import React, { useEffect, useMemo, useState } from "react";
import {
  Plane,
  Building2,
  Compass,
  FileText,
  Bus,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  CreditCard,
  Printer,
  ArrowRight,
  MessageSquare,
  Globe,
  Car,
  Star,
  Headphones,
  Zap,
  Award,
  Menu,
  X,
  UserPlus,
  LogIn,
  LogOut,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Users,
  Tag,
  Upload,
  KeyRound,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wallet
} from "lucide-react";
import { EsaalatCheckoutButton } from "./EsaalatCheckoutButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  WebsiteThemeConfig,
  WebsiteFeatureItem,
  WebsiteSectionConfig,
  WebsiteNavLink,
  WebsiteShowcaseServiceItem,
  WebsiteHeroSlide,
  DEFAULT_FEATURES,
  DEFAULT_SECTIONS_CONFIG,
  DEFAULT_NAV_LINKS,
  DEFAULT_SHOWCASE_SERVICES,
  normalizeWebsiteConfig,
  resolveEffectiveThemeConfig,
  buildThemeCssVariables,
  resolveLogoByChoice,
  safeJsonParse,
  hexToRgba
} from "@/lib/website-theme";

export interface PortalCatalogData {
  rides?: any[];
  flights?: any[];
  hotels?: any[];
  packages?: any[];
  visas?: any[];
  buses?: any[];
  customServices?: any[];
}

export interface PortalCustomerAccount {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  id_image_url?: string | null;
  phone_verified?: number;
}

export interface PortalWebsiteViewProps {
  config: WebsiteThemeConfig;
  catalog?: PortalCatalogData;
  showReturnToSystem?: boolean;
  isLivePreview?: boolean;
  isDraftPreview?: boolean;
  onReturnToSystem?: () => void;
  onSendWhatsApp: (phone?: string, text?: string) => void;
  onCreateBooking: (payload: any) => Promise<any>;
  isSubmittingBooking?: boolean;
  esaalatMethods?: {
    isEnabled?: boolean;
    displayName?: string;
    description?: string;
    currency?: string;
    presentationMode?: "modal" | "window";
    accounts?: Array<{
      id: string;
      accountName?: string;
      serviceName?: string;
      accountType?: string;
      currency?: string;
      isDefault?: boolean;
      label?: string;
      providerName?: string;
    }>;
  };
  onCreateEsaalatSession?: (payload: { orderId: number; preferredAccountId?: string }) => Promise<any>;
  onVerifyEsaalatPayment?: (payload: {
    externalOrderId: string;
    intentId?: string;
    intentCode?: string;
    status?: string;
  }) => Promise<any>;
  onLookupBooking: (query: string) => Promise<any>;
  onSubmitInquiry: (payload: {
    name: string;
    phone: string;
    email?: string;
    service_interest: string;
    message: string;
  }) => Promise<void>;
  onSendCustomerOtp?: (phone: string, purpose?: "register" | "login") => Promise<any>;
  onRegisterCustomer: (payload: {
    name: string;
    phone: string;
    email?: string;
    nationality?: string;
    password?: string;
    otp_code?: string;
    id_image_data?: string | null;
    id_image_name?: string | null;
  }) => Promise<any>;
  onLoginCustomer?: (payload: {
    phone: string;
    password?: string;
    otp_code?: string;
  }) => Promise<any>;
}

