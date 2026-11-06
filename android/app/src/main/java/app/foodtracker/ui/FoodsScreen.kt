package app.foodtracker.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.EditorComponent
import app.foodtracker.FoodEditorReply
import app.foodtracker.FoodInfoView
import app.foodtracker.FoodLabel
import app.foodtracker.FoodsView
import app.foodtracker.SaveReply
import app.foodtracker.SelectOption
import app.foodtracker.bool
import app.foodtracker.get
import app.foodtracker.js
import app.foodtracker.objects
import app.foodtracker.pairs
import app.foodtracker.str
import app.foodtracker.with
import app.foodtracker.withAt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

// Foods, native: a port of app/src/screens/Foods.jsx (the list, the editor) and FoodInfo.jsx (its Info tab). Data:
// core.js foods, foodEditor, foodInfo; the editor's logic is app/src/foodForm.js.

/** The Foods list: a search box, "+ add new food", the foods found. */
@Composable
fun FoodsScreen(view: FoodsView?, query: String, onQuery: (String) -> Unit, core: Core) {
    Column(Modifier.fillMaxSize().background(C.bg)) {
        TopBar("Foods", onBack = core::back)
        LazyColumn(Modifier.weight(1f).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(bottom = 32.dp)) {
            item { TextBox(query, onQuery, Modifier.padding(bottom = 4.dp), placeholder = "Search foods…", imeAction = androidx.compose.ui.text.input.ImeAction.Search) }
            item { AddRow("+ add new food", { core.go("/foods/new") }) }
            items(view?.rows ?: emptyList(), key = { it.id }) { r ->
                ListCard({ core.go("/foods/${r.id}") }) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(buildAnnotatedString {
                            append(r.label)
                            if (r.recipe) withStyle(SpanStyle(color = C.muted, fontSize = 13.sp)) { append(" · recipe") }
                            if (r.conflict) withStyle(SpanStyle(color = C.warn, fontSize = 13.sp)) { append(" · ⚠ same ID") }
                        }, Modifier.weight(1f), color = C.text)
                        Text(r.per, color = C.muted)
                    }
                    r.made?.let { Tag(it) }
                    MacroText(r.macros)
                }
            }
        }
    }
}

/**
 * A recipe's or concoction's component (Foods.jsx, Consumptions.jsx): the food picker, then amount, ± Δ, unit, ε,
 * ×, and what it brings in. `c` is the form's component; `cv`, what the web app says of it.
 */
@Composable
fun ComponentCard(
    c: JsonObject,
    cv: EditorComponent?,
    search: suspend (String) -> List<FoodLabel>,
    onPick: (String) -> Unit,
    set: (String, Any?) -> Unit,
    onRemove: () -> Unit,
    onCreate: ((String) -> Unit)? = null,
    amountFocus: FocusRequester? = null,
) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(C.panel).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FoodPicker(cv?.item, search, onPick, bg = C.bg, onCreate = onCreate)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
            TextBox(c.str("amount"), { set("amount", it) }, Modifier.weight(1f), placeholder = "amount", decimal = true, bg = C.bg,
                focusRequester = amountFocus, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp))
            DeltaBox(c.str("amountDelta"), cv?.deltaPlaceholder ?: "auto", { set("amountDelta", it) }, Modifier.weight(0.8f), bg = C.bg)
            UnitCombo(cv?.units, c.str("unit"), { set("unit", it) }, Modifier.weight(1f), bg = C.bg)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            EntryErrorChip(cv?.entryError ?: "", { set("entryError", it) }, bg = C.bg)
            Box(Modifier.weight(1f)) { MacroText(cv?.macros) }
            RoundIconButton("Remove", onRemove) { Text("×", color = C.text, fontSize = 20.sp) }
        }
    }
}

/** A form stashed while a new component is made from it ("+" beside a component's search box; Foods.jsx `parents`). */
class StashedFood(val route: String, val name: String, val form: JsonObject, val extraShown: List<String>, val index: Int) {
    var created: JsonElement? = null
}

/** The stack of stashed forms: the new food's own may stash another. In memory only, as on the web. */
object FoodStash {
    val parents = ArrayList<StashedFood>()
}

/**
 * A food: Edit and Info tabs (a new one: the form only). `route`: the current route, to find a form stashed on it;
 * `nested` ("in"): the new food is a component of the form stashed at that depth; `name`: what was typed for it.
 */
