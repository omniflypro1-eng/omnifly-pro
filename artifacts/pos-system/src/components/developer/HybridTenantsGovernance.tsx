import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
  Users,
} from "lucide-react";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token") || "";
}

async function apiRequest<T = any>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    throw new Error(parsed?.error || parsed?.message || text || `خطأ (${res.status})`);
  }
  return parsed as T;
}

const PACKAGE_PRESETS: Record<
  string,
  { label: string; maxUsers: string; maxDevices: string; offlineHours: string }
> = {
  starter: { label: "Starter الأساسية", maxUsers: "5", maxDevices: "2", offlineHours: "48" },
  pro: { label: "Professional المتقدمة", maxUsers: "15", maxDevices: "4", offlineHours: "72" },
  enterprise: { label: "Enterprise الشاملة", maxUsers: "50", maxDevices: "10", offlineHours: "168" },
  vip: { label: "VIP المؤسسات الكبرى", maxUsers: "200", maxDevices: "50", offlineHours: "720" },
};

function formatBytes(bytes?: number): string {
  const b = Number(bytes || 0);
  if (b <= 0) return "0 KB";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function addMonthsToDate(dateStr: string, months: number): string {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const valid = Number.isNaN(base.getTime()) ? new Date() : base;
  valid.setMonth(valid.getMonth() + months);
  return valid.toISOString().split("T")[0];
}

function getStatusMeta(status?: string) {
  switch (status) {
    case "suspended":
      return { label: "معلق / موقوف", cls: "bg-red-50 text-red-700 border-red-200" };
    case "expired":
      return { label: "منتهي الصلاحية", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    default:
      return { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
}

function getInstStatusMeta(status?: string) {
  switch (status) {
    case "pending_approval":
      return { label: "بانتظار التفعيل", cls: "bg-amber-50 text-amber-800 border-amber-300" };
    case "blocked":
      return { label: "محظور", cls: "bg-red-50 text-red-700 border-red-200" };
    case "revoked":
      return { label: "ملغي", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    default:
      return { label: "مفوّض", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
}

export function HybridTenantsGovernance({ isDeveloper }: { isDeveloper: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Top-level sub-tabs & filters
  const [activeView, setActiveView] = useState<"tenants" | "devices">("tenants");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "expired">("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [expandedTenantId, setExpandedTenantId] = useState<number | null>(null);

  // Cross-tenant devices filter
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<"all" | "authorized" | "pending_approval" | "blocked" | "revoked">("all");

  // Create Tenant Form state
  const [tCompanyName, setTCompanyName] = useState("");
  const [tPackage, setTPackage] = useState("enterprise");
  const [tStartDate, setTStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tExpiresAt, setTExpiresAt] = useState("2027-12-31");
  const [tMaxUsers, setTMaxUsers] = useState("50");
  const [tMaxDevices, setTMaxDevices] = useState("10");
  const [tOfflineHours, setTOfflineHours] = useState("168");
  const [tGraceDays, setTGraceDays] = useState("0");
  const [tRetentionDays, setTRetentionDays] = useState("30");
  const [tAllowLocal, setTAllowLocal] = useState(false);
  const [tAdminUser, setTAdminUser] = useState("");
  const [tAdminName, setTAdminName] = useState("");
  const [tAdminPass, setTAdminPass] = useState("");
  const [tNotes, setTNotes] = useState("");
  const [createdTenantCreds, setCreatedTenantCreds] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected Tenant Governance & Monitoring Modal state
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [modalTab, setModalTab] = useState<"license" | "users" | "devices" | "monitor">("license");

  // Modal Editable Tenant Fields
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editPackage, setEditPackage] = useState("enterprise");
  const [editSubStatus, setEditSubStatus] = useState("active");
  const [editStartDate, setEditStartDate] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editMaxUsers, setEditMaxUsers] = useState("25");
  const [editMaxDevices, setEditMaxDevices] = useState("5");
  const [editOfflineHours, setEditOfflineHours] = useState("72");
  const [editGraceDays, setEditGraceDays] = useState("0");
  const [editRetentionDays, setEditRetentionDays] = useState("30");
  const [editAllowLocal, setEditAllowLocal] = useState(true);
  const [editNotes, setEditNotes] = useState("");

  // Modal User Management & Password Reset state
  const [newUUsername, setNewUUsername] = useState("");
  const [newUName, setNewUName] = useState("");
  const [newURole, setNewURole] = useState("employee");
  const [newUPass, setNewUPass] = useState("");
  const [bypassUserQuota, setBypassUserQuota] = useState(false);
  const [resetTargetUsername, setResetTargetUsername] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [confirmDeleteCode, setConfirmDeleteCode] = useState("");

  const {
    data: tenants = [],
    isFetching: tenantsFetching,
    refetch: refetchTenants,
  } = useQuery<any[]>({
    queryKey: ["developer-tenants"],
    queryFn: () => apiRequest("/api/developer/tenants"),
    enabled: isDeveloper,
    refetchInterval: 15000,
  });

  const {
    data: allInstallations = [],
    isFetching: devicesFetching,
    refetch: refetchInstallations,
  } = useQuery<any[]>({
    queryKey: ["developer-installations"],
    queryFn: () => apiRequest("/api/developer/installations"),
    enabled: isDeveloper && activeView === "devices",
  });

  const {
    data: tenantDetails,
    isLoading: detailsLoading,
    refetch: refetchDetails,
  } = useQuery<any>({
    queryKey: ["developer-tenant-details", selectedTenantId],
    queryFn: () => apiRequest(`/api/developer/tenants/${selectedTenantId}/details`),
    enabled: isDeveloper && selectedTenantId !== null,
  });

  const openGovernanceModal = (t: any, initialTab: "license" | "users" | "devices" | "monitor" = "license") => {
    setSelectedTenantId(t.id);
    setModalTab(initialTab);
    setEditCompanyName(t.company_name || "");
    setEditPackage(t.package_name || "enterprise");
    setEditSubStatus(t.subscription_status || "active");
    setEditStartDate(t.license_start_date || "");
    setEditExpiresAt(t.license_expires_at || "");
    setEditMaxUsers(String(t.max_users ?? 25));
    setEditMaxDevices(String(t.max_devices ?? 5));
    setEditOfflineHours(String(t.offline_grace_hours ?? 72));
    setEditGraceDays(String(t.grace_days ?? 0));
    setEditRetentionDays(String(t.retention_days_after_expiry ?? 30));
    setEditAllowLocal(Boolean(t.allow_local_desktop));
    setEditNotes(t.notes || "");
    setResetTargetUsername(null);
    setResetPasswordValue("");
    setConfirmDeleteCode("");
  };

  const invalidateAllTenantData = () => {
    qc.invalidateQueries({ queryKey: ["developer-tenants"] });
    qc.invalidateQueries({ queryKey: ["developer-installations"] });
    qc.invalidateQueries({ queryKey: ["licenses"] });
    qc.invalidateQueries({ queryKey: ["license-status"] });
    if (selectedTenantId !== null) {
      qc.invalidateQueries({ queryKey: ["developer-tenant-details", selectedTenantId] });
    }
  };

  const createTenantMut = useMutation({
    mutationFn: () =>
      apiRequest("/api/developer/tenants", {
        method: "POST",
        body: JSON.stringify({
          company_name: tCompanyName.trim(),
          package_name: tPackage,
          license_start_date: tStartDate,
          license_expires_at: tExpiresAt,
          max_users: Number(tMaxUsers) || 25,
          max_devices: Number(tMaxDevices) || 5,
          allow_local_desktop: tAllowLocal,
          offline_grace_hours: Number(tOfflineHours) || 72,
          grace_days: Math.max(0, Number(tGraceDays) || 0),
          retention_days_after_expiry: Math.max(1, Number(tRetentionDays) || 30),
          admin_username: tAdminUser.trim(),
          admin_name: tAdminName.trim() || undefined,
          admin_password: tAdminPass,
          notes: tNotes.trim(),
        }),
      }),
    onSuccess: (res) => {
      invalidateAllTenantData();
      setCreatedTenantCreds({
        companyName: tCompanyName.trim(),
        tenantCode: res.tenant?.tenant_code,
        licenseKey: res.tenant?.license_key,
        username: tAdminUser.trim(),
        password: tAdminPass,
        expiresAt: tExpiresAt,
        packageName: tPackage,
      });
      setTCompanyName("");
      setTAdminUser("");
      setTAdminName("");
      setTAdminPass("");
      setTNotes("");
      toast({ title: "تم إنشاء حساب المؤسسة وتجهيز قاعدة البيانات المعزولة" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إنشاء المؤسسة", description: e.message }),
  });

  const updateTenantMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      apiRequest(`/api/developer/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      invalidateAllTenantData();
      if (res?.tenant && selectedTenantId === res.tenant.id) {
        setEditSubStatus(res.tenant.subscription_status);
        setEditAllowLocal(Boolean(res.tenant.allow_local_desktop));
        setEditExpiresAt(res.tenant.license_expires_at);
      }
      toast({ title: "تم حفظ تحديثات وحوكمة المؤسسة" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التحديث", description: e.message }),
  });

  const regenerateKeyMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/developer/tenants/${id}/regenerate-key`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      invalidateAllTenantData();
      toast({ title: "تم توليد مفتاح ترخيص جديد للمؤسسة" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "تعذر توليد المفتاح", description: e.message }),
  });

  const addTenantUserMut = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/developer/tenants/${id}/users`, {
        method: "POST",
        body: JSON.stringify({
          username: newUUsername.trim(),
          name: newUName.trim() || newUUsername.trim(),
          role: newURole,
          password: newUPass,
          bypass_quota: bypassUserQuota,
        }),
      }),
    onSuccess: () => {
      invalidateAllTenantData();
      setNewUUsername("");
      setNewUName("");
      setNewUPass("");
      toast({ title: "تم إضافة المستخدم للمؤسسة بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة المستخدم", description: e.message }),
  });

  const updateTenantUserMut = useMutation({
    mutationFn: ({ tenantId, userId, body }: { tenantId: number; userId: number; body: any }) =>
      apiRequest(`/api/developer/tenants/${tenantId}/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      invalidateAllTenantData();
      setResetTargetUsername(null);
      setResetPasswordValue("");
      toast({ title: "تم تحديث حالة / صلاحية المستخدم" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تحديث المستخدم", description: e.message }),
  });

  const resetPasswordMut = useMutation({
    mutationFn: ({ tenantId, username, new_password }: { tenantId: number; username: string; new_password: string }) =>
      apiRequest(`/api/developer/tenants/${tenantId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ username, new_password }),
      }),
    onSuccess: (res) => {
      invalidateAllTenantData();
      setResetTargetUsername(null);
      setResetPasswordValue("");
      toast({ title: `تم تحديث كلمة مرور المستخدم (${res.username})` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تغيير كلمة المرور", description: e.message }),
  });

  const deleteTenantMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/developer/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedTenantId(null);
      setConfirmDeleteCode("");
      invalidateAllTenantData();
      toast({ title: "تم حذف المؤسسة وقاعدة بياناتها نهائياً" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف المؤسسة", description: e.message }),
  });

  const updateInstStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "authorized" | "blocked" | "revoked" }) =>
      apiRequest(`/api/developer/installations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      invalidateAllTenantData();
      toast({ title: "تم تحديث حالة الجهاز المرتبط" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تحديث الجهاز", description: e.message }),
  });

  const deleteInstMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/developer/installations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateAllTenantData();
      toast({ title: "تم فك ارتباط الجهاز من المؤسسة" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل فك الارتباط", description: e.message }),
  });

  // KPI Aggregation
  const kpi = useMemo(() => {
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(
      (t) => t.subscription_status === "active" && t.effective_policy?.allowed !== false
    ).length;
    const suspendedOrExpired = totalTenants - activeTenants;
    const totalUsers = tenants.reduce((acc, t) => acc + Number(t.users_count || 0), 0);
    const totalMaxUsers = tenants.reduce((acc, t) => acc + Number(t.max_users || 0), 0);
    const authorizedDevices = tenants.reduce((acc, t) => acc + Number(t.active_devices_count || 0), 0);
    const blockedDevices = tenants.reduce((acc, t) => acc + Number(t.blocked_devices_count || 0), 0);
    const alertsCount = tenants.filter((t) => {
      const conflicts = Number(t.stats?.pending_conflicts || 0);
      const expiringSoon = Boolean(t.effective_policy?.isWarning);
      const blocked = t.effective_policy?.allowed === false;
      return conflicts > 0 || expiringSoon || blocked;
    }).length;
    return {
      totalTenants,
      activeTenants,
      suspendedOrExpired,
      totalUsers,
      totalMaxUsers,
      authorizedDevices,
      blockedDevices,
      alertsCount,
    };
  }, [tenants]);

  // Filtered Tenants
  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter !== "all" && (t.subscription_status || "active") !== statusFilter) return false;
      if (packageFilter !== "all" && (t.package_name || "enterprise") !== packageFilter) return false;
      if (!q) return true;
      return (
        String(t.company_name || "").toLowerCase().includes(q) ||
        String(t.tenant_code || "").toLowerCase().includes(q) ||
        String(t.admin_username || "").toLowerCase().includes(q) ||
        String(t.license_key || "").toLowerCase().includes(q)
      );
    });
  }, [tenants, searchQuery, statusFilter, packageFilter]);

  // Filtered Cross-Tenant Devices
  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    return allInstallations.filter((inst) => {
      if (deviceStatusFilter !== "all" && inst.status !== deviceStatusFilter) return false;
      if (!q) return true;
      return (
        String(inst.company_name || "").toLowerCase().includes(q) ||
        String(inst.tenant_code || "").toLowerCase().includes(q) ||
        String(inst.device_name || "").toLowerCase().includes(q) ||
        String(inst.device_id || "").toLowerCase().includes(q) ||
        String(inst.installation_id || "").toLowerCase().includes(q) ||
        String(inst.username || "").toLowerCase().includes(q)
      );
    });
  }, [allInstallations, deviceSearch, deviceStatusFilter]);

  const handlePackageSelect = (pkg: string) => {
    setTPackage(pkg);
    const preset = PACKAGE_PRESETS[pkg];
    if (preset) {
      setTMaxUsers(preset.maxUsers);
      setTMaxDevices(preset.maxDevices);
      setTOfflineHours(preset.offlineHours);
    }
  };

  const handleCopy = (key: string, value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(key);
    toast({ title: `تم نسخ ${label}` });
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
  };

  const activeModalTenant = tenantDetails?.tenant || tenants.find((t) => t.id === selectedTenantId);

  return (
    <>
      <Card className="border border-slate-200 bg-white rounded-2xl shadow-none overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-black text-slate-900">
                  مركز حوكمة المؤسسات السحابية والأجهزة المحلية (Hybrid Cloud + Local Tenants)
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 mt-0.5">
                  إنشاء حسابات مكاتب السياحة والسفر، التحكم في الباقات وتواريخ الانتهاء والحدود، إيقاف أو تعديل الحسابات، ومراقبة التثبيتات المحلية والأداء التشغيلي.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveView("tenants")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    activeView === "tenants"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  المؤسسات والمكاتب ({tenants.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("devices")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    activeView === "devices"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  الأجهزة المحلية المتصلة ({kpi.authorizedDevices + kpi.blockedDevices})
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchTenants();
                  if (activeView === "devices") refetchInstallations();
                }}
                className="h-8 px-2.5 text-xs font-bold whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ml-1 ${tenantsFetching || devicesFetching ? "animate-spin" : ""}`} />
                تحديث
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-5">
          {/* ── KPI MONITORING SUMMARY STRIP ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>حسابات المؤسسات</span>
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl font-black font-mono tabular-nums text-slate-900">{kpi.totalTenants}</span>
                <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                  {kpi.activeTenants} نشط
                </span>
                {kpi.suspendedOrExpired > 0 && (
                  <span className="text-[11px] font-bold text-red-700 whitespace-nowrap">
                    · {kpi.suspendedOrExpired} موقوف/منتهي
                  </span>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>المستخدمون الفعليون</span>
                <Users className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl font-black font-mono tabular-nums text-slate-900">{kpi.totalUsers}</span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  من حد {kpi.totalMaxUsers}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>الأجهزة المحلية المرتبطة</span>
                <Laptop className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl font-black font-mono tabular-nums text-slate-900">
                  {kpi.authorizedDevices}
                </span>
                <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">مفوّض</span>
                {kpi.blockedDevices > 0 && (
                  <span className="text-[11px] font-bold text-red-700 whitespace-nowrap">
                    · {kpi.blockedDevices} محظور
                  </span>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>تنبيهات الحوكمة والمزامنة</span>
                <Activity className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={`text-xl font-black font-mono tabular-nums ${
                    kpi.alertsCount > 0 ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {kpi.alertsCount}
                </span>
                <span className="text-[11px] font-bold text-slate-600">
                  {kpi.alertsCount > 0 ? "مؤسسات تحتاج مراجعة" : "كافة المؤسسات مستقرة"}
                </span>
              </div>
            </div>
          </div>

          {activeView === "tenants" ? (
            <>
              {tenants.some((t) => !t.allow_local_desktop && Number(t.pending_approval_devices_count || 0) > 0) && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>توجد طلبات دخول محلية بانتظار التفعيل من الإدارة/المطور:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tenants
                      .filter((t) => !t.allow_local_desktop && Number(t.pending_approval_devices_count || 0) > 0)
                      .map((t) => (
                        <div
                          key={`pending-local-${t.id}`}
                          className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs"
                        >
                          <span className="font-black text-slate-900">{t.company_name}</span>
                          <span className="font-mono text-[11px] text-slate-500">({t.tenant_code})</span>
                          <span className="text-[11px] font-bold text-amber-700">
                            · {t.pending_approval_devices_count} طلب
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={updateTenantMut.isPending}
                            onClick={() =>
                              updateTenantMut.mutate(
                                { id: t.id, body: { allow_local_desktop: true } },
                                {
                                  onSuccess: () =>
                                    toast({
                                      title: "تم تفعيل الدخول المحلي بنجاح",
                                      description: `يمكن للعميل (${t.company_name}) الدخول الآن بالنسخة المحلية ومزامنة كامل البيانات تلقائياً.`
                                    })
                                }
                              )
                            }
                            className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <Laptop className="w-3 h-3" />
                            <span>تفعيل الدخول المحلي الآن</span>
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ── TOOLBAR: SEARCH + FILTERS + CREATE TRIGGER ── */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[210px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بحث بالاسم، الكود، مفتاح الترخيص، أو اسم المدير..."
                      className="h-9 pr-8 text-xs bg-white"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="active">النشطة فقط</option>
                    <option value="suspended">المعلقة / الموقوفة</option>
                    <option value="expired">المنتهية الصلاحية</option>
                  </select>
                  <select
                    value={packageFilter}
                    onChange={(e) => setPackageFilter(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                  >
                    <option value="all">كل الباقات</option>
                    <option value="starter">Starter الأساسية</option>
                    <option value="pro">Professional المتقدمة</option>
                    <option value="enterprise">Enterprise الشاملة</option>
                    <option value="vip">VIP المؤسسات الكبرى</option>
                  </select>
                </div>

                <Button
                  type="button"
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-9 px-4 gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showCreateForm ? "إغلاق نموذج الإنشاء" : "إنشاء حساب مكتب / مؤسسة جديدة"}</span>
                </Button>
              </div>

              {/* ── COLLAPSIBLE CREATE TENANT FORM ── */}
              {showCreateForm && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        تجهيز حساب مؤسسة / مكتب سياحة وسفر جديد (مع قاعدة بيانات معزولة)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        اختر باقة جاهزة أو خصّص عدد المستخدمين والأجهزة المحلية وساعات العمل بدون إنترنت.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {Object.entries(PACKAGE_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handlePackageSelect(key)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap shrink-0 ${
                            tPackage === key
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        اسم المؤسسة / مكتب السفر *
                      </label>
                      <Input
                        value={tCompanyName}
                        onChange={(e) => setTCompanyName(e.target.value)}
                        placeholder="مثال: شركة النخبة للسفريات"
                        className="h-9 text-xs bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">الباقة والاشتراك</label>
                      <select
                        value={tPackage}
                        onChange={(e) => handlePackageSelect(e.target.value)}
                        className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold"
                      >
                        <option value="starter">Starter الأساسية</option>
                        <option value="pro">Professional المتقدمة</option>
                        <option value="enterprise">Enterprise الشاملة</option>
                        <option value="vip">VIP المؤسسات الكبرى</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ بداية الاشتراك</label>
                      <Input
                        type="date"
                        value={tStartDate}
                        onChange={(e) => setTStartDate(e.target.value)}
                        className="h-9 text-xs bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ انتهاء الاشتراك</label>
                      <Input
                        type="date"
                        value={tExpiresAt}
                        onChange={(e) => setTExpiresAt(e.target.value)}
                        className="h-9 text-xs bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">عدد المستخدمين المسموح</label>
                      <Input
                        type="number"
                        min="1"
                        value={tMaxUsers}
                        onChange={(e) => setTMaxUsers(e.target.value)}
                        className="h-9 text-xs bg-white font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        عدد الأجهزة المحلية المسموحة
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={tMaxDevices}
                        onChange={(e) => setTMaxDevices(e.target.value)}
                        className="h-9 text-xs bg-white font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        اسم مستخدم المدير *
                      </label>
                      <Input
                        value={tAdminUser}
                        onChange={(e) => setTAdminUser(e.target.value)}
                        placeholder="مثال: elite_admin"
                        className="h-9 text-xs bg-white font-mono dir-ltr text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور الأولية *</label>
                      <Input
                        type="text"
                        value={tAdminPass}
                        onChange={(e) => setTAdminPass(e.target.value)}
                        placeholder="كلمة مرور للعميل"
                        className="h-9 text-xs bg-white font-mono dir-ltr text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم مدير المكتب (اختياري)</label>
                      <Input
                        value={tAdminName}
                        onChange={(e) => setTAdminName(e.target.value)}
                        placeholder="مدير المكتب"
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">ساعات العمل أوفلاين</label>
                      <Input
                        type="number"
                        min="1"
                        value={tOfflineHours}
                        onChange={(e) => setTOfflineHours(e.target.value)}
                        className="h-9 text-xs bg-white font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">سماح دخول بعد التوقف (0 = منع فوري)</label>
                      <Input
                        type="number"
                        min="0"
                        value={tGraceDays}
                        onChange={(e) => setTGraceDays(e.target.value)}
                        className="h-9 text-xs bg-white font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">حفظ البيانات بعد التوقف (يوم)</label>
                      <Input
                        type="number"
                        min="1"
                        value={tRetentionDays}
                        onChange={(e) => setTRetentionDays(e.target.value)}
                        className="h-9 text-xs bg-white font-mono tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات العقد / المطور</label>
                      <Input
                        value={tNotes}
                        onChange={(e) => setTNotes(e.target.value)}
                        placeholder="بيانات التعاقد أو رقم التواصل..."
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tAllowLocal}
                        onChange={(e) => setTAllowLocal(e.target.checked)}
                      />
                      <span>السماح بالدخول والمزامنة من النسخة المحلية فوراً (أو اتركه غير محدد لتفعيله لاحقاً عند طلب العميل)</span>
                    </label>

                    <Button
                      type="button"
                      disabled={!tCompanyName.trim() || !tAdminUser.trim() || !tAdminPass.trim() || createTenantMut.isPending}
                      onClick={() => createTenantMut.mutate()}
                      className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-9 px-5 gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{createTenantMut.isPending ? "جاري الإنشاء..." : "اعتماد وإنشاء المؤسسة"}</span>
                    </Button>
                  </div>
                </div>
              )}

              {createdTenantCreds && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-black text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>
                        تم تجهيز حساب: {createdTenantCreds.companyName} ({createdTenantCreds.tenantCode})
                      </span>
                    </div>
                    <div className="font-mono text-emerald-900 dir-ltr text-right">
                      User: {createdTenantCreds.username} · Pass: {createdTenantCreds.password} · Key:{" "}
                      {createdTenantCreds.licenseKey} · Exp: {createdTenantCreds.expiresAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleCopy(
                          "created-creds",
                          `بيانات حساب OmniFly Pro:\nالمؤسسة: ${createdTenantCreds.companyName}\nكود المؤسسة: ${createdTenantCreds.tenantCode}\nمفتاح الترخيص: ${createdTenantCreds.licenseKey}\nالباقة: ${createdTenantCreds.packageName}\nاسم المستخدم: ${createdTenantCreds.username}\nكلمة المرور: ${createdTenantCreds.password}\nانتهاء الاشتراك: ${createdTenantCreds.expiresAt}`,
                          "بيانات التسليم للعميل"
                        )
                      }
                      className="h-8 text-xs font-bold bg-white border-emerald-400 whitespace-nowrap"
                    >
                      {copiedId === "created-creds" ? <Check className="w-3.5 h-3.5 ml-1" /> : <Copy className="w-3.5 h-3.5 ml-1" />}
                      نسخ بيانات التسليم
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCreatedTenantCreds(null)}
                      className="h-8 text-xs text-slate-600"
                    >
                      إخفاء
                    </Button>
                  </div>
                </div>
              )}

              {/* ── TENANTS GOVERNANCE DIRECTORY TABLE ── */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="p-3 text-right font-bold">المؤسسة / الكود</th>
                      <th className="p-3 text-center font-bold">الباقة</th>
                      <th className="p-3 text-center font-bold">المستخدمون</th>
                      <th className="p-3 text-center font-bold">الأجهزة المحلية</th>
                      <th className="p-3 text-center font-bold">النشاط التشغيلي</th>
                      <th className="p-3 text-center font-bold">تاريخ الانتهاء</th>
                      <th className="p-3 text-center font-bold">النسخة المحلية</th>
                      <th className="p-3 text-center font-bold">الحالة</th>
                      <th className="p-3 text-center font-bold">الحوكمة والتحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500">
                          لا توجد مؤسسات مطابقة لخيارات البحث أو التصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t) => {
                        const isExp = expandedTenantId === t.id;
                        const statusMeta = getStatusMeta(t.subscription_status);
                        const remDays = t.effective_policy?.remainingDays;
                        const bookings = Number(t.stats?.travel_bookings || 0);
                        const visas = Number(t.stats?.travel_visas || 0);
                        const orders = Number(t.stats?.orders || 0);
                        const conflicts = Number(t.stats?.pending_conflicts || 0);

                        return (
                          <React.Fragment key={t.id}>
                            <tr className="hover:bg-slate-50/70">
                              <td className="p-3">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{t.company_name}</span>
                                  {t.id === 1 && (
                                    <span className="text-[10px] font-bold text-blue-700 border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded">
                                      الرئيسية
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono dir-ltr text-right mt-0.5">
                                  {t.tenant_code} · Admin: {t.admin_username || "—"}
                                </div>
                              </td>

                              <td className="p-3 text-center">
                                <div className="font-mono font-bold text-slate-800 uppercase">{t.package_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                                  أوفلاين: {t.offline_grace_hours || 72}س
                                </div>
                              </td>

                              <td className="p-3 text-center font-mono tabular-nums text-slate-800">
                                <span className={t.users_count >= t.max_users ? "text-amber-700 font-bold" : ""}>
                                  {t.users_count}
                                </span>
                                {" / "}
                                {t.max_users}
                              </td>

                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setExpandedTenantId(isExp ? null : t.id)}
                                  className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 font-mono text-[11px] font-bold tabular-nums whitespace-nowrap"
                                >
                                  {t.active_devices_count} / {t.max_devices} ({isExp ? "إخفاء" : "عرض"})
                                </button>
                              </td>

                              <td className="p-3 text-center">
                                <div className="font-mono tabular-nums text-[11px] text-slate-700">
                                  حجوزات {bookings} · تأشيرات {visas} · فواتير {orders}
                                </div>
                                {conflicts > 0 && (
                                  <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                                    {conflicts} تعارض مزامنة معلق
                                  </div>
                                )}
                              </td>

                              <td className="p-3 text-center">
                                <div className="font-mono tabular-nums font-bold text-slate-800">
                                  {t.license_expires_at}
                                </div>
                                {t.license_start_date && (
                                  <div className="text-[10px] font-mono tabular-nums text-slate-500">
                                    بداية: {t.license_start_date}
                                  </div>
                                )}
                                {typeof remDays === "number" && (
                                  <div
                                    className={`text-[10px] font-mono tabular-nums ${
                                      remDays < 0
                                        ? "text-red-700 font-bold"
                                        : remDays <= 15
                                        ? "text-amber-700 font-bold"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {remDays < 0 ? `متوقف منذ ${Math.abs(remDays)} يوم` : `متبقي ${remDays} يوم`}
                                  </div>
                                )}
                                {t.effective_policy?.isRetentionWarning && (
                                  <div className="text-[10px] font-bold text-orange-700 mt-0.5">
                                    البيانات محفوظة · مهلة الحذف: {t.effective_policy?.retentionDaysLeft ?? 0} يوم
                                  </div>
                                )}
                              </td>

                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {t.allow_local_desktop ? (
                                    <button
                                      type="button"
                                      disabled={updateTenantMut.isPending}
                                      onClick={() =>
                                        updateTenantMut.mutate(
                                          {
                                            id: t.id,
                                            body: { allow_local_desktop: false },
                                          },
                                          {
                                            onSuccess: () =>
                                              toast({ title: `تم إيقاف الدخول المحلي لحساب ${t.company_name}` }),
                                          }
                                        )
                                      }
                                      title="انقر لإيقاف الدخول من النسخة المحلية"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>مفعّلة للمحلي</span>
                                    </button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={updateTenantMut.isPending}
                                      onClick={() =>
                                        updateTenantMut.mutate(
                                          {
                                            id: t.id,
                                            body: { allow_local_desktop: true },
                                          },
                                          {
                                            onSuccess: () =>
                                              toast({
                                                title: "تم تفعيل الدخول المحلي بنجاح",
                                                description: `يمكن للعميل (${t.company_name}) الدخول الآن بالنسخة المحلية ومزامنة كامل البيانات تلقائياً.`,
                                              }),
                                          }
                                        )
                                      }
                                      className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap gap-1"
                                    >
                                      <Laptop className="w-3 h-3" />
                                      <span>تفعيل الدخول المحلي</span>
                                    </Button>
                                  )}
                                  {Number(t.pending_approval_devices_count || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold whitespace-nowrap">
                                      <AlertTriangle className="w-3 h-3" />
                                      طلب دخول محلي ({t.pending_approval_devices_count})
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${statusMeta.cls}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openGovernanceModal(t, "license")}
                                    className="h-7 px-2.5 text-[11px] font-bold whitespace-nowrap shrink-0"
                                  >
                                    <Settings2 className="w-3.5 h-3.5 ml-1" />
                                    إدارة ومراقبة
                                  </Button>

                                  {(t.subscription_status === "expired" ||
                                    t.effective_policy?.code === "license_expired" ||
                                    t.subscription_status === "suspended") && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      title="تجديد الاشتراك +سنة واستعادة الدخول مع الحفاظ الكامل على البيانات"
                                      onClick={() =>
                                        updateTenantMut.mutate({
                                          id: t.id,
                                          body: {
                                            subscription_status: "active",
                                            license_status: "active",
                                            license_expires_at: addMonthsToDate(
                                              new Date().toISOString().split("T")[0],
                                              12
                                            ),
                                          },
                                        })
                                      }
                                      className="h-7 px-2 text-[11px] font-bold text-blue-700 border-blue-200 hover:bg-blue-50 whitespace-nowrap shrink-0"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 ml-1" />
                                      تجديد سنة
                                    </Button>
                                  )}

                                  {t.subscription_status === "suspended" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      title="تفعيل الحساب"
                                      onClick={() =>
                                        updateTenantMut.mutate({
                                          id: t.id,
                                          body: { subscription_status: "active", license_status: "active" },
                                        })
                                      }
                                      className="h-7 px-2 text-[11px] font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50 whitespace-nowrap shrink-0"
                                    >
                                      <PlayCircle className="w-3.5 h-3.5 ml-1" />
                                      تفعيل
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      title="إيقاف وتعليق المؤسسة فوراً"
                                      onClick={() =>
                                        updateTenantMut.mutate({
                                          id: t.id,
                                          body: { subscription_status: "suspended", license_status: "suspended" },
                                        })
                                      }
                                      className="h-7 px-2 text-[11px] font-bold text-red-700 border-red-200 hover:bg-red-50 whitespace-nowrap shrink-0"
                                    >
                                      <PauseCircle className="w-3.5 h-3.5 ml-1" />
                                      إيقاف
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {isExp && (
                              <tr className="bg-slate-50/90">
                                <td colSpan={9} className="p-3">
                                  {!t.installations || t.installations.length === 0 ? (
                                    <div className="text-center text-xs text-slate-500 py-3">
                                      لا توجد أجهزة محلية مسجلة لهذه المؤسسة حتى الآن.
                                    </div>
                                  ) : (
                                    <div className="border border-slate-200 rounded-lg bg-white overflow-x-auto">
                                      <table className="w-full text-[11px]">
                                        <thead className="bg-slate-100 border-b text-slate-700">
                                          <tr>
                                            <th className="p-2 text-right">Installation ID</th>
                                            <th className="p-2 text-right">الجهاز / النظام</th>
                                            <th className="p-2 text-center">المستخدم</th>
                                            <th className="p-2 text-center">App / DB</th>
                                            <th className="p-2 text-center">آخر مزامنة</th>
                                            <th className="p-2 text-center">الحالة</th>
                                            <th className="p-2 text-center">الإجراء</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {t.installations.map((inst: any) => {
                                            const im = getInstStatusMeta(inst.status);
                                            return (
                                              <tr key={inst.id}>
                                                <td className="p-2 font-mono dir-ltr text-right">
                                                  {inst.installation_id}
                                                </td>
                                                <td className="p-2">
                                                  <div className="font-bold">{inst.device_name || inst.os_info}</div>
                                                  <div className="font-mono text-[10px] text-slate-500 dir-ltr text-right">
                                                    {inst.device_id}
                                                  </div>
                                                </td>
                                                <td className="p-2 text-center font-mono">{inst.username || "—"}</td>
                                                <td className="p-2 text-center font-mono tabular-nums">
                                                  v{inst.app_version} / DB {inst.db_version}
                                                </td>
                                                <td className="p-2 text-center font-mono dir-ltr">
                                                  {inst.last_successful_sync || "—"}
                                                </td>
                                                <td className="p-2 text-center">
                                                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${im.cls}`}>
                                                    {im.label} · {inst.sync_status}
                                                  </span>
                                                </td>
                                                <td className="p-2 text-center space-x-1 space-x-reverse">
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                      updateInstStatusMut.mutate({
                                                        id: inst.id,
                                                        status: inst.status === "authorized" ? "blocked" : "authorized",
                                                      })
                                                    }
                                                    className="h-6 px-2 text-[10px] font-bold"
                                                  >
                                                    {inst.status === "authorized" ? "حظر الجهاز" : "إعادة تفويض"}
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => deleteInstMut.mutate(inst.id)}
                                                    className="h-6 px-2 text-[10px] font-bold text-red-700 border-red-200"
                                                  >
                                                    فك الارتباط
                                                  </Button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* ── CROSS-TENANT LOCAL DEVICES MONITORING VIEW ── */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    placeholder="بحث ببصمة الجهاز، Installation ID، اسم المؤسسة، أو المستخدم..."
                    className="h-9 pr-8 text-xs bg-white"
                  />
                </div>
                <select
                  value={deviceStatusFilter}
                  onChange={(e) => setDeviceStatusFilter(e.target.value as any)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                >
                  <option value="all">كل حالات الأجهزة</option>
                  <option value="authorized">المفوّضة فقط</option>
                  <option value="pending_approval">بانتظار التفعيل</option>
                  <option value="blocked">المحظورة</option>
                  <option value="revoked">الملغاة</option>
                </select>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="p-3 text-right font-bold">المؤسسة</th>
                      <th className="p-3 text-right font-bold">الجهاز والنظام</th>
                      <th className="p-3 text-right font-bold">Installation & Device ID</th>
                      <th className="p-3 text-center font-bold">المستخدم</th>
                      <th className="p-3 text-center font-bold">المزامنة (↓ / ↑)</th>
                      <th className="p-3 text-center font-bold">آخر اتصال / مزامنة</th>
                      <th className="p-3 text-center font-bold">الحالة</th>
                      <th className="p-3 text-center font-bold">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          لا توجد أجهزة محلية مسجلة تطابق معايير البحث.
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((inst) => {
                        const im = getInstStatusMeta(inst.status);
                        return (
                          <tr key={inst.id} className="hover:bg-slate-50/70">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{inst.company_name}</div>
                              <div className="text-[11px] font-mono text-slate-500">{inst.tenant_code}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{inst.device_name || "جهاز محلي"}</div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {inst.os_info || "Desktop"} · v{inst.app_version}
                              </div>
                            </td>
                            <td className="p-3 font-mono dir-ltr text-right">
                              <div className="text-[11px] text-slate-800">{inst.installation_id}</div>
                              <div className="text-[10px] text-slate-500">{inst.device_id}</div>
                            </td>
                            <td className="p-3 text-center font-mono text-slate-700">{inst.username || "—"}</td>
                            <td className="p-3 text-center font-mono tabular-nums text-slate-700">
                              ↓{inst.last_downloaded_seq || 0} / ↑{inst.last_uploaded_seq || 0}
                            </td>
                            <td className="p-3 text-center font-mono dir-ltr text-[11px] text-slate-600">
                              <div>{inst.last_successful_sync || "لم يزامن"}</div>
                              <div className="text-[10px] text-slate-400">{inst.last_seen_at || ""}</div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${im.cls}`}>
                                {im.label} · {inst.sync_status}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {inst.status === "authorized" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInstStatusMut.mutate({ id: inst.id, status: "blocked" })}
                                    className="h-7 px-2 text-[11px] font-bold text-red-700 border-red-200 whitespace-nowrap"
                                  >
                                    <Lock className="w-3 h-3 ml-1" />
                                    حظر
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInstStatusMut.mutate({ id: inst.id, status: "authorized" })}
                                    className="h-7 px-2 text-[11px] font-bold text-emerald-700 border-emerald-200 whitespace-nowrap"
                                  >
                                    <Unlock className="w-3 h-3 ml-1" />
                                    تفويض
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteInstMut.mutate(inst.id)}
                                  className="h-7 px-2 text-[11px] font-bold text-slate-700 whitespace-nowrap"
                                >
                                  فك الربط
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── COMPREHENSIVE TENANT GOVERNANCE & MONITORING MODAL ── */}
      <Dialog
        open={selectedTenantId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTenantId(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto dir-rtl text-right p-0">
          {activeModalTenant && (
            <>
              <DialogHeader className="p-5 bg-slate-50 border-b border-slate-200 text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-6">
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                      <Building2 className="w-5 h-5 text-blue-700" />
                      <span>{activeModalTenant.company_name}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        {activeModalTenant.tenant_code}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                      <span>الباقة: {activeModalTenant.package_name}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        حجم قاعدة البيانات: {formatBytes(tenantDetails?.db_size_bytes ?? activeModalTenant.db_size_bytes)}
                      </span>
                      <span>·</span>
                      <span className="font-mono">ينتهي: {activeModalTenant.license_expires_at}</span>
                    </DialogDescription>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!activeModalTenant.allow_local_desktop ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={updateTenantMut.isPending}
                        onClick={() =>
                          updateTenantMut.mutate(
                            {
                              id: activeModalTenant.id,
                              body: { allow_local_desktop: true },
                            },
                            {
                              onSuccess: () =>
                                toast({
                                  title: "تم تفعيل الدخول المحلي بنجاح",
                                  description: "يمكن للعميل الآن الدخول من النسخة المحلية بنفس بيانات السحابة ومزامنة كافة البيانات.",
                                }),
                            }
                          )
                        }
                        className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap gap-1"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                        <span>تفعيل الدخول المحلي</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updateTenantMut.isPending}
                        onClick={() =>
                          updateTenantMut.mutate({
                            id: activeModalTenant.id,
                            body: { allow_local_desktop: false },
                          })
                        }
                        className="h-8 px-3 text-xs font-bold text-amber-800 border-amber-300 hover:bg-amber-50 whitespace-nowrap gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>تعطيل الدخول المحلي</span>
                      </Button>
                    )}

                    {activeModalTenant.subscription_status === "suspended" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          updateTenantMut.mutate({
                            id: activeModalTenant.id,
                            body: { subscription_status: "active", license_status: "active" },
                          })
                        }
                        className="h-8 px-3 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white whitespace-nowrap"
                      >
                        <PlayCircle className="w-3.5 h-3.5 ml-1" />
                        إعادة تفعيل المؤسسة
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateTenantMut.mutate({
                            id: activeModalTenant.id,
                            body: { subscription_status: "suspended", license_status: "suspended" },
                          })
                        }
                        className="h-8 px-3 text-xs font-bold text-red-700 border-red-200 hover:bg-red-50 whitespace-nowrap"
                      >
                        <PauseCircle className="w-3.5 h-3.5 ml-1" />
                        إيقاف المؤسسة فوراً
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inner Modal Segmented Navigation */}
                <div className="flex flex-wrap items-center gap-1.5 pt-3">
                  {[
                    { id: "license", label: "الباقة والتراخيص والحدود", icon: KeyRound },
                    { id: "users", label: "المستخدمون وكلمات المرور", icon: Users },
                    { id: "devices", label: "الأجهزة المحلية والمزامنة", icon: Laptop },
                    { id: "monitor", label: "المراقبة وسجلات التدقيق", icon: Activity },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setModalTab(tab.id as any)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 ${
                          modalTab === tab.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </DialogHeader>

              <div className="p-5 space-y-5">
                {detailsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-500">جاري تحميل بيانات المراقبة...</div>
                ) : (
                  <>
                    {/* ── TAB 1: PACKAGE, QUOTAS & LICENSE EDITING ── */}
                    {modalTab === "license" && (
                      <div className="space-y-4">
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="text-xs">
                            <div className="font-bold text-slate-700">مفتاح ترخيص المؤسسة الرقمي:</div>
                            <div className="font-mono font-black text-slate-900 dir-ltr text-right mt-0.5">
                              {activeModalTenant.license_key || "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleCopy("modal-key", activeModalTenant.license_key || "", "مفتاح الترخيص")
                              }
                              className="h-8 text-xs font-bold bg-white"
                            >
                              <Copy className="w-3.5 h-3.5 ml-1" />
                              نسخ المفتاح
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={regenerateKeyMut.isPending}
                              onClick={() => regenerateKeyMut.mutate(activeModalTenant.id)}
                              className="h-8 text-xs font-bold bg-white"
                            >
                              <RefreshCw className="w-3.5 h-3.5 ml-1" />
                              توليد مفتاح جديد
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المؤسسة</label>
                            <Input
                              value={editCompanyName}
                              onChange={(e) => setEditCompanyName(e.target.value)}
                              className="h-9 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">الباقة</label>
                            <select
                              value={editPackage}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditPackage(val);
                                const p = PACKAGE_PRESETS[val];
                                if (p) {
                                  setEditMaxUsers(p.maxUsers);
                                  setEditMaxDevices(p.maxDevices);
                                  setEditOfflineHours(p.offlineHours);
                                }
                              }}
                              className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold"
                            >
                              <option value="starter">Starter الأساسية</option>
                              <option value="pro">Professional المتقدمة</option>
                              <option value="enterprise">Enterprise الشاملة</option>
                              <option value="vip">VIP المؤسسات الكبرى</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">حالة الاشتراك</label>
                            <select
                              value={editSubStatus}
                              onChange={(e) => setEditSubStatus(e.target.value)}
                              className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold"
                            >
                              <option value="active">نشط</option>
                              <option value="suspended">معلق / موقوف</option>
                              <option value="expired">منتهي</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ البداية</label>
                            <Input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              className="h-9 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              تاريخ انتهاء الترخيص والتمديد السريع
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Input
                                type="date"
                                value={editExpiresAt}
                                onChange={(e) => setEditExpiresAt(e.target.value)}
                                className="h-9 text-xs font-mono w-40"
                              />
                              {[
                                { label: "+1 شهر", m: 1 },
                                { label: "+3 أشهر", m: 3 },
                                { label: "+6 أشهر", m: 6 },
                                { label: "+سنة", m: 12 },
                              ].map((ext) => (
                                <Button
                                  key={ext.m}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditExpiresAt(addMonthsToDate(editExpiresAt, ext.m))}
                                  className="h-9 px-2.5 text-[11px] font-bold whitespace-nowrap"
                                >
                                  {ext.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              الحد الأقصى للمستخدمين
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={editMaxUsers}
                              onChange={(e) => setEditMaxUsers(e.target.value)}
                              className="h-9 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              الحد الأقصى للأجهزة المحلية
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={editMaxDevices}
                              onChange={(e) => setEditMaxDevices(e.target.value)}
                              className="h-9 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              ساعات العمل أوفلاين المسموحة
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={editOfflineHours}
                              onChange={(e) => setEditOfflineHours(e.target.value)}
                              className="h-9 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              سماح دخول بعد الانتهاء (0 = منع فوري)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={editGraceDays}
                              onChange={(e) => setEditGraceDays(e.target.value)}
                              className="h-9 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              حفظ البيانات بعد التوقف (يوم)
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={editRetentionDays}
                              onChange={(e) => setEditRetentionDays(e.target.value)}
                              className="h-9 text-xs font-mono tabular-nums"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            ملاحظات الإدارة والتعاقد
                          </label>
                          <Input
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="ملاحظات داخلية للمطور..."
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editAllowLocal}
                              onChange={(e) => setEditAllowLocal(e.target.checked)}
                            />
                            <span>تفعيل ربط وتشغيل النسخة المحلية (Desktop Sync)</span>
                          </label>

                          <Button
                            type="button"
                            disabled={updateTenantMut.isPending}
                            onClick={() =>
                              updateTenantMut.mutate({
                                id: activeModalTenant.id,
                                body: {
                                  company_name: editCompanyName.trim(),
                                  package_name: editPackage,
                                  subscription_status: editSubStatus,
                                  license_status: editSubStatus,
                                  license_start_date: editStartDate,
                                  license_expires_at: editExpiresAt,
                                  max_users: Number(editMaxUsers) || 1,
                                  max_devices: Number(editMaxDevices) || 1,
                                  offline_grace_hours: Number(editOfflineHours) || 72,
                                  grace_days: Math.max(0, Number(editGraceDays) || 0),
                                  retention_days_after_expiry: Math.max(1, Number(editRetentionDays) || 30),
                                  allow_local_desktop: editAllowLocal,
                                  notes: editNotes,
                                },
                              })
                            }
                            className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-9 px-5 whitespace-nowrap"
                          >
                            {updateTenantMut.isPending ? "جاري الحفظ..." : "حفظ التعديلات وتطبيق السياسة"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* ── TAB 2: TENANT USERS & PASSWORD GOVERNANCE ── */}
                    {modalTab === "users" && (
                      <div className="space-y-4">
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                          <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <UserPlus className="w-4 h-4 text-blue-700" />
                            <span>إضافة مستخدم مباشر لحساب المؤسسة</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <Input
                              value={newUUsername}
                              onChange={(e) => setNewUUsername(e.target.value)}
                              placeholder="اسم المستخدم (English)"
                              className="h-8 text-xs bg-white font-mono dir-ltr text-right"
                            />
                            <Input
                              value={newUName}
                              onChange={(e) => setNewUName(e.target.value)}
                              placeholder="الاسم الكامل للموظف"
                              className="h-8 text-xs bg-white"
                            />
                            <select
                              value={newURole}
                              onChange={(e) => setNewURole(e.target.value)}
                              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold"
                            >
                              <option value="admin">مدير النظام (admin)</option>
                              <option value="general_manager">مدير عام</option>
                              <option value="accountant">محاسب</option>
                              <option value="employee">موظف حجز ومبيعات</option>
                            </select>
                            <Input
                              value={newUPass}
                              onChange={(e) => setNewUPass(e.target.value)}
                              placeholder="كلمة المرور"
                              className="h-8 text-xs bg-white font-mono dir-ltr text-right"
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={bypassUserQuota}
                                onChange={(e) => setBypassUserQuota(e.target.checked)}
                              />
                              <span>تجاوز حد الباقة مؤقتاً لصلاحية المطور</span>
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!newUUsername.trim() || !newUPass.trim() || addTenantUserMut.isPending}
                              onClick={() => addTenantUserMut.mutate(activeModalTenant.id)}
                              className="h-8 px-3 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white"
                            >
                              إضافة المستخدم
                            </Button>
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b text-slate-700">
                              <tr>
                                <th className="p-2.5 text-right font-bold">اسم المستخدم</th>
                                <th className="p-2.5 text-right font-bold">الاسم</th>
                                <th className="p-2.5 text-center font-bold">الدور</th>
                                <th className="p-2.5 text-center font-bold">الحالة</th>
                                <th className="p-2.5 text-center font-bold">كلمة المرور / التحكم</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(tenantDetails?.users || []).length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-6 text-center text-slate-500">
                                    لا يوجد مستخدمون مسجلون في هذه المؤسسة.
                                  </td>
                                </tr>
                              ) : (
                                (tenantDetails?.users || []).map((u: any) => (
                                  <tr key={`${u.id}-${u.username}`}>
                                    <td className="p-2.5 font-mono font-bold text-slate-900">{u.username}</td>
                                    <td className="p-2.5 font-bold text-slate-700">{u.name}</td>
                                    <td className="p-2.5 text-center">
                                      <select
                                        value={u.role || "employee"}
                                        onChange={(e) =>
                                          updateTenantUserMut.mutate({
                                            tenantId: activeModalTenant.id,
                                            userId: u.id,
                                            body: { role: e.target.value },
                                          })
                                        }
                                        className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px] font-bold"
                                      >
                                        <option value="admin">admin</option>
                                        <option value="general_manager">مدير عام</option>
                                        <option value="accountant">accountant</option>
                                        <option value="employee">employee</option>
                                        <option value="cashier">cashier</option>
                                      </select>
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                                          u.active
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-red-50 text-red-700 border-red-200"
                                        }`}
                                      >
                                        {u.active ? "نشط" : "معطل"}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-center">
                                      {resetTargetUsername === u.username ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <Input
                                            value={resetPasswordValue}
                                            onChange={(e) => setResetPasswordValue(e.target.value)}
                                            placeholder="كلمة مرور جديدة"
                                            className="h-7 w-32 text-[11px] font-mono"
                                          />
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={resetPasswordValue.trim().length < 3 || resetPasswordMut.isPending}
                                            onClick={() =>
                                              resetPasswordMut.mutate({
                                                tenantId: activeModalTenant.id,
                                                username: u.username,
                                                new_password: resetPasswordValue.trim(),
                                              })
                                            }
                                            className="h-7 px-2 text-[11px] font-bold bg-slate-900 text-white"
                                          >
                                            حفظ
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setResetTargetUsername(null);
                                              setResetPasswordValue("");
                                            }}
                                            className="h-7 px-2 text-[11px]"
                                          >
                                            إلغاء
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1.5">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              updateTenantUserMut.mutate({
                                                tenantId: activeModalTenant.id,
                                                userId: u.id,
                                                body: { active: !u.active },
                                              })
                                            }
                                            className="h-7 px-2 text-[11px] font-bold"
                                          >
                                            {u.active ? "تعطيل" : "تفعيل"}
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setResetTargetUsername(u.username);
                                              setResetPasswordValue("");
                                            }}
                                            className="h-7 px-2 text-[11px] font-bold"
                                          >
                                            تغيير كلمة المرور
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── TAB 3: LINKED DEVICES & SYNC LOGS ── */}
                    {modalTab === "devices" && (
                      <div className="space-y-4">
                        {!activeModalTenant.allow_local_desktop && (
                          <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>الدخول من النسخة المحلية معطّل حالياً لهذا الحساب — انقر لتفعيله وتمكين المزامنة الفورية مع السحابة.</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={updateTenantMut.isPending}
                              onClick={() =>
                                updateTenantMut.mutate({
                                  id: activeModalTenant.id,
                                  body: { allow_local_desktop: true },
                                })
                              }
                              className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1"
                            >
                              <Laptop className="w-3.5 h-3.5" />
                              <span>تفعيل الدخول المحلي الآن</span>
                            </Button>
                          </div>
                        )}
                        <div className="border border-slate-200 rounded-xl overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b text-slate-700">
                              <tr>
                                <th className="p-2.5 text-right font-bold">الجهاز</th>
                                <th className="p-2.5 text-right font-bold">Installation / Device ID</th>
                                <th className="p-2.5 text-center font-bold">آخر مزامنة</th>
                                <th className="p-2.5 text-center font-bold">الحالة</th>
                                <th className="p-2.5 text-center font-bold">الإجراء</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(tenantDetails?.installations || []).length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-6 text-center text-slate-500">
                                    لا توجد أجهزة محلية مسجلة لهذه المؤسسة.
                                  </td>
                                </tr>
                              ) : (
                                (tenantDetails?.installations || []).map((inst: any) => {
                                  const im = getInstStatusMeta(inst.status);
                                  return (
                                    <tr key={inst.id}>
                                      <td className="p-2.5">
                                        <div className="font-bold">{inst.device_name || "جهاز محلي"}</div>
                                        <div className="text-[11px] text-slate-500 font-mono">{inst.os_info}</div>
                                      </td>
                                      <td className="p-2.5 font-mono text-[11px] dir-ltr text-right">
                                        <div>{inst.installation_id}</div>
                                        <div className="text-slate-500">{inst.device_id}</div>
                                      </td>
                                      <td className="p-2.5 text-center font-mono text-[11px] dir-ltr">
                                        {inst.last_successful_sync || "—"}
                                      </td>
                                      <td className="p-2.5 text-center">
                                        <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${im.cls}`}>
                                          {im.label} · {inst.sync_status}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center space-x-1 space-x-reverse">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            updateInstStatusMut.mutate({
                                              id: inst.id,
                                              status: inst.status === "authorized" ? "blocked" : "authorized",
                                            })
                                          }
                                          className="h-7 px-2 text-[11px] font-bold"
                                        >
                                          {inst.status === "authorized" ? "حظر" : "تفويض"}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => deleteInstMut.mutate(inst.id)}
                                          className="h-7 px-2 text-[11px] font-bold text-red-700 border-red-200"
                                        >
                                          فك الربط
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-black text-slate-900">سجل عمليات المزامنة الأخيرة</div>
                          <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-60">
                            <table className="w-full text-[11px]">
                              <thead className="bg-slate-50 border-b text-slate-700">
                                <tr>
                                  <th className="p-2 text-right">الوقت</th>
                                  <th className="p-2 text-center">النوع</th>
                                  <th className="p-2 text-center">النتيجة</th>
                                  <th className="p-2 text-right">التفاصيل</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {(tenantDetails?.sync_logs || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-500">
                                      لا توجد سجلات مزامنة مسجلة حتى الآن.
                                    </td>
                                  </tr>
                                ) : (
                                  (tenantDetails?.sync_logs || []).map((log: any) => (
                                    <tr key={log.id}>
                                      <td className="p-2 font-mono dir-ltr text-right">
                                        {log.started_at || log.created_at || "—"}
                                      </td>
                                      <td className="p-2 text-center font-mono">{log.sync_type || log.direction}</td>
                                      <td className="p-2 text-center font-bold">{log.status}</td>
                                      <td className="p-2 text-slate-600">{log.message || log.error_message || "—"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── TAB 4: LIVE OPERATIONAL MONITORING & SENSITIVE SERVICES ── */}
                    {modalTab === "monitor" && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                          {[
                            { label: "حجوزات السفر والطيران", val: tenantDetails?.metrics?.travel_bookings ?? 0 },
                            { label: "ملفات التأشيرات", val: tenantDetails?.metrics?.travel_visas ?? 0 },
                            { label: "المسافرون والعملاء", val: tenantDetails?.metrics?.travel_passengers ?? 0 },
                            { label: "فواتير المبيعات", val: tenantDetails?.metrics?.orders ?? 0 },
                            { label: "حجوزات الفنادق", val: tenantDetails?.metrics?.travel_hotels ?? 0 },
                            { label: "حجوزات النقل البري", val: tenantDetails?.metrics?.travel_bus_bookings ?? 0 },
                            { label: "القيود المحاسبية", val: tenantDetails?.metrics?.journal_entries ?? 0 },
                            { label: "تعارضات المزامنة المعلقة", val: tenantDetails?.metrics?.pending_conflicts ?? 0 },
                          ].map((m) => (
                            <div key={m.label} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                              <div className="text-[11px] font-bold text-slate-500">{m.label}</div>
                              <div className="text-lg font-black font-mono tabular-nums text-slate-900 mt-1">
                                {m.val}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-black text-slate-900">
                              آخر أحداث سجل التدقيق داخل قاعدة المؤسسة
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => refetchDetails()}
                              className="h-7 px-2 text-[11px] font-bold"
                            >
                              <RefreshCw className="w-3 h-3 ml-1" />
                              تحديث القراءات
                            </Button>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-56">
                            <table className="w-full text-[11px]">
                              <thead className="bg-slate-50 border-b text-slate-700">
                                <tr>
                                  <th className="p-2 text-right">المستخدم</th>
                                  <th className="p-2 text-right">العملية</th>
                                  <th className="p-2 text-center">النوع</th>
                                  <th className="p-2 text-right">الوقت</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {(tenantDetails?.audit_logs || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-500">
                                      لا توجد حركات تدقيق مسجلة داخل هذه المؤسسة.
                                    </td>
                                  </tr>
                                ) : (
                                  (tenantDetails?.audit_logs || []).map((a: any) => (
                                    <tr key={a.id}>
                                      <td className="p-2 font-bold">{a.user_name || "—"}</td>
                                      <td className="p-2 text-slate-700">{a.action}</td>
                                      <td className="p-2 text-center font-mono">{a.action_type || a.entity_type}</td>
                                      <td className="p-2 font-mono dir-ltr text-right text-slate-500">
                                        {a.created_at || "—"}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {activeModalTenant.id > 1 ? (
                          <div className="border border-red-200 bg-red-50/70 rounded-xl p-4 space-y-2.5">
                            <div className="text-xs font-black text-red-800 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" />
                              <span>منطقة خطرة: حذف حساب المؤسسة وقاعدة بياناتها نهائياً</span>
                            </div>
                            <p className="text-[11px] text-red-700">
                              سيتم حذف المؤسسة وملف قاعدة البيانات المعزول وكافة المستخدمين والأجهزة المرتبطة بها بشكل لا يمكن التراجع عنه. لتأكيد الحذف اكتب كود المؤسسة{" "}
                              <span className="font-mono font-bold">{activeModalTenant.tenant_code}</span>:
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={confirmDeleteCode}
                                onChange={(e) => setConfirmDeleteCode(e.target.value)}
                                placeholder={activeModalTenant.tenant_code}
                                className="h-8 w-44 text-xs font-mono bg-white dir-ltr text-right"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={
                                  confirmDeleteCode.trim() !== activeModalTenant.tenant_code ||
                                  deleteTenantMut.isPending
                                }
                                onClick={() => deleteTenantMut.mutate(activeModalTenant.id)}
                                className="h-8 px-3 text-xs font-bold whitespace-nowrap"
                              >
                                <Trash2 className="w-3.5 h-3.5 ml-1" />
                                {deleteTenantMut.isPending ? "جاري الحذف..." : "حذف المؤسسة نهائياً"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 text-[11px] font-bold text-slate-600 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-700" />
                            <span>هذه هي المؤسسة الرئيسية الافتراضية للنظام ولا يمكن حذفها.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
