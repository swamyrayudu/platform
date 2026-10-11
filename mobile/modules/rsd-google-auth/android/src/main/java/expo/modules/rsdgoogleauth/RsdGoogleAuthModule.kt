package expo.modules.rsdgoogleauth

import android.content.MutableContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest

class GoogleSetupException : CodedException(
  "Google sign-in could not start. Check Google Play services and register this app's package and signing SHA-1 in the same Google Cloud project as the Web client ID."
)
class GoogleResponseException : CodedException("Google returned an unsupported sign-in response. Please try again.")
class GoogleActivityException : CodedException("Open RSD Education before starting Google sign-in.")
class GoogleIncompleteException : CodedException(
  "Google did not complete sign-in. If you selected an account, verify this installed app's Android OAuth package and signing SHA-1 in the same Google Cloud project as the Web client."
)
class GoogleAccountException : CodedException("Google could not verify the selected account. Check that account in Android's Google account settings, then try again.")
class GoogleInterruptedException : CodedException("Google sign-in was interrupted. Open RSD Education and try again.")

class RsdGoogleAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RsdGoogleAuth")

    // Public signing certificates only: never return account data or credentials.
    Function("getSetupInfo") {
      val context = appContext.reactContext ?: throw GoogleActivityException()
      @Suppress("DEPRECATION")
      val info = context.packageManager.getPackageInfo(context.packageName,
        if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
      @Suppress("DEPRECATION")
      val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
      val fingerprints = signatures.orEmpty().map { signature ->
        MessageDigest.getInstance("SHA-1").digest(signature.toByteArray())
          .joinToString(":") { byte -> "%02X".format(byte.toInt() and 0xff) }
      }
      mapOf("packageName" to context.packageName, "sha1Fingerprints" to fingerprints)
    }

    (AsyncFunction("signIn") Coroutine { webClientId: String, nonce: String ->
      val activity = appContext.currentActivity ?: throw GoogleActivityException()
      if (!webClientId.endsWith(".apps.googleusercontent.com") || nonce.isBlank()) {
        throw GoogleSetupException()
      }
      val option = GetSignInWithGoogleOption.Builder(webClientId)
        // Use the backend's exact nonce, not a newly generated or hashed value.
        .setNonce(nonce)
        .build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      try {
        val result = CredentialManager.create(activity).getCredential(
          context = MutableContextWrapper(activity), request = request
        )
        val credential = result.credential
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
          throw GoogleResponseException()
        }
        GoogleIdTokenCredential.createFrom(credential.data).idToken
      } catch (cancelled: GetCredentialCancellationException) {
        // Play services also uses cancellation for failed authorization. Do not
        // claim the user pressed Back or automatically reopen the chooser.
        if (cancelled.message?.contains("reauth", ignoreCase = true) == true) {
          throw GoogleAccountException()
        }
        throw GoogleIncompleteException()
      } catch (interrupted: GetCredentialInterruptedException) {
        throw GoogleInterruptedException()
      } catch (missing: NoCredentialException) {
        throw GoogleSetupException()
      } catch (error: GetCredentialException) {
        // Never log Google credentials or return provider internals to the UI.
        throw GoogleSetupException()
      }
    }).runOnQueue(Queues.MAIN)

    AsyncFunction("clearSession") Coroutine { ->
      val context = appContext.reactContext ?: throw GoogleActivityException()
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    }
  }
}
