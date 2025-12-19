//
//  VonageVoice.m
//  VonageVoiceCall
//
//  Objective-C bridge file that exposes the Swift `VonageVoice` class to
//  React Native via the `RCT_EXTERN_MODULE` / `RCT_EXTERN_METHOD` macros.
//
//  This file should remain thin: it only declares the JS-facing signatures
//  (promises and event emitter usage) so that the Swift implementation can
//  be called from JavaScript.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Expose the Swift class `VonageVoice` to React Native. The Swift file
// implements the actual behavior; these extern declarations ensure the
// methods are visible to the RN bridge.
@interface RCT_EXTERN_MODULE(VonageVoice, NSObject)

/**
 * Authentication
 */
RCT_EXTERN_METHOD(
    login:(NSString *)token
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    logout:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

/**
 * Call control methods. All methods return promises and resolve/reject
 * based on the native SDK outcome.
 */
RCT_EXTERN_METHOD(
    call:(NSString *)to
    from:(NSString *)from
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    answer:(NSString *)callId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    reject:(NSString *)callId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    hangup:(NSString *)callId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    mute:(NSString *)callId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    unmute:(NSString *)callId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

/**
 * Retrieve last known call status cached on native side for the given callId.
 */
RCT_EXTERN_METHOD(
    getCallStatus:(NSString *)callId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

/**
 * Speaker control: route audio to the speaker (true) or to default (false).
 */
RCT_EXTERN_METHOD(
    setSpeaker:(BOOL)enabled
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

/**
 * DTMF – send a single DTMF tone for the current active call.
 */
RCT_EXTERN_METHOD(
    sendDTMF:(NSString *)tone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

@end
