import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  useGetCurrencies,
  useCreateCurrency,
  useUpdateCurrency,
  useDeleteCurrency
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Coins, ArrowUpDown, Calculator, Check, Globe, HelpCircle, Sparkles, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

type CurrencyForm = {
  name: string;
  symbol: string;
  fraction: string;
  decimal_places: number;
  flag: string;
  type: "local" | "foreign";
  exchange_rate: number;
  active: boolean;
};

const POPULAR_CURRENCY_PRESETS = [
  { name: "ريال سعودي", symbol: "SAR", fraction: "هللة", decimal_places: 2, flag: "🇸🇦", type: "foreign", exchange_rate: 4 },
  { name: "ريال يمني", symbol: "YER", fraction: "فلس", decimal_places: 2, flag: "🇾🇪", type: "local", exchange_rate: 1 },
  { name: "دولار أمريكي", symbol: "USD", fraction: "سنت", decimal_places: 2, flag: "🇺🇸", type: "foreign", exchange_rate: 1.88 },
  { name: "درهم إماراتي", symbol: "AED", fraction: "فلس", decimal_places: 2, flag: "🇦🇪", type: "foreign", exchange_rate: 1.02 },
  { name: "دينار كويتي", symbol: "KWD", fraction: "فلس", decimal_places: 3, flag: "🇰🇼", type: "foreign", exchange_rate: 12.25 },
  { name: "دينار أردني", symbol: "JOD", fraction: "قرش", decimal_places: 3, flag: "🇯🇴", type: "foreign", exchange_rate: 5.29 },
  { name: "ريال قطري", symbol: "QAR", fraction: "درهم", decimal_places: 2, flag: "🇶🇦", type: "foreign", exchange_rate: 1.03 },
  { name: "ريال عماني", symbol: "OMR", fraction: "بيسة", decimal_places: 3, flag: "🇴🇲", type: "foreign", exchange_rate: 9.75 },
  { name: "دينار بحريني", symbol: "BHD", fraction: "فلس", decimal_places: 3, flag: "🇧🇭", type: "foreign", exchange_rate: 9.95 },
  { name: "جنيه مصري", symbol: "EGP", fraction: "قرش", decimal_places: 2, flag: "🇪🇬", type: "foreign", exchange_rate: 0.076 },
  { name: "يورو أوروبي", symbol: "EUR", fraction: "سنت", decimal_places: 2, flag: "🇪🇺", type: "foreign", exchange_rate: 4.10 },
  { name: "جنيه إسترليني", symbol: "GBP", fraction: "بنس", decimal_places: 2, flag: "🇬🇧", type: "foreign", exchange_rate: 4.85 },
];

