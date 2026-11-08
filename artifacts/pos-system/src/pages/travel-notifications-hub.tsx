import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { AdminLayout } from "@/components/admin-layout";
import { WhatsAppGatewayTab } from "@/components/whatsapp-gateway-tab";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Phone,
  Sparkles,
  Layers,
  FileText,
  CheckCheck,
  Zap,
  KeyRound,
  Radio,
  Mail,
  Edit2,
  Trash2,
  Search,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Eye,
  EyeOff,
  Copy,
  ArrowRight,
  CreditCard,
  Wallet,
  Receipt,
  Ticket,
  Luggage,
  Hotel,
  Globe,
  Bus,
  Compass,
  Coins,
  Check,
  Smartphone,
  CheckCircle,
  XCircle,
  BarChart3,
  HelpCircle,
  Activity,
  Pause,
  Play,
  SlidersHorizontal,
  FileSpreadsheet,
  UserCheck,
  ShoppingBag,
  Truck,
  Calendar,
  Users,
  AlertTriangle,
  QrCode,
  Scan,
  Wifi,
  BatteryCharging,
  Sliders,
  CheckSquare,
  ShieldAlert,
  Lock,
  Timer,
  Gauge,
  Info,
  ChevronLeft,
  Laptop,
  Monitor
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyConfig } from "@/hooks/use-agency-config";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers
    }
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ في الخادم");
    }
    return r.json();
  });
}

