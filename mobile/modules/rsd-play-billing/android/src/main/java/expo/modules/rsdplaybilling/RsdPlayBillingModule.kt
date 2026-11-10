package expo.modules.rsdplaybilling

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * Thin wrapper over the Google Play Billing Library for RSD Pro subscriptions.
 *
 * Deliberately does NOT grant access or acknowledge purchases: the app sends
 * every purchase token to the backend, which verifies it with the Google Play
 * Developer API, stores it and acknowledges it. The phone is never trusted.
 */
class PlayBillingException(code: String, message: String, val responseCode: Int? = null) :
  CodedException(code, message, null)

private fun failure(result: BillingResult, action: String): PlayBillingException {
  val code = when (result.responseCode) {
    BillingResponseCode.USER_CANCELED -> "E_PLAY_CANCELLED"
    BillingResponseCode.ITEM_ALREADY_OWNED -> "E_PLAY_ALREADY_OWNED"
    BillingResponseCode.BILLING_UNAVAILABLE -> "E_PLAY_BILLING_UNAVAILABLE"
    BillingResponseCode.ITEM_UNAVAILABLE -> "E_PLAY_ITEM_UNAVAILABLE"
    BillingResponseCode.FEATURE_NOT_SUPPORTED -> "E_PLAY_NOT_SUPPORTED"
    BillingResponseCode.DEVELOPER_ERROR -> "E_PLAY_DEVELOPER_ERROR"
    BillingResponseCode.SERVICE_DISCONNECTED,
    BillingResponseCode.SERVICE_UNAVAILABLE,
    BillingResponseCode.NETWORK_ERROR -> "E_PLAY_NETWORK"
    else -> "E_PLAY_ERROR"
  }
  val message = when (code) {
    "E_PLAY_CANCELLED" -> "Purchase was cancelled."
    "E_PLAY_ALREADY_OWNED" -> "This Google Play account already has this subscription. Use Restore purchases."
    "E_PLAY_BILLING_UNAVAILABLE" -> "Google Play billing is not available. Sign in to the Play Store and update it, then try again."
    "E_PLAY_ITEM_UNAVAILABLE" -> "This plan is not available on Google Play right now."
    "E_PLAY_NETWORK" -> "Could not reach Google Play. Check your connection and try again."
    else -> "Google Play could not $action (code ${result.responseCode})."
  }
  return PlayBillingException(code, message, result.responseCode)
}

class RsdPlayBillingModule : Module() {
  private var client: BillingClient? = null
  private val connectLock = Mutex()
  private val purchaseLock = Mutex()
  private val productCache = mutableMapOf<String, ProductDetails>()
  @Volatile private var pendingFlow: CompletableDeferred<List<Purchase>>? = null

