import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, UserCheck, Plane, ArrowRight, ArrowLeft, CheckCircle2, 
  CreditCard, DollarSign, Receipt, Printer, Ticket, 
  Calendar, ShieldAlert, AlertCircle, FileText, Sparkles, Building2, MapPin,
  Coins, Wallet, Landmark, RefreshCw, Plus, Check, Eye
} from "lucide-react";
import { SearchableAccountSelect } from "@/components/ui/searchable-account-select";
import { TravelPrintModal } from "@/components/travel-print-modal";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
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

const CURRENCIES = [
  { code: "SAR", symbol: "ر.س", label: "ريال سعودي (SAR)", flag: "🇸🇦" },
  { code: "USD", symbol: "$", label: "دولار أمريكي (USD)", flag: "🇺🇸" },
  { code: "YER", symbol: "ر.ي", label: "ريال يمني (YER)", flag: "🇾🇪" },
  { code: "EUR", symbol: "€", label: "يورو أوروبي (EUR)", flag: "🇪🇺" },
  { code: "AED", symbol: "د.إ", label: "درهم إماراتي (AED)", flag: "🇦🇪" },
  { code: "QAR", symbol: "ر.ق", label: "ريال قطري (QAR)", flag: "🇶🇦" },
  { code: "KWD", symbol: "د.ك", label: "دينار كويتي (KWD)", flag: "🇰🇼" },
  { code: "OMR", symbol: "ر.ع", label: "ريال عماني (OMR)", flag: "🇴🇲" }
];

const STEPS = [
  { id: 1, title: "العميل ودليل الحسابات", subtitle: "اختيار العميل وعملة الحساب", icon: Users },
  { id: 2, title: "المسافرون", subtitle: "بيانات الجوازات والركاب", icon: UserCheck },
  { id: 3, title: "رحلة الذهاب والعودة", subtitle: "مسار الطيران والمطارات", icon: Plane },
  { id: 4, title: "الناقل والمورد والأسعار", subtitle: "ربط المورد بالدليل والتسعير", icon: DollarSign },
  { id: 5, title: "طريقة الدفع والتسوية", subtitle: "نقدي، آجل، أو مجزأ والخزينة", icon: CreditCard },
  { id: 6, title: "المراجعة والأثر المالي", subtitle: "معاينة القيد المزدوج والإصدار", icon: Receipt }
];

