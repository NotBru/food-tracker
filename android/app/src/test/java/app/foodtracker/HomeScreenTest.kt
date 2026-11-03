package app.foodtracker

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.foodtracker.ui.FoodTheme
import app.foodtracker.ui.HomeActions
import app.foodtracker.ui.HomeScreen
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The native homescreen with views as the web app sends them (native/core.js home): a made-up one in
 * test/resources/home.json, and, if `fixtures.dir` is set (FIXTURES_DIR), every home*.json recorded from the real
 * web app there. A screenshot of each lands in app/build/screenshots/.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class HomeScreenTest {
    @get:Rule val rule = createComposeRule()
    private val json = Json { ignoreUnknownKeys = true }
    private val sample = javaClass.classLoader!!.getResource("home.json").readText()

    private class Recorder : HomeActions {
        val calls = mutableListOf<String>()
        override fun go(path: String) { calls += "go $path" }
        override fun replace(path: String) { calls += "replace $path" }
        override fun export() { calls += "export" }
        override fun pickImport() { calls += "pickImport" }
        override suspend fun importFile(text: String, merge: Boolean) { calls += "import $merge" }
        override suspend fun backupOn() = false
    }

    private fun view(text: String, style: String? = null) = json.decodeFromString(HomeView.serializer(), text).let { if (style != null) it.copy(style = style) else it }

    @Test fun barsAndGauges() {
        var v by mutableStateOf(view(sample))
        rule.setContent { FoodTheme { HomeScreen(v, SyncStatus("synced", "Synced."), Recorder()) } }
        shot("home-bars")
        v = view(sample, "gauges")
        shot("home-gauges")
    }

    @Test fun buttonsMoveTheRoute() {
        val actions = Recorder()
        rule.setContent { FoodTheme { HomeScreen(view(sample), SyncStatus("waiting", "Not synced yet."), actions) } }
        rule.onNodeWithContentDescription("Next window").performClick()
        rule.onNodeWithContentDescription("Previous day").performClick()
        rule.onNodeWithText("Calories").performClick()
        rule.onNodeWithText("Logs").performClick()
        rule.onNodeWithText("Consumptions").performClick()
        rule.onNodeWithContentDescription("Add temp note").performClick()
        rule.onNodeWithText("Database").performClick()
        rule.onNodeWithText("Export databases").performClick()
        rule.onNodeWithText("Time graphs").performClick()
        shot("home-menu")
        assertEquals(
            listOf("replace /?win=last7", "replace /?day=2026-11-01", "go /breakdown/energy?from=2026-11-02&to=2026-11-02&win=daily",
                "go /consumptions", "go /notes?new", "export", "go /graphs"),
            actions.calls,
        )
    }

    @Test fun recordedViews() {
        val dir = System.getProperty("fixtures.dir")?.let(::File) ?: return
        val files = dir.listFiles { f -> f.name.startsWith("home") && f.name.endsWith(".json") }!!.sorted()
        var v by mutableStateOf(view(files.first().readText()))
        rule.setContent { FoodTheme { HomeScreen(v, SyncStatus("off", "Backup is off."), Recorder()) } }
        for (f in files) for (style in listOf("bars", "gauges")) {
            v = view(f.readText(), style)
            shot("recorded-${f.nameWithoutExtension}-$style")
        }
    }

    /** Draws every window (dialogs too) into one PNG. */
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
}
