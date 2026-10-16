package app.foodtracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.LocalNav
import app.foodtracker.LocalRepo
import app.foodtracker.data.Component
import app.foodtracker.data.Ctx
import app.foodtracker.data.Item
import app.foodtracker.data.Measure
import app.foodtracker.data.NUTRIENTS
import app.foodtracker.data.Nutrient
import app.foodtracker.data.UnitConv
import app.foodtracker.data.amountText
import app.foodtracker.data.baseAmount
import app.foodtracker.data.deltaFromInput
import app.foodtracker.data.deltaText
import app.foodtracker.data.emptyNutrients
import app.foodtracker.data.isoOf
import app.foodtracker.data.jsNumber
import app.foodtracker.data.jsString
import app.foodtracker.data.localOf
import app.foodtracker.data.measure
import app.foodtracker.data.normalizeNumber
import app.foodtracker.data.nutrientsFor
import app.foodtracker.data.sourceLabel
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.MathContext
import java.time.LocalDateTime

// A food is anything you can eat: an ingredient, a recipe (has components) or a concoction (has a made-at time).
// One list, one editor; what kind a food is follows from its fields.

@Composable
fun FoodListScreen() {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val ctx by repo.ctx.collectAsState(null)
    var query by rememberSaveable { mutableStateOf("") }
    Screen("Foods", nav::back) {
        val c = ctx ?: return@Screen
        Input(query, { query = it }, Modifier.fillMaxWidth().padding(bottom = 4.dp), placeholder = "Search foods…", imeAction = ImeAction.Search, description = "Search foods")
        AddCard("+ add new food") { nav.go(Route.FoodEdit(null)) }
        for ((item, label) in searchItems(c, query)) {
            val base = baseAmount(item)
            val n = remember(c, item) { nutrientsFor(c, item.id, base.amount, base.unit) }
            ListCard({ nav.go(Route.FoodEdit(item.id)) }) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(AnnotatedString(label) + kindSuffix(item), Modifier.weight(1f), color = C.text)
                    val amt = if (item.amount > 0) amountText(base.amount, item.amountText) else jsString(base.amount)
                    val err = if (item.amountDeltaAuto == false && item.amountDelta > 0) " ±${jsString(item.amountDelta)}" else ""
                    Muted("per $amt$err ${base.unit}")
                }
                MacroLine(n.nutrients, n.ok)
            }
        }
    }
}

// --- Form state ---------------------------------------------------------------------------------------------------

data class UnitRow(
    val fromAmount: String = "1", val fromDelta: String = "0", val fromUnit: String = "",
    val toAmount: String = "", val toDelta: String = "", val toUnit: String = "",
)
data class CompRow(val itemId: Long? = null, val amount: String = "", val amountDelta: String = "", val unit: String = "")
data class NRow(val text: String = "", val delta: String = "") {
    val filled get() = text.isNotBlank() || delta.isNotBlank()
}

// Always shown, on top. Everything else appears once it has a value (or is added from the picker).
private val CORE = listOf("energy", "proteins", "fat", "carbohydrates")

/** The food editor's state. Held by its route, so it survives a trip to "Search external" and back. */
class FoodForm(src: Item?, val initialId: Long?) {
    var name by mutableStateOf(src?.name ?: "")
    var brand by mutableStateOf(src?.brand ?: "")
    var attributes by mutableStateOf(src?.attributes ?: emptyList())
    var amount by mutableStateOf(if (src != null) amountText(src.amount, src.amountText) else "100")
    var amountDelta by mutableStateOf(if (src != null) deltaText(src.amountDelta, src.amountDeltaAuto) else "")
    var unit by mutableStateOf(src?.unit ?: if (initialId != null) "" else "g")
    var isMade by mutableStateOf(!src?.madeAt.isNullOrEmpty())
    var madeAt by mutableStateOf(src?.madeAt?.takeIf { it.isNotEmpty() }?.let(::localOf) ?: LocalDateTime.now().withSecond(0).withNano(0))
    var units by mutableStateOf((src?.units ?: emptyList()).map {
        UnitRow(
            amountText(it.fromAmount, it.fromText), deltaText(it.fromDelta, it.fromDeltaAuto), it.fromUnit,
            amountText(it.toAmount, it.toText), deltaText(it.toDelta, it.toDeltaAuto), it.toUnit,
        )
    })
    var components by mutableStateOf((src?.components ?: emptyList()).map {
        CompRow(it.itemId, amountText(it.amount, it.amountText), deltaText(it.amountDelta, it.amountDeltaAuto), it.unit)
    })
    var nutrients by mutableStateOf((emptyNutrients() + (src?.nutrients ?: emptyMap())).mapValues { (_, n) ->
        NRow(n.text ?: if (n.value.isFinite()) jsString(n.value) else "", if (n.deltaAuto == true || !n.delta.isFinite()) "" else jsString(n.delta))
    })
    var source by mutableStateOf(src?.source)
    /** Extra (non-core) nutrients shown even while empty, because the user just added them. */
    var extraShown by mutableStateOf(listOf<String>())

