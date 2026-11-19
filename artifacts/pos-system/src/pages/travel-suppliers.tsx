import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  Wallet,
  Receipt,
  FileText,
  DollarSign,
  Printer,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Eye,
  X,
  CreditCard,
  Building,
  Check
} from "lucide-react";
import { useAgencyConfig } from "@/hooks/use-agency-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { tafqeet } from "@/lib/tafqeet";

const fmt = (num: number) => (num || 0).toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const currenciesList = [
  { code: "SAR", name: "ريال سعودي (SAR)", rate: "1", symbol: "ر.س" },
  { code: "USD", name: "دولار أمريكي (USD)", rate: "3.75", symbol: "$" },
  { code: "YER", name: "ريال يمني (YER)", rate: "0.0025", symbol: "ر.ي" },
  { code: "EUR", name: "يورو (EUR)", rate: "4.10", symbol: "€" },
  { code: "AED", name: "درهم إماراتي (AED)", rate: "1.02", symbol: "د.إ" }
];

export default function TravelSuppliersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { agencyName } = useAgencyConfig();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Modals & Sheets
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openStatementSheet, setOpenStatementSheet] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

  // Full-Screen Report Viewer
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Forms
  const [form, setForm] = useState({
    name: "",
    supplier_type: "شركة طيران",
    contact_person: "",
    phone: "",
    email: "",
    country: "السعودية",
    currency: "ريال",
    bank_details: "",
    notes: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    voucher_no: `PAY-SUP-${Math.floor(100000 + Math.random() * 900000)}`,
    reference_no: "REF-101",
    manual_no: "",
    voucher_date: new Date().toISOString().slice(0, 10),
    currency: "SAR",
    exchange_rate: "1",
    amount: "1000",
    foreign_amount: "1000",
    payment_method: "cash",
    safe_id: "1",
    bank_account_id: "",
    cost_center: "الفرع الرئيسي",
    notes: "سداد دفعة حساب للمورد",
    amount_text: ""
  });

  // Queries
  const { data: safesRaw } = useQuery({
    queryKey: ["/api/accounting/safes"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/safes");
      return res.json();
    }
  });
  const safes = Array.isArray(safesRaw) ? safesRaw : (safesRaw?.safes || safesRaw?.data || []);

  const { data: suppliersRaw, isLoading } = useQuery({
    queryKey: ["/api/travel/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/travel/suppliers");
      return res.json();
    }
  });
  const suppliers = Array.isArray(suppliersRaw) ? suppliersRaw : (suppliersRaw?.suppliers || suppliersRaw?.data || []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const suppId = params.get("supplierId");
    const action = params.get("action");
    if (suppId && suppliers.length > 0) {
      const found = suppliers.find((s: any) => s.id.toString() === suppId);
      if (found) {
        setSelectedSupplier(found);
        if (action === "statement") {
          setOpenStatementSheet(true);
        }
      }
    }
  }, [suppliers]);

  const { data: statementData, refetch: refetchStatement } = useQuery({
    queryKey: ["/api/travel/suppliers", selectedSupplier?.id, "statement"],
    queryFn: async () => {
      if (!selectedSupplier?.id) return null;
      const res = await fetch(`/api/travel/suppliers/${selectedSupplier.id}/statement`);
      return res.json();
    },
    enabled: !!selectedSupplier?.id
  });

  // Mutations
  const createSupplierMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل تسجيل المورد");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/suppliers"] });
      toast({ title: "نجاح", description: "تم تسجيل المورد/الوكيل بنجاح ✅" });
      setOpenAddModal(false);
    }
  });

  const paySupplierMutation = useMutation({
    mutationFn: async ({ suppId, payload }: { suppId: number; payload: any }) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/suppliers/${suppId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إضافة سند الصرف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/suppliers"] });
      refetchStatement();
      toast({ title: "تم الصرف", description: "تم إنشاء سند الصرف وترحيل القيد المحاسبي بنجاح ✅" });
      setOpenPaymentModal(false);
    }
  });

  const filtered = suppliers.filter((s: any) => {
    const matchType = filterType === "all" || s.supplier_type === filterType;
    const matchSearch =
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.supplier_code?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Print Statement Report Preview
  const handlePreviewStatement = (supp: any) => {
    const suppName = supp.name || "المورد";
    const balance = supp.current_balance || 0;
    const payments = statementData?.payments || [];
    const paymentsRows = payments.map((p: any, idx: number) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${p.voucher_number || `PV-${p.id}`}</td>
        <td>${p.voucher_date || '-'}</td>
        <td>${p.notes || 'سند صرف دفعة'}</td>
        <td style="font-family: monospace; font-weight: bold; color: #b45309;">${fmt(p.amount)} ريال</td>
      </tr>
    `).join("");

    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 25px;">
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #b45309;">كشف حساب مورد / وكيل تفصيلي</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">المورد: ${suppName} | الكود: ${supp.supplier_code || 'SUP-101'}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; text-align: center;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b;">اسم المورد</div>
            <div style="font-size: 15px; font-weight: bold; color: #1e293b;">${suppName}</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b;">تصنيف النشاط</div>
            <div style="font-size: 15px; font-weight: bold; color: #1e293b;">${supp.supplier_type || 'خدمات سياحية'}</div>
          </div>
          <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;">
            <div style="font-size: 12px; color: #92400e;">الرصيد الدائن المستحق</div>
            <div style="font-size: 18px; font-weight: bold; color: #b45309; font-family: monospace;">${fmt(balance)} ريال</div>
          </div>
        </div>

        <h3 style="color: #1e293b; margin-bottom: 10px;">سجل سندات الدفع والصرف:</h3>
        <table>
          <thead>
            <tr style="background: #fef3c7; color: #78350f;">
              <th>#</th>
              <th>رقم السند</th>
              <th>التاريخ</th>
              <th>البيان والملاحظات</th>
              <th>المبلغ المصروف</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsRows || "<tr><td colSpan='5' style='text-align: center;'>لا توجد عمليات صرف مسجلة لهذه الفترة</td></tr>"}
          </tbody>
        </table>
      </div>
    `;

    setReportHtml(html);
    setReportTitle(`كشف حساب المورد - ${suppName}`);
    setReportViewerOpen(true);
  };

  const handleOpenPayment = (supp: any) => {
    setSelectedSupplier(supp);
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const initialAmount = 1000;
    setPaymentForm({
      voucher_no: `PAY-SUP-${randomNum}`,
      reference_no: `REF-${randomNum.toString().slice(-4)}`,
      manual_no: "",
      voucher_date: new Date().toISOString().slice(0, 10),
      currency: "SAR",
      exchange_rate: "1",
      amount: String(initialAmount),
      foreign_amount: String(initialAmount),
      payment_method: "cash",
      safe_id: safes[0]?.id ? String(safes[0].id) : "1",
      bank_account_id: "",
      cost_center: "الفرع الرئيسي",
      notes: `سداد دفعة من مستحقات المورد: ${supp.name}`,
      amount_text: tafqeet(initialAmount, "SAR")
    });
    setOpenPaymentModal(true);
  };

  const cyclePaymentCurrency = () => {
    const currentIdx = currenciesList.findIndex(c => c.code === paymentForm.currency);
    const nextIdx = (currentIdx + 1) % currenciesList.length;
    const nextCurr = currenciesList[nextIdx];
    const newRate = nextCurr.rate;
    const numAmt = Number(paymentForm.amount) || 0;
    const newForeign = Number(newRate) !== 0 ? Math.round((numAmt / Number(newRate)) * 100) / 100 : numAmt;
    setPaymentForm(prev => ({
      ...prev,
      currency: nextCurr.code,
      exchange_rate: newRate,
      foreign_amount: String(newForeign),
      amount_text: tafqeet(numAmt, nextCurr.code)
    }));
    toast({ title: `(F9) تم تبديل العملة إلى: ${nextCurr.name}` });
  };

  const handlePreviewPaymentVoucher = () => {
    const suppName = selectedSupplier?.name || "المورد";
    const numAmt = Number(paymentForm.amount) || 0;
    const curr = paymentForm.currency || "SAR";
    const tafq = paymentForm.amount_text || tafqeet(numAmt, curr);
    const safeObj = safes.find((s: any) => String(s.id) === String(paymentForm.safe_id));
    const safeName = safeObj?.name || (paymentForm.payment_method === 'bank' ? 'الحساب البنكي' : 'الصندوق الرئيسي');
    
    const voucherHtml = `
      <div style="direction: rtl; font-family: Tajawal, Arial, sans-serif; padding: 25px; color: #1e293b;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #e11d48; padding-bottom: 12px; margin-bottom: 20px;">
          <div>
            <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 800;">${agencyName}</h2>
            <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">نظام إدارة شبكة الموردين والمشتريات والحسابات العامة</p>
          </div>
          <div style="text-align: center;">
            <div style="background: #e11d48; color: white; font-size: 16px; font-weight: 800; padding: 6px 24px; border-radius: 6px; letter-spacing: 0.5px;">
              سند صرف نقدي / بنكي (PAYMENT VOUCHER)
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">رقم السند: <strong style="font-family: monospace; color: #e11d48; font-size: 13px;">${paymentForm.voucher_no}</strong></div>
          </div>
          <div style="text-align: left; font-size: 12px; color: #475569; font-family: monospace;">
            <div>التاريخ: <strong>${paymentForm.voucher_date}</strong></div>
            <div>المرجع: <strong>${paymentForm.reference_no || '-'}</strong></div>
            <div>طريقة الدفع: <strong>${paymentForm.payment_method === 'bank' ? 'تحويل بنكي' : 'نقداً من الصندوق'}</strong></div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; font-size: 13px; line-height: 2;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>يصرف إلى السادة / المورد: <strong style="font-size: 15px; color: #0f172a;">${suppName}</strong> (كود: ${selectedSupplier?.supplier_code || '-'})</div>
            <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 4px 12px; border-radius: 6px; font-weight: bold; color: #be123c;">
              المبلغ: <span style="font-family: monospace; font-size: 16px;">${fmt(numAmt)}</span> ${curr}
            </div>
          </div>
          <div style="margin-top: 8px;">
            المبلغ كتابةً: <strong style="color: #92400e;">فقط ${tafq} لا غير</strong>
          </div>
          <div style="margin-top: 6px;">
            من حساب / الصندوق: <strong>${safeName}</strong> &nbsp;|&nbsp; مركز التكلفة: <strong>${paymentForm.cost_center || 'الفرع الرئيسي'}</strong>
          </div>
          <div style="margin-top: 6px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
            وذلك مقابل: <strong>${paymentForm.notes || 'سداد مستحقات ومطالبات توريد وخدمات'}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 12px; margin-bottom: 25px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; color: #334155; font-weight: bold;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">رقم الحساب</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">اسم الحساب في الدليل</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">العملة</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">سعر الصرف</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">مدين (${curr})</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">دائن (${curr})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${selectedSupplier?.account_code || '21100'}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">حساب المورد: ${suppName}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${curr}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${paymentForm.exchange_rate}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #e11d48;">${fmt(numAmt)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">0.00</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${paymentForm.payment_method === 'bank' ? '11120' : '11100'}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${safeName}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${curr}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${paymentForm.exchange_rate}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">0.00</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0284c7;">${fmt(numAmt)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; margin-top: 40px; font-size: 13px;">
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">
            <div>أمين الصندوق / المنفذ</div>
            <div style="height: 45px;"></div>
            <div style="color: #64748b; font-size: 11px;">التوقيع: .....................</div>
          </div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">
            <div>المحاسب المالي / التدقيق</div>
            <div style="height: 45px;"></div>
            <div style="color: #64748b; font-size: 11px;">التوقيع: .....................</div>
          </div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">
            <div>استلمت المبلغ كاملاً (المستلم)</div>
            <div style="height: 45px;"></div>
            <div style="color: #64748b; font-size: 11px;">توقيع / ختم المستلم: .....................</div>
          </div>
        </div>
      </div>
    `;

    setReportHtml(voucherHtml);
    setReportTitle(`سند صرف مورد - ${paymentForm.voucher_no}`);
    setReportViewerOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-amber-600" />
              <h1 className="text-2xl font-bold text-slate-800">إدارة الموردين والوكلاء (Suppliers & Agents)</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              إدارة شركات الطيران، سلاسل الفنادق، النقل، وكلاء التأشيرات، مع كشف حساب دائن ومدين وسندات الصرف المحاسبية
            </p>
          </div>
          <Button onClick={() => setOpenAddModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium">
            <Plus className="w-4 h-4" /> إضافة مورد/وكيل جديد
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المورد، الكود، مسؤول التواصل..."
              className="pr-9"
            />
          </div>

          <div className="w-full md:w-64">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="نوع المورد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموردين والوكلاء</SelectItem>
                <SelectItem value="شركة طيران">شركات الطيران</SelectItem>
                <SelectItem value="فندق / سلسلة">سلاسل الفنادق</SelectItem>
                <SelectItem value="شركة نقل">شركات النقل والمواصلات</SelectItem>
                <SelectItem value="شركة تأمين">شركات التأمين</SelectItem>
                <SelectItem value="وكيل تأشيرات">وكلاء التأشيرات</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Supplier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-3 text-center py-12 text-slate-500">جاري تحميل قائمة الموردين...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-3 text-center py-12 bg-white rounded-2xl border text-slate-500">
              لا يوجد موردين مطابقين للبحث
            </div>
          ) : (
            filtered.map((supp: any, idx: number) => (
              <div key={`supp-${supp.id || idx}-${idx}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold bg-amber-50 text-amber-800 rounded-lg">
                      {supp.supplier_code}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-bold">
                      {supp.supplier_type}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-snug">{supp.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">المسؤول: {supp.contact_person || "غير محدد"}</p>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
                    {supp.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /><span dir="ltr">{supp.phone}</span></div>}
                    {supp.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /><span className="truncate">{supp.email}</span></div>}
                  </div>

                  <div className="flex justify-between items-center p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="text-xs text-slate-600">الرصيد الدائن المستحق:</span>
                    <span className="font-bold text-amber-800 text-base font-mono">
                      {fmt(supp.current_balance)} ريال
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1 border-slate-200"
                    onClick={() => { setSelectedSupplier(supp); setOpenStatementSheet(true); }}
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> كشف حساب
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1"
                    onClick={() => handleOpenPayment(supp)}
                  >
                    <Coins className="w-3.5 h-3.5" /> سند صرف
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Full-Screen Modal Add Supplier */}
        <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-800">
                <Users className="w-6 h-6 text-amber-600" /> تسجيل مورد أو وكيل خدمات سياحية جديد
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-4 text-sm">
              <div className="space-y-1 col-span-2">
                <Label className="font-bold">اسم المورد / الشركة *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: الخطوط السعودية / Bupa / VFS Global" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">تصنيف المورد</Label>
                <Select value={form.supplier_type} onValueChange={(v) => setForm({ ...form, supplier_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="شركة طيران">شركة طيران</SelectItem>
                    <SelectItem value="فندق / سلسلة">فندق / سلسلة فنادق</SelectItem>
                    <SelectItem value="شركة نقل">شركة نقل ومواصلات</SelectItem>
                    <SelectItem value="شركة تأمين">شركة تأمين</SelectItem>
                    <SelectItem value="وكيل تأشيرات">وكيل تأشيرات</SelectItem>
                    <SelectItem value="متعهد رحلات">متعهد رحلات سياحية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">اسم مسؤول التواصل</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="اسم المندوب" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0501122334" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">البريد الإلكتروني</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="b2b@supplier.com" />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="font-bold">تفاصيل الحساب البنكي والتحويلات</Label>
                <Input value={form.bank_details} onChange={(e) => setForm({ ...form, bank_details: e.target.value })} placeholder="رقم الآيبان IBAN - اسم البنك" />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenAddModal(false)}>إلغاء</Button>
              <Button onClick={() => createSupplierMutation.mutate(form)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8">
                حفظ بيانات المورد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Payment Voucher - General Accounting Grade */}
        <Dialog open={openPaymentModal} onOpenChange={setOpenPaymentModal}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto dir-rtl bg-slate-100 dark:bg-slate-900 p-4 font-sans text-xs" dir="rtl">
            {/* Top Header Bar */}
            <div className="flex flex-wrap items-center justify-between bg-slate-200 dark:bg-slate-800 p-2.5 rounded-lg border shadow-sm gap-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="bg-rose-600 text-white px-3.5 py-1 rounded font-extrabold text-sm shadow">سند صرف</span>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border">
                  <span className="text-slate-500 font-bold">التاريخ:</span>
                  <Input 
                    type="date" 
                    value={paymentForm.voucher_date} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, voucher_date: e.target.value })} 
                    className="h-7 w-28 text-xs border-0 bg-transparent p-0 font-bold" 
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border">
                  <span className="text-slate-500 font-bold">رقم السند:</span>
                  <Input 
                    value={paymentForm.voucher_no} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, voucher_no: e.target.value })} 
                    className="h-7 w-28 text-xs border-0 bg-transparent p-0 font-bold text-center font-mono text-rose-700" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border">
                  <span className="text-slate-500">رقم المرجع:</span>
                  <Input 
                    value={paymentForm.reference_no} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} 
                    className="h-7 w-20 text-xs border-0 bg-transparent p-0 text-center font-bold font-mono" 
                    placeholder="REF-101"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border">
                  <span className="text-slate-500">رقم يدوي:</span>
                  <Input 
                    value={paymentForm.manual_no} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, manual_no: e.target.value })} 
                    placeholder="2" 
                    className="h-7 w-14 text-xs border-0 bg-transparent p-0 text-center font-mono" 
                  />
                </div>
                <Badge variant="outline" className={paymentForm.payment_method === 'bank' ? "bg-blue-100 text-blue-800 border-blue-300 font-bold" : "bg-rose-100 text-rose-800 border-rose-300 font-bold"}>
                  {paymentForm.payment_method === 'bank' ? "سند صرف بنكي" : "سند صرف نقدي"}
                </Badge>
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="mt-3 bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm space-y-3.5">
              {/* Row 1: First Party (Safe/Bank) & Currency with F9 & Exchange Rate */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  الصندوق / الحساب (الطرف الأول):
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Select value={paymentForm.safe_id} onValueChange={(v) => setPaymentForm({ ...paymentForm, safe_id: v })}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 border-slate-300 font-bold">
                      <SelectValue placeholder="اختر الصندوق أو الحساب البنكي" />
                    </SelectTrigger>
                    <SelectContent>
                      {safes.map((s: any, idx: number) => (
                        <SelectItem key={`safe-${s.id || idx}-${idx}`} value={String(s.id)}>
                          {s.name} {s.balance != null ? `(الرصيد: ${fmt(s.balance)} ريال)` : ''}
                        </SelectItem>
                      ))}
                      {safes.length === 0 && <SelectItem value="1">الصندوق الرئيسي (الخزينة المركزية)</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  طريقة الدفع وعملة السند:
                </div>
                <div className="col-span-12 sm:col-span-4 flex items-center gap-1.5 flex-wrap">
                  <Select 
                    value={paymentForm.payment_method} 
                    onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="bank">بنكي</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={paymentForm.currency} 
                    onValueChange={(val) => {
                      const found = currenciesList.find(c => c.code === val);
                      const rate = found ? found.rate : "1";
                      const num = Number(paymentForm.amount) || 0;
                      setPaymentForm({
                        ...paymentForm,
                        currency: val,
                        exchange_rate: rate,
                        foreign_amount: String(Number(rate) !== 0 ? Math.round((num / Number(rate)) * 100) / 100 : num),
                        amount_text: tafqeet(num, val)
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs bg-purple-50 dark:bg-purple-950 font-bold border-purple-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currenciesList.map((c, idx) => (
                        <SelectItem key={`supp-cur-${c.code}-${idx}`} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cyclePaymentCurrency}
                    title="اضغط F9 لتبديل وتغيير العملة سريعاً"
                    className="h-8 px-2 text-[11px] font-black bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 gap-1 shrink-0"
                  >
                    <span>F9</span>
                  </Button>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-slate-400 text-[10px]">س.ص:</span>
                    <Input 
                      className="h-8 w-14 text-xs font-mono font-bold text-center" 
                      value={paymentForm.exchange_rate} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, exchange_rate: e.target.value })} 
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Second Party (Supplier Information & Current Debt Balance) */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  المورد / الوكيل (الطرف الثاني):
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{selectedSupplier?.name}</span>
                      <span className="text-slate-500 text-[11px] mr-2">كود: <strong className="font-mono text-slate-700">{selectedSupplier?.supplier_code || 'SUP-101'}</strong></span>
                      <span className="text-slate-400 text-[10px] mr-2 font-mono">[دليل: {selectedSupplier?.account_code || '21100'}]</span>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-[11px]">
                      مستحقات حالية: {fmt(selectedSupplier?.current_balance)} ريال
                    </Badge>
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  عملة المورد:
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <div className="h-8 flex items-center justify-center bg-purple-50 dark:bg-purple-950 border border-purple-200 rounded px-3 font-bold text-purple-900 dark:text-purple-200">
                    {selectedSupplier?.currency || paymentForm.currency}
                  </div>
                </div>
              </div>

              {/* Row 3: Amount & Tafqeet */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  المبلغ المصروف:
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <div className="relative">
                    <Input 
                      type="number"
                      className="h-8 text-sm font-extrabold text-rose-700 bg-white dark:bg-slate-800 pr-12 font-mono" 
                      value={paymentForm.amount} 
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = Number(val) || 0;
                        setPaymentForm({
                          ...paymentForm,
                          amount: val,
                          foreign_amount: String(Number(paymentForm.exchange_rate) !== 0 ? Math.round((num / Number(paymentForm.exchange_rate)) * 100) / 100 : num),
                          amount_text: tafqeet(num, paymentForm.currency)
                        });
                      }} 
                      placeholder="1000" 
                    />
                    <span className="absolute right-2 top-2 text-xs font-bold text-rose-600">
                      {currenciesList.find(c => c.code === paymentForm.currency)?.symbol || "ر.س"}
                    </span>
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  المبلغ كتابةً (تفقيط):
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Input 
                    className="h-8 text-xs bg-amber-50 dark:bg-amber-950 font-bold text-slate-800 dark:text-slate-200 border-amber-200" 
                    value={paymentForm.amount_text || (paymentForm.amount ? tafqeet(Number(paymentForm.amount), paymentForm.currency) : "صفر")} 
                    readOnly 
                  />
                </div>
              </div>

              {/* Row 4: Statement & Cost Center */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  البيان / مقابل سداد:
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <Input 
                    className="h-8 text-xs bg-white dark:bg-slate-800" 
                    value={paymentForm.notes} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} 
                    placeholder="سداد مستحقات حجز تذاكر طيران / خدمات سياحية..." 
                  />
                </div>

                <div className="col-span-12 sm:col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  مركز التكلفة:
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <Select value={paymentForm.cost_center} onValueChange={(v) => setPaymentForm({ ...paymentForm, cost_center: v })}>
                    <SelectTrigger className="h-8 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="الفرع الرئيسي">الفرع الرئيسي</SelectItem>
                      <SelectItem value="فرع الرياض">فرع الرياض</SelectItem>
                      <SelectItem value="فرع جدة">فرع جدة</SelectItem>
                      <SelectItem value="قسم السياحة والسفر">قسم السياحة والسفر</SelectItem>
                      <SelectItem value="قسم العمرة والزيارة">قسم العمرة والزيارة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Accounting Details Section */}
            <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm p-3">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-900 grid grid-cols-2 h-8 text-[11px] font-bold">
                  <TabsTrigger value="details">تفاصيل أطراف القيد المحاسبي المزدوج</TabsTrigger>
                  <TabsTrigger value="impact">أثر السداد على رصيد المورد والخزينة</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-2.5">
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 border-b">
                          <th className="p-2 border-l">رقم الحساب</th>
                          <th className="p-2 border-l">اسم الحساب (دليل الحسابات)</th>
                          <th className="p-2 border-l">العملة</th>
                          <th className="p-2 border-l">س.ص</th>
                          <th className="p-2 border-l">مدين</th>
                          <th className="p-2">دائن</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-rose-50/40 dark:bg-rose-950/20">
                          <td className="p-2 border-l font-mono text-slate-600 font-bold">{selectedSupplier?.account_code || '21100'}</td>
                          <td className="p-2 border-l font-bold text-slate-900 dark:text-slate-100">
                            حساب المورد: {selectedSupplier?.name} (سداد وتخفيض المستحق)
                          </td>
                          <td className="p-2 border-l text-center font-bold text-purple-700">{paymentForm.currency}</td>
                          <td className="p-2 border-l text-center font-mono">{paymentForm.exchange_rate}</td>
                          <td className="p-2 border-l font-bold text-rose-700 font-mono">{fmt(Number(paymentForm.amount))}</td>
                          <td className="p-2 font-mono text-slate-400">0.00</td>
                        </tr>
                        <tr className="border-b bg-blue-50/40 dark:bg-blue-950/20">
                          <td className="p-2 border-l font-mono text-slate-600 font-bold">{paymentForm.payment_method === 'bank' ? '11120' : '11100'}</td>
                          <td className="p-2 border-l font-bold text-slate-900 dark:text-slate-100">
                            {safes.find((s: any) => String(s.id) === String(paymentForm.safe_id))?.name || (paymentForm.payment_method === 'bank' ? 'الحساب البنكي' : 'الصندوق الرئيسي')} (صرف نقدي)
                          </td>
                          <td className="p-2 border-l text-center font-bold text-purple-700">{paymentForm.currency}</td>
                          <td className="p-2 border-l text-center font-mono">{paymentForm.exchange_rate}</td>
                          <td className="p-2 border-l font-mono text-slate-400">0.00</td>
                          <td className="p-2 font-bold text-blue-700 font-mono">{fmt(Number(paymentForm.amount))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="impact" className="mt-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border">
                      <div className="text-slate-500 text-[11px]">رصيد المورد قبل السند</div>
                      <div className="font-bold font-mono text-amber-700 text-sm mt-1">{fmt(selectedSupplier?.current_balance)} ريال</div>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded border border-rose-200">
                      <div className="text-rose-600 text-[11px] font-bold">مبلغ السداد المصروف</div>
                      <div className="font-bold font-mono text-rose-700 text-sm mt-1">-{fmt(Number(paymentForm.amount))} {paymentForm.currency}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-200">
                      <div className="text-emerald-700 text-[11px] font-bold">الرصيد المتبقي بعد السداد</div>
                      <div className="font-bold font-mono text-emerald-800 text-sm mt-1">
                        {fmt((selectedSupplier?.current_balance || 0) - (Number(paymentForm.amount) || 0))} ريال
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewPaymentVoucher}
                className="gap-1.5 font-bold border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
              >
                <Printer className="w-4 h-4" /> معاينة وطباعة السند (A4)
              </Button>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setOpenPaymentModal(false)}>إلغاء</Button>
                <Button
                  onClick={() => paySupplierMutation.mutate({ suppId: selectedSupplier.id, payload: paymentForm })}
                  disabled={paySupplierMutation.isPending || Number(paymentForm.amount) <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-6"
                >
                  <Check className="w-4 h-4" />
                  {paySupplierMutation.isPending ? "جاري الترحيل..." : "تأكيد الصرف وترحيل القيد المحاسبي"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Statement of Account Sheet */}
        <Sheet open={openStatementSheet} onOpenChange={setOpenStatementSheet}>
          <SheetContent side="left" className="w-full sm:max-w-xl font-sans overflow-y-auto" dir="rtl">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> كشف حساب المورد: {selectedSupplier?.name}
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                ملخص كامل للخدمات المشتراة وسندات الدفع مع رصيد الحساب الجاري
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6 text-sm">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center text-xs">
                <div>
                  <div className="text-slate-500">إجمالي المشتريات</div>
                  <div className="font-bold text-slate-800">{fmt(statementData?.summary?.totalPurchases)} ريال</div>
                </div>
                <div>
                  <div className="text-slate-500">إجمالي المدفوعات</div>
                  <div className="font-bold text-emerald-700">{fmt(statementData?.summary?.totalPayments)} ريال</div>
                </div>
                <div>
                  <div className="text-slate-500">الرصيد المتبقي</div>
                  <div className="font-bold text-amber-800">{fmt(statementData?.summary?.balance)} ريال</div>
                </div>
              </div>

              <Button
                onClick={() => handlePreviewStatement(selectedSupplier)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
              >
                <Eye className="w-4 h-4" /> استعراض كشف الحساب قبل الطباعة (شاشة كاملة)
              </Button>

              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-700">سجل الدفعات وسندات الصرف:</h4>
                {statementData?.payments?.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">لا توجد سندات دفع سابقة.</div>
                ) : (
                  statementData?.payments?.map((p: any, idx: number) => (
                    <div key={`supp-stmt-p-${p.id || idx}-${idx}`} className="p-3 bg-white border rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{p.voucher_number}</div>
                        <div className="text-slate-500">{p.voucher_date} - {p.notes || "دفعة نقدية"}</div>
                      </div>
                      <div className="font-bold text-amber-800 font-mono">-{fmt(p.amount)} ريال</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Full-Screen Report Viewer Modal */}
        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={reportTitle}
        />

      </div>
    </AdminLayout>
  );
}
