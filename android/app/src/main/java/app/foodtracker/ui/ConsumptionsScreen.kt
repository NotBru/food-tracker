package app.foodtracker.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.ConsumptionEditorReply
import app.foodtracker.ConsumptionsView
import app.foodtracker.Core
import app.foodtracker.FoodLabel
import app.foodtracker.SaveReply
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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Consumptions, native: a port of app/src/screens/Consumptions.jsx. The list and the editor's numbers come from the
// web app (native/core.js consumptions, consumptionEditor; the editor's logic is app/src/consumptionForm.js).

/**
 * The consumption editor, stashed while "+ register food" makes a new food over it (consumptionForm.js
 * stashForNewFood): back on `route`, the editor opens again as it was, the new food (`created`, once it's saved) picked.
 * In memory only.
 */
class StashedConsumption(val route: String, val consumption: JsonObject, val form: JsonObject, var created: JsonElement? = null) {
    /** The editor's opening args (core.js consumptionEditor): the stashed form, with the new food picked. */
    fun open() = js("consumption" to consumption, "form" to form, "event" to created?.let { listOf("pick", it) })
}

object ConsumptionStash {
    var stashed: StashedConsumption? = null
    /** The editor stashed on `route`, taken off; null if none. */
    fun take(route: String): JsonObject? = stashed?.takeIf { it.route == route }?.also { stashed = null }?.open()
}

/** A day's consumptions. `editing`: the editor's opening args (core.js consumptionEditor), or null. */
@Composable
fun ConsumptionsScreen(view: ConsumptionsView?, core: Core, route: String, editing: JsonObject?, onEdit: (JsonObject?) -> Unit) {
    val context = LocalContext.current
    var ask by remember { mutableStateOf<Asking?>(null) }
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize()) {
        ScreenFrame("Consumptions", view?.user, onBack = core::back, right = {
            RoundIconButton("Pick day", { view?.let { v -> pickDate(context, v.day) { core.replace("/consumptions?day=$it") } } }) { Text("📅", fontSize = 18.sp) }
        }) {
            if (view != null) {
                Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    RoundIconButton("Previous day", { core.replace(view.prev) }) { Chevron() }
                    Text(view.title, color = C.text, fontWeight = FontWeight.SemiBold)
                    RoundIconButton("Next day", { core.replace(view.next) }) { Chevron(rotation = 180f) }
                }
                AddRow("+ add consumption", { onEdit(js("day" to view.day)) })
                for (row in view.rows) {
                    ListCard({ core.go(row.open) }, onDelete = {
                        ask = Asking(row.ask, "Delete") { scope.launch { core.call("deleteConsumption", JsonPrimitive(row.id)) } }
                    }) {
                        MainLine(row.label, row.line, row.made)
                        MacroText(row.macros)
                    }
                }
            }
        }
        if (editing != null) ConsumptionEditorSheet(core, route, editing, onClose = { onEdit(null) })
    }
    ask?.Show { ask = null }
}

/** An alert (no [confirm]) or a question, as the web app's alert() and confirm(); [onCancel] when answered no. */
class Asking(val text: String, val confirm: String? = null, val danger: Boolean = confirm == "Delete", val onCancel: () -> Unit = {}, val onConfirm: () -> Unit = {}) {
    @Composable
    fun Show(onDismiss: () -> Unit) = Ask(text, onDismiss, confirm, danger, onCancel = onCancel, onConfirm = onConfirm)
}

/**
 * Consumptions.jsx ConsumptionEditor, the add/edit sheet. `open`: core.js consumptionEditor's opening args ({id} or
 * {day}, or a stash's [StashedConsumption.open]). The form is kept here as typed; the web app says what it adds up to
 * after each change. `route`: the screen it's over, for "+ register food" to come back to.
 */
