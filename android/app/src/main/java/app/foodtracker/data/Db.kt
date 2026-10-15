package app.foodtracker.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Upsert
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

// Each record is stored as its JSON (the same shape the web app keeps in IndexedDB and exports), next to the
// columns that queries need. Nested data (nutrients, units, components, target ranges) never needs querying, and
// this keeps import/export a straight copy. The `id` column is authoritative; the JSON's id is overwritten on read.

@Entity(tableName = "users")
data class UserRow(@PrimaryKey(autoGenerate = true) val id: Long = 0, val name: String)

@Entity(tableName = "items")
data class ItemRow(@PrimaryKey(autoGenerate = true) val id: Long = 0, val name: String, val json: String)

@Entity(tableName = "logs", indices = [Index("userId", "datetime")])
data class LogRow(@PrimaryKey(autoGenerate = true) val id: Long = 0, val userId: Long, val datetime: String, val json: String)

@Entity(tableName = "targets", indices = [Index("userId")])
data class TargetRow(@PrimaryKey(autoGenerate = true) val id: Long = 0, val userId: Long, val validFrom: String, val json: String)

@Entity(tableName = "config")
data class ConfigEntity(@PrimaryKey val key: String, val json: String)

data class UserCount(val userId: Long, val count: Int)

@Dao
interface FoodDao {
    @Query("SELECT * FROM users ORDER BY name COLLATE NOCASE") fun users(): Flow<List<UserRow>>
    @Query("SELECT * FROM users ORDER BY id") suspend fun usersNow(): List<UserRow>
    @Query("SELECT COUNT(*) FROM users") suspend fun userCount(): Int
    @Upsert suspend fun upsertUser(u: UserRow): Long
    @Query("DELETE FROM users WHERE id = :id") suspend fun deleteUser(id: Long)
    @Query("SELECT userId, COUNT(*) AS count FROM logs GROUP BY userId") fun logCounts(): Flow<List<UserCount>>

    @Query("SELECT * FROM items") fun items(): Flow<List<ItemRow>>
    @Query("SELECT * FROM items") suspend fun itemsNow(): List<ItemRow>
    @Insert suspend fun insertItem(r: ItemRow): Long
    @Upsert suspend fun upsertItem(r: ItemRow)
    @Query("DELETE FROM items WHERE id = :id") suspend fun deleteItem(id: Long)

    /** Consumptions of a user in [start, end), newest first. */
    @Query("SELECT * FROM logs WHERE userId = :userId AND datetime >= :start AND datetime < :end ORDER BY datetime DESC")
    fun logsBetween(userId: Long, start: String, end: String): Flow<List<LogRow>>
    @Query("SELECT * FROM logs") suspend fun logsNow(): List<LogRow>
    @Insert suspend fun insertLog(r: LogRow): Long
    @Upsert suspend fun upsertLog(r: LogRow)
    @Query("DELETE FROM logs WHERE id = :id") suspend fun deleteLog(id: Long)
    @Query("DELETE FROM logs WHERE userId = :userId") suspend fun deleteLogsOf(userId: Long)

    @Query("SELECT * FROM targets WHERE userId = :userId ORDER BY validFrom DESC") fun targets(userId: Long): Flow<List<TargetRow>>
    @Query("SELECT * FROM targets") suspend fun targetsNow(): List<TargetRow>
    @Insert suspend fun insertTarget(r: TargetRow): Long
    @Upsert suspend fun upsertTarget(r: TargetRow)
    @Query("DELETE FROM targets WHERE id = :id") suspend fun deleteTarget(id: Long)
    @Query("DELETE FROM targets WHERE userId = :userId") suspend fun deleteTargetsOf(userId: Long)

    @Query("SELECT * FROM config WHERE `key` = :key") fun config(key: String): Flow<ConfigEntity?>
    @Query("SELECT * FROM config WHERE `key` = :key") suspend fun configNow(key: String): ConfigEntity?
    @Query("SELECT * FROM config") suspend fun configsNow(): List<ConfigEntity>
    @Upsert suspend fun putConfig(c: ConfigEntity)
    @Query("DELETE FROM config WHERE `key` = :key") suspend fun deleteConfig(key: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertUsers(r: List<UserRow>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertItems(r: List<ItemRow>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertLogs(r: List<LogRow>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertTargets(r: List<TargetRow>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertConfigs(r: List<ConfigEntity>)
    @Query("DELETE FROM users") suspend fun clearUsers()
    @Query("DELETE FROM items") suspend fun clearItems()
    @Query("DELETE FROM logs") suspend fun clearLogs()
    @Query("DELETE FROM targets") suspend fun clearTargets()
    @Query("DELETE FROM config") suspend fun clearConfig()
}

@Database(entities = [UserRow::class, ItemRow::class, LogRow::class, TargetRow::class, ConfigEntity::class], version = 1, exportSchema = false)
abstract class FoodDb : RoomDatabase() {
    abstract fun dao(): FoodDao

    companion object {
        /** A new database starts with the default user (design.md: Users screen). */
        private val seed = object : Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                db.execSQL("INSERT INTO users (id, name) VALUES (${DEFAULT_USER.id}, '${DEFAULT_USER.name}')")
            }
        }

        fun open(context: Context, inMemory: Boolean = false): FoodDb {
            val builder = if (inMemory) Room.inMemoryDatabaseBuilder(context, FoodDb::class.java)
            else Room.databaseBuilder(context, FoodDb::class.java, "food-tracker.db")
            return builder.addCallback(seed).build()
        }
    }
}

val DEFAULT_USER = User(1, "Default")
