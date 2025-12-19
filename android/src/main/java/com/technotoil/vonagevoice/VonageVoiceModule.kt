package com.technotoil.vonagevoice

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * VonageVoice native module (non-codegen implementation).
 *
 * We intentionally avoid generated `Native*Spec` types so the module
 * compiles even when RN codegen is not enabled. Replace/extend methods
 * below with actual Vonage SDK integrations.
 */
class VonageVoiceModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return NAME
  }

  /**
   * Example asynchronous method that resolves the product of two numbers.
   * Replace this with real Vonage SDK methods when wiring the native API.
   */
  @ReactMethod
  fun multiply(a: Double, b: Double, promise: Promise) {
    promise.resolve(a * b)
  }

  companion object {
    const val NAME = "VonageVoice"
  }
}
