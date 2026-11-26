import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDashboardSummary, useGetTopProducts, useGetSalesByHour, useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, DollarSign, Receipt, TrendingUp, Package, Users, ShoppingCart, Percent, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : null) ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const now = new Date();
const today = now.toISOString().slice(0, 10);
const monthStart = today.slice(0, 7) + "-01";
const dateParams = `?startDate=${monthStart}&endDate=${today}`;

const PAYMENT_COLORS: Record<string, string> = { cash: "#1e3a5f", card: "#3b82f6", mixed: "#f59e0b" };
const PAYMENT_LABELS: Record<string, string> = { cash: "نقداً", card: "شبكة", mixed: "مختلط" };

export default function Dashboard() {
  const qc = useQueryClient();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: topProducts, isLoading: isLoadingTopProducts } = useGetTopProducts();
  const { data: salesByHour, isLoading: isLoadingSalesByHour } = useGetSalesByHour();
  const { data: settings } = useGetSettings();
  const updateSettingsMutation = useUpdateSettings();

  const { data: paymentRows = [] } = useQuery<any[]>({
    queryKey: ["dash-payment"],
    queryFn: () => fetchWithAuth(`/api/reports/by-payment${dateParams}`),
  });
  const { data: categoryRows = [] } = useQuery<any[]>({
    queryKey: ["dash-category"],
    queryFn: () => fetchWithAuth(`/api/reports/by-category${dateParams}`),
  });

  const [initForm, setInitForm] = useState({
    businessName: "",
    currency: "ريال يمني"
  });

  useEffect(() => {
    if (settings) {
      setInitForm({
        businessName: settings.businessName || "مخابز الشام",
        currency: settings.currency || "ريال يمني"
      });
    }
  }, [settings]);

  if (isLoadingSummary || isLoadingTopProducts || isLoadingSalesByHour) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const isInitialized = settings?.initialized === "true" || settings?.initialized === true;

  const handleInitialize = () => {
    updateSettingsMutation.mutate({
      businessName: initForm.businessName,
      currency: initForm.currency,
      initialized: "true"
    }, {
      onSuccess: () => {
        // Also update default safe's currency
        const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : null) ?? "";
        fetch("/api/safes", { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(safesList => {
            const mainSafe = safesList.find((s: any) => s.name === "الصندوق الرئيسي");
            if (mainSafe) {
              fetch(`/api/safes/${mainSafe.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  name: mainSafe.name,
                  balance: mainSafe.balance,
                  currency: initForm.currency,
                  notes: mainSafe.notes,
                  active: mainSafe.active === 1
                })
              });
            }
          });
        qc.invalidateQueries({ queryKey: ["settings"] });
        alert("تمت تهيئة النظام وتحديث مسمى النشاط والعملة الافتراضية بنجاح!");
      }
    });
  };

  const avgOrderValue = summary && summary.todayOrders > 0 ? summary.todaySales / summary.todayOrders : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">لوحة القيادة</h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">{new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        {/* System Initialization Card */}
        {!isInitialized && (
          <Card className="border border-amber-300 bg-amber-50/30 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-amber-900">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                تهيئة وتجهيز النظام للاستخدام لأول مرة
              </CardTitle>
              <CardDescription className="text-amber-800/80 text-xs sm:text-sm">
                يرجى تحديد مسمى النشاط والعملة الافتراضية المعتمدة للمبيعات والحسابات وسندات الصرف والقبض.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> اسم النشاط التجاري
                  </label>
                  <Input
                    value={initForm.businessName}
                    onChange={e => setInitForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="مثال: مخابز الشام الحديثة"
                    className="bg-white h-11"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">العملة الافتراضية للنظام</label>
                  <select
                    value={initForm.currency}
                    onChange={e => setInitForm(f => ({ ...f, currency: e.target.value }))}
                    className="flex h-11 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="ريال سعودي">ريال سعودي (ر.س)</option>
                    <option value="ريال يمني">ريال يمني (ر.ي)</option>
                    <option value="دينار أردني">دينار أردني (د.أ)</option>
                    <option value="دولار أمريكي">دولار أمريكي ($)</option>
                    <option value="دينار كويتي">دينار كويتي (د.ك)</option>
                    <option value="درهم إماراتي">درهم إماراتي (د.إ)</option>
                    <option value="جنيه مصري">جنيه مصري (ج.م)</option>
                  </select>
                </div>

                <Button
                  onClick={handleInitialize}
                  disabled={!initForm.businessName}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-11"
                >
                  حفظ وإتمام تهيئة النظام
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today stats — row 1 */}
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-slate-600 mb-2">اليوم</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0"><DollarSign className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">المبيعات</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums truncate">{fmt(summary?.todaySales)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl shrink-0"><Receipt className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">الفواتير</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums">{summary?.todayOrders}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-green-500/10 text-green-600 rounded-xl shrink-0"><TrendingUp className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">الأرباح</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums truncate">{fmt(summary?.todayProfit)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl shrink-0"><ShoppingCart className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">متوسط الفاتورة</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums truncate">{fmt(avgOrderValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Month stats — row 2 */}
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-slate-600 mb-2">الشهر الحالي</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0"><DollarSign className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">المبيعات</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums truncate">{fmt(summary?.monthSales)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl shrink-0"><Receipt className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">الفواتير</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums">{summary?.monthOrders}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-xl shrink-0"><Package className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">المنتجات النشطة</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums">{summary?.totalProducts}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/10 text-orange-600 rounded-xl shrink-0"><Users className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">العملاء</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tabular-nums">{summary?.totalCustomers}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">مبيعات اليوم بالساعة</CardTitle></CardHeader>
            <CardContent className="h-56 px-2 sm:px-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByHour || []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(v) => `${v}:00`} tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} width={40} />
                  <Tooltip labelFormatter={(v) => `الساعة ${v}:00`} formatter={(v: number) => [fmt(v), "المبيعات"]} />
                  <Line type="monotone" dataKey="total" name="المبيعات" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">أكثر المنتجات مبيعاً (الشهر)</CardTitle></CardHeader>
            <CardContent className="h-56 px-2 sm:px-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(topProducts || []).slice(0, 8)} layout="vertical" margin={{ top: 5, right: 12, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="productName" width={75} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, "الكمية"]} />
                  <Bar dataKey="totalQty" name="الكمية" fill="#1e3a5f" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">طرق الدفع (الشهر)</CardTitle></CardHeader>
            <CardContent className="min-h-[14rem]">
              {paymentRows.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">لا توجد بيانات</div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 h-full">
                  <div className="w-full sm:w-[55%] h-48 sm:h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentRows} dataKey="total" nameKey="paymentMethod" cx="50%" cy="50%" outerRadius={68} innerRadius={30}>
                          {paymentRows.map((r: any, idx: number) => <Cell key={idx} fill={PAYMENT_COLORS[r.paymentMethod] ?? "#94a3b8"} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [fmt(v), "الإجمالي"]} labelFormatter={(v) => PAYMENT_LABELS[v] ?? v} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2 text-xs sm:text-sm w-full sm:w-[45%]">
                    {paymentRows.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: PAYMENT_COLORS[r.paymentMethod] ?? "#94a3b8" }} />
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight text-slate-900">{PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod}</p>
                          <p className="text-xs text-slate-500 font-mono tabular-nums truncate">{r.orders} فاتورة — {fmt(r.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">المبيعات بالفئة (الشهر)</CardTitle></CardHeader>
            <CardContent className="h-56 px-2 sm:px-6">
              {categoryRows.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">لا توجد بيانات</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryRows} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="categoryName" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 9 }} width={40} />
                    <Tooltip formatter={(v: number) => [fmt(v), "الإيراد"]} />
                    <Bar dataKey="totalRevenue" name="الإيراد" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
