package app.foodtracker.data

import java.time.LocalDate
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Port of the web app's calc.js: unit conversion and nutrient computation with errors.

// Built-in conversions to a base unit per dimension.
private val BUILTIN = mapOf(
    "g" to ("mass" to 1.0), "kg" to ("mass" to 1000.0), "mg" to ("mass" to 0.001),
    "oz" to ("mass" to 28.349523125), "lb" to ("mass" to 453.59237),
    "ml" to ("volume" to 1.0), "l" to ("volume" to 1000.0), "cl" to ("volume" to 10.0), "dl" to ("volume" to 100.0),
    "tsp" to ("volume" to 4.92892), "tbsp" to ("volume" to 14.7868), "cup" to ("volume" to 236.588),
    "fl oz" to ("volume" to 29.5735),
)

fun normUnit(u: String?) = (u ?: "").trim().lowercase()

// --- Intervals -----------------------------------------------------------------------------------------------
// Every amount may carry an error (amount ± Δ). Scale factors are carried as [nominal, low, high] so the error of
// each nutrient can be taken at the worst case of all amounts involved.

data class Span(val nominal: Double, val low: Double, val high: Double) {
    operator fun times(o: Span) = Span(nominal * o.nominal, low * o.low, high * o.high)
    // Dividing by an interval that reaches 0 has no upper bound.
    operator fun div(o: Span) = Span(nominal / o.nominal, low / o.high, if (o.low > 0) high / o.low else Double.POSITIVE_INFINITY)

    companion object {
        fun exact(f: Double) = Span(f, f, f)
        val NONE = Span(Double.NaN, Double.NaN, Double.NaN)
    }
}

/** amount ± Δ; the low end never goes below 0. */
fun span(x: Double, d: Double): Span {
    val dd = abs(d).let { if (it.isNaN()) 0.0 else it }
    return Span(x, max(0.0, x - dd), x + dd)
}

private fun builtin(a: String, b: String): Double {
    val x = BUILTIN[a] ?: return Double.NaN
    val y = BUILTIN[b] ?: return Double.NaN
    return if (x.first == y.first) x.second / y.second else Double.NaN
}

/** Factor f such that `amount fromUnit` = `amount * f toUnit`, or NaN if unknown. */
fun unitFactor(fromUnit: String, toUnit: String, units: List<UnitConv> = emptyList()) =
    unitFactorSpan(fromUnit, toUnit, units).nominal

/**
 * Same as unitFactor, as an interval given the units' errors. Uses built-ins, then the food's own units
 * (e.g. 1 slice = 30 ± 5 g), chained through at most one built-in hop on either side (1 slice -> 30 g -> 0.03 kg).
 */
fun unitFactorSpan(fromUnit: String, toUnit: String, units: List<UnitConv> = emptyList()): Span {
    val from = normUnit(fromUnit)
    val to = normUnit(toUnit)
    if (from == to) return Span.exact(1.0)
    val direct = builtin(from, to)
    if (direct.isFinite()) return Span.exact(direct)

    val edges = mutableListOf<Triple<String, String, Span>>()
    for (c in units) {
        if (!(c.fromAmount > 0 && c.toAmount > 0)) continue
        val a = span(c.fromAmount, c.fromDelta)
        val b = span(c.toAmount, c.toDelta)
        edges += Triple(normUnit(c.fromUnit), normUnit(c.toUnit), b / a)
        edges += Triple(normUnit(c.toUnit), normUnit(c.fromUnit), a / b)
    }
    fun hop(a: String, b: String) = if (a == b) 1.0 else builtin(a, b)
    for ((a, b, f) in edges) {
        val k = hop(from, a) * hop(b, to)
        if (k.isFinite()) return Span.exact(k) * f
    }
    return Span.NONE
}

/**
 * Adds `nutrients` scaled by `factor` into `total`. The Δ added is the worst case over (value ± Δ) × [low, high];
 * for an exact factor that's just Δ·|factor|. Δs of a sum add up.
 */
