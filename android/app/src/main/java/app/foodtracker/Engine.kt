package app.foodtracker

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.IOException
import java.util.UUID

/** The web app's address. Its own files are served from the APK (assets/web/); /backup/ and /off-search/ are live. */
const val HOST = "track-shit.notbru.xyz"
const val ORIGIN = "https://$HOST"

class EngineError(message: String) : Exception(message)

/**
 * The web app, running in a WebView: the engine under the native screens (its data, calculations and sync are the
 * only copy), and the screens not ported yet, which it draws itself. See docs/execution/2026-11-03-native-ui.md and
 * app/src/native/bridge.js for the other side.
 *
 * Its route (the URL's #) is the app's one navigation state: [route] follows it, and native screens move it with
 * [go], [replace] and [back]. [call] asks the web app's native/core.js for something once; [watch] again whenever
 * the data it reads changes.
 */
@SuppressLint("SetJavaScriptEnabled")
class Engine(private val context: Context) : Core {
    private val json = Json { ignoreUnknownKeys = true }
    private val main = Handler(Looper.getMainLooper())

    private val _route = MutableStateFlow("/")
    /** The current route, "path?query" as in the web app's #. "/" until the web app says otherwise. */
    val route: StateFlow<String> = _route
    private val _sync = MutableStateFlow<SyncStatus?>(null)
    /** The sync icon's state; null until the web app has started. */
    val sync: StateFlow<SyncStatus?> = _sync
    private val _ready = MutableStateFlow(false)
    val ready: StateFlow<Boolean> = _ready

