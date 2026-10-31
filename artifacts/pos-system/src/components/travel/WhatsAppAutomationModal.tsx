import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Send, ExternalLink, CheckCircle2, AlertCircle, Phone, User, 
  Settings, Sparkles, Luggage, Clock, ShieldCheck, Laptop, FileText, CheckCheck, RefreshCw, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPax?: any;
  allPassengers?: any[];
  selectedCustomerId?: any;
  currentCustomerName?: string;
  onBatchComplete?: (res: any) => void;
  onEditPassenger?: (paxId: any) => void;
}

export function WhatsAppAutomationModal({
  open,
  onOpenChange,
  targetPax,
  allPassengers = [],
  selectedCustomerId,
  currentCustomerName,
  onBatchComplete,
  onEditPassenger
}: WhatsAppModalProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending4Wa, setSending4Wa] = useState(false);
  const [sendingMeta, setSendingMeta] = useState(false);
  const [templateType, setTemplateType] = useState<"card" | "passport_alert" | "umrah_exit" | "batch_report">("card");
  
  // 4WhatsApp Gateway status
  const [fourWaConfig, setFourWaConfig] = useState<any>(null);
  const [fourWaConnected, setFourWaConnected] = useState<boolean>(true);

  // Fetch 4WhatsApp status
  useEffect(() => {
    if (open) {
      fetch("/api/travel/whatsapp/4whatsapp/status")
        .then(r => r.json())
        .then(data => {
          if (data?.config) {
            setFourWaConfig(data.config);
            setFourWaConnected(data.config.session_status === "connected" || data.config.is_authenticated === 1);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  // Generate customized message based on template selection and passenger details
  const generateTemplateText = (type: "card" | "passport_alert" | "umrah_exit" | "batch_report", pax: any) => {
    const recipientName = pax?.name_ar || pax?.name_en || currentCustomerName || "العميل الكريم";
    const passportNo = pax?.passport_number || "---";
    const remaining = pax?.remaining_days !== null && pax?.remaining_days !== undefined ? `${pax.remaining_days} يوم` : 'غير محدد';
    const exitDate = (pax?.expected_exit_date || '').replace(/-/g, '/');
    const entryDate = (pax?.travel_date || '').replace(/-/g, '/');
    const agencySender = fourWaConfig?.display_phone_number || "+967 77 345 6789";

    switch(type) {
      case "card":
        return `عزيزنا المسافر *${recipientName}* المحترم 🛂\nتحية طيبة من وكالة أومني فلاي للسياحة والسفر ✈️\nنرفق لكم بطاقة المسافر وتفاصيل وثائق السفر المعتمدة:\n• رقم الجواز: ${passportNo}\n• تاريخ الدخول/السفر: ${entryDate || 'قريباً'}\n• تاريخ الخروج المتوقع: ${exitDate || 'حسب مدة التأشيرة'}\n• المدة المقررة: ${pax?.program_duration_days || 90} يوم\nنتمنى لكم رحلة سعيدة وموفقة! 🌟\n📞 الوكالة: ${agencySender}`;

      case "passport_alert":
        return `⚠️ *تنبيه هام بشأن صلاحية جواز السفر*\nعزيزنا المسافر: *${recipientName}* 🛂\nنود إحاطتكم بأن جواز سفركم رقم (*${passportNo}*) قارب على الانتهاء.\nنوصيكم بسرعة تجديد الجواز لضمان استيفاء شروط السفر والتأشيرات الدولية (صلاحية لا تقل عن 6 أشهر).\nوكالة أومني فلاي للسياحة والسفر تتمنى لكم دوام التوفيق 🌟`;

      case "umrah_exit":
        return `🕋 *تذكير متابعة تأشيرة العمرة وموعد الخروج - مكة المكرمة*\nالمعتمر الكريم: *${recipientName}*\n• رقم الجواز: ${passportNo}\n• تاريخ الدخول: ${entryDate} | المدة: ${pax?.program_duration_days || 90} يوم\n• الأيام المتبقية داخل مكة: *${remaining}*\n• تاريخ الخروج المتوقع: ${exitDate}\nيرجى التنسيق المبكر لتأكيد حجوزات المغادرة والعودة بسلامة الله.\n📞 هاتف الوكالة: ${agencySender}`;

      case "batch_report":
        return `عزيزنا العميل *${recipientName}* المحترم 🌸\nمرفق لكم كشف تقرير المسافرين والمعتمرين المسجلين بوكالتكم لدى أومني فلاي.\nإجمالي المسافرين في الكشف: ${allPassengers.length} مسافر\nتاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}\nشكراً لتعاملكم الدائم والمتميز معنا ✈️.`;
    }
  };

  // Sync state whenever modal opens or pax changes
  useEffect(() => {
    if (open) {
      const recipientPhone = targetPax?.phone || (allPassengers.length > 0 ? allPassengers[0]?.phone : "") || "967773456789";
      setPhone(recipientPhone);

      const initialType = targetPax ? "card" : "batch_report";
      setTemplateType(initialType);
      setMessage(generateTemplateText(initialType, targetPax));
    }
  }, [open, targetPax, allPassengers, currentCustomerName, fourWaConfig]);

  const handleTemplateChange = (newType: "card" | "passport_alert" | "umrah_exit" | "batch_report") => {
    setTemplateType(newType);
    setMessage(generateTemplateText(newType, targetPax));
  };

  // 1. Send via 4WhatsApp Enterprise Gateway (https://api2.4whatsapp.com/api/Agent_Client)
  const handleSendVia4WhatsApp = async () => {
    if (!phone || !message) {
      toast({ title: "تنبيه", description: "يرجى إدخال رقم الهاتف ونص الرسالة", variant: "destructive" });
      return;
    }
    setSending4Wa(true);
    try {
      const res = await fetch("/api/travel/whatsapp/4whatsapp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_phone: phone,
          message_body: message,
          recipient_name: targetPax?.name_ar || targetPax?.name_en || currentCustomerName || "عميل"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال عبر بوابة 4WhatsApp");

      toast({
        title: "✓ تم الإرسال بنجاح عبر 4WHATSAPP السحابية ⚡",
        description: data.message || `تم تسليم الرسالة إلى +${phone}`
      });
      if (onBatchComplete) {
        onBatchComplete({ successCount: 1, skippedCount: 0, successList: [targetPax || { name: currentCustomerName }] });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "فشل الإرسال عبر 4WhatsApp",
        description: err.message || "حدث خطأ أثناء التواصل مع بوابة 4WhatsApp",
        variant: "destructive"
      });
    } finally {
      setSending4Wa(false);
    }
  };

  // 2. Open Direct Official Dynamic WhatsApp Web URL
  const handleOpenDirectWhatsAppWeb = () => {
    const cleanDigits = phone.replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(message);
    const url = `https://web.whatsapp.com/send/?phone=${cleanDigits}&text=${encoded}&type=phone_number&app_absent=0`;
    window.open(url, "_blank");
  };

  // 3. Launch WhatsApp Desktop Protocol
  const handleLaunchWhatsAppDesktop = () => {
    const cleanDigits = phone.replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(message);
    const url = `whatsapp://send?phone=${cleanDigits}&text=${encoded}`;
    window.location.href = url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl p-6" dir="rtl">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-950">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <span>إرسال تنبيه ورسالة واتساب للمسافر (إدارة الجوازات والعمرة)</span>
            </DialogTitle>
            <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-bold text-xs gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>4WhatsApp Gateway: {fourWaConnected ? "متصل سحابياً 🟢" : "جاهز للربط 🟡"}</span>
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            التحكم الكامل في نص الرسالة المرسلة وتوقيتها عبر بوابة 4WhatsApp السحابية أو روابط واتساب ويب المباشرة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Template Selection Pills */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              اختر قالب الرسالة المخصص لبيانات المسافر:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleTemplateChange("card")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 font-bold ${
                  templateType === "card"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Luggage className="w-4 h-4 text-indigo-600" />
                <span>بطاقة المسافر</span>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange("passport_alert")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 font-bold ${
                  templateType === "passport_alert"
                    ? "bg-amber-50 border-amber-500 text-amber-900 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>انتهاء الجواز</span>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange("umrah_exit")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 font-bold ${
                  templateType === "umrah_exit"
                    ? "bg-rose-50 border-rose-500 text-rose-900 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>مغادرة مكة</span>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange("batch_report")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 font-bold ${
                  templateType === "batch_report"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>كشف التقرير</span>
              </button>
            </div>
          </div>

          {/* Passenger & Phone Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> اسم المسافر / المستلم
              </label>
              <Input
                readOnly
                value={targetPax?.name_ar || targetPax?.name_en || currentCustomerName || "عميل عام"}
                className="bg-slate-50 text-xs font-bold rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> رقم الهاتف والواتساب (مع رمز الدولة)
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="967771234567 أو 966501234567"
                dir="ltr"
                className="text-xs font-mono font-bold rounded-xl"
              />
            </div>
          </div>

          {/* Message Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">نص الرسالة المعد للإرسال:</label>
              <span className="text-[10px] text-slate-400">يمكنك تعديل أي جزء من النص يدوياً قبل الإرسال</span>
            </div>
            <Textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs font-sans leading-relaxed resize-none rounded-xl"
              placeholder="اكتب نص رسالة الواتساب هنا..."
            />
          </div>

          {/* Hub Integration Notice */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between text-xs text-purple-950">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>لحفظ قوالب الرسائل الدائمة والتحكم في وقت الإرسال المجدول آلياً:</span>
            </div>
            <a
              href="/travel-notifications-hub"
              className="font-bold underline text-purple-700 hover:text-purple-900 flex items-center gap-1 whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              مركز تنبيهات الواتساب
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="gap-2 sm:justify-between flex flex-col sm:flex-row border-t pt-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenDirectWhatsAppWeb}
              className="text-[#00a884] border-[#00a884]/40 hover:bg-[#00a884]/10 text-xs font-bold rounded-xl gap-1.5"
              title="فتح الرابط التلقائي المباشر لخدمة WhatsApp Web"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>رابط واتساب ويب 🌐</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleLaunchWhatsAppDesktop}
              className="text-slate-700 border-slate-300 hover:bg-slate-100 text-xs font-bold rounded-xl gap-1.5"
              title="فتح المحادثة في تطبيق واتساب المكتبي"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>تطبيق الكمبيوتر 💻</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              إلغاء
            </Button>

            <Button
              type="button"
              onClick={handleSendVia4WhatsApp}
              disabled={sending4Wa}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs gap-2 px-5 py-2.5 rounded-xl shadow-lg shadow-purple-500/20"
            >
              {sending4Wa ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Zap className="w-4 h-4 text-amber-300" />
              )}
              <span>{sending4Wa ? "جاري الإرسال السحابي..." : "إرسال عبر 4WhatsApp السحابي ⚡"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

