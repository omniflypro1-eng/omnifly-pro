import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Server,
  HardDrive,
  GitMerge,
  Clock,
  FileCheck,
  ShieldAlert,
  Laptop,
  Settings2,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token") || "";
}

async function apiGet(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "فشل الاتصال بالخادم" }));
    throw new Error(err.error || err.message || "خطأ غير متوقع");
  }
  return res.json();
}

async function apiPost(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "فشل تنفيذ العملية");
  }
  return data;
}

const STATUS_CONFIG: Record<
  string,
  { labelAr: string; cls: string; borderCls: string }
> = {
  Connected: {
    labelAr: "متصل بالسحابة",
    cls: "text-emerald-700 bg-emerald-50",
    borderCls: "border-emerald-200",
  },
  Synced: {
    labelAr: "متزامن بالكامل",
    cls: "text-emerald-700 bg-emerald-50",
    borderCls: "border-emerald-200",
  },
  Syncing: {
    labelAr: "جاري المزامنة الآن...",
    cls: "text-blue-700 bg-blue-50",
    borderCls: "border-blue-200",
  },
  "Pending Changes": {
    labelAr: "تغييرات محلية بانتظار الرفع",
    cls: "text-amber-700 bg-amber-50",
    borderCls: "border-amber-200",
  },
  Offline: {
    labelAr: "وضع عدم الاتصال (Offline)",
    cls: "text-slate-700 bg-slate-100",
    borderCls: "border-slate-300",
  },
  "Conflict Detected": {
    labelAr: "تضارب بيانات يتطلب مراجعة",
    cls: "text-orange-700 bg-orange-50",
    borderCls: "border-orange-300",
  },
  "Sync Failed": {
    labelAr: "فشل المزامنة",
    cls: "text-red-700 bg-red-50",
    borderCls: "border-red-300",
  },
  "License Expired": {
    labelAr: "انتهى الترخيص السحابي",
    cls: "text-red-800 bg-red-50",
    borderCls: "border-red-300",
  },
};

