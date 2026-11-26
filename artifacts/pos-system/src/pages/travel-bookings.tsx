import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, Search, Edit2, Trash2, Printer, CheckCircle2, AlertCircle, RefreshCw, XCircle, DollarSign, Plane, Send, Eye, Maximize2, FileDown, Store, Settings, ExternalLink, Home, ArrowLeftRight, Zap, Menu, FileSpreadsheet, Building2, Users, X } from "lucide-react";
import { FlightBookingFullscreenDialog } from "@/components/travel/flight-booking-fullscreen-dialog";
import { useAgencyConfig } from "@/hooks/use-agency-config";
import { buildFlightBoardingPassBody, buildFlightBoardingPassHtml } from "@/lib/travelTicketTemplates";
import { printA4Html } from "@/lib/printUtils";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : null) ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {})
    }
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ أثناء العملية");
    }
    if (res.status === 204) return {} as T;
    return res.json();
  });
}

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  confirmed: { label: "مؤكد", class: "bg-blue-100 text-blue-800 border-blue-200" },
  issued: { label: "مصدرة", class: "bg-green-100 text-green-800 border-green-200" },
  pending_issue: { label: "بانتظار الإصدار", class: "bg-amber-100 text-amber-800 border-amber-200" },
  cancelled: { label: "ملغاة", class: "bg-red-100 text-red-800 border-red-200" },
  refunded: { label: "مسترجعة", class: "bg-purple-100 text-purple-800 border-purple-200" },
  reissued: { label: "معاد إصدارها", class: "bg-indigo-100 text-indigo-800 border-indigo-200" }
};

