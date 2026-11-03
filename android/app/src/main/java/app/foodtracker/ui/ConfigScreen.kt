package app.foodtracker.ui

import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.foodtracker.ConfigView
import app.foodtracker.Core
import app.foodtracker.SaveReply
import app.foodtracker.bool
import app.foodtracker.get
import app.foodtracker.str
import app.foodtracker.with
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

// Config, native: a port of app/src/screens/Config.jsx (data: core.js config; saving: app/src/forms.js). The form is
// the web app's (forms.js configForm), edited by key.

private val SWITCHES = listOf(
    Triple("onlyTargets", "Dashboard: only nutrients with a target", "Off: calories, protein, fat and carbs are always shown, with or without a target."),
    Triple("adjGhost", "Ghost of the uncapped calorie bar", "Where the bar would be with no correction caps, drawn faintly over the capped one."),
    Triple("showVersion", "App version", "When this version of the app was built (YYYYMMDDHHmm, local time), beside the backup icon on the homescreen."),
)

@Composable
fun ConfigScreen(core: Core) {
    val start by produceState<ConfigView?>(null) { value = runCatching { core.get(ConfigView.serializer(), "config") }.getOrNull() }
    ScreenFrame("Config", onBack = core::back, gap = 14.dp) {
        val s = start ?: return@ScreenFrame
        var form by remember(s) { mutableStateOf(s.form) }
        var ask by remember { mutableStateOf<Asking?>(null) }
        val scope = rememberCoroutineScope()
        val context = LocalContext.current
        fun set(key: String, v: Any?) { form = form.with(key, v) }
        fun save() = scope.launch {
            val r = runCatching { core.get(SaveReply.serializer(), "saveConfig", form) }.getOrElse { SaveReply(alert = "Couldn't save: ${it.message}") }
            if (r.alert != null) ask = Asking(r.alert) else core.back()
        }
        Field("Encrypted backup to the server") {
            Row { PillButton("Backup", { core.go("/backup") }, bg = C.panel, fg = C.text) }
        }
        Field("Day starts at (meals before this count for the previous day)") {
            val t = form.str("dayStart")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PillButton(t.ifEmpty { "--:--" }, {
                    val (h, m) = t.split(':').let { (it.getOrNull(0)?.toIntOrNull() ?: 4) to (it.getOrNull(1)?.toIntOrNull() ?: 0) }
                    TimePickerDialog(context, { _, hh, mm -> set("dayStart", "%02d:%02d".format(hh, mm)) }, h, m, true).show()
                }, bg = C.panel, fg = C.text)
            }
        }
        Field("Dashboard style") {
            val opts = listOf("gauges" to "Gauges", "bars" to "Bars")
            Segmented(opts.map { it.second }, opts.indexOfFirst { it.first == form.str("dashboard") }, { set("dashboard", opts[it].first) })
        }
        Field("Error intervals hold (% of the probability)") {
            TextBox(form.str("coverage"), { set("coverage", it) }, placeholder = s.placeholders["coverage"], decimal = true)
        }
        Field("7-day calorie correction: each bound moves at most (kcal)") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Field("Min", Modifier.weight(1f)) { TextBox(form.str("capMin"), { set("capMin", it) }, placeholder = s.placeholders["capMin"], decimal = true) }
                Field("Max", Modifier.weight(1f)) { TextBox(form.str("capMax"), { set("capMax", it) }, placeholder = s.placeholders["capMax"], decimal = true, onDone = { save() }) }
            }
        }
        SwitchPanel { for ((key, title, about) in SWITCHES) SwitchItem(title, about, form.bool(key)) { set(key, it) } }
        Field("Reference databases (their generic foods are listed with yours)") {
            SwitchPanel { for (r in s.references) SwitchItem(r.name, r.about, form.bool(r.key)) { set(r.key, it) } }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { PillButton("Save", { save() }) }
        ask?.Show { ask = null }
    }
}

