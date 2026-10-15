package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.data.Bar
import app.foodtracker.data.NV
import app.foodtracker.data.Range
import app.foodtracker.data.Status
import app.foodtracker.data.fmt
import app.foodtracker.data.rangeLabel
import app.foodtracker.data.targetBar
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** A dashboard row: calories and the macros always; any other nutrient once a target mentions it. */
data class DashRow(val key: String, val label: String, val unit: String, val color: Color, val mandatory: Boolean)

val MANDATORY_ROWS = listOf(
    DashRow("energy", "Calories", "kcal", C.kcal, true),
    DashRow("proteins", "Protein", "g", C.prot, true),
    DashRow("fat", "Fat", "g", C.fat, true),
    DashRow("carbohydrates", "Carbs", "g", C.carb, true),
)

// Mandatory rows without a target still get a neutral, full bar/gauge (no regions, markers or label).
private val DUMMY = Bar(fill = 100.0, minAt = null, maxAt = null, status = Status.None, dummy = true)
fun barFor(row: DashRow, v: NV, range: Range?): Bar? = targetBar(v.value, range, v.delta) ?: if (row.mandatory) DUMMY else null

// --- Fill pieces ----------------------------------------------------------------------------------------------
// The fill (solid up to value − Δ, hatched from there to value + Δ) is cut at the min and max, and each piece
// takes the colour of the region it lies in. A bar without a target: one grey piece.

data class Piece(val from: Double, val to: Double, val region: Status, val hatched: Boolean)

private fun regionAt(bar: Bar, x: Double) = when {
    bar.dummy -> Status.None
    bar.minAt != null && x < bar.minAt -> Status.Under
    bar.maxAt != null && x > bar.maxAt -> Status.Over
    else -> Status.Ok
}

fun fillPieces(bar: Bar): List<Piece> {
    val spans = mutableListOf(Triple(0.0, bar.errLo ?: bar.fill, false))
    if (bar.errLo != null && bar.errHi != null && bar.errHi > bar.errLo) spans += Triple(bar.errLo, bar.errHi, true)
    val out = mutableListOf<Piece>()
    for ((a, b, hatched) in spans) {
        if (!(b > a)) continue
        val cuts = listOf(a) + listOfNotNull(bar.minAt, bar.maxAt).filter { it > a && it < b }.sorted() + b
        for (i in 1 until cuts.size) out += Piece(cuts[i - 1], cuts[i], regionAt(bar, (cuts[i - 1] + cuts[i]) / 2), hatched)
    }
    return out
}

fun fillEnd(bar: Bar) = if (bar.errLo != null) bar.errHi ?: bar.fill else bar.fill

private fun pieceColor(p: Piece) = if (p.region == Status.None) C.muted.copy(alpha = 0.45f) else C.status(p.region)

/** Draws `content` into its own layer, then keeps only what lies under `mask` (like an SVG mask). */
private inline fun DrawScope.masked(content: DrawScope.() -> Unit, mask: DrawScope.() -> Unit) {
    drawIntoCanvas { canvas ->
        canvas.saveLayer(Rect(Offset.Zero, size), Paint())
        content()
        canvas.saveLayer(Rect(Offset.Zero, size), Paint().apply { blendMode = BlendMode.DstIn })
        mask()
        canvas.restore()
        canvas.restore()
    }
}

// --- Gauge ------------------------------------------------------------------------------------------------------
// Semicircle version of the bar: same scale (targetBar), tinted regions, fill coloured per region. Geometry in
// the web app's viewBox units (120 × 66), scaled to the canvas.

private const val VB_W = 120f
private const val VB_H = 66f
private const val CX = 60f
private const val CY = 60f
private const val R = 46f
private const val SW = 10f
private const val OVER = 0.08f // regions overshoot the ends, then get masked to the round-ended track
private const val HATCH_STEP = 3.2f
private const val HATCH_SLANT = 2.2f

