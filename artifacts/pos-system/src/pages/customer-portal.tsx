import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plane,
  Building2,
  Compass,
  FileText,
  Bus,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  CreditCard,
  Printer,
  Sparkles,
  Ticket,
  Luggage,
  Star,
  ArrowRight,
  MessageSquare,
  Globe,
  Tag,
  Car,
  QrCode,
  Share2,
  Award,
  ChevronLeft,
  Headphones,
  Send,
  Zap,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { NjazLogo, NjazSymbol } from "@/components/NjazLogo";
import { dispatchWhatsApp } from "@/lib/whatsapp";
import { WhatsAppPermissionDialog } from "@/components/WhatsAppPermissionDialog";

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerPortalPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("rides");

  // WhatsApp One-Time Permission & Direct Native Dispatch State
  const [waPermOpen, setWaPermOpen] = useState(false);
  const [pendingWaAction, setPendingWaAction] = useState<(() => void) | null>(null);

  const handleSendWhatsApp = (phone?: string, text: string = "") => {
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
  const { data: siteConfig } = useQuery<any>({
    queryKey: ["public-website-config"],
    queryFn: () => fetch("/api/public/website/config").then((r) => r.json())
  });

  // Fetch Catalog
  const { data: catalog } = useQuery<any>({
    queryKey: ["public-website-catalog"],
    queryFn: () => fetch("/api/public/website/catalog").then((r) => r.json())
  });

  // Fallback Rides if DB empty
  const defaultRides = [
    { id: "ride-1", title: "توصيل واستقبال مطار الملك خالد (الرياض)", type: "توصيل مطار VIP", price: 150, car_type: "سيدان حديثة (كامري / سوناتا)", duration: "45 دقيقة", features: "استقبال باللوحة • متوفر 24/7 • واي فاي" },
    { id: "ride-2", title: "توصيل مطار الملك عبدالعزيز (جدة) إلى مكة المكرمة", type: "مشاوير الحرمين", price: 280, car_type: "جمس يوكون / فان عائلي", duration: "ساعة واحدة", features: "تسليم أمام الفندق • استيعاب العفش • سائق معتمد" },
    { id: "ride-3", title: "مشوار مباشر: مكة المكرمة إلى المدينة المنورة", type: "بين المدن", price: 550, car_type: "سيارة VIP خاصة عائلية", duration: "4 ساعات", features: "توقف للاستراحة • مشروبات وضيافة • راحة تامة" },
    { id: "ride-4", title: "جولة سياحية خاصة داخل الرياض (يوم كامل 8 ساعات)", type: "جولة سياحية", price: 450, car_type: "سيارة فاخرة مع سائق خاص", duration: "8 ساعات", features: "زيارة الدرعية • البوليفارد • برج المملكة" },
    { id: "ride-5", title: "توصيل مطار الأمير محمد بن عبدالعزيز (المدينة)", type: "توصيل مطار", price: 120, car_type: "سيدان عائلية مريحة", duration: "30 دقيقة", features: "مباشرة إلى فنادق المنطقة المركزية" },
    { id: "ride-6", title: "مشوار قطار الحرمين السريع (توصيل للمحطة)", type: "خدمة محطات", price: 80, car_type: "سيارة حديثة سريعة", duration: "25 دقيقة", features: "دقة في المواعيد لضمان اللحاق بالرحلة" }
  ];

  const availableRides = (catalog?.rides && catalog.rides.length > 0) ? catalog.rides : defaultRides;

  // Filters State
  const [rideFrom, setRideFrom] = useState("");
  const [rideTo, setRideTo] = useState("");
  const [flightOrigin, setFlightOrigin] = useState("");
  const [flightDest, setFlightDest] = useState("");
  const [hotelCity, setHotelCity] = useState("");

  // Booking Modal State
  const [bookingModalItem, setBookingModalItem] = useState<any>(null);
  const [bookingForm, setBookingForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    passport_number: "",
    nationality: "سعودي",
    passengers_count: 1,
    departure_date: new Date().toISOString().slice(0, 10),
    return_date: "",
    payment_method: "credit_card",
    promo_code: "",
    notes: ""
  });

  // Booking Confirmation Result
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Contact / Inquiry Form
  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    phone: "",
    email: "",
    service_interest: "مشوار ونقل سياحي VIP",
    message: ""
  });

  // Book Mutation
  const bookMutation = useMutation({
    mutationFn: (payload: any) =>
      fetch("/api/public/website/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "فشل تسجيل الحجز");
        return d;
      }),
    onSuccess: (data) => {
      setConfirmedBooking(data.booking);
      toast({
        title: "تم تأكيد طلب الحجز بنجاح! 🎉",
        description: `رقم الحجز: ${data.booking.booking_ref} | الرمز المرجعي: ${data.booking.pnr}`
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في عملية الحجز",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const handleOpenBooking = (item: any, type: string, title: string, amount: number) => {
    setBookingModalItem({
      raw: item,
      type,
      title,
      baseAmount: amount,
      origin: item.origin || item.destination_city || item.city || item.from || "",
      destination: item.destination || item.destination_country || item.country || item.to || ""
    });
    setConfirmedBooking(null);
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.customer_name || !bookingForm.customer_phone) {
      toast({ title: "تنبيه", description: "يرجى كتابة الاسم ورقم الجوال للتواصل", variant: "destructive" });
      return;
    }

    const payload = {
      service_type: bookingModalItem.type,
      service_title: bookingModalItem.title,
      customer_name: bookingForm.customer_name,
      customer_phone: bookingForm.customer_phone,
      customer_email: bookingForm.customer_email,
      passport_number: bookingForm.passport_number,
      nationality: bookingForm.nationality,
      origin: bookingModalItem.origin,
      destination: bookingModalItem.destination,
      departure_date: bookingForm.departure_date,
      return_date: bookingForm.return_date,
      passengers_count: Number(bookingForm.passengers_count || 1),
      total_amount: bookingModalItem.baseAmount * Number(bookingForm.passengers_count || 1),
      payment_method: bookingForm.payment_method,
      promo_code: bookingForm.promo_code,
      notes: bookingForm.notes
    };

    bookMutation.mutate(payload);
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setIsLookingUp(true);
    setLookupResults(null);
    try {
      const res = await fetch(`/api/public/website/lookup?query=${encodeURIComponent(lookupQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "لم يتم العثور على حجز");
      setLookupResults(data);
    } catch (err: any) {
      toast({ title: "بحث الحجوزات", description: err.message, variant: "destructive" });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.phone || !inquiryForm.message) {
      toast({ title: "تنبيه", description: "يرجى تعبئة كافة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/public/website/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال الطلب");
      toast({ title: "تم الإرسال بنجاح ✅", description: "سيتواصل معك مستشار الحجوزات قريباً" });
      setInquiryForm({ name: "", phone: "", email: "", service_interest: "مشوار ونقل سياحي VIP", message: "" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  // Filtered flights
  const flights = (catalog?.flights || []).filter((f: any) => {
    if (flightOrigin && !f.origin.toLowerCase().includes(flightOrigin.toLowerCase())) return false;
    if (flightDest && !f.destination.toLowerCase().includes(flightDest.toLowerCase())) return false;
    return true;
  });

  // Filtered hotels
  const hotels = (catalog?.hotels || []).filter((h: any) => {
    if (hotelCity && !h.city.toLowerCase().includes(hotelCity.toLowerCase())) return false;
    return true;
  });

  const defaultPhone = siteConfig?.phone || "+967 779 977 151";
  const whatsappPhone = siteConfig?.whatsapp || "+967779977151";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white pb-20 sm:pb-0" dir="rtl">
      {/* ─── Top Identity & Branding Announcement Bar ─── */}
      <div className="bg-blue-950 text-slate-100 text-[11px] sm:text-xs py-2 px-3 sm:px-8 border-b border-blue-900">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>أكوان للسفريات والسياحة • Akwan Travel & Tourism</span>
            </div>
            <span className="hidden lg:inline-block text-slate-400">|</span>
            <span className="hidden md:flex items-center gap-1 text-slate-300">
              <Headphones className="w-3.5 h-3.5 text-blue-400" />
              <span>خدمة العملاء: هشام السامعي HESHAM ALSAMEAI</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="text-emerald-400 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>{defaultPhone}</span>
            </span>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-blue-900/90 text-blue-200 border border-blue-700/60">حجوزات 24/7</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-900/90 text-emerald-200 border border-emerald-700/60">تأشيرات وطيران</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Navigation Header ─── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Akwan & Njaz Combined Branding Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-blue-600 overflow-hidden bg-white p-0.5 shadow-md shrink-0 flex items-center justify-center">
                <img
                  src="/assets/aistudio/image_9d8afe8b.png"
                  alt="أكوان للسفريات والسياحة"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    // Fallback if image fails
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-xl font-black tracking-tight text-blue-950">
                    أكوان للسفريات والسياحة
                  </span>
                  <Badge className="bg-blue-600 text-white font-bold text-[10px] hidden sm:inline-flex">
                    Akwan Travel
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-semibold leading-none mt-0.5">
                  بوابة الحجوزات والمشاوير الذكية • بالتعاون مع نجاز
                </p>
              </div>
            </div>

            {/* Direct Contact & Tracking Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href={`tel:${defaultPhone.replace(/\s+/g, "")}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">اتصال مباشر</span>
              </a>

              <button
                type="button"
                onClick={() => handleSendWhatsApp(whatsappPhone, "مرحباً، أود استفسار أو حجز رحلة مع أكوان للسفريات والسياحة")}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">واتساب مباشر</span>
              </button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("lookup")}
                className="gap-1.5 text-xs font-bold border-blue-300 text-blue-900 hover:bg-blue-50 rounded-xl px-2.5 sm:px-3.5 h-9"
              >
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden xs:inline">تتبع حجزك</span>
                <span className="xs:hidden">تتبع</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Modern Hero Banner with Akwan Branding Artwork ─── */}
      <section className="relative bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-900 text-white pt-8 sm:pt-14 pb-20 sm:pb-28 overflow-hidden">
        {/* Background Glowing Ring Effects inspired by uploaded image */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-20 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center mb-8 sm:mb-12">
            
            {/* Right Side Info & Headlines */}
            <div className="lg:col-span-8 text-center lg:text-right">
              {/* Top Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-900/80 border border-blue-400/40 text-blue-100 text-xs font-bold mb-4 shadow-sm backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>أكوان للسفريات والسياحة — خدمات سريعة وحجوزات موثوقة 100%</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                سافر بكل راحة وأمان.. <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-sky-300">
                  مع أكوان للسفريات والسياحة
                </span>
              </h1>

              <p className="text-slate-300 text-xs sm:text-base leading-relaxed font-medium max-w-2xl mx-auto lg:mx-0">
                حجوزات طيران عالمية ومحلية، مشاوير ونقل مطارات وحرمين، فنادق فاخرة، باقات سياحية وتأشيرات سفر بكل سرعة وسهولة وبأفضل الأسعار.
              </p>

              {/* Official Customer Contact Badge */}
              <div className="mt-5 inline-flex items-center gap-3 bg-white/10 backdrop-blur-md p-2.5 px-4 rounded-2xl border border-white/20 text-right">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-emerald-300 font-bold">خدمة العملاء والمشاوير 24/7</div>
                  <div className="text-xs sm:text-sm font-black text-white">هشام السامعي HESHAM ALSAMEAI</div>
                  <div className="text-[11px] text-amber-300 font-bold dir-ltr flex gap-2">
                    <span>{defaultPhone}</span>
                    <span>•</span>
                    <span>+967 718 100 074</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Side Branding Visual Card (Desktop / Tablet) */}
            <div className="lg:col-span-4 hidden lg:flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-slate-900 border-2 border-blue-400/50 p-4 rounded-3xl text-center space-y-3 max-w-xs shadow-2xl">
                  <div className="w-36 h-36 mx-auto rounded-full border-4 border-amber-400 p-1 bg-white shadow-xl overflow-hidden">
                    <img
                      src="/assets/aistudio/image_9d8afe8b.png"
                      alt="أكوان للسفريات والسياحة"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">أكوان للسفريات والسياحة</h3>
                    <p className="text-xs text-amber-300 font-semibold">Akwan Travel & Tourism</p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>وكالة معتمدة وموثوقة</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ─── Modern Booking Console Tabs ─── */}
          <div className="bg-white rounded-3xl p-3 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 max-w-5xl mx-auto">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              {/* Horizontal Scrollable Tabs */}
              <TabsList className="flex sm:grid sm:grid-cols-7 overflow-x-auto no-scrollbar scroll-smooth h-auto p-1.5 bg-slate-100 rounded-2xl gap-1 mb-5">
                {siteConfig?.rides_enabled !== 0 && (
                  <TabsTrigger
                    value="rides"
                    className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-900 data-[state=active]:text-white transition-all"
                  >
                    <Car className="w-4 h-4" />
                    <span>المشاوير والنقل</span>
                  </TabsTrigger>
                )}
                {siteConfig?.flight_enabled !== 0 && (
                  <TabsTrigger
                    value="flights"
                    className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-900 data-[state=active]:text-white transition-all"
                  >
                    <Plane className="w-4 h-4" />
                    <span>طيران</span>
                  </TabsTrigger>
                )}
                {siteConfig?.hotel_enabled !== 0 && (
                  <TabsTrigger
                    value="hotels"
                    className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-900 data-[state=active]:text-white transition-all"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>فنادق</span>
                  </TabsTrigger>
                )}
                {siteConfig?.packages_enabled !== 0 && (
                  <TabsTrigger
                    value="packages"
                    className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-900 data-[state=active]:text-white transition-all"
                  >
                    <Compass className="w-4 h-4" />
                    <span>باقات وعمرة</span>
                  </TabsTrigger>
                )}
                {siteConfig?.visas_enabled !== 0 && (
                  <TabsTrigger
                    value="visas"
                    className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-900 data-[state=active]:text-white transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>تأشيرات</span>
                  </TabsTrigger>
                )}
                {siteConfig?.bus_enabled !== 0 && (
                  <TabsTrigger
                    value="buses"
                    className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-blue-900 data-[state=active]:text-white transition-all"
                  >
                    <Bus className="w-4 h-4" />
                    <span>باصات</span>
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="lookup"
                  className="shrink-0 rounded-xl py-2 sm:py-2.5 px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-slate-950 data-[state=active]:text-white transition-all"
                >
                  <Search className="w-4 h-4" />
                  <span>تتبع حجزك</span>
                </TabsTrigger>
              </TabsList>

              {/* ─── TAB 1: RIDES & TRANSFERS (المشاوير والنقل) ─── */}
              {siteConfig?.rides_enabled !== 0 && (
                <TabsContent value="rides" className="space-y-4 mt-0">
                  <div className="bg-blue-50/80 p-3 sm:p-4 rounded-2xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-xs shrink-0">
                        <Car className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm">خدمات المشاوير والنقل الخاص والمطارات والحرمين</h4>
                        <p className="text-[11px] sm:text-xs text-slate-600">سيارات حديثة وسائقون محترفون بتنسيق مباشر مع هشام السامعي 24/7</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold text-[10px] sm:text-xs py-1 shrink-0">
                      تأكيد فوري بالواتساب
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {availableRides.map((ride: any) => (
                      <Card
                        key={ride.id}
                        className="rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden group bg-white"
                      >
                        <CardHeader className="p-4 pb-2 bg-gradient-to-l from-blue-50/50 to-white border-b border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <Badge className="bg-blue-900 text-white text-[10px] font-bold">{ride.badge || ride.type || "مشوار خاص"}</Badge>
                            {ride.duration && (
                              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-600" /> {ride.duration}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                            {ride.title}
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="p-4 space-y-3">
                          <div className="text-xs text-slate-600 space-y-1.5">
                            {ride.car_type && (
                              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                <Car className="w-3.5 h-3.5 text-blue-600" />
                                <span>{ride.car_type}</span>
                              </div>
                            )}
                            {ride.features && (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{ride.features}</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block">السعر الصافي</span>
                              <span className="text-lg font-black text-blue-900">{fmt(ride.price)} ر.س</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleOpenBooking(ride, "ride", ride.title, ride.price)}
                              className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black px-4 shadow-xs"
                            >
                              احجز المشوار
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* ─── TAB 2: FLIGHTS ─── */}
              {siteConfig?.flight_enabled !== 0 && (
                <TabsContent value="flights" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">مدينة المغادرة</label>
                      <Input
                        placeholder="مثال: الرياض، جدة، صنعاء، عدن..."
                        value={flightOrigin}
                        onChange={(e) => setFlightOrigin(e.target.value)}
                        className="bg-white rounded-xl text-xs h-10"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">وجهة الوصول</label>
                      <Input
                        placeholder="مثال: دبي، القاهرة، عمان، اسطنبول..."
                        value={flightDest}
                        onChange={(e) => setFlightDest(e.target.value)}
                        className="bg-white rounded-xl text-xs h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {flights.map((f: any) => (
                      <div
                        key={f.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex flex-col items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                            <span>{f.airline_code || "IY"}</span>
                            <span className="text-[10px] text-slate-500 font-normal">{f.flight_no}</span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{f.airline_name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{f.origin}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 rotate-180" />
                              <span className="font-semibold text-slate-800">{f.destination}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-xs text-slate-600">
                          <div>
                            <span className="block text-[10px] text-slate-400">الإقلاع</span>
                            <span className="font-bold text-slate-900 text-sm">{f.departure_time}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400">الوصول</span>
                            <span className="font-bold text-slate-900 text-sm">{f.arrival_time}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-slate-400 block">الإجمالي الشامل</span>
                            <span className="text-lg font-black text-blue-900">{fmt(f.total_fare)} ر.س</span>
                          </div>
                          <Button
                            onClick={() => handleOpenBooking(f, "flight", `${f.airline_name} (${f.flight_no}) من ${f.origin} إلى ${f.destination}`, f.total_fare)}
                            className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold h-10 px-5"
                          >
                            احجز الآن
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* ─── TAB 3: HOTELS ─── */}
              {siteConfig?.hotel_enabled !== 0 && (
                <TabsContent value="hotels" className="space-y-4 mt-0">
                  <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
                    <Input
                      placeholder="ابحث بالمدينة (مثال: مكة المكرمة، المدينة المنورة، جدة، الرياض)"
                      value={hotelCity}
                      onChange={(e) => setHotelCity(e.target.value)}
                      className="bg-white rounded-xl text-xs h-10"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {hotels.map((h: any) => (
                      <Card key={h.id} className="rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
                        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between">
                          <div>
                            <CardTitle className="text-sm font-bold text-slate-900">{h.hotel_name}</CardTitle>
                            <CardDescription className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{h.city} - {h.country || "المملكة العربية السعودية"}</span>
                            </CardDescription>
                          </div>
                          <div className="flex items-center text-amber-500 text-xs font-bold gap-0.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span>{h.star_rating || 5} نجوم</span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="text-xs text-slate-500">
                            <span className="block font-medium text-slate-700">{h.amenities || "واي فاي مجاني • إفطار • خدمة غرف"}</span>
                          </div>
                          <div className="text-left shrink-0">
                            <span className="text-[10px] text-slate-400 block">الليلة ابتداءً من</span>
                            <span className="text-base font-black text-blue-900 mb-2 block">{fmt(h.avg_room_rate || 450)} ر.س</span>
                            <Button
                              size="sm"
                              onClick={() => handleOpenBooking(h, "hotel", `حجز فندق: ${h.hotel_name} (${h.city})`, h.avg_room_rate || 450)}
                              className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold"
                            >
                              احجز الغرفة
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* ─── TAB 4: PACKAGES ─── */}
              {siteConfig?.packages_enabled !== 0 && (
                <TabsContent value="packages" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {(catalog?.packages || []).map((pkg: any) => (
                      <Card key={pkg.id} className="rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-950 to-indigo-900 text-white p-4">
                          <Badge className="bg-amber-400 text-slate-950 font-bold text-[10px] mb-2">{pkg.package_type || "برنامج سياحي"}</Badge>
                          <h4 className="text-base font-bold leading-tight">{pkg.package_name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-300 mt-2">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{pkg.duration_days || 7} أيام / {pkg.duration_nights || 6} ليالٍ</span>
                          </div>
                        </div>
                        <CardContent className="p-4 space-y-3">
                          <div className="text-xs text-slate-600">
                            <div className="flex items-center gap-1.5 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-blue-600" />
                              <span>{pkg.destination_city} - {pkg.destination_country}</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block">للفرد ابتداءً من</span>
                              <span className="text-base font-black text-blue-900">{fmt(pkg.price_per_person || 2400)} ر.س</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleOpenBooking(pkg, "package", `باقة: ${pkg.package_name}`, pkg.price_per_person || 2400)}
                              className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold"
                            >
                              احجز الباقة
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* ─── TAB 5: VISAS ─── */}
              {siteConfig?.visas_enabled !== 0 && (
                <TabsContent value="visas" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {(catalog?.visas || []).map((v: any, idx: number) => (
                      <Card key={idx} className="rounded-2xl border border-slate-200 hover:border-blue-400 transition-all">
                        <CardHeader className="p-4 pb-2 bg-blue-50/60 border-b border-blue-100">
                          <Badge className="w-fit bg-blue-900 text-white text-[10px] font-bold mb-1">خدمة معتمدة</Badge>
                          <CardTitle className="text-sm font-bold text-slate-900">{v.country}</CardTitle>
                          <CardDescription className="text-xs text-slate-600 font-medium">{v.type}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="text-xs text-slate-500">
                            <div><strong className="text-slate-700">المدة المتوقعة:</strong> {v.processing_days}</div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-base font-black text-blue-900">{fmt(v.price)} ر.س</span>
                            <Button
                              size="sm"
                              onClick={() => handleOpenBooking(v, "visa", `تأشيرة: ${v.country}`, v.price)}
                              className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold"
                            >
                              طلب التأشيرة
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* ─── TAB 6: BUSES ─── */}
              {siteConfig?.bus_enabled !== 0 && (
                <TabsContent value="buses" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {(catalog?.buses || []).map((b: any, idx: number) => (
                      <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                            <Bus className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>من {b.from} إلى {b.to}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{b.operator} • {b.departure_time}</div>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="text-base font-black text-slate-900 block">{fmt(b.price)} ر.س</span>
                          <Button
                            size="sm"
                            onClick={() => handleOpenBooking(b, "bus", `تذكرة باص من ${b.from} إلى ${b.to}`, b.price)}
                            className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold mt-1"
                          >
                            احجز
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* ─── TAB 7: LOOKUP ─── */}
              <TabsContent value="lookup" className="space-y-6 mt-0">
                <div className="max-w-xl mx-auto text-center space-y-4 py-2 sm:py-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto border border-blue-200">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">استعلام وتتبع حجز أكوان للسفريات</h3>
                    <p className="text-xs text-slate-500 mt-1">أدخل رقم الحجز المرجعي أو رقم الجوال للاطلاع على تفاصيل تذكرتك وتحميلها</p>
                  </div>

                  <form onSubmit={handleLookupSubmit} className="flex gap-2">
                    <Input
                      placeholder="رقم الحجز (مثل: WEB-123456) أو رقم الجوال"
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      className="rounded-xl h-11 text-xs bg-slate-50 font-medium"
                    />
                    <Button type="submit" disabled={isLookingUp} className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl h-11 px-4 sm:px-6 font-bold text-xs shrink-0">
                      {isLookingUp ? "جارٍ البحث..." : "استعلام"}
                    </Button>
                  </form>
                </div>

                {lookupResults && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    {(lookupResults.online_bookings || []).map((b: any) => (
                      <div key={b.id} className="p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-900 text-white text-xs">{b.booking_ref}</Badge>
                            <span className="font-bold text-slate-900 text-sm">{b.service_title}</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3 sm:gap-4">
                            <span><strong>المسافر:</strong> {b.customer_name}</span>
                            <span><strong>رقم PNR:</strong> {b.pnr}</span>
                            <span><strong>الحالة:</strong> مؤكد ✅</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
                          <span className="font-black text-slate-900 text-sm">{fmt(b.total_amount)} ر.س</span>
                          <Button size="sm" onClick={() => window.print()} variant="outline" className="rounded-xl text-xs gap-1">
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة التذكرة</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* ─── BOOKING MODAL & CHECKOUT ─── */}
      {bookingModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto">
            {!confirmedBooking ? (
              <form onSubmit={handleConfirmSubmit} className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <Badge className="bg-blue-50 text-blue-900 border-blue-200 mb-1">أكوان للسفريات والسياحة</Badge>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">{bookingModalItem.title}</h3>
                    <p className="text-xs text-slate-500">القيمة الأساسية: {fmt(bookingModalItem.baseAmount)} ر.س</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBookingModalItem(null)}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    ✕
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">الاسم الكامل *</label>
                    <Input
                      required
                      placeholder="كما هو مدون في الهوية أو الجواز"
                      value={bookingForm.customer_name}
                      onChange={(e) => setBookingForm({ ...bookingForm, customer_name: e.target.value })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">رقم الجوال (واتساب) *</label>
                    <Input
                      required
                      placeholder="05XXXXXXXX"
                      value={bookingForm.customer_phone}
                      onChange={(e) => setBookingForm({ ...bookingForm, customer_phone: e.target.value })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">تاريخ الحجز المفضل</label>
                    <Input
                      type="date"
                      value={bookingForm.departure_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, departure_date: e.target.value })}
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>

                {/* Payment Selection */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 block">طريقة السداد:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={`p-2 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${bookingForm.payment_method === "credit_card" ? "bg-blue-50 border-blue-600 text-blue-900 font-bold" : "bg-white border-slate-200"}`}>
                      <input
                        type="radio"
                        name="pay"
                        className="hidden"
                        checked={bookingForm.payment_method === "credit_card"}
                        onChange={() => setBookingForm({ ...bookingForm, payment_method: "credit_card" })}
                      />
                      <CreditCard className="w-4 h-4 mb-1 text-blue-600" />
                      <span className="text-[11px]">بطاقة بنكية</span>
                    </label>

                    <label className={`p-2 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${bookingForm.payment_method === "bank_transfer" ? "bg-blue-50 border-blue-600 text-blue-900 font-bold" : "bg-white border-slate-200"}`}>
                      <input
                        type="radio"
                        name="pay"
                        className="hidden"
                        checked={bookingForm.payment_method === "bank_transfer"}
                        onChange={() => setBookingForm({ ...bookingForm, payment_method: "bank_transfer" })}
                      />
                      <Building2 className="w-4 h-4 mb-1 text-blue-600" />
                      <span className="text-[11px]">تحويل بنكي</span>
                    </label>

                    <label className={`p-2 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${bookingForm.payment_method === "pay_at_branch" ? "bg-blue-50 border-blue-600 text-blue-900 font-bold" : "bg-white border-slate-200"}`}>
                      <input
                        type="radio"
                        name="pay"
                        className="hidden"
                        checked={bookingForm.payment_method === "pay_at_branch"}
                        onChange={() => setBookingForm({ ...bookingForm, payment_method: "pay_at_branch" })}
                      />
                      <MapPin className="w-4 h-4 mb-1 text-slate-700" />
                      <span className="text-[11px]">دفع بالفرع</span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">الإجمالي المستحق</span>
                    <span className="text-lg sm:text-xl font-black text-blue-900">
                      {fmt(bookingModalItem.baseAmount)} ر.س
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setBookingModalItem(null)} className="rounded-xl text-xs">
                      إلغاء
                    </Button>
                    <Button type="submit" disabled={bookMutation.isPending} className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold px-4 sm:px-6">
                      {bookMutation.isPending ? "جارٍ التأكيد..." : "تأكيد الحجز فورياً"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              /* Success Boarding Card Ticket */
              <div className="text-center py-4 space-y-4">
                <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 sm:w-10 h-8 sm:h-10" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">تم تسجيل حجزك بنجاح في أكوان للسفريات! 🎉</h3>
                  <p className="text-xs text-slate-500 mt-1">تذكرتك وقسيمة الخدمة معتمدة وجاهزة للاستخدام</p>
                </div>

                {/* Digital Boarding Pass Ticket */}
                <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl text-right relative overflow-hidden shadow-lg border-2 border-amber-400">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <NjazSymbol size={28} />
                      <span className="font-black text-xs sm:text-sm">أكوان للسفريات والسياحة</span>
                    </div>
                    <Badge className="bg-amber-400 text-slate-950 font-bold font-mono text-xs">{confirmedBooking.booking_ref}</Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">المسافر:</span>
                      <span className="font-bold text-white">{confirmedBooking.customer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">الخدمة:</span>
                      <span className="font-bold text-amber-300">{confirmedBooking.service_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">رقم PNR المرجعي:</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">{confirmedBooking.pnr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">المبلغ الإجمالي:</span>
                      <span className="font-black text-amber-300 text-base">{fmt(confirmedBooking.total_amount)} ر.س</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    onClick={() => window.print()}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة التذكرة</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      handleSendWhatsApp(
                        whatsappPhone,
                        `مرحباً أكوان للسفريات، تم حجز ${confirmedBooking.booking_ref} باسم ${confirmedBooking.customer_name}`
                      )
                    }
                    className="flex-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>إرسال للواتساب</span>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBookingModalItem(null);
                    setConfirmedBooking(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 mt-2"
                >
                  إغلاق ومتابعة التصفح
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CUSTOM INQUIRY & CONTACT SECTION ─── */}
      <section className="bg-slate-100 py-12 sm:py-16 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-3 sm:px-6">
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-lg border border-slate-200">
            <div className="text-center max-w-xl mx-auto mb-6">
              <Badge className="bg-blue-50 text-blue-900 border-blue-200 mb-2">طلب مشوار أو رحلة مخصصة</Badge>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">هل تحتاج ترتيب مشوار خاص أو باقة سفر عائلية؟</h3>
              <p className="text-xs text-slate-500 mt-1">فريق أكوان للسفريات والسياحة برئاسة هشام السامعي جاهز لخدمتك على مدار الساعة</p>
            </div>

            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الاسم الكريم *</label>
                  <Input
                    required
                    placeholder="اسمك الكريم"
                    value={inquiryForm.name}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                    className="rounded-xl text-xs h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">رقم الهاتف / الواتساب *</label>
                  <Input
                    required
                    placeholder="05XXXXXXXX"
                    value={inquiryForm.phone}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    className="rounded-xl text-xs h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الخدمة المطلوبة</label>
                  <select
                    value={inquiryForm.service_interest}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, service_interest: e.target.value })}
                    className="w-full h-10 bg-white border border-slate-300 rounded-xl text-xs px-3 font-medium"
                  >
                    <option value="مشوار ونقل سياحي VIP">مشوار ونقل سياحي VIP</option>
                    <option value="توصيل واستقبال مطار">توصيل واستقبال مطار</option>
                    <option value="حجوزات طيران">حجوزات طيران وتذاكر</option>
                    <option value="باقة عمرة وزيارة">باقة عمرة وزيارة</option>
                    <option value="تأشيرات سياحية">تأشيرات سياحية</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">تفاصيل المشوار أو الرحلة *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="حدد نقطة الانطلاق والوصول، التاريخ والوقت، وعدد الأفراد..."
                  value={inquiryForm.message}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl text-xs p-3 font-medium focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="w-full sm:w-auto bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold h-10 px-8">
                  إرسال الطلب لمستشار السفر
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ─── FOOTER WITH FULL BRANDING ─── */}
      <footer className="bg-blue-950 text-slate-300 py-12 border-t border-blue-900 mt-auto text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full border border-amber-400 overflow-hidden bg-white p-0.5 shrink-0">
                <img
                  src="/assets/aistudio/image_9d8afe8b.png"
                  alt="أكوان للسفريات والسياحة"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="font-black text-sm text-white">أكوان للسفريات والسياحة</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mt-2">
              وكالة أكوان للسفريات والسياحة — نسعد بخدمتكم في حجوزات الطيران الدولية والمحلية، المشاوير السياحية وتوصيل المطارات، الفنادق، وباقات السفر المتكاملة.
            </p>
            <div className="pt-2 text-amber-400 font-bold text-xs">
              خدمة العملاء: هشام السامعي HESHAM ALSAMEAI
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-3">الخدمات السريعة</h4>
            <ul className="space-y-2 text-slate-300">
              <li><button onClick={() => setActiveTab("rides")} className="hover:text-amber-400 transition-colors">المشاوير وتوصيل المطارات VIP</button></li>
              <li><button onClick={() => setActiveTab("flights")} className="hover:text-amber-400 transition-colors">حجز تذاكر الطيران المباشرة</button></li>
              <li><button onClick={() => setActiveTab("hotels")} className="hover:text-amber-400 transition-colors">حجوزات الفنادق والمنتجعات</button></li>
              <li><button onClick={() => setActiveTab("packages")} className="hover:text-amber-400 transition-colors">باقات العمرة والرحلات</button></li>
              <li><button onClick={() => setActiveTab("visas")} className="hover:text-amber-400 transition-colors">خدمات التأشيرات السريعة</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-3">التواصل المباشر</h4>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-amber-400" /> <span>{defaultPhone}</span></li>
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-amber-400" /> <span>+967 718 100 074</span></li>
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-amber-400" /> <span>info@akwan-travel.com</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-3">ضمانات الخدمة</h4>
            <p className="text-slate-400 mb-3 text-xs leading-relaxed">
              جميع الحجوزات مؤكدة برقم مرجعي PNR رسمي معتمد، مع متابعة دقيقة وتواصل مباشر بالواتساب طوال رحلتك.
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-900 border border-blue-800 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>حجوزات آمنة ومرخصة 100%</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-blue-900 text-center text-slate-400 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>جميع الحقوق محفوظة © {new Date().getFullYear()} أكوان للسفريات والسياحة — Akwan Travel & Tourism.</span>
          <span className="text-amber-400 font-bold">بوابة الحجوزات الذكية والسريعة</span>
        </div>
      </footer>

      {/* ─── Mobile Sticky Bottom Navigation ─── */}
      <nav aria-label="شريط التنقل السريع للهواتف" className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => { setActiveTab("rides"); window.scrollTo({ top: 120, behavior: "smooth" }); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
            activeTab === "rides" ? "text-blue-900 font-bold scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Car className="w-5 h-5" />
          <span className="text-[10px]">المشاوير</span>
        </button>

        <button
          onClick={() => { setActiveTab("flights"); window.scrollTo({ top: 120, behavior: "smooth" }); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
            activeTab === "flights" ? "text-blue-900 font-bold scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Plane className="w-5 h-5" />
          <span className="text-[10px]">الطيران</span>
        </button>

        <button
          onClick={() => { setActiveTab("hotels"); window.scrollTo({ top: 120, behavior: "smooth" }); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
            activeTab === "hotels" ? "text-blue-900 font-bold scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span className="text-[10px]">الفنادق</span>
        </button>

        <button
          onClick={() => { setActiveTab("lookup"); window.scrollTo({ top: 120, behavior: "smooth" }); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
            activeTab === "lookup" ? "text-blue-900 font-bold scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px]">تتبع حجزك</span>
        </button>

        <button
          type="button"
          onClick={() => handleSendWhatsApp(whatsappPhone, "مرحباً أكوان للسفريات، أود الاستفسار والحجز معكم")}
          className="flex flex-col items-center gap-0.5 py-1 px-2 text-emerald-600 hover:text-emerald-700 transition-all font-bold cursor-pointer"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">واتساب</span>
        </button>
      </nav>

      {/* ─── WhatsApp One-Time Permission & Send Mode Dialog ─── */}
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
    </div>
  );
}
