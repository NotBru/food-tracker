package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Bar
import app.foodtracker.DashRow
import app.foodtracker.HomeView
import app.foodtracker.Span
import app.foodtracker.SyncStatus
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

// The homescreen, native: a port of app/src/screens/Home.jsx's layout. What it shows comes from the web app
// (native/core.js home): this only lays it out, so the numbers are the web app's own.

/** What the homescreen does beyond showing its view: move the route, export, import. */
interface HomeActions {
    fun go(path: String)
    fun replace(path: String)
    fun export()
    /** Opens the file picker; the picked file comes back as `importing`. */
    fun pickImport()
    suspend fun importFile(text: String, merge: Boolean)
    suspend fun backupOn(): Boolean
}

/** A picked file for Import databases. */
data class PickedFile(val name: String, val text: String)

// The homescreen's open button group (Logs or Database), kept while the app runs, as Home.jsx's `openGroup`.
private var openGroup: String? = null

@Composable
fun HomeScreen(
    view: HomeView?,
    sync: SyncStatus?,
    actions: HomeActions,
    importing: PickedFile? = null,
    onImportClosed: () -> Unit = {},
) {
    var group by remember { mutableStateOf(openGroup) }
    fun toggle(g: String) { group = if (group == g) null else g; openGroup = group }
    Column(Modifier.fillMaxSize().background(C.bg)) {
        TopRow(view, sync, actions)
        WindowHeader(view, actions)
        if (view?.daily == true) DayStep(view, actions)
        Column(Modifier.weight(1f).padding(start = 16.dp, end = 16.dp, bottom = 12.dp)) {
            Column(Modifier.weight(1f)) {
                if (view != null) Dashboard(view, actions, Modifier.weight(1f, fill = false))
                PillButton("Time graphs", { actions.go("/graphs") }, Modifier.fillMaxWidth().padding(top = 0.dp, bottom = 10.dp), bg = C.panel, fg = C.text)
            }
            Menu(group, ::toggle, view, actions)
        }
    }
    if (importing != null) ImportSheet(importing, actions, onImportClosed)
}

@Composable
private fun TopRow(view: HomeView?, sync: SyncStatus?, actions: HomeActions) {
    Row(
        Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Sync and the version on the left, Config and the user on the right (styles.css .config-btn margin-left: auto).
        SyncButton(sync) { actions.go("/backup") }
        view?.version?.let {
            Text(it, Modifier.clip(Pill).background(C.panel).padding(horizontal = 9.dp, vertical = 6.dp), color = C.muted, fontSize = 12.sp)
        }
        Spacer(Modifier.weight(1f))
        SmallPill("⚙️ Config") { actions.go("/config") }
        SmallPill("👤 ${view?.user ?: "…"}", Modifier.widthIn(max = 200.dp)) { actions.go("/users") }
    }
}

@Composable
private fun SmallPill(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) =
    PillButton(text, onClick, modifier, bg = C.panel, fg = C.text, padding = PaddingValues(horizontal = 14.dp, vertical = 6.dp), fontSize = 14.sp, weight = FontWeight.Medium)

// The sync icon (Backup.jsx SyncStatus): a cloud, and inside it what the colour says.
private val cloud = svgPath("M6.5 19a4.5 4.5 0 0 1-.6-8.96 6.5 6.5 0 0 1 12.4-1A5 5 0 0 1 17.5 19Z")
private val glyphs = mapOf(
    "synced" to "M9 14.5l2 2 4-4",
    "waiting" to "M8.5 15h.01M12 15h.01M15.5 15h.01",
    "syncing" to "M8.5 15h.01M12 15h.01M15.5 15h.01",
    "unreachable" to "M8.5 15h.01M12 15h.01M15.5 15h.01",
    "error" to "M12 11v3M12 17h.01",
    "conflict" to "M9 12.5h6l-1.8-1.8M15 16H9l1.8 1.8",
    "off" to "M4 4l16 16",
).mapValues { svgPath(it.value) }

private fun syncColor(state: String?) = when (state) {
    "synced" -> C.kcal
    "waiting", "syncing", "unreachable" -> C.warn
    "error" -> C.prot
    "conflict" -> C.conflict
    else -> C.muted
}

