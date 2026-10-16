package app.foodtracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.LocalNav
import app.foodtracker.LocalRepo
import app.foodtracker.data.Ciqual
import app.foodtracker.data.CiqualTable
import app.foodtracker.data.Config
import app.foodtracker.data.Draft
import app.foodtracker.data.NUTRIENTS
import app.foodtracker.data.NUTRIENT_BY_KEY
import app.foodtracker.data.OpenFoodFacts
import app.foodtracker.data.Range
import app.foodtracker.data.Target
import app.foodtracker.data.User
import app.foodtracker.data.dateTimeLabel
import app.foodtracker.data.isoOf
import app.foodtracker.data.jsNumber
import app.foodtracker.data.jsString
import app.foodtracker.data.localOf
import app.foodtracker.data.nowIso
import app.foodtracker.data.nutrientRank
import app.foodtracker.data.parseTime
import app.foodtracker.data.rangeLabel
import app.foodtracker.data.toNV
import kotlinx.coroutines.launch
import java.time.LocalTime

// --- Search external ------------------------------------------------------------------------------------------------
// Opened from New food. Picking a result goes back to the form, prefilled. CIQUAL is local, so it filters as you
// type; Open Food Facts searches on submit (rate-limited).

@Composable
fun ExternalScreen(route: Route.External) {
    val nav = LocalNav.current
    var source by rememberSaveable { mutableStateOf("ciqual") }
    var query by rememberSaveable { mutableStateOf(route.query) }
    Screen("Search external", nav::back) {
        Segmented(listOf("ciqual" to "Generic (CIQUAL)", "off" to "Products (OFF)"), source, { source = it })
        Spacer(Modifier.size(4.dp))
        if (source == "ciqual") CiqualSearch(query) { query = it } else OffSearch(query) { query = it }
    }
}

@Composable
private fun Results(drafts: List<Draft>, empty: String?) {
    val nav = LocalNav.current
    if (drafts.isEmpty()) { if (empty != null) Muted(empty, size = 16); return }
    for (d in drafts) {
        ListCard({ nav.pickDraft(d) }) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(d.item.name, Modifier.weight(1f), color = C.text)
                Muted("per 100 ${d.item.unit}")
            }
            if (d.subtitle.isNotEmpty()) Muted(d.subtitle, size = 13)
            MacroLine(d.item.nutrients.toNV())
        }
    }
}

@Composable
private fun CiqualSearch(query: String, setQuery: (String) -> Unit) {
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    var table by remember { mutableStateOf<CiqualTable?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { runCatching { Ciqual.load(context) }.onSuccess { table = it }.onFailure { error = it.message } }
    val t = table
    val drafts = remember(t, query) { if (t == null) emptyList() else Ciqual.search(t, query).map { Ciqual.draft(t, it) } }
    Input(query, setQuery, Modifier.fillMaxWidth(), placeholder = "Search generic foods (English or French)…", imeAction = ImeAction.Search, description = "Search CIQUAL")
    when {
        error != null -> Text(error!!, color = C.warn)
        t == null -> Muted("Loading the CIQUAL table…", size = 16)
        else -> Results(drafts, if (query.isNotBlank()) "No match." else "${t.foods.size} foods. Type to search, e.g. \"egg boiled\".")
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Muted("Data: ", size = 13)
        PillButton(t?.source ?: "ANSES-CIQUAL", { uri.openUri("https://ciqual.anses.fr/") }, look = Look.Link, fontSize = 13)
    }
    Muted("French food composition table, ${t?.licence ?: "Licence Ouverte"}. Values per 100 g; Δ from the sources' range where given.", size = 13)
}

private sealed class OffState {
    data object Idle : OffState()
    data object Loading : OffState()
    data class Done(val drafts: List<Draft>, val searched: String) : OffState()
    data class Failed(val message: String) : OffState()
}

@Composable
private fun OffSearch(query: String, setQuery: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val uri = LocalUriHandler.current
    var state by remember { mutableStateOf<OffState>(OffState.Idle) }
    fun run() {
        val q = query.trim()
        if (q.isEmpty() || state == OffState.Loading) return
        state = OffState.Loading
        scope.launch {
            state = try { OffState.Done(OpenFoodFacts.search(q), q) } catch (e: Exception) { OffState.Failed(e.message ?: e.toString()) }
        }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Input(query, setQuery, Modifier.weight(1f), placeholder = "Product name or barcode…", imeAction = ImeAction.Search, onIme = ::run, description = "Search OFF")
        PillButton(if (OpenFoodFacts.isBarcode(query)) "Look up" else "Search", ::run, enabled = query.isNotBlank() && state != OffState.Loading)
    }
    when (val s = state) {
        OffState.Loading -> Muted("Searching Open Food Facts…", size = 16)
        is OffState.Failed -> Text(s.message, color = C.warn)
        is OffState.Done -> Results(s.drafts, "Nothing found for \"${s.searched}\".")
        OffState.Idle -> {}
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Muted("Data: ", size = 13)
        PillButton("Open Food Facts", { uri.openUri("https://world.openfoodfacts.org/") }, look = Look.Link, fontSize = 13)
    }
    Muted("Community-made, ODbL. Values per 100 g/ml as on the label; check them against your pack. Max 10 searches per minute.", size = 13)
}

// --- Targets --------------------------------------------------------------------------------------------------------
// Listed latest first; each holds user-chosen nutrients (energy included) and is valid from its timestamp until
// the next target's. Values are daily ranges {min?, max?}; either bound is optional.

private fun <V> inOrder(entries: Collection<Map.Entry<String, V>>) = entries.sortedBy { nutrientRank(it.key) }

@Composable
fun TargetsScreen() {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val user by repo.currentUser.collectAsState(null)
    val targets by repo.currentTargets.collectAsState(null)
    var editing by remember { mutableStateOf<Target?>(null) }
    Screen("Targets", nav::back, subtitle = user?.name) {
        val u = user ?: return@Screen
        val list = targets ?: return@Screen
        val now = nowIso()
        val activeId = list.firstOrNull { it.validFrom <= now }?.id
        AddCard("+ add target") { editing = Target(validFrom = now, userId = u.id, values = list.firstOrNull()?.values ?: emptyMap()) }
        list.forEachIndexed { i, t ->
            ListCard({ editing = t }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("From ${dateTimeLabel(t.validFrom)}", Modifier.weight(1f), color = C.text)
                    if (t.id == activeId) Tag("active", ok = true) else if (t.validFrom > now) Tag("upcoming")
                }
                if (i > 0) Muted("until ${dateTimeLabel(list[i - 1].validFrom)}")
                Text(
                    buildAnnotatedString {
                        append(inOrder(t.values.entries).joinToString(" · ") { (k, r) ->
                            "${NUTRIENT_BY_KEY[k]?.label ?: k} ${rangeLabel(r)} ${NUTRIENT_BY_KEY[k]?.unit ?: ""}"
                        })
                        withStyle(SpanStyle(color = C.muted)) { append(" per day") }
                    },
                    color = C.text, fontSize = 13.sp,
                )
            }
        }
    }
    editing?.let { TargetEditor(it) { editing = null } }
}

