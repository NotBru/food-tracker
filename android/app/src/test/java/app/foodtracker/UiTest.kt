package app.foodtracker

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.foodtracker.data.Config
import app.foodtracker.data.FoodDb
import app.foodtracker.data.Item
import app.foodtracker.data.Log
import app.foodtracker.data.Nutrient
import app.foodtracker.data.Range
import app.foodtracker.data.Repo
import app.foodtracker.data.Target
import app.foodtracker.data.UnitConv
import app.foodtracker.data.isoOf
import app.foodtracker.data.today
import app.foodtracker.ui.Nav
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config as RoboConfig
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.LocalTime

/**
 * Drives the real UI (Robolectric, native graphics) through the main flows and saves a screenshot of each screen
 * to app/build/screenshots/.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@RoboConfig(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class UiTest {
    @get:Rule val rule = createComposeRule()
    private lateinit var repo: Repo
    private lateinit var nav: Nav

    @Before fun setUp() = runBlocking {
        repo = Repo(FoodDb.open(ApplicationProvider.getApplicationContext(), inMemory = true))
        nav = Nav()
        val bread = repo.saveItem(Item(
            name = "Bread", brand = "Bakery", amount = 100.0, amountText = "100", amountDelta = 0.0, amountDeltaAuto = false, unit = "g",
            units = listOf(UnitConv(fromAmount = 1.0, fromText = "1", fromDelta = 0.0, fromDeltaAuto = false, fromUnit = "slice", toAmount = 30.0, toText = "30", toDelta = 1.0, toDeltaAuto = true, toUnit = "g")),
            nutrients = mapOf("energy" to Nutrient(250.0, 1.0, "250", true), "proteins" to Nutrient(9.0, 1.0, "9", true), "fat" to Nutrient(3.2, 0.1, "3.2", true), "carbohydrates" to Nutrient(49.0, 1.0, "49", true)),
        ))
        val cheese = repo.saveItem(Item(
            name = "Cheese", amount = 100.0, unit = "g",
            nutrients = mapOf("energy" to Nutrient(400.0, 1.0), "proteins" to Nutrient(25.0, 1.0), "fat" to Nutrient(33.0, 1.0), "carbohydrates" to Nutrient(1.0, 1.0), "calcium" to Nutrient(700.0, 10.0)),
        ))
        repo.saveItem(Item(name = "Sandwich", components = listOf(
            app.foodtracker.data.Component(bread, 2.0, "2", 0.0, false, "slice"),
            app.foodtracker.data.Component(cheese, 30.0, "30", 1.0, true, "g"),
        )))
        val day = today("05:00")
        repo.saveLog(Log(userId = 1, datetime = isoOf(day.atTime(LocalTime.of(8, 15))), itemId = bread, amount = 2.0, amountText = "2", amountDelta = 0.0, amountDeltaAuto = false, unit = "slice"))
        repo.saveLog(Log(userId = 1, datetime = isoOf(day.atTime(LocalTime.of(12, 40))), itemId = cheese, amount = 80.0, amountText = "80", amountDelta = 5.0, amountDeltaAuto = false, unit = "g"))
        repo.saveTarget(Target(userId = 1, validFrom = isoOf(day.minusDays(10).atStartOfDay()), values = mapOf(
            "energy" to Range(1800.0, 2200.0), "proteins" to Range(min = 100.0), "fat" to Range(max = 80.0), "calcium" to Range(1000.0, 2500.0),
        )))
        rule.setContent { AppRoot(repo, nav) }
    }

    /** Draws every window (the activity, plus any open sheet or dialog) into one PNG. */
    private fun shot(name: String) {
        rule.waitForIdle()
        val wmg = Class.forName("android.view.WindowManagerGlobal")
        val global = wmg.getMethod("getInstance").invoke(null)
        @Suppress("UNCHECKED_CAST")
        val views = (wmg.getDeclaredField("mViews").apply { isAccessible = true }.get(global) as List<View>).filter { it.isShown }
        val base = views.first()
        val bmp = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        for (v in views) {
            val at = IntArray(2).also { v.getLocationOnScreen(it) }
            canvas.save()
            canvas.translate(at[0].toFloat(), at[1].toFloat())
            v.draw(canvas)
            canvas.restore()
        }
        val dir = File(System.getProperty("screenshots.dir") ?: "build/screenshots").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun SemanticsNodeInteractionsProvider.waitText(text: String, substring: Boolean = false) {
        try {
            rule.waitUntil(20_000) { onAllNodesWithText(text, substring).fetchSemanticsNodes().isNotEmpty() }
        } catch (e: Throwable) {
            shot("FAILED-waiting-for-${text.filter { it.isLetterOrDigit() }}")
            throw e
        }
    }

    @Test fun homeDashboard() {
        rule.waitText("Calories")
        rule.waitText("2 consumptions")
        rule.onNodeWithText("Calcium").assertExists() // a targeted nutrient gets its own tile
        rule.waitText("Budget", substring = true)
        shot("01-home-gauges")
        rule.onNodeWithContentDescription("Next window").performClick()
        rule.waitText("This week", substring = true)
        shot("02-home-weekly")
    }

    @Test fun homeBars() {
        runBlocking { repo.saveConfig(Config(dashboard = "bars")) }
        rule.waitText("Calories")
        rule.waitText("2 consumptions")
        shot("03-home-bars")
    }

    @Test fun addConsumption() {
        rule.waitText("Consumptions")
        rule.onNodeWithText("Consumptions").performClick()
        rule.waitText("+ add consumption")
        shot("04-consumptions")
        rule.onNodeWithText("+ add consumption").performClick()
        rule.waitText("New consumption")
        rule.onNodeWithContentDescription("Food").performClick()
        rule.onNodeWithContentDescription("Food").performTextInput("sand")
        rule.waitText("Sandwich", substring = true)
        rule.onAllNodesWithText("Sandwich", substring = true).onFirst().performClick()
        rule.onNodeWithContentDescription("Amount").performTextInput("1")
        rule.waitText("kcal", substring = true)
        rule.onNodeWithText("▸ Details").performClick()
        rule.waitText("Calcium")
        shot("05-consumption-editor")
        rule.onNodeWithText("Save").performClick()
        rule.waitUntil(20_000) { runBlocking { repo.logCounts.first()[1L] } == 3 }
        rule.waitText("Sandwich", substring = true)
        shot("06-consumptions-after-add")
    }

    @Test fun editFood() {
        rule.onNodeWithText("Foods").performClick()
        rule.waitText("Cheese")
        shot("07-foods")
        rule.onNodeWithText("Bread", substring = true).performClick()
        rule.waitText("Edit food")
        shot("08-food-editor")
        rule.onNodeWithText("Cheese").assertDoesNotExist()
        // Add a nutrient from the picker; its Δ defaults from the digits typed.
        rule.onNodeWithContentDescription("Add nutrient").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Add nutrient").performTextInput("fib")
        rule.waitText("Fibers", substring = true)
        rule.mainClock.advanceTimeBy(1000) // the list scrolls itself into view after a short delay
        rule.onAllNodesWithText("Fibers", substring = true).onFirst().performScrollTo().performClick()
        rule.waitUntil(20_000) { rule.onAllNodes(hasContentDescription("Fibers value")).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithContentDescription("Fibers value").performTextInput("2.7")
        rule.onNodeWithText("Save").performScrollTo().performClick()
        rule.waitUntil(20_000) { runBlocking { repo.ctx.first().list.first { it.name == "Bread" }.nutrients["fibers"]?.value } == 2.7 }
        val fibers = runBlocking { repo.ctx.first().list.first { it.name == "Bread" }.nutrients.getValue("fibers") }
        assertEquals(0.1, fibers.delta, 1e-12)
    }

    @Test fun newFoodFromCiqual() {
        rule.onNodeWithText("Foods").performClick()
        rule.waitText("+ add new food")
        rule.onNodeWithText("+ add new food").performClick()
        rule.waitUntil(20_000) { rule.onAllNodes(hasContentDescription("Name")).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithContentDescription("Name").performTextInput("lentils")
        rule.onNodeWithText("Search external databases…").performClick()
        rule.waitUntil(30_000) { rule.onAllNodesWithText("lentil", substring = true, ignoreCase = true).fetchSemanticsNodes().size > 1 }
        shot("09-external-ciqual")
        rule.onAllNodes(hasText("Lentil", substring = true) and !hasContentDescription("Search CIQUAL")).onFirst().performClick()
        rule.waitText("From ", substring = true)
        shot("10-food-from-ciqual")
        rule.onNodeWithText("Save").performScrollTo().performClick()
        rule.waitUntil(20_000) { runBlocking { repo.ctx.first().list.any { it.source?.db == "ciqual" } } }
        val item = runBlocking { repo.ctx.first().list.first { it.source?.db == "ciqual" } }
        assertTrue(item.name.contains("entil"))
        assertEquals(listOf("database", "CIQUAL"), item.attributes.single())
    }

    @Test fun targetsUsersConfig() {
        rule.onNodeWithText("Targets").performClick()
        rule.waitText("active")
        shot("11-targets")
        rule.onNodeWithText("From", substring = true).performClick()
        rule.waitText("Edit target")
        shot("12-target-editor")
        rule.onNodeWithText("Cancel").performClick()
        rule.waitUntil(20_000) { rule.onAllNodesWithText("Edit target").fetchSemanticsNodes().isEmpty() }
        nav.back()
        rule.onNodeWithContentDescription("Users").performClick()
        rule.waitText("+ add user")
        rule.onNodeWithText("+ add user").performClick()
        rule.onNodeWithContentDescription("User name").performTextInput("Ana")
        rule.onNodeWithText("Save").performClick()
        rule.waitUntil(20_000) { runBlocking { repo.currentUser.first().name } == "Ana" }
        rule.waitText("current")
        shot("13-users")
        nav.back()
        rule.waitText("0 consumptions") // the new user starts empty
        rule.onNodeWithText("Config").performClick()
        rule.waitText("Dashboard style")
        rule.onNodeWithContentDescription("Bars").performClick()
        shot("14-config")
        rule.onNodeWithText("Save").performClick()
        rule.waitUntil(20_000) { runBlocking { repo.config.first().dashboard } == "bars" }
    }
}