export default function SyncCenterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [cloudUrlInput, setCloudUrlInput] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncInterval, setAutoSyncInterval] = useState("30");
  const [logFilter, setLogFilter] = useState<"all" | "success" | "failed" | "conflict">("all");
  const [activeConflict, setActiveConflict] = useState<any | null>(null);
  const [mergeSelection, setMergeSelection] = useState<Record<string, "cloud" | "local">>({});
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ["hybrid-sync-status"],
    queryFn: () => apiGet("/api/sync/status"),
    refetchInterval: 10000,
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ["hybrid-sync-conflicts"],
    queryFn: () => apiGet("/api/sync/conflicts"),
    refetchInterval: 12000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["hybrid-sync-logs"],
    queryFn: () => apiGet("/api/sync/logs"),
    refetchInterval: 12000,
  });

  useEffect(() => {
    if (syncStatus) {
      setCloudUrlInput(syncStatus.cloudServerUrl || "");
      setAutoSyncEnabled(Boolean(syncStatus.autoSyncEnabled ?? true));
      setAutoSyncInterval(String(syncStatus.autoSyncIntervalSec || 30));
    }
  }, [syncStatus]);

  const syncNowMut = useMutation({
    mutationFn: () => apiPost("/api/sync/now", {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["hybrid-sync-status"] });
      qc.invalidateQueries({ queryKey: ["hybrid-sync-conflicts"] });
      qc.invalidateQueries({ queryKey: ["hybrid-sync-logs"] });
      if (res.ok) {
        toast({
          title: "اكتملت المزامنة بنجاح",
          description: `تم رفع (${res.uploadedCount || 0}) وتنزيل (${res.downloadedCount || 0}) سجل و (${res.filesSynced || 0}) ملفات.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "تعذر إتمام المزامنة",
          description: res.error || "الخادم السحابي غير متاح حالياً.",
        });
      }
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "فشل المزامنة", description: e.message });
    },
  });

  const configMut = useMutation({
    mutationFn: () =>
      apiPost("/api/sync/configure", {
        cloud_server_url: cloudUrlInput.trim(),
        auto_sync_enabled: autoSyncEnabled,
        auto_sync_interval_sec: Number(autoSyncInterval) || 30,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hybrid-sync-status"] });
      toast({ title: "تم حفظ إعدادات المزامنة السحابية بنجاح" });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "فشل حفظ الإعدادات", description: e.message });
    },
  });

  const resolveConflictMut = useMutation({
    mutationFn: ({
      conflictId,
      strategy,
      mergedFields,
      note,
    }: {
      conflictId: number;
      strategy: "cloud" | "local" | "merge";
      mergedFields?: Record<string, any>;
      note?: string;
    }) =>
      apiPost(`/api/sync/conflicts/${conflictId}/resolve`, {
        strategy,
        merged_fields: mergedFields,
        note,
      }),
    onSuccess: () => {
      setActiveConflict(null);
      setResolutionNote("");
      qc.invalidateQueries({ queryKey: ["hybrid-sync-conflicts"] });
      qc.invalidateQueries({ queryKey: ["hybrid-sync-status"] });
      qc.invalidateQueries({ queryKey: ["hybrid-sync-logs"] });
      toast({ title: "تمت معالجة التضارب وتوحيد النسختين بنجاح" });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "فشل حل التضارب", description: e.message });
    },
  });

  const statusKey = syncStatus?.status || "Connected";
  const statusMeta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.Connected;
  const isLocalMode = syncStatus?.mode === "local";
  const pendingConflicts = (conflicts as any[]).filter((c) => c.status === "pending");
  const filteredLogs = (logs as any[]).filter((l) => {
    if (logFilter === "all") return true;
    return l.status === logFilter;
  });

  const openMergeDialog = (c: any) => {
    const initSel: Record<string, "cloud" | "local"> = {};
    for (const f of c.conflictFields || []) {
      initSel[f] = "cloud";
    }
    setMergeSelection(initSel);
    setResolutionNote("");
    setActiveConflict(c);
  };

  const handleConfirmMerge = () => {
    if (!activeConflict) return;
    const mergedFields: Record<string, any> = {};
    const cloudObj = activeConflict.cloudPayload || {};
    const localObj = activeConflict.localPayload || {};
    for (const f of activeConflict.conflictFields || []) {
      mergedFields[f] = mergeSelection[f] === "local" ? localObj[f] : cloudObj[f];
    }
    resolveConflictMut.mutate({
      conflictId: activeConflict.id,
      strategy: "merge",
      mergedFields,
      note: resolutionNote || "دمج يدوي للحقول المتعارضة",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6 dir-rtl">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Cloud className="w-6 h-6 text-blue-700 shrink-0" />
              <h1 className="text-xl font-black text-slate-900">
                مركز المزامنة السحابية والمحلية
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${statusMeta.cls} ${statusMeta.borderCls}`}
              >
                {statusMeta.labelAr}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium flex flex-wrap items-center gap-2">
              <span>{syncStatus?.companyName || "المؤسسة النشطة"}</span>
              <span>·</span>
              <span>
                النمط: {isLocalMode ? "النسخة المحلية المكتبية (Electron Local)" : "النسخة السحابية المباشرة (Cloud Web)"}
              </span>
              <span>·</span>
              <span className="font-mono text-[11px] text-slate-500 dir-ltr">
                {syncStatus?.installationId || "—"}
              </span>
              <span>·</span>
              <span className="font-mono text-[11px] text-slate-500 dir-ltr">
                {syncStatus?.deviceId || syncStatus?.currentSystemDeviceId || "—"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              type="button"
              onClick={() => syncNowMut.mutate()}
              disabled={syncNowMut.isPending || statusKey === "Syncing"}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-9 px-4 gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncNowMut.isPending ? "animate-spin" : ""}`} />
              <span>{syncNowMut.isPending ? "جاري المزامنة..." : "مزامنة الآن"}</span>
            </Button>
          </div>
        </div>

        {/* Critical Alert Banners (Pending Uploads / License Expired / Conflicts) */}
        {syncStatus && !syncStatus.licensePolicy?.allowed && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-black text-red-900">
                تم إيقاف المزامنة والدخول بسبب حالة الترخيص السحابي
              </p>
              <p className="text-red-800 font-medium leading-relaxed">
                {syncStatus.licensePolicy?.reason ||
                  "انتهت صلاحية اشتراك المؤسسة أو تم حظر هذا الجهاز. جميع البيانات المحلية محفوظة ولن تُحذف، يرجى التجديد عبر لوحة المطور."}
              </p>
            </div>
          </div>
        )}

        {syncStatus && syncStatus.pendingUploadsCount > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-bold text-amber-950">
                يوجد <span className="font-mono font-black tabular-nums">{syncStatus.pendingUploadsCount}</span> تغييرات محلية مسجلة بدون اتصال ولم تُرفع للسحابة بعد. لا تحذف قاعدة البيانات قبل إتمام المزامنة.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => syncNowMut.mutate()}
              disabled={syncNowMut.isPending}
              className="border-amber-400 bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs h-8 shrink-0"
            >
              رفع التغييرات الآن
            </Button>
          </div>
        )}

        {/* 4 Clean KPI Cards (Tabular Numerals) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200 bg-white shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 block">تغييرات بانتظار الرفع</span>
                <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                  {isLoading ? "—" : syncStatus?.pendingUploadsCount ?? 0}
                </span>
              </div>
              <ArrowUpDown className="w-5 h-5 text-amber-600" />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 block">السجلات المتزامنة</span>
                <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                  {isLoading ? "—" : syncStatus?.syncedRecordsCount ?? 0}
                </span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 block">ملفات ومرفقات معلقة</span>
                <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                  {isLoading ? "—" : syncStatus?.pendingFilesCount ?? 0}
                </span>
              </div>
              <FileCheck className="w-5 h-5 text-blue-600" />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 block">تضاربات قيد المراجعة</span>
                <span
                  className={`text-2xl font-black font-mono tabular-nums ${
                    (syncStatus?.unresolvedConflictsCount ?? 0) > 0 ? "text-orange-700" : "text-slate-900"
                  }`}
                >
                  {isLoading ? "—" : syncStatus?.unresolvedConflictsCount ?? 0}
                </span>
              </div>
              <GitMerge className="w-5 h-5 text-orange-600" />
            </CardContent>
          </Card>
        </div>

        {/* Settings & Checkpoints Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cloud Connection & Auto Sync Controls */}
          <Card className="lg:col-span-2 border border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-700" />
                <span>إعدادات الخادم السحابي والمزامنة التلقائية</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                ربط النسخة المحلية بعنوان السحابة وتحديد وتيرة المزامنة التلقائية في الخلفية.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    عنوان الخادم السحابي (Cloud Server URL)
                  </label>
                  <Input
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    placeholder="https://cloud.omniflypro.com"
                    className="font-mono text-xs dir-ltr text-left h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    فترة المزامنة (بالثواني)
                  </label>
                  <Input
                    type="number"
                    min="10"
                    value={autoSyncInterval}
                    onChange={(e) => setAutoSyncInterval(e.target.value)}
                    className="font-mono text-xs tabular-nums h-9"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700"
                  />
                  <span>تفعيل المزامنة التلقائية الذكية عند توفر الاتصال بالإنترنت</span>
                </label>

                <Button
                  type="button"
                  onClick={() => configMut.mutate()}
                  disabled={configMut.isPending}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-5"
                >
                  {configMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Schema & Checkpoint Parity Summary */}
          <Card className="border border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-700" />
                <span>تطابق الإصدارات ونقاط التوقف</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">إصدار قاعدة البيانات المحلية</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {syncStatus?.localDbVersion || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">إصدار قاعدة البيانات السحابية</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {syncStatus?.cloudDbVersion || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">إصدار التطبيق</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  v{syncStatus?.appVersion || "1.1.0"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">آخر تسلسل تنزيل / رفع</span>
                <span className="font-mono font-bold text-blue-700 tabular-nums dir-ltr">
                  ↓{syncStatus?.lastDownloadedSeq ?? 0} / ↑{syncStatus?.lastUploadedSeq ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">آخر مزامنة ناجحة</span>
                <span className="font-mono text-[11px] font-bold text-slate-800 dir-ltr">
                  {syncStatus?.lastSuccessfulSync || "لم تتم بعد"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conflicts Queue */}
        <Card className="border border-slate-200 bg-white shadow-none">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-orange-600" />
                <span>تضاربات المزامنة والمراجعة ({pendingConflicts.length} قيد الانتظار)</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                السجلات المالية محمية ضد الحذف أو التعديل الصامت؛ كما تظهر التعديلات المتزامنة على نفس السجل هنا لاختيار النسخة المعتمدة أو الدمج.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {conflicts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                لا توجد أي تضاربات بيانات مسجلة. جميع السجلات متطابقة بين السحابة والجهاز المحلي.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="p-3 text-right font-bold">الجدول / السجل</th>
                      <th className="p-3 text-right font-bold">سبب التضارب</th>
                      <th className="p-3 text-right font-bold">الحقول المتعارضة</th>
                      <th className="p-3 text-center font-bold">الإصدارات (محلي / سحابي)</th>
                      <th className="p-3 text-center font-bold">الحالة</th>
                      <th className="p-3 text-center font-bold">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(conflicts as any[]).map((c) => {
                      const isPending = c.status === "pending";
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{c.table_name}</div>
                            <div className="font-mono text-[10px] text-slate-500 dir-ltr text-right">
                              #{c.record_id} · {c.sync_uuid?.slice(0, 12)}
                            </div>
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {c.conflict_reason === "financial_immutability_guard"
                              ? "حماية السجل المالي ضد التعديل/الحذف الصامت"
                              : "تعديل متزامن على نفس الحقل بدون اتصال"}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-600 dir-ltr text-right">
                            {(c.conflictFields || []).join(", ") || "—"}
                          </td>
                          <td className="p-3 text-center font-mono tabular-nums text-slate-800">
                            L:v{c.local_version} / C:v{c.cloud_version}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                isPending
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {isPending ? "بانتظار القرار" : c.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={resolveConflictMut.isPending}
                                  onClick={() =>
                                    resolveConflictMut.mutate({
                                      conflictId: c.id,
                                      strategy: "cloud",
                                      note: "اعتماد نسخة السحابة",
                                    })
                                  }
                                  className="h-7 px-2 text-[11px] font-bold"
                                >
                                  اعتماد السحابة
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={resolveConflictMut.isPending}
                                  onClick={() =>
                                    resolveConflictMut.mutate({
                                      conflictId: c.id,
                                      strategy: "local",
                                      note: "اعتماد النسخة المحلية",
                                    })
                                  }
                                  className="h-7 px-2 text-[11px] font-bold"
                                >
                                  اعتماد المحلية
                                </Button>
                                {c.conflict_reason !== "financial_immutability_guard" && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => openMergeDialog(c)}
                                    className="h-7 px-2 text-[11px] font-bold bg-blue-700 hover:bg-blue-800 text-white"
                                  >
                                    دمج الحقول
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                تم الحل بواسطة {c.resolved_by || "الإدارة"}
                              </span>
                            )}
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

        {/* Linked Installations & Devices */}
        <Card className="border border-slate-200 bg-white shadow-none">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-700" />
              <span>الأجهزة والتثبيتات المرتبطة بالمؤسسة ({syncStatus?.installations?.length || 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!syncStatus?.installations || syncStatus.installations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-medium">
                لا توجد تثبيتات محلية مسجلة لهذه المؤسسة حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="p-3 text-right font-bold">معرّف التثبيت</th>
                      <th className="p-3 text-right font-bold">بصمة الجهاز / الاسم</th>
                      <th className="p-3 text-center font-bold">الإصدار (App / DB)</th>
                      <th className="p-3 text-center font-bold">آخر مزامنة</th>
                      <th className="p-3 text-center font-bold">حالة المزامنة</th>
                      <th className="p-3 text-center font-bold">الترخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncStatus.installations.map((inst: any) => (
                      <tr key={inst.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono text-[11px] text-slate-800 dir-ltr text-right">
                          {inst.installation_id}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{inst.device_name || inst.os_info || "محطة عمل"}</div>
                          <div className="font-mono text-[10px] text-slate-500 dir-ltr text-right">{inst.device_id}</div>
                        </td>
                        <td className="p-3 text-center font-mono text-[11px] tabular-nums">
                          v{inst.app_version} · {inst.db_version}
                        </td>
                        <td className="p-3 text-center font-mono text-[11px] dir-ltr">
                          {inst.last_successful_sync || "—"}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {inst.sync_status || "Connected"}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                              inst.status === "authorized"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {inst.status === "authorized" ? "مصرّح" : "محظور"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Logs Table */}
        <Card className="border border-slate-200 bg-white shadow-none">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <span>سجل عمليات المزامنة</span>
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {(["all", "success", "failed", "conflict"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLogFilter(k)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                    logFilter === k
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {k === "all" ? "الكل" : k === "success" ? "ناجحة" : k === "failed" ? "فاشلة" : "تضارب"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-medium">
                لا توجد سجلات مزامنة مطابقة للتصفية الحالية.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="p-3 text-right font-bold">التوقيت</th>
                      <th className="p-3 text-center font-bold">الاتجاه</th>
                      <th className="p-3 text-center font-bold">الحالة</th>
                      <th className="p-3 text-center font-bold">مرفوع / منزل / ملفات</th>
                      <th className="p-3 text-center font-bold">المدة</th>
                      <th className="p-3 text-right font-bold">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono text-[11px] text-slate-700 dir-ltr text-right">
                          {log.created_at}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">{log.direction}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                              log.status === "success"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : log.status === "conflict"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono tabular-nums text-slate-800">
                          ↑{log.uploaded_count || 0} · ↓{log.downloaded_count || 0} · 📎{log.files_synced || 0}
                        </td>
                        <td className="p-3 text-center font-mono text-[11px] tabular-nums text-slate-600">
                          {log.duration_ms ? `${log.duration_ms}ms` : "—"}
                        </td>
                        <td className="p-3 text-slate-600">{log.error_message || "اكتملت بنجاح"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Field-by-Field Conflict Merge Modal */}
      {activeConflict && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-blue-700" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    دمج الحقول المتعارضة — {activeConflict.table_name} (#{activeConflict.record_id})
                  </h3>
                  <p className="text-[11px] text-slate-500">اختر القيمة المعتمدة لكل حقل متعارض</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveConflict(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {(activeConflict.conflictFields || []).map((field: string) => {
                const cloudVal = activeConflict.cloudPayload?.[field];
                const localVal = activeConflict.localPayload?.[field];
                const choice = mergeSelection[field] || "cloud";
                return (
                  <div key={field} className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="text-xs font-black text-slate-800 font-mono">{field}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setMergeSelection((p) => ({ ...p, [field]: "cloud" }))}
                        className={`p-2.5 rounded-lg border text-right transition-colors ${
                          choice === "cloud"
                            ? "border-blue-600 bg-blue-50 text-blue-950 font-bold"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <div className="text-[10px] text-blue-700 font-bold mb-1">نسخة السحابة (Cloud v{activeConflict.cloud_version})</div>
                        <div className="break-words">{String(cloudVal ?? "—")}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMergeSelection((p) => ({ ...p, [field]: "local" }))}
                        className={`p-2.5 rounded-lg border text-right transition-colors ${
                          choice === "local"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <div className="text-[10px] text-emerald-700 font-bold mb-1">النسخة المحلية (Local v{activeConflict.local_version})</div>
                        <div className="break-words">{String(localVal ?? "—")}</div>
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">ملاحظة المعالجة (اختياري)</label>
                <Input
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="سبب اختيار الدمج أو المراجعة..."
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveConflict(null)}
                className="text-xs font-bold h-9"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={resolveConflictMut.isPending}
                onClick={handleConfirmMerge}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold h-9 gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد الدمج وتوحيد النسختين</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
