package app.foodtracker.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.data.Ctx
import app.foodtracker.data.Item
import app.foodtracker.data.Kind
import app.foodtracker.data.NV
import app.foodtracker.data.NutrientDef
import app.foodtracker.data.calories
import app.foodtracker.data.deltaFromInput
import app.foodtracker.data.fmt
import app.foodtracker.data.jsString
import app.foodtracker.data.kind
import app.foodtracker.data.label
import app.foodtracker.data.shortDateTimeLabel

val Pill = RoundedCornerShape(999.dp)
val Card = RoundedCornerShape(22.dp)

// --- alert() / confirm() -----------------------------------------------------------------------------------------
// The web app uses the browser's alert/confirm; these are the same, as dialogs hosted at the root.

class Dialogs {
    data class Spec(val text: String, val confirmLabel: String?, val danger: Boolean, val onConfirm: () -> Unit)
    var current by mutableStateOf<Spec?>(null)
        private set

    fun alert(text: String) { current = Spec(text, null, false) {} }
    fun confirm(text: String, confirmLabel: String = "OK", danger: Boolean = false, onConfirm: () -> Unit) {
        current = Spec(text, confirmLabel, danger, onConfirm)
    }
    fun dismiss() { current = null }
}

val LocalDialogs = staticCompositionLocalOf { Dialogs() }

@Composable
fun DialogHost(dialogs: Dialogs) {
    val spec = dialogs.current ?: return
    AlertDialog(
        onDismissRequest = dialogs::dismiss,
        containerColor = C.panel,
        textContentColor = C.text,
        text = { Text(spec.text, fontSize = 16.sp) },
        confirmButton = {
            if (spec.confirmLabel == null) TextButton(onClick = dialogs::dismiss) { Text("OK", color = C.accent) }
            else TextButton(onClick = { dialogs.dismiss(); spec.onConfirm() }) {
                Text(spec.confirmLabel, color = if (spec.danger) C.prot else C.accent, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = if (spec.confirmLabel == null) null else ({
            TextButton(onClick = dialogs::dismiss) { Text("Cancel", color = C.muted) }
        }),
    )
}

// --- Screen frame ---------------------------------------------------------------------------------------------

/** Width follows the window, up to 2.5× a phone's width, then stays capped and centred (like the web app). */
val MAX_WIDTH = 1200.dp

@Composable
fun Screen(
    title: String,
    onBack: (() -> Unit)?,
    subtitle: String? = null,
    right: (@Composable () -> Unit)? = null,
    scroll: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    val focus = LocalFocusManager.current
    Box(
        Modifier.fillMaxSize().background(C.bg).systemBarsPadding().imePadding()
            // Tapping outside a text field closes the keyboard and any open suggestion list.
            .pointerInput(Unit) { detectTapGestures { focus.clearFocus() } },
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(Modifier.widthIn(max = MAX_WIDTH).fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(48.dp)) { if (onBack != null) IconCircle("‹", "Back", onClick = onBack) }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = C.text, textAlign = TextAlign.Center)
                    if (subtitle != null) Text(subtitle, fontSize = 13.sp, color = C.muted)
                }
                Box(Modifier.width(48.dp), contentAlignment = Alignment.CenterEnd) { right?.invoke() }
            }
            val body = Modifier.fillMaxWidth().weight(1f).padding(horizontal = 16.dp)
            Column(
                if (scroll) body.verticalScroll(rememberScrollState()) else body,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                content()
                Spacer(Modifier.size(24.dp))
            }
        }
    }
}

// --- Buttons ----------------------------------------------------------------------------------------------------

enum class Look { Primary, Secondary, Danger, Link }

