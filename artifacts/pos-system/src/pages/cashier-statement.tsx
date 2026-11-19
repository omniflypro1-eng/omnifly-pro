import React, { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { 
  Printer, 
  Download, 
  RefreshCw, 
  Search, 
  FileText, 
  Filter, 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Plane, 
  Hotel, 
  Globe, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Eye, 
  ShieldCheck, 
  Wallet, 
  Building2, 
  User,
  CreditCard,
  FileSpreadsheet,
  X,
  ExternalLink,
  ChevronDown,
  Clock,
  Maximize2,
  FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAgencyConfig } from "@/hooks/use-agency-config";
import { saveA4PdfToFile } from "@/lib/printUtils";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useToast } from "@/hooks/use-toast";

function getAuthToken(): string {
  return localStorage.getItem("pos_token") || sessionStorage.getItem("pos_token") || "";
}

async function fetchWithAuth(url: string) {
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const SERVICE_ICONS: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  flight: { icon: Plane, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", label: "تذكرة طيران" },
  hotel: { icon: Hotel, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "حجز فندق" },
  visa: { icon: Globe, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "تأشيرة سفر" },
  transport: { icon: Truck, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", label: "نقل بري وباصات" },
  invoice: { icon: Receipt, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", label: "فاتورة مبيعات سياحية" },
  voucher: { icon: Wallet, color: "text-teal-600", bg: "bg-teal-50 border-teal-200", label: "سند مالي ومقبوضات" },
  package: { icon: ShieldCheck, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200", label: "برنامج سياحي" }
};

export default function CashierStatement() {
  const agency = useAgencyConfig();
  const { toast } = useToast();

  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("تقرير كشف حساب المبيعات والعملاء");

  const generateStatementHtml = () => {
    const custTitle = selectedCustomer ? `كشف حساب العميل - ${selectedCustomer.name}` : "تقرير كشف حساب المبيعات والعملاء الشامل";
    return `
      <div style="font-family: 'Tajawal', 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; color: #0f172a; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; color: #1e293b; margin: 0 0 5px 0;">${agency.agencyName}</h1>
            <p style="font-size: 12px; color: #64748b; margin: 0;">${agency.agencyNameEn} | نظام المبيعات والفواتير السياحية ✈️</p>
            <p style="font-size: 11px; color: #475569; margin: 4px 0 0 0;">الرقم الضريبي: ${agency.taxNumber || "300000000000003"} | الترخيص: ${agency.licenseNumber || "1010000000"}</p>
          </div>
          <div style="text-align: left; font-size: 12px; color: #334155;">
            <p style="font-weight: bold; color: #2563eb; font-size: 14px; margin: 0 0 4px 0;">${custTitle}</p>
            <p style="margin: 0;">تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA")}</p>
            <p style="margin: 2px 0 0 0;">الفترة: من ${startDate} إلى ${endDate}</p>
          </div>
        </div>

        ${selectedCustomer ? `
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div><strong>اسم العميل:</strong> ${selectedCustomer.name}</div>
            <div><strong>كود الحساب:</strong> ${selectedCustomer.account_code || "11210"}</div>
            <div><strong>رقم الجوال:</strong> ${selectedCustomer.phone || "—"}</div>
            <div><strong>الرصيد السابق:</strong> ${Number(previousBalance || 0).toLocaleString()} ${agency.currency}</div>
            <div><strong>الرصيد الصافي:</strong> ${Number(currentBalance || 0).toLocaleString()} ${agency.currency}</div>
            <div><strong>نوع الحساب:</strong> ${selectedCustomer.customer_type === "company" ? "شركة / وكيل" : "فردي"}</div>
          </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9; color: #1e293b;">
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center; width: 30px;">م</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; width: 80px;">التاريخ</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; width: 90px;">المرجع</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; width: 90px;">الخدمة</th>
              ${!selectedCustomer ? '<th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">العميل</th>' : ''}
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">البيان والتفاصيل</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center; width: 50px;">العملة</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center; width: 80px; background: #eff6ff; color: #1d4ed8;">مدين (+)</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center; width: 80px; background: #ecfdf5; color: #047857;">دائن (-)</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center; width: 90px; background: #f8fafc;">الرصيد التراكمي</th>
            </tr>
          </thead>
          <tbody>
            ${selectedCustomer && Number(previousBalance || 0) !== 0 ? `
              <tr style="background: #f8fafc; font-weight: bold;">
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">-</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px;">${startDate}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px;">رصيد سابق</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px;">افتتاحي</td>
                ${!selectedCustomer ? '<td style="border: 1px solid #cbd5e1; padding: 5px;">-</td>' : ''}
                <td style="border: 1px solid #cbd5e1; padding: 5px;">رصيد الحساب المالي المدور قبل بداية الفترة</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${agency.currency}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; color: #1d4ed8;">${previousBalance > 0 ? Number(previousBalance).toLocaleString() : ""}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; color: #047857;">${previousBalance < 0 ? Number(Math.abs(previousBalance)).toLocaleString() : ""}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold;">${Number(previousBalance).toLocaleString()} ${agency.currency}</td>
              </tr>
            ` : ''}
            ${transactions.map((tx: any, idx: number) => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px;">${tx.date}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; font-family: monospace;">${tx.ref_number || "—"}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px;">${tx.service_label || tx.service_type}</td>
                ${!selectedCustomer ? `<td style="border: 1px solid #cbd5e1; padding: 5px;">${tx.customer_name || "—"}</td>` : ''}
                <td style="border: 1px solid #cbd5e1; padding: 5px;">${tx.description || ""}${tx.passenger_name ? ` (المسافر: ${tx.passenger_name})` : ""}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${tx.currency || "SAR"}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; color: #1d4ed8; font-weight: bold;">${Number(tx.debit || 0) > 0 ? Number(tx.debit).toLocaleString() : "—"}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; color: #047857; font-weight: bold;">${Number(tx.credit || 0) > 0 ? Number(tx.credit).toLocaleString() : "—"}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold;">${Number(tx.running_balance || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: bold; font-size: 12px;">
              <td colspan="${selectedCustomer ? 6 : 7}" style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">المجموع الكلي للفترة:</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; color: #1d4ed8;">${transactions.reduce((acc: number, t: any) => acc + Number(t.debit || 0), 0).toLocaleString()}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; color: #047857;">${transactions.reduce((acc: number, t: any) => acc + Number(t.credit || 0), 0).toLocaleString()}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">${Number(currentBalance || 0).toLocaleString()} ${agency.currency}</td>
            </tr>
          </tfoot>
        </table>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 30px; text-align: center; font-size: 11px;">
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">إعداد المحاسب</div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">المدير المالي</div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">ختم الوكالة المعتمد</div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px;">توثيق وتوقيع العميل</div>
        </div>
      </div>
    `;
  };

  const handleFullScreenPreview = () => {
    const html = generateStatementHtml();
    setReportHtml(html);
    setReportTitle(selectedCustomer ? `كشف حساب العميل - ${selectedCustomer.name}` : "تقرير كشف حساب المبيعات والعملاء الشامل");
    setReportViewerOpen(true);
  };

  const handleExportPdf = async () => {
    const html = generateStatementHtml();
    const cleanTitle = (selectedCustomer ? `كشف_حساب_${selectedCustomer.name}` : "تقرير_كشف_حساب_المبيعات_والعملاء").replace(/[\\/:*?"<>|]/g, "_").trim();
    try {
      const res = await saveA4PdfToFile(html, cleanTitle, cleanTitle);
      if (res.canceled) return;
      if (res.success) {
        toast({
          title: "تم حفظ ملف PDF بنجاح",
          description: res.filePath ? `المسار: ${res.filePath}` : "تم تحميل المستند بنجاح"
        });
      } else if (res.error) {
        toast({
          title: "فشل حفظ الملف",
          description: res.error,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "خطأ غير متوقع",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Active view tab: "customer_statement" | "all_customers_summary" | "sales_log"
  const [activeTab, setActiveTab] = useState<"customer_statement" | "all_customers_summary" | "sales_log">("customer_statement");

  // Filter state
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "debt" | "settled" | "credit">("all");

  // Details Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Fetch report data
  const { data: reportData, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "/api/travel/reports/sales-customer-statement",
      startDate,
      endDate,
      selectedCustomerId,
      serviceTypeFilter,
      currencyFilter,
      paymentMethodFilter
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedCustomerId) params.append("customerId", selectedCustomerId);
      if (serviceTypeFilter && serviceTypeFilter !== "all") params.append("serviceType", serviceTypeFilter);
      if (currencyFilter && currencyFilter !== "all") params.append("currency", currencyFilter);
      if (paymentMethodFilter && paymentMethodFilter !== "all") params.append("paymentMethod", paymentMethodFilter);

      return fetchWithAuth(`/api/travel/reports/sales-customer-statement?${params.toString()}`);
    }
  });

  const customersList = reportData?.customers || [];
  const customersSummary = reportData?.customers_summary || [];
  const selectedCustomer = reportData?.selected_customer || null;
  const transactions = reportData?.transactions || [];
  const summary = reportData?.summary || {
    total_sales: 0,
    total_paid: 0,
    total_outstanding: 0,
    total_profit: 0,
    total_transactions: 0,
    customers_count: 0,
    active_customers_count: 0
  };
  const currencySummaries = reportData?.currency_summaries || {};
  const previousBalance = reportData?.previous_balance || 0;
  const currentBalance = reportData?.current_balance || 0;

  // Filtered customers summary for Tab 2
  const filteredCustomersSummary = useMemo(() => {
    return customersSummary.filter((c: any) => {
      const matchesSearch =
        !customerSearchQuery ||
        String(c.customer_name || "").toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        String(c.phone || "").includes(customerSearchQuery) ||
        String(c.account_code || "").includes(customerSearchQuery);

      if (!matchesSearch) return false;

      if (balanceFilter === "debt") return (c.balance || 0) > 0;
      if (balanceFilter === "settled") return (c.balance || 0) === 0;
      if (balanceFilter === "credit") return (c.balance || 0) < 0;

      return true;
    });
  }, [customersSummary, customerSearchQuery, balanceFilter]);

  // Set date presets
  const handleDatePreset = (preset: "today" | "this_month" | "this_quarter" | "this_year" | "all_time") => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "this_month") {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      setStartDate(new Date(now.getFullYear(), qMonth, 1).toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "this_year") {
      setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "all_time") {
      setStartDate("2020-01-01");
      setEndDate(todayStr);
    }
  };

  // Switch to single customer statement
  const viewSingleCustomer = (custId: number) => {
    setSelectedCustomerId(String(custId));
    setActiveTab("customer_statement");
  };

  const handlePrint = () => {
    window.print();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) return;

    let headers = ["م", "التاريخ", "المرجع", "نوع الخدمة", "البيان", "العملة", "مدين (+)", "دائن (-)", "الرصيد التراكمي", "طريقة الدفع"];
    let rows = transactions.map((t: any, idx: number) => [
      idx + 1,
      t.date,
      t.ref_number,
      t.service_label,
      `"${String(t.description || '').replace(/"/g, '""')}"`,
      t.currency,
      t.debit,
      t.credit,
      t.running_balance,
      t.payment_method
    ]);

    let csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `كشف_حساب_مبيعات_عملاء_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 print:space-y-4" dir="rtl">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 bg-white p-5 rounded-2xl shadow-sm print:shadow-none print:border-b-2 print:p-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 print:hidden">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  تقرير كشف حساب المبيعات والعملاء
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                  نظام المبيعات والفواتير السياحية ✈️
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                كشف حساب تفصيلي للعملاء، متابعة المبيعات السياحية المركزية، سندات المقبوضات، والأرصدة المستحقة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 text-xs gap-1.5 border-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              تحديث
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleFullScreenPreview}
              className="h-9 text-xs gap-1.5 border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
              استعراض بشاشة كاملة
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={transactions.length === 0}
              className="h-9 text-xs gap-1.5 border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100 font-bold"
            >
              <FileDown className="w-3.5 h-3.5" />
              تصدير ملف PDF
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/95 text-white shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة كشف الحساب (A4)
            </Button>
          </div>
        </div>

        {/* Global KPI Cards Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              إجمالي مبيعات الفترة
            </p>
            <p className="text-xl font-black text-blue-600 mt-1.5">
              {Number(summary.total_sales || 0).toLocaleString()}
              <span className="text-xs font-normal text-slate-500 mr-1">{agency.currency}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">حجم المبيعات والخدمات المصدرة</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              إجمالي المحصل والمقبوض
            </p>
            <p className="text-xl font-black text-emerald-600 mt-1.5">
              {Number(summary.total_paid || 0).toLocaleString()}
              <span className="text-xs font-normal text-slate-500 mr-1">{agency.currency}</span>
            </p>
            <p className="text-[10px] text-emerald-700 mt-1 font-medium">سندات قبض ودفعات مسددة</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              {selectedCustomer ? "الرصيد الصافي للعميل" : "إجمالي الذمم والديون"}
            </p>
            <p className={`text-xl font-black mt-1.5 ${Number(summary.total_outstanding || 0) > 0 ? "text-amber-600" : "text-slate-800"}`}>
              {Number(summary.total_outstanding || 0).toLocaleString()}
              <span className="text-xs font-normal text-slate-500 mr-1">{agency.currency}</span>
            </p>
            <p className="text-[10px] text-amber-700 mt-1">
              {Number(summary.total_outstanding || 0) > 0 ? "مبالغ مستحقة قيد التحصيل" : "الحساب مسدد بالكامل"}
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-teal-600" />
              صافي أرباح الوكالة
            </p>
            <p className="text-xl font-black text-teal-600 mt-1.5">
              {Number(summary.total_profit || 0).toLocaleString()}
              <span className="text-xs font-normal text-slate-500 mr-1">{agency.currency}</span>
            </p>
            <p className="text-[10px] text-teal-700 mt-1 font-medium">العمولات وفارق أسعار الموردين</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm col-span-2 lg:col-span-1">
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              عدد الحركات والعمليات
            </p>
            <p className="text-xl font-black text-indigo-600 mt-1.5">
              {summary.total_transactions || 0}
              <span className="text-xs font-normal text-slate-500 mr-1">حركة</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {summary.active_customers_count || 0} عميل نشط مسجل
            </p>
          </div>
        </div>

        {/* Filter Center Box */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Customer Picker */}
            <div className="flex-1 min-w-[240px]">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                اختر العميل (أو استعرض كافة العملاء)
              </label>
              <div className="relative">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-9 text-xs border rounded-xl px-3 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-primary focus:bg-white"
                >
                  <option value="all">🏢 كافة العملاء والشركات (عرض شامل)</option>
                  {customersList.map((c: any) => (
                    <option key={`c-opt-${c.id}`} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""} - كود: {c.account_code || "11210"} {Number(c.balance || 0) > 0 ? `[مدين: ${Number(c.balance).toLocaleString()}]` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-1 bg-slate-50 border rounded-xl p-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">من:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-7 text-xs border-0 bg-transparent w-28 px-1 shadow-none"
                />
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">إلى:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-7 text-xs border-0 bg-transparent w-28 px-1 shadow-none"
                />
              </div>
            </div>

            {/* Service Type */}
            <div className="w-36">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">نوع الخدمة</label>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="w-full h-9 text-xs border rounded-xl px-2.5 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-primary"
              >
                <option value="all">كافة الخدمات</option>
                <option value="flight">✈️ تذاكر طيران</option>
                <option value="hotel">🏨 فنادق</option>
                <option value="visa">🛂 تأشيرات سفر</option>
                <option value="transport">🚌 نقل بري وباصات</option>
                <option value="invoice">🧾 فواتير شاملة</option>
                <option value="voucher">💰 سندات ومقبوضات</option>
              </select>
            </div>

            {/* Currency */}
            <div className="w-32">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">العملة</label>
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                className="w-full h-9 text-xs border rounded-xl px-2.5 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-primary"
              >
                <option value="all">كافة العملات</option>
                <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                <option value="EUR">🇪🇺 يورو (EUR)</option>
                <option value="YER">🇾🇪 ريال يمني (YER)</option>
              </select>
            </div>

            {/* Payment Method */}
            <div className="w-32">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">طريقة السداد</label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full h-9 text-xs border rounded-xl px-2.5 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-primary"
              >
                <option value="all">كافة الطرق</option>
                <option value="cash">نقداً (Cash)</option>
                <option value="credit">آجل / ذمة (Credit)</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="credit_card">بطاقة / شبكة</option>
              </select>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 ml-1">فترات سريعة:</span>
            {[
              { id: "today", label: "اليوم" },
              { id: "this_month", label: "هذا الشهر" },
              { id: "this_quarter", label: "الربع الحالي" },
              { id: "this_year", label: "هذا العام" },
              { id: "all_time", label: "كافة الفترات" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePreset(p.id as any)}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto print:hidden">
          {[
            { id: "customer_statement", label: "📄 كشف حساب العميل التفصيلي (Customer Statement)", icon: FileText },
            { id: "all_customers_summary", label: "📊 كشف أرصدة ومبيعات كافة العملاء (Receivables)", icon: Users },
            { id: "sales_log", label: "🧾 سجل فواتير وحركات المبيعات (Sales Log)", icon: Receipt }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DETAILED CUSTOMER STATEMENT (كشف حساب العميل التفصيلي) */}
        {/* ========================================================================= */}
        {activeTab === "customer_statement" && (
          <div className="space-y-4">
            {/* If a customer is selected, show profile card */}
            {selectedCustomer ? (
              <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white border border-blue-200 rounded-2xl shadow-sm print:border print:p-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow">
                      {selectedCustomer.name?.[0] || "ع"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h2>
                        <Badge variant="outline" className="text-[10px] bg-white border-blue-300 text-blue-700">
                          كود الحساب: {selectedCustomer.account_code || "11210"}
                        </Badge>
                        {selectedCustomer.customer_type && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {selectedCustomer.customer_type === "company" ? "شركة / وكيل" : "فرد"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>📱 {selectedCustomer.phone || "بدون هاتف"}</span>
                        {selectedCustomer.national_id && <span>🪪 الهوية: {selectedCustomer.national_id}</span>}
                        {selectedCustomer.office_name && <span>🏢 مكتب وسيط: {selectedCustomer.office_name}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Customer Financial Quick Balances */}
                  <div className="flex items-center gap-4 border-t md:border-t-0 md:border-r border-blue-200 pt-3 md:pt-0 pr-0 md:pr-4">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 font-semibold block">الرصيد السابق للفترة</span>
                      <span className="text-sm font-bold text-slate-700">
                        {Number(previousBalance || 0).toLocaleString()} {agency.currency}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 font-semibold block">الرصيد الصافي المستحق</span>
                      <span className={`text-base font-black ${Number(currentBalance || 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {Number(currentBalance || 0).toLocaleString()} {agency.currency}
                        <span className="text-[10px] font-bold mr-1">
                          {Number(currentBalance || 0) > 0 ? "(مدين)" : Number(currentBalance || 0) < 0 ? "(دائن)" : "(مسدد)"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2 text-amber-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    يتم حالياً استعراض كشف الحساب الموحد لكافة العملاء. يمكنك تحديد عميل محدد من القائمة أعلاه أو الانتقال لتبويب <strong>"كشف أرصدة ومبيعات كافة العملاء"</strong> لاختيار عميل معين.
                  </span>
                </div>
              </div>
            )}

            {/* Official Print Header (Visible only when printing) */}
            <div className="hidden print:block border-b-2 pb-4 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{agency.agencyName}</h1>
                  <p className="text-xs text-slate-600">{agency.agencyNameEn} | خدمات السفر والسياحة والرحلات</p>
                  <p className="text-xs text-slate-500 mt-1">الرقم الضريبي: {agency.taxNumber || "300000000000003"} | السجل/الترخيص: {agency.licenseNumber || "1010000000"}</p>
                </div>
                <div className="text-left text-xs text-slate-600">
                  <p className="font-bold text-sm text-primary">كشف حساب معتمد</p>
                  <p>تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</p>
                  <p>الفترة من: {startDate} إلى: {endDate}</p>
                </div>
              </div>

              {selectedCustomer && (
                <div className="mt-3 p-2 bg-slate-50 border rounded-lg text-xs grid grid-cols-3 gap-2">
                  <div><strong>العميل:</strong> {selectedCustomer.name}</div>
                  <div><strong>كود الحساب:</strong> {selectedCustomer.account_code || "11210"}</div>
                  <div><strong>الجوال:</strong> {selectedCustomer.phone || "—"}</div>
                </div>
              )}
            </div>

            {/* Detailed Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-50 text-slate-700 border-b print:bg-slate-100">
                    <tr>
                      <th className="p-3 font-bold w-10 text-center">م</th>
                      <th className="p-3 font-bold w-24">التاريخ</th>
                      <th className="p-3 font-bold w-28">المرجع / السند</th>
                      <th className="p-3 font-bold w-32">نوع الخدمة</th>
                      {!selectedCustomer && <th className="p-3 font-bold w-36">العميل</th>}
                      <th className="p-3 font-bold">البيان والشرح التفصيلي</th>
                      <th className="p-3 font-bold w-16 text-center">العملة</th>
                      <th className="p-3 font-bold w-28 text-center text-blue-700 bg-blue-50/50">مدين (+)</th>
                      <th className="p-3 font-bold w-28 text-center text-emerald-700 bg-emerald-50/50">دائن (-)</th>
                      <th className="p-3 font-bold w-32 text-center text-slate-900 bg-slate-100">الرصيد التراكمي</th>
                      <th className="p-3 font-bold w-24 text-center print:hidden">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Previous Balance Row */}
                    {selectedCustomer && Number(previousBalance || 0) !== 0 && (
                      <tr className="bg-slate-50/60 font-semibold text-slate-600">
                        <td className="p-2.5 text-center">—</td>
                        <td className="p-2.5">{startDate}</td>
                        <td className="p-2.5 text-slate-400">رصيد سابق</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-[10px] text-slate-700">رصيد افتتاحي</span>
                        </td>
                        <td className="p-2.5 text-slate-500 font-medium">رصيد الحساب المالي المدور قبل بداية الفترة المحددة</td>
                        <td className="p-2.5 text-center text-slate-400">{agency.currency}</td>
                        <td className="p-2.5 text-center text-blue-700 font-bold">
                          {previousBalance > 0 ? Number(previousBalance).toLocaleString() : ""}
                        </td>
                        <td className="p-2.5 text-center text-emerald-700 font-bold">
                          {previousBalance < 0 ? Number(Math.abs(previousBalance)).toLocaleString() : ""}
                        </td>
                        <td className="p-2.5 text-center font-bold bg-slate-100/60">
                          {Number(previousBalance).toLocaleString()} {agency.currency}
                        </td>
                        <td className="p-2.5 print:hidden"></td>
                      </tr>
                    )}

                    {isLoading && (
                      <tr>
                        <td colSpan={selectedCustomer ? 10 : 11} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                          جاري استرجاع كشف الحساب والبيانات الحقيقية...
                        </td>
                      </tr>
                    )}

                    {!isLoading && transactions.length === 0 && (
                      <tr>
                        <td colSpan={selectedCustomer ? 10 : 11} className="py-12 text-center text-slate-400">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          لا توجد حركات مبيعات أو سندات مسجلة للعميل في الفترة المحددة
                        </td>
                      </tr>
                    )}

                    {transactions.map((tx: any, idx: number) => {
                      const serviceCfg = SERVICE_ICONS[tx.service_type] || {
                        icon: FileText,
                        color: "text-slate-600",
                        bg: "bg-slate-50 border-slate-200",
                        label: tx.service_label || "خدمة"
                      };
                      const Icon = serviceCfg.icon;

                      return (
                        <tr key={`tx-${tx.id || idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{tx.date}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 text-[11px]">
                            {tx.ref_number || "—"}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${serviceCfg.bg} ${serviceCfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {tx.service_label || serviceCfg.label}
                            </span>
                          </td>
                          {!selectedCustomer && (
                            <td className="p-3 font-bold text-slate-800 truncate max-w-[140px]">
                              {tx.customer_name || `عميل #${tx.customer_id}`}
                            </td>
                          )}
                          <td className="p-3 text-slate-700">
                            <p className="font-semibold text-slate-900 leading-tight">{tx.description}</p>
                            {tx.passenger_name && (
                              <p className="text-[10px] text-slate-400 mt-0.5">👤 المسافر: {tx.passenger_name}</p>
                            )}
                            {tx.notes && (
                              <p className="text-[10px] text-slate-500 italic mt-0.5 font-sans">📝 {tx.notes}</p>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-600 text-[10px]">
                            {tx.currency || "SAR"}
                          </td>
                          <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/30">
                            {Number(tx.debit || 0) > 0 ? Number(tx.debit).toLocaleString() : "—"}
                          </td>
                          <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/30">
                            {Number(tx.credit || 0) > 0 ? Number(tx.credit).toLocaleString() : "—"}
                          </td>
                          <td className={`p-3 text-center font-black bg-slate-50/80 ${Number(tx.running_balance || 0) > 0 ? "text-amber-700" : Number(tx.running_balance || 0) < 0 ? "text-emerald-700" : "text-slate-600"}`}>
                            {Number(tx.running_balance || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center print:hidden">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedTx(tx)}
                              className="h-7 text-[11px] px-2 text-slate-600 hover:text-primary gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              معاينة
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Totals Footer */}
                  <tfoot className="bg-slate-100/90 text-slate-900 border-t-2 border-slate-300 font-bold print:bg-slate-200">
                    <tr>
                      <td colSpan={selectedCustomer ? 5 : 6} className="p-3 text-left font-black">
                        المجموع الإجمالي للحركات (الفترة: {startDate} إلى {endDate}):
                      </td>
                      <td className="p-3 text-center text-[10px] text-slate-500">{agency.currency}</td>
                      <td className="p-3 text-center text-blue-700 font-black text-sm bg-blue-100/40">
                        {transactions.reduce((acc: number, t: any) => acc + Number(t.debit || 0), 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center text-emerald-700 font-black text-sm bg-emerald-100/40">
                        {transactions.reduce((acc: number, t: any) => acc + Number(t.credit || 0), 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-black text-sm bg-slate-200/60 text-slate-900">
                        {Number(currentBalance || 0).toLocaleString()} {agency.currency}
                      </td>
                      <td className="p-3 print:hidden"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Official Certification & Signature Block (Visible on Print) */}
            <div className="hidden print:grid grid-cols-4 gap-4 mt-8 pt-6 border-t-2 text-center text-xs">
              <div className="space-y-10">
                <p className="font-bold text-slate-800">إعداد المحاسب:</p>
                <p className="text-slate-400">..............................</p>
              </div>
              <div className="space-y-10">
                <p className="font-bold text-slate-800">المدير المالي:</p>
                <p className="text-slate-400">..............................</p>
              </div>
              <div className="space-y-10">
                <p className="font-bold text-slate-800">ختم الوكالة المعتمد:</p>
                <p className="text-slate-400">..............................</p>
              </div>
              <div className="space-y-10">
                <p className="font-bold text-slate-800">مصادقة وتوقيع العميل:</p>
                <p className="text-slate-400">..............................</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ALL CUSTOMERS RECEIVABLES & SALES SUMMARY (كشف أرصدة العملاء) */}
        {/* ========================================================================= */}
        {activeTab === "all_customers_summary" && (
          <div className="space-y-4">
            {/* Filter Sub-bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="ابحث بالاسم، الجوال، أو كود الحساب..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="pr-8 h-8 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-slate-500 ml-1">حالة الرصيد:</span>
                {[
                  { id: "all", label: "الجميع" },
                  { id: "debt", label: "عليهم ذمم (مدينون)" },
                  { id: "settled", label: "مسددون بالكامل" },
                  { id: "credit", label: "أرصدة دائنة" }
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBalanceFilter(b.id as any)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      balanceFilter === b.id
                        ? "bg-primary text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customers Master Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-50 text-slate-700 border-b">
                    <tr>
                      <th className="p-3 font-bold w-12 text-center">م</th>
                      <th className="p-3 font-bold w-28">كود الحساب</th>
                      <th className="p-3 font-bold">اسم العميل</th>
                      <th className="p-3 font-bold w-32">الجوال</th>
                      <th className="p-3 font-bold w-28 text-center">النوع والتصنيف</th>
                      <th className="p-3 font-bold w-24 text-center">العمليات</th>
                      <th className="p-3 font-bold w-32 text-center text-blue-700 bg-blue-50/50">إجمالي المبيعات</th>
                      <th className="p-3 font-bold w-32 text-center text-emerald-700 bg-emerald-50/50">المسدد والمقبوض</th>
                      <th className="p-3 font-bold w-36 text-center text-slate-900 bg-slate-100">الرصيد المتبقي (الذمة)</th>
                      <th className="p-3 font-bold w-28 text-center">آخر حركة</th>
                      <th className="p-3 font-bold w-32 text-center print:hidden">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomersSummary.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          لا يوجد عملاء مطابقين لمعايير البحث
                        </td>
                      </tr>
                    )}

                    {filteredCustomersSummary.map((c: any, idx: number) => {
                      const netBalance = Number(c.balance || (c.total_sales - c.total_paid) || 0);

                      return (
                        <tr key={`cust-row-${c.customer_id}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {c.account_code || "11210"}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                                {c.customer_name?.[0] || "ع"}
                              </div>
                              <span>{c.customer_name}</span>
                            </div>
                            {c.office_name && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">مكتب: {c.office_name}</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 font-mono text-[11px]">{c.phone || "—"}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-600">
                              {c.customer_type === "company" ? "شركة" : "فردي"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-bold text-slate-700">
                            {c.transactions_count || 0}
                          </td>
                          <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/20">
                            {Number(c.total_sales || 0).toLocaleString()} {agency.currency}
                          </td>
                          <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/20">
                            {Number(c.total_paid || 0).toLocaleString()} {agency.currency}
                          </td>
                          <td className="p-3 text-center font-black bg-slate-50">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black inline-block ${
                              netBalance > 0
                                ? "bg-amber-100 text-amber-800"
                                : netBalance < 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {netBalance.toLocaleString()} {agency.currency}
                            </span>
                          </td>
                          <td className="p-3 text-center text-slate-500 whitespace-nowrap text-[11px]">
                            {c.last_transaction_date || "—"}
                          </td>
                          <td className="p-3 text-center print:hidden">
                            <Button
                              size="sm"
                              onClick={() => viewSingleCustomer(c.customer_id)}
                              className="h-7 text-xs px-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold gap-1 shadow-none"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              كشف الحساب
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TRAVEL SALES LOG (سجل فواتير وحركات المبيعات) */}
        {/* ========================================================================= */}
        {activeTab === "sales_log" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b">
                  <tr>
                    <th className="p-3 font-bold w-12 text-center">م</th>
                    <th className="p-3 font-bold w-24">التاريخ</th>
                    <th className="p-3 font-bold w-32">رقم المعاملة</th>
                    <th className="p-3 font-bold w-28">نوع الخدمة</th>
                    <th className="p-3 font-bold">اسم العميل</th>
                    <th className="p-3 font-bold">البيان والمسافر</th>
                    <th className="p-3 font-bold w-28 text-center text-blue-700 bg-blue-50/50">سعر البيع</th>
                    <th className="p-3 font-bold w-24 text-center text-slate-600">التكلفة</th>
                    <th className="p-3 font-bold w-24 text-center text-emerald-700 bg-emerald-50/50">الربح</th>
                    <th className="p-3 font-bold w-24 text-center">طريقة الدفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions
                    .filter((t: any) => t.selling_price > 0 || t.debit > 0)
                    .map((tx: any, idx: number) => {
                      const serviceCfg = SERVICE_ICONS[tx.service_type] || {
                        icon: FileText,
                        color: "text-slate-600",
                        bg: "bg-slate-50 border-slate-200",
                        label: tx.service_label || "خدمة"
                      };
                      const Icon = serviceCfg.icon;

                      return (
                        <tr key={`log-${tx.id || idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 whitespace-nowrap font-medium text-slate-700">{tx.date}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{tx.ref_number}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${serviceCfg.bg} ${serviceCfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {tx.service_label}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{tx.customer_name}</td>
                          <td className="p-3 text-slate-700">
                            <p className="font-medium text-slate-800">{tx.description}</p>
                            {tx.passenger_name && (
                              <span className="text-[10px] text-slate-400">👤 المسافر: {tx.passenger_name}</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/20">
                            {Number(tx.selling_price || tx.debit || 0).toLocaleString()} {tx.currency || agency.currency}
                          </td>
                          <td className="p-3 text-center text-slate-600">
                            {Number(tx.cost_price || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/20">
                            {Number(tx.profit || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-600">
                            {tx.payment_method === "cash" ? "نقداً" : tx.payment_method === "credit" ? "آجل" : tx.payment_method === "bank_transfer" ? "تحويل" : tx.payment_method}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TRANSACTION DETAILS MODAL */}
        {/* ========================================================================= */}
        {selectedTx && (
          <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <FileText className="w-5 h-5 text-primary" />
                  تفاصيل الحركة المالية: {selectedTx.ref_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">التاريخ والوقت</span>
                    <span className="font-bold text-slate-800">{selectedTx.datetime || selectedTx.date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">نوع العملية</span>
                    <span className="font-bold text-primary">{selectedTx.service_label}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">العميل</span>
                    <span className="font-bold text-slate-800">{selectedTx.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">طريقة السداد</span>
                    <span className="font-bold text-slate-800">{selectedTx.payment_method}</span>
                  </div>
                </div>

                <div className="p-3 bg-white border rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 block">الشرح والبيان:</span>
                  <p className="font-medium text-slate-900 leading-relaxed">{selectedTx.description}</p>
                  {selectedTx.passenger_name && (
                    <p className="text-[11px] text-slate-600 mt-1">👤 اسم المسافر: <strong>{selectedTx.passenger_name}</strong></p>
                  )}
                  {selectedTx.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-1">📝 ملاحظات: {selectedTx.notes}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border rounded-xl text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">المبلغ المستحق (مدين)</span>
                    <span className="text-sm font-bold text-blue-700">{Number(selectedTx.debit || 0).toLocaleString()} {selectedTx.currency}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">المسدد (دائن)</span>
                    <span className="text-sm font-bold text-emerald-700">{Number(selectedTx.credit || 0).toLocaleString()} {selectedTx.currency}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">الرصيد بعد الحركة</span>
                    <span className="text-sm font-black text-slate-900">{Number(selectedTx.running_balance || 0).toLocaleString()} {selectedTx.currency}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button size="sm" variant="outline" onClick={() => setSelectedTx(null)}>
                  إغلاق
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

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
