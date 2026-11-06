package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.GraphChart
import app.foodtracker.GraphReadout
import app.foodtracker.GraphsView
import app.foodtracker.get
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.LocalDate
import kotlin.math.roundToInt

// Time graphs, native: a port of app/src/screens/Graphs.jsx (data and scales: app/src/graphs.js; core.js graphs,
// graphsReadout). Per dashboard row a chart of one column per day (the target range, light; the interval hatched, green/red; nothing below it;
// the estimate: graphs.js columnShapes), body measurements as dots; the 7-day average as a band. A tap picks a day; sliding sideways moves
// every chart through the days.

private val BAND = Color(30, 34, 40, 178)

@Composable
fun GraphsScreen(view: GraphsView?, core: Core, query: JsonObject) {
    var sel by remember { mutableStateOf<String?>(null) }
    val shown = view?.let { v -> sel?.takeIf { it in v.list } ?: v.list.lastOrNull() }
    val readouts by produceState<Map<String, GraphReadout>>(emptyMap(), view, shown) {
        if (shown != null) value = runCatching {
            core.get(MapSerializer(String.serializer(), GraphReadout.serializer()), "graphsReadout", query, JsonPrimitive(shown))
        }.getOrDefault(value)
    }
    // The URL keeps the view, as the dashboard's: `days` unless the default, `end` unless today.
    fun setView(n: Int, end: String?) {
        val v = view ?: return
        val qs = listOfNotNull(if (n != v.defaultDays) "days=$n" else null, end?.takeIf { it < v.today }?.let { "end=$it" }).joinToString("&")
        core.replace("/graphs${if (qs.isNotEmpty()) "?$qs" else ""}")
    }
    // Sliding: `cols` columns from where the drag started (right = earlier days).
    var panFrom by remember { mutableStateOf<String?>(null) }
    fun pan(cols: Int, done: Boolean) {
        val v = view ?: return
        val from = panFrom ?: v.last.also { panFrom = it }
        val e = LocalDate.parse(from).minusDays(cols.toLong()).toString()
        setView(v.span, if (e < v.today) e else v.today)
        if (done) panFrom = null
    }
    ScreenFrame("Time graphs", view?.subtitle ?: "", onBack = core::back) {
        val v = view ?: return@ScreenFrame
        DaysRow(v, { setView(it, v.last) }) { setView(v.span, null) }
        for (c in v.charts) Chart(c, v, shown, readouts[c.key], onPick = { sel = it }, onPan = ::pan, onOpen = core::go)
    }
}

/** `.tg-days`: a slider (its stops: 12 months … 1 day) and a box for how many days, and Today. */
@Composable
private fun DaysRow(v: GraphsView, onSpan: (Int) -> Unit, onToday: () -> Unit) {
    var text by remember(v.span) { mutableStateOf(v.span.toString()) }
    var slide by remember(v.span, v.stop) { mutableFloatStateOf(v.stop.toFloat()) }
    val stopAt = { x: Float -> v.stops[x.roundToInt().coerceIn(0, v.stops.size - 1)] }
    Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Slider(slide, { slide = it; text = stopAt(it).days.toString() },
            Modifier.weight(1f).semantics { stateDescription = stopAt(slide).label }, valueRange = 0f..(v.stops.size - 1).toFloat(), steps = v.stops.size - 2,
            onValueChangeFinished = { onSpan(stopAt(slide).days) },
            colors = SliderDefaults.colors(thumbColor = C.accent, activeTrackColor = C.accent, inactiveTrackColor = C.line,
                activeTickColor = Color.Transparent, inactiveTickColor = Color.Transparent))
        TextBox(text, { t ->
            text = t
            t.toIntOrNull()?.takeIf { it in 1..v.maxDays }?.let(onSpan)
        }, Modifier.width(72.dp), numeric = true, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
            onFocus = { if (!it) text = v.span.toString() })
        Muted("days")
        PillButton("Today", onToday, enabled = v.last != v.today, bg = C.panel, fg = C.text, fontSize = 14.sp,
            padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 8.dp))
    }
}