@Composable
fun Gauge(bar: Bar?, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxWidth().aspectRatio(VB_W / VB_H)) {
        if (bar == null) return@Canvas // keeps its space, draws nothing
        val k = size.width / VB_W
        val sw = SW * k
        val box = Rect(Offset((CX - R) * k, (CY - R) * k), Size(2 * R * k, 2 * R * k))
        // p in [0, 1] along the arc, left to right over the top.
        fun arc(p0: Float, p1: Float, color: Color, cap: StrokeCap = StrokeCap.Butt, blend: BlendMode = BlendMode.SrcOver) =
            drawArc(color, 180f + 180f * p0, 180f * (p1 - p0), false, box.topLeft, box.size, style = Stroke(sw, cap = cap), blendMode = blend)
        fun pt(p: Float, r: Float) = (PI * (1 - p)).let { a -> Offset((CX + r * cos(a).toFloat()) * k, (CY - r * sin(a).toFloat()) * k) }
        fun f(x: Double?) = ((x ?: 0.0) / 100).toFloat()

        masked({
            arc(-OVER, 1 + OVER, C.bg)
            if (bar.minAt != null && bar.minAt > 0) arc(-OVER, f(bar.minAt), C.warn.copy(alpha = 0.28f))
            if (!bar.dummy) {
                val lo = f(bar.minAt).let { if (it > 0) it else -OVER }
                val hi = (if (bar.maxAt != null) f(bar.maxAt) else 1f).let { if (it < 1) it else 1 + OVER }
                arc(lo, hi, C.kcal.copy(alpha = 0.28f))
            }
            if (bar.maxAt != null && bar.maxAt < 100) arc(f(bar.maxAt), 1 + OVER, C.prot.copy(alpha = 0.28f))
        }) { arc(0f, 1f, Color.White, StrokeCap.Round) }

        val end = f(fillEnd(bar))
        if (end <= 0) return@Canvas
        val pieces = fillPieces(bar)
        masked({
            pieces.forEachIndexed { i, pc ->
                // The first and last pieces overshoot so the mask's round ends are filled.
                val p0 = if (i == 0) -OVER else f(pc.from)
                val p1 = if (i == pieces.size - 1) f(pc.to) + OVER else f(pc.to)
                val color = pieceColor(pc)
                if (!pc.hatched) arc(p0, p1, color)
                else masked({
                    arc(f(pc.from), p1, color.copy(alpha = 0.4f))
                    // Slanted lines: each from the inner edge at s to the outer edge a little further along.
                    val len = (PI * R).toFloat()
                    var s = f(pc.from) * len - HATCH_SLANT
                    while (s < p1 * len) {
                        drawLine(C.lighter(color), pt(s / len, R - SW / 2), pt((s + HATCH_SLANT) / len, R + SW / 2), strokeWidth = 1.1f * k)
                        s += HATCH_STEP
                    }
                }) { arc(f(pc.from), p1, Color.White) }
            }
        }) { arc(0f, end, Color.White, StrokeCap.Round) }
    }
}

// --- Bar --------------------------------------------------------------------------------------------------------

@Composable
fun TargetBar(bar: Bar, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxWidth().height(10.dp)) {
        val h = size.height
        val w = size.width
        val track = Path().apply { addRoundRect(RoundRect(0f, 0f, w, h, CornerRadius(h / 2))) }
        fun x(p: Double?) = ((p ?: 0.0) / 100 * w).toFloat()
        clipPath(track) {
            drawRect(C.bg)
            if (bar.minAt != null) drawRect(C.warn.copy(alpha = 0.28f), Offset.Zero, Size(x(bar.minAt), h))
            if (!bar.dummy) drawRect(C.kcal.copy(alpha = 0.28f), Offset(x(bar.minAt ?: 0.0), 0f), Size(x(bar.maxAt ?: 100.0) - x(bar.minAt ?: 0.0), h))
            if (bar.maxAt != null) drawRect(C.prot.copy(alpha = 0.28f), Offset(x(bar.maxAt), 0f), Size(w - x(bar.maxAt), h))
            // The fill's shape: round-ended, 0 → end; pieces inside it.
            val fillbox = Path().apply { addRoundRect(RoundRect(0f, 0f, x(fillEnd(bar)), h, CornerRadius(h / 2))) }
            clipPath(fillbox) {
                for (pc in fillPieces(bar)) {
                    val color = pieceColor(pc)
                    val left = x(pc.from)
                    val right = x(pc.to)
                    if (!pc.hatched) drawRect(color, Offset(left, 0f), Size(right - left, h))
                    else clipRect(left, 0f, right, h) {
                        drawRect(color.copy(alpha = 0.4f), Offset(left, 0f), Size(right - left, h))
                        // Lines slanted at 110°, 1.5 px every 5 px, like the web app's repeating gradient.
                        val step = 5.dp.toPx()
                        val lean = h * 0.36f
                        var s = left - lean
                        while (s < right + lean) {
                            drawLine(C.lighter(color), Offset(s + lean, 0f), Offset(s, h), strokeWidth = 1.5.dp.toPx())
                            s += step
                        }
                    }
                }
            }
        }
    }
}

