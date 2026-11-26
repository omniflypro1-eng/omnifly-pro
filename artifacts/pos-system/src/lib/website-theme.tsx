import React from "react";

export interface WebsiteFeatureItem {
  id: string;
  icon: "shield" | "zap" | "headphones" | "globe" | "award" | "clock";
  title: string;
  subtitle: string;
  enabled: boolean;
}

export interface WebsiteSectionConfig {
  id:
    | "hero"
    | "features"
    | "services_showcase"
    | "booking_console"
    | "promotions"
    | "inquiry_contact"
    | "footer";
  label: string;
  enabled: boolean;
  title?: string;
  subtitle?: string;
}

export interface WebsiteHeroSlide {
  id: string;
  title: string;
  highlight: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_link: string;
}

export interface WebsiteNavLink {
  id: string;
  label: string;
  target: string;
  tab?: string;
  enabled: boolean;
}

export interface WebsiteShowcaseServiceItem {
  id: string;
  title: string;
  subtitle: string;
  icon: "plane" | "hotel" | "visa" | "passengers" | "compass" | "car" | "bus" | "shield" | "globe";
  target: string;
  tab?: string;
  image_url?: string;
  enabled: boolean;
}

export interface WebsitePromotion {
  id?: number;
  title: string;
  subtitle?: string;
  badge?: string;
  discount_text?: string;
  image_url?: string;
  link_url?: string;
  is_active?: number;
  sort_order?: number;
}

export interface WebsiteThemeConfig {
  id?: number;
  tenant_id?: number;
  tenant_code?: string;
  company_name?: string;

  // Brand identity & contact
  site_name: string;
  site_slogan: string;
  phone: string;
  secondary_phone: string;
  whatsapp: string;
  email: string;
  address: string;
  geo_location: string;
  topbar_announcement: string;
  topbar_text: string;
  customer_service_name: string;
  announcement_badge_1: string;
  announcement_badge_2: string;
  nav_subtitle: string;
  social_handle: string;
  facebook_url: string;
  x_url: string;
  instagram_url: string;
  show_social_links: number;
  show_login_btn: number;
  show_register_btn: number;

  // Hero & CTA
  hero_title: string;
  hero_title_2: string;
  hero_title_3: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_slides_json: string;
  hero_cta_primary_text: string;
  hero_cta_primary_link: string;
  hero_cta_secondary_text: string;
  hero_cta_secondary_link: string;

  // Logos & Media
  logo_url: string;
  system_logo_url: string;
  itqan_logo_url: string;
  header_logo_type: "company" | "system" | "itqan";
  footer_logo_type: "company" | "system" | "itqan";
  favicon_url: string;
  rides_image_url: string;
  flight_image_url: string;
  hotel_image_url: string;
  packages_image_url: string;
  visas_image_url: string;

  // 12 Color Controls
  primary_color: string;
  secondary_color: string;
  button_color: string;
  button_hover_color: string;
  background_color: string;
  card_bg_color: string;
  text_primary_color: string;
  text_secondary_color: string;
  link_color: string;
  border_color: string;
  navbar_bg_color: string;
  footer_bg_color: string;

  // Design Styles & Typography
  design_style: "modern" | "minimal" | "formal";
  theme_mode: "light" | "dark" | "auto";
  button_radius: "pill" | "rounded" | "square";
  card_radius: "none" | "md" | "lg" | "2xl";
  shadow_level: "none" | "soft" | "medium";
  font_family: string;
  base_font_size: number;
  content_width: "compact" | "standard" | "wide";
  section_spacing: "compact" | "normal" | "relaxed";
  background_pattern: "solid" | "dots" | "grid" | "gradient";

  // Dynamic Sections & Content
  sections_config_json: string;
  features_json: string;
  nav_links_json: string;
  services_showcase_json: string;
  inquiry_title: string;
  inquiry_subtitle: string;

