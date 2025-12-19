package com.technotoil.vonagevoice

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage implementation that registers the Vonage native module.
 *
 * This class is discovered by React Native autolinking (or can be added
 * manually to the application's package list). It provides the
 * `VonageModule` as a native module and does not expose any view managers.
 */
class VonagePackage : ReactPackage {

    /**
     * Create and return the list of native modules provided by this package.
     *
     * @param reactContext The react application context passed by RN.
     * @return A list containing a single `VonageModule` instance.
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf<NativeModule>(VonageModule(reactContext))
    }

    /**
     * This package does not provide any custom native view managers.
     *
     * @return an empty list.
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}