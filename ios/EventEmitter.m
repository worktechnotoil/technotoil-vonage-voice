//
//  EventEmitter.m
//  VonageVoiceCall
//
//  Bridge declarations for the Swift `EventEmitter` class. This file exposes
//  the native emitter to React Native's bridge using the `RCT_EXTERN_MODULE`
//  macro. The Swift implementation (`EventEmitter` in `VonageVoice.swift`) is
//  responsible for the actual event sending; this file only ensures the
//  class is visible to the RN runtime when using Swift.
//
//  Notes:
//  - Keep this file minimal. Do not duplicate method declarations here — the
//    Swift class already implements `supportedEvents` and `sendEventToJS`.
//  - If you add new emitter-related methods in Swift that need to be visible
//    to Objective-C (and thus to the RN bridge), declare them via `RCT_EXTERN_METHOD`.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Make the Swift `EventEmitter` class available to React Native's bridge.
@interface RCT_EXTERN_MODULE(EventEmitter, RCTEventEmitter)
@end