@Composable
fun FoodScreen(core: Core, id: String, route: String, info: Boolean, nutrient: String?, nested: Int?, name: String?, log: String? = null) {
    val isNew = id == "new"
    val parent = nested?.let { FoodStash.parents.getOrNull(it - 1) }
    var reply by remember(id, nested) { mutableStateOf<FoodEditorReply?>(null) }
    var form by remember(id, nested) { mutableStateOf<JsonObject?>(null) }
    var extraShown by remember(id, nested) { mutableStateOf(listOf<String>()) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    var focusNutrient by remember { mutableStateOf<String?>(null) }
    // The Info tab's 🖨: its nutrition label, starting at the consumption `log` (if opened from one), else at the
    // tab's amount (`infoAmount`).
    var printing by remember { mutableStateOf(false) }
    var infoAmount by remember(id) { mutableStateOf("" to "") }
    val scope = rememberCoroutineScope()
    val ser = FoodEditorReply.serializer()
    val base = js("id" to id, "name" to name)
    fun args(extra: Map<String, Any?> = emptyMap()) = JsonObject(base + js("form" to form, "extraShown" to extraShown) + js(*extra.toList().toTypedArray()))

    LaunchedEffect(reply == null) {
        if (reply != null) return@LaunchedEffect
        // Back from a new component: this form as it was, with the food made (if saved) set as that component.
        val restored = FoodStash.parents.lastOrNull()?.takeIf { it.route == route }
        try {
            if (restored != null) {
                FoodStash.parents.removeAt(FoodStash.parents.size - 1)
                extraShown = restored.extraShown
                form = restored.form
                val r = core.get(ser, "foodEditor", JsonObject(base + js("form" to restored.form, "extraShown" to restored.extraShown,
                    "event" to restored.created?.let { listOf("created", listOf(restored.index, it)) })))
                reply = r
                form = r.form
            } else {
                val r = core.get(ser, "foodEditor", base)
                reply = r
                form = r.form
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) { ask = Asking(e.message ?: "Couldn't open it.") }
    }
    LaunchedEffect(form, extraShown) {
        val r = reply ?: return@LaunchedEffect
        if (form == null || (form == r.form && extraShown.isEmpty())) return@LaunchedEffect
        try { reply = core.get(ser, "foodEditor", args()).copy(form = form) } catch (e: CancellationException) { throw e } catch (_: Exception) {}
    }
    fun event(name: String, arg: Any? = null) = scope.launch {
        runCatching { core.get(ser, "foodEditor", args(mapOf("event" to listOf(name, arg)))) }.onSuccess { reply = it; form = it.form }
    }
    fun save() = scope.launch {
        val s = runCatching { core.get(SaveReply.serializer(), "saveFood", args()) }.getOrElse { SaveReply(alert = "Couldn't save: ${it.message}") }
        if (s.alert != null) { ask = Asking(s.alert); return@launch }
        // Made as a component: the parent (next back) picks it up.
        if (isNew && parent != null) FoodStash.parents.lastOrNull()?.created = s.id
        core.back()
    }

    val r = reply
    val v = r?.view
    val title = when { parent != null -> "New component"; v == null -> ""; v.missing -> "Edit food"; else -> v.title }
    val subtitle = parent?.let { if (it.name.isNotEmpty()) "for “${it.name}”" else "for the new food" }
    val context = LocalContext.current
    Box(Modifier.fillMaxSize()) {
        ScreenFrame(title, subtitle, onBack = core::back, gap = 12.dp, right = if (info && v?.missing == false) ({ PrinterButton { printing = true } }) else null) {
            if (v == null) return@ScreenFrame
            if (v.missing) { Muted("Food not found (deleted?).", size = 16.sp); return@ScreenFrame }
            if (!isNew) Segmented(listOf("Edit", "Info"), if (info) 1 else 0, { i ->
                core.replace("/foods/$id" + listOfNotNull(if (i == 1) "tab=info" else null, nutrient?.let { "nutrient=$it" }, log?.let { "log=${Uri.encode(it)}" })
                    .joinToString("&").let { if (it.isEmpty()) "" else "?$it" })
            })
            v.sameId?.let { ids ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("⚠ Same ID as ${if (ids.size > 1) "${ids.size} other foods" else "another food"} with different values:", color = C.warn, fontSize = 13.sp)
                }
                ids.forEach { o -> LinkButton("#$o", { core.go("/foods/$o") }) }
            }
            if (info) { FoodInfoTab(core, id, nutrient) { per, unit -> infoAmount = per to unit }; return@ScreenFrame }
            val f = form ?: return@ScreenFrame
            fun set(key: String, value: Any?) { form = f.with(key, value) }
            val search: suspend (String) -> List<FoodLabel> = { q -> core.get(ListSerializer(FoodLabel.serializer()), "foodSearch", JsonPrimitive(q), v.search) }

            v.copyNote?.let { Muted(it, size = 13.sp) }
            v.external?.let { ext ->
                // Save also sits up here, smaller, so a prefilled draft can be saved without scrolling.
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PillButton("Search external databases…", { core.go(ext) }, Modifier.weight(1f), bg = C.panel, fg = C.text, padding = PaddingValues(12.dp), fontSize = 15.sp)
                    PillButton("Save", { save() }, padding = PaddingValues(horizontal = 18.dp, vertical = 12.dp))
                }
            }
            v.source?.let { src ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("From ", color = C.muted, fontSize = 13.sp)
                    Text(src.text, Modifier.weight(1f, fill = false).clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(src.href))) }, color = C.accent, fontSize = 13.sp)
                    Text(" ", fontSize = 13.sp)
                    LinkButton("unlink", { event("unlink") })
                }
            }
            Field("Name") { TextBox(f.str("name"), { set("name", it) }) }
            Field("Brand") { TextBox(f.str("brand"), { set("brand", it) }) }
            Field("Attributes") { AttributesEditor(f.pairs("attributes")) { set("attributes", it) } }

            H3("Units")
            f.objects("units").forEachIndexed { i, u ->
                val ph = v.units.getOrNull(i)
                fun setU(key: String, value: String) { form = f.withAt("units", i, js(key to value)) }
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(C.panel).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Two lines: "1 ± Δ slice ×" / "= 30 ± Δ g".
                    for (side in listOf("from", "to")) Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (side == "to") "=" else "", Modifier.width(14.dp), color = C.muted)
                        val pad = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                        TextBox(u.str("${side}Amount"), { setU("${side}Amount", it) }, Modifier.weight(1f), decimal = true, bg = C.bg, contentPadding = pad)
                        DeltaBox(u.str("${side}Delta"), (if (side == "from") ph?.fromPlaceholder else ph?.toPlaceholder) ?: "auto", { setU("${side}Delta", it) }, Modifier.weight(0.8f), bg = C.bg)
                        TextBox(u.str("${side}Unit"), { setU("${side}Unit", it) }, Modifier.weight(1f), placeholder = if (side == "from") "slice" else "unit", bg = C.bg, capitalize = false, contentPadding = pad)
                        if (side == "from") RoundIconButton("Remove", { event("removeUnit", i) }) { Text("×", color = C.text, fontSize = 20.sp) }
                        else Box(Modifier.size(40.dp))
                    }
                }
            }
            AddRow("+ add unit", { event("addUnit") })
            Muted("g/kg/mg/oz/lb and ml/l/cl/dl/tsp/tbsp/cup convert automatically.", size = 13.sp)

            CheckRow(f.bool("isMade"), "Made at a specific time (concoction)") { set("isMade", it) }
            if (f.bool("isMade")) {
                Field("Made at") { DateTimeBox(f.str("madeAt")) { set("madeAt", it) } }
                Field("Expires after (days)") { TextBox(f.str("expiresAfterDays"), { set("expiresAfterDays", it) }, placeholder = v.expiryPlaceholder, decimal = true) }
            }

            H3("Components")
            val amountFocus = remember { HashMap<Int, FocusRequester>() }
            f.objects("components").forEachIndexed { i, c ->
                ComponentCard(c, v.components.getOrNull(i), search, { event("component", listOf(i, it)) },
                    { key, value -> form = f.withAt("components", i, js(key to value)) }, { event("removeComponent", i) },
                    onCreate = { text ->
                        FoodStash.parents += StashedFood(route, f.str("name").trim(), f, extraShown, i)
                        core.go("/foods/new?in=${FoodStash.parents.size}${if (text.isNotEmpty()) "&name=${Uri.encode(text)}" else ""}")
                    },
                    amountFocus = amountFocus.getOrPut(i) { FocusRequester() })
            }
            AddRow("+ add component", { event("addComponent") })

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                Field("Per amount", Modifier.weight(1f)) { TextBox(f.str("amount"), { set("amount", it) }, placeholder = "1", decimal = true) }
                Field("± Δ", Modifier.weight(0.8f)) { DeltaBox(f.str("amountDelta"), v.deltaPlaceholder, { set("amountDelta", it) }) }
                Field("Unit", Modifier.weight(1f)) { TextBox(f.str("unit"), { set("unit", it) }, placeholder = "portion", capitalize = false) }
            }
            v.auto?.let { a ->
                if (a.problem != null) Muted(a.problem, size = 13.sp)
                else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LinkButton("Auto", { event("auto") })
                    Muted(a.text ?: "", size = 13.sp)
                }
            }
            Column {
                Text(v.previewLabel, color = C.text, fontSize = 16.sp)
                MacroText(v.preview, 14.sp)
            }

            if (v.hasComponents) Muted("Nutrients are inferred from the components.", size = 16.sp)
            else {
                H3("Nutrients")
                val nutrients = f["nutrients"]?.jsonObject ?: JsonObject(emptyMap())
                val requesters = remember { HashMap<String, FocusRequester>() }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (n in v.nutrients) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(buildAnnotatedString {
                            append(n.label)
                            withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" ${n.unit}") }
                        }, Modifier.weight(1f), color = C.text, fontSize = 14.sp)
                        val text = (nutrients[n.key] as? JsonObject)?.str("text") ?: ""
                        TextBox(text, { t -> form = f.with("nutrients", JsonObject(nutrients + (n.key to js("text" to t)))) }, Modifier.width(120.dp),
                            placeholder = n.placeholder, decimal = true, focusRequester = requesters.getOrPut(n.key) { FocusRequester() },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 9.dp), textStyle = androidx.compose.ui.text.TextStyle(color = C.text, fontSize = 14.sp))
                        if (n.core) Box(Modifier.size(34.dp)) else SmallIconButton("Remove ${n.label}", {
                            extraShown = extraShown - n.key
                            event("removeNutrient", n.key)
                        }) { Text("×", color = C.text, fontSize = 18.sp) }
                    }
                    if (v.adder.isNotEmpty()) NutrientAdder(v.adder) { key ->
                        extraShown = extraShown + key
                        focusNutrient = key
                    }
                }
                LaunchedEffect(focusNutrient, v.nutrients) {
                    val k = focusNutrient ?: return@LaunchedEffect
                    if (v.nutrients.any { it.key == k }) { runCatching { requesters[k]?.requestFocus() }; focusNutrient = null }
                }
                val options by produceState<List<SelectOption>>(emptyList()) {
                    value = runCatching { core.get(ListSerializer(SelectOption.serializer()), "categoryOptions") }.getOrDefault(emptyList())
                }
                Field("Category (how much its values vary)") { SelectBox(v.category, options, f.str("category"), { set("category", it) }) }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (v.canDelete) PillButton("Delete", {
                    ask = Asking("Delete this food? Consumptions and recipes using it will show it as missing.", "Delete") {
                        scope.launch { runCatching { core.call("deleteFood", JsonPrimitive(id)) }; core.back() }
                    }
                }, Modifier.weight(1f), bg = C.danger, fg = Color.White)
                PillButton("Save", { save() }, Modifier.weight(1f))
            }
        }
        if (printing && info) LabelSheet(core, id, log, infoAmount.first, infoAmount.second) { printing = false }
    }
    ask?.Show { ask = null }
}