@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    look: Look = Look.Primary,
    enabled: Boolean = true,
    fontSize: Int = 16,
    padding: PaddingValues = PaddingValues(horizontal = 22.dp, vertical = 12.dp),
) {
    val (bg, fg) = when (look) {
        Look.Primary -> C.accent to C.onAccent
        Look.Secondary -> C.panel to C.text
        Look.Danger -> C.danger to Color.White
        Look.Link -> Color.Transparent to C.accent
    }
    Box(
        modifier.clip(Pill).background(if (enabled) bg else bg.copy(alpha = 0.4f))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(if (look == Look.Link) PaddingValues(vertical = 4.dp) else padding),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text, color = if (enabled) fg else fg.copy(alpha = 0.6f), fontSize = fontSize.sp,
            fontWeight = if (look == Look.Link) FontWeight.Medium else FontWeight.SemiBold, textAlign = TextAlign.Center,
            maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun IconCircle(symbol: String, description: String, size: Dp = 40.dp, background: Color = C.panel, onClick: () -> Unit) {
    Box(
        Modifier.size(size).clip(CircleShape).background(background).clickable(onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) { Text(symbol, fontSize = if (size < 40.dp) 18.sp else 20.sp, color = C.text) }
}

/** Buttons at the end of a form: [Delete] [Cancel] [Save]. */
@Composable
fun Actions(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), content = content)
}

// --- Lists ------------------------------------------------------------------------------------------------------

@Composable
fun ListCard(onClick: (() -> Unit)? = null, background: Color = C.panel, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(Card).background(background)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        content = content,
    )
}

/** Dashed "+ add …" row, first in a list. */
@Composable
fun AddCard(text: String, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().clip(Card).dashedBorder().clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, color = C.accent, fontWeight = FontWeight.SemiBold) }
}

fun Modifier.dashedBorder(color: Color = C.line, radius: Dp = 22.dp) = drawBehind {
    val w = 2.dp.toPx()
    drawRoundRect(
        color, topLeft = androidx.compose.ui.geometry.Offset(w / 2, w / 2),
        size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w),
        cornerRadius = CornerRadius(radius.toPx().coerceAtMost(size.height / 2)),
        style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx()))),
    )
}

@Composable
fun Muted(text: String, modifier: Modifier = Modifier, size: Int = 14) = Text(text, modifier, color = C.muted, fontSize = size.sp)

@Composable
fun Tag(text: String, ok: Boolean = false) {
    Text(
        text, Modifier.clip(Pill).background(C.bg).padding(horizontal = 10.dp, vertical = 2.dp),
        color = if (ok) C.kcal else C.muted, fontSize = 12.sp,
    )
}

@Composable
fun SectionTitle(text: String) = Text(text, Modifier.padding(top = 8.dp), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = C.text)

// --- Inputs -----------------------------------------------------------------------------------------------------

@Composable
fun Field(label: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 14.sp, color = C.muted)
        content()
    }
}

/**
 * Pill-shaped text input. Numbers use the decimal keypad and read "," as "." (Android keypads in many locales
 * only offer a comma).
 */
@Composable
fun Input(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    number: Boolean = false,
    enabled: Boolean = true,
    prefix: String? = null,
    background: Color = C.panel,
    dashed: Boolean = false,
    placeholderColor: Color = C.muted,
    capitalize: Boolean = !number,
    selectAllOnFocus: Boolean = false,
    imeAction: ImeAction = ImeAction.Done,
    onIme: (() -> Unit)? = null,
    focusRequester: FocusRequester? = null,
    onFocus: (Boolean) -> Unit = {},
    textStyle: TextStyle = TextStyle(fontSize = 16.sp),
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    description: String? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    // A TextFieldValue so the whole text can be selected on focus (like the web app's select()).
    var tfv by remember { mutableStateOf(TextFieldValue(value)) }
    if (tfv.text != value) tfv = tfv.copy(text = value, selection = TextRange(value.length))
    val currentOnFocus by rememberUpdatedState(onFocus)
    var seen by remember { mutableStateOf(false) }
    LaunchedEffect(focused) {
        if (focused && selectAllOnFocus) tfv = tfv.copy(selection = TextRange(0, tfv.text.length))
        if (focused || seen) currentOnFocus(focused) // not on first composition
        seen = true
    }
    BasicTextField(
        value = tfv,
        onValueChange = {
            val text = if (number) it.text.replace(',', '.') else it.text
            tfv = it.copy(text = text)
            if (text != value) onChange(text)
        },
        modifier = modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier),
        enabled = enabled,
        singleLine = true,
        textStyle = textStyle.copy(color = if (enabled) C.text else C.muted),
        cursorBrush = SolidColor(C.accent),
        interactionSource = interaction,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (number) KeyboardType.Decimal else KeyboardType.Text,
            capitalization = if (capitalize) KeyboardCapitalization.Sentences else KeyboardCapitalization.None,
            autoCorrectEnabled = false,
            imeAction = imeAction,
        ),
        keyboardActions = KeyboardActions(onAny = { onIme?.invoke() ?: defaultKeyboardAction(imeAction) }),
        decorationBox = { inner ->
            Row(
                Modifier.clip(Pill).background(background)
                    .then(if (dashed) Modifier.dashedBorder(radius = 999.dp) else Modifier.border(BorderStroke(1.dp, if (focused) C.accent else Color.Transparent), Pill))
                    .padding(contentPadding),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (prefix != null) Text(prefix, color = C.muted, modifier = Modifier.padding(end = 4.dp), style = textStyle)
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = placeholderColor, style = textStyle, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    inner()
                }
            }
        },
    )
}