@Composable
fun ConsumptionEditorSheet(core: Core, route: String, open: JsonObject, onClose: () -> Unit, onDeleted: () -> Unit = onClose) {
    var reply by remember(open) { mutableStateOf<ConsumptionEditorReply?>(null) }
    var form by remember(open) { mutableStateOf<JsonObject?>(null) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    val scope = rememberCoroutineScope()
    val ser = ConsumptionEditorReply.serializer()

    LaunchedEffect(open) {
        try {
            val r = core.get(ser, "consumptionEditor", open)
            reply = r
            form = r.form
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            ask = Asking(e.message ?: "Couldn't open it.")
            onClose()
        }
    }
    LaunchedEffect(form) {
        val r = reply ?: return@LaunchedEffect
        val f = form ?: return@LaunchedEffect
        if (f == r.form) return@LaunchedEffect
        try { reply = core.get(ser, "consumptionEditor", js("consumption" to r.consumption, "form" to f)).copy(form = f) }
        catch (e: CancellationException) { throw e } catch (_: Exception) {}
    }
    val r = reply
    val f = form
    if (r == null || f == null) return
    val v = r.view
    val args = { js("consumption" to r.consumption, "form" to f) }
    fun set(key: String, value: Any?) { form = f.with(key, value) }
    fun event(name: String, arg: Any? = null) = scope.launch {
        runCatching { core.get(ser, "consumptionEditor", js("consumption" to r.consumption, "form" to f, "event" to listOf(name, arg))) }
            .onSuccess { reply = it; form = it.form }
    }
    fun save(confirmed: Boolean = false): Unit { scope.launch {
        val s = runCatching { core.get(SaveReply.serializer(), "saveConsumption", args(), JsonPrimitive(confirmed)) }
            .getOrElse { SaveReply(alert = "Couldn't save: ${it.message}") }
        when {
            s.alert != null -> ask = Asking(s.alert)
            s.confirm != null -> ask = Asking(s.confirm, "Save") { save(true) }
            s.done -> onClose()
        }
    } }
    val search: suspend (String) -> List<FoodLabel> = { q -> core.get(ListSerializer(FoodLabel.serializer()), "foodSearch", JsonPrimitive(q), v.search) }
    val concoction = f.bool("concoction")

    SheetOverlay(onClose) {
        SheetTitle(v.title)
        Field("Date and time") { DateTimeBox(f.str("datetime")) { set("datetime", it) } }
        if (v.isNew) CheckRow(concoction, "New concoction (made at this time)") { event("concoction", it) }
        if (concoction) {
            Field("Name") { TextBox(f.str("name"), { set("name", it) }) }
            Field("Brand") { TextBox(f.str("brand"), { set("brand", it) }) }
            Field("Attributes") { AttributesEditor(f.pairs("attributes")) { set("attributes", it) } }
            H3("Components")
            val comps = f.objects("components")
            comps.forEachIndexed { i, c ->
                val cv = v.components.getOrNull(i)
                fun setC(key: String, value: Any?) { form = f.withAt("components", i, js(key to value)) }
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(C.panel).padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FoodPicker(cv?.item, search, { event("component", listOf(i, it)) }, bg = C.bg)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
                        TextBox(c.str("amount"), { setC("amount", it) }, Modifier.weight(1f), placeholder = "amount", decimal = true, bg = C.bg,
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp))
                        DeltaBox(c.str("amountDelta"), cv?.deltaPlaceholder ?: "auto", { setC("amountDelta", it) }, Modifier.weight(0.8f), bg = C.bg)
                        UnitCombo(cv?.units, c.str("unit"), { setC("unit", it) }, Modifier.weight(1f), bg = C.bg)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        EntryErrorChip(cv?.entryError ?: "", { setC("entryError", it) }, bg = C.bg)
                        Box(Modifier.weight(1f)) { MacroText(cv?.macros) }
                        RoundIconButton("Remove", { event("removeComponent", i) }) { Text("×", color = C.text, fontSize = 20.sp) }
                    }
                }
            }
            AddRow("+ add component", { event("addComponent") })
            v.total?.let { Muted(it, size = 13.sp) }
        } else {
            Field("Item") {
                FoodPicker(v.item, search, { event("pick", it) }, onRegister = { text ->
                    ConsumptionStash.stashed = StashedConsumption(route, r.consumption, f)
                    core.go("/foods/new?for=consumption${if (text.isNotEmpty()) "&name=${Uri.encode(text)}" else ""}")
                })
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
            Field(v.amountLabel, Modifier.weight(1f)) { TextBox(f.str("amount"), { set("amount", it) }, placeholder = v.amountPlaceholder, decimal = true) }
            Field("± Δ", Modifier.weight(1f)) { DeltaBox(f.str("amountDelta"), v.deltaPlaceholder, { set("amountDelta", it) }) }
            Field("Unit", Modifier.weight(1f)) { UnitCombo(v.units, f.str("unit"), { set("unit", it) }) }
        }
        if (v.ownFood) Field("Entry error, % (how far the food may be from what's eaten; 0 if it's the product on the label)") {
            TextBox(f.str("entryError"), { set("entryError", it) }, placeholder = v.entryErrorPlaceholder, decimal = true, onDone = { save() })
        }
        if (concoction) Field("Expires after (days)") {
            TextBox(f.str("expiresAfterDays"), { set("expiresAfterDays", it) }, placeholder = v.expiryPlaceholder, decimal = true)
        }
        v.max?.let { PillButton(it, { event("max") }, Modifier.fillMaxWidth(), bg = C.panel, fg = C.text) }
        v.preview?.let { MacroText(it, 16.sp) }
        v.details?.let { DetailsDropdown(it) }
        SheetActions(v.save, { save() }, onClose, onDelete = if (v.isNew) null else ({
            ask = Asking("Delete this entry?", "Delete") {
                scope.launch {
                    runCatching { core.call("deleteConsumption", r.consumption["id"] ?: JsonNull) }
                    onDeleted()
                }
            }
        }))
    }
    ask?.Show { ask = null }
}