private data class TargetRowForm(val key: String, val min: String, val max: String)

@Composable
private fun TargetEditor(target: Target, onClose: () -> Unit) {
    val repo = LocalRepo.current
    val dialogs = LocalDialogs.current
    val scope = rememberCoroutineScope()
    var validFrom by remember { mutableStateOf(localOf(target.validFrom)) }
    fun txt(x: Double?) = if (x != null && x.isFinite()) jsString(x) else ""
    // Kept in nutrient-list order.
    var rows by remember {
        mutableStateOf(NUTRIENTS.filter { it.key in target.values }.map { TargetRowForm(it.key, txt(target.values[it.key]?.min), txt(target.values[it.key]?.max)) })
    }
    val adder = remember { FocusRequester() } // the keyboard's "next" in a min or max goes here
    val focus = remember { mutableMapOf<String, FocusRequester>() }
    var focusKey by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(focusKey) { focusKey?.let { focus[it]?.requestSoon() }; focusKey = null }

    fun save() {
        fun num(t: String) = if (t.isNotBlank() && jsNumber(t).isFinite()) jsNumber(t) else null
        val values = linkedMapOf<String, Range>()
        for (r in rows) {
            val mn = num(r.min)
            val mx = num(r.max)
            if (mn == null && mx == null) continue
            if (mn != null && mx != null && mn > mx) return dialogs.alert("${NUTRIENT_BY_KEY[r.key]?.label ?: r.key}: min is above max.")
            values[r.key] = Range(mn, mx)
        }
        if (values.isEmpty()) return dialogs.alert("Set at least one min or max.")
        scope.launch { repo.saveTarget(target.copy(validFrom = isoOf(validFrom), values = values)); onClose() }
    }

    EditorSheet(if (target.id != 0L) "Edit target" else "New target", onClose) {
        Field("Valid from") { DateTimeField(validFrom) { validFrom = it } }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("per day", Modifier.weight(1f), color = C.muted, fontSize = 12.sp)
            Text("min", Modifier.width(84.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
            Text("max", Modifier.width(84.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.size(34.dp))
        }
        rows.forEachIndexed { i, r ->
            val def = NUTRIENT_BY_KEY[r.key]
            fun set(x: TargetRowForm) { rows = rows.mapIndexed { j, y -> if (j == i) x else y } }
            val small = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 9.dp)
            val style = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    buildAnnotatedString { append(def?.label ?: r.key); withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" ${def?.unit ?: ""}") } },
                    Modifier.weight(1f), color = C.text, fontSize = 14.sp,
                )
                Input(r.min, { set(r.copy(min = it)) }, Modifier.width(84.dp), placeholder = "–", number = true, imeAction = ImeAction.Next,
                    onIme = { runCatching { adder.requestFocus() } }, focusRequester = focus.getOrPut(r.key) { FocusRequester() }, textStyle = style, contentPadding = small,
                    description = "${def?.label ?: r.key} min")
                Input(r.max, { set(r.copy(max = it)) }, Modifier.width(84.dp), placeholder = "–", number = true, imeAction = ImeAction.Next,
                    onIme = { runCatching { adder.requestFocus() } }, textStyle = style, contentPadding = small, description = "${def?.label ?: r.key} max")
                IconCircle("×", "Remove ${def?.label ?: r.key}", size = 34.dp) { rows = rows.filterIndexed { j, _ -> j != i } }
            }
        }
        NutrientAdder(NUTRIENTS.filter { n -> rows.none { it.key == n.key } }, { key ->
            rows = (rows + TargetRowForm(key, "", "")).sortedBy { nutrientRank(it.key) }
            focusKey = key
        }, adder)
        Actions {
            if (target.id != 0L) PillButton("Delete", {
                dialogs.confirm("Delete this target?", "Delete", danger = true) { scope.launch { repo.deleteTarget(target.id); onClose() } }
            }, look = Look.Danger)
            PillButton("Cancel", onClose, look = Look.Secondary)
            PillButton("Save", ::save)
        }
    }
}

