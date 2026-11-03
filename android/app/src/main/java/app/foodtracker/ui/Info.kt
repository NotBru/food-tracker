package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.EnergyChartView
import app.foodtracker.InfoItem
import app.foodtracker.NutrientTableView
import app.foodtracker.Rich
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.min

// Parts of the info screens (a consumption's, a food's Info tab): rich text, the info list, the energy donut and the
// nutrient table, as FoodInfo.jsx and EnergyChart.jsx draw them.

/** A colour named by the web app ("warn", "kcal", "prot", "fat", "carb", "muted", "accent"). */
fun toneColor(tone: String?): Color = when (tone) {
    "fat" -> C.fat
    "prot" -> C.prot
    "carb" -> C.carb
    "kcal" -> C.kcal
    "warn" -> C.warn
    "muted" -> C.muted
    "accent" -> C.accent
    "range" -> C.range
    "danger" -> C.danger
    else -> C.ofClass(tone ?: "")
}

/** A tone at `shade`, mixed with the background (energy.js). */
fun shaded(tone: String, shade: Double): Color = lerp(C.bg, toneColor(tone), shade.toFloat())

fun richString(spans: List<Rich>, size: TextUnit = 14.sp): AnnotatedString = buildAnnotatedString {
    for (s in spans) withStyle(SpanStyle(
        fontWeight = if (s.b) FontWeight.Bold else null,
        color = when { s.c != null -> toneColor(s.c); s.m -> C.muted; else -> Color.Unspecified },
        fontSize = if (s.small) size * 0.85f else TextUnit.Unspecified,
    )) { append(s.t) }
}

@Composable
fun RichText(spans: List<Rich>, modifier: Modifier = Modifier, size: TextUnit = 14.sp, color: Color = C.text, align: TextAlign? = null) =
    Text(richString(spans, size), modifier, color = color, fontSize = size, textAlign = align)

/** `.info-list`: panel rows, a muted label over each value; a link row opens its route. */
@Composable
fun InfoList(items: List<InfoItem>, onOpen: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (it in items) {
            if (it.note) {
                RichText(it.text, Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp), size = 13.sp, color = C.muted)
                continue
            }
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(C.panel)
                    .let { m -> it.link?.let { l -> m.clickable { onOpen(l) } } ?: m }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                it.lead?.let { lead -> RichText(lead, Modifier.widthIn(min = 64.dp), size = 18.sp, align = TextAlign.End) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    it.label?.let { l -> Text(l, color = C.muted, fontSize = 14.sp) }
                    Text(buildAnnotatedString {
                        append(richString(it.text))
                        it.more?.let { m -> withStyle(SpanStyle(color = C.muted)) { append(" $m") } }
                    }, color = C.text, fontSize = 14.sp)
                    it.tag?.let { t -> Tag(t) }
                    it.sub?.let { s -> Text(s, color = C.muted, fontSize = 13.sp) }
                }
            }
        }
    }
}

