package app.foodtracker.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.IOException
import java.math.BigDecimal
import java.math.MathContext
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.Normalizer

// External food databases (port of external.js).
//   CIQUAL (ANSES, France): ~3.5k generic foods, bundled as assets/ciqual.json (the web app's public/ciqual.json).
//     Licence Ouverte, credit "ANSES-CIQUAL".
//   Open Food Facts: packaged products, fetched live. ODbL. Rate limits: 10 searches/min per IP, so searches only
//     run on submit, never per keystroke.
// Both give values per 100 g (or 100 ml). Results become a draft food that prefills the "New food" form, with a
// `database` attribute (CIQUAL / OFF) and `source` ({db, id}) for the link back.

/** A food ready to prefill the editor, plus a line to show in the result list. */
data class Draft(val item: Item, val subtitle: String)

private fun nutrient(text: String, delta: Double? = null) =
    Nutrient(value = jsNumber(text), text = text, delta = delta ?: deltaFromInput(text), deltaAuto = delta == null)

// The tables' "per 100 g" basis is exact, and so is the "1" in "1 serving = …"; only the other side of a unit
// gets the usual error from its digits.
private fun per100(item: Item) = item.copy(amount = 100.0, amountText = "100", amountDelta = 0.0, amountDeltaAuto = false)
private fun one(unit: String, toAmount: Double, toUnit: String) = UnitConv(
    fromAmount = 1.0, fromText = "1", fromDelta = 0.0, fromDeltaAuto = false, fromUnit = unit,
    toAmount = toAmount, toText = jsString(toAmount), toDelta = deltaFromInput(jsString(toAmount)), toDeltaAuto = true, toUnit = toUnit,
)

// Case- and accent-insensitive ("creme" finds "Crème").
fun fold(s: String): String = Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "").lowercase()

// --- CIQUAL --------------------------------------------------------------------------------------------------

class CiqualFood(val code: JsonPrimitive, val en: String, val fr: String, val group: String, val values: JsonArray) {
    val hay = fold("$en $fr")
}

class CiqualTable(val source: String, val licence: String, val keys: List<String>, val groups: Map<String, String>, val foods: List<CiqualFood>)

object Ciqual {
    private var table: CiqualTable? = null
    private val lock = Mutex()

    suspend fun load(context: Context): CiqualTable = lock.withLock {
        table ?: withContext(Dispatchers.IO) {
            val text = context.assets.open("ciqual.json").bufferedReader().use { it.readText() }
            parse(text)
        }.also { table = it }
    }

    fun parse(text: String): CiqualTable {
        val o = JSON.parseToJsonElement(text).jsonObject
        return CiqualTable(
            source = o["source"]?.jsonPrimitive?.content ?: "ANSES-CIQUAL",
            licence = o["licence"]?.jsonPrimitive?.content ?: "Licence Ouverte",
            keys = o["keys"]!!.jsonArray.map { it.jsonPrimitive.content },
            groups = o["groups"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content },
            foods = o["foods"]!!.jsonArray.map {
                val f = it.jsonArray
                CiqualFood(f[0].jsonPrimitive, f[1].jsonPrimitive.content, f[2].jsonPrimitive.content, f[3].jsonPrimitive.content, f[4].jsonArray)
            },
        )
    }

    /** Every word must match the English or French name; names starting with the query, then shorter names, first. */
    fun search(table: CiqualTable, query: String, limit: Int = 60): List<CiqualFood> {
        val q = fold(query.trim())
        val words = q.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return emptyList()
        return table.foods.filter { f -> words.all { it in f.hay } }
            .sortedWith(compareByDescending<CiqualFood> { fold(it.en).startsWith(q) }.thenBy { it.en.length })
            .take(limit)
    }

    fun draft(table: CiqualTable, food: CiqualFood): Draft {
        val nutrients = linkedMapOf<String, Nutrient>()
        table.keys.forEachIndexed { i, key ->
            when (val v = food.values.getOrNull(i)) {
                is JsonArray -> nutrients[key] = nutrient(v[0].jsonPrimitive.content, v[1].jsonPrimitive.double)
                is JsonPrimitive -> if (v.content.isNotEmpty()) nutrients[key] = nutrient(v.content)
                else -> {}
            }
        }
        val item = per100(Item(
            name = food.en, attributes = listOf(listOf("database", "CIQUAL")), unit = "g", nutrients = nutrients,
            source = Source("ciqual", food.code, table.source),
        ))
        return Draft(item, table.groups[food.group] ?: "")
    }
}

