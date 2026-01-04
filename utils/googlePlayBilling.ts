import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// Use Expo's requireNativeModule for better compatibility with Expo Modules API
const GooglePlayBillingModule = requireNativeModule('GooglePlayBillingModule');

/**
 * Get the external transaction token from Google Play Billing Library
 * for Alternative Billing reporting.
 * 
 * IMPORTANT: This token must be obtained BEFORE redirecting the user to
 * the alternative payment method (Stripe). The token is unique to each
 * transaction and must be reported to Google Play after the payment succeeds.
 * 
 * @returns The external transaction token from Google Play, or null if unavailable
 */
export async function getAlternativeBillingToken(): Promise<string | null> {
  // Only works on Android
  if (Platform.OS !== 'android') {
    console.log('[GooglePlayBilling] Not on Android, skipping token generation');
    return null;
  }

  try {
    console.log('[GooglePlayBilling] Requesting token from native module...');
    const token = await GooglePlayBillingModule.getAlternativeBillingToken();
    
    if (token) {
      console.log('[GooglePlayBilling] Token generated successfully');
      return token;
    } else {
      console.warn('[GooglePlayBilling] No token returned from native module');
      return null;
    }
  } catch (error: any) {
    console.error('[GooglePlayBilling] Failed to get token:', error?.message || error);
    return null;
  }
}