private fun addInto(total: Totals, nutrients: Map<String, NV>, factor: Span) {
    val (f, lo, hi) = factor
    for (def in NUTRIENTS) {
        // Unknown energy is estimated from macros per item, so one label without kcal doesn't zero it out.
        val n = if (def.key == "energy") calories(nutrients) else nutrients[def.key] ?: continue
        val t = total.getOrPut(def.key) { NV(0.0, 0.0) }
        if (n.estimated) t.estimated = true
        if (n.value.isFinite()) {
            val d = if (n.delta.isFinite()) abs(n.delta) else 0.0
            val v = n.value * f
            val corners = listOf((n.value - d) * lo, (n.value - d) * hi, (n.value + d) * lo, (n.value + d) * hi)
            t.value += v
            t.delta += if (lo == hi) d * abs(f) else max(corners.max() - v, v - corners.min())
        } else {
            t.missing = true
        }
    }
}

/** Everything nutrient computation needs, loaded once. */
class Ctx(val list: List<Item>) {
    val items: Map<Long, Item> = list.associateBy { it.id }
    fun resolve(id: Long?): Item? = id?.let { items[it] }
    /** The same context with `draft` in place of (or added as) its id: the food editor's live preview. */
    fun with(draft: Item) = Ctx(list.filter { it.id != draft.id } + draft)
}

/** Amount and unit an item's nutrients refer to (plus the amount's error). Without one it counts as 1 portion. */
data class Base(val amount: Double, val unit: String, val delta: Double)

fun baseAmount(item: Item): Base =
    if (item.amount > 0 && item.unit.isNotEmpty()) Base(item.amount, item.unit, abs(item.amountDelta).let { if (it.isNaN()) 0.0 else it })
    else Base(1.0, "portion", 0.0)

/** Units food `itemId` can be measured in: its own unit first, then its defined units and convertible built-ins. */
fun unitsFor(ctx: Ctx, itemId: Long?): List<String> {
    val item = ctx.resolve(itemId) ?: return emptyList()
    val base = normUnit(baseAmount(item).unit)
    val candidates = linkedSetOf<String>().apply { addAll(BUILTIN.keys); add("portion") }
    for (c in item.units) { candidates += normUnit(c.fromUnit); candidates += normUnit(c.toUnit) }
    candidates -= base
    candidates -= ""
    return listOf(base) + candidates.filter { unitFactor(it, base, item.units).isFinite() }.sorted()
}

/** Keep `unit` if it still works for the newly picked food, otherwise switch to the food's own unit. */
fun keepUnit(ctx: Ctx, itemId: Long, unit: String): String {
    val units = unitsFor(ctx, itemId)
    return if (unit.isNotEmpty() && normUnit(unit) in units) unit else units.firstOrNull() ?: ""
}

/** ok = false: a unit couldn't be converted or an item is missing. */
data class Result(val nutrients: Map<String, NV>, val ok: Boolean)

/**
 * Nutrients for `amount ± amountDelta unit` of item `id`. Items with components get them inferred from the
 * components; otherwise their own nutrients are used.
 */
fun nutrientsFor(ctx: Ctx, id: Long?, amount: Double, unit: String, amountDelta: Double = 0.0, seen: Set<Long> = emptySet()): Result {
    val out: Totals = linkedMapOf()
    val item = ctx.resolve(id)
    if (item == null || item.id in seen) return Result(out, false)

    // (amount ± Δ) converted to the base unit, divided by (base amount ± Δ).
    val base = baseAmount(item)
    val factor = span(amount, amountDelta) * unitFactorSpan(unit, base.unit, item.units) / span(base.amount, base.delta)
    if (!factor.nominal.isFinite()) return Result(out, false)

    if (item.components.isEmpty()) {
        if (item.nutrients.isNotEmpty()) addInto(out, item.nutrients.toNV(), factor)
        return Result(out, true)
    }
    var ok = true
    val nextSeen = seen + item.id
    for (c in item.components) {
        val sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, c.amountDelta, nextSeen)
        if (!sub.ok) ok = false
        addInto(out, sub.nutrients, factor)
        for ((k, v) in sub.nutrients) if (v.missing) out[k]?.missing = true
    }
    return Result(out, ok)
}

