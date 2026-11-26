import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useGetSettings } from "@workspace/api-client-react";
import { useAgencyConfig } from "@/hooks/use-agency-config";
import { Loader2, DollarSign, Plane, Ticket, Globe, Hotel, TrendingUp, AlertTriangle, Users, Wallet, ShieldAlert, Calendar, CheckCircle2, Bus, Luggage, RotateCcw, ArrowLeft, Sparkles, Building2, ExternalLink, Phone, MessageSquare, Search, ArrowRight, ShieldCheck, Clock, FileText, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : "") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysUntil(dateStr?: string) {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

const COLORS = ["#1e3a5f", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function TravelDashboardPage() {
  const { agencyName, currency: globalCurrency } = useAgencyConfig();
  const [expiringModalOpen, setExpiringModalOpen] = useState(false);
  const [pendingVisasModalOpen, setPendingVisasModalOpen] = useState(false);
  const [upcomingFlightsModalOpen, setUpcomingFlightsModalOpen] = useState(false);
  const [searchPassport, setSearchPassport] = useState("");
  const [searchVisa, setSearchVisa] = useState("");
  const [searchFlight, setSearchFlight] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["travel-dashboard-stats"],
    queryFn: () => fetchWithAuth("/api/travel/dashboard-stats")
  });

  const currencySymbol = data?.primaryCurrency || globalCurrency || "ريال";

  if (isLoading || !data) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const kpis = data.kpis || {};
  const charts = data.charts || {};
  const alerts = data.alerts || {};

  return (
    <AdminLayout>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black flex items-center gap-2 text-slate-900">
              <Plane className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />
              <span className="truncate">لوحة قيادة {agencyName}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
              متابعة العمليات التشغيلية، مبيعات التذاكر، التأشيرات، الفنادق، أرباح العمولات والتنبيهات المباشرة
            </p>
          </div>
          <div className="text-xs sm:text-sm text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl font-semibold self-start sm:self-auto shrink-0">
            📅 {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Row 1: Primary Financial & Travel KPIs */}
        <div>
          <h2 className="text-xs font-bold text-slate-600 mb-2.5">المؤشرات التشغيلية والمالية الرئيسية</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border border-slate-200/90 shadow-xs hover:border-primary/40 transition-colors">
              <CardContent className="p-3.5">
                <p className="text-xs text-slate-500 font-medium">مبيعات اليوم</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-slate-900 mt-1 truncate">{fmt(kpis.todaySales)} <span className="text-[11px] font-sans font-bold text-slate-500">{currencySymbol}</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">{kpis.todayBookings} حجز اليوم</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs hover:border-blue-400 transition-colors">
              <CardContent className="p-3.5">
                <p className="text-xs text-slate-500 font-medium">مبيعات الشهر</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-blue-700 mt-1 truncate">{fmt(kpis.monthSales)} <span className="text-[11px] font-sans font-bold text-blue-600/80">{currencySymbol}</span></p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs hover:border-emerald-400 transition-colors">
              <CardContent className="p-3.5">
                <p className="text-xs text-slate-500 font-medium">عمولة المكتب (الشهر)</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-emerald-700 mt-1 truncate">{fmt(kpis.monthCommission)} <span className="text-[11px] font-sans font-bold text-emerald-600/80">{currencySymbol}</span></p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs hover:border-indigo-400 transition-colors">
              <CardContent className="p-3.5">
                <p className="text-xs text-slate-500 font-medium">صافي الأرباح</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-indigo-700 mt-1 truncate">{fmt(kpis.netProfit)} <span className="text-[11px] font-sans font-bold text-indigo-600/80">{currencySymbol}</span></p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs hover:border-amber-400 transition-colors">
              <CardContent className="p-3.5">
                <p className="text-xs text-slate-500 font-medium">مستحق على العملاء</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-amber-700 mt-1 truncate">{fmt(kpis.customerDebts)} <span className="text-[11px] font-sans font-bold text-amber-600/80">{currencySymbol}</span></p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs hover:border-purple-400 transition-colors">
              <CardContent className="p-3.5">
                <p className="text-xs text-slate-500 font-medium">رصيد الخزائن والصندوق</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-purple-700 mt-1 truncate">{fmt(kpis.safeBalance)} <span className="text-[11px] font-sans font-bold text-purple-600/80">{currencySymbol}</span></p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row 2: 5 Quick Access Shortcuts */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              اختصارات الوصول السريع لخدمات وشاشات النظام الرئيسية
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
              انقر على أي اختصار للانتقال الفوري للشاشة المطلوبة ⚡
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* الاختصار رقم 1: شاشة إدارة العملاء والشركات (نظام السفريات) */}
            <Link href="/customers" className="block focus:outline-none">
              <Card
                id="shortcut-card-1-customers"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-indigo-500/40 hover:border-indigo-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      اختصار 1
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/25 transition-all">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">نظام السفريات والسياحة</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors mt-0.5 line-clamp-1">
                      إدارة العملاء والشركات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-indigo-300">
                        {kpis.customersCount ?? 4}
                      </span>
                      <span className="text-[11px] text-slate-400">عميل / شركة</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-indigo-300 font-medium group-hover:text-indigo-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-indigo-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 2: شاشة معاملات وخدمات التأشيرات (خدمات وحجوزات السفر) */}
            <Link href="/travel-visas" className="block focus:outline-none">
              <Card
                id="shortcut-card-2-visas"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-teal-500/40 hover:border-teal-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30">
                      اختصار 2
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center text-teal-400 group-hover:scale-110 group-hover:bg-teal-500/25 transition-all">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">خدمات وحجوزات السفر</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-teal-200 transition-colors mt-0.5 line-clamp-1">
                      معاملات وخدمات التأشيرات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-teal-300">
                        {kpis.visaTransactions ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">معاملة تأشيرة</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-teal-300 font-medium group-hover:text-teal-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-teal-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 3: شاشة حجوزات النقل البري (خدمات وحجوزات السفر) */}
            <Link href="/travel-bus-tickets" className="block focus:outline-none">
              <Card
                id="shortcut-card-3-bus"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      اختصار 3
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/25 transition-all">
                      <Bus className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">خدمات وحجوزات السفر</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-200 transition-colors mt-0.5 line-clamp-1">
                      حجوزات النقل البري والباصات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-emerald-300">
                        {kpis.busBookingsCount ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">تذكرة وحجز</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-300 font-medium group-hover:text-emerald-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-emerald-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 4: شاشة إدارة المسافرين والجوازات (نظام السفريات) */}
            <Link href="/passengers" className="block focus:outline-none">
              <Card
                id="shortcut-card-4-passengers"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      اختصار 4
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/25 transition-all">
                      <Luggage className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">نظام السفريات والسياحة</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5 line-clamp-1">
                      إدارة المسافرين والجوازات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-amber-300">
                        {kpis.passengersCount ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">مسافر مسجل</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-300 font-medium group-hover:text-amber-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-amber-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 5: شاشة فواتير ومردودات الخدمات والاسترجاع المعاملات (خدمات وحجوزات السفر) */}
            <Link href="/travel-refunds" className="block focus:outline-none">
              <Card
                id="shortcut-card-5-refunds"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-rose-500/40 hover:border-rose-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30">
                      اختصار 5
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 group-hover:scale-110 group-hover:bg-rose-500/25 transition-all">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">خدمات وحجوزات السفر</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors mt-0.5 line-clamp-1">
                      فواتير ومردودات الخدمات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-rose-300">
                        {kpis.refundsCount ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">عملية استرجاع</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-rose-300 font-medium group-hover:text-rose-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-rose-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-bold">أكثر شركات الطيران استخداماً</CardTitle>
            </CardHeader>
            <CardContent className="h-56 sm:h-64 px-2 sm:px-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.airlineStats || []} margin={{ top: 5, right: 8, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v: number) => [fmt(v), "المبيعات"]} />
                  <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-bold">أكثر الوجهات والمدن طلبًا</CardTitle>
            </CardHeader>
            <CardContent className="h-56 sm:h-64 px-2 sm:px-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.destStats || []} layout="vertical" margin={{ top: 5, right: 12, bottom: 5, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, "عدد الحجوزات"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Flight Performance Widget */}
        <Card className="border border-indigo-100 shadow-xs">
          <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-slate-900">
                <Plane className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>مؤشر أداء الرحلات الجوية</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                تحليل حالة ومعدل الرحلات النشطة، المؤكدة، قيد الانتظار، والملغاة
              </CardDescription>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 shrink-0">
              محدث لحظياً ⚡
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.flightPerformance || []}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={5}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {(charts.flightPerformance || []).map((entry: any, index: number) => (
                        <Cell key={`flight-perf-cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "عدد الرحلات"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-700">توزيع حالات الطيران والرحلات:</p>
                <div className="space-y-2">
                  {(charts.flightPerformance || []).map((item: any, idx: number) => (
                    <div key={`flight-perf-item-${idx}`} className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0" style={{ backgroundColor: item.color || COLORS[idx % COLORS.length] }} />
                        <span className="font-bold text-slate-800">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums font-black text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                        {item.count} رحلة
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Alerts Section - Fully Interactive with Modal Popups */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>المؤشرات الرقابية والتنبيهات المباشرة (انقر لعرض القائمة التفصيلية)</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              تنبيهات فورية لضمان سلامة العمليات وعدم فوات المواعيد ⚡
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Alert 1: Expiring Passports */}
            <Card 
              onClick={() => setExpiringModalOpen(true)}
              className="border-t-4 border-t-amber-500 cursor-pointer hover:shadow-lg hover:border-amber-400 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                  عرض القائمة <ExternalLink className="w-3 h-3" />
                </span>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-900">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span>جوازات سفر تنتهي قريباً (خلال 6 أشهر)</span>
                  <span className="mr-auto font-mono text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                    {alerts.expiringPassports?.length || 0}
                  </span>
                </CardTitle>
                <CardDescription className="text-[11px]">
                  انقر هنا لاستعراض قائمة الجوازات المنتهية أو التي قاربت على الانتهاء
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {alerts.expiringPassports?.length === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-emerald-800">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      لا توجد جوازات تنتهي قريباً ✅
                    </span>
                    <span className="text-[10px] text-emerald-600 underline font-semibold">استعراض المسافرين</span>
                  </div>
                ) : (
                  alerts.expiringPassports?.slice(0, 3).map((p: any, idx: number) => {
                    const daysLeft = getDaysUntil(p.passport_expiry_date);
                    const isExpired = daysLeft !== null && daysLeft < 0;
                    return (
                      <div key={`traveldashboard-p-id-${p.id || idx}-${idx}`} className="flex items-center justify-between p-2.5 bg-amber-50/80 hover:bg-amber-100/80 rounded-lg border border-amber-200 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1">
                            {p.name_ar || p.name_en}
                            {isExpired ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 font-bold">منتهي</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-800 font-bold">متبقي {daysLeft} يوم</span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">{p.passport_number}</p>
                        </div>
                        <span className="font-mono text-amber-900 font-bold text-xs">{p.passport_expiry_date}</span>
                      </div>
                    );
                  })
                )}
                {alerts.expiringPassports?.length > 3 && (
                  <p className="text-[11px] text-amber-700 text-center font-bold pt-1">
                    + {alerts.expiringPassports.length - 3} جوازات أخرى (انقر للتفاصيل الكاملة)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Alert 2: Pending Visas */}
            <Card 
              onClick={() => setPendingVisasModalOpen(true)}
              className="border-t-4 border-t-blue-500 cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  عرض القائمة <ExternalLink className="w-3 h-3" />
                </span>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 group-hover:scale-110 transition-transform">
                    <Globe className="w-4 h-4" />
                  </div>
                  <span>تأشيرات قيد المتابعة والوثائق الناقصة</span>
                  <span className="mr-auto font-mono text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                    {alerts.pendingVisas?.length || 0}
                  </span>
                </CardTitle>
                <CardDescription className="text-[11px]">
                  انقر هنا لاستعراض التأشيرات تحت الإجراء والوثائق المطلوب استكمالها
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {alerts.pendingVisas?.length === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-emerald-800">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      لا توجد تأشيرات قيد الانتظار ✅
                    </span>
                    <span className="text-[10px] text-emerald-600 underline font-semibold">إدارة التأشيرات</span>
                  </div>
                ) : (
                  alerts.pendingVisas?.slice(0, 3).map((v: any, idx) => (
                    <div key={`traveldashboard-v-id-${v.id || idx}-${idx}`} className="p-2.5 bg-blue-50/80 hover:bg-blue-100/80 rounded-lg border border-blue-200 space-y-1 transition-colors">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span className="truncate max-w-[180px]">{v.customer_name || v.passenger_name} ({v.country})</span>
                        <span className="font-mono text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-bold">{v.visa_number}</span>
                      </div>
                      {v.missing_docs ? (
                        <p className="text-amber-800 font-bold text-[11px]">⚠️ نواقص: {v.missing_docs}</p>
                      ) : (
                        <p className="text-blue-700 font-medium text-[11px]">قيد المعالجة بالسفارة / القنصلية</p>
                      )}
                    </div>
                  ))
                )}
                {alerts.pendingVisas?.length > 3 && (
                  <p className="text-[11px] text-blue-700 text-center font-bold pt-1">
                    + {alerts.pendingVisas.length - 3} معاملات أخرى (انقر للتفاصيل الكاملة)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Alert 3: Upcoming Flights */}
            <Card 
              onClick={() => setUpcomingFlightsModalOpen(true)}
              className="border-t-4 border-t-emerald-500 cursor-pointer hover:shadow-lg hover:border-emerald-400 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  عرض القائمة <ExternalLink className="w-3 h-3" />
                </span>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-900">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
                    <Plane className="w-4 h-4" />
                  </div>
                  <span>رحلات قادمة (خلال الـ 7 أيام القادمة)</span>
                  <span className="mr-auto font-mono text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {alerts.upcomingFlights?.length || 0}
                  </span>
                </CardTitle>
                <CardDescription className="text-[11px]">
                  انقر هنا لمتابعة مواعيد إقلاع رحلات المسافرين والتأكيد
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {alerts.upcomingFlights?.length === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-emerald-800">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      لا توجد مغادرات قريبة جداً ✅
                    </span>
                    <span className="text-[10px] text-emerald-600 underline font-semibold">حجوزات الطيران</span>
                  </div>
                ) : (
                  alerts.upcomingFlights?.slice(0, 3).map((f: any, idx: number) => (
                    <div key={`traveldashboard-f-id-${f.id || idx}-${idx}`} className="flex items-center justify-between p-2.5 bg-emerald-50/80 hover:bg-emerald-100/80 rounded-lg border border-emerald-200 transition-colors">
                      <div>
                        <p className="font-bold text-slate-900">{f.customer_name || f.passenger_name} - {f.destination_city}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{f.airline_supplier} ({f.flight_number || "رحلة مجدولة"})</p>
                      </div>
                      <span className="font-mono text-emerald-800 font-bold text-xs">{f.departure_date}</span>
                    </div>
                  ))
                )}
                {alerts.upcomingFlights?.length > 3 && (
                  <p className="text-[11px] text-emerald-700 text-center font-bold pt-1">
                    + {alerts.upcomingFlights.length - 3} رحلات أخرى (انقر للتفاصيل الكاملة)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 1: Expiring & Expired Passports Dialog */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={expiringModalOpen} onOpenChange={setExpiringModalOpen}>
          <DialogContent className="w-[calc(100%-0.75rem)] sm:w-full max-w-4xl max-h-[90dvh] flex flex-col p-0 overflow-hidden bg-slate-50 rounded-2xl border-amber-300 [&>button]:hidden">
            <DialogHeader className="p-3 sm:p-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-white/20 rounded-lg shrink-0">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 text-right">
                    <DialogTitle className="text-sm sm:text-lg font-bold text-white leading-snug">
                      جوازات السفر المنتهية أو التي تنتهي قريباً (خلال 6 أشهر)
                    </DialogTitle>
                    <DialogDescription className="text-amber-100 text-[11px] sm:text-xs">
                      سجل تفصيلي بجوازات سفر المسافرين والعملاء لتنبيههم والتجديد المبكر قبل السفر
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-white">
                    {alerts.expiringPassports?.length || 0} جواز مسجل
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpiringModalOpen(false)}
                    aria-label="إغلاق"
                    className="h-9 w-9 rounded-full bg-white/20 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 bg-white border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <Input
                  value={searchPassport}
                  onChange={(e) => setSearchPassport(e.target.value)}
                  placeholder="ابحث باسم المسافر، رقم الجواز، أو الجنسية..."
                  className="pr-9 text-xs h-9 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                const list = (alerts.expiringPassports || []).filter((p: any) => {
                  if (!searchPassport) return true;
                  const q = searchPassport.toLowerCase();
                  return (
                    (p.name_ar && p.name_ar.toLowerCase().includes(q)) ||
                    (p.name_en && p.name_en.toLowerCase().includes(q)) ||
                    (p.passport_number && p.passport_number.toLowerCase().includes(q)) ||
                    (p.nationality && p.nationality.toLowerCase().includes(q))
                  );
                });

                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 px-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">لا توجد جوازات سفر منتهية أو قاربت على الانتهاء</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        جميع جوازات سفر المسافرين المسجلة في النظام سارية المفعول وصالحة لأكثر من 6 أشهر.
                      </p>
                      <div className="mt-4">
                        <Link href="/passengers">
                          <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white gap-2 font-bold text-xs">
                            <Users className="w-4 h-4" /> استعراض كافة المسافرين والجوازات
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {list.map((p: any, idx: number) => {
                      const daysLeft = getDaysUntil(p.passport_expiry_date);
                      const isExpired = daysLeft !== null && daysLeft < 0;
                      return (
                        <div key={`modal-passport-${p.id || idx}`} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-amber-400 transition-all space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{p.name_ar || p.name_en}</h4>
                              {p.name_en && p.name_ar && <p className="text-[11px] text-muted-foreground font-medium">{p.name_en}</p>}
                            </div>
                            {isExpired ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                ⚠️ منتهي الصلاحية
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ⏳ ينتهي خلال {daysLeft} يوم
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-500 block">رقم الجواز:</span>
                              <span className="font-mono font-bold text-slate-900">{p.passport_number || "---"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">تاريخ الانتهاء:</span>
                              <span className="font-mono font-bold text-rose-700">{p.passport_expiry_date || "---"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">الجنسية:</span>
                              <span className="font-bold text-slate-700">{p.nationality || "غير محدد"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">رقم التواصل:</span>
                              <span className="font-mono font-bold text-slate-700">{p.phone || "---"}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            {p.phone ? (
                              <a 
                                href={`https://wa.me/${p.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`السلام عليكم ${p.name_ar || ''}، نود تذكيركم بأن صلاحية جواز السفر رقم ${p.passport_number || ''} تنتهي بتاريخ ${p.passport_expiry_date || ''}. يرجى التجديد لضمان سفر مريح.`)}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> تذكير واتساب
                              </a>
                            ) : <span />}
                            <Link href="/passengers">
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-700 hover:bg-indigo-50 font-bold gap-1">
                                فتح ملف المسافر <ArrowLeft className="w-3 h-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                إدارة المسافرين والجوازات • أومني فلاي برو
              </span>
              <div className="flex items-center gap-2">
                <Link href="/passengers">
                  <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs gap-1.5">
                    <Users className="w-3.5 h-3.5" /> شاشة المسافرين والجوازات
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => setExpiringModalOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 2: Pending Visas & Missing Documents Dialog */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={pendingVisasModalOpen} onOpenChange={setPendingVisasModalOpen}>
          <DialogContent className="w-[calc(100%-0.75rem)] sm:w-full max-w-4xl max-h-[90dvh] flex flex-col p-0 overflow-hidden bg-slate-50 rounded-2xl border-blue-300 [&>button]:hidden">
            <DialogHeader className="p-3 sm:p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-white/20 rounded-lg shrink-0">
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 text-right">
                    <DialogTitle className="text-sm sm:text-lg font-bold text-white leading-snug">
                      تأشيرات قيد المتابعة والوثائق الناقصة
                    </DialogTitle>
                    <DialogDescription className="text-blue-100 text-[11px] sm:text-xs">
                      متابعة معاملات التأشيرات الإلكترونية والسفارات واستكمال النواقص المطلوبة
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-white">
                    {alerts.pendingVisas?.length || 0} تأشيرة تحت الإجراء
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingVisasModalOpen(false)}
                    aria-label="إغلاق"
                    className="h-9 w-9 rounded-full bg-white/20 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 bg-white border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <Input
                  value={searchVisa}
                  onChange={(e) => setSearchVisa(e.target.value)}
                  placeholder="ابحث برقم التأشيرة، اسم العميل، المسافر، أو الدولة..."
                  className="pr-9 text-xs h-9 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                const list = (alerts.pendingVisas || []).filter((v: any) => {
                  if (!searchVisa) return true;
                  const q = searchVisa.toLowerCase();
                  return (
                    (v.visa_number && v.visa_number.toLowerCase().includes(q)) ||
                    (v.customer_name && v.customer_name.toLowerCase().includes(q)) ||
                    (v.passenger_name && v.passenger_name.toLowerCase().includes(q)) ||
                    (v.country && v.country.toLowerCase().includes(q))
                  );
                });

                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 px-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">لا توجد تأشيرات قيد الانتظار أو وثائق ناقصة</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        جميع معاملات التأشيرات مكتملة ومصدرة بنجاح، ولا توجد ملفات متأخرة حالياً.
                      </p>
                      <div className="mt-4">
                        <Link href="/travel-visas">
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold text-xs">
                            <Globe className="w-4 h-4" /> فتح شاشة إدارة التأشيرات
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {list.map((v: any, idx: number) => (
                      <div key={`modal-visa-${v.id || idx}`} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                                {v.visa_number}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {v.country}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-1">
                              {v.customer_name || v.passenger_name || "عميل غير محدد"}
                            </h4>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'pending_docs' 
                              ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {v.status === 'pending_docs' ? 'نواقص وثائق' : 'قيد المعالجة'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-500 block">نوع التأشيرة:</span>
                            <span className="font-bold text-slate-800">{v.visa_type || "سياحية / عمل"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">تاريخ التقديم:</span>
                            <span className="font-mono font-bold text-slate-700">{v.submission_date || v.created_at?.slice(0, 10) || "---"}</span>
                          </div>
                        </div>

                        {v.missing_docs && (
                          <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                              <strong className="block text-[11px]">الوثائق المطلوب استكمالها:</strong>
                              <span className="text-amber-800 font-medium">{v.missing_docs}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {v.customer_phone ? `📞 ${v.customer_phone}` : ""}
                          </span>
                          <Link href="/travel-visas">
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-700 hover:bg-blue-50 font-bold gap-1">
                              متابعة التأشيرة <ArrowLeft className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                إدارة التأشيرات والسفارات • أومني فلاي برو
              </span>
              <div className="flex items-center gap-2">
                <Link href="/travel-visas">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> شاشة إدارة التأشيرات
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => setPendingVisasModalOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 3: Upcoming Flights (Next 7 Days) Dialog */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <Dialog open={upcomingFlightsModalOpen} onOpenChange={setUpcomingFlightsModalOpen}>
          <DialogContent className="w-[calc(100%-0.75rem)] sm:w-full max-w-4xl max-h-[90dvh] flex flex-col p-0 overflow-hidden bg-slate-50 rounded-2xl border-emerald-300 [&>button]:hidden">
            <DialogHeader className="p-3 sm:p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-white/20 rounded-lg shrink-0">
                    <Plane className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 text-right">
                    <DialogTitle className="text-sm sm:text-lg font-bold text-white leading-snug">
                      رحلات الطيران القادمة (خلال الـ 7 أيام القادمة)
                    </DialogTitle>
                    <DialogDescription className="text-emerald-100 text-[11px] sm:text-xs">
                      متابعة مغادرات المسافرين، أرقام الرحلات، التأكيد وإصدار بطاقات صعود الطائرة
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-white">
                    {alerts.upcomingFlights?.length || 0} رحلة مجدولة
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpcomingFlightsModalOpen(false)}
                    aria-label="إغلاق"
                    className="h-9 w-9 rounded-full bg-white/20 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 bg-white border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <Input
                  value={searchFlight}
                  onChange={(e) => setSearchFlight(e.target.value)}
                  placeholder="ابحث باسم المسافر، رقم الرحلة، PNR، أو الوجهة..."
                  className="pr-9 text-xs h-9 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                const list = (alerts.upcomingFlights || []).filter((f: any) => {
                  if (!searchFlight) return true;
                  const q = searchFlight.toLowerCase();
                  return (
                    (f.customer_name && f.customer_name.toLowerCase().includes(q)) ||
                    (f.passenger_name && f.passenger_name.toLowerCase().includes(q)) ||
                    (f.flight_number && f.flight_number.toLowerCase().includes(q)) ||
                    (f.pnr && f.pnr.toLowerCase().includes(q)) ||
                    (f.destination_city && f.destination_city.toLowerCase().includes(q)) ||
                    (f.airline_supplier && f.airline_supplier.toLowerCase().includes(q))
                  );
                });

                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 px-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">لا توجد رحلات طيران قادمة خلال الـ 7 أيام القادمة</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        جميع الرحلات المجدولة إما أبعد من 7 أيام أو تم تنفيذها بالفعل.
                      </p>
                      <div className="mt-4">
                        <Link href="/travel-bookings">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold text-xs">
                            <Plane className="w-4 h-4" /> فتح شاشة حجوزات وتذاكر الطيران
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {list.map((f: any, idx: number) => (
                      <div key={`modal-flight-${f.id || idx}`} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-all space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                <Plane className="w-3 h-3 text-emerald-700" />
                                {f.airline_supplier || "طيران"}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {f.flight_number || "---"}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-1">
                              {f.customer_name || f.passenger_name || "مسافر"}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {f.status === 'issued' ? 'تذكرة مصدرة' : 'مؤكدة'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-500 block">المسار (إلى):</span>
                            <span className="font-bold text-slate-800">{f.origin_city || 'المغادرة'} ➔ {f.destination_city || 'الوصول'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">تاريخ الإقلاع:</span>
                            <span className="font-mono font-bold text-emerald-700">{f.departure_date} {f.departure_time ? `(${f.departure_time})` : ''}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">PNR / التذكرة:</span>
                            <span className="font-mono font-bold text-slate-800">{f.pnr || f.ticket_number || f.booking_number || "---"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">الدرجة / السعر:</span>
                            <span className="font-bold text-slate-700">{f.travel_class || "اقتصادية"} · {Number(f.selling_price || 0).toLocaleString()} {f.currency || "SAR"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {f.customer_phone ? `📞 ${f.customer_phone}` : ""}
                          </span>
                          <Link href="/travel-bookings">
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 font-bold gap-1">
                              معاينة الحجز <ArrowLeft className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                إدارة حجوزات وتذاكر الطيران • أومني فلاي برو
              </span>
              <div className="flex items-center gap-2">
                <Link href="/travel-bookings">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5">
                    <Plane className="w-3.5 h-3.5" /> شاشة تذاكر الطيران
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => setUpcomingFlightsModalOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
