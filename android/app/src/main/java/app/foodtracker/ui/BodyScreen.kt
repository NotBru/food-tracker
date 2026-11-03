@file:OptIn(ExperimentalFoundationApi::class)

package app.foodtracker.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.BodyEditorView
import app.foodtracker.BodyExtra
import app.foodtracker.BodySaveReply
import app.foodtracker.BodyView
import app.foodtracker.Core
import app.foodtracker.NameHint
import app.foodtracker.ValueDelta
import app.foodtracker.bridgeJson
import app.foodtracker.get
import app.foodtracker.js
import app.foodtracker.jsOf
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Body measurements, native: a port of app/src/screens/Body.jsx (data: core.js body; saving: app/src/forms.js).

@Composable
fun BodyScreen(view: BodyView?, core: Core, editing: JsonObject?, onEdit: (JsonObject?) -> Unit) {
    Box(Modifier.fillMaxSize()) {
        ScreenFrame("Body measurements", view?.user, onBack = core::back) {
            if (view == null) return@ScreenFrame
            Column(Modifier.padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Muted("7-day averages", size = 13.sp)
                for (w in view.weeks) Text(buildAnnotatedString {
                    withStyle(SpanStyle(color = C.muted)) { append("${w.label} · ") }
                    if (w.value == null) withStyle(SpanStyle(color = C.muted)) { append("none this week") }
                    else {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(w.value) }
                        append(" ${w.unit}")
                        w.pm?.let { withStyle(SpanStyle(color = C.muted)) { append(" $it") } }
                    }
                }, color = C.text)
                val m = view.maint
                if (m.need != null) Muted(m.need, size = 16.sp)
                else {
                    Text(buildAnnotatedString {
                        withStyle(SpanStyle(color = C.muted)) { append("Maintenance ≈ ") }
                        withStyle(SpanStyle(color = C.kcal, fontWeight = FontWeight.Bold)) { append(m.value ?: "") }
                        append(" kcal/day")
                        withStyle(SpanStyle(color = C.muted)) { append(" (${m.range})") }
                    }, color = C.text)
                    Muted(m.detail ?: "", size = 13.sp)
                }
            }
            AddRow("+ add measurements", { onEdit(newBodyEntry(view)) })
            for (r in view.rows) ListCard({ onEdit(r.entry) }) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(r.text, Modifier.weight(1f), color = C.text, fontWeight = FontWeight.Bold)
                    Text(r.`when`, color = C.muted)
                }
            }
        }
        if (editing != null && view != null) BodyEditor(core, editing, view) { onEdit(null) }
    }
}

/** Body.jsx newEntry: now, this user, nothing measured yet. */
fun newBodyEntry(view: BodyView) = js("datetime" to java.time.Instant.now().toString(), "userId" to view.userId, "values" to emptyMap<String, Any>())

/**
 * An entry: a value and ± Δ per built-in field, any other measurement added like an attribute (name, unit, value,
 * ± Δ), and a time. Names are looked up among those used before as they're typed; one that looks like a typo of a
 * known one asks first.
 */
