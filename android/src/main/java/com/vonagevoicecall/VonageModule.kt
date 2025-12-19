package com.technotoil.vonagevoice

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.vonage.android_core.VGClientConfig
import com.vonage.clientcore.core.api.ClientConfigRegion
import com.vonage.voice.api.*

/**
 * React Native module that wraps Vonage Voice SDK functionality.
 *
 * Exposes promise-based methods for login/logout, call control, DTMF
 * and a simple event emitter for incoming-call and call-status events.
 */
class VonageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var client: VoiceClient? = null
    private var onGoingCallID: CallId? = null
    private var callInviteID: CallId? = null

    private val currentActivitySafe: Activity?
        get() = reactApplicationContext.currentActivity

    override fun getName(): String = "VonageVoice"

    init {
        // Initialize the Vonage Voice client and enable websocket invites.
        client = VoiceClient(reactContext.applicationContext)
        val config = VGClientConfig(ClientConfigRegion.US)
        config.enableWebsocketInvites = true
        client?.setConfig(config)

        // Incoming call listener
        client?.setCallInviteListener { callId, from, _ ->
            callInviteID = callId
            val params = Arguments.createMap().apply {
                putString("callId", callId.toString())
                putString("from", from)
            }
            sendEvent("onIncomingCall", params)
        }

        // Call hangup listener
        client?.setOnCallHangupListener { callId, _, _ ->
            if (onGoingCallID == callId) {
                onGoingCallID = null
            }
            val params = Arguments.createMap().apply { putString("callId", callId.toString()) }
            sendEvent("onCallEnded", params)
        }
    }

    /**
     * Configure audio session for VoIP calls. Sets speakerphone and max volume.
     */
    private fun configureAudio(speakerOn: Boolean = false) {
        val activity = currentActivitySafe ?: return
        val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isMicrophoneMute = false
        audioManager.isSpeakerphoneOn = speakerOn

        // Ensure voice stream is audible
        audioManager.setStreamVolume(
            AudioManager.STREAM_VOICE_CALL,
            audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL),
            0
        )
    }

    // MARK: - Login
    @ReactMethod
    fun login(jwt: String, promise: Promise) {
        client?.createSession(jwt) { err, sessionId ->
            if (err != null) {
                promise.reject("LOGIN_FAILED", err.localizedMessage)
            } else {
                val result = Arguments.createMap().apply { putString("sessionId", sessionId) }
                promise.resolve(result)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    @ReactMethod
    fun logout(promise: Promise) {
        client?.deleteSession { err ->
            if (err != null) {
                promise.reject("LOGOUT_FAILED", err.localizedMessage)
            } else {
                promise.resolve(true)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    // MARK: - Call
    @ReactMethod
    fun call(to: String, from: String, promise: Promise) {
        configureAudio()
        val params: Map<String, String> = mapOf("to" to to, "from" to from)
        client?.serverCall(params) { err, callId ->
            when {
                err != null -> promise.reject("CALL_FAILED", err.localizedMessage)
                callId != null -> {
                    onGoingCallID = callId
                    val eventParams = Arguments.createMap().apply {
                        putString("callId", callId.toString())
                        putString("to", to)
                        putString("from", from)
                    }
                    sendEvent("onCallStarted", eventParams)
                    promise.resolve(callId.toString())
                }
                else -> promise.reject("CALL_FAILED", "Unknown error creating call")
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    @ReactMethod
    fun answer(promise: Promise) {
        configureAudio()
        val invite = callInviteID
        if (invite == null) {
            promise.reject("NO_CALL", "No incoming call to answer")
            return
        }

        client?.answer(invite) { err ->
            if (err != null) {
                promise.reject("ANSWER_FAILED", err.localizedMessage)
            } else {
                onGoingCallID = invite
                val params = Arguments.createMap().apply { putString("callId", invite.toString()) }
                sendEvent("onCallAnswered", params)
                promise.resolve(true)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    @ReactMethod
    fun reject(callId: String, promise: Promise) {
        client?.reject(callId) { err ->
            if (err != null) promise.reject("REJECT_FAILED", err.localizedMessage)
            else {
                val map = Arguments.createMap().apply { putString("callId", callId.toString()) }
                sendEvent("onCallRejected", map)
                promise.resolve(true)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    @ReactMethod
    fun hangup(callId: String, promise: Promise) {
        client?.hangup(callId) { err ->
            if (err != null) promise.reject("HANGUP_FAILED", err.localizedMessage)
            else {
                val map = Arguments.createMap().apply { putString("callId", callId.toString()) }
                sendEvent("onCallEnded", map)
                promise.resolve(true)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
        onGoingCallID = null
    }

    @ReactMethod
    fun mute(callId: String, promise: Promise) {
        client?.mute(callId) { err ->
            if (err != null) {
                promise.reject("MUTE_FAILED", err.localizedMessage)
            } else {
                val params = Arguments.createMap().apply { putString("callId", callId) }
                sendEvent("onCallMuted", params)
                promise.resolve(callId)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    @ReactMethod
    fun unmute(callId: String, promise: Promise) {
        client?.unmute(callId) { err ->
            if (err != null) {
                promise.reject("UNMUTE_FAILED", err.localizedMessage)
            } else {
                val params = Arguments.createMap().apply { putString("callId", callId) }
                sendEvent("onCallUnmuted", params)
                promise.resolve(callId)
            }
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    @ReactMethod
    fun setSpeaker(enabled: Boolean, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity != null) {
            val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.isSpeakerphoneOn = enabled
            promise.resolve(enabled)
        } else {
            promise.reject("NO_ACTIVITY", "Current activity not available")
        }
    }

    // MARK: - DTMF
    @ReactMethod
    fun sendDTMF(tone: String, promise: Promise) {
        val id = onGoingCallID
        if (id == null) {
            promise.reject("NO_CALL", "No active call to send DTMF")
            return
        }

        client?.sendDTMF(id, tone) { err ->
            if (err != null) promise.reject("DTMF_FAILED", err.localizedMessage)
            else promise.resolve(true)
        } ?: promise.reject("NO_CLIENT", "Voice client not initialized")
    }

    // MARK: - Event emitter
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
