package app.foodtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

// Buttons and bits in the web app's style (app/src/styles.css): pills, round icon buttons, chevrons.

val Pill = RoundedCornerShape(999.dp)

/** A pill button: accent by default (the web's `button`), or any colours (secondary: panel and text). */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    bg: Color = C.accent,
    fg: Color = C.onAccent,
    enabled: Boolean = true,
    padding: PaddingValues = PaddingValues(horizontal = 22.dp, vertical = 12.dp),
    fontSize: TextUnit = 16.sp,
    weight: FontWeight = FontWeight.SemiBold,
    outline: Color? = null,
    content: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(
        modifier
            .alpha(if (enabled) 1f else 0.35f)
            .clip(Pill)
            .background(bg)
            .let { if (outline != null) it.border(1.dp, outline, Pill) else it }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(padding),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (content != null) content() else Text(text, color = fg, fontSize = fontSize, fontWeight = weight, maxLines = 1)
    }
}

/** The web's `button.icon`: a 40 dp round panel button holding an icon. */
@Composable
fun RoundIconButton(label: String, onClick: () -> Unit, enabled: Boolean = true, icon: @Composable () -> Unit) {
    Box(
        Modifier
            .size(40.dp)
            .alpha(if (enabled) 1f else 0.35f)
            .clip(CircleShape)
            .background(C.panel)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { icon() }
}

private val chevronLeft = svgPath("M14.5 5.5 8 12l6.5 6.5")

/** ‹ (left) or › (right, `rotation` 180), as components.jsx Chevron: a 24-unit path, round joins. */
@Composable
fun Chevron(color: Color = C.text, size: Dp = 20.dp, rotation: Float = 0f) {
    Canvas(Modifier.size(size).rotate(rotation)) {
        scale(this.size.width / 24f, this.size.height / 24f, pivot = androidx.compose.ui.geometry.Offset.Zero) {
            drawPath(chevronLeft, color, style = Stroke(width = 2.2f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

/** A bottom sheet in the web's style (`.modal` + `.sheet`): dimmed backdrop, rounded top. Tapping outside closes. */
@Composable
fun Sheet(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(32.dp))
                .background(C.bg)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) { content() }
    }
}

/** An alert or a confirmation (the web's alert/confirm), in the same style. */
@Composable
fun Ask(text: String, onDismiss: () -> Unit, confirm: String? = null, danger: Boolean = false, onCancel: () -> Unit = {}, onConfirm: () -> Unit = {}) {
    Sheet({ onDismiss(); onCancel() }) {
        Text(text, color = C.text, fontSize = 16.sp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
            if (confirm != null) {
                PillButton("Cancel", { onDismiss(); onCancel() }, bg = C.panel, fg = C.text)
                PillButton(confirm, { onDismiss(); onConfirm() }, bg = if (danger) C.danger else C.accent, fg = if (danger) Color.White else C.onAccent)
            } else PillButton("OK", onDismiss)
        }
    }
}

/** Muted small text, the web's `.muted.small`. */
@Composable
fun Muted(text: String, modifier: Modifier = Modifier, size: TextUnit = 14.sp) = Text(text, modifier, color = C.muted, fontSize = size)
