package app.foodtracker

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// The views app/src/native/core.js sends: texts already formatted, links as routes. Only what's laid out is here.

/** The sync icon (core.js syncStatus): state off | conflict | syncing | error | unreachable | waiting | synced. */
@Serializable
data class SyncStatus(val state: String, val text: String, val label: String? = null)

/** The homescreen (core.js home). */
@Serializable
data class HomeView(
    val win: String,
    val winName: String,
    val title: String,
    val dots: List<Boolean>,
    val daily: Boolean,
    val prevWin: String,
    val nextWin: String,
    val prevDay: String,
    val nextDay: String? = null,
    val todayView: String? = null,
    val user: String,
    val version: String? = null,
    val style: String,
    val rows: List<DashRow>,
    val summary: String,
    val failed: String? = null,
    val consumptions: String,
    val addConsumption: String,
)

@Serializable
data class DashRow(
    val key: String,
    val label: String,
    val unit: String,
    /** c-kcal | c-prot | c-fat | c-carb | "" (the value's colour) */
    val color: String,
    val value: String,
    val pm: String,
    val err: String,
    val bar: Bar? = null,
    val ghost: Span? = null,
    val rangeLine: String,
    val budget: Budget? = null,
    val open: String,
)

/** A target bar, in % of its width (dashboard.js): regions under/ok/over, the fill in pieces, the estimate's tick. */
@Serializable
data class Bar(
    val status: String,
    val dummy: Boolean,
    val minAt: Double? = null,
    val maxAt: Double? = null,
    val fill: Double? = null,
    val end: Double? = null,
    val pieces: List<Piece>,
    val mean: Boolean,
)

@Serializable
data class Piece(val from: Double, val to: Double, val region: String, val hatched: Boolean)

@Serializable
data class Span(val from: Double, val to: Double)

@Serializable
data class Budget(val text: String, val over: Boolean)

/** Export databases (core.js exportFile). */
@Serializable
data class ExportFile(val name: String, val text: String)

// --- Shared parts ---

/** components.jsx MacroLine (core.js macroLine): ok false = "can't compute". */
@Serializable
data class MacroLine(val ok: Boolean, val parts: List<MacroPart> = emptyList())

@Serializable
data class MacroPart(val color: String, val text: String, val pm: String? = null, val after: String = "")

/** A food as pickers list it (core.js foodSearch). */
@Serializable
data class FoodLabel(val id: String, val label: String, val recipe: Boolean = false, val made: String? = null)

/** A nutrient of "Details" (Consumptions.jsx NutrientDetails). */
@Serializable
data class DetailRow(val label: String, val value: String, val pm: String, val unit: String, val missing: Boolean = false)

/** What a save says (core.js): can't ([alert]), asks first ([confirm], then saved again confirmed), or [done]. */
@Serializable
data class SaveReply(val alert: String? = null, val confirm: String? = null, val done: Boolean = false, val id: JsonElement? = null)

// --- Consumptions ---

@Serializable
data class ConsumptionsView(
    val day: String,
    val title: String,
    val user: String,
    val prev: String,
    val next: String,
    val rows: List<ConsumptionRow>,
)

@Serializable
data class ConsumptionRow(
    val id: String,
    val label: String,
    val made: String? = null,
    val line: String,
    val macros: MacroLine,
    val open: String,
    val ask: String,
)

/** core.js consumptionEditor: the consumption and form to send back, and what to show. */
@Serializable
data class ConsumptionEditorReply(val consumption: JsonObject, val form: JsonObject, val view: ConsumptionEditorView)

@Serializable
data class ConsumptionEditorView(
    val title: String,
    val isNew: Boolean,
    val item: FoodLabel? = null,
    val amountLabel: String,
    val amountPlaceholder: String? = null,
    val deltaPlaceholder: String,
    val units: List<String>? = null,
    val ownFood: Boolean,
    val entryErrorPlaceholder: String,
    val expiryPlaceholder: String,
    val max: String? = null,
    val preview: MacroLine? = null,
    val details: List<DetailRow>? = null,
    val components: List<EditorComponent> = emptyList(),
    val total: String? = null,
    val save: String,
    val search: JsonObject,
)

@Serializable
data class EditorComponent(
    val item: FoodLabel? = null,
    val units: List<String>? = null,
    val deltaPlaceholder: String,
    val entryError: String,
    val macros: MacroLine? = null,
)

// --- Info screens ---

/** A piece of rich text (core.js): bold, muted, a colour (warn, kcal, …), small. */
@Serializable
data class Rich(val t: String, val b: Boolean = false, val m: Boolean = false, val c: String? = null, val small: Boolean = false)

/** An `.info-list` row: a muted label, then its text; maybe a tag, a muted "more", a line under it, a link. */
@Serializable
data class InfoItem(
    val label: String? = null,
    val text: List<Rich> = emptyList(),
    val tag: String? = null,
    val more: String? = null,
    val sub: String? = null,
    val link: String? = null,
    /** A component's value of the nutrient it's ranked by (FoodInfo.jsx info-lead). */
    val lead: List<Rich>? = null,
    /** A plain muted note between rows. */
    val note: Boolean = false,
)

/** EnergyChart.jsx (core.js energyChart). */
@Serializable
data class EnergyChartView(val total: String, val totalPm: String, val slices: List<EnergySlice>, val legend: List<EnergyLegendRow>, val note: String)

@Serializable
data class EnergySlice(val label: String, val tone: String, val shade: Double, val share: Double, val kcal: String, val pct: String)

@Serializable
data class EnergyLegendRow(val macro: Boolean, val label: String, val tone: String, val shade: Double, val g: String, val kcal: String, val pct: String)