/** FoodInfo.jsx: the nutrients for any amount (picked on top), the energy by macro, every amount with its error. */
@Composable
private fun FoodInfoTab(core: Core, id: String, nutrient: String?, onAmount: (String, String) -> Unit) {
    var per by remember(id) { mutableStateOf<String?>(null) }
    var unit by remember(id) { mutableStateOf<String?>(null) }
    val view by produceState<FoodInfoView?>(null, id, per, unit, nutrient) {
        value = runCatching { core.get(FoodInfoView.serializer(), "foodInfo", JsonPrimitive(id), app.foodtracker.jsOf(per), app.foodtracker.jsOf(unit), app.foodtracker.jsOf(nutrient)) }.getOrNull() ?: value
    }
    val v = view ?: return
    if (v.missing) return
    LaunchedEffect(per ?: v.per, unit ?: v.unit) { onAmount(per ?: v.per, unit ?: v.unit) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Muted("per", size = 16.sp)
        TextBox(per ?: v.per, { per = it }, Modifier.weight(0.45f), decimal = true)
        Box(Modifier.weight(1f)) { SelectBox(unit ?: v.unit, v.units.map { SelectOption(it, it) }, unit ?: v.unit, { unit = it }, searchable = false) }
    }
    v.energy?.let { H3("Energy by macro"); EnergyChart(it) }
    H3("Nutrients")
    Muted(v.about, size = 13.sp)
    if (v.failed) Text("Some of it can't be computed (missing food or unit conversion).", color = C.warn, fontSize = 13.sp)
    v.table?.let { NutrientTable(it) }
    Gap(6.dp)
    H3("Amounts")
    InfoList(v.list, core::go)
}
