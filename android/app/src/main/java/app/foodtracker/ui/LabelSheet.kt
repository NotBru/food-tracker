package app.foodtracker.ui

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.LabelImage
import app.foodtracker.LabelPick
import app.foodtracker.LabelSheetView
import app.foodtracker.SelectOption
import app.foodtracker.get
import app.foodtracker.js
import app.foodtracker.jsOf
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.json.JsonPrimitive

// The nutrition label sheet (🖨 on a food's Info tab and a consumption's info), native: a port of
// app/src/screens/LabelSheet.jsx. Its choices come from core.js labelSheet, the image from labelImage (label.js draws
// it in the web app, as on the web); Save image writes the PNG where the phone's file picker says.

private val printer = svgPath("M7 9V4h10v5M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v6H7z")

/** components.jsx PrinterIcon, as a round top-bar button. */
@Composable
fun PrinterButton(onClick: () -> Unit) = RoundIconButton("Nutrition label", onClick) {
    Canvas(Modifier.size(20.dp)) {
        scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) {
            drawPath(printer, C.text, style = Stroke(width = 2.5f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

/**
 * The label sheet for food `itemId`. `logId`: the consumption it was opened from (it starts at what was eaten);
 * `perText`, `perUnit`: the Info tab's amount (it starts there otherwise).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LabelSheet(core: Core, itemId: String, logId: String?, perText: String, perUnit: String, onClose: () -> Unit) {
    val view by produceState<LabelSheetView?>(null, itemId, logId) {
        value = runCatching {
            core.get(LabelSheetView.serializer().nullable, "labelSheet", JsonPrimitive(itemId), jsOf(logId), JsonPrimitive(perText), JsonPrimitive(perUnit))
        }.getOrNull()
    }
    val v = view ?: return
    var pick by remember(v) { mutableStateOf(v.start) }
    fun set(text: String = pick.text, unit: String = pick.unit) { pick = LabelPick("custom", text, unit) }
    val image by produceState<Pair<LabelImage, ImageBitmap>?>(null, pick) {
        value = runCatching {
            core.get(LabelImage.serializer().nullable, "labelImage", JsonPrimitive(itemId), jsOf(logId), js("key" to pick.key, "text" to pick.text, "unit" to pick.unit))
        }.getOrNull()?.let { img ->
            val bytes = Base64.decode(img.png, Base64.DEFAULT)
            img to BitmapFactory.decodeByteArray(bytes, 0, bytes.size).asImageBitmap()
        }
    }
    val context = LocalContext.current
    var saving by remember { mutableStateOf<ByteArray?>(null) }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { uri ->
        val bytes = saving
        saving = null
        if (uri != null && bytes != null) context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
    }
    SheetOverlay(onClose) {
        SheetTitle("Nutrition label")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (p in v.presets) {
                val on = pick.key == p.key
                PillButton(p.label, { pick = p }, bg = if (on) C.accent else C.panel, fg = if (on) C.onAccent else C.text,
                    padding = PaddingValues(horizontal = 14.dp, vertical = 8.dp), fontSize = 14.sp)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Muted("per", size = 16.sp)
            TextBox(pick.text, { set(text = it) }, Modifier.weight(0.45f), decimal = true)
            Box(Modifier.weight(1f)) { SelectBox(pick.unit, v.units.map { SelectOption(it, it) }, pick.unit, { set(unit = it) }, searchable = false) }
        }
        val shown = image
        if (shown != null) {
            val (_, bmp) = shown
            Image(bmp, "Nutrition label", Modifier.align(Alignment.CenterHorizontally).widthIn(max = 420.dp).fillMaxWidth()
                .aspectRatio(bmp.width.toFloat() / bmp.height).clip(RoundedCornerShape(12.dp)).border(1.dp, C.line, RoundedCornerShape(12.dp)))
        } else Muted("Type an amount.", size = 13.sp)
        SheetActions("Save image", {
            val (img) = shown ?: return@SheetActions
            saving = Base64.decode(img.png, Base64.DEFAULT)
            save.launch(img.name)
        }, onClose, enabled = shown != null)
    }
}
