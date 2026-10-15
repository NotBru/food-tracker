package app.foodtracker.data

import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.abs
import kotlin.math.floor

// Port of the web app's nutrients.js.

/** `default = 0.0`: preset to 0 (design.md); anything else not filled in is stored as NaN. */
data class NutrientDef(val key: String, val label: String, val unit: String, val default: Double? = null)

val NUTRIENTS = listOf(
    NutrientDef("energy", "Energy", "kcal"),
    NutrientDef("proteins", "Proteins", "g", 0.0),
    NutrientDef("fat", "Fat", "g", 0.0),
    NutrientDef("saturatedFat", "Saturated fat", "g"),
    NutrientDef("monounsaturatedFat", "Monounsaturated fat", "g"),
    NutrientDef("polyunsaturatedFat", "Polyunsaturated fat", "g"),
    NutrientDef("transFat", "Trans fat", "g"),
    NutrientDef("cholesterol", "Cholesterol", "mg"),
    NutrientDef("carbohydrates", "Carbohydrates", "g", 0.0),
    NutrientDef("sugars", "Sugars", "g"),
    NutrientDef("addedSugars", "Added sugars", "g"),
    NutrientDef("fibers", "Fibers", "g"),
    NutrientDef("sodium", "Sodium", "mg"),
    NutrientDef("salt", "Salt", "g"),
    NutrientDef("potassium", "Potassium", "mg"),
    NutrientDef("chloride", "Chloride", "mg"),
    NutrientDef("calcium", "Calcium", "mg"),
    NutrientDef("phosphorus", "Phosphorus", "mg"),
    NutrientDef("magnesium", "Magnesium", "mg"),
    NutrientDef("iron", "Iron", "mg"),
    NutrientDef("zinc", "Zinc", "mg"),
    NutrientDef("copper", "Copper", "mg"),
    NutrientDef("manganese", "Manganese", "mg"),
    NutrientDef("fluoride", "Fluoride", "mg"),
    NutrientDef("selenium", "Selenium", "µg"),
    NutrientDef("chromium", "Chromium", "µg"),
    NutrientDef("molybdenum", "Molybdenum", "µg"),
    NutrientDef("iodine", "Iodine", "µg"),
    NutrientDef("vitaminA", "Vitamin A", "µg"),
    NutrientDef("vitaminB1", "Vitamin B1 (thiamin)", "mg"),
    NutrientDef("vitaminB2", "Vitamin B2 (riboflavin)", "mg"),
    NutrientDef("vitaminB3", "Vitamin B3 (niacin)", "mg"),
    NutrientDef("vitaminB5", "Vitamin B5 (pantothenic acid)", "mg"),
    NutrientDef("vitaminB6", "Vitamin B6", "mg"),
    NutrientDef("vitaminB7", "Vitamin B7 (biotin)", "µg"),
    NutrientDef("vitaminB9", "Vitamin B9 (folate)", "µg"),
    NutrientDef("vitaminB12", "Vitamin B12", "µg"),
    NutrientDef("vitaminC", "Vitamin C", "mg"),
    NutrientDef("vitaminD", "Vitamin D", "µg"),
    NutrientDef("vitaminE", "Vitamin E", "mg"),
    NutrientDef("vitaminK", "Vitamin K", "µg"),
    NutrientDef("alcohol", "Alcohol", "g"),
    NutrientDef("caffeine", "Caffeine", "mg"),
    NutrientDef("water", "Water", "g"),
)
val NUTRIENT_BY_KEY = NUTRIENTS.associateBy { it.key }
fun nutrientRank(key: String) = NUTRIENTS.indexOfFirst { it.key == key }

fun emptyNutrients(): Map<String, Nutrient> = NUTRIENTS.associate {
    it.key to Nutrient(value = it.default ?: Double.NaN, delta = if (it.default == 0.0) 0.0 else Double.NaN, text = "", deltaAuto = true)
}

// --- JS number semantics -------------------------------------------------------------------------------------
// Typed numbers go through these so the app reads and prints them exactly like the web app.

private val NUMBER = Regex("""^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$""")

/** JS `Number(text)`: blank -> 0, junk -> NaN. */
fun jsNumber(text: String): Double {
    val s = text.trim()
    if (s.isEmpty()) return 0.0
    return if (NUMBER.matches(s)) s.toDouble() else Double.NaN
}

