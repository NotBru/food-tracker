package app.foodtracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import app.foodtracker.LocalRepo
import app.foodtracker.data.Ctx
import app.foodtracker.data.Log
import app.foodtracker.data.NUTRIENTS
import app.foodtracker.data.NV
import app.foodtracker.data.amountText
import app.foodtracker.data.consumptionNutrients
import app.foodtracker.data.dayBounds
import app.foodtracker.data.deltaText
import app.foodtracker.data.fmt
import app.foodtracker.data.isoOf
import app.foodtracker.data.jsString
import app.foodtracker.data.keepUnit
import app.foodtracker.data.localOf
import app.foodtracker.data.measure
import app.foodtracker.data.nowIso
import app.foodtracker.data.prettyDay
import app.foodtracker.data.timeLabel
import app.foodtracker.data.today
import app.foodtracker.data.unitsFor
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.time.LocalTime

/** A scrollable list of one day's consumptions, newest first, with a day picker. */
@Composable
fun ConsumptionsScreen(route: Route.Consumptions) {
    val repo = LocalRepo.current
    val config by repo.config.collectAsState(null)
    val user by repo.currentUser.collectAsState(null)
    val ctx by repo.ctx.collectAsState(null)
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val cfg = config
    val u = user
    val todayDay = remember(cfg?.dayStart, lifecycle) { cfg?.let { today(it.dayStart) } }
    val day = route.day ?: todayDay
    val logs by remember(u?.id, day, cfg?.dayStart) {
        if (u == null || day == null || cfg == null) flowOf(null)
        else dayBounds(day, cfg.dayStart).let { (start, end) -> repo.logsBetween(u.id, start, end) }
    }.collectAsState(null)
    var editing by remember { mutableStateOf<Log?>(null) }
    var picking by remember { mutableStateOf(false) }
    val nav = app.foodtracker.LocalNav.current

    Screen("Consumptions", nav::back, subtitle = u?.name, right = { IconCircle("📅", "Pick day") { picking = true } }) {
        val c = ctx
        val l = logs
        if (day == null || c == null || l == null || u == null || cfg == null) return@Screen
        // Browsing days replaces the day shown; back doesn't walk through them.
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconCircle("‹", "Previous day") { route.day = day.minusDays(1) }
            Text(prettyDay(day), Modifier.weight(1f), color = C.text, fontWeight = FontWeight.SemiBold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            IconCircle("›", "Next day") { route.day = day.plusDays(1) }
        }
        AddCard("+ add consumption") {
            // Default time: now if viewing today, otherwise noon of the viewed day.
            val dt = if (day == today(cfg.dayStart)) nowIso() else isoOf(day.atTime(LocalTime.NOON))
            editing = Log(datetime = dt, userId = u.id)
        }
        for (log in l) {
            val item = c.resolve(log.itemId)
            val n = remember(c, log) { consumptionNutrients(c, log) }
            ListCard({ editing = log }) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (item != null) itemLabel(item) else "(deleted item)", Modifier.weight(1f), color = C.text)
                    val err = if (log.amountDeltaAuto == false) " ±${jsString(log.amountDelta)}" else ""
                    Muted("${timeLabel(log.datetime)} · ${amountText(log.amount, log.amountText)}$err ${log.unit}")
                }
                MacroLine(n.nutrients, n.ok, deltas = true)
            }
        }
    }
    if (picking && day != null) DatePickerPopup(day, { route.day = it }) { picking = false }
    editing?.let { e -> ctx?.let { c -> ConsumptionEditor(c, e) { editing = null } } }
}

