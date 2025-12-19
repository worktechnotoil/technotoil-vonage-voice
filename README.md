# VonageVoice React Native Module

VonageVoice is a React Native module that wraps the Vonage Voice SDK for mobile platforms. It exposes a promise-based JavaScript API and emits events for incoming calls and call status so you can integrate voice calling into your React Native app.

The project contains the JS wrapper, Android (Kotlin) and iOS (Swift + Objective-C extern) implementations, and an `example/` app for local testing.

**Important paths**

- `src/` — TypeScript source for the JS wrapper.
- `android/` — Android native implementation (Kotlin).
- `ios/` — iOS native implementation (Swift + Objective-C externs).
- `example/` — example React Native app used to test the module locally.

---

**Prerequisites**

- Node.js (>= 14), npm or Yarn
- Android SDK & build tools (for Android)
- Xcode & CocoaPods (for iOS)
- React Native environment set up: https://reactnative.dev/docs/environment-setup

**Table of contents**

1. Installation (local development)
2. Usage (JS)
3. API reference
4. Native setup notes (iOS / Android)
5. Development & packaging
6. Troubleshooting
7. Contributing
8. License

---

**1. Installation (local development)**

Recommended approach for working on the library and testing inside the `example` app is to build the JS output, create a local tarball and add it to the example app. This avoids Yarn Berry memory/resolution issues when adding folders directly.

From the library root:

```bash
# 1) build TypeScript => dist/
npm run build

# 2) create local package tarball
npm pack
```

Install the tarball into the example app:

```bash
cd example
yarn add ../technotoil-vonage-voice-0.1.0.tgz

# reset Metro and run the app
npx react-native start --reset-cache
yarn android   # or yarn ios
```

Alternative: use monorepo workspaces or `file:` dependency (careful to exclude `example/` from `tsc` compile). If you use Yarn v2/berry, prefer `npm pack` to avoid the YN0027/memory issues.

---

**2. Usage (JS)**

Import and call methods from the JS wrapper located at `src/`:

```js
import VonageVoice from '@technotoil/vonage-voice'

// login
VonageVoice.login(jwt).then(({ sessionId }) => console.log('session', sessionId))

// start a server call
VonageVoice.call('+1234567890', 'myNumber').then(callId => console.log('callId', callId))

// events using NativeEventEmitter
import { NativeEventEmitter, NativeModules } from 'react-native'
const emitter = new NativeEventEmitter(NativeModules.VonageVoice)
emitter.addListener('onIncomingCall', event => console.log('incoming', event))
```

---

**3. API reference (JS wrapper)**

- `login(jwt: string): Promise<{sessionId: string}>`
- `logout(): Promise<boolean>`
- `call(to: string, from: string): Promise<string>` — returns `callId`
- `answer(): Promise<boolean>`
- `reject(callId: string): Promise<boolean>`
- `hangup(callId: string): Promise<boolean>`
- `mute(callId: string): Promise<string>`
- `unmute(callId: string): Promise<string>`
- `setSpeaker(enabled: boolean): Promise<boolean>`
- `sendDTMF(tone: string): Promise<boolean>`

Events emitted (DeviceEventEmitter / NativeEventEmitter):

- `onIncomingCall` — `{ callId, from }`
- `onCallStarted` — `{ callId, to, from }`
- `onCallAnswered` — `{ callId }`
- `onCallEnded` — `{ callId }`
- `onCallRejected` — `{ callId }`

---

**4. Native setup notes**

iOS

- After adding the package to the `example` app, install CocoaPods:

```bash
cd example/ios
bundle install   # only first time if using bundler
bundle exec pod install
```

- The iOS implementation uses Swift with Objective-C externs (`VonageVoice.swift` + `VonageVoice.m`). If autolinking doesn't pick it up, ensure the files are part of the app target.

Android

- Autolinking expects the package Kotlin/Java `package` declaration to match the file path. The Android sources should live under `android/src/main/java/com/technotoil/vonagevoice/` with `package com.technotoil.vonagevoice` at the top of Kotlin files.
- The library includes `VonagePackage` (implements `ReactPackage`) and `VonageModule` (the native module). If the generated `PackageList` in the app complains about `com.technotoil.vonagevoice.VonagePackage` not found, move/rename the library Kotlin files to match the package path and rebuild.

