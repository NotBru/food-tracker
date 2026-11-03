@file:OptIn(ExperimentalFoundationApi::class)

package app.foodtracker.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.DetailRow
import app.foodtracker.FoodLabel
import app.foodtracker.MacroLine
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import java.util.Calendar

// The web app's screen parts and form controls (components.jsx, styles.css), for the native screens: the top bar,
// list cards, sheets, text boxes, the food picker, units, ± Δ, entry errors, dates.

// --- Screens --------------------------------------------------------------------------------------------------

/** components.jsx Screen: ‹, the title (and subtitle) centred, something on the right; under it the screen's content. */
@Composable
fun TopBar(title: String, subtitle: String? = null, onBack: (() -> Unit)?, right: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(48.dp)) { if (onBack != null) RoundIconButton("Back", onBack) { Chevron() } }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, color = C.text, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 2)
            if (subtitle != null) Text(subtitle, color = C.muted, fontSize = 13.sp, textAlign = TextAlign.Center, maxLines = 1)
        }
        Box(Modifier.width(48.dp), contentAlignment = Alignment.CenterEnd) { right?.invoke() }
    }
}

/** A screen: top bar, then its content scrolling under it (the web's `main`: 16 dp sides, 32 below). */
@Composable
fun ScreenFrame(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)?,
    right: (@Composable () -> Unit)? = null,
    gap: Dp = 8.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize().background(C.bg)) {
        TopBar(title, subtitle, onBack, right)
        Column(
            Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(gap),
        ) { content() }
    }
}

/** The web's `.list li`: a panel card; tapped, `onClick`. With `onDelete`, a trash button on its right. */
@Composable
fun ListCard(onClick: (() -> Unit)?, onDelete: (() -> Unit)? = null, deleteLabel: String = "Delete", content: @Composable ColumnScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(C.panel)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(start = 18.dp, end = if (onDelete != null) 10.dp else 18.dp, top = 14.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { content() }
        if (onDelete != null) {
            Box(Modifier.size(40.dp).clip(Pill).background(C.bg).clickable(role = Role.Button, onClick = onDelete)
                .semantics { contentDescription = deleteLabel }, contentAlignment = Alignment.Center) { TrashIcon() }
        }
    }
}

/** The web's `.list li.add`: "+ add …", dashed. */
@Composable
fun AddRow(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).dashedBorder(C.line, 22.dp).clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, color = C.accent, fontWeight = FontWeight.SemiBold, fontSize = 16.sp) }
}

fun Modifier.dashedBorder(color: Color, radius: Dp, width: Dp = 2.dp) = drawBehind {
    val w = width.toPx()
    drawRoundRect(
        color, topLeft = Offset(w / 2, w / 2), size = size.copy(size.width - w, size.height - w),
        cornerRadius = CornerRadius(radius.toPx()), style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3 * w, 3 * w))),
    )
}

/** A label and the row under it: "Read ‹text› · ‹muted›" lines of list cards. */
@Composable
fun MainLine(text: String, right: String? = null, tag: String? = null, color: Color = C.text) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(text, color = color, fontSize = 16.sp, modifier = Modifier.weight(1f, fill = false))
            if (tag != null) Tag(tag)
        }
        if (right != null) Text(right, color = C.muted, fontSize = 16.sp)
    }
}

/** `.tag` (a concoction's made-at time, "made 2026-11-01 13:00"). */
@Composable
fun Tag(text: String, color: Color = C.muted) =
    Text(text, Modifier.clip(Pill).background(C.bg).padding(horizontal = 8.dp), color = color, fontSize = 12.sp, maxLines = 1)

private val trash = svgPath("M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5")