fun consumptionNutrients(ctx: Ctx, log: Log) = nutrientsFor(ctx, log.itemId, log.amount, log.unit, log.amountDelta)

fun sumNutrients(list: List<Map<String, NV>>): Map<String, NV> {
    val total: Totals = linkedMapOf()
    for (n in list) {
        addInto(total, n, Span.exact(1.0))
        for ((k, v) in n) if (v.missing) total[k]?.missing = true
    }
    return total
}

// --- Targets -------------------------------------------------------------------------------------------------

/** Target that applies to a logical day: the latest one that started before the day ended. */
fun targetForDay(targets: List<Target>, day: LocalDate, dayStart: String): Target? {
    val end = dayBounds(day, dayStart).second
    return targets.filter { it.validFrom < end }.maxByOrNull { it.validFrom }
}

/** Daily min/max summed over the days [first, last], per nutrient (a bound only counts the days that set it). */
fun windowTargets(targets: List<Target>, first: LocalDate, last: LocalDate, dayStart: String): Map<String, Range> {
    val mins = mutableMapOf<String, Double>()
    val maxs = mutableMapOf<String, Double>()
    val keys = linkedSetOf<String>()
    var d = first
    while (!d.isAfter(last)) {
        targetForDay(targets, d, dayStart)?.values?.forEach { (k, r) ->
            keys += k
            if (r.hasMin) mins[k] = (mins[k] ?: 0.0) + r.min!!
            if (r.hasMax) maxs[k] = (maxs[k] ?: 0.0) + r.max!!
        }
        d = d.plusDays(1)
    }
    return keys.associateWith { Range(mins[it], maxs[it]) }
}

enum class Status { Under, Ok, Over, None }

/**
 * Progress-bar geometry for a value against a range, in % of the bar's width. With a max, the max sits at 80%
 * (and the min proportionally); with only a min, the min sits at 50%. errLo/errHi place value ± delta.
 */
data class Bar(
    val fill: Double, val minAt: Double?, val maxAt: Double?, val status: Status,
    val errLo: Double? = null, val errHi: Double? = null, val dummy: Boolean = false,
)

fun targetBar(value: Double, range: Range?, delta: Double = 0.0): Bar? {
    val hasMin = range?.hasMin == true
    val hasMax = range?.hasMax == true
    if (!hasMin && !hasMax) return null
    val mn = range!!.min ?: 0.0
    val mx = range.max ?: 0.0
    val full = if (hasMax) (if (mx > 0) mx / 0.8 else 1.0) else if (mn > 0) mn / 0.5 else 1.0
    fun pos(x: Double) = min(100.0, max(0.0, x / full * 100))
    // Worst case of the error bar: "ok" only if all of [value − Δ, value + Δ] is within the range. If it spills
    // over both bounds, the side the value itself leans to wins.
    val d = if (delta.isFinite()) abs(delta) else 0.0
    val low = hasMin && value - d < mn
    val high = hasMax && value + d > mx
    val status = when {
        low && high -> if (value - mn < mx - value) Status.Under else Status.Over
        low -> Status.Under
        high -> Status.Over
        else -> Status.Ok
    }
    return Bar(
        fill = pos(value), minAt = if (hasMin) pos(mn) else null, maxAt = if (hasMax) pos(mx) else null, status = status,
        errLo = if (d != 0.0) pos(value - d) else null, errHi = if (d != 0.0) pos(value + d) else null,
    )
}