---

**Permissions & Native SDK details**

This module uses the Vonage native voice SDKs. Make sure you add the required permissions / Info.plist keys to your app (not the library) when you integrate the package.

Android (native dependency)
- Gradle dependency used by the library: `implementation "com.vonage:client-sdk-voice:2.1.2"` (see `android/build.gradle`).
- Required Android permissions (add to `android/app/src/main/AndroidManifest.xml` of the app):
	- `android.permission.RECORD_AUDIO` — required to capture the device microphone for outgoing or two-way calls.
	- `android.permission.MODIFY_AUDIO_SETTINGS` — recommended to adjust audio routing and microphone/speaker behavior.
	- `android.permission.INTERNET` — required for network signalling and media transport.
	- `android.permission.ACCESS_NETWORK_STATE` — recommended for network state checks.

Android runtime permissions: `RECORD_AUDIO` is a dangerous permission and must be requested at runtime on Android 6.0+ (API 23+). The JS example in `example/src/App.tsx` demonstrates requesting microphone permission before starting a call.

iOS (native dependency)
- The iOS Pod dependency: `VonageClientSDKVoice` (included via `VonageVoice.podspec`).
- Required Info.plist keys (add to your app target's `Info.plist`):
	- `NSMicrophoneUsageDescription` — description shown to user when requesting microphone access.
	- `NSCameraUsageDescription` — only required if you enable video; not needed for voice-only flows.

Which functions need which permissions
- `login(jwt)` / `logout()` — network access (`INTERNET`) but no microphone permission is required.
- `call(...)`, `answer()`, `sendDTMF()` — require microphone access (`RECORD_AUDIO` / `NSMicrophoneUsageDescription`) because a call will capture audio. `sendDTMF` itself does not capture audio but is part of the active call flow so microphone permission must already be granted.
- `mute()` / `unmute()` / `setSpeaker()` / `hangup()` — operate on an active call; microphone permission should already be present.
- `getCallStatus()` / event listeners — typically only need network permission; they do not require microphone access unless the app starts an audio session.

Notes
- Always request runtime microphone permission before initiating or answering calls on Android (API 23+). On iOS, request microphone permission using `AVAudioSession`/`react-native-permissions` or the native flow the app uses; the system presents the prompt the first time the app attempts to use the microphone if `NSMicrophoneUsageDescription` is present.
- The library intentionally leaves the actual permission prompt and permission-flow control to the host app so the app can present its own UI/UX when requesting access.
- If you need helper methods for permission requests, consider using `react-native-permissions` (listed as a peerDependency) to implement consistent permission flows across Android and iOS.

Manual linking (only if autolinking cannot be used): Add `new VonagePackage()` to the list of packages in your `MainApplication` class (Android) or include the module files in your Xcode target (iOS).

---

**5. Development & packaging**

- Build JS output:

```bash
npm run build
```

- Create local tarball for testing:

```bash
npm pack
```

- Add to example and run (see Installation section).

Optional automation script (you can add to the repo):

```bash
# pack-and-install.sh
npm run build && npm pack && cd example && yarn add ../*.tgz
```

---

**6. Troubleshooting**

- Yarn/Yarn Berry memory errors when adding local folder: use `npm pack` then `yarn add ../file.tgz`.
- `tsc` building the `example` folder: update library `tsconfig.json` to exclude the example, e.g. add `"exclude": ["example", "node_modules"]` or set `"include": ["src"]`.
- Android manifest merge conflict (`application@name`): libraries should not declare an `application` element — remove app-level manifest entries from the library or use `tools:replace` in the app manifest.
- Native module undefined at runtime (`NativeModules.VonageVoice` is undefined): rebuild native app after installing the package, restart Metro with `--reset-cache`, and ensure autolinking finds the native package.

---

**7. Contributing**

- Fork the repo, create a branch, make your changes, add tests or update the `example/` app to exercise your changes, and open a PR. Keep API changes backward compatible when possible.

**8. License**

See the `LICENSE` file in this repository.

---

If you want, I can also:

- add a `USAGE.md` with common flows and examples,
- add a small `scripts/pack-and-install.sh` helper and update `package.json` scripts, or
- run an Android build in the `example` to verify autolinking.



# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