  private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
    val flow = pendingFlow
    if (flow != null && !flow.isCompleted) {
      pendingFlow = null
      if (result.responseCode == BillingResponseCode.OK) flow.complete(purchases.orEmpty())
      else flow.completeExceptionally(failure(result, "complete the purchase"))
      return@PurchasesUpdatedListener
    }
    // Updates outside an active flow: a pending (UPI / cash) payment finished,
    // or a purchase made from the Play Store app. JS sends them to the server.
    if (result.responseCode == BillingResponseCode.OK && !purchases.isNullOrEmpty()) {
      sendEvent("onPurchasesUpdated", mapOf("purchases" to purchases.map(::serialize)))
    }
  }

  private suspend fun connected(): BillingClient = connectLock.withLock {
    val context = appContext.reactContext ?: throw PlayBillingException("E_PLAY_NO_CONTEXT", "Open RSD Education and try again.")
    val existing = client
    if (existing != null && existing.isReady) return existing
    val billing = existing ?: BillingClient.newBuilder(context.applicationContext)
      .setListener(purchasesListener)
      // Required: allows UPI / cash payments that complete later (common in India).
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().enablePrepaidPlans().build())
      .enableAutoServiceReconnection()
      .build()
      .also { client = it }
    val result = suspendCancellableCoroutine<BillingResult> { cont ->
      billing.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(result: BillingResult) {
          if (cont.isActive) cont.resume(result)
        }
        override fun onBillingServiceDisconnected() {
          // enableAutoServiceReconnection reconnects on the next call.
        }
      })
    }
    if (result.responseCode != BillingResponseCode.OK) throw failure(result, "connect")
    billing
  }

  private fun serialize(purchase: Purchase): Map<String, Any?> = mapOf(
    "purchaseToken" to purchase.purchaseToken,
    "products" to purchase.products,
    "orderId" to purchase.orderId,
    // 0 = UNSPECIFIED, 1 = PURCHASED, 2 = PENDING
    "purchaseState" to purchase.purchaseState,
    "purchaseTime" to purchase.purchaseTime.toDouble(),
    "isAcknowledged" to purchase.isAcknowledged,
    "isAutoRenewing" to purchase.isAutoRenewing,
    "obfuscatedAccountId" to purchase.accountIdentifiers?.obfuscatedAccountId
  )

  private fun serialize(details: ProductDetails): Map<String, Any?> = mapOf(
    "productId" to details.productId,
    "title" to details.title,
    "name" to details.name,
    "offers" to details.subscriptionOfferDetails.orEmpty().map { offer ->
      mapOf(
        "basePlanId" to offer.basePlanId,
        "offerId" to offer.offerId,
        "offerToken" to offer.offerToken,
        "offerTags" to offer.offerTags,
        "pricingPhases" to offer.pricingPhases.pricingPhaseList.map { phase ->
          mapOf(
            "formattedPrice" to phase.formattedPrice,
            "priceAmountMicros" to phase.priceAmountMicros.toDouble(),
            "priceCurrencyCode" to phase.priceCurrencyCode,
            // ISO 8601, e.g. P1M, P3M, P1Y
            "billingPeriod" to phase.billingPeriod,
            "billingCycleCount" to phase.billingCycleCount,
            // 1 = INFINITE_RECURRING, 2 = FINITE_RECURRING, 3 = NON_RECURRING
            "recurrenceMode" to phase.recurrenceMode
          )
        }
      )
    }
  )

  override fun definition() = ModuleDefinition {
    Name("RsdPlayBilling")
    Events("onPurchasesUpdated")

    /** Subscription base plans + offers this user is eligible for, with Google's localized prices. */
    (AsyncFunction("getSubscription") Coroutine { productId: String ->
      val billing = connected()
      val params = QueryProductDetailsParams.newBuilder()
        .setProductList(listOf(
          QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        ))
        .build()
      val (result, list) = suspendCancellableCoroutine<Pair<BillingResult, List<ProductDetails>>> { cont ->
        billing.queryProductDetailsAsync(params) { result, details ->
          if (cont.isActive) cont.resume(result to details.productDetailsList)
        }
      }
      if (result.responseCode != BillingResponseCode.OK) throw failure(result, "load plans")
      val details = list.firstOrNull { it.productId == productId } ?: return@Coroutine null
      productCache[productId] = details
      serialize(details)
    })

    /**
     * Open Google's purchase sheet. Resolves with the purchases Google returns
     * (state PURCHASED or PENDING); rejects E_PLAY_CANCELLED when the user backs out.
     */
    (AsyncFunction("purchase") Coroutine { productId: String, offerToken: String, obfuscatedAccountId: String, oldPurchaseToken: String?, replacementMode: Int? ->
      purchaseLock.withLock {
        val billing = connected()
        val activity = appContext.currentActivity ?: throw PlayBillingException("E_PLAY_NO_ACTIVITY", "Open RSD Education and try again.")
        val details = productCache[productId] ?: throw PlayBillingException("E_PLAY_NOT_LOADED", "Plans are not loaded yet. Refresh and try again.")
        if (details.subscriptionOfferDetails.orEmpty().none { it.offerToken == offerToken }) {
          throw PlayBillingException("E_PLAY_NOT_LOADED", "This plan has changed. Refresh and try again.")
        }
        if (obfuscatedAccountId.isBlank() || obfuscatedAccountId.length > 64) {
          throw PlayBillingException("E_PLAY_DEVELOPER_ERROR", "Account could not be linked to this purchase.")
        }
        val builder = BillingFlowParams.newBuilder()
          .setProductDetailsParamsList(listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder()
              .setProductDetails(details)
              .setOfferToken(offerToken)
              .build()
          ))
          // Server reads this back from Google to prove which account bought the token.
          .setObfuscatedAccountId(obfuscatedAccountId)
        if (!oldPurchaseToken.isNullOrBlank()) {
          // Base-plan change inside ONE subscription product. PBL 8.1+ adds
          // per-product SubscriptionProductReplacementParams for multi-product
          // (add-on) purchases; the subscription-level mode below is still the
          // supported path for a single product and keeps behaviour explicit.
          @Suppress("DEPRECATION")
          builder.setSubscriptionUpdateParams(
            BillingFlowParams.SubscriptionUpdateParams.newBuilder()
              .setOldPurchaseToken(oldPurchaseToken)
              .setSubscriptionReplacementMode(replacementMode ?: BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION)
              .build()
          )
        }
        val flow = CompletableDeferred<List<Purchase>>()
        pendingFlow = flow
        val launch = withContext(Dispatchers.Main) { billing.launchBillingFlow(activity, builder.build()) }
        if (launch.responseCode != BillingResponseCode.OK) {
          pendingFlow = null
          throw failure(launch, "open the purchase screen")
        }
        // UPI / card entry can take a while, but never wait forever: a lost
        // callback would otherwise block every later purchase until restart.
        val purchases = withTimeoutOrNull(30L * 60 * 1000) { flow.await() }
        if (purchases == null) {
          pendingFlow = null
          throw PlayBillingException("E_PLAY_TIMEOUT", "Google Play did not respond. If you paid, use Restore purchases.")
        }
        purchases.map(::serialize)
      }
    })

    /** Active subscriptions owned by the Google account on this device (for restore). */
    (AsyncFunction("queryActivePurchases") Coroutine { ->
      val billing = connected()
      val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
      val (result, purchases) = suspendCancellableCoroutine<Pair<BillingResult, List<Purchase>>> { cont ->
        billing.queryPurchasesAsync(params) { result, list -> if (cont.isActive) cont.resume(result to list) }
      }
      if (result.responseCode != BillingResponseCode.OK) throw failure(result, "check your purchases")
      purchases.map(::serialize)
    })

    OnDestroy {
      pendingFlow?.completeExceptionally(PlayBillingException("E_PLAY_CANCELLED", "Purchase was interrupted."))
      pendingFlow = null
      client?.endConnection()
      client = null
    }
  }
}

