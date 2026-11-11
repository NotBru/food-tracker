package app.foodtracker

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.webkit.ValueCallback
import android.webkit.WebChromeClient.FileChooserParams
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import app.foodtracker.ui.FoodTheme
import app.foodtracker.ui.PickedFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File

/**
 * The app: the web app's engine (a WebView, [Engine]) under native screens ([App]). Also does for the web app what a
 * browser would: back, links, picking files and taking pictures, saving a file.
 */
class MainActivity : ComponentActivity() {
    lateinit var engine: Engine
    private val json = Json { ignoreUnknownKeys = true }

    /** Import databases: the file picked, until merge or replace is chosen. */
    val importing = MutableStateFlow<PickedFile?>(null)
    private var exportText: String? = null

    // Pictures and files: for a web screen's file input, or a native screen (temp notes: camera or gallery).
    // `picked` gets what was picked, or null if nothing was.
    private var picked: ((Array<Uri>?) -> Unit)? = null
    private var shot: Uri? = null
    private fun deliver(uris: Array<Uri>?) {
        val f = picked
        picked = null
        f?.invoke(uris?.takeIf { it.isNotEmpty() })
    }
    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok -> deliver(if (ok) shot?.let { arrayOf(it) } else null) }
    private val pickMany = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris -> deliver(uris.toTypedArray()) }
    private val pickOne = registerForActivityResult(ActivityResultContracts.GetContent()) { uri -> deliver(uri?.let { arrayOf(it) }) }

    /** A picture from the camera, or (`camera` false) any number from the gallery: [(address the web app can fetch,
     * file name)], empty if none. */
    fun pickPictures(camera: Boolean, onPicked: (List<Pair<String, String>>) -> Unit) {
        deliver(null)
        picked = { uris -> onPicked(uris.orEmpty().map { engine.serve(it) to (displayName(it) ?: "picture.jpg") }) }
        runCatching { if (camera) launchCamera() else pickMany.launch("image/*") }
            .onFailure { picked = null; toast("Can't open a picker: ${it.message}") }
    }

    private fun launchCamera() {
        val dir = File(cacheDir, "pictures").apply { mkdirs() }
        // Earlier shots: the web app has its own copy by now (shrunk, in its database).
        dir.listFiles()?.forEach { it.delete() }
        val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
        shot = FileProvider.getUriForFile(this, "app.foodtracker.files", file)
        takePicture.launch(shot!!)
    }

    private val openImport = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) lifecycleScope.launch {
            runCatching {
                val text = withContext(Dispatchers.IO) { contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() } }
                importing.value = PickedFile(displayName(uri) ?: "file", text)
            }.onFailure { toast("Couldn't read the file: ${it.message}") }
        }
    }
    private val saveExport = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val text = exportText
        exportText = null
        if (uri != null && text != null) lifecycleScope.launch {
            runCatching { withContext(Dispatchers.IO) { contentResolver.openOutputStream(uri)!!.use { it.write(text.toByteArray()) } } }
                .onSuccess { toast("Exported.") }
                .onFailure { toast("Export failed: ${it.message}") }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Edge to edge on every Android version (15 enforces it), light bar icons over the app's dark background;
        // App keeps the content clear of the bars.
        enableEdgeToEdge(SystemBarStyle.dark(android.graphics.Color.TRANSPARENT), SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
        engine = Engine(this)
        engine.onFileChooser = ::chooseFiles
        engine.onGone = { recreate() }
        engine.onExit = { finish() }
        engine.load(linkOf(intent) ?: "$ORIGIN/")
        SyncJob.sync = engine.sync
        // Back goes back through the web app's routes; from the first one, out of the app (Engine.back).
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = engine.back()
        })
        setContent { FoodTheme { App(this) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // A link to the web app (the backup secret's QR link): to its route, without reloading.
        linkOf(intent)?.let { url -> engine.go(Uri.parse(url).fragment?.ifEmpty { null } ?: "/") }
    }

    override fun onResume() {
        super.onResume()
        engine.resume()
    }

    /** Out of sight: the web app syncs; the app stays up until it's done (SyncJob). */
    override fun onStop() {
        super.onStop()
        val state = engine.sync.value?.state
        if (state != null && state != "off") SyncJob.schedule(this)
    }

    override fun onDestroy() {
        SyncJob.sync = null
        engine.webView.destroy()
        super.onDestroy()
    }

    private fun linkOf(intent: Intent?): String? =
        intent?.data?.takeIf { intent.action == Intent.ACTION_VIEW && it.host == HOST }?.toString()

    fun export() = lifecycleScope.launch {
        runCatching { json.decodeFromJsonElement(ExportFile.serializer(), engine.call("exportFile")) }
            .onSuccess {
                exportText = it.text
                saveExport.launch(it.name)
            }
            .onFailure { toast("Export failed: ${it.message}") }
    }

    fun pickImport() = openImport.launch(arrayOf("application/json", "text/plain", "application/octet-stream"))

    private fun chooseFiles(callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
        deliver(null)
        picked = { callback.onReceiveValue(it) }
        val type = params.acceptTypes.firstOrNull { it.isNotBlank() } ?: "*/*"
        return runCatching {
            when {
                params.isCaptureEnabled -> launchCamera()
                params.mode == FileChooserParams.MODE_OPEN_MULTIPLE -> pickMany.launch(type)
                else -> pickOne.launch(type)
            }
            true
        }.getOrElse {
            picked = null
            toast("Can't open a picker: ${it.message}")
            false
        }
    }

    private fun displayName(uri: Uri): String? =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }

    fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
}
