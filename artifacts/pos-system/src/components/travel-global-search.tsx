import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plane,
  Ticket,
  Users,
  Globe,
  Building2,
  Luggage,
  ArrowRight,
  ExternalLink,
  Phone,
  Hash,
  CreditCard,
  Coins,
  FileText,
  Bus,
  CheckSquare,
  BookOpen,
  UserCheck,
  Calendar,
  Sparkles,
  Receipt,
  DollarSign,
  Briefcase,
  AlertCircle,
  LayoutDashboard,
  Settings as SettingsIcon,
  ShieldCheck,
  Zap,
  Navigation,
  Key,
  Database,
  BarChart3,
  Undo2,
  Wallet,
  Building,
  TableProperties,
  Clock,
  Banknote,
  FileSearch,
  Printer,
  History,
  Languages,
  MessageSquare,
  HelpCircle,
  Package,
  MapPin,
  Sticker,
  FileCheck,
  RefreshCw,
  ClipboardList,
  ShoppingBag
} from "lucide-react";
import { useLocation } from "wouter";

export interface SearchResults {
  suppliers?: any[];
  customers?: any[];
  passengers?: any[];
  employees?: any[];
  vouchers?: any[];
  invoices?: any[];
  bookings?: any[];
  visas?: any[];
  hotels?: any[];
  buses?: any[];
  tasks?: any[];
  accounts?: any[];
}

interface AppScreen {
  id: string;
  title: string;
  description: string;
  path: string;
  category: "all" | "suppliers" | "finance" | "trips" | "people" | "tasks" | "settings";
  icon: any;
  keywords: string[];
}