// --- Open Food Facts -----------------------------------------------------------------------------------------

object OpenFoodFacts {
    private const val OFF = "https://world.openfoodfacts.org"
    // OFF asks apps to identify themselves with a User-Agent.
    private const val USER_AGENT = "FoodTracker-Android/0.1.0"
    private val FIELDS = listOf(
        "code", "product_name", "brands", "quantity", "product_quantity", "product_quantity_unit",
        "serving_quantity", "serving_quantity_unit", "nutriments",
    ).joinToString(",")

    // App key -> [OFF nutriment, factor from OFF's per-100 g value (always grams, kcal for energy)].
    private const val G = 1.0
    private const val MG = 1e3
    private const val UG = 1e6
    private val MAP = mapOf(
        "energy" to ("energy-kcal" to 1.0), "proteins" to ("proteins" to G), "fat" to ("fat" to G),
        "saturatedFat" to ("saturated-fat" to G), "monounsaturatedFat" to ("monounsaturated-fat" to G),
        "polyunsaturatedFat" to ("polyunsaturated-fat" to G), "transFat" to ("trans-fat" to G), "cholesterol" to ("cholesterol" to MG),
        "carbohydrates" to ("carbohydrates" to G), "sugars" to ("sugars" to G), "addedSugars" to ("added-sugars" to G), "fibers" to ("fiber" to G),
        "sodium" to ("sodium" to MG), "salt" to ("salt" to G), "potassium" to ("potassium" to MG), "chloride" to ("chloride" to MG),
        "calcium" to ("calcium" to MG), "phosphorus" to ("phosphorus" to MG), "magnesium" to ("magnesium" to MG), "iron" to ("iron" to MG),
        "zinc" to ("zinc" to MG), "copper" to ("copper" to MG), "manganese" to ("manganese" to MG), "fluoride" to ("fluoride" to MG),
        "selenium" to ("selenium" to UG), "chromium" to ("chromium" to UG), "molybdenum" to ("molybdenum" to UG), "iodine" to ("iodine" to UG),
        "vitaminA" to ("vitamin-a" to UG), "vitaminB1" to ("vitamin-b1" to MG), "vitaminB2" to ("vitamin-b2" to MG),
        "vitaminB3" to ("vitamin-pp" to MG), "vitaminB5" to ("pantothenic-acid" to MG), "vitaminB6" to ("vitamin-b6" to MG),
        "vitaminB7" to ("biotin" to UG), "vitaminB9" to ("vitamin-b9" to UG), "vitaminB12" to ("vitamin-b12" to UG),
        "vitaminC" to ("vitamin-c" to MG), "vitaminD" to ("vitamin-d" to UG), "vitaminE" to ("vitamin-e" to MG), "vitaminK" to ("vitamin-k" to UG),
        "caffeine" to ("caffeine" to MG), "water" to ("water" to G),
    )

    // Unit conversion leaves float noise (0.0225 g -> 22.500000000000004 µg); 4 significant digits keeps the
    // label's precision for typical values, and the Δ then follows from those digits like a typed value.
    private fun tidy(x: Double) = jsString(BigDecimal(x).round(MathContext(4)).toDouble())