@Composable
private fun SyncButton(sync: SyncStatus?, onClick: () -> Unit) {
    // Yellow until the web app has said how the backup is: like the web app's "checking" state.
    val state = sync?.state ?: "waiting"
    val color = syncColor(state)
    PillButton("", onClick, Modifier.semantics { contentDescription = sync?.text ?: "Starting…" }, bg = C.panel,
        padding = PaddingValues(horizontal = 9.dp, vertical = 6.dp)) {
        Canvas(Modifier.size(20.dp)) {
            scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) {
                val st = Stroke(width = 1.8f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                drawPath(cloud, color, style = st)
                glyphs[state]?.let { drawPath(it, color, style = st) }
            }
        }
        sync?.label?.let { Text(it, color = color, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1) }
    }
}

@Composable
private fun WindowHeader(view: HomeView?, actions: HomeActions) {
    val swipe = with(LocalDensity.current) { 40.dp.toPx() }
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 12.dp)
            .pointerInput(view?.prevWin, view?.nextWin) {
                var dx = 0f
                detectHorizontalDragGestures(
                    onDragStart = { dx = 0f },
                    onDragEnd = { if (view != null && abs(dx) > swipe) actions.replace(if (dx < 0) view.nextWin else view.prevWin) },
                ) { _, d -> dx += d }
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoundIconButton("Previous window", { view?.let { actions.replace(it.prevWin) } }) { Chevron() }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(view?.winName?.replaceFirstChar { it.uppercase() } ?: "", color = C.text, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
            Text(view?.title ?: "…", color = C.muted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (on in view?.dots ?: List(4) { false }) {
                    Box(Modifier.height(7.dp).width(if (on) 20.dp else 7.dp).clip(Pill).background(if (on) C.text else C.line))
                }
            }
        }
        RoundIconButton("Next window", { view?.let { actions.replace(it.nextWin) } }) { Chevron(rotation = 180f) }
    }
}

@Composable
private fun DayStep(view: HomeView, actions: HomeActions) {
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoundIconButton("Previous day", { actions.replace(view.prevDay) }) { Chevron() }
        PillButton("Today", { view.todayView?.let(actions::replace) }, bg = C.panel, fg = C.text, enabled = view.todayView != null,
            padding = PaddingValues(horizontal = 16.dp, vertical = 6.dp), fontSize = 14.sp)
        RoundIconButton("Next day", { view.nextDay?.let(actions::replace) }, enabled = view.nextDay != null) { Chevron(rotation = 180f) }
    }
}

@Composable
private fun Dashboard(view: HomeView, actions: HomeActions, modifier: Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(C.panel)
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (view.style == "bars") {
            for (r in view.rows) BarRow(r, view) { actions.go(r.open) }
        } else {
            // Tiles in a row are as tall as the tallest (the web's grid).
            for (pair in view.rows.chunked(2)) Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (r in pair) GaugeTile(r, view, Modifier.weight(1f).fillMaxHeight()) { actions.go(r.open) }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        Text(
            buildAnnotatedString {
                append(view.summary)
                view.failed?.let { withStyle(SpanStyle(color = C.warn)) { append(" · $it") } }
            },
            Modifier.padding(horizontal = 10.dp, vertical = 4.dp), color = C.muted, fontSize = 16.sp,
        )
    }
}

private const val NBSP = " "

/** "bars": one row per nutrient, the value and a horizontal bar over tinted regions. */
@Composable
private fun BarRow(r: DashRow, view: HomeView, onOpen: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(C.panel2)
            .clickable(onClick = onOpen)
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Text(r.label, Modifier.width(90.dp).alignByBaseline(), color = C.muted, fontSize = 16.sp)
        Column(Modifier.weight(1f).alignByBaseline()) {
            Text(buildAnnotatedString {
                withStyle(SpanStyle(color = C.ofClass(r.color), fontSize = 34.sp, fontWeight = FontWeight.ExtraBold)) { append(r.value) }
                withStyle(SpanStyle(color = C.muted, fontSize = 14.sp)) { append(" ${r.unit} ${r.pm}") }
            })
            Text(r.err.ifEmpty { NBSP }, color = C.range, fontSize = 13.sp, lineHeight = 16.sp)
            // Without a target the bar keeps its space, so every row is equally spaced.
            Column(Modifier.padding(top = 2.dp).alpha(if (r.bar != null) 1f else 0f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                TargetBar(r.bar, r.ghost)
                Text(r.rangeLine.ifEmpty { NBSP }, color = C.ofRegion(r.bar?.status ?: ""), fontSize = 14.sp)
                r.budget?.let { BudgetText(it, r.unit) }
            }
        }
    }
}

