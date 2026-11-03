package app.foodtracker

import kotlinx.serialization.Serializable

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