@Composable
fun TrashIcon(color: Color = C.muted) = Canvas(Modifier.size(18.dp)) {
    scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) {
        drawPath(trash, color, style = Stroke(width = 2.2f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** components.jsx MacroLine, from core.js macroLine. */
@Composable
fun MacroText(m: MacroLine?, size: TextUnit = 13.sp) {
    if (m == null) return
    if (!m.ok) return Text("can't compute (unit conversion missing?)", color = C.warn, fontSize = size)
    Text(macroString(m), fontSize = size, color = C.text)
}

fun macroString(m: MacroLine): AnnotatedString = buildAnnotatedString {
    m.parts.forEachIndexed { i, p ->
        if (i > 0) append(" · ")
        withStyle(SpanStyle(color = C.ofClass(p.color), fontWeight = FontWeight.SemiBold)) {
            append(p.text)
            if (p.pm != null) withStyle(SpanStyle(fontWeight = FontWeight.Normal, color = C.ofClass(p.color).copy(alpha = 0.75f))) { append(" ${p.pm}") }
            append(p.after)
        }
    }
}

/** Consumptions.jsx NutrientDetails: "▸ Details", opening every nutrient known. */
@Composable
fun DetailsDropdown(rows: List<DetailRow>) {
    var open by remember { mutableStateOf(false) }
    Column {
        Text("${if (open) "▾" else "▸"} Details", Modifier.clickable { open = !open }.padding(vertical = 4.dp), color = C.accent, fontWeight = FontWeight.Medium)
        if (open) {
            Column(Modifier.padding(top = 4.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(C.panel).padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (rows.isEmpty()) Text("No nutrients known", color = C.muted, fontSize = 14.sp)
                rows.forEachIndexed { i, r ->
                    if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(C.line))
                    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(r.label, color = C.text, fontSize = 14.sp)
                        Text(buildAnnotatedString {
                            append(r.value)
                            withStyle(SpanStyle(color = C.text.copy(alpha = 0.75f), fontSize = 12.sp)) { append(" ${r.pm}") }
                            append(" ${r.unit}")
                            if (r.missing) withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" +?") }
                        }, color = C.text, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

// --- Sheets ---------------------------------------------------------------------------------------------------

/**
 * The web's `.modal` + `.sheet`, drawn over the screen (not a window of its own, so the keyboard pushes it up like the
 * rest of the app): dimmed backdrop, rounded top, scrolling. Back or a tap outside: `onDismiss`.
 */
@Composable
fun SheetOverlay(onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    BackHandler(onBack = onDismiss)
    BoxWithConstraints(
        Modifier.fillMaxSize().background(Color(0xAA000000))
            .clickable(remember { MutableInteractionSource() }, indication = null, onClick = onDismiss),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(
            Modifier.widthIn(max = 480.dp).fillMaxWidth().heightIn(max = maxHeight * 0.9f)
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)).background(C.bg)
                .clickable(remember { MutableInteractionSource() }, indication = null) {}
                .verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.align(Alignment.CenterHorizontally).size(40.dp, 5.dp).clip(Pill).background(C.line))
            content()
        }
    }
}

@Composable
fun SheetTitle(text: String) = Text(text, color = C.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)

/** `.row.actions`: Delete on the left (if any), then Cancel and the main button. */
@Composable
fun SheetActions(save: String, onSave: () -> Unit, onCancel: () -> Unit, onDelete: (() -> Unit)? = null, enabled: Boolean = true, deleteLabel: String = "Delete") {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (onDelete != null) PillButton(deleteLabel, onDelete, Modifier.weight(if (deleteLabel.length > 8) 1.5f else 1f), bg = C.danger, fg = Color.White, padding = PaddingValues(vertical = 12.dp))
        PillButton("Cancel", onCancel, Modifier.weight(1f), bg = C.panel, fg = C.text, padding = PaddingValues(vertical = 12.dp))
        PillButton(save, onSave, Modifier.weight(1f), enabled = enabled, padding = PaddingValues(vertical = 12.dp))
    }
}

// --- Form controls --------------------------------------------------------------------------------------------

/** `.field`: a muted label over its control. */
@Composable
fun Field(label: String, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, color = C.muted, fontSize = 14.sp)
        content()
    }
}

/**
 * The web's `input`: a pill, panel-coloured, an accent border while focused (red if `invalid`). `leading`: a muted
 * mark inside on the left ("±"). `decimal`: the number keyboard.
 */
@Composable
fun TextBox(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    decimal: Boolean = false,
    numeric: Boolean = false,
    invalid: Boolean = false,
    enabled: Boolean = true,
    leading: String? = null,
    bg: Color = C.panel,
    singleLine: Boolean = true,
    capitalize: Boolean = true,
    focusRequester: FocusRequester? = null,
    onFocus: (Boolean) -> Unit = {},
    imeAction: ImeAction = ImeAction.Next,
    onDone: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    textStyle: TextStyle = TextStyle(color = C.text, fontSize = 16.sp),
    placeholderColor: Color = C.muted,
) {
    var focused by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    BasicTextField(
        value, onChange,
        modifier.fillMaxWidth()
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { if (it.isFocused != focused) { focused = it.isFocused; onFocus(it.isFocused) } },
        enabled = enabled,
        singleLine = singleLine,
        textStyle = textStyle,
        cursorBrush = SolidColor(C.accent),
        keyboardOptions = KeyboardOptions(
            capitalization = if (capitalize && !decimal && !numeric) KeyboardCapitalization.Sentences else KeyboardCapitalization.None,
            keyboardType = when { decimal -> KeyboardType.Decimal; numeric -> KeyboardType.Number; else -> KeyboardType.Text },
            imeAction = if (onDone != null) ImeAction.Done else imeAction,
        ),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() ?: focus.clearFocus() }),
        decorationBox = { inner ->
            Row(
                Modifier.clip(if (singleLine) Pill else RoundedCornerShape(20.dp)).background(bg)
                    .border(1.dp, when { invalid -> C.prot; focused -> C.accent; else -> Color.Transparent }, if (singleLine) Pill else RoundedCornerShape(20.dp))
                    .alpha(if (enabled) 1f else 0.5f).padding(contentPadding),
                verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
            ) {
                if (leading != null) Text(leading, color = C.muted, fontSize = textStyle.fontSize, modifier = Modifier.padding(end = 6.dp))
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty() && placeholder != null) Text(placeholder, color = placeholderColor, fontSize = textStyle.fontSize, maxLines = 1)
                    inner()
                }
            }
        },
    )
}

