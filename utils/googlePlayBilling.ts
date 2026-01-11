import { Platform } from 'react-native';
import {
  initConnection,
  checkAlternativeBillingAvailabilityAndroid,
  createAlternativeBillingTokenAndroid,
  endConnection,
} from 'react-native-iap';

let isInitialized = false;

export async function getAlternativeBillingToken(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    console.log('[GooglePlayBilling] Not on Android, skipping token generation');
    return null;
  }

  try {
    // Initialize connection with alternative billing mode
    if (!isInitialized) {
      console.log('[GooglePlayBilling] Initializing IAP connection...');
      await initConnection({
        alternativeBillingModeAndroid: 'alternative-only',
      });
      isInitialized = true;
    }

    // Check if alternative billing is available
    console.log('[GooglePlayBilling] Checking alternative billing availability...');
    const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
    
    if (!isAvailable) {
      console.warn('[GooglePlayBilling] Alternative billing not available');
      return null;
    }

    // Generate the external transaction token
    // Note: We pass a dummy productId since we're using Stripe for actual payment
    console.log('[GooglePlayBilling] Creating alternative billing token...');
    const token = await createAlternativeBillingTokenAndroid('credits');

    if (token) {
      console.log('[GooglePlayBilling] Token generated successfully');
      return token;
    } else {
      console.warn('[GooglePlayBilling] No token returned');
      return null;
    }
  } catch (error: any) {
    console.error('[GooglePlayBilling] Failed to get token:', error?.message || error);
    return null;
  }
}

// Clean up connection when app closes
export async function cleanupBillingConnection(): Promise<void> {
  if (isInitialized) {
    try {
      await endConnection();
      isInitialized = false;
      console.log('[GooglePlayBilling] Connection closed');
    } catch (error: any) {
      console.error('[GooglePlayBilling] Error closing connection:', error?.message);
    }
  }
}
