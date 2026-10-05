# Mobile builds

## Installable web game (fastest)

`npm ci && npm run build`, then host `dist/` at the root of an HTTPS origin. Open it once online, then install from the browser. Every production asset is cached for offline play. `npm run preview` on localhost is suitable for testing; a LAN HTTP address supports gameplay but usually not service workers/installability.

## Android

The `android/` project is already generated. Requirements: Node 22.12+, Android Studio with **Android SDK 36**, current platform/build tools, and the Java version required by Capacitor 8 / Android Gradle Plugin (use Android Studio's bundled JDK; Java 21 is recommended).

```sh
npm ci
npm run mobile:sync
npx cap open android
```

Wait for Gradle sync, choose an emulator or USB-connected device, and run. To build from a configured shell:

```sh
cd android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

For distribution, set your own application ID if needed, configure a signing key in Android Studio, and generate a signed app bundle. Keep signing credentials outside source control. Android minSdk is 24. The web assets are bundled; gameplay does not require a server.

## iPhone / iPad

Requires a Mac, Xcode supporting Capacitor 8 (Xcode 26+), iOS 15+, and an Apple signing team for physical devices/distribution. The checked-in project uses Swift Package Manager.

```sh
npm ci
npm run mobile:sync
npx cap open ios
```

Select your Team under Signing & Capabilities, choose a simulator/device, and Run. To distribute, Product → Archive, then follow Xcode Organizer's signing/export workflow.

## Before shipping

Test safe areas, rotation, app suspend/resume, low memory, audio after interruptions, exported saves, and touch placement on your target devices. Change icon/splash metadata as desired. `capacitor.config.json` contains the name, app ID, background color and bundled `dist` directory. Run `npm run mobile:sync` after changing web source.

Native wrappers were successfully generated and synchronized here. **A native binary was not compiled or signed:** this environment has no Android SDK or macOS/Xcode. The working, tested deliverable is the browser/PWA build plus ready-to-open native source projects. Mobile browser tests use Chromium touch emulation and dispatched pinch gestures; they do not replace physical-device QA.