@Composable
private fun Chart(c: GraphChart, v: GraphsView, shown: String?, readout: GraphReadout?, onPick: (String) -> Unit, onPan: (Int, Boolean) -> Unit, onOpen: (String) -> Unit) {
    val measurer = rememberTextMeasurer()
    val n = v.list.size
    val picked = v.list.indexOf(shown)
    val list by rememberUpdatedState(v.list)
    val pan by rememberUpdatedState(onPan)
    val pick by rememberUpdatedState(onPick)
    Column(Modifier.padding(top = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(c.label, color = C.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(" ${c.unit}", color = C.muted, fontSize = 13.sp)
            Box(Modifier.weight(1f))
            WeekKey()
            Text("7-day average", Modifier.padding(start = 6.dp), color = C.muted, fontSize = 12.sp)
        }
        Row(Modifier.padding(top = 6.dp).height(150.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            // The y axis: the gridlines' values, right-aligned beside them.
            val style = TextStyle(color = C.muted, fontSize = 11.sp)
            Canvas(Modifier.width(30.dp).fillMaxHeight()) {
                for (g in c.grid) {
                    val t = measurer.measure(g.text, style)
                    val y = size.height * (1 - g.at / 100).toFloat() - t.size.height / 2f
                    drawText(t, topLeft = Offset(size.width - t.size.width, y.coerceIn(0f, size.height - t.size.height)))
                }
            }
            Canvas(
                Modifier.weight(1f).fillMaxHeight()
                    .pointerInput(Unit) { detectTapGestures { p -> list.getOrNull((p.x / size.width * list.size).toInt().coerceIn(0, list.size - 1))?.let(pick) } }
                    .pointerInput(Unit) {
                        var dx = 0f
                        val cols = { (dx / (size.width / list.size.toFloat())).roundToInt() }
                        detectHorizontalDragGestures(
                            onDragStart = { dx = 0f },
                            onDragEnd = { pan(cols(), true) },
                            onDragCancel = { pan(cols(), true) },
                        ) { change, d -> change.consume(); dx += d; pan(cols(), false) }
                    },
            ) { plot(c, n, picked) }
        }
        // A few dates: the first, the middle and the last day.
        Canvas(Modifier.fillMaxWidth().padding(start = 36.dp).height(18.dp)) {
            val style = TextStyle(color = C.muted, fontSize = 11.sp)
            v.xLabels.forEachIndexed { i, l ->
                val t = measurer.measure(l.text, style)
                val x = when (i) {
                    0 -> 0f
                    v.xLabels.lastIndex -> size.width - t.size.width
                    else -> size.width * l.at.toFloat() - t.size.width / 2f
                }
                drawText(t, topLeft = Offset(x, 3.dp.toPx()))
            }
        }
        readout?.let { r ->
            Column(Modifier.fillMaxWidth().padding(top = 6.dp).let { m -> r.link?.let { l -> m.clickable { onOpen(l) } } ?: m }) {
                RichText(r.line1)
                RichText(r.line2)
            }
        }
    }
}

/** The plot: per day its column (or dot), the gridlines, the 7-day average band, the picked day outlined. */
private fun DrawScope.plot(c: GraphChart, n: Int, picked: Int) {
    val w = size.width
    val h = size.height
    val colW = w / n
    val y = { p: Double -> (h * (1 - p / 100)).toFloat() }
    clipRect {
        drawRect(C.bg)
        c.columns.forEachIndexed { i, col ->
            val x0 = i * colW
            for (z in col.zones) drawRect(C.ofRegion(z.region).copy(alpha = 0.28f), Offset(x0, y(z.to)), Size(colW, y(z.from) - y(z.to)))
            for (pc in col.pieces) {
                val color = C.ofRegion(pc.region)
                val r = Rect(x0, y(pc.to), x0 + colW, y(pc.from))
                if (pc.hatched) hatchRect(r, color) else drawRect(if (pc.region == "none") color.copy(alpha = 0.45f) else color, r.topLeft, r.size)
            }
            col.mean?.let { m -> drawRect(Color.White, Offset(x0, y(m) - 1.dp.toPx()), Size(colW, 2.dp.toPx())) }
        }
        for (g in c.grid) drawRect(Color.White.copy(alpha = 0.08f), Offset(0f, y(g.at)), Size(w, 1f))
        // The 7-day average: runs of days that have one, filled between the low and high lines.
        val runs = mutableListOf(mutableListOf<app.foodtracker.WeekPoint>())
        for (p in c.week) if (p != null) runs.last().add(p) else runs.add(mutableListOf())
        for (r in runs.filter { it.isNotEmpty() }) {
            val px = { p: app.foodtracker.WeekPoint -> (p.x * colW).toFloat() }
            val py = { pct: Double -> (h * pct / 100).toFloat() }
            val band = Path().apply {
                r.forEachIndexed { j, p -> if (j == 0) moveTo(px(p), py(p.hi)) else lineTo(px(p), py(p.hi)) }
                for (p in r.asReversed()) lineTo(px(p), py(p.lo))
                close()
            }
            drawPath(band, BAND)
            for (edge in listOf({ p: app.foodtracker.WeekPoint -> p.hi }, { p: app.foodtracker.WeekPoint -> p.lo })) {
                val line = Path().apply { r.forEachIndexed { j, p -> if (j == 0) moveTo(px(p), py(edge(p))) else lineTo(px(p), py(edge(p))) } }
                drawPath(line, C.accent, style = Stroke(1.5.dp.toPx()))
            }
        }
        // A measure's dots over the band (styles.css: z-index 1).
        c.columns.forEachIndexed { i, col ->
            col.dot?.let { d ->
                val cx = i * colW + colW / 2
                if (d.lo != null && d.hi != null) drawRect(Color.White.copy(alpha = 0.6f), Offset(cx - 1.dp.toPx(), y(d.hi)), Size(2.dp.toPx(), y(d.lo) - y(d.hi)))
                drawCircle(Color.White, 3.5.dp.toPx(), Offset(cx, y(d.at)))
            }
        }
        if (picked >= 0) drawRect(Color.White.copy(alpha = 0.55f), Offset(picked * colW + 0.5f, 0.5f), Size(colW - 1f, h - 1f), style = Stroke(1.dp.toPx()))
    }
}

/** `.tg-key`: the band's swatch. */
@Composable
private fun WeekKey() = Canvas(Modifier.size(16.dp, 10.dp)) {
    val t = 1.dp.toPx()
    drawRect(BAND, Offset(0f, t), Size(size.width, size.height - 2 * t))
    drawLine(C.accent, Offset(0f, t), Offset(size.width, t), 1.5.dp.toPx())
    drawLine(C.accent, Offset(0f, size.height - t), Offset(size.width, size.height - t), 1.5.dp.toPx())
}
