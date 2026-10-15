package app.foodtracker.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

// Records have the same shape (and field names) as the web app's IndexedDB rows, so an export from either app
// imports into the other. Numbers that aren't known are NaN (JSON null in export files, see Repo.exportAll).

@Serializable
data class User(val id: Long = 0, val name: String = "")

/** A nutrient value as typed: `text` keeps the digits (precision); `deltaAuto` = Δ from those digits. */
@Serializable
data class Nutrient(
    val value: Double = Double.NaN,
    val delta: Double = Double.NaN,
    val text: String? = null,
    val deltaAuto: Boolean? = null,
)

/** `fromAmount ± fromDelta fromUnit` = `toAmount ± toDelta toUnit`, e.g. 1 slice = 30 ± 5 g. */
@Serializable
data class UnitConv(
    val fromAmount: Double = Double.NaN,
    val fromText: String? = null,
    val fromDelta: Double = 0.0,
    val fromDeltaAuto: Boolean? = null,
    val fromUnit: String = "",
    val toAmount: Double = Double.NaN,
    val toText: String? = null,
    val toDelta: Double = 0.0,
    val toDeltaAuto: Boolean? = null,
    val toUnit: String = "",
)

@Serializable
data class Component(
    val itemId: Long? = null,
    val amount: Double = Double.NaN,
    val amountText: String? = null,
    val amountDelta: Double = 0.0,
    val amountDeltaAuto: Boolean? = null,
    val unit: String = "",
)

/** Where an imported food came from: CIQUAL (numeric food code) or Open Food Facts (barcode string). */
@Serializable
data class Source(val db: String, val id: JsonPrimitive, val version: String? = null)

/**
 * A food. Ingredient, recipe (has components) and concoction (has madeAt) are the same record; what it "is"
 * follows from its fields. Attributes are [key, value] pairs and change the food's identity.
 */
@Serializable
data class Item(
    val id: Long = 0,
    val name: String = "",
    val brand: String = "",
    val attributes: List<List<String>> = emptyList(),
    val amount: Double = Double.NaN,
    val amountText: String? = null,
    val amountDelta: Double = 0.0,
    val amountDeltaAuto: Boolean? = null,
    val unit: String = "",
    val madeAt: String? = null,
    val units: List<UnitConv> = emptyList(),
    val components: List<Component> = emptyList(),
    val nutrients: Map<String, Nutrient> = emptyMap(),
    val source: Source? = null,
)

/** A consumption ("log" in storage, like the web app). */
@Serializable
data class Log(
    val id: Long = 0,
    val userId: Long = 0,
    val datetime: String = "",
    val itemId: Long? = null,
    val amount: Double = Double.NaN,
    val amountText: String? = null,
    val amountDelta: Double = 0.0,
    val amountDeltaAuto: Boolean? = null,
    val unit: String = "",
)

@Serializable
data class Range(val min: Double? = null, val max: Double? = null) {
    val hasMin get() = min != null && min.isFinite()
    val hasMax get() = max != null && max.isFinite()
}

/** Daily min/max per nutrient, valid from `validFrom` until the next target of the same user. */
@Serializable
data class Target(
    val id: Long = 0,
    val userId: Long = 0,
    val validFrom: String = "",
    val values: Map<String, Range> = emptyMap(),
)

@Serializable
data class Config(val dayStart: String = "05:00", val dashboard: String = "gauges")

/** A config table row: key "main" holds a Config, key "currentUser" holds a user id. */
@Serializable
data class ConfigRow(val key: String, val value: JsonElement)

enum class Kind { Ingredient, Recipe, Concoction }

fun Item.kind(): Kind = when {
    !madeAt.isNullOrEmpty() -> Kind.Concoction
    components.isNotEmpty() -> Kind.Recipe
    else -> Kind.Ingredient
}

fun Kind.label() = name.lowercase()