  // Services toggles & pricing
  rides_enabled: number;
  flight_enabled: number;
  hotel_enabled: number;
  packages_enabled: number;
  visas_enabled: number;
  bus_enabled: number;
  insurance_enabled: number;
  flight_markup_val: number;
  hotel_markup_val: number;
  package_markup_val: number;
  payment_card_enabled: number;
  payment_bank_enabled: number;
  payment_cash_enabled: number;
  bank_name: string;
  bank_iban: string;
  bank_account_name: string;
  promo_code: string;
  promo_discount_percent: number;
  promo_min_passengers: number;
  promo_required_service: string;
  currency: string;
  require_id_upload: number;
  show_id_upload: number;
  team_notification_phone: string;

  // 4WhatsApp OTP & Customer Registration Control
  enable_whatsapp_otp: number;
  require_whatsapp_otp: number;

  // Image & Media Visibility Controls
  show_website_images: number;
  show_hero_image: number;
  show_services_images: number;
  show_site_logos: number;

  // Footer
  footer_desc: string;
  footer_quick_services_title: string;
  footer_contact_title: string;
  footer_address: string;
  footer_guarantee_title: string;
  footer_guarantee_desc: string;
  footer_license_badge: string;
  footer_copyright: string;

  // Meta & Draft state
  custom_domain?: string;
  subdomain?: string;
  has_unpublished_changes?: boolean;
  published_at?: string;
  draft_config?: Partial<WebsiteThemeConfig> | null;
  promotions?: WebsitePromotion[];
}

export interface ColorFieldMeta {
  key: keyof Pick<
    WebsiteThemeConfig,
    | "primary_color"
    | "secondary_color"
    | "button_color"
    | "button_hover_color"
    | "background_color"
    | "card_bg_color"
    | "text_primary_color"
    | "text_secondary_color"
    | "link_color"
    | "border_color"
    | "navbar_bg_color"
    | "footer_bg_color"
  >;
  label: string;
  hint: string;
  defaultHex: string;
}

export const COLOR_FIELD_META: ColorFieldMeta[] = [
  { key: "primary_color", label: "اللون الأساسي (Primary)", hint: "لون الهوية الرئيسي والعناوين البارزة", defaultHex: "#0D6EFD" },
  { key: "secondary_color", label: "اللون الثانوي (Secondary)", hint: "لون العناصر التكميلية والتمييز البصري", defaultHex: "#F59E0B" },
  { key: "button_color", label: "لون الأزرار (Button)", hint: "الخلفية الأساسية لأزرار الحجز والبحث", defaultHex: "#0D6EFD" },
  { key: "button_hover_color", label: "لون الأزرار عند التمرير (Hover)", hint: "درجة اللون التفاعلية عند مرور المؤشر", defaultHex: "#0B5ED7" },
  { key: "background_color", label: "لون الخلفية العامة (Background)", hint: "خلفية صفحات الموقع بالكامل", defaultHex: "#F8FAFC" },
  { key: "card_bg_color", label: "لون البطاقات والحاويات (Cards)", hint: "خلفية بطاقات الرحلات والفنادق والخدمات", defaultHex: "#FFFFFF" },
  { key: "text_primary_color", label: "لون النص الرئيسي", hint: "العناوين والمحتوى الأساسي", defaultHex: "#0F172A" },
  { key: "text_secondary_color", label: "لون النص الثانوي", hint: "الأوصاف والتفاصيل الفرعية", defaultHex: "#475569" },
  { key: "link_color", label: "لون الروابط (Links)", hint: "روابط القوائم والروابط التفاعلية", defaultHex: "#0D6EFD" },
  { key: "border_color", label: "لون الحدود والفواصل (Borders)", hint: "إطارات البطاقات والمدخلات والفواصل", defaultHex: "#E2E8F0" },
  { key: "navbar_bg_color", label: "خلفية شريط التنقل (Navbar)", hint: "خلفية الشريط العلوي الرئيسي", defaultHex: "#FFFFFF" },
  { key: "footer_bg_color", label: "خلفية التذييل (Footer)", hint: "خلفية تذييل الموقع والشريط الإعلاني", defaultHex: "#0F294A" }
];

