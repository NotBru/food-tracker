package app.foodtracker.ui

import android.graphics.BitmapFactory
import android.util.Base64
import android.util.LruCache
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.NotePic
import app.foodtracker.NoteRow
import app.foodtracker.NotesView
import app.foodtracker.SaveReply
import app.foodtracker.bridgeJson
import app.foodtracker.get
import app.foodtracker.js
import app.foodtracker.jsOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlin.math.abs

// Temp notes, native: a port of app/src/screens/Notes.jsx (data: core.js notes; saving: app/src/notes.js). Pictures
// are taken or picked here, shrunk and kept by the web app, and come back as JPEG to show.

/** What the notes screen needs of the phone: a picture from the camera or the gallery ([(address, name)]). */
fun interface PicturePicker {
    fun pick(camera: Boolean, onPicked: (List<Pair<String, String>>) -> Unit)
}

/** The pictures shown, decoded once: a note's pictures don't change (a new one gets a new id). */
private object Pictures {
    private val cache = object : LruCache<String, ImageBitmap>(48 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap) = value.width * value.height * 4
    }

    /** Picture `id` at most about `side` px on its long side (0: as it is); null if it isn't on this device yet. */
    suspend fun load(core: Core, id: String, side: Int): ImageBitmap? {
        val key = "$id@$side"
        cache.get(key)?.let { return it }
        val b64 = (core.call("notePicture", JsonPrimitive(id)) as? JsonPrimitive)?.contentOrNull ?: return null
        val img = withContext(Dispatchers.Default) {
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            var sample = 1
            if (side > 0) while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= side) sample *= 2
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
        } ?: return null
        cache.put(key, img)
        return img
    }
}

/** A picture, or "…" while it isn't on this device (it comes with the next sync). `.note-pic`: 72 dp, cropped. */
@Composable
private fun Picture(core: Core, pic: NotePic, modifier: Modifier = Modifier.size(72.dp), full: Boolean = false, onClick: (() -> Unit)? = null) {
    val img by produceState<ImageBitmap?>(null, pic.ref, pic.have) { value = if (pic.have) Pictures.load(core, pic.ref, if (full) 0 else 256) else null }
    val m = modifier.clip(RoundedCornerShape(12.dp)).let { if (onClick != null) it.clickable(onClick = onClick) else it }
    val i = img
    if (i == null) Box(m.background(C.panel2), contentAlignment = Alignment.Center) { Text("…", color = C.muted) }
    else Image(i, pic.name ?: "", m, contentScale = if (full) ContentScale.Fit else ContentScale.Crop)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NotesScreen(view: NotesView?, core: Core, picker: PicturePicker, editing: JsonObject?, onEdit: (JsonObject?) -> Unit) {
    var viewing by remember { mutableStateOf<Pair<List<NotePic>, Int>?>(null) }
    // Saves outlive the editor (it closes at once): their failures are told here.
    val saving = rememberCoroutineScope()
    var failed by remember { mutableStateOf<Asking?>(null) }
    Box(Modifier.fillMaxSize()) {
        ScreenFrame("Temp notes", view?.user, onBack = core::back) {
            if (view == null) return@ScreenFrame
            Muted(view.keep, size = 13.sp)
            AddRow("+ add note", { onEdit(js("userId" to view.userId, "text" to "", "pictures" to emptyList<String>(), "pictureNames" to emptyMap<String, String>())) })
            for (row in view.rows) NoteCard(row, core, { onEdit(row.note) }) { i -> viewing = row.pics to i }
        }
        if (editing != null) NoteEditor(editing, view?.rows?.firstOrNull { it.note["id"] == editing["id"] }, core, picker, saving, { failed = Asking(it) },
            { onEdit(null) }) { pics, i -> viewing = pics to i }
        viewing?.let { (pics, at) -> Viewer(core, pics, at) { viewing = null } }
    }
    failed?.Show { failed = null }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NoteCard(row: NoteRow, core: Core, onOpen: () -> Unit, onView: (Int) -> Unit) {
    ListCard(onOpen) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(buildAnnotatedString {
                append(row.`when`)
                if (row.done) withStyle(SpanStyle(color = C.kcal)) { append(" · ✓ done") }
            }, color = C.muted, fontSize = 16.sp, maxLines = 1)
            Text(row.left, color = C.muted, fontSize = 13.sp, maxLines = 1)
        }
        val dim = Modifier.alpha(if (row.done) 0.55f else 1f)
        if (row.text.isNotEmpty()) Text(row.text, dim, color = C.text, fontSize = 16.sp)
        if (row.pics.isNotEmpty()) FlowRow(dim, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            row.pics.forEachIndexed { i, p -> Picture(core, p) { onView(i) } }
        }
    }
}

