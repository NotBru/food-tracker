package app.foodtracker.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.ConsumptionInfoView
import app.foodtracker.Core
import app.foodtracker.js

// A consumption's info screen, native: a port of app/src/screens/ConsumptionInfo.jsx (data: core.js consumptionInfo).
// ✎ opens the usual editor sheet over it; deleting it there goes back.

@Composable
fun ConsumptionInfoScreen(id: String, view: ConsumptionInfoView?, core: Core) {
    var editing by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize()) {
        if (view != null && !view.found) {
            ScreenFrame("Consumption", onBack = core::back) { Muted("Consumption not found (deleted?).", size = 16.sp) }
            return@Box
        }
        ScreenFrame(view?.title ?: "", view?.subtitle, onBack = core::back, gap = 6.dp, right = {
            RoundIconButton("Edit", { editing = true }) { Text("✎", color = C.text, fontSize = 20.sp) }
        }) {
            if (view == null) return@ScreenFrame
            InfoList(view.list, core::go)
            view.macros?.let { InfoCard { MacroText(it, 14.sp) } }
            Gap(12.dp)
            if (view.failed) Text("Some of it can't be computed (missing food or unit conversion).", color = C.warn, fontSize = 13.sp)
            H3("Energy by macro")
            view.energy?.let { EnergyChart(it) }
            H3("Nutrients")
            view.table?.let { NutrientTable(it) }
        }
        if (editing) ConsumptionEditorSheet(core, js("id" to id), onClose = { editing = false }, onDeleted = { editing = false; core.back() })
    }
}