@Composable
private fun ConsumptionEditor(ctx: Ctx, log: Log, onClose: () -> Unit) {
    val repo = LocalRepo.current
    val dialogs = LocalDialogs.current
    val scope = rememberCoroutineScope()
    var datetime by remember { mutableStateOf(localOf(log.datetime)) }
    var itemId by remember { mutableStateOf(log.itemId) }
    var amount by remember { mutableStateOf(amountText(log.amount, log.amountText)) }
    var delta by remember { mutableStateOf(deltaText(log.amountDelta, log.amountDeltaAuto)) }
    var unit by remember { mutableStateOf(log.unit) }
    // Error of the amount; blank = from the digits typed, like nutrient values ("250" -> ±1, "1.5" -> ±0.1).
    val m = measure(amount, delta)
    val preview = if (itemId != null && m.value > 0 && unit.isNotBlank())
        consumptionNutrients(ctx, Log(itemId = itemId, amount = m.value, unit = unit, amountDelta = m.delta)) else null

    fun save() {
        val id = itemId
        if (id == null || !(m.value > 0) || unit.isBlank()) return dialogs.alert("Item, amount and unit are required.")
        val u = unit.trim()
        val rec = log.copy(
            datetime = isoOf(datetime), itemId = id, amount = m.value, amountText = m.text, amountDelta = m.delta,
            amountDeltaAuto = m.auto, unit = u,
        )
        val write = { scope.launch { repo.saveLog(rec); onClose() } } // stays on the same day even if the date changed
        if (u.lowercase() !in unitsFor(ctx, id)) dialogs.confirm(
            "“$u” doesn't convert for this food, so its nutrients can't be computed (add it under the food's Units). Save anyway?",
            "Save",
        ) { write() } else write()
    }

    EditorSheet(if (log.id != 0L) "Edit consumption" else "New consumption", onClose) {
        Field("Date and time") { DateTimeField(datetime) { datetime = it } }
        Field("Item") { ItemPicker(ctx, itemId, { id -> itemId = id; unit = keepUnit(ctx, id, unit) }) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Field("Amount", Modifier.weight(1f)) { Input(amount, { amount = it }, number = true, description = "Amount") }
            Field("± Δ", Modifier.weight(0.75f)) { DeltaInput(delta, { delta = it }, amount) }
            Field("Unit", Modifier.weight(1f)) { UnitCombo(itemId?.let { unitsFor(ctx, it) }, unit, { unit = it }) }
        }
        if (preview != null) MacroLine(preview.nutrients, preview.ok, deltas = true)
        if (preview?.ok == true) NutrientDetails(preview.nutrients)
        Actions {
            if (log.id != 0L) PillButton("Delete", {
                dialogs.confirm("Delete this entry?", "Delete", danger = true) { scope.launch { repo.deleteLog(log.id); onClose() } }
            }, look = Look.Danger)
            PillButton("Cancel", onClose, look = Look.Secondary)
            PillButton("Save", ::save)
        }
    }
}

/**
 * Drop-down with every nutrient known for this consumption (e.g. a coffee's caffeine, which the macro line hides).
 * Nutrients no food in it has a value for are left out; "+?" marks one only some of its components know.
 */
@Composable
private fun NutrientDetails(nutrients: Map<String, NV>) {
    var open by remember { mutableStateOf(false) }
    val rows = NUTRIENTS.filter { d -> d.key != "energy" && nutrients[d.key]?.let { !(it.missing && it.value == 0.0) } == true }
    Column {
        PillButton("${if (open) "▾" else "▸"} Details", { open = !open }, look = Look.Link)
        if (open) Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(C.panel).padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            rows.forEachIndexed { i, d ->
                val n = nutrients.getValue(d.key)
                if (i > 0) HorizontalDivider(color = C.line)
                Row(Modifier.padding(vertical = 3.dp)) {
                    Text(d.label, Modifier.weight(1f), color = C.text, fontSize = 14.sp)
                    Text(
                        buildAnnotatedString {
                            append(fmt(n.value, 2))
                            withStyle(SpanStyle(color = C.muted)) { append(" ±${fmt(n.delta.takeIf { it.isFinite() } ?: 0.0, 2)}") }
                            append(" ${d.unit}")
                            if (n.missing) withStyle(SpanStyle(color = C.muted)) { append(" +?") }
                        },
                        color = C.text, fontSize = 14.sp,
                    )
                }
            }
            if (rows.isEmpty()) Muted("No nutrients known")
        }
    }
}