@Composable
private fun BudgetText(b: app.foodtracker.Budget, unit: String, modifier: Modifier = Modifier) = Text(
    buildAnnotatedString {
        append("Δ Budget: ")
        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = if (b.over) C.prot else C.kcal)) { append(b.text) }
        append(" $unit")
    },
    modifier, color = C.text, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
)

/** The horizontal bar (Home.jsx BarRow): regions, the fill in pieces (hatched over the error range), the estimate, the ghost. */
@Composable
private fun TargetBar(bar: Bar?, ghost: Span?) {
    Canvas(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(10.dp)) {
        val w = size.width
        val h = size.height
        val x = { p: Double -> (p / 100 * w).toFloat() }
        clipRect {
            drawRect(C.bg)
            if (bar != null) {
                val zone = { from: Double, to: Double, color: Color ->
                    drawRect(color.copy(alpha = 0.28f), Offset(x(from), 0f), Size(x(to) - x(from), h))
                }
                bar.minAt?.let { zone(0.0, it, C.prot) }
                if (!bar.dummy) zone(bar.minAt ?: 0.0, bar.maxAt ?: 100.0, C.kcal)
                bar.maxAt?.let { zone(it, 100.0, C.prot) }
                for (pc in bar.pieces) {
                    val color = C.ofRegion(pc.region)
                    val rect = Rect(x(pc.from), 0f, x(pc.to), h)
                    if (pc.hatched) hatchRect(rect, color)
                    else drawRect(if (pc.region == "none") color.copy(alpha = 0.45f) else color, rect.topLeft, rect.size)
                }
            }
            ghost?.let { drawRect(Color(200, 200, 200, 64), Offset(x(it.from), 0f), Size(x(it.to) - x(it.from), h)) }
        }
        // The estimate's white tick, a little past the bar's edges.
        if (bar?.mean == true && bar.fill != null) {
            val tick = 3.dp.toPx()
            val over = 2.dp.toPx()
            drawRect(Color.White, Offset(x(bar.fill) - tick / 2, -over), Size(tick, h + 2 * over))
        }
    }
}

/** The error range's band (styles.css .bar-err): the colour see-through, lines slanted at 110° in a lighter shade. */
internal fun DrawScope.hatchRect(r: Rect, color: Color) {
    clipRect(r.left, r.top, r.right, r.bottom) {
        drawRect(color.copy(alpha = 0.4f), r.topLeft, r.size)
        val step = 5.dp.toPx()
        val lw = 1.5.dp.toPx()
        // A line at 110° (CSS gradient angle) leans this far across the bar's height.
        val lean = (r.height * kotlin.math.tan(20.0 * PI / 180)).toFloat()
        val line = lerp(color, Color.White, 0.4f)
        var x0 = r.left - lean - step
        while (x0 < r.right + step) {
            drawLine(line, Offset(x0, r.bottom), Offset(x0 + lean, r.top), strokeWidth = lw)
            x0 += step
        }
    }
}