    /** Asked to pick files for a web screen (temp notes' camera and gallery). Returns false if it can't. */
    var onFileChooser: ((ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean)? = null
    /** The web app's renderer died (out of memory, usually): the activity starts it again. */
    var onGone: (() -> Unit)? = null
    /** Back with no route to go back to: leave the app. */
    var onExit: (() -> Unit)? = null

    private val served = java.util.concurrent.ConcurrentHashMap<String, Uri>()

    /**
     * An address the web app can fetch `uri` from (a picture taken or picked for a native screen), so the file never
     * crosses the bridge as text.
     */
    fun serve(uri: Uri): String {
        val token = UUID.randomUUID().toString()
        served[token] = uri
        return "$ORIGIN/__native/file/$token"
    }

    private val replies = HashMap<String, CompletableDeferred<JsonElement>>()
    private val watches = HashMap<String, Pair<String, (JsonElement?, String?) -> Unit>>() // id -> (script, listener)
    private val waiting = ArrayList<String>() // scripts sent before the web app was ready

    val webView: WebView = WebView(context).apply {
        setBackgroundColor(android.graphics.Color.parseColor("#111418"))
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = true
        addJavascriptInterface(Bridge(), "NativeBridge")
        webViewClient = Client()
        webChromeClient = Chrome()
    }

    /** Opens the web app at `url` (its address, maybe with a #route). */
    fun load(url: String = "$ORIGIN/") {
        _ready.value = false
        webView.loadUrl(url)
    }

    override suspend fun call(name: String, vararg args: JsonElement): JsonElement {
        val id = UUID.randomUUID().toString()
        val reply = CompletableDeferred<JsonElement>()
        replies[id] = reply
        send("core.call(${str(id)}, ${str(name)}, ${JsonArray(args.toList())})")
        return reply.await()
    }

    fun watch(name: String, vararg args: JsonElement): Flow<JsonElement> = callbackFlow {
        val id = UUID.randomUUID().toString()
        val script = "core.watch(${str(id)}, ${str(name)}, ${JsonArray(args.toList())})"
        watches[id] = script to { value, error ->
            if (error != null) close(EngineError(error)) else trySend(value ?: JsonNull)
        }
        send(script)
        awaitClose {
            main.post {
                watches.remove(id)
                send("core.unwatch(${str(id)})")
            }
        }
    }

    override fun go(path: String) = send("core.go(${str(path)})")
    override fun replace(path: String) = send("core.replace(${str(path)})")
    /** A step back through the routes; [onExit] when there's none. Before the web app is up: [onExit] at once. */
    override fun back() {
        if (_ready.value) send("core.back()") else onExit?.invoke()
    }
    /** The app is in front again: the day may have changed while it slept. */
    fun resume() = send("core.resume()")

    private fun str(s: String) = JsonPrimitive(s).toString()

    private fun send(script: String) {
        if (_ready.value) webView.evaluateJavascript(script, null) else waiting += script
    }

    private fun receive(m: JsonObject) {
        val id = m["id"]?.jsonPrimitive?.contentOrNull
        when (m["type"]?.jsonPrimitive?.contentOrNull) {
            "reply" -> replies.remove(id)?.let { r ->
                if (m["ok"]?.jsonPrimitive?.contentOrNull == "true") r.complete(m["value"] ?: JsonNull)
                else r.completeExceptionally(EngineError(m["error"]?.jsonPrimitive?.contentOrNull ?: "Failed."))
            }
            "watch" -> watches[id]?.second?.invoke(m["value"], m["error"]?.jsonPrimitive?.contentOrNull)
            "exit" -> onExit?.invoke()
            "route" -> _route.value = m["path"]?.jsonPrimitive?.contentOrNull ?: "/"
            "sync" -> _sync.value = m["value"]?.let { json.decodeFromJsonElement(SyncStatus.serializer(), it) }
            "ready" -> {
                _route.value = m["path"]?.jsonPrimitive?.contentOrNull ?: "/"
                _sync.value = m["sync"]?.let { json.decodeFromJsonElement(SyncStatus.serializer(), it) }
                _ready.value = true
                // After a reload the page has forgotten what was watched: everything again, then what waited.
                for ((script, _) in watches.values) webView.evaluateJavascript(script, null)
                val scripts = waiting.filter { s -> watches.values.none { it.first == s } }
                waiting.clear()
                for (s in scripts) webView.evaluateJavascript(s, null)
            }
        }
    }

    /** What the web app sees as `window.NativeBridge` (native/bridge.js). Called on a WebView thread. */
    private inner class Bridge {
        @JavascriptInterface
        fun handles(path: String): Boolean = Routes.isNative(path)

        @JavascriptInterface
        fun post(message: String) {
            val m = runCatching { json.parseToJsonElement(message).jsonObject }.getOrNull() ?: return
            main.post { receive(m) }
        }
    }

    private inner class Client : WebViewClient() {
        /** The web app's own files from the APK, so it opens offline and matches these native screens. */
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url
            if (url.host != HOST || request.method != "GET") return null
            val path = url.path.orEmpty().ifEmpty { "/" }
            if (path.startsWith("/__native/file/")) {
                val uri = served[path.removePrefix("/__native/file/")] ?: return WebResourceResponse("text/plain", null, 404, "Gone", null, null)
                return runCatching {
                    WebResourceResponse(context.contentResolver.getType(uri) ?: "image/jpeg", null, context.contentResolver.openInputStream(uri))
                }.getOrNull()
            }
            if (path.startsWith("/backup/") || path.startsWith("/off-search/")) return null
            val asset = "web" + if (path == "/") "/index.html" else path
            return try {
                val type = mimeOf(asset)
                WebResourceResponse(type, if (type.startsWith("text/") || type.endsWith("json") || type.endsWith("javascript")) "utf-8" else null,
                    context.assets.open(asset))
            } catch (e: IOException) {
                null // not in the build: the network has it, or not
            }
        }

        /** Other sites (Open Food Facts' pages, links in texts) open in the browser. */
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (request.url.host == HOST) return false
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, request.url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            _ready.value = false
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            Log.w("Engine", "web renderer gone (crashed: ${detail.didCrash()})")
            onGone?.invoke()
            return true
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean =
            onFileChooser?.invoke(callback, params) ?: false

        override fun onConsoleMessage(m: ConsoleMessage): Boolean {
            Log.d("Engine", "${m.messageLevel()} ${m.message()} (${m.sourceId()}:${m.lineNumber()})")
            return true
        }
    }

    private fun mimeOf(name: String) = when (name.substringAfterLast('.', "")) {
        "html" -> "text/html"
        "js" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "webmanifest" -> "application/manifest+json"
        "png" -> "image/png"
        else -> "application/octet-stream"
    }
}
