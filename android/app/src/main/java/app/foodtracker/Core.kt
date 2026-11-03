package app.foodtracker

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

/**
 * What native screens ask of the web app (the [Engine]): its router, and native/core.js's functions. An interface so
 * screens can be drawn in tests without it.
 */
interface Core {
    fun go(path: String)
    fun replace(path: String)
    fun back()
    suspend fun call(name: String, vararg args: JsonElement): JsonElement
}

/**
 * The JSON of the bridge: unknown fields ignored (core.js may send more than a screen lays out); blank fields kept in
 * forms sent back (its code expects them).
 */
val bridgeJson = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true; encodeDefaults = true }

suspend fun <T> Core.get(ser: KSerializer<T>, name: String, vararg args: JsonElement): T =
    bridgeJson.decodeFromJsonElement(ser, call(name, *args))

// Building and reading the web app's objects (forms are kept as the JSON core.js made them).

fun js(vararg pairs: Pair<String, Any?>): JsonObject = JsonObject(pairs.associate { (k, v) -> k to jsOf(v) })

fun jsOf(v: Any?): JsonElement = when (v) {
    null -> JsonNull
    is JsonElement -> v
    is String -> JsonPrimitive(v)
    is Number -> JsonPrimitive(v)
    is Boolean -> JsonPrimitive(v)
    is List<*> -> JsonArray(v.map(::jsOf))
    is Pair<*, *> -> JsonArray(listOf(jsOf(v.first), jsOf(v.second)))
    is Map<*, *> -> JsonObject(v.entries.associate { (k, x) -> k.toString() to jsOf(x) })
    else -> JsonPrimitive(v.toString())
}

fun JsonObject.str(key: String): String = (this[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""
fun JsonObject.strOrNull(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
fun JsonObject.bool(key: String): Boolean = (this[key] as? JsonPrimitive)?.booleanOrNull ?: false
fun JsonObject.objects(key: String): List<JsonObject> = (this[key] as? JsonArray)?.map { it.jsonObject } ?: emptyList()
fun JsonObject.with(key: String, value: Any?): JsonObject = JsonObject(this + (key to jsOf(value)))
fun JsonObject.withAt(key: String, i: Int, patch: JsonObject): JsonObject =
    with(key, objects(key).mapIndexed { j, o -> if (j == i) JsonObject(o + patch) else o })
/** [["key", "value"], …] (a food's attributes) as pairs. */
fun JsonObject.pairs(key: String): List<Pair<String, String>> = (this[key] as? JsonArray)?.map { row ->
    val a = row as? JsonArray
    ((a?.getOrNull(0) as? JsonPrimitive)?.contentOrNull ?: "") to ((a?.getOrNull(1) as? JsonPrimitive)?.contentOrNull ?: "")
} ?: emptyList()
