package app.foodtracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.ExplorePicked
import app.foodtracker.ExploreView
import app.foodtracker.get
import app.foodtracker.jsOf
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

// Explore, native: a port of app/src/screens/Explore.jsx (ranking: app/src/explore.js; data: core.js explore,
// exploreFind, explorePicked). Fits the window: the list takes what the chart (at most 45%) and the switches (24%)
// leave. The search box scrolls the list to the best-ranked match, centred; Done picks it.

@Composable
fun ExploreScreen(core: Core, nutrient: String) {
    var off by remember(nutrient) { mutableStateOf(emptyList<String>()) }
    var loggedOnly by remember(nutrient) { mutableStateOf(false) }
    var query by remember(nutrient) { mutableStateOf("") }
    var pickedId by remember(nutrient) { mutableStateOf<String?>(null) }
    val view by produceState<ExploreView?>(null, nutrient, off, loggedOnly) {
        value = runCatching { core.get(ExploreView.serializer(), "explore", JsonPrimitive(nutrient), jsOf(off), JsonPrimitive(loggedOnly)) }.getOrNull() ?: value
    }
    val match by produceState(-1, view, query) {
        value = if (query.isBlank()) -1 else runCatching {
            (core.call("exploreFind", JsonPrimitive(nutrient), jsOf(off), JsonPrimitive(loggedOnly), JsonPrimitive(query)) as JsonPrimitive).intOrNull ?: -1
        }.getOrDefault(-1)
    }
    val rows = view?.rows.orEmpty()
    val picked = rows.firstOrNull { it.id == pickedId } ?: rows.firstOrNull()
    val top by produceState<ExplorePicked?>(null, picked?.id) {
        value = picked?.let { p -> runCatching { core.get(ExplorePicked.serializer().nullable, "explorePicked", JsonPrimitive(nutrient), JsonPrimitive(p.id)) }.getOrNull() }
    }
    val list = rememberLazyListState()
    LaunchedEffect(match) {
        if (match < 0) return@LaunchedEffect
        list.animateScrollToItem(match)
        val item = list.layoutInfo.visibleItemsInfo.firstOrNull { it.index == match } ?: return@LaunchedEffect
        list.animateScrollBy(-(list.layoutInfo.viewportSize.height / 2f - item.size / 2f))
    }
    Column(Modifier.fillMaxSize().background(C.bg)) {
        TopBar(view?.title ?: "", "Explore", core::back)
        val v = view ?: return@Column
        if (v.unknown) { Muted(v.empty, Modifier.padding(16.dp)); return@Column }
        BoxWithConstraints(Modifier.weight(1f).padding(start = 16.dp, end = 16.dp, bottom = 12.dp)) {
            val h = maxHeight
            Column(Modifier.fillMaxSize()) {
                top?.let { t ->
                    Column(Modifier.heightIn(max = h * 0.45f).verticalScroll(rememberScrollState())) {
                        Text(buildAnnotatedString {
                            withStyle(SpanStyle(color = C.accent, fontWeight = FontWeight.Medium)) { append(t.label) }
                            withStyle(SpanStyle(color = C.muted)) { append(t.per) }
                        }, Modifier.fillMaxWidth().clickable { core.go(t.link) }, color = C.text, textAlign = TextAlign.Center)
                        EnergyChart(t.chart)
                    }
                }
                TextBox(query, { query = it }, Modifier.padding(top = 12.dp), placeholder = "Find in the list",
                    onDone = { if (match >= 0) pickedId = rows[match].id })
                if (query.isNotBlank() && match < 0) Muted("Not in the list.", Modifier.padding(start = 4.dp, top = 6.dp), size = 13.sp)
                LazyColumn(Modifier.weight(1f).heightIn(min = 80.dp).padding(top = 12.dp), state = list, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(rows, key = { _, r -> r.id }) { i, r ->
                        val shape = RoundedCornerShape(22.dp)
                        Column(
                            Modifier.fillMaxWidth().clip(shape).background(if (i == match) C.panel2 else C.panel)
                                .let { if (r == picked) it.border(2.dp, C.accent, shape) else it }
                                .clickable { pickedId = r.id }.padding(horizontal = 18.dp, vertical = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(r.label, Modifier.weight(1f), color = C.text, fontSize = 16.sp)
                                Text(buildAnnotatedString {
                                    append(r.value)
                                    withStyle(SpanStyle(fontSize = 13.sp, color = C.muted)) { append(" ${r.pm}") }
                                }, color = C.text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Muted(r.text, size = 13.sp)
                        }
                    }
                    if (rows.isEmpty()) item { Muted(v.empty, Modifier.padding(8.dp)) }
                }
                Row(Modifier.heightIn(max = h * 0.24f).padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SwitchBox("Databases", Modifier.weight(1f), v.dbs.map { it.name to it.on }) { name, on -> off = if (on) off - name else off + name }
                    SwitchBox("Foods", Modifier.weight(1f), listOf("Logged only" to loggedOnly)) { _, on -> loggedOnly = on }
                }
            }
        }
    }
}

/** `.ex-bottom > section`: a panel, its muted title over small switches (scrolling if many). */
@Composable
private fun SwitchBox(title: String, modifier: Modifier, items: List<Pair<String, Boolean>>, onChange: (String, Boolean) -> Unit) {
    Column(modifier.clip(RoundedCornerShape(16.dp)).background(C.panel).padding(horizontal = 12.dp, vertical = 8.dp)) {
        Text(title, color = C.muted, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
        Column(Modifier.verticalScroll(rememberScrollState())) {
            for ((name, on) in items) Row(
                Modifier.fillMaxWidth().clickable { onChange(name, !on) }.padding(vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Switch(on, { onChange(name, it) }, Modifier.scale(0.7f).height(24.dp).width(40.dp), colors = SwitchDefaults.colors(checkedTrackColor = C.accent, checkedThumbColor = C.onAccent,
                    uncheckedTrackColor = C.line, uncheckedThumbColor = C.muted, uncheckedBorderColor = Color.Transparent))
                Text(name, color = C.text, fontSize = 15.sp)
            }
        }
    }
}