const APP_SCREENS: AppScreen[] = [
  { id: "dash", title: "لوحة التحكم الرئيسية", description: "نظرة عامة على الإحصائيات والعمليات", path: "/travel-dashboard", category: "all", icon: LayoutDashboard, keywords: ["احصائيات", "رئيسية", "dashboard"] },
  { id: "wizard", title: "معالج الحجز الذكي (Wizard)", description: "حجز طيران، فنادق، وتأشيرات في خطوة واحدة", path: "/travel-wizard", category: "trips", icon: Zap, keywords: ["حجز سريع", "معالج", "طيران", "فنادق"] },
  { id: "bookings", title: "إدارة حجوزات الطيران", description: "قائمة كافة الحجوزات وتذاكر الطيران", path: "/travel-bookings", category: "trips", icon: Plane, keywords: ["تذاكر", "طيران", "pnr", "تذكرة"] },
  { id: "visas", title: "إدارة التأشيرات (Visas)", description: "متابعة طلبات ومعاملات التأشيرات", path: "/travel-visas", category: "trips", icon: Globe, keywords: ["فيزا", "تاشيرة", "سفارة"] },
  { id: "hotels", title: "حجوزات الفنادق والسكـن", description: "إدارة حجوزات الغرف والفنادق للعملاء", path: "/travel-hotels", category: "trips", icon: Building2, keywords: ["فندق", "سكن", "غرفة"] },
  { id: "buses", title: "تذاكر النقل البري (الباصات)", description: "حجز وإدارة رحلات الحافلات والنقل", path: "/travel-bus-bookings", category: "trips", icon: Bus, keywords: ["باص", "حافلة", "نقل بري"] },
  { id: "suppliers", title: "دليل الموردين والوكلاء", description: "إدارة بيانات الموردين وشركات الطيران", path: "/travel-suppliers", category: "suppliers", icon: Building, keywords: ["مورد", "وكيل", "شركة طيران"] },
  { id: "customers", title: "دليل العملاء والشركات", description: "إدارة بيانات العملاء الدائمين والشركات", path: "/customers", category: "people", icon: Users, keywords: ["عميل", "شركة", "زبون"] },
  { id: "passengers", title: "سجل المسافرين الدائمين", description: "قاعدة بيانات المسافرين وجوازات السفر", path: "/passengers", category: "people", icon: Luggage, keywords: ["مسافر", "جواز", "بيانات"] },
  { id: "invoices", title: "الفواتير والمبيعات", description: "إدارة فواتير العملاء والمبيعات المركزية", path: "/travel-invoices", category: "finance", icon: FileText, keywords: ["فاتورة", "مبيعات", "invoice"] },
  { id: "accounting", title: "الحسابات العامة والقيود", description: "سندات الصرف والقبض وقيود اليومية", path: "/accounting", category: "finance", icon: Coins, keywords: ["سند", "صرف", "قبض", "محاسبة"] },
  { id: "hr", title: "الموارد البشرية (HR)", description: "إدارة الموظفين، الرواتب، والإجازات", path: "/hr", category: "people", icon: UserCheck, keywords: ["موظف", "راتب", "اجازة", "hr"] },
  { id: "tasks", title: "إدارة المهام والعمليات", description: "توزيع المهام التشغيلية ومتابعة الإنجاز", path: "/travel-tasks", category: "tasks", icon: CheckSquare, keywords: ["مهمة", "عملية", "تشغيل"] },
  { id: "reports", title: "التقارير المركزية", description: "تقارير المبيعات، الأرباح، والأداء", path: "/travel-reports", category: "finance", icon: BarChart3, keywords: ["تقرير", "ارباح", "اداء"] },
  { id: "whatsapp", title: "مركز التنبيهات وواتساب", description: "إدارة رسائل الواتساب والاشعارات التلقائية", path: "/travel-notifications-hub", category: "tasks", icon: MessageSquare, keywords: ["واتساب", "رسائل", "تنبيه"] },
  { id: "settings", title: "إعدادات النظام", description: "تهيئة الخيارات العامة والأسعار والعمولات", path: "/travel-settings", category: "settings", icon: SettingsIcon, keywords: ["اعدادات", "خيارات", "تهيئة"] },
  { id: "audit", title: "سجل الرقابة (Audit Trail)", description: "مراقبة حركات المستخدمين والنظام", path: "/audit", category: "settings", icon: ShieldCheck, keywords: ["رقابة", "تدقيق", "لوج"] },
  { id: "backup", title: "النسخ الاحتياطي", description: "حفظ واستعادة بيانات النظام", path: "/backup-restore", category: "settings", icon: Database, keywords: ["نسخ", "احتياطي", "باك اب"] },
  { id: "zatca", title: "الربط مع هيئة الزكاة (ZATCA)", description: "الفاتورة الإلكترونية والامتثال الضريبي", path: "/travel-zatca-compliance", category: "finance", icon: FileCheck, keywords: ["زكاة", "فاتورة الكترونية", "ضريبة"] },
  { id: "vcc", title: "مدفوعات البطاقات الافتراضية (VCC)", description: "إدارة بطاقات الدفع الافتراضية للموردين", path: "/travel-vcc-payments", category: "finance", icon: CreditCard, keywords: ["vcc", "بطاقة", "دفع"] },
  { id: "bsp", title: "مطابقة الـ BSP", description: "مطابقة تقارير الـ BSP مع النظام", path: "/travel-bsp-reconciliation", category: "finance", icon: RefreshCw, keywords: ["bsp", "مطابقة", "طيران"] },
  { id: "refunds", title: "إدارة المرتجعات والrefund", description: "معالجة طلبات استرجاع المبالغ والتذاكر", path: "/travel-refunds", category: "trips", icon: Undo2, keywords: ["استرجاع", "مرتجع", "refund"] },
  { id: "itinerary", title: "مصمم المسارات الذكي", description: "إنشاء برنامج رحلة احترافي للعميل", path: "/travel-smart-itinerary", category: "trips", icon: MapPin, keywords: ["مسار", "برنامج", "itinerary"] },
  { id: "proc-req", title: "طلبات شراء وحجز الخدمات", description: "طلبات الاحتياج والتوريد من الأقسام", path: "/travel-procurement?tab=requests", category: "suppliers", icon: ClipboardList, keywords: ["شراء", "طلب", "حجز"] },
  { id: "proc-rfq", title: "عروض أسعار الموردين والمقارنة", description: "مفاضلة ومقارنة أسعار الوكلاء", path: "/travel-procurement?tab=rfqs", category: "suppliers", icon: FileCheck, keywords: ["عروض", "مناقصة", "سعر"] },
  { id: "proc-order", title: "أوامر وشراء خدمات التذاكر", description: "أوامر الشراء الرسمية PO", path: "/travel-procurement?tab=orders", category: "suppliers", icon: ShoppingBag, keywords: ["امر شراء", "po", "مشتريات"] },
  { id: "proc-inv", title: "فواتير مشتريات الخدمات", description: "تسجيل فواتير المشتريات من الموردين", path: "/travel-procurement?tab=invoices", category: "suppliers", icon: FileText, keywords: ["فاتورة مشتريات", "pi", "مورد"] },
  { id: "proc-pay", title: "سندات دفع الموردين والتسويات", description: "إدارة المدفوعات والتحويلات للوكلاء", path: "/travel-procurement?tab=payments", category: "finance", icon: Wallet, keywords: ["سند دفع", "صرف", "تحويل"] },
  { id: "proc-report", title: "تقارير المشتريات السياحية", description: "تحليل المشتريات والأرباح من الموردين", path: "/travel-procurement?tab=reports", category: "finance", icon: BarChart3, keywords: ["تقرير مشتريات", "تحليل", "موردين"] },
];

