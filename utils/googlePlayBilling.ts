import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

const GooglePlayBillingModule = requireNativeModule('GooglePlayBillingModule');

export async function getAlternativeBillingToken(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    console.log('[GooglePlayBilling] Not on Android, skipping token generation');
    return null;
  }

  if (!GooglePlayBillingModule) {
    console.error('[GooglePlayBilling] Native module not found');
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
