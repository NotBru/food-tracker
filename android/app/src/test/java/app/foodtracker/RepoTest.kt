package app.foodtracker

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.foodtracker.data.Ciqual
import app.foodtracker.data.FoodDb
import app.foodtracker.data.Item
import app.foodtracker.data.Log
import app.foodtracker.data.Nutrient
import app.foodtracker.data.OpenFoodFacts
import app.foodtracker.data.Range
import app.foodtracker.data.Repo
import app.foodtracker.data.Target
import app.foodtracker.data.User
import app.foodtracker.data.nowIso
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class RepoTest {
    private lateinit var repo: Repo

    @Before fun setUp() {
        repo = Repo(FoodDb.open(ApplicationProvider.getApplicationContext(), inMemory = true))
    }

    @Test fun startsWithDefaultUser() = runBlocking {
        assertEquals(listOf(User(1, "Default")), repo.users.first())
        assertEquals(1L, repo.currentUser.first().id)
    }

    @Test fun exportUsesNullForNaNAndRoundTrips() = runBlocking {
        val id = repo.saveItem(Item(name = "Egg", amount = 100.0, unit = "g", nutrients = mapOf("energy" to Nutrient(140.0, 1.0), "fibers" to Nutrient())))
        repo.saveLog(Log(userId = 1, datetime = nowIso(), itemId = id, amount = 2.0, unit = "portion"))
        repo.saveTarget(Target(userId = 1, validFrom = nowIso(), values = mapOf("energy" to Range(max = 2000.0))))
        val text = repo.exportAll()
        val data = Json.parseToJsonElement(text).jsonObject
        assertEquals(7, data["version"]!!.jsonPrimitive.int)
        val fibers = data["tables"]!!.jsonObject["items"]!!.jsonArray[0].jsonObject["nutrients"]!!.jsonObject["fibers"]!!.jsonObject
        assertEquals(JsonNull, fibers["value"])

        val other = Repo(FoodDb.open(ApplicationProvider.getApplicationContext(), inMemory = true))
        other.importAll(text)
        val egg = other.ctx.first().resolve(id)!!
        assertEquals("Egg", egg.name)
        assertTrue(egg.nutrients.getValue("fibers").value.isNaN())
        assertEquals(1, other.logCounts.first()[1L])
        assertEquals(2000.0, other.targets(1).first().single().values.getValue("energy").max!!, 0.0)
    }

    /** A file as the web app writes it (db.js exportAll, version 7). */
    @Test fun importsWebAppExport() = runBlocking {
        val text = File("src/test/resources/web-export.json").readText()
        repo.importAll(text)
        val users = repo.users.first()
        assertEquals(listOf("Ana", "Default"), users.map { it.name })
        assertEquals(2L, repo.currentUser.first().id)
        val ctx = repo.ctx.first()
        val bread = ctx.resolve(1)!!
        assertEquals("slice", bread.units.single().fromUnit)
        assertTrue(bread.nutrients.getValue("sugars").value.isNaN())
        assertEquals(0.1, bread.nutrients.getValue("proteins").delta, 1e-12) // auto Δ refreshed from "9.0"
        assertEquals(1, repo.logCounts.first()[2L])
        assertEquals("bars", repo.config.first().dashboard)
        // Ciqual source ids are numbers and stay numbers.
        assertTrue(Json.parseToJsonElement(repo.exportAll()).toString().contains("\"id\":20047") || repo.exportAll().contains("\"id\": 20047"))
    }

    @Test fun rejectsOtherFiles() = runBlocking {
        for (bad in listOf("{}", "not json", """{"app":"food-tracker","version":3,"tables":{}}""")) {
            try { repo.importAll(bad); fail("accepted $bad") } catch (e: IllegalArgumentException) { /* expected */ }
        }
    }

    @Test fun deletingUsers() = runBlocking {
        val ana = repo.saveUser(User(name = "Ana"))
        repo.setCurrentUser(ana)
        repo.saveLog(Log(userId = ana, datetime = nowIso(), itemId = null, amount = 1.0, unit = "g"))
        repo.saveLog(Log(userId = 1, datetime = nowIso(), itemId = null, amount = 1.0, unit = "g"))
        repo.deleteUser(ana)
        assertEquals(1L, repo.currentUser.first().id) // selection falls back
        assertEquals(mapOf(1L to 1), repo.logCounts.first())
        try { repo.deleteUser(1); fail("deleted the last user") } catch (e: IllegalStateException) { /* expected */ }
    }

    @Test fun ciqualTableParsesAndSearches() {
        val table = Ciqual.parse(File("../../app/public/ciqual.json").readText())
        assertTrue(table.foods.size > 3000)
        val hits = Ciqual.search(table, "creme")
        assertTrue(hits.isNotEmpty())
        val draft = Ciqual.draft(table, Ciqual.search(table, "egg boiled").first())
        assertEquals(100.0, draft.item.amount, 0.0)
        assertEquals(listOf("provenance", "CIQUAL"), draft.item.attributes.single())
        assertTrue(draft.item.nutrients.getValue("proteins").value > 5)
    }

    @Test fun offProductBecomesDraft() {
        val p = Json.parseToJsonElement(
            """{"code":"3017620422003","product_name":"Nutella","brands":"Ferrero, Nutella","quantity":"400 g","product_quantity":"400",
               "product_quantity_unit":"g","serving_quantity":15,"nutriments":{"energy-kcal_100g":539,"proteins_100g":6.3,"sodium_100g":0.0428,
               "alcohol_100g":0}}""",
        ).jsonObject
        val d = OpenFoodFacts.draft(p)
        assertEquals("Nutella", d.item.name)
        assertEquals("Ferrero", d.item.brand)
        assertEquals("Ferrero · 400 g", d.subtitle)
        assertEquals(listOf("serving", "package"), d.item.units.map { it.fromUnit })
        assertEquals(42.8, d.item.nutrients.getValue("sodium").value, 1e-9) // g -> mg
        assertEquals("42.8", d.item.nutrients.getValue("sodium").text)
    }
}
