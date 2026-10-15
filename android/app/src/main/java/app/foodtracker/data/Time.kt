package app.foodtracker.data

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.TemporalAdjusters

// "Logical day": with dayStart = 05:00, a meal at 02:00 on the 16th belongs to the 15th. Port of time.js.
// Datetimes are stored like the web app's `toISOString()`: UTC with milliseconds, so they compare as strings.

private val ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

fun zone(): ZoneId = ZoneId.systemDefault()
fun isoOf(instant: Instant): String = ISO.format(instant)
fun isoOf(local: LocalDateTime): String = isoOf(local.atZone(zone()).toInstant())
fun nowIso(): String = isoOf(Instant.now())
fun instantOf(iso: String): Instant = Instant.parse(iso)
fun localOf(iso: String): LocalDateTime = LocalDateTime.ofInstant(instantOf(iso), zone())

fun offsetMinutes(dayStart: String): Int {
    val parts = dayStart.split(":")
    return (parts.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0)
}

fun logicalDay(iso: String, dayStart: String): LocalDate =
    localOf(iso).minusMinutes(offsetMinutes(dayStart).toLong()).toLocalDate()

fun today(dayStart: String): LocalDate =
    LocalDateTime.now(zone()).minusMinutes(offsetMinutes(dayStart).toLong()).toLocalDate()

/** Real-time [start, end) of a logical day, as ISO strings. */
fun dayBounds(day: LocalDate, dayStart: String): Pair<String, String> {
    val start = day.atStartOfDay().plusMinutes(offsetMinutes(dayStart).toLong())
    return isoOf(start) to isoOf(start.plusDays(1))
}

enum class Window { Daily, Weekly, Monthly }

/** Logical days [first, last] of the window containing `day`. Weeks start on Monday. */
fun windowDays(win: Window, day: LocalDate): Pair<LocalDate, LocalDate> = when (win) {
    Window.Daily -> day to day
    Window.Weekly -> day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).let { it to it.plusDays(6) }
    Window.Monthly -> day.withDayOfMonth(1) to day.with(TemporalAdjusters.lastDayOfMonth())
}

private val PRETTY_DAY = DateTimeFormatter.ofPattern("EEE, d MMM yyyy")
private val SHORT_DAY = DateTimeFormatter.ofPattern("MM-dd")
private val MONTH = DateTimeFormatter.ofPattern("MMMM yyyy")
private val TIME = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)
private val DATE_TIME = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
private val SHORT_DATE_TIME = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT)

fun prettyDay(day: LocalDate): String = PRETTY_DAY.format(day)
fun shortDay(day: LocalDate): String = SHORT_DAY.format(day)
fun monthName(day: LocalDate): String = MONTH.format(day)
fun timeLabel(iso: String): String = TIME.format(localOf(iso))
fun dateTimeLabel(iso: String): String = DATE_TIME.format(localOf(iso))
fun shortDateTimeLabel(iso: String): String = SHORT_DATE_TIME.format(localOf(iso))

/** Local date and time to the second, for export file names (no ":" since it isn't allowed everywhere). */
fun fileStamp(now: LocalDateTime = LocalDateTime.now()): String =
    DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss").format(now)

fun parseTime(s: String): LocalTime? = runCatching { LocalTime.parse(s) }.getOrNull()