/** "gauges": tiles two per row, the value inside a semicircle. */
@Composable
private fun GaugeTile(r: DashRow, view: HomeView, modifier: Modifier, onOpen: () -> Unit) {
    Column(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(C.panel2)
            .clickable(onClick = onOpen)
            .padding(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(r.label, Modifier.fillMaxWidth().padding(start = 4.dp), color = C.muted, fontSize = 14.sp)
        Box(Modifier.fillMaxWidth().widthIn(max = 170.dp).aspectRatio(120f / 66f), contentAlignment = Alignment.BottomCenter) {
            Gauge(r.bar, r.ghost)
            Text(r.value, Modifier.padding(bottom = 2.dp), color = C.ofClass(r.color), fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 28.sp)
        }
        Text("${r.unit} ${r.pm}", Modifier.padding(top = 2.dp), color = C.muted, fontSize = 12.sp)
        Text(r.err.ifEmpty { NBSP }, color = C.range, fontSize = 13.sp)
        Text(r.rangeLine.ifEmpty { NBSP }, Modifier.padding(top = 4.dp), color = C.ofRegion(r.bar?.status ?: ""), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        r.budget?.let { BudgetText(it, r.unit, Modifier.padding(top = 2.dp)) }
    }
}

// The gauge's geometry, as Home.jsx's SVG: a 120×66 box, an arc of radius 46 and width 10 centred at (60, 60).
private const val GCX = 60f
private const val GCY = 60f
private const val GR = 46f
private const val GW = 10f

/** The point at `p` (0 → 1, left to right over the top) at radius `r`. */
private fun gpt(p: Float, r: Float = GR) = Offset(GCX + r * cos(PI * (1 - p)).toFloat(), GCY - r * sin(PI * (1 - p)).toFloat())

@Composable
private fun Gauge(bar: Bar?, ghost: Span?) {
    if (bar == null) return // it keeps its space, drawing nothing
    Canvas(Modifier.fillMaxSize()) {
        scale(size.width / 120f, size.height / 66f, pivot = Offset.Zero) {
            val arc = { p0: Float, p1: Float, color: Color ->
                val a = p0.coerceIn(0f, 1f)
                val b = p1.coerceIn(0f, 1f)
                if (b > a) drawArc(color, 180f * a - 180f, 180f * (b - a), false, Offset(GCX - GR, GCY - GR), Size(2 * GR, 2 * GR), style = Stroke(GW, cap = StrokeCap.Butt))
            }
            val f = { x: Double? -> ((x ?: 0.0) / 100).toFloat() }
            arc(0f, 1f, C.bg)
            if ((bar.minAt ?: 0.0) > 0) arc(0f, f(bar.minAt), C.prot.copy(alpha = 0.28f))
            if (!bar.dummy) arc(f(bar.minAt), if (bar.maxAt != null) f(bar.maxAt) else 1f, C.kcal.copy(alpha = 0.28f))
            if (bar.maxAt != null && bar.maxAt < 100) arc(f(bar.maxAt), 1f, C.prot.copy(alpha = 0.28f))
            val end = f(bar.end)
            for (pc in bar.pieces) {
                val color = C.ofRegion(pc.region)
                val p0 = f(pc.from)
                val p1 = minOf(f(pc.to), end)
                if (!pc.hatched) arc(p0, p1, if (pc.region == "none") color.copy(alpha = 0.45f) else color)
                else {
                    arc(p0, p1, color.copy(alpha = 0.4f))
                    clipPath(annulus(p0, p1)) { hatchArc(p0, p1, lerp(color, Color.White, 0.4f)) }
                }
            }
            if (bar.mean && bar.fill != null) drawLine(Color.White, gpt(f(bar.fill), GR - GW / 2 - 2), gpt(f(bar.fill), GR + GW / 2 + 2), strokeWidth = 3f)
            ghost?.let { arc(it.from.toFloat() / 100, it.to.toFloat() / 100, Color(200, 200, 200, 64)) }
        }
    }
}

/** The ring's piece between p0 and p1 (for clipping the hatch to it). */
private fun annulus(p0: Float, p1: Float) = Path().apply {
    val outer = Rect(GCX - GR - GW / 2, GCY - GR - GW / 2, GCX + GR + GW / 2, GCY + GR + GW / 2)
    val inner = Rect(GCX - GR + GW / 2, GCY - GR + GW / 2, GCX + GR - GW / 2, GCY + GR - GW / 2)
    arcTo(outer, 180f * p0 - 180f, 180f * (p1 - p0), true)
    arcTo(inner, 180f * p1 - 180f, -180f * (p1 - p0), false)
    close()
}

// Hatch lines along the arc (Home.jsx hatch): from the inner edge at s to the outer edge a little further along.
private const val HATCH_STEP = 3.2f
private const val HATCH_SLANT = 2.2f

private fun DrawScope.hatchArc(p0: Float, p1: Float, color: Color) {
    val len = (PI * GR).toFloat()
    var s = p0 * len - HATCH_SLANT
    while (s < p1 * len) {
        drawLine(color, gpt(s / len, GR - GW / 2), gpt((s + HATCH_SLANT) / len, GR + GW / 2), strokeWidth = 1.1f)
        s += HATCH_STEP
    }
}

@Composable
private fun Menu(group: String?, toggle: (String) -> Unit, view: HomeView?, actions: HomeActions) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (group == "logs") {
            MenuItem("Consumptions", { actions.go(view?.consumptions ?: "/consumptions") }, "Add consumption") { actions.go(view?.addConsumption ?: "/consumptions?new") }
            MenuItem("Targets", { actions.go("/targets") }, "Add target") { actions.go("/targets?new") }
            MenuItem("Body measurements", { actions.go("/body") }, "Add body measurements") { actions.go("/body?new") }
            MenuItem("Temp notes", { actions.go("/notes") }, "Add temp note") { actions.go("/notes?new") }
        }
        if (group == "database") {
            MenuItem("Foods", { actions.go("/foods") }, "Add food") { actions.go("/foods/new") }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PillButton("Import databases", actions::pickImport, Modifier.weight(1f), bg = C.panel, fg = C.text, padding = PaddingValues(10.dp), fontSize = 15.sp)
                PillButton("Export databases", actions::export, Modifier.weight(1f), bg = C.panel, fg = C.text, padding = PaddingValues(10.dp), fontSize = 15.sp)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((g, label) in listOf("logs" to "Logs", "database" to "Database")) {
                val open = group == g
                PillButton(label, { toggle(g) }, Modifier.weight(1f), bg = if (open) C.mustard else C.panel, fg = if (open) C.onAccent else C.mustard,
                    padding = PaddingValues(14.dp), outline = if (open) null else C.mustard) {
                    Text(label, color = if (open) C.onAccent else C.mustard, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                    Chevron(if (open) C.onAccent else C.mustard, rotation = if (open) 270f else 90f)
                }
            }
        }
    }
}

@Composable
private fun MenuItem(label: String, onOpen: () -> Unit, addLabel: String, onAdd: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        PillButton(label, onOpen, Modifier.weight(1f), bg = C.mustard, fg = C.onAccent, padding = PaddingValues(14.dp), fontSize = 17.sp)
        PillButton("+", onAdd, Modifier.width(48.dp).semantics { contentDescription = addLabel }, bg = C.panel, fg = C.mustard,
            padding = PaddingValues(vertical = 10.dp), fontSize = 24.sp)
    }
}

