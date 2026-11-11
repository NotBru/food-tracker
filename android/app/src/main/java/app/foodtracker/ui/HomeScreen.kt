package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.runtime.LaunchedEffect
import kotlin.math.roundToInt
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
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
import app.foodtracker.PieErrPt
import app.foodtracker.PieRef
import app.foodtracker.PieScene
import app.foodtracker.PieText
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
    /** The energy pie of the last view on n × n px, k px a dp (core.js pieScene). */
    suspend fun pieScene(n: Int, k: Float): PieScene? = null
    /** The line under the pie for the ring at `kcal` (core.js pieReadout). */
    suspend fun pieReadout(kcal: Double): PieText? = null
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
                for (on in view?.dots ?: List(5) { false }) {
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
        // The energy pie (Config): the first tile, as wide as the dashboard (Home.jsx useFitPie puts it on top when
        // no tile fits beside it, as on a phone).
        view.pie?.let { PieTile(it, actions) }
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

/**
 * "bars": one slim row per nutrient (Home.jsx BarRow): its name and unit, then the bar with its numbers on it: the
 * estimate above, the target below; calories also get the budget under those.
 */
@Composable
private fun BarRow(r: DashRow, view: HomeView, onOpen: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(C.panel2)
            .clickable(onClick = onOpen)
            .padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.width(72.dp)) {
            Text(r.label, color = C.muted, fontSize = 14.sp, lineHeight = 17.sp)
            Text(r.unit, Modifier.alpha(0.75f), color = C.muted, fontSize = 12.sp, lineHeight = 14.sp)
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            val notes = r.notes
            NoteLane(notes?.top.orEmpty(), above = true, valueColor = C.ofClass(r.color))
            TargetBar(r.bar, r.ghost)
            // Always there, so rows with and without a target are spaced alike.
            NoteLane(notes?.bottom.orEmpty(), above = false, valueColor = C.text)
            notes?.budget?.let { BudgetLane(it) }
        }
    }
}

// --- Bar notes (Home.jsx NoteLane, spreadNotes, BudgetLane) ---

private val NOTE_GAP = 6.dp

/**
 * Left edges for labels of widths `w` wanted centred at `c`, in a lane `width` wide: neighbours that would overlap
 * become one block, centred where its labels want it on average, then kept inside the lane.
 */
private fun spreadNotes(c: List<Float>, w: List<Float>, width: Float, gap: Float): List<Float> {
    class Block(val list: List<Int>) { var left = 0f; var w = 0f }
    fun place(b: Block): Block {
        var o = 0f
        var sum = 0f
        for (i in b.list) { sum += c[i] - (o + w[i] / 2); o += w[i] + gap }
        b.w = o - gap
        b.left = (sum / b.list.size).coerceIn(0f, maxOf(0f, width - b.w))
        return b
    }
    val blocks = mutableListOf<Block>()
    for (i in c.indices.sortedBy { c[it] }) {
        blocks.add(place(Block(listOf(i))))
        while (blocks.size > 1) {
            val a = blocks[blocks.size - 2]
            val b = blocks[blocks.size - 1]
            if (a.left + a.w + gap <= b.left) break
            blocks.removeAt(blocks.size - 1); blocks.removeAt(blocks.size - 1)
            blocks.add(place(Block(a.list + b.list)))
        }
    }
    val lefts = MutableList(c.size) { 0f }
    for (b in blocks) {
        var x = b.left
        for (i in b.list) { lefts[i] = x; x += w[i] + gap }
    }
    return lefts
}

