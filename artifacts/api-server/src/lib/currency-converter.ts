import { db } from "./sqlite";

export interface CurrencyRecord {
  id: number;
  name: string;
  symbol: string;
  fraction?: string;
  type: "local" | "foreign";
  exchange_rate: number;
  active: number;
  decimal_places?: number;
  flag?: string;
}

/**
 * Standard ISO 4217 Currency Reference Definitions
 */
export const STANDARD_CURRENCIES_META: Record<string, {
  name: string;
  fraction: string;
  decimals: number;
  flag: string;
  defaultRateToUSD: number; // For international cross-rate calculations
}> = {
  SAR: { name: "ريال سعودي", fraction: "هللة", decimals: 2, flag: "🇸🇦", defaultRateToUSD: 3.75 },
  YER: { name: "ريال يمني", fraction: "فلس", decimals: 2, flag: "🇾🇪", defaultRateToUSD: 530 },
  USD: { name: "دولار أمريكي", fraction: "سنت", decimals: 2, flag: "🇺🇸", defaultRateToUSD: 1.0 },
  EUR: { name: "يورو أوروبي", fraction: "سنت", decimals: 2, flag: "🇪🇺", defaultRateToUSD: 0.92 },
  GBP: { name: "جنيه إسترليني", fraction: "بنس", decimals: 2, flag: "🇬🇧", defaultRateToUSD: 0.78 },
  AED: { name: "درهم إماراتي", fraction: "فلس", decimals: 2, flag: "🇦🇪", defaultRateToUSD: 3.6725 },
  KWD: { name: "دينار كويتي", fraction: "فلس", decimals: 3, flag: "🇰🇼", defaultRateToUSD: 0.307 },
  BHD: { name: "دينار بحريني", fraction: "فلس", decimals: 3, flag: "🇧🇭", defaultRateToUSD: 0.376 },
  OMR: { name: "ريال عماني", fraction: "بيسة", decimals: 3, flag: "🇴🇲", defaultRateToUSD: 0.3845 },
  QAR: { name: "ريال قطري", fraction: "درهم", decimals: 2, flag: "🇶🇦", defaultRateToUSD: 3.64 },
  JOD: { name: "دينار أردني", fraction: "قرش", decimals: 3, flag: "🇯🇴", defaultRateToUSD: 0.709 },
  EGP: { name: "جنيه مصري", fraction: "قرش", decimals: 2, flag: "🇪🇬", defaultRateToUSD: 48.5 },
  TRY: { name: "ليرة تركية", fraction: "قرش", decimals: 2, flag: "🇹🇷", defaultRateToUSD: 34.2 },
  MYR: { name: "رينغيت ماليزي", fraction: "سين", decimals: 2, flag: "🇲🇾", defaultRateToUSD: 4.35 },
};

/**
 * Normalizes currency name/symbol to standard uppercase codes (SAR, YER, USD, etc.)
 */
export function normalizeCurrencyName(input?: string | null): string {
  if (!input) return "SAR";
  const s = input.trim().toLowerCase();
  if (s === "yer" || s === "ريال يمني" || s === "يمني" || s === "ر.ي" || s === "ريال") return "YER";
  if (s === "sar" || s === "ريال سعودي" || s === "سعودي" || s === "ر.س") return "SAR";
  if (s === "usd" || s === "دولار أمريكي" || s === "دولار" || s === "$") return "USD";
  if (s === "aed" || s === "درهم إماراتي" || s === "درهم" || s === "د.إ") return "AED";
  if (s === "kwd" || s === "دينار كويتي" || s === "دينار" || s === "د.ك") return "KWD";
  if (s === "bhd" || s === "دينار بحريني" || s === "بحريني") return "BHD";
  if (s === "omr" || s === "ريال عماني" || s === "عماني") return "OMR";
  if (s === "eur" || s === "يورو" || s === "€") return "EUR";
  if (s === "gbp" || s === "جنيه إسترليني" || s === "باوند" || s === "£") return "GBP";
  if (s === "jod" || s === "دينار أردني" || s === "د.أ") return "JOD";
  if (s === "qar" || s === "ريال قطري" || s === "ر.ق") return "QAR";
  if (s === "egp" || s === "جنيه مصري" || s === "ج.م") return "EGP";
  return input.trim().toUpperCase();
}

