package com.technotoil.vonagevoice

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.vonage.android_core.VGClientConfig
import com.vonage.clientcore.core.api.ClientConfigRegion
import com.vonage.voice.api.*

class VonageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var client: VoiceClient? = null
    private var onGoingCallID: CallId? = null
    private var callInviteID: CallId? = null
    private val callStatusMap = mutableMapOf<String, Int>()
    private val currentActivitySafe: Activity?
    get() = reactApplicationContext.currentActivity


    override fun getName(): String = "VonageVoice"

    init {
        client = VoiceClient(reactContext.applicationContext)
        val config = VGClientConfig(ClientConfigRegion.US)
        config.enableWebsocketInvites = true
        config.enableNoiseSuppression = true
        client!!.setConfig(config)

        // Session error listener for "Fail Reason" requirements
        client!!.setSessionErrorListener { err ->
            val params = Arguments.createMap()
            val message = when (err.name) {
                "TOKEN_EXPIRED" -> "Session expired, please login again"
                "NETWORK_ERROR" -> "Vonage connection not available"
                else -> "Connection error: ${err.name}"
            }
            params.putString("reason", message)
            sendEvent("onSessionError", params)
        }

// Call leg updates
client!!.setOnLegStatusUpdate { callId, _, status ->
    android.util.Log.d("VonageModule", "Call Status Update: $status")
    val statusInt = when (status.toString().uppercase()) {
        "RINGING" -> 1
        "ANSWERED" -> 2
        "FAILED" -> 4
        "COMPLETED" -> 5
        else -> 0
    }
    
    callStatusMap[callId.toString()] = statusInt

    val params = Arguments.createMap()
    params.putString("callId", callId.toString())
    params.putInt("status", statusInt)
    sendEvent("onCallStatus", params)
}
        // Incoming call listener
        client!!.setCallInviteListener { callId, from, _ ->
            callInviteID = callId
            val params = Arguments.createMap()
            params.putString("callId", callId.toString())
            params.putString("from", from)
            sendEvent("onIncomingCall", params)
        }

        // Call hangup listener
        client!!.setOnCallHangupListener { callId, _, _ ->
            if (onGoingCallID == callId) {
                onGoingCallID = null
            }
            val params = Arguments.createMap()
            params.putString("callId", callId.toString())
            sendEvent("onCallEnded", params)
        }

        
    }

  private fun configureAudio(speakerOn: Boolean = false) {
        val activity = currentActivitySafe ?: return
        val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isMicrophoneMute = false
        audioManager.isSpeakerphoneOn = speakerOn
        
        // Call audio ko force karo
    audioManager.setStreamVolume(
        AudioManager.STREAM_VOICE_CALL,
        audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL),
        0
    )
    }

    // MARK: - Login
    @ReactMethod
    fun login(jwt: String, promise: Promise) {
        client!!.createSession(jwt) { err, sessionId ->
            if (err != null) {
                promise.reject("LOGIN_FAILED", err.localizedMessage)
            } else {
                val result = Arguments.createMap()
                result.putString("sessionId", sessionId)
                promise.resolve(result)
            }
        }
    }

    @ReactMethod
    fun logout(promise: Promise) {
        client!!.deleteSession { err ->
            if (err != null) {
                promise.reject("LOGOUT_FAILED", err.localizedMessage)
            } else {
                promise.resolve(true)
            }
        }
    }

    // MARK: - Call
    @ReactMethod
    fun call(to: String, from:String, promise: Promise) {
        configureAudio()
        val params: Map<String, String> = mapOf(
            "to" to to,
            "from" to from
        )
        client!!.serverCall(params) { err, callId ->
            if (err != null) {
                promise.reject("CALL_FAILED", err.localizedMessage)
            } else if (callId != null) {
                onGoingCallID = callId
                val eventParams = Arguments.createMap()
                eventParams.putString("callId", callId.toString())
                eventParams.putString("to", to)
                eventParams.putString("from", from)
                sendEvent("onCallStarted", eventParams)
                promise.resolve(callId.toString())
            }
        }
    }

    @ReactMethod
    fun answer(promise: Promise) {
        configureAudio()
        callInviteID?.let { id ->
            client!!.answer(id) { err ->
                if (err != null) {
                    promise.reject("ANSWER_FAILED", err.localizedMessage)
                } else {
                    onGoingCallID = id
                    val params = Arguments.createMap()
                    params.putString("callId", id.toString())
                    sendEvent("onCallAnswered", params)
                    promise.resolve(true)
                }
            }
        } ?: promise.reject("NO_CALL", "No incoming call to answer")
    }

    @ReactMethod
    fun reject(callId: String, promise: Promise) {
        client?.reject(callId) { err ->
            if (err != null) promise.reject("REJECT_FAILED", err.localizedMessage)
            else {
                val map = Arguments.createMap()
                map.putString("callId", callId.toString())
                sendEvent("onCallRejected", map)
                promise.resolve(true)
            }
        }
    }

    @ReactMethod
    fun hangup(callId: String, promise: Promise) {
        client?.hangup(callId) { err ->
            if (err != null) promise.reject("HANGUP_FAILED", err.localizedMessage)
            else {
                val map = Arguments.createMap()
                map.putString("callId", callId.toString())
                sendEvent("onCallEnded", map)
                promise.resolve(true)
            }
        }
        onGoingCallID = null
    }

    @ReactMethod
fun mute(callId: String, promise: Promise) {
    client?.mute(callId) { err ->
        if (err != null) {
            promise.reject("MUTE_FAILED", err.localizedMessage)
        } else {
            val params = Arguments.createMap()
            params.putString("callId", callId)
            sendEvent("onCallMuted", params)
            promise.resolve(callId) // resolve promise with callId
        }
    }
}

@ReactMethod
fun unmute(callId: String, promise: Promise) {
    client?.unmute(callId) { err ->
        if (err != null) {
            promise.reject("UNMUTE_FAILED", err.localizedMessage)
        } else {
            val params = Arguments.createMap()
            params.putString("callId", callId)
            sendEvent("onCallUnmuted", params)
            promise.resolve(callId)
        }
    }
}

    @ReactMethod
    fun getCallStatus(callId: String, promise: Promise) {
        val status = callStatusMap[callId] ?: 0
        promise.resolve(status)
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
        onGoingCallID?.let { id ->
            client!!.sendDTMF(id, tone) { err ->
                if (err != null) {
                    promise.reject("DTMF_FAILED", err.localizedMessage)
                } else {
                    promise.resolve(true)
                }
            }
        } ?: promise.reject("NO_CALL", "No active call to send DTMF")
    }

    // MARK: - Event emitter
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

   
}