/** Error of an amount ("± Δ"). Blank = from the digits of `amount` (shown as the placeholder). */
@Composable
fun DeltaInput(value: String, onChange: (String) -> Unit, amount: String, modifier: Modifier = Modifier, background: Color = C.panel) {
    val auto = deltaFromInput(amount)
    Input(
        value, onChange, modifier, placeholder = if (auto.isFinite()) jsString(auto) else "auto", number = true, prefix = "±",
        background = background, contentPadding = PaddingValues(start = 12.dp, end = 10.dp, top = 12.dp, bottom = 12.dp),
        description = "± Δ",
    )
}

@Composable
fun CheckRow(checked: Boolean, onChange: (Boolean) -> Unit, label: String) {
    Row(Modifier.clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onChange, colors = CheckboxDefaults.colors(checkedColor = C.accent, checkmarkColor = C.onAccent, uncheckedColor = C.muted))
        Text(label, color = C.muted, fontSize = 14.sp)
    }
}

/** Two- or more-way toggle. */
@Composable
fun Segmented(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().clip(Pill).background(C.panel).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for ((value, label) in options) {
            val on = value == selected
            Box(
                Modifier.weight(1f).clip(Pill).background(if (on) C.accent else Color.Transparent).clickable { onSelect(value) }
                    .padding(10.dp).semantics { contentDescription = label },
                contentAlignment = Alignment.Center,
            ) { Text(label, color = if (on) C.onAccent else C.muted, fontWeight = FontWeight.SemiBold, maxLines = 1) }
        }
    }
}

// --- Suggestion lists (item search, units, nutrients) -------------------------------------------------------------
// Shown under their input while it has focus, in the page flow like the web app's .picker-list.

@Composable
fun SuggestionList(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.padding(top = 6.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(C.panel)
            .border(1.dp, C.line, RoundedCornerShape(20.dp)).heightIn(max = 260.dp)
            .verticalScroll(rememberScrollState()).padding(6.dp),
        content = content,
    )
}

@Composable
fun Suggestion(text: AnnotatedString, active: Boolean = false, onClick: () -> Unit) {
    Text(
        text,
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .then(if (active) Modifier.background(C.bg).border(1.dp, C.accent, RoundedCornerShape(14.dp)) else Modifier)
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
        color = C.text,
    )
}

@Composable
fun NoSuggestion(text: String) = Text(text, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), color = C.muted)

fun itemLabel(item: Item?): String {
    if (item == null) return "(missing item)"
    val attrs = item.attributes.filter { it.getOrNull(0)?.isNotEmpty() == true }.map { "${it[0]}: ${it.getOrElse(1) { "" }}" }
    val made = item.madeAt?.takeIf { it.isNotEmpty() }?.let { "— made ${shortDateTimeLabel(it)}" }
    return listOfNotNull(
        item.name.ifEmpty { "(unnamed)" }, item.brand.takeIf { it.isNotEmpty() }?.let { "· $it" },
        attrs.takeIf { it.isNotEmpty() }?.let { "(${it.joinToString(", ")})" }, made,
    ).joinToString(" ")
}

