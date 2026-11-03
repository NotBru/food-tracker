package app.foodtracker.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.Path

/** The web app's colours (app/src/styles.css :root), so native and web screens look alike. */
object C {
    val bg = Color(0xFF111418)
    val panel = Color(0xFF1B2027)
    val panel2 = Color(0xFF232A33)
    val line = Color(0xFF2B323C)
    val text = Color(0xFFE6EDF3)
    val muted = Color(0xFF8B949E)
    val accent = Color(0xFF58A6FF)
    val prot = Color(0xFFFF7B72)
    val carb = Color(0xFFFFA657)
    val fat = Color(0xFFD2A8FF)
    val kcal = Color(0xFF7EE787)
    val warn = Color(0xFFF2CC60)
    val range = Color(0xFF56D4DD)
    val mustard = Color(0xFFD9A42B)
    val conflict = Color(0xFFA371F7)
    val danger = Color(0xFFDA3633)
    val onAccent = Color(0xFF0B0F14)

    /** A dashboard value's colour by its class (c-kcal, c-prot, c-fat, c-carb). */
    fun ofClass(cls: String) = when (cls) {
        "c-kcal" -> kcal
        "c-prot" -> prot
        "c-fat" -> fat
        "c-carb" -> carb
        else -> text
    }

    /** A target's region (under, ok, over, none) or status. */
    fun ofRegion(r: String) = when (r) {
        "ok" -> kcal
        "under", "over" -> prot
        else -> muted
    }
}

@Composable
fun FoodTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = C.accent, onPrimary = C.onAccent, background = C.bg, onBackground = C.text,
            surface = C.panel, onSurface = C.text, surfaceVariant = C.panel2, onSurfaceVariant = C.muted,
        ),
        content = content,
    )
}

/** An SVG path's `d` (24×24 icons of the web app). */
fun svgPath(d: String): Path = PathParser().parsePathString(d).toPath()
