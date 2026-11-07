import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  QrCode,
  Smartphone,
  ExternalLink,
  Paperclip,
  XCircle,
  FileText,
  Info,
  Sliders,
  Clock,
  Plane,
  Globe,
  Hotel,
  Bus,
  Users,
  Receipt,
  Ticket,
  Save,
  Check,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { COUNTRY_CODES } from "../pages/travel-notifications-hub";

export interface WhatsAppGatewayTabProps {
  fourWaForm: {
    company_code: string;
    username: string;
    password: string;
    phone_number: string;
    country_code: string;
  };
  setFourWaForm: React.Dispatch<React.SetStateAction<any>>;
  fourWaStatus: "pending_login" | "ready_for_scan" | "connected";
  fourWaData: any;
  fourWaPhone: string;
  fourWaQrDataUrl: string;
  showFourWaPassword: boolean;
  setShowFourWaPassword: React.Dispatch<React.SetStateAction<boolean>>;
  fourWaLoginMutation: any;
  fourWaCheckStatusMutation: any;
  fourWaGenerateQrMutation: any;
  fourWaConfirmScanMutation: any;
  fourWaDisconnectMutation: any;
  fourWaSendMessageMutation: any;
  fourWaQuickTestPhone: string;
  setFourWaQuickTestPhone: React.Dispatch<React.SetStateAction<string>>;
  fourWaTestMessage: string;
  setFourWaTestMessage: React.Dispatch<React.SetStateAction<string>>;
  fourWaAttachment: { file: File; base64: string; name: string; type: string } | null;
  setFourWaAttachment: React.Dispatch<React.SetStateAction<any>>;
  handleFourWaFileSelect: (file?: File) => void;
  openOfficialWhatsAppWeb: () => void;
  handleOpenDirectWhatsAppWeb: (phone: string, text: string) => void;
}

