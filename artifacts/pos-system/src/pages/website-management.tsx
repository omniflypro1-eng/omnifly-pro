import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import {
  Globe,
  LayoutDashboard,
  Ticket,
  Building2,
  Plane,
  Compass,
  FileText,
  Bus,
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Save,
  Percent,
  Copy,
  Check,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  MapPin,
  Car,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Upload,
  ImageIcon,
  Palette,
  Layers,
  History,
  RotateCcw,
  Rocket,
  Undo2,
  XCircle,
  Wallet,
  AlertCircle,
  Send,
  KeyRound,
  Server
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { NjazLogo } from "@/components/NjazLogo";
import {
  dispatchWhatsApp,
  getWhatsAppPermission,
  saveWhatsAppPermission,
  resetWhatsAppPermission,
  WhatsAppSendMode
} from "@/lib/whatsapp";
import { WhatsAppPermissionDialog } from "@/components/WhatsAppPermissionDialog";
import {
  WebsiteThemeConfig,
  WebsitePromotion,
  DEFAULT_WEBSITE_THEME,
  normalizeWebsiteConfig
} from "@/lib/website-theme";
import { VisualIdentityEditor } from "@/components/website/VisualIdentityEditor";
import { SectionsCustomizer } from "@/components/website/SectionsCustomizer";


function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token") || ""
      : "";
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

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function WebsiteManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchStr = useSearch();
  const [activeTab, setActiveTab] = useState("visual-identity");
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pendingDeleteServiceId, setPendingDeleteServiceId] = useState<number | null>(null);
  const [focusedBookingId, setFocusedBookingId] = useState<number | null>(null);
  const [focusedInquiryId, setFocusedInquiryId] = useState<number | null>(null);
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [reviewPaymentStatus, setReviewPaymentStatus] = useState<string>("paid");
  const [reviewPaymentMethod, setReviewPaymentMethod] = useState<string>("cash");
  const [reviewSafeId, setReviewSafeId] = useState<string>("");
  const [reviewFinalAmount, setReviewFinalAmount] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [reviewForceWaNow, setReviewForceWaNow] = useState<boolean>(false);
  const [rejectTargetBooking, setRejectTargetBooking] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  // WhatsApp One-Time Permission & Direct Native Dispatch State
  const [waPermOpen, setWaPermOpen] = useState(false);
  const [pendingWaAction, setPendingWaAction] = useState<(() => void) | null>(null);
  const [currentWaPerm, setCurrentWaPerm] = useState(getWhatsAppPermission);

  const handleSendWhatsApp = (phone?: string, text = "") => {
    dispatchWhatsApp({
      phone,
      text,
      onRequirePermission: (action) => {
        setPendingWaAction(() => action);
        setWaPermOpen(true);
      }
    });
  };

  const handleUpdateWaMode = (mode: WhatsAppSendMode) => {
    const updated = saveWhatsAppPermission({ mode });
    setCurrentWaPerm(updated);
    toast({
      title: "تم تحديث ضبط الواتساب",
      description:
        mode === "installed_app"
          ? "تم التفعيل: الإرسال المباشر عبر تطبيق واتساب المثبت"
          : "تم التفعيل: الإرسال عبر متصفح الويب"
    });
  };

  const handleResetWaPermission = () => {
    resetWhatsAppPermission();
    setCurrentWaPerm(getWhatsAppPermission());
    toast({
      title: "تمت إعادة تعيين الإذن",
      description: "سيطلب النظام الإذن مجدداً لمرة واحدة عند أول إرسال قادم"
    });
  };

  // 1. Fetch Website Settings (with Tenant isolation & Draft overlay)
  const { data: config } = useQuery<any>({
    queryKey: ["admin-website-config"],
    queryFn: () => fetchWithAuth("/api/admin/website/config")
  });

  const [formState, setFormState] = useState<WebsiteThemeConfig | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // 4WhatsApp Live Status, Server Check & Test OTP Dispatch
  const [testOtpPhone, setTestOtpPhone] = useState("");
  const [liveServerChecking, setLiveServerChecking] = useState(false);
  const [liveCheckResult, setLiveCheckResult] = useState<any>(null);
  const [testOtpResult, setTestOtpResult] = useState<{
    success: boolean;
    message: string;
    test_otp?: string;
    latency_ms?: number;
  } | null>(null);

  const { data: fourWaStatus, refetch: refetchFourWaStatus } = useQuery<any>({
    queryKey: ["admin-website-4whatsapp-status"],
    queryFn: () => fetchWithAuth("/api/admin/website/4whatsapp-status")
  });

  useEffect(() => {
    if (fourWaStatus?.config?.phone_number && !testOtpPhone) {
      setTestOtpPhone(fourWaStatus.config.phone_number);
    }
  }, [fourWaStatus, testOtpPhone]);

  const handleVerify4WhatsAppServer = async () => {
    setLiveServerChecking(true);
    setLiveCheckResult(null);
    try {
      const res = await fetchWithAuth<any>("/api/admin/website/4whatsapp-status?live=1");
      setLiveCheckResult(res);
      await refetchFourWaStatus();
      const connected = Boolean(res?.config?.is_connected || (res?.live_check?.verified && res?.live_check?.linked));
      toast({
        title: connected ? "سيرفر 4WhatsApp متصل وجاهز للإرسال" : "سيرفر 4WhatsApp غير جاهز للإرسال",
        description: connected
          ? `الحساب مربوط ونشط${res?.live_check?.days_remaining ? ` (متبقي ${res.live_check.days_remaining} يوم)` : ""}`
          : res?.live_check?.error || res?.config?.last_verification_error || "يرجى ربط الحساب من مركز تنبيهات الواتساب",
        variant: connected ? "default" : "destructive"
      });
    } catch (err: any) {
      toast({
        title: "تعذر فحص سيرفر 4WhatsApp",
        description: err?.message || "حدث خطأ أثناء الاتصال بالسيرفر",
        variant: "destructive"
      });
    } finally {
      setLiveServerChecking(false);
    }
  };

  const test4WhatsAppOtpMutation = useMutation({
    mutationFn: (phone: string) =>
      fetchWithAuth<any>("/api/admin/website/test-4whatsapp-otp", {
        method: "POST",
        body: JSON.stringify({ phone })
      }),
    onSuccess: (res) => {
      setTestOtpResult({
        success: true,
        message: res.message,
        test_otp: res.test_otp,
        latency_ms: res.latency_ms
      });
      refetchFourWaStatus();
      toast({
        title: "تم إرسال كود التحقق التجريبي بنجاح",
        description: res.message
      });
    },
    onError: (err: any) => {
      setTestOtpResult({
        success: false,
        message: err?.message || "فشل إرسال كود التحقق عبر سيرفر 4WhatsApp"
      });
      refetchFourWaStatus();
      toast({
        title: "فشل اختبار إرسال كود التحقق",
        description: err?.message || "تأكد من حالة اتصال سيرفر 4WhatsApp",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (config && !initialLoaded) {
      const effectiveInitial = config.draft_config
        ? normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...config, ...config.draft_config })
        : normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...config });
      setFormState(effectiveInitial);
      setInitialLoaded(true);
    }
  }, [config, initialLoaded]);

  // 2. Fetch Online Bookings
  const { data: bookings = [] } = useQuery<any[]>({
    queryKey: ["admin-website-bookings"],
    queryFn: () => fetchWithAuth("/api/admin/website/bookings")
  });

  // 3. Fetch Inquiries
  const { data: inquiries = [] } = useQuery<any[]>({
    queryKey: ["admin-website-inquiries"],
    queryFn: () => fetchWithAuth("/api/admin/website/inquiries")
  });

  // 3.5 Fetch Safes for cash receipt selection during approval
  const { data: safesList = [] } = useQuery<any[]>({
    queryKey: ["admin-safes-list"],
    queryFn: () => fetchWithAuth<any[]>("/api/safes").catch((): any[] => [])
  });

  const openBookingReviewModal = (b: any) => {
    setReviewBooking(b);
    setReviewPaymentMethod(b.payment_method || "cash");
    setReviewPaymentStatus(
      b.payment_status === "paid" || b.payment_method === "credit_card" ? "paid" : "pending"
    );
    setReviewFinalAmount(String(b.total_amount ?? 0));
    setReviewNotes(b.notes || "");
    setReviewForceWaNow(false);
    if (safesList.length > 0 && !reviewSafeId) {
      setReviewSafeId(String(safesList[0].id));
    }
  };

  useEffect(() => {
    const applyFromSearch = (qs: string) => {
      const sp = new URLSearchParams(qs);
      const tab = sp.get("tab");
      const bId = sp.get("bookingId");
      const iId = sp.get("inquiryId");
      if (tab) setActiveTab(tab);
      if (bId) setFocusedBookingId(Number(bId));
      if (iId) setFocusedInquiryId(Number(iId));
    };
    const qs = searchStr || (typeof window !== "undefined" ? window.location.search : "");
    if (qs) applyFromSearch(qs);

    const onNotifNav = (e: Event) => {
      const href = (e as CustomEvent)?.detail?.href || "";
      const qIdx = href.indexOf("?");
      if (qIdx >= 0) applyFromSearch(href.slice(qIdx));
    };
    if (typeof window !== "undefined") {
      window.addEventListener("omnifly:notification-navigate", onNotifNav);
      return () => window.removeEventListener("omnifly:notification-navigate", onNotifNav);
    }
  }, [searchStr]);

  useEffect(() => {
    if (focusedBookingId && bookings.length > 0) {
      const match = bookings.find((b) => Number(b.id) === focusedBookingId);
      if (match && match.booking_status === "pending_approval") {
        openBookingReviewModal(match);
      }
    }
  }, [focusedBookingId, bookings]);

  // 4. Fetch Custom Services & Rides
  const { data: customServices = [] } = useQuery<any[]>({
    queryKey: ["admin-website-services"],
    queryFn: () => fetchWithAuth("/api/admin/website/services")
  });

  // 5. Fetch Promotions
  const { data: promotions = [] } = useQuery<WebsitePromotion[]>({
    queryKey: ["admin-website-promotions"],
    queryFn: () => fetchWithAuth("/api/admin/website/promotions")
  });

  // 6. Fetch Theme History & Audit Trail
  const { data: historyData } = useQuery<{ history: any[]; audits: any[] }>({
    queryKey: ["admin-website-history"],
    queryFn: () => fetchWithAuth("/api/admin/website/history")
  });

  const invalidateAllWebsiteQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-website-config"] });
    queryClient.invalidateQueries({ queryKey: ["admin-website-history"] });
    queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
    queryClient.invalidateQueries({ queryKey: ["public-website-catalog"] });
  };

  // Save Draft Mutation (never overwrites live site until Publish!)
  const saveDraftMutation = useMutation({
    mutationFn: (payload: WebsiteThemeConfig) =>
      fetchWithAuth("/api/admin/website/draft", {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      invalidateAllWebsiteQueries();
      toast({
        title: "تم حفظ المسودة بنجاح",
        description: "التعديلات محفوظة في المسودة ولن تظهر للزوار حتى تضغط «نشر التغييرات»."
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل حفظ المسودة", description: err.message, variant: "destructive" });
    }
  });

  // Publish Live Mutation
  const publishMutation = useMutation({
    mutationFn: (payload: WebsiteThemeConfig) =>
      fetchWithAuth("/api/admin/website/publish", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: (res: any) => {
      if (res?.settings) {
        setFormState(normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...res.settings }));
      }
      invalidateAllWebsiteQueries();
      toast({
        title: "تم نشر التغييرات وتطبيق الهوية البصرية",
        description: "أصبح التصميم والإعدادات الجديدة مفعلة الآن لعملاء المؤسسة."
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل نشر التغييرات", description: err.message, variant: "destructive" });
    }
  });

  // Discard Draft / Unsaved Changes
  const discardDraftMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth("/api/admin/website/discard-draft", {
        method: "POST"
      }),
    onSuccess: (res: any) => {
      if (res?.settings) {
        setFormState(normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...res.settings }));
      } else if (config) {
        setFormState(normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...config }));
      }
      invalidateAllWebsiteQueries();
      toast({
        title: "تم إلغاء التعديلات غير المنشورة",
        description: "تمت إعادة المحرر إلى آخر نسخة منشورة ومعتمدة."
      });
    },
    onError: (err: any) => {
      toast({ title: "تعذر الإلغاء", description: err.message, variant: "destructive" });
    }
  });

  // Reset to Default Theme
  const resetDefaultMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth("/api/admin/website/reset-default", {
        method: "POST"
      }),
    onSuccess: (res: any) => {
      if (res?.settings) {
        setFormState(normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...res.settings }));
      }
      setConfirmResetOpen(false);
      invalidateAllWebsiteQueries();
      toast({
        title: "تمت استعادة التصميم الافتراضي",
        description: "تم حفظ نسخة احتياطية في سجل التغييرات وتطبيق التصميم الافتراضي."
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل الاستعادة", description: err.message, variant: "destructive" });
    }
  });

  // Restore Snapshot from History
  const restoreSnapshotMutation = useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: "publish" | "draft" }) =>
      fetchWithAuth(`/api/admin/website/restore/${id}`, {
        method: "POST",
        body: JSON.stringify({ mode })
      }),
    onSuccess: (res: any, vars) => {
      if (vars.mode === "draft" && res?.draft_config) {
        setFormState(normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...config, ...res.draft_config }));
      } else if (res?.settings) {
        setFormState(normalizeWebsiteConfig({ ...DEFAULT_WEBSITE_THEME, ...res.settings }));
      }
      invalidateAllWebsiteQueries();
      toast({
        title: vars.mode === "draft" ? "تم تحميل النسخة إلى المسودة" : "تمت استعادة ونشر النسخة بنجاح"
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل الاسترجاع", description: err.message, variant: "destructive" });
    }
  });

  // Legacy Netlify sync button support
  const syncNetlifyMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth("/api/admin/website/sync-netlify", {
        method: "POST"
      }),
    onSuccess: (data: any) => {
      toast({ title: "تم تحديث ملفات الموقع", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "تنبيه التزامن", description: err.message, variant: "destructive" });
    }
  });

  // Asset Upload Helper
  const handleUploadAsset = async (file: File, assetType: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const res: any = await fetchWithAuth("/api/admin/website/upload-asset", {
            method: "POST",
            body: JSON.stringify({ base64Data, fileName: file.name, assetType })
          });
          if (res?.url) {
            toast({ title: "تم رفع الصورة بنجاح", description: "تم حفظ الملف داخل مساحة المؤسسة." });
            resolve(res.url);
            return;
          }
          resolve(null);
        } catch (err: any) {
          toast({ title: "فشل رفع الصورة", description: err.message, variant: "destructive" });
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Update Booking Status Mutation
  const updateBookingStatusMutation = useMutation({
    mutationFn: ({ id, booking_status, payment_status }: any) =>
      fetchWithAuth(`/api/admin/website/bookings/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ booking_status, payment_status })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      toast({ title: "تم التحديث", description: "تم تغيير حالة الحجز" });
    }
  });

  // Approve Website Booking -> Save Customer + COA + Invoice + Journal + WhatsApp Scheduler
  const approveBookingMutation = useMutation({
    mutationFn: (payload: {
      id: number;
      payment_status: string;
      payment_method: string;
      safe_id?: number;
      final_amount: number;
      notes: string;
      force_whatsapp_immediate: boolean;
    }) =>
      fetchWithAuth<any>(`/api/admin/website/bookings/${payload.id}/approve`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-safes-list"] });
      setReviewBooking(null);
      setFocusedBookingId(null);
      toast({
        title: "تم اعتماد المعاملة والترحيل المحاسبي بنجاح",
        description: res?.message || "تم حفظ العميل والفاتورة في دليل الحسابات وتطبيق ضبط تنبيهات واتساب"
      });
    },
    onError: (err: any) => {
      toast({ title: "تعذر اعتماد الحجز", description: err.message, variant: "destructive" });
    }
  });

  // Reject Website Booking
  const rejectBookingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      fetchWithAuth(`/api/admin/website/bookings/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      setRejectTargetBooking(null);
      setRejectReason("");
      setReviewBooking(null);
      setFocusedBookingId(null);
      toast({ title: "تم رفض طلب الحجز" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر رفض الحجز", description: err.message, variant: "destructive" });
    }
  });

  // Approve Website Inquiry (+ optional save customer in COA)
  const approveInquiryMutation = useMutation({
    mutationFn: ({ id, save_customer }: { id: number; save_customer?: boolean }) =>
      fetchWithAuth<any>(`/api/admin/website/inquiries/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ status: "reviewed", save_customer: Boolean(save_customer) })
      }),
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      if (vars.save_customer) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      }
      setFocusedInquiryId(null);
      toast({
        title: vars.save_customer ? "تم اعتماد الاستفسار وحفظ العميل في دليل الحسابات" : "تم اعتماد ومراجعة الاستفسار",
        description: res?.customerAccountCode ? `حساب العميل: ${res.customerAccountCode}` : undefined
      });
    },
    onError: (err: any) => {
      toast({ title: "تعذر تحديث الاستفسار", description: err.message, variant: "destructive" });
    }
  });

  // Services CRUD
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState("all");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({
    category: "rides",
    title: "",
    subtitle: "",
    price: 150,
    badge: "الأكثر طلباً",
    car_type: "سيدان حديثة (كامري / سوناتا)",
    duration: "45 دقيقة",
    features: "استقبال باللوحة • متوفر 24/7 • واي فاي مجاني",
    origin: "مطار الملك خالد الدولي",
    destination: "جميع أحياء الرياض",
    is_active: 1,
    sort_order: 0
  });

  const saveServiceMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingService?.id) {
        return fetchWithAuth(`/api/admin/website/services/${editingService.id}`, {
          method: "PUT",
          body: JSON.stringify(data)
        });
      }
      return fetchWithAuth("/api/admin/website/services", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-services"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-catalog"] });
      setServiceModalOpen(false);
      setEditingService(null);
      toast({ title: "تم حفظ الخدمة بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: number) =>
      fetchWithAuth(`/api/admin/website/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-services"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-catalog"] });
      setPendingDeleteServiceId(null);
      toast({ title: "تم حذف الخدمة" });
    }
  });

  const toggleServiceActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: number }) =>
      fetchWithAuth(`/api/admin/website/services/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-services"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-catalog"] });
      toast({ title: "تم تحديث حالة الخدمة" });
    }
  });

  // Promotions CRUD handlers
  const handleCreatePromotion = async (promo: WebsitePromotion) => {
    await fetchWithAuth("/api/admin/website/promotions", {
      method: "POST",
      body: JSON.stringify(promo)
    });
    queryClient.invalidateQueries({ queryKey: ["admin-website-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
    toast({ title: "تمت إضافة البنر الإعلاني بنجاح" });
  };

  const handleUpdatePromotion = async (id: number, promo: Partial<WebsitePromotion>) => {
    await fetchWithAuth(`/api/admin/website/promotions/${id}`, {
      method: "PUT",
      body: JSON.stringify(promo)
    });
    queryClient.invalidateQueries({ queryKey: ["admin-website-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
    toast({ title: "تم تحديث حالة البنر الإعلاني" });
  };

  const handleDeletePromotion = async (id: number) => {
    await fetchWithAuth(`/api/admin/website/promotions/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["admin-website-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
    toast({ title: "تم حذف البنر الإعلاني" });
  };

  const tenantCode = config?.tenant_code || "";
  const tenantId = config?.tenant_id;
  const publicPortalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal${tenantCode ? `?tenant=${encodeURIComponent(tenantCode)}` : ""}`
      : "/portal";
  const previewPortalHref = `/portal?preview=1${tenantCode ? `&tenant=${encodeURIComponent(tenantCode)}` : ""}`;

  const handleCopyPortalLink = () => {
    navigator.clipboard.writeText(publicPortalUrl);
    setCopiedLink(true);
    toast({ title: "تم نسخ رابط الموقع الخاص بالمؤسسة", description: publicPortalUrl });
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleOpenAddService = () => {
    setEditingService(null);
    setServiceForm({
      category: "rides",
      title: "",
      subtitle: "",
      price: 150,
      badge: "الأكثر طلباً",
      car_type: "سيدان حديثة (كامري / سوناتا)",
      duration: "45 دقيقة",
      features: "استقبال باللوحة • متوفر 24/7 • واي فاي مجاني",
      origin: "مطار الملك خالد الدولي",
      destination: "جميع أحياء الرياض",
      is_active: 1,
      sort_order: 0
    });
    setServiceModalOpen(true);
  };

  const handleOpenEditService = (service: any) => {
    setEditingService(service);
    setServiceForm({
      category: service.category || "rides",
      title: service.title || "",
      subtitle: service.subtitle || "",
      price: Number(service.price) || 0,
      badge: service.badge || "",
      car_type: service.car_type || "",
      duration: service.duration || "",
      features: service.features || "",
      origin: service.origin || "",
      destination: service.destination || "",
      is_active: service.is_active ?? 1,
      sort_order: service.sort_order ?? 0
    });
    setServiceModalOpen(true);
  };

  const handleSaveContentForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState) return;
    publishMutation.mutate(formState);
  };

  const totalBookingsCount = bookings.length;
  const confirmedCount = bookings.filter((b) => b.booking_status === "confirmed").length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const newInquiriesCount = inquiries.filter((i) => i.status === "new").length;

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Top Management Studio Header & Draft/Publish Action Bar */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <NjazLogo size="md" showText={false} />
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                    إدارة الموقع والهوية البصرية
                  </h1>
                  {tenantCode && (
                    <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-xs font-mono">
                      المؤسسة: {tenantCode}
                    </Badge>
                  )}
                  {config?.has_unpublished_changes && (
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs">
                      توجد مسودة غير منشورة
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  تحكم كامل في الألوان (12 لوناً)، الشعارات، أنماط التصميم، ترتيب الأقسام، الحجوزات، والأسعار لكل مؤسسة بشكل مستقل
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleCopyPortalLink}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold gap-1.5 border-slate-300 h-9"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "تم النسخ" : "نسخ رابط المؤسسة"}</span>
              </Button>

              <a href={previewPortalHref} target="_blank" rel="noreferrer">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 h-9"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>معاينة الموقع</span>
                </Button>
              </a>
            </div>
          </div>

          {/* Workflow Controls Row */}
          {formState && (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={saveDraftMutation.isPending}
                  onClick={() => saveDraftMutation.mutate(formState)}
                  variant="outline"
                  className="rounded-xl text-xs font-bold gap-1.5 border-slate-300 h-10 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  <span>{saveDraftMutation.isPending ? "جارٍ الحفظ..." : "حفظ كمسودة"}</span>
                </Button>

                <Button
                  type="button"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate(formState)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold gap-1.5 h-10 px-5 shadow-xs cursor-pointer"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{publishMutation.isPending ? "جارٍ النشر..." : "نشر التغييرات"}</span>
                </Button>

                <Button
                  type="button"
                  disabled={discardDraftMutation.isPending}
                  onClick={() => discardDraftMutation.mutate()}
                  variant="ghost"
                  className="rounded-xl text-xs font-bold gap-1.5 text-slate-600 hover:bg-slate-100 h-10 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>إلغاء التعديلات غير المحفوظة</span>
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmResetOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50 h-10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة التصميم الافتراضي</span>
              </Button>
            </div>
          )}
        </div>

        {/* Confirm Reset Modal */}
        {confirmResetOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <h3 className="text-base font-black text-slate-900">تأكيد استعادة التصميم الافتراضي</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                سيتم حفظ نسخة احتياطية من التصميم الحالي في «سجل التغييرات» قبل استعادة الألوان والخطوط والأنماط الافتراضية للمؤسسة. هل تريد المتابعة؟
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setConfirmResetOpen(false)} className="text-xs h-9">
                  تراجع
                </Button>
                <Button
                  type="button"
                  disabled={resetDefaultMutation.isPending}
                  onClick={() => resetDefaultMutation.mutate()}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-9"
                >
                  {resetDefaultMutation.isPending ? "جارٍ الاستعادة..." : "تأكيد الاستعادة"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">إجمالي الحجوزات الإلكترونية</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{totalBookingsCount}</span>
                <span className="text-[11px] text-emerald-600 font-bold mt-0.5 block">{confirmedCount} حجز مؤكد</span>
              </div>
              <div className="p-3 bg-sky-50 rounded-2xl text-sky-600">
                <Ticket className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">مبيعات الموقع الإلكتروني</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">{fmt(totalRevenue)} ر.س</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">مباشرة لخزينة المؤسسة</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <CreditCard className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">استفسارات الزوار</span>
                <span className="text-2xl font-black text-indigo-600 mt-1 block">{newInquiriesCount}</span>
                <span className="text-[11px] text-indigo-500 font-medium mt-0.5 block">إجمالي {inquiries.length} طلب</span>
              </div>
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                <MessageSquare className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-xs text-slate-500 font-medium block">رابط البوابة المخصص</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block font-mono truncate">
                  {tenantCode ? `/site/${tenantCode}` : "/portal"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cleanUrl =
                      typeof window !== "undefined"
                        ? `${window.location.origin}${tenantCode ? `/site/${tenantCode}` : "/portal"}`
                        : tenantCode
                        ? `/site/${tenantCode}`
                        : "/portal";
                    navigator.clipboard.writeText(cleanUrl);
                    toast({ title: "تم نسخ الرابط العام للبوابة", description: cleanUrl });
                  }}
                  className="text-[11px] text-sky-600 hover:underline font-bold mt-0.5 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>نسخ رابط المشاركة العام</span>
                </button>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Studio Tabs */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap lg:grid lg:grid-cols-9 h-auto p-1.5 bg-slate-100 rounded-2xl gap-1 mb-6">
              <TabsTrigger value="visual-identity" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Palette className="w-4 h-4" />
                <span>الألوان والهوية</span>
              </TabsTrigger>
              <TabsTrigger value="sections" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Layers className="w-4 h-4" />
                <span>الأقسام والإعلانات</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Globe className="w-4 h-4" />
                <span>النصوص والاتصال</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <LayoutDashboard className="w-4 h-4" />
                <span>الخدمات والعروض</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Percent className="w-4 h-4" />
                <span>التسعير والدفع</span>
              </TabsTrigger>
              <TabsTrigger value="esaalat" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <CreditCard className="w-4 h-4" />
                <span>الدفع الإلكتروني ← Esaalat</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Ticket className="w-4 h-4" />
                <span>الحجوزات ({bookings.length})</span>
              </TabsTrigger>
              <TabsTrigger value="inquiries" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <MessageSquare className="w-4 h-4" />
                <span>الاستفسارات ({inquiries.length})</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <History className="w-4 h-4" />
                <span>سجل التغييرات</span>
              </TabsTrigger>
            </TabsList>



            {/* ─── TAB 1: VISUAL IDENTITY & LIVE PREVIEW STUDIO ─── */}
            <TabsContent value="visual-identity" className="mt-0">
              {formState && (
                <VisualIdentityEditor
                  formState={formState}
                  setFormState={setFormState}
                  tenantCode={tenantCode}
                  tenantId={tenantId}
                  onUploadAsset={handleUploadAsset}
                />
              )}
            </TabsContent>

            {/* ─── TAB 2: SECTIONS, HERO SLIDES, FEATURES & PROMO BANNERS ─── */}
            <TabsContent value="sections" className="mt-0">
              {formState && (
                <SectionsCustomizer
                  formState={formState}
                  setFormState={setFormState}
                  promotions={promotions}
                  onUploadAsset={handleUploadAsset}
                  onCreatePromotion={handleCreatePromotion}
                  onUpdatePromotion={handleUpdatePromotion}
                  onDeletePromotion={handleDeletePromotion}
                />
              )}
            </TabsContent>

            {/* ─── TAB 3: CONTENT, CONTACT & BRANDING ─── */}
            <TabsContent value="content" className="space-y-6 mt-0">
              <form onSubmit={handleSaveContentForm} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">بيانات المؤسسة والاتصال ومحتوى الواجهة</h3>
                  <p className="text-xs text-slate-500">تخصيص الاسم والهواتف والنصوص الرئيسية وتذييل الموقع</p>
                </div>

                {formState && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">اسم الوكالة / الموقع *</label>
                      <Input
                        value={formState.site_name || ""}
                        onChange={(e) => setFormState({ ...formState, site_name: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">العنوان الفرعي أسفل الشعار</label>
                      <Input
                        value={formState.nav_subtitle || ""}
                        onChange={(e) => setFormState({ ...formState, nav_subtitle: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">إعلان الشريط العلوي</label>
                      <Input
                        value={formState.topbar_announcement || ""}
                        onChange={(e) => setFormState({ ...formState, topbar_announcement: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">شارة الأمان في الشريط العلوي</label>
                      <Input
                        value={formState.announcement_badge_1 || ""}
                        onChange={(e) => setFormState({ ...formState, announcement_badge_1: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">اسم مستشار / خدمة العملاء</label>
                      <Input
                        value={formState.customer_service_name || ""}
                        onChange={(e) => setFormState({ ...formState, customer_service_name: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">الشعار اللفظي (Slogan)</label>
                      <Input
                        value={formState.site_slogan || ""}
                        onChange={(e) => setFormState({ ...formState, site_slogan: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">رقم الهاتف الرسمي</label>
                      <Input
                        value={formState.phone || ""}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">رقم الهاتف الثانوي</label>
                      <Input
                        value={formState.secondary_phone || ""}
                        onChange={(e) => setFormState({ ...formState, secondary_phone: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">رقم الواتساب للعملاء</label>
                      <Input
                        value={formState.whatsapp || ""}
                        onChange={(e) => setFormState({ ...formState, whatsapp: e.target.value })}
                        className="rounded-xl h-10 text-xs font-mono"
                        placeholder="9665XXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">رقم واتساب الفريق لاستلام إشعارات وطلبات الموقع (4WhatsApp)</label>
                      <Input
                        value={formState.team_notification_phone || ""}
                        onChange={(e) => setFormState({ ...formState, team_notification_phone: e.target.value })}
                        placeholder="9665XXXXXXXX (يستلم إشعار فوري عند كل حجز أو طلب)"
                        className="rounded-xl h-10 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        يُرسل النظام إشعاراً فورياً عبر 4WhatsApp إلى هذا الرقم فور تقديم أي طلب أو حجز من العملاء بالموقع.
                      </span>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">البريد الإلكتروني</label>
                      <Input
                        value={formState.email || ""}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">العنوان الرئيسي 1 (Hero Line 1)</label>
                      <Input
                        value={formState.hero_title_2 || ""}
                        onChange={(e) => setFormState({ ...formState, hero_title_2: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">العنوان المميز (Hero Highlight)</label>
                      <Input
                        value={formState.hero_title_3 || ""}
                        onChange={(e) => setFormState({ ...formState, hero_title_3: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">الوصف التعريفي للبنر الرئيسي</label>
                      <Textarea
                        rows={2}
                        value={formState.hero_subtitle || ""}
                        onChange={(e) => setFormState({ ...formState, hero_subtitle: e.target.value })}
                        className="rounded-xl text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">وصف المؤسسة في التذييل</label>
                      <Textarea
                        rows={2}
                        value={formState.footer_desc || ""}
                        onChange={(e) => setFormState({ ...formState, footer_desc: e.target.value })}
                        className="rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">النطاق الفرعي المخصص (Subdomain)</label>
                      <Input
                        value={formState.subdomain || ""}
                        onChange={(e) => setFormState({ ...formState, subdomain: e.target.value })}
                        placeholder="مثال: my-agency"
                        className="rounded-xl h-10 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">النطاق الخاص بالمؤسسة (Custom Domain)</label>
                      <Input
                        value={formState.custom_domain || ""}
                        onChange={(e) => setFormState({ ...formState, custom_domain: e.target.value })}
                        placeholder="مثال: booking.agency-travel.com"
                        className="rounded-xl h-10 text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">نص حقوق النشر (Copyright)</label>
                      <Input
                        value={formState.footer_copyright || ""}
                        onChange={(e) => setFormState({ ...formState, footer_copyright: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>

                    {/* Customer Registration, 4WhatsApp OTP Control & Live Server Verification */}
                    <div className="sm:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div>
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-emerald-600" />
                            <span>إعدادات فتح حساب العميل والتحقق عبر 4WhatsApp</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            تحكم كامل في إرسال أرقام التحقق عبر سيرفر 4WhatsApp، وفحص السيرفر للتأكد من قدرته على الإرسال، والتحكم في رفع وثائق الهوية.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {fourWaStatus?.config?.is_connected ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-bold gap-1 px-2.5 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>4WhatsApp متصل</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[11px] font-bold gap-1 px-2.5 py-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>4WhatsApp غير متصل</span>
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* 4WhatsApp Live Server Verification & Test OTP Box */}
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-blue-600" />
                            <div>
                              <div className="text-xs font-extrabold text-slate-900">
                                التحقق المباشر من سيرفر 4WhatsApp وإرسال أرقام التحقق
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {fourWaStatus?.config?.phone_number
                                  ? `الرقم المربوط: ${fourWaStatus.config.display_phone_number || fourWaStatus.config.phone_number} • رسائل اليوم: ${fourWaStatus.config.daily_sent_count || 0}`
                                  : "لم يتم ربط رقم 4WhatsApp بعد — اضبط الربط من مركز تنبيهات الواتساب"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={liveServerChecking}
                              onClick={handleVerify4WhatsAppServer}
                              className="h-8 text-[11px] font-bold rounded-lg gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${liveServerChecking ? "animate-spin" : ""}`} />
                              <span>{liveServerChecking ? "جارٍ فحص السيرفر..." : "فحص سيرفر 4WhatsApp"}</span>
                            </Button>
                            <a href="/travel-notifications-hub" className="text-[11px] font-bold text-slate-600 hover:text-blue-600 underline">
                              إعدادات الربط
                            </a>
                          </div>
                        </div>

                        {liveCheckResult?.live_check && (
                          <div className={`p-2.5 rounded-lg text-[11px] font-bold border ${
                            liveCheckResult.live_check.verified && liveCheckResult.live_check.linked
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-rose-50 border-rose-200 text-rose-800"
                          }`}>
                            {liveCheckResult.live_check.verified && liveCheckResult.live_check.linked
                              ? `✓ السيرفر متصل ومصادق عليه وجاهز لإرسال أكواد التحقق للعملاء${liveCheckResult.live_check.days_remaining ? ` (الصلاحية المتبقية: ${liveCheckResult.live_check.days_remaining} يوم)` : ""}.`
                              : `✕ تنبيه من السيرفر: ${liveCheckResult.live_check.error || "جلسة 4WhatsApp غير مرتبطة حالياً"}`}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                          <Input
                            value={testOtpPhone}
                            onChange={(e) => setTestOtpPhone(e.target.value)}
                            placeholder="أدخل رقم جوال لاختبار إرسال كود التحقق (مثال: 9665XXXXXXXX)"
                            className="h-9 text-xs font-mono dir-ltr text-left flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={test4WhatsAppOtpMutation.isPending || !testOtpPhone.trim()}
                            onClick={() => test4WhatsAppOtpMutation.mutate(testOtpPhone.trim())}
                            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg gap-1.5 shrink-0 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {test4WhatsAppOtpMutation.isPending
                                ? "جارٍ إرسال كود اختبار..."
                                : "اختبار إرسال رقم تحقق عبر 4WhatsApp"}
                            </span>
                          </Button>
                        </div>

                        {testOtpResult && (
                          <div className={`p-2.5 rounded-lg text-[11px] font-bold border ${
                            testOtpResult.success
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-rose-50 border-rose-200 text-rose-800"
                          }`}>
                            {testOtpResult.message}
                          </div>
                        )}
                      </div>

                      {/* OTP Requirement Toggles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">إرسال رقم تحقق عبر 4WhatsApp للعملاء</span>
                            <span className="text-[10px] text-slate-500">
                              عند الإيقاف: يفتح العميل حسابه مباشرة بدون طلب أو إرسال كود تحقق
                            </span>
                          </div>
                          <Switch
                            checked={(formState.enable_whatsapp_otp ?? 1) !== 0}
                            onCheckedChange={(checked) => {
                              const nextEnable = checked ? 1 : 0;
                              setFormState({
                                ...formState,
                                enable_whatsapp_otp: nextEnable,
                                require_whatsapp_otp: nextEnable === 0 ? 0 : formState.require_whatsapp_otp
                              });
                            }}
                          />
                        </label>

                        <label
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                            (formState.enable_whatsapp_otp ?? 1) === 0
                              ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                              : "bg-white border-slate-200 cursor-pointer"
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">إلزام العميل بتأكيد ملكية الرقم بكود 4WhatsApp</span>
                            <span className="text-[10px] text-slate-500">
                              عند التفعيل: لا يفتح الحساب إلا بعد إدخال الكود؛ وعند الإيقاف: التحقق اختياري ولا يعطل التسجيل
                            </span>
                          </div>
                          <Switch
                            disabled={(formState.enable_whatsapp_otp ?? 1) === 0}
                            checked={(formState.enable_whatsapp_otp ?? 1) !== 0 && (formState.require_whatsapp_otp ?? 1) === 1}
                            onCheckedChange={(checked) =>
                              setFormState({
                                ...formState,
                                require_whatsapp_otp: checked ? 1 : 0
                              })
                            }
                          />
                        </label>
                      </div>

                      {(formState.enable_whatsapp_otp ?? 1) !== 0 &&
                        (formState.require_whatsapp_otp ?? 1) === 1 &&
                        !fourWaStatus?.config?.is_connected && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              تنبيه: تم تفعيل الإلزام بكود الواتساب بينما سيرفر 4WhatsApp غير مرتبط حالياً بالباركود. لن يتمكن العملاء من استلام رمز التحقق المكون من 4 أرقام حتى يتم ربط رقم 4WhatsApp من بوابة واتساب، أو يمكنك إيقاف الإلزام ليفتح العميل حسابه مباشرة.
                            </span>
                          </div>
                        )}

                      {/* ID / Passport Upload Toggles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-200/70">
                        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">إظهار حقل رفع صورة الجواز / البطاقة</span>
                            <span className="text-[10px] text-slate-500">عرض أو إخفاء خانة رفع الوثيقة في شاشة إنشاء الحساب</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formState.show_id_upload !== 0}
                            onChange={(e) => {
                              const nextShow = e.target.checked ? 1 : 0;
                              setFormState({
                                ...formState,
                                show_id_upload: nextShow,
                                require_id_upload: nextShow === 0 ? 0 : formState.require_id_upload
                              });
                            }}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </label>

                        <label
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                            formState.show_id_upload === 0
                              ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                              : "bg-white border-slate-200 cursor-pointer"
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">إلزام العميل برفع صورة الجواز / البطاقة</span>
                            <span className="text-[10px] text-slate-500">لا يكتمل فتح الحساب إلا بعد رفع صورة الهوية أو الجواز</span>
                          </div>
                          <input
                            type="checkbox"
                            disabled={formState.show_id_upload === 0}
                            checked={formState.show_id_upload !== 0 && formState.require_id_upload === 1}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                require_id_upload: e.target.checked ? 1 : 0
                              })
                            }
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer disabled:cursor-not-allowed"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={syncNetlifyMutation.isPending}
                    onClick={() => syncNetlifyMutation.mutate()}
                    className="rounded-xl text-xs font-bold gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تصدير بيانات الموقع</span>
                  </Button>

                  <Button
                    type="submit"
                    disabled={publishMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-2 px-6"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>حفظ ونشر النصوص والهوية</span>
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ─── TAB 4: SERVICES VISIBILITY & CUSTOM RIDES/SERVICES CRUD ─── */}
            <TabsContent value="services" className="space-y-8 mt-0">
              <form onSubmit={handleSaveContentForm} className="space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">أقسام الخدمات الرئيسية بالموقع</h3>
                    <p className="text-xs text-slate-500">تفعيل أو إيقاف أقسام الحجز التي تظهر في المنصة</p>
                  </div>
                  <Button type="submit" disabled={publishMutation.isPending} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5">
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ ونشر حالة الأقسام</span>
                  </Button>
                </div>

                {formState && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { key: "rides_enabled", label: "المشاوير والنقل VIP", sub: "توصيل المطارات والحرمين", icon: Car },
                      { key: "flight_enabled", label: "تذاكر الطيران", sub: "محرك بحث الرحلات", icon: Plane },
                      { key: "hotel_enabled", label: "الفنادق والمنتجعات", sub: "دليل الفنادق", icon: Building2 },
                      { key: "packages_enabled", label: "الباقات والعمرة", sub: "البرامج السياحية", icon: Compass },
                      { key: "visas_enabled", label: "التأشيرات", sub: "معاملات التأشيرات", icon: FileText },
                      { key: "bus_enabled", label: "تذاكر الباصات", sub: "النقل البري", icon: Bus },
                      { key: "insurance_enabled", label: "التأمين الصحي", sub: "وثائق تأمين السفر", icon: ShieldCheck }
                    ].map((srv) => {
                      const Icon = srv.icon;
                      const checked = (formState as any)[srv.key] !== 0;
                      return (
                        <Card key={srv.key} className="rounded-xl border-slate-200 bg-white">
                          <CardContent className="p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 text-xs block">{srv.label}</span>
                                <span className="text-[10px] text-slate-400">{srv.sub}</span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setFormState({ ...formState, [srv.key]: e.target.checked ? 1 : 0 })
                              }
                              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </form>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-black text-slate-900">إدارة المشاوير والخدمات المخصصة ({customServices.length})</h3>
                    <p className="text-xs text-slate-500 mt-0.5">إضافة وتعديل وحذف كل مشوار أو باقة أو تأشيرة مخصصة</p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleOpenAddService}
                    className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة خدمة / مشوار</span>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "rides", label: "المشاوير" },
                    { id: "packages", label: "الباقات" },
                    { id: "visas", label: "التأشيرات" },
                    { id: "general", label: "عامة" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setServiceCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                        serviceCategoryFilter === cat.id
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customServices
                    .filter((s) => serviceCategoryFilter === "all" || s.category === serviceCategoryFilter)
                    .map((service) => (
                      <Card key={service.id} className="rounded-2xl border-slate-200">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-black text-slate-900 text-xs sm:text-sm">{service.title}</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">{service.subtitle}</p>
                            </div>
                            <span className="font-black text-emerald-600 text-sm shrink-0">
                              {fmt(service.price)} ر.س
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toggleServiceActiveMutation.mutate({
                                  id: service.id,
                                  is_active: service.is_active === 1 ? 0 : 1
                                })
                              }
                              className="h-8 text-xs rounded-xl gap-1"
                            >
                              {service.is_active === 1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              <span>{service.is_active === 1 ? "إخفاء" : "إظهار"}</span>
                            </Button>

                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditService(service)}
                                className="h-8 text-xs rounded-xl px-2.5 gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </Button>

                              {pendingDeleteServiceId === service.id ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => deleteServiceMutation.mutate(service.id)}
                                  className="h-8 text-xs rounded-xl px-2.5 bg-rose-600 text-white"
                                >
                                  تأكيد الحذف
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPendingDeleteServiceId(service.id)}
                                  className="h-8 text-xs rounded-xl px-2 text-rose-600 border-rose-200"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              {serviceModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <h3 className="text-base font-black text-slate-900">
                        {editingService ? "تعديل الخدمة" : "إضافة خدمة جديدة"}
                      </h3>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setServiceModalOpen(false)}>
                        ✕
                      </Button>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveServiceMutation.mutate(serviceForm);
                      }}
                      className="space-y-3 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          value={serviceForm.category}
                          onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                          className="h-10 border border-slate-300 rounded-xl px-3 font-bold"
                        >
                          <option value="rides">مشاوير ونقل VIP</option>
                          <option value="packages">باقات سياحية وعمرة</option>
                          <option value="visas">تأشيرات</option>
                          <option value="general">عروض عامة</option>
                        </select>
                        <Input
                          type="number"
                          required
                          value={serviceForm.price}
                          onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                          placeholder="السعر"
                          className="h-10"
                        />
                        <Input
                          required
                          value={serviceForm.title}
                          onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                          placeholder="عنوان الخدمة / المشوار *"
                          className="h-10 sm:col-span-2"
                        />
                        <Input
                          value={serviceForm.subtitle}
                          onChange={(e) => setServiceForm({ ...serviceForm, subtitle: e.target.value })}
                          placeholder="الوصف الفرعي"
                          className="h-10"
                        />
                        <Input
                          value={serviceForm.car_type}
                          onChange={(e) => setServiceForm({ ...serviceForm, car_type: e.target.value })}
                          placeholder="نوع المركبة"
                          className="h-10"
                        />
                        <Input
                          value={serviceForm.duration}
                          onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                          placeholder="المدة التقديرية"
                          className="h-10"
                        />
                        <Input
                          value={serviceForm.features}
                          onChange={(e) => setServiceForm({ ...serviceForm, features: e.target.value })}
                          placeholder="المزايا"
                          className="h-10"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button type="button" variant="outline" onClick={() => setServiceModalOpen(false)}>
                          إلغاء
                        </Button>
                        <Button type="submit" disabled={saveServiceMutation.isPending} className="bg-orange-500 text-white">
                          حفظ الخدمة
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 5: PRICING, MARKUPS & BANKING ─── */}
            <TabsContent value="pricing" className="space-y-6 mt-0">
              <form onSubmit={handleSaveContentForm} className="space-y-6">
                {formState && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <label className="font-bold text-slate-800 block mb-1">هامش ربح الطيران (%)</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formState.flight_markup_val ?? 5}
                          onChange={(e) =>
                            setFormState({ ...formState, flight_markup_val: Number(e.target.value) })
                          }
                          className="h-10 bg-white"
                        />
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <label className="font-bold text-slate-800 block mb-1">هامش ربح الفنادق (%)</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formState.hotel_markup_val ?? 8}
                          onChange={(e) =>
                            setFormState({ ...formState, hotel_markup_val: Number(e.target.value) })
                          }
                          className="h-10 bg-white"
                        />
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <label className="font-bold text-slate-800 block mb-1">كود الخصم الترويجي</label>
                        <div className="flex gap-2">
                          <Input
                            value={formState.promo_code || ""}
                            onChange={(e) => setFormState({ ...formState, promo_code: e.target.value })}
                            className="h-10 bg-white font-mono uppercase"
                          />
                          <Input
                            type="number"
                            value={formState.promo_discount_percent ?? 10}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                promo_discount_percent: Number(e.target.value)
                              })
                            }
                            className="h-10 bg-white w-24"
                          />
                        </div>
                      </div>
                    </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <span className="font-bold text-slate-900 text-xs block">التحكم في طرق السداد الظاهرة في صفحة الحجز</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
                            <span className="font-bold text-slate-800 text-xs">بطاقة بنكية / صراف</span>
                            <Switch
                              checked={(formState.payment_card_enabled ?? 1) !== 0}
                              onCheckedChange={(checked) => setFormState({ ...formState, payment_card_enabled: checked ? 1 : 0 })}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
                            <span className="font-bold text-slate-800 text-xs">تحويل بنكي</span>
                            <Switch
                              checked={(formState.payment_bank_enabled ?? 1) !== 0}
                              onCheckedChange={(checked) => setFormState({ ...formState, payment_bank_enabled: checked ? 1 : 0 })}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
                            <span className="font-bold text-slate-800 text-xs">دفع بالفرع (نقداً)</span>
                            <Switch
                              checked={(formState.payment_cash_enabled ?? 1) !== 0}
                              onCheckedChange={(checked) => setFormState({ ...formState, payment_cash_enabled: checked ? 1 : 0 })}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <span className="font-bold text-slate-900 text-xs block">شروط وأحكام كود الخصم الترويجي</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">الحد الأدنى لعدد المسافرين لتفعيل الخصم</label>
                            <Input
                              type="number"
                              min={1}
                              value={formState.promo_min_passengers ?? 1}
                              onChange={(e) => setFormState({ ...formState, promo_min_passengers: Number(e.target.value) || 1 })}
                              className="h-10 bg-white"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">الخدمة المشمولة بالخصم (تارقت)</label>
                            <select
                              value={formState.promo_required_service || ""}
                              onChange={(e) => setFormState({ ...formState, promo_required_service: e.target.value })}
                              className="h-10 bg-white w-full rounded-xl border border-slate-200 px-3 font-bold text-slate-800"
                            >
                              <option value="">جميع الخدمات (بدون شرط)</option>
                              <option value="flight">حجوزات الطيران</option>
                              <option value="hotel">حجوزات الفنادق</option>
                              <option value="package">الباقات السياحية والعمرة</option>
                              <option value="visa">التأشيرات</option>
                              <option value="bus">النقل البري والباصات</option>
                              <option value="ride">المشاوير وتوصيل المطار</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">اسم البنك</label>
                        <Input
                          value={formState.bank_name || ""}
                          onChange={(e) => setFormState({ ...formState, bank_name: e.target.value })}
                          className="h-10 bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">رقم الآيبان (IBAN)</label>
                        <Input
                          value={formState.bank_iban || ""}
                          onChange={(e) => setFormState({ ...formState, bank_iban: e.target.value })}
                          className="h-10 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">اسم المستفيد</label>
                        <Input
                          value={formState.bank_account_name || ""}
                          onChange={(e) =>
                            setFormState({ ...formState, bank_account_name: e.target.value })
                          }
                          className="h-10 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-3 border-t">
                  <Button type="submit" disabled={publishMutation.isPending} className="bg-blue-600 text-white rounded-xl text-xs font-bold gap-2 px-6">
                    <Save className="w-4 h-4" />
                    <span>حفظ ونشر التسعير والدفع</span>
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ─── TAB 6: ONLINE BOOKINGS ─── */}
            <TabsContent value="bookings" className="space-y-4 mt-0">
              {bookings.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">لا توجد حجوزات إلكترونية مسجلة حتى الآن</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">رقم الحجز</th>
                        <th className="p-3">المسافر</th>
                        <th className="p-3">الجوال</th>
                        <th className="p-3">الخدمة</th>
                        <th className="p-3">الإجمالي</th>
                        <th className="p-3">حالة الاعتماد</th>
                        <th className="p-3">الدفع والترحيل</th>
                        <th className="p-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.map((b) => {
                        const isPendingApproval = b.booking_status === "pending_approval";
                        const isRejected = b.booking_status === "rejected";
                        const isConfirmed = b.booking_status === "confirmed";
                        const isFocused = focusedBookingId === Number(b.id);
                        return (
                          <tr
                            key={b.id}
                            className={
                              isFocused
                                ? "bg-amber-50/90 ring-2 ring-inset ring-amber-400"
                                : isPendingApproval
                                ? "bg-amber-50/40 hover:bg-amber-50/70"
                                : "hover:bg-slate-50/70"
                            }
                          >
                            <td className="p-3 font-mono font-bold text-blue-700">
                              <div>{b.booking_ref}</div>
                              <div className="text-[10px] text-slate-400">{b.pnr}</div>
                            </td>
                            <td className="p-3 font-bold">
                              <div>{b.customer_name}</div>
                              {b.customer_id && (
                                <span className="text-[10px] text-emerald-700 font-bold">
                                  عميل مسجل بدليل الحسابات
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono">{b.customer_phone}</td>
                            <td className="p-3">{b.service_title}</td>
                            <td className="p-3 font-black text-emerald-600">{fmt(b.total_amount)} ر.س</td>
                            <td className="p-3">
                              {isPendingApproval ? (
                                <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black gap-1">
                                  <Clock className="w-3 h-3" />
                                  بانتظار الموافقة
                                </Badge>
                              ) : isRejected ? (
                                <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black gap-1">
                                  <XCircle className="w-3 h-3" />
                                  مرفوض
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  معتمد ومؤكد
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={b.payment_status === "paid" ? "text-emerald-600 font-bold block" : "text-amber-600 font-bold block"}>
                                {b.payment_status === "paid" ? "مدفوع" : "آجل / بانتظار السداد"}
                              </span>
                              {b.invoice_id && (
                                <span className="text-[10px] text-slate-500 font-mono block">
                                  فاتورة #{b.invoice_id} {b.journal_entry_id ? `· قيد #${b.journal_entry_id}` : ""}
                                </span>
                              )}
                              {b.whatsapp_scheduled_at && (
                                <span className="text-[10px] text-emerald-700 block">
                                  واتساب: {b.whatsapp_scheduled_at}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {isPendingApproval && (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => openBookingReviewModal(b)}
                                      className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>مراجعة واعتماد</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRejectTargetBooking(b);
                                        setRejectReason("");
                                      }}
                                      className="h-8 text-[11px] border-rose-300 text-rose-700 hover:bg-rose-50 font-bold gap-1 cursor-pointer"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>رفض</span>
                                    </Button>
                                  </>
                                )}
                                {isConfirmed && b.payment_status !== "paid" && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateBookingStatusMutation.mutate({
                                        id: b.id,
                                        payment_status: "paid",
                                        booking_status: "confirmed"
                                      })
                                    }
                                    className="h-8 text-[11px]"
                                  >
                                    تأكيد السداد
                                  </Button>
                                )}
                                {b.customer_phone && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleSendWhatsApp(
                                        b.customer_phone,
                                        `مرحباً ${b.customer_name}، بخصوص حجزكم ${b.booking_ref}`
                                      )
                                    }
                                    className="h-8 w-8 p-0 text-emerald-600"
                                    title="مراسلة العميل عبر واتساب"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 7: INQUIRIES ─── */}
            <TabsContent value="inquiries" className="space-y-3 mt-0">
              {inquiries.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">لا توجد استفسارات جديدة</p>
                </div>
              ) : (
                inquiries.map((inq) => {
                  const isFocused = focusedInquiryId === Number(inq.id);
                  const isNew = inq.status === "new";
                  return (
                    <div
                      key={inq.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isFocused
                          ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300"
                          : isNew
                          ? "bg-indigo-50/40 border-indigo-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-black text-slate-900">{inq.name}</span>
                          <span className="text-slate-400 font-mono">{inq.phone}</span>
                          <span className="text-blue-700 font-bold">{inq.service_interest}</span>
                          <Badge
                            className={
                              isNew
                                ? "bg-amber-100 text-amber-900 border-amber-300 text-[10px]"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"
                            }
                          >
                            {isNew ? "جديد بانتظار المراجعة" : "تمت المراجعة والاعتماد"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{inq.message}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {isNew && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={approveInquiryMutation.isPending}
                              onClick={() => approveInquiryMutation.mutate({ id: inq.id, save_customer: true })}
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>اعتماد وحفظ كعميل</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={approveInquiryMutation.isPending}
                              onClick={() => approveInquiryMutation.mutate({ id: inq.id, save_customer: false })}
                              className="rounded-xl text-xs font-bold cursor-pointer"
                            >
                              تمت المراجعة
                            </Button>
                          </>
                        )}
                        {inq.phone && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              handleSendWhatsApp(
                                inq.phone,
                                `مرحباً ${inq.name}، بخصوص طلبكم (${inq.service_interest})`
                              )
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1 shrink-0"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ─── TAB 8: VERSION HISTORY & AUDIT LOG ─── */}
            <TabsContent value="history" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-900">النسخ السابقة للهوية البصرية (Version History)</h3>
                  {(historyData?.history || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed">
                      ستظهر هنا نقاط الاستعادة تلقائياً عند كل عملية نشر أو استعادة
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(historyData?.history || []).map((h) => (
                        <div
                          key={h.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-black text-slate-900">{h.snapshot_name}</div>
                            <div className="text-[11px] text-slate-500">
                              بواسطة {h.created_by_name || "النظام"} · {h.created_at}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => restoreSnapshotMutation.mutate({ id: h.id, mode: "draft" })}
                              className="h-8 text-[11px]"
                            >
                              معاينة كمسودة
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => restoreSnapshotMutation.mutate({ id: h.id, mode: "publish" })}
                              className="h-8 text-[11px] bg-blue-600 text-white"
                            >
                              استعادة ونشر
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-900">سجل التدقيق للتعديلات (Audit Trail)</h3>
                  {(historyData?.audits || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed">
                      لا توجد سجلات تدقيق بعد
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {(historyData?.audits || []).map((a) => (
                        <div key={a.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-900">{a.details}</span>
                            <span className="font-mono text-[10px] text-blue-600">{a.action}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {a.user_name} · {a.created_at}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* WhatsApp Dispatch Controls & Device Permissions Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900">طريقة إرسال الواتساب على هذا الجهاز</h4>
                <Badge className={currentWaPerm.mode === "installed_app" ? "bg-emerald-600 text-white text-[10px]" : "bg-slate-700 text-white text-[10px]"}>
                  {currentWaPerm.mode === "installed_app" ? "تلقائي: تطبيق واتساب المثبت" : "يدوي: متصفح الويب"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentWaPerm.mode === "installed_app"
                  ? "توجيه الرسائل مباشرة إلى تطبيق واتساب المثبت على جهازك."
                  : "فتح الرابط عبر متصفح الإنترنت."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={currentWaPerm.mode === "installed_app" ? "default" : "outline"}
              onClick={() => handleUpdateWaMode("installed_app")}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تطبيق واتساب</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={currentWaPerm.mode === "manual_web" ? "default" : "outline"}
              onClick={() => handleUpdateWaMode("manual_web")}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>متصفح الويب</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleResetWaPermission}
              className="rounded-xl text-xs text-slate-500 h-8 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة تعيين الإذن</span>
            </Button>
          </div>
        </div>
      </div>

      <WhatsAppPermissionDialog
        open={waPermOpen}
        onClose={() => {
          setWaPermOpen(false);
          setPendingWaAction(null);
        }}
        onConfirmed={() => {
          setWaPermOpen(false);
          setCurrentWaPerm(getWhatsAppPermission());
          if (pendingWaAction) {
            pendingWaAction();
            setPendingWaAction(null);
          }
        }}
      />

      {/* Booking Approval & Accounting Review Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  مراجعة واعتماد طلب الحجز ({reviewBooking.booking_ref})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  عند الاعتماد يتم حفظ العميل وإصدار فاتورة وقيد مزدوج في دليل الحسابات وتطبيق مؤقت تنبيهات واتساب تلقائياً
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setReviewBooking(null)}>
                ✕
              </Button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">اسم العميل:</span>
                <span className="font-black text-slate-900">{reviewBooking.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الجوال / الواتساب:</span>
                <span className="font-mono font-bold text-slate-800">{reviewBooking.customer_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الخدمة:</span>
                <span className="font-bold text-blue-700">{reviewBooking.service_title}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">المبلغ النهائي ({reviewBooking.currency || "SAR"})</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={reviewFinalAmount}
                  onChange={(e) => setReviewFinalAmount(e.target.value)}
                  className="h-10 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">حالة السداد المحاسبية</label>
                <select
                  value={reviewPaymentStatus}
                  onChange={(e) => setReviewPaymentStatus(e.target.value)}
                  className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold bg-white"
                >
                  <option value="paid">مدفوع (تحصيل مباشر للصندوق/البنك)</option>
                  <option value="pending">آجل (ذمم عملاء 112XX)</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">طريقة الدفع</label>
                <select
                  value={reviewPaymentMethod}
                  onChange={(e) => setReviewPaymentMethod(e.target.value)}
                  className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold bg-white"
                >
                  <option value="cash">نقداً (الصندوق)</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="credit_card">بطاقة بنكية</option>
                  <option value="esaalat">الدفع الإلكتروني (Esaalat)</option>
                </select>
              </div>
              {reviewPaymentStatus === "paid" && reviewPaymentMethod === "cash" && safesList.length > 0 && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الصندوق المستلم</label>
                  <select
                    value={reviewSafeId}
                    onChange={(e) => setReviewSafeId(e.target.value)}
                    className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold bg-white"
                  >
                    {safesList.map((sf: any) => (
                      <option key={sf.id} value={sf.id}>
                        {sf.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">ملاحظات الاعتماد</label>
                <Textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="ملاحظات داخلية أو تعليمات للعميل..."
                  className="text-xs"
                />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewForceWaNow}
                  onChange={(e) => setReviewForceWaNow(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="font-bold text-emerald-900">
                  إرسال إشعار الواتساب فوراً (بدلاً من انتظار المؤقت المضبوط في مركز التنبيهات)
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectTargetBooking(reviewBooking);
                  setRejectReason("");
                }}
                className="text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50"
              >
                رفض الطلب
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setReviewBooking(null)} className="text-xs">
                  إلغاء
                </Button>
                <Button
                  type="button"
                  disabled={approveBookingMutation.isPending}
                  onClick={() =>
                    approveBookingMutation.mutate({
                      id: reviewBooking.id,
                      payment_status: reviewPaymentStatus,
                      payment_method: reviewPaymentMethod,
                      safe_id: reviewSafeId ? Number(reviewSafeId) : undefined,
                      final_amount: Number(reviewFinalAmount || 0),
                      notes: reviewNotes,
                      force_whatsapp_immediate: reviewForceWaNow
                    })
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{approveBookingMutation.isPending ? "جارٍ الاعتماد..." : "اعتماد وترحيل لدليل الحسابات"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Booking Confirmation Modal */}
      {rejectTargetBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-rose-700">
                تأكيد رفض طلب الحجز ({rejectTargetBooking.booking_ref})
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRejectTargetBooking(null)}>
                ✕
              </Button>
            </div>
            <p className="text-xs text-slate-600">
              لن يتم تسجيل العميل أو إنشاء أي قيود محاسبية عند رفض الطلب.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">سبب الرفض (اختياري)</label>
              <Textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثال: تعذر توفر المقاعد أو عدم تأكيد التحويل..."
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setRejectTargetBooking(null)} className="text-xs">
                تراجع
              </Button>
              <Button
                type="button"
                disabled={rejectBookingMutation.isPending}
                onClick={() => rejectBookingMutation.mutate({ id: rejectTargetBooking.id, reason: rejectReason })}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                {rejectBookingMutation.isPending ? "جارٍ الرفض..." : "تأكيد الرفض"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
