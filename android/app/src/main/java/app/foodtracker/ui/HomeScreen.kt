package app.foodtracker.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import app.foodtracker.LocalNav
import app.foodtracker.LocalRepo
import app.foodtracker.data.Ctx
import app.foodtracker.data.NUTRIENTS
import app.foodtracker.data.NV
import app.foodtracker.data.Window
import app.foodtracker.data.calories
import app.foodtracker.data.consumptionNutrients
import app.foodtracker.data.dayBounds
import app.foodtracker.data.fileStamp
import app.foodtracker.data.monthName
import app.foodtracker.data.prettyDay
import app.foodtracker.data.shortDay
import app.foodtracker.data.sumNutrients
import app.foodtracker.data.today
import app.foodtracker.data.windowDays
import app.foodtracker.data.windowTargets
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.math.abs
import kotlin.math.max

private fun windowTitle(win: Window, first: LocalDate, last: LocalDate) = when (win) {
    Window.Daily -> "Today · ${prettyDay(first)}"
    Window.Weekly -> "This week · ${shortDay(first)} → ${shortDay(last)}"
    Window.Monthly -> "This month · ${monthName(first)}"
}

@Composable
fun HomeScreen() {
    val repo = LocalRepo.current
    val nav = LocalNav.current
    val dialogs = LocalDialogs.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var winIdx by remember { mutableIntStateOf(0) }
    val win = Window.entries[winIdx]
    fun shift(d: Int) { winIdx = (winIdx + d + Window.entries.size) % Window.entries.size }

    val config by repo.config.collectAsState(null)
    val user by repo.currentUser.collectAsState(null)
    val ctx by repo.ctx.collectAsState(null)
    val targets by repo.currentTargets.collectAsState(null)
    // "Today" is re-read whenever the app comes back to the foreground.
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val cfg = config
    val u = user
    val days = remember(cfg?.dayStart, win, lifecycle) { cfg?.let { windowDays(win, today(it.dayStart)) } }
    val logs by remember(u?.id, days, cfg?.dayStart) {
        if (u == null || days == null || cfg == null) kotlinx.coroutines.flow.flowOf(null)
        else repo.logsBetween(u.id, dayBounds(days.first, cfg.dayStart).first, dayBounds(days.second, cfg.dayStart).second)
    }.collectAsState(null)

    // --- Import / export ----------------------------------------------------------------------------------------
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        dialogs.confirm("Importing REPLACES all current data with the file contents. Continue?", "Import", danger = true) {
            scope.launch {
                try {
                    val text = context.contentResolver.openInputStream(uri)!!.bufferedReader().use { it.readText() }
                    repo.importAll(text)
                    dialogs.alert("Import done.")
                } catch (e: Exception) {
                    dialogs.alert("Import failed: ${e.message}")
                }
            }
        }
    }
    val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch {
            try {
                val text = repo.exportAll()
                context.contentResolver.openOutputStream(uri, "wt")!!.bufferedWriter().use { it.write(text) }
                dialogs.alert("Export done.")
            } catch (e: Exception) {
                dialogs.alert("Export failed: ${e.message}")
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize().background(C.bg).systemBarsPadding(), contentAlignment = Alignment.TopCenter) {
        val tall = maxHeight >= 800.dp
        val wide = maxWidth >= 700.dp
        Column(Modifier.widthIn(max = MAX_WIDTH).fillMaxSize()) {
            // The current user, on top.
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp), horizontalArrangement = Arrangement.End) {
                Text(
                    "👤 ${u?.name ?: "…"}",
                    Modifier.widthIn(max = 240.dp).clip(Pill).background(C.panel).clickable { nav.go(Route.Users) }
                        .padding(horizontal = 14.dp, vertical = 6.dp).semantics { contentDescription = "Users" },
                    color = C.text, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            WindowHeader(win, days, ::shift)

            // Only the dashboard scrolls; the header and the buttons stay in view.
            Column(Modifier.weight(1f).padding(horizontal = 16.dp)) {
                val c = ctx
                val l = logs
                val t = targets
                if (c != null && l != null && t != null && days != null && cfg != null) {
                    Dashboard(c, l, t, days, cfg.dayStart, cfg.dashboard, Modifier.verticalScroll(rememberScrollState()))
                }
            }
            Spacer(Modifier.height(10.dp))
            Menu(tall, wide, Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp),
                onImport = { importer.launch(arrayOf("application/json", "application/octet-stream", "text/plain", "*/*")) },
                onExport = { exporter.launch("food-tracker-${fileStamp()}.json") })
        }
    }
}

