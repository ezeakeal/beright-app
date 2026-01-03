import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';

/**
 * Get the external transaction token from Google Play Billing Library
 * for Alternative Billing reporting.
 * 
 * This token must be obtained after a successful payment through
 * an alternative payment method (like Stripe) and is required
 * to report the transaction to Google Play.
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
    // Initialize connection to Google Play Billing
    await RNIap.initConnection();
    console.log('[GooglePlayBilling] Connection initialized');

    // Create alternative billing only reporting details
    // This generates the token that Google requires for server-side reporting
    const result = await RNIap.createAlternativeBillingOnlyReportingDetailsAsync();
    
    if (result && result.externalTransactionToken) {
      console.log('[GooglePlayBilling] Token generated successfully');
      return result.externalTransactionToken;
    } else {
      console.warn('[GooglePlayBilling] No token in result:', result);
      return null;
    }
  } catch (error: any) {
    console.error('[GooglePlayBilling] Failed to get token:', error?.message || error);
    return null;
  } finally {
    // Clean up connection
    try {
      await RNIap.endConnection();
    } catch (e) {
      // Silent cleanup
    }
  }
}

/**
 * Check if Alternative Billing is available on this device
 */
export async function isAlternativeBillingAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    await RNIap.initConnection();
    // If we can initialize, Alternative Billing is available
    await RNIap.endConnection();
    return true;
  } catch (error) {
    console.error('[GooglePlayBilling] Alternative Billing not available:', error);
    return false;
  }
}

