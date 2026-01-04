#!/bin/bash

# EAS Build Hook: Copy custom Android files after prebuild
# This hook runs after Expo prebuild generates the Android project

echo "🔧 Copying custom Android files..."

ANDROID_APP_DIR="$EAS_BUILD_WORKINGDIR/android/app"
ANDROID_MAIN_DIR="$ANDROID_APP_DIR/src/main/java/com/vadix/berightapp"

# Create directory if it doesn't exist
mkdir -p "$ANDROID_MAIN_DIR"

# Copy custom native modules
cp "$EAS_BUILD_WORKINGDIR/native-modules/GooglePlayBillingModule.kt" "$ANDROID_MAIN_DIR/"
cp "$EAS_BUILD_WORKINGDIR/native-modules/GooglePlayBillingPackage.kt" "$ANDROID_MAIN_DIR/"
cp "$EAS_BUILD_WORKINGDIR/native-modules/MainApplication.kt" "$ANDROID_MAIN_DIR/"

echo "✅ Custom Android files copied"

# Add Google Play Billing Library dependency to build.gradle
BUILD_GRADLE="$ANDROID_APP_DIR/build.gradle"

if ! grep -q "com.android.billingclient:billing" "$BUILD_GRADLE"; then
    echo "📦 Adding Google Play Billing Library dependency..."
    
    # Find the dependencies block and add the billing library
    sed -i.bak '/dependencies {/a\
    // Google Play Billing Library for Alternative Billing\
    implementation("com.android.billingclient:billing:6.1.0")\
' "$BUILD_GRADLE"
    
    echo "✅ Billing Library dependency added"
else
    echo "✅ Billing Library dependency already present"
fi

echo "🎉 EAS build hook completed successfully"