    private fun JsonObject.num(key: String): Double? = (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull?.takeIf { it.isFinite() }
    private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull
    /** JS `Number(x)` of a field that may be a number or a string. */
    private fun JsonObject.number(key: String): Double = (this[key] as? JsonPrimitive)?.contentOrNull?.let(::jsNumber) ?: Double.NaN

    private fun nutrients(n: JsonObject): Map<String, Nutrient> {
        val out = linkedMapOf<String, Nutrient>()
        for ((key, pair) in MAP) n.num("${pair.first}_100g")?.let { out[key] = nutrient(tidy(it * pair.second)) }
        if ("energy" !in out) n.num("energy-kj_100g")?.let { out["energy"] = nutrient(tidy(it / 4.184)) }
        // OFF stores alcohol as % vol; ethanol is 0.789 g/ml.
        n.num("alcohol_100g")?.let { out["alcohol"] = nutrient(tidy(it * 0.789)) }
        return out
    }

    fun draft(p: JsonObject): Draft {
        val unit = if (p.str("product_quantity_unit") == "ml") "ml" else "g"
        val units = mutableListOf<UnitConv>()
        val serving = p.number("serving_quantity")
        if (serving > 0) units += one("serving", serving, p.str("serving_quantity_unit")?.ifEmpty { null } ?: unit)
        val pack = p.number("product_quantity")
        if (pack > 0) units += one("package", pack, p.str("product_quantity_unit")?.ifEmpty { null } ?: unit)
        val brand = (p.str("brands") ?: "").split(",")[0].trim()
        val code = p.str("code") ?: ""
        val item = per100(Item(
            name = (p.str("product_name") ?: "").trim().ifEmpty { "Product $code" }, brand = brand,
            attributes = listOf(listOf("database", "OFF")), unit = unit, units = units,
            nutrients = nutrients((p["nutriments"] as? JsonObject) ?: JsonObject(emptyMap())),
            source = Source("off", JsonPrimitive(code)),
        ))
        return Draft(item, listOfNotNull(brand.ifEmpty { null }, p.str("quantity")?.ifEmpty { null }).joinToString(" · "))
    }

    private fun get(url: String): JsonElement? {
        val conn = try {
            (URL(url).openConnection() as HttpURLConnection).apply {
                setRequestProperty("User-Agent", USER_AGENT)
                connectTimeout = 15_000
                readTimeout = 30_000
            }
        } catch (e: IOException) {
            throw IOException("Open Food Facts didn't answer (offline, or busy / rate-limited). Try again in a minute.")
        }
        try {
            val status = try { conn.responseCode } catch (e: IOException) {
                throw IOException("Open Food Facts didn't answer (offline, or busy / rate-limited). Try again in a minute.")
            }
            if (status == 429) throw IOException("Open Food Facts rate limit reached (10 searches per minute). Try again shortly.")
            if (status == 404) return null
            if (status !in 200..299) throw IOException("Open Food Facts: HTTP $status")
            return JSON.parseToJsonElement(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    fun isBarcode(q: String) = Regex("^\\d{8,14}$").matches(q.trim())

    /** Barcode -> [product] (or []); text -> up to 24 products that have nutrition data. */
    suspend fun search(query: String): List<Draft> = withContext(Dispatchers.IO) {
        val q = query.trim()
        if (isBarcode(q)) {
            val res = get("$OFF/api/v2/product/$q.json?fields=$FIELDS") as? JsonObject
            val product = res?.get("product") as? JsonObject
            if ((res?.get("status") as? JsonPrimitive)?.intOrNull == 1 && product != null) {
                val withCode = if (product["code"] == null) JsonObject(product + ("code" to JsonPrimitive(q))) else product
                listOf(draft(withCode))
            } else emptyList()
        } else {
            val params = mapOf(
                "search_terms" to q, "search_simple" to "1", "action" to "process", "json" to "1", "page_size" to "24", "fields" to FIELDS,
            ).entries.joinToString("&") { (k, v) -> "$k=${URLEncoder.encode(v, "UTF-8")}" }
            val res = get("$OFF/cgi/search.pl?$params") as? JsonObject
            ((res?.get("products") as? JsonArray) ?: JsonArray(emptyList()))
                .mapNotNull { it as? JsonObject }
                .filter { p -> (p["nutriments"] as? JsonObject)?.keys?.any { it.endsWith("_100g") } == true }
                .map(::draft)
        }
    }
}

/** Text and link for a food's source. */
fun sourceLabel(s: Source?): Pair<String, String>? = when (s?.db) {
    "ciqual" -> "${s.version ?: "ANSES-CIQUAL"} · food #${s.id.content}" to "https://ciqual.anses.fr/#/aliments/${s.id.content}"
    "off" -> "Open Food Facts · ${s.id.content}" to "https://world.openfoodfacts.org/product/${s.id.content}"
    else -> null
}