@Composable
private fun WindowHeader(win: Window, days: Pair<LocalDate, LocalDate>?, shift: (Int) -> Unit) {
    val threshold = with(LocalDensity.current) { 40.dp.toPx() }
    var dx by remember { mutableStateOf(0f) }
    Row(
        Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 12.dp)
            // Swipe left/right to change the window.
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { dx = 0f },
                    onDragEnd = { if (abs(dx) > threshold) shift(if (dx < 0) 1 else -1) },
                ) { _, amount -> dx += amount }
            }
            .semantics { contentDescription = "Time window" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconCircle("‹", "Previous window") { shift(-1) }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(win.name, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = C.text)
            Text(days?.let { windowTitle(win, it.first, it.second) } ?: "…", color = C.muted, fontSize = 14.sp)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (w in Window.entries) {
                    Box(Modifier.size(width = if (w == win) 20.dp else 7.dp, height = 7.dp).clip(Pill).background(if (w == win) C.text else C.line))
                }
            }
        }
        IconCircle("›", "Next window") { shift(1) }
    }
}

@Composable
private fun Dashboard(
    ctx: Ctx, logs: List<app.foodtracker.data.Log>, allTargets: List<app.foodtracker.data.Target>,
    days: Pair<LocalDate, LocalDate>, dayStart: String, style: String, modifier: Modifier,
) {
    val results = remember(ctx, logs) { logs.map { consumptionNutrients(ctx, it) } }
    val total = remember(results) { sumNutrients(results.map { it.nutrients }) }
    val targets = remember(allTargets, days, dayStart) { windowTargets(allTargets, days.first, days.second, dayStart) }
    // Every nutrient that any target mentions gets a row, even if no target covers this window.
    val targeted = allTargets.flatMap { it.values.keys }.toSet()
    val rows = MANDATORY_ROWS + NUTRIENTS.filter { it.key in targeted && MANDATORY_ROWS.none { r -> r.key == it.key } }
        .map { DashRow(it.key, it.label, it.unit, C.text, false) }
    val failed = results.count { !it.ok }
    fun valueOf(key: String): NV = if (key == "energy") calories(total) else total[key].let { NV(it?.value ?: 0.0, it?.delta ?: 0.0) }

    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(C.panel).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BoxWithConstraints {
            // Like CSS auto-fill: tiles at least 140 dp wide (2 on a phone), bars at least 340 dp.
            val bars = style == "bars"
            val cols = max(1, (maxWidth / if (bars) 340.dp else 140.dp).toInt())
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (chunk in rows.chunked(cols)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (r in chunk) {
                            val m = Modifier.weight(1f)
                            if (bars) BarRow(r, valueOf(r.key), targets[r.key], m) else GaugeTile(r, valueOf(r.key), targets[r.key], m)
                        }
                        repeat(cols - chunk.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        Row(Modifier.padding(horizontal = 10.dp, vertical = 4.dp)) {
            Muted("${logs.size} consumption${if (logs.size == 1) "" else "s"}", size = 16)
            if (failed > 0) Text(" · $failed couldn't be computed", color = C.warn)
        }
    }
}

@Composable
private fun Menu(tall: Boolean, wide: Boolean, modifier: Modifier, onImport: () -> Unit, onExport: () -> Unit) {
    val nav = LocalNav.current
    val main = listOf<Pair<String, () -> Unit>>(
        "Consumptions" to { nav.go(Route.Consumptions()) },
        "Foods" to { nav.go(Route.Foods) },
        "Targets" to { nav.go(Route.Targets) },
        "Config" to { nav.go(Route.Config) },
    )
    // 2×2 on a phone, one row when wide; tall enough: one button per row.
    val cols = if (tall) 1 else if (wide) 4 else 2
    val big = PaddingValues(14.dp)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (chunk in main.chunked(cols)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((label, action) in chunk) PillButton(label, action, Modifier.weight(1f), fontSize = 17, padding = big)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val small = PaddingValues(10.dp)
            PillButton("Import databases", onImport, Modifier.weight(1f), Look.Secondary, fontSize = 15, padding = small)
            PillButton("Export databases", onExport, Modifier.weight(1f), Look.Secondary, fontSize = 15, padding = small)
        }
    }
}