/**
 * Gets the current primary system currency from settings table
 */
export function getSystemPrimaryCurrency(): string {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'currency'").get() as { value: string } | undefined;
    if (row && row.value) {
      return normalizeCurrencyName(row.value);
    }
  } catch {}
  return "SAR";
}

/**
 * Gets all active currencies from the currencies table
 */
export function getActiveCurrencies(): CurrencyRecord[] {
  try {
    return db.prepare("SELECT * FROM currencies WHERE active = 1").all() as CurrencyRecord[];
  } catch {
    return [];
  }
}

/**
 * Gets standard decimals for a currency (e.g. 2 for SAR/USD/YER, 3 for KWD/BHD/OMR/JOD)
 */
export function getCurrencyDecimals(currencyInput: string): number {
  const code = normalizeCurrencyName(currencyInput);
  try {
    const row = db.prepare("SELECT decimal_places FROM currencies WHERE symbol = ?").get(code) as { decimal_places?: number } | undefined;
    if (row && row.decimal_places !== undefined && row.decimal_places !== null) {
      return Number(row.decimal_places);
    }
  } catch {}
  return STANDARD_CURRENCIES_META[code]?.decimals ?? 2;
}

/**
 * Gets standard fraction name for a currency (e.g. هللة for SAR, سنت for USD, فلس for YER/KWD)
 */
export function getCurrencyFractionName(currencyInput: string): string {
  const code = normalizeCurrencyName(currencyInput);
  try {
    const row = db.prepare("SELECT fraction FROM currencies WHERE symbol = ?").get(code) as { fraction?: string } | undefined;
    if (row && row.fraction) {
      return row.fraction;
    }
  } catch {}
  return STANDARD_CURRENCIES_META[code]?.fraction ?? "جزء";
}

/**
 * Computes the conversion multiplier between two currencies.
 * Amount_In_Target = Amount_In_Source * Multiplier
 */
