import { NativeModules, NativeEventEmitter } from 'react-native';

// Destructure native modules
const { VonageVoice, EventEmitter } = NativeModules;

// Warn if the VonageVoice module is not properly linked
if (!VonageVoice) {
  console.warn(
    '⚠️ VonageVoice native module not found — check iOS/Android bridge setup'
  );
}

// Use the native EventEmitter for listening to VonageVoice events
const eventEmitter = new NativeEventEmitter(EventEmitter);

/**
 * VonageVoiceModule
 * A JS wrapper around the native VonageVoice module.
 * Provides call management, login/logout, DTMF, and event handling.
 */
const VonageVoiceModule = {
  // ---------------------------
  // --- Core Authentication ---
  // ---------------------------
  /**
   * Log in to Vonage with a token
   * @param token - JWT or access token
   */
  login: (token: string) => VonageVoice?.login(token),

  /**
   * Log out from Vonage
   */
  logout: () => VonageVoice?.logout(),

  // ---------------------------
  // --- Call Controls ---
  // ---------------------------

  /**
   * Initiate a call
   * @param to - recipient identifier (number or userId)
   * @param from - sender identifier
   */
  call: (to: string, from: string) => VonageVoice?.call(to, from),

  /**
   * Answer an incoming call
   * @param callId - ID of the call to answer
   */
  answer: (callId: string) => VonageVoice?.answer(callId),

  /**
   * Reject an incoming call
   * @param callId - ID of the call to reject
   */
  reject: (callId: string) => VonageVoice?.reject(callId),

  /**
   * Hang up an ongoing call
   * @param callId - ID of the call to hang up
   */
  hangup: (callId: string) => VonageVoice?.hangup(callId),

  /**
   * Mute an ongoing call
   * @param callId - ID of the call to mute
   */
  mute: (callId: string) => VonageVoice?.mute(callId),

  /**
   * Unmute an ongoing call
   * @param callId - ID of the call to unmute
   */
  unmute: (callId: string) => VonageVoice?.unmute(callId),

  /**
   * Get the status of a call
   * @param callId - ID of the call
   */
  getCallStatus: (callId: string) => VonageVoice?.getCallStatus(callId),

  /**
   * Enable or disable speakerphone
   * @param enabled - true to enable speaker, false to disable
   */
  setSpeaker: (enabled: boolean) => VonageVoice?.setSpeaker(enabled),

  // ---------------------------
  // --- DTMF (Dual-tone multi-frequency) ---
  // ---------------------------

  /**
   * Send a DTMF tone during a call
   * @param tone - The DTMF tone to send
   */
  sendDTMF: (tone: string) => VonageVoice?.sendDTMF(tone),

  // ---------------------------
  // --- Event Handling ---
  // ---------------------------

  /**
   * Add an event listener
   * @param eventName - Name of the event to listen to
   * @param handler - Callback function executed on event
   * @returns { remove: () => void } - Object with remove function to unsubscribe
   */
  addListener: (eventName: string, handler: (...args: any[]) => void) => {
    const subscription = eventEmitter.addListener(eventName, handler);
    return {
      remove: () => subscription.remove(),
    };
  },

  /**
   * Remove all listeners for a specific event
   * @param eventName - Name of the event
   */
  removeAllListeners: (eventName: string) => {
    eventEmitter.removeAllListeners(eventName);
  },
};

export default VonageVoiceModule;