private fun noteStyle(kind: String, valueColor: Color) = when (kind) {
    "value" -> TextStyle(color = valueColor, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    "lo", "hi" -> TextStyle(color = C.range, fontSize = 12.sp)
    else -> TextStyle(color = C.muted, fontSize = 12.sp)
}

/** One lane of notes, each centred on its place on the bar: above it, baselines on its top; below, under it. */
@Composable
private fun NoteLane(notes: List<app.foodtracker.Note>, above: Boolean, valueColor: Color) {
    val measurer = rememberTextMeasurer()
    val shown = notes.filter { it.at != null }
    Canvas(Modifier.fillMaxWidth().padding(top = if (above) 0.dp else 2.dp, bottom = if (above) 2.dp else 0.dp).height(if (above) 19.dp else 15.dp)) {
        val texts = shown.map { measurer.measure(it.text, noteStyle(it.kind, valueColor)) }
        val lefts = spreadNotes(shown.map { (it.at!! / 100 * size.width).toFloat() }, texts.map { it.size.width.toFloat() }, size.width, NOTE_GAP.toPx())
        texts.forEachIndexed { i, t ->
            val y = if (above) size.height - 3.dp.toPx() - t.firstBaseline else 2.dp.toPx()
            drawText(t, topLeft = Offset(lefts[i], y))
        }
    }
}

/** Calories with a max: a segment from the estimate's high end to the max, labelled with what's left (Δ). */
@Composable
private fun BudgetLane(b: app.foodtracker.NoteBudget) {
    val measurer = rememberTextMeasurer()
    val color = if (b.over) C.prot else C.kcal
    Canvas(Modifier.fillMaxWidth().height(16.dp)) {
        val from = ((b.from ?: return@Canvas) / 100 * size.width).toFloat()
        val to = ((b.to ?: return@Canvas) / 100 * size.width).toFloat()
        val mid = size.height / 2
        val lw = 1.5.dp.toPx()
        val tick = 4.dp.toPx()
        drawLine(color.copy(alpha = 0.7f), Offset(from, mid), Offset(to, mid), strokeWidth = lw)
        for (x in listOf(from, to)) drawLine(color, Offset(x, mid - tick), Offset(x, mid + tick), strokeWidth = lw)
        val t = measurer.measure(b.text, TextStyle(color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold))
        val pad = 4.dp.toPx()
        val left = ((from + to) / 2 - t.size.width / 2f).coerceIn(0f, maxOf(0f, size.width - t.size.width))
        // Its label sits on the line, over a gap cut in it.
        drawRect(C.panel2, Offset(left - pad, 0f), Size(t.size.width + 2 * pad, size.height))
        drawText(t, topLeft = Offset(left, mid - t.size.height / 2f))
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
    Canvas(Modifier.fillMaxWidth().height(8.dp)) {
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

// --- Energy pie (Home.jsx PieTile, PieCanvas): pie.js pieScene says what goes where; this draws it. ---

// The last pie drawn, kept while the app runs: shown at once when the homescreen comes back, until the fresh one.
private var lastScene: PieScene? = null

@Composable
private fun PieTile(pie: PieRef, actions: HomeActions) {
    val k = LocalDensity.current.density
    var widthPx by remember { mutableStateOf(0) }
    var scene by remember { mutableStateOf(lastScene?.takeIf { it.square == pie.square }) }
    var pointed by remember { mutableStateOf<Double?>(null) }
    var readout by remember { mutableStateOf<PieText?>(null) }
    LaunchedEffect(pie.id, widthPx) {
        if (widthPx > 0) actions.pieScene(widthPx, k)?.let { scene = it; lastScene = it }
    }
    LaunchedEffect(pointed, scene?.id) { readout = pointed?.let { actions.pieReadout(it) } }
    val image = remember(scene) { scene?.let(::pieImage) }
    // Pointing (a tap, or sliding sideways) reads the ring (or row) under it, as the web's pointer events.
    fun point(p: Offset) {
        val sc = scene ?: return
        val w = widthPx.toFloat().takeIf { it > 0 } ?: return
        val f = if (sc.square) 1 - p.y / w else kotlin.math.hypot(p.x - w / 2, p.y - w / 2) / (w / 2)
        pointed = if (f in 0f..1f) f * sc.full else null
    }
    Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(20.dp)).background(C.panel2)) {
        Canvas(
            Modifier.padding(12.dp).fillMaxSize()
                .onSizeChanged { widthPx = it.width }
                .clip(if (pie.square) RoundedCornerShape(10.dp) else RectangleShape)
                .pointerInput(Unit) { detectTapGestures(onPress = { point(it) }) }
                .pointerInput(Unit) { detectHorizontalDragGestures { change, _ -> point(change.position) } }
                .semantics { contentDescription = if (pie.square) "Calories up the side, the macros' shares of them across" else "Calories as the radius, the macros' shares of them by angle" },
        ) {
            val sc = scene ?: return@Canvas
            val img = image ?: return@Canvas
            scale(size.width / sc.n, pivot = Offset.Zero) { drawPie(sc, img) }
        }
        readout?.let {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = C.text, fontWeight = FontWeight.SemiBold)) { append(it.bold) }
                    append(it.text)
                },
                Modifier.align(Alignment.BottomCenter).padding(8.dp).fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.7f)).padding(horizontal = 8.dp, vertical = 4.dp),
                color = C.muted, fontSize = 13.sp, textAlign = TextAlign.Center,
            )
        }
    }
}

