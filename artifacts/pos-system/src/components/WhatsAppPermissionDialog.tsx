import React, { useState } from "react";
import { MessageSquare, Smartphone, Globe, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WhatsAppSendMode,
  saveWhatsAppPermission,
  getWhatsAppPermission
} from "@/lib/whatsapp";

interface WhatsAppPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  title?: string;
  description?: string;
}

export function WhatsAppPermissionDialog({
  open,
  onClose,
  onConfirmed,
  title = "إذن الوصول إلى تطبيق واتساب المثبت على هذا الجهاز",
  description = "يطلب النظام إذنك لمرة واحدة فقط لتحديد طريقة إرسال الرسائل والتذاكر للعملاء عبر واتساب"
}: WhatsAppPermissionDialogProps) {
  const currentConfig = getWhatsAppPermission();
  const [selectedMode, setSelectedMode] = useState<WhatsAppSendMode>(
    currentConfig.mode || "installed_app"
  );
  const [rememberChoice, setRememberChoice] = useState(true);

  if (!open) return null;

  const handleConfirm = () => {
    saveWhatsAppPermission({
      mode: selectedMode,
      alwaysRemember: rememberChoice
    });
    onConfirmed();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900">{title}</h3>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                طلب لمرة واحدة
              </Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Options */}
        <div className="py-4 space-y-3">
          {/* Option 1: Native Installed App (Recommended) */}
          <label
            onClick={() => setSelectedMode("installed_app")}
            className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
              selectedMode === "installed_app"
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <input
              type="radio"
              name="whatsapp_mode"
              className="hidden"
              checked={selectedMode === "installed_app"}
              onChange={() => setSelectedMode("installed_app")}
            />
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                selectedMode === "installed_app"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {selectedMode === "installed_app" && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  تلقائي: فتح تطبيق واتساب المثبت مباشرة على هذا الجهاز
                </span>
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                  موصى به
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                يتم إرسال الرسالة وفتح تطبيق واتساب المثبت على جهازك (الكمبيوتر أو الهاتف) مباشرة بدون المرور بصفحة الويب أو البحث عن واتساب ويب.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 mt-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>بروتوكول مباشر (whatsapp://send)</span>
              </div>
            </div>
          </label>

          {/* Option 2: Manual / Web */}
          <label
            onClick={() => setSelectedMode("manual_web")}
            className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
              selectedMode === "manual_web"
                ? "border-slate-600 bg-slate-50 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <input
              type="radio"
              name="whatsapp_mode"
              className="hidden"
              checked={selectedMode === "manual_web"}
              onChange={() => setSelectedMode("manual_web")}
            />
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                selectedMode === "manual_web"
                  ? "border-slate-700 bg-slate-700 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {selectedMode === "manual_web" && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <div className="flex-1 text-right">
              <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                يدوي: فتح صفحة الويب في المتصفح (واتساب ويب)
              </span>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                فتح الرابط في تبويب جديد عبر المتصفح (Web WhatsApp).
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>عبر رابط المتصفح (web.whatsapp.com)</span>
              </div>
            </div>
          </label>

          {/* Remember Choice Checkbox */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  تذكر اختياري على هذا الجهاز
                </span>
                <span className="text-[10px] text-slate-400">
                  لن يسألك النظام مرة أخرى، وسيتم الإرسال فورياً في المرات القادمة
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs h-9 px-4"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-9 px-6 shadow-xs"
          >
            تأكيد والبدء بالإرسال فوراً
          </Button>
        </div>
      </div>
    </div>
  );
}