export default function TravelWizardBookingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccessModal, setIsSuccessModal] = useState(false);
  const [issuedResult, setIssuedResult] = useState<any>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Quick Add Customer Dialog
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustType, setNewCustType] = useState("individual");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  // Form State
  const [form, setForm] = useState({
    // Step 1: Customer & Chart of Accounts
    customer_id: "",
    customer_name: "",
    customer_account_code: "",
    customer_type: "individual", // individual, corporate, vip, debtor
    customer_currency: "SAR",
    customer_statement: "",
    price_tier: "standard", // standard, corporate, agent, employee, custom
    credit_limit: 0,
    current_balance: 0,
    
    // Step 2: Passenger
    passenger_type: "same_as_customer", // same_as_customer, select_existing, new_passenger
    passenger_id: "",
    passenger_name_ar: "",
    passenger_name_en: "",
    passenger_title: "Mr",
    passport_number: "",
    passport_expiry_date: "",
    nationality: "سعودي",
    
    // Step 3: Flight details
    trip_type: "round_trip", // one_way, round_trip, multi_city
    origin_city: "الرياض (RUH)",
    destination_city: "دبي (DXB)",
    departure_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    departure_time: "10:30",
    return_date: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
    return_time: "18:00",
    travel_class: "اقتصادية",
    pnr: `PNR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    flight_number: "SV-112",
    ticket_number: `065-${Math.floor(1000000000 + Math.random() * 9000000000)}`,

    // Step 4: Airline & Supplier in Chart of Accounts
    supplier_id: "",
    supplier_name: "",
    supplier_account_code: "",
    airline_supplier: "الخطوط الجوية السعودية (Saudia)",
    supplier_currency: "SAR",
    supplier_payment_method: "credit", // credit (آجل), cash (نقدي), bank_transfer (تحويل)
    supplier_statement: "",
    supplier_cost: 1200, // سعر الشراء من المورد
    service_fee: 50, // رسوم الخدمة
    direct_expense: 0, // مصروفات مباشرة
    discount_amount: 0, // الخصم
    selling_price: 1500, // سعر البيع الأساسي
    commission_override: 300, // العمولة المقدرة
    price_rule_note: "سعر بيع التجزئة القياسي للعملاء الأفراد",

    // Step 5: Payment
    payment_mode: "cash", // cash, credit, partial, bank
    paid_amount: 1500,
    supplier_paid_amount: 0,
    safe_id: 1,
    bank_account_id: 1,
    payment_notes: "سداد فوري عند الحجز",

    // Step 6: Notes
    booking_notes: "تأكيد المقعد الأمامي ووجبة خاصة"
  });

  // Queries
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: suppliersList = [] } = useQuery<any[]>({
    queryKey: ["suppliers-list"],
    queryFn: () => fetchWithAuth("/api/suppliers")
  });

  const { data: airlines = [] } = useQuery<any[]>({
    queryKey: ["travel-airlines"],
    queryFn: () => fetchWithAuth("/api/travel/airlines")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["travel-passengers-list", form.customer_id],
    queryFn: () => fetchWithAuth(`/api/travel/passengers?${form.customer_id ? `customer_id=${form.customer_id}` : ''}`)
  });

  const { data: safes = [] } = useQuery<any[]>({
    queryKey: ["safes-list"],
    queryFn: () => fetchWithAuth("/api/safes")
  });

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["bank-accounts-list"],
    queryFn: () => fetchWithAuth("/api/accounting/banks")
  });

  // Calculate dynamic math
  const cost = Number(form.supplier_cost || 0);
  const directExp = Number(form.direct_expense || 0);
  const sFee = Number(form.service_fee || 0);
  const discount = Number(form.discount_amount || 0);
  const baseSell = Number(form.selling_price || 0);
  
  // Total Sale = Selling Price + Service Fee - Discount
  const totalSaleAmount = Math.max(0, baseSell + sFee - discount);
  // Profit = Total Sale Amount - Total Cost (Supplier Cost + Direct Expense)
  const netProfit = totalSaleAmount - (cost + directExp);
  // Due / Remaining
  const paid = Number(form.paid_amount || 0);
  const remainingDebt = Math.max(0, totalSaleAmount - paid);

  // Handle Customer Selection
  const handleSelectCustomer = (cust: any) => {
    if (cust) {
      const isCorp = cust.customer_type === "corporate";
      const isVip = cust.customer_type === "vip";
      let suggestedPrice = 1500;
      let pTier = "standard";

      if (isCorp) {
        suggestedPrice = 1350; // Special corporate pricing
        pTier = "corporate";
      } else if (isVip) {
        suggestedPrice = 1400; // VIP rate
        pTier = "vip";
      }

      setForm(f => ({
        ...f,
        customer_id: String(cust.id),
        customer_name: cust.name,
        customer_account_code: cust.account_code || `112${String(cust.id).padStart(2, "0")}`,
        customer_type: cust.customer_type || "individual",
        customer_currency: cust.currency || f.customer_currency || "SAR",
        customer_statement: `قيمة تذكرة طيران للعميل: ${cust.name} ${f.pnr ? `(PNR: ${f.pnr})` : ""}`,
        price_tier: pTier,
        credit_limit: cust.credit_limit || (isCorp ? 50000 : 5000),
        current_balance: cust.balance || 0,
        selling_price: suggestedPrice,
        paid_amount: isCorp ? 0 : suggestedPrice,
        payment_mode: isCorp ? "credit" : "cash",
        passenger_name_ar: cust.name,
        passenger_name_en: cust.name_en || "",
        passport_number: cust.passport_number || ""
      }));
    } else {
      setForm(f => ({
        ...f,
        customer_id: "",
        customer_name: "",
        customer_account_code: "",
        customer_statement: ""
      }));
    }
  };

  // Handle Supplier Selection
  const handleSelectSupplier = (sup: any) => {
    if (sup) {
      setForm(f => ({
        ...f,
        supplier_id: String(sup.id),
        supplier_name: sup.name,
        supplier_account_code: sup.account_code || `211${String(sup.id).padStart(2, "0")}`,
        airline_supplier: sup.name || f.airline_supplier,
        supplier_currency: sup.currency || f.supplier_currency || "SAR",
        supplier_statement: `تكلفة تذكرة طيران من المورد: ${sup.name} ${f.pnr ? `(PNR: ${f.pnr})` : ""}`
      }));
    } else {
      setForm(f => ({
        ...f,
        supplier_id: "",
        supplier_name: "",
        supplier_account_code: "",
        supplier_statement: ""
      }));
    }
  };

  // Handle Quick Add Customer
  const handleQuickAddCustomer = async () => {
    if (!newCustName.trim()) {
      toast({ title: "تنبيه", description: "يرجى كتابة اسم العميل الجديد", variant: "destructive" });
      return;
    }
    setIsAddingCustomer(true);
    try {
      const res: any = await fetchWithAuth("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: newCustName,
          phone: newCustPhone,
          customer_type: newCustType,
          currency: form.customer_currency || "SAR"
        })
      });
      toast({ title: "تم بنجاح", description: `تمت إضافة العميل ${res.name} بنجاح إلى دليل الحسابات.` });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      handleSelectCustomer(res);
      setShowAddCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
    } catch (e: any) {
      toast({ title: "خطأ في الإضافة", description: e.message || "تعذر إضافة العميل", variant: "destructive" });
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // Submit Booking Mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      // 1. Create passenger if new
      let pId = form.passenger_id ? Number(form.passenger_id) : null;
      if (form.passenger_type === "new_passenger" && form.passenger_name_ar) {
        const paxRes: any = await fetchWithAuth("/api/travel/passengers", {
          method: "POST",
          body: JSON.stringify({
            customer_id: form.customer_id || null,
            name_ar: form.passenger_name_ar,
            name_en: form.passenger_name_en || form.passenger_name_ar,
            title: form.passenger_title,
            passport_number: form.passport_number,
            passport_expiry_date: form.passport_expiry_date,
            nationality: form.nationality
          })
        });
        pId = paxRes.id;
      }

      // 2. Create Booking Ticket with comprehensive accounting linkages
      const bookingData = {
        booking_number: `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        service_type: "flight",
        customer_id: Number(form.customer_id),
        passenger_id: pId,
        airline_supplier: form.airline_supplier,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        supplier_name: form.supplier_name || form.airline_supplier,
        customer_currency: form.customer_currency || "SAR",
        supplier_currency: form.supplier_currency || "SAR",
        customer_statement: form.customer_statement || `قيمة تذكرة طيران للعميل: ${form.customer_name}`,
        supplier_statement: form.supplier_statement || `تكلفة تذكرة طيران من ${form.airline_supplier}`,
        supplier_payment_method: form.supplier_payment_method || "credit",
        flight_number: form.flight_number,
        origin_city: form.origin_city,
        destination_city: form.destination_city,
        departure_date: form.departure_date,
        departure_time: form.departure_time,
        return_date: form.trip_type === "round_trip" ? form.return_date : null,
        travel_class: form.travel_class,
        ticket_number: form.ticket_number,
        pnr: form.pnr,
        status: "issued",
        issue_date: new Date().toISOString().slice(0, 10),
        cost_price: cost + directExp,
        selling_price: totalSaleAmount,
        commission: netProfit,
        profit: netProfit,
        paid_amount: paid,
        supplier_paid_amount: Number(form.supplier_paid_amount || 0),
        payment_status: remainingDebt === 0 ? "paid" : (paid > 0 ? "partial" : "unpaid"),
        payment_method: form.payment_mode,
        safe_id: form.safe_id,
        bank_account_id: form.bank_account_id,
        notes: `${form.booking_notes} | تسعير: ${form.price_tier} | مسدد: ${paid} ${form.customer_currency} | متبقي آجل: ${remainingDebt} ${form.customer_currency}`
      };

      const result: any = await fetchWithAuth("/api/travel/bookings", {
        method: "POST",
        body: JSON.stringify(bookingData)
      });

      return result;
    },
    onSuccess: (res) => {
      setIssuedResult(res);
      setIsSuccessModal(true);
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      qc.invalidateQueries({ queryKey: ["suppliers-list"] });
      qc.invalidateQueries({ queryKey: ["safes-list"] });
      toast({
        title: "تم إصدار التذكرة وترحيل القيود بنجاح ✅",
        description: `تم ربط القيد المزدوج بالحسابات وتحديث رصيد العميل والمورد.`
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في إصدار التذكرة",
        description: err.message || "حدث خطأ أثناء حفظ التذكرة وترحيل القيود",
        variant: "destructive"
      });
    }
  });

  const nextStep = () => {
    if (currentStep === 1 && !form.customer_id) {
      toast({ title: "تنبيه", description: "يرجى اختيار العميل من دليل الحسابات للمتابعة", variant: "destructive" });
      return;
    }
    if (currentStep === 4 && totalSaleAmount < cost) {
      if (!confirm("تنبيه أمان: سعر البيع أقل من سعر التكلفة! هل ترغب في طلب موافقة إدارية وإكمال الإدخال؟")) {
        return;
      }
    }
    setCurrentStep(s => Math.min(s + 1, 6));
  };

  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Wizard Main Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-indigo-900/40">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/30 border border-indigo-400/30 rounded-xl">
                <Sparkles className="w-8 h-8 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  معالج الحجز السريع وإصدار التذاكر
                  <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                    مربوط بدليل الحسابات
                  </span>
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  إصدار تذاكر الطيران، اختيار العميل والمورد من دليل الحسابات، توليد القيود المزدوجة وتحديث الأرصدة تلقائياً
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/travel-dashboard">
              <Button variant="outline" size="sm" className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 text-xs">
                لوحة تحكم السفريات
              </Button>
            </Link>
            <Link href="/travel-bookings">
              <Button variant="outline" size="sm" className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 text-xs">
                سجل التذاكر والحجوزات
              </Button>
            </Link>
          </div>
        </div>

        {/* Wizard Steps Stepper Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-white p-3 rounded-xl border shadow-sm">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <button
                key={`wizard-step-${step.id || idx}`}
                onClick={() => setCurrentStep(step.id)}
                type="button"
                className={`p-2.5 rounded-lg text-right transition-all flex items-center gap-2.5 cursor-pointer ${
                  isCurrent 
                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20" 
                    : isCompleted 
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200" 
                    : "hover:bg-slate-50 text-muted-foreground"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isCurrent 
                    ? "bg-white text-primary" 
                    : isCompleted 
                    ? "bg-emerald-600 text-white" 
                    : "bg-slate-200 text-slate-600"
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold truncate">{step.title}</div>
                  <div className="text-[10px] opacity-75 truncate">{step.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Wizard Step Content Card */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6">
            {/* ================= STEP 1: CUSTOMER & CHART OF ACCOUNTS ================= */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="border-b pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      الخطوة 1: اختيار العميل ودليل الحسابات والعملة
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      يتم ربط التذكرة والفاتورة آلياً بحساب العميل في دليل الحسابات وتحديث المديونية والرصيد
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddCustomer(true)}
                    className="text-xs font-bold gap-1 border-primary/40 text-primary hover:bg-primary/5"
                  >
                    <Plus className="w-4 h-4" /> إضافة عميل جديد بالدليل
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Searchable Account Select for Customers */}
                    <SearchableAccountSelect
                      label="اختيار العميل من دليل الحسابات *"
                      required
                      type="customer"
                      value={form.customer_id}
                      accounts={customers}
                      placeholder="-- اضغط للبحث بالاسم أو الكود أو رقم الهاتف --"
                      title="دليل العملاء والحسابات"
                      onSelect={(cust) => handleSelectCustomer(cust)}
                      onQuickAdd={() => setShowAddCustomer(true)}
                      quickAddLabel="+ عميل جديد"
                    />

                    {/* Customer Currency Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        عملة العميل / الفاتورة (Customer Currency) *
                      </label>
                      <select
                        value={form.customer_currency}
                        onChange={e => setForm(f => ({ ...f, customer_currency: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs font-bold focus:ring-2 focus:ring-primary"
                      >
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pricing Tier */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">شريحة التسعير المطبقة (Pricing Tier)</label>
                      <select
                        value={form.price_tier}
                        onChange={e => setForm(f => ({ ...f, price_tier: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                      >
                        <option value="standard">سعر التجزئة العادي (Standard Retail)</option>
                        <option value="corporate">سعر الشركات والاتفاقيات (Corporate Discount)</option>
                        <option value="agent">سعر الوكلاء والموزعين (B2B Agent)</option>
                        <option value="employee">سعر الموظفين والأقارب (Staff Rate)</option>
                        <option value="vip">سعر كبار العملاء (VIP Client Rate)</option>
                      </select>
                    </div>

                    {/* Customer Statement */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">بيان القيد المالي للعميل (Statement)</label>
                      <Input
                        value={form.customer_statement}
                        onChange={e => setForm(f => ({ ...f, customer_statement: e.target.value }))}
                        placeholder="قيمة تذكرة طيران..."
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Customer Financial Profile Card */}
                  <div className="bg-slate-50 border rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      الملف المالي للعميل في دليل الحسابات
                    </h4>
                    {form.customer_id ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">اسم العميل:</span>
                          <span className="font-bold text-slate-900 text-sm">{form.customer_name}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">رقم الحساب بالدليل:</span>
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {form.customer_account_code || "11200"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">نوع الحساب:</span>
                          <span className="font-semibold text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {form.customer_type === 'corporate' ? 'حساب شركة (Corporate B2B)' : 'حساب أفراد (Retail)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">الرصيد الحالي المستحق:</span>
                          <span className={`font-mono font-bold text-sm ${form.current_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Number(form.current_balance || 0).toLocaleString()} {form.customer_currency}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">الحد الائتماني المتاح:</span>
                          <span className="font-mono font-bold text-blue-700">
                            {Number(form.credit_limit || 0).toLocaleString()} {form.customer_currency}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-muted-foreground text-xs space-y-1">
                        <UserCheck className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                        <p>لم يتم اختيار عميل بعد.</p>
                        <p className="text-[11px] text-slate-400">ابحث عن العميل أو اضغط على "+ إضافة عميل جديد".</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 2: PASSENGERS ================= */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" />
                    الخطوة 2: بيانات المسافرين وجواز السفر
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تحديد المسافر الفعلي المسافر على متن الرحلة ومطابقة بيانات الجواز للتذكرة الإلكترونية
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, passenger_type: "same_as_customer" }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        form.passenger_type === "same_as_customer"
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      👤 المسافر هو نفس العميل ({form.customer_name || "العميل"})
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, passenger_type: "select_existing" }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        form.passenger_type === "select_existing"
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      📋 اختيار مسافر مسجل مسبقاً
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, passenger_type: "new_passenger" }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        form.passenger_type === "new_passenger"
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      ✨ إضافة مسافر جديد
                    </button>
                  </div>

                  {form.passenger_type === "select_existing" && (
                    <div className="p-4 bg-slate-50 rounded-xl border space-y-2">
                      <label className="text-xs font-bold text-slate-700">قائمة المسافرين المسجلين:</label>
                      <select
                        value={form.passenger_id}
                        onChange={e => {
                          const pId = e.target.value;
                          const p = passengers.find(px => String(px.id) === String(pId));
                          if (p) {
                            setForm(f => ({
                              ...f,
                              passenger_id: String(p.id),
                              passenger_name_ar: p.name_ar,
                              passenger_name_en: p.name_en || "",
                              passport_number: p.passport_number || "",
                              passport_expiry_date: p.passport_expiry_date || "",
                              nationality: p.nationality || "سعودي"
                            }));
                          }
                        }}
                        className="w-full h-10 rounded-lg border bg-white px-3 text-xs"
                      >
                        <option value="">-- اضغط لاختيار المسافر --</option>
                        {passengers.map((p: any, idx: number) => (
                          <option key={`pax-${p.id || idx}`} value={p.id}>
                            {p.name_ar} ({p.name_en || "English Name"}) - جواز: {p.passport_number || "—"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">اسم المسافر بالعربي *</label>
                      <Input
                        value={form.passenger_name_ar}
                        onChange={e => setForm(f => ({ ...f, passenger_name_ar: e.target.value }))}
                        placeholder="الاسم الثلاثي أو الرباعي"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">الاسم بالإنجليزية (مطابق للجواز) *</label>
                      <Input
                        value={form.passenger_name_en}
                        onChange={e => setForm(f => ({ ...f, passenger_name_en: e.target.value.toUpperCase() }))}
                        placeholder="SURNAME / GIVEN NAME"
                        className="text-xs font-mono uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">اللقب (Title)</label>
                      <select
                        value={form.passenger_title}
                        onChange={e => setForm(f => ({ ...f, passenger_title: e.target.value }))}
                        className="w-full h-10 rounded-lg border bg-background px-3 text-xs"
                      >
                        <option value="Mr">السيد (Mr)</option>
                        <option value="Mrs">السيدة (Mrs)</option>
                        <option value="Ms">الآنسة (Ms)</option>
                        <option value="Child">طفل (CHD)</option>
                        <option value="Infant">رضيع (INF)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">رقم جواز السفر (Passport No) *</label>
                      <Input
                        value={form.passport_number}
                        onChange={e => setForm(f => ({ ...f, passport_number: e.target.value.toUpperCase() }))}
                        placeholder="A12345678"
                        className="text-xs font-mono uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">تاريخ انتهاء الجواز</label>
                      <Input
                        type="date"
                        value={form.passport_expiry_date}
                        onChange={e => setForm(f => ({ ...f, passport_expiry_date: e.target.value }))}
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">الجنسية (Nationality)</label>
                      <Input
                        value={form.nationality}
                        onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                        placeholder="سعودي / يمني / مصري..."
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 3: FLIGHT SEGMENTS & ROUTING ================= */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Plane className="w-5 h-5 text-primary" />
                    الخطوة 3: مسار الرحلة ومحطات الذهاب والعودة
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تحديد مطار المغادرة والوصول والتواريخ ورقم الحجز PNR ورقم الرحلة
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={form.trip_type === "round_trip" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm(f => ({ ...f, trip_type: "round_trip" }))}
                    className="text-xs font-bold"
                  >
                    🔄 ذهاب وعودة (Round Trip)
                  </Button>
                  <Button
                    type="button"
                    variant={form.trip_type === "one_way" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm(f => ({ ...f, trip_type: "one_way" }))}
                    className="text-xs font-bold"
                  >
                    ➡️ ذهاب فقط (One Way)
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">مدينة / مطار المغادرة (Origin) *</label>
                    <Input
                      value={form.origin_city}
                      onChange={e => setForm(f => ({ ...f, origin_city: e.target.value }))}
                      placeholder="الرياض (RUH) / جدة (JED)..."
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">مدينة / مطار الوصول (Destination) *</label>
                    <Input
                      value={form.destination_city}
                      onChange={e => setForm(f => ({ ...f, destination_city: e.target.value }))}
                      placeholder="دبي (DXB) / القاهرة (CAI) / إسطنبول (IST)..."
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">تاريخ ووقت الإقلاع (Departure)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={form.departure_date}
                        onChange={e => setForm(f => ({ ...f, departure_date: e.target.value }))}
                        className="text-xs font-mono"
                      />
                      <Input
                        type="time"
                        value={form.departure_time}
                        onChange={e => setForm(f => ({ ...f, departure_time: e.target.value }))}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  {form.trip_type === "round_trip" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">تاريخ ووقت العودة (Return)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={form.return_date}
                          onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
                          className="text-xs font-mono"
                        />
                        <Input
                          type="time"
                          value={form.return_time}
                          onChange={e => setForm(f => ({ ...f, return_time: e.target.value }))}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">رقم الرحلة (Flight Number)</label>
                    <Input
                      value={form.flight_number}
                      onChange={e => setForm(f => ({ ...f, flight_number: e.target.value.toUpperCase() }))}
                      placeholder="SV-112"
                      className="text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">درجة السفر (Cabin Class)</label>
                    <select
                      value={form.travel_class}
                      onChange={e => setForm(f => ({ ...f, travel_class: e.target.value }))}
                      className="w-full h-10 rounded-lg border bg-background px-3 text-xs"
                    >
                      <option value="اقتصادية">الدرجة السياحية (Economy Class)</option>
                      <option value="رجال الأعمال">درجة رجال الأعمال (Business Class)</option>
                      <option value="الأولى">الدرجة الأولى (First Class)</option>
                      <option value="سياحية ممتازة">السياحية الممتازة (Premium Economy)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">رمز الحجز PNR *</label>
                    <Input
                      value={form.pnr}
                      onChange={e => setForm(f => ({ ...f, pnr: e.target.value.toUpperCase() }))}
                      className="text-xs font-mono uppercase font-bold text-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">رقم التذكرة الإلكترونية (E-Ticket No)</label>
                    <Input
                      value={form.ticket_number}
                      onChange={e => setForm(f => ({ ...f, ticket_number: e.target.value }))}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 4: CARRIER, SUPPLIER IN CHART OF ACCOUNTS & ADVANCED PRICING ================= */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    الخطوة 4: ربط المورد بدليل الحسابات ونظام الأسعار
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختيار شركة الطيران أو المزود كطرف دائن من دليل الحسابات وتحديد العملة والتسعير والربح
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Supplier & Currency Selection */}
                  <div className="space-y-4">
                    {/* Searchable Account Select for Suppliers */}
                    <SearchableAccountSelect
                      label="اختيار المورد / شركة الطيران (من دليل الحسابات) *"
                      required
                      type="supplier"
                      value={form.supplier_id}
                      accounts={suppliersList.length > 0 ? suppliersList : airlines}
                      placeholder="-- اضغط للبحث عن المورد أو شركة الطيران بالدليل --"
                      title="دليل الموردين وشركات الطيران"
                      onSelect={(sup) => handleSelectSupplier(sup)}
                    />

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">الاسم التجاري للناقل (Carrier Display Name)</label>
                      <Input
                        value={form.airline_supplier}
                        onChange={e => setForm(f => ({ ...f, airline_supplier: e.target.value }))}
                        placeholder="مثال: الخطوط السعودية (Saudia)..."
                        className="text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Supplier Currency */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-500" />
                          عملة المورد (Currency)
                        </label>
                        <select
                          value={form.supplier_currency}
                          onChange={e => setForm(f => ({ ...f, supplier_currency: e.target.value }))}
                          className="w-full h-10 rounded-lg border bg-background px-3 text-xs font-bold"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Supplier Payment Method */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">طريقة سداد المورد</label>
                        <select
                          value={form.supplier_payment_method}
                          onChange={e => setForm(f => ({ ...f, supplier_payment_method: e.target.value }))}
                          className="w-full h-10 rounded-lg border bg-background px-3 text-xs"
                        >
                          <option value="credit">آجل / على حساب المورد (Credit)</option>
                          <option value="cash">نقداً من الصندوق (Cash)</option>
                          <option value="bank_transfer">تحويل بنكي للمورد (Bank)</option>
                        </select>
                      </div>
                    </div>

                    {/* Price Inputs */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">سعر شراء التذكرة من المورد (Cost) *</label>
                        <Input
                          type="number"
                          value={form.supplier_cost}
                          onChange={e => setForm(f => ({ ...f, supplier_cost: Number(e.target.value) }))}
                          className="font-mono font-bold text-slate-900"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">سعر البيع الأساسي للعميل (Selling) *</label>
                        <Input
                          type="number"
                          value={form.selling_price}
                          onChange={e => setForm(f => ({ ...f, selling_price: Number(e.target.value) }))}
                          className="font-mono font-bold text-blue-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">رسوم الخدمة (+)</label>
                        <Input
                          type="number"
                          value={form.service_fee}
                          onChange={e => setForm(f => ({ ...f, service_fee: Number(e.target.value) }))}
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">خصم العميل (-)</label>
                        <Input
                          type="number"
                          value={form.discount_amount}
                          onChange={e => setForm(f => ({ ...f, discount_amount: Number(e.target.value) }))}
                          className="font-mono text-xs text-red-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">مصروف مباشر (+)</label>
                        <Input
                          type="number"
                          value={form.direct_expense}
                          onChange={e => setForm(f => ({ ...f, direct_expense: Number(e.target.value) }))}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Real-time Profit & Cost Engine */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" /> محرك حساب الربح والتسعير الآلي
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        {form.customer_currency}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>سعر البيع الأساسي للعميل:</span>
                        <span className="font-mono text-slate-200">{baseSell.toLocaleString()} {form.customer_currency}</span>
                      </div>
                      {sFee > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>+ رسوم الخدمة المضافة:</span>
                          <span className="font-mono">+{sFee.toLocaleString()} {form.customer_currency}</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="flex justify-between text-red-400">
                          <span>- الخصم الممنوح للعميل:</span>
                          <span className="font-mono">-{discount.toLocaleString()} {form.customer_currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-1.5">
                        <span>إجمالي الفاتورة على العميل:</span>
                        <span className="font-mono text-cyan-400">{totalSaleAmount.toLocaleString()} {form.customer_currency}</span>
                      </div>

                      <div className="flex justify-between text-slate-400 border-t border-slate-800/60 pt-1.5">
                        <span>- تكلفة المورد الأساسية:</span>
                        <span className="font-mono text-slate-300">-{cost.toLocaleString()} {form.supplier_currency}</span>
                      </div>
                    </div>

                    <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-emerald-300 font-bold uppercase">صافي ربح التذكرة (Net Commission)</div>
                        <div className="text-[11px] text-slate-400">يُسجل في حـ/ إيرادات التذاكر (41001)</div>
                      </div>
                      <div className="text-xl font-mono font-extrabold text-emerald-400">
                        +{netProfit.toLocaleString()} {form.customer_currency}
                      </div>
                    </div>

                    {totalSaleAmount < cost && (
                      <div className="bg-red-950/80 border border-red-500/50 rounded-xl p-2.5 flex items-center gap-2 text-red-200 text-xs">
                        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                        <span>تحذير: العملية بأقل من سعر التكلفة وستتطلب اعتماداً إدارياً!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 5: PAYMENT & TREASURY ================= */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    الخطوة 5: طريقة الدفع والسداد والخزينة (Payment & Treasury)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تحديد وسيلة تحصيل المبلغ من العميل (نقداً، آجل، أو دفعة جزئية) والخزينة أو الحساب البنكي
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: "cash", paid_amount: totalSaleAmount }))}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                      form.payment_mode === "cash" 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-sm" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-bold flex items-center justify-between">
                      <span>1. سداد كامل نقداً / شبكة</span>
                      <Receipt className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">تسوية كامل المبلغ ({totalSaleAmount.toLocaleString()} {form.customer_currency}) في الصندوق فوراً</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: "credit", paid_amount: 0 }))}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                      form.payment_mode === "credit" 
                        ? "border-blue-500 bg-blue-50 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-sm" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-bold flex items-center justify-between">
                      <span>2. بيع آجل على الحساب</span>
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">ترحيل كامل المبلغ لذمة العميل في دليل الحسابات (مديونية)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: "partial", paid_amount: Math.round(totalSaleAmount / 2) }))}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                      form.payment_mode === "partial" 
                        ? "border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-sm" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-bold flex items-center justify-between">
                      <span>3. دفعة مقدمة / سداد جزئي</span>
                      <DollarSign className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">تحصيل دفعة نقداً وترحيل المتبقي كمديونية على العميل</div>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">المبلغ المحصل الآن (Paid Now) *</label>
                    <Input
                      type="number"
                      value={form.paid_amount}
                      onChange={e => setForm(f => ({ ...f, paid_amount: Number(e.target.value) }))}
                      className="font-mono font-bold text-emerald-700 text-lg bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">المتبقي آجل على العميل (Remaining)</label>
                    <div className="h-10 flex items-center px-3 rounded-md bg-white border font-mono font-bold text-red-600 text-base">
                      {remainingDebt.toLocaleString()} {form.customer_currency}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">الصندوق / الخزينة المستلمة</label>
                    <select
                      value={form.safe_id}
                      onChange={e => setForm(f => ({ ...f, safe_id: Number(e.target.value) }))}
                      className="w-full h-10 rounded-md border border-input bg-white px-3 text-xs font-semibold"
                    >
                      {safes.map((s: any, idx: number) => (
                        <option key={`safe-${s.id || idx}`} value={s.id}>
                          {s.name} ({s.currency || 'SAR'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 6: CONFIRMATION & FINANCIAL IMPACT PREVIEW ================= */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-primary" />
                    الخطوة 6: مراجعة الحجز ومعاينة القيد المحاسبي المزدوج
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    مراجعة بيانات التذكرة، حسابات الطرفين في الدليل، والقيد المزدوج قبل الحفظ النهائي
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Summary Card 1 */}
                  <div className="border rounded-xl p-4 bg-slate-50/70 space-y-2.5">
                    <h4 className="font-bold text-slate-800 text-xs border-b pb-1 text-primary flex items-center gap-1.5">
                      <Ticket className="w-4 h-4" /> بيانات التذكرة والرحلة
                    </h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">العميل:</span><span className="font-bold">{form.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المسافر:</span><span className="font-bold">{form.passenger_name_ar} ({form.passenger_name_en})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">جواز السفر:</span><span className="font-mono font-semibold">{form.passport_number || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">خط السير:</span><span className="font-bold">{form.origin_city} ⬅️ {form.destination_city}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">تاريخ الرحلة:</span><span className="font-mono">{form.departure_date} ({form.departure_time})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">الناقل والدرجة:</span><span>{form.airline_supplier} - {form.travel_class}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">رقم الحجز PNR:</span><span className="font-mono font-bold text-primary">{form.pnr}</span></div>
                  </div>

                  {/* Summary Card 2: Accounting Impact */}
                  <div className="border rounded-xl p-4 bg-slate-50/70 space-y-2.5">
                    <h4 className="font-bold text-slate-800 text-xs border-b pb-1 text-emerald-700 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4" /> الأثر المالي في دليل الحسابات
                    </h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">حساب العميل (المدين):</span><span className="font-mono font-bold text-slate-800">{form.customer_account_code || "11200"} - {form.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">حساب المورد (الدائن):</span><span className="font-mono font-bold text-slate-800">{form.supplier_account_code || "21100"} - {form.supplier_name || form.airline_supplier}</span></div>
                    <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">إجمالي قيمة الفاتورة:</span><span className="font-mono font-bold text-slate-900">{totalSaleAmount.toLocaleString()} {form.customer_currency}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">تكلفة شراء المورد:</span><span className="font-mono text-slate-600">{cost.toLocaleString()} {form.supplier_currency}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">صافي ربح التذكرة:</span><span className="font-mono font-bold text-emerald-700">+{netProfit.toLocaleString()} {form.customer_currency}</span></div>
                    <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">المدفوع نقداً بالخزينة:</span><span className="font-mono font-bold text-blue-700">{paid.toLocaleString()} {form.customer_currency}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المتبقي آجل على العميل:</span><span className="font-mono font-bold text-red-600">{remainingDebt.toLocaleString()} {form.customer_currency}</span></div>
                  </div>
                </div>

                {/* Journal Entry Preview Table */}
                <div className="border rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-900 text-white p-2.5 text-xs font-bold flex justify-between items-center">
                    <span>معاينة القيد المحاسبي المزدوج الآلي (Automatic Journal Entry)</span>
                    <span className="text-[10px] text-amber-300">متزن ومرحل للحسابات</span>
                  </div>
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b">
                        <th className="p-2.5">رقم الحساب</th>
                        <th className="p-2.5">اسم الحساب في الدليل</th>
                        <th className="p-2.5">البيان والشرح</th>
                        <th className="p-2.5 text-center">مدين (Debit)</th>
                        <th className="p-2.5 text-center">دائن (Credit)</th>
                        <th className="p-2.5 text-center">العملة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {/* Customer / Safe Debit */}
                      {paid > 0 && (
                        <tr>
                          <td className="p-2 text-indigo-700 font-bold">11100</td>
                          <td className="p-2 font-sans font-semibold">الصندوق والخزينة الرئيسية</td>
                          <td className="p-2 font-sans text-slate-500">تحصيل نقدي - {form.customer_name}</td>
                          <td className="p-2 text-center text-emerald-700 font-bold">{paid.toLocaleString()}</td>
                          <td className="p-2 text-center text-slate-400">0.00</td>
                          <td className="p-2 text-center font-sans">{form.customer_currency}</td>
                        </tr>
                      )}
                      {remainingDebt > 0 && (
                        <tr>
                          <td className="p-2 text-indigo-700 font-bold">{form.customer_account_code || "11200"}</td>
                          <td className="p-2 font-sans font-semibold">ذمم العملاء - {form.customer_name}</td>
                          <td className="p-2 font-sans text-slate-500">آجل متبقي على العميل</td>
                          <td className="p-2 text-center text-emerald-700 font-bold">{remainingDebt.toLocaleString()}</td>
                          <td className="p-2 text-center text-slate-400">0.00</td>
                          <td className="p-2 text-center font-sans">{form.customer_currency}</td>
                        </tr>
                      )}
                      {/* Revenue Credit */}
                      <tr>
                        <td className="p-2 text-indigo-700 font-bold">41001</td>
                        <td className="p-2 font-sans font-semibold">إيرادات ومبيعات تذاكر الطيران</td>
                        <td className="p-2 font-sans text-slate-500">إجمالي فاتورة التذكرة PNR: {form.pnr}</td>
                        <td className="p-2 text-center text-slate-400">0.00</td>
                        <td className="p-2 text-center text-blue-700 font-bold">{totalSaleAmount.toLocaleString()}</td>
                        <td className="p-2 text-center font-sans">{form.customer_currency}</td>
                      </tr>
                      {/* Supplier Cost & Payables */}
                      {cost > 0 && (
                        <>
                          <tr>
                            <td className="p-2 text-indigo-700 font-bold">51000</td>
                            <td className="p-2 font-sans font-semibold">تكاليف ومشتريات خدمات السفر</td>
                            <td className="p-2 font-sans text-slate-500">تكلفة التذكرة من {form.supplier_name || form.airline_supplier}</td>
                            <td className="p-2 text-center text-emerald-700 font-bold">{cost.toLocaleString()}</td>
                            <td className="p-2 text-center text-slate-400">0.00</td>
                            <td className="p-2 text-center font-sans">{form.supplier_currency}</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-indigo-700 font-bold">{form.supplier_account_code || "21100"}</td>
                            <td className="p-2 font-sans font-semibold">حساب المورد - {form.supplier_name || form.airline_supplier}</td>
                            <td className="p-2 font-sans text-slate-500">استحقاق المورد (آجل)</td>
                            <td className="p-2 text-center text-slate-400">0.00</td>
                            <td className="p-2 text-center text-blue-700 font-bold">{cost.toLocaleString()}</td>
                            <td className="p-2 text-center font-sans">{form.supplier_currency}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ملاحظات إضافية على الحجز والفاتورة</label>
                  <Input
                    value={form.booking_notes}
                    onChange={e => setForm(f => ({ ...f, booking_notes: e.target.value }))}
                    placeholder="شروط خاصة، سياسة أمتعة، رقم المقعد..."
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* Step Actions Toolbar */}
            <div className="flex items-center justify-between border-t pt-5 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="gap-2 font-bold text-xs"
              >
                <ArrowRight className="w-4 h-4" /> السابق
              </Button>

              {currentStep < 6 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-bold px-6 text-xs"
                >
                  المتابعة للخطوة التالية <ArrowLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-8 text-sm shadow-md"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {bookMutation.isPending ? "جاري إصدار الحجز وترحيل القيود..." : "تأكيد الحجز وإصدار الفاتورة النهائية"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Add Customer Modal */}
        <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                إضافة عميل جديد وربطه بدليل الحسابات
              </DialogTitle>
              <DialogDescription className="text-xs">
                سيتم إنشاء حساب مالي مستقل للعميل تحت الأصول المتداولة (11200 - ذمم مدينة)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-bold">اسم العميل / الشركة *</label>
                <Input
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="الاسم الكامل أو اسم المنشأة"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold">رقم الهاتف / الواتساب</label>
                <Input
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="0500000000"
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold">نوع العميل</label>
                <select
                  value={newCustType}
                  onChange={e => setNewCustType(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs"
                >
                  <option value="individual">أفراد (Individual)</option>
                  <option value="corporate">شركة / جهة اعتبارية (Corporate)</option>
                  <option value="vip">عميل مهم (VIP)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setShowAddCustomer(false)} className="text-xs">
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleQuickAddCustomer}
                disabled={isAddingCustomer}
                className="bg-primary text-xs font-bold gap-1"
              >
                {isAddingCustomer ? "جاري الحفظ..." : "حفظ وإدراج بالدليل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Success Modal with Print and ATB Options */}
        <Dialog open={isSuccessModal} onOpenChange={setIsSuccessModal}>
          <DialogContent className="max-w-lg text-center" dir="rtl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center text-slate-900">
                تم تأكيد الحجز وإصدار التذكرة بنجاح!
              </DialogTitle>
              <DialogDescription className="text-center text-xs">
                تم تسجيل التذكرة برقم PNR <span className="font-mono font-bold text-primary">{form.pnr}</span> وترحيل القيود المحاسبية إلى حساب العميل والمورد
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 border rounded-xl p-4 text-xs text-right space-y-2 font-sans my-3">
              <div className="flex justify-between"><span>العميل:</span><span className="font-bold">{form.customer_name}</span></div>
              <div className="flex justify-between"><span>المورد / الناقل:</span><span className="font-bold">{form.airline_supplier}</span></div>
              <div className="flex justify-between"><span>المسافر:</span><span className="font-bold">{form.passenger_name_ar}</span></div>
              <div className="flex justify-between"><span>خط السير:</span><span className="font-bold">{form.origin_city} ⬅️ {form.destination_city}</span></div>
              <div className="flex justify-between"><span>إجمالي المبلغ:</span><span className="font-mono font-bold text-slate-900">{totalSaleAmount.toLocaleString()} {form.customer_currency}</span></div>
              <div className="flex justify-between"><span>المبلغ المحصل نقداً:</span><span className="font-mono font-bold text-emerald-700">{paid.toLocaleString()} {form.customer_currency}</span></div>
              {remainingDebt > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>المسجل آجل في كشف حساب العميل:</span>
                  <span className="font-mono font-bold">{remainingDebt.toLocaleString()} {form.customer_currency}</span>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSuccessModal(false);
                  setCurrentStep(1);
                  setForm(f => ({
                    ...f,
                    pnr: `PNR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    ticket_number: `065-${Math.floor(1000000000 + Math.random() * 9000000000)}`
                  }));
                }}
                className="font-bold text-xs"
              >
                إجراء حجز جديد
              </Button>

              <Button
                size="sm"
                onClick={() => setPrintModalOpen(true)}
                className="bg-primary gap-1 font-bold text-xs"
              >
                <Printer className="w-4 h-4" /> معاينة وطباعة التذكرة
              </Button>

              <Link href="/travel-atb-printing">
                <Button size="sm" variant="secondary" className="gap-1 font-bold text-xs">
                  <Ticket className="w-4 h-4" /> محرك بطاقة الصعود ATB
                </Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Official Travel Document Print Modal */}
        {issuedResult && (
          <TravelPrintModal
            open={printModalOpen}
            onOpenChange={setPrintModalOpen}
            documentType="ticket"
            data={issuedResult}
          />
        )}
      </div>
    </AdminLayout>
  );
}