// --- Labels -------------------------------------------------------------------------------------------------------

private fun statusMark(s: Status) = when (s) { Status.Ok -> "✓"; Status.Under -> "↓"; else -> "↑" }

/** "1800–2200 kcal ✓" line, or a blank line of the same height when there's no target. */
@Composable
fun RangeLine(bar: Bar?, range: Range?, unit: String, modifier: Modifier = Modifier) {
    val text = if (bar != null && !bar.dummy && range != null) "${rangeLabel(range)} $unit ${statusMark(bar.status)}" else " "
    Text(text, modifier, color = if (bar != null) C.status(bar.status) else C.muted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

/**
 * Calories only, with a max in the target: what's left to eat, worst case. The most eaten so far is value + Δ,
 * so the budget is max − (value + Δ). At or below 0 it reads "over budget".
 */
@Composable
fun Budget(row: DashRow, v: NV, range: Range?) {
    if (row.key != "energy" || range?.hasMax != true) return
    val left = range.max!! - (v.value + (v.delta.takeIf { it.isFinite() } ?: 0.0))
    Text(
        buildAnnotatedString {
            if (left > 0) {
                append("Budget ")
                withStyle(SpanStyle(color = C.kcal, fontWeight = FontWeight.Bold)) { append(fmt(left, 0)) }
                append(" ${row.unit}")
            } else {
                append("Over budget by ")
                withStyle(SpanStyle(color = C.prot, fontWeight = FontWeight.Bold)) { append(fmt(-left, 0)) }
                append(" ${row.unit}")
            }
        },
        color = C.text, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
    )
}

private val TileShape = RoundedCornerShape(20.dp)

/** Dashboard style "gauges": equal tiles, value inside a semicircle gauge. */
@Composable
fun GaugeTile(row: DashRow, v: NV, range: Range?, modifier: Modifier = Modifier) {
    val bar = barFor(row, v, range)
    Column(
        modifier.clip(TileShape).background(C.panel2).padding(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(row.label, Modifier.fillMaxWidth().padding(start = 4.dp), color = C.muted, fontSize = 14.sp)
        Box(Modifier.widthIn(max = 170.dp).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
            Gauge(bar)
            Text(
                "${if (v.estimated) "~" else ""}${fmt(v.value, 0)}", Modifier.padding(bottom = 2.dp),
                color = row.color, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 28.sp, textAlign = TextAlign.Center,
            )
        }
        Text("${row.unit} ±${fmt(v.delta)}", color = C.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        RangeLine(bar, range, row.unit, Modifier.padding(top = 4.dp))
        Budget(row, v, range)
    }
}

/** Dashboard style "bars": one full-width row per nutrient with a horizontal bar over tinted regions. */
@Composable
fun BarRow(row: DashRow, v: NV, range: Range?, modifier: Modifier = Modifier) {
    val bar = barFor(row, v, range)
    Row(modifier.clip(TileShape).background(C.panel2).padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(row.label, Modifier.width(90.dp).padding(top = 14.dp), color = C.muted)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = row.color, fontSize = 34.sp, fontWeight = FontWeight.ExtraBold)) {
                        append("${if (v.estimated) "~" else ""}${fmt(v.value, 0)}")
                    }
                    withStyle(SpanStyle(color = C.muted, fontSize = 14.sp)) { append(" ${row.unit} ±${fmt(v.delta)}") }
                },
            )
            // Without a target the bar keeps its space, so every row is equally spaced.
            Box(Modifier.padding(vertical = 4.dp)) { if (bar != null) TargetBar(bar) else Box(Modifier.height(10.dp)) }
            RangeLine(bar, range, row.unit)
            Budget(row, v, range)
        }
    }
}
