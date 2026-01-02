import 'dotenv/config';

export default () => ({
  expo: {
    name: "B'right",
    slug: "conflict-resolution-app",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.vadix.berightapp",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      versionCode: 2,
      package: "com.vadix.berightapp",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    owner: "danvagg",
    plugins: [
      "expo-localization",
      [
        "@stripe/stripe-react-native",
        {
          "enableGooglePay": true,
          "merchantIdentifier": "merchant.com.vadix.berightapp"
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static"
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "9c98bf2a-e3dd-49ae-a61f-2e1a69c36ac6"
      },
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
      STRIPE_MERCHANT_COUNTRY: process.env.STRIPE_MERCHANT_COUNTRY ?? "IE",
    }
  }
});


