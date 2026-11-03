package app.foodtracker.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.BackupConflict
import app.foodtracker.BackupReply
import app.foodtracker.BackupSecret
import app.foodtracker.BackupView
import app.foodtracker.Core
import app.foodtracker.SyncStatus
import app.foodtracker.get
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive

// Backup, native: a port of app/src/screens/Backup.jsx (data and actions: core.js backup…, over app/src/backup.js).
// The state lives in the web app (not in its database): read again whenever the sync status changes, and after
// each action.

@Composable
fun BackupScreen(core: Core, sync: SyncStatus?, linked: String?) {
    var refresh by remember { mutableIntStateOf(0) }
    val view by produceState<BackupView?>(null, sync, refresh) { value = runCatching { core.get(BackupView.serializer(), "backup") }.getOrNull() ?: value }
    var busy by remember { mutableStateOf(false) }
    var invite by remember { mutableStateOf("") }
    var pasted by remember { mutableStateOf(linked ?: "") }
    var secret by remember { mutableStateOf<BackupSecret?>(null) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    // A scanned link carries the secret in the address: kept in the box only, not in the history.
    LaunchedEffect(linked) { if (linked != null) core.replace("/backup") }

    fun act(name: String, vararg args: JsonElement, then: suspend (BackupReply) -> Unit = {}) = scope.launch {
        busy = true
        val r = runCatching { core.get(BackupReply.serializer(), name, *args) }.getOrElse { BackupReply(alert = it.message) }
        busy = false
        refresh++
        if (r.alert != null) ask = Asking(r.alert) else then(r)
    }
    suspend fun showSecret() { secret = runCatching { core.get(BackupSecret.serializer().nullable, "backupSecret") }.getOrNull() }
    // Restoring: fetch (checks the secret, says from when), confirm (switching secrets first, if so), restore.
    fun restore(text: String?) = act("backupFetch", text?.let { JsonPrimitive(it) } ?: JsonNull) { r ->
        val go = Asking(r.confirm ?: "", "Restore", danger = true) {
            act("backupRestore") { done -> pasted = ""; secret = null; done.done?.let { ask = Asking(it) } }
        }
        ask = if (r.switching) Asking("This device is backed up under another secret. It will switch to this one (the old backup stays on the server). Continue?", "Continue") { ask = go } else go
    }

    ScreenFrame("Backup", onBack = core::back, gap = 14.dp) {
        val v = view ?: return@ScreenFrame
        val restoreSection: @Composable () -> Unit = {
            Field(if (v.on) "Restore a backup from another secret" else "Restore a backup from another device") {
                Muted("On the other device, open Backup and show its secret. Scan the QR with this phone's camera, or paste the secret or link here.", size = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextBox(pasted, { pasted = it }, Modifier.weight(1f), placeholder = "Secret or link", capitalize = false)
                    PillButton("Restore", { restore(pasted) }, enabled = !busy && pasted.isNotBlank(), bg = C.panel, fg = C.text)
                }
            }
        }
        if (!v.on) {
            Muted("The data is encrypted on this device before it's sent, so the server can't read it. The secret that unlocks it stays on your devices only: lose them all without a copy of the secret and the backup is lost too.", size = 13.sp)
            Field("Back up this device (a invite code lets you start)") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextBox(invite, { invite = it }, Modifier.weight(1f), placeholder = "Invite code", capitalize = false)
                    PillButton("Start", { act("backupStart", JsonPrimitive(invite)) { showSecret() } }, enabled = !busy && invite.isNotBlank())
                }
            }
            restoreSection()
            ask?.Show { ask = null }
            return@ScreenFrame
        }
        Text(buildAnnotatedString {
            withStyle(SpanStyle(color = if (v.synced) C.text else C.warn)) { append(v.status ?: "") }
            withStyle(SpanStyle(color = C.muted)) {
                append(" It syncs by itself with the other devices on this secret while the app is open: a few seconds after a change, every 15 minutes, and when you come back to the app.")
            }
        }, fontSize = 13.sp)
        v.inbox?.let { Muted(it, size = 13.sp) }
        if (v.conflicts > 0) Conflicts(core, v, refresh, busy) { i, side -> act("backupResolve", JsonPrimitive(i), JsonPrimitive(side)) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PillButton("Sync now", { act("backupSync") }, enabled = !busy && v.conflicts == 0)
            PillButton("Restore", { restore(null) }, enabled = !busy, bg = C.panel, fg = C.text)
        }
        Field("Secret") {
            Muted("Anyone with it can read and replace this backup. Keep a copy somewhere safe, and use it to restore on another device.", size = 13.sp)
            val s = secret
            if (s != null) {
                Qr(s.qr, Modifier.align(Alignment.CenterHorizontally))
                Text(s.secret, color = C.text, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PillButton("Copy", {
                        (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Backup secret", s.secret))
                        ask = Asking("Copied.")
                    }, bg = C.panel, fg = C.text)
                    PillButton("Hide", { secret = null }, bg = C.panel, fg = C.text)
                }
            } else Row { PillButton("Show secret", { scope.launch { showSecret() } }, bg = C.panel, fg = C.text) }
        }
        Field("Change the secret (if it got out)") {
            Muted("Moves the backup to a new secret, with this device's data. The old one stops working on every device; show the new one to your other devices.", size = 13.sp)
            Row {
                PillButton("Change the secret", {
                    ask = Asking("Change the secret? The old one stops working on every device that has it.", "Change") { act("backupChangeSecret") { showSecret() } }
                }, enabled = !busy, bg = C.panel, fg = C.text)
            }
        }
        restoreSection()
        Field("Stop backing up this device") {
            Muted("Forgets the secret here; the backup stays on the server.", size = 13.sp)
            Row {
                PillButton("Forget the secret", {
                    ask = Asking("Forget the secret on this device? Without a copy of it, the backup can't be restored.", "Forget") { act("backupForget") { secret = null } }
                }, enabled = !busy, bg = C.panel, fg = C.text)
            }
        }
        ask?.Show { ask = null }
    }
}