/** Word search over foods; most recently made concoctions first, then alphabetical (web: Foods list, ItemPicker). */
fun searchItems(ctx: Ctx, query: String, exclude: Long? = null): List<Pair<Item, String>> {
    val words = query.lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return ctx.list.asSequence().filter { it.id != exclude }.map { it to itemLabel(it) }
        .filter { (_, label) -> words.all { label.lowercase().contains(it) } }
        .sortedWith(compareByDescending<Pair<Item, String>> { it.first.madeAt ?: "" }.thenBy { it.second })
        .toList()
}

fun kindSuffix(item: Item): AnnotatedString = buildAnnotatedString {
    if (item.kind() != Kind.Ingredient) withStyle(SpanStyle(color = C.muted, fontSize = 13.sp)) { append(" · ${item.kind().label()}") }
}

/**
 * One search box over every food: ingredients, recipes and concoctions are interchangeable, so the picker never
 * asks which kind you want. Shows the picked food's label until focused; then filters as you type.
 */
@Composable
fun ItemPicker(ctx: Ctx, value: Long?, onChange: (Long) -> Unit, exclude: Long? = null, background: Color = C.panel) {
    var query by remember { mutableStateOf<String?>(null) } // null = closed
    val focus = LocalFocusManager.current
    val selected = ctx.resolve(value)
    val matches = if (query == null) emptyList() else searchItems(ctx, query!!, exclude).take(50)
    Column {
        Input(
            query ?: (if (selected != null) itemLabel(selected) else ""),
            { query = it },
            Modifier.fillMaxWidth(),
            placeholder = "Search foods…",
            background = background,
            onFocus = { query = if (it) "" else null },
            onIme = { matches.firstOrNull()?.let { onChange(it.first.id) }; focus.clearFocus() },
            description = "Food",
        )
        if (query != null) SuggestionList {
            for ((item, label) in matches) {
                Suggestion(AnnotatedString(label) + kindSuffix(item)) { onChange(item.id); focus.clearFocus() }
            }
            if (matches.isEmpty()) NoSuggestion("No match")
        }
    }
}

/**
 * Unit for a consumption: free text with suggestions from the units the food converts to (`units`, own unit
 * first). Disabled until a food is picked.
 */
@Composable
fun UnitCombo(units: List<String>?, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    if (units == null) {
        Input("", {}, modifier, placeholder = "pick a food first", enabled = false)
        return
    }
    val q = value.trim().lowercase()
    // While the text is exactly one of the units, show them all (it was just picked or prefilled).
    val matches = if (q in units) units else units.filter { it.contains(q) }
    Column(modifier) {
        Input(
            value, { onChange(it); open = true }, Modifier.fillMaxWidth(), placeholder = units.firstOrNull() ?: "unit",
            capitalize = false, selectAllOnFocus = true, onFocus = { open = it },
            onIme = { matches.firstOrNull()?.let(onChange); focus.clearFocus() }, description = "Unit",
        )
        if (open) SuggestionList {
            for (u in matches) Suggestion(AnnotatedString(u)) { onChange(u); open = false; focus.clearFocus() }
            if (matches.isEmpty()) NoSuggestion("No conversion to “$value” for this food")
        }
    }
}

