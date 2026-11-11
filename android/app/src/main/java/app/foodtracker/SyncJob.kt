package app.foodtracker

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Keeps the app running in the background until the web app's sync is done. The web app syncs as it's hidden, but
 * Android freezes a backgrounded app within seconds, often mid-sync; while a job runs, it doesn't. So leaving the app
 * starts this one (expedited, where Android has those: it starts at once, without a notification), which holds on
 * while the sync icon says syncing or waiting, a minute at most.
 */
class SyncJob : JobService() {
    companion object {
        private const val ID = 1
        private const val MAX_MS = 60_000L
        // The sync the web app starts as it's hidden: a moment to say so.
        private const val START_MS = 1_500L

        /** The running app's sync status (MainActivity sets it); null with no app. */
        @Volatile var sync: StateFlow<SyncStatus?>? = null

        fun busy(s: SyncStatus?) = s?.state == "syncing" || s?.state == "waiting"

        /** Leaving the app with a backup set up: hold on until it's synced. */
        fun schedule(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            val job = JobInfo.Builder(ID, ComponentName(context, SyncJob::class.java))
                .apply { if (Build.VERSION.SDK_INT >= 31) setExpedited(true) else setOverrideDeadline(0) }
                .build()
            runCatching { scheduler.schedule(job) }.onFailure { Log.w("SyncJob", "not scheduled: ${it.message}") }
        }
    }

    private var running: Job? = null

    override fun onStartJob(params: JobParameters): Boolean {
        val flow = sync ?: return false
        running = CoroutineScope(Dispatchers.Main).launch {
            delay(START_MS)
            val done = withTimeoutOrNull(MAX_MS) { flow.first { !busy(it) } } != null
            Log.i("SyncJob", if (done) "synced: ${flow.value?.state}" else "gave up waiting: ${flow.value?.state}")
            jobFinished(params, false)
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        running?.cancel()
        return false
    }
}
