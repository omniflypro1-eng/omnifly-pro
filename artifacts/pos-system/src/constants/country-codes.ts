export interface CountryCodeItem {
  code: string;
  name: string;
  flag: string;
  placeholder: string;
}

export const COUNTRY_CODES: CountryCodeItem[] = [
  { code: "967", name: "اليمن (YE)", flag: "🇾🇪", placeholder: "771234567" },
  { code: "966", name: "المملكة العربية السعودية (SA)", flag: "🇸🇦", placeholder: "501234567" },
  { code: "20", name: "مصر (EG)", flag: "🇪🇬", placeholder: "1012345678" },
  { code: "971", name: "الإمارات (AE)", flag: "🇦🇪", placeholder: "501234567" },
  { code: "965", name: "الكويت (KW)", flag: "🇰🇼", placeholder: "50123456" },
  { code: "968", name: "عُمان (OM)", flag: "🇴🇲", placeholder: "91234567" },
  { code: "974", name: "قطر (QA)", flag: "🇶🇦", placeholder: "50123456" },
  { code: "973", name: "البحرين (BH)", flag: "🇧🇭", placeholder: "39123456" },
  { code: "962", name: "الأردن (JO)", flag: "🇯🇴", placeholder: "791234567" },
  { code: "964", name: "العراق (IQ)", flag: "🇮🇶", placeholder: "7701234567" },
  { code: "249", name: "السودان (SD)", flag: "🇸🇩", placeholder: "912345678" },
];