/** Backup.jsx Conflicts: each row changed differently on two devices, both versions, a button for each. */
@Composable
private fun Conflicts(core: Core, v: BackupView, refresh: Int, busy: Boolean, onPick: (Int, String) -> Unit) {
    val list by produceState(emptyList<BackupConflict>(), v.conflicts, refresh) {
        value = runCatching { core.get(ListSerializer(BackupConflict.serializer()), "backupConflicts") }.getOrDefault(value)
    }
    var label by remember(v.conflictLabel) { mutableStateOf(v.conflictLabel) }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Merge conflicts", color = C.conflict, fontWeight = FontWeight.Bold)
        Muted("Changed differently on this device and another one since they last synced. Pick which to keep; syncing waits until all are picked.", size = 13.sp)
        list.forEachIndexed { i, c ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(C.panel).padding(horizontal = 14.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(c.title) }
                    append(" ${c.label}")
                }, color = C.text)
                for (f in c.fields) Text(buildAnnotatedString {
                    withStyle(SpanStyle(color = C.muted)) { append("${f.name}: ") }
                    append("here ${f.here} · other device ${f.there}")
                }, color = C.text, fontSize = 13.sp)
                c.note?.let { Muted(it, size = 13.sp) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PillButton("Keep this device's", { onPick(i, "local") }, enabled = !busy, bg = C.bg, fg = C.text, fontSize = 14.sp, padding = PaddingValues(horizontal = 14.dp, vertical = 10.dp))
                    PillButton("Keep the other device's", { onPick(i, "cloud") }, enabled = !busy, bg = C.bg, fg = C.text, fontSize = 14.sp, padding = PaddingValues(horizontal = 14.dp, vertical = 10.dp))
                }
            }
        }
        SwitchRow("\"Merge conflict\" beside the sync icon", "Off, a merge conflict shows only as the sync icon turning violet (on the homescreen); tap it to come here.", label) {
            label = it
            scope.launch { runCatching { core.call("backupConflictLabel", JsonPrimitive(it)) } }
        }
    }
}

/** Backup.jsx Qr: black on white with a quiet zone of 4 modules, 240 dp. */
@Composable
private fun Qr(rows: List<String>, modifier: Modifier = Modifier) {
    Box(modifier.size(240.dp).clip(RoundedCornerShape(12.dp)).background(Color.White)) {
        Canvas(Modifier.size(240.dp)) {
            val n = rows.size + 8
            val m = size.width / n
            rows.forEachIndexed { r, row ->
                row.forEachIndexed { c, ch -> if (ch == '1') drawRect(Color.Black, Offset((c + 4) * m, (r + 4) * m), Size(m + 0.5f, m + 0.5f)) }
            }
        }
    }
}
