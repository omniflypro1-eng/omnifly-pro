import { db, ensure4WhatsAppConfigTable } from "./sqlite";

export interface SystemAgencyProfile {
  businessName: string;
  businessNameEn: string;
  address: string;
  phone: string;
  secondaryPhone: string;
  whatsappPhone: string;
  allPhones: string[];
  email: string;
  website: string;
  taxNumber: string;
  licenseNumber: string;
  iataCode: string;
  logoUrl: string;
  currency: string;
  countryCode: string;
}

const PLACEHOLDER_PHONES = new Set([
  "966500000000",
  "+966500000000",
  "966505544332",
  "+966505544332",
  "+966 50 554 4332",
  "967773456789",
  "+967773456789",
  "+967 77 345 6789",
  "+966 11 456 7890",
  "966114567890",
  "+966 50 123 4567",
  "966501234567",
]);

const SEED_ADDRESSES = new Set([
  "الرياض - طريق الملك فهد - برج الأعمال",
  "الرياض - طريق الملك فهد - برج الأعمال - الطابق 4",
]);

const SEED_BUSINESS_NAMES = new Set([
  "مطعمي",
  "وكالة السفريات والسياحة ERP",
  "شركة العالمية للرحلات والسياحة",
  "وكالة أومني فلاي للسفريات والسياحة",
  "وكالة أومني فلاي برو للسياحة والسفر",
]);

export function isPlaceholderPhone(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return true;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) return true;
  return PLACEHOLDER_PHONES.has(trimmed) || PLACEHOLDER_PHONES.has(digits) || PLACEHOLDER_PHONES.has(`+${digits}`);
}

