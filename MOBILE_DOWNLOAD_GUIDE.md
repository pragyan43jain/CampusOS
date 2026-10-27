# 📱 CampusOS Mobile Download & Packaging Guide

CampusOS can be run and installed as a standalone mobile application via two distinct distribution methods:
1. **Instant Web App (PWA)**: Zero app-store downloads, 1-tap install on Android & iOS, standalone window with no browser address bar.
2. **Native Android APK (.apk)**: Packaged via **Capacitor** with native Android manifest permissions, offline bundle, cleartext traffic support, and automated GitHub Actions CI/CD.

---

## 🚀 Option 1: Instant Mobile Install (PWA) — Fastest for Students

No sideloading or Developer Mode required. Works directly from your mobile browser:

### On Android (Google Chrome):
1. Open your deployed CampusOS URL (or local network IP `http://<your-ip>:5173`) in **Google Chrome**.
2. Tap the **Three Dots (⋮)** in the top right corner.
3. Tap **"Install app"** or **"Add to Home screen"**.
4. Tap **Install**. CampusOS will now appear in your app drawer and home screen with its official icon and launch without any browser address bar.

### On Apple iPhone (Safari):
1. Open your CampusOS URL in **Safari**.
2. Tap the **Share button (↥)** at the bottom of the screen.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right corner. The app will launch in standalone fullscreen mode.

---

## 🤖 Option 2: Native Android APK (.apk)

CampusOS includes a complete native Android project located at `frontend/android/` generated and managed by **Capacitor**.

### Method A: Automated GitHub Actions Build (Recommended)
Every push to `main` triggers our GitHub Actions workflow:
👉 **`.github/workflows/build-mobile-apk.yml`**

1. Go to your GitHub repository -> **Actions** tab.
2. Select **"Build CampusOS Mobile APK"**.
3. Click **"Run workflow"** (or view the latest completed run).
4. Under **Artifacts**, download **`CampusOS-Mobile-App`** (`app-debug.apk`).
5. Send the `.apk` to your Android phone via WhatsApp, Telegram, or Google Drive, tap to install, and enjoy CampusOS!

---

### Method B: Build Locally with Docker (No Android Studio Required)
If you have Docker installed, you can compile the `.apk` with a single command:

```bash
./scripts/build_apk_docker.sh
```

The script builds the web assets, syncs Capacitor, and compiles the native APK inside a Docker Android SDK container. Output APK is placed at:
```
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

---

### Method C: Build Locally with Android Studio or Gradle
If you have Android Studio or the Android SDK with JDK 17 installed:

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

To open and run directly on a connected Android phone or emulator:
```bash
cd frontend
npx cap open android
```
Click **Run (Green Play Button)** in Android Studio.

---

## 🌐 Connecting the Mobile App to Your Backend Server

When running CampusOS on your phone, the app needs to know where your FastAPI backend is hosted.

### 1. In-App Backend Switcher (Easiest)
1. In CampusOS, tap the **Mobile App** button in the sidebar or mobile menu.
2. Switch to the **"Backend Server"** tab.
3. Enter your backend URL:
   - **For Cloud Production**: `https://your-backend.onrender.com/api`
   - **For Campus Wi-Fi Testing**: `http://192.168.x.x:8000/api` (replace with your laptop's local IP)
   - **For Android Emulator**: `http://10.0.2.2:8000/api`
4. Tap **Save & Reconnect**. CampusOS will remember your server and reconnect instantly!

### 2. Environment Variable Configuration
When deploying the frontend to Vercel/Netlify, set:
```env
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## ⚙️ Capacitor & PWA Configuration Details

| Component | Path | Description |
|:---|:---|:---|
| **Capacitor Config** | `frontend/capacitor.config.ts` | Configures `appId: 'com.campusos.app'`, web directory, and cleartext server traffic |
| **Android Manifest** | `frontend/android/app/src/main/AndroidManifest.xml` | Declares `INTERNET` permission, `usesCleartextTraffic="true"`, and orientations |
| **App Icons & Splash** | `frontend/public/icons/` & `android/app/src/main/res/mipmap-*/` | High-DPI 192px & 512px maskable launcher icons |
| **PWA Web Manifest** | `frontend/public/manifest.json` | Standalone display mode, theme colors, and PWA metadata |
| **Service Worker** | `frontend/public/sw.js` | Caches app shell assets with network-first live API bypass |
| **CI/CD Workflow** | `.github/workflows/build-mobile-apk.yml` | GitHub Actions workflow producing downloadable `.apk` artifacts |