export const ARABIC_FONT_OPTIONS = [
  { value: "Tajawal", label: "Tajawal — عصري ومقروء (الافتراضي)" },
  { value: "Cairo", label: "Cairo — هندسي حديث وواضح" },
  { value: "Almarai", label: "Almarai — رسمي مؤسسي نظيف" },
  { value: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic — تقني متوازن" },
  { value: "Noto Sans Arabic", label: "Noto Sans Arabic — كلاسيكي متوافق" }
];

export const DEFAULT_FEATURES: WebsiteFeatureItem[] = [
  {
    id: "feat-security",
    icon: "shield",
    title: "أمان عالي وحماية للبيانات",
    subtitle: "تشفير كامل لبيانات المسافرين والمعاملات",
    enabled: true
  },
  {
    id: "feat-speed",
    icon: "zap",
    title: "سرعة في الأداء واستجابة فورية",
    subtitle: "حجز وإصدار فوري برقم مرجعي PNR معتمد",
    enabled: true
  },
  {
    id: "feat-support",
    icon: "headphones",
    title: "دعم فني متميز على مدار الساعة",
    subtitle: "فريق خدمة عملاء متخصص طوال أيام الأسبوع",
    enabled: true
  },
  {
    id: "feat-devices",
    icon: "globe",
    title: "متوافق مع جميع الأجهزة",
    subtitle: "تجربة سلسة على الكمبيوتر والتابلت والجوال",
    enabled: true
  }
];

export const DEFAULT_SECTIONS_CONFIG: WebsiteSectionConfig[] = [
  { id: "hero", label: "البنر الرئيسي (Hero)", enabled: true, title: "سافر بكل راحة وأمان..", subtitle: "حلول متكاملة لإدارة وكالات السفر والسياحة بأحدث التقنيات وخدمات احترافية" },
  { id: "features", label: "شريط المزايا والثقة (Features)", enabled: true, title: "لماذا تختار بوابتنا؟", subtitle: "معايير عالية للسرعة والأمان والموثوقية" },
  { id: "services_showcase", label: "معرض أهم الخدمات (Showcase)", enabled: true, title: "أهم خدمات النظام", subtitle: "كل ما تحتاجه لإدارة أعمال السفر والسياحة في مكان واحد" },
  { id: "booking_console", label: "منصة البحث والحجز التفاعلية", enabled: true, title: "منصة الحجوزات الفورية", subtitle: "ابحث واحجز الرحلات والفنادق والمشاوير والتأشيرات مباشرة" },
  { id: "promotions", label: "البنرات الإعلانية والعروض (Promos)", enabled: true, title: "أحدث العروض الحصرية", subtitle: "باقات وعروض موسمية مخصصة لك" },
  { id: "inquiry_contact", label: "نموذج الطلبات والتواصل المباشر", enabled: true, title: "هل تحتاج ترتيب رحلة خاصة أو باقة سفر؟", subtitle: "تواصل مع مستشار السفر مباشرة وسنرد عليك فوراً" },
  { id: "footer", label: "تذييل الموقع (Footer)", enabled: true }
];

export const DEFAULT_NAV_LINKS: WebsiteNavLink[] = [
  { id: "nav-home", label: "الرئيسية", target: "#hero-section", enabled: true },
  { id: "nav-services", label: "الخدمات", target: "#services-showcase", enabled: true },
  { id: "nav-flights", label: "الرحلات", target: "#booking-console", tab: "flights", enabled: true },
  { id: "nav-bookings", label: "الحجوزات", target: "#booking-console", tab: "lookup", enabled: true },
  { id: "nav-visas", label: "التأشيرات", target: "#booking-console", tab: "visas", enabled: true },
  { id: "nav-contact", label: "تواصل معنا", target: "#contact-section", enabled: true }
];

export const DEFAULT_SHOWCASE_SERVICES: WebsiteShowcaseServiceItem[] = [
  {
    id: "srv-flights",
    title: "حجوزات الطيران",
    subtitle: "رحلات دولية ومحلية فورية",
    icon: "plane",
    target: "#booking-console",
    tab: "flights",
    enabled: true
  },
  {
    id: "srv-hotels",
    title: "حجوزات الفنادق",
    subtitle: "فنادق ومنتجعات فاخرة",
    icon: "hotel",
    target: "#booking-console",
    tab: "hotels",
    enabled: true
  },
  {
    id: "srv-visas",
    title: "التأشيرات والجوازات",
    subtitle: "معاملات وتأشيرات سريعة",
    icon: "visa",
    target: "#booking-console",
    tab: "visas",
    enabled: true
  },
  {
    id: "srv-passengers",
    title: "إدارة المسافرين",
    subtitle: "تتبع الحجوزات وبيانات المسافر",
    icon: "passengers",
    target: "#booking-console",
    tab: "lookup",
    enabled: true
  },
  {
    id: "srv-tourism",
    title: "خدمات السفر والسياحة",
    subtitle: "برامج وباقات سياحية متكاملة",
    icon: "compass",
    target: "#booking-console",
    tab: "packages",
    enabled: true
  },
  {
    id: "srv-rides",
    title: "المشاوير والنقل VIP",
    subtitle: "توصيل المطارات والحرمين",
    icon: "car",
    target: "#booking-console",
    tab: "rides",
    enabled: true
  }
];

export const DEFAULT_WEBSITE_THEME: WebsiteThemeConfig = {
  site_name: "اتقان سوفت للسفريات والسياحة",
  site_slogan: "حلول متكاملة لإدارة وكالات السفر والسياحة بأحدث التقنيات",
  phone: "+966 50 123 4567",
  secondary_phone: "",
  whatsapp: "966501234567",
  email: "reservations@itqansoft-travel.sa",
  address: "الرياض - المملكة العربية السعودية",
  geo_location: "الرياض • المملكة العربية السعودية",
  topbar_announcement: "اتقان سوفت • بوابة السفريات والسياحة الذكية",
  topbar_text: "خدمة العملاء 24/7",
  customer_service_name: "فريق خدمة العملاء المعتمد",
  announcement_badge_1: "بياناتك آمنة ومحمية",
  announcement_badge_2: "حجوزات فورية 24/7",
  nav_subtitle: "منصة الحجوزات والسفر الحديثة",
  social_handle: "@ItqanSoft",
  facebook_url: "",
  x_url: "",
  instagram_url: "",
  show_social_links: 1,
  show_login_btn: 1,
  show_register_btn: 1,

  hero_title: "سافر بكل راحة وأمان ..",
  hero_title_2: "سافر بكل راحة وأمان ..",
  hero_title_3: "مع اتقان سوفت",
  hero_subtitle: "حلول متكاملة لإدارة وكالات السفر والسياحة بأحدث التقنيات وخدمات احترافية للطيران والفنادق والتأشيرات والمشاوير.",
  hero_image_url: "",
  hero_slides_json: "",
  hero_cta_primary_text: "ابدأ البحث عن الرحلات",
  hero_cta_primary_link: "#booking-console",
  hero_cta_secondary_text: "استعراض الخدمات",
  hero_cta_secondary_link: "#services-showcase",

  logo_url: "",
  system_logo_url: "",
  itqan_logo_url: "",
  header_logo_type: "company",
  footer_logo_type: "company",
  favicon_url: "",
  rides_image_url: "",
  flight_image_url: "",
  hotel_image_url: "",
  packages_image_url: "",
  visas_image_url: "",

  primary_color: "#0D6EFD",
  secondary_color: "#F59E0B",
  button_color: "#0D6EFD",
  button_hover_color: "#0B5ED7",
  background_color: "#F8FAFC",
  card_bg_color: "#FFFFFF",
  text_primary_color: "#0F172A",
  text_secondary_color: "#475569",
  link_color: "#0D6EFD",
  border_color: "#E2E8F0",
  navbar_bg_color: "#FFFFFF",
  footer_bg_color: "#0F294A",

  design_style: "modern",
  theme_mode: "light",
  button_radius: "rounded",
  card_radius: "lg",
  shadow_level: "soft",
  font_family: "Tajawal",
  base_font_size: 16,
  content_width: "standard",
  section_spacing: "normal",
  background_pattern: "solid",

  sections_config_json: JSON.stringify(DEFAULT_SECTIONS_CONFIG),
  features_json: JSON.stringify(DEFAULT_FEATURES),
  nav_links_json: JSON.stringify(DEFAULT_NAV_LINKS),
  services_showcase_json: JSON.stringify(DEFAULT_SHOWCASE_SERVICES),
  inquiry_title: "هل تحتاج ترتيب مشوار خاص أو باقة سفر عائلية؟",
  inquiry_subtitle: "مستشارو السفر جاهزون لتلبية طلباتك على مدار الساعة",

  rides_enabled: 1,
  flight_enabled: 1,
  hotel_enabled: 1,
  packages_enabled: 1,
  visas_enabled: 1,
  bus_enabled: 1,
  insurance_enabled: 1,
  flight_markup_val: 5,
  hotel_markup_val: 8,
  package_markup_val: 10,
  payment_card_enabled: 1,
  payment_bank_enabled: 1,
  payment_cash_enabled: 1,
  bank_name: "مصرف الراجحي",
  bank_iban: "SA0000000000000000000000",
  bank_account_name: "اتقان سوفت للسفريات والسياحة",
  promo_code: "ITQAN10",
  promo_discount_percent: 10,
  promo_min_passengers: 1,
  promo_required_service: "",
  currency: "SAR",
  require_id_upload: 0,
  show_id_upload: 1,
  team_notification_phone: "",

  enable_whatsapp_otp: 1,
  require_whatsapp_otp: 1,
  show_website_images: 1,
  show_hero_image: 1,
  show_services_images: 1,
  show_site_logos: 1,

  footer_desc: "منصة سفر وسياحة متكاملة تجمع بين الحجوزات الفورية للطيران والفنادق والمشاوير والتأشيرات بأعلى معايير الموثوقية.",
  footer_quick_services_title: "الخدمات السريعة",
  footer_contact_title: "التواصل المباشر",
  footer_address: "الرياض - المملكة العربية السعودية",
  footer_guarantee_title: "ضمانات الخدمة",
  footer_guarantee_desc: "جميع الحجوزات مؤكدة برقم مرجعي PNR معتمد، مع متابعة دقيقة وتواصل مباشر عبر الواتساب.",
  footer_license_badge: "حجوزات آمنة ومعتمدة 100%",
  footer_copyright: `جميع الحقوق محفوظة © ${new Date().getFullYear()} اتقان سوفت للسفريات والسياحة`
};

export function validateHexColor(hex?: string | null, fallback = "#0D6EFD"): string {
  if (!hex || typeof hex !== "string") return fallback;
  const trimmed = hex.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function safeJsonParse<T>(raw: any, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function normalizeWebsiteConfig(raw?: Partial<WebsiteThemeConfig> | null): WebsiteThemeConfig {
  const merged = { ...DEFAULT_WEBSITE_THEME, ...(raw || {}) } as WebsiteThemeConfig;
  for (const field of COLOR_FIELD_META) {
    (merged as any)[field.key] = validateHexColor((merged as any)[field.key], field.defaultHex);
  }
  merged.base_font_size = Math.min(20, Math.max(13, Number(merged.base_font_size) || 16));
  if (!["modern", "minimal", "formal"].includes(merged.design_style)) merged.design_style = "modern";
  if (!["light", "dark", "auto"].includes(merged.theme_mode)) merged.theme_mode = "light";
  if (!["pill", "rounded", "square"].includes(merged.button_radius)) merged.button_radius = "rounded";
  if (!["none", "md", "lg", "2xl"].includes(merged.card_radius)) merged.card_radius = "lg";
  if (!["none", "soft", "medium"].includes(merged.shadow_level)) merged.shadow_level = "soft";
  if (!["compact", "standard", "wide"].includes(merged.content_width)) merged.content_width = "standard";
  if (!["compact", "normal", "relaxed"].includes(merged.section_spacing)) merged.section_spacing = "normal";
  if (!["solid", "dots", "grid", "gradient"].includes(merged.background_pattern)) merged.background_pattern = "solid";
  if (!["company", "system", "itqan"].includes(merged.header_logo_type)) merged.header_logo_type = "company";
  if (!["company", "system", "itqan"].includes(merged.footer_logo_type)) merged.footer_logo_type = "company";
  return merged;
}

export function resolveEffectiveThemeConfig(
  cfg: WebsiteThemeConfig,
  prefersDark = false
): WebsiteThemeConfig {
  const norm = normalizeWebsiteConfig(cfg);
  const isDark = norm.theme_mode === "dark" || (norm.theme_mode === "auto" && prefersDark);
  if (!isDark) return norm;
  // In dark mode, keep custom colors if explicitly changed from defaults or adapt neutral surfaces safely
  return {
    ...norm,
    background_color: norm.background_color === "#F8FAFC" ? "#0B1220" : norm.background_color,
    card_bg_color: norm.card_bg_color === "#FFFFFF" ? "#111C31" : norm.card_bg_color,
    navbar_bg_color: norm.navbar_bg_color === "#FFFFFF" ? "#0F172A" : norm.navbar_bg_color,
    text_primary_color: norm.text_primary_color === "#0F172A" ? "#F8FAFC" : norm.text_primary_color,
    text_secondary_color: norm.text_secondary_color === "#475569" ? "#CBD5E1" : norm.text_secondary_color,
    border_color: norm.border_color === "#E2E8F0" ? "#1E293B" : norm.border_color
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = validateHexColor(hex, "#0D6EFD").slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getContrastTextColor(hex?: string | null): string {
  const clean = validateHexColor(hex, "#0D6EFD").slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.42 ? "#0F172A" : "#FFFFFF";
}

export function buildThemeCssVariables(cfg: WebsiteThemeConfig): React.CSSProperties {
  const buttonRadiusMap: Record<string, string> = {
    pill: "9999px",
    rounded: "0.75rem",
    square: "0.375rem"
  };
  const cardRadiusMap: Record<string, string> = {
    none: "0.25rem",
    md: "0.75rem",
    lg: "1.125rem",
    "2xl": "1.5rem"
  };
  const shadowMap: Record<string, string> = {
    none: "none",
    soft: "0 6px 24px -6px rgba(15, 23, 42, 0.08)",
    medium: "0 14px 36px -8px rgba(15, 23, 42, 0.14)"
  };

  return {
    "--ws-primary": cfg.primary_color,
    "--ws-primary-text": getContrastTextColor(cfg.primary_color),
    "--ws-primary-soft": hexToRgba(cfg.primary_color, 0.09),
    "--ws-primary-border": hexToRgba(cfg.primary_color, 0.22),
    "--ws-secondary": cfg.secondary_color,
    "--ws-secondary-text": getContrastTextColor(cfg.secondary_color),
    "--ws-secondary-soft": hexToRgba(cfg.secondary_color, 0.14),
    "--ws-btn-bg": cfg.button_color,
    "--ws-btn-text": getContrastTextColor(cfg.button_color),
    "--ws-btn-hover": cfg.button_hover_color,
    "--ws-bg": cfg.background_color,
    "--ws-card-bg": cfg.card_bg_color,
    "--ws-text-primary": cfg.text_primary_color,
    "--ws-text-secondary": cfg.text_secondary_color,
    "--ws-link": cfg.link_color,
    "--ws-border": cfg.border_color,
    "--ws-navbar-bg": cfg.navbar_bg_color,
    "--ws-footer-bg": cfg.footer_bg_color,
    "--ws-footer-text": getContrastTextColor(cfg.footer_bg_color),
    "--ws-btn-radius": buttonRadiusMap[cfg.button_radius] || "0.75rem",
    "--ws-card-radius": cardRadiusMap[cfg.card_radius] || "1.125rem",
    "--ws-shadow": shadowMap[cfg.shadow_level] || shadowMap.soft,
    "--ws-font-family": `'${cfg.font_family || "Tajawal"}', 'Cairo', system-ui, sans-serif`,
    "--ws-font-size": `${cfg.base_font_size || 16}px`
  } as React.CSSProperties;
}

export function resolveLogoByChoice(
  cfg: WebsiteThemeConfig,
  choice: "company" | "system" | "itqan"
): { url: string; fallbackKind: "company" | "system" | "itqan" } {
  if (choice === "itqan") {
    return { url: cfg.itqan_logo_url || "", fallbackKind: "itqan" };
  }
  if (choice === "system") {
    return { url: cfg.system_logo_url || cfg.logo_url || "", fallbackKind: "system" };
  }
  return { url: cfg.logo_url || "", fallbackKind: "company" };
}

export function ItqanLogoMark({
  primary = "#0D6EFD",
  secondary = "#F59E0B",
  size = 44
}: {
  primary?: string;
  secondary?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="itqanWingGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor="#0B3B8C" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#itqanWingGrad)" />
      <path
        d="M46 18C34 20 24 28 19 41C26 35 35 32 45 31L46 18Z"
        fill="#FFFFFF"
        fillOpacity="0.95"
      />
      <path
        d="M17 45C25 46 37 42 47 33C41 37 31 39 22 39L17 45Z"
        fill={secondary}
      />
      <circle cx="44" cy="19" r="3" fill={secondary} />
    </svg>
  );
}

export function TravelHeroArtwork({
  primary = "#0D6EFD",
  secondary = "#F59E0B"
}: {
  primary?: string;
  secondary?: string;
}) {
  return (
    <svg
      viewBox="0 0 640 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full object-cover select-none pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyHeroGrad" x1="0" y1="0" x2="640" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="55%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#EFF6FF" />
        </linearGradient>
        <linearGradient id="planeBodyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>

      <rect width="640" height="380" fill="url(#skyHeroGrad)" />

      {/* Soft sunlit atmospheric circles */}
      <circle cx="150" cy="120" r="110" fill={primary} fillOpacity="0.08" />
      <circle cx="460" cy="210" r="150" fill={secondary} fillOpacity="0.08" />

      {/* Dashed flight trajectory */}
      <path
        d="M35 280 C 130 165, 290 120, 495 92"
        stroke={primary}
        strokeWidth="2.5"
        strokeDasharray="7 7"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />

      {/* Stylized world landmarks skyline along bottom-left */}
      <g opacity="0.28" fill={primary}>
        {/* Tower / Eiffel silhouette */}
        <path d="M88 355 L100 245 L105 245 L117 355 L110 355 L105 315 L100 315 L95 355 Z" />
        {/* Clock tower / Big Ben */}
        <rect x="148" y="268" width="22" height="87" rx="2" />
        <polygon points="159,244 148,268 170,268" />
        {/* Arch / Colosseum */}
        <path d="M196 355 V295 H258 V355 H246 V322 C246 312 234 312 234 322 V355 H220 V322 C220 312 208 312 208 322 V355 Z" />
        {/* Modern Towers */}
        <rect x="282" y="255" width="20" height="100" rx="3" />
        <rect x="308" y="280" width="26" height="75" rx="3" />
        {/* Palm leaves accent */}
        <path d="M54 355 V310 M54 310 C42 302 35 307 32 315 M54 310 C66 300 76 306 78 315" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Soft wave horizon */}
      <path
        d="M0 340 Q 180 315 360 342 T 640 330 L 640 380 L 0 380 Z"
        fill={primary}
        fillOpacity="0.1"
      />

      {/* Sleek modern jet airplane flying diagonally */}
      <g transform="translate(215, 72) rotate(-14)">
        {/* Upper wing */}
        <path d="M98 62 L52 14 L74 12 L138 56 Z" fill={primary} fillOpacity="0.88" />
        {/* Fuselage */}
        <path
          d="M24 68 C45 55, 130 48, 198 54 C218 56, 228 62, 226 68 C224 75, 206 79, 184 80 L42 78 C28 77, 18 73, 24 68 Z"
          fill="url(#planeBodyGrad)"
          stroke={primary}
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        {/* Tail fin */}
        <path d="M30 66 L10 34 L30 34 L52 60 Z" fill={secondary} />
        {/* Cockpit window */}
        <path d="M196 58 C206 59, 214 62, 216 65 L196 65 Z" fill={primary} />
        {/* Lower wing */}
        <path d="M88 74 L60 118 L86 116 L128 76 Z" fill={primary} />
        {/* Windows line */}
        <circle cx="96" cy="66" r="2.2" fill={primary} fillOpacity="0.55" />
        <circle cx="110" cy="65" r="2.2" fill={primary} fillOpacity="0.55" />
        <circle cx="124" cy="64.5" r="2.2" fill={primary} fillOpacity="0.55" />
        <circle cx="138" cy="64" r="2.2" fill={primary} fillOpacity="0.55" />
        <circle cx="152" cy="63.5" r="2.2" fill={primary} fillOpacity="0.55" />
        <circle cx="166" cy="63.5" r="2.2" fill={primary} fillOpacity="0.55" />
      </g>
    </svg>
  );
}
