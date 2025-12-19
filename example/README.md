# Example: VonageVoice

This example app demonstrates how to install and run the local `@technotoil/VonageVoice` library from the repo and how to call the basic API from JavaScript.

Prerequisites:
- macOS with Xcode (for iOS)
- Android Studio / Android SDK (for Android)
- Node.js and Yarn (or npm)
- CocoaPods (for iOS native dependencies)

Recommended local install workflow (avoids Yarn memory/copy issues):

1. From the library root (one level above `example`) create a tarball:

```sh
# from /Users/apple/Documents/Reactnative/library/@technotoil/VonageVoice
npm pack
# this produces a file like technotoil-vonagevoice-1.0.0.tgz
```

2. Install the tarball into the example app:

```sh
cd example
yarn add ../technotoil-vonagevoice-1.0.0.tgz
# OR: npm install ../technotoil-vonagevoice-1.0.0.tgz
```

3. Install iOS pods (if running iOS):

```sh
cd ios
bundle exec pod install
cd ..
```

4. Run Metro and launch the app:

```sh
# Start Metro
yarn start

# Android
yarn android

# iOS
yarn ios
```

Required Android permissions (add to `AndroidManifest.xml` of the app if needed):

- `android.permission.RECORD_AUDIO`
- `android.permission.MODIFY_AUDIO_SETTINGS`
- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`

Required iOS Info.plist entries (if using microphone/network features):

- `NSMicrophoneUsageDescription` — reason for microphone access
- `NSCameraUsageDescription` — if you use video features (not required for voice only)

Basic usage (JavaScript)

```ts
import VonageVoice from '@technotoil/VonageVoice';

// Example: login
VonageVoice.login({ apiKey: 'KEY', apiSecret: 'SECRET' })
  .then(() => console.log('logged in'))
  .catch(err => console.warn('login failed', err));

// Place a call
VonageVoice.call({ to: '+1234567890' });

// Listen to events
import { NativeEventEmitter, NativeModules } from 'react-native';
const emitter = new NativeEventEmitter(NativeModules.VonageVoice);
emitter.addListener('onCallStateChanged', event => {
  console.log('call state', event);
});
```

Notes & troubleshooting
- If you see Kotlin compile errors referring to `NativeVonageVoiceSpec`, ensure the Android module was converted to a plain `ReactContextBaseJavaModule` (this example library disables TurboModules/codegen by default).
- If you get a duplicate launcher icon on Android, ensure the library's `android/src/main/AndroidManifest.xml` does not include an `application` element with a `MAIN/LAUNCHER` activity. The example app provides the launcher activity.
- If Yarn complains about duplicate workspace names, make sure the `example/package.json` `name` is different from the library package name.
- For local development, using `npm pack` then installing the produced `.tgz` in the example is the most reliable approach.

Further work
- If you want the example project files renamed (remove the `Example` suffix across Xcode/Android project files), I can perform the multi-file rename and update Pod targets — tell me to proceed and I'll do that next.

Happy hacking!
