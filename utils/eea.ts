import * as Localization from "expo-localization";

// ISO 3166-1 alpha-2, per Google Play Console Help (EEA list).
const EEA_COUNTRY_CODES = new Set<string>([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE",
]);

export function getDeviceRegionCode(): string | null {
  const locales = Localization.getLocales();
  const regionCode = locales?.[0]?.regionCode;
  if (!regionCode) return null;
  return String(regionCode).toUpperCase();
}

export function isEeaCountryCode(regionCode: string): boolean {
  return EEA_COUNTRY_CODES.has(String(regionCode).toUpperCase());
}



