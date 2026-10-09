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
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { NjazLogo } from "@/components/NjazLogo";

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

  // 3. Fetch Inquiries
  const { data: inquiries = [], isLoading: isInquiriesLoading } = useQuery<any[]>({
    queryKey: ["admin-website-inquiries"],
    queryFn: () => fetchWithAuth("/api/admin/website/inquiries")
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
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1.5 bg-slate-100 rounded-2xl gap-1 mb-6">
              <TabsTrigger value="bookings" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <Ticket className="w-4 h-4" />
                <span>الحجوزات الإلكترونية ({bookings.length})</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <LayoutDashboard className="w-4 h-4" />
                <span>الخدمات والأقسام</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="rounded-xl py-2.5 text-xs font-bold gap-1.5 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                <Globe className="w-4 h-4" />
                <span>المحتوى والهوية</span>
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
                              {config?.whatsapp && (
                                <a
                                  href={`https://wa.me/${b.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً أستاذ ${b.customer_name}، بخصوص حجزكم رقم ${b.booking_ref} لدى وكالة أومني فلاي...`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                </a>
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

            {/* ─── TAB 2: SECTIONS & SERVICES VISIBILITY ─── */}
            <TabsContent value="services" className="space-y-6">
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">التحكم في الأقسام والخدمات المعروضة في الموقع للعملاء</h3>
                  <p className="text-xs text-slate-500">يمكنك تفعيل أو إيقاف أي خدمة لتظهر أو تختفي فورياً من الموقع الإلكتروني للزوار</p>
                </div>

                {formState && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                            <Plane className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">حجز تذاكر الطيران</span>
                            <span className="text-[11px] text-slate-400">محرك بحث الرحلات المباشرة</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.flight_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, flight_enabled: e.target.checked ? 1 : 0 })}
                          className="w-5 h-5 accent-sky-600 rounded-md cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">حجز الفنادق والمنتجعات</span>
                            <span className="text-[11px] text-slate-400">دليل الفنادق ومحرك الأسعار</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.hotel_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, hotel_enabled: e.target.checked ? 1 : 0 })}
                          className="w-5 h-5 accent-sky-600 rounded-md cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                            <Compass className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">باقات السياحة والعمرة</span>
                            <span className="text-[11px] text-slate-400">البرامج السياحية الشاملة</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.packages_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, packages_enabled: e.target.checked ? 1 : 0 })}
                          className="w-5 h-5 accent-sky-600 rounded-md cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">معاملات وخدمات التأشيرات</span>
                            <span className="text-[11px] text-slate-400">التقديم وتتبع حالة التأشيرات</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.visas_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, visas_enabled: e.target.checked ? 1 : 0 })}
                          className="w-5 h-5 accent-sky-600 rounded-md cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                            <Bus className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">تذاكر الباصات والنقل البري</span>
                            <span className="text-[11px] text-slate-400">حجوزات الرحلات البرية</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.bus_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, bus_enabled: e.target.checked ? 1 : 0 })}
                          className="w-5 h-5 accent-sky-600 rounded-md cursor-pointer"
                        />
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">التأمين الصحي والسياحي</span>
                            <span className="text-[11px] text-slate-400">وثائق تأمين السفر المعتمدة</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.insurance_enabled === 1}
                          onChange={(e) => setFormState({ ...formState, insurance_enabled: e.target.checked ? 1 : 0 })}
                          className="w-5 h-5 accent-sky-600 rounded-md cursor-pointer"
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button type="submit" disabled={updateConfigMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold gap-2 px-6">
                    <Save className="w-4 h-4" />
                    <span>حفظ حالة الأقسام</span>
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ─── TAB 3: CONTENT & BRANDING CMS ─── */}
            <TabsContent value="content" className="space-y-6">
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">بيانات الهوية والمحتوى والاتصال بالموقع</h3>
                  <p className="text-xs text-slate-500">تظهر هذه البيانات مباشرة في الواجهة الرئيسية وأسفل الموقع للعملاء</p>
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
                      <label className="font-bold text-slate-700 block mb-1">رقم الواتساب لاستقبال الحجوزات</label>
                      <Input
                        value={formState.whatsapp || ""}
                        onChange={(e) => setFormState({ ...formState, whatsapp: e.target.value })}
                        placeholder="مثال: 966501234567"
                        className="rounded-xl h-10 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">البريد الإلكتروني الرسمي</label>
                      <Input
                        value={formState.email || ""}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">العنوان والمقر الرئيسي</label>
                      <Input
                        value={formState.address || ""}
                        onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">العنوان الرئيسي في البنر (Hero Title)</label>
                      <Input
                        value={formState.hero_title || ""}
                        onChange={(e) => setFormState({ ...formState, hero_title: e.target.value })}
                        className="rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">الوصف الترويجي في البنر (Hero Subtitle)</label>
                      <textarea
                        rows={2}
                        value={formState.hero_subtitle || ""}
                        onChange={(e) => setFormState({ ...formState, hero_subtitle: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl text-xs p-3 font-medium focus:outline-sky-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button type="submit" disabled={updateConfigMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold gap-2 px-6">
                    <Save className="w-4 h-4" />
                    <span>حفظ المحتوى والهوية</span>
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
                          <a
                            href={`https://wa.me/${inq.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً أستاذ ${inq.name}، بخصوص استفساركم لدى وكالة أومني فلاي للسياحة والسفر...`)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1">
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>محادثة واتساب</span>
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}
