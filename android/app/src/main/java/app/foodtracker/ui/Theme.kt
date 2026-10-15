package app.foodtracker.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import app.foodtracker.data.Status

// The web app's palette (styles.css :root). Dark only, like the web app.
object C {
    val bg = Color(0xFF111418)
    val panel = Color(0xFF1B2027)
    val panel2 = Color(0xFF232A33) // a touch lighter than panel, for frames inside panels
    val line = Color(0xFF2B323C)
    val text = Color(0xFFE6EDF3)
    val muted = Color(0xFF8B949E)
    val accent = Color(0xFF58A6FF)
    val onAccent = Color(0xFF0B0F14)
    val prot = Color(0xFFFF7B72)
    val carb = Color(0xFFFFA657)
    val fat = Color(0xFFD2A8FF)
    val kcal = Color(0xFF7EE787)
    val warn = Color(0xFFF2CC60)
    val danger = Color(0xFFDA3633)
    val scrim = Color(0xAA000000)

    /** Fill and tint colour of a target status: under min, within range, above max; grey without a target. */
    fun status(s: Status) = when (s) {
        Status.Under -> warn
        Status.Ok -> kcal
        Status.Over -> prot
        Status.None -> muted
    }

    /** A lighter solid shade, for the hatch lines of an error band. */
    fun lighter(c: Color) = lerp(c, Color.White, 0.4f)
}

@Composable
fun FoodTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = C.accent, onPrimary = C.onAccent, background = C.bg, onBackground = C.text,
            surface = C.bg, onSurface = C.text, surfaceVariant = C.panel, onSurfaceVariant = C.muted,
            surfaceContainer = C.panel, surfaceContainerHigh = C.panel, surfaceContainerHighest = C.panel2,
            surfaceContainerLow = C.bg, outline = C.line, error = C.danger,
        ),
        content = content,
    )
}
