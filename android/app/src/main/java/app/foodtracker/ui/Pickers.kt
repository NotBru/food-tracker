package app.foodtracker.ui

import android.text.format.DateFormat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.data.prettyDay
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

// The DatePicker works in UTC millis at midnight.
private fun LocalDate.utcMillis() = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
private fun localDateOf(millis: Long) = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerPopup(day: LocalDate, onPick: (LocalDate) -> Unit, onDismiss: () -> Unit) {
    val state = rememberDatePickerState(initialSelectedDateMillis = day.utcMillis())
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { state.selectedDateMillis?.let { onPick(localDateOf(it)) }; onDismiss() }) { Text("OK", color = C.accent) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = C.muted) } },
        colors = DatePickerDefaults.colors(containerColor = C.panel),
    ) { DatePicker(state, colors = DatePickerDefaults.colors(containerColor = C.panel)) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerPopup(time: LocalTime, onPick: (LocalTime) -> Unit, onDismiss: () -> Unit) {
    val state = rememberTimePickerState(time.hour, time.minute, DateFormat.is24HourFormat(LocalContext.current))
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = C.panel,
        text = { TimePicker(state) },
        confirmButton = { TextButton(onClick = { onPick(LocalTime.of(state.hour, state.minute)); onDismiss() }) { Text("OK", color = C.accent) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = C.muted) } },
    )
}

private val TIME = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

/** Pill showing a date; tap to pick. */
@Composable
fun DateButton(day: LocalDate, onChange: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    PillButton(prettyDay(day), { open = true }, modifier, Look.Secondary)
    if (open) DatePickerPopup(day, onChange) { open = false }
}

@Composable
fun TimeButton(time: LocalTime, onChange: (LocalTime) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    PillButton(TIME.format(time), { open = true }, modifier, Look.Secondary)
    if (open) TimePickerPopup(time, onChange) { open = false }
}

/** Date and time as two pills (the web app's datetime-local input). */
@Composable
fun DateTimeField(value: LocalDateTime, onChange: (LocalDateTime) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DateButton(value.toLocalDate(), { onChange(it.atTime(value.toLocalTime())) }, Modifier.weight(1.6f))
        TimeButton(value.toLocalTime(), { onChange(value.toLocalDate().atTime(it)) }, Modifier.weight(1f))
    }
}

/** Bottom sheet for an editor (consumption, target, user), like the web app's modal sheet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorSheet(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = C.bg,
        scrimColor = C.scrim,
    ) {
        Column(
            Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = C.text)
            content()
        }
    }
}
