import React, { useEffect, useMemo, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { dispatchWhatsApp } from "@/lib/whatsapp";
import { WhatsAppPermissionDialog } from "@/components/WhatsAppPermissionDialog";
import { PortalWebsiteView, PortalCatalogData } from "@/components/website/PortalWebsiteView";
import { DEFAULT_WEBSITE_THEME, WebsiteThemeConfig, normalizeWebsiteConfig } from "@/lib/website-theme";
import { useAuth } from "@/components/auth-provider";
import { getStoredAuthToken } from "@/lib/safe-storage";
import { ArrowRight } from "lucide-react";

const LIVE_RENDER_API = "https://omnifly-pro-jdpf.onrender.com";

function buildTenantQueryAndHeaders(tenantIdentifier?: string | null) {
  const headers: Record<string, string> = {};
  let queryPart = "";
  if (tenantIdentifier && tenantIdentifier.trim()) {
    const clean = tenantIdentifier.trim();
    if (/^\d+$/.test(clean)) {
      headers["X-Tenant-Id"] = clean;
    } else {
      headers["X-Tenant-Code"] = clean;
    }
    queryPart = `tenant=${encodeURIComponent(clean)}`;
  }
  return { headers, queryPart };
}

async function fetchPortalApi(
  endpoint: string,
  tenantIdentifier?: string | null,
  options?: RequestInit
): Promise<Response> {
  const isNetlify =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("netlify") || window.location.hostname.includes("omnifly.app"));

  const { headers: tenantHeaders, queryPart } = buildTenantQueryAndHeaders(tenantIdentifier);
  const sep = endpoint.includes("?") ? "&" : "?";
  const endpointWithTenant = queryPart ? `${endpoint}${sep}${queryPart}` : endpoint;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const urlWithBuster =
      endpointWithTenant + (endpointWithTenant.includes("?") ? "&" : "?") + `_t=${Date.now()}`;

    const res = await fetch(urlWithBuster, {
      ...options,
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...tenantHeaders,
        ...options?.headers
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) return res;

    if (isNetlify) {
      const fallbackUrl = `${LIVE_RENDER_API}${endpointWithTenant}${
        endpointWithTenant.includes("?") ? "&" : "?"
      }_t=${Date.now()}`;
      const directController = new AbortController();
      const directTimeout = setTimeout(() => directController.abort(), 3500);
      const directRes = await fetch(fallbackUrl, {
        ...options,
        headers: { "Cache-Control": "no-cache", ...tenantHeaders, ...options?.headers },
        signal: directController.signal
      });
      clearTimeout(directTimeout);
      if (directRes.ok) return directRes;
    }
    return res;
  } catch {
    if (endpoint.includes("/api/public/website") && !tenantIdentifier) {
      try {
        const staticRes = await fetch(`/website-data.json?_t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (staticRes.ok) {
          const fullData = await staticRes.json();
          if (endpoint.includes("/config")) {
            return new Response(JSON.stringify(fullData.settings || {}));
          }
          if (endpoint.includes("/catalog")) {
            return new Response(
              JSON.stringify({
                rides: fullData.services || [],
                flights: fullData.flights || fullData.ndcOffers || [],
                hotels: fullData.hotels || [],
                packages: fullData.packages || [],
                visas: fullData.visas || [],
                buses: fullData.buses || []
              })
            );
          }
        }
      } catch {}
    }
    return fetch(endpointWithTenant, {
      ...options,
      headers: { ...tenantHeaders, ...options?.headers }
    });
  }
}

export default function CustomerPortalPage() {
  const { toast } = useToast();
  const searchStr = useSearch();
  const [siteMatched, siteParams] = useRoute<{ tenantCode: string }>("/site/:tenantCode");
  const [portalTenantMatched, portalTenantParams] = useRoute<{ tenantCode: string }>("/portal/:tenantCode");

  const searchParams = useMemo(() => new URLSearchParams(searchStr || (typeof window !== "undefined" ? window.location.search : "")), [searchStr]);

  const tenantIdentifier = useMemo(() => {
    const fromSiteRoute = siteMatched && siteParams ? siteParams.tenantCode : null;
    const fromPortalRoute = portalTenantMatched && portalTenantParams ? portalTenantParams.tenantCode : null;
    return (
      fromSiteRoute ||
      fromPortalRoute ||
      searchParams.get("tenant") ||
      searchParams.get("t") ||
      searchParams.get("tenantId") ||
      null
    );
  }, [siteMatched, siteParams, portalTenantMatched, portalTenantParams, searchParams]);

  // "الرجوع للنظام" ONLY appears when explicitly previewing from inside the ERP (?preview=1 or ?from=system)
  // AND only when the viewer has an active verified ERP user session — NEVER on copied public links or external browser sessions.
  const { user: authUser } = useAuth();
  const isInternalPreview =
    searchParams.get("preview") === "1" || searchParams.get("from") === "system";
  const isLiveIframe = searchParams.get("live") === "1";
  const [authToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getStoredAuthToken() || sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token") || "";
  });
  const { data: verifiedErpSession } = useQuery<{ user?: { id?: number } } | null>({
    queryKey: ["portal-verify-erp-session", authToken],
    enabled: Boolean(isInternalPreview && !isLiveIframe && Boolean(authToken || authUser?.id)),
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 60000
  });

  const hasAdminSession = Boolean(
    (authUser && authUser.id) ||
    (authToken && verifiedErpSession?.user?.id)
  );

  const showReturnToSystem = Boolean(
    isInternalPreview && !isLiveIframe && hasAdminSession
  );

  // Live preview override synced from WebsiteManagement Studio via postMessage
  const [livePreviewConfig, setLivePreviewConfig] = useState<Partial<WebsiteThemeConfig> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "WEBSITE_LIVE_PREVIEW_UPDATE" && event.data?.config) {
        setLivePreviewConfig(event.data.config);
      }
    };
    window.addEventListener("message", handleMessage);
    if (isLiveIframe && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "WEBSITE_LIVE_PREVIEW_READY" }, window.location.origin);
    }
    return () => window.removeEventListener("message", handleMessage);
  }, [isLiveIframe]);

  // WhatsApp One-Time Permission & Direct Native Dispatch State
  const [waPermOpen, setWaPermOpen] = useState(false);
  const [pendingWaAction, setPendingWaAction] = useState<(() => void) | null>(null);

  const handleSendWhatsApp = (phone?: string, text = "") => {
    dispatchWhatsApp({
      phone,
      text,
      onRequirePermission: (action) => {
        setPendingWaAction(() => action);
        setWaPermOpen(true);
      }
    });
  };

  // Fetch Website Branding & Settings
  const { data: siteConfig } = useQuery<WebsiteThemeConfig>({
    queryKey: ["public-website-config", tenantIdentifier || "default", isInternalPreview ? "preview" : "public"],
    queryFn: async () => {
      const authToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token") || ""
          : "";
      const endpoint =
        isInternalPreview && authToken
          ? "/api/public/website/config?preview_draft=1"
          : "/api/public/website/config";
      const headers: Record<string, string> = {};
      if (isInternalPreview && authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetchPortalApi(endpoint, tenantIdentifier, { headers });
      return res.json();
    },
    refetchInterval: isLiveIframe ? false : 15000,
    staleTime: 4000
  });

  // Fetch Live Catalog
  const { data: catalog } = useQuery<PortalCatalogData>({
    queryKey: ["public-website-catalog", tenantIdentifier || "default"],
    queryFn: () =>
      fetchPortalApi("/api/public/website/catalog", tenantIdentifier).then((r) => r.json()),
    refetchInterval: isLiveIframe ? false : 15000,
    staleTime: 4000
  });

  // Fetch Tenant-Scoped Esaalat Payment Availability
  const { data: esaalatMethods } = useQuery<any>({
    queryKey: ["public-esaalat-methods", tenantIdentifier || "default"],
    queryFn: () =>
      fetchPortalApi("/api/public/esaalat/methods", tenantIdentifier)
        .then((r) => (r.ok ? r.json() : { isEnabled: false }))
        .catch(() => ({ isEnabled: false })),
    refetchInterval: isLiveIframe ? false : 30000,
    staleTime: 10000
  });

  const activeConfig = useMemo(() => {
    const base = { ...DEFAULT_WEBSITE_THEME, ...(siteConfig || {}) };
    if (livePreviewConfig) {
      return normalizeWebsiteConfig({ ...base, ...livePreviewConfig });
    }
    return normalizeWebsiteConfig(base);
  }, [siteConfig, livePreviewConfig]);

  // Dynamic Title & Favicon per Tenant
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeConfig.site_name) {
      document.title = activeConfig.site_name;
    }
    if (activeConfig.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = activeConfig.favicon_url;
    }
  }, [activeConfig.site_name, activeConfig.favicon_url]);

  const bookMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchPortalApi("/api/public/website/bookings", tenantIdentifier, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "فشل تسجيل الحجز");
        return d;
      }),
    onSuccess: (data, variables) => {
      if (variables?.payment_method === "esaalat") {
        toast({
          title: "تم تسجيل الحجز — بانتظار إتمام الدفع",
          description: `يرجى إتمام السداد عبر بوابة Esaalat للحجز (${data.booking?.booking_ref || ""})`
        });
      } else {
        toast({
          title: "تم حجز المعاملة",
          description: `تم حجز المعاملة، سوف يتم الموافقة عليها قريباً، وسوف يتم إشعارك بذلك (${data.booking?.booking_ref || ""})`
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "خطأ في عملية الحجز", description: err.message, variant: "destructive" });
    }
  });

  const handleCreateEsaalatSession = async (payload: { orderId: number; preferredAccountId?: string }) => {
    const res = await fetchPortalApi("/api/public/esaalat/create-session", tenantIdentifier, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "تعذر إنشاء جلسة الدفع الإلكتروني",
        description: data.error || "حدث خطأ أثناء الاتصال ببوابة Esaalat",
        variant: "destructive"
      });
      throw new Error(data.error || "فشل إنشاء جلسة الدفع");
    }
    return data;
  };

  const handleVerifyEsaalatPayment = async (payload: {
    externalOrderId: string;
    intentId?: string;
    intentCode?: string;
    status?: string;
  }) => {
    const res = await fetchPortalApi("/api/public/esaalat/verify", tenantIdentifier, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "تعذر التحقق من الدفع",
        description: data.error || "لم يتم التحقق من العملية بعد",
        variant: "destructive"
      });
      throw new Error(data.error || "فشل التحقق من الدفع");
    }
    if (data.verified && data.status === "paid") {
      toast({
        title: "تم الدفع والتحقق بنجاح",
        description: `تم تأكيد السداد عبر الخادم للحجز ${data.transaction?.external_order_id || ""}`
      });
    }
    return data;
  };

  const handleLookupBooking = async (query: string) => {
    const res = await fetchPortalApi(
      `/api/public/website/lookup?query=${encodeURIComponent(query)}`,
      tenantIdentifier
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "لم يتم العثور على حجز");
    return data;
  };

  const handleSubmitInquiry = async (payload: {
    name: string;
    phone: string;
    email?: string;
    service_interest: string;
    message: string;
  }) => {
    const res = await fetchPortalApi("/api/public/website/inquiries", tenantIdentifier, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "تعذر الإرسال", description: data.error || "حدث خطأ", variant: "destructive" });
      throw new Error(data.error || "فشل الإرسال");
    }
    toast({
      title: "تم استلام طلبك بنجاح",
      description: data.message || "سيتواصل معك مستشار السفر قريباً"
    });
  };

  const handleSendCustomerOtp = async (phone: string, purpose: "register" | "login" = "register") => {
    const res = await fetchPortalApi("/api/public/website/send-otp", tenantIdentifier, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose })
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "تعذر إرسال كود التحقق",
        description: data.error || "تأكد من صحة رقم الواتساب وإعدادات بوابة 4WhatsApp",
        variant: "destructive"
      });
      throw new Error(data.error || "تعذر إرسال كود التحقق");
    }
    toast({
      title: data.otp_disabled
        ? "التحقق عبر الواتساب غير مطلوب"
        : "تم إرسال كود التحقق عبر واتساب",
      description: data.message || "راجع رسائل الواتساب على هاتفك وأدخل الرمز المكون من 4 أرقام يدوياً"
    });
    return data;
  };

  const handleRegisterCustomer = async (payload: {
    name: string;
    phone: string;
    email?: string;
    nationality?: string;
    password?: string;
    otp_code?: string;
    id_image_data?: string | null;
    id_image_name?: string | null;
  }) => {
    const res = await fetchPortalApi("/api/public/website/register-customer", tenantIdentifier, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "تعذر إنشاء الحساب",
        description: data.error || "يرجى التحقق من البيانات وكود التحقق",
        variant: "destructive"
      });
      throw new Error(data.error || "تعذر إنشاء الحساب");
    }
    toast({
      title: data.already_registered ? "تم تأكيد حسابك وتحديث بياناتك" : "تم فتح الحساب بنجاح",
      description: data.message
    });
    return data;
  };

  const handleCustomerLogin = async (payload: {
    phone: string;
    password?: string;
    otp_code?: string;
  }) => {
    const res = await fetchPortalApi("/api/public/website/login", tenantIdentifier, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "تعذر تسجيل الدخول",
        description: data.error || "يرجى التحقق من رقم الجوال أو كلمة المرور",
        variant: "destructive"
      });
      throw new Error(data.error || "تعذر تسجيل الدخول");
    }
    toast({
      title: "تم تسجيل الدخول بنجاح",
      description: data.message || `مرحباً بك ${data.customer?.name || ""}`
    });
    return data;
  };

  return (
    <>
      {showReturnToSystem && (
        <aside
          aria-label="شريط معاينة مسؤول النظام"
          className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 text-xs flex items-center justify-between border-b border-slate-700 shadow-md sticky top-0 z-50 animate-in fade-in slide-in-from-top-1 duration-200 print:hidden"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-extrabold text-white text-xs sm:text-sm">
                معاينة الموقع الإلكتروني (وضع مسؤول النظام)
              </span>
              <span className="hidden md:inline-block text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                لن يظهر هذا الزر أو الشريط للعملاء عند فتح الرابط العام في أي متصفح
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/website-management";
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer shadow-sm shrink-0"
          >
            <span>العودة للنظام</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}

      <PortalWebsiteView
        config={activeConfig}
        catalog={catalog}
        showReturnToSystem={showReturnToSystem}
        isLivePreview={isLiveIframe}
        isDraftPreview={Boolean((siteConfig as any)?.is_draft_preview)}
        onReturnToSystem={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/website-management";
          }
        }}
        onSendWhatsApp={handleSendWhatsApp}
        onCreateBooking={(payload) => bookMutation.mutateAsync(payload)}
        isSubmittingBooking={bookMutation.isPending}
        esaalatMethods={esaalatMethods}
        onCreateEsaalatSession={handleCreateEsaalatSession}
        onVerifyEsaalatPayment={handleVerifyEsaalatPayment}
        onLookupBooking={handleLookupBooking}
        onSubmitInquiry={handleSubmitInquiry}
        onSendCustomerOtp={handleSendCustomerOtp}
        onRegisterCustomer={handleRegisterCustomer}
        onLoginCustomer={handleCustomerLogin}
      />

      <WhatsAppPermissionDialog
        open={waPermOpen}
        onClose={() => {
          setWaPermOpen(false);
          setPendingWaAction(null);
        }}
        onConfirmed={() => {
          setWaPermOpen(false);
          if (pendingWaAction) {
            pendingWaAction();
            setPendingWaAction(null);
          }
        }}
      />
    </>
  );
}