@Composable
private fun BodyEditor(core: Core, entry: JsonObject, view: BodyView, onClose: () -> Unit) {
    val start by produceState<BodyEditorView?>(null, entry) { value = runCatching { core.get(BodyEditorView.serializer(), "bodyEditor", entry) }.getOrNull() }
    val s = start ?: return
    var texts by remember(s) { mutableStateOf(s.texts) }
    var extra by remember(s) { mutableStateOf(s.extra) }
    var datetime by remember(s) { mutableStateOf(s.datetime) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    val scope = rememberCoroutineScope()
    val isNew = entry["id"] == null
    val amounts = view.fields.map { texts[it.key]?.value ?: "" } + extra.map { it.value }
    val placeholders by produceState(emptyList<String>(), amounts) {
        value = runCatching { core.get(ListSerializer(String.serializer()), "deltaPlaceholders", jsOf(amounts)) }.getOrDefault(value)
    }
    fun save(answers: Map<String, Boolean> = emptyMap()): Unit { scope.launch {
        val form = js(
            "texts" to bridgeJson.encodeToJsonElement(MapSerializer(String.serializer(), ValueDelta.serializer()), texts),
            "extra" to bridgeJson.encodeToJsonElement(ListSerializer(BodyExtra.serializer()), extra),
            "datetime" to datetime,
        )
        val r = runCatching { core.get(BodySaveReply.serializer(), "saveBody", entry, form, view.known, jsOf(answers)) }
            .getOrElse { BodySaveReply(alert = "Couldn't save: ${it.message}") }
        when {
            r.alert != null -> ask = Asking(r.alert)
            r.ask != null -> ask = Asking(r.ask.text, "Use “${r.ask.near}”", onCancel = { save(answers + (r.ask.label to false)) }) { save(answers + (r.ask.label to true)) }
            else -> onClose()
        }
    } }
    val small = PaddingValues(horizontal = 12.dp, vertical = 9.dp)
    val style = TextStyle(color = C.text, fontSize = 14.sp)
    SheetOverlay(onClose) {
        SheetTitle(s.title)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.weight(1f))
                Text("value", Modifier.width(92.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
                Text("± Δ", Modifier.width(80.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
            }
            view.fields.forEachIndexed { i, f ->
                val t = texts[f.key] ?: ValueDelta()
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(buildAnnotatedString {
                            append(f.label)
                            withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" ${f.unit}") }
                        }, color = C.text, fontSize = 14.sp)
                        f.hint?.let { Muted(it, size = 12.sp) }
                    }
                    TextBox(t.value, { texts = texts + (f.key to t.copy(value = it)) }, Modifier.width(92.dp), decimal = true, contentPadding = small, textStyle = style,
                        placeholder = if (isNew) f.last else null)
                    DeltaBox(t.delta, placeholders.getOrNull(i) ?: "auto", { texts = texts + (f.key to t.copy(delta = it)) }, Modifier.width(80.dp), small = true)
                }
            }
            if (extra.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((label, w) in listOf("name" to 0f, "unit" to 48f, "value" to 60f, "± Δ" to 76f)) Text(label, if (w == 0f) Modifier.weight(1f) else Modifier.width(w.dp),
                    color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
                Box(Modifier.width(34.dp))
            }
            extra.forEachIndexed { i, x ->
                fun setX(nx: BodyExtra) { extra = extra.mapIndexed { j, y -> if (j == i) nx else y } }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Top) {
                    Box(Modifier.weight(1f)) { NameCombo(core, x.label, view, { setX(x.copy(label = it)) }) { n -> setX(x.copy(label = n.label, unit = x.unit.ifEmpty { n.unit })) } }
                    TextBox(x.unit, { setX(x.copy(unit = it)) }, Modifier.width(48.dp), placeholder = "unit", capitalize = false, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 9.dp), textStyle = style)
                    TextBox(x.value, { setX(x.copy(value = it)) }, Modifier.width(60.dp), decimal = true, contentPadding = small, textStyle = style)
                    DeltaBox(x.delta, placeholders.getOrNull(view.fields.size + i) ?: "auto", { setX(x.copy(delta = it)) }, Modifier.width(76.dp), small = true)
                    SmallIconButton("Remove", { extra = extra.filterIndexed { j, _ -> j != i } }) { Text("×", color = C.text, fontSize = 16.sp) }
                }
            }
            LinkButton("+ measurement", { extra = extra + BodyExtra() })
        }
        Field("Time") { DateTimeBox(datetime) { datetime = it } }
        SheetActions("Save", { save() }, onClose, onDelete = if (isNew) null else ({
            ask = Asking("Delete these measurements?", "Delete") { scope.launch { runCatching { core.call("deleteBody", entry["id"]!!) }; onClose() } }
        }))
    }
    ask?.Show { ask = null }
}

/** Body.jsx NameCombo: a measurement's name, with the names used before listed under it as it's typed. */
@Composable
private fun NameCombo(core: Core, text: String, view: BodyView, onChange: (String) -> Unit, onPick: (NameHint) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val hints by produceState(emptyList<NameHint>(), text, open) {
        if (open) value = runCatching { core.get(ListSerializer(NameHint.serializer()), "bodyNames", JsonPrimitive(text), view.known) }.getOrDefault(emptyList())
    }
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    // The list comes up under the box: brought into view, above the keyboard.
    val shown = remember { BringIntoViewRequester() }
    LaunchedEffect(hints.isNotEmpty() && open) { if (open && hints.isNotEmpty()) { delay(400); shown.bringIntoView() } }
    Column(Modifier.bringIntoViewRequester(shown)) {
        TextBox(text, onChange, placeholder = "name", onFocus = { open = it }, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 9.dp),
            textStyle = TextStyle(color = C.text, fontSize = 14.sp))
        if (open && hints.isNotEmpty()) PickerList(hints.size, "") { i ->
            val n = hints[i]
            PickerRow(i == 0, { onPick(n); focus.clearFocus() }) {
                Text(buildAnnotatedString {
                    if (n.near) withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append("did you mean ") }
                    append(n.label)
                    if (n.unit.isNotEmpty()) withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" · ${n.unit}") }
                }, color = C.text, fontSize = 14.sp)
            }
        }
    }
}
