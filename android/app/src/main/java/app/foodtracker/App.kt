package app.foodtracker

import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import app.foodtracker.ui.HomeActions
import app.foodtracker.ui.HomeScreen
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private val json = Json { ignoreUnknownKeys = true }

/**
 * The web app (always there, running) and over it the native screen of the current route, if it has one; a route
 * without one is the web app's screen, drawn by the WebView itself.
 */
@Composable
fun App(activity: MainActivity) {
    val engine = activity.engine
    val route by engine.route.collectAsState()
    val r = remember(route) { Route.parse(route) }
    Box(Modifier.fillMaxSize()) {
        AndroidView({ engine.webView }, Modifier.fillMaxSize())
        when {
            r.path == "/" -> HomeRoute(activity, r)
        }
    }
}

@Composable
private fun HomeRoute(activity: MainActivity, r: Route) {
    val engine = activity.engine
    val query = JsonObject(r.query.mapValues { JsonPrimitive(it.value) })
    // The last view shown for this route, from the previous run: drawn at once, while the web app starts.
    val key = "home?${r.query.toSortedMap()}"
    val initial = remember(key) { Snapshots.load(activity, key)?.let { runCatching { json.decodeFromString(HomeView.serializer(), it) }.getOrNull() } }
    val flow = remember(key) {
        engine.watch("home", query)
            .onEach { Snapshots.save(activity, key, it) }
            .map { json.decodeFromJsonElement(HomeView.serializer(), it) }
            .catch { activity.toast("Couldn't show the dashboard: ${it.message}") }
    }
    val view by flow.collectAsState(initial)
    val sync by engine.sync.collectAsState()
    val importing by activity.importing.collectAsState()
    val actions = remember(engine) {
        object : HomeActions {
            override fun go(path: String) = engine.go(path)
            override fun replace(path: String) = engine.replace(path)
            override fun export() { activity.export() }
            override fun pickImport() = activity.pickImport()
            override suspend fun importFile(text: String, merge: Boolean) { engine.call("importFile", JsonPrimitive(text), JsonPrimitive(merge)) }
            override suspend fun backupOn() = (engine.call("backupOn") as? JsonPrimitive)?.content == "true"
        }
    }
    HomeScreen(view, sync, actions, importing) { activity.importing.value = null }
}

/** The last view of each native screen, kept between runs so the app shows something at once. */
object Snapshots {
    private fun prefs(c: Context) = c.getSharedPreferences("snapshots", Context.MODE_PRIVATE)
    fun load(c: Context, key: String): String? = prefs(c).getString(key, null)
    fun save(c: Context, key: String, value: JsonElement) = prefs(c).edit().putString(key, value.toString()).apply()
}
