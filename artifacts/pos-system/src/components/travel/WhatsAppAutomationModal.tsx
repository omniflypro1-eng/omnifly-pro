import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, ExternalLink, CheckCircle2, AlertCircle, Phone, User, Settings, Sparkles } from "lucide-react";
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
  const [sending, setSending] = useState(false);

  // Sync state whenever modal opens or pax changes
  React.useEffect(() => {
    if (open) {
      const recipientPhone = targetPax?.phone || (allPassengers.length > 0 ? allPassengers[0]?.phone : "") || "966500000000";
      setPhone(recipientPhone);

      const recipientName = targetPax?.name_ar || targetPax?.name_en || currentCustomerName || "العميل الكريم";
      const defaultText = targetPax 
        ? `عزيزنا المسافر *${recipientName}* المحترم 🛂\nتحية طيبة من وكالة أومني فلاي للسياحة والسفر ✈️\nنود إحاطتكم ببيانات رحلتكم وجواز السفر (${targetPax.passport_number || 'N/A'}).\nتاريخ السفر: ${targetPax.travel_date || 'محدد قريباً'}\nنتمنى لكم رحلة موفقة!`
        : `عزيزنا العميل *${recipientName}* المحترم 🌸\nمرفق لكم كشف تقرير المسافرين والمعتمرين المسجلين بوكالتكم.\nإجمالي المسافرين: ${allPassengers.length}\nشكراً لتعاملكم مع أومني فلاي.`;

      setMessage(defaultText);
    }
  }, [open, targetPax, allPassengers, currentCustomerName]);

  const handleSendViaMetaApi = async () => {
    if (!phone || !message) {
      toast({ title: "تنبيه", description: "يرجى التأكد من كتابة رقم الهاتف ونص الرسالة", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          channel: "whatsapp",
          recipient_phone: phone,
          recipient_name: targetPax?.name_ar || currentCustomerName || "عميل",
          template_code: targetPax ? "PAX_CARD_DIRECT" : "CLIENT_BATCH_REPORT",
          message_body: message
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال الرسالة");

      toast({
        title: "✓ تم الإرسال بنجاح عبر Meta Cloud API",
        description: data.message || `تم تسليم الرسالة إلى الرقم ${phone}`
      });
      if (onBatchComplete) {
        onBatchComplete({ successCount: 1, skippedCount: 0, successList: [targetPax || { name: currentCustomerName }] });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "فشل الإرسال",
        description: err.message || "حدث خطأ أثناء التواصل مع بوابة Meta WhatsApp Cloud API",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleOpenDirectWhatsAppWeb = () => {
    const cleanDigits = phone.replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleanDigits}?text=${encoded}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white text-slate-900 rounded-2xl shadow-2xl p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-black flex items-center gap-2 text-emerald-800">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              إرسال رسالة واتساب رسمية (Meta Cloud API)
            </DialogTitle>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
              🟢 Meta Cloud Connected
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            إرسال إشعار مباشر أو بطاقة المسافر عبر بوابة Meta WhatsApp الرسمية
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> المسافر / المستلم
              </label>
              <Input
                readOnly
                value={targetPax?.name_ar || targetPax?.name_en || currentCustomerName || "عميل عام"}
                className="bg-slate-50 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> رقم الهاتف والواتساب
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="966500000000"
                dir="ltr"
                className="text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">نص الرسالة</label>
            <Textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs font-sans leading-relaxed resize-none"
              placeholder="اكتب نص رسالة الواتساب هنا..."
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>لإدارة محرك الأتمتة الموحد والقواعد السحابية لجميع أقسام النظام:</span>
            </div>
            <a
              href="/travel-notifications-hub"
              className="font-bold underline text-emerald-700 hover:text-emerald-900 flex items-center gap-1 whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              مركز تنبيهات الواتساب
            </a>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between flex flex-col sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleOpenDirectWhatsAppWeb}
            className="text-slate-600 hover:bg-slate-100 text-xs gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            فتح WhatsApp Web
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSendViaMetaApi}
              disabled={sending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 px-4"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "جاري الإرسال..." : "إرسال عبر Meta Cloud API 🚀"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