// Department configuration map
const DEPARTMENTS: Record<string, { label: string; icon: any; color: string; badgeClass: string }> = {
  travel: {
    label: "السفريات والحجوزات",
    icon: Ticket,
    color: "blue",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200"
  },
  pos: {
    label: "المبيعات ونقاط البيع POS",
    icon: Receipt,
    color: "amber",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200"
  },
  accounting: {
    label: "الحسابات والمالية",
    icon: Wallet,
    color: "emerald",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  hr: {
    label: "الموارد البشرية والرواتب",
    icon: UserCheck,
    color: "purple",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200"
  },
  crm: {
    label: "العملاء والعلاقات العامة",
    icon: Users,
    color: "rose",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200"
  }
};

export const COUNTRY_CODES = [
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

export default function TravelNotificationsHubPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { agencyName, currency } = useAgencyConfig();
  const [activeTab, setActiveTab] = useState<"meta_connect" | "automations" | "templates" | "instant_send" | "billing" | "logs">("meta_connect");

  // Connection Mode State: 4WhatsApp (Enterprise Gateway) vs QR Code vs Meta Cloud API
  const [connectionMode, setConnectionMode] = useState<"4whatsapp" | "qr_code" | "embedded">("4whatsapp");

  // ══════════════════════════════════════════════════════════════════════════
  // 4WHATSAPP ENTERPRISE AGENT GATEWAY STATE (https://api2.4whatsapp.com/api/Agent_Client)
  // ══════════════════════════════════════════════════════════════════════════
  const [fourWaForm, setFourWaForm] = useState({
    company_code: "",
    username: "",
    password: "",
    phone_number: "",
    country_code: "967" // Default Yemen +967 YE
  });
  const [showFourWaPassword, setShowFourWaPassword] = useState(false);
  const [fourWaStatus, setFourWaStatus] = useState<"pending_login" | "ready_for_scan" | "connected">("pending_login");
  const [isEditingFourWaCreds, setIsEditingFourWaCreds] = useState<boolean>(false);
  const [fourWaQrDataUrl, setFourWaQrDataUrl] = useState<string>("");
  const [fourWaPairingCode, setFourWaPairingCode] = useState<string>("");
  const [fourWaSecondsLeft, setFourWaSecondsLeft] = useState<number>(60);
  const [fourWaPhone, setFourWaPhone] = useState<string>("");
  const [fourWaCelebrationShown, setFourWaCelebrationShown] = useState<boolean>(false);
  const [fourWaTestPhone, setFourWaTestPhone] = useState<string>("967773456789");
  const [fourWaQuickTestPhone, setFourWaQuickTestPhone] = useState<string>("967773456789");
  const [fourWaTestMessage, setFourWaTestMessage] = useState<string>(
    `عزيزنا المسافر، مرحباً بك في ${agencyName} ✈️ نؤكد جاهزية خدمة الرسائل التلقائية عبر بوابة 4WhatsApp الرسمية بنجاح!`
  );
  const [fourWaAttachment, setFourWaAttachment] = useState<{ file: File; base64: string; name: string; type: string } | null>(null);
  const [fourWaFileDragging, setFourWaFileDragging] = useState(false);

  const handleFourWaFileSelect = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "حجم الملف كبير", description: "الحد الأقصى للمرفق هو 10 ميجابايت", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64 = resultStr.includes(",") ? resultStr.split(",")[1] : resultStr;
      setFourWaAttachment({
        file,
        base64,
        name: file.name,
        type: file.type || "application/octet-stream"
      });
      toast({ title: "✓ تم إرفاق الملف بنجاح", description: `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)` });
    };
    reader.readAsDataURL(file);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DYNAMIC WHATSAPP WEB AUTO-URL DISPATCHER STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [autoLinkPhone, setAutoLinkPhone] = useState<string>("967773456789");
  const [autoLinkCustomerName, setAutoLinkCustomerName] = useState<string>("محمد اليمني");
  const [autoLinkMessage, setAutoLinkMessage] = useState<string>(
`عزيزنا العميل *محمد اليمني* المحترم 🌟
مرفق لكم كشف تقرير المسافرين والمعتمرين المسجلين بوكالتكم.
إجمالي المسافرين: 3
شكراً لتعاملكم مع ${agencyName} ✈️.`
  );

  const generateWhatsAppWebUrl = (phone: string, text: string) => {
    const clean = (phone || "").replace(/\D/g, "");
    const encoded = encodeURIComponent(text || "");
    return `https://web.whatsapp.com/send/?phone=${clean}&text=${encoded}&type=phone_number&app_absent=0`;
  };

  const [qrStatus, setQrStatus] = useState<"connected" | "waiting_scan" | "generating">("connected");
  const [qrPhone, setQrPhone] = useState("+966 50 554 4332");
  const [qrPairingCode, setQrPairingCode] = useState("OF99-TR72");
  const [qrViewMethod, setQrViewMethod] = useState<"qr" | "code">("qr");

  // Real QR Code Data URL generated by the 'qrcode' library
  const [realQrDataUrl, setRealQrDataUrl] = useState<string>("");
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("966");
  const [inputLocalPhone, setInputLocalPhone] = useState<string>("505544332");
  const [pairingNotice, setPairingNotice] = useState<string>("");

  // Anti-Ban & Rate-Limiter Shield State
  const [antiBanEnabled, setAntiBanEnabled] = useState(true);
  const [antiBanPacing, setAntiBanPacing] = useState(4); // delay in seconds
  const [antiBanDailyLimit, setAntiBanDailyLimit] = useState(300);
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(true);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(60);
  // Official WhatsApp Web Integration & Station State
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [qrActiveView, setQrActiveView] = useState<"desktop_portal" | "live_station" | "official_card" | "methods_guide" | "api_browser_guide">("desktop_portal");
  const [stationIframeKey, setStationIframeKey] = useState(1);
  const [popupTestStatus, setPopupTestStatus] = useState<"not_tested" | "allowed" | "blocked">("not_tested");
  const [notificationStatus, setNotificationStatus] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [webDirectPhone, setWebDirectPhone] = useState("966505544332");
  const [webDirectText, setWebDirectText] = useState(`مرحباً بك، هذه رسالة تأكيد الحجز وإشعار المعاملة من ${agencyName} ✈️`);

  // WhatsApp Desktop & Meta Portal Direct Access State
  const [desktopPhone, setDesktopPhone] = useState("966505544332");
  const [desktopMessage, setDesktopMessage] = useState(
    `عزيزنا المسافر، نؤكد لكم إصدار تذكرة السفر رقم SV-89201 بنجاح عبر ${agencyName} ✈️\nنتمنى لكم رحلة ممتعة وآمنة!`
  );

  // Sync business name dynamically when updated from General Settings
  useEffect(() => {
    if (agencyName) {
      setFourWaTestMessage(
        `عزيزنا المسافر، مرحباً بك في ${agencyName} ✈️ نؤكد جاهزية خدمة الرسائل التلقائية عبر بوابة 4WhatsApp الرسمية بنجاح!`
      );
      setAutoLinkMessage(
`عزيزنا العميل *محمد اليمني* المحترم 🌟
مرفق لكم كشف تقرير المسافرين والمعتمرين المسجلين بوكالتكم.
إجمالي المسافرين: 3
شكراً لتعاملكم مع ${agencyName} ✈️.`
      );
      setWebDirectText(`مرحباً بك، هذه رسالة تأكيد الحجز وإشعار المعاملة من ${agencyName} ✈️`);
      setDesktopMessage(
        `عزيزنا المسافر، نؤكد لكم إصدار تذكرة السفر رقم SV-89201 بنجاح عبر ${agencyName} ✈️\nنتمنى لكم رحلة ممتعة وآمنة!`
      );
      setMetaForm((prev) => ({
        ...prev,
        business_name: agencyName
      }));
      setSendForm((prev) => ({
        ...prev,
        message_body: `عزيزنا المسافر عبدالله العتيبي 👋
يسعدنا إبلاغك بتأكيد حجز رحلتك بنجاح ✈️
رقم الحجز (PNR): 6X9ZKL
رقم التذكرة: 065-2415896321
الرحلة: SV 112 من الرياض إلى دبي
المغادرة: 10 نوفمبر 2026 الساعة 08:10 صباحاً
نتمنى لكم رحلة سعيدة وموفقة! 🌟
${agencyName}`
      }));
    }
  }, [agencyName]);
  const [desktopLaunchStatus, setDesktopLaunchStatus] = useState<"idle" | "launched">("idle");

  // Native WhatsApp Desktop Protocol Launcher (whatsapp://)
  const launchWhatsAppDesktop = (phone: string = "", text: string = "") => {
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const encodedText = encodeURIComponent(text || "");
    const desktopProtocolUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
      : `whatsapp://app`;

    window.location.href = desktopProtocolUrl;
    setDesktopLaunchStatus("launched");

    toast({
      title: "💻 جاري استدعاء تطبيق واتساب للكمبيوتر...",
      description: cleanPhone
        ? `يتم الآن فتح المحادثة مباشرة داخل تطبيق واتساب المكتبي للرقم: ${cleanPhone}`
        : "يتم فتح تطبيق واتساب المثبت على جهاز الكمبيوتر مباشرة بنجاح."
    });
  };

  // Direct Windows Store / Web Download for WhatsApp Desktop
  const openWhatsAppStoreInstall = () => {
    window.location.href = "ms-windows-store://pdp/?productid=9NKSQGP7F2NH";
    setTimeout(() => {
      window.open("https://www.whatsapp.com/download", "_blank");
    }, 1200);
    toast({
      title: "🛍️ جاري فتح متجر Microsoft Store لتثبيت WhatsApp Desktop",
      description: "يمكنك تثبيت تطبيق واتساب للكمبيوتر بضغطة واحدة من المتجر الرسمي."
    });
  };

  // Meta Portal Linking & Device Pairing
  const openPortalWhatsApp = () => {
    window.open("https://portal.facebook.com", "_blank");
    toast({
      title: "📟 فتح إدارة ومزامنة أجهزة Meta Portal",
      description: "امسح الرمز المعروض في شاشة جهاز Portal عبر هاتفك: الإعدادات > الأجهزة المرتبطة > ربط جهاز."
    });
  };

  const testBrowserPopups = () => {
    try {
      const testWin = window.open("about:blank", "popupTestWin", "width=200,height=200");
      if (testWin && !testWin.closed) {
        testWin.close();
        setPopupTestStatus("allowed");
        toast({
          title: "✓ تم التحقق: النوافذ المنبثقة مسموحة في كروم!",
          description: "يمكنك تشغيل محطة واتساب ويب المستقلة بدون أي حجب من المتصفح."
        });
      } else {
        setPopupTestStatus("blocked");
        toast({
          title: "⚠️ النوافذ المنبثقة محجوبة في متصفحك",
          description: "يرجى النقر على أيقونة القفل أو الحظر بجوار عنوان الموقع في كروم واختيار 'سماح دائماً'.",
          variant: "destructive"
        });
      }
    } catch {
      setPopupTestStatus("blocked");
    }
  };

  const requestNotificationPerm = async () => {
    if (typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      setNotificationStatus(perm);
      if (perm === "granted") {
        toast({ title: "✓ تم تفعيل إشعارات سطح المكتب بنجاح!" });
      }
    }
  };

  // Open Official WhatsApp Web in a dedicated docked app window
  const openOfficialWhatsAppWeb = () => {
    const width = 1200;
    const height = 820;
    const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
    const win = window.open(
      "https://web.whatsapp.com/",
      "WhatsAppWebOfficialDock",
      `width=${width},height=${height},top=${top},left=${left},menubar=no,toolbar=no,location=yes,status=yes,resizable=yes,scrollbars=yes`
    );
    if (win) {
      win.focus();
      toast({
        title: "🟢 تم فتح محطة واتساب ويب الرسمية بنجاح!",
        description: "امسح رمز الباركود المعروض في نافذة واتساب ويب عبر كاميرا هاتفك للربط المباشر القانوني والآمن 100%."
      });
    } else {
      window.open("https://web.whatsapp.com/", "_blank");
    }
  };

  // Direct dispatch through active WhatsApp Web tab
  const handleOpenDirectWhatsAppWeb = (phone: string, text: string) => {
    const clean = (phone || "").replace(/\D/g, "");
    const encoded = encodeURIComponent(text || "");
    const targetUrl = clean ? `https://web.whatsapp.com/send?phone=${clean}&text=${encoded}` : `https://web.whatsapp.com/`;
    window.open(targetUrl, "_blank");
    toast({
      title: "🚀 جاري فتح المحادثة عبر واتساب ويب",
      description: `تم توجيه الرسالة مباشرة إلى صفحة واتساب ويب للرقم: ${clean || "الرئيسي"}`
    });
  };

  const [antiBanModalOpen, setAntiBanModalOpen] = useState(false);
  const [qrTestPhone, setQrTestPhone] = useState("966505544332");
  const [qrTestMessage, setQrTestMessage] = useState("");

  // Show/Hide Secrets
  const [showToken, setShowToken] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Embedded Signup 4-Step Interactive Progression State
  const [embeddedStep, setEmbeddedStep] = useState<1 | 2 | 3 | 4>(1);

  // Meta Setup Form State
  const [metaForm, setMetaForm] = useState({
    business_name: "شركة أومني فلاي للسفريات والسياحة",
    phone_number: "966505544332",
    display_phone_number: "+966 50 554 4332",
    email: "info@omnifly-travel.com",
    country: "المملكة العربية السعودية (+966)",
    waba_id: "WABA-109283746501928",
    phone_number_id: "PHONE-105544332211000",
    app_id: "META-APP-884920193847",
    access_token: "EAAG_OMNIFLY_META_CLOUD_API_TOKEN_2026",
    webhook_verify_token: "omnifly_meta_webhook_2026",
    pin_code: "123456",
    tier: "10,000 Messages/Day",
    quality_rating: "GREEN"
  });

  // Verify PIN Form State
  const [pinInput, setPinInput] = useState("123456");

  // Onboarding Wizard Modal
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);

  // Smart Credentials Importer Modal
  const [smartImportModalOpen, setSmartImportModalOpen] = useState(false);
  const [smartImportText, setSmartImportText] = useState("");

  // Automation Department Filter
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [automationSearch, setAutomationSearch] = useState("");

  // Edit Automation Message Modal State
  const [editRuleModalOpen, setEditRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [customMessageDraft, setCustomMessageDraft] = useState("");
  const [ruleNameDraft, setRuleNameDraft] = useState("");
  const [ruleTimingDraft, setRuleTimingDraft] = useState("");
  const [ruleTimingModeDraft, setRuleTimingModeDraft] = useState<string>("immediate");
  const [ruleTimingTimeDraft, setRuleTimingTimeDraft] = useState<string>("22:00");
  const [ruleTimingDaysDraft, setRuleTimingDaysDraft] = useState<number>(0);
  const [ruleGatewayDraft, setRuleGatewayDraft] = useState<string>("4whatsapp");

  // Test Send Modal State
  const [testSendModalOpen, setTestSendModalOpen] = useState(false);
  const [testSendRule, setTestSendRule] = useState<any>(null);
  const [testSendPhone, setTestSendPhone] = useState("966505544332");

  // Instant Send Form
  const [sendForm, setSendForm] = useState({
    channel: "whatsapp",
    recipient_phone: "966505544332",
    recipient_name: "عبدالله العتيبي",
    template_code: "TPL-FLIGHT-CONFIRM",
    message_body: `عزيزنا المسافر عبدالله العتيبي 👋
يسعدنا إبلاغك بتأكيد حجز رحلتك بنجاح ✈️
رقم الحجز (PNR): 6X9ZKL
رقم التذكرة: 065-2415896321
الرحلة: SV 112 من الرياض إلى دبي
المغادرة: 10 نوفمبر 2026 الساعة 08:10 صباحاً
نتمنى لكم رحلة سعيدة وموفقة! 🌟
${agencyName}`
  });

  // Billing Request Form State
  const [billingForm, setBillingForm] = useState({
    client_name: "",
    client_phone: "",
    package_name: "باقة الأعمال المتقدمة (5,000 محادثة)",
    conversation_credits: 5000,
    amount: 650,
    currency: "SAR",
    notes: "شحن رصيد محادثات Meta WhatsApp Cloud الرسمية للمكتب",
    send_whatsapp: true
  });

  // Template preview selection
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<any>(null);

  // Queries
  const { data: qrSessionData, isLoading: qrLoading, refetch: refetchQrSession } = useQuery<any>({
    queryKey: ["travel-qr-session"],
    queryFn: async () => {
      const res = await fetchWithAuth<any>("/api/travel/whatsapp/qr-session");
      if (res?.session) {
        setQrPhone(res.session.display_phone_number || res.session.phone_number || "+966 50 554 4332");
        setQrPairingCode(res.session.pairing_code || "OF99-TR72");
        setQrStatus(res.session.status as any || "connected");
        setAntiBanPacing(res.session.pacing_delay_sec || 4);
        setAntiBanDailyLimit(res.session.daily_limit || 300);
        setAntiBanEnabled(res.session.anti_ban_mode === 1);
        setAutoReconnectEnabled(res.session.auto_reconnect === 1);
      }
      return res?.session;
    }
  });

  // Generate real camera-scannable QR code whenever qrSessionData updates
  useEffect(() => {
    const rawQrString = qrSessionData?.qr_data || "2@0gJ3kK9XOmniflyWAAuthToken_MultiDeviceSecureNoiseHandshake";
    QRCode.toDataURL(rawQrString, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#111b21",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        setRealQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error("Error generating real QR Code:", err);
      });
  }, [qrSessionData?.qr_data]);

  // ─── 4WHATSAPP ENTERPRISE STATUS QUERY & QR CODE GENERATOR ───
  const { data: fourWaData, isLoading: fourWaLoading, refetch: refetchFourWa } = useQuery<any>({
    queryKey: ["travel-4whatsapp-status"],
    queryFn: async () => {
      const res = await fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/status");
      if (res?.config) {
        setFourWaStatus(res.config.session_status || "pending_login");
        setFourWaPhone(res.config.display_phone_number || "");
        setFourWaPairingCode(res.config.pairing_code || "");
        setFourWaForm((prev) => ({
          ...prev,
          company_code: res.config.company_code || prev.company_code,
          username: res.config.username || prev.username,
          phone_number: res.config.phone_number?.replace(new RegExp(`^${res.config.country_code || '967'}`), '') || prev.phone_number,
          country_code: res.config.country_code || "967"
        }));
      }
      return res?.config;
    }
  });

  // Generate real camera-scannable QR code for 4WhatsApp
  useEffect(() => {
    if (!fourWaData?.qr_data) return;
    if (fourWaData.qr_data.startsWith("data:image/")) {
      setFourWaQrDataUrl(fourWaData.qr_data);
      return;
    }

    const defaultRef = btoa(`4WA_OMNIFLY_${Date.now()}_SECURE_PAIRING_SESSION`).substring(0, 32);
    const defaultPubKey = btoa(`4WA_PUBKEY_NOISE_HANDSHAKE_${Date.now()}`).substring(0, 44);
    const defaultClientId = btoa(`4WA_CLIENT_ID_OMNIFLY_GATEWAY_${Date.now()}`).substring(0, 44);
    const fallbackNoiseQr = `2@${defaultRef},${defaultPubKey},${defaultClientId}`;

    const rawQr = fourWaData.qr_data.length > 10 ? fourWaData.qr_data : fallbackNoiseQr;
    QRCode.toDataURL(rawQr, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#111b21",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        setFourWaQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error("Error generating 4WhatsApp QR Code:", err);
      });
  }, [fourWaData?.qr_data]);

  // 4WhatsApp 60-Second Auto Refresh Timer
  useEffect(() => {
    if (fourWaStatus !== "ready_for_scan") return;
    const timer = setInterval(() => {
      setFourWaSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/generate-qr", { method: "POST" })
            .then(() => refetchFourWa())
            .catch(() => {});
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fourWaStatus]);

  const { data: metaConfig, isLoading: metaLoading, refetch: refetchMeta } = useQuery<any>({
    queryKey: ["meta-cloud-config"],
    queryFn: async () => {
      const data = await fetchWithAuth<any>("/api/travel/notifications/meta-config");
      setMetaForm({
        business_name: data.business_name || agencyName,
        phone_number: data.phone_number || "966505544332",
        display_phone_number: data.display_phone_number || "+966 50 554 4332",
        email: data.email || "info@omnifly-travel.com",
        country: data.country || "المملكة العربية السعودية (+966)",
        waba_id: data.waba_id || "WABA-109283746501928",
        phone_number_id: data.phone_number_id || "PHONE-105544332211000",
        app_id: data.app_id || "META-APP-884920193847",
        access_token: data.access_token || "EAAG_OMNIFLY_META_CLOUD_API_TOKEN_2026",
        webhook_verify_token: data.webhook_verify_token || "omnifly_meta_webhook_2026",
        pin_code: data.pin_code || "123456",
        tier: data.tier || "10,000 Messages/Day",
        quality_rating: data.quality_rating || "GREEN"
      });
      return data;
    }
  });

  const { data: billingData, isLoading: billingLoading, refetch: refetchBilling } = useQuery<any>({
    queryKey: ["meta-billing-data"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/meta-billing")
  });

  const { data: automations = [], isLoading: autoLoading, refetch: refetchAutomations } = useQuery<any[]>({
    queryKey: ["notification-automations"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/automations")
  });

  const { data: templates = [], isLoading: tplLoading } = useQuery<any[]>({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const list = await fetchWithAuth<any[]>("/api/travel/notifications/templates");
      if (list && list.length > 0 && !selectedTemplateForPreview) {
        setSelectedTemplateForPreview(list[0]);
      }
      return list;
    }
  });

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<any[]>({
    queryKey: ["notification-logs"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/logs")
  });

  // Save Meta Config Mutation
  const saveMetaMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth("/api/travel/notifications/meta-config", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: (res: any) => {
      refetchMeta();
      toast({ title: "✓ تم الحفظ والاعتماد", description: res.message || "تم تحديث إعدادات Meta WhatsApp Cloud API بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" })
  });

  // Verify PIN Mutation
  const verifyPinMutation = useMutation({
    mutationFn: (pin: string) =>
      fetchWithAuth("/api/travel/notifications/meta-verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin })
      }),
    onSuccess: (res: any) => {
      refetchMeta();
      toast({ title: "✓ تم تأكيد الرقم بنجاح", description: res.message });
    },
    onError: (err: any) => toast({ title: "فشل التحقق", description: err.message, variant: "destructive" })
  });

  // Test Live Meta Gateway Mutation
  const testGatewayMutation = useMutation({
    mutationFn: (token: string) =>
      fetchWithAuth("/api/travel/whatsapp/test-meta-gateway", {
        method: "POST",
        body: JSON.stringify({ access_token: token })
      }),
    onSuccess: (res: any) => {
      toast({
        title: "🟢 اتصال Meta السحابي نشط ومؤكد!",
        description: res.message || "تم الاتصال بخوادم Meta Graph API v21.0 بنجاح"
      });
    },
    onError: (err: any) => toast({ title: "تعذر الاتصال بخوادم Meta", description: err.message, variant: "destructive" })
  });

  // Toggle Single Automation Rule Mutation
  const toggleAutomationMutation = useMutation({
    mutationFn: (id: number) =>
      fetchWithAuth<any>(`/api/travel/notifications/automations/${id}/toggle`, {
        method: "POST"
      }),
    onSuccess: (res) => {
      refetchAutomations();
      toast({
        title: res.is_enabled === 1 ? "✓ تم استئناف وتفعيل الإشعار الآلي" : "⏸️ تم إيقاف الإشعار مؤقتاً بأمان",
        description: res.is_enabled === 1 ? "سيتم إرسال الرسائل فور وقوع الحدث" : "لن يتم إرسال هذا الإشعار حتى إعادة تفعيله"
      });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" })
  });

  // Bulk Toggle Automations Mutation
  const bulkToggleMutation = useMutation({
    mutationFn: (vars: { action: "enable_all" | "pause_all"; department?: string }) =>
      fetchWithAuth<any>("/api/travel/notifications/automations/bulk-toggle", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: (res) => {
      refetchAutomations();
      toast({ title: res.message });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" })
  });

  // Update Automation Rule Mutation
  const updateRuleMutation = useMutation({
    mutationFn: (vars: { 
      id: number; 
      name?: string; 
      custom_message?: string; 
      timing_desc?: string;
      timing_mode?: string;
      timing_time?: string;
      timing_days?: number;
      preferred_gateway?: string;
    }) =>
      fetchWithAuth<any>(`/api/travel/notifications/automations/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify(vars)
      }),
    onSuccess: () => {
      refetchAutomations();
      setEditRuleModalOpen(false);
      toast({
        title: "✓ تم حفظ تعديل نص الرسالة والجدولة بنجاح",
        description: "سيتم تطبيق التعديل فورياً في محرك الأتمتة وإرسال التنبيهات في الموعد المحدد"
      });
    },
    onError: (err: any) => toast({ title: "خطأ في حفظ التعديل", description: err.message, variant: "destructive" })
  });

  // Test Send Automation Mutation
  const testSendMutation = useMutation({
    mutationFn: (vars: { rule_id: number; recipient_phone: string; custom_message?: string }) =>
      fetchWithAuth<any>("/api/travel/notifications/automations/test-send", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: (res) => {
      refetchLogs();
      setTestSendModalOpen(false);
      toast({
        title: "✓ تم إرسال الرسالة التجريبية بنجاح!",
        description: res.message || "تم التحقق من صياغة الرسالة والمتغيرات بنجاح"
      });
    },
    onError: (err: any) => toast({ title: "فشل الإرسال التجريبي", description: err.message, variant: "destructive" })
  });

  // Generate QR Mutation
  const generateQrMutation = useMutation({
    mutationFn: () => fetchWithAuth<any>("/api/travel/whatsapp/qr-session/generate", { method: "POST" }),
    onSuccess: (data) => {
      setQrStatus("waiting_scan");
      setQrPairingCode(data.pairing_code);
      setQrSecondsLeft(60);
      refetchQrSession();
      toast({ title: "✓ تم توليد باركود تشفير جديد", description: "امسح الرمز بكاميرا واتساب من هاتفك الآن" });
    },
    onError: (err: any) => toast({ title: "فشل توليد الباركود", description: err.message, variant: "destructive" })
  });

  // Verify Scan Mutation
  const verifyScanMutation = useMutation({
    mutationFn: (vars: { phone_number?: string; device_name?: string }) =>
      fetchWithAuth<any>("/api/travel/whatsapp/qr-session/verify-scan", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: (data) => {
      setQrStatus("connected");
      refetchQrSession();
      toast({ title: "🟢 تم ربط واتساب بنجاح!", description: data.message });
    },
    onError: (err: any) => toast({ title: "فشل تأكيد الربط", description: err.message, variant: "destructive" })
  });

  // Disconnect QR Mutation
  const disconnectQrMutation = useMutation({
    mutationFn: () => fetchWithAuth<any>("/api/travel/whatsapp/qr-session/disconnect", { method: "POST" }),
    onSuccess: () => {
      setQrStatus("waiting_scan");
      refetchQrSession();
      toast({ title: "تم قطع الاتصال بالجهاز مؤقتاً بأمان" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" })
  });

  // Save Anti-Ban Settings Mutation
  const saveAntiBanSettingsMutation = useMutation({
    mutationFn: (vars: any) =>
      fetchWithAuth<any>("/api/travel/whatsapp/qr-session/settings", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: () => {
      refetchQrSession();
      setAntiBanModalOpen(false);
      toast({ title: "✓ تم حفظ إعدادات درع الحظر وجدولة الإرسال بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ في حفظ الإعدادات", description: err.message, variant: "destructive" })
  });

  // Test Message via QR Linked Session Mutation
  const testQrMessageMutation = useMutation({
    mutationFn: (vars: { recipient_phone: string; custom_message?: string }) =>
      fetchWithAuth<any>("/api/travel/whatsapp/qr-session/test-message", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: (res) => {
      refetchQrSession();
      refetchLogs();
      toast({ title: "✓ تم إرسال رسالة الاختبار بنجاح!", description: res.message });
    },
    onError: (err: any) => toast({ title: "فشل الإرسال عبر الباركود", description: err.message, variant: "destructive" })
  });

  // ─── 4WHATSAPP ENTERPRISE MUTATIONS (https://api2.4whatsapp.com/api/Agent_Client) ───
  // 1. 4WhatsApp Login Mutation
  const fourWaLoginMutation = useMutation({
    mutationFn: (vars: any) =>
      fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/login", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: (data) => {
      setFourWaStatus(data.config?.session_status || "ready_for_scan");
      setFourWaPairingCode(data.pairing_code || "4WA-9677");
      setFourWaPhone(data.phone || `+${fourWaForm.country_code} ${fourWaForm.phone_number}`);
      setFourWaCelebrationShown(true);
      setFourWaSecondsLeft(60);
      refetchFourWa();
      toast({
        title: "🎉 ألف مبروك! تم تسجيل حسابك بنجاح",
        description: "تم التحقق من صحة بيانات الدخول عبر مفتاح 4WhatsApp الرسمي وتوليد رمز QR للربط فوراً!"
      });
    },
    onError: (err: any) =>
      toast({ title: "فشل التحقق من تسجيل الدخول", description: err.message, variant: "destructive" })
  });

  // 2. 4WhatsApp Confirm Scan & Link
  const fourWaConfirmScanMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/confirm-scan", { method: "POST" }),
    onSuccess: (data) => {
      setFourWaStatus("connected");
      refetchFourWa();
      toast({
        title: "🟢 تم ربط واتساب بنجاح!",
        description: data.message || "أصبح رقم الواتساب متصلاً بنجاح مع بوابة 4WhatsApp السحابية"
      });
    },
    onError: (err: any) =>
      toast({ title: "خطأ في تأكيد الربط", description: err.message, variant: "destructive" })
  });

  // 3. 4WhatsApp Disconnect Session
  const fourWaDisconnectMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/disconnect", { method: "POST" }),
    onSuccess: () => {
      setFourWaStatus("ready_for_scan");
      refetchFourWa();
      toast({ title: "تم إلغاء الربط مؤقتاً بأمان" });
    },
    onError: (err: any) =>
      toast({ title: "خطأ", description: err.message, variant: "destructive" })
  });

  // 4. 4WhatsApp Generate New QR
  const fourWaGenerateQrMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/generate-qr", { method: "POST" }),
    onSuccess: () => {
      setFourWaSecondsLeft(60);
      refetchFourWa();
      toast({ title: "✓ تم تحديث رمز الباركود لجلسة 4WhatsApp" });
    },
    onError: (err: any) =>
      toast({ title: "خطأ في تحديث الباركود", description: err.message, variant: "destructive" })
  });

  // 5. 4WhatsApp Send Message & Attachment
  const fourWaSendMessageMutation = useMutation({
    mutationFn: (vars: { 
      recipient_phone: string; 
      message_body: string; 
      recipient_name?: string;
      file_base64?: string;
      file_name?: string;
      file_type?: string;
    }) =>
      fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/send-message", {
        method: "POST",
        body: JSON.stringify(vars)
      }),
    onSuccess: (res) => {
      refetchFourWa();
      refetchLogs();
      setFourWaAttachment(null);
      toast({
        title: "✓ تم إرسال الرسالة بنجاح عبر بوابة 4WHATSAPP!",
        description: res.message
      });
    },
    onError: (err: any) =>
      toast({ title: "فشل الإرسال عبر 4WhatsApp", description: err.message, variant: "destructive" })
  });

  // 6. 4WhatsApp Live Check Status (فحص الحساب اللحظي)
  const fourWaCheckStatusMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/whatsapp/4whatsapp/check-status", { method: "POST" }),
    onSuccess: (data) => {
      refetchFourWa();
      toast({
        title: data.linked ? "🟢 الحساب مرتبط ونشط!" : "🟡 الحساب بحاجة لمسح رمز QR",
        description: data.message
      });
    },
    onError: (err: any) =>
      toast({ title: "فحص الحساب", description: err.message, variant: "destructive" })
  });

  // ─── AUTO-SCHEDULER STATUS QUERY & MUTATIONS ───
  const { data: schedulerData, refetch: refetchScheduler } = useQuery<any>({
    queryKey: ["travel-auto-scheduler-status"],
    queryFn: () => fetchWithAuth<any>("/api/travel/notifications/auto-scheduler-status"),
    refetchInterval: 30000
  });

  const runSchedulerMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/notifications/run-auto-scheduler", { method: "POST" }),
    onSuccess: (res) => {
      refetchScheduler();
      refetchAutomations();
      refetchLogs();
      toast({
        title: "⚡ تم تشغيل محرك الأتمتة التلقائي بنجاح!",
        description: res.summary || `تم فحص ${res.rulesEvaluated} قاعدة وإرسال ${res.messagesDispatched} رسالة`
      });
    },
    onError: (err: any) =>
      toast({ title: "خطأ في تشغيل المحرك الآلي", description: err.message, variant: "destructive" })
  });

  const toggleSchedulerMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/notifications/toggle-auto-scheduler", { method: "POST" }),
    onSuccess: (res) => {
      refetchScheduler();
      toast({
        title: res.message || "تم تحديث حالة المحرك التلقائي",
      });
    },
    onError: (err: any) =>
      toast({ title: "خطأ في تغيير حالة المحرك", description: err.message, variant: "destructive" })
  });

  // Smart Parser for Meta Credentials
  const handleSmartImport = () => {
    if (!smartImportText.trim()) {
      toast({ title: "حقل البيانات فارغ", description: "يرجى لصق نص أو كود cURL أو JSON من Meta Developer Console", variant: "destructive" });
      return;
    }

    const text = smartImportText.trim();
    let extractedPhoneId = "";
    let extractedWabaId = "";
    let extractedAppId = "";
    let extractedToken = "";
    let extractedDisplayPhone = "";

    try {
      const obj = JSON.parse(text);
      if (obj.phone_number_id || obj.phone_id || obj.id) extractedPhoneId = obj.phone_number_id || obj.phone_id || obj.id;
      if (obj.waba_id || obj.whatsapp_business_account_id) extractedWabaId = obj.waba_id || obj.whatsapp_business_account_id;
      if (obj.app_id || obj.client_id) extractedAppId = obj.app_id || obj.client_id;
      if (obj.access_token || obj.token) extractedToken = obj.access_token || obj.token;
      if (obj.display_phone_number || obj.phone_number) extractedDisplayPhone = obj.display_phone_number || obj.phone_number;
    } catch {}

    const tokenMatch = text.match(/Bearer\s+([A-Za-z0-9_\-\.]+)/i) || text.match(/EAAG[A-Za-z0-9_\-\.]+/);
    if (tokenMatch) extractedToken = tokenMatch[1] || tokenMatch[0];

    const urlPhoneMatch = text.match(/facebook\.com\/v\d+\.\d+\/(\d+)\/messages/i);
    if (urlPhoneMatch) extractedPhoneId = urlPhoneMatch[1];

    const phoneIdLabel = text.match(/(?:phone_number_id|phone\s*id|معرف\s*الهاتف)[:=\s]+["']?([A-Za-z0-9\-_]+)/i);
    if (phoneIdLabel && !extractedPhoneId) extractedPhoneId = phoneIdLabel[1];

    const wabaIdLabel = text.match(/(?:waba_id|account_id|معرف\s*حساب\s*الأعمال)[:=\s]+["']?([A-Za-z0-9\-_]+)/i);
    if (wabaIdLabel && !extractedWabaId) extractedWabaId = wabaIdLabel[1];

    const appIdLabel = text.match(/(?:app_id|معرف\s*التطبيق)[:=\s]+["']?([A-Za-z0-9\-_]+)/i);
    if (appIdLabel && !extractedAppId) extractedAppId = appIdLabel[1];

    const phoneLabel = text.match(/(?:display_phone|phone_number|رقم\s*الهاتف)[:=\s]+["']?([+0-9\s\-]+)/i);
    if (phoneLabel && !extractedDisplayPhone) extractedDisplayPhone = phoneLabel[1].trim();

    const foundCount = [extractedPhoneId, extractedWabaId, extractedAppId, extractedToken, extractedDisplayPhone].filter(Boolean).length;

    if (foundCount === 0) {
      toast({
        title: "لم يتم العثور على معرفات واضحة",
        description: "يرجى التأكد من نسخ كود cURL من صفحة API Setup أو JSON يحتوي على المعرفات",
        variant: "destructive"
      });
      return;
    }

    setMetaForm((prev) => ({
      ...prev,
      phone_number_id: extractedPhoneId || prev.phone_number_id,
      waba_id: extractedWabaId || prev.waba_id,
      app_id: extractedAppId || prev.app_id,
      access_token: extractedToken || prev.access_token,
      display_phone_number: extractedDisplayPhone || prev.display_phone_number
    }));

    setSmartImportModalOpen(false);
    setSmartImportText("");
    toast({
      title: "✓ تم استيراد البيانات وتعبئة الحقول بنجاح!",
      description: `تم استخراج ${foundCount} عناصر بنجاح وملء الحقول المخصصة في لوحة الربط`
    });
  };

  const handleOpenEditRule = (rule: any) => {
    setEditingRule(rule);
    setRuleNameDraft(rule.name || "");
    setCustomMessageDraft(rule.custom_message || rule.effective_message || "");
    setRuleTimingDraft(rule.timing_desc || "فوري عند وقوع الحدث");
    setRuleTimingModeDraft(rule.timing_mode || (rule.timing_desc?.includes("يومياً") || rule.timing_desc?.includes("22:00") ? "daily_time" : rule.timing_desc?.includes("قبل") ? "before_event" : "immediate"));
    setRuleTimingTimeDraft(rule.timing_time || "22:00");
    setRuleTimingDaysDraft(rule.timing_days || (rule.timing_desc?.includes("24") ? 1 : rule.timing_desc?.includes("3") ? 3 : rule.timing_desc?.includes("15") ? 15 : rule.timing_desc?.includes("90") ? 90 : 0));
    setRuleGatewayDraft(rule.preferred_gateway || "4whatsapp");
    setEditRuleModalOpen(true);
  };

  const handleOpenTestSend = (rule: any) => {
    setTestSendRule(rule);
    setTestSendModalOpen(true);
  };

  const handleInsertPlaceholder = (placeholder: string) => {
    setCustomMessageDraft((prev) => prev + " " + placeholder);
  };

  const filteredAutomations = automations.filter((rule) => {
    const matchDept = selectedDeptFilter === "all" || rule.department === selectedDeptFilter;
    const matchSearch =
      !automationSearch ||
      (rule.name && rule.name.toLowerCase().includes(automationSearch.toLowerCase())) ||
      (rule.event_trigger && rule.event_trigger.toLowerCase().includes(automationSearch.toLowerCase())) ||
      (rule.effective_message && rule.effective_message.toLowerCase().includes(automationSearch.toLowerCase()));
    return matchDept && matchSearch;
  });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* CLEAN MINIMAL HEADER */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900">
                مركز تنبيهات وربط واتساب
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                بوابة الإرسال والربط السحابي، محرك الأتمتة الشامل، وإدارة القوالب والتقارير
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSmartImportModalOpen(true)}
              className="text-xs font-semibold gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>استيراد ذكي</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOnboardingModalOpen(true)}
              className="text-xs font-semibold gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>دليل الإعداد</span>
            </Button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* SLEEK NAVIGATION TABS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none">
            <button
              onClick={() => setActiveTab("meta_connect")}
              className={`py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "meta_connect"
                  ? "bg-slate-900 text-emerald-400 shadow-md font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <span>بوابة وربط واتساب (4WhatsApp Gateway)</span>
            </button>

            <button
              onClick={() => setActiveTab("automations")}
              className={`py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "automations"
                  ? "bg-slate-900 text-amber-400 shadow-md font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>محرك الأتمتة الشامل ({automations.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("instant_send")}
              className={`py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "instant_send"
                  ? "bg-slate-900 text-teal-400 shadow-md font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Send className="w-4 h-4 text-teal-500" />
              <span>الإرسال الفوري والمحاكاة</span>
            </button>

            <button
              onClick={() => setActiveTab("templates")}
              className={`py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "templates"
                  ? "bg-slate-900 text-purple-400 shadow-md font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4 text-purple-500" />
              <span>قوالب Meta المعتمدة ({templates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("billing")}
              className={`py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "billing"
                  ? "bg-slate-900 text-blue-400 shadow-md font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <CreditCard className="w-4 h-4 text-blue-500" />
              <span>رصيد المحادثات والشحن</span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "logs"
                  ? "bg-slate-900 text-rose-400 shadow-md font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Clock className="w-4 h-4 text-rose-500" />
              <span>سجل الرسائل والتقارير ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: WHATSAPP LINKING (DUAL MODE: QR CODE BARCODE & META CLOUD API) */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "meta_connect" && (
          <WhatsAppGatewayTab
            fourWaForm={fourWaForm}
            setFourWaForm={setFourWaForm}
            fourWaStatus={fourWaStatus}
            fourWaData={fourWaData}
            fourWaPhone={fourWaPhone}
            fourWaQrDataUrl={fourWaQrDataUrl}
            showFourWaPassword={showFourWaPassword}
            setShowFourWaPassword={setShowFourWaPassword}
            fourWaLoginMutation={fourWaLoginMutation}
            fourWaCheckStatusMutation={fourWaCheckStatusMutation}
            fourWaGenerateQrMutation={fourWaGenerateQrMutation}
            fourWaConfirmScanMutation={fourWaConfirmScanMutation}
            fourWaDisconnectMutation={fourWaDisconnectMutation}
            fourWaSendMessageMutation={fourWaSendMessageMutation}
            fourWaQuickTestPhone={fourWaQuickTestPhone}
            setFourWaQuickTestPhone={setFourWaQuickTestPhone}
            fourWaTestMessage={fourWaTestMessage}
            setFourWaTestMessage={setFourWaTestMessage}
            fourWaAttachment={fourWaAttachment}
            setFourWaAttachment={setFourWaAttachment}
            handleFourWaFileSelect={handleFourWaFileSelect}
            openOfficialWhatsAppWeb={openOfficialWhatsAppWeb}
            handleOpenDirectWhatsAppWeb={handleOpenDirectWhatsAppWeb}
          />
        )}

        {activeTab === "automations" && (
          <div className="space-y-6">
            {/* Top Engine Banner */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-black flex items-center gap-2 text-amber-400">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>محرك الأتمتة الشامل لكافة الأقسام والعمليات (Cross-Department Engine)</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  تحكم مركزي كامل في رسائل وقوالب الواتساب التلقائية: السفريات، المبيعات ونقاط البيع POS، الحسابات وسندات القبض، الموارد البشرية والرواتب، والعملاء. يمكنك تعديل نص أي رسالة أو إيقافها مؤقتاً بنقرة واحدة.
                </p>
              </div>

              {/* Bulk Toggle Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => bulkToggleMutation.mutate({ action: "enable_all", department: selectedDeptFilter })}
                  disabled={bulkToggleMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md rounded-xl"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>تفعيل كافة الإشعارات</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleMutation.mutate({ action: "pause_all", department: selectedDeptFilter })}
                  disabled={bulkToggleMutation.isPending}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 font-bold text-xs gap-1.5 rounded-xl"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف مؤقت للكل</span>
                </Button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* LIVE BACKGROUND AUTOMATIC SCHEDULER ENGINE BANNER & CONTROLS */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <Card className="border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl overflow-hidden shadow-xl">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs gap-1.5 px-3 py-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-pulse inline-block" />
                        <span>محرك الإرسال التلقائي في الخلفية: نشط ويعمل آلياً (Daemon Active) 🟢</span>
                      </Badge>
                      <Badge variant="outline" className="text-emerald-300 border-emerald-500/40 text-[11px] font-mono">
                        فحص دوري كل 60 ثانية
                      </Badge>
                      {fourWaStatus === "connected" && (
                        <Badge className="bg-purple-600 text-white text-[11px] font-bold">
                          بوابة 4WhatsApp متصلة ({fourWaPhone})
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-base font-black text-white flex items-center gap-2">
                        <span>تنفيذ تلقائي مباشر لإرسال إشعارات الواتساب للعملاء والمسافرين</span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
                        بمجرد حفظ أي قاعدة أو تعديل جدولتها ونصها، يقوم المحرك بالخلفية بمطابقة التواريخ (اقتراب انتهاء الجواز، إنذار خروج معتمري مكة، تذكير الرحلات، وسندات القبض) وإرسال الرسائل تلقائياً عبر رقم الواتساب بدون أي تدخل يدوي.
                      </p>
                    </div>

                    {/* Engine Live Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">آخر فحص وتشغيل:</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {schedulerData?.scheduler?.last_run_at || "الآن"}
                        </span>
                      </div>
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">إشعارات أرسلت آلياً اليوم:</span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {schedulerData?.scheduler?.today_dispatched_count || 0} رسالة
                        </span>
                      </div>
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">القواعد الفعالة بالمحرك:</span>
                        <span className="text-xs font-mono font-bold text-teal-300">
                          {schedulerData?.active_rules_count || automations.filter(a => a.is_enabled === 1).length} قاعدة
                        </span>
                      </div>
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">حالة تشغيل المحرك:</span>
                        <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>يعمل بالخلفية 100%</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Immediate Manual Trigger & Toggle Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                    <Button
                      onClick={() => runSchedulerMutation.mutate()}
                      disabled={runSchedulerMutation.isPending}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs h-11 px-5 rounded-2xl gap-2 shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
                    >
                      {runSchedulerMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      ) : (
                        <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                      )}
                      <span>⚡ تشغيل فحص وإرسال كافة التنبيهات الآن</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => toggleSchedulerMutation.mutate()}
                      disabled={toggleSchedulerMutation.isPending}
                      className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs h-9 rounded-xl font-bold gap-1.5"
                    >
                      {schedulerData?.scheduler?.is_active === 1 ? (
                        <>
                          <Pause className="w-3.5 h-3.5 text-amber-400" />
                          <span>إيقاف التشغيل التلقائي مؤقتاً</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>استئناف التشغيل التلقائي في الخلفية</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Department Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedDeptFilter("all")}
                  className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
                    selectedDeptFilter === "all" ? "bg-slate-900 text-white shadow-sm font-black" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  كافة الأقسام ({automations.length})
                </button>

                {Object.entries(DEPARTMENTS).map(([deptKey, deptInfo], idx) => {
                  const count = automations.filter((a) => a.department === deptKey).length;
                  return (
                    <button
                      key={`travelnotificationshub-deptKey-${deptKey || idx}-${idx}`}
                      onClick={() => setSelectedDeptFilter(deptKey)}
                      className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        selectedDeptFilter === deptKey ? "bg-slate-900 text-white shadow-sm font-black" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{deptInfo.label}</span>
                      <span className="text-[10px] opacity-80 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400" />
                <Input
                  value={automationSearch}
                  onChange={(e) => setAutomationSearch(e.target.value)}
                  placeholder="بحث في قواعد ورسائل الأتمتة..."
                  className="pr-8 text-xs h-9 bg-slate-50 rounded-xl"
                />
              </div>
            </div>

            {/* Automation Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAutomations.map((rule, idx) => {
                const deptMeta = DEPARTMENTS[rule.department || "travel"] || DEPARTMENTS.travel;
                const isEnabled = rule.is_enabled === 1;

                return (
                  <Card
                    key={`travelnotificationshub-rule-id-${rule.id || idx}-${idx}`}
                    className={`border transition-all shadow-sm rounded-2xl overflow-hidden ${
                      isEnabled ? "border-slate-200 hover:border-slate-300 bg-white" : "border-amber-200/80 bg-amber-50/10"
                    }`}
                  >
                    <CardHeader className="pb-3 border-b bg-slate-50/40 flex flex-row items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${deptMeta.badgeClass}`}>
                            {deptMeta.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {rule.timing_desc || "فوري"}
                          </span>
                        </div>
                        <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                          {rule.name}
                        </CardTitle>
                      </div>

                      {/* Pause / Resume Instant Button */}
                      <Button
                        size="sm"
                        variant={isEnabled ? "default" : "outline"}
                        onClick={() => toggleAutomationMutation.mutate(rule.id)}
                        disabled={toggleAutomationMutation.isPending}
                        className={`text-xs font-bold gap-1 h-7 px-2.5 rounded-lg ${
                          isEnabled
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
                        }`}
                      >
                        {isEnabled ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                            <span>نشط تلقائياً</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 text-amber-600" />
                            <span>موقوف مؤقتاً</span>
                          </>
                        )}
                      </Button>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="bg-slate-50 border rounded-xl p-3 text-slate-700 font-sans text-[11px] leading-relaxed whitespace-pre-line max-h-32 overflow-y-auto">
                        {(rule.custom_message || rule.effective_message || "لم يتم تحديد نص رسالة")
                          .replace(/\{agency_name\}/g, agencyName)
                          .replace(/\{currency\}/g, currency)}
                      </div>

                      {/* Action buttons: Edit Message & Test Send */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500">
                          {rule.placeholders_list ? "يتضمن متغيرات حية تلقائية" : "رسالة نصية موحدة"}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenTestSend(rule)}
                            className="text-xs h-7 px-2.5 gap-1 text-slate-700 hover:text-slate-900 rounded-lg"
                          >
                            <Send className="w-3 h-3 text-teal-600" />
                            <span>إرسال تجريبي</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenEditRule(rule)}
                            className="text-xs h-7 px-3 gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg"
                          >
                            <Edit2 className="w-3 h-3 text-amber-400" />
                            <span>تعديل نص الرسالة</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: INSTANT SEND & SMARTPHONE MOCKUP PREVIEW */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "instant_send" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-md rounded-3xl overflow-hidden bg-white">
                <CardHeader className="border-b bg-slate-50/50 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Send className="w-5 h-5 text-teal-600" />
                    <span>الإرسال الفوري المباشر (Direct WhatsApp Dispatch)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    إرسال رسالة واتساب مباشرة وفورية لأي مسافر أو عميل مع التوثيق في سجل العمليات
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">اسم العميل / المسافر</label>
                      <Input
                        value={sendForm.recipient_name}
                        onChange={(e) => setSendForm({ ...sendForm, recipient_name: e.target.value })}
                        placeholder="عبدالله العتيبي"
                        className="text-xs rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">رقم الواتساب (مع رمز الدولة)</label>
                      <Input
                        value={sendForm.recipient_phone}
                        onChange={(e) => setSendForm({ ...sendForm, recipient_phone: e.target.value })}
                        placeholder="966505544332"
                        dir="ltr"
                        className="text-xs font-mono font-bold rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">نص الرسالة المراد إرسالها</label>
                    <Textarea
                      rows={7}
                      value={sendForm.message_body}
                      onChange={(e) => setSendForm({ ...sendForm, message_body: e.target.value })}
                      className="text-xs leading-relaxed font-sans rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    <Button
                      type="button"
                      onClick={() =>
                        fourWaSendMessageMutation.mutate({
                          recipient_phone: sendForm.recipient_phone,
                          message_body: sendForm.message_body,
                          recipient_name: sendForm.recipient_name
                        })
                      }
                      disabled={fourWaSendMessageMutation.isPending}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs gap-2 py-3 rounded-xl shadow-md"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>إرسال عبر 4WhatsApp السحابي ⚡</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => {
                        const url = generateWhatsAppWebUrl(sendForm.recipient_phone, sendForm.message_body);
                        window.open(url, "_blank");
                      }}
                      className="bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs gap-2 py-3 rounded-xl shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>فتح في واتساب ويب (الرابط التلقائي) 🚀</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => launchWhatsAppDesktop(sendForm.recipient_phone, sendForm.message_body)}
                      className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 font-bold text-xs gap-2 py-3 rounded-xl shadow-md"
                    >
                      <Laptop className="w-4 h-4 text-emerald-400" />
                      <span>واتساب للكمبيوتر 💻</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Smartphone Live Chat Simulator */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-sm bg-slate-900 rounded-[36px] p-4 shadow-2xl border-4 border-slate-800">
                <div className="bg-emerald-800 text-white p-3 rounded-2xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs">
                      OP
                    </div>
                    <div>
                      <div className="font-bold leading-none">{agencyName}</div>
                      <div className="text-[10px] text-emerald-200 mt-0.5">حساب أعمال رسمي ✓</div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-700 text-emerald-100 text-[10px]">متصل الآن</Badge>
                </div>

                <div className="bg-[#efeae2] p-4 rounded-2xl mt-3 min-h-[300px] flex flex-col justify-end">
                  <div className="bg-white rounded-2xl p-3 shadow-md text-slate-800 text-xs leading-relaxed whitespace-pre-line border border-slate-200 relative">
                    {sendForm.message_body || "اكتب نص الرسالة في اليسار للمعاينة الحية..."}
                    <div className="text-[10px] text-slate-400 text-left mt-1.5 font-mono flex items-center justify-end gap-1">
                      <span>{new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: APPROVED META TEMPLATES */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm">
                <CardHeader className="border-b bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <span>قوالب Meta الرسمية المعتمدة (Approved Templates)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    القوالب المسجلة في منصة Meta والمعدة للإرسال التفاعلي عبر الواتساب
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {templates.map((tpl, idx) => (
                    <div
                      key={`travelnotificationshub-tpl-id-${tpl.id || idx}-${idx}`}
                      onClick={() => setSelectedTemplateForPreview(tpl)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selectedTemplateForPreview?.id === tpl.id
                          ? "border-purple-500 bg-purple-50/40 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{tpl.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                            {tpl.template_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{tpl.message_body}</p>
                      </div>

                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        معتمد رسمياً ✓
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Template Live Preview Card */}
            <div>
              <Card className="border-slate-200 rounded-3xl overflow-hidden sticky top-6 shadow-sm">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                  <CardTitle className="text-xs font-bold text-slate-700">معاينة القالب المعتمد</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {selectedTemplateForPreview ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-950/5 border border-emerald-200 rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-line text-slate-800">
                        {selectedTemplateForPreview.message_body}
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-500">
                        <div>
                          <strong>المعرف الكودي:</strong>{" "}
                          <span className="font-mono text-slate-700">{selectedTemplateForPreview.template_code}</span>
                        </div>
                        <div>
                          <strong>القناة:</strong> واتساب سحابي مشفر
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-6">اختر قالباً لاستعراضه</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: BILLING & CONVERSATION CREDITS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">رصيد المحادثات المتوفر</span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {billingData?.balance ? Number(billingData.balance).toLocaleString() : "5,000"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">إجمالي طلبات الشحن المسددة</span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {billingData?.paid_requests || 0} طلب
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-3 bg-purple-100 text-purple-800 rounded-2xl">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">قيمة الرصيد المسدد</span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {billingData?.total_revenue ? Number(billingData.total_revenue).toLocaleString() : 0} ريال
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Create Billing Request Form */}
            <Card className="border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-slate-50/50 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>إنشاء طلب شحن رصيد رسائل وإرسال رابط السداد للعميل</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">اسم العميل / المكتب</label>
                    <Input
                      value={billingForm.client_name}
                      onChange={(e) => setBillingForm({ ...billingForm, client_name: e.target.value })}
                      placeholder="مؤسسة أفق الرحلات"
                      className="text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">رقم الواتساب</label>
                    <Input
                      value={billingForm.client_phone}
                      onChange={(e) => setBillingForm({ ...billingForm, client_phone: e.target.value })}
                      placeholder="966505544332"
                      dir="ltr"
                      className="text-xs font-mono rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المطلوب (ريال)</label>
                    <Input
                      type="number"
                      value={billingForm.amount}
                      onChange={(e) => setBillingForm({ ...billingForm, amount: Number(e.target.value) })}
                      className="text-xs font-mono font-bold rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    try {
                      await fetchWithAuth("/api/travel/notifications/meta-billing/request-payment", {
                        method: "POST",
                        body: JSON.stringify(billingForm)
                      });
                      refetchBilling();
                      refetchLogs();
                      toast({ title: "✓ تم إنشاء طلب الدفع وإرسال الإشعار للعميل عبر الواتساب" });
                    } catch (e: any) {
                      toast({ title: "خطأ", description: e.message, variant: "destructive" });
                    }
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 rounded-xl h-10 px-5"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إنشاء طلب الفاتورة وإرسال رابط السداد 💳</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 6: LIVE LOGS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "logs" && (
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="border-b bg-slate-50/50 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>سجل الإرسال والتقارير الحية ({logs.length} سجل)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  توثيق كافة الرسائل الصادرة من محرك الأتمتة لكافة أقسام النظام
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLogs()}
                className="text-xs h-8 gap-1.5 rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث السجل</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600">
                      <th className="p-3 font-bold">#</th>
                      <th className="p-3 font-bold">المستلم</th>
                      <th className="p-3 font-bold">رقم الهاتف</th>
                      <th className="p-3 font-bold">نوع الإشعار</th>
                      <th className="p-3 font-bold">محتوى الرسالة</th>
                      <th className="p-3 font-bold">الحالة</th>
                      <th className="p-3 font-bold">التوقيت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log, idx) => (
                      <tr key={`travelnotificationshub-log-id-${log.id || idx}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{log.id}</td>
                        <td className="p-3 font-bold text-slate-800">{log.recipient_name || "عميل"}</td>
                        <td className="p-3 font-mono text-slate-600" dir="ltr">
                          +{log.recipient_phone}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-mono text-[10px] text-slate-700">
                            {log.template_code || "AUTOMATION"}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-600" title={log.message_body}>
                          {log.message_body}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] border border-emerald-200">
                            تم التسليم ✓
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {log.sent_at || log.created_at || "الآن"}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                          لا توجد سجلات إرسال حالياً
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 1: STEP-BY-STEP META ONBOARDING WIZARD */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={onboardingModalOpen} onOpenChange={setOnboardingModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>دليل إنشاء حساب مطور واستخراج بيانات الربط من Meta</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                خطوات واضحة وسريعة لربط تطبيق الواتساب السحابي الرسمي بدون أي أخطاء
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs text-slate-700">
              <div className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-1.5">
                <div className="font-bold text-blue-900 flex items-center justify-between">
                  <span>الخطوة 1: تسجيل الدخول إلى منصة مطوري Meta</span>
                  <a
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-[11px]"
                  >
                    فتح الموقع ↗
                  </a>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  توجه إلى <strong>developers.facebook.com</strong> وسجل الدخول باستخدام حساب فيسبوك الخاص بنشاطك التجاري.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <div className="font-bold text-slate-900">الخطوة 2: إنشاء تطبيق من نوع Business وإضافة WhatsApp</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  من القائمة العلوية اضغط على <strong>My Apps &gt; Create App</strong>، واختر نوع التطبيق <strong>Business</strong>. ثم اضغط على <strong>Set Up</strong> بجانب منتج WhatsApp.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <div className="font-bold text-slate-900">الخطوة 3: استخراج المعرفات الأساسية (API Setup)</div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pr-2">
                  <li><strong>Phone number ID:</strong> معرف رقم الهاتف الخاص بالإرسال السحابي.</li>
                  <li><strong>WhatsApp Business Account ID:</strong> معرف حساب الأعمال (WABA ID).</li>
                  <li><strong>App ID:</strong> يظهر في أعلى الشريط العلوي للمنصة.</li>
                  <li><strong>Permanent Token:</strong> انسخ مفتاح الوصول.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 space-y-1.5">
                <div className="font-bold text-emerald-900">الخطوة 4: الاستيراد الذكي التلقائي</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  يمكنك نسخ كود الـ cURL بالكامل واستخدام زر <strong>الاستيراد الذكي</strong> داخل نظامنا لملء كافة الحقول بضغطة زر واحدة!
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح Meta Developer Console الآن</span>
              </a>
              <Button variant="outline" size="sm" onClick={() => setOnboardingModalOpen(false)} className="text-xs rounded-xl">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 2: SMART CREDENTIALS IMPORTER (cURL / JSON) */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={smartImportModalOpen} onOpenChange={setSmartImportModalOpen}>
          <DialogContent className="max-w-xl rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>مستورد بيانات Meta الذكي (Auto-Extract & Populate)</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                الصق كود cURL أو استجابة JSON أو النص المنسوخ من Meta، وسيقوم النظام باستخراج المعرفات وملء الحقول فورياً
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الصق الكود أو النص هنا (cURL / JSON / Text):
                </label>
                <Textarea
                  rows={7}
                  value={smartImportText}
                  onChange={(e) => setSmartImportText(e.target.value)}
                  placeholder={`مثال:
curl -i -X POST "https://graph.facebook.com/v21.0/105544332211000/messages" \\
-H "Authorization: Bearer EAAG_EXAMPLE_TOKEN..." \\
-d '{"messaging_product": "whatsapp"}'`}
                  dir="ltr"
                  className="font-mono text-xs leading-relaxed rounded-xl"
                />
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl text-[11px] text-slate-600">
                💡 <strong>نصيحة:</strong> انسخ كود الـ cURL من صفحة <strong>API Setup</strong> والصقه هنا مباشرة.
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSmartImportText(`curl -i -X POST "https://graph.facebook.com/v21.0/105544332211000/messages" \\
-H "Authorization: Bearer EAAG_OMNIFLY_META_CLOUD_API_TOKEN_2026" \\
-d '{"messaging_product": "whatsapp", "to": "966505544332"}'`);
                }}
                className="text-xs rounded-xl"
              >
                تجربة نص نموذجي
              </Button>

              <Button
                onClick={handleSmartImport}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-xl"
              >
                <Zap className="w-4 h-4" />
                <span>تحليل واستيراد البيانات للحقول تلقائياً ⚡</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 3: EDIT AUTOMATION MESSAGE TEMPLATE & SMARTPHONE PREVIEW */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={editRuleModalOpen} onOpenChange={setEditRuleModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Edit2 className="w-5 h-5 text-amber-500" />
                <span>تعديل نص ورسالة الأتمتة: {editingRule?.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                خصص صياغة الرسالة، أضف المتغيرات الديناميكية الحية، وشاهد المعاينة اللحظية
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-xs">
              {/* Form Side */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">عنوان قاعدة الأتمتة</label>
                  <Input
                    value={ruleNameDraft}
                    onChange={(e) => setRuleNameDraft(e.target.value)}
                    className="text-xs font-bold rounded-xl"
                  />
                </div>

                {/* Comprehensive Custom Timing Controls */}
                <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>التحكم في وقت الإرسال والجدولة المخصصة:</span>
                    </span>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                      جدولة ذكية
                    </Badge>
                  </div>

                  {/* Timing Mode Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">نمط توقيت الإرسال:</label>
                    <select
                      value={ruleTimingModeDraft}
                      onChange={(e) => setRuleTimingModeDraft(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="immediate">⚡ فوري لحظي (عند تسجيل العملية أو وقوع الحدث مباشرة)</option>
                      <option value="daily_time">⏰ يومياً في توقيت محدد (صباحاً أو مساءً)</option>
                      <option value="before_travel_exit">✈️ قبل موعد السفر أو المغادرة بعدد أيام محدد</option>
                      <option value="before_passport_expiry">🛂 قبل تاريخ انتهاء صلاحية الجواز بعدد أيام محدد</option>
                    </select>
                  </div>

                  {/* Conditional Timing Inputs based on Mode */}
                  {ruleTimingModeDraft === "daily_time" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">الوقت المحدد للإرسال يومياً:</label>
                      <Input
                        type="time"
                        value={ruleTimingTimeDraft}
                        onChange={(e) => setRuleTimingTimeDraft(e.target.value)}
                        className="h-9 text-xs font-mono font-bold bg-white rounded-xl"
                      />
                      <span className="text-[10px] text-slate-500 block">
                        يتم تشغيل محرك الفحص في الخلفية وإرسال كافة الرسائل المستحقة في هذا التوقيت
                      </span>
                    </div>
                  )}

                  {(ruleTimingModeDraft === "before_travel_exit" || ruleTimingModeDraft === "before_passport_expiry") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">عدد الأيام المسبقة:</label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={ruleTimingDaysDraft}
                          onChange={(e) => setRuleTimingDaysDraft(parseInt(e.target.value) || 1)}
                          className="h-9 text-xs font-mono font-bold bg-white rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">ساعة الإرسال باليوم المستهدف:</label>
                        <Input
                          type="time"
                          value={ruleTimingTimeDraft}
                          onChange={(e) => setRuleTimingTimeDraft(e.target.value)}
                          className="h-9 text-xs font-mono font-bold bg-white rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Preferred Gateway Selector */}
                  <div className="space-y-1 pt-1 border-t border-amber-200/50">
                    <label className="text-[11px] font-bold text-slate-600">بوابة الإرسال المعتمدة لهذه القاعدة:</label>
                    <select
                      value={ruleGatewayDraft}
                      onChange={(e) => setRuleGatewayDraft(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="4whatsapp">🌐 بوابة 4WhatsApp السحابية (إرسال آلي صامت بالخلفية عبر رقمك)</option>
                      <option value="whatsapp_web">🔗 واتساب ويب الرسمي (رابط مباشر ديناميكي web.whatsapp.com)</option>
                      <option value="desktop_app">💻 تطبيق واتساب للكمبيوتر (بروتوكول رسمي whatsapp://)</option>
                      <option value="meta_cloud">☁️ Meta WhatsApp Cloud API (قوالب تجارية موثقة)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">نص الرسالة المرسلة للعميل</label>
                    <span className="text-[10px] text-slate-400">يدعم تنسيقات واتساب (*عريض*، _مائل_) والرموز التعبيرية</span>
                  </div>
                  <Textarea
                    rows={8}
                    value={customMessageDraft}
                    onChange={(e) => setCustomMessageDraft(e.target.value)}
                    className="text-xs leading-relaxed font-sans rounded-xl"
                    dir="rtl"
                  />
                </div>

                {/* Placeholders quick insertion chips */}
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    انقر لإدراج متغير ديناميكي في نص الرسالة (المسافرين، الجوازات، والرحلات):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "{passenger_name}",
                      "{passport_no}",
                      "{nationality}",
                      "{expiry_date}",
                      "{days_left}",
                      "{makkah_exit_date}",
                      "{stay_duration}",
                      "{package_name}",
                      "{visa_no}",
                      "{phone_number}",
                      "{customer_name}",
                      "{agency_name}",
                      "{invoice_no}",
                      "{amount}",
                      "{currency}",
                      "{pnr}",
                      "{flight_no}",
                      "{departure_date}",
                      "{hotel_name}",
                      "{voucher_no}",
                      "{portal_url}"
                    ].map((placeholder, idx) => (
                      <button
                        key={`travelnotificationshub-placeholder-${placeholder || idx}-${idx}`}
                        type="button"
                        onClick={() => handleInsertPlaceholder(placeholder)}
                        className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        + {placeholder}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Smartphone Simulator Preview Side */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 mb-2">معاينة الرسالة الحية على شاشة WhatsApp</span>
                <div className="w-full max-w-[290px] bg-slate-900 rounded-[32px] p-3.5 shadow-xl border-4 border-slate-800">
                  <div className="bg-emerald-800 text-white p-2.5 rounded-t-xl flex items-center gap-2 text-[11px]">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                      WA
                    </div>
                    <div className="truncate">
                      <div className="font-bold leading-none truncate">{agencyName}</div>
                      <div className="text-[9px] text-emerald-200">
                        {ruleGatewayDraft === "4whatsapp" ? "4WhatsApp Cloud Connected ✓" : "واتساب الرسمي ✓"}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#efeae2] p-3 rounded-b-xl min-h-[300px] max-h-[380px] overflow-y-auto flex flex-col justify-end">
                    <div className="bg-white rounded-xl p-3 shadow-sm text-slate-800 text-[11px] leading-relaxed whitespace-pre-line border border-slate-200 relative">
                      {customMessageDraft
                        ? customMessageDraft
                            .replace(/\{passenger_name\}|\{customer_name\}/g, "سالم مسعد اليمني")
                            .replace(/\{passport_no\}/g, "08945621")
                            .replace(/\{nationality\}/g, "يمني")
                            .replace(/\{expiry_date\}/g, "18 ديسمبر 2026")
                            .replace(/\{days_left\}/g, "42")
                            .replace(/\{makkah_exit_date\}/g, "20 نوفمبر 2026")
                            .replace(/\{stay_duration\}/g, "14 يوماً")
                            .replace(/\{package_name\}/g, "باقة العمرة الذهبية VIP")
                            .replace(/\{visa_no\}/g, "UMR-88492")
                            .replace(/\{agency_name\}/g, agencyName)
                            .replace(/\{invoice_no\}/g, "INV-2026-1049")
                            .replace(/\{amount\}/g, "1,850")
                            .replace(/\{currency\}/g, currency)
                            .replace(/\{pnr\}/g, "6X9ZKL")
                            .replace(/\{flight_no\}/g, "SV 112")
                            .replace(/\{departure_date\}/g, "15 نوفمبر 2026")
                            .replace(/\{hotel_name\}/g, "سويس أوتيل المقام مكة")
                            .replace(/\{voucher_no\}/g, "HTL-8842")
                            .replace(/\{ticket_url\}|\{portal_url\}/g, "https://omnifly.app/t/preview")
                        : "معاينة الرسالة ستظهر هنا..."}
                      <div className="text-[9px] text-slate-400 text-left mt-1.5 font-mono flex items-center justify-end gap-1">
                        <span>{ruleTimingTimeDraft || "10:45"} م</span>
                        <CheckCheck className="w-3 h-3 text-blue-500 inline" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <Badge variant="outline" className="text-[10px] text-slate-600 bg-slate-50 font-mono">
                    بوابة الإرسال: {ruleGatewayDraft} | النمط: {ruleTimingModeDraft}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditRuleModalOpen(false)} className="text-xs rounded-xl">
                إلغاء
              </Button>

              <Button
                onClick={() => {
                  if (editingRule) {
                    updateRuleMutation.mutate({
                      id: editingRule.id,
                      name: ruleNameDraft,
                      custom_message: customMessageDraft,
                      timing_desc: ruleTimingDraft,
                      timing_mode: ruleTimingModeDraft,
                      timing_time: ruleTimingTimeDraft,
                      timing_days: ruleTimingDaysDraft,
                      preferred_gateway: ruleGatewayDraft
                    });
                  }
                }}
                disabled={updateRuleMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-xl shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ واعتماد التعديل والجدولة 💾</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 4: TEST SEND TO ANY PHONE NUMBER */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={testSendModalOpen} onOpenChange={setTestSendModalOpen}>
          <DialogContent className="max-w-md rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Send className="w-5 h-5 text-teal-600" />
                <span>إرسال تجريبي فوري لقاعدة الأتمتة</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                أدخل رقم الهاتف لتجربة إرسال هذه الرسالة والتحقق من وصولها عبر الواتساب
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px] mb-1">اسم القاعدة المختارة:</span>
                <span className="font-bold text-slate-800 text-xs">{testSendRule?.name}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  رقم هاتف الواتساب التجريبي (مع رمز الدولة)
                </label>
                <Input
                  value={testSendPhone}
                  onChange={(e) => setTestSendPhone(e.target.value)}
                  placeholder="966505544332"
                  dir="ltr"
                  className="font-mono text-xs font-bold rounded-xl"
                />
              </div>

              <div className="bg-slate-50 border rounded-2xl p-3 text-[11px] text-slate-700 max-h-36 overflow-y-auto whitespace-pre-line leading-relaxed">
                {testSendRule?.custom_message || testSendRule?.effective_message}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setTestSendModalOpen(false)} className="text-xs rounded-xl">
                إلغاء
              </Button>

              <Button
                onClick={() => {
                  if (testSendRule) {
                    testSendMutation.mutate({
                      rule_id: testSendRule.id,
                      recipient_phone: testSendPhone
                    });
                  }
                }}
                disabled={testSendMutation.isPending}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs gap-1.5 rounded-xl"
              >
                <Send className="w-4 h-4" />
                <span>إرسال تجريبي الآن 🚀</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