/** Import: merge the file into what's here, or replace everything with it (Home.jsx ImportSheet). */
@Composable
private fun ImportSheet(file: PickedFile, actions: HomeActions, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var confirmReplace by rememberSaveable { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf<String?>(null) }
    fun run(merge: Boolean) = scope.launch {
        busy = true
        try {
            actions.importFile(file.text, merge)
            onClose()
        } catch (e: Exception) {
            failed = "Import failed: ${e.message}"
            busy = false
        }
    }
    Sheet(onClose) {
        Text("Import ${file.name}", color = C.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = C.text)) { append("Merge ") }
            append("adds the file's foods, consumptions, targets and body measurements to what's here. A user with the same name is the same user; entries already here are skipped; config stays as it is.")
        }, color = C.muted, fontSize = 14.sp)
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = C.text)) { append("Replace ") }
            append("deletes everything here and puts the file's data in its place.")
        }, color = C.muted, fontSize = 14.sp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
            PillButton("Cancel", onClose, bg = C.panel, fg = C.text)
            PillButton("Replace", {
                scope.launch {
                    val synced = if (actions.backupOn()) " It also replaces the data on every device synced with this backup." else ""
                    confirmReplace = "Replace ALL data on this device with the file?$synced This cannot be undone."
                }
            }, bg = C.danger, fg = Color.White, enabled = !busy)
            PillButton("Merge", { run(true) }, enabled = !busy)
        }
    }
    confirmReplace?.let { Ask(it, { confirmReplace = null }, confirm = "Replace", danger = true) { run(false) } }
    failed?.let { Ask(it, { failed = null }) }
}
