# KENTY native applications
The React/Vite client remains the shared application UI and Supabase backend. Native packaging is added without replacing the web deployment.

## Windows desktop
Run `npm install`, then `npm run desktop:dev`. Build an NSIS installer with `npm run desktop:dist`; output is in `release/`. CI creates an unsigned installer artifact. A code-signing certificate is required for trusted publisher identity. The updater is wired to electron-updater's GitHub Releases provider; publish releases before distributing updates.

## Android
Run `npm install`, `npm run native:android:add` once, then `npm run android:sync`. Open Android Studio with `npm run android:open`. CI generates a native project and uploads a debug APK plus unsigned release AAB. A release keystore and Play Console credentials are required for publishing.

## iOS
Requires macOS, Xcode, Apple Developer membership and signing profiles. Run `npm install`, `npm run native:ios:add` once, then `npm run ios:sync` and `npm run ios:open`. Configure signing and APNs before device installation or publishing.

## Push
Native push registration is wired in `web/src/native.js` and emits `kenty:push-token`. Delivery still requires FCM credentials for Android, APNs credentials for iOS and a secure server-side sender. Never put service credentials in the client.

## Camera and microphone
Capacitor declares native camera/photo usage descriptions. Existing camera and WebRTC voice flows remain shared; validate behavior on physical devices.

## Limitations
CI artifacts are unsigned. iOS cannot be built on Windows/Linux. No signing certificates, FCM/APNs credentials or Play credentials are stored in this repository.
