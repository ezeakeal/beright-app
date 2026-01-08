# Android Studio Setup Guide for Local Builds

**Purpose:** Build the app locally to test Google Play Billing without using EAS build quota.

---

## Step 1: Install Android Studio

### macOS Installation

1. **Download Android Studio:**
   - Go to: https://developer.android.com/studio
   - Download "Android Studio Ladybug" (or latest stable version)
   - Download size: ~1.2GB

2. **Install:**
   ```bash
   # Open the downloaded DMG file
   open ~/Downloads/android-studio-*.dmg
   
   # Drag Android Studio to Applications folder
   # Launch Android Studio from Applications
   ```

3. **Initial Setup Wizard:**
   - Choose "Standard" installation
   - Select theme (light/dark)
   - Wait for SDK components to download (~3-5GB)

---

## Step 2: Configure Android SDK

### Install Required SDK Components

1. **Open SDK Manager:**
   - In Android Studio: `Tools → SDK Manager`
   - Or press: `Cmd + ,` (Preferences) → `Appearance & Behavior → System Settings → Android SDK`

2. **SDK Platforms Tab** - Install:
   - ✅ Android 14.0 (API 34) - Latest
   - ✅ Android 13.0 (API 33) - For compatibility
   - Check "Show Package Details" and ensure these are selected:
     - Android SDK Platform 34
     - Sources for Android 34

3. **SDK Tools Tab** - Install:
   - ✅ Android SDK Build-Tools (latest version)
   - ✅ Android SDK Command-line Tools (latest)
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator (optional, for testing)
   - ✅ Google Play services
   - ✅ Intel x86 Emulator Accelerator (HAXM installer) - If on Intel Mac

4. **Click "Apply"** to download and install (~5-10 minutes)

### Verify SDK Location

The SDK should be installed at:
```
/Users/danielvagg/Library/Android/sdk
```

---

## Step 3: Configure Environment Variables

### Add to Shell Configuration

**For zsh (default on macOS):**

```bash
# Open your zsh config
nano ~/.zshrc

# Add these lines at the end:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# Save and exit (Ctrl+X, then Y, then Enter)

# Reload your shell configuration
source ~/.zshrc
```

### Verify Installation

```bash
# Check Android SDK is found
echo $ANDROID_HOME
# Should output: /Users/danielvagg/Library/Android/sdk

# Check adb is available
adb --version
# Should output: Android Debug Bridge version x.x.x

# Check Java is available (Android Studio includes JDK)
java -version
# Should output: openjdk version "17.x.x" or similar
```

---

## Step 4: Configure JDK for Expo

Expo requires JDK 17 (which comes with Android Studio):

```bash
# Find Android Studio's JDK
ls /Applications/Android\ Studio.app/Contents/jbr/Contents/Home

# Add to ~/.zshrc
export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH

# Reload
source ~/.zshrc

# Verify
java -version
# Should show: openjdk version "17.x.x"
```

---

## Step 5: Accept Android SDK Licenses

This is crucial for building:

```bash
# Accept all SDK licenses
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses

# You should see multiple license acceptances
```

---

## Step 6: Build the App Locally

### Option A: Full Local Build (Recommended for Testing)

```bash
cd /Users/danielvagg/personal-repos/bright_app

# Clean any previous builds
rm -rf android/ ios/

# Generate native Android project
npx expo prebuild --clean --platform android

# Verify the billing dependency was added
cat android/app/build.gradle | grep billing
# Should output: implementation("com.android.billingclient:billing:7.1.1")

# Verify native module was copied
ls -la android/app/src/main/java/com/vadix/berightapp/GooglePlayBillingModule.kt
# Should exist

# Install dependencies
npm install

# Build release APK
cd android
./gradlew assembleRelease

# APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

### Option B: Development Build (Faster, for rapid testing)

```bash
cd /Users/danielvagg/personal-repos/bright_app

# Generate native code if not done
npx expo prebuild --platform android

# Start Metro bundler
npx expo start --clear

# In another terminal, build and install on device
npx expo run:android --variant release
```

---

## Step 7: Sign the APK (For Testing on Real Device)

### Generate Upload Keystore (First Time Only)

```bash
cd /Users/danielvagg/personal-repos/bright_app

# Create keystore directory
mkdir -p android/app

# Generate keystore
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/app/upload-keystore.keystore \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be prompted for:
# - Keystore password (e.g., "bright-app-2026")
# - Key password (same as keystore password)
# - Your name: Daniel Vagg
# - Organizational unit: Development
# - Organization: Vadix
# - City: Dublin
# - State: Dublin
# - Country: IE

# Save these credentials securely!
```

### Configure Gradle to Use Keystore

```bash
# Create gradle.properties
nano android/gradle.properties