/** JS `String(x)`: 100.0 -> "100", 0.1 -> "0.1". */
fun jsString(x: Double): String = when {
    x.isNaN() -> "NaN"
    x.isInfinite() -> if (x > 0) "Infinity" else "-Infinity"
    x == floor(x) && abs(x) < 1e15 -> x.toLong().toString()
    else -> BigDecimal(x.toString()).stripTrailingZeros().toPlainString()
}

// Default Δ from the digits typed: one unit of the last digit, same precision as the input ("59.8" -> 0.1, "12" -> 1).
// A trailing dot means one decimal place: "3." is read as "3.0".
fun normalizeNumber(text: String): String {
    val s = text.trim()
    return if (Regex("""^[+-]?\d+\.$""").matches(s)) "${s}0" else s
}

fun deltaFromInput(text: String): Double {
    val s = normalizeNumber(text)
    if (s.isEmpty() || jsNumber(s).isNaN()) return Double.NaN
    val decimals = if ('.' in s) s.substringAfter('.').length else 0
    return BigDecimal.ONE.movePointLeft(decimals).toDouble()
}

/** An amount typed as `text` with its error typed as `deltaText`. Blank error = from the digits. */
data class Measure(val value: Double, val text: String, val delta: Double, val auto: Boolean)

fun measure(text: String?, deltaText: String?): Measure {
    val t = normalizeNumber(text ?: "")
    val auto = (deltaText ?: "").trim().isEmpty()
    val fromDigits = deltaFromInput(t).let { if (it.isNaN() || it == 0.0) 0.0 else it }
    val typed = abs(jsNumber(deltaText ?: "")).let { if (it.isNaN()) 0.0 else it }
    return Measure(
        value = if (t.isEmpty()) Double.NaN else jsNumber(t),
        text = t,
        delta = if (auto) fromDigits else typed,
        auto = auto,
    )
}

/** Form texts from stored fields: the amount as typed, and the error (blank when it's the digits default). */
fun amountText(value: Double, text: String?): String = text ?: if (value.isFinite()) jsString(value) else ""
fun deltaText(delta: Double, auto: Boolean?): String = if (auto == true || !delta.isFinite()) "" else jsString(delta)

// --- Values with errors, as used in computations --------------------------------------------------------------

/** A computed nutrient: value ± delta; `missing` = some food involved doesn't know it. */
data class NV(var value: Double, var delta: Double, var missing: Boolean = false, var estimated: Boolean = false)

typealias Totals = MutableMap<String, NV>

fun Map<String, Nutrient>.toNV(): Map<String, NV> = mapValues { (_, n) -> NV(n.value, n.delta) }

/** Calories shown everywhere: stored energy if known, otherwise the Atwater estimate 4/4/9 (+7 alcohol). */
fun calories(n: Map<String, NV>): NV {
    n["energy"]?.let { if (it.value.isFinite()) return it.copy() }
    fun v(k: String) = n[k]?.value?.takeIf { it.isFinite() } ?: 0.0
    fun d(k: String) = n[k]?.delta?.takeIf { it.isFinite() } ?: 0.0
    return NV(
        value = 4 * v("proteins") + 4 * v("carbohydrates") + 9 * v("fat") + 7 * v("alcohol"),
        delta = 4 * d("proteins") + 4 * d("carbohydrates") + 9 * d("fat") + 7 * d("alcohol"),
        estimated = true,
    )
}

/** JS `x.toFixed(abs >= 100 ? 0 : digits)` without trailing ".0…"; "–" for NaN. */
fun fmt(x: Double, digits: Int = 1): String {
    if (!x.isFinite()) return "–"
    val d = if (abs(x) >= 100) 0 else digits
    val s = BigDecimal(x).setScale(d, RoundingMode.HALF_UP).toPlainString().let { if (it == "-0" || it.matches(Regex("-0\\.0+"))) it.drop(1) else it }
    return s.replace(Regex("""\.0+$"""), "")
}

/** "1800–2200", "≥ 120" or "≤ 2300" for a target range. */
fun rangeLabel(r: Range): String = when {
    r.hasMin && r.hasMax -> "${fmt(r.min!!, 0)}–${fmt(r.max!!, 0)}"
    r.hasMin -> "≥ ${fmt(r.min!!, 0)}"
    else -> "≤ ${fmt(r.max ?: Double.NaN, 0)}"
}