/** EnergyChart.jsx: the donut (total in the middle, or the slice tapped), its legend and the note. */
@Composable
fun EnergyChart(e: EnergyChartView) {
    var active by remember(e) { mutableStateOf<Int?>(null) }
    BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp), contentAlignment = Alignment.Center) {
        val side = min(240f, maxWidth.value * 0.7f).dp
        Box(Modifier.size(side), contentAlignment = Alignment.Center) {
            val many = e.slices.size > 1
            Canvas(Modifier.size(side).pointerInput(e) {
                detectTapGestures { p ->
                    val c = size.width / 2f
                    val r = hypot(p.x - c, p.y - c) / (size.width / 200f)
                    if (r < 62 || r > 98) { active = null; return@detectTapGestures }
                    var a = (atan2(p.y - c, p.x - c) * 180 / PI + 90).let { if (it < 0) it + 360 else it } / 360
                    var at = 0.0
                    val i = e.slices.indexOfFirst { s -> (a >= at && a < at + s.share).also { at += s.share } }
                    active = if (i < 0 || active == i) null else i
                }
            }) {
                val k = size.width / 200f
                val r = 80 * k
                val tl = Offset(100 * k - r, 100 * k - r)
                val sz = Size(2 * r, 2 * r)
                drawCircle(C.panel, r, style = Stroke(30 * k))
                val gap = if (many) 2.0 / (2 * PI * 80) * 360 else 0.0
                var at = -90.0
                e.slices.forEachIndexed { i, s ->
                    val sweep = s.share * 360
                    drawArc(shaded(s.tone, s.shade), at.toFloat(), maxOf(0.3, sweep - gap).toFloat(), false, tl, sz,
                        style = Stroke((if (active == i) 36 else 30) * k))
                    at += sweep
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val s = active?.let { e.slices.getOrNull(it) }
                if (s != null) {
                    Text(s.kcal, color = C.text, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold)
                    Text("kcal · ${s.pct}%", color = C.muted, fontSize = 13.sp)
                    Text(s.label, color = C.text, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = side * 0.6f))
                } else {
                    Text(e.total, color = C.text, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold)
                    Text(e.totalPm, color = C.muted, fontSize = 13.sp)
                }
            }
        }
    }
    Column(Modifier.padding(top = 6.dp)) {
        for (row in e.legend) {
            TableRow {
                Row(Modifier.weight(1f).padding(start = if (row.macro) 0.dp else 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.padding(end = 8.dp).size(10.dp).clip(RoundedCornerShape(3.dp)).background(shaded(row.tone, row.shade)))
                    Text(row.label, color = C.text, fontSize = if (row.macro) 14.sp else 13.sp, fontWeight = if (row.macro) FontWeight.SemiBold else null)
                }
                val w = if (row.macro) FontWeight.SemiBold else null
                val col = if (row.macro) C.text else C.muted
                Text(buildAnnotatedString { append(row.g); withStyle(SpanStyle(color = C.muted)) { append(" g") } }, color = col, fontSize = 14.sp, fontWeight = w, textAlign = TextAlign.End)
                Text(buildAnnotatedString { append(row.kcal); withStyle(SpanStyle(color = C.muted)) { append(" kcal") } }, color = col, fontSize = 14.sp, fontWeight = w, textAlign = TextAlign.End)
                Text(row.pct, color = col, fontSize = 14.sp, fontWeight = w, textAlign = TextAlign.End, modifier = Modifier.width(44.dp))
            }
        }
    }
    Text(e.note, Modifier.padding(top = 6.dp, bottom = 14.dp), color = C.muted, fontSize = 13.sp)
}

/** A `.info-table` row: a line above, 6 dp padding. */
@Composable
fun TableRow(content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Column {
        Box(Modifier.fillMaxWidth().height(1.dp).background(C.line))
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

/** FoodInfo.jsx NutrientTable. */
@Composable
fun NutrientTable(t: NutrientTableView) {
    Column(Modifier.padding(top = 6.dp)) {
        for (r in t.rows) TableRow {
            Text(buildAnnotatedString {
                append(r.label)
                if (r.missing) withStyle(SpanStyle(color = C.warn)) { append(" *") }
            }, Modifier.weight(1f), color = C.text, fontSize = 14.sp)
            Text(buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(r.value) }
                append(" ${r.pm} ")
                withStyle(SpanStyle(color = C.muted)) { append(r.unit) }
            }, color = C.text, fontSize = 14.sp, textAlign = TextAlign.End)
            Text(r.range, color = C.muted, fontSize = 14.sp, textAlign = TextAlign.End)
            if (r.cv.isNotEmpty()) Text(r.cv, color = C.muted, fontSize = 13.sp, textAlign = TextAlign.End)
        }
    }
    if (t.missing) Text(buildAnnotatedString {
        withStyle(SpanStyle(color = C.warn)) { append("*") }
        append(" some components don't have this value.")
    }, Modifier.padding(top = 6.dp), color = C.muted, fontSize = 13.sp)
}

/** An `.info-list` row of anything. */
@Composable
fun InfoCard(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(C.panel).padding(horizontal = 16.dp, vertical = 10.dp)) { content() }
}
