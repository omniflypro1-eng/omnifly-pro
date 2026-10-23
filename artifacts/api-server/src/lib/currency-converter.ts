import { db } from "./sqlite";

export interface CurrencyRecord {
  id: number;
  name: string;
  symbol: string;
  fraction?: string;
  type: "local" | "foreign";
  exchange_rate: number;
  active: number;
}

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
  if (s === "eur" || s === "يورو" || s === "€") return "EUR";
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

  // YER <-> SAR
  if (from === "YER" && to === "SAR") {
    const rate = customRate || toRecord?.exchange_rate || 4.0;
    if (rate <= 20) {
      // In Yemen: Rate '4' means 4 SAR per 1,000 YER (1,000,000 * 4 / 1000 = 4,000 SAR)
      return rate / 1000.0;
    }
    if (rate >= 50) {
      // In Yemen: Rate '250' means 250 YER per 1 SAR (1,000,000 / 250 = 4,000 SAR)
      return 1.0 / rate;
    }
    return rate; // e.g. 0.004
  }

  if (from === "SAR" && to === "YER") {
    const rate = customRate || fromRecord?.exchange_rate || 4.0;
    if (rate <= 20) {
      // In Yemen: 4,000 SAR * 1000 / 4 = 1,000,000 YER
      return 1000.0 / rate;
    }
    if (rate >= 50) {
      // In Yemen: 4,000 SAR * 250 = 1,000,000 YER
      return rate;
    }
    return 1.0 / rate;
  }

  // YER <-> USD
  if (from === "YER" && to === "USD") {
    const rate = customRate || toRecord?.exchange_rate || 1.88;
    if (rate <= 20) return rate / 1000.0; // 1,000,000 * 1.88 / 1000 = 1880 USD
    if (rate >= 50) return 1.0 / rate;    // 1,000,000 / 530 = 1886.79 USD
    return rate;
  }

  if (from === "USD" && to === "YER") {
    const rate = customRate || fromRecord?.exchange_rate || 1.88;
    if (rate <= 20) return 1000.0 / rate;
    if (rate >= 50) return rate;
    return 1.0 / rate;
  }

  // SAR <-> USD (1 USD = 3.75 SAR)
  if (from === "SAR" && to === "USD") return 1.0 / 3.75;
  if (from === "USD" && to === "SAR") return 3.75;

  // SAR <-> AED (1 AED = 1.02 SAR)
  if (from === "SAR" && to === "AED") return 1.0 / 1.02;
  if (from === "AED" && to === "SAR") return 1.02;

  // General fallback using exchange_rate relative to local currency
  const fromRate = fromRecord?.exchange_rate || 1.0;
  const toRate = toRecord?.exchange_rate || 1.0;

  if (toRate && fromRate) {
    return toRate / fromRate;
  }

  return 1.0;
}

/**
 * Converts an amount from one currency to another rounded to 2 decimal places.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRate?: number
): number {
  if (!amount || isNaN(amount)) return 0;
  const multiplier = getConversionMultiplier(fromCurrency, toCurrency, customRate);
  return Math.round((amount * multiplier) * 100) / 100;
}