/** The rings' (or rows') colours, pixel by pixel; the round pie's edge anti-aliased. */
private fun pieImage(sc: PieScene): ImageBitmap {
    val n = sc.n
    val tos = sc.levels.map { segs -> DoubleArray(segs.size) { segs[it].to } }
    val rgbs = sc.levels.map { segs -> IntArray(segs.size) { segs[it].c.let { c -> (c[0] shl 16) or (c[1] shl 8) or c[2] } } }
    val px = IntArray(n * n)
    val r = n / 2.0
    for (y in 0 until n) for (x in 0 until n) {
        val l: Double
        var t: Double
        if (sc.square) {
            l = n - (y + 0.5)
            t = (x + 0.5) / (2.0 * n)
        } else {
            val dx = x + 0.5 - r
            val dy = y + 0.5 - r
            l = kotlin.math.hypot(dx, dy)
            t = kotlin.math.atan2(dx, -dy) / (2 * PI)
            if (t < 0) t += 1
        }
        if (l > sc.top || l < 0) continue
        val i = kotlin.math.floor(l).toInt().coerceAtMost(tos.size - 1)
        val to = tos[i]
        var j = 0
        while (j < to.size - 1 && t >= to[j]) j++
        val a = if (sc.square) 255 else (kotlin.math.min(1.0, sc.top - l) * 255).roundToInt()
        px[y * n + x] = (a shl 24) or rgbs[i][j]
    }
    return android.graphics.Bitmap.createBitmap(px, n, n, android.graphics.Bitmap.Config.ARGB_8888).asImageBitmap()
}

private fun rgb(c: List<Int>, alpha: Float = 1f) = Color(c[0], c[1], c[2], (alpha * 255).roundToInt())

