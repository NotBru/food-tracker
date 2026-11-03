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

    // A web screen's file input (temp notes: camera or gallery).
    private var chooser: ValueCallback<Array<Uri>>? = null
    private var shot: Uri? = null
    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        chooser?.onReceiveValue(if (ok) shot?.let { arrayOf(it) } else null)
        chooser = null
    }
    private val pickMany = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        chooser?.onReceiveValue(uris.toTypedArray().takeIf { it.isNotEmpty() })
        chooser = null
    }
    private val pickOne = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        chooser?.onReceiveValue(uri?.let { arrayOf(it) })
        chooser = null
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

    override fun onDestroy() {
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
        chooser?.onReceiveValue(null)
        chooser = callback
        val type = params.acceptTypes.firstOrNull { it.isNotBlank() } ?: "*/*"
        return runCatching {
            when {
                params.isCaptureEnabled -> {
                    val dir = File(cacheDir, "pictures").apply { mkdirs() }
                    dir.listFiles()?.forEach { it.delete() } // earlier shots: the web app has its own copy by now
                    val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
                    shot = FileProvider.getUriForFile(this, "app.foodtracker.files", file)
                    takePicture.launch(shot!!)
                }
                params.mode == FileChooserParams.MODE_OPEN_MULTIPLE -> pickMany.launch(type)
                else -> pickOne.launch(type)
            }
            true
        }.getOrElse {
            chooser = null
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
