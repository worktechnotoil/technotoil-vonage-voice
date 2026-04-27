//
//  VonageVoice.swift
//  VonageVoiceCall
//
//  Lightweight Swift wrapper that bridges the Vonage Client SDK to React Native.
//  This file exposes a JS-facing class (`VonageVoice`) and a simple `EventEmitter`
//  implementation used to forward native events to JavaScript.
//
//  Notes:
//  - Keep Objective-C/Swift bridging in sync with your Podspec and package manifest.
//  - Ensure `VonageVoice` is registered as a native module (via bridging header or RCT exports).
//

import AVFoundation
import Foundation
import React
import VonageClientSDKVoice

/// VonageVoice is the JS-facing wrapper around the Vonage iOS Voice SDK.
/// It exposes async methods (promises) and emits events through `EventEmitter`.
@objc(VonageVoice)
class VonageVoice: NSObject {
  /// Shared singleton used by the Swift side when necessary.
  @objc public static let shared = VonageVoice()

  /// Underlying Vonage SDK client.
  private var client: VGVoiceClient?

  /// Current active call identifier (if any).
  private var currentCallId: String?

  /// Cache of last known leg statuses keyed by call id.
  private var callStatuses: [String: VGLegStatus] = [:]

  override init() {
    super.init()
    // Ensure microphone permission is requested early.
    checkAndRequestMicrophonePermission()

    // Initialize the SDK client and set delegate to receive callbacks.
    client = VGVoiceClient()
    client?.delegate = self
  }

  // MARK: - Permissions & Audio Session

  /// Ensure microphone permission is granted; if not, request it.
  func checkAndRequestMicrophonePermission() {
    let audioSession = AVAudioSession.sharedInstance()

    switch audioSession.recordPermission {
    case .granted:
      // Permission already granted — nothing to do.
      break
    case .denied:
      // Informative log; consider exposing a callback to JS to prompt user.
      print("Microphone access denied. Direct user to Settings.")
    case .undetermined:
      // Request permission and log the result.
      audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          print(granted ? "Permission granted after request." : "Permission denied after request.")
        }
      }
    @unknown default:
      print("Unknown microphone permission status.")
    }
  }

  /// Configure AVAudioSession for voice chat usage and prefer built-in mic if available.
  private func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
      try session.setPreferredIOBufferDuration(0.02) // 20ms
      try session.setActive(true)

       // 🔥 FORCE EARPIECE (MAIN FIX)
      try session.overrideOutputAudioPort(.none)

      // Prefer built-in microphone input if available
      if let mic = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
        try? session.setPreferredInput(mic)
      }

// 🔥 RE-APPLY (Vonage override fix)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
        try? AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
      }
      // Debug logging — safe to remove in production
      print("🔊 Audio session active")
      print("Inputs:", session.currentRoute.inputs)
      print("Outputs:", session.currentRoute.outputs)
    } catch {
      print("❌ Audio session error:", error.localizedDescription)
    }
  }

  // MARK: - JS Exposed API (Promise based)

  @objc func login(_ token: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    VGVoiceClient.isUsingCallKit = false
    client?.createSession(token) { error, sessionId in
      if let error = error {
        reject("LOGIN_FAILED", error.localizedDescription, error)
      } else {
        resolve(["success": true, "sessionId": sessionId ?? ""])
      }
    }
  }

  @objc func logout(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    client?.deleteSession { error in
      if let error = error {
        reject("LOGOUT_FAILED", error.localizedDescription, error)
      } else {
        resolve(["success": true])
      }
    }
  }

  // MARK: - Call Controls

  @objc func call(_ to: String, from: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let params: [String: Any] = ["to": to, "from": from]

    client?.serverCall(params) { error, callId in
      // Ensure mic permission before proceeding
      guard AVAudioSession.sharedInstance().recordPermission == .granted else {
        reject("MIC_PERMISSION", "Microphone permission not granted", nil)
        return
      }

      self.configureAudioSession()

      if let error = error {
        reject("CALL_FAILED", error.localizedDescription, error)
      } else if let callId = callId {
        self.currentCallId = callId
        self.sendEvent("onCallStarted", body: ["callId": callId, "to": to, "from": from])
        resolve(["callId": callId])
      } else {
        reject("CALL_FAILED", "Unknown error creating call", nil)
      }
    }
  }

  @objc func answer(_ callId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard AVAudioSession.sharedInstance().recordPermission == .granted else {
      reject("MIC_PERMISSION", "Microphone permission not granted", nil)
      return
    }

    self.configureAudioSession()
    client?.answer(callId) { error in
      if let error = error {
        reject("ANSWER_FAILED", error.localizedDescription, error)
      } else {
        self.currentCallId = callId
        self.sendEvent("onCallAnswered", body: ["callId": callId])
        resolve(["success": true])
      }
    }
  }

  @objc func reject(_ callId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    client?.reject(callId) { error in
      if let error = error {
        reject("REJECT_FAILED", error.localizedDescription, error)
      } else {
        self.sendEvent("onCallRejected", body: ["callId": callId])
        resolve(["success": true])
      }
    }
  }

  @objc func hangup(_ callId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    client?.hangup(callId) { error in
      if let error = error {
        reject("HANGUP_FAILED", error.localizedDescription, error)
      } else {
        self.sendEvent("onCallEnded", body: ["callId": callId])
        resolve(["success": true])
      }
    }
  }

  @objc func mute(_ callId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let client = client else {
      reject("NO_CLIENT", "Voice client not initialized", nil)
      return
    }

    client.mute(callId) { error in
      if let error = error {
        reject("MUTE_FAILED", error.localizedDescription, error)
      } else {
        let eventBody: [String: Any] = ["callId": callId]
        self.sendEvent("onCallMuted", body: eventBody)
        resolve(callId)
      }
    }
  }

  @objc func unmute(_ callId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let client = client else {
      reject("NO_CLIENT", "Voice client not initialized", nil)
      return
    }

    client.unmute(callId) { error in
      if let error = error {
        reject("UNMUTE_FAILED", error.localizedDescription, error)
      } else {
        let eventBody: [String: Any] = ["callId": callId]
        self.sendEvent("onCallUnmuted", body: eventBody)
        resolve(callId)
      }
    }
  }

  @objc func getCallStatus(_ callId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let status = callStatuses[callId] else {
      reject("NO_STATUS", "No status found for callId", nil)
      return
    }

    resolve(["callId": callId, "status": status.rawValue])
  }

  // @objc func setSpeaker(_ enabled: Bool, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
  //   do {
  //     let session = AVAudioSession.sharedInstance()
  //     try session.overrideOutputAudioPort(enabled ? .speaker : .none)
  //     resolve(true)
  //   } catch {
  //     reject("AUDIO_ERROR", error.localizedDescription, error)
  //   }
  // }