/** The scene's shape (Home.jsx shapeOf): a level and turns to a point; arcs and bands as paths. */
private class PieShape(val square: Boolean, val n: Float) {
    val r = n / 2
    fun xy(t: Double, l: Double): Offset =
        if (square) Offset((2 * t * n).toFloat(), (n - l).toFloat())
        else Offset((r + l * sin(t * 2 * PI)).toFloat(), (r - l * cos(t * 2 * PI)).toFloat())
    private fun circle(l: Double) = Rect(Offset(r, r), l.toFloat())
    /** A ring's arc as a stroke; the square: a row's segment, in the right half. */
    fun arc(l: Double, from: Double, to: Double): Path? {
        val p = Path()
        if (square) {
            val a = maxOf(0.0, from)
            val b = minOf(0.5, to)
            if (b <= a) return null
            p.moveTo((2 * a * n).toFloat(), (n - l).toFloat())
            p.lineTo((2 * b * n).toFloat(), (n - l).toFloat())
        } else {
            if (l <= 0) return null
            if (to - from >= 1) p.addOval(circle(l))
            else p.arcTo(circle(l), (from * 360 - 90).toFloat(), ((to - from) * 360).toFloat(), true)
        }
        return p
    }
    /** The band between two levels over an arc. */
    fun band(l0: Double, l1: Double, from: Double, to: Double): Path? {
        val p = Path()
        if (square) {
            val a = maxOf(0.0, from)
            val b = minOf(0.5, to)
            if (b <= a) return null
            p.addRect(Rect((2 * a * n).toFloat(), (n - l1).toFloat(), (2 * b * n).toFloat(), (n - l0).toFloat()))
        } else {
            val start = (from * 360 - 90).toFloat()
            val sweep = ((to - from) * 360).toFloat()
            p.arcTo(circle(l1), start, sweep, true)
            p.arcTo(circle(maxOf(0.0, l0)), start + sweep, -sweep, false)
            p.close()
        }
        return p
    }
    /** A band whose edges curve (pts from its lower level up): up its `from` edge, across, down its `to` edge. */
    fun curvedBand(pts: List<PieErrPt>): Path {
        val p = Path()
        pts.forEachIndexed { i, pt -> xy(pt.from, pt.l).let { if (i == 0) p.moveTo(it.x, it.y) else p.lineTo(it.x, it.y) } }
        val top = pts.last()
        val bottom = pts.first()
        if (!square) p.arcTo(circle(top.l), (top.from * 360 - 90).toFloat(), ((top.to - top.from) * 360).toFloat(), false)
        for (pt in pts.asReversed()) xy(pt.to, pt.l).let { p.lineTo(it.x, it.y) }
        if (!square) p.arcTo(circle(maxOf(0.0, bottom.l)), (bottom.to * 360 - 90).toFloat(), ((bottom.from - bottom.to) * 360).toFloat(), false)
        p.close()
        return p
    }
}

private fun DrawScope.drawPie(sc: PieScene, img: ImageBitmap) {
    val k = sc.k.toFloat()
    val n = sc.n.toFloat()
    val sh = PieShape(sc.square, n)
    drawImage(img)
    // The bars at the calorie min and max: their outer edges thin solid lines.
    for (l in sc.barEdges) sh.arc(l, 0.0, 1.0)?.let { drawPath(it, rgb(sc.barLine), style = Stroke(k)) }
    // The estimate: a ring as wide as the calories' interval, split by what was eaten.
    for (a in sc.arcs) sh.arc(sc.mid, a.from, a.to)?.let { drawPath(it, rgb(a.c), style = Stroke(sc.thick.toFloat())) }
    // Its parts outside the calorie target, darker.
    for (d in sc.dims) sh.band(d.l0, d.l1, d.from, d.to)?.let { drawPath(it, rgb(d.c)) }
    // Each macro's range on it (curved: its kcal the same on every ring): see-through, hatched at 110° as the bars' error range.
    for (e in sc.errs) {
        if (e.pts.size < 2) continue
        clipPath(sh.curvedBand(e.pts)) {
            drawRect(rgb(e.c, 0.4f), size = Size(n, n))
            val slant = n * kotlin.math.tan(PI / 9).toFloat()
            var x = -n
            while (x < n) {
                drawLine(rgb(e.hatch), Offset(x, n), Offset(x + slant, 0f), strokeWidth = 1.5f * k)
                x += 5 * k
            }
        }
    }
    for (l in sc.edges) sh.arc(l, 0.0, 1.0)?.let { drawPath(it, Color.White, style = Stroke(1.5f * k)) }
    // The macros' targets, over everything: dashed lines up to the calorie target's lowest ring, then curves to the top.
    val targetStroke = Stroke(1.2f * k, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5 * k, 4 * k)))
    val targetColour = Color.White.copy(alpha = 0.55f)
    for (ln in sc.lines) drawPath(Path().apply { sh.xy(ln.t, ln.l0).let { moveTo(it.x, it.y) }; sh.xy(ln.t, ln.l1).let { lineTo(it.x, it.y) } }, targetColour, style = targetStroke)
    for (curve in sc.curves) {
        val p = Path()
        var on = false
        for (pt in curve) {
            if (pt == null) { on = false; continue }
            val o = sh.xy(pt.t, pt.l)
            if (on) p.lineTo(o.x, o.y) else p.moveTo(o.x, o.y)
            on = true
        }
        drawPath(p, targetColour, style = targetStroke)
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
