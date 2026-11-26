import React, { useState, useEffect } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

export interface EsaalatCheckoutResult {
  intentCode?: string;
  status?: string;
  [key: string]: any;
}

export interface EsaalatCheckoutButtonProps {
  sessionToken: string;
  portalUrl?: string;
  locale?: string;
  presentation?: "modal" | "redirect" | string;
  variant?: "dark" | "light" | string;
  radius?: number;
  label?: string;
  onVerified?: (result: EsaalatCheckoutResult) => void | Promise<void>;
  onCancelled?: (result: EsaalatCheckoutResult) => void | Promise<void>;
  onWrongAmount?: (result: EsaalatCheckoutResult) => void | Promise<void>;
  onExpired?: (result: EsaalatCheckoutResult) => void | Promise<void>;
  onFailed?: (result: EsaalatCheckoutResult) => void | Promise<void>;
  onError?: (error: { message?: string }) => void;
}

export function EsaalatCheckoutButton({
  sessionToken,
  portalUrl = "https://checkout.esaalat.com",
  locale = "ar",
  presentation = "modal",
  label,
  onVerified,
  onCancelled,
  onWrongAmount,
  onExpired,
  onFailed,
  onError,
}: EsaalatCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const cleanPortalUrl = (portalUrl || "https://checkout.esaalat.com").replace(/\/+$/, "");
  const checkoutUrl = cleanPortalUrl.includes("?")
    ? `${cleanPortalUrl}&token=${encodeURIComponent(sessionToken)}&locale=${locale}`
    : `${cleanPortalUrl}/session/${encodeURIComponent(sessionToken)}?locale=${locale}`;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;
      const { type, payload } = event.data;
      if (type === "ESAALAT_PAYMENT_SUCCESS" || type === "ESAALAT_VERIFIED") {
        setModalOpen(false);
        onVerified?.(payload || { status: "PAID" });
      } else if (type === "ESAALAT_PAYMENT_CANCELLED" || type === "ESAALAT_CANCELLED") {
        setModalOpen(false);
        onCancelled?.(payload || { status: "CANCELLED" });
      } else if (type === "ESAALAT_PAYMENT_WRONG_AMOUNT" || type === "ESAALAT_WRONG_AMOUNT") {
        setModalOpen(false);
        onWrongAmount?.(payload || { status: "WRONG_AMOUNT" });
      } else if (type === "ESAALAT_PAYMENT_EXPIRED" || type === "ESAALAT_EXPIRED") {
        setModalOpen(false);
        onExpired?.(payload || { status: "EXPIRED" });
      } else if (type === "ESAALAT_PAYMENT_FAILED" || type === "ESAALAT_FAILED") {
        setModalOpen(false);
        onFailed?.(payload || { status: "FAILED" });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onVerified, onCancelled, onWrongAmount, onExpired, onFailed]);

  const handleOpenCheckout = () => {
    try {
      setLoading(true);
      if (presentation === "redirect") {
        if ((window as any).electronAPI?.openExternal) {
          (window as any).electronAPI.openExternal(checkoutUrl);
        } else {
          window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        }
        setLoading(false);
      } else {
        setModalOpen(true);
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      onError?.({ message: err?.message || "تعذر فتح نافذة الدفع" });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenCheckout}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        <span>{label || "ادفع الآن عبر بوابة الدفع الإلكتروني"}</span>
        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[650px] max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">بوابة الدفع الإلكتروني</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 bg-slate-50 relative">
              <iframe
                src={checkoutUrl}
                title="Esaalat Payment"
                className="w-full h-full border-0"
                allow="payment; camera"
              />
            </div>
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600">
              <span>يرجى إكمال الدفع أو إغلاق النافذة عند الانتهاء</span>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  onCancelled?.({ status: "CANCELLED" });
                }}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default EsaalatCheckoutButton;