function cleanStr(val?: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

export function getSystemAgencyProfile(): SystemAgencyProfile {
  const globalMap: Record<string, string> = {};
  try {
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    for (const r of rows) {
      globalMap[r.key] = cleanStr(r.value);
    }
  } catch {}

  let travelRow: any = null;
  try {
    travelRow = db.prepare("SELECT * FROM travel_system_settings WHERE id = 1").get();
  } catch {}

  let docRow: any = null;
  try {
    docRow = db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get();
  } catch {}

  let fourWaRow: any = null;
  try {
    ensure4WhatsAppConfigTable(db);
    fourWaRow = db.prepare("SELECT * FROM travel_4whatsapp_config WHERE id = 1").get();
  } catch {}

  let waAutoRow: any = null;
  try {
    waAutoRow = db.prepare("SELECT agency_sender FROM travel_whatsapp_automation_config WHERE id = 1").get();
  } catch {}

  // 1. Business Name (General Settings > Doc Print > Travel Settings non-seed)
  const gName = cleanStr(globalMap.businessName);
  const dName = cleanStr(docRow?.company_name);
  const tName = cleanStr(travelRow?.company_name_ar);

  let businessName = "";
  if (gName && !SEED_BUSINESS_NAMES.has(gName)) {
    businessName = gName;
  } else if (dName && !SEED_BUSINESS_NAMES.has(dName)) {
    businessName = dName;
  } else if (tName && !SEED_BUSINESS_NAMES.has(tName)) {
    businessName = tName;
  } else {
    businessName = gName || dName || tName || "إدارة السفريات والسياحة";
  }

  // English Business Name: only use travelRow.company_name_en if customized OR if Arabic name was NOT customized away from seed
  const rawEnName = cleanStr(travelRow?.company_name_en);
  let businessNameEn = "";
  if (rawEnName && rawEnName !== "Al-Alamiya Travel & Tourism Co.") {
    businessNameEn = rawEnName;
  } else if (!gName || gName === tName) {
    businessNameEn = rawEnName || "Travel & Tourism Management";
  }

  // 2. Address (General Settings first, then custom Doc/Travel settings)
  const gAddr = cleanStr(globalMap.address);
  const dAddr = cleanStr(docRow?.address);
  const tAddr = cleanStr(travelRow?.address);
  let address = "";
  if (gAddr) {
    address = gAddr;
  } else if (dAddr && !SEED_ADDRESSES.has(dAddr)) {
    address = dAddr;
  } else if (tAddr && !SEED_ADDRESSES.has(tAddr)) {
    address = tAddr;
  }

  // 3. Phones (General Settings > 4WhatsApp authenticated phone > Automation sender if non-placeholder > Travel settings non-placeholder)
  const gPhone = cleanStr(globalMap.phone);
  const fourWaPhone =
    fourWaRow && (fourWaRow.is_authenticated === 1 || fourWaRow.session_status === "connected")
      ? cleanStr(fourWaRow.display_phone_number || fourWaRow.phone_number)
      : "";
  const autoSender = cleanStr(waAutoRow?.agency_sender);
  const tPhone1 = cleanStr(travelRow?.phone_primary);
  const tPhone2 = cleanStr(travelRow?.phone_secondary);
  const dPhone = cleanStr(docRow?.phone);

  const primaryCandidates = [gPhone, fourWaPhone, autoSender, tPhone1, dPhone].filter((p) => !isPlaceholderPhone(p));
  const phone = primaryCandidates[0] || "";

  const secCandidates = [tPhone2, fourWaPhone].filter((p) => !isPlaceholderPhone(p) && p.replace(/\D/g, "") !== phone.replace(/\D/g, ""));
  const secondaryPhone = secCandidates[0] || "";

  const whatsappCandidates = [fourWaPhone, autoSender, gPhone, tPhone1].filter((p) => !isPlaceholderPhone(p));
  const whatsappPhone = whatsappCandidates[0] || "";

  const allPhonesSet = new Map<string, string>();
  for (const p of [phone, secondaryPhone, whatsappPhone]) {
    if (p && !isPlaceholderPhone(p)) {
      const key = p.replace(/\D/g, "");
      if (key && !allPhonesSet.has(key)) {
        allPhonesSet.set(key, p);
      }
    }
  }
  const allPhones = Array.from(allPhonesSet.values());

  // 4. Email, Website, Tax, License
  const rawEmail = cleanStr(globalMap.email) || cleanStr(travelRow?.email);
  const email = rawEmail && rawEmail !== "info@alamiya-travel.com" ? rawEmail : "";

  const rawWebsite = cleanStr(travelRow?.website);
  const website = rawWebsite && rawWebsite !== "www.alamiya-travel.com" ? rawWebsite : "";

  const rawTax = cleanStr(globalMap.taxNumber) || cleanStr(travelRow?.tax_number);
  const taxNumber = rawTax && rawTax !== "300998877600003" ? rawTax : "";

  const rawLicense = cleanStr(travelRow?.license_number);
  const licenseNumber = rawLicense && rawLicense !== "LIC-TRV-2026-99" ? rawLicense : "";

  const rawIata = cleanStr(travelRow?.iata_code);
  const iataCode = rawIata && rawIata !== "IATA-7291823" ? rawIata : "";

  // 5. Logo URL (General Settings > Travel Settings > Doc Print > Default)
  const logoUrl =
    cleanStr(globalMap.logoUrl) ||
    cleanStr(travelRow?.logo_url) ||
    cleanStr(docRow?.logo_url) ||
    "/omnisystem-logo.png";

  // 6. Currency
  const currency = cleanStr(globalMap.currency) || cleanStr(travelRow?.default_currency) || "ريال";

  // 7. Country Code
  let countryCode = cleanStr(fourWaRow?.country_code) || "967";
  const checkPhoneDigits = (whatsappPhone || phone).replace(/\D/g, "");
  if (checkPhoneDigits.startsWith("966")) countryCode = "966";
  else if (checkPhoneDigits.startsWith("967")) countryCode = "967";
  else if (checkPhoneDigits.startsWith("971")) countryCode = "971";
  else if (checkPhoneDigits.startsWith("20")) countryCode = "20";

  return {
    businessName,
    businessNameEn,
    address,
    phone,
    secondaryPhone,
    whatsappPhone,
    allPhones,
    email,
    website,
    taxNumber,
    licenseNumber,
    iataCode,
    logoUrl,
    currency,
    countryCode,
  };
}

export function buildAgencySignatureText(agency: SystemAgencyProfile): string {
  const lines: string[] = [];
  lines.push(`🏢 *${agency.businessName}*`);
  if (agency.address) {
    lines.push(`📍 العنوان: ${agency.address}`);
  }
  if (agency.allPhones.length > 0) {
    lines.push(`📞 للتواصل والاستفسار: ${agency.allPhones.join(" | ")}`);
  }
  if (agency.email) {
    lines.push(`✉️ البريد الإلكتروني: ${agency.email}`);
  }
  return lines.join("\n");
}

export function replaceAgencyBrandPlaceholders(text: string, agency: SystemAgencyProfile): string {
  if (!text) return "";
  let out = text
    .replace(/\{agency_name\}/g, agency.businessName)
    .replace(/\{agency_address\}/g, agency.address || "")
    .replace(/\{agency_phone\}/g, agency.allPhones[0] || "")
    .replace(/\{agency_sender\}/g, agency.whatsappPhone || agency.allPhones[0] || agency.businessName)
    .replace(/\{currency\}/g, agency.currency);

  // Replace factory placeholder brand strings with actual business name configured by user
  out = out
    .replace(/وكالة أومني فلاي للسفريات والسياحة|وكالة أومني فلاي للسياحة والسفر|وكالة أومني فلاي لخدمات السفر والعمرة|وكالة أومني فلاي للسفريات|وكالة أومني فلاي/g, agency.businessName);

  // Strip any accidental placeholder phone mentions
  for (const fake of PLACEHOLDER_PHONES) {
    if (out.includes(fake)) {
      const replacement = agency.whatsappPhone || agency.allPhones[0] || "";
      out = out.split(fake).join(replacement);
    }
  }

  return out;
}