/** components.jsx DeltaInput: "± Δ", blank meaning the error from the digits (the placeholder). */
@Composable
fun DeltaBox(value: String, placeholder: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, bg: Color = C.panel, small: Boolean = false) =
    TextBox(value, onChange, modifier, placeholder = placeholder, decimal = true, leading = "±", bg = bg,
        contentPadding = if (small) PaddingValues(start = 10.dp, end = 8.dp, top = 9.dp, bottom = 9.dp) else PaddingValues(start = 12.dp, end = 10.dp, top = 12.dp, bottom = 12.dp),
        textStyle = TextStyle(color = C.text, fontSize = if (small) 14.sp else 16.sp))

/** `.check`: a tick box and its muted label. */
@Composable
fun CheckRow(checked: Boolean, label: String, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onChange, colors = CheckboxDefaults.colors(checkedColor = C.accent, uncheckedColor = C.muted, checkmarkColor = C.onAccent))
        Text(label, color = C.muted, fontSize = 14.sp)
    }
}

/** A dropdown list under a box (`.picker-list`): rows, the first highlighted (the one Enter picks), or `empty`. */
@Composable
fun PickerList(count: Int, empty: String, row: @Composable (Int) -> Unit) {
    Column(
        Modifier.padding(top = 6.dp).fillMaxWidth().heightIn(max = 260.dp).clip(RoundedCornerShape(20.dp)).background(C.panel)
            .border(1.dp, C.line, RoundedCornerShape(20.dp)).verticalScroll(rememberScrollState()).padding(6.dp),
    ) {
        if (count == 0) Text(empty, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), color = C.muted)
        for (i in 0 until count) row(i)
    }
}

@Composable
fun PickerRow(active: Boolean, onPick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .let { if (active) it.background(C.bg).border(1.dp, C.accent, RoundedCornerShape(14.dp)) else it }
            .clickable(onClick = onPick).padding(horizontal = 14.dp, vertical = 10.dp),
    ) { content() }
}

/**
 * components.jsx ItemPicker: one search box over every food. Focused, it lists what `search` finds for what's typed
 * (the web app's own ranking, core.js foodSearch); tapping one (or the keyboard's Done, for the first) picks it.
 * `onCreate`: a + beside it, to make a new food from what's typed.
 */