// --- Users ----------------------------------------------------------------------------------------------------------
// Tapping a user switches to them; ✎ edits the name. Each user has their own consumptions and targets; foods and
// config are shared.

@Composable
fun UsersScreen() {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val users by repo.users.collectAsState(null)
    val current by repo.currentUser.collectAsState(null)
    val counts by repo.logCounts.collectAsState(emptyMap())
    var editing by remember { mutableStateOf<User?>(null) }
    Screen("Users", nav::back) {
        val list = users ?: return@Screen
        AddCard("+ add user") { editing = User() }
        for (u in list) {
            ListCard({ scope.launch { repo.setCurrentUser(u.id) } }) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(u.name, Modifier.weight(1f), color = C.text)
                    if (u.id == current?.id) Tag("current", ok = true)
                    IconCircle("✎", "Edit ${u.name}", size = 34.dp, background = C.bg) { editing = u }
                }
                val n = counts[u.id] ?: 0
                Muted("$n consumption${if (n == 1) "" else "s"}")
            }
        }
    }
    editing?.let { e -> users?.let { UserEditor(e, it, counts[e.id] ?: 0) { editing = null } } }
}

@Composable
private fun UserEditor(user: User, users: List<User>, count: Int, onClose: () -> Unit) {
    val repo = LocalRepo.current
    val dialogs = LocalDialogs.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(user.name) }
    var confirmDelete by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestSoon() }

    fun save() {
        val n = name.trim()
        if (n.isEmpty()) return dialogs.alert("Name is required.")
        if (users.any { it.id != user.id && it.name.equals(n, ignoreCase = true) }) return dialogs.alert("There is already a user “$n”.")
        scope.launch {
            if (user.id != 0L) repo.saveUser(user.copy(name = n))
            else repo.setCurrentUser(repo.saveUser(User(name = n))) // a new user is usually added to be used
            onClose()
        }
    }

    EditorSheet(if (user.id != 0L) "Edit user" else "New user", onClose) {
        Field("Name") { Input(name, { name = it }, Modifier.fillMaxWidth(), focusRequester = focus, onIme = ::save, description = "User name") }
        if (confirmDelete) Text(
            "Deleting ${user.name} also deletes their $count consumption${if (count == 1) "" else "s"} and their targets. Foods stay.",
            color = C.warn,
        )
        Actions {
            if (user.id != 0L && users.size > 1) {
                if (confirmDelete) PillButton("Delete for good", {
                    scope.launch {
                        try { repo.deleteUser(user.id); onClose() } catch (e: Exception) { dialogs.alert(e.message ?: "Delete failed") }
                    }
                }, look = Look.Danger)
                else PillButton("Delete", { confirmDelete = true }, look = Look.Danger)
            }
            PillButton("Cancel", onClose, look = Look.Secondary)
            PillButton("Save", ::save)
        }
    }
}

// --- Config ---------------------------------------------------------------------------------------------------------

@Composable
fun ConfigScreen() {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val saved by repo.config.collectAsState(null)
    var form by remember { mutableStateOf<Config?>(null) }
    LaunchedEffect(saved) { if (form == null) form = saved }
    Screen("Config", nav::back) {
        val f = form ?: return@Screen
        Field("Day starts at (meals before this count for the previous day)") {
            TimeButton(parseTime(f.dayStart) ?: LocalTime.of(5, 0), { form = f.copy(dayStart = "%02d:%02d".format(it.hour, it.minute)) }, Modifier.fillMaxWidth())
        }
        Field("Dashboard style") {
            Segmented(listOf("gauges" to "Gauges", "bars" to "Bars"), f.dashboard, { form = f.copy(dashboard = it) })
        }
        Actions { PillButton("Save", { scope.launch { repo.saveConfig(f.copy(dayStart = f.dayStart.ifEmpty { "05:00" })); nav.back() } }) }
    }
}