function fmt(n?: number | string) {
  return Number(n ?? 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderFeatureIcon(iconName: WebsiteFeatureItem["icon"], color: string) {
  const props = { className: "w-6 h-6", style: { color } };
  switch (iconName) {
    case "shield":
      return <ShieldCheck {...props} />;
    case "zap":
      return <Zap {...props} />;
    case "headphones":
      return <Headphones {...props} />;
    case "award":
      return <Award {...props} />;
    case "clock":
      return <Clock {...props} />;
    case "globe":
    default:
      return <Globe {...props} />;
  }
}

function renderShowcaseIcon(iconName: WebsiteShowcaseServiceItem["icon"], color: string) {
  const props = { className: "w-6 h-6", style: { color } };
  switch (iconName) {
    case "plane":
      return <Plane {...props} />;
    case "hotel":
      return <Building2 {...props} />;
    case "visa":
      return <FileText {...props} />;
    case "passengers":
      return <Users {...props} />;
    case "compass":
      return <Compass {...props} />;
    case "car":
      return <Car {...props} />;
    case "bus":
      return <Bus {...props} />;
    case "shield":
      return <ShieldCheck {...props} />;
    case "globe":
    default:
      return <Globe {...props} />;
  }
}

export function BrandLogoDisplay({
  cfg,
  choice,
  size = 44
}: {
  cfg: WebsiteThemeConfig;
  choice: "company" | "system" | "itqan";
  size?: number;
}) {
  const showLogos = (cfg.show_website_images ?? 1) !== 0 && (cfg.show_site_logos ?? 1) !== 0;
  const { url, fallbackKind } = resolveLogoByChoice(cfg, choice);
  const [imgFailed, setImgFailed] = useState(false);

  if (showLogos && url && !imgFailed) {
    return (
      <img
        src={url}
        alt={cfg.site_name}
        style={{ width: size, height: size }}
        className="object-contain rounded-xl shrink-0"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${cfg.primary_color || "#0D6EFD"}, ${cfg.secondary_color || "#F59E0B"})`
      }}
      className="rounded-xl shrink-0 flex items-center justify-center text-white shadow-xs"
    >
      <Building2 style={{ width: Math.max(16, Math.round(size * 0.54)), height: Math.max(16, Math.round(size * 0.54)) }} />
    </div>
  );
}

export function PortalWebsiteView({
  config,
  catalog,
  showReturnToSystem = false,
  isLivePreview = false,
  isDraftPreview = false,
  onReturnToSystem,
  onSendWhatsApp,
  onCreateBooking,
  isSubmittingBooking = false,
  esaalatMethods,
  onCreateEsaalatSession,
  onVerifyEsaalatPayment,
  onLookupBooking,
  onSubmitInquiry,
  onSendCustomerOtp,
  onRegisterCustomer,
  onLoginCustomer
}: PortalWebsiteViewProps) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const cfg = useMemo(
    () => resolveEffectiveThemeConfig(normalizeWebsiteConfig(config), prefersDark),
    [config, prefersDark]
  );

  const cssVars = useMemo(() => buildThemeCssVariables(cfg), [cfg]);

  const customerStorageKey = `portal_customer_${cfg.tenant_code || cfg.tenant_id || "default"}`;
  const [loggedInCustomer, setLoggedInCustomer] = useState<PortalCustomerAccount | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(`portal_customer_${config?.tenant_code || config?.tenant_id || "default"}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(customerStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) setLoggedInCustomer(parsed);
      }
    } catch {}
  }, [customerStorageKey]);

  const persistCustomerSession = (cust: PortalCustomerAccount | null) => {
    setLoggedInCustomer(cust);
    if (typeof window !== "undefined") {
      try {
        if (cust) {
          localStorage.setItem(customerStorageKey, JSON.stringify(cust));
        } else {
          localStorage.removeItem(customerStorageKey);
        }
      } catch {}
    }
  };

  const [activeTab, setActiveTab] = useState<string>("rides");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);

  // Filters State
  const [rideSearch, setRideSearch] = useState("");
  const [flightOrigin, setFlightOrigin] = useState("");
  const [flightDest, setFlightDest] = useState("");
  const [hotelCity, setHotelCity] = useState("");

  // Booking Modal State
  const [bookingModalItem, setBookingModalItem] = useState<any>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [preferredEsaalatAccountId, setPreferredEsaalatAccountId] = useState<string>("");
  const [esaalatSession, setEsaalatSession] = useState<{
    sessionToken: string;
    portalUrl?: string;
    externalOrderId: string;
    amount: string;
    currency: string;
    presentationMode?: "modal" | "window";
  } | null>(null);
  const [esaalatSessionLoading, setEsaalatSessionLoading] = useState(false);
  const [esaalatSessionError, setEsaalatSessionError] = useState<string | null>(null);
  const [esaalatVerifyResult, setEsaalatVerifyResult] = useState<{
    status: "pending" | "paid" | "cancelled" | "expired" | "wrong_amount" | "failed";
    verified: boolean;
    message?: string;
  } | null>(null);
  const [pendingBookingAction, setPendingBookingAction] = useState<{
    item: any;
    type: string;
    title: string;
    amount: number;
  } | null>(null);
  const [pendingInquirySubmit, setPendingInquirySubmit] = useState(false);
  const [authGateNotice, setAuthGateNotice] = useState<string | null>(null);

  const [bookingForm, setBookingForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    passport_number: "",
    nationality: "سعودي",
    passengers_count: 1,
    departure_date: new Date().toISOString().slice(0, 10),
    return_date: "",
    payment_method: "credit_card",
    promo_code: "",
    notes: ""
  });

  // Lookup State
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Inquiry Form State
  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    phone: "",
    email: "",
    service_interest: "مشوار ونقل سياحي VIP",
    message: ""
  });
  const [inquirySending, setInquirySending] = useState(false);

  // Pre-fill customer data when signed in
  useEffect(() => {
    if (loggedInCustomer) {
      setBookingForm((prev) => ({
        ...prev,
        customer_name: prev.customer_name || loggedInCustomer.name || "",
        customer_phone: prev.customer_phone || loggedInCustomer.phone || "",
        customer_email: prev.customer_email || loggedInCustomer.email || "",
        nationality: prev.nationality || loggedInCustomer.nationality || "سعودي"
      }));
      setInquiryForm((prev) => ({
        ...prev,
        name: prev.name || loggedInCustomer.name || "",
        phone: prev.phone || loggedInCustomer.phone || "",
        email: prev.email || loggedInCustomer.email || ""
      }));
    }
  }, [loggedInCustomer]);

  // Customer Self-Service Registration Modal (with 4WhatsApp OTP + Optional/Mandatory ID Image)
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    phone: "",
    email: "",
    nationality: "سعودي",
    password: "",
    otp_code: "",
    id_image_data: "" as string,
    id_image_name: "" as string
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpSending, setRegOtpSending] = useState(false);
  const [regOtpCooldown, setRegOtpCooldown] = useState(0);
  const [regError, setRegError] = useState<string | null>(null);
  const [regOtpNotice, setRegOtpNotice] = useState<string | null>(null);

  // Dedicated Customer Login Modal
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");
  const [loginForm, setLoginForm] = useState({
    phone: "",
    password: "",
    otp_code: ""
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtpSending, setLoginOtpSending] = useState(false);
  const [loginOtpCooldown, setLoginOtpCooldown] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginOtpNotice, setLoginOtpNotice] = useState<string | null>(null);

  useEffect(() => {
    if (regOtpCooldown <= 0) return;
    const t = setTimeout(() => setRegOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [regOtpCooldown]);

  useEffect(() => {
    if (loginOtpCooldown <= 0) return;
    const t = setTimeout(() => setLoginOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [loginOtpCooldown]);

  // Parsed JSON arrays
  const sectionsConfig = useMemo<WebsiteSectionConfig[]>(() => {
    const parsed = safeJsonParse<WebsiteSectionConfig[]>(cfg.sections_config_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SECTIONS_CONFIG;
    // Ensure any newly introduced default section ids are preserved if missing
    const map = new Map(parsed.map((s) => [s.id, s]));
    const merged = [...parsed];
    for (const def of DEFAULT_SECTIONS_CONFIG) {
      if (!map.has(def.id)) merged.push(def);
    }
    return merged;
  }, [cfg.sections_config_json]);

  const featuresList = useMemo<WebsiteFeatureItem[]>(() => {
    const parsed = safeJsonParse<WebsiteFeatureItem[]>(cfg.features_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FEATURES;
    return parsed.filter((f) => f.enabled !== false);
  }, [cfg.features_json]);

  const navLinks = useMemo<WebsiteNavLink[]>(() => {
    const parsed = safeJsonParse<WebsiteNavLink[]>(cfg.nav_links_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_NAV_LINKS;
    return parsed.filter((l) => l.enabled !== false);
  }, [cfg.nav_links_json]);

  const heroSlides = useMemo<WebsiteHeroSlide[]>(() => {
    const parsed = safeJsonParse<WebsiteHeroSlide[]>(cfg.hero_slides_json, []);
    return Array.isArray(parsed) ? parsed.filter((s) => s.title || s.image_url) : [];
  }, [cfg.hero_slides_json]);

  const promotions = useMemo(() => {
    return Array.isArray(cfg.promotions) ? cfg.promotions.filter((p) => p.is_active !== 0) : [];
  }, [cfg.promotions]);

  // Fallback Rides
  const defaultRides = [
    {
      id: "ride-1",
      title: "توصيل واستقبال مطار الملك خالد (الرياض)",
      type: "توصيل مطار VIP",
      price: 150,
      car_type: "سيدان حديثة (كامري / سوناتا)",
      duration: "45 دقيقة",
      features: "استقبال باللوحة • متوفر 24/7 • واي فاي"
    },
    {
      id: "ride-2",
      title: "توصيل مطار الملك عبدالعزيز (جدة) إلى مكة المكرمة",
      type: "مشاوير الحرمين",
      price: 280,
      car_type: "جمس يوكون / فان عائلي",
      duration: "ساعة واحدة",
      features: "تسليم أمام الفندق • استيعاب العفش • سائق معتمد"
    },
    {
      id: "ride-3",
      title: "مشوار مباشر: مكة المكرمة إلى المدينة المنورة",
      type: "بين المدن",
      price: 550,
      car_type: "سيارة VIP خاصة عائلية",
      duration: "4 ساعات",
      features: "توقف للاستراحة • مشروبات وضيافة • راحة تامة"
    }
  ];

  const availableRides = (catalog?.rides && catalog.rides.length > 0 ? catalog.rides : defaultRides).filter(
    (r: any) =>
      !rideSearch ||
      String(r.title || "").toLowerCase().includes(rideSearch.toLowerCase()) ||
      String(r.origin || "").toLowerCase().includes(rideSearch.toLowerCase()) ||
      String(r.destination || "").toLowerCase().includes(rideSearch.toLowerCase())
  );

  const flights = (catalog?.flights || []).filter((f: any) => {
    if (flightOrigin && !String(f.origin || "").toLowerCase().includes(flightOrigin.toLowerCase())) return false;
    if (flightDest && !String(f.destination || "").toLowerCase().includes(flightDest.toLowerCase())) return false;
    return true;
  });

  const hotels = (catalog?.hotels || []).filter((h: any) => {
    if (hotelCity && !String(h.city || "").toLowerCase().includes(hotelCity.toLowerCase())) return false;
    return true;
  });

  const defaultPhone = cfg.phone || "+966 50 123 4567";
  const whatsappPhone = cfg.whatsapp || "966501234567";
  const currencyLabel = cfg.currency || "ر.س";

  // Container width & section spacing classes
  const maxWidthClass =
    cfg.content_width === "compact"
      ? "max-w-5xl"
      : cfg.content_width === "wide"
      ? "max-w-[1440px]"
      : "max-w-7xl";

  const spacingClass =
    cfg.section_spacing === "compact"
      ? "py-6 sm:py-8"
      : cfg.section_spacing === "relaxed"
      ? "py-12 sm:py-16"
      : "py-8 sm:py-12";

  const bgPatternStyle: React.CSSProperties = useMemo(() => {
    if (cfg.background_pattern === "dots") {
      return {
        backgroundImage: `radial-gradient(${cfg.border_color} 1.25px, transparent 1.25px)`,
        backgroundSize: "22px 22px"
      };
    }
    if (cfg.background_pattern === "grid") {
      return {
        backgroundImage: `linear-gradient(to right, ${cfg.border_color}44 1px, transparent 1px), linear-gradient(to bottom, ${cfg.border_color}44 1px, transparent 1px)`,
        backgroundSize: "36px 36px"
      };
    }
    if (cfg.background_pattern === "gradient") {
      return {
        backgroundImage: `linear-gradient(180deg, ${cfg.primary_color}0D 0%, ${cfg.background_color} 420px)`
      };
    }
    return {};
  }, [cfg.background_pattern, cfg.border_color, cfg.primary_color, cfg.background_color]);

  const cardSurfaceClass =
    cfg.design_style === "minimal"
      ? "border transition-colors"
      : cfg.design_style === "formal"
      ? "border transition-shadow"
      : "border transition-all hover:-translate-y-0.5";

  const scrollToTarget = (target: string, tab?: string) => {
    if (tab) setActiveTab(tab);
    setMobileMenuOpen(false);
    if (typeof document !== "undefined" && target.startsWith("#")) {
      const el = document.querySelector(target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const resumePendingOperationAfterAuth = (cust: PortalCustomerAccount) => {
    setAuthGateNotice(null);
    setBookingForm((prev) => ({
      ...prev,
      customer_name: cust.name || prev.customer_name,
      customer_phone: cust.phone || prev.customer_phone,
      customer_email: cust.email || prev.customer_email,
      nationality: cust.nationality || prev.nationality
    }));
    setInquiryForm((prev) => ({
      ...prev,
      name: cust.name || prev.name,
      phone: cust.phone || prev.phone,
      email: cust.email || prev.email
    }));
    if (pendingBookingAction) {
      const pending = pendingBookingAction;
      setPendingBookingAction(null);
      setBookingModalItem({
        raw: pending.item,
        type: pending.type,
        title: pending.title,
        baseAmount: Number(pending.amount) || 0,
        origin: pending.item.origin || pending.item.destination_city || pending.item.city || pending.item.from || "",
        destination: pending.item.destination || pending.item.destination_country || pending.item.country || pending.item.to || ""
      });
      setConfirmedBooking(null);
    }
    if (pendingInquirySubmit) {
      setPendingInquirySubmit(false);
    }
  };

  const handleOpenBooking = (item: any, type: string, title: string, amount: number) => {
    if (!loggedInCustomer) {
      setPendingBookingAction({ item, type, title, amount });
      setAuthGateNotice(
        isOtpRequired
          ? "لإجراء أي حجز أو معاملة عبر الموقع، يرجى أولاً فتح حساب عميل جديد وتأكيد رقمك عبر واتساب أو تسجيل الدخول بحسابك."
          : "لإجراء أي حجز أو معاملة عبر الموقع، يرجى أولاً إنشاء حساب عميل جديد أو تسجيل الدخول بحسابك."
      );
      setRegError(null);
      setRegisterModalOpen(true);
      return;
    }

    setBookingForm((prev) => ({
      ...prev,
      customer_name: loggedInCustomer.name || prev.customer_name,
      customer_phone: loggedInCustomer.phone || prev.customer_phone,
      customer_email: loggedInCustomer.email || prev.customer_email,
      nationality: loggedInCustomer.nationality || prev.nationality
    }));
    setBookingModalItem({
      raw: item,
      type,
      title,
      baseAmount: Number(amount) || 0,
      origin: item.origin || item.destination_city || item.city || item.from || "",
      destination: item.destination || item.destination_country || item.country || item.to || ""
    });
    setConfirmedBooking(null);
    setEsaalatSession(null);
    setEsaalatSessionError(null);
    setEsaalatVerifyResult(null);
  };

  const startEsaalatCheckoutSession = async (orderId: number, accountId?: string) => {
    if (!onCreateEsaalatSession) return;
    setEsaalatSessionLoading(true);
    setEsaalatSessionError(null);
    try {
      const session = await onCreateEsaalatSession({
        orderId,
        preferredAccountId: accountId || undefined
      });
      setEsaalatSession({
        sessionToken: session.sessionToken,
        portalUrl: session.portalUrl,
        externalOrderId: session.externalOrderId,
        amount: String(session.amount),
        currency: String(session.currency || "SAR"),
        presentationMode: session.presentationMode || "modal"
      });
      setEsaalatVerifyResult({ status: "pending", verified: false, message: "يرجى إتمام الدفع عبر بوابة Esaalat" });
    } catch (err: any) {
      setEsaalatSessionError(err?.message || "تعذر إنشاء جلسة الدفع الإلكتروني");
    } finally {
      setEsaalatSessionLoading(false);
    }
  };

  const verifyEsaalatOutcome = async (
    externalOrderId: string,
    payload: { intentId?: string; intentCode?: string; status?: string },
    fallbackMessage?: string
  ) => {
    if (!onVerifyEsaalatPayment) return;
    try {
      const result = await onVerifyEsaalatPayment({
        externalOrderId,
        ...payload
      });
      setEsaalatVerifyResult({
        status: result.status || (result.verified ? "paid" : "pending"),
        verified: Boolean(result.verified),
        message: result.verified
          ? "تم تأكيد استلام الدفع والتحقق من المعاملة عبر الخادم بنجاح."
          : fallbackMessage || result.message || "حالة الدفع قيد التحقق."
      });
    } catch (err: any) {
      setEsaalatVerifyResult({
        status: "failed",
        verified: false,
        message: err?.message || fallbackMessage || "تعذر التحقق من الدفع."
      });
    }
  };

  const promoDiscountAmount = useMemo(() => {
    if (!bookingModalItem || !bookingForm.promo_code.trim() || !cfg.promo_code) return 0;
    if (bookingForm.promo_code.trim().toUpperCase() === cfg.promo_code.trim().toUpperCase()) {
      const paxCount = Number(bookingForm.passengers_count || 1);
      const minPax = Number(cfg.promo_min_passengers) || 1;
      if (paxCount < minPax) return 0;

      const reqService = String(cfg.promo_required_service || "").trim();
      if (reqService && bookingModalItem.type !== reqService) {
        return 0;
      }

      const gross = bookingModalItem.baseAmount * paxCount;
      return (gross * (Number(cfg.promo_discount_percent) || 10)) / 100;
    }
    return 0;
  }, [bookingModalItem, bookingForm.promo_code, bookingForm.passengers_count, cfg.promo_code, cfg.promo_discount_percent, cfg.promo_min_passengers, cfg.promo_required_service]);

  const grossBookingTotal = bookingModalItem
    ? bookingModalItem.baseAmount * Number(bookingForm.passengers_count || 1)
    : 0;
  const netBookingTotal = Math.max(0, grossBookingTotal - promoDiscountAmount);

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingModalItem) return;
    if (!loggedInCustomer) {
      setBookingModalItem(null);
      setAuthGateNotice("يرجى تسجيل الدخول أو فتح حساب عميل أولاً لإرسال طلب الحجز.");
      setRegisterModalOpen(true);
      return;
    }
    const res = await onCreateBooking({
      customer_id: loggedInCustomer.id,
      service_type: bookingModalItem.type,
      service_title: bookingModalItem.title,
      customer_name: bookingForm.customer_name || loggedInCustomer.name,
      customer_phone: bookingForm.customer_phone || loggedInCustomer.phone,
      customer_email: bookingForm.customer_email || loggedInCustomer.email,
      passport_number: bookingForm.passport_number,
      nationality: bookingForm.nationality || loggedInCustomer.nationality,
      origin: bookingModalItem.origin,
      destination: bookingModalItem.destination,
      departure_date: bookingForm.departure_date,
      return_date: bookingForm.return_date,
      passengers_count: Number(bookingForm.passengers_count || 1),
      total_amount: grossBookingTotal,
      payment_method: bookingForm.payment_method,
      promo_code: bookingForm.promo_code,
      notes: bookingForm.notes
    });
    if (res?.booking) {
      setConfirmedBooking(res.booking);
      if (bookingForm.payment_method === "esaalat" && onCreateEsaalatSession) {
        await startEsaalatCheckoutSession(res.booking.id, preferredEsaalatAccountId || undefined);
      }
    }
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setIsLookingUp(true);
    setLookupError(null);
    setLookupResults(null);
    try {
      const data = await onLookupBooking(lookupQuery.trim());
      setLookupResults(data);
    } catch (err: any) {
      setLookupError(err.message || "تعذر البحث حالياً");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleInquiryFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInCustomer) {
      setPendingInquirySubmit(true);
      setAuthGateNotice(
        isOtpRequired
          ? "لإرسال طلب رحلة أو خدمة مخصصة، يرجى أولاً فتح حساب عميل وتأكيده عبر واتساب أو تسجيل الدخول بحسابك."
          : "لإرسال طلب رحلة أو خدمة مخصصة، يرجى أولاً إنشاء حساب عميل أو تسجيل الدخول بحسابك."
      );
      setRegError(null);
      setRegisterModalOpen(true);
      return;
    }
    setInquirySending(true);
    try {
      await onSubmitInquiry({
        ...inquiryForm,
        name: inquiryForm.name || loggedInCustomer.name,
        phone: inquiryForm.phone || loggedInCustomer.phone
      });
      setInquiryForm({
        name: loggedInCustomer.name || "",
        phone: loggedInCustomer.phone || "",
        email: loggedInCustomer.email || "",
        service_interest: "مشوار ونقل سياحي VIP",
        message: ""
      });
    } finally {
      setInquirySending(false);
    }
  };

  const handleSendRegOtp = async () => {
    if (!registerForm.phone.trim()) {
      setRegError("يرجى إدخال رقم الجوال (واتساب) أولاً لإرسال كود التحقق");
      return;
    }
    setRegError(null);
    setRegOtpNotice(null);
    setRegOtpSending(true);
    try {
      if (onSendCustomerOtp) {
        const otpRes = await onSendCustomerOtp(registerForm.phone.trim(), "register");
        if (otpRes?.otp_disabled) {
          setRegOtpNotice(otpRes.message || "التحقق عبر الواتساب غير مطلوب — يمكنك فتح الحساب مباشرة.");
          return;
        }
        setRegisterForm((prev) => ({ ...prev, otp_code: "" }));
        setRegOtpNotice("تم إرسال كود التحقق المكون من 4 أرقام إلى رقم الواتساب الخاص بك عبر 4WhatsApp — يرجى فتح واتساب وإدخال الرمز يدوياً.");
      }
      setRegOtpSent(true);
      setRegOtpCooldown(60);
    } catch (err: any) {
      setRegOtpSent(false);
      setRegError(err?.message || "تعذر إرسال كود التحقق عبر سيرفر 4WhatsApp");
    } finally {
      setRegOtpSending(false);
    }
  };

  const handleIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setRegError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setRegisterForm((prev) => ({
        ...prev,
        id_image_data: String(reader.result || ""),
        id_image_name: file.name
      }));
      setRegError(null);
    };
    reader.readAsDataURL(file);
  };

  const isOtpRequired = (cfg.enable_whatsapp_otp ?? 1) !== 0 && (cfg.require_whatsapp_otp ?? 1) === 1;
  const isOtpEnabled = (cfg.enable_whatsapp_otp ?? 1) !== 0;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const trimmedRegOtp = registerForm.otp_code.trim();
    if (isOtpRequired && !/^\d{4}$/.test(trimmedRegOtp)) {
      setRegError("يرجى طلب وإدخال كود التحقق المكون من 4 أرقام المرسل إلى رقم الواتساب الخاص بك لتأكيد ملكية الرقم");
      return;
    }
    if (!isOtpRequired && isOtpEnabled && trimmedRegOtp && !/^\d{4}$/.test(trimmedRegOtp)) {
      setRegError("كود التحقق المرسل عبر واتساب يجب أن يتكون من 4 أرقام");
      return;
    }

    const showIdUpload = cfg.show_id_upload !== 0;
    const requireIdUpload = showIdUpload && cfg.require_id_upload === 1;
    if (requireIdUpload && !registerForm.id_image_data) {
      setRegError("يرجى رفع صورة جواز السفر أو البطاقة الشخصية لإتمام فتح الحساب");
      return;
    }

    setRegisterLoading(true);
    try {
      const res = await onRegisterCustomer({
        name: registerForm.name.trim(),
        phone: registerForm.phone.trim(),
        email: registerForm.email.trim() || undefined,
        nationality: registerForm.nationality.trim() || "سعودي",
        password: registerForm.password.trim() || undefined,
        otp_code: registerForm.otp_code.trim() || undefined,
        id_image_data: showIdUpload && registerForm.id_image_data ? registerForm.id_image_data : null,
        id_image_name: showIdUpload && registerForm.id_image_name ? registerForm.id_image_name : null
      });
      if (res?.customer) {
        persistCustomerSession(res.customer);
        setRegisterModalOpen(false);
        setRegisterForm({
          name: "",
          phone: "",
          email: "",
          nationality: "سعودي",
          password: "",
          otp_code: "",
          id_image_data: "",
          id_image_name: ""
        });
        setRegOtpSent(false);
        resumePendingOperationAfterAuth(res.customer);
      }
    } catch (err: any) {
      setRegError(err?.message || "تعذر إتمام التسجيل");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSendLoginOtp = async () => {
    if (!loginForm.phone.trim()) {
      setLoginError("يرجى إدخال رقم الجوال أولاً");
      return;
    }
    setLoginError(null);
    setLoginOtpNotice(null);
    setLoginOtpSending(true);
    try {
      if (onSendCustomerOtp) {
        await onSendCustomerOtp(loginForm.phone.trim(), "login");
        setLoginForm((prev) => ({ ...prev, otp_code: "" }));
        setLoginOtpNotice("تم إرسال كود التحقق المكون من 4 أرقام إلى رقم الواتساب الخاص بك عبر 4WhatsApp — يرجى إدخاله يدوياً.");
      }
      setLoginOtpSent(true);
      setLoginOtpCooldown(60);
    } catch (err: any) {
      setLoginOtpSent(false);
      setLoginError(err?.message || "تعذر إرسال كود الدخول عبر سيرفر 4WhatsApp");
    } finally {
      setLoginOtpSending(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!onLoginCustomer) return;

    setLoginLoading(true);
    try {
      const res = await onLoginCustomer({
        phone: loginForm.phone.trim(),
        password: loginMode === "password" ? loginForm.password : undefined,
        otp_code: loginMode === "otp" ? loginForm.otp_code : undefined
      });
      if (res?.customer) {
        persistCustomerSession(res.customer);
        setLoginModalOpen(false);
        setLoginForm({ phone: "", password: "", otp_code: "" });
        setLoginOtpSent(false);
        resumePendingOperationAfterAuth(res.customer);
      }
    } catch (err: any) {
      setLoginError(err?.message || "بيانات الدخول غير صحيحة");
    } finally {
      setLoginLoading(false);
    }
  };

  const showImagesGlobally = (cfg.show_website_images ?? 1) !== 0;
  const showHeroImg = showImagesGlobally && (cfg.show_hero_image ?? 1) !== 0;
  const showServicesImgs = showImagesGlobally && (cfg.show_services_images ?? 1) !== 0;

  const activeSlide =
    heroSlides.length > 0 ? heroSlides[heroSlideIdx % heroSlides.length] : null;
  const heroTitleLine1 = activeSlide?.title || cfg.hero_title_2 || cfg.hero_title || "سافر بكل راحة وأمان ..";
  const heroTitleHighlight = activeSlide?.highlight || cfg.hero_title_3 || `مع ${cfg.site_name}`;
  const heroSubtitleText = activeSlide?.subtitle || cfg.hero_subtitle;
  const customHeroUrl = activeSlide?.image_url || cfg.hero_image_url || "";
  const heroBannerImage = customHeroUrl || "/assets/travel_hero_default.jpg";
  const isCustomHeroImg = Boolean(customHeroUrl);

  const serviceShowcaseCards = useMemo(() => {
    const parsed = safeJsonParse<WebsiteShowcaseServiceItem[]>(cfg.services_showcase_json, []);
    const list =
      Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SHOWCASE_SERVICES;

    const imageByTab: Record<string, string> = {
      flights: cfg.flight_image_url,
      hotels: cfg.hotel_image_url,
      visas: cfg.visas_image_url,
      rides: cfg.rides_image_url,
      packages: cfg.packages_image_url
    };

    return list
      .filter((item) => item.enabled !== false)
      .filter((item) => {
        if (item.tab === "flights" && cfg.flight_enabled === 0) return false;
        if (item.tab === "hotels" && cfg.hotel_enabled === 0) return false;
        if (item.tab === "visas" && cfg.visas_enabled === 0) return false;
        if (item.tab === "rides" && cfg.rides_enabled === 0) return false;
        if (item.tab === "packages" && cfg.packages_enabled === 0) return false;
        if (item.tab === "buses" && cfg.bus_enabled === 0) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        resolvedImage: item.image_url || (item.tab ? imageByTab[item.tab] : "") || ""
      }));
  }, [
    cfg.services_showcase_json,
    cfg.flight_enabled,
    cfg.hotel_enabled,
    cfg.visas_enabled,
    cfg.rides_enabled,
    cfg.packages_enabled,
    cfg.bus_enabled,
    cfg.flight_image_url,
    cfg.hotel_image_url,
    cfg.visas_image_url,
    cfg.rides_image_url,
    cfg.packages_image_url
  ]);

  // Ordered body sections (excluding footer which always sits at the bottom)
  const orderedBodySections = sectionsConfig.filter((s) => s.id !== "footer" && s.enabled !== false);
  const footerEnabled = sectionsConfig.find((s) => s.id === "footer")?.enabled !== false;

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col overflow-x-hidden pb-16 sm:pb-0 transition-colors"
      style={{
        ...cssVars,
        backgroundColor: "var(--ws-bg)",
        color: "var(--ws-text-primary)",
        fontFamily: "var(--ws-font-family)",
        fontSize: "var(--ws-font-size)",
        ...bgPatternStyle
      }}
    >
      {/* Preview Draft Ribbon only in internal live preview */}
      {isDraftPreview && !isLivePreview && (
        <div
          className="text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-3"
          style={{ backgroundColor: "var(--ws-secondary)" }}
        >
          <span>أنت تشاهد الآن معاينة المسودة غير المنشورة — التغييرات لم تُعتمد للجمهور بعد</span>
        </div>
      )}

      {/* ─── 1. Top Announcement Bar ─── */}
      <div
        className="text-white/95 text-[11px] sm:text-xs py-2 border-b border-white/10"
        style={{ backgroundColor: "var(--ws-footer-bg)" }}
      >
        <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ws-secondary)" }} />
              <span>{cfg.topbar_announcement || cfg.site_name}</span>
            </span>
            {cfg.geo_location && (
              <>
                <span className="text-white/40 hidden sm:inline">·</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-white/85">
                  <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--ws-secondary)" }} />
                  <span>{cfg.geo_location}</span>
                </span>
              </>
            )}
            <span className="text-white/40 hidden md:inline">·</span>
            <a
              href={`tel:${defaultPhone.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-1 text-white/90 hover:text-white font-semibold dir-ltr"
            >
              <Phone className="w-3 h-3 shrink-0" style={{ color: "var(--ws-secondary)" }} />
              <span>{defaultPhone}</span>
            </a>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{cfg.announcement_badge_1 || "بياناتك آمنة ومحمية"}</span>
            </span>

            {cfg.show_social_links !== 0 && (cfg.facebook_url || cfg.x_url || cfg.instagram_url) && (
              <div className="hidden md:flex items-center gap-2 text-white/80">
                <span className="text-white/30">|</span>
                {cfg.x_url && (
                  <a href={cfg.x_url} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                    X
                  </a>
                )}
                {cfg.instagram_url && (
                  <a href={cfg.instagram_url} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                    Instagram
                  </a>
                )}
                {cfg.facebook_url && (
                  <a href={cfg.facebook_url} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. Main 3-Zone Navigation Header ─── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b"
        style={{
          backgroundColor: cfg.navbar_bg_color,
          borderColor: "var(--ws-border)"
        }}
      >
        <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8`}>
          <div className="flex items-center justify-between gap-3 h-16 sm:h-20">
            {/* Brand Zone */}
            <a
              href="#hero-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToTarget("#hero-section");
              }}
              className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0"
            >
              <BrandLogoDisplay cfg={cfg} choice={cfg.header_logo_type} size={44} />
              <div className="min-w-0">
                <div
                  className="text-sm sm:text-lg font-extrabold tracking-tight truncate leading-tight"
                  style={{ color: "var(--ws-text-primary)" }}
                >
                  {cfg.site_name}
                </div>
                <div
                  className="text-[11px] font-medium truncate leading-tight"
                  style={{ color: "var(--ws-text-secondary)" }}
                >
                  {cfg.nav_subtitle || "منصة الحجوزات والسفر الحديثة"}
                </div>
              </div>
            </a>

            {/* Desktop Nav Links */}
            <nav aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-5 xl:gap-6">
              {navLinks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToTarget(item.target, item.tab)}
                  className="text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer py-2 hover:opacity-80"
                  style={{ color: "var(--ws-text-primary)" }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Action Zone */}
            <div className="flex items-center gap-2 shrink-0">
              {showReturnToSystem && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (onReturnToSystem) {
                      onReturnToSystem();
                    } else if (typeof window !== "undefined") {
                      window.location.href = "/website-management";
                    }
                  }}
                  className="gap-1.5 text-xs font-extrabold whitespace-nowrap shrink-0 h-10 px-3 cursor-pointer"
                  style={{
                    backgroundColor: "var(--ws-secondary)",
                    color: "#0F172A",
                    borderRadius: "var(--ws-btn-radius)"
                  }}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>الرجوع للنظام</span>
                </Button>
              )}

              {loggedInCustomer ? (
                <div className="hidden sm:flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold"
                    style={{
                      backgroundColor: "var(--ws-primary-soft)",
                      borderColor: "var(--ws-primary-border)",
                      color: "var(--ws-text-primary)"
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="max-w-[130px] truncate">{loggedInCustomer.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => persistCustomerSession(null)}
                    className="gap-1 text-xs font-bold h-9 px-2.5 cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50"
                    title="تسجيل خروج العميل"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج</span>
                  </Button>
                </div>
              ) : (
                <>
                  {cfg.show_register_btn !== 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAuthGateNotice(null);
                        setRegError(null);
                        setRegisterModalOpen(true);
                      }}
                      className="hidden sm:inline-flex gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 h-10 px-3.5 cursor-pointer bg-transparent"
                      style={{
                        borderColor: "var(--ws-border)",
                        color: "var(--ws-text-primary)",
                        borderRadius: "var(--ws-btn-radius)"
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" style={{ color: "var(--ws-primary)" }} />
                      <span>إنشاء حساب</span>
                    </Button>
                  )}

                  {cfg.show_login_btn !== 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setAuthGateNotice(null);
                        setLoginError(null);
                        setLoginModalOpen(true);
                      }}
                      className="ws-btn-primary hidden sm:inline-flex gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 h-10 px-4 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>تسجيل الدخول</span>
                    </Button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="قائمة التنقل"
                className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border cursor-pointer"
                style={{
                  borderColor: "var(--ws-border)",
                  color: "var(--ws-text-primary)"
                }}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div
              className="lg:hidden py-4 border-t space-y-2"
              style={{ borderColor: "var(--ws-border)" }}
            >
              <div className="grid grid-cols-2 gap-2">
                {navLinks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToTarget(item.target, item.tab)}
                    className="text-right px-3 py-2.5 rounded-xl text-sm font-bold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--ws-card-bg)",
                      borderColor: "var(--ws-border)",
                      color: "var(--ws-text-primary)"
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {loggedInCustomer ? (
                  <div className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: "var(--ws-border)", backgroundColor: "var(--ws-bg)" }}>
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>مرحباً، {loggedInCustomer.name}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        persistCustomerSession(null);
                        setMobileMenuOpen(false);
                      }}
                      className="h-8 text-xs text-rose-600 border-rose-200 gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>خروج</span>
                    </Button>
                  </div>
                ) : (
                  <>
                    {cfg.show_register_btn !== 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setAuthGateNotice(null);
                          setRegError(null);
                          setRegisterModalOpen(true);
                        }}
                        className="flex-1 h-11 text-xs font-bold gap-1.5"
                        style={{
                          borderColor: "var(--ws-border)",
                          borderRadius: "var(--ws-btn-radius)"
                        }}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>إنشاء حساب</span>
                      </Button>
                    )}
                    {cfg.show_login_btn !== 0 && (
                      <Button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setAuthGateNotice(null);
                          setLoginError(null);
                          setLoginModalOpen(true);
                        }}
                        className="ws-btn-primary flex-1 h-11 text-xs font-bold gap-1.5"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>تسجيل الدخول</span>
                      </Button>
                    )}
                  </>
                )}
                {showReturnToSystem && (
                  <Button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (onReturnToSystem) onReturnToSystem();
                      else window.location.href = "/website-management";
                    }}
                    className="w-full h-11 text-xs font-extrabold gap-1.5"
                    style={{
                      backgroundColor: "var(--ws-secondary)",
                      color: "#0F172A",
                      borderRadius: "var(--ws-btn-radius)"
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>الرجوع للنظام</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── 3. Dynamic Ordered Page Sections ─── */}
      <main className="flex-1">
        {orderedBodySections.map((sec) => {
          /* ── PANORAMIC HERO SECTION (Matched to Modern Itqan Soft Design) ── */
          if (sec.id === "hero") {
            const heroBgVeil =
              cfg.theme_mode === "dark"
                ? `linear-gradient(270deg, ${cfg.card_bg_color}F5 0%, ${cfg.card_bg_color}E6 48%, ${cfg.card_bg_color}80 100%)`
                : isCustomHeroImg
                ? `linear-gradient(270deg, ${cfg.card_bg_color}F2 0%, ${cfg.card_bg_color}D8 46%, ${cfg.card_bg_color}26 100%)`
                : `linear-gradient(270deg, rgba(240, 248, 255, 0.94) 0%, rgba(232, 244, 255, 0.85) 44%, rgba(232, 244, 255, 0.08) 78%)`;

            return (
              <section
                id="hero-section"
                key={sec.id}
                className="pt-4 sm:pt-6 pb-2"
              >
                <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8`}>
                  <div
                    className="relative overflow-hidden border"
                    style={{
                      borderRadius: "var(--ws-card-radius)",
                      borderColor: "var(--ws-border)",
                      backgroundColor: cfg.theme_mode === "dark" ? "var(--ws-card-bg)" : "#E9F4FF",
                      boxShadow: "var(--ws-shadow)"
                    }}
                  >
                    {/* Panoramic Scenic Artwork Layer */}
                    {showHeroImg ? (
                      <div className="relative lg:absolute lg:inset-0 h-52 sm:h-64 lg:h-full w-full overflow-hidden">
                        <img
                          src={heroBannerImage}
                          alt={cfg.site_name}
                          className="w-full h-full object-cover object-left"
                        />
                        <div
                          className="hidden lg:block absolute inset-0 pointer-events-none"
                          style={{ background: heroBgVeil }}
                        />
                        <div
                          className="lg:hidden absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                          style={{
                            background: `linear-gradient(to top, ${cfg.card_bg_color}, transparent)`
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-40"
                        style={{
                          background: `radial-gradient(circle at 10% 50%, ${hexToRgba(cfg.primary_color, 0.15)} 0%, transparent 60%), radial-gradient(circle at 90% 20%, ${hexToRgba(cfg.secondary_color, 0.1)} 0%, transparent 50%)`
                        }}
                      />
                    )}

                    {/* Foreground RTL Content Zone (Right half on desktop, stacked clean card on mobile) */}
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center min-h-[260px] lg:min-h-[430px] px-5 py-6 sm:px-10 sm:py-10 lg:px-12 lg:py-14 bg-gradient-to-b from-transparent to-transparent">
                      <div className="lg:col-span-6 text-center lg:text-right space-y-4 sm:space-y-5 ws-animate-fade-up">
                        {cfg.site_slogan && (
                          <p
                            className="text-xs sm:text-sm font-bold tracking-wide"
                            style={{ color: "var(--ws-primary)" }}
                          >
                            {cfg.site_slogan}
                          </p>
                        )}

                        <h1
                          className="text-2xl sm:text-4xl lg:text-[44px] font-black leading-[1.2] tracking-tight"
                          style={{ color: "var(--ws-text-primary)", textWrap: "balance" }}
                        >
                          {heroTitleLine1}
                          <span className="block mt-1.5" style={{ color: "var(--ws-primary)" }}>
                            {heroTitleHighlight}
                          </span>
                        </h1>

                        <p
                          className="text-sm sm:text-base leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium"
                          style={{ color: "var(--ws-text-secondary)" }}
                        >
                          {heroSubtitleText}
                        </p>

                        {/* Primary + Secondary CTAs */}
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1">
                          <Button
                            type="button"
                            onClick={() =>
                              scrollToTarget(
                                activeSlide?.cta_link || cfg.hero_cta_primary_link || "#booking-console",
                                "flights"
                              )
                            }
                            className="ws-btn-primary h-12 px-6 text-sm font-extrabold gap-2 whitespace-nowrap cursor-pointer"
                            style={{ boxShadow: "var(--ws-shadow)" }}
                          >
                            <Search className="w-4 h-4" />
                            <span>{activeSlide?.cta_text || cfg.hero_cta_primary_text || "ابدأ البحث عن الرحلات"}</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              scrollToTarget(cfg.hero_cta_secondary_link || "#services-showcase")
                            }
                            className="h-12 px-5 text-sm font-bold gap-2 whitespace-nowrap cursor-pointer"
                            style={{
                              borderColor: "var(--ws-border)",
                              backgroundColor: "var(--ws-card-bg)",
                              color: "var(--ws-text-primary)",
                              borderRadius: "var(--ws-btn-radius)"
                            }}
                          >
                            <ArrowLeft className="w-4 h-4" style={{ color: "var(--ws-primary)" }} />
                            <span>{cfg.hero_cta_secondary_text || "استعراض الخدمات"}</span>
                          </Button>
                        </div>

                        {/* Advisor & Direct Support Summary Line */}
                        <div
                          className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs"
                          style={{ color: "var(--ws-text-secondary)" }}
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <Headphones className="w-4 h-4" style={{ color: "var(--ws-primary)" }} />
                            <span>{cfg.customer_service_name || "فريق خدمة العملاء"}</span>
                          </span>
                          <span className="opacity-35">·</span>
                          <button
                            type="button"
                            onClick={() =>
                              onSendWhatsApp(
                                whatsappPhone,
                                `مرحباً ${cfg.site_name}، أود الاستفسار عن حجز رحلة أو خدمة.`
                              )
                            }
                            className="inline-flex items-center gap-1.5 font-bold hover:underline cursor-pointer"
                            style={{ color: "#059669" }}
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>تواصل فوري عبر واتساب</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Hero Slide Controls / Indicator Dots */}
                    {heroSlides.length > 1 && (
                      <div className="relative lg:absolute bottom-3 inset-x-0 z-20 flex items-center justify-center gap-3 pb-3 lg:pb-0">
                        <button
                          type="button"
                          onClick={() =>
                            setHeroSlideIdx((i) => (i - 1 + heroSlides.length) % heroSlides.length)
                          }
                          className="w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-sm cursor-pointer border border-slate-200"
                          aria-label="السابق"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
                          {heroSlides.map((sl, i) => (
                            <button
                              key={sl.id || i}
                              type="button"
                              onClick={() => setHeroSlideIdx(i)}
                              aria-label={`شريحة ${i + 1}`}
                              className="h-2.5 rounded-full transition-all cursor-pointer"
                              style={{
                                width: i === heroSlideIdx % heroSlides.length ? "20px" : "10px",
                                backgroundColor:
                                  i === heroSlideIdx % heroSlides.length
                                    ? "var(--ws-primary)"
                                    : "var(--ws-border)"
                              }}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setHeroSlideIdx((i) => (i + 1) % heroSlides.length)}
                          className="w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-sm cursor-pointer border border-slate-200"
                          aria-label="التالي"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          /* ── FEATURES STRIP SECTION (Unified 4-Column Horizontal Bar) ── */
          if (sec.id === "features") {
            return (
              <section key={sec.id} className="py-4 sm:py-6">
                <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8`}>
                  <div
                    className="border overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x lg:divide-x-reverse"
                    style={{
                      backgroundColor: "var(--ws-card-bg)",
                      borderColor: "var(--ws-border)",
                      borderRadius: "var(--ws-card-radius)",
                      boxShadow: "var(--ws-shadow)"
                    }}
                  >
                    {featuresList.map((feat) => (
                      <div
                        key={feat.id}
                        className="p-5 sm:p-6 flex flex-col items-center text-center gap-2.5 transition-colors"
                        style={{ borderColor: "var(--ws-border)" }}
                      >
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "var(--ws-primary-soft)" }}
                        >
                          {renderFeatureIcon(feat.icon, cfg.primary_color)}
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="text-sm font-extrabold leading-snug"
                            style={{ color: "var(--ws-text-primary)" }}
                          >
                            {feat.title}
                          </h3>
                          <p
                            className="text-xs mt-1 leading-relaxed"
                            style={{ color: "var(--ws-text-secondary)" }}
                          >
                            {feat.subtitle}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          /* ── SERVICES SHOWCASE SECTION ── */
          if (sec.id === "services_showcase") {
            return (
              <section id="services-showcase" key={sec.id} className={spacingClass}>
                <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8`}>
                  <div
                    className="p-5 sm:p-8 border space-y-6"
                    style={{
                      backgroundColor: "var(--ws-primary-soft)",
                      borderColor: "var(--ws-primary-border)",
                      borderRadius: "var(--ws-card-radius)"
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                      <div>
                        <h2
                          className="text-xl sm:text-2xl font-black tracking-tight"
                          style={{ color: "var(--ws-text-primary)" }}
                        >
                          {sec.title || "أهم خدمات النظام"}
                        </h2>
                        <p
                          className="text-xs sm:text-sm mt-1"
                          style={{ color: "var(--ws-text-secondary)" }}
                        >
                          {sec.subtitle || "كل ما تحتاجه لإدارة أعمال السفر والسياحة في مكان واحد"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => scrollToTarget("#booking-console")}
                        className="gap-1.5 text-xs font-bold whitespace-nowrap self-start sm:self-auto cursor-pointer"
                        style={{
                          backgroundColor: "var(--ws-card-bg)",
                          borderColor: "var(--ws-primary)",
                          color: "var(--ws-primary)",
                          borderRadius: "var(--ws-btn-radius)"
                        }}
                      >
                        <span>عرض جميع الخدمات</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                      {serviceShowcaseCards.map((srv) => (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => scrollToTarget(srv.target || "#booking-console", srv.tab)}
                          className={`${cardSurfaceClass} p-4 sm:p-5 text-center flex flex-col items-center gap-3 cursor-pointer`}
                          style={{
                            backgroundColor: "var(--ws-card-bg)",
                            borderColor: "var(--ws-border)",
                            borderRadius: "var(--ws-card-radius)",
                            boxShadow: "var(--ws-shadow)"
                          }}
                        >
                          {srv.resolvedImage && showServicesImgs ? (
                            <img
                              src={srv.resolvedImage}
                              alt={srv.title}
                              className="w-14 h-14 rounded-2xl object-cover border"
                              style={{ borderColor: "var(--ws-border)" }}
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: "var(--ws-primary-soft)" }}
                            >
                              {renderShowcaseIcon(srv.icon, cfg.primary_color)}
                            </div>
                          )}
                          <div>
                            <div
                              className="text-sm font-extrabold leading-snug"
                              style={{ color: "var(--ws-text-primary)" }}
                            >
                              {srv.title}
                            </div>
                            <div
                              className="text-[11px] mt-1 leading-relaxed"
                              style={{ color: "var(--ws-text-secondary)" }}
                            >
                              {srv.subtitle}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          /* ── INTERACTIVE BOOKING CONSOLE SECTION ── */
          if (sec.id === "booking_console") {
            return (
              <section id="booking-console" key={sec.id} className={spacingClass}>
                <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8 space-y-5`}>
                  <div className="text-center max-w-2xl mx-auto">
                    <h2
                      className="text-xl sm:text-2xl font-black tracking-tight"
                      style={{ color: "var(--ws-text-primary)" }}
                    >
                      {sec.title || "منصة البحث والحجز المباشر"}
                    </h2>
                    <p
                      className="text-xs sm:text-sm mt-1"
                      style={{ color: "var(--ws-text-secondary)" }}
                    >
                      {sec.subtitle || "اختر نوع الخدمة وأكمل بيانات الحجز للحصول على رقم PNR فوري"}
                    </p>
                  </div>

                  <div
                    className="p-3 sm:p-6 border"
                    style={{
                      backgroundColor: "var(--ws-card-bg)",
                      borderColor: "var(--ws-border)",
                      borderRadius: "var(--ws-card-radius)",
                      boxShadow: "var(--ws-shadow)"
                    }}
                  >
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList
                        className="flex lg:grid lg:grid-cols-7 overflow-x-auto no-scrollbar h-auto p-1.5 rounded-2xl gap-1 mb-6"
                        style={{ backgroundColor: "var(--ws-bg)" }}
                      >
                        {cfg.rides_enabled !== 0 && (
                          <TabsTrigger
                            value="rides"
                            className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                            style={
                              activeTab === "rides"
                                ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                                : { color: "var(--ws-text-primary)" }
                            }
                          >
                            <Car className="w-4 h-4" />
                            <span>المشاوير والنقل</span>
                          </TabsTrigger>
                        )}
                        {cfg.flight_enabled !== 0 && (
                          <TabsTrigger
                            value="flights"
                            className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                            style={
                              activeTab === "flights"
                                ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                                : { color: "var(--ws-text-primary)" }
                            }
                          >
                            <Plane className="w-4 h-4" />
                            <span>طيران</span>
                          </TabsTrigger>
                        )}
                        {cfg.hotel_enabled !== 0 && (
                          <TabsTrigger
                            value="hotels"
                            className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                            style={
                              activeTab === "hotels"
                                ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                                : { color: "var(--ws-text-primary)" }
                            }
                          >
                            <Building2 className="w-4 h-4" />
                            <span>فنادق</span>
                          </TabsTrigger>
                        )}
                        {cfg.packages_enabled !== 0 && (
                          <TabsTrigger
                            value="packages"
                            className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                            style={
                              activeTab === "packages"
                                ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                                : { color: "var(--ws-text-primary)" }
                            }
                          >
                            <Compass className="w-4 h-4" />
                            <span>باقات وعمرة</span>
                          </TabsTrigger>
                        )}
                        {cfg.visas_enabled !== 0 && (
                          <TabsTrigger
                            value="visas"
                            className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                            style={
                              activeTab === "visas"
                                ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                                : { color: "var(--ws-text-primary)" }
                            }
                          >
                            <FileText className="w-4 h-4" />
                            <span>تأشيرات</span>
                          </TabsTrigger>
                        )}
                        {cfg.bus_enabled !== 0 && (
                          <TabsTrigger
                            value="buses"
                            className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                            style={
                              activeTab === "buses"
                                ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                                : { color: "var(--ws-text-primary)" }
                            }
                          >
                            <Bus className="w-4 h-4" />
                            <span>باصات</span>
                          </TabsTrigger>
                        )}
                        <TabsTrigger
                          value="lookup"
                          className="shrink-0 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                          style={
                            activeTab === "lookup"
                              ? { backgroundColor: "var(--ws-primary)", color: "var(--ws-primary-text, #FFFFFF)" }
                              : { color: "var(--ws-text-primary)" }
                          }
                        >
                          <Search className="w-4 h-4" />
                          <span>تتبع حجزك</span>
                        </TabsTrigger>
                      </TabsList>

                      {/* TAB 1: RIDES */}
                      {cfg.rides_enabled !== 0 && (
                        <TabsContent value="rides" className="space-y-4 mt-0">
                          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--ws-border)", backgroundColor: "var(--ws-bg)" }}>
                            <div className="flex items-center gap-2.5">
                              <Car className="w-5 h-5 shrink-0" style={{ color: "var(--ws-primary)" }} />
                              <div>
                                <div className="text-xs font-extrabold" style={{ color: "var(--ws-text-primary)" }}>
                                  خدمات المشاوير والتوصيل الخاص VIP
                                </div>
                                <div className="text-[11px]" style={{ color: "var(--ws-text-secondary)" }}>
                                  تأكيد فوري بتنسيق مباشر مع {cfg.customer_service_name || "فريق الحجوزات"}
                                </div>
                              </div>
                            </div>
                            <Input
                              placeholder="ابحث عن مسار أو مطار..."
                              value={rideSearch}
                              onChange={(e) => setRideSearch(e.target.value)}
                              className="sm:max-w-xs h-10 text-xs"
                              style={{ backgroundColor: "var(--ws-card-bg)", borderColor: "var(--ws-border)" }}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {availableRides.map((ride: any, idx: number) => (
                              <div
                                key={`ride-${ride.id || idx}`}
                                className={`${cardSurfaceClass} p-4 flex flex-col justify-between gap-4`}
                                style={{
                                  backgroundColor: "var(--ws-card-bg)",
                                  borderColor: "var(--ws-border)",
                                  borderRadius: "var(--ws-card-radius)"
                                }}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold" style={{ color: "var(--ws-primary)" }}>
                                      {ride.badge || ride.type || "مشوار خاص"}
                                    </span>
                                    {ride.duration && (
                                      <span className="flex items-center gap-1" style={{ color: "var(--ws-text-secondary)" }}>
                                        <Clock className="w-3 h-3" />
                                        {ride.duration}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-sm font-extrabold leading-snug" style={{ color: "var(--ws-text-primary)" }}>
                                    {ride.title}
                                  </h4>
                                  {ride.car_type && (
                                    <div className="text-xs flex items-center gap-1.5" style={{ color: "var(--ws-text-secondary)" }}>
                                      <Car className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ws-primary)" }} />
                                      <span>{ride.car_type}</span>
                                    </div>
                                  )}
                                  {ride.features && (
                                    <div className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--ws-text-secondary)" }}>
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                                      <span>{ride.features}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--ws-border)" }}>
                                  <div>
                                    <span className="text-[10px] block" style={{ color: "var(--ws-text-secondary)" }}>
                                      السعر الصافي
                                    </span>
                                    <span className="text-base font-black" style={{ color: "var(--ws-primary)" }}>
                                      {fmt(ride.price)} {currencyLabel}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleOpenBooking(ride, "ride", ride.title, ride.price)}
                                    className="ws-btn-primary text-xs font-bold h-10 px-4 whitespace-nowrap cursor-pointer"
                                  >
                                    احجز المشوار
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      )}

                      {/* TAB 2: FLIGHTS */}
                      {cfg.flight_enabled !== 0 && (
                        <TabsContent value="flights" className="space-y-4 mt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--ws-border)", backgroundColor: "var(--ws-bg)" }}>
                            <div>
                              <label className="text-xs font-bold block mb-1" style={{ color: "var(--ws-text-primary)" }}>
                                مدينة المغادرة
                              </label>
                              <Input
                                placeholder="مثال: الرياض، جدة، عدن، صنعاء..."
                                value={flightOrigin}
                                onChange={(e) => setFlightOrigin(e.target.value)}
                                className="h-10 text-xs"
                                style={{ backgroundColor: "var(--ws-card-bg)", borderColor: "var(--ws-border)" }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold block mb-1" style={{ color: "var(--ws-text-primary)" }}>
                                وجهة الوصول
                              </label>
                              <Input
                                placeholder="مثال: دبي، القاهرة، لندن، اسطنبول..."
                                value={flightDest}
                                onChange={(e) => setFlightDest(e.target.value)}
                                className="h-10 text-xs"
                                style={{ backgroundColor: "var(--ws-card-bg)", borderColor: "var(--ws-border)" }}
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            {flights.map((f: any, idx: number) => (
                              <div
                                key={`flight-${f.id || idx}`}
                                className="p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                style={{
                                  backgroundColor: "var(--ws-card-bg)",
                                  borderColor: "var(--ws-border)",
                                  borderRadius: "var(--ws-card-radius)"
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs border shrink-0"
                                    style={{
                                      backgroundColor: "var(--ws-primary-soft)",
                                      color: "var(--ws-primary)",
                                      borderColor: "var(--ws-primary-border)"
                                    }}
                                  >
                                    <span>{f.airline_code || "SV"}</span>
                                    <span className="text-[10px] opacity-80">{f.flight_no}</span>
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-sm" style={{ color: "var(--ws-text-primary)" }}>
                                      {f.airline_name}
                                    </div>
                                    <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: "var(--ws-text-secondary)" }}>
                                      <span>{f.origin}</span>
                                      <ArrowLeft className="w-3.5 h-3.5" />
                                      <span className="font-bold" style={{ color: "var(--ws-text-primary)" }}>
                                        {f.destination}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 text-xs">
                                  <div>
                                    <span className="block text-[10px]" style={{ color: "var(--ws-text-secondary)" }}>الإقلاع</span>
                                    <span className="font-bold text-sm" style={{ color: "var(--ws-text-primary)" }}>{f.departure_time}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px]" style={{ color: "var(--ws-text-secondary)" }}>الوصول</span>
                                    <span className="font-bold text-sm" style={{ color: "var(--ws-text-primary)" }}>{f.arrival_time}</span>
                                  </div>
                                  {f.baggage_allowance_kg && (
                                    <div>
                                      <span className="block text-[10px]" style={{ color: "var(--ws-text-secondary)" }}>الأمتعة</span>
                                      <span className="font-bold text-xs">{f.baggage_allowance_kg} كجم</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: "var(--ws-border)" }}>
                                  <div>
                                    <span className="text-[10px] block" style={{ color: "var(--ws-text-secondary)" }}>الإجمالي الشامل</span>
                                    <span className="text-base font-black" style={{ color: "var(--ws-primary)" }}>
                                      {fmt(f.total_fare)} {currencyLabel}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      handleOpenBooking(
                                        f,
                                        "flight",
                                        `${f.airline_name} (${f.flight_no}) من ${f.origin} إلى ${f.destination}`,
                                        f.total_fare
                                      )
                                    }
                                    className="ws-btn-primary text-xs font-bold h-10 px-5 whitespace-nowrap cursor-pointer"
                                  >
                                    احجز الآن
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      )}

                      {/* TAB 3: HOTELS */}
                      {cfg.hotel_enabled !== 0 && (
                        <TabsContent value="hotels" className="space-y-4 mt-0">
                          <div className="p-3 rounded-xl border" style={{ borderColor: "var(--ws-border)", backgroundColor: "var(--ws-bg)" }}>
                            <Input
                              placeholder="ابحث بالمدينة (مثال: مكة المكرمة، المدينة المنورة، جدة، الرياض)"
                              value={hotelCity}
                              onChange={(e) => setHotelCity(e.target.value)}
                              className="h-10 text-xs"
                              style={{ backgroundColor: "var(--ws-card-bg)", borderColor: "var(--ws-border)" }}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {hotels.map((h: any, idx: number) => (
                              <div
                                key={`hotel-${h.id || idx}`}
                                className="p-4 border flex flex-col justify-between gap-4"
                                style={{
                                  backgroundColor: "var(--ws-card-bg)",
                                  borderColor: "var(--ws-border)",
                                  borderRadius: "var(--ws-card-radius)"
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className="text-sm font-extrabold" style={{ color: "var(--ws-text-primary)" }}>
                                      {h.hotel_name}
                                    </h4>
                                    <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--ws-text-secondary)" }}>
                                      <MapPin className="w-3.5 h-3.5" style={{ color: "var(--ws-primary)" }} />
                                      <span>{h.city} - {h.country || "المملكة العربية السعودية"}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 shrink-0">
                                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                                    <span>{h.star_rating || 5} نجوم</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: "var(--ws-border)" }}>
                                  <span className="text-xs" style={{ color: "var(--ws-text-secondary)" }}>
                                    {h.amenities || "واي فاي مجاني • إفطار • خدمة غرف"}
                                  </span>
                                  <div className="text-left shrink-0">
                                    <span className="text-[10px] block" style={{ color: "var(--ws-text-secondary)" }}>الليلة من</span>
                                    <span className="text-base font-black block mb-1.5" style={{ color: "var(--ws-primary)" }}>
                                      {fmt(h.avg_room_rate || 450)} {currencyLabel}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        handleOpenBooking(
                                          h,
                                          "hotel",
                                          `حجز فندق: ${h.hotel_name} (${h.city})`,
                                          h.avg_room_rate || 450
                                        )
                                      }
                                      className="ws-btn-primary text-xs font-bold h-9 px-4 cursor-pointer"
                                    >
                                      احجز الغرفة
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      )}

                      {/* TAB 4: PACKAGES */}
                      {cfg.packages_enabled !== 0 && (
                        <TabsContent value="packages" className="space-y-4 mt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(catalog?.packages || []).map((pkg: any, idx: number) => (
                              <div
                                key={`pkg-${pkg.id || idx}`}
                                className="border overflow-hidden flex flex-col justify-between"
                                style={{
                                  backgroundColor: "var(--ws-card-bg)",
                                  borderColor: "var(--ws-border)",
                                  borderRadius: "var(--ws-card-radius)"
                                }}
                              >
                                <div className="p-4" style={{ backgroundColor: "var(--ws-footer-bg)", color: "var(--ws-footer-text, #FFFFFF)" }}>
                                  <span className="text-[11px] font-bold" style={{ color: "var(--ws-secondary)" }}>
                                    {pkg.package_type || "برنامج سياحي"}
                                  </span>
                                  <h4 className="text-base font-black mt-1 leading-snug">{pkg.package_name}</h4>
                                  <div className="flex items-center gap-1.5 text-xs opacity-85 mt-2">
                                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--ws-secondary)" }} />
                                    <span>{pkg.duration_days || 7} أيام / {pkg.duration_nights || 6} ليالٍ</span>
                                  </div>
                                </div>
                                <div className="p-4 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] block" style={{ color: "var(--ws-text-secondary)" }}>
                                      للفرد ابتداءً من
                                    </span>
                                    <span className="text-base font-black" style={{ color: "var(--ws-primary)" }}>
                                      {fmt(pkg.price_per_person || 2400)} {currencyLabel}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenBooking(
                                        pkg,
                                        "package",
                                        `باقة: ${pkg.package_name}`,
                                        pkg.price_per_person || 2400
                                      )
                                    }
                                    className="ws-btn-primary text-xs font-bold h-10 px-4 cursor-pointer"
                                  >
                                    احجز الباقة
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      )}

                      {/* TAB 5: VISAS */}
                      {cfg.visas_enabled !== 0 && (
                        <TabsContent value="visas" className="space-y-4 mt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(catalog?.visas || []).map((v: any, idx: number) => (
                              <div
                                key={`visa-${idx}`}
                                className="p-4 border flex flex-col justify-between gap-3"
                                style={{
                                  backgroundColor: "var(--ws-card-bg)",
                                  borderColor: "var(--ws-border)",
                                  borderRadius: "var(--ws-card-radius)"
                                }}
                              >
                                <div className="space-y-1.5">
                                  <span className="text-[11px] font-bold" style={{ color: "var(--ws-primary)" }}>
                                    خدمة معتمدة
                                  </span>
                                  <h4 className="text-sm font-extrabold" style={{ color: "var(--ws-text-primary)" }}>
                                    {v.country}
                                  </h4>
                                  <p className="text-xs font-medium" style={{ color: "var(--ws-text-secondary)" }}>
                                    {v.type}
                                  </p>
                                  <div className="text-xs pt-1" style={{ color: "var(--ws-text-secondary)" }}>
                                    <strong>المدة:</strong> {v.processing_days}
                                  </div>
                                </div>

                                <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--ws-border)" }}>
                                  <span className="text-base font-black" style={{ color: "var(--ws-primary)" }}>
                                    {fmt(v.price)} {currencyLabel}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleOpenBooking(v, "visa", `تأشيرة: ${v.country}`, v.price)}
                                    className="ws-btn-primary text-xs font-bold h-9 px-4 cursor-pointer"
                                  >
                                    طلب التأشيرة
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      )}

                      {/* TAB 6: BUSES */}
                      {cfg.bus_enabled !== 0 && (
                        <TabsContent value="buses" className="space-y-4 mt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(catalog?.buses || []).map((b: any, idx: number) => (
                              <div
                                key={`bus-${idx}`}
                                className="p-4 border flex items-center justify-between gap-3"
                                style={{
                                  backgroundColor: "var(--ws-card-bg)",
                                  borderColor: "var(--ws-border)",
                                  borderRadius: "var(--ws-card-radius)"
                                }}
                              >
                                <div>
                                  <div className="flex items-center gap-2 font-extrabold text-sm" style={{ color: "var(--ws-text-primary)" }}>
                                    <Bus className="w-4 h-4 shrink-0" style={{ color: "var(--ws-primary)" }} />
                                    <span>من {b.from} إلى {b.to}</span>
                                  </div>
                                  <div className="text-xs mt-1" style={{ color: "var(--ws-text-secondary)" }}>
                                    {b.operator} · {b.departure_time}
                                  </div>
                                </div>
                                <div className="text-left shrink-0">
                                  <span className="text-base font-black block mb-1" style={{ color: "var(--ws-primary)" }}>
                                    {fmt(b.price)} {currencyLabel}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenBooking(b, "bus", `تذكرة باص من ${b.from} إلى ${b.to}`, b.price)
                                    }
                                    className="ws-btn-primary text-xs font-bold h-9 px-4 cursor-pointer"
                                  >
                                    احجز
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      )}

                      {/* TAB 7: BOOKING LOOKUP */}
                      <TabsContent value="lookup" className="space-y-5 mt-0">
                        <div className="max-w-xl mx-auto text-center space-y-4 py-2">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border"
                            style={{
                              backgroundColor: "var(--ws-primary-soft)",
                              color: "var(--ws-primary)",
                              borderColor: "var(--ws-primary-border)"
                            }}
                          >
                            <Search className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-black" style={{ color: "var(--ws-text-primary)" }}>
                              استعلام وتتبع حجز {cfg.site_name}
                            </h3>
                            <p className="text-xs mt-1" style={{ color: "var(--ws-text-secondary)" }}>
                              أدخل رقم الحجز المرجعي أو رقم PNR أو رقم الجوال للاطلاع على حالة الحجز وطباعة التذكرة
                            </p>
                          </div>

                          <form onSubmit={handleLookupSubmit} className="flex gap-2">
                            <Input
                              placeholder="رقم الحجز (مثل: WEB-123456) أو رقم الجوال"
                              value={lookupQuery}
                              onChange={(e) => setLookupQuery(e.target.value)}
                              className="h-11 text-xs"
                              style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)" }}
                            />
                            <Button
                              type="submit"
                              disabled={isLookingUp}
                              className="ws-btn-primary h-11 px-5 font-bold text-xs shrink-0 cursor-pointer"
                            >
                              {isLookingUp ? "جارٍ البحث..." : "استعلام"}
                            </Button>
                          </form>
                          {lookupError && <p className="text-xs font-bold text-rose-600">{lookupError}</p>}
                        </div>

                        {lookupResults && (
                          <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ws-border)" }}>
                            {(lookupResults.online_bookings || []).length === 0 &&
                            (lookupResults.travel_bookings || []).length === 0 ? (
                              <p className="text-center text-xs py-4" style={{ color: "var(--ws-text-secondary)" }}>
                                لم يتم العثور على حجوزات مطابقة للبحث
                              </p>
                            ) : (
                              <>
                                {(lookupResults.online_bookings || []).map((b: any, idx: number) => (
                                  <div
                                    key={`lookup-online-${b.id || idx}`}
                                    className="p-4 border rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                                    style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)" }}
                                  >
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-xs" style={{ color: "var(--ws-primary)" }}>
                                          {b.booking_ref}
                                        </span>
                                        <span className="font-bold text-sm" style={{ color: "var(--ws-text-primary)" }}>
                                          {b.service_title}
                                        </span>
                                      </div>
                                      <div className="text-xs mt-1 flex flex-wrap gap-3" style={{ color: "var(--ws-text-secondary)" }}>
                                        <span><strong>المسافر:</strong> {b.customer_name}</span>
                                        <span><strong>PNR:</strong> {b.pnr}</span>
                                        <span><strong>الحالة:</strong> {b.booking_status === "confirmed" ? "مؤكد" : b.booking_status}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-sm" style={{ color: "var(--ws-primary)" }}>
                                        {fmt(b.total_amount)} {currencyLabel}
                                      </span>
                                      {b.booking_status === "confirmed" ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.print()}
                                          className="text-xs gap-1 cursor-pointer"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>طباعة التذكرة</span>
                                        </Button>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
                                          بانتظار موافقة الإدارة
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </section>
            );
          }

          /* ── PROMOTIONS & BANNERS SECTION ── */
          if (sec.id === "promotions") {
            if (promotions.length === 0) return null;
            return (
              <section key={sec.id} className={spacingClass}>
                <div className={`${maxWidthClass} mx-auto px-3 sm:px-6 lg:px-8 space-y-5`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black" style={{ color: "var(--ws-text-primary)" }}>
                        {sec.title || "أحدث العروض والبنرات الإعلانية"}
                      </h2>
                      <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--ws-text-secondary)" }}>
                        {sec.subtitle || "عروض موسمية مخصصة وحصرية لعملائنا"}
                      </p>
                    </div>
                    {cfg.promo_code && (
                      <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--ws-primary)" }}>
                        <Tag className="w-4 h-4" />
                        <span>كود الخصم: {cfg.promo_code}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {promotions.map((promo, idx) => (
                      <div
                        key={`promo-${promo.id || idx}`}
                        className="border overflow-hidden flex flex-col sm:flex-row items-stretch"
                        style={{
                          backgroundColor: "var(--ws-card-bg)",
                          borderColor: "var(--ws-border)",
                          borderRadius: "var(--ws-card-radius)",
                          boxShadow: "var(--ws-shadow)"
                        }}
                      >
                        {showImagesGlobally && promo.image_url && (
                          <div className="sm:w-44 h-40 sm:h-auto shrink-0 overflow-hidden bg-slate-100">
                            <img
                              src={promo.image_url}
                              alt={promo.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center justify-between gap-2 text-[11px] font-bold mb-1">
                              <span style={{ color: "var(--ws-primary)" }}>{promo.badge || "عرض خاص"}</span>
                              {promo.discount_text && (
                                <span style={{ color: "var(--ws-secondary)" }}>{promo.discount_text}</span>
                              )}
                            </div>
                            <h3 className="text-base font-extrabold" style={{ color: "var(--ws-text-primary)" }}>
                              {promo.title}
                            </h3>
                            {promo.subtitle && (
                              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--ws-text-secondary)" }}>
                                {promo.subtitle}
                              </p>
                            )}
                          </div>
                          <div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => scrollToTarget(promo.link_url || "#booking-console")}
                              className="ws-btn-primary text-xs font-bold h-9 px-4 cursor-pointer"
                            >
                              احجز العرض الآن
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          /* ── INQUIRY & CONTACT SECTION ── */
          if (sec.id === "inquiry_contact") {
            return (
              <section id="contact-section" key={sec.id} className={`${spacingClass} border-t`} style={{ borderColor: "var(--ws-border)" }}>
                <div className="max-w-4xl mx-auto px-3 sm:px-6">
                  <div
                    className="p-5 sm:p-8 border"
                    style={{
                      backgroundColor: "var(--ws-card-bg)",
                      borderColor: "var(--ws-border)",
                      borderRadius: "var(--ws-card-radius)",
                      boxShadow: "var(--ws-shadow)"
                    }}
                  >
                    <div className="text-center max-w-xl mx-auto mb-6">
                      <span className="text-xs font-bold" style={{ color: "var(--ws-primary)" }}>
                        طلب رحلة أو خدمة مخصصة
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black mt-1" style={{ color: "var(--ws-text-primary)" }}>
                        {cfg.inquiry_title || sec.title || "هل تحتاج ترتيب مشوار خاص أو باقة سفر عائلية؟"}
                      </h2>
                      <p className="text-xs mt-1.5" style={{ color: "var(--ws-text-secondary)" }}>
                        {cfg.inquiry_subtitle || sec.subtitle || `فريق ${cfg.site_name} جاهز لخدمتك على مدار الساعة`}
                      </p>
                    </div>

                    <form onSubmit={handleInquiryFormSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold block mb-1">الاسم الكريم *</label>
                          <Input
                            required
                            placeholder="اسمك الكريم"
                            value={inquiryForm.name}
                            onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                            className="h-10 text-xs"
                            style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)" }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1">رقم الهاتف / الواتساب *</label>
                          <Input
                            required
                            placeholder="05XXXXXXXX"
                            value={inquiryForm.phone}
                            onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                            className="h-10 text-xs"
                            style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)" }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1">الخدمة المطلوبة</label>
                          <select
                            value={inquiryForm.service_interest}
                            onChange={(e) => setInquiryForm({ ...inquiryForm, service_interest: e.target.value })}
                            className="w-full h-10 border rounded-xl text-xs px-3 font-medium"
                            style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)", color: "var(--ws-text-primary)" }}
                          >
                            <option value="مشوار ونقل سياحي VIP">مشوار ونقل سياحي VIP</option>
                            <option value="توصيل واستقبال مطار">توصيل واستقبال مطار</option>
                            <option value="حجوزات طيران">حجوزات طيران وتذاكر</option>
                            <option value="باقة عمرة وزيارة">باقة عمرة وزيارة</option>
                            <option value="تأشيرات سياحية">تأشيرات سياحية</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold block mb-1">تفاصيل الطلب *</label>
                        <textarea
                          required
                          rows={3}
                          placeholder="حدد نقطة الانطلاق والوصول، التاريخ والوقت، وعدد المسافرين..."
                          value={inquiryForm.message}
                          onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                          className="w-full border rounded-xl text-xs p-3 font-medium"
                          style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)", color: "var(--ws-text-primary)" }}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={inquirySending}
                          className="ws-btn-primary w-full sm:w-auto text-xs font-bold h-11 px-8 cursor-pointer"
                        >
                          {inquirySending ? "جارٍ الإرسال..." : "إرسال الطلب لمستشار السفر"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            );
          }

          return null;
        })}
      </main>

      {/* ─── 4. Footer ─── */}
      {footerEnabled && (
        <footer
          className="py-10 sm:py-12 border-t mt-auto text-xs"
          style={{
            backgroundColor: "var(--ws-footer-bg)",
            color: "var(--ws-footer-text, #FFFFFF)",
            borderColor: "var(--ws-border)"
          }}
        >
          <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8`}>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <BrandLogoDisplay cfg={cfg} choice={cfg.footer_logo_type} size={40} />
                <span className="font-black text-sm">{cfg.site_name}</span>
              </div>
              <p className="opacity-80 text-xs leading-relaxed">{cfg.footer_desc}</p>
              <div className="text-xs font-bold" style={{ color: "var(--ws-secondary)" }}>
                {cfg.customer_service_name}
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-3">{cfg.footer_quick_services_title || "الخدمات السريعة"}</h4>
              <ul className="space-y-2 opacity-80">
                <li>
                  <button type="button" onClick={() => scrollToTarget("#booking-console", "rides")} className="hover:opacity-100 transition-opacity cursor-pointer">
                    المشاوير وتوصيل المطارات
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToTarget("#booking-console", "flights")} className="hover:opacity-100 transition-opacity cursor-pointer">
                    حجز تذاكر الطيران
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToTarget("#booking-console", "hotels")} className="hover:opacity-100 transition-opacity cursor-pointer">
                    حجوزات الفنادق
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToTarget("#booking-console", "packages")} className="hover:opacity-100 transition-opacity cursor-pointer">
                    الباقات السياحية والعمرة
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToTarget("#booking-console", "visas")} className="hover:opacity-100 transition-opacity cursor-pointer">
                    خدمات التأشيرات
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3">{cfg.footer_contact_title || "التواصل المباشر"}</h4>
              <ul className="space-y-2.5 opacity-85">
                <li className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ws-secondary)" }} />
                  <span className="dir-ltr">{defaultPhone}</span>
                </li>
                {cfg.secondary_phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ws-secondary)" }} />
                    <span className="dir-ltr">{cfg.secondary_phone}</span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ws-secondary)" }} />
                  <span>{cfg.email}</span>
                </li>
                {(cfg.footer_address || cfg.geo_location) && (
                  <li className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ws-secondary)" }} />
                    <span>{cfg.footer_address || cfg.geo_location}</span>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3">{cfg.footer_guarantee_title || "ضمانات الخدمة"}</h4>
              <p className="opacity-80 mb-3 text-xs leading-relaxed">
                {cfg.footer_guarantee_desc}
              </p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/15 border border-current/15 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "var(--ws-secondary)" }} />
                <span>{cfg.footer_license_badge || "حجوزات آمنة ومعتمدة 100%"}</span>
              </div>
            </div>
          </div>

          <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8 pt-6 mt-8 border-t border-current/15 text-center opacity-75 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-3`}>
            <span>{cfg.footer_copyright}</span>
            <span style={{ color: "var(--ws-secondary)" }} className="font-bold">
              {cfg.nav_subtitle || "بوابة الحجوزات الذكية"}
            </span>
          </div>
        </footer>
      )}

      {/* ─── 5. Compact Mobile Sticky Bottom Bar (<= 56px, < 15% mobile viewport) ─── */}
      <nav
        aria-label="شريط التنقل السريع للهواتف"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t backdrop-blur-md px-2 flex items-center justify-around"
        style={{
          backgroundColor: cfg.navbar_bg_color,
          borderColor: "var(--ws-border)"
        }}
      >
        <button
          type="button"
          onClick={() => scrollToTarget("#booking-console", "rides")}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] cursor-pointer"
          style={{ color: activeTab === "rides" ? "var(--ws-primary)" : "var(--ws-text-secondary)" }}
        >
          <Car className="w-4 h-4" />
          <span className="text-[10px] font-bold">المشاوير</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToTarget("#booking-console", "flights")}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] cursor-pointer"
          style={{ color: activeTab === "flights" ? "var(--ws-primary)" : "var(--ws-text-secondary)" }}
        >
          <Plane className="w-4 h-4" />
          <span className="text-[10px] font-bold">الطيران</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToTarget("#booking-console", "lookup")}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] cursor-pointer"
          style={{ color: activeTab === "lookup" ? "var(--ws-primary)" : "var(--ws-text-secondary)" }}
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px] font-bold">تتبع</span>
        </button>
        <button
          type="button"
          onClick={() => onSendWhatsApp(whatsappPhone, `مرحباً ${cfg.site_name}، أود الاستفسار والحجز`)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] text-emerald-600 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-bold">واتساب</span>
        </button>
      </nav>

      {/* ─── 6. BOOKING CHECKOUT & PNR BOARDING PASS MODAL ─── */}
      {bookingModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border my-auto"
            style={{
              backgroundColor: "var(--ws-card-bg)",
              borderColor: "var(--ws-border)",
              borderRadius: "var(--ws-card-radius)",
              color: "var(--ws-text-primary)"
            }}
          >
            {!confirmedBooking ? (
              <form onSubmit={handleConfirmSubmit} className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b" style={{ borderColor: "var(--ws-border)" }}>
                  <div>
                    <span className="text-xs font-bold" style={{ color: "var(--ws-primary)" }}>
                      {cfg.site_name}
                    </span>
                    <h3 className="text-sm sm:text-base font-black mt-0.5">{bookingModalItem.title}</h3>
                    <p className="text-xs" style={{ color: "var(--ws-text-secondary)" }}>
                      القيمة الأساسية للفرد: {fmt(bookingModalItem.baseAmount)} {currencyLabel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBookingModalItem(null)}
                    className="rounded-full h-9 w-9 p-0"
                  >
                    ✕
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1">الاسم الكامل *</label>
                    <Input
                      required
                      placeholder="كما هو مدون في الهوية أو الجواز"
                      value={bookingForm.customer_name}
                      onChange={(e) => setBookingForm({ ...bookingForm, customer_name: e.target.value })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">رقم الجوال (واتساب) *</label>
                    <Input
                      required
                      placeholder="05XXXXXXXX"
                      value={bookingForm.customer_phone}
                      onChange={(e) => setBookingForm({ ...bookingForm, customer_phone: e.target.value })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">تاريخ الحجز المفضل</label>
                    <Input
                      type="date"
                      value={bookingForm.departure_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, departure_date: e.target.value })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">عدد المسافرين</label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={bookingForm.passengers_count}
                      onChange={(e) => setBookingForm({ ...bookingForm, passengers_count: Number(e.target.value) || 1 })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">كود الخصم (اختياري)</label>
                    <Input
                      placeholder={cfg.promo_code ? `مثال: ${cfg.promo_code}` : "أدخل كود الخصم"}
                      value={bookingForm.promo_code}
                      onChange={(e) => setBookingForm({ ...bookingForm, promo_code: e.target.value })}
                      className="rounded-xl h-10 text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div className="p-3 rounded-2xl border space-y-2 text-xs" style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)" }}>
                  <span className="font-bold block">طريقة السداد:</span>
                  <div className={`grid gap-2 ${esaalatMethods?.isEnabled ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                    {esaalatMethods?.isEnabled && (
                      <label
                        className="p-2.5 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all text-center"
                        style={{
                          backgroundColor: bookingForm.payment_method === "esaalat" ? "var(--ws-primary-soft)" : "var(--ws-card-bg)",
                          borderColor: bookingForm.payment_method === "esaalat" ? "var(--ws-primary)" : "var(--ws-border)"
                        }}
                      >
                        <input
                          type="radio"
                          name="pay"
                          className="hidden"
                          checked={bookingForm.payment_method === "esaalat"}
                          onChange={() => setBookingForm({ ...bookingForm, payment_method: "esaalat" })}
                        />
                        <ShieldCheck className="w-4 h-4 mb-1 text-emerald-600" />
                        <span className="text-[11px] font-bold">{esaalatMethods.displayName || "الدفع عبر Esaalat"}</span>
                      </label>
                    )}

                    {cfg.payment_card_enabled !== 0 && (
                      <label
                        className="p-2.5 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all"
                        style={{
                          backgroundColor: bookingForm.payment_method === "credit_card" ? "var(--ws-primary-soft)" : "var(--ws-card-bg)",
                          borderColor: bookingForm.payment_method === "credit_card" ? "var(--ws-primary)" : "var(--ws-border)"
                        }}
                      >
                        <input
                          type="radio"
                          name="pay"
                          className="hidden"
                          checked={bookingForm.payment_method === "credit_card"}
                          onChange={() => setBookingForm({ ...bookingForm, payment_method: "credit_card" })}
                        />
                        <CreditCard className="w-4 h-4 mb-1" style={{ color: "var(--ws-primary)" }} />
                        <span className="text-[11px] font-bold">بطاقة بنكية</span>
                      </label>
                    )}

                    {cfg.payment_bank_enabled !== 0 && (
                      <label
                        className="p-2.5 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all"
                        style={{
                          backgroundColor: bookingForm.payment_method === "bank_transfer" ? "var(--ws-primary-soft)" : "var(--ws-card-bg)",
                          borderColor: bookingForm.payment_method === "bank_transfer" ? "var(--ws-primary)" : "var(--ws-border)"
                        }}
                      >
                        <input
                          type="radio"
                          name="pay"
                          className="hidden"
                          checked={bookingForm.payment_method === "bank_transfer"}
                          onChange={() => setBookingForm({ ...bookingForm, payment_method: "bank_transfer" })}
                        />
                        <Building2 className="w-4 h-4 mb-1" style={{ color: "var(--ws-primary)" }} />
                        <span className="text-[11px] font-bold">تحويل بنكي</span>
                      </label>
                    )}

                    {cfg.payment_cash_enabled !== 0 && (
                      <label
                        className="p-2.5 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all"
                        style={{
                          backgroundColor: bookingForm.payment_method === "pay_at_branch" ? "var(--ws-primary-soft)" : "var(--ws-card-bg)",
                          borderColor: bookingForm.payment_method === "pay_at_branch" ? "var(--ws-primary)" : "var(--ws-border)"
                        }}
                      >
                        <input
                          type="radio"
                          name="pay"
                          className="hidden"
                          checked={bookingForm.payment_method === "pay_at_branch"}
                          onChange={() => setBookingForm({ ...bookingForm, payment_method: "pay_at_branch" })}
                        />
                        <MapPin className="w-4 h-4 mb-1" style={{ color: "var(--ws-primary)" }} />
                        <span className="text-[11px] font-bold">دفع بالفرع</span>
                      </label>
                    )}
                  </div>

                  {bookingForm.payment_method === "esaalat" && esaalatMethods?.isEnabled && (
                    <div className="mt-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2 text-[11px]">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{esaalatMethods.displayName || "الدفع الإلكتروني عبر Esaalat"}</span>
                      </div>
                      {esaalatMethods.description && (
                        <p className="text-emerald-800">{esaalatMethods.description}</p>
                      )}
                      {Array.isArray(esaalatMethods.accounts) && esaalatMethods.accounts.length > 0 && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">اختر المحفظة / الحساب المفضل (اختياري):</label>
                          <select
                            value={preferredEsaalatAccountId}
                            onChange={(e) => setPreferredEsaalatAccountId(e.target.value)}
                            className="w-full h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold"
                          >
                            <option value="">السماح بالاختيار داخل بوابة Esaalat</option>
                            {esaalatMethods.accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.accountName || acc.label} {(acc.serviceName || acc.providerName) ? `(${acc.serviceName || acc.providerName})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {bookingForm.payment_method === "bank_transfer" && cfg.bank_iban && (
                    <div className="mt-2 p-2.5 rounded-xl border text-[11px]" style={{ backgroundColor: "var(--ws-card-bg)", borderColor: "var(--ws-border)" }}>
                      <div><strong>البنك:</strong> {cfg.bank_name}</div>
                      <div className="font-mono"><strong>IBAN:</strong> {cfg.bank_iban}</div>
                      <div><strong>المستفيد:</strong> {cfg.bank_account_name}</div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--ws-border)" }}>
                  <div>
                    <span className="text-xs block" style={{ color: "var(--ws-text-secondary)" }}>الإجمالي المستحق</span>
                    <span className="text-lg sm:text-xl font-black" style={{ color: "var(--ws-primary)" }}>
                      {fmt(netBookingTotal)} {currencyLabel}
                    </span>
                    {promoDiscountAmount > 0 && (
                      <span className="text-[11px] text-emerald-600 font-bold block">
                        تم تطبيق خصم ({fmt(promoDiscountAmount)} {currencyLabel})
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setBookingModalItem(null)} className="rounded-xl text-xs h-10">
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingBooking}
                      className="ws-btn-primary text-xs font-bold h-10 px-5 cursor-pointer"
                    >
                      {isSubmittingBooking ? "جارٍ الإرسال..." : "إرسال طلب الحجز"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xs ${
                  esaalatVerifyResult?.verified && esaalatVerifyResult?.status === "paid"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-600"
                }`}>
                  {esaalatVerifyResult?.verified && esaalatVerifyResult?.status === "paid" ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : (
                    <Clock className="w-8 h-8" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black" style={{ color: "var(--ws-text-primary)" }}>
                    {confirmedBooking.payment_method === "esaalat"
                      ? esaalatVerifyResult?.verified && esaalatVerifyResult?.status === "paid"
                        ? "تم سداد وتأكيد المعاملة بنجاح"
                        : `تم حجز المعاملة في ${cfg.site_name} — بانتظار السداد عبر Esaalat`
                      : `تم حجز المعاملة في ${cfg.site_name}`}
                  </h3>
                  {confirmedBooking.payment_method !== "esaalat" && (
                    <p className="text-xs sm:text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 leading-relaxed">
                      تم حجز المعاملة، سوف يتم الموافقة عليها قريباً، وسوف يتم إشعارك بذلك
                    </p>
                  )}
                </div>

                {confirmedBooking.payment_method === "esaalat" && (
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-right space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        بوابة الدفع الإلكتروني الآمن (Esaalat)
                      </span>
                      {esaalatSession && (
                        <span className="text-[11px] font-mono font-bold text-slate-600">
                          {esaalatSession.amount} {esaalatSession.currency}
                        </span>
                      )}
                    </div>

                    {esaalatSessionLoading && (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-slate-600">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>جارٍ إنشاء جلسة دفع مشفرة من الخادم...</span>
                      </div>
                    )}

                    {esaalatSessionError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{esaalatSessionError}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEsaalatCheckoutSession(confirmedBooking.id, preferredEsaalatAccountId || undefined)}
                          className="h-8 text-xs font-bold gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          إعادة محاولة إنشاء جلسة الدفع
                        </Button>
                      </div>
                    )}

                    {esaalatVerifyResult && esaalatVerifyResult.status !== "pending" && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-bold ${
                          esaalatVerifyResult.verified && esaalatVerifyResult.status === "paid"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                            : esaalatVerifyResult.status === "wrong_amount"
                            ? "bg-amber-50 border-amber-300 text-amber-900"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        {esaalatVerifyResult.message}
                      </div>
                    )}

                    {esaalatSession && !(esaalatVerifyResult?.verified && esaalatVerifyResult?.status === "paid") && (
                      <div className="flex flex-col items-center gap-2.5 pt-1">
                        <EsaalatCheckoutButton
                          sessionToken={esaalatSession.sessionToken}
                          portalUrl={esaalatSession.portalUrl}
                          locale="ar"
                          presentation={esaalatSession.presentationMode || "modal"}
                          variant="dark"
                          radius={12}
                          label={`ادفع الآن (${esaalatSession.amount} ${esaalatSession.currency})`}
                          onVerified={async (result) => {
                            await verifyEsaalatOutcome(esaalatSession.externalOrderId, {
                              intentCode: result.intentCode,
                              status: result.status
                            });
                          }}
                          onCancelled={async (result) => {
                            await verifyEsaalatOutcome(
                              esaalatSession.externalOrderId,
                              { intentCode: result.intentCode, status: "CANCELLED" },
                              "تم إلغاء عملية الدفع من قبل المستخدم"
                            );
                          }}
                          onWrongAmount={async (result) => {
                            await verifyEsaalatOutcome(
                              esaalatSession.externalOrderId,
                              { intentCode: result.intentCode, status: "WRONG_AMOUNT" },
                              "المبلغ المحول غير مطابق لقيمة الحجز"
                            );
                          }}
                          onExpired={async (result) => {
                            await verifyEsaalatOutcome(
                              esaalatSession.externalOrderId,
                              { intentCode: result.intentCode, status: "EXPIRED" },
                              "انتهت مهلة جلسة الدفع — يمكنك إنشاء جلسة جديدة"
                            );
                          }}
                          onFailed={async (result) => {
                            await verifyEsaalatOutcome(
                              esaalatSession.externalOrderId,
                              { intentCode: result.intentCode, status: "FAILED" },
                              "تعذر التحقق من جلسة الدفع"
                            );
                          }}
                          onError={(error) => {
                            setEsaalatVerifyResult({
                              status: "failed",
                              verified: false,
                              message: error.message || "تعذر فتح نافذة الدفع"
                            });
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              verifyEsaalatOutcome(
                                esaalatSession.externalOrderId,
                                {},
                                "لم يظهر تأكيد السداد من الخادم بعد"
                              )
                            }
                            className="h-8 text-[11px] font-bold gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            تحقق من حالة الدفع من الخادم
                          </Button>
                          {(esaalatVerifyResult?.status === "expired" ||
                            esaalatVerifyResult?.status === "cancelled" ||
                            esaalatVerifyResult?.status === "failed") && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                startEsaalatCheckoutSession(confirmedBooking.id, preferredEsaalatAccountId || undefined)
                              }
                              className="h-8 text-[11px] font-bold gap-1"
                            >
                              <Wallet className="w-3 h-3" />
                              إنشاء جلسة دفع جديدة
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="text-white p-4 sm:p-5 rounded-2xl text-right shadow-lg border-2"
                  style={{ backgroundColor: "#0F294A", borderColor: "var(--ws-secondary)" }}
                >
                  <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <BrandLogoDisplay cfg={cfg} choice={cfg.header_logo_type} size={28} />
                      <span className="font-black text-xs sm:text-sm text-white">{cfg.site_name}</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-amber-300">
                      {confirmedBooking.booking_ref}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-white/75 shrink-0">المسافر:</span>
                      <span className="font-bold text-white text-left">{confirmedBooking.customer_name}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-white/75 shrink-0">الخدمة:</span>
                      <span className="font-bold text-amber-300 text-left">{confirmedBooking.service_title}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-white/75 shrink-0">رقم PNR المرجعي:</span>
                      <span className="font-mono font-black text-emerald-300 text-sm">{confirmedBooking.pnr}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-white/75 shrink-0">المبلغ الإجمالي:</span>
                      <span className="font-black text-base text-amber-300">
                        {fmt(confirmedBooking.total_amount)} {currencyLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setBookingModalItem(null);
                      setConfirmedBooking(null);
                      setEsaalatSession(null);
                      setEsaalatVerifyResult(null);
                    }}
                    className="ws-btn-primary w-full h-11 text-xs font-extrabold cursor-pointer"
                  >
                    إغلاق ومتابعة التصفح
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 7. CUSTOMER SELF-SERVICE REGISTRATION MODAL (4WhatsApp OTP + Optional/Mandatory ID Upload) ─── */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="max-w-md w-full p-5 sm:p-6 shadow-2xl border my-auto max-h-[94vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--ws-card-bg)",
              borderColor: "var(--ws-border)",
              borderRadius: "var(--ws-card-radius)",
              color: "var(--ws-text-primary)"
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: "var(--ws-border)" }}>
              <div>
                <h3 className="text-base font-black">
                  {isOtpRequired ? "فتح حساب عميل وتأكيد الواتساب" : "إنشاء حساب عميل جديد"}
                </h3>
                <p className="text-xs" style={{ color: "var(--ws-text-secondary)" }}>
                  {isOtpRequired
                    ? `افتح حسابك في ${cfg.site_name} وتأكد من رقمك عبر كود 4WhatsApp`
                    : `سجل بياناتك في ${cfg.site_name} للبدء في الحجز فوراً`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRegisterModalOpen(false);
                  setAuthGateNotice(null);
                }}
                className="rounded-full h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {authGateNotice && (
              <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold leading-relaxed">
                {authGateNotice}
              </div>
            )}

            {regError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">الاسم الكامل *</label>
                <Input
                  required
                  placeholder="الاسم الثلاثي أو الرباعي"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="h-10 text-xs"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">
                  رقم الجوال {isOtpEnabled ? "(واتساب) *" : "*"}
                </label>
                <div className="flex gap-2">
                  <Input
                    required
                    placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    className="h-10 text-xs flex-1 font-mono dir-ltr text-left"
                  />
                  {isOtpEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={regOtpSending || regOtpCooldown > 0}
                      onClick={handleSendRegOtp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-3 text-[11px] font-bold gap-1 shrink-0 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {regOtpSending
                          ? "جارٍ الإرسال..."
                          : regOtpCooldown > 0
                          ? `إعادة (${regOtpCooldown}ث)`
                          : regOtpSent
                          ? "إعادة إرسال"
                          : isOtpRequired
                          ? "إرسال كود واتساب *"
                          : "تأكيد الرقم (اختياري)"}
                      </span>
                    </Button>
                  )}
                </div>
                {regOtpNotice ? (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    {regOtpNotice}
                  </p>
                ) : regOtpSent ? (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    تم إرسال كود التحقق إلى رقم الواتساب الخاص بك
                  </p>
                ) : null}
              </div>

              {(isOtpRequired || (isOtpEnabled && (regOtpSent || registerForm.otp_code))) && (
                <div>
                  <label className="font-bold block mb-1">
                    كود التحقق المرسل عبر واتساب {isOtpRequired ? "*" : "(اختياري)"}
                  </label>
                  <Input
                    required={isOtpRequired}
                    maxLength={4}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="أدخل الكود المكون من 4 أرقام من واتساب"
                    value={registerForm.otp_code}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        otp_code: e.target.value.replace(/\D/g, "").slice(0, 4)
                      })
                    }
                    className="h-10 text-sm font-mono font-black tracking-widest text-center dir-ltr"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">كلمة المرور (للدخول لاحقاً)</label>
                  <Input
                    type="password"
                    placeholder="اختياري (4 أحرف فأكثر)"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">الجنسية</label>
                  <Input
                    value={registerForm.nationality}
                    onChange={(e) => setRegisterForm({ ...registerForm, nationality: e.target.value })}
                    className="h-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">البريد الإلكتروني (اختياري)</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="h-10 text-xs"
                />
              </div>

              {cfg.show_id_upload !== 0 && (
                <div className="p-3 rounded-xl border border-dashed space-y-2" style={{ borderColor: "var(--ws-border)", backgroundColor: "var(--ws-bg)" }}>
                  <div className="flex items-center justify-between">
                    <label className="font-bold flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" style={{ color: "var(--ws-primary)" }} />
                      <span>
                        صورة الجواز أو الهوية الوطنية{" "}
                        {cfg.require_id_upload === 1 ? (
                          <span className="text-rose-600">* (مطلوب)</span>
                        ) : (
                          <span className="text-slate-500">(اختياري)</span>
                        )}
                      </span>
                    </label>
                    {registerForm.id_image_data && (
                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, id_image_data: "", id_image_name: "" })}
                        className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        حذف الصورة
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleIdFileChange}
                    className="block w-full text-[11px] file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {registerForm.id_image_data && (
                    <div className="flex items-center gap-2 pt-1">
                      <img
                        src={registerForm.id_image_data}
                        alt="معاينة الوثيقة"
                        className="w-16 h-12 object-cover rounded-lg border"
                      />
                      <span className="text-[11px] text-emerald-700 font-bold truncate">
                        تم إرفاق: {registerForm.id_image_name || "صورة الوثيقة"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--ws-border)" }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRegisterModalOpen(false);
                    setAuthGateNotice(null);
                  }}
                  className="h-10 text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={registerLoading}
                  className="ws-btn-primary h-10 px-5 text-xs font-bold cursor-pointer"
                >
                  {registerLoading
                    ? "جارٍ تسجيل الحساب..."
                    : isOtpRequired
                    ? "تأكيد الكود وفتح الحساب"
                    : "إنشاء الحساب وبدء الحجز فوراً"}
                </Button>
              </div>

              <div className="text-center pt-2 border-t" style={{ borderColor: "var(--ws-border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterModalOpen(false);
                    setLoginError(null);
                    setLoginModalOpen(true);
                  }}
                  className="text-xs font-bold hover:underline cursor-pointer"
                  style={{ color: "var(--ws-primary)" }}
                >
                  لديك حساب عميل مسجل بالفعل؟ اضغط هنا لتسجيل الدخول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 8. DEDICATED CLIENT LOGIN MODAL ─── */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="max-w-md w-full p-5 sm:p-6 shadow-2xl border my-auto"
            style={{
              backgroundColor: "var(--ws-card-bg)",
              borderColor: "var(--ws-border)",
              borderRadius: "var(--ws-card-radius)",
              color: "var(--ws-text-primary)"
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: "var(--ws-border)" }}>
              <div>
                <h3 className="text-base font-black">تسجيل دخول العميل</h3>
                <p className="text-xs" style={{ color: "var(--ws-text-secondary)" }}>
                  أدخل بيانات حسابك لمتابعة حجوزاتك في {cfg.site_name}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLoginModalOpen(false);
                  setAuthGateNotice(null);
                }}
                className="rounded-full h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {authGateNotice && (
              <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold leading-relaxed">
                {authGateNotice}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border mb-4" style={{ backgroundColor: "var(--ws-bg)", borderColor: "var(--ws-border)" }}>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("password");
                  setLoginError(null);
                }}
                className="py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                style={
                  loginMode === "password"
                    ? { backgroundColor: "var(--ws-primary)", color: "#FFFFFF" }
                    : { color: "var(--ws-text-secondary)" }
                }
              >
                <Lock className="w-3.5 h-3.5" />
                <span>بكلمة المرور</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("otp");
                  setLoginError(null);
                }}
                className="py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                style={
                  loginMode === "otp"
                    ? { backgroundColor: "var(--ws-primary)", color: "#FFFFFF" }
                    : { color: "var(--ws-text-secondary)" }
                }
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>بكود الواتساب (OTP)</span>
              </button>
            </div>

            {loginError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">رقم الجوال المسجل *</label>
                <div className="flex gap-2">
                  <Input
                    required
                    placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                    value={loginForm.phone}
                    onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                    className="h-10 text-xs flex-1 font-mono dir-ltr text-left"
                  />
                  {loginMode === "otp" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={loginOtpSending || loginOtpCooldown > 0}
                      onClick={handleSendLoginOtp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-3 text-[11px] font-bold gap-1 shrink-0 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {loginOtpSending
                          ? "جارٍ الإرسال..."
                          : loginOtpCooldown > 0
                          ? `(${loginOtpCooldown}ث)`
                          : loginOtpSent
                          ? "إعادة إرسال"
                          : "إرسال الكود"}
                      </span>
                    </Button>
                  )}
                </div>
                {loginOtpNotice && (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    {loginOtpNotice}
                  </p>
                )}
              </div>

              {loginMode === "password" ? (
                <div>
                  <label className="font-bold block mb-1">كلمة المرور *</label>
                  <Input
                    required
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="h-10 text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="font-bold block mb-1">كود التحقق المرسل عبر واتساب *</label>
                  <Input
                    required
                    maxLength={4}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="أدخل الرمز المكون من 4 أرقام من واتساب"
                    value={loginForm.otp_code}
                    onChange={(e) =>
                      setLoginForm({
                        ...loginForm,
                        otp_code: e.target.value.replace(/\D/g, "").slice(0, 4)
                      })
                    }
                    className="h-10 text-sm font-mono font-black tracking-widest text-center dir-ltr"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--ws-border)" }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLoginModalOpen(false);
                    setAuthGateNotice(null);
                  }}
                  className="h-10 text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="ws-btn-primary h-10 px-5 text-xs font-bold cursor-pointer"
                >
                  {loginLoading ? "جارٍ الدخول..." : "دخول لحسابي"}
                </Button>
              </div>

              <div className="text-center pt-2 border-t" style={{ borderColor: "var(--ws-border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalOpen(false);
                    setRegError(null);
                    setRegisterModalOpen(true);
                  }}
                  className="text-xs font-bold hover:underline cursor-pointer"
                  style={{ color: "var(--ws-primary)" }}
                >
                  عميل جديد؟ اضغط هنا لفتح حساب وتفعيله عبر واتساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