const FLIGHT_STATUS_BADGES: Record<string, { label: string; class: string }> = {
  "مؤكدة": { label: "مؤكدة", class: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  "بانتظار التأكيد": { label: "بانتظار التأكيد", class: "bg-amber-100 text-amber-800 border-amber-300" },
  "ملغاة": { label: "ملغاة", class: "bg-red-100 text-red-800 border-red-300" },
  "مؤجلة": { label: "مؤجلة", class: "bg-orange-100 text-orange-800 border-orange-300" },
  "مكتملة": { label: "مكتملة", class: "bg-indigo-100 text-indigo-800 border-indigo-300" },
};

export default function TravelBookingsPage() {
  const qc = useQueryClient();
  const { agencyName, agencyNameEn, logoUrl, address, phone, taxNumber, licenseNumber, currency: globalCurrency } = useAgencyConfig();
  const brandConfig = { agencyName, agencyNameEn, logoUrl, address, phone, taxNumber, licenseNumber, currency: globalCurrency };
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [flightStatusFilter, setFlightStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [voucherModalBooking, setVoucherModalBooking] = useState<any | null>(null);

  // Full-Screen Report Viewer
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  const handlePreviewBooking = (bk: any) => {
    const html = buildFlightBoardingPassHtml(bk, brandConfig);
    setReportHtml(html);
    setReportTitle(`تذكرة_طيران_${bk.pnr || bk.booking_number || 'حجز'}`);
    setReportViewerOpen(true);
  };

  const [form, setForm] = useState({
    booking_number: "",
    service_type: "flight",
    customer_id: "",
    passenger_id: "",
    airline_supplier: "",
    supplier_id: "",
    flight_number: "",
    origin_city: "",
    destination_city: "",
    departure_date: "",
    return_date: "",
    ticket_number: "",
    pnr: "",
    status: "confirmed",
    flight_status: "مؤكدة",
    issue_date: new Date().toISOString().slice(0, 10),
    cost_price: "0",
    supplier_currency: "SAR",
    supplier_statement: "قيمة تذكرة طيران",
    selling_price: "0",
    customer_currency: "SAR",
    customer_statement: "قيمة تذكرة طيران",
    agency_commission: "0",
    commission_currency: "SAR",
    payment_status: "paid",
    payment_method: "cash",
    notes: ""
  });

  const { data: bookings = [], isLoading } = useQuery<any[]>({
    queryKey: ["travel-bookings", search, statusFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (statusFilter) q.set("status", statusFilter);
      return fetchWithAuth(`/api/travel/bookings?${q.toString()}`);
    }
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["travel-passengers-list"],
    queryFn: () => fetchWithAuth("/api/travel/passengers")
  });

  const { data: airlines = [] } = useQuery<any[]>({
    queryKey: ["travel-airlines-list"],
    queryFn: () => fetchWithAuth("/api/travel/sub-accounts/21100")
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const targetId = editingBooking?.id || (data.booking_number && bookings.find((b: any) => b.booking_number === data.booking_number)?.id);
      if (targetId) {
        return fetchWithAuth(`/api/travel/bookings/${targetId}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/travel/bookings", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
      setModalOpen(false);
      setEditingBooking(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
    }
  });

  const resetForm = () => {
    setEditingBooking(null);
    setForm({
      booking_number: `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      service_type: "flight",
      customer_id: "",
      passenger_id: "",
      airline_supplier: "",
      supplier_id: "",
      flight_number: "",
      origin_city: "",
      destination_city: "",
      departure_date: "",
      return_date: "",
      ticket_number: "",
      pnr: "",
      status: "confirmed",
      flight_status: "مؤكدة",
      issue_date: new Date().toISOString().slice(0, 10),
      cost_price: "0",
      supplier_currency: "SAR",
      supplier_statement: "قيمة تذكرة طيران",
      selling_price: "0",
      customer_currency: "SAR",
      customer_statement: "قيمة تذكرة طيران",
      agency_commission: "0",
      commission_currency: "SAR",
      payment_status: "paid",
      payment_method: "cash",
      notes: ""
    });
  };

  const handleEdit = (bk: any) => {
    setEditingBooking(bk);
    setForm({
      booking_number: bk.booking_number || "",
      service_type: bk.service_type || "flight",
      customer_id: bk.customer_id ? String(bk.customer_id) : "",
      passenger_id: bk.passenger_id ? String(bk.passenger_id) : "",
      airline_supplier: bk.airline_supplier || "",
      supplier_id: bk.supplier_id ? String(bk.supplier_id) : "",
      flight_number: bk.flight_number || "",
      origin_city: bk.origin_city || "",
      destination_city: bk.destination_city || "",
      departure_date: bk.departure_date || "",
      return_date: bk.return_date || "",
      ticket_number: bk.ticket_number || "",
      pnr: bk.pnr || "",
      status: bk.status || "confirmed",
      flight_status: bk.flight_status || (bk.status === "cancelled" ? "ملغاة" : bk.status === "pending_issue" ? "بانتظار التأكيد" : "مؤكدة"),
      issue_date: bk.issue_date || new Date().toISOString().slice(0, 10),
      cost_price: String(bk.cost_price || 0),
      supplier_currency: bk.supplier_currency || "SAR",
      supplier_statement: bk.supplier_statement || "قيمة تذكرة طيران",
      selling_price: String(bk.selling_price || 0),
      customer_currency: bk.customer_currency || "SAR",
      customer_statement: bk.customer_statement || "قيمة تذكرة طيران",
      agency_commission: String(bk.agency_commission || 0),
      commission_currency: bk.commission_currency || "SAR",
      payment_status: bk.payment_status || "paid",
      payment_method: bk.payment_method || "cash",
      notes: bk.notes || ""
    });
    setModalOpen(true);
  };

  const changeStatus = (bk: any, newStatus: string) => {
    fetchWithAuth(`/api/travel/bookings/${bk.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...bk, status: newStatus })
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
    });
  };

  const costVal = Number(form.cost_price || 0);
  const sellVal = Number(form.selling_price || 0);
  const commVal = sellVal - costVal;

  return (
    <AdminLayout>
      <div className="space-y-6 pb-28 text-right" dir="rtl">
        {/* Top Header Bar (Matching Image Design) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-2">
            <Link href="/licenses">
              <Button size="sm" variant="outline" className="border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs h-9 px-3 gap-1.5 rounded-xl shadow-2xs">
                <span>🔑</span> إدارة الترخيص <ExternalLink className="w-3.5 h-3.5 text-purple-700" />
              </Button>
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 text-blue-900 px-3 py-1.5 rounded-xl border border-blue-200 text-xs font-bold">
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>{agencyName || "وكالة السفريات"}</span>
            </div>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث شامل عن تذكرة، مسافر، PNR، وجهة..."
              className="pr-9 bg-slate-50 border-slate-200 text-xs h-9 rounded-xl focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Link href="/settings">
              <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl" title="الإعدادات">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              onClick={() => qc.invalidateQueries({ queryKey: ["travel-bookings"] })}
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Hero Card - Distinctive Curved Gradient (Matching Uploaded Image) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 p-6 sm:p-8 text-white shadow-2xl border border-blue-600/30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 max-w-2xl text-right">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/25 border border-blue-400/40 rounded-2xl shadow-inner text-blue-300">
                  <Plane className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    حجوزات وتذاكر الطيران والرحلات الجوية
                  </h1>
                  <div className="w-20 h-1 bg-blue-400 rounded-full mt-1.5" />
                </div>
              </div>

              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-medium">
                إدارة شاملة لحجوزات الطيران، إصدار التذاكر الإلكترونية، تتبع PNR، خطوط الطيران والموردين واحتساب العمولات المالية والتحصيلات.
              </p>

              {/* Main CTA: Add Booking Button (Pill Button Matching Image) */}
              <div className="pt-2">
                <Button
                  id="btn-add-flight-booking-hero"
                  onClick={() => { resetForm(); setModalOpen(true); }}
                  className="w-full sm:w-auto bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-sm sm:text-base px-8 py-3 h-auto rounded-2xl shadow-lg shadow-blue-500/30 gap-2 border border-blue-300/40 hover:scale-[1.02] transition-transform"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  إضافة حجز تذكرة جديد
                </Button>
              </div>

              {/* Secondary Actions Row Matching Image */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link href="/travel-airlines">
                  <Button
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/25 text-xs font-bold rounded-xl h-10 px-4 gap-2 backdrop-blur-xs"
                  >
                    <Building2 className="w-4 h-4 text-blue-300" />
                    إضافة شركة طيران
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    const csvRows = [
                      ["رقم الحجز", "PNR", "العميل", "المسافر", "الناقل", "رقم الرحلة", "المسار", "تاريخ الإقلاع", "السعر", "الحالة"],
                      ...bookings.map((b: any) => [
                        b.booking_number || "",
                        b.pnr || "",
                        b.customer_name || "",
                        b.passenger_name || "",
                        b.airline_supplier || "",
                        b.flight_number || "",
                        `${b.origin_city || ""} -> ${b.destination_city || ""}`,
                        b.departure_date || "",
                        b.selling_price || "0",
                        b.status || ""
                      ])
                    ];
                    const blob = new Blob(["\uFEFF" + csvRows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `حجوزات_تذاكر_الطيران_${new Date().toISOString().slice(0, 10)}.csv`;
                    link.click();
                  }}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/25 text-xs font-bold rounded-xl h-10 px-4 gap-2 backdrop-blur-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-300" />
                  تصدير كشف Excel
                </Button>
              </div>
            </div>

            {/* Decorative Plane Emblem Badge */}
            <div className="hidden lg:flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md shrink-0 w-64 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 mb-3 shadow-lg">
                <Plane className="w-10 h-10" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">نظام الطيران الموحد</span>
              <span className="text-[11px] text-blue-300/80 mt-1 font-mono">OmniFly Air Global</span>
            </div>
          </div>
        </div>

        {/* Current Transactions Status Card (Matching Image) */}
        {(() => {
          const completedCount = bookings.filter((b: any) => b.status === "issued" || b.status === "confirmed").length;
          const renewingCount = bookings.filter((b: any) => b.status === "pending_issue" || b.status === "pending").length;
          const delayedCount = bookings.filter((b: any) => b.status === "cancelled" || b.status === "refunded").length;
          return (
            <Card className="border-slate-200/80 shadow-sm bg-white overflow-hidden rounded-2xl">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                        <span className="text-blue-600 font-black">|</span> المعاملات الحالية
                      </h3>
                      <p className="text-[11px] text-muted-foreground">حالة تذاكر الطيران والرحلات الجوية المسجلة في النظام</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-around sm:justify-end gap-3 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">تم</span>
                      <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-sm flex items-center justify-center border border-emerald-300 shadow-2xs">
                        {completedCount}
                      </span>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">يتم تجديدها</span>
                      <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-mono font-bold text-sm flex items-center justify-center border border-blue-300 shadow-2xs">
                        {renewingCount}
                      </span>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">معاملة معلقة</span>
                      <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-sm flex items-center justify-center border border-amber-300 shadow-2xs">
                        {delayedCount}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Mobile & Tablet Quick Actions Stack (Matching Image Layout) */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
          <Button
            onClick={() => { resetForm(); setModalOpen(true); }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-md gap-2"
          >
            <Plus className="w-4 h-4" /> إضافة معاملة جديدة
          </Button>

          <Button
            onClick={() => {
              if (selectedBooking) {
                handleEdit(selectedBooking);
              } else {
                alert("يرجى اختيار تذكرة من الجدول لتعديلها");
              }
            }}
            variant="outline"
            className="flex-1 border-blue-400 text-blue-700 bg-blue-50/50 hover:bg-blue-100 font-bold h-11 rounded-xl gap-2"
          >
            <Edit2 className="w-4 h-4" /> تعديل المعاملة
          </Button>

          <Button
            onClick={() => {
              if (selectedBooking) {
                setVoucherModalBooking(selectedBooking);
              } else {
                alert("يرجى اختيار تذكرة من الجدول لمعاينتها وطباعتها");
              }
            }}
            className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold h-11 rounded-xl shadow-md gap-2"
          >
            <Printer className="w-4 h-4" /> طباعة المعاملة (استعراضي)
          </Button>

          <Button
            onClick={() => {
              if (selectedBooking) {
                handlePreviewBooking(selectedBooking);
              } else {
                alert("يرجى اختيار تذكرة من الجدول لاستعراضها وتصديرها كـ PDF");
              }
            }}
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold h-11 rounded-xl shadow-md gap-2"
          >
            <Maximize2 className="w-4 h-4" />
            <FileDown className="w-4 h-4" />
            شاشة كاملة وتصدير PDF
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="ابحث برقم التذكرة، الـ PNR، اسم العميل أو المسافر..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-44"
            >
              <option value="">جميع حالات التذكرة</option>
              <option value="confirmed">مؤكد</option>
              <option value="issued">مصدرة</option>
              <option value="pending_issue">بانتظار الإصدار</option>
              <option value="cancelled">ملغاة</option>
              <option value="refunded">مسترجعة</option>
              <option value="reissued">معاد إصدارها</option>
            </select>
            <select
              value={flightStatusFilter}
              onChange={e => setFlightStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-44"
            >
              <option value="">جميع حالات الرحلة</option>
              <option value="مؤكدة">مؤكدة</option>
              <option value="بانتظار التأكيد">بانتظار التأكيد</option>
              <option value="ملغاة">ملغاة</option>
              <option value="مؤجلة">مؤجلة</option>
              <option value="مكتملة">مكتملة</option>
            </select>
          </div>
        </Card>

        {/* Bookings Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">جدول التذاكر والحجوزات ({bookings.filter(b => !flightStatusFilter || (b.flight_status || 'مؤكدة') === flightStatusFilter).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل الحجوزات...</div>
            ) : bookings.filter(b => !flightStatusFilter || (b.flight_status || 'مؤكدة') === flightStatusFilter).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد حجوزات مطابقة للبحث</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold">
                      <th className="p-3">رقم الحجز/PNR</th>
                      <th className="p-3">العميل / المسافر</th>
                      <th className="p-3">شركة الطيران / الرحلة</th>
                      <th className="p-3">المسار (من - إلى)</th>
                      <th className="p-3">رقم التذكرة</th>
                      <th className="p-3">التكلفة / سعر البيع</th>
                      <th className="p-3">عمولة المكتب</th>
                      <th className="p-3">حالة الرحلة</th>
                      <th className="p-3">حالة التذكرة</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings
                      .filter(b => !flightStatusFilter || (b.flight_status || 'مؤكدة') === flightStatusFilter)
                      .map((bk, idx) => {
                      const badge = STATUS_BADGES[bk.status] || { label: bk.status, class: "bg-slate-100" };
                      const fStatus = bk.flight_status || (bk.status === "cancelled" ? "ملغاة" : bk.status === "pending_issue" ? "بانتظار التأكيد" : "مؤكدة");
                      const fBadge = FLIGHT_STATUS_BADGES[fStatus] || { label: fStatus, class: "bg-slate-100 text-slate-800 border-slate-200" };
                      return (
                        <tr key={`bk-${bk.id || idx}-${idx}`} onClick={() => setSelectedBooking(bk)} className={`border-b hover:bg-slate-50 transition-colors cursor-pointer ${selectedBooking?.id === bk.id ? "bg-blue-50/50 ring-1 ring-inset ring-blue-300" : ""}`}>
                          <td className="p-3">
                            <div className="font-bold font-mono text-primary">{bk.booking_number}</div>
                            {bk.pnr && (
                              <div className="text-xs font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded inline-block font-semibold">
                                PNR: {bk.pnr}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{bk.customer_name || "عميل عام"}</div>
                            <div className="text-xs text-muted-foreground">👤 {bk.passenger_name_ar || bk.passenger_name_en || "نفس العميل"}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className="font-semibold text-slate-800">{bk.airline_supplier || "غير محدد"}</div>
                            <div className="font-mono text-muted-foreground">{bk.flight_number || "-"}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className="font-bold">{bk.origin_city || "-"} ⬅️ {bk.destination_city || "-"}</div>
                            <div className="text-[11px] text-muted-foreground">📅 المغادرة: {bk.departure_date || "-"}</div>
                          </td>
                          <td className="p-3 font-mono text-xs font-semibold">
                            {bk.ticket_number || "-"}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <div className="text-muted-foreground">شراء: {Number(bk.cost_price || 0).toLocaleString()}</div>
                            <div className="font-bold text-slate-900">بيع: {Number(bk.selling_price || 0).toLocaleString()}</div>
                          </td>
                          <td className="p-3 font-mono text-xs font-bold text-emerald-700 bg-emerald-50/50">
                            +{Number(bk.commission || 0).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full border ${fBadge.class}`}>
                              {fBadge.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="استعراض قبل الطباعة وتصدير PDF" onClick={() => handlePreviewBooking(bk)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-700 hover:bg-slate-100" title="طباعة الفاتورة / القسيمة" onClick={() => setVoucherModalBooking(bk)}>
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="تعديل الحجز" onClick={() => handleEdit(bk)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {bk.status !== "issued" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="تأكيد وإصدار التذكرة" onClick={() => changeStatus(bk, "issued")}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                title="حذف الحجز"
                                onClick={() => {
                                  if (confirm(`هل أنت تأكد من حذف الحجز "${bk.booking_number}"؟`)) {
                                    deleteMutation.mutate(bk.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Full-Screen Flight Booking Window */}
        <FlightBookingFullscreenDialog
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingBooking(null);
          }}
          booking={editingBooking}
          bookingsList={bookings}
          customers={customers}
          passengers={passengers}
          airlines={airlines}
          onSave={(data) => saveMutation.mutateAsync(data)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onPrintVoucher={(bk) => setVoucherModalBooking(bk)}
          isSaving={saveMutation.isPending}
          onCustomerAdded={() => qc.invalidateQueries({ queryKey: ["customers-list"] })}
        />

        {/* Voucher / Invoice Print Dialog */}
        <Dialog open={Boolean(voucherModalBooking)} onOpenChange={open => !open && setVoucherModalBooking(null)}>
          <DialogContent dir="rtl" className="w-[calc(100%-0.75rem)] sm:w-full max-w-5xl max-h-[94dvh] flex flex-col p-0 overflow-hidden [&>button]:hidden rounded-2xl">
            <div className="bg-slate-900 text-white px-3 sm:px-5 py-3 flex items-center justify-between gap-2 shrink-0 border-b border-slate-800">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-xs sm:text-base font-bold text-white truncate">
                  <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
                  <span className="truncate">تذكرة الطيران الإلكترونية (Boarding Pass & E-Ticket)</span>
                </DialogTitle>
                <DialogDescription className="text-[10px] sm:text-xs text-slate-300 truncate mt-0.5">
                  معاينة التذكرة المعتمدة الجاهزة للطباعة أو التصدير بصيغة PDF
                </DialogDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setVoucherModalBooking(null)}
                className="h-9 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1 rounded-xl shrink-0 shadow"
              >
                <X className="w-4 h-4" />
                <span>إغلاق</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-5 bg-slate-50">
              {voucherModalBooking && (
                <div
                  id="print-area"
                  dangerouslySetInnerHTML={{
                    __html: buildFlightBoardingPassBody(voucherModalBooking, brandConfig)
                  }}
                />
              )}
            </div>

            <DialogFooter className="p-3 sm:p-4 bg-white border-t border-slate-200 flex flex-row flex-wrap items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setVoucherModalBooking(null)} className="h-9 px-3 rounded-xl font-bold">إغلاق</Button>
              <Button
                type="button"
                onClick={() => {
                  const bk = voucherModalBooking;
                  setVoucherModalBooking(null);
                  handlePreviewBooking(bk);
                }}
                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 rounded-xl text-xs sm:text-sm"
              >
                <Maximize2 className="w-4 h-4" />
                <span>شاشة كاملة / PDF</span>
              </Button>
              <Button
                type="button"
                onClick={() => printA4Html(buildFlightBoardingPassHtml(voucherModalBooking, brandConfig), `تذكرة طيران - ${voucherModalBooking.pnr || voucherModalBooking.booking_number}`)}
                className="h-9 px-3 bg-primary hover:bg-primary/90 font-bold gap-1.5 rounded-xl text-xs sm:text-sm"
              >
                <Printer className="w-4 h-4" /> طباعة التذكرة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        
      </div>

        {/* BOTTOM ACTION BAR (Desktop only; mobile uses stacked actions + AdminLayout dock) */}
        <div className="hidden lg:block fixed bottom-0 right-0 left-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] p-4 z-40">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">المعاملة المحددة حالياً:</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {selectedBooking ? `${selectedBooking.booking_number} - (${selectedBooking.passenger_name || selectedBooking.customer_name})` : "لم يتم تحديد معاملة"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                id="btn-bottom-add"
                onClick={() => { resetForm(); setModalOpen(true); }}
                className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 px-5 shadow-md shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                حجز جديد
              </Button>

              <Button
                id="btn-bottom-edit"
                disabled={!selectedBooking}
                onClick={() => selectedBooking && handleEdit(selectedBooking)}
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-50 font-bold gap-2"
              >
                <Edit2 className="w-4 h-4" />
                تعديل ✏️
              </Button>
              
              <Button
                id="btn-bottom-search"
                onClick={() => document.getElementById("search-flight-bookings")?.focus()}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-bold gap-2"
              >
                <Search className="w-4 h-4" />
                بحث 🔍
              </Button>

              <Button
                id="btn-bottom-print"
                disabled={!selectedBooking}
                onClick={() => selectedBooking && setVoucherModalBooking(selectedBooking)}
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold gap-2"
              >
                <Printer className="w-4 h-4" />
                طباعة القسيمة 🖨️
              </Button>

              <Button
                id="btn-bottom-delete"
                disabled={!selectedBooking}
                onClick={() => {
                  if (selectedBooking && confirm(`هل أنت متأكد من حذف الحجز "${selectedBooking.booking_number}"؟`)) {
                    deleteMutation.mutate(selectedBooking.id);
                    setSelectedBooking(null);
                  }
                }}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 font-bold gap-2"
              >
                <Trash2 className="w-4 h-4" />
                حذف 🗑️
              </Button>
            </div>
          </div>
        </div>

        {/* Full-Screen Report Viewer Modal for Ticket Preview & PDF Export */}
        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={reportTitle}
          landscape={true}
        />

    </AdminLayout>
  );
}