@objc func setSpeaker(_ enabled: Bool, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    do {
        let session = AVAudioSession.sharedInstance()
        
        // 1. Category same rahegi (NO defaultToSpeaker)
        let options: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP]
        
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: options)
        
        // 2. Activate session pehle (important for consistency)
        try session.setActive(true)
        
        // 3. Force output
        try session.overrideOutputAudioPort(enabled ? .speaker : .none)
        
        resolve(true)
        
    } catch {
        // Retry fallback (same as your logic)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            try? AVAudioSession.sharedInstance().overrideOutputAudioPort(enabled ? .speaker : .none)
        }
        
        reject("AUDIO_ERROR", error.localizedDescription, error)
    }
}

  // MARK: - DTMF

  @objc func sendDTMF(_ tone: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let callId = currentCallId else {
      reject("NO_CALL", "No active call", nil)
      return
    }
    client?.sendDTMF(callId, withDigits: tone) { error in
      if let error = error {
        reject("DTMF_FAILED", error.localizedDescription, error)
      } else {
        resolve(["success": true])
      }
    }
  }
}

// MARK: - VGVoiceClientDelegate

extension VonageVoice: VGVoiceClientDelegate {
  func voiceClient(_ client: VGVoiceClient, didReceiveInviteForCall callId: VGCallId, from caller: String, with type: VGVoiceChannelType) {
    sendEvent("onIncomingCall", body: ["callId": callId, "from": caller])
  }

  func voiceClient(_ client: VGVoiceClient, didReceiveInviteCancelForCall callId: String, with reason: VGVoiceInviteCancelReason) {
    sendEvent("onCallCancelled", body: ["callId": callId, "reason": reason.rawValue])
  }

  func voiceClient(_ client: VGVoiceClient, didReceiveHangupForCall callId: VGCallId, withQuality callQuality: VGRTCQuality, reason: VGHangupReason) {
    sendEvent("onCallEnded", body: ["callId": callId, "reason": reason.rawValue])
  }

  func voiceClient(_ client: VGVoiceClient, didReceiveMuteForCall callId: VGCallId, withLegId legId: String, andStatus isMuted: Bool) {
    let eventName = isMuted ? "onCallMuted" : "onCallUnmuted"
    sendEvent(eventName, body: ["callId": callId, "legId": legId])
  }

  func voiceClient(_ client: VGVoiceClient, didReceiveLegStatusUpdateForCall callId: VGCallId, withLegId legId: String, andStatus status: VGLegStatus) {
    print("Leg Status Update:", status.rawValue, legId)
    callStatuses[callId] = status
     print(status,"status3322")
    if status.rawValue == 2 {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            try? AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
        }
    }
    sendEvent("onCallStatus", body: ["callId": callId, "status": status.rawValue])
  }

  func client(_ client: VGBaseClient, didReceiveSessionErrorWith reason: VGSessionErrorReason) {
    sendEvent("onSessionError", body: ["reason": reason.rawValue])
  }
}

// MARK: - Event Emitter Helper

extension VonageVoice {
  /// Forward events to the shared `EventEmitter` instance.
  fileprivate func sendEvent(_ name: String, body: [String: Any]) {
    EventEmitter.shared?.sendEventToJS(name: name, body: body)
  }
}

// MARK: - EventEmitter Class
@objc(EventEmitter)
class EventEmitter: RCTEventEmitter {
  @objc public static weak var shared: EventEmitter?

  override init() {
    super.init()
    EventEmitter.shared = self
  }

  /// List of events that this emitter can send to JS.
  override func supportedEvents() -> [String]! {
    return [
      "onIncomingCall",
      "onCallStarted",
      "onCallAnswered",
      "onCallRejected",
      "onCallEnded",
      "onCallCancelled",
      "onSessionError",
      "onCallUnmuted",
      "onCallMuted",
      "onCallStatus"
    ]
  }

  /// The emitter requires the main queue for setup as it touches AVAudioSession.
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  /// Send an event to JS on the main thread; safe-guards if bridge isn't ready.
  @objc func sendEventToJS(name: String, body: [String: Any]) {
    DispatchQueue.main.async {
      if self.bridge != nil {
        self.sendEvent(withName: name, body: body)
      } else {
        print("⚠️ EventEmitter bridge not ready for event: \(name)")
      }
    }
  }
}
