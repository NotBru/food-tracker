package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.BdBar
import app.foodtracker.BdEntry
import app.foodtracker.BreakdownView
import app.foodtracker.Core
import app.foodtracker.jsOf
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Breakdown, native: a port of app/src/screens/Breakdown.jsx (logic: app/src/breakdown.js; data: core.js breakdown).
// One nutrient over a window: each consumption (or group of them) as a bar, largest first; by day from the 7-day
// dashboard; in quintiles. Ticked entries can be grouped.

@Composable
fun BreakdownScreen(view: BreakdownView?, core: Core, nutrient: String, query: JsonObject) {
    var shownView by remember(view?.title, view?.subtitle, view?.per?.kcal) { mutableStateOf<String?>(null) }
    var picked by remember(query) { mutableStateOf(emptySet<String>()) }
    var open by remember(query) { mutableStateOf(emptySet<String>()) }
    var groupName by remember(query) { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize()) {
        ScreenFrame(view?.title ?: "", view?.subtitle, onBack = core::back, right = view?.takeIf { !it.unknown }?.let { v ->
            { RoundIconButton("Explore", { core.go(v.explore) }) { Text("🔍", fontSize = 16.sp) } }
        }) {
            val v = view ?: return@ScreenFrame
            if (v.unknown) { Muted("Unknown nutrient."); return@ScreenFrame }
            val color = C.ofClass(v.cls)
            v.total?.let { t ->
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold)) { append(t.value) }
                    append(" ${t.unit} ${t.pm} ")
                    withStyle(SpanStyle(color = C.muted)) { append(t.range) }
                }, Modifier.padding(top = 4.dp, bottom = 4.dp), color = C.text, fontSize = 18.sp)
            }
            v.per?.let { p -> Segmented(listOf("Total", "per 100 kcal"), if (p.kcal) 1 else 0, { core.replace(if (it == 1) p.perKcal else p.total) }) }
            val mode = (shownView ?: v.view).takeIf { m -> v.views.any { it.key == m } } ?: "ranked"
            Segmented(v.views.map { it.label }, v.views.indexOfFirst { it.key == mode }, { shownView = v.views[it].key })
            Gap(4.dp)
            v.empty?.let { Muted(it) }
            fun toggle(set: Set<String>, k: String) = if (k in set) set - k else set + k
            @Composable
            fun Entry(e: BdEntry) = BdRow(e, color, ticked = e.key in picked, onTick = { picked = toggle(picked, e.key) }, expanded = e.key in open,
                onOpen = { if (e.group) open = toggle(open, e.key) else e.link?.let(core::go) }, onMember = core::go,
                onRename = { name -> scope.launch { runCatching { core.call("renameGroup", JsonPrimitive(e.groupId), JsonPrimitive(name)) } } },
                onUngroup = { scope.launch { runCatching { core.call("ungroup", JsonPrimitive(e.groupId)) }; open = open - e.key } })
            when {
                v.empty != null -> {}
                mode == "days" -> for (d in v.days) BdRow(d, color, ticked = null, onOpen = { d.link?.let(core::go) })
                mode == "quintiles" -> {
                    val byKey = v.rows.associateBy { it.key }
                    for (q in v.quintiles) {
                        Text(buildAnnotatedString {
                            append(q.name)
                            withStyle(SpanStyle(color = C.muted, fontWeight = FontWeight.Normal)) { append(q.info) }
                        }, Modifier.padding(start = 4.dp, top = 12.dp), color = C.text, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        for (k in q.keys) byKey[k]?.let { Entry(it) }
                    }
                }
                else -> for (e in v.rows) Entry(e)
            }
            if (v.notes != null || v.failed != null) Text(buildAnnotatedString {
                v.notes?.let { append("$it ") }
                v.failed?.let { withStyle(SpanStyle(color = C.warn)) { append(it) } }
            }, color = C.muted, fontSize = 13.sp)
            val ticked = v.rows.count { it.key in picked }
            if (mode != "days" && ticked > 0) Gap(140.dp)
        }
        val v = view
        val ticked = v?.rows?.filter { it.key in picked }.orEmpty()
        if (v != null && ticked.isNotEmpty() && (shownView ?: v.view) != "days") {
            fun group() = scope.launch {
                runCatching { core.call("breakdownGroup", JsonPrimitive(nutrient), query, jsOf(ticked.map { it.key }), JsonPrimitive(groupName)) }
                picked = emptySet(); groupName = ""
            }
            // .bd-groupbar: kept at the bottom while entries are ticked.
            Column(
                Modifier.align(Alignment.BottomCenter).padding(12.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(C.panel2)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TextBox(groupName, { groupName = it }, placeholder = "Name (optional)", bg = C.bg, onDone = { if (ticked.size >= 2) group() })
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${ticked.size} selected", Modifier.weight(1f), color = C.text)
                    PillButton("Clear", { picked = emptySet(); groupName = "" }, bg = C.panel, fg = C.text)
                    PillButton("Group", { group() }, enabled = ticked.size >= 2)
                }
            }
        }
    }
}