    fun setN(key: String, row: NRow) { nutrients = nutrients + (key to row) }

    fun toRecord(): Item {
        val base = measure(amount, amountDelta)
        return Item(
            id = initialId ?: 0, name = name.trim(), brand = brand.trim(), attributes = attributes,
            amount = if (base.value > 0) base.value else Double.NaN, amountText = base.text, amountDelta = base.delta, amountDeltaAuto = base.auto,
            unit = unit.trim(),
            madeAt = if (isMade) isoOf(madeAt) else null,
            units = units.filter { jsNumber(it.fromAmount) > 0 && it.fromUnit.isNotBlank() && jsNumber(it.toAmount) > 0 && it.toUnit.isNotBlank() }
                .map {
                    val a = measure(it.fromAmount, it.fromDelta)
                    val b = measure(it.toAmount, it.toDelta)
                    UnitConv(a.value, a.text, a.delta, a.auto, it.fromUnit.trim(), b.value, b.text, b.delta, b.auto, it.toUnit.trim())
                },
            components = components.filter { it.itemId != null }.map {
                val m = measure(it.amount, it.amountDelta)
                Component(it.itemId, m.value, m.text, m.delta, m.auto, it.unit.trim())
            },
            nutrients = NUTRIENTS.associate { def ->
                val row = nutrients[def.key] ?: NRow()
                val text = normalizeNumber(row.text)
                val value = if (text.isEmpty()) def.default ?: Double.NaN else jsNumber(text)
                val auto = row.delta.isBlank()
                val delta = if (!auto) jsNumber(row.delta) else if (text.isEmpty() && def.default == 0.0) 0.0 else deltaFromInput(text)
                def.key to Nutrient(value, delta, text, auto)
            },
            source = source,
        )
    }

    companion object {
        fun from(item: Item?, isNew: Boolean) = FoodForm(item, if (isNew) null else item?.id)
    }
}

// Every amount has an error (± Δ). Blank = from the digits typed. Amounts that are divided by (per amount, both
// sides of a unit) must keep their low end above 0.
private fun divisorProblem(label: String, m: Measure): String? {
    if (!(m.value > 0) || m.delta < m.value) return null
    return "$label: ±${jsString(m.delta)}${if (m.auto) " (from the digits)" else ""} would reach 0. Type more digits (e.g. ${jsString(m.value)}.0) or set a smaller ±."
}

// --- Editor -------------------------------------------------------------------------------------------------------

@Composable
fun FoodEditScreen(route: Route.FoodEdit) {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val ctx by repo.ctx.collectAsState(null)
    val c = ctx
    val rec = if (route.id != null) c?.resolve(route.id) else null
    LaunchedEffect(c != null) {
        if (c != null && route.form == null && (route.id == null || rec != null)) route.form = FoodForm.from(rec, isNew = route.id == null)
    }
    val title = if (route.id != null) "Edit food" else "New food"
    val form = route.form
    if (c == null || form == null) {
        Screen(title, nav::back) { if (c != null && route.id != null && rec == null) Muted("Food not found (deleted?).") }
        return
    }
    FoodEditor(c, form, title)
}