/** FoodInfo.jsx NutrientTable (core.js nutrientTable). */
@Serializable
data class NutrientTableView(val rows: List<NutrientTableRow>, val missing: Boolean)

@Serializable
data class NutrientTableRow(val label: String, val missing: Boolean, val value: String, val pm: String, val unit: String, val range: String, val cv: String)

@Serializable
data class ConsumptionInfoView(
    val found: Boolean,
    val title: String = "",
    val subtitle: String = "",
    val list: List<InfoItem> = emptyList(),
    val macros: MacroLine? = null,
    val failed: Boolean = false,
    val energy: EnergyChartView? = null,
    val table: NutrientTableView? = null,
)

// --- Temp notes ---

@Serializable
data class NotesView(val user: String, val userId: JsonElement, val keep: String, val rows: List<NoteRow>)

@Serializable
data class NoteRow(
    val note: JsonObject,
    val `when`: String,
    val title: String,
    val done: Boolean,
    val left: String,
    val text: String,
    val pics: List<NotePic>,
)

/** A note's picture: stored ([id]; [have] once it's on this device) or picked and not saved yet ([key]). */
@Serializable
data class NotePic(val id: String? = null, val key: String? = null, val name: String? = null, val have: Boolean = true) {
    val ref get() = id ?: key!!
}

// --- Foods ---

@Serializable
data class FoodsView(val rows: List<FoodRow>)

@Serializable
data class FoodRow(
    val id: String,
    val label: String,
    val recipe: Boolean = false,
    val made: String? = null,
    val conflict: Boolean = false,
    val per: String,
    val macros: MacroLine,
)

@Serializable
data class FoodEditorReply(val form: JsonObject? = null, val view: FoodEditorView)

@Serializable
data class FoodEditorView(
    val missing: Boolean,
    val isNew: Boolean = false,
    val title: String = "",
    val copyNote: String? = null,
    val external: String? = null,
    val source: Link? = null,
    val units: List<UnitPlaceholders> = emptyList(),
    val expiryPlaceholder: String = "",
    val components: List<EditorComponent> = emptyList(),
    val deltaPlaceholder: String = "",
    val hasComponents: Boolean = false,
    val auto: AutoSum? = null,
    val previewLabel: String = "",
    val preview: MacroLine? = null,
    val nutrients: List<NutrientField> = emptyList(),
    val adder: List<NutrientOption> = emptyList(),
    val category: String = "",
    val sameId: List<String>? = null,
    val canDelete: Boolean = false,
    val search: JsonObject = JsonObject(emptyMap()),
)

@Serializable
data class Link(val text: String, val href: String)

@Serializable
data class UnitPlaceholders(val fromPlaceholder: String, val toPlaceholder: String)

@Serializable
data class AutoSum(val problem: String? = null, val text: String? = null)

@Serializable
data class NutrientField(val key: String, val label: String, val unit: String, val placeholder: String, val core: Boolean)

@Serializable
data class NutrientOption(val key: String, val label: String, val unit: String = "")

@Serializable
data class SelectOption(val value: String, val label: String, val group: String? = null)

@Serializable
data class FoodInfoView(
    val missing: Boolean,
    val per: String = "",
    val unit: String = "",
    val units: List<String> = emptyList(),
    val energy: EnergyChartView? = null,
    val about: String = "",
    val failed: Boolean = false,
    val table: NutrientTableView? = null,
    val list: List<InfoItem> = emptyList(),
)

// --- Targets ---

@Serializable
data class TargetsView(val user: String, val new: JsonObject, val rows: List<TargetRow>)

@Serializable
data class TargetRow(val target: JsonObject, val from: String, val tag: String? = null, val until: String? = null, val values: String)

@Serializable
data class TargetEditorView(val title: String, val validFrom: String, val rows: List<List<String>>, val nutrients: List<NutrientOption>)

// --- Body measurements ---

@Serializable
data class BodyView(
    val user: String,
    val userId: JsonElement,
    val weeks: List<BodyWeek>,
    val maint: Maintenance,
    val rows: List<BodyRow>,
    val known: JsonElement,
    val fields: List<BodyField>,
)

@Serializable
data class BodyWeek(val label: String, val value: String? = null, val unit: String, val pm: String? = null)

@Serializable
data class Maintenance(val need: String? = null, val value: String? = null, val range: String? = null, val detail: String? = null)

@Serializable
data class BodyRow(val entry: JsonObject, val text: String, val `when`: String)

@Serializable
data class BodyField(val key: String, val label: String, val unit: String, val hint: String? = null, val last: String? = null)

@Serializable
data class BodyEditorView(val title: String, val datetime: String, val texts: Map<String, ValueDelta>, val extra: List<BodyExtra>)

@Serializable
data class ValueDelta(val value: String = "", val delta: String = "")

@Serializable
data class BodyExtra(val label: String = "", val unit: String = "", val value: String = "", val delta: String = "")

@Serializable
data class NameHint(val label: String, val unit: String = "", val near: Boolean = false)

/** saveBody: like [SaveReply], or a name to ask about ([ask]). */
@Serializable
data class BodySaveReply(val alert: String? = null, val ask: BodyAsk? = null, val done: Boolean = false)

@Serializable
data class BodyAsk(val label: String, val near: String, val text: String)

// --- Users ---

@Serializable
data class UsersView(val rows: List<UserRow>, val canDelete: Boolean)

@Serializable
data class UserRow(val user: JsonObject, val name: String, val current: Boolean, val count: String, val deleteText: String)

// --- Config ---

@Serializable
data class ConfigView(val form: JsonObject, val placeholders: Map<String, String>, val references: List<ReferenceDb>)

@Serializable
data class ReferenceDb(val key: String, val name: String, val about: String)