@Composable
fun FoodPicker(
    picked: FoodLabel?,
    search: suspend (String) -> List<FoodLabel>,
    onPick: (String) -> Unit,
    bg: Color = C.panel,
    onCreate: ((String) -> Unit)? = null,
) {
    var query by remember { mutableStateOf<String?>(null) } // null = closed
    var hits by remember { mutableStateOf<List<FoodLabel>>(emptyList()) }
    val focus = LocalFocusManager.current
    LaunchedEffect(query) {
        val q = query ?: return@LaunchedEffect
        try { hits = search(q) } catch (e: CancellationException) { throw e } catch (_: Exception) { hits = emptyList() }
    }
    fun pick(f: FoodLabel) {
        onPick(f.id)
        focus.clearFocus()
    }
    val view = remember { BringIntoViewRequester() }
    LaunchedEffect(hits, query != null) { if (query != null) { delay(150); view.bringIntoView() } }
    Column(Modifier.bringIntoViewRequester(view)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            TextBox(query ?: picked?.label ?: "", { query = it }, Modifier.weight(1f), placeholder = "Search foods…", bg = bg,
                onFocus = { query = if (it) "" else null }, onDone = { hits.firstOrNull()?.let(::pick) ?: focus.clearFocus() })
            if (onCreate != null) RoundIconButton("New food", { onCreate((query ?: "").trim()) }) { Text("+", color = C.accent, fontSize = 22.sp) }
        }
        if (query == null) picked?.made?.let { Box(Modifier.padding(start = 12.dp, top = 6.dp)) { Tag(it) } }
        else PickerList(hits.size, "No match") { i ->
            val f = hits[i]
            PickerRow(i == 0, { pick(f) }) {
                Text(buildAnnotatedString {
                    append(f.label)
                    if (f.recipe) withStyle(SpanStyle(color = C.muted, fontSize = 13.sp)) { append(" · recipe") }
                }, color = C.text)
            }
            if (f.made != null) Box(Modifier.padding(start = 14.dp, bottom = 4.dp)) { Tag(f.made) }
        }
    }
}

/**
 * components.jsx UnitCombo: free text, suggesting the units the food converts to (`units`, its own first); null until a
 * food is picked.
 */
@Composable
fun UnitCombo(units: List<String>?, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, bg: Color = C.panel) {
    if (units == null) return TextBox("", {}, modifier, placeholder = "pick a food first", enabled = false, bg = bg)
    var open by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val q = value.trim().lowercase()
    val matches = if (q in units) listOf(q) + units.filter { it != q } else units.filter { q in it }
    val view = remember { BringIntoViewRequester() }
    LaunchedEffect(open) { if (open) { delay(150); view.bringIntoView() } }
    Column(modifier.bringIntoViewRequester(view)) {
        TextBox(value, onChange, placeholder = units.firstOrNull() ?: "unit", bg = bg, capitalize = false, onFocus = { open = it },
            onDone = { matches.firstOrNull()?.let(onChange); focus.clearFocus() })
        if (open) PickerList(matches.size, "No conversion to “$value” for this food") { i ->
            PickerRow(i == 0, { onChange(matches[i]); focus.clearFocus() }) { Text(matches[i], color = C.text) }
        }
    }
}

/**
 * components.jsx EntryErrorButton: "ε 10%"; tapped, a box (in %), kept on Done or when left. A blank or not a number
 * keeps the old value.
 */
@Composable
fun EntryErrorChip(pct: String, onChange: (Double) -> Unit, bg: Color = C.panel) {
    var editing by remember { mutableStateOf<String?>(null) }
    val requester = remember { FocusRequester() }
    val text = editing
    if (text == null) {
        PillButton("ε $pct%", { editing = pct }, bg = bg, fg = C.text, padding = PaddingValues(horizontal = 12.dp, vertical = 12.dp), fontSize = 14.sp)
        return
    }
    fun done() {
        val x = text.trim().replace(',', '.').toDoubleOrNull()
        if (text.isNotBlank() && x != null && x >= 0) onChange(x / 100)
        editing = null
    }
    TextBox(text, { editing = it }, Modifier.width(72.dp), decimal = true, bg = bg, focusRequester = requester,
        onFocus = { if (!it) done() }, onDone = ::done, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp))
    LaunchedEffect(Unit) { requester.requestFocus() }
}