/**
 * A note's text and pictures. A new one is stamped with the time it's saved; an edited one keeps its time. Save
 * closes it at once: the note is saved (and synced) behind, in `saving`; a failure is told with `onFailed`.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NoteEditor(note: JsonObject, row: NoteRow?, core: Core, picker: PicturePicker, saving: CoroutineScope, onFailed: (String) -> Unit,
                       onClose: () -> Unit, onView: (List<NotePic>, Int) -> Unit) {
    val isNew = note["id"] == null
    var text by remember(note) { mutableStateOf((note["text"] as? JsonPrimitive)?.contentOrNull ?: "") }
    var done by remember(note) { mutableStateOf((note["done"] as? JsonPrimitive)?.contentOrNull == "true") }
    var pics by remember(note) { mutableStateOf(row?.pics ?: emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    val scope = rememberCoroutineScope()
    fun pick(camera: Boolean) = picker.pick(camera) { files ->
        if (files.isEmpty()) return@pick
        busy = true
        scope.launch {
            runCatching {
                core.get(ListSerializer(NotePic.serializer()), "notePick", jsOf(files.map { (url, name) -> mapOf("url" to url, "name" to name) }))
            }.onSuccess { pics = pics + it }.onFailure { ask = Asking(it.message ?: "Couldn't add it.") }
            busy = false
        }
    }
    fun save() {
        if (text.isBlank() && pics.isEmpty()) { ask = Asking("Write something or add a picture."); return }
        val args = arrayOf(note, JsonPrimitive(text), JsonPrimitive(done), bridgeJson.encodeToJsonElement(ListSerializer(NotePic.serializer()), pics))
        onClose()
        saving.launch {
            val r = runCatching { core.get(SaveReply.serializer(), "saveNote", *args) }.getOrElse { SaveReply(alert = "Couldn't save the note: ${it.message}") }
            r.alert?.let(onFailed)
        }
    }
    SheetOverlay(onClose) {
        SheetTitle(if (isNew) "New note" else row?.title ?: "Note")
        TextBox(text, { text = it }, Modifier.heightIn(min = 112.dp), placeholder = "What it's about…", singleLine = false,
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp))
        if (pics.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            pics.forEachIndexed { i, p ->
                Box {
                    Picture(core, p) { onView(pics, i) }
                    Box(Modifier.align(Alignment.TopEnd).offset(6.dp, (-6).dp).size(26.dp).clip(Pill).background(C.panel2)
                        .clickable { pics = pics.filterIndexed { j, _ -> j != i } }, contentAlignment = Alignment.Center) {
                        Text("×", color = C.text, fontSize = 16.sp)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PillButton("📷 Camera", { pick(true) }, Modifier.weight(1f), bg = C.panel, fg = C.text, enabled = !busy)
            PillButton("🖼️ Gallery", { pick(false) }, Modifier.weight(1f), bg = C.panel, fg = C.text, enabled = !busy)
        }
        SwitchRow("Done", "Taken care of: logged, or nothing to log. The log-food skill skips it, and marks the notes it logs.", done) { done = it }
        SheetActions(if (busy) "…" else "Save", ::save, onClose, enabled = !busy, onDelete = if (isNew) null else ({
            ask = Asking("Delete this note?", "Delete") { scope.launch { runCatching { core.call("deleteNote", note) }; onClose() } }
        }))
    }
    ask?.Show { ask = null }
}

/** `.switch-list` row: a name, a line about it, and its switch on the right. In a panel of its own. */
@Composable
fun SwitchRow(title: String, about: String?, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    SwitchPanel { SwitchItem(title, about, checked, enabled, onChange) }
}

@Composable
fun SwitchPanel(bg: Color = C.panel, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(bg).padding(horizontal = 14.dp, vertical = 4.dp)) { content() }
}

@Composable
fun SwitchItem(title: String, about: String?, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(enabled = enabled) { onChange(!checked) }.padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = C.text, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            if (about != null) Text(about, color = C.muted, fontSize = 13.sp)
        }
        Switch(checked, onChange, enabled = enabled, colors = SwitchDefaults.colors(checkedTrackColor = C.accent, checkedThumbColor = C.onAccent,
            uncheckedTrackColor = C.line, uncheckedThumbColor = C.muted, uncheckedBorderColor = Color.Transparent))
    }
}

/** A note's pictures full screen, from `at`: a swipe goes through them, a tap or back closes. */
@Composable
private fun Viewer(core: Core, pics: List<NotePic>, at: Int, onClose: () -> Unit) {
    var i by remember(pics) { mutableStateOf(at) }
    BackHandler(onBack = onClose)
    Box(
        Modifier.fillMaxSize().background(Color(0xEE000000)).padding(16.dp)
            .pointerInput(pics) {
                var dx = 0f
                detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = {
                    if (abs(dx) >= 40.dp.toPx()) i = (i + if (dx < 0) 1 else -1).coerceIn(0, pics.size - 1)
                }) { _, d -> dx += d }
            }
            .pointerInput(Unit) { detectTapGestures { onClose() } }
            .clickable(remember { MutableInteractionSource() }, null) {},
        contentAlignment = Alignment.Center,
    ) {
        Picture(core, pics[i], Modifier.fillMaxSize(), full = true)
        if (pics.size > 1) Text("${i + 1} / ${pics.size}", Modifier.align(Alignment.BottomCenter).clip(RoundedCornerShape(12.dp))
            .background(Color(0xAA000000)).padding(horizontal = 10.dp, vertical = 2.dp), color = Color.White, fontSize = 14.sp)
    }
}