export function getConversionMultiplier(
  fromCurrencyInput: string,
  toCurrencyInput: string,
  customRate?: number
): number {
  const from = normalizeCurrencyName(fromCurrencyInput);
  const to = normalizeCurrencyName(toCurrencyInput);

  if (from === to) return 1.0;

  const currencies = getActiveCurrencies();
  const fromRecord = currencies.find(c => normalizeCurrencyName(c.symbol) === from || normalizeCurrencyName(c.name) === from);
  const toRecord = currencies.find(c => normalizeCurrencyName(c.symbol) === to || normalizeCurrencyName(c.name) === to);

  // 1. YER <-> SAR
  if ((from === "YER" && to === "SAR") || (from === "SAR" && to === "YER")) {
    const sarRecord = (from === "SAR" ? fromRecord : toRecord) || currencies.find(c => normalizeCurrencyName(c.symbol) === "SAR");
    let rate = Number(sarRecord?.exchange_rate) || 5.0;
    // Only use customRate if it is a meaningful exchange rate and not 1.0 (trivial local currency rate)
    if (customRate && customRate > 0 && customRate !== 1.0) {
      rate = customRate;
    }
    let yerToSar = 0.005; // default 5 SAR per 1,000 YER (or 1 SAR = 200 YER)
    if (rate <= 20) {
      yerToSar = rate / 1000.0;
    } else if (rate >= 50) {
      yerToSar = 1.0 / rate;
    } else if (rate < 0.1) {
      yerToSar = rate;
    }

    if (from === "YER" && to === "SAR") {
      return yerToSar;
    } else {
      return 1.0 / yerToSar;
    }
  }

  // 2. YER <-> USD
  if ((from === "YER" && to === "USD") || (from === "USD" && to === "YER")) {
    const usdRecord = (from === "USD" ? fromRecord : toRecord) || currencies.find(c => normalizeCurrencyName(c.symbol) === "USD");
    let rate = Number(usdRecord?.exchange_rate) || 1.88;
    if (customRate && customRate > 0 && customRate !== 1.0) {
      rate = customRate;
    }
    let yerToUsd = 1.88 / 1000.0;
    if (rate <= 20) {
      yerToUsd = rate / 1000.0;
    } else if (rate >= 50) {
      yerToUsd = 1.0 / rate;
    } else if (rate < 0.1) {
      yerToUsd = rate;
    }

    if (from === "YER" && to === "USD") {
      return yerToUsd;
    } else {
      return 1.0 / yerToUsd;
    }
  }

  // 3. International Pegged & Free Floating Exchange Rates
  // SAR <-> USD (1 USD = 3.75 SAR Pegged)
  if (from === "SAR" && to === "USD") return 1.0 / 3.75;
  if (from === "USD" && to === "SAR") return 3.75;

  // SAR <-> AED (1 AED = 1.02 SAR)
  if (from === "SAR" && to === "AED") return 1.0 / 1.02;
  if (from === "AED" && to === "SAR") return 1.02;

  // SAR <-> KWD (1 KWD = 12.25 SAR)
  if (from === "SAR" && to === "KWD") return 1.0 / 12.25;
  if (from === "KWD" && to === "SAR") return 12.25;

  // SAR <-> BHD (1 BHD = 9.95 SAR)
  if (from === "SAR" && to === "BHD") return 1.0 / 9.95;
  if (from === "BHD" && to === "SAR") return 9.95;

  // SAR <-> OMR (1 OMR = 9.75 SAR)
  if (from === "SAR" && to === "OMR") return 1.0 / 9.75;
  if (from === "OMR" && to === "SAR") return 9.75;

  // SAR <-> QAR (1 QAR = 1.03 SAR)
  if (from === "SAR" && to === "QAR") return 1.0 / 1.03;
  if (from === "QAR" && to === "SAR") return 1.03;

  // SAR <-> JOD (1 JOD = 5.29 SAR)
  if (from === "SAR" && to === "JOD") return 1.0 / 5.29;
  if (from === "JOD" && to === "SAR") return 5.29;

  // SAR <-> EUR (1 EUR = 4.10 SAR)
  if (from === "SAR" && to === "EUR") return 1.0 / 4.10;
  if (from === "EUR" && to === "SAR") return 4.10;

  // SAR <-> GBP (1 GBP = 4.85 SAR)
  if (from === "SAR" && to === "GBP") return 1.0 / 4.85;
  if (from === "GBP" && to === "SAR") return 4.85;

  // SAR <-> EGP (1 SAR = 13.0 EGP)
  if (from === "SAR" && to === "EGP") return 13.0;
  if (from === "EGP" && to === "SAR") return 1.0 / 13.0;

  // 4. Cross rates using database exchange_rate relative to local base currency
  const fromRate = fromRecord?.exchange_rate;
  const toRate = toRecord?.exchange_rate;

  if (toRate && fromRate && fromRate > 0 && toRate > 0) {
    return toRate / fromRate;
  }

  // 5. Fallback cross-rate via USD
  const fromUsd = STANDARD_CURRENCIES_META[from]?.defaultRateToUSD;
  const toUsd = STANDARD_CURRENCIES_META[to]?.defaultRateToUSD;
  if (fromUsd && toUsd && fromUsd > 0 && toUsd > 0) {
    // If rate is expressed as units per 1 USD:
    return toUsd / fromUsd;
  }

  return 1.0;
}

/**
 * Converts an amount from one currency to another rounded to standard decimal places.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRate?: number
): number {
  if (!amount || isNaN(amount)) return 0;
  const multiplier = getConversionMultiplier(fromCurrency, toCurrency, customRate);
  const decimals = getCurrencyDecimals(toCurrency);
  const factor = Math.pow(10, decimals);
  return Math.round((amount * multiplier) * factor) / factor;
}

/**
 * Formats an amount with international fraction breakdown.
 */
export function formatCurrencyAmount(
  amount: number,
  currencyCode: string
): {
  amount: number;
  decimals: number;
  fractionName: string;
  formatted: string;
  spelled: string;
} {
  const code = normalizeCurrencyName(currencyCode);
  const decimals = getCurrencyDecimals(code);
  const fractionName = getCurrencyFractionName(code);
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(amount * factor) / factor;

  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * factor);

  const metaName = STANDARD_CURRENCIES_META[code]?.name || code;
  const formatted = rounded.toLocaleString("ar-SA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const spelled = `${whole.toLocaleString("ar-SA")} ${metaName} ${frac > 0 ? `و ${frac} ${fractionName}` : ""}`.trim();

  return {
    amount: rounded,
    decimals,
    fractionName,
    formatted,
    spelled,
  };
}