/** components.jsx AttributesEditor: key and value rows, "+ attribute". */
@Composable
fun AttributesEditor(value: List<Pair<String, String>>, onChange: (List<Pair<String, String>>) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        value.forEachIndexed { i, (k, v) ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TextBox(k, { t -> onChange(value.mapIndexed { j, p -> if (j == i) t to p.second else p }) }, Modifier.weight(1f), placeholder = "key")
                TextBox(v, { t -> onChange(value.mapIndexed { j, p -> if (j == i) p.first to t else p }) }, Modifier.weight(1f), placeholder = "value")
                RoundIconButton("Remove", { onChange(value.filterIndexed { j, _ -> j != i }) }) { Text("×", color = C.text, fontSize = 20.sp) }
            }
        }
        Text("+ attribute", Modifier.clickable { onChange(value + ("" to "")) }.padding(vertical = 4.dp), color = C.accent, fontWeight = FontWeight.Medium)
    }
}

private val DATETIME = Regex("""^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$""")

/** "YYYY-MM-DD HH:MM" typed -> "YYYY-MM-DDTHH:MM", or null if it isn't a real date and time (components.jsx). */
fun parseDateTime(t: String): String? {
    val m = DATETIME.matchEntire(t.trim()) ?: return null
    val (y, mo, d, h, mi) = m.destructured
    val cal = Calendar.getInstance().apply { isLenient = false; set(y.toInt(), mo.toInt() - 1, d.toInt(), h.toInt(), mi.toInt()) }
    return runCatching { cal.time; if (h.toInt() < 24 && mi.toInt() < 60) "$y-$mo-${d}T${h.padStart(2, '0')}:$mi" else null }.getOrNull()
}

/**
 * components.jsx DateTimeInput: typed "YYYY-MM-DD HH:MM" (the phone's locale would show another format), marked while
 * not a valid date and back to the last valid one when left; 📅 picks it. `value`, `onChange`: "YYYY-MM-DDTHH:MM".
 */
@Composable
fun DateTimeBox(value: String, onChange: (String) -> Unit) {
    var text by remember(value) { mutableStateOf(value.replace('T', ' ')) }
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        TextBox(text, { t -> text = t; parseDateTime(t)?.let(onChange) }, Modifier.weight(1f), placeholder = "YYYY-MM-DD HH:MM",
            numeric = true, invalid = parseDateTime(text) == null, onFocus = { if (!it) text = value.replace('T', ' ') })
        SmallIconButton("Pick date and time", {
            val cur = parseDateTime(value) ?: value
            val (date, time) = cur.split('T').let { it[0] to it.getOrElse(1) { "12:00" } }
            pickDate(context, date) { d ->
                val (h, mi) = time.split(':').map { it.toInt() }
                TimePickerDialog(context, { _, hh, mm -> onChange("${d}T${"%02d".format(hh)}:${"%02d".format(mm)}") }, h, mi, true).show()
            }
        }) { Text("📅", fontSize = 16.sp) }
    }
}

/** The phone's date picker, from `day` ("YYYY-MM-DD"); `onPick` gets the day picked. */
fun pickDate(context: android.content.Context, day: String, onPick: (String) -> Unit) {
    val (y, m, d) = day.split('-').map { it.toInt() }
    DatePickerDialog(context, { _, yy, mm, dd -> onPick("%04d-%02d-%02d".format(yy, mm + 1, dd)) }, y, m - 1, d).show()
}

/** `button.icon.small`: 34 dp. */
@Composable
fun SmallIconButton(label: String, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Box(
        Modifier.size(34.dp).clip(Pill).background(C.panel).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { icon() }
}

/** `button.link`: accent text. */
@Composable
fun LinkButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = C.accent) =
    Text(text, modifier.clickable(onClick = onClick).padding(vertical = 4.dp), color = color, fontWeight = FontWeight.Medium)