export default function CurrenciesPage() {
  const { user } = useAuth();
  const { data: currencies = [], isLoading } = useGetCurrencies();
  const createMutation = useCreateCurrency();
  const updateMutation = useUpdateCurrency();
  const deleteMutation = useDeleteCurrency();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CurrencyForm>({
    name: "",
    symbol: "",
    fraction: "هللة",
    decimal_places: 2,
    flag: "🌐",
    type: "foreign",
    exchange_rate: 1.0,
    active: true
  });

  // Currency Converter Quick Calculator States
  const [calcFromId, setCalcFromId] = useState<number | null>(null);
  const [calcToId, setCalcToId] = useState<number | null>(null);
  const [calcAmount, setCalcAmount] = useState<number>(1000000);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      symbol: "",
      fraction: "هللة",
      decimal_places: 2,
      flag: "🌐",
      type: "foreign",
      exchange_rate: 1.0,
      active: true
    });
    setShowDialog(true);
  };

  const applyPreset = (preset: typeof POPULAR_CURRENCY_PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      name: preset.name,
      symbol: preset.symbol,
      fraction: preset.fraction,
      decimal_places: preset.decimal_places,
      flag: preset.flag,
      type: preset.type as any,
      exchange_rate: preset.exchange_rate
    }));
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name,
      symbol: c.symbol,
      fraction: c.fraction || "هللة",
      decimal_places: c.decimal_places !== undefined ? Number(c.decimal_places) : 2,
      flag: c.flag || "🌐",
      type: c.type || "foreign",
      exchange_rate: Number(c.exchange_rate) || 1.0,
      active: c.active === 1 || c.active === true
    });
    setShowDialog(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["currencies"] });
    qc.invalidateQueries({ queryKey: ["travel-dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleSave = () => {
    if (!form.name || !form.symbol || !form.exchange_rate) {
      toast({ variant: "destructive", title: "يرجى ملء جميع الحقول المطلوبة (الاسم، الرمز الدولي، وسعر الصرف)" });
      return;
    }

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: form },
        {
          onSuccess: () => {
            invalidate();
            setShowDialog(false);
            toast({ title: "تم تحديث العملة بنجاح" });
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "فشل في تحديث العملة", description: err.message });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: form },
        {
          onSuccess: () => {
            invalidate();
            setShowDialog(false);
            toast({ title: "تم إضافة العملة بنجاح" });
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "فشل في إضافة العملة", description: err.message });
          }
        }
      );
    }
  };

  const handleDelete = (c: any) => {
    if (c.type === "local") {
      toast({ variant: "destructive", title: "تنبيه هام", description: "لا يمكن حذف العملة المحلية الأساسية للنظام." });
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف العملة "${c.name}" (${c.symbol})؟`)) return;
    deleteMutation.mutate(
      { id: c.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "تم حذف العملة بنجاح" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "فشل في حذف العملة", description: err.message });
        }
      }
    );
  };

  // Safe Calculator calculation adhering to international accounting laws and local conventions
  const calculationResult = useMemo(() => {
    if (currencies.length === 0) {
      return { converted: 0, multiplier: 1, reverseMultiplier: 1, formula: "", fromCur: null, toCur: null, spelled: "" };
    }

    const fromCur = currencies.find(c => c.id === (calcFromId || currencies[0].id)) || currencies[0];
    const toCur = currencies.find(c => c.id === (calcToId || currencies[1]?.id || currencies[0].id)) || currencies[1] || currencies[0];

    if (!fromCur || !toCur) {
      return { converted: 0, multiplier: 1, reverseMultiplier: 1, formula: "", fromCur: null, toCur: null, spelled: "" };
    }

    if (fromCur.id === toCur.id || fromCur.symbol === toCur.symbol) {
      return {
        converted: calcAmount,
        multiplier: 1,
        reverseMultiplier: 1,
        formula: `1 ${fromCur.symbol} = 1 ${toCur.symbol}`,
        fromCur,
        toCur,
        spelled: `${calcAmount.toLocaleString("ar-SA")} ${toCur.name}`
      };
    }

    const fromCode = (fromCur.symbol || "").toUpperCase();
    const toCode = (toCur.symbol || "").toUpperCase();
    let multiplier = 1.0;

    // YER <-> SAR
    if (fromCode === "YER" && toCode === "SAR") {
      const r = Number(toCur.exchange_rate) || 4;
      multiplier = r <= 20 ? (r / 1000) : (r >= 50 ? (1 / r) : r);
    } else if (fromCode === "SAR" && toCode === "YER") {
      const r = Number(fromCur.exchange_rate) || 4;
      multiplier = r <= 20 ? (1000 / r) : (r >= 50 ? r : (1 / r));
    }
    // YER <-> USD
    else if (fromCode === "YER" && toCode === "USD") {
      const r = Number(toCur.exchange_rate) || 1.88;
      multiplier = r <= 20 ? (r / 1000) : (r >= 50 ? (1 / r) : r);
    } else if (fromCode === "USD" && toCode === "YER") {
      const r = Number(fromCur.exchange_rate) || 1.88;
      multiplier = r <= 20 ? (1000 / r) : (r >= 50 ? r : (1 / r));
    }
    // SAR <-> USD
    else if (fromCode === "SAR" && toCode === "USD") {
      multiplier = 1 / 3.75;
    } else if (fromCode === "USD" && toCode === "SAR") {
      multiplier = 3.75;
    }
    // SAR <-> AED
    else if (fromCode === "SAR" && toCode === "AED") {
      multiplier = 1 / 1.02;
    } else if (fromCode === "AED" && toCode === "SAR") {
      multiplier = 1.02;
    }
    // General Cross Rates
    else {
      const fRate = Number(fromCur.exchange_rate) || 1;
      const tRate = Number(toCur.exchange_rate) || 1;
      multiplier = tRate / fRate;
    }

    const decimals = toCur.decimal_places !== undefined ? Number(toCur.decimal_places) : 2;
    const factor = Math.pow(10, decimals);
    const converted = Math.round((calcAmount * multiplier) * factor) / factor;
    const reverseMultiplier = multiplier > 0 ? Math.round((1.0 / multiplier) * 100000) / 100000 : 0;

    const whole = Math.floor(converted);
    const fractionVal = Math.round((converted - whole) * factor);
    const fractionName = toCur.fraction || "هللة";

    const spelled = `${whole.toLocaleString("ar-SA")} ${toCur.name} ${fractionVal > 0 ? `و ${fractionVal} ${fractionName}` : ""}`.trim();

    return {
      converted,
      multiplier,
      reverseMultiplier,
      formula: `1 ${fromCur.symbol} = ${multiplier < 0.001 ? multiplier.toFixed(6) : multiplier} ${toCur.symbol}  (1 ${toCur.symbol} = ${reverseMultiplier} ${fromCur.symbol})`,
      fromCur,
      toCur,
      spelled
    };
  }, [currencies, calcFromId, calcToId, calcAmount]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coins className="w-7 h-7 text-emerald-600" />
              تهيئة وإدارة العملات وأسعار الصرف
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              تعريف العملات المحلية والأجنبية، تحديد أسعار الصرف، والكسور المئوية المعتمدة بالنظام وفقاً للقوانين والمعايير الدولية (ISO 4217 & IAS 21).
            </p>
          </div>
          {user?.role === "admin" || user?.role === "developer" ? (
            <Button onClick={openAdd} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Plus className="w-4 h-4" />
              إضافة عملة جديدة
            </Button>
          ) : null}
        </div>

        {/* Currency Grid and Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                قائمة العملات المعتمدة بالنظام ({currencies.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                الكسور المئوية والأنصبة محددة وفق معيار ISO 4217
              </span>
            </div>
            
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border">جاري التحميل...</div>
            ) : (
              <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-3 font-bold">اسم العملة</th>
                      <th className="p-3 font-bold">الرمز الدولي</th>
                      <th className="p-3 font-bold">فئة الكسر والخانة</th>
                      <th className="p-3 font-bold">النوع</th>
                      <th className="p-3 font-bold">معامل سعر الصرف</th>
                      <th className="p-3 font-bold">الحالة</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currencies.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="text-xl">{c.flag || "🌐"}</span>
                          <span>{c.name}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">{c.symbol}</td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {c.fraction || "هللة"}
                          </span>
                          <span className="text-xs text-muted-foreground block font-mono">
                            {c.decimal_places ?? 2} خانات عشرية ({(1 / Math.pow(10, c.decimal_places ?? 2)).toFixed(c.decimal_places ?? 2)})
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={c.type === "local" ? "default" : "outline"}
                            className={c.type === "local" ? "bg-emerald-600 text-white font-bold" : "text-slate-700 dark:text-slate-300 font-semibold"}
                          >
                            {c.type === "local" ? "🟢 عملة محلية أساسية" : "🌐 عملة أجنبية"}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {c.exchange_rate}
                          {c.type === "local" ? " (الأساس 1.0)" : ""}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={c.active === 1 || c.active === true ? "outline" : "destructive"}
                            className={c.active === 1 || c.active === true ? "text-emerald-700 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : ""}
                          >
                            {c.active === 1 || c.active === true ? "نشط ومتاح" : "موقوف"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-end">
                            {(user?.role === "admin" || user?.role === "developer") && (
                              <>
                                <button
                                  onClick={() => openEdit(c)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="تعديل العملة وسعر الصرف"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {c.type !== "local" && (
                                  <button
                                    onClick={() => handleDelete(c)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    title="حذف العملة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currencies.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          لا توجد عملات مضافة حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Currency Converter Side-Panel */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Calculator className="w-5 h-5 text-emerald-600" />
              محاسب الصرف والتحويل المالي المباشر
            </h2>
            <div className="bg-card rounded-2xl border-2 border-emerald-300/80 dark:border-emerald-800/50 p-4 space-y-4 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  المبلغ المراد تحويله واختباره
                </label>
                <Input
                  type="number"
                  value={calcAmount}
                  onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)}
                  className="font-mono text-lg font-bold text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">من عملة</label>
                  <select
                    value={calcFromId || (currencies[0]?.id ?? "")}
                    onChange={e => setCalcFromId(parseInt(e.target.value) || null)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-background text-sm font-bold"
                  >
                    {currencies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.flag || ""} {c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>

                <div className="p-2.5 mt-5 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 border border-emerald-200">
                  <ArrowUpDown className="w-4 h-4" />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">إلى عملة</label>
                  <select
                    value={calcToId || (currencies[1]?.id ?? currencies[0]?.id ?? "")}
                    onChange={e => setCalcToId(parseInt(e.target.value) || null)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-background text-sm font-bold"
                  >
                    {currencies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.flag || ""} {c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Converted Output Display */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-950 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <span className="text-xs text-muted-foreground font-semibold block">
                  القيمة المقابلة الصافية بالصرف المعتمد
                </span>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono" dir="ltr">
                  {calculationResult.converted.toLocaleString(undefined, {
                    minimumFractionDigits: calculationResult.toCur?.decimal_places ?? 2,
                    maximumFractionDigits: calculationResult.toCur?.decimal_places ?? 2
                  })}{" "}
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {calculationResult.toCur?.symbol || ""}
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                  {calculationResult.spelled}
                </div>
              </div>

              {/* Mathematical Formula breakdown */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  معادلة التحويل وسعر الصرف التبادلي:
                </div>
                <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 dir-ltr text-left">
                  {calculationResult.formula}
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-900 dark:text-blue-300 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  تتوافق هذه الحسابات مع المعيار الدولي للتقارير المالية (IAS 21) وكود العملات (ISO 4217) لضمان عدم ضياع الكسور والهللات في التقارير والصناديق.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent dir="rtl" className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" />
                {editing ? "تعديل بيانات العملة وسعر الصرف" : "إضافة عملة جديدة للنظام"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                حدد مواصفات العملة بدقة، رمز الآيزو الدولي، والكسر المئوي المعتمد.
              </DialogDescription>
            </DialogHeader>

            {/* Quick Presets Buttons (When adding) */}
            {!editing && (
              <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  قوالب عملات جاهزة ومعتمدة دولياً (انقر للتعبئة التلقائية):
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {POPULAR_CURRENCY_PRESETS.map(p => (
                    <button
                      key={p.symbol}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 ${
                        form.symbol === p.symbol
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white dark:bg-slate-800 hover:bg-slate-100 border-slate-300 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{p.flag}</span>
                      <span>{p.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold">اسم العملة *</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="مثال: ريال سعودي، دولار أمريكي"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">الرمز الدولي (ISO 4217) *</label>
                  <Input
                    value={form.symbol}
                    onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                    placeholder="مثال: SAR, USD, YER"
                    dir="ltr"
                    className="font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold">اسم فئة الكسر (التحتية) *</label>
                  <Input
                    value={form.fraction}
                    onChange={e => setForm({ ...form, fraction: e.target.value })}
                    placeholder="مثال: هللة، فلس، سنت، قرش"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">الخانات العشرية للكسر *</label>
                  <select
                    value={form.decimal_places}
                    onChange={e => setForm({ ...form, decimal_places: parseInt(e.target.value) || 2 })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-bold"
                  >
                    <option value={2}>خانتين (0.01) - شائع (هللة، سنت، فلس)</option>
                    <option value={3}>3 خانات (0.001) - (دينار كويتي/بحريني/أردني/عماني)</option>
                    <option value={0}>بدون كسور (0) - (ين ياباني، ون كوري)</option>
                    <option value={4}>4 خانات (0.0001) - حسابات تداول خاصة</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">العلم / الأيقونة</label>
                  <Input
                    value={form.flag}
                    onChange={e => setForm({ ...form, flag: e.target.value })}
                    placeholder="🇸🇦"
                    className="text-center text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold">نوع العملة بالنظام</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as any, exchange_rate: e.target.value === "local" ? 1.0 : form.exchange_rate })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-bold"
                  >
                    <option value="foreign">عملة أجنبية (Foreign Currency)</option>
                    <option value="local">عملة محلية أساسية (Local Base Currency)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    العملة المحلية الأساسية تكون دائماً بسعر صرف 1.0 كمرجع للتحويلات.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">معامل سعر الصرف *</label>
                  <Input
                    type="number"
                    step="any"
                    disabled={form.type === "local"}
                    value={form.type === "local" ? 1.0 : form.exchange_rate}
                    onChange={e => setForm({ ...form, exchange_rate: parseFloat(e.target.value) || 0 })}
                    className="font-mono font-bold"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    مثال: 4 (معامل الألف لليمني مقابل السعودي) أو 250 أو 3.75.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold">تنشيط العملة بالنظام</label>
                  <p className="text-[11px] text-muted-foreground">عند الإيقاف، لا تظهر العملة في خيارات الفواتير والسندات والصناديق.</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={v => setForm({ ...form, active: v })}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {editing ? "حفظ التعديلات" : "إضافة العملة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
