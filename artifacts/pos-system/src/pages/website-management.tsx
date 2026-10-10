import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  LayoutDashboard,
  Calendar,
  Ticket,
  Building2,
  Plane,
  Compass,
  FileText,
  Bus,
  CreditCard,
  Settings,
  Users,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Save,
  Percent,
  DollarSign,
  Copy,
  Check,
  MessageSquare,
  Printer,
  ShieldCheck,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Tag,
  AlertCircle,
  Car,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Smartphone,
  Sparkles,
  Upload,
  Image as ImageIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? sessionStorage.getItem("pos_token") ?? "";
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
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WebsiteManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("bookings");
  const [copiedLink, setCopiedLink] = useState(false);

  // WhatsApp One-Time Permission & Direct Native Dispatch State
  const [waPermOpen, setWaPermOpen] = useState(false);
  const [pendingWaAction, setPendingWaAction] = useState<(() => void) | null>(null);
  const [currentWaPerm, setCurrentWaPerm] = useState(getWhatsAppPermission);

  const handleSendWhatsApp = (phone?: string, text: string = "") => {
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
      title: "تم تحديث ضبط الواتساب ✅",
      description: mode === "installed_app"
        ? "تم التفعيل: الإرسال المباشر عبر تطبيق واتساب المثبت (whatsapp://)"
        : "تم التفعيل: الإرسال عبر متصفح الويب (واتساب ويب)"
    });
  };

  const handleResetWaPermission = () => {
    resetWhatsAppPermission();
    setCurrentWaPerm(getWhatsAppPermission());
    toast({
      title: "تمت إعادة تعيين الإذن 🔄",
      description: "سيطلب النظام الإذن مجدداً لمرة واحدة عند أول إرسال قادم"
    });
  };

  // 1. Fetch Website Settings
  const { data: config, isLoading: isConfigLoading } = useQuery<any>({
    queryKey: ["admin-website-config"],
    queryFn: () => fetchWithAuth("/api/admin/website/config")
  });

  // Settings form state
  const [formState, setFormState] = useState<any>(null);

  React.useEffect(() => {
    if (config && !formState) {
      setFormState(config);
    }
  }, [config]);

  // 2. Fetch Online Bookings
  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery<any[]>({
    queryKey: ["admin-website-bookings"],
    queryFn: () => fetchWithAuth("/api/admin/website/bookings")
  });

  // 2.1 Fetch Offers & Ads Banners
  const { data: offers = [], isLoading: isOffersLoading } = useQuery<any[]>({
    queryKey: ["admin-website-offers"],
    queryFn: () => fetchWithAuth("/api/admin/website/offers")
  });

  // 3. Fetch Inquiries
  const { data: inquiries = [], isLoading: isInquiriesLoading } = useQuery<any[]>({
    queryKey: ["admin-website-inquiries"],
    queryFn: () => fetchWithAuth("/api/admin/website/inquiries")
  });

  // Image Upload State & Helper
  const [uploadingImage, setUploadingImage] = useState(false);
  const handleUploadFile = async (file: File): Promise<string> => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("pos_token") ?? sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/admin/website/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع الصورة");
      toast({ title: "تم رفع الصورة بنجاح ✅" });
      return data.url;
    } catch (err: any) {
      toast({ title: "خطأ في رفع الصورة", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  // Offer Modal State
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [offerForm, setOfferForm] = useState({
    title: "",
    subtitle: "",
    badge: "",
    discount: "",
    image_url: "",
    action_type: "tab",
    action_value: "rides",
    is_active: 1,
    sort_order: 0
  });

  // Offer Mutations
  const saveOfferMutation = useMutation({
    mutationFn: (payload: any) =>
      editingOffer
        ? fetchWithAuth(`/api/admin/website/offers/${editingOffer.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          })
        : fetchWithAuth("/api/admin/website/offers", {
            method: "POST",
            body: JSON.stringify(payload)
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-offers"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
      setOfferModalOpen(false);
      setEditingOffer(null);
      toast({ title: "تم حفظ العرض الإعلاني بنجاح 🎉" });
    },
    onError: (err: any) => {
      toast({ title: "فشل حفظ العرض", description: err.message, variant: "destructive" });
    }
  });

  const deleteOfferMutation = useMutation({
    mutationFn: (id: number) =>
      fetchWithAuth(`/api/admin/website/offers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-offers"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
      toast({ title: "تم حذف العرض الإعلاني" });
    }
  });

  const toggleOfferActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: any) =>
      fetchWithAuth(`/api/admin/website/offers/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-offers"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
      toast({ title: "تم تحديث حالة العرض" });
    }
  });

  // Update Settings Mutation
  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: any) =>
      fetchWithAuth("/api/admin/website/config", {
        method: "PUT",
        body: JSON.stringify(newConfig)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-config"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-config"] });
      toast({ title: "تم الحفظ بنجاح ✅", description: "تم تحديث إعدادات ومحتوى الموقع الإلكتروني للعملاء" });
    },
    onError: (err: any) => {
      toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" });
    }
  });

  // Update Booking Status Mutation
  const updateBookingStatusMutation = useMutation({
    mutationFn: ({ id, booking_status, payment_status }: any) =>
      fetchWithAuth(`/api/admin/website/bookings/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ booking_status, payment_status })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-bookings"] });
      toast({ title: "تم التحديث ✅", description: "تم تغيير حالة الحجز" });
    }
  });

  // 4. Fetch Custom Services & Rides
  const { data: customServices = [], isLoading: isServicesLoading } = useQuery<any[]>({
    queryKey: ["admin-website-services"],
    queryFn: () => fetchWithAuth("/api/admin/website/services")
  });

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

  // Save Service Mutation (Create / Update)
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
      toast({
        title: "تم الحفظ بنجاح ✅",
        description: editingService ? "تم تحديث بيانات الخدمة بنجاح" : "تمت إضافة الخدمة الجديدة للموقع بنجاح"
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" });
    }
  });

  // Delete Service Mutation
  const deleteServiceMutation = useMutation({
    mutationFn: (id: number) =>
      fetchWithAuth(`/api/admin/website/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-services"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-catalog"] });
      toast({ title: "تم الحذف بنجاح 🗑️", description: "تمت إزالة الخدمة من الموقع" });
    },
    onError: (err: any) => {
      toast({ title: "فشل الحذف", description: err.message, variant: "destructive" });
    }
  });

  // Toggle Service Active Mutation
  const toggleServiceActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: number }) =>
      fetchWithAuth(`/api/admin/website/services/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-services"] });
      queryClient.invalidateQueries({ queryKey: ["public-website-catalog"] });
      toast({ title: "تم التحديث ✅", description: "تم تحديث حالة عرض الخدمة" });
    }
  });

  // Open Service Modal
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

  // Copy website link
  const handleCopyPortalLink = () => {
    const url = `${window.location.origin}/portal`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast({ title: "تم نسخ رابط الموقع 📋", description: url });
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState) return;
    updateConfigMutation.mutate(formState);
  };

  // Stats calculation
  const totalBookingsCount = bookings.length;
  const confirmedCount = bookings.filter((b) => b.booking_status === "confirmed").length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const newInquiriesCount = inquiries.filter((i) => i.status === "new").length;

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-4">
            <NjazLogo size="md" showText={false} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-slate-900">إدارة موقع نجاز للمشاوير والسفريات (CMS)</h1>
                <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">@Njaz معتمد</Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                التحكم الكامل في صفحات الموقع، الحجوزات والمشاوير، هوامش الربح، بوابات الدفع، وهوية وكالة نجاز
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleCopyPortalLink}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold gap-1.5 border-slate-300"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "تم النسخ!" : "نسخ رابط الموقع"}</span>
            </Button>

            <a href="/portal" target="_blank" rel="noreferrer">
              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة وزيارة موقع العملاء</span>
              </Button>
            </a>
          </div>
        </div>

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
                <span className="text-xs text-slate-500 font-medium block">إجمالي المبيعات عبر الموقع</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">{fmt(totalRevenue)} ر.س</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">مباشرة إلى خزينة النظام</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <CreditCard className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">استفسارات الزوار الجديدة</span>
                <span className="text-2xl font-black text-indigo-600 mt-1 block">{newInquiriesCount}</span>
                <span className="text-[11px] text-indigo-500 font-medium mt-0.5 block">بانتظار تواصل المستشار</span>
              </div>
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                <MessageSquare className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">رابط البوابة العامة</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block font-mono">/portal</span>
                <span className="text-[11px] text-sky-600 font-medium mt-0.5 block">مفتوح للعملاء والجمهور</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                <Globe className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs Hub */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-6 h-auto p-1.5 bg-slate-100 rounded-2xl gap-1 mb-6">
              <TabsTrigger value="bookings" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <Ticket className="w-4 h-4" />
                <span>الحجوزات ({bookings.length})</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <LayoutDashboard className="w-4 h-4" />
                <span>الخدمات والمشاوير</span>
              </TabsTrigger>
              <TabsTrigger value="offers" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <Sparkles className="w-4 h-4" />
                <span>العروض والإعلانات ({offers.length})</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <Globe className="w-4 h-4" />
                <span>الشعار والهوية والشريط</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <Percent className="w-4 h-4" />
                <span>هوامش الربح والكوبونات</span>
              </TabsTrigger>
              <TabsTrigger value="inquiries" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <MessageSquare className="w-4 h-4" />
                <span>استفسارات الزوار ({inquiries.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: BOOKINGS LIST ─── */}
            <TabsContent value="bookings" className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>سجل الحجوزات الواردة مباشرة من الموقع الإلكتروني</span>
                  <Badge variant="outline" className="text-xs">{bookings.length}</Badge>
                </h3>
                <span className="text-xs text-slate-400">تحديث فوري عند إتمام أي حجز من المسافرين</span>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">لا توجد حجوزات إلكترونية مسجلة حتى الآن</p>
                  <p className="text-[11px] text-slate-400 mt-1">عندما يقوم أي عميل بالحجز من واجهة الموقع ستظهر تفاصيله هنا فوراً</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">رقم الحجز</th>
                        <th className="p-3">اسم المسافر</th>
                        <th className="p-3">رقم الجوال</th>
                        <th className="p-3">الخدمة المحجوزة</th>
                        <th className="p-3">المبلغ الإجمالي</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3">حالة الحجز</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-mono font-bold text-sky-700">
                            <div>{b.booking_ref}</div>
                            <div className="text-[10px] text-slate-400">{b.pnr}</div>
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            <div>{b.customer_name}</div>
                            <div className="text-[10px] text-slate-400">{b.passport_number || "هوية وطنية"}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{b.customer_phone}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800">{b.service_title}</span>
                            <span className="block text-[10px] text-slate-400">
                              {b.passengers_count || 1} مسافر • {b.departure_date || "تاريخ مفتوح"}
                            </span>
                          </td>
                          <td className="p-3 font-black text-emerald-600">{fmt(b.total_amount)} ر.س</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px]">
                              {b.payment_method === "credit_card" ? "بطاقة ائتمان" : b.payment_method === "bank_transfer" ? "تحويل بنكي" : "سداد بالفرع"}
                            </Badge>
                            <span className={`block text-[10px] font-bold mt-0.5 ${b.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                              {b.payment_status === "paid" ? "مدفوع بالكامل ✅" : "بانتظار السداد"}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge className={b.booking_status === "confirmed" ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}>
                              {b.booking_status === "confirmed" ? "مؤكد" : b.booking_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {b.customer_phone && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleSendWhatsApp(
                                      b.customer_phone,
                                      `مرحباً أستاذ ${b.customer_name}، بخصوص حجزكم رقم ${b.booking_ref} لدى وكالة نجاز للسفريات والمشاوير (@Njaz)...`
                                    )
                                  }
                                  title="مراسلة العميل عبر واتساب"
                                  className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  updateBookingStatusMutation.mutate({
                                    id: b.id,
                                    payment_status: "paid",
                                    booking_status: "confirmed"
                                  });
                                }}
                                className="h-8 text-[11px] rounded-lg px-2.5 font-bold"
                              >
                                تأكيد السداد
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 2: SECTIONS & SERVICES VISIBILITY & CRUD ─── */}
            <TabsContent value="services" className="space-y-8">
              {/* 1. Main Sections Visibility */}
              <form onSubmit={handleSaveSettings} className="space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">أقسام الموقع الرئيسية (إظهار / إخفاء الأقسام العامة)</h3>
                    <p className="text-xs text-slate-500">التحكم الفوري في إظهار أو إخفاء أي قسم كامل في موقع العملاء (@Njaz Portal)</p>
                  </div>
                  <Button type="submit" disabled={updateConfigMutation.isPending} size="sm" className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs">
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ حالة الأقسام</span>
                  </Button>
                </div>

                {formState && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <Car className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">مشاوير ونقل وتوصيل VIP</span>
                            <span className="text-[10px] text-slate-400">توصيل المطارات والحرمين</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.rides_enabled !== 0}
                          onChange={(e) => setFormState({ ...formState, rides_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                            <Plane className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">حجز تذاكر الطيران</span>
                            <span className="text-[10px] text-slate-400">محرك بحث الرحلات المباشرة</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.flight_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, flight_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">حجز الفنادق والمنتجعات</span>
                            <span className="text-[10px] text-slate-400">دليل الفنادق ومحرك الأسعار</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.hotel_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, hotel_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Compass className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">باقات السياحة والعمرة</span>
                            <span className="text-[10px] text-slate-400">البرامج السياحية الشاملة</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.packages_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, packages_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">معاملات وخدمات التأشيرات</span>
                            <span className="text-[10px] text-slate-400">التقديم وتتبع حالة التأشيرات</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.visas_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, visas_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <Bus className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">تذاكر الباصات والنقل البري</span>
                            <span className="text-[10px] text-slate-400">حجوزات الرحلات البرية</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.bus_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, bus_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 bg-white">
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">التأمين الصحي والسياحي</span>
                            <span className="text-[10px] text-slate-400">وثائق تأمين السفر المعتمدة</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.insurance_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, insurance_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </form>

              {/* 2. Custom Services & Rides CRUD Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">إدارة المشاوير والخدمات والعروض المخصصة</h3>
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 font-bold">
                        {customServices.length} خدمات مضافة
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      إضافة وتعديل وحذف وتفعيل كل مشوار أو باقة أو خدمة تظهر للمسافرين مع تحديد السعر والسيارة والميزات
                    </p>
                  </div>

                  <Button
                    onClick={handleOpenAddService}
                    className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة مشوار / خدمة جديدة +</span>
                  </Button>
                </div>

                {/* Filter Tabs by Category */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400 text-xs font-bold ml-1">تصفية:</span>
                  {[
                    { id: "all", label: "جميع الخدمات" },
                    { id: "rides", label: "المشاوير والنقل VIP" },
                    { id: "packages", label: "باقات سياحية وعمرة" },
                    { id: "visas", label: "تأشيرات سفر" },
                    { id: "general", label: "عروض أخرى" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setServiceCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                        serviceCategoryFilter === cat.id
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Services List / Cards */}
                {customServices.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold">لا توجد خدمات أو مشاوير مخصصة مسجلة</p>
                    <p className="text-[11px] text-slate-400 mt-1">اضغط على زر "إضافة مشوار / خدمة جديدة" للبدء</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customServices
                      .filter((s) => serviceCategoryFilter === "all" || s.category === serviceCategoryFilter)
                      .map((service) => (
                        <Card
                          key={service.id}
                          className={`rounded-2xl border transition-all ${
                            service.is_active === 1
                              ? "border-slate-200 shadow-xs hover:border-orange-300"
                              : "border-slate-200 bg-slate-50/70 opacity-75"
                          }`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                                    {service.category === "rides"
                                      ? "مشاوير ونقل"
                                      : service.category === "packages"
                                      ? "باقة سياحية"
                                      : service.category === "visas"
                                      ? "تأشيرة"
                                      : "خدمة عامة"}
                                  </Badge>
                                  {service.badge && (
                                    <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
                                      {service.badge}
                                    </Badge>
                                  )}
                                  {service.is_active === 1 ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                      معروض للعملاء
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-200 text-slate-600 text-[10px]">مخفي</Badge>
                                  )}
                                </div>
                                <h4 className="font-black text-slate-900 text-xs sm:text-sm line-clamp-1">{service.title}</h4>
                                {service.subtitle && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">{service.subtitle}</p>
                                )}
                              </div>
                              <div className="text-left shrink-0">
                                <span className="font-black text-emerald-600 text-base">{fmt(service.price)}</span>
                                <span className="text-[10px] text-slate-400 block">ر.س</span>
                              </div>
                            </div>

                            <div className="text-[11px] space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-600">
                              {service.car_type && (
                                <div className="flex items-center gap-1.5">
                                  <Car className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  <span>{service.car_type}</span>
                                </div>
                              )}
                              {service.duration && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                  <span>{service.duration}</span>
                                </div>
                              )}
                              {(service.origin || service.destination) && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="line-clamp-1">{service.origin} ➔ {service.destination}</span>
                                </div>
                              )}
                              {service.features && (
                                <p className="text-[10px] text-slate-400 line-clamp-2 pt-1 border-t border-slate-200/60">
                                  {service.features}
                                </p>
                              )}
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
                                className={`h-8 text-xs rounded-xl gap-1 font-bold ${
                                  service.is_active === 1
                                    ? "text-slate-600 hover:bg-slate-100"
                                    : "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                                }`}
                              >
                                {service.is_active === 1 ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                    <span>إخفاء</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>إظهار بالموقع</span>
                                  </>
                                )}
                              </Button>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenEditService(service)}
                                  className="h-8 text-xs rounded-xl px-2.5 gap-1 border-slate-300 text-slate-700 hover:bg-slate-100"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>تعديل</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من حذف الخدمة: ${service.title}؟`)) {
                                      deleteServiceMutation.mutate(service.id);
                                    }
                                  }}
                                  className="h-8 text-xs rounded-xl px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </div>

              {/* ─── ADD / EDIT SERVICE MODAL ─── */}
              {serviceModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto text-right" dir="rtl">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          {editingService ? "تعديل تفاصيل الخدمة / المشوار" : "إضافة خدمة أو مشوار جديد للموقع"}
                        </h3>
                        <p className="text-xs text-slate-500">
                          ستظهر هذه الخدمة وتفاصيلها وسعرها فورياً في واجهة العملاء (@Njaz)
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setServiceModalOpen(false)}
                        className="rounded-full h-8 w-8 p-0"
                      >
                        ✕
                      </Button>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveServiceMutation.mutate(serviceForm);
                      }}
                      className="space-y-4 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">فئة الخدمة *</label>
                          <select
                            value={serviceForm.category}
                            onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                            className="w-full h-10 bg-white border border-slate-300 rounded-xl text-xs px-3 font-bold"
                          >
                            <option value="rides">مشاوير ونقل سياحي VIP (Rides)</option>
                            <option value="packages">باقات سياحية وعمرة (Packages)</option>
                            <option value="visas">تأشيرات ومعاملات سفر (Visas)</option>
                            <option value="general">عروض وخدمات عامة (General)</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">السعر (ر.س) *</label>
                          <Input
                            type="number"
                            required
                            min="0"
                            step="1"
                            value={serviceForm.price}
                            onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                            className="rounded-xl h-10 text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="font-bold text-slate-700 block mb-1">اسم الخدمة / عنوان المشوار *</label>
                          <Input
                            required
                            placeholder="مثال: توصيل واستقبال مطار الملك خالد الدولي VIP"
                            value={serviceForm.title}
                            onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                            className="rounded-xl h-10 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">التصنيف الفرعي / النوع</label>
                          <Input
                            placeholder="مثال: توصيل مطار VIP أو باقة عمرة 5 نجوم"
                            value={serviceForm.subtitle}
                            onChange={(e) => setServiceForm({ ...serviceForm, subtitle: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">وسام تميز (Badge)</label>
                          <Input
                            placeholder="مثال: الأكثر طلباً، عرض خاص، VIP"
                            value={serviceForm.badge}
                            onChange={(e) => setServiceForm({ ...serviceForm, badge: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">نوع السيارة / فئة النقل</label>
                          <Input
                            placeholder="مثال: جمس يوكون / سيدان كامري حديثة"
                            value={serviceForm.car_type}
                            onChange={(e) => setServiceForm({ ...serviceForm, car_type: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">المدة التقديرية</label>
                          <Input
                            placeholder="مثال: 45 دقيقة أو 3 أيام"
                            value={serviceForm.duration}
                            onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">نقطة الانطلاق (Origin)</label>
                          <Input
                            placeholder="مثال: مطار الملك خالد الدولي"
                            value={serviceForm.origin}
                            onChange={(e) => setServiceForm({ ...serviceForm, origin: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">الوجهة (Destination)</label>
                          <Input
                            placeholder="مثال: فنادق المنطقة المركزية"
                            value={serviceForm.destination}
                            onChange={(e) => setServiceForm({ ...serviceForm, destination: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="font-bold text-slate-700 block mb-1">ميزات الخدمة (Features)</label>
                          <Input
                            placeholder="مثال: استقبال باللوحة • متوفر 24/7 • واي فاي • مياه وضيافة"
                            value={serviceForm.features}
                            onChange={(e) => setServiceForm({ ...serviceForm, features: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">حالة العرض في الموقع</span>
                            <span className="text-[11px] text-slate-400">إظهار الخدمة للجمهور والمسافرين فور الحفظ</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={serviceForm.is_active === 1}
                            onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked ? 1 : 0 })}
                            className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setServiceModalOpen(false)}
                          className="rounded-xl text-xs"
                        >
                          إلغاء
                        </Button>
                        <Button
                          type="submit"
                          disabled={saveServiceMutation.isPending}
                          className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold px-6"
                        >
                          {saveServiceMutation.isPending ? "جارٍ الحفظ..." : "حفظ الخدمة"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 2.5: OFFERS & ADS BANNERS CMS ─── */}
            <TabsContent value="offers" className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">إدارة العروض والإعلانات الترويجية الحصرية</h3>
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 font-bold">
                      {offers.length} عروض إعلانية
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إضافة وتعديل وحذف العروض وبنرات الإعلانات التي تظهر أعلى الموقع مع تحديد الصورة والخصم
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setEditingOffer(null);
                    setOfferForm({
                      title: "",
                      subtitle: "",
                      badge: "عرض خاص",
                      discount: "خصم 15%",
                      image_url: "",
                      action_type: "tab",
                      action_value: "rides",
                      is_active: 1,
                      sort_order: offers.length + 1
                    });
                    setOfferModalOpen(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة عرض / إعلان جديد +</span>
                </Button>
              </div>

              {/* Offers Grid */}
              {offers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">لا توجد عروض أو إعلانات مسجلة</p>
                  <p className="text-[11px] text-slate-400 mt-1">اضغط على زر "إضافة عرض / إعلان جديد" للبدء</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offers.map((offer: any) => (
                    <Card
                      key={offer.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        offer.is_active === 1
                          ? "border-slate-200 shadow-xs hover:border-orange-300"
                          : "border-slate-200 bg-slate-50/70 opacity-75"
                      }`}
                    >
                      {offer.image_url ? (
                        <div className="h-36 w-full overflow-hidden relative bg-slate-100">
                          <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover" />
                          {offer.badge && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                              {offer.badge}
                            </span>
                          )}
                          {offer.discount && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold font-mono">
                              {offer.discount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-24 w-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                          بدون صورة
                        </div>
                      )}

                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-black text-slate-900 text-xs sm:text-sm line-clamp-1">{offer.title}</h4>
                            {offer.subtitle && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{offer.subtitle}</p>
                            )}
                          </div>
                          <Badge className={offer.is_active === 1 ? "bg-emerald-50 text-emerald-700 text-[10px]" : "bg-slate-200 text-slate-600 text-[10px]"}>
                            {offer.is_active === 1 ? "معروض" : "مخفي"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleOfferActiveMutation.mutate({ id: offer.id, is_active: offer.is_active === 1 ? 0 : 1 })}
                            className="h-8 text-xs rounded-xl"
                          >
                            {offer.is_active === 1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingOffer(offer);
                                setOfferForm({
                                  title: offer.title || "",
                                  subtitle: offer.subtitle || "",
                                  badge: offer.badge || "",
                                  discount: offer.discount || "",
                                  image_url: offer.image_url || "",
                                  action_type: offer.action_type || "tab",
                                  action_value: offer.action_value || "rides",
                                  is_active: offer.is_active ?? 1,
                                  sort_order: offer.sort_order ?? 0
                                });
                                setOfferModalOpen(true);
                              }}
                              className="h-8 text-xs rounded-xl gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>تعديل</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذا العرض؟")) {
                                  deleteOfferMutation.mutate(offer.id);
                                }
                              }}
                              className="h-8 text-xs text-rose-600 hover:text-rose-700 rounded-xl"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Offer Modal */}
              {offerModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto text-right" dir="rtl">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <h3 className="text-base font-black text-slate-900">
                        {editingOffer ? "تعديل بيانات العرض / الإعلان" : "إضافة عرض إعلاني جديد"}
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setOfferModalOpen(false)} className="rounded-full h-8 w-8 p-0">✕</Button>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveOfferMutation.mutate(offerForm);
                      }}
                      className="space-y-4 text-xs"
                    >
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">عنوان العرض أو الإعلان *</label>
                        <Input
                          required
                          placeholder="مثال: خصم 20% على مشاوير واستقبال المطار VIP"
                          value={offerForm.title}
                          onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                          className="rounded-xl h-10 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">الوصف الفرعي للعرض</label>
                        <Input
                          placeholder="مثال: خدمة 24/7 بسيارات حديثة ومجهزة لكافة المدن"
                          value={offerForm.subtitle}
                          onChange={(e) => setOfferForm({ ...offerForm, subtitle: e.target.value })}
                          className="rounded-xl h-10 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">وسام التميز (Badge)</label>
                          <Input
                            placeholder="مثال: الأكثر طلباً / VIP"
                            value={offerForm.badge}
                            onChange={(e) => setOfferForm({ ...offerForm, badge: e.target.value })}
                            className="rounded-xl h-10 text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">نسبة أو قيمة الخصم</label>
                          <Input
                            placeholder="مثال: خصم 20% / سعر خاص"
                            value={offerForm.discount}
                            onChange={(e) => setOfferForm({ ...offerForm, discount: e.target.value })}
                            className="rounded-xl h-10 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* Image Upload for Offer */}
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">صورة العرض / البنر</label>
                        <div className="flex gap-2 items-center">
                          <Input
                            placeholder="رابط الصورة أو ارفع من جهازك"
                            value={offerForm.image_url}
                            onChange={(e) => setOfferForm({ ...offerForm, image_url: e.target.value })}
                            className="rounded-xl h-10 text-xs font-mono flex-1"
                          />
                          <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer font-bold flex items-center gap-1 shrink-0 text-xs">
                            <Upload className="w-3.5 h-3.5" />
                            <span>رفع صورة</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = await handleUploadFile(file);
                                  setOfferForm({ ...offerForm, image_url: url });
                                }
                              }}
                            />
                          </label>
                        </div>
                        {offerForm.image_url && (
                          <div className="mt-2 h-20 w-36 rounded-xl overflow-hidden border border-slate-200">
                            <img src={offerForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">نوع الإجراء عند النقر</label>
                          <select
                            value={offerForm.action_type}
                            onChange={(e) => setOfferForm({ ...offerForm, action_type: e.target.value })}
                            className="w-full h-10 bg-white border border-slate-300 rounded-xl text-xs px-3"
                          >
                            <option value="tab">الانتقال لقسم في الموقع</option>
                            <option value="whatsapp">مراسلة واتساب فوراً</option>
                          </select>
                        </div>

                        {offerForm.action_type === "tab" && (
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">القسم المستهدف</label>
                            <select
                              value={offerForm.action_value}
                              onChange={(e) => setOfferForm({ ...offerForm, action_value: e.target.value })}
                              className="w-full h-10 bg-white border border-slate-300 rounded-xl text-xs px-3"
                            >
                              <option value="rides">المشاوير والنقل VIP</option>
                              <option value="flights">حجوزات الطيران</option>
                              <option value="hotels">حجوزات الفنادق</option>
                              <option value="packages">باقات العمرة والرحلات</option>
                              <option value="visas">تأشيرات السفر</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-800">حالة عرض الإعلان للجمهور</span>
                        <input
                          type="checkbox"
                          checked={offerForm.is_active === 1}
                          onChange={(e) => setOfferForm({ ...offerForm, is_active: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-orange-600 rounded"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button type="button" variant="outline" onClick={() => setOfferModalOpen(false)} className="rounded-xl text-xs">إلغاء</Button>
                        <Button type="submit" disabled={saveOfferMutation.isPending} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold px-6">
                          {saveOfferMutation.isPending ? "جارٍ الحفظ..." : "حفظ العرض"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 3: CONTENT & BRANDING CMS ─── */}
            <TabsContent value="content" className="space-y-6">
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">الهوية البصرية، الشعار، الشريط العلوي وبيانات الاتصال</h3>
                  <p className="text-xs text-slate-500">تحكم كامل في مظهر الموقع، الشعار المرفوع، الشريط العلوي، شبكات التواصل، والتذييل</p>
                </div>

                {formState && (
                  <div className="space-y-6 text-xs">
                    {/* 1. Logo Management Box */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-orange-500" />
                          <span>شعار الموقع والهوية البصرية الرسمية</span>
                        </h4>
                        <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">يدعم PNG, JPG, SVG, WebP</Badge>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        {/* Current Logo Preview */}
                        <div className="p-2 border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 w-28 h-28">
                          {formState.logo_url ? (
                            <img src={formState.logo_url} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <NjazLogo size="md" showText={false} />
                          )}
                        </div>

                        <div className="flex-1 space-y-3 w-full">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">رابط صورة الشعار (Logo URL)</label>
                            <div className="flex gap-2">
                              <Input
                                value={formState.logo_url || ""}
                                onChange={(e) => setFormState({ ...formState, logo_url: e.target.value })}
                                placeholder="https://example.com/logo.png أو ارفع من الملفات مباشرة ⬇️"
                                className="rounded-xl h-10 text-xs font-mono"
                              />
                              <label className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl cursor-pointer font-bold flex items-center gap-1.5 shrink-0 text-xs shadow-xs transition-colors">
                                <Upload className="w-4 h-4" />
                                <span>{uploadingImage ? "جارٍ الرفع..." : "رفع من الجهاز"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={uploadingImage}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await handleUploadFile(file);
                                      setFormState({ ...formState, logo_url: url });
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormState({ ...formState, logo_url: "" })}
                              className="text-[11px] rounded-xl h-8"
                            >
                              استعادة الشعار الهندسي الافتراضي لنـجـاز
                            </Button>
                            {formState.logo_url && (
                              <span className="text-[11px] text-emerald-600 font-bold">✓ تم تفعيل الشعار المرفوع</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Top Identity Bar & Social Media Controls */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-sky-600" />
                        <span>بيانات الشريط العلوي، خدمة العملاء والشبكات الاجتماعية</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">نص خدمة العملاء والمشاوير *</label>
                          <Input
                            value={formState.topbar_text || "خدمة العملاء والمشاوير 24/7"}
                            onChange={(e) => setFormState({ ...formState, topbar_text: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">رقم الهاتف الرسمي (الشريط العلوي) *</label>
                          <Input
                            value={formState.phone || "+966 50 123 4567"}
                            onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">رقم الواتساب لاستقبال الطلبات *</label>
                          <Input
                            value={formState.whatsapp || "966501234567"}
                            onChange={(e) => setFormState({ ...formState, whatsapp: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">المعرف الموحد للوكالة *</label>
                          <Input
                            value={formState.social_handle || "@Njaz"}
                            onChange={(e) => setFormState({ ...formState, social_handle: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">البريد الإلكتروني الرسمي *</label>
                          <Input
                            value={formState.email || "info@njaz-travel.com"}
                            onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">العنوان والمقر الرئيسي *</label>
                          <Input
                            value={formState.address || "المملكة العربية السعودية - خدمات النقل والمطارات"}
                            onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Social Channels URLs */}
                      <div className="pt-2 border-t border-slate-200">
                        <label className="font-bold text-slate-800 block mb-2">روابط صفحات التواصل الاجتماعي المعتمدة</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="text-[11px] text-slate-500 font-bold block mb-1">رابط Facebook</span>
                            <Input
                              value={formState.facebook_url || "https://facebook.com/Njaz"}
                              onChange={(e) => setFormState({ ...formState, facebook_url: e.target.value })}
                              className="rounded-xl h-9 text-xs bg-white font-mono"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 font-bold block mb-1">رابط X / Twitter</span>
                            <Input
                              value={formState.x_url || "https://x.com/Njaz"}
                              onChange={(e) => setFormState({ ...formState, x_url: e.target.value })}
                              className="rounded-xl h-9 text-xs bg-white font-mono"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 font-bold block mb-1">رابط Instagram</span>
                            <Input
                              value={formState.instagram_url || "https://instagram.com/Njaz"}
                              onChange={(e) => setFormState({ ...formState, instagram_url: e.target.value })}
                              className="rounded-xl h-9 text-xs bg-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Announcement Ticker Bar */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>شريط الإعلانات الترويجي المنزلق (Announcement Bar)</span>
                        </h4>
                        <input
                          type="checkbox"
                          checked={formState.announcement_bar_enabled !== 0}
                          onChange={(e) => setFormState({ ...formState, announcement_bar_enabled: e.target.checked ? 1 : 0 })}
                          className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                        />
                      </div>
                      <Input
                        value={formState.announcement_bar_text || "🔥 عروض المشاوير السياحية وتوصيل المطارات VIP مستمرة على مدار الساعة — احجز مشوارك الآن مع نجاز!"}
                        onChange={(e) => setFormState({ ...formState, announcement_bar_text: e.target.value })}
                        className="rounded-xl h-10 text-xs bg-white font-medium"
                      />
                    </div>

                    {/* 4. Section Banner Images */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <span>صور وبنرات الأقسام الرئيسية (المشاوير، الطيران، الفنادق، الباقات)</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">صورة قسم المشاوير والنقل VIP</label>
                          <div className="flex gap-2">
                            <Input
                              value={formState.rides_image_url || ""}
                              onChange={(e) => setFormState({ ...formState, rides_image_url: e.target.value })}
                              placeholder="رابط الصورة أو ارفع ملفاً"
                              className="rounded-xl h-9 text-xs bg-white font-mono flex-1"
                            />
                            <label className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer font-bold text-xs shrink-0 flex items-center gap-1">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = await handleUploadFile(file);
                                    setFormState({ ...formState, rides_image_url: url });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">صورة قسم حجوزات الطيران</label>
                          <div className="flex gap-2">
                            <Input
                              value={formState.flights_image_url || ""}
                              onChange={(e) => setFormState({ ...formState, flights_image_url: e.target.value })}
                              placeholder="رابط الصورة أو ارفع ملفاً"
                              className="rounded-xl h-9 text-xs bg-white font-mono flex-1"
                            />
                            <label className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer font-bold text-xs shrink-0 flex items-center gap-1">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = await handleUploadFile(file);
                                    setFormState({ ...formState, flights_image_url: url });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">صورة قسم الفنادق والمنتجعات</label>
                          <div className="flex gap-2">
                            <Input
                              value={formState.hotels_image_url || ""}
                              onChange={(e) => setFormState({ ...formState, hotels_image_url: e.target.value })}
                              placeholder="رابط الصورة أو ارفع ملفاً"
                              className="rounded-xl h-9 text-xs bg-white font-mono flex-1"
                            />
                            <label className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer font-bold text-xs shrink-0 flex items-center gap-1">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = await handleUploadFile(file);
                                    setFormState({ ...formState, hotels_image_url: url });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">صورة قسم الباقات والعمرة</label>
                          <div className="flex gap-2">
                            <Input
                              value={formState.packages_image_url || ""}
                              onChange={(e) => setFormState({ ...formState, packages_image_url: e.target.value })}
                              placeholder="رابط الصورة أو ارفع ملفاً"
                              className="rounded-xl h-9 text-xs bg-white font-mono flex-1"
                            />
                            <label className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer font-bold text-xs shrink-0 flex items-center gap-1">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = await handleUploadFile(file);
                                    setFormState({ ...formState, packages_image_url: url });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. Hero & Slogan Texts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">اسم الوكالة / الموقع الرسمي *</label>
                        <Input
                          value={formState.site_name || "وكالة نجاز للمشاوير والسفريات والسياحة"}
                          onChange={(e) => setFormState({ ...formState, site_name: e.target.value })}
                          className="rounded-xl h-10 text-xs bg-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">الشعار اللفظي (Slogan)</label>
                        <Input
                          value={formState.site_slogan || "نسعد بخدمتكم في حجوزات الطيران، المشاوير السياحية وتوصيل المطارات، الفنادق، وباقات السفر المتكاملة"}
                          onChange={(e) => setFormState({ ...formState, site_slogan: e.target.value })}
                          className="rounded-xl h-10 text-xs bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">العنوان الرئيسي في الواجهة (Hero Title)</label>
                        <Input
                          value={formState.hero_title || "مشاويرك، رحلاتك، وفنادقك.. بكل إنجاز وسهولة!"}
                          onChange={(e) => setFormState({ ...formState, hero_title: e.target.value })}
                          className="rounded-xl h-10 text-xs bg-white font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">الوصف الترويجي في الواجهة (Hero Subtitle)</label>
                        <textarea
                          rows={2}
                          value={formState.hero_subtitle || "حجوزات طيران محلية ودولية، مشاوير ونقل سياحي مريح، فنادق فاخرة، وباقات عمرة وتأشيرات بأفضل الأسعار وأعلى سرعة إنجاز"}
                          onChange={(e) => setFormState({ ...formState, hero_subtitle: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl text-xs p-3 font-medium focus:outline-sky-500"
                        />
                      </div>
                    </div>

                    {/* 6. Footer & Guarantees Details */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>نصوص التذييل وضمانات نجاز للعملاء</span>
                      </h4>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">نبذة الوكالة في التذييل (Footer Bio)</label>
                        <textarea
                          rows={2}
                          value={formState.footer_desc || "وكالة نجاز للمشاوير والسفريات والسياحة — نسعد بخدمتكم في حجوزات الطيران، المشاوير السياحية وتوصيل المطارات، الفنادق، وباقات السفر المتكاملة."}
                          onChange={(e) => setFormState({ ...formState, footer_desc: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl text-xs p-3 font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">عنوان قسم الضمانات</label>
                          <Input
                            value={formState.guarantee_title || "ضمانات نجاز للعملاء"}
                            onChange={(e) => setFormState({ ...formState, guarantee_title: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">نص الضمانات</label>
                          <Input
                            value={formState.guarantee_text || "جميع حجوزاتنا مؤكدة برقم PNR رسمي معتمد، مع ضمان استرداد فوري ودعم فني على مدار الساعة لكل مشوار ورحلة."}
                            onChange={(e) => setFormState({ ...formState, guarantee_text: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button type="submit" disabled={updateConfigMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold gap-2 px-8 py-2.5 shadow-xs">
                    <Save className="w-4 h-4" />
                    <span>حفظ المحتوى والهوية بالكامل</span>
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ─── TAB 4: MARKUPS & PRICING & PAYMENT ─── */}
            <TabsContent value="pricing" className="space-y-6">
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">قواعد التسعير، هوامش الربح الإلكترونية، وبوابات الدفع</h3>
                  <p className="text-xs text-slate-500">تحدد هوامش الربح المضافة تلقائياً على الأسعار المعروضة للعميل في الموقع</p>
                </div>

                {formState && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <label className="font-bold text-slate-800 block mb-1">هامش ربح تذاكر الطيران (%)</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formState.flight_markup_val ?? 5}
                          onChange={(e) => setFormState({ ...formState, flight_markup_val: Number(e.target.value) })}
                          className="rounded-xl h-10 text-xs bg-white"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">يضاف إلى السعر الأساسي للتذكرة</span>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <label className="font-bold text-slate-800 block mb-1">هامش ربح الفنادق (%)</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formState.hotel_markup_val ?? 8}
                          onChange={(e) => setFormState({ ...formState, hotel_markup_val: Number(e.target.value) })}
                          className="rounded-xl h-10 text-xs bg-white"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">يضاف على سعر الليلة الفندقية</span>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <label className="font-bold text-slate-800 block mb-1">كود الخصم الترويجي (Promo Code)</label>
                        <div className="flex gap-2">
                          <Input
                            value={formState.promo_code || "OMNIFLY10"}
                            onChange={(e) => setFormState({ ...formState, promo_code: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white font-mono uppercase"
                          />
                          <Input
                            type="number"
                            placeholder="النسبة %"
                            value={formState.promo_discount_percent ?? 10}
                            onChange={(e) => setFormState({ ...formState, promo_discount_percent: Number(e.target.value) })}
                            className="rounded-xl h-10 text-xs bg-white w-24"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Banking Details */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-sky-600" />
                        <span>بيانات الحساب البنكي لتحويلات العملاء</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">اسم البنك</label>
                          <Input
                            value={formState.bank_name || ""}
                            onChange={(e) => setFormState({ ...formState, bank_name: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">رقم الآيبان (IBAN)</label>
                          <Input
                            value={formState.bank_iban || ""}
                            onChange={(e) => setFormState({ ...formState, bank_iban: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">اسم المستفيد المعتمد</label>
                          <Input
                            value={formState.bank_account_name || ""}
                            onChange={(e) => setFormState({ ...formState, bank_account_name: e.target.value })}
                            className="rounded-xl h-10 text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button type="submit" disabled={updateConfigMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold gap-2 px-6">
                    <Save className="w-4 h-4" />
                    <span>حفظ الأسعار وطرق الدفع</span>
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ─── TAB 5: INQUIRIES ─── */}
            <TabsContent value="inquiries" className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>طلبات واستفسارات الزوار والرحلات الخاصة</span>
                  <Badge variant="outline" className="text-xs">{inquiries.length}</Badge>
                </h3>
              </div>

              {inquiries.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">لا توجد استفسارات جديدة حتى الآن</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inquiries.map((inq) => (
                    <div key={inq.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{inq.name}</span>
                          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">{inq.service_interest}</Badge>
                          <span className="text-[11px] text-slate-400 font-mono">{inq.phone}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{inq.message}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {inq.phone && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              handleSendWhatsApp(
                                inq.phone,
                                `مرحباً أستاذ ${inq.name}، بخصوص استفساركم لدى وكالة نجاز للسفريات والمشاوير (@Njaz)...`
                              )
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>محادثة واتساب</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <h4 className="text-sm font-black text-slate-900">طريقة إرسال ومراسلة الواتساب على هذا الجهاز</h4>
                <Badge className={currentWaPerm.mode === "installed_app" ? "bg-emerald-600 text-white text-[10px]" : "bg-slate-700 text-white text-[10px]"}>
                  {currentWaPerm.mode === "installed_app" ? "تلقائي: تطبيق واتساب المثبت (مباشر)" : "يدوي: متصفح الويب"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentWaPerm.mode === "installed_app"
                  ? "يتم توجيه الرسائل مباشرة إلى تطبيق واتساب المثبت على جهازك دون فتح صفحة المتصفح أو واتساب ويب."
                  : "يتم فتح الرابط عبر متصفح الإنترنت (واتساب ويب)."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={currentWaPerm.mode === "installed_app" ? "default" : "outline"}
              onClick={() => handleUpdateWaMode("installed_app")}
              className={`rounded-xl text-xs font-bold gap-1.5 h-8 cursor-pointer ${
                currentWaPerm.mode === "installed_app"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تلقائي (تطبيق واتساب المثبت)</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={currentWaPerm.mode === "manual_web" ? "default" : "outline"}
              onClick={() => handleUpdateWaMode("manual_web")}
              className={`rounded-xl text-xs font-bold gap-1.5 h-8 cursor-pointer ${
                currentWaPerm.mode === "manual_web"
                  ? "bg-slate-800 text-white"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>يدوي (متصفح الويب)</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleResetWaPermission}
              className="rounded-xl text-xs text-slate-500 hover:text-slate-800 h-8 cursor-pointer"
              title="إعادة تعيين وسؤال المستخدم عند الإرسال القادم"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة تعيين الإذن</span>
            </Button>
          </div>
        </div>
      </div>

      {/* WhatsApp One-Time Permission Dialog */}
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
    </AdminLayout>
  );
}