/** Text box with suggestions over `options` (nutrients not shown yet). Tap one, or the keyboard action for the first. */
@Composable
fun NutrientAdder(options: List<NutrientDef>, onAdd: (String) -> Unit, focusRequester: FocusRequester? = null) {
    var text by remember { mutableStateOf("") }
    var open by remember { mutableStateOf(false) }
    val q = text.trim().lowercase()
    val words = q.split(Regex("\\s+")).filter { it.isNotEmpty() }
    // Every typed word must appear ("vit b" -> Vitamin B1…); labels starting with the text come first.
    val matches = options.filter { n -> words.all { n.label.lowercase().contains(it) } }
        .sortedByDescending { it.label.lowercase().startsWith(q) }
    Column {
        Input(
            text, { text = it; open = true }, Modifier.fillMaxWidth(), placeholder = "+ add nutrient…",
            background = Color.Transparent, dashed = true, placeholderColor = C.accent, focusRequester = focusRequester,
            onFocus = { open = it },
            onIme = { matches.firstOrNull()?.let { onAdd(it.key); text = "" } },
            description = "Add nutrient",
        )
        if (open) SuggestionList {
            for (n in matches) {
                Suggestion(buildAnnotatedString {
                    append(n.label)
                    withStyle(SpanStyle(color = C.muted, fontSize = 13.sp)) { append(" ${n.unit}") }
                }) { onAdd(n.key); text = "" }
            }
            if (matches.isEmpty()) NoSuggestion("No match")
        }
    }
}

@Composable
fun AttributesEditor(value: List<List<String>>, onChange: (List<List<String>>) -> Unit) {
    fun set(i: Int, j: Int, v: String) = onChange(value.mapIndexed { k, row -> if (k == i) row.toMutableList().also { while (it.size < 2) it += ""; it[j] = v } else row })
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        value.forEachIndexed { i, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Input(row.getOrElse(0) { "" }, { set(i, 0, it) }, Modifier.weight(1f), placeholder = "key", capitalize = false)
                Input(row.getOrElse(1) { "" }, { set(i, 1, it) }, Modifier.weight(1f), placeholder = "value")
                IconCircle("×", "Remove attribute") { onChange(value.filterIndexed { k, _ -> k != i }) }
            }
        }
        PillButton("+ attribute", { onChange(value + listOf(listOf("", ""))) }, look = Look.Link)
    }
}

// --- Macro line -------------------------------------------------------------------------------------------------

/** "P 12 · F 5 · C 30 · 230 kcal"; with `deltas`, each value also shows its error ("P 12 ±1 · …"). */
fun macroLine(nutrients: Map<String, NV>, ok: Boolean = true, deltas: Boolean = false): AnnotatedString = buildAnnotatedString {
    if (!ok) {
        withStyle(SpanStyle(color = C.warn)) { append("can't compute (unit conversion missing?)") }
        return@buildAnnotatedString
    }
    fun v(k: String) = nutrients[k]?.value ?: 0.0
    fun pm(d: Double?, digits: Int = 1) {
        if (deltas) withStyle(SpanStyle(fontWeight = FontWeight.Normal, color = Color.Unspecified)) {
            append(" ±${fmt(d?.takeIf { it.isFinite() } ?: 0.0, digits)}")
        }
    }
    val kcal = calories(nutrients)
    withStyle(SpanStyle(color = C.prot, fontWeight = FontWeight.SemiBold)) { append("P ${fmt(v("proteins"))}"); pm(nutrients["proteins"]?.delta) }
    append(" · ")
    withStyle(SpanStyle(color = C.fat, fontWeight = FontWeight.SemiBold)) { append("F ${fmt(v("fat"))}"); pm(nutrients["fat"]?.delta) }
    append(" · ")
    withStyle(SpanStyle(color = C.carb, fontWeight = FontWeight.SemiBold)) { append("C ${fmt(v("carbohydrates"))}"); pm(nutrients["carbohydrates"]?.delta) }
    append(" · ")
    withStyle(SpanStyle(color = C.kcal, fontWeight = FontWeight.SemiBold)) {
        append("${if (kcal.estimated) "~" else ""}${fmt(kcal.value, 0)}"); pm(kcal.delta, 0); append(" kcal")
    }
}

@Composable
fun MacroLine(nutrients: Map<String, NV>, ok: Boolean = true, deltas: Boolean = false) =
    Text(macroLine(nutrients, ok, deltas), fontSize = 13.sp, color = C.text)
