package expo.modules.rsdappupdate

import android.app.Activity
import android.content.Context
import android.os.Build
import com.google.android.gms.tasks.Task
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Thin wrapper over Google Play In-App Updates.
 *
 * Only reports what Play says and starts Play's own update screens. Whether an
 * update is required or optional is decided in JavaScript
 * (utils/play-update-policy.ts) from the server's minimum version and Play's
 * update priority.
 */
class AppUpdateException(code: String, message: String) : CodedException(code, message, null)

private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { cont ->
  addOnSuccessListener { cont.resume(it) }
  addOnFailureListener { cont.resumeWithException(it) }
}

private fun availabilityName(value: Int) = when (value) {
  UpdateAvailability.UPDATE_AVAILABLE -> "available"
  UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "in_progress"
  UpdateAvailability.UPDATE_NOT_AVAILABLE -> "not_available"
  else -> "unknown"
}

private fun statusName(value: Int) = when (value) {
  InstallStatus.PENDING -> "pending"
  InstallStatus.DOWNLOADING -> "downloading"
  InstallStatus.DOWNLOADED -> "downloaded"
  InstallStatus.INSTALLING -> "installing"
  InstallStatus.INSTALLED -> "installed"
  InstallStatus.FAILED -> "failed"
  InstallStatus.CANCELED -> "cancelled"
  else -> "unknown"
}

class RsdAppUpdateModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw AppUpdateException("E_UPDATE_NO_CONTEXT", "The app is not ready yet.")

  private var manager: AppUpdateManager? = null
  private fun manager(): AppUpdateManager = manager ?: AppUpdateManagerFactory.create(context).also { manager = it }

  private val listener = InstallStateUpdatedListener { state ->
    sendEvent("onInstallState", mapOf(
      "status" to statusName(state.installStatus()),
      "bytesDownloaded" to state.bytesDownloaded().toDouble(),
      "totalBytes" to state.totalBytesToDownload().toDouble(),
    ))
  }

  private fun installedVersionCode(): Double {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
    return code.toDouble()
  }

  private fun describe(info: AppUpdateInfo): Map<String, Any?> = mapOf(
    "availability" to availabilityName(info.updateAvailability()),
    "availableVersionCode" to info.availableVersionCode().toDouble(),
    "installedVersionCode" to installedVersionCode(),
    "priority" to info.updatePriority(),
    "stalenessDays" to info.clientVersionStalenessDays(),
    "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
    "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
    "installStatus" to statusName(info.installStatus()),
    "packageName" to context.packageName,
  )

  override fun definition() = ModuleDefinition {
    Name("RsdAppUpdate")
    Events("onInstallState")

    OnStartObserving { manager().registerListener(listener) }
    OnStopObserving { manager?.unregisterListener(listener) }
    OnDestroy { manager?.unregisterListener(listener) }

    /** What Google Play says about updates for this install. */
    (AsyncFunction("check") Coroutine { ->
      describe(manager().appUpdateInfo.await())
    })

    /**
     * Opens Play's update screen: "immediate" (full screen, the app restarts when
     * done) or "flexible" (downloads in the background). Resolves "ok",
     * "cancelled", "failed" or "unavailable".
     */
    (AsyncFunction("start") Coroutine { type: String ->
      val activity: Activity = appContext.currentActivity
        ?: throw AppUpdateException("E_UPDATE_NO_ACTIVITY", "Open RSD Education and try again.")
      val updateType = if (type == "immediate") AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
      // Each AppUpdateInfo can start one flow only, so always ask Play again.
      val info = manager().appUpdateInfo.await()
      val availability = info.updateAvailability()
      val startable = availability == UpdateAvailability.UPDATE_AVAILABLE ||
        (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS && updateType == AppUpdateType.IMMEDIATE)
      if (!startable || !info.isUpdateTypeAllowed(updateType)) return@Coroutine "unavailable"
      val result = withContext(Dispatchers.Main) {
        manager().startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(updateType).build())
      }.await()
      when (result) {
        Activity.RESULT_OK -> "ok"
        Activity.RESULT_CANCELED -> "cancelled"
        else -> "failed"
      }
    })

    /** Installs a downloaded flexible update; the app restarts. */
    (AsyncFunction("complete") Coroutine { ->
      manager().completeUpdate().await()
      true
    })
  }
}
