package app.foodtracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.SaveReply
import app.foodtracker.TargetEditorView
import app.foodtracker.TargetsView
import app.foodtracker.get
import app.foodtracker.jsOf
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Targets, native: a port of app/src/screens/Targets.jsx (data: core.js targets, targetEditor; saving: app/src/forms.js).

@Composable
fun TargetsScreen(view: TargetsView?, core: Core, editing: JsonObject?, onEdit: (JsonObject?) -> Unit) {
    Box(Modifier.fillMaxSize()) {
        ScreenFrame("Targets", view?.user, onBack = core::back) {
            if (view == null) return@ScreenFrame
            AddRow("+ add target", { onEdit(view.new) })
            for (r in view.rows) ListCard({ onEdit(r.target) }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(r.from, color = C.text)
                    r.tag?.let { Tag(it, if (it == "active") C.kcal else C.muted) }
                }
                r.until?.let { Text(it, color = C.muted) }
                Text(buildAnnotatedString {
                    append(r.values)
                    withStyle(SpanStyle(color = C.muted)) { append(" per day") }
                }, color = C.text, fontSize = 13.sp)
            }
        }
        if (editing != null) TargetEditor(core, editing) { onEdit(null) }
    }
}

@Composable
private fun TargetEditor(core: Core, target: JsonObject, onClose: () -> Unit) {
    val start by produceState<TargetEditorView?>(null, target) { value = runCatching { core.get(TargetEditorView.serializer(), "targetEditor", target) }.getOrNull() }
    val s = start ?: return
    var validFrom by remember(s) { mutableStateOf(s.validFrom) }
    // [key, minText, maxText], kept in nutrient-list order.
    var rows by remember(s) { mutableStateOf(s.rows) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    var focusKey by remember { mutableStateOf<String?>(null) }
    val requesters = remember { HashMap<String, FocusRequester>() }
    val scope = rememberCoroutineScope()
    val byKey = s.nutrients.associateBy { it.key }
    val order = s.nutrients.map { it.key }
    fun setCell(i: Int, j: Int, v: String) { rows = rows.mapIndexed { k, r -> if (k == i) r.mapIndexed { m, c -> if (m == j) v else c } else r } }
    fun save() = scope.launch {
        val r = runCatching { core.get(SaveReply.serializer(), "saveTarget", target, JsonPrimitive(validFrom), jsOf(rows)) }
            .getOrElse { SaveReply(alert = "Couldn't save: ${it.message}") }
        if (r.alert != null) ask = Asking(r.alert) else onClose()
    }
    val isNew = target["id"] == null
    SheetOverlay(onClose) {
        SheetTitle(s.title)
        Field("Valid from") { DateTimeBox(validFrom) { validFrom = it } }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Muted("per day", Modifier.weight(1f), size = 12.sp)
                Text("min", Modifier.width(84.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
                Text("max", Modifier.width(64.dp), color = C.muted, fontSize = 12.sp, textAlign = TextAlign.Center)
                Box(Modifier.width(34.dp))
            }
            rows.forEachIndexed { i, (k, minT, maxT) ->
                val n = byKey[k]
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(buildAnnotatedString {
                        append(n?.label ?: k)
                        withStyle(SpanStyle(color = C.muted, fontSize = 12.sp)) { append(" ${n?.unit ?: ""}") }
                    }, Modifier.weight(1f), color = C.text, fontSize = 14.sp)
                    val small = PaddingValues(horizontal = 12.dp, vertical = 9.dp)
                    val style = TextStyle(color = C.text, fontSize = 14.sp)
                    TextBox(minT, { setCell(i, 1, it) }, Modifier.width(84.dp), placeholder = "–", decimal = true, contentPadding = small, textStyle = style,
                        focusRequester = requesters.getOrPut(k) { FocusRequester() })
                    TextBox(maxT, { setCell(i, 2, it) }, Modifier.width(64.dp), placeholder = "–", decimal = true, contentPadding = small, textStyle = style)
                    SmallIconButton("Remove ${n?.label ?: k}", { rows = rows.filterIndexed { j, _ -> j != i } }) { Text("×", color = C.text, fontSize = 18.sp) }
                }
            }
            NutrientAdder(s.nutrients.filter { n -> rows.none { it[0] == n.key } }) { key ->
                rows = (rows + listOf(listOf(key, "", ""))).sortedBy { order.indexOf(it[0]) }
                focusKey = key
            }
        }
        SheetActions("Save", { save() }, onClose, onDelete = if (isNew) null else ({
            ask = Asking("Delete this target?", "Delete") { scope.launch { runCatching { core.call("deleteTarget", target["id"]!!) }; onClose() } }
        }))
    }
    LaunchedEffect(focusKey, rows) {
        val k = focusKey ?: return@LaunchedEffect
        runCatching { requesters[k]?.requestFocus() }
        focusKey = null
    }
    ask?.Show { ask = null }
}
