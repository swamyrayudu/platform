package expo.modules.rsdgoogleauth

import android.content.MutableContextWrapper
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GoogleSetupException : CodedException(
  "Google sign-in could not start. Check Google Play services and register this app's package and signing SHA-1 in the same Google Cloud project as the Web client ID."
)
class GoogleResponseException : CodedException("Google returned an unsupported sign-in response. Please try again.")
class GoogleActivityException : CodedException("Open RSD Education before starting Google sign-in.")

class RsdGoogleAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RsdGoogleAuth")

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
        null
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