@Composable
fun H3(text: String) = Text(text, Modifier.padding(top = 8.dp), color = C.text, fontSize = 16.sp, fontWeight = FontWeight.Bold)

@Composable
fun Gap(h: Dp) = Spacer(Modifier.height(h))

/** `.segmented`: pill tabs, the one on in accent. */
@Composable
fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().clip(Pill).background(C.panel).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEachIndexed { i, o ->
            val on = i == selected
            Box(Modifier.weight(1f).clip(Pill).background(if (on) C.accent else Color.Transparent).clickable(role = Role.Tab) { onSelect(i) }
                .padding(10.dp), contentAlignment = Alignment.Center) {
                Text(o, color = if (on) C.onAccent else C.muted, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1)
            }
        }
    }
}

/**
 * components.jsx Select, as on a phone (a dropdown of every option): a box showing the choice; tapped, a sheet lists
 * the options under their groups, with a search box (every word, as on a computer).
 */
@Composable
fun SelectBox(label: String, options: List<app.foodtracker.SelectOption>, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, searchable: Boolean = true) {
    var open by remember { mutableStateOf(false) }
    Row(
        modifier.fillMaxWidth().clip(Pill).background(C.panel).clickable { open = true }.padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), color = C.text, fontSize = 16.sp, maxLines = 1)
        Chevron(C.muted, 16.dp, rotation = 270f)
    }
    if (open) {
        var q by remember { mutableStateOf("") }
        val fold = { s: String -> java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "").lowercase() }
        val words = fold(q).split(Regex("\\s+")).filter { it.isNotEmpty() }
        val shown = options.filter { o -> words.all { w -> w in fold("${o.label} ${o.group ?: ""}") } }
        androidx.compose.ui.window.Dialog({ open = false }) {
            Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).clip(RoundedCornerShape(24.dp)).background(C.bg).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (searchable) TextBox(q, { q = it }, placeholder = "Search…")
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    var group: String? = null
                    for (o in shown) {
                        if (o.group != group && o.group != null) Text(o.group, Modifier.padding(start = 14.dp, top = 10.dp, bottom = 2.dp), color = C.muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        group = o.group
                        PickerRow(o.value == value, { onChange(o.value); open = false }) { Text(o.label, color = C.text) }
                    }
                    if (shown.isEmpty()) Text("No match", Modifier.padding(14.dp), color = C.muted)
                }
            }
        }
    }
}

/**
 * components.jsx NutrientAdder: "+ add nutrient…", dashed; typing filters the options (every word; labels starting
 * with the text first). Tap one, or Done for the first.
 */
@Composable
fun NutrientAdder(options: List<app.foodtracker.NutrientOption>, onAdd: (String) -> Unit) {
    var text by remember { mutableStateOf("") }
    var open by remember { mutableStateOf(false) }
    val q = text.trim().lowercase()
    val words = q.split(Regex("\\s+")).filter { it.isNotEmpty() }
    val matches = options.filter { n -> words.all { it in n.label.lowercase() } }.sortedByDescending { it.label.lowercase().startsWith(q) }
    val view = remember { BringIntoViewRequester() }
    LaunchedEffect(open) { if (open) { delay(300); view.bringIntoView() } }
    fun add(key: String) { onAdd(key); text = "" }
    Column(Modifier.bringIntoViewRequester(view)) {
        Box(Modifier.dashedBorder(C.line, 999.dp).clip(Pill)) {
            TextBox(text, { text = it; open = true }, bg = Color.Transparent, onFocus = { open = it }, onDone = { matches.firstOrNull()?.let { add(it.key) } },
                placeholder = "+ add nutrient…", placeholderColor = C.accent)
        }
        if (open) PickerList(matches.size, "No match") { i ->
            PickerRow(i == 0, { add(matches[i].key) }) {
                Text(buildAnnotatedString {
                    append(matches[i].label)
                    withStyle(SpanStyle(color = C.muted, fontSize = 13.sp)) { append(" ${matches[i].unit}") }
                }, color = C.text)
            }
        }
    }
}
