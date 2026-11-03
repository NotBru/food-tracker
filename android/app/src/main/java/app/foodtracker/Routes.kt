package app.foodtracker

import java.net.URLDecoder

/** A route of the web app's router: "/consumptions?day=2026-11-01" → path "/consumptions", query {day}. */
data class Route(val path: String, val query: Map<String, String>) {
    companion object {
        fun parse(route: String): Route {
            val (path, qs) = route.split('?', limit = 2).let { it[0].ifEmpty { "/" } to it.getOrElse(1) { "" } }
            val query = qs.split('&').filter { it.isNotEmpty() }.associate { kv ->
                val (k, v) = kv.split('=', limit = 2).let { it[0] to it.getOrElse(1) { "" } }
                URLDecoder.decode(k, "UTF-8") to URLDecoder.decode(v, "UTF-8")
            }
            return Route(path, query)
        }
    }
}

/** Which routes have a native screen; the others are the web app's own (in the WebView under them). */
object Routes {
    /** Paths with a native screen; ":x" stands for any one part ("/consumptions/:id"). */
    val native = listOf("/", "/consumptions", "/consumptions/:id", "/notes", "/foods", "/foods/:id", "/targets", "/body", "/users", "/config", "/foods/external", "/explore/:id")

    private val patterns = native.map { p -> Regex("^" + p.split('/').joinToString("/") { if (it.startsWith(":")) "[^/]+" else Regex.escape(it) } + "$") }

    fun isNative(path: String) = path.split('?')[0].ifEmpty { "/" }.let { p -> patterns.any { it.matches(p) } }
}
