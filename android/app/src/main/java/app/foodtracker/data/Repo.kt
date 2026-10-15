package app.foodtracker.data

import androidx.room.withTransaction
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

@OptIn(ExperimentalSerializationApi::class)
val JSON = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true // JSON null for a number field -> its default (NaN for unknown values)
    allowSpecialFloatingPointValues = true // NaN is stored as is; only export files turn it into null
    encodeDefaults = true
    isLenient = true
}

@OptIn(ExperimentalSerializationApi::class)
private val PRETTY = Json(JSON) { prettyPrint = true; prettyPrintIndent = "  " }

/** Export file version; matches the web app's (db.js exportAll), so files move both ways. */
const val EXPORT_VERSION = 7

@OptIn(ExperimentalCoroutinesApi::class)
class Repo(val db: FoodDb) {
    private val dao = db.dao()

    // --- Reading ------------------------------------------------------------------------------------------------

    val config: Flow<Config> = dao.config("main").map { row ->
        row?.let { runCatching { JSON.decodeFromString<Config>(it.json) }.getOrNull() } ?: Config()
    }.distinctUntilChanged()

    val users: Flow<List<User>> = dao.users().map { rows -> rows.map { User(it.id, it.name) } }

    /** The selected user; falls back to the first one if the selection is missing or was deleted. */
    val currentUser: Flow<User> = combine(users, dao.config("currentUser")) { list, row ->
        val id = row?.let { JSON.parseToJsonElement(it.json).jsonPrimitive.longOrNull }
        list.firstOrNull { it.id == id } ?: list.minByOrNull { it.id } ?: DEFAULT_USER
    }.distinctUntilChanged()

    val logCounts: Flow<Map<Long, Int>> = dao.logCounts().map { rows -> rows.associate { it.userId to it.count } }

    val ctx: Flow<Ctx> = dao.items().map { rows -> Ctx(rows.map(::itemOf)) }

    fun logsBetween(userId: Long, start: String, end: String): Flow<List<Log>> =
        dao.logsBetween(userId, start, end).map { rows -> rows.map(::logOf) }

    fun targets(userId: Long): Flow<List<Target>> = dao.targets(userId).map { rows -> rows.map(::targetOf) }

    /** Targets of the current user, newest first. */
    val currentTargets: Flow<List<Target>> = currentUser.flatMapLatest { targets(it.id) }

    suspend fun item(id: Long): Item? = dao.itemsNow().firstOrNull { it.id == id }?.let(::itemOf)

    // --- Writing ------------------------------------------------------------------------------------------------

    suspend fun saveItem(item: Item): Long {
        val json = JSON.encodeToString(Item.serializer(), item)
        return if (item.id == 0L) dao.insertItem(ItemRow(name = item.name, json = json))
        else item.id.also { dao.upsertItem(ItemRow(item.id, item.name, json)) }
    }
    suspend fun deleteItem(id: Long) = dao.deleteItem(id)

    suspend fun saveLog(log: Log): Long {
        val json = JSON.encodeToString(Log.serializer(), log)
        return if (log.id == 0L) dao.insertLog(LogRow(userId = log.userId, datetime = log.datetime, json = json))
        else log.id.also { dao.upsertLog(LogRow(log.id, log.userId, log.datetime, json)) }
    }
    suspend fun deleteLog(id: Long) = dao.deleteLog(id)

    suspend fun saveTarget(t: Target): Long {
        val json = JSON.encodeToString(Target.serializer(), t)
        return if (t.id == 0L) dao.insertTarget(TargetRow(userId = t.userId, validFrom = t.validFrom, json = json))
        else t.id.also { dao.upsertTarget(TargetRow(t.id, t.userId, t.validFrom, json)) }
    }
    suspend fun deleteTarget(id: Long) = dao.deleteTarget(id)

    suspend fun saveConfig(c: Config) = dao.putConfig(ConfigEntity("main", JSON.encodeToString(Config.serializer(), c)))

    // The selected user is its own config row, so saving the Config screen doesn't touch it.
    suspend fun setCurrentUser(id: Long) = dao.putConfig(ConfigEntity("currentUser", id.toString()))

    /** Adds (id = 0) or renames a user; returns its id. */
    suspend fun saveUser(user: User): Long =
        if (user.id == 0L) dao.upsertUser(UserRow(name = user.name)) else user.id.also { dao.upsertUser(UserRow(user.id, user.name)) }

    /** Deletes a user with their consumptions and targets. The last user can't be deleted. */
    suspend fun deleteUser(id: Long) = db.withTransaction {
        if (dao.userCount() <= 1) throw IllegalStateException("The last user can't be deleted.")
        dao.deleteLogsOf(id)
        dao.deleteTargetsOf(id)
        dao.deleteUser(id)
        val current = dao.configNow("currentUser")?.json?.toLongOrNull()
        if (current == id) dao.deleteConfig("currentUser")
    }