const fmt = (num: number) => (num || 0).toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function TravelGlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (query.trim().length < 2) return;
      
      setLoading(true);
      try {
        const token = sessionStorage.getItem("pos_token") ?? localStorage.getItem("pos_token") ?? "";
        const res = await fetch(`/api/travel/global-search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const navigateTo = (path: string) => {
    setLocation(path);
    onOpenChange(false);
  };

  const filteredScreens = useMemo(() => {
    if (!query || query.trim().length < 1) return [];
    const q = query.toLowerCase().trim();
    return APP_SCREENS.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.description.toLowerCase().includes(q) || 
      s.keywords.some(k => k.includes(q))
    ).filter(s => activeTab === "all" || s.category === activeTab || (activeTab === "finance" && s.category === "finance"));
  }, [query, activeTab]);

  const counts = useMemo(() => {
    return {
      suppliers: results?.suppliers?.length || 0,
      customers: results?.customers?.length || 0,
      passengers: results?.passengers?.length || 0,
      employees: results?.employees?.length || 0,
      vouchers: results?.vouchers?.length || 0,
      invoices: results?.invoices?.length || 0,
      bookings: results?.bookings?.length || 0,
      visas: results?.visas?.length || 0,
      hotels: results?.hotels?.length || 0,
      buses: results?.buses?.length || 0,
      tasks: results?.tasks?.length || 0,
      accounts: results?.accounts?.length || 0,
      screens: filteredScreens.length || 0
    };
  }, [results, filteredScreens]);

  const totalResults = useMemo(() => {
    const { screens, ...rest } = counts;
    return Object.values(rest).reduce((acc, c) => acc + c, 0) + screens;
  }, [counts]);

  const tripsCount = counts.bookings + counts.visas + counts.hotels + counts.buses;
  const financeCount = counts.vouchers + counts.invoices + counts.accounts;
  const peopleCount = counts.customers + counts.passengers + counts.employees;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl p-0 overflow-hidden shadow-2xl border-slate-200 font-sans max-h-[92vh] flex flex-col">
        {/* Header Search Box */}
        <DialogHeader className="p-4 pb-3 border-b bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Search className="w-5 h-5 text-indigo-600" />
              البحث الشامل والمفصل في نظام السفريات والسياحة (Global Search)
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-[11px] bg-indigo-50 text-indigo-700 border-indigo-200">
              {totalResults > 0 ? `${totalResults} نتيجة مطابقة` : "البحث السريع"}
            </Badge>
          </div>

          <div className="relative mt-1">
            <Search className="w-4 h-4 absolute right-3 top-3.5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن مورد، عميل، مهمة، صفحة، واجهة، فاتورة، تذكرة طيران، PNR، جواز، أو رحلة باص..."
              className="pr-9 pl-16 h-11 text-xs sm:text-sm bg-white dark:bg-slate-800 border-slate-300 focus-visible:ring-indigo-500 shadow-inner font-medium"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-700 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded cursor-pointer transition-colors"
              >
                مسح
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 scrollbar-none text-[11px]">
            <Button
              type="button"
              variant={activeTab === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("all")}
              className={`h-7 px-2.5 text-xs font-bold gap-1 rounded-full ${activeTab === "all" ? "bg-indigo-600 text-white" : ""}`}
            >
              الكل ({totalResults})
            </Button>
            <Button
              type="button"
              variant={activeTab === "suppliers" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("suppliers")}
              className={`h-7 px-2.5 text-xs font-bold gap-1 rounded-full ${activeTab === "suppliers" ? "bg-amber-600 text-white" : ""}`}
            >
              🏢 الموردين ({counts.suppliers})
            </Button>
            <Button
              type="button"
              variant={activeTab === "finance" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("finance")}
              className={`h-7 px-2.5 text-xs font-bold gap-1 rounded-full ${activeTab === "finance" ? "bg-rose-600 text-white" : ""}`}
            >
              💳 المالية ({financeCount})
            </Button>
            <Button
              type="button"
              variant={activeTab === "trips" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("trips")}
              className={`h-7 px-2.5 text-xs font-bold gap-1 rounded-full ${activeTab === "trips" ? "bg-blue-600 text-white" : ""}`}
            >
              ✈️ الحجوزات ({tripsCount})
            </Button>
            <Button
              type="button"
              variant={activeTab === "people" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("people")}
              className={`h-7 px-2.5 text-xs font-bold gap-1 rounded-full ${activeTab === "people" ? "bg-emerald-600 text-white" : ""}`}
            >
              👥 الناس ({peopleCount})
            </Button>
            <Button
              type="button"
              variant={activeTab === "tasks" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("tasks")}
              className={`h-7 px-2.5 text-xs font-bold gap-1 rounded-full ${activeTab === "tasks" ? "bg-purple-600 text-white" : ""}`}
            >
              📋 المهام والعمليات ({counts.tasks})
            </Button>
          </div>
        </DialogHeader>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-12 text-center text-xs text-slate-500 animate-pulse space-y-2">
              <Sparkles className="w-6 h-6 mx-auto text-indigo-500 animate-spin" />
              <p className="font-bold">جاري الفحص السريع والبحث في كافة جداول وبيانات النظام...</p>
            </div>
          )}

          {!loading && query.length >= 1 && totalResults === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">لا توجد نتائج مطابقة لـ "{query}"</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                جرّب البحث باسم المورد، اسم العميل، رقم السند، كود التذكرة، رقم الـ PNR، أو اسم الشاشة/الصفحة
              </p>
            </div>
          )}

          {!loading && !results && query.length < 1 && (
            <div className="py-8 text-center text-slate-500 text-xs space-y-4">
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 rounded-xl max-w-md mx-auto">
                <p className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-1">محرك البحث المركزي الموحد</p>
                <p className="text-slate-500 text-xs">ابحث بالاسم، برقم السند، برقم التذكرة، أو باسم الشاشة والوظيفة</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
                <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded text-[11px] font-bold">🖥️ واجهات النظام</span>
                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded text-[11px] font-bold">🏢 الموردين</span>
                <span className="bg-rose-50 text-rose-900 border border-rose-200 px-2.5 py-1 rounded text-[11px] font-bold">💳 السندات المالية</span>
                <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded text-[11px] font-bold">✈️ التذاكر وPNR</span>
                <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded text-[11px] font-bold">👤 المسافرين</span>
                <span className="bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded text-[11px] font-bold">📋 المهام والعمليات</span>
              </div>
            </div>
          )}

          {/* 0. Screens & Tasks (واجهات النظام والمهام السريعة) */}
          {filteredScreens.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-indigo-600" />
                  واجهات النظام والوظائف ({filteredScreens.length})
                </span>
                <span className="text-[10px] text-slate-400">الوصول السريع</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredScreens.map((s, idx: number) => (
                  <div
                    key={`search-screen-${s.id}`}
                    onClick={() => navigateTo(s.path)}
                    className="p-3 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center gap-3 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <s.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-xs text-slate-900 truncate">{s.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{s.description}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. Suppliers & Agents (شبكة الموردين والوكلاء) */}
          {(activeTab === "all" || activeTab === "suppliers") && results?.suppliers && results.suppliers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  الموردين والوكلاء المعتمدين ({results.suppliers.length})
                </span>
                <span className="text-[10px] text-slate-400">شبكة الموردين</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.suppliers.map((s, idx) => (
                  <div
                    key={`travelglobalsearch-s-id-${s.id || idx}-${idx}`}
                    onClick={() => navigateTo(`/travel-suppliers?supplierId=${s.id}&action=statement`)}
                    className="p-3 bg-amber-50/50 hover:bg-amber-100/70 border border-amber-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{s.name}</span>
                        <Badge variant="outline" className="bg-amber-100 text-amber-900 text-[10px]">
                          {s.supplier_type || "مورد"}
                        </Badge>
                        {s.supplier_code && (
                          <span className="text-[10px] font-mono text-slate-500">كود: {s.supplier_code}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        {s.contact_person && <span>👤 مسؤول: {s.contact_person}</span>}
                        {s.phone && <span>📞 {s.phone}</span>}
                        {s.current_balance != null && (
                          <span className="font-bold font-mono text-amber-800">
                            مستحقات المورد: {fmt(s.current_balance)} {s.currency || "ريال"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-700 text-xs font-bold">
                      <span>عرض</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Financial Vouchers (سندات الصرف والقبض) */}
          {(activeTab === "all" || activeTab === "finance") && results?.vouchers && results.vouchers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-rose-800 dark:text-rose-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-rose-600" />
                  السندات المالية (صرف وقبض) ({results.vouchers.length})
                </span>
                <span className="text-[10px] text-slate-400">الحسابات العامة</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.vouchers.map((v, idx) => (
                  <div
                    key={`${v.id}-${v.voucher_number}`}
                    onClick={() => navigateTo("/accounting")}
                    className="p-3 bg-rose-50/50 hover:bg-rose-100/70 border border-rose-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={v.type === "payment" ? "bg-rose-600 text-white text-[10px]" : "bg-emerald-600 text-white text-[10px]"}>
                          {v.type === "payment" ? "سند صرف" : "سند قبض"}
                        </Badge>
                        <span className="font-mono font-bold text-xs text-rose-900">{v.voucher_number}</span>
                        {v.party_name && (
                          <span className="font-bold text-xs text-slate-800">الطرف: {v.party_name}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="font-bold font-mono text-rose-700">المبلغ: {fmt(v.amount)} {v.currency || "ريال"}</span>
                        {v.payment_against && <span className="text-slate-600">البيان: {v.payment_against}</span>}
                        {v.created_at && <span className="text-slate-400 font-mono">{v.created_at.slice(0, 10)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-rose-700 text-xs font-bold">
                      <span>فتح</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Invoices & Statements (الفواتير وكشوفات الحساب) */}
          {(activeTab === "all" || activeTab === "finance") && results?.invoices && results.invoices.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  الفواتير المركزية والمبيعات ({results.invoices.length})
                </span>
                <span className="text-[10px] text-slate-400">المبيعات المركزية</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.invoices.map((inv, idx) => (
                  <div
                    key={`travelglobalsearch-inv-id-${inv.id || idx}-${idx}`}
                    onClick={() => navigateTo("/travel-invoices")}
                    className="p-3 bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-emerald-900">{inv.invoice_number}</span>
                        <span className="font-bold text-xs text-slate-800">{inv.customer_name}</span>
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-800">
                          {inv.status || "معتمدة"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="font-bold font-mono text-emerald-700">الإجمالي: {fmt(inv.grand_total || inv.net_selling)} {inv.currency || "ريال"}</span>
                        {inv.invoice_date && <span>التاريخ: {inv.invoice_date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold">
                      <span>عرض</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Chart of Accounts (دليل الحسابات والأرصدة) */}
          {(activeTab === "all" || activeTab === "finance") && results?.accounts && results.accounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  دليل الحسابات وكشوفات الحساب ({results.accounts.length})
                </span>
                <span className="text-[10px] text-slate-400">شجرة الحسابات</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.accounts.map((acc, idx) => (
                  <div
                    key={`travelglobalsearch-acc-id-${acc.id || idx}-${idx}`}
                    onClick={() => navigateTo("/accounting")}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700">[{acc.code}]</span>
                        <span className="font-bold text-xs text-slate-900">{acc.name}</span>
                        <Badge variant="outline" className="text-[10px]">{acc.type || "حساب"}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        الرصيد: <strong className="text-slate-800">{fmt(acc.balance)} {acc.currency || "ريال"}</strong>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Bookings & Tickets (حجوزات وتذاكر الطيران) */}
          {(activeTab === "all" || activeTab === "trips") && results?.bookings && results.bookings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-blue-800 dark:text-blue-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-blue-600" />
                  حجوزات وتذاكر الطيران ({results.bookings.length})
                </span>
                <span className="text-[10px] text-slate-400">إدارة التذاكر والحجوزات</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.bookings.map((b, idx) => (
                  <div
                    key={`travelglobalsearch-b-id-${b.id || idx}-${idx}`}
                    onClick={() => navigateTo("/travel-bookings")}
                    className="p-3 bg-blue-50/50 hover:bg-blue-100/70 border border-blue-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{b.customer_name || "عميل"}</span>
                        {b.passenger_name && (
                          <span className="text-[11px] text-slate-600">({b.passenger_name})</span>
                        )}
                        {b.destination && (
                          <span className="text-[10px] bg-blue-200/70 text-blue-900 font-semibold px-2 py-0.5 rounded">
                            ✈️ {b.destination}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {b.pnr && <span>PNR: <strong className="text-blue-800">{b.pnr}</strong></span>}
                        {b.ticket_number && <span>تذكرة: {b.ticket_number}</span>}
                        {b.code && <span>رمز: {b.code}</span>}
                        {b.selling_price && <span>السعر: {fmt(b.selling_price)} ريال</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Bus Bookings (رحلات النقل البري والباصات) */}
          {(activeTab === "all" || activeTab === "trips") && results?.buses && results.buses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-cyan-800 dark:text-cyan-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Bus className="w-4 h-4 text-cyan-600" />
                  رحلات وحجوزات النقل البري والباصات ({results.buses.length})
                </span>
                <span className="text-[10px] text-slate-400">النقل البري</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.buses.map((bus, idx) => (
                  <div
                    key={`travelglobalsearch-bus-id-${bus.id || idx}-${idx}`}
                    onClick={() => navigateTo("/travel-bus-bookings")}
                    className="p-3 bg-cyan-50/50 hover:bg-cyan-100/70 border border-cyan-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{bus.passenger_name || bus.customer_name}</span>
                        <Badge variant="outline" className="text-[10px] border-cyan-300 text-cyan-800">
                          {bus.origin_city} ➔ {bus.destination_city}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {bus.booking_number && <span>حجز: {bus.booking_number}</span>}
                        {bus.ticket_number && <span>تذكرة: {bus.ticket_number}</span>}
                        {bus.pnr_number && <span>PNR: {bus.pnr_number}</span>}
                        {bus.selling_price && <span>السعر: {fmt(bus.selling_price)} ريال</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cyan-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Customers (العملاء والشركات) */}
          {(activeTab === "all" || activeTab === "people") && results?.customers && results.customers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  العملاء والشركات ({results.customers.length})
                </span>
                <span className="text-[10px] text-slate-400">دليل العملاء</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.customers.map((c, idx) => (
                  <div
                    key={`travelglobalsearch-c-id-${c.id || idx}-${idx}`}
                    onClick={() => navigateTo("/customers")}
                    className="p-3 bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.passport_number && <span>جواز: {c.passport_number}</span>}
                        {c.nationality && <span>الجنسية: {c.nationality}</span>}
                        {c.balance != null && (
                          <span className="font-bold text-emerald-800">الرصيد: {fmt(c.balance)} ريال</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Passengers (المسافرون) */}
          {(activeTab === "all" || activeTab === "people") && results?.passengers && results.passengers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-indigo-800 dark:text-indigo-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Luggage className="w-4 h-4 text-indigo-600" />
                  المسافرون Passengers ({results.passengers.length})
                </span>
                <span className="text-[10px] text-slate-400">سجل المسافرين</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.passengers.map((p, idx) => (
                  <div
                    key={`travelglobalsearch-p-id-${p.id || idx}-${idx}`}
                    onClick={() => navigateTo("/passengers")}
                    className="p-3 bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{p.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {p.passport_number && <span>جواز: <strong className="text-indigo-800">{p.passport_number}</strong></span>}
                        {p.phone && <span>هاتف: {p.phone}</span>}
                        {p.nationality && <span>الجنسية: {p.nationality}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. Employees (الموظفون وفريق العمل) */}
          {(activeTab === "all" || activeTab === "people") && results?.employees && results.employees.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-teal-800 dark:text-teal-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  فريق العمل والموظفون ({results.employees.length})
                </span>
                <span className="text-[10px] text-slate-400">الموارد البشرية HR</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.employees.map((emp, idx) => (
                  <div
                    key={`travelglobalsearch-emp-id-${emp.id || idx}-${idx}`}
                    onClick={() => navigateTo("/hr")}
                    className="p-3 bg-teal-50/50 hover:bg-teal-100/70 border border-teal-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{emp.name}</span>
                        {emp.employee_number && (
                          <Badge variant="outline" className="font-mono text-[10px]">#{emp.employee_number}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        {(emp.job_title || emp.position) && <span>الوظيفة: {emp.job_title || emp.position}</span>}
                        {emp.phone && <span>📞 {emp.phone}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-teal-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. Visas (معاملات التأشيرات) */}
          {(activeTab === "all" || activeTab === "trips") && results?.visas && results.visas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-amber-600" />
                  معاملات التأشيرات ({results.visas.length})
                </span>
                <span className="text-[10px] text-slate-400">إدارة التأشيرات</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.visas.map((v, idx) => (
                  <div
                    key={`travelglobalsearch-v-id-${v.id || idx}-${idx}`}
                    onClick={() => navigateTo("/travel-visas")}
                    className="p-3 bg-amber-50/50 hover:bg-amber-100/70 border border-amber-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{v.passenger_name || "مسافر"}</span>
                        <span className="text-[11px] bg-amber-200 text-amber-900 font-semibold px-1.5 py-0.5 rounded">
                          {v.country} - {v.visa_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {v.code && <span>رقم المعاملة: {v.code}</span>}
                        {v.passport_number && <span>جواز: {v.passport_number}</span>}
                        {v.status && <span>الحالة: {v.status}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 11. Hotels (الفنادق) */}
          {(activeTab === "all" || activeTab === "trips") && results?.hotels && results.hotels.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-purple-800 dark:text-purple-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  الفنادق والدليل الفندقي ({results.hotels.length})
                </span>
                <span className="text-[10px] text-slate-400">دليل الفنادق</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.hotels.map((h, idx) => (
                  <div
                    key={`travelglobalsearch-h-id-${h.id || idx}-${idx}`}
                    onClick={() => navigateTo("/travel-hotels-db")}
                    className="p-3 bg-purple-50/50 hover:bg-purple-100/70 border border-purple-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{h.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{h.city} {h.country ? ` - ${h.country}` : ""}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. Tasks & Operations (المهام والعمليات التشغيلية) */}
          {(activeTab === "all" || activeTab === "tasks") && results?.tasks && results.tasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-purple-800 dark:text-purple-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                  المهام والعمليات التشغيلية ({results.tasks.length})
                </span>
                <span className="text-[10px] text-slate-400">إدارة المهام</span>
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.tasks.map((t, idx) => (
                  <div
                    key={`travelglobalsearch-t-id-${t.id || idx}-${idx}`}
                    onClick={() => navigateTo("/travel-tasks")}
                    className="p-3 bg-purple-50/50 hover:bg-purple-100/70 border border-purple-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-purple-900">[{t.task_code}]</span>
                        <span className="font-bold text-xs text-slate-900">{t.title}</span>
                        <Badge variant="outline" className="text-[10px]">{t.status || "قيد التنفيذ"}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        {t.assigned_to_name && <span>المسؤول: {t.assigned_to_name}</span>}
                        {t.priority && <span>الأولوية: {t.priority}</span>}
                        {t.due_date && <span>تاريخ الإنجاز: {t.due_date}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span>اضغط <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-[10px]">Esc</kbd> للإغلاق</span>
            <span className="text-slate-300">|</span>
            <span>اختصار الفتح: <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-[10px]">Ctrl + K</kbd></span>
          </div>
          <span className="font-bold text-indigo-700">إجمالي النتائج: {totalResults}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
