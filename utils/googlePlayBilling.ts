import { Platform } from 'react-native';
import {
  initConnection,
  checkAlternativeBillingAvailabilityAndroid,
  showAlternativeBillingDialogAndroid,
  createAlternativeBillingTokenAndroid,
  endConnection,
} from 'react-native-iap';

let isInitialized = false;

export async function getAlternativeBillingToken(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    console.log('[GooglePlayBilling] Not on Android, skipping token generation');
    return null;
  }

  if (!isInitialized) {
    console.log('[GooglePlayBilling] Initializing IAP connection...');
    await initConnection({
      alternativeBillingModeAndroid: 'alternative-only',
    });
    isInitialized = true;
  }

  // 3-step alternative billing flow (react-native-iap 14.4.12):
  // 1) availability -> 2) disclosure dialog -> 3) token
  console.log('[GooglePlayBilling] Checking alternative billing availability...');
  const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
  if (!isAvailable) {
    console.warn('[GooglePlayBilling] Alternative billing not available');
    return null;
  }

  console.log('[GooglePlayBilling] Showing alternative billing dialog...');
  const userAccepted = await showAlternativeBillingDialogAndroid();
  if (!userAccepted) {
    throw new Error('User did not accept the alternative billing dialog.');
  }

  console.log('[GooglePlayBilling] Creating alternative billing token...');
  const token = await createAlternativeBillingTokenAndroid();
  if (!token) {
    throw new Error('No external transaction token returned from Google Play.');
  }

  console.log('[GooglePlayBilling] Token generated successfully');
  return token;
}

export async function cleanupBillingConnection(): Promise<void> {
  if (!isInitialized) return;
  await endConnection();
  isInitialized = false;
  console.log('[GooglePlayBilling] Connection closed');
}
