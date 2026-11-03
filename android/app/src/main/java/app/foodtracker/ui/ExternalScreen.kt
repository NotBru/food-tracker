package app.foodtracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.OffSearchView
import app.foodtracker.get
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive

// "Search external", native: a port of app/src/screens/External.jsx (data: core.js offSearch, offPick). Searched on
// Enter; picking a result goes back to the food editor, prefilled (external.js's pending draft, as on the web).

private sealed interface OffState {
    data object Idle : OffState
    data object Loading : OffState
    data object Picking : OffState
    data class Failed(val message: String) : OffState
    data class Done(val view: OffSearchView) : OffState
}

@Composable
fun ExternalScreen(core: Core, initialQuery: String) {
    var query by remember { mutableStateOf(initialQuery) }
    var state by remember { mutableStateOf<OffState>(OffState.Idle) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    val button by produceState("Search", query) { value = runCatching { (core.call("offButton", JsonPrimitive(query)) as JsonPrimitive).content }.getOrDefault(value) }
    fun run() {
        if (query.isBlank() || state == OffState.Loading || state == OffState.Picking) return
        state = OffState.Loading
        scope.launch {
            state = try { OffState.Done(core.get(OffSearchView.serializer(), "offSearch", JsonPrimitive(query))) }
            catch (e: CancellationException) { throw e } catch (e: Exception) { OffState.Failed(e.message ?: "Couldn't search.") }
        }
    }
    fun pick(i: Int) {
        if (state == OffState.Picking) return
        state = OffState.Picking
        scope.launch { runCatching { core.call("offPick", JsonPrimitive(i)) }; core.back() }
    }
    ScreenFrame("Search Open Food Facts", onBack = core::back) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            TextBox(query, { query = it }, Modifier.weight(1f), placeholder = "Product name or barcode (all digits)…", focusRequester = focus, onDone = ::run)
            PillButton(button, ::run, enabled = query.isNotBlank() && state != OffState.Loading)
        }
        when (val s = state) {
            OffState.Loading -> Muted("Searching Open Food Facts…")
            OffState.Picking -> Muted("Loading the product…")
            is OffState.Failed -> Text(s.message, color = C.warn)
            is OffState.Done -> if (s.view.rows.isEmpty()) Muted(s.view.empty) else s.view.rows.forEachIndexed { i, r ->
                ListCard({ pick(i) }) {
                    MainLine(r.name, r.per)
                    r.subtitle?.let { Muted(it, size = 13.sp) }
                    MacroText(r.macros)
                }
            }
            OffState.Idle -> {}
        }
        Text(buildAnnotatedString {
            append("Data: ")
            withLink(LinkAnnotation.Url("https://world.openfoodfacts.org/", TextLinkStyles(SpanStyle(color = C.accent)))) { append("Open Food Facts") }
            append(", community-made, ODbL. Values per 100 g/ml as on the label; check them against your pack.")
        }, color = C.muted, fontSize = 13.sp)
    }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
}