    // --- Import / export ----------------------------------------------------------------------------------------
    // JSON has no NaN, so it is written as null and read back as NaN (the fields' default).

    suspend fun exportAll(): String {
        val tables = buildJsonObject {
            put("users", JsonArray(dao.usersNow().map { JSON.encodeToJsonElement(User(it.id, it.name)) }))
            put("items", JsonArray(dao.itemsNow().map { JSON.encodeToJsonElement(itemOf(it)) }))
            put("logs", JsonArray(dao.logsNow().map { JSON.encodeToJsonElement(logOf(it)) }))
            put("targets", JsonArray(dao.targetsNow().map { JSON.encodeToJsonElement(targetOf(it)) }))
            put("config", JsonArray(dao.configsNow().map {
                JSON.encodeToJsonElement(ConfigRow(it.key, JSON.parseToJsonElement(it.json)))
            }))
        }
        val data = buildJsonObject {
            put("app", "food-tracker")
            put("version", EXPORT_VERSION)
            put("exportedAt", nowIso())
            put("tables", nanToNull(tables))
        }
        return PRETTY.encodeToString(JsonElement.serializer(), data)
    }

    /** Replaces all data with the file's. Accepts exports of the web app and of this app (version 7). */
    suspend fun importAll(text: String) {
        val data = runCatching { JSON.parseToJsonElement(text).jsonObject }.getOrNull()
            ?: throw IllegalArgumentException("Not a JSON file")
        if ((data["app"] as? JsonPrimitive)?.content != "food-tracker") throw IllegalArgumentException("Not a food-tracker export file")
        val version = (data["version"] as? JsonPrimitive)?.int ?: 1
        if (version < EXPORT_VERSION) throw IllegalArgumentException(
            "This file is from an older version (v$version). Import it into the web app and export it again.",
        )
        val tables = data["tables"]?.jsonObject ?: JsonObject(emptyMap())
        fun rows(name: String) = (tables[name] as? JsonArray) ?: JsonArray(emptyList())

        val users = rows("users").map { JSON.decodeFromJsonElement<User>(it) }.ifEmpty { listOf(DEFAULT_USER) }
        val items = rows("items").map { refreshAutoDeltas(JSON.decodeFromJsonElement<Item>(it)) }
        val logs = rows("logs").map { JSON.decodeFromJsonElement<Log>(it) }
        val targets = rows("targets").map { JSON.decodeFromJsonElement<Target>(it) }
        val config = rows("config").map { JSON.decodeFromJsonElement<ConfigRow>(it) }

        db.withTransaction {
            dao.clearUsers(); dao.clearItems(); dao.clearLogs(); dao.clearTargets(); dao.clearConfig()
            dao.insertUsers(users.map { UserRow(it.id, it.name) })
            dao.insertItems(items.map { ItemRow(it.id, it.name, JSON.encodeToString(Item.serializer(), it)) })
            dao.insertLogs(logs.map { LogRow(it.id, it.userId, it.datetime, JSON.encodeToString(Log.serializer(), it)) })
            dao.insertTargets(targets.map { TargetRow(it.id, it.userId, it.validFrom, JSON.encodeToString(Target.serializer(), it)) })
            dao.insertConfigs(config.map { ConfigEntity(it.key, JSON.encodeToString(JsonElement.serializer(), it.value)) })
        }
    }

    suspend fun configNow(): Config = config.first()
}

private fun itemOf(r: ItemRow) = JSON.decodeFromString<Item>(r.json).copy(id = r.id)
private fun logOf(r: LogRow) = JSON.decodeFromString<Log>(r.json).copy(id = r.id)
private fun targetOf(r: TargetRow) = JSON.decodeFromString<Target>(r.json).copy(id = r.id)

/** Recompute automatic Δs from the typed text (keeps imported data in line with deltaFromInput). */
fun refreshAutoDeltas(item: Item): Item = item.copy(
    nutrients = item.nutrients.mapValues { (_, n) ->
        if (n.deltaAuto == true && !n.text.isNullOrEmpty()) n.copy(delta = deltaFromInput(n.text)) else n
    },
)

/** Like JSON.stringify: NaN and ±Infinity become null. */
fun nanToNull(e: JsonElement): JsonElement = when (e) {
    is JsonObject -> JsonObject(e.mapValues { nanToNull(it.value) })
    is JsonArray -> JsonArray(e.map(::nanToNull))
    is JsonPrimitive -> if (!e.isString && e !is JsonNull && e.doubleOrNull?.isFinite() == false) JsonNull else e
}