# Add these lines:
MYAPP_UPLOAD_STORE_FILE=upload-keystore.keystore
MYAPP_UPLOAD_KEY_ALIAS=upload
MYAPP_UPLOAD_STORE_PASSWORD=your-keystore-password
MYAPP_UPLOAD_KEY_PASSWORD=your-key-password

# Save and exit
```

### Update build.gradle

```bash
nano android/app/build.gradle

# Find the signingConfigs section and update:
signingConfigs {
    release {
        if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
}
```

### Build Signed APK

```bash
cd /Users/danielvagg/personal-repos/bright_app/android
./gradlew assembleRelease

# Signed APK at:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## Step 8: Install on Device

### Via USB (Recommended)

1. **Enable Developer Options on Android Device:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings → Developer Options
   - Enable "USB Debugging"

2. **Connect Device:**
   ```bash
   # Connect phone via USB
   
   # Check device is detected
   adb devices
   # Should show: XXXXXXXXXX    device
   
   # Install APK
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   
   # Or use Expo CLI
   npx expo run:android --device
   ```

### Via File Transfer

```bash
# Copy APK to Downloads
cp android/app/build/outputs/apk/release/app-release.apk ~/Downloads/bright-app-v1.0.2.apk

# Transfer to phone (AirDrop, email, Google Drive, etc.)
# On phone: Open the APK file and install
# You may need to enable "Install from Unknown Sources"
```

---

## Step 9: Test Google Play Billing

### Check Logs While Testing

```bash
# Open real-time logs from device
adb logcat | grep -E "(GooglePlayBilling|BillingClient|BRIGHT_APP)"

# In another terminal, trigger a payment in the app
# Watch for token generation logs
```

### What to Look For

✅ **Success indicators:**
```
GooglePlayBillingModule: BillingClient connected successfully
GooglePlayBillingModule: Token generated: eyJhbGci...
GooglePlayBillingModule: Token sent to server
```

❌ **Error indicators:**
```
BillingClient: onBillingSetupFinished: BillingResult{responseCode=X, debugMessage=...}
GooglePlayBillingModule: Failed to create billing program reporting details
```

---

## Troubleshooting

### Issue: "ANDROID_HOME not found"

```bash
# Verify SDK location
ls ~/Library/Android/sdk

# If exists, add to PATH
export ANDROID_HOME=$HOME/Library/Android/sdk
source ~/.zshrc
```

### Issue: "sdkmanager: command not found"

```bash
# Install command-line tools via Android Studio
# Tools → SDK Manager → SDK Tools → Android SDK Command-line Tools
```

### Issue: "Gradle build failed"

```bash
# Clean gradle cache
cd android
./gradlew clean

# Or clean everything
cd ..
rm -rf android/build android/app/build
```

### Issue: "Device not authorized"

```bash
# On device, accept the USB debugging authorization popup
# Then retry
adb devices
```

### Issue: "App crashes on startup"

```bash
# Check logs
adb logcat *:E

# Common causes:
# - Missing google-services.json
# - Wrong package name
# - Native module not compiled
```

---

## Performance Tips

### Speed Up Builds

```bash
# Enable Gradle daemon (add to ~/.gradle/gradle.properties)
mkdir -p ~/.gradle
nano ~/.gradle/gradle.properties

# Add:
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
```

### Use Build Cache

```bash
# In android/gradle.properties, add:
android.enableBuildCache=true
android.useAndroidX=true
```

---

## Quick Reference Commands

```bash
# Build release APK
cd android && ./gradlew assembleRelease

# Install on device
adb install -r app/build/outputs/apk/release/app-release.apk

# View logs
adb logcat | grep GooglePlayBilling

# Clean build
./gradlew clean

# List connected devices
adb devices

# Uninstall app
adb uninstall com.vadix.berightapp
```

---

## Differences: Local Build vs EAS Build

| Aspect | Local Build | EAS Build |
|--------|-------------|-----------|
| **Speed** | 5-10 minutes | 15-20 minutes |
| **Cost** | Free | Quota limited |
| **Requirements** | Android Studio | GitHub + EAS account |
| **Keystore** | You manage | EAS manages |
| **Reproducibility** | Your machine only | Any machine |
| **CI/CD** | Manual | Automated |

**Recommendation:** Use local builds for rapid testing, EAS for production releases.

---

## Next Steps After Setup

1. ✅ Build the app locally
2. ✅ Install on real Android device in EEA
3. ✅ Test payment flow and token generation
4. ✅ Verify token appears in logs
5. ✅ Check Firestore for `googlePlayReported: true`
6. ✅ If successful, upload to Play Console for internal testing

---

## Estimated Time

- **Android Studio download**: 10 minutes
- **SDK installation**: 15 minutes
- **Configuration**: 10 minutes
- **First build**: 10 minutes
- **Total**: ~45 minutes

After initial setup, subsequent builds take 5-10 minutes.

---

**Last Updated:** 2026-01-08
**For:** B'right App - Google Play Alternative Billing Testing

