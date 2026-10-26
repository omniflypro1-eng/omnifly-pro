import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
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
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyConfig } from "@/hooks/use-agency-config";
import { Plane } from "lucide-react";

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
    icon: PlaneIcon,
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
    icon: LandmarkIcon,
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

function PlaneIcon(props: any) {
  return <Ticket {...props} />;
}
function LandmarkIcon(props: any) {
  return <Wallet {...props} />;
}

export default function TravelNotificationsHubPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();  const { agencyName } = useAgencyConfig();
  const [activeTab, setActiveTab] = useState<"meta_connect" | "automations" | "billing" | "templates" | "instant_send" | "logs">("meta_connect");

  // Connection Mode State
  const [connectionMode, setConnectionMode] = useState<"embedded" | "qr_code">("embedded");
  const [qrStatus, setQrStatus] = useState<"connected" | "waiting_scan" | "generating">("connected");
  const [qrPhone, setQrPhone] = useState("+966 50 554 4332");

  // Show/Hide Secrets
  const [showToken, setShowToken] = useState(false);
  const [showPin, setShowPin] = useState(false);

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

  // Billing Request Form State (طلب الدفع للعميل داخل النظام)
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

  // Direct Top-up Modal State
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpForm, setTopUpForm] = useState({
    request_id: null as number | null,
    additional_credits: 5000,
    amount: 650,
    payment_method: "bank_transfer",
    notes: "سداد فوري عبر التحويل البنكي المباشر"
  });

  // Filters & State for logs
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  // Template preview selection
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<any>(null);

  // Queries
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

  // Toggle Single Automation Rule Mutation (Pause / Resume)
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
    mutationFn: (vars: { id: number; name?: string; custom_message?: string; timing_desc?: string }) =>
      fetchWithAuth<any>(`/api/travel/notifications/automations/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify(vars)
      }),
    onSuccess: (res) => {
      refetchAutomations();
      setEditRuleModalOpen(false);
      toast({
        title: "✓ تم حفظ تعديل نص الرسالة بنجاح",
        description: "سيتم تطبيق التعديل فورياً في محرك الأتمتة السحابي لكافة الإشعارات القادمة"
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

  // Smart Parser for Meta Credentials from cURL / JSON / Text
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

    // 1. Try parsing as JSON
    try {
      const obj = JSON.parse(text);
      if (obj.phone_number_id || obj.phone_id || obj.id) extractedPhoneId = obj.phone_number_id || obj.phone_id || obj.id;
      if (obj.waba_id || obj.whatsapp_business_account_id) extractedWabaId = obj.waba_id || obj.whatsapp_business_account_id;
      if (obj.app_id || obj.client_id) extractedAppId = obj.app_id || obj.client_id;
      if (obj.access_token || obj.token) extractedToken = obj.access_token || obj.token;
      if (obj.display_phone_number || obj.phone_number) extractedDisplayPhone = obj.display_phone_number || obj.phone_number;
    } catch (e) {
      // Not JSON, continue with regex extraction
    }

    // 2. Extract Bearer Token (e.g. from cURL header)
    const tokenMatch = text.match(/Bearer\s+([A-Za-z0-9_\-\.]+)/i) || text.match(/EAAG[A-Za-z0-9_\-\.]+/);
    if (tokenMatch) {
      extractedToken = tokenMatch[1] || tokenMatch[0];
    }

    // 3. Extract Phone Number ID from URL (e.g. graph.facebook.com/v21.0/105544332211000/messages)
    const urlPhoneMatch = text.match(/facebook\.com\/v\d+\.\d+\/(\d+)\/messages/i);
    if (urlPhoneMatch) {
      extractedPhoneId = urlPhoneMatch[1];
    }

    // 4. Regex for explicit labels
    const phoneIdLabel = text.match(/(?:phone_number_id|phone\s*id|معرف\s*الهاتف)[:=\s]+["']?([A-Za-z0-9\-_]+)/i);
    if (phoneIdLabel && !extractedPhoneId) extractedPhoneId = phoneIdLabel[1];

    const wabaIdLabel = text.match(/(?:waba_id|account_id|معرف\s*حساب\s*الأعمال)[:=\s]+["']?([A-Za-z0-9\-_]+)/i);
    if (wabaIdLabel && !extractedWabaId) extractedWabaId = wabaIdLabel[1];

    const appIdLabel = text.match(/(?:app_id|معرف\s*التطبيق)[:=\s]+["']?([A-Za-z0-9\-_]+)/i);
    if (appIdLabel && !extractedAppId) extractedAppId = appIdLabel[1];

    const phoneLabel = text.match(/(?:display_phone|phone_number|رقم\s*الهاتف)[:=\s]+["']?([+0-9\s\-]+)/i);
    if (phoneLabel && !extractedDisplayPhone) extractedDisplayPhone = phoneLabel[1].trim();

    // Count found items
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

  // Open Edit Modal for an automation
  const handleOpenEditRule = (rule: any) => {
    setEditingRule(rule);
    setRuleNameDraft(rule.name || "");
    setCustomMessageDraft(rule.custom_message || rule.effective_message || "");
    setRuleTimingDraft(rule.timing_desc || "فوري عند وقوع الحدث");
    setEditRuleModalOpen(true);
  };

  // Open Test Send Modal
  const handleOpenTestSend = (rule: any) => {
    setTestSendRule(rule);
    setTestSendModalOpen(true);
  };

  // Insert placeholder into custom message draft at cursor position
  const handleInsertPlaceholder = (placeholder: string) => {
    setCustomMessageDraft((prev) => prev + " " + placeholder);
  };

  // Filter automations
  const filteredAutomations = automations.filter((rule) => {
    const matchDept = selectedDeptFilter === "all" || rule.department === selectedDeptFilter;
    const matchSearch =
      !automationSearch ||
      (rule.name && rule.name.toLowerCase().includes(automationSearch.toLowerCase())) ||
      (rule.event_trigger && rule.event_trigger.toLowerCase().includes(automationSearch.toLowerCase())) ||
      (rule.effective_message && rule.effective_message.toLowerCase().includes(automationSearch.toLowerCase()));
    return matchDept && matchSearch;
  });

  const activeAutomationsCount = automations.filter((a) => a.is_enabled === 1).length;
  const pausedAutomationsCount = automations.filter((a) => a.is_enabled === 0).length;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* HERO / HEADER SECTION */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2">
                    <span>مركز تنبيهات وربط واتساب السحابي المتقدم</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      Meta Cloud API v21.0
                    </span>
                  </h1>
                  <p className="text-xs lg:text-sm text-slate-300">
                    الربط المباشر مع Meta Developer Console، استيراد المعرفات، ومحرك الأتمتة الشامل لكافة أقسام النظام
                  </p>
                </div>
              </div>
            </div>

            {/* Top Action CTAs including Meta Developer Console Registration Button */}
            <div className="flex flex-wrap items-center gap-3">
              {/* PRIMARY BUTTON: Register / Open Meta Developer Console */}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] border border-blue-400/30 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 text-blue-200" />
                <span>تسجيل / فتح حساب Meta Developer Console</span>
              </a>

              {/* Step-by-Step Walkthrough Guide */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOnboardingModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold text-xs gap-1.5 whitespace-nowrap"
              >
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>دليل الإعداد واستخراج المعرفات</span>
              </Button>

              {/* Smart Importer Button */}
              <Button
                size="sm"
                onClick={() => setSmartImportModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-emerald-600/20 whitespace-nowrap"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>استيراد ذكي للبيانات (cURL / JSON)</span>
              </Button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div>
                <span className="text-slate-400 block text-[11px]">حالة البوابة السحابية:</span>
                <span className="font-bold text-emerald-400">نشطة ومعتمدة 100%</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">قواعد الأتمتة الشاملة:</span>
              <span className="font-bold text-white font-mono">{automations.length} قاعدة (نشط: {activeAutomationsCount} / موقوف: {pausedAutomationsCount})</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">رصيد المحادثات المتوفر:</span>
              <span className="font-bold text-amber-400 font-mono">
                {billingData?.balance ? Number(billingData.balance).toLocaleString() : "5,000"} محادثة
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">حد الإرسال اليومي (Tier):</span>
              <span className="font-bold text-purple-300 font-mono">10,000 Messages/Day</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* NAVIGATION TABS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold pb-px">
            <button
              onClick={() => setActiveTab("meta_connect")}
              className={`py-2.5 px-4 rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "meta_connect"
                  ? "bg-slate-900 text-emerald-400 border-t-2 border-emerald-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <KeyRound className="w-4 h-4 text-emerald-500" />
              <span>ربط Meta Developer Console والمعرفات</span>
            </button>

            <button
              onClick={() => setActiveTab("automations")}
              className={`py-2.5 px-4 rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "automations"
                  ? "bg-slate-900 text-amber-400 border-t-2 border-amber-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>محرك الأتمتة الشامل لكافة الأقسام ({automations.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("templates")}
              className={`py-2.5 px-4 rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "templates"
                  ? "bg-slate-900 text-purple-400 border-t-2 border-purple-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4 text-purple-500" />
              <span>قوالب Meta المعتمدة</span>
            </button>

            <button
              onClick={() => setActiveTab("instant_send")}
              className={`py-2.5 px-4 rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "instant_send"
                  ? "bg-slate-900 text-teal-400 border-t-2 border-teal-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Send className="w-4 h-4 text-teal-500" />
              <span>الإرسال الفوري المباشر</span>
            </button>

            <button
              onClick={() => setActiveTab("billing")}
              className={`py-2.5 px-4 rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "billing"
                  ? "bg-slate-900 text-blue-400 border-t-2 border-blue-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <CreditCard className="w-4 h-4 text-blue-500" />
              <span>رصيد المحادثات وفواتير الشحن</span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`py-2.5 px-4 rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "logs"
                  ? "bg-slate-900 text-rose-400 border-t-2 border-rose-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Clock className="w-4 h-4 text-rose-500" />
              <span>سجل الرسائل والتقارير الحية</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: META DEVELOPER CONSOLE CREDENTIALS & ONBOARDING */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "meta_connect" && (
          <div className="space-y-6">
            {/* Connection Method Switcher */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">طريقة ربط واتساب بالنظام (أدوات عالمية متقدمة)</h4>
                  <p className="text-xs text-slate-500">اختر بين الربط الرسمي المباشر عبر Meta Embedded Signup أو ربط الهاتف الفوري عبر مسح الباركود (QR Code Multi-Device)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={connectionMode === "embedded" ? "default" : "outline"}
                  onClick={() => setConnectionMode("embedded")}
                  className={`text-xs font-bold gap-1.5 ${connectionMode === "embedded" ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md" : ""}`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>الربط الرسمي Cloud API & Embedded Signup</span>
                </Button>

                <Button
                  variant={connectionMode === "qr_code" ? "default" : "outline"}
                  onClick={() => setConnectionMode("qr_code")}
                  className={`text-xs font-bold gap-1.5 ${connectionMode === "qr_code" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md" : ""}`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>ربط عبر مسح الباركود (QR Code Link)</span>
                </Button>
              </div>
            </div>

            {connectionMode === "qr_code" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                  <CardHeader className="border-b bg-slate-50/50 pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                      <Radio className="w-5 h-5 text-emerald-600" />
                      <span>ربط واتساب بالمسح الضوئي لرمز الاستجابة السريعة (QR Code / WhatsApp Web Multi-Device)</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      قم بفتح تطبيق واتساب على هاتفك المحمول، انتقل إلى الإعدادات &gt; الأجهزة المرتبطة &gt; ربط جهاز، ثم امسح الرمز أدناه للربط الفوري.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col md:flex-row items-center justify-center gap-8">
                    <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500/30 shadow-lg flex flex-col items-center justify-center space-y-3">
                      <div className="w-56 h-56 bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center text-white relative shadow-inner">
                        {qrStatus === "generating" ? (
                          <div className="flex flex-col items-center space-y-2">
                            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                            <span className="text-xs text-slate-300">جاري توليد QR Code جديد...</span>
                          </div>
                        ) : qrStatus === "waiting_scan" ? (
                          <div className="flex flex-col items-center space-y-2 text-center">
                            <div className="w-40 h-40 bg-white rounded-lg p-2 flex items-center justify-center">
                              <div className="w-36 h-36 bg-slate-900 grid grid-cols-6 gap-1 p-2 rounded">
                                {Array.from({ length: 36 }).map((_, i) => (
                                  <div key={`travelnotificationshub-qrbox-${i}`} className={`rounded-xs ${i % 2 === 0 || i % 5 === 0 ? 'bg-white' : 'bg-slate-900'}`} />
                                ))}
                              </div>
                            </div>
                            <span className="text-[11px] text-amber-300 font-bold">في انتظار مسح الكود بالكاميرا...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center space-y-3 text-center">
                            <div className="w-40 h-40 bg-white rounded-lg p-2 flex items-center justify-center shadow">
                              <CheckCircle2 className="w-20 h-20 text-emerald-600" />
                            </div>
                            <span className="text-xs text-emerald-300 font-bold">تم ربط الهاتف بنجاح 🟢</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setQrStatus("generating");
                            setTimeout(() => setQrStatus("waiting_scan"), 1200);
                            toast({ title: "تم توليد رمز QR جديد، يرجى مسحه بالهاتف" });
                          }}
                          className="text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>تحديث رمز QR</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setQrStatus("connected");
                            toast({ title: "تم ربط جهاز واتساب بنجاح!" });
                          }}
                          className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        >
                          محاكاة الربط الناجح
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 max-w-sm">
                      <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                        <h5 className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>تعليمات الربط الآمن والمستقر</span>
                        </h5>
                        <ul className="text-[11px] text-emerald-800 space-y-1.5 list-disc list-inside">
                          <li>يدعم النظام بروتوكول تعدد الأجهزة (Multi-Device) الرسمي.</li>
                          <li>يبقى الجلسة نشطة ومستقرة لإرسال التذاكر والتنبيهات فورياً.</li>
                          <li>لا يتطلب اشتراك مطور في Meta للطريقة السريعة.</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 block">رقم الهاتف المرتبط حالياً:</label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={qrPhone}
                            onChange={(e) => setQrPhone(e.target.value)}
                            dir="ltr"
                            className="text-xs font-mono font-bold"
                          />
                          <Badge variant="outline" className={qrStatus === "connected" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300"}>
                            {qrStatus === "connected" ? "متصل" : "غير متصل"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="bg-slate-50/50 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span>حالة الاتصال والخدمات النشطة</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1 border-b">
                      <span className="text-slate-600">نوع الربط:</span>
                      <span className="font-bold text-emerald-700">مسح باركود (QR Code)</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b">
                      <span className="text-slate-600">حالة الجلسة:</span>
                      <span className="font-bold text-emerald-700">متصل وجاهز للإرسال</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-600">إجمالي الرسائل المرسلة:</span>
                      <span className="font-mono font-bold text-slate-800">1,420 رسالة</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Meta Registration Banner for clients who do not have an account */}
                <div className="bg-gradient-to-r from-blue-900/90 via-slate-900 to-indigo-950 border border-blue-800/60 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30">
                        <Globe className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-blue-100">
                        ليس لديك حساب على Meta for Developers بعد؟
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      يمكنك إنشاء حساب مطور رسمي مجاناً في دقائق عبر منصة مطوري Meta، وإنشاء تطبيق WhatsApp Business واستخراج المعرفات الأساسية لربطها هنا فورياً.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح منصة Meta for Developers ↗</span>
                    </a>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOnboardingModalOpen(true)}
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 whitespace-nowrap"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-300" />
                      <span>خطوات استخراج المعرفات</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Credentials Form */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                              <KeyRound className="w-5 h-5 text-emerald-600" />
                              <span>معرفات ومفاتيح الربط الرسمي (Meta Developer Console & Embedded Signup)</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                              قم بإدخال بيانات تطبيق الواتساب المعتمد من منصة Meta لتنشيط الإرسال السحابي المشفر لكافة أقسام النظام
                            </CardDescription>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSmartImportModalOpen(true)}
                              className="text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-500" />
                              <span>استيراد ذكي</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testGatewayMutation.mutate(metaForm.access_token)}
                              disabled={testGatewayMutation.isPending}
                              className="text-xs gap-1.5 font-bold border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${testGatewayMutation.isPending ? "animate-spin" : ""}`} />
                              <span>فحص الاتصال الحي</span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              اسم النشاط التجاري المعتمد (Business Name)
                            </label>
                            <Input
                              value={metaForm.business_name}
                              onChange={(e) => setMetaForm({ ...metaForm, business_name: e.target.value })}
                              placeholder={agencyName}
                              className="text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              رقم الهاتف الرسمي المعروض (Display Phone Number)
                            </label>
                            <Input
                              value={metaForm.display_phone_number}
                              onChange={(e) => setMetaForm({ ...metaForm, display_phone_number: e.target.value })}
                              placeholder="+966 50 554 4332"
                              dir="ltr"
                              className="text-xs font-mono font-bold"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-bold text-slate-700">معرف رقم الهاتف (Phone Number ID)</label>
                              <span className="text-[10px] text-slate-400">من صفحة API Setup</span>
                            </div>
                            <Input
                              value={metaForm.phone_number_id}
                              onChange={(e) => setMetaForm({ ...metaForm, phone_number_id: e.target.value })}
                              placeholder="PHONE-105544332211000"
                              dir="ltr"
                              className="text-xs font-mono"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-bold text-slate-700">معرف حساب الأعمال (WABA ID)</label>
                              <span className="text-[10px] text-slate-400">WhatsApp Business Account ID</span>
                            </div>
                            <Input
                              value={metaForm.waba_id}
                              onChange={(e) => setMetaForm({ ...metaForm, waba_id: e.target.value })}
                              placeholder="WABA-109283746501928"
                              dir="ltr"
                              className="text-xs font-mono"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-bold text-slate-700">معرف التطبيق في Meta (App ID)</label>
                              <span className="text-[10px] text-slate-400">App Dashboard</span>
                            </div>
                            <Input
                              value={metaForm.app_id}
                              onChange={(e) => setMetaForm({ ...metaForm, app_id: e.target.value })}
                              placeholder="META-APP-884920193847"
                              dir="ltr"
                              className="text-xs font-mono"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-bold text-slate-700">رمز التحقق للويبهوك (Webhook Verify Token)</label>
                              <span className="text-[10px] text-slate-400">Webhook Verification</span>
                            </div>
                            <Input
                              value={metaForm.webhook_verify_token}
                              onChange={(e) => setMetaForm({ ...metaForm, webhook_verify_token: e.target.value })}
                              placeholder="omnifly_meta_webhook_2026"
                              dir="ltr"
                              className="text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-slate-700">
                              رمز الوصول الدائم (Permanent System User Access Token)
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowToken(!showToken)}
                              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              {showToken ? "إخفاء الرمز" : "إظهار الرمز"}
                            </button>
                          </div>
                          <Input
                            type={showToken ? "text" : "password"}
                            value={metaForm.access_token}
                            onChange={(e) => setMetaForm({ ...metaForm, access_token: e.target.value })}
                            placeholder="EAAG..."
                            dir="ltr"
                            className="text-xs font-mono"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            يمكن الحصول عليه من Meta Business Settings &gt; System Users أو رمز مؤقت 24 ساعة من صفحة API Setup للاختبار السريع.
                          </p>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMetaForm({
                                business_name: agencyName,
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
                              toast({ title: "تمت التعبئة بالبيانات القياسية المعتمدة" });
                            }}
                            className="text-xs"
                          >
                            إعادة تعيين البيانات القياسية
                          </Button>

                          <Button
                            onClick={() => saveMetaMutation.mutate(metaForm)}
                            disabled={saveMetaMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md px-6"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {saveMetaMutation.isPending ? "جاري حفظ الإعدادات..." : "حفظ واعتماد بيانات الربط السحابي 💾"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Connection Status & 2FA PIN */}
                  <div className="space-y-6">
                    {/* Status Card */}
                    <Card className="border-slate-200">
                      <CardHeader className="border-b bg-emerald-50/40 pb-3">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-emerald-800">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            حالة التوثيق في خوادم Meta
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700">موثق ومعتمد</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-emerald-100/60">
                          <span className="text-slate-600">تقييم الجودة (Quality):</span>
                          <span className="font-bold text-emerald-700">GREEN (ممتازة)</span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-emerald-100/60">
                          <span className="text-slate-600">حد الرسائل اليومي:</span>
                          <span className="font-mono font-bold text-slate-800">10,000 Messages/Day</span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-emerald-100/60">
                          <span className="text-slate-600">رصيد المحادثات المتوفر:</span>
                          <span className="font-mono font-bold text-amber-600">
                            {billingData?.balance ? Number(billingData.balance).toLocaleString() : "5,000"} محادثة
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-600">إصدار واجهة Meta:</span>
                          <span className="font-mono font-bold text-slate-800">Graph API v21.0</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 2FA PIN Registration Card */}
                    <Card className="border-slate-200">
                      <CardHeader className="pb-3 bg-slate-50/50">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                          <Smartphone className="w-4 h-4 text-emerald-600" />
                          تأكيد رقم الهاتف ورمز الـ PIN المكون من 6 أرقام
                        </CardTitle>
                        <CardDescription className="text-xs">
                          التحقق النهائي برمز الحماية الثنائي 2FA لتمكين إرسال الرسائل من الرقم الرسمي
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">رمز التحقق الثنائي (6-Digit PIN)</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type={showPin ? "text" : "password"}
                              maxLength={6}
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value)}
                              placeholder="123456"
                              dir="ltr"
                              className="font-mono text-center tracking-widest text-base font-black w-36"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPin(!showPin)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              {showPin ? "إخفاء" : "إظهار"}
                            </button>
                          </div>
                        </div>

                        <Button
                          onClick={() => verifyPinMutation.mutate(pinInput)}
                          disabled={verifyPinMutation.isPending}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          {verifyPinMutation.isPending ? "جاري التحقق من خوادم Meta..." : "تأكيد تسجيل الرقم في Meta الآن 🚀"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: COMPREHENSIVE AUTOMATIONS ENGINE FOR ALL ERP DEPARTMENTS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "automations" && (
          <div className="space-y-6">
            {/* Top Engine Banner */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>تفعيل كافة الإشعارات</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleMutation.mutate({ action: "pause_all", department: selectedDeptFilter })}
                  disabled={bulkToggleMutation.isPending}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 font-bold text-xs gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف مؤقت للكل</span>
                </Button>
              </div>
            </div>

            {/* Department Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedDeptFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    selectedDeptFilter === "all" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
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
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        selectedDeptFilter === deptKey ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{deptInfo.label}</span>
                      <span className="text-[10px] opacity-80 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                <Input
                  value={automationSearch}
                  onChange={(e) => setAutomationSearch(e.target.value)}
                  placeholder="بحث في قواعد ورسائل الأتمتة..."
                  className="pr-8 text-xs h-8 bg-slate-50"
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
                    className={`border transition-all shadow-sm ${
                      isEnabled ? "border-slate-200 hover:border-slate-300" : "border-amber-200/80 bg-amber-50/10"
                    }`}
                  >
                    <CardHeader className="pb-3 border-b bg-slate-50/40 flex flex-row items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${deptMeta.badgeClass}`}>
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
                        className={`text-xs font-bold gap-1 h-7 px-2.5 ${
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
                      {/* Message Preview Box */}
                      <div className="bg-slate-50 border rounded-lg p-3 text-slate-700 font-sans text-[11px] leading-relaxed whitespace-pre-line max-h-32 overflow-y-auto">
                        {rule.custom_message || rule.effective_message || "لم يتم تحديد نص رسالة"}
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
                            className="text-xs h-7 px-2.5 gap-1 text-slate-700 hover:text-slate-900"
                          >
                            <Send className="w-3 h-3 text-teal-600" />
                            <span>إرسال تجريبي</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenEditRule(rule)}
                            className="text-xs h-7 px-3 gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold"
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
        {/* TAB 3: APPROVED META TEMPLATES */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-slate-200">
                <CardHeader className="border-b bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <span>قوالب Meta الرسمية المعتمدة (Approved Templates)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    القوالب المسجلة في منصة Meta Graph API والمعدة للإرسال التفاعلي عبر الواتساب
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {templates.map((tpl, idx) => (
                    <div
                      key={`travelnotificationshub-tpl-id-${tpl.id || idx}-${idx}`}
                      onClick={() => setSelectedTemplateForPreview(tpl)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selectedTemplateForPreview?.id === tpl.id
                          ? "border-purple-500 bg-purple-50/30 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{tpl.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {tpl.template_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{tpl.message_body}</p>
                      </div>

                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        معتمد رسمياً ✓
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Template Live Preview Card */}
            <div>
              <Card className="border-slate-200 sticky top-6">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                  <CardTitle className="text-xs font-bold text-slate-700">معاينة القالب المعتمد</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {selectedTemplateForPreview ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-950/5 border border-emerald-200 rounded-xl p-3 text-xs leading-relaxed whitespace-pre-line text-slate-800">
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
        {/* TAB 4: INSTANT SEND */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "instant_send" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b bg-slate-50/50 pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Send className="w-5 h-5 text-teal-600" />
                  <span>الإرسال الفوري المباشر (Direct Dispatch)</span>
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
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">رقم الواتساب (مع رمز الدولة)</label>
                    <Input
                      value={sendForm.recipient_phone}
                      onChange={(e) => setSendForm({ ...sendForm, recipient_phone: e.target.value })}
                      placeholder="966505544332"
                      dir="ltr"
                      className="text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">نص الرسالة المراد إرسالها</label>
                  <Textarea
                    rows={6}
                    value={sendForm.message_body}
                    onChange={(e) => setSendForm({ ...sendForm, message_body: e.target.value })}
                    className="text-xs leading-relaxed font-sans"
                  />
                </div>

                <Button
                  onClick={async () => {
                    try {
                      await fetchWithAuth("/api/travel/notifications/send", {
                        method: "POST",
                        body: JSON.stringify(sendForm)
                      });
                      refetchLogs();
                      toast({ title: "✓ تم إرسال الرسالة بنجاح إلى الرقم +" + sendForm.recipient_phone });
                    } catch (e: any) {
                      toast({ title: "خطأ في الإرسال", description: e.message, variant: "destructive" });
                    }
                  }}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs gap-1.5 py-2.5"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال الرسالة عبر الواتساب الآن 🚀</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: BILLING & CONVERSATION CREDITS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
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

              <Card className="border-slate-200">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
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

              <Card className="border-slate-200">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
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
            <Card className="border-slate-200">
              <CardHeader className="border-b bg-slate-50/50 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>إنشاء طلب شحن رصيد رسائل وإرسال رابط السداد للعميل</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">اسم العميل / المكتب</label>
                    <Input
                      value={billingForm.client_name}
                      onChange={(e) => setBillingForm({ ...billingForm, client_name: e.target.value })}
                      placeholder="مؤسسة أفق الرحلات"
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">رقم الواتساب</label>
                    <Input
                      value={billingForm.client_phone}
                      onChange={(e) => setBillingForm({ ...billingForm, client_phone: e.target.value })}
                      placeholder="966505544332"
                      dir="ltr"
                      className="text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المطلوب (ريال)</label>
                    <Input
                      type="number"
                      value={billingForm.amount}
                      onChange={(e) => setBillingForm({ ...billingForm, amount: Number(e.target.value) })}
                      className="text-xs font-mono font-bold"
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
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5"
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
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>سجل الإرسال والتقارير الحية ({logs.length} سجل)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  توثيق كافة الرسائل الصادرة من محرك الأتمتة السحابي لجميع أقسام النظام
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLogs()}
                className="text-xs h-8 gap-1.5"
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
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700">
                            {log.template_code || "AUTOMATION"}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-600" title={log.message_body}>
                          {log.message_body}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
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
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
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
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/40 space-y-1.5">
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
                  توجه إلى <strong>developers.facebook.com</strong> وسجل الدخول باستخدام حساب فيسبوك الخاص بنشاطك التجاري. اضغط على <strong>Get Started</strong> إذا كانت أول مرة لتوثيق رقم هاتفك.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <div className="font-bold text-slate-900">الخطوة 2: إنشاء تطبيق من نوع Business وإضافة WhatsApp</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  من القائمة العلوية اضغط على <strong>My Apps &gt; Create App</strong>، اختر نوع التطبيق <strong>Other</strong> ثم <strong>Business</strong>، وقم بتسميته باسم وكالتك (مثلاً: أومني فلاي للسفريات). بعد إنشاء التطبيق، اضغط على <strong>Set Up</strong> بجانب منتج <strong>WhatsApp</strong>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <div className="font-bold text-slate-900">الخطوة 3: استخراج المعرفات الأساسية (API Setup)</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  من القائمة الجانبية للتطبيق اذهب إلى <strong>WhatsApp &gt; API Setup</strong>، وستجد الحقول الأساسية:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pr-2">
                  <li><strong>Phone number ID:</strong> معرف رقم الهاتف الخاص بالإرسال السحابي.</li>
                  <li><strong>WhatsApp Business Account ID:</strong> معرف حساب الأعمال (WABA ID).</li>
                  <li><strong>App ID:</strong> يظهر في أعلى الشريط العلوي للمنصة.</li>
                  <li><strong>Temporary / Permanent Token:</strong> اضغط Copy لنسخ مفتاح الوصول.</li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-1.5">
                <div className="font-bold text-emerald-900">الخطوة 4: النسخ واللصق أو الاستيراد الذكي التلقائي</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  يمكنك نسخ كود الـ cURL بالكامل من قسم (Send and receive messages) واستخدام زر <strong>الاستيراد الذكي</strong> داخل نظامنا لملء كافة الحقول بضغطة زر واحدة دون الحاجة لكتابتها يدوياً!
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح Meta Developer Console الآن</span>
              </a>
              <Button variant="outline" size="sm" onClick={() => setOnboardingModalOpen(false)} className="text-xs">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 2: SMART CREDENTIALS IMPORTER (cURL / JSON) */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={smartImportModalOpen} onOpenChange={setSmartImportModalOpen}>
          <DialogContent className="max-w-xl" dir="rtl">
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
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="p-3 bg-slate-50 border rounded-lg text-[11px] text-slate-600">
                💡 <strong>نصيحة:</strong> اذهب إلى صفحة <strong>API Setup</strong> في Meta Developer Console، انسخ كود الـ cURL الموجود في الخطوة 2، والصقه هنا مباشرة.
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
                className="text-xs"
              >
                تجربة نص نموذجي
              </Button>

              <Button
                onClick={handleSmartImport}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
              >
                <Zap className="w-4 h-4" />
                <span>تحليل واستيراد البيانات للحقول تلقائياً ⚡</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 3: EDIT AUTOMATION MESSAGE TEMPLATE & LIVE SMARTPHONE PREVIEW */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={editRuleModalOpen} onOpenChange={setEditRuleModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
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
                    className="text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">توقيت إطلاق الإشعار</label>
                  <Input
                    value={ruleTimingDraft}
                    onChange={(e) => setRuleTimingDraft(e.target.value)}
                    placeholder="فوري عند وقوع الحدث"
                    className="text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">نص الرسالة المرسلة للعميل</label>
                    <span className="text-[10px] text-slate-400">يدعم الرموز التعبيرية والتنسيق</span>
                  </div>
                  <Textarea
                    rows={8}
                    value={customMessageDraft}
                    onChange={(e) => setCustomMessageDraft(e.target.value)}
                    className="text-xs leading-relaxed font-sans"
                    dir="rtl"
                  />
                </div>

                {/* Placeholders quick insertion buttons */}
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    انقر لإدراج متغير ديناميكي في نص الرسالة:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "{customer_name}",
                      "{passenger_name}",
                      "{invoice_no}",
                      "{amount}",
                      "{currency}",
                      "{pnr}",
                      "{flight_no}",
                      "{departure_date}",
                      "{hotel_name}",
                      "{visa_code}",
                      "{voucher_no}",
                      "{due_date}",
                      "{ticket_url}",
                      "{portal_url}"
                    ].map((placeholder, idx) => (
                      <button
                        key={`travelnotificationshub-placeholder-${placeholder || idx}-${idx}`}
                        type="button"
                        onClick={() => handleInsertPlaceholder(placeholder)}
                        className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        + {placeholder}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Smartphone Simulator Preview Side */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 mb-2">معاينة الرسالة على تطبيق WhatsApp</span>
                <div className="w-full max-w-[280px] bg-slate-900 rounded-[28px] p-3 shadow-xl border-4 border-slate-800">
                  {/* Phone Header */}
                  <div className="bg-emerald-800 text-white p-2 rounded-t-xl flex items-center gap-2 text-[11px]">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[10px]">
                      OP
                    </div>
                    <div>
                      <div className="font-bold leading-none">{agencyName}</div>
                      <div className="text-[9px] text-emerald-200">حساب تجاري رسمي ✓</div>
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="bg-[#efeae2] p-3 rounded-b-xl min-h-[260px] flex flex-col justify-end">
                    <div className="bg-white rounded-lg p-2.5 shadow-sm text-slate-800 text-[11px] leading-relaxed whitespace-pre-line border border-slate-200 relative">
                      {customMessageDraft
                        ? customMessageDraft
                            .replace(/\{customer_name\}|\{passenger_name\}/g, "أحمد العتيبي")
                            .replace(/\{invoice_no\}/g, "INV-2026-1049")
                            .replace(/\{amount\}/g, "1,850")
                            .replace(/\{currency\}/g, "ريال")
                            .replace(/\{pnr\}/g, "6X9ZKL")
                            .replace(/\{flight_no\}/g, "SV 112")
                            .replace(/\{departure_date\}/g, "15 نوفمبر 2026")
                            .replace(/\{hotel_name\}/g, "بارك حياة دبي")
                            .replace(/\{visa_code\}/g, "VISA-9041")
                            .replace(/\{voucher_no\}/g, "HTL-8842")
                            .replace(/\{ticket_url\}|\{portal_url\}/g, "https://omnifly.app/t/preview")
                        : "معاينة الرسالة ستظهر هنا..."}
                      <div className="text-[9px] text-slate-400 text-left mt-1 font-mono flex items-center justify-end gap-1">
                        <span>10:45 م</span>
                        <CheckCheck className="w-3 h-3 text-blue-500 inline" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditRuleModalOpen(false)} className="text-xs">
                إلغاء
              </Button>

              <Button
                onClick={() => {
                  if (editingRule) {
                    updateRuleMutation.mutate({
                      id: editingRule.id,
                      name: ruleNameDraft,
                      custom_message: customMessageDraft,
                      timing_desc: ruleTimingDraft
                    });
                  }
                }}
                disabled={updateRuleMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ واعتماد التعديل 💾</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 4: TEST SEND TO ANY PHONE NUMBER */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={testSendModalOpen} onOpenChange={setTestSendModalOpen}>
          <DialogContent className="max-w-md" dir="rtl">
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
                  className="font-mono text-xs font-bold"
                />
              </div>

              <div className="bg-slate-50 border rounded-lg p-3 text-[11px] text-slate-700 max-h-36 overflow-y-auto whitespace-pre-line leading-relaxed">
                {testSendRule?.custom_message || testSendRule?.effective_message}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setTestSendModalOpen(false)} className="text-xs">
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
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs gap-1.5"
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