export function WhatsAppGatewayTab({
  fourWaForm,
  setFourWaForm,
  fourWaStatus,
  fourWaData,
  fourWaPhone,
  fourWaQrDataUrl,
  showFourWaPassword,
  setShowFourWaPassword,
  fourWaLoginMutation,
  fourWaCheckStatusMutation,
  fourWaGenerateQrMutation,
  fourWaConfirmScanMutation,
  fourWaDisconnectMutation,
  fourWaSendMessageMutation,
  fourWaQuickTestPhone,
  setFourWaQuickTestPhone,
  fourWaTestMessage,
  setFourWaTestMessage,
  fourWaAttachment,
  setFourWaAttachment,
  handleFourWaFileSelect,
  openOfficialWhatsAppWeb,
  handleOpenDirectWhatsAppWeb
}: WhatsAppGatewayTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fileDragging, setFileDragging] = useState(false);

  const isConnected = fourWaStatus === "connected" || fourWaData?.session_status === "connected";
  const isReadyForScan = fourWaStatus === "ready_for_scan" || fourWaData?.session_status === "ready_for_scan";
  const daysRemaining = fourWaData?.days_remaining ?? 0;

  // Active sub-tab inside 4WhatsApp Gateway:
  // default to "settings" if already connected, else "credentials" or "qr_code"
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "instant_send" | "qr_code" | "credentials">(
    isConnected ? "settings" : "credentials"
  );

  useEffect(() => {
    if (isConnected && activeSubTab === "credentials") {
      setActiveSubTab("settings");
    }
  }, [isConnected]);

  // Fetch travel WhatsApp automation settings
  const { data: automationConfig, isLoading: isLoadingConfig } = useQuery<any>({
    queryKey: ["travel-whatsapp-automation-config"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/whatsapp/automation-config", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("تعذر جلب إعدادات الأتمتة");
      return res.json();
    }
  });

  // Fetch extracted contacts directory (Passengers, Customers, Suppliers)
  const { data: contactsDirectory } = useQuery<any>({
    queryKey: ["travel-whatsapp-contacts-directory"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/whatsapp/contacts-directory", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return { passengers: [], customers: [], suppliers: [], totalCount: 0 };
      return res.json();
    }
  });

  const [selectedContactCategory, setSelectedContactCategory] = useState<"passengers" | "customers" | "suppliers">("passengers");

  // Local draft state for notification settings
  const [settingsDraft, setSettingsDraft] = useState<any>({
    is_active: 1,
    content_type: "text_and_pdf",
    schedule_mode: "registration_time",
    scheduled_time: "22:00",
    intro_message_text: "السلام عليكم ورحمة الله وبركاته، الأخ/الأخت الكريم/ة.. تحية طيبة من وكالة أومني فلاي، نرفق لكم تفاصيل حجزكم ومستندات الجواز والتأشيرة:",
    target_group: "all",
    enable_flight_notifications: 1,
    flight_message_template: "عزيزنا المسافر {passenger_name} ✈️ نود تذكيركم بموعد رحلتكم رقم {flight_no} المتجهة إلى {destination} غداً بتاريخ {departure_date}. نتمنى لكم رحلة سعيدة وآمنة مع وكالة أومني فلاي للسفريات ✈️",
    flight_timing_mode: "before_24h",
    flight_attach_pdf: 1,
    enable_visa_notifications: 1,
    visa_message_template: "بشرى سارة عزيزنا {passenger_name}! 🎉 تم تأكيد صدور تأشيرة {country} الخاصة بجواز سفركم رقم {passport_no} بنجاح! يسعدنا خدمتكم في وكالة أومني فلاي 🌍",
    visa_timing_mode: "immediate",
    visa_attach_pdf: 1,
    enable_hotel_notifications: 1,
    hotel_message_template: "مرحباً عزيزنا {passenger_name} 🏨 تم تأكيد حجز فندقكم {hotel_name} - {city}. نتمنى لكم إقامة ممتعة ومريحة 🌟",
    hotel_timing_mode: "immediate",
    hotel_attach_pdf: 1,
    enable_bus_notifications: 1,
    bus_message_template: "عزيزنا المسافر {passenger_name} 🚌 تم إصدار تذكرة رحلة النقل البري بنجاح! خط السير: {route}، المقعد: {seat_no}. رافقتكم السلامة 🌟",
    bus_timing_mode: "immediate",
    bus_attach_pdf: 1,
    enable_package_notifications: 1,
    package_message_template: "أهلاً بك عزيزنا {passenger_name} 🌟 نرفق لكم تفاصيل برنامجكم السياحي والعمرة المعتمد من وكالة أومني فلاي. تقبل الله طاعتكم ونتمنى لكم رحلة ممتعة 🕋",
    package_timing_mode: "immediate",
    package_attach_pdf: 1,
    enable_accounting_notifications: 1,
    accounting_message_template: "عزيزنا العميل {passenger_name} المحترم 💵 تم استلام دفعتكم المالية بنجاح بموجب سند قبض رقم {voucher_no}. شاكرين حسن تعاملكم 🌟",
    accounting_timing_mode: "immediate",
    accounting_attach_pdf: 1,
    preferred_gateway: "4whatsapp"
  });

  // Sync draft whenever server config loads
  useEffect(() => {
    if (automationConfig) {
      setSettingsDraft((prev: any) => ({
        ...prev,
        ...automationConfig
      }));
    }
  }, [automationConfig]);

  // Mutation to save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/whatsapp/automation-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل حفظ إعدادات الأتمتة");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["travel-whatsapp-automation-config"] });
      queryClient.invalidateQueries({ queryKey: ["travel-notification-automations"] });
      toast({
        title: "تم الحفظ والاعتماد بنجاح",
        description: data.message || "تم حفظ كافة إعدادات التنبيهات والجدولة وتفعيلها عبر بوابة 4WhatsApp بنجاح!"
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "خطأ أثناء الحفظ",
        description: err.message || "تعذر حفظ الإعدادات"
      });
    }
  });

  // Active service accordion in settings
  const [activeServiceSection, setActiveServiceSection] = useState<string>("flight");

  // Helper to insert placeholders into a specified field
  const handleInsertTag = (fieldName: string, tag: string) => {
    setSettingsDraft((prev: any) => ({
      ...prev,
      [fieldName]: (prev[fieldName] || "") + " " + tag
    }));
  };

  // Helper to select a passenger and load into quick test dispatcher
  const handleSelectPassengerForTest = (pax: any) => {
    const rawPhone = pax.phone || pax.mobile || "";
    let cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
    const cCode = fourWaForm.country_code || "967";
    if (cleanPhone && !cleanPhone.startsWith(cCode) && cleanPhone.length <= 10) {
      cleanPhone = `${cCode}${cleanPhone}`;
    }
    setFourWaQuickTestPhone(cleanPhone);
    setFourWaTestMessage(
      settingsDraft.intro_message_text
        .replace(/\{passenger_name\}/g, pax.name_ar || pax.name_en || "المسافر الكريم")
        .replace(/\{passport_no\}/g, pax.passport_number || "A12345678")
        .replace(/\{departure_date\}/g, pax.travel_date || "2026-11-15")
        .replace(/\{destination\}/g, pax.destination || "جدة / مكة")
    );
    setActiveSubTab("instant_send");
    toast({
      title: "تم سحب بيانات المسافر بنجاح",
      description: `تم سحب رقم المسافر ${pax.name_ar || pax.name_en} (${cleanPhone}) وتجهيز الرسالة للإرسال الفوري عبر 4WhatsApp.`
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Top Gateway Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-5 lg:p-6 rounded-3xl shadow-xl border border-emerald-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <MessageSquare className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base lg:text-lg font-black text-white">
                بوابة واتساب للأعمال (4WhatsApp Gateway)
              </h3>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                api2.4whatsapp.com
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              الربط المباشر الموثوق لإرسال الإشعارات الآلية، التذاكر، فواتير المبيعات، ومستندات الجوازات والتأشيرات عبر سحابة 4WhatsApp الرسمية بنقاء وسرعة فائقة.
            </p>
          </div>
        </div>

        {/* Status Badges & Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          {isConnected ? (
            <Badge className="bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 gap-1.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>متصل ومرتبط سحابياً 🟢</span>
              {daysRemaining > 0 && (
                <span className="bg-emerald-600/70 px-1.5 py-0.5 rounded text-[10px] mr-1">
                  متبقي {daysRemaining} يوم
                </span>
              )}
            </Badge>
          ) : isReadyForScan ? (
            <Badge className="bg-amber-500 text-slate-950 font-bold text-xs px-3 py-1.5 gap-1.5 shadow-sm animate-pulse">
              <QrCode className="w-4 h-4" />
              <span>جاهز للمسح من الهاتف 🟡</span>
            </Badge>
          ) : (
            <Badge className="bg-slate-700 text-slate-300 text-xs px-3 py-1.5 gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>بانتظار تسجيل الدخول</span>
            </Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => fourWaCheckStatusMutation.mutate()}
            disabled={fourWaCheckStatusMutation.isPending}
            className="text-xs font-bold gap-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fourWaCheckStatusMutation.isPending ? "animate-spin" : ""}`} />
            <span>فحص الحالة اللحظية</span>
          </Button>

          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fourWaDisconnectMutation.mutate()}
              disabled={fourWaDisconnectMutation.isPending}
              className="text-xs font-bold gap-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30 h-9"
            >
              <span>إلغاء الربط</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Sleek Secondary Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab("settings")}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "settings"
                ? "bg-slate-900 text-emerald-400 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>إعدادات تنبيهات المسافرين والسفريات ⚙️</span>
          </button>

          <button
            onClick={() => setActiveSubTab("instant_send")}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "instant_send"
                ? "bg-slate-900 text-emerald-400 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>الإرسال الفوري والمرفقات 🚀</span>
          </button>

          <button
            onClick={() => setActiveSubTab("qr_code")}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "qr_code"
                ? "bg-slate-900 text-emerald-400 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>الباركود ورمز QR 📱</span>
          </button>

          <button
            onClick={() => setActiveSubTab("credentials")}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === "credentials"
                ? "bg-slate-900 text-emerald-400 shadow-sm font-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>بيانات الحساب وجلسة الربط 🔐</span>
          </button>
        </div>

        {activeSubTab === "settings" && (
          <Button
            size="sm"
            onClick={() => saveSettingsMutation.mutate(settingsDraft)}
            disabled={saveSettingsMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-3.5 rounded-xl gap-1.5 shrink-0 shadow-sm"
          >
            {saveSettingsMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>حفظ واعتماد الإعدادات 💾</span>
          </Button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: TRAVEL & TOURISM NOTIFICATION SETTINGS (THE MAIN USER REQUEST) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "settings" && (
        <div className="space-y-6">
          {/* Section 1: Global Passenger Dispatch Controls */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-emerald-600" />
                    <span>إعدادات ضبط وإرسال التنبيهات والرسائل للمسافرين عبر 4WhatsApp</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    تحكم كامل في صيغة الإرسال (نص، PDF)، وقت وتوقيت الإرسال، وتخصيص نص الرسائل مع سحب أرقام المسافرين تلقائياً.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">حالة الإرسال الآلي:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsDraft((prev: any) => ({
                        ...prev,
                        is_active: prev.is_active === 1 ? 0 : 1
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      settingsDraft.is_active === 1 ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settingsDraft.is_active === 1 ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold font-mono text-emerald-700">
                    {settingsDraft.is_active === 1 ? "مفعل 🟢" : "موقف ⚪"}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Format Choice: Text vs PDF vs Text+PDF */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>صيغة وطريقة إرسال التنبيه للمسافر:</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    حدد ما إذا كان سيتم إرسال نص التنبيه فقط أو إرفاق مستند الـ PDF الخاص بالحجز أو كليهما معاً:
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: "text", label: "نص فقط 📝", desc: "إرسال نص الرسالة فقط" },
                      { id: "pdf", label: "مرفق PDF فقط 📄", desc: "إرسال مستند الحجز PDF" },
                      { id: "text_and_pdf", label: "نص + PDF معاً 📑", desc: "نص الرسالة مع المرفق (موصى به)" }
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setSettingsDraft((prev: any) => ({ ...prev, content_type: fmt.id }))}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                          settingsDraft.content_type === fmt.id
                            ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xs font-bold block">{fmt.label}</span>
                        <span className="text-[10px] text-slate-500 mt-1 block leading-tight">{fmt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Dispatch Timing & Schedule Mode */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>ضبط وقت وتوقيت إرسال التنبيهات للمسافرين:</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    اختر توقيت إطلاق الإشعار التلقائي عبر 4WhatsApp:
                  </p>

                  <div className="space-y-2 pt-1">
                    <select
                      value={settingsDraft.schedule_mode || "registration_time"}
                      onChange={(e) => setSettingsDraft((prev: any) => ({ ...prev, schedule_mode: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                    >
                      <option value="registration_time">⚡ فوري لحظياً (عند تسجيل المسافر أو تأكيد الحجز مباشرة)</option>
                      <option value="before_travel_1d">✈️ قبل موعد السفر أو الرحلة بـ 24 ساعة (تذكير موعد الإقلاع والمطار)</option>
                      <option value="before_travel_2d">✈️ قبل موعد السفر أو الرحلة بـ 48 ساعة (تجهيز الأمتعة والجواز)</option>
                      <option value="custom_time">⏰ يومياً في توقيت محدد (تشغيل المحرك في ساعة محددة)</option>
                    </select>

                    {settingsDraft.schedule_mode === "custom_time" && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">وقت الإرسال اليومي:</span>
                        <Input
                          type="time"
                          value={settingsDraft.scheduled_time || "22:00"}
                          onChange={(e) => setSettingsDraft((prev: any) => ({ ...prev, scheduled_time: e.target.value }))}
                          className="h-9 text-xs font-mono font-bold bg-white rounded-xl w-36"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Text Message Body Customization with Dynamic Variables */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-teal-600" />
                    <span>تعديل نص الرسالة الترحيبية وتنبيه الحجز للمسافرين:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    يدعم الرموز التعبيرية وتنسيقات واتساب (*عريض*، _مائل_)
                  </span>
                </div>

                <Textarea
                  rows={4}
                  value={settingsDraft.intro_message_text || ""}
                  onChange={(e) => setSettingsDraft((prev: any) => ({ ...prev, intro_message_text: e.target.value }))}
                  placeholder="اكتب نص الرسالة التي ستصل للمسافر..."
                  className="text-xs leading-relaxed font-sans rounded-2xl bg-slate-50 border-slate-200 focus:bg-white resize-y min-h-[90px]"
                  dir="rtl"
                />

                {/* Variable Insertion Chips */}
                <div className="pt-1">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    انقر لإدراج متغير ديناميكي يُسحب تلقائياً من بيانات المسافر والحجز:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: "{passenger_name}", label: "اسم المسافر" },
                      { tag: "{phone_number}", label: "رقم الهاتف" },
                      { tag: "{passport_no}", label: "رقم الجواز" },
                      { tag: "{pnr}", label: "رقم الحجز PNR" },
                      { tag: "{flight_no}", label: "رقم الرحلة" },
                      { tag: "{departure_date}", label: "تاريخ المغادرة" },
                      { tag: "{destination}", label: "الوجهة" },
                      { tag: "{hotel_name}", label: "اسم الفندق" },
                      { tag: "{voucher_no}", label: "رقم الفوتشر" },
                      { tag: "{remaining_days}", label: "الأيام المتبقية" },
                      { tag: "{agency_name}", label: "اسم الوكالة" }
                    ].map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleInsertTag("intro_message_text", item.tag)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border border-slate-200 transition-colors flex items-center gap-1"
                      >
                        <span className="text-emerald-600 font-mono">+</span>
                        <span>{item.label}</span>
                        <span className="text-[9px] text-slate-400 font-mono font-normal">{item.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Auto-Pull WhatsApp Numbers Directory (المسافرين، العملاء، والموردين) */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">
                      دليل أرقام الواتساب المسحوبة تلقائياً من أقسام النظام (العملاء، المسافرين، والموردين):
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200">
                      إجمالي المتاح: {contactsDirectory?.totalCount || 0} رقم
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    يسحب النظام أرقام العملاء، المسافرين، والموردين تلقائياً لتشغيل التنبيهات المجدولة والإرسال الآلي
                  </span>
                </div>

                {/* Category Selector Tabs */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedContactCategory("passengers")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedContactCategory === "passengers"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>✈️ المسافرين</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                      {contactsDirectory?.passengers?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedContactCategory("customers")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedContactCategory === "customers"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>👥 العملاء</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                      {contactsDirectory?.customers?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedContactCategory("suppliers")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedContactCategory === "suppliers"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>🏢 الموردين</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                      {contactsDirectory?.suppliers?.length || 0}
                    </span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/50">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                        <th className="p-2.5 pr-4">الاسم المسجل</th>
                        <th className="p-2.5">رقم الهاتف / الواتساب</th>
                        <th className="p-2.5">الجهة / التصنيف</th>
                        <th className="p-2.5">البيانات المتاحة</th>
                        <th className="p-2.5 text-center">اختبار الإرسال</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 bg-white">
                      {((contactsDirectory as any)?.[selectedContactCategory] || []).length > 0 ? (
                        ((contactsDirectory as any)?.[selectedContactCategory] || []).map((item: any) => (
                          <tr key={`${selectedContactCategory}-${item.id}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 pr-4 font-bold text-slate-900">
                              {item.name || `جهة #${item.id}`}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">
                              {item.phone || item.mobile || "غير مسجل"}
                            </td>
                            <td className="p-2.5">
                              <Badge variant="outline" className={`text-[10px] font-bold ${
                                selectedContactCategory === 'passengers' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                selectedContactCategory === 'customers' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {selectedContactCategory === 'passengers' ? 'مسافر سياحي' :
                                 selectedContactCategory === 'customers' ? 'عميل معتمد' : 'مورد / شركة'}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                              {item.passport_number ? `جواز: ${item.passport_number}` : item.email ? item.email : item.travel_date ? `سفر: ${item.travel_date}` : "مكتمل البيانات"}
                            </td>
                            <td className="p-2.5 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSelectPassengerForTest({
                                  id: item.id,
                                  name_ar: item.name,
                                  phone: item.phone,
                                  passport_number: item.passport_number || "---",
                                  travel_date: item.travel_date || "2026/11/15",
                                  visa_type: selectedContactCategory === 'passengers' ? 'تأشيرة سياحية' : selectedContactCategory === 'customers' ? 'فاتورة عميل' : 'سند صرف مورد'
                                })}
                                className="text-[11px] h-7 px-2.5 rounded-lg border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold gap-1"
                              >
                                <Send className="w-3 h-3 text-emerald-600" />
                                <span>اختيار وتجربة الإرسال 📨</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            لا توجد سجلات هاتف مسجلة حالياً في هذا القسم
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Specific Travel Services & Bookings Operations Settings */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                <span>إعدادات خدمات وحجوزات السفر (التحكم في رسائل وتوقيت كل خدمة)</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                خصص نصوص الرسائل ومرفقات الـ PDF وتوقيت الإرسال لكل قسم: تذاكر الطيران، التأشيرات، الفنادق، النقل البري، الباقات، والفواتير والسندات.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4 text-xs">
              {/* Service Sub-Selector Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                {[
                  { id: "flight", label: "✈️ تذاكر وحجوزات الطيران", icon: Plane },
                  { id: "visa", label: "🛂 التأشيرات والجوازات", icon: Globe },
                  { id: "hotel", label: "🏨 حجوزات الفنادق والسكن", icon: Hotel },
                  { id: "bus", label: "🚌 النقل البري والباصات", icon: Bus },
                  { id: "package", label: "🕋 الباقات والعمرة", icon: Sparkles },
                  { id: "accounting", label: "🧾 السندات والفواتير", icon: Receipt }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveServiceSection(s.id)}
                    className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      activeServiceSection === s.id
                        ? "bg-indigo-600 text-white shadow-sm font-black"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* 1. Flight Bookings Settings */}
              {activeServiceSection === "flight" && (
                <div className="space-y-4 animate-in fade-in duration-200 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Plane className="w-4 h-4 text-indigo-600" />
                        <span>إشعارات وتذاكر الطيران للمسافرين</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال التذكرة الإلكترونية وتفاصيل PNR وتذكير موعد الإقلاع والمقعد للمسافر.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.flight_attach_pdf === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              flight_attach_pdf: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>إرفاق تذكرة الطيران PDF</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.enable_flight_notifications === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              enable_flight_notifications: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>تفعيل الإشعار</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">نص رسالة تذكرة الطيران والتذكير:</label>
                      <Textarea
                        rows={3}
                        value={settingsDraft.flight_message_template || ""}
                        onChange={(e) =>
                          setSettingsDraft((prev: any) => ({ ...prev, flight_message_template: e.target.value }))
                        }
                        className="text-xs bg-white rounded-xl border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">وقت وتوقيت الإرسال:</label>
                      <select
                        value={settingsDraft.flight_timing_mode || "before_24h"}
                        onChange={(e) =>
                          setSettingsDraft((prev: any) => ({ ...prev, flight_timing_mode: e.target.value }))
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        <option value="immediate">⚡ فوري عند إصدار التذكرة</option>
                        <option value="before_24h">✈️ قبل الإقلاع بـ 24 ساعة</option>
                        <option value="before_48h">✈️ قبل الإقلاع بـ 48 ساعة</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Visa & Passport Settings */}
              {activeServiceSection === "visa" && (
                <div className="space-y-4 animate-in fade-in duration-200 bg-teal-50/30 p-4 rounded-2xl border border-teal-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-teal-600" />
                        <span>إشعارات التأشيرات وجوازات السفر</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إشعار صدور التأشيرة للمسافر، وتنبيهات انتهاء صلاحية الجواز، ومتابعة مدة الإقامة.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.visa_attach_pdf === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              visa_attach_pdf: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                        />
                        <span>إرفاق وثيقة التأشيرة PDF</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.enable_visa_notifications === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              enable_visa_notifications: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                        />
                        <span>تفعيل الإشعار</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">نص إشعار صدور التأشيرة:</label>
                      <Textarea
                        rows={3}
                        value={settingsDraft.visa_message_template || ""}
                        onChange={(e) =>
                          setSettingsDraft((prev: any) => ({ ...prev, visa_message_template: e.target.value }))
                        }
                        className="text-xs bg-white rounded-xl border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">وقت وتوقيت الإرسال:</label>
                      <select
                        value={settingsDraft.visa_timing_mode || "immediate"}
                        onChange={(e) =>
                          setSettingsDraft((prev: any) => ({ ...prev, visa_timing_mode: e.target.value }))
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        <option value="immediate">⚡ فوري عند صدور التأشيرة</option>
                        <option value="passport_expiry_90d">🛂 قبل انتهاء الجواز بـ 90 يوماً</option>
                        <option value="daily_stay">🕋 متابعة يومية لمدة الإقامة</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Hotel Booking Settings */}
              {activeServiceSection === "hotel" && (
                <div className="space-y-4 animate-in fade-in duration-200 bg-amber-50/30 p-4 rounded-2xl border border-amber-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Hotel className="w-4 h-4 text-amber-600" />
                        <span>إشعارات وتأكيدات حجوزات الفنادق والسكن</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال قسيمة السكن (Hotel Voucher) ومواعيد الدخول والخروج ورابط الموقع الجغرافي.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.hotel_attach_pdf === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              hotel_attach_pdf: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <span>إرفاق فوتشر الفندق PDF</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.enable_hotel_notifications === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              enable_hotel_notifications: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <span>تفعيل الإشعار</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">نص رسالة تأكيد الفندق والفوتشر:</label>
                    <Textarea
                      rows={3}
                      value={settingsDraft.hotel_message_template || ""}
                      onChange={(e) =>
                        setSettingsDraft((prev: any) => ({ ...prev, hotel_message_template: e.target.value }))
                      }
                      className="text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* 4. Bus & Land Transport Settings */}
              {activeServiceSection === "bus" && (
                <div className="space-y-4 animate-in fade-in duration-200 bg-blue-50/30 p-4 rounded-2xl border border-blue-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-blue-600" />
                        <span>إشعارات وتذاكر النقل البري والباصات</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال تذكرة الرحلة، موعد الانطلاق، محطة التحرك، ورقم المقعد للمسافر.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.bus_attach_pdf === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              bus_attach_pdf: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>إرفاق تذكرة الباص PDF</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.enable_bus_notifications === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              enable_bus_notifications: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>تفعيل الإشعار</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">نص رسالة تذكرة النقل البري والمحطة:</label>
                    <Textarea
                      rows={3}
                      value={settingsDraft.bus_message_template || ""}
                      onChange={(e) =>
                        setSettingsDraft((prev: any) => ({ ...prev, bus_message_template: e.target.value }))
                      }
                      className="text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* 5. Tour Packages & Umrah */}
              {activeServiceSection === "package" && (
                <div className="space-y-4 animate-in fade-in duration-200 bg-purple-50/30 p-4 rounded-2xl border border-purple-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>إشعارات البرامج السياحية وحملات العمرة</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال جدول البرنامج السياحي، مسار الزيارات، ومتابعة إقامة معتمري مكة.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.package_attach_pdf === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              package_attach_pdf: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                        <span>إرفاق جدول البرنامج PDF</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.enable_package_notifications === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              enable_package_notifications: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                        <span>تفعيل الإشعار</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">نص رسالة البرنامج والمسار السياحي:</label>
                    <Textarea
                      rows={3}
                      value={settingsDraft.package_message_template || ""}
                      onChange={(e) =>
                        setSettingsDraft((prev: any) => ({ ...prev, package_message_template: e.target.value }))
                      }
                      className="text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* 6. Invoices & Receipts */}
              {activeServiceSection === "accounting" && (
                <div className="space-y-4 animate-in fade-in duration-200 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-600" />
                        <span>سندات القبض المالي والفواتير للمسافرين</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال سند القبض المالي فور استلام الدفعة، وإرفاق إيصال السداد أو الفاتورة الضريبية.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.accounting_attach_pdf === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              accounting_attach_pdf: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>إرفاق سند القبض PDF</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={settingsDraft.enable_accounting_notifications === 1}
                          onChange={(e) =>
                            setSettingsDraft((prev: any) => ({
                              ...prev,
                              enable_accounting_notifications: e.target.checked ? 1 : 0
                            }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>تفعيل الإشعار</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">نص رسالة سند القبض المالي:</label>
                    <Textarea
                      rows={3}
                      value={settingsDraft.accounting_message_template || ""}
                      onChange={(e) =>
                        setSettingsDraft((prev: any) => ({ ...prev, accounting_message_template: e.target.value }))
                      }
                      className="text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Bar: Save Everything with High Accuracy */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-xs block text-white">
                  تنفيذ الإعدادات وحفظها دائمياً في قاعدة البيانات
                </span>
                <span className="text-[11px] text-slate-400">
                  يتم تطبيق هذه الإعدادات وتنفيذ إرسال التنبيهات بدقة فائقة عبر بوابة 4WhatsApp الرسمية
                </span>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => saveSettingsMutation.mutate(settingsDraft)}
              disabled={saveSettingsMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-11 px-6 rounded-xl gap-2 shadow-md shadow-emerald-600/30 shrink-0"
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>حفظ واعتماد كافة الإعدادات والجدولة عبر 4WhatsApp 💾</span>
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: INSTANT SEND & ATTACHMENT DISPATCHER */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "instant_send" && (
        <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              <span>الإرسال الفوري المباشر وإرفاق الملفات عبر 4WhatsApp (API Dispatcher)</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              إرسال رسائل أو مرفقات PDF وتذاكر السفر مباشرة لأي مسافر أو عميل عبر رقم الواتساب المتصل.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fourWaSendMessageMutation.mutate({
                  recipient_phone: fourWaQuickTestPhone,
                  message_body: fourWaTestMessage,
                  file_base64: fourWaAttachment?.base64,
                  file_name: fourWaAttachment?.name,
                  file_type: fourWaAttachment?.type
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Text and Phone Area (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      رقم هاتف المستلم <span className="font-normal text-slate-400">(مع مفتاح الدولة أو بدونه)</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={fourWaForm.country_code}
                        onChange={(e) => setFourWaForm((prev: any) => ({ ...prev, country_code: e.target.value }))}
                        className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white w-28 shrink-0"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            +{c.code} ({c.name})
                          </option>
                        ))}
                      </select>
                      <Input
                        value={fourWaQuickTestPhone}
                        onChange={(e) => setFourWaQuickTestPhone(e.target.value)}
                        placeholder="مثال: 771234567 أو 967771234567"
                        className="text-xs font-mono font-bold h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">نص الرسالة</label>
                    <Textarea
                      rows={5}
                      value={fourWaTestMessage}
                      onChange={(e) => setFourWaTestMessage(e.target.value)}
                      placeholder="اكتب رسالتك هنا..."
                      className="text-xs leading-relaxed rounded-xl bg-slate-50 border-slate-200 focus:bg-white resize-y min-h-[120px]"
                    />
                  </div>
                </div>

                {/* Attachment Upload Area (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col">
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">
                    المرفق <span className="font-normal text-slate-400">(اختياري - حتى 10 ميجابايت)</span>
                  </span>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setFileDragging(true);
                    }}
                    onDragLeave={() => setFileDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setFileDragging(false);
                      if (e.dataTransfer.files?.[0]) {
                        handleFourWaFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`flex-1 min-h-[160px] rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-colors ${
                      fileDragging
                        ? "border-emerald-500 bg-emerald-50/50"
                        : "border-slate-200 bg-slate-50/60 hover:bg-slate-50"
                    }`}
                  >
                    {fourWaAttachment ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 rounded-full bg-emerald-100 text-emerald-700">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 max-w-[200px] truncate">
                          {fourWaAttachment.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {(fourWaAttachment.file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFourWaAttachment(null)}
                          className="text-rose-600 hover:bg-rose-50 text-[11px] h-7 px-2 mt-1 rounded-lg"
                        >
                          <XCircle className="w-3.5 h-3.5 ml-1" />
                          إزالة المرفق
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 rounded-full bg-slate-100 text-slate-400">
                          <Paperclip className="w-6 h-6" />
                        </div>
                        <label className="cursor-pointer">
                          <span className="text-xs font-bold text-emerald-700 hover:underline">
                            انقر لاختيار ملف (PDF / صورة)
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFourWaFileSelect(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                        <span className="text-[10px] text-slate-400">أو اسحب وأفلت الملف داخل هذا المربع</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={fourWaSendMessageMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-6 rounded-xl gap-2 shadow-sm"
                  >
                    {fourWaSendMessageMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{fourWaSendMessageMutation.isPending ? "جاري الإرسال عبر البوابة..." : "إرسال الرسالة الآن 🚀"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenDirectWhatsAppWeb(fourWaQuickTestPhone, fourWaTestMessage)}
                    className="text-xs h-10 px-4 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 font-bold gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                    <span>فتح في واتساب ويب مباشرة</span>
                  </Button>
                </div>

                <p className="text-[11px] text-slate-400">
                  يتم توثيق كل عملية إرسال مباشرة في سجل الرسائل وتقارير النظام
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 3: LIVE BARCODE & MULTI-DEVICE PAIRING */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "qr_code" && (
        <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <span>مسح الباركود وربط الجهاز (Live 4WhatsApp Barcode QR)</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              امسح رمز الباركود من تطبيق واتساب بهاتفك لربط الرقم بسحابة 4WhatsApp مباشرة وبشكل دائم.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Left Column: QR Image & Actions */}
              <div className="flex flex-col items-center text-center">
                <div className="relative p-3 bg-white rounded-3xl border-2 border-slate-200 shadow-md">
                  {fourWaGenerateQrMutation.isPending ? (
                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-2xl">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                      <span className="text-xs font-bold text-slate-600">جاري طلب الباركود من سيرفر 4WhatsApp...</span>
                    </div>
                  ) : fourWaQrDataUrl ? (
                    <img
                      src={fourWaQrDataUrl}
                      alt="4WhatsApp QR Code"
                      className="w-64 h-64 object-contain rounded-2xl"
                    />
                  ) : (
                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-2xl p-4">
                      <QrCode className="w-12 h-12 text-slate-300" />
                      <span className="text-xs font-bold text-slate-600">انقر لتوليد وجلب رمز الباركود</span>
                      <Button
                        size="sm"
                        onClick={() => fourWaGenerateQrMutation.mutate()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
                      >
                        توليد الباركود الآن
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fourWaGenerateQrMutation.mutate()}
                    disabled={fourWaGenerateQrMutation.isPending}
                    className="text-xs font-bold gap-1 rounded-xl"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fourWaGenerateQrMutation.isPending ? "animate-spin" : ""}`} />
                    <span>تحديث الباركود</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => fourWaConfirmScanMutation.mutate()}
                    disabled={fourWaConfirmScanMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1 rounded-xl"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تأكيد المسح والاتصال ✓</span>
                  </Button>
                </div>
              </div>

              {/* Right Column: Step by step instructions */}
              <div className="space-y-4 text-xs text-slate-600">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                  <span className="font-bold text-emerald-950 block text-sm">
                    خطوات المسح والربط السريع:
                  </span>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-relaxed font-medium">
                    <li>افتح تطبيق **WhatsApp** على هاتفك المحمول.</li>
                    <li>انقر على قائمة **الإعدادات** (أو الثلاث نقاط الرأسية) واختر **الأجهزة المرتبطة**.</li>
                    <li>انقر على **ربط جهاز** ووجّه كاميرا هاتفك نحو رمز الباركود المعروض أمامك.</li>
                    <li>فور اكتمال المسح، انقر على زر **تأكيد المسح والاتصال** أعلاه لحفظ الجلسة في النظام.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 block">
                    ملاحظات حول سحابة 4WhatsApp:
                  </span>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    رمز الباركود يتم جلبه عبر بروتوكول 4WhatsApp الرسمي. بعد الربط يظل الرقم متصلاً بشكل دائم، مما يتيح إرسال كافة التنبيهات والرسائل في الخلفية دون الحاجة لبقاء المتصفح مفتوحاً.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 4: CREDENTIALS & ACCOUNT CONFIGURATION */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "credentials" && (
        <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>بيانات حساب 4WhatsApp ومفاتيح الربط والاعتماد</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              بيانات الدخول والرمز السري (Token) وكود الشركة المعتمد لدى سحابة 4WhatsApp.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fourWaLoginMutation.mutate(fourWaForm);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    كود الشركة (Company Code)
                  </label>
                  <Input
                    value={fourWaForm.company_code}
                    onChange={(e) => setFourWaForm((prev: any) => ({ ...prev, company_code: e.target.value }))}
                    placeholder="0058"
                    className="font-mono font-bold text-xs h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">الكود الافتراضي: 0058</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    اسم المستخدم (Username)
                  </label>
                  <Input
                    value={fourWaForm.username}
                    onChange={(e) => setFourWaForm((prev: any) => ({ ...prev, username: e.target.value }))}
                    placeholder="admin"
                    className="font-bold text-xs h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">اسم المستخدم بالحساب</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    رقم هاتف الواتساب
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={fourWaForm.country_code}
                      onChange={(e) => setFourWaForm((prev: any) => ({ ...prev, country_code: e.target.value }))}
                      className="h-10 px-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white w-24 shrink-0"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          +{c.code}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={fourWaForm.phone_number}
                      onChange={(e) => setFourWaForm((prev: any) => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="771234567"
                      className="font-mono font-bold text-xs h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    الرمز السري (Token / Password)
                  </label>
                  <div className="relative">
                    <Input
                      type={showFourWaPassword ? "text" : "password"}
                      value={fourWaForm.password}
                      onChange={(e) => setFourWaForm((prev: any) => ({ ...prev, password: e.target.value }))}
                      placeholder="رمز التوكن السري"
                      className="font-mono text-xs h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white pl-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFourWaPassword(!showFourWaPassword)}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showFourWaPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <Button
                  type="submit"
                  disabled={fourWaLoginMutation.isPending}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-6 rounded-xl gap-2 shadow-sm"
                >
                  {fourWaLoginMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{fourWaLoginMutation.isPending ? "جاري التحقق والاتصال..." : "حفظ بيانات الحساب والتحقق مع السيرفر 🔐"}</span>
                </Button>

                <p className="text-[11px] text-slate-400">
                  يتم حفظ بيانات الحساب في قاعدة بيانات النظام واستخدامها تلقائياً لإرسال كافة التنبيهات
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
