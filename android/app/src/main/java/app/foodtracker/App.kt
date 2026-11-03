package app.foodtracker

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import app.foodtracker.ui.BodyScreen
import app.foodtracker.ui.C
import app.foodtracker.ui.ConfigScreen
import app.foodtracker.ui.ConsumptionInfoScreen
import app.foodtracker.ui.ConsumptionsScreen
import app.foodtracker.ui.HomeActions
import app.foodtracker.ui.ExploreScreen
import app.foodtracker.ui.ExternalScreen
import app.foodtracker.ui.FoodScreen
import app.foodtracker.ui.FoodsScreen
import app.foodtracker.ui.HomeScreen
import app.foodtracker.ui.NotesScreen
import app.foodtracker.ui.PicturePicker
import app.foodtracker.ui.TargetsScreen
import app.foodtracker.ui.UsersScreen
import app.foodtracker.ui.newBodyEntry
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * The web app (always there, running) and over it the native screen of the current route, if it has one; a route
 * without one is the web app's screen, drawn by the WebView itself.
 */
@Composable
fun App(activity: MainActivity) {
    val engine = activity.engine
    val route by engine.route.collectAsState()
    val r = remember(route) { Route.parse(route) }
    val parts = r.path.split('/').filter { it.isNotEmpty() }
    // Android 15 draws apps edge to edge: everything is kept clear of the status and navigation bars, the camera
    // cutout and the keyboard (which no longer resizes the window by itself), web screens included.
    Box(Modifier.fillMaxSize().background(C.bg).safeDrawingPadding()) {
        AndroidView({ engine.webView }, Modifier.fillMaxSize())
        when {
            r.path == "/" -> HomeRoute(activity, r)
            parts == listOf("consumptions") -> ConsumptionsRoute(activity, r)
            parts == listOf("notes") -> NotesRoute(activity, r)
            parts == listOf("foods") -> FoodsRoute(activity)
            parts == listOf("targets") -> TargetsRoute(activity, r)
            parts == listOf("body") -> BodyRoute(activity, r)
            parts == listOf("users") -> UsersScreen(watchView(activity, "users", emptyList(), UsersView.serializer()), engine)
            parts == listOf("config") -> ConfigScreen(engine)
            parts.size == 2 && parts[0] == "explore" -> ExploreScreen(engine, parts[1])
            parts == listOf("foods", "external") -> ExternalScreen(engine, r.query["q"] ?: "")
            parts.size == 2 && parts[0] == "foods" -> FoodScreen(
                engine, parts[1], route, r.query["tab"] == "info", r.query["nutrient"], r.query["in"]?.toIntOrNull(), r.query["name"],
            )
            parts.size == 2 && parts[0] == "consumptions" -> {
                val view = watchView(activity, "consumptionInfo", listOf(JsonPrimitive(parts[1]), jsOf(r.query["nutrient"])), ConsumptionInfoView.serializer())
                ConsumptionInfoScreen(parts[1], view, engine)
            }
        }
    }
}

/** The route's query as core.js views take it. */
private fun Route.args() = JsonObject(query.mapValues { JsonPrimitive(it.value) })

/**
 * core.js view `name`, kept current (a watch): null until it first comes. With `snapshot`, the last one shown for these
 * args, from the previous run, comes first, drawn at once while the web app starts.
 */
@Composable
fun <T> watchView(activity: MainActivity, name: String, args: List<JsonElement>, ser: KSerializer<T>, snapshot: Boolean = true): T? {
    val key = "$name?${args.joinToString("&")}"
    val initial = remember(key) {
        if (!snapshot) null else Snapshots.load(activity, key)?.let { runCatching { bridgeJson.decodeFromString(ser, it) }.getOrNull() }
    }
    val flow = remember(key) {
        activity.engine.watch(name, *args.toTypedArray())
            .onEach { if (snapshot) Snapshots.save(activity, key, it) }
            .map { bridgeJson.decodeFromJsonElement(ser, it) }
            .catch { activity.toast("Couldn't show this: ${it.message}") }
    }
    val view by flow.collectAsState(initial)
    return view
}

@Composable
private fun HomeRoute(activity: MainActivity, r: Route) {
    val engine = activity.engine
    val view = watchView(activity, "home", listOf(r.args()), HomeView.serializer())
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

@Composable
private fun ConsumptionsRoute(activity: MainActivity, r: Route) {
    val engine = activity.engine
    val day = r.query["day"]
    val view = watchView(activity, "consumptions", listOf(js("day" to day)), ConsumptionsView.serializer())
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    // Opened with ?new (the homescreen's +): straight into a new consumption, once; the flag leaves the route so
    // closing the editor or going back doesn't bring it back.
    val adding = "new" in r.query
    LaunchedEffect(adding) {
        if (!adding) return@LaunchedEffect
        editing = js("day" to day)
        engine.replace("/consumptions${if (day != null) "?day=$day" else ""}")
    }
    ConsumptionsScreen(view, engine, editing) { editing = it }
}

@Composable
private fun FoodsRoute(activity: MainActivity) {
    var query by remember { mutableStateOf("") }
    // The last list is drawn at once only for no search (what opening the screen shows).
    val view = watchView(activity, "foods", listOf(JsonPrimitive(query)), FoodsView.serializer(), snapshot = query.isEmpty())
    FoodsScreen(view, query, { query = it }, activity.engine)
}

@Composable
private fun NotesRoute(activity: MainActivity, r: Route) {
    val engine = activity.engine
    val view = watchView(activity, "notes", emptyList(), NotesView.serializer())
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    // ?new (the homescreen's +): straight into a new note, once.
    val adding = "new" in r.query
    LaunchedEffect(adding, view != null) {
        if (!adding || view == null) return@LaunchedEffect
        editing = js("userId" to view.userId, "text" to "", "pictures" to emptyList<String>(), "pictureNames" to emptyMap<String, String>())
        engine.replace("/notes")
    }
    NotesScreen(view, engine, PicturePicker(activity::pickPictures), editing) { editing = it }
}

@Composable
private fun TargetsRoute(activity: MainActivity, r: Route) {
    val view = watchView(activity, "targets", emptyList(), TargetsView.serializer())
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    // ?new (the homescreen's +): straight into a new target (from now, with the latest one's values), once.
    val adding = "new" in r.query
    LaunchedEffect(adding, view != null) {
        if (!adding || view == null) return@LaunchedEffect
        editing = view.new
        activity.engine.replace("/targets")
    }
    TargetsScreen(view, activity.engine, editing) { editing = it }
}

@Composable
private fun BodyRoute(activity: MainActivity, r: Route) {
    val view = watchView(activity, "body", emptyList(), BodyView.serializer())
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    // ?new (the homescreen's +): straight into new measurements, once.
    val adding = "new" in r.query
    LaunchedEffect(adding, view != null) {
        if (!adding || view == null) return@LaunchedEffect
        editing = newBodyEntry(view)
        activity.engine.replace("/body")
    }
    BodyScreen(view, activity.engine, editing) { editing = it }
}

/** The last view of each native screen, kept between runs so the app shows something at once. */
object Snapshots {
    private fun prefs(c: Context) = c.getSharedPreferences("snapshots", Context.MODE_PRIVATE)
    fun load(c: Context, key: String): String? = prefs(c).getString(key, null)
    fun save(c: Context, key: String, value: JsonElement) = prefs(c).edit().putString(key, value.toString()).apply()
}