@Composable
private fun FoodEditor(ctx: Ctx, form: FoodForm, title: String) {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val dialogs = LocalDialogs.current
    val uri = LocalUriHandler.current
    val scope = rememberCoroutineScope()
    val adder = remember { FocusRequester() } // the keyboard's "next" in a nutrient's value or Δ goes here
    val valueFocus = remember { mutableMapOf<String, FocusRequester>() }
    var focusKey by remember { mutableStateOf<String?>(null) } // nutrient just added: its value field gets the cursor
    LaunchedEffect(focusKey) {
        focusKey?.let { valueFocus[it]?.requestSoon() }
        focusKey = null
    }

    val draft = form.toRecord().let { if (it.id == 0L) it.copy(id = -1) else it }
    // Live preview: compute with the unsaved form swapped into the context.
    val base = baseAmount(draft)
    val preview = nutrientsFor(ctx.with(draft), draft.id, base.amount, base.unit)

    fun save() {
        val r = form.toRecord()
        if (r.name.isEmpty()) return dialogs.alert("Name is required.")
        val problem = listOf(divisorProblem("Per amount", measure(form.amount, form.amountDelta))) + r.units.flatMap {
            listOf(
                divisorProblem("Units: ${it.fromText} ${it.fromUnit}", Measure(it.fromAmount, it.fromText ?: "", it.fromDelta, it.fromDeltaAuto == true)),
                divisorProblem("Units: ${it.toText} ${it.toUnit}", Measure(it.toAmount, it.toText ?: "", it.toDelta, it.toDeltaAuto == true)),
            )
        }
        problem.firstOrNull { it != null }?.let { return dialogs.alert(it) }
        scope.launch { repo.saveItem(r); nav.back() }
    }

    Screen(title, nav::back) {
        if (form.initialId == null) {
            PillButton("Search external databases…", { nav.go(Route.External(form.name.trim())) }, Modifier.fillMaxWidth(), Look.Secondary)
        }
        sourceLabel(form.source)?.let { (text, href) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Muted("From ", size = 13)
                PillButton(text, { uri.openUri(href) }, look = Look.Link, fontSize = 13)
                Spacer(Modifier.width(8.dp))
                PillButton("unlink", { form.source = null }, look = Look.Link, fontSize = 13)
            }
        }
        Field("Name") { Input(form.name, { form.name = it }, Modifier.fillMaxWidth(), description = "Name") }
        Field("Brand") { Input(form.brand, { form.brand = it }, Modifier.fillMaxWidth(), description = "Brand") }
        Field("Attributes") { AttributesEditor(form.attributes) { form.attributes = it } }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Field("Per amount", Modifier.weight(1f)) { Input(form.amount, { form.amount = it }, placeholder = "1", number = true, description = "Per amount") }
            Field("± Δ", Modifier.weight(0.75f)) { DeltaInput(form.amountDelta, { form.amountDelta = it }, form.amount) }
            Field("Unit", Modifier.weight(1f)) { Input(form.unit, { form.unit = it }, placeholder = "portion", capitalize = false, description = "Unit") }
        }

        SectionTitle("Units")
        form.units.forEachIndexed { i, u ->
            fun set(row: UnitRow) { form.units = form.units.mapIndexed { j, x -> if (j == i) row else x } }
            ListCard(background = C.panel) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Two lines: "1 ± Δ slice" / "= 30 ± Δ g".
                    ConvLine("", u.fromAmount, { set(u.copy(fromAmount = it)) }, u.fromDelta, { set(u.copy(fromDelta = it)) }, u.fromUnit, { set(u.copy(fromUnit = it)) }, "slice") {
                        IconCircle("×", "Remove unit", background = C.bg) { form.units = form.units.filterIndexed { j, _ -> j != i } }
                    }
                    ConvLine("=", u.toAmount, { set(u.copy(toAmount = it)) }, u.toDelta, { set(u.copy(toDelta = it)) }, u.toUnit, { set(u.copy(toUnit = it)) }, "") {
                        Spacer(Modifier.size(40.dp))
                    }
                }
            }
        }
        AddCard("+ add unit") { form.units = form.units + UnitRow(toUnit = form.unit.trim().ifEmpty { "g" }) }
        Muted("g/kg/mg/oz/lb and ml/l/cl/dl/tsp/tbsp/cup convert automatically.", size = 13)

        CheckRow(form.isMade, { form.isMade = it }, "Made at a specific time (concoction)")
        if (form.isMade) Field("Made at") { DateTimeField(form.madeAt) { form.madeAt = it } }

        SectionTitle("Components")
        form.components.forEachIndexed { i, comp ->
            fun set(row: CompRow) { form.components = form.components.mapIndexed { j, x -> if (j == i) row else x } }
            ListCard {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ItemPicker(ctx, comp.itemId, { id ->
                        set(comp.copy(itemId = id, unit = comp.unit.ifEmpty { ctx.resolve(id)?.unit?.ifEmpty { null } ?: "portion" }))
                    }, exclude = form.initialId, background = C.bg)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Input(comp.amount, { set(comp.copy(amount = it)) }, Modifier.weight(1f), placeholder = "amount", number = true, background = C.bg)
                        DeltaInput(comp.amountDelta, { set(comp.copy(amountDelta = it)) }, comp.amount, Modifier.weight(0.75f), background = C.bg)
                        Input(comp.unit, { set(comp.copy(unit = it)) }, Modifier.weight(1f), placeholder = "unit", capitalize = false, background = C.bg)
                        IconCircle("×", "Remove component", background = C.bg) { form.components = form.components.filterIndexed { j, _ -> j != i } }
                    }
                }
            }
        }
        AddCard("+ add component") { form.components = form.components + CompRow() }

        Text(
            buildAnnotatedString { append("Per ${jsString(base.amount)} ${base.unit}: ") } + macroLine(preview.nutrients, preview.ok, deltas = true),
            color = C.text, modifier = Modifier.padding(vertical = 8.dp),
        )

        if (draft.components.isNotEmpty()) Muted("Nutrients are inferred from the components.", size = 16)
        else {
            SectionTitle("Nutrients")
            NutrientHeader()
            val shown = CORE.mapNotNull { k -> NUTRIENTS.find { it.key == k } } +
                NUTRIENTS.filter { it.key !in CORE && (form.nutrients[it.key]?.filled == true || it.key in form.extraShown) }
            for (n in shown) {
                val row = form.nutrients[n.key] ?: NRow()
                val fr = valueFocus.getOrPut(n.key) { FocusRequester() }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        buildAnnotatedString { append(n.label); withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" ${n.unit}") } },
                        Modifier.weight(1f), color = C.text, fontSize = 14.sp,
                    )
                    val small = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 9.dp)
                    val style = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
                    Input(
                        row.text, { form.setN(n.key, row.copy(text = it)) }, Modifier.width(84.dp), placeholder = if (n.default == 0.0) "0" else "NaN",
                        number = true, focusRequester = fr, imeAction = ImeAction.Next, onIme = { runCatching { adder.requestFocus() } },
                        textStyle = style, contentPadding = small, description = "${n.label} value",
                    )
                    val auto = deltaFromInput(row.text)
                    Input(
                        row.delta, { form.setN(n.key, row.copy(delta = it)) }, Modifier.width(64.dp),
                        placeholder = if (row.text.isNotEmpty() && auto.isFinite()) jsString(BigDecimal(auto).round(MathContext(3)).toDouble())
                        else if (n.default == 0.0) "0" else "auto",
                        number = true, imeAction = ImeAction.Next, onIme = { runCatching { adder.requestFocus() } },
                        textStyle = style, contentPadding = small, description = "${n.label} Δ",
                    )
                    if (n.key in CORE) Spacer(Modifier.size(34.dp))
                    else IconCircle("×", "Remove ${n.label}", size = 34.dp) {
                        // Clears value and Δ (so it's stored as NaN again) and hides the row.
                        form.setN(n.key, NRow())
                        form.extraShown = form.extraShown - n.key
                    }
                }
            }
            val hidden = NUTRIENTS.filter { it.key !in CORE && form.nutrients[it.key]?.filled != true && it.key !in form.extraShown }
            if (hidden.isNotEmpty()) NutrientAdder(hidden, { key -> form.extraShown = form.extraShown + key; focusKey = key }, adder)
        }

        Actions {
            if (form.initialId != null) PillButton("Delete", {
                dialogs.confirm("Delete this food? Consumptions and recipes using it will show it as missing.", "Delete", danger = true) {
                    scope.launch { repo.deleteItem(form.initialId); nav.back() }
                }
            }, look = Look.Danger)
            PillButton("Save", ::save)
        }
    }
}

@Composable
private fun NutrientHeader() {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Spacer(Modifier.weight(1f))
        Text("value", Modifier.width(84.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
        Text("Δ", Modifier.width(64.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.size(34.dp))
    }
}

/** One side of a unit conversion: "[=] amount ±Δ unit [×]". */
@Composable
private fun ConvLine(
    eq: String, amount: String, onAmount: (String) -> Unit, delta: String, onDelta: (String) -> Unit,
    unit: String, onUnit: (String) -> Unit, unitHint: String, trailing: @Composable () -> Unit,
) {
    val small = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 9.dp)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(14.dp), contentAlignment = Alignment.Center) { Muted(eq) }
        Input(amount, onAmount, Modifier.weight(1f), number = true, background = C.bg, contentPadding = small, description = "Unit amount")
        DeltaInput(delta, onDelta, amount, Modifier.weight(0.8f), background = C.bg)
        Input(unit, onUnit, Modifier.weight(1f), placeholder = unitHint.ifEmpty { "unit" }, capitalize = false, background = C.bg, contentPadding = small, description = "Unit name")
        trailing()
    }
}
