package app.foodtracker.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
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
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive

// "Search external", native: a port of app/src/screens/External.jsx (data: core.js offSearch, offPick). Searched on
// Enter; picking a result goes back to the food editor, prefilled (external.js's pending draft, as on the web). The
// barcode button scans a code with the camera (zxing-android-embedded's scanner screen; ScanSheet.jsx on the web) and
// looks it up.

private val barcode = svgPath("M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 8v8M11 8v8M13.5 8v8M16 8v8")

/** components.jsx BarcodeIcon, as a round button. */
@Composable
private fun BarcodeButton(onClick: () -> Unit) = RoundIconButton("Scan a barcode", onClick) {
    Canvas(Modifier.size(20.dp)) {
        scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) {
            drawPath(barcode, C.text, style = Stroke(width = 2.5f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

private val scanOptions get() = ScanOptions()
    .setDesiredBarcodeFormats(ScanOptions.EAN_13, ScanOptions.EAN_8, ScanOptions.UPC_A, ScanOptions.UPC_E)
    .setPrompt("Hold the bars across the line; it looks the code up once it reads it.")
    .setBeepEnabled(false)
    .setOrientationLocked(false)

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
    val scanner = rememberLauncherForActivityResult(ScanContract()) { r -> r.contents?.let { query = it; run() } }
    ScreenFrame("Search Open Food Facts", onBack = core::back) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            TextBox(query, { query = it }, Modifier.weight(1f), placeholder = "Product name or barcode (all digits)…", focusRequester = focus, onDone = ::run)
            BarcodeButton { scanner.launch(scanOptions) }
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