/** A row: name (a tick box before it, for grouping; a group's ▸), value and share, its bar, the line under it. */
@Composable
private fun BdRow(
    e: BdEntry, color: Color, ticked: Boolean?, onTick: () -> Unit = {}, expanded: Boolean = false, onOpen: () -> Unit,
    onMember: (String) -> Unit = {}, onRename: (String) -> Unit = {}, onUngroup: () -> Unit = {},
) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(C.panel).clickable(onClick = onOpen).padding(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (ticked != null) TickBox(ticked, onTick)
            if (e.group) Text(if (expanded) "▾" else "▸", color = C.muted)
            Text(e.label, Modifier.weight(1f), color = C.text, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            ValueText(e.value, e.more)
        }
        // The made-at tag under the name (beside it, a concoction's name would have no room left).
        e.made?.let { Tag(it) }
        BdBarView(e.bar, color)
        Muted(e.sub, size = 13.sp)
        if (expanded) Column(Modifier.padding(top = 6.dp).clickable(enabled = false) {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            // Saved on Done or when leaving the box; empty goes back to the food names.
            var name by remember(e.name) { mutableStateOf(e.name ?: "") }
            TextBox(name, { name = it }, placeholder = "Group name", bg = C.bg, onDone = { onRename(name) },
                onFocus = { if (!it && name.trim() != (e.name ?: "")) onRename(name) })
            for (m in e.members) Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(C.bg).clickable { onMember(m.link) }.padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(m.label, Modifier.weight(1f), color = C.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    ValueText(m.value, m.more)
                }
                m.made?.let { Tag(it, bg = C.panel) }
                Muted(m.sub, size = 13.sp)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { LinkButton("Ungroup", onUngroup) }
        }
    }
}

@Composable
private fun ValueText(value: String, more: String) = Text(buildAnnotatedString {
    append(value)
    withStyle(SpanStyle(fontWeight = FontWeight.Normal, color = C.muted, fontSize = 13.sp)) { append(more) }
}, color = C.text, fontWeight = FontWeight.Bold, maxLines = 1)

/** `.bd-tick`: an 18 dp tick box. */
@Composable
private fun TickBox(on: Boolean, onChange: () -> Unit) {
    Box(
        Modifier.size(20.dp).clip(RoundedCornerShape(4.dp)).background(if (on) C.accent else Color.Transparent)
            .border(1.5.dp, if (on) C.accent else C.muted, RoundedCornerShape(4.dp))
            .toggleable(on, role = Role.Checkbox) { onChange() }.semantics { contentDescription = "Select" },
        contentAlignment = Alignment.Center,
    ) { if (on) Text("✓", color = C.onAccent, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

/** `.bd-bar`: solid to the interval's low end, hatched to its high end, a white tick at the value. */
@Composable
private fun BdBarView(b: BdBar, color: Color) {
    Canvas(Modifier.fillMaxWidth().padding(vertical = 2.dp).height(10.dp)) {
        val w = size.width
        val h = size.height
        clipRect {
            drawRect(C.bg)
            drawRect(color, Offset.Zero, Size(w * (if (b.err) b.lo else b.mean).toFloat(), h))
            if (b.err) hatchRect(Rect(w * b.lo.toFloat(), 0f, w * b.hi.toFloat(), h), color)
        }
        if (b.err) {
            val tick = 3.dp.toPx()
            val over = 2.dp.toPx()
            drawRect(Color.White, Offset(w * b.mean.toFloat() - tick / 2, -over), Size(tick, h + 2 * over))
        }
    }
}
