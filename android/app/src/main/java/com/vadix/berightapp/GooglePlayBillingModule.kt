package com.vadix.berightapp

import com.android.billingclient.api.*
import com.facebook.react.bridge.*

class GooglePlayBillingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var billingClient: BillingClient? = null
    
    override fun getName(): String {
        return "GooglePlayBillingModule"
    }
    
    @ReactMethod
    fun getAlternativeBillingToken(promise: Promise) {
        try {
            // Initialize billing client if not already done
            if (billingClient == null) {
                billingClient = BillingClient.newBuilder(reactApplicationContext)
                    .setListener { _, _ -> }
                    .enablePendingPurchases()
                    .build()
            }
            
            // Connect to billing service
            billingClient?.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                        // Create billing program reporting details for Alternative Billing
                        val params = BillingProgramReportingDetailsParams.newBuilder()
                            .setBillingProgram(BillingProgram.EXTERNAL_OFFER)
                            .build()
                        
                        billingClient?.createBillingProgramReportingDetailsAsync(
                            params,
                            object : BillingProgramReportingDetailsListener {
                                override fun onCreateBillingProgramReportingDetailsResponse(
                                    billingResult: BillingResult,
                                    billingProgramReportingDetails: BillingProgramReportingDetails?
                                ) {
                                    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                                        val token = billingProgramReportingDetails?.externalTransactionToken
                                        if (token != null) {
                                            promise.resolve(token)
                                        } else {
                                            promise.reject("NO_TOKEN", "No external transaction token returned")
                                        }
                                    } else {
                                        promise.reject(
                                            "BILLING_ERROR",
                                            "Failed to create billing program reporting details: ${billingResult.debugMessage}"
                                        )
                                    }
                                    
                                    // Disconnect after getting token
                                    billingClient?.endConnection()
                                }
                            }
                        )
                    } else {
                        promise.reject(
                            "CONNECTION_ERROR",
                            "Failed to connect to billing service: ${billingResult.debugMessage}"
                        )
                    }
                }
                
                override fun onBillingServiceDisconnected() {
                    // Connection lost, will need to reconnect
                }
            })
        } catch (e: Exception) {
            promise.reject("ERROR", "Exception in getAlternativeBillingToken: ${e.message}", e)
        }
    }
}

