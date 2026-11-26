import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  Building2,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Star,
  MapPin,
  Layers,
  ArrowRight,
  Percent,
  Check,
  Hotel,
  Globe,
  ShieldCheck,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Aggregator {
  id: number;
  supplier_code: string;
  supplier_name: string;
  api_endpoint: string;
  status: string;
  avg_latency_ms: number;
  currency: string;
  credit_balance: number;
}

interface MarkupRule {
  id: number;
  rule_name: string;
  channel: string;
  service_type: string;
  destination_country: string;
  airline_or_chain: string;
  markup_type: string;
  markup_value: number;
  discount_value: number;
  priority: number;
  is_active: number;
  notes?: string;
}

interface HotelResult {
  id: string;
  name: string;
  city: string;
  rating: number;
  supplier: string;
  board_type: string;
  room_type: string;
  cancellation: string;
  base_rate_usd: number;
  base_rate_sar: number;
  sell_rate_sar: number;
  markup_applied_pct: number;
  agent_margin_sar: number;
  applied_rule: string;
  image_url: string;
}

export default function TravelHotelAggregator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"search" | "markup_matrix" | "suppliers">("search");

  // Search state
  const [cityQuery, setCityQuery] = useState("مكة المكرمة");
  const [selectedChannel, setSelectedChannel] = useState("b2c_web");
  const [searchResults, setSearchResults] = useState<HotelResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<HotelResult | null>(null);
  const [bookingGuest, setBookingGuest] = useState({ name: "محمد العتيبي", phone: "0551122334" });
  const [bookedSuccess, setBookedSuccess] = useState<any | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Markup Rules state
  const [markupRules, setMarkupRules] = useState<MarkupRule[]>([]);
  const [suppliers, setSuppliers] = useState<Aggregator[]>([]);
  const [newRuleModal, setNewRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    rule_name: "",
    channel: "all",
    service_type: "hotel",
    destination_country: "all",
    airline_or_chain: "all",
    markup_type: "percentage",
    markup_value: 5.0,
    discount_value: 0.0,
    priority: 1,
    notes: ""
  });

  const loadData = async () => {
    try {
      const [resRules, resSupp] = await Promise.all([
        fetch("/api/travel/markup-rules").then(r => r.json()),
        fetch("/api/travel/hotel-aggregators").then(r => r.json())
      ]);
      if (resRules.success) setMarkupRules(resRules.data);
      if (resSupp.success) setSuppliers(resSupp.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    handleSearchHotels();
  }, []);

  const handleSearchHotels = async () => {
    setIsSearching(true);
    setSelectedHotel(null);
    setBookedSuccess(null);
    try {
      const res = await fetch("/api/travel/hotel-aggregators/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: cityQuery,
          channel: selectedChannel
        })
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل استعلام مجمعات الفنادق", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.rule_name) return;
    try {
      const res = await fetch("/api/travel/markup-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleForm)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحفظ بنجاح", description: data.message });
        setNewRuleModal(false);
        setRuleForm({
          rule_name: "",
          channel: "all",
          service_type: "hotel",
          destination_country: "all",
          airline_or_chain: "all",
          markup_type: "percentage",
          markup_value: 5.0,
          discount_value: 0.0,
          priority: 1,
          notes: ""
        });
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر حفظ قاعدة التسعير", variant: "destructive" });
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/travel/markup-rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: data.message });
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر حذف القاعدة", variant: "destructive" });
    }
  };

  const handleBookHotel = () => {
    if (!selectedHotel) return;
    const confCode = "HTL-" + Math.floor(100000 + Math.random() * 900000);
    setBookedSuccess({
      confirmation_code: confCode,
      hotel_name: selectedHotel.name,
      guest_name: bookingGuest.name,
      supplier: selectedHotel.supplier,
      amount: selectedHotel.sell_rate_sar,
      voucher_url: `/api/travel/vouchers/${confCode}`
    });
    toast({ title: "تم تأكيد الحجز الفندقي", description: `رقم التأكيد: ${confCode} عبر ${selectedHotel.supplier}` });
  };

  return (
    <AdminLayout>
      <div className="p-2 sm:p-4 lg:p-6 space-y-5 max-w-7xl mx-auto text-right" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-800/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 sm:p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl shrink-0">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-snug">
                  مجمع الفنادق العالمي ومحرك الهامش الديناميكي
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed">
                  البحث الموحد عبر كبرى بنوك الغرف العالمية (Hotelbeds, WebBeds, TBO, Expedia) مع إدارة هوامش الربح وقواعد الخصم التلقائية
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link href="/travel-dashboard" className="flex-1 sm:flex-initial">
                <button
                  type="button"
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  <span>لوحة القيادة</span>
                </button>
              </Link>
              <button
                onClick={() => setNewRuleModal(true)}
                className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs sm:text-sm font-black shadow-md transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>إضافة قاعدة تسعير</span>
              </button>
            </div>
          </div>

          {/* Responsive Tab Navigation */}
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/10 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveTab("search")}
              className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "search"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "bg-slate-800/70 text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>محرك البحث والمقارنة</span>
            </button>
            <button
              onClick={() => setActiveTab("markup_matrix")}
              className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "markup_matrix"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "bg-slate-800/70 text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Percent className="w-4 h-4 shrink-0" />
              <span>مصفوفة الهوامش ({markupRules.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "suppliers"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "bg-slate-800/70 text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>بوابات المزودين ({suppliers.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Search & Booking */}
        {activeTab === "search" && (
          <div className="space-y-5">
            {/* Responsive Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">المدينة أو الوجهة السياحية</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={e => setCityQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearchHotels()}
                    placeholder="ابحث بالمدينة (مكة، دبي، إسطنبول، طرابزون...)"
                    className="w-full h-11 pr-9 pl-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">قناة التسعير الديناميكية</label>
                <div className="relative">
                  <SlidersHorizontal className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedChannel}
                    onChange={e => setSelectedChannel(e.target.value)}
                    className="w-full h-11 pr-9 pl-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="b2c_web">مبيعات الأفراد B2C Web Portal (+7.5%)</option>
                    <option value="b2b_platinum">وكيل B2B بلاتيني معتمد (+2.0% - خصم 1.5%)</option>
                    <option value="b2b_gold">وكيل B2B ذهبي (+3.5%)</option>
                    <option value="walk_in">مبيعات الفرع المباشرة Walk-In (+8.0%)</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-3">
                <button
                  onClick={handleSearchHotels}
                  disabled={isSearching}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>{isSearching ? "جارِ مقارنة المزودين..." : "بحث ومقارنة الأسعار"}</span>
                </button>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Hotel Results List */}
              <div className="lg:col-span-7 space-y-3.5">
                {searchResults.length === 0 && !isSearching ? (
                  <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center space-y-3">
                    <Hotel className="w-12 h-12 mx-auto text-slate-300" />
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">لا توجد نتائج مطابقة للبحث</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      جرّب تغيير اسم المدينة أو قناة التسعير ثم اضغط على زر البحث ومقارنة الأسعار.
                    </p>
                  </div>
                ) : (
                  searchResults.map((hotel, idx) => {
                    const isSelected = selectedHotel?.id === hotel.id;
                    const isImgBroken = brokenImages[hotel.id];
                    return (
                      <div
                        key={`travelhotelaggregator-hotel-id-${hotel.id || idx}-${idx}`}
                        onClick={() => {
                          setSelectedHotel(hotel);
                          setBookedSuccess(null);
                        }}
                        className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition-all flex flex-col sm:flex-row gap-3.5 sm:gap-4 ${
                          isSelected
                            ? "bg-emerald-50/70 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                        }`}
                      >
                        {/* Resilient Image Container */}
                        {hotel.image_url && !isImgBroken ? (
                          <img
                            src={hotel.image_url}
                            alt={hotel.name}
                            referrerPolicy="no-referrer"
                            onError={() => setBrokenImages(prev => ({ ...prev, [hotel.id]: true }))}
                            className="w-full sm:w-36 h-40 sm:h-32 object-cover rounded-xl shrink-0 bg-slate-100"
                          />
                        ) : (
                          <div className="w-full sm:w-36 h-40 sm:h-32 rounded-xl shrink-0 bg-gradient-to-br from-slate-800 to-emerald-950 text-emerald-300 flex flex-col items-center justify-center p-3 text-center">
                            <Hotel className="w-8 h-8 mb-1 opacity-80" />
                            <span className="text-[11px] font-bold text-white/90 line-clamp-1">{hotel.city}</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 text-amber-500">
                                {Array.from({ length: Math.min(5, Math.max(1, hotel.rating || 4)) }).map((_, i) => (
                                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                ))}
                                <span className="text-[11px] text-slate-500 font-medium mr-1">{hotel.supplier}</span>
                              </div>
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base mt-1 leading-snug">{hotel.name}</h3>
                              <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{hotel.city} · {hotel.room_type}</span>
                              </p>
                            </div>

                            <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              <div className="text-base sm:text-lg font-black text-emerald-700 font-mono tabular-nums">
                                {hotel.sell_rate_sar.toLocaleString()} <span className="text-xs font-sans font-bold">ر.س</span>
                              </div>
                              <div className="text-[11px] text-slate-400 line-through font-mono tabular-nums">
                                التكلفة: {hotel.base_rate_sar.toLocaleString()} ر.س
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-emerald-800">{hotel.board_type}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-sky-700 font-medium">{hotel.cancellation}</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-800 font-mono tabular-nums">
                              الهامش: +{hotel.agent_margin_sar} ر.س ({hotel.markup_applied_pct}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sticky Instant Hotel Booking & Voucher Generation Panel */}
              <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
                {selectedHotel ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        تأكيد حجز الفندق وإصدار الفاوتشر
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        المزود المعتمد: <span className="font-bold text-slate-900">{selectedHotel.supplier}</span>
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                        <div className="font-bold text-sm text-slate-900">{selectedHotel.name}</div>
                        <div className="text-slate-600">نوع الغرفة: {selectedHotel.room_type}</div>
                        <div className="text-emerald-700 font-semibold">نظام الوجبات: {selectedHotel.board_type}</div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 block">بيانات النزيل الرئيسي</label>
                        <input
                          type="text"
                          value={bookingGuest.name}
                          onChange={e => setBookingGuest(p => ({ ...p, name: e.target.value }))}
                          placeholder="اسم النزيل الثلاثي"
                          className="w-full h-11 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={bookingGuest.phone}
                          onChange={e => setBookingGuest(p => ({ ...p, phone: e.target.value }))}
                          placeholder="رقم الجوال لتلقي الفاوتشر وتفاصيل الحجز"
                          className="w-full h-11 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between font-black text-emerald-900 text-sm">
                          <span>إجمالي سعر البيع:</span>
                          <span className="font-mono tabular-nums">{selectedHotel.sell_rate_sar.toLocaleString()} ريال</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 text-xs font-semibold">
                          <span>صافي ربح الوكالة:</span>
                          <span className="font-mono tabular-nums">+{selectedHotel.agent_margin_sar.toLocaleString()} ريال</span>
                        </div>
                      </div>

                      <button
                        onClick={handleBookHotel}
                        className="w-full min-h-[46px] py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>تأكيد الحجز الفوري وإصدار الفاوتشر</span>
                      </button>

                      {bookedSuccess && (
                        <div className="p-4 bg-emerald-50 border border-emerald-400 rounded-xl space-y-1.5 animate-in fade-in">
                          <div className="text-xs sm:text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                            <Check className="w-4 h-4 shrink-0" />
                            <span>تم تأكيد الحجز برقم: {bookedSuccess.confirmation_code}</span>
                          </div>
                          <p className="text-[11px] text-emerald-700 font-mono">
                            المزود: {bookedSuccess.supplier} · النزيل: {bookedSuccess.guest_name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-10 text-center text-slate-500 space-y-2">
                    <Building2 className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                    <h4 className="font-bold text-sm text-slate-800">اختر فندقاً من القائمة</h4>
                    <p className="text-xs text-slate-500">انقر على أي فندق لعرض تفاصيل الغرفة وتأكيد الحجز الفوري</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Markup Matrix */}
        {activeTab === "markup_matrix" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>قواعد تسعير الهوامش والخصومات السياحية</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono tabular-nums">{markupRules.length} قواعد معرفة</span>
            </div>

            {markupRules.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <Percent className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">لا توجد قواعد تسعير مضافة بعد</p>
                <button
                  onClick={() => setNewRuleModal(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  + إضافة أول قاعدة
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
                  {markupRules.map((rule, idx) => (
                    <div key={`mobile-rule-${rule.id || idx}`} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{rule.rule_name}</h4>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {rule.channel} · {rule.service_type} · أولوية {rule.priority}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="حذف القاعدة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-mono">
                        <span className="font-bold text-emerald-700">
                          الهامش: {rule.markup_type === "percentage" ? `${rule.markup_value}%` : `${rule.markup_value} ريال`}
                        </span>
                        <span className="text-sky-700 font-bold">
                          خصم: {rule.discount_value > 0 ? `${rule.discount_value}%` : "0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-3">اسم القاعدة</th>
                        <th className="p-3">القناة المستهدفة</th>
                        <th className="p-3">نوع الخدمة</th>
                        <th className="p-3">الوجهة / السلسلة</th>
                        <th className="p-3">الهامش المضاف</th>
                        <th className="p-3">الخصم الترويجي</th>
                        <th className="p-3">الأولوية</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {markupRules.map((rule, idx) => (
                        <tr key={`travelhotelaggregator-rule-id-${rule.id || idx}-${idx}`} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-bold text-slate-900">{rule.rule_name}</td>
                          <td className="p-3 font-mono">{rule.channel}</td>
                          <td className="p-3">{rule.service_type}</td>
                          <td className="p-3">{rule.destination_country}</td>
                          <td className="p-3 font-bold text-emerald-700 font-mono tabular-nums">
                            {rule.markup_type === "percentage" ? `${rule.markup_value}%` : `${rule.markup_value} ريال`}
                          </td>
                          <td className="p-3 font-bold text-sky-700 font-mono tabular-nums">
                            {rule.discount_value > 0 ? `${rule.discount_value}%` : "-"}
                          </td>
                          <td className="p-3 font-mono tabular-nums">{rule.priority}</td>
                          <td className="p-3 text-emerald-700 font-bold">نشط</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: Suppliers Gateways */}
        {activeTab === "suppliers" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supp, idx) => (
              <div key={`travelhotelaggregator-supp-id-${supp.id || idx}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs hover:shadow-md transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-emerald-400 font-mono font-bold text-xs">
                    {supp.supplier_code.toUpperCase()}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {supp.status === "connected" ? "متصل ومتاح" : "غير متاح"}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">{supp.supplier_name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1 truncate" dir="ltr">{supp.api_endpoint}</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">سرعة الاستجابة:</span>
                    <span className="font-bold font-mono tabular-nums text-slate-900">{supp.avg_latency_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">الرصيد الائتماني:</span>
                    <span className="font-bold text-emerald-700 font-mono tabular-nums">{supp.credit_balance.toLocaleString()} {supp.currency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Rule Modal - Responsive */}
        {newRuleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => setNewRuleModal(false)}>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-slate-900">إضافة قاعدة تسعير وهامش ربح جديدة</h3>
                <button
                  type="button"
                  onClick={() => setNewRuleModal(false)}
                  aria-label="إغلاق"
                  className="h-9 w-9 shrink-0 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddRule} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">اسم القاعدة:</label>
                  <input
                    type="text"
                    required
                    value={ruleForm.rule_name}
                    onChange={e => setRuleForm(p => ({ ...p, rule_name: e.target.value }))}
                    placeholder="مثال: هامش عطلات الصيف للأفراد"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">القناة المستهدفة:</label>
                    <select
                      value={ruleForm.channel}
                      onChange={e => setRuleForm(p => ({ ...p, channel: e.target.value }))}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">كافة القنوات</option>
                      <option value="b2c_web">مبيعات الأفراد B2C</option>
                      <option value="b2b_gold">وكلاء B2B Gold</option>
                      <option value="b2b_platinum">وكلاء B2B Platinum</option>
                      <option value="walk_in">مبيعات الفرع Walk-In</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">نوع الخدمة:</label>
                    <select
                      value={ruleForm.service_type}
                      onChange={e => setRuleForm(p => ({ ...p, service_type: e.target.value }))}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">كافة الخدمات</option>
                      <option value="hotel">حجوزات الفنادق</option>
                      <option value="flight">تذاكر الطيران</option>
                      <option value="package">البرامج السياحية</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">نسبة الهامش (%):</label>
                    <input
                      type="number"
                      step="0.5"
                      value={ruleForm.markup_value}
                      onChange={e => setRuleForm(p => ({ ...p, markup_value: Number(e.target.value) }))}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">الأولوية:</label>
                    <input
                      type="number"
                      value={ruleForm.priority}
                      onChange={e => setRuleForm(p => ({ ...p, priority: Number(e.target.value) }))}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setNewRuleModal(false)}
                    className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition cursor-pointer"
                  >
                    حفظ القاعدة
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
