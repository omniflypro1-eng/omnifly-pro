import React, { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Ticket,
  FileText,
  CheckCircle2,
  RefreshCw,
  QrCode,
  Plane,
  ArrowRight,
  Loader2,
  FileDown,
  Building2,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Luggage,
  Sparkles,
  Info
} from "lucide-react";
import { useAgencyConfig } from "@/hooks/use-agency-config";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function TravelAtbPrintingPage() {
  const { agencyName, agencyNameEn, logoUrl, phone, taxNumber, licenseNumber, currency } = useAgencyConfig();
  const { toast } = useToast();
  const [selectedBookingId, setSelectedBookingId] = useState<number>(1);
  const [activeFormat, setActiveFormat] = useState<"atb" | "thermal80" | "a4_itinerary">("atb");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Query Bookings
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useQuery<any[]>({
    queryKey: ["travel-bookings-list"],
    queryFn: () => fetchWithAuth("/api/travel/bookings")
  });

  const activeId = selectedBookingId || bookings?.[0]?.id || 1;

  // Query Rendered ATB Data
  const { data: atbData, isLoading: atbLoading, refetch: refetchAtb } = useQuery<any>({
    queryKey: ["atb-render-data", activeId],
    queryFn: () => fetchWithAuth(`/api/travel/atb/render-data/${activeId}`),
    enabled: !!activeId
  });

  const booking = atbData || {
    airline_name: "الخطوط السعودية (Saudia)",
    airline_code: "SV",
    passenger_name: "ALOTAIBI/ABDULLAH MR",
    eticket_number: "065-2415896321",
    pnr: "6X9ZKL",
    flight_number: "SV 112",
    booking_class: "Y",
    origin_code: "RUH",
    origin_name: "الرياض (King Khalid Intl)",
    destination_code: "DXB",
    destination_name: "دبي (Dubai Intl)",
    departure_date: "10 SEP 2026",
    boarding_time: "07:30",
    departure_time: "08:10",
    gate: "14B",
    seat: "12A",
    group: "GROUP 2",
    sequence_number: "048",
    baggage_allowance: "1 PC / 23 KG",
    barcode_string: "M1ALOTAIBI/ABDULLAH   E6X9ZKL RUHDXBSV 0112 253Y012A0048 100",
    frequent_flyer_number: "SV-88992211 (Alfursan Gold)"
  };

  // Clean, targeted print handler without browser slop
  const handlePrint = () => {
    setIsPrinting(true);
    const styleId = "__travel-atb-print-style__";
    document.getElementById(styleId)?.remove();

    const elementId =
      activeFormat === "atb"
        ? "printable-atb-document"
        : activeFormat === "thermal80"
        ? "printable-thermal-document"
        : "printable-a4-document";

    const style = document.createElement("style");
    style.id = styleId;

    if (activeFormat === "atb") {
      style.textContent = `
        @page { size: landscape; margin: 8mm; }
        @media print {
          body * { visibility: hidden !important; }
          #${elementId}, #${elementId} * { visibility: visible !important; }
          #${elementId} {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 850px !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: 1px solid #94a3b8 !important;
            background: #fbf9f4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 999999 !important;
          }
        }
      `;
    } else if (activeFormat === "thermal80") {
      style.textContent = `
        @page { size: 80mm auto; margin: 0; padding: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #${elementId}, #${elementId} * { visibility: visible !important; }
          #${elementId} {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 3mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 999999 !important;
          }
        }
      `;
    } else {
      style.textContent = `
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          #${elementId}, #${elementId} * { visibility: visible !important; }
          #${elementId} {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 999999 !important;
          }
        }
      `;
    }

    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      document.getElementById(styleId)?.remove();
      setIsPrinting(false);
    }, 1200);
  };

  // High-Resolution PDF Export
  const handleDownloadPdf = async () => {
    const elementId =
      activeFormat === "atb"
        ? "printable-atb-document"
        : activeFormat === "thermal80"
        ? "printable-thermal-document"
        : "printable-a4-document";

    const element = document.getElementById(elementId);
    if (!element) {
      toast({
        title: "تعذر العثور على القالب",
        description: "يرجى الانتظار لحين اكتمال تحميل بيانات القالب ثم المحاولة مجدداً",
        variant: "destructive"
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: activeFormat === "atb" ? "#fbf9f4" : "#ffffff",
        windowWidth: element.scrollWidth
      });

      const imgData = canvas.toDataURL("image/png", 1.0);

      if (activeFormat === "atb") {
        // IATA ATB Boarding Pass Standard Card: 210mm x 85mm
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: [210, 85]
        });
        pdf.addImage(imgData, "PNG", 0, 0, 210, 85);
        const pnrClean = (booking.pnr || "TKT").replace(/[^a-zA-Z0-9]/g, "");
        const passClean = (booking.passenger_name || "Passenger").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
        pdf.save(`BoardingPass_${pnrClean}_${passClean}.pdf`);
      } else if (activeFormat === "thermal80") {
        // Continuous 80mm roll format
        const imgWidth = 72; // mm width with margins
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pageHeight = Math.max(120, imgHeight + 10);
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [80, pageHeight]
        });
        pdf.addImage(imgData, "PNG", 4, 5, imgWidth, imgHeight);
        const pnrClean = (booking.pnr || "TKT").replace(/[^a-zA-Z0-9]/g, "");
        pdf.save(`ThermalReceipt_${pnrClean}.pdf`);
      } else {
        // A4 E-Ticket Itinerary
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = pdfWidth - 20; // 10mm margins on sides
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
        const pnrClean = (booking.pnr || "TKT").replace(/[^a-zA-Z0-9]/g, "");
        pdf.save(`ETicket_Itinerary_${pnrClean}.pdf`);
      }

      toast({
        title: "تم تصدير ملف PDF بنجاح ✅",
        description: `تم حفظ (${
          activeFormat === "atb"
            ? "بطاقة الصعود ATB"
            : activeFormat === "thermal80"
            ? "الإيصال الحراري 80mm"
            : "التذكرة الإلكترونية A4"
        }) بجودة طباعة فائقة الدقة.`
      });
    } catch (err: any) {
      console.error("PDF Export error:", err);
      toast({
        title: "فشل تصدير PDF",
        description: err.message || "حدث خطأ أثناء معالجة المستند وتوليد PDF",
        variant: "destructive"
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-900/40">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 border border-amber-400/40 rounded-xl">
                <Printer className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <span>محرك طباعة التذاكر وبطاقات الصعود ATB & Thermal</span>
                  <span className="text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                    PDF & Thermal Engine
                  </span>
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  إصدار وتصدير بطاقات صعود الطائرة القياسية IATA ATB2، فواتير الطابعات الحرارية 80mm، والتذاكر الإلكترونية A4 بدقة فائقة
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/travel-dashboard">
              <Button variant="outline" size="sm" className="bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700 text-xs">
                <ArrowRight className="w-4 h-4 ml-1.5" />
                الرجوع للوحة القيادة
              </Button>
            </Link>

            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer text-xs"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf || atbLoading}
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
                  جاري تجهيز PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 ml-1.5" />
                  تصدير كملف PDF
                </>
              )}
            </Button>

            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer text-xs"
              onClick={handlePrint}
              disabled={isPrinting || atbLoading}
            >
              <Printer className="w-4 h-4 ml-1.5" />
              طباعة فورية
            </Button>
          </div>
        </div>

        {/* Controls & Selector Strip */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-primary" />
                اختر الحجز / التذكرة:
              </label>
              <select
                className="h-10 border rounded-lg px-3 bg-white text-xs font-medium min-w-[280px] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(Number(e.target.value))}
              >
                {bookings?.map((b, idx) => (
                  <option key={`travelatbprinting-b-id-${b.id || idx}-${idx}`} value={b.id}>
                    {b.pnr} - {b.passenger_name || b.passenger_name_ar || b.passenger_name_en || "مسافر"} ({b.flight_number || "SV"} - {b.origin_city} ✈️ {b.destination_city})
                  </option>
                ))}
              </select>

              <Button
                variant="ghost"
                size="sm"
                className="h-10 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => {
                  refetchBookings();
                  refetchAtb();
                }}
                title="تحديث البيانات"
              >
                <RefreshCw className="w-3.5 h-3.5 ml-1" />
                تحديث
              </Button>
            </div>

            {/* Template Format Selector Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveFormat("atb")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFormat === "atb"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                بطاقة صعود (IATA ATB Pass)
              </button>

              <button
                type="button"
                onClick={() => setActiveFormat("thermal80")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFormat === "thermal80"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                إيصال حراري (80mm Thermal)
              </button>

              <button
                type="button"
                onClick={() => setActiveFormat("a4_itinerary")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFormat === "a4_itinerary"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Plane className="w-3.5 h-3.5" />
                تذكرة وجدول رحلة A4
              </button>
            </div>
          </CardContent>
        </Card>

        {/* PRINT CANVAS DISPLAY */}
        {activeFormat === "atb" && (
          /* REALISTIC IATA ATB2 BOARDING PASS CARD (Landscape) */
          <div className="flex flex-col items-center p-4 bg-slate-100 rounded-2xl overflow-x-auto print:bg-white print:p-0">
            <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              معاينة بطاقة صعود الطائرة القياسية IATA ATB2 (حجم الطباعة القياسي: Landscape 210mm x 85mm)
            </div>

            <div
              id="printable-atb-document"
              className="w-[850px] bg-[#fbf9f4] border-2 border-slate-400 rounded-xl shadow-2xl p-6 font-mono text-slate-900 relative print:border-none print:shadow-none print:w-full print:m-0"
              style={{ minHeight: "280px" }}
              dir="ltr"
            >
              {/* Magnetic Stripe Simulation on Back/Top */}
              <div className="h-4 bg-slate-900 rounded-t -mt-6 -mx-6 mb-4 opacity-90" />

              <div className="grid grid-cols-12 gap-4">
                {/* Main Body (Left 8 Cols) */}
                <div className="col-span-8 border-r-2 border-dashed border-slate-400 pr-4 space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h2 className="text-base font-black uppercase text-indigo-950 flex items-center gap-2">
                        <span>{booking.airline_name}</span>
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded">
                          {booking.airline_code}
                        </span>
                      </h2>
                      <div className="text-[10px] text-slate-500">ELECTRONIC BOARDING PASS / PASSENGER TICKET</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-indigo-900">PNR: {booking.pnr}</div>
                      <div className="text-[10px] text-slate-500">TKT: {booking.eticket_number}</div>
                    </div>
                  </div>

                  {/* Passenger Name & Flight Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="col-span-2">
                      <div className="text-[9px] text-slate-500 uppercase">PASSENGER NAME / اسم المسافر</div>
                      <div className="text-sm font-black tracking-wide text-slate-900">{booking.passenger_name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase">CLASS / الفئة</div>
                      <div className="text-sm font-black text-indigo-950">{booking.booking_class} (ECONOMY)</div>
                    </div>
                  </div>

                  {/* Route & Times */}
                  <div className="grid grid-cols-4 gap-2 text-xs bg-slate-200/60 p-2.5 rounded">
                    <div>
                      <div className="text-[9px] text-slate-500">FROM / من</div>
                      <div className="font-black text-sm text-slate-900">{booking.origin_code}</div>
                      <div className="text-[9px] text-slate-600 truncate">{booking.origin_name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">TO / إلى</div>
                      <div className="font-black text-sm text-slate-900">{booking.destination_code}</div>
                      <div className="text-[9px] text-slate-600 truncate">{booking.destination_name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">FLIGHT / الرحلة</div>
                      <div className="font-black text-sm text-indigo-900">{booking.flight_number}</div>
                      <div className="text-[9px] text-slate-600">{booking.departure_date}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">BOARDING / الصعود</div>
                      <div className="font-black text-sm text-emerald-800">{booking.boarding_time}</div>
                    </div>
                  </div>

                  {/* Gate, Seat, Group, Sequence */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 border-2 border-slate-800 rounded bg-white">
                      <div className="text-[9px] text-slate-500">GATE / البوابة</div>
                      <div className="text-base font-black text-slate-900">{booking.gate}</div>
                    </div>
                    <div className="p-2 border-2 border-indigo-900 rounded bg-indigo-50 text-indigo-950">
                      <div className="text-[9px] text-indigo-700">SEAT / المقعد</div>
                      <div className="text-base font-black text-indigo-950">{booking.seat}</div>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <div className="text-[9px] text-slate-500">GROUP / المجموعة</div>
                      <div className="text-xs font-bold text-slate-900">{booking.group}</div>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <div className="text-[9px] text-slate-500">SEQ / التسلسل</div>
                      <div className="text-xs font-bold text-slate-900">{booking.sequence_number}</div>
                    </div>
                  </div>

                  {/* Barcode Strip */}
                  <div className="pt-1 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-mono text-slate-400 truncate max-w-sm">
                        {booking.barcode_string}
                      </div>
                      <div className="text-[8px] text-slate-500 mt-0.5">
                        ISSUED BY: {agencyName} • {agencyNameEn}
                      </div>
                    </div>
                    <div className="bg-white p-1 border rounded shadow-sm">
                      <QrCode className="w-12 h-12 text-slate-900" />
                    </div>
                  </div>
                </div>

                {/* Tear-off Passenger Coupon Stub (Right 4 Cols) */}
                <div className="col-span-4 space-y-3 pl-2 text-xs">
                  <div className="border-b pb-1">
                    <div className="text-[9px] font-black uppercase text-indigo-950">{booking.airline_code} PASSENGER STUB</div>
                    <div className="text-[8px] text-slate-400">قسيمة المسافر</div>
                  </div>

                  <div>
                    <div className="text-[8px] text-slate-500">NAME</div>
                    <div className="font-bold text-[11px] truncate text-slate-900">{booking.passenger_name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <div className="text-[8px] text-slate-500">FLIGHT</div>
                      <div className="font-bold text-indigo-950">{booking.flight_number}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500">DATE</div>
                      <div className="font-bold text-slate-900">{booking.departure_date?.slice(0, 11)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <div className="text-[8px] text-slate-500">FROM</div>
                      <div className="font-bold text-slate-900">{booking.origin_code}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500">TO</div>
                      <div className="font-bold text-slate-900">{booking.destination_code}</div>
                    </div>
                  </div>

                  <div className="p-2 border border-slate-900 rounded bg-white flex justify-between items-center">
                    <div>
                      <div className="text-[8px] text-slate-500">SEAT</div>
                      <div className="font-black text-sm text-indigo-900">{booking.seat}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500">GATE</div>
                      <div className="font-bold text-xs text-slate-900">{booking.gate}</div>
                    </div>
                  </div>

                  <div className="text-[8px] text-slate-500 pt-2 border-t text-center space-y-1">
                    <div>BAGGAGE: {booking.baggage_allowance}</div>
                    <div className="font-bold text-emerald-800">BOARDING: {booking.boarding_time}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeFormat === "thermal80" && (
          /* 80mm THERMAL RECEIPT LAYOUT */
          <div className="flex flex-col items-center p-4 bg-slate-100 rounded-2xl print:bg-white print:p-0">
            <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              معاينة الإيصال الحراري 80mm لطابعات الفواتير ونقاط البيع (Roll 80mm Thermal Receipt)
            </div>

            <div
              id="printable-thermal-document"
              className="w-[340px] bg-white border border-slate-300 p-6 shadow-xl font-mono text-xs text-slate-900 space-y-4 rounded-lg print:border-none print:shadow-none print:w-full print:m-0"
            >
              <div className="text-center space-y-1 border-b pb-3">
                <h2 className="font-bold text-sm text-slate-900">{agencyName}</h2>
                <div className="text-[10px] text-slate-500 uppercase">{agencyNameEn}</div>
                {taxNumber && <div className="text-[10px] text-slate-600">الرقم الضريبي: {taxNumber}</div>}
                {phone && <div className="text-[10px] text-slate-600">الهاتف: {phone}</div>}
                <div className="inline-block bg-slate-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded mt-1">
                  إيصال حجز وتذكرة طيران معتمد
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">رقم الحجز (PNR):</span>
                  <span className="font-bold text-indigo-900">{booking.pnr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">رقم التذكرة:</span>
                  <span className="font-semibold">{booking.eticket_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">اسم المسافر:</span>
                  <span className="font-bold">{booking.passenger_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">الناقل الجوي:</span>
                  <span className="font-semibold">{booking.airline_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">رقم الرحلة:</span>
                  <span className="font-bold text-indigo-900">{booking.flight_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">خط السير:</span>
                  <span>{booking.origin_code} ✈️ {booking.destination_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">تاريخ السفر:</span>
                  <span>{booking.departure_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">وقت الإقلاع:</span>
                  <span>{booking.departure_time || "08:15"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">وقت الصعود:</span>
                  <span className="font-bold text-emerald-800">{booking.boarding_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">المقعد / البوابة:</span>
                  <span className="font-bold">{booking.seat} (بوابة {booking.gate})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">الوزن المسموح:</span>
                  <span>{booking.baggage_allowance}</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-1">
                <QrCode className="w-24 h-24 text-slate-900" />
                <span className="text-[9px] text-slate-500 font-mono mt-1">VERIFIED E-TICKET QR</span>
              </div>

              <div className="text-center text-[10px] text-slate-500 border-t pt-2 space-y-1">
                <div>يرجى التواجد في المطار قبل الإقلاع بـ 3 ساعات</div>
                <div>بوابة الصعود تُغلق قبل 15 دقيقة من موعد الإقلاع</div>
                <div className="font-bold text-slate-700">نتمنى لكم رحلة سعيدة وموفقة! ✈️</div>
              </div>
            </div>
          </div>
        )}

        {activeFormat === "a4_itinerary" && (
          /* A4 FULL ITINERARY & E-TICKET FORMAT */
          <div className="flex flex-col items-center p-4 bg-slate-100 rounded-2xl print:bg-white print:p-0">
            <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              معاينة التذكرة الإلكترونية وجدول الرحلة الرسمي A4 (A4 E-Ticket Itinerary)
            </div>

            <div
              id="printable-a4-document"
              className="w-[800px] bg-white border border-slate-300 rounded-xl shadow-xl p-8 text-slate-900 space-y-6 print:border-none print:shadow-none print:w-full print:m-0"
            >
              {/* Official Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-slate-900">{agencyName}</h2>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{agencyNameEn}</p>
                  <p className="text-[11px] text-slate-600">
                    {licenseNumber && `ترخيص سياحي: ${licenseNumber} • `}
                    {taxNumber && `الرقم الضريبي: ${taxNumber} • `}
                    {phone && `هاتف: ${phone}`}
                  </p>
                </div>
                <div className="text-left flex flex-col items-end">
                  <div className="bg-indigo-900 text-white text-xs font-bold px-3 py-1 rounded">
                    تذكرة سفر إلكترونية وجدول رحلة
                  </div>
                  <div className="text-xs font-mono font-bold mt-1 text-slate-700">
                    PNR: <span className="text-indigo-900 font-extrabold text-sm">{booking.pnr}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">TKT: {booking.eticket_number}</div>
                </div>
              </div>

              {/* Passenger & Booking Meta Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">اسم المسافر (Passenger Name):</span>
                  <span className="text-sm font-black text-slate-900 block mt-0.5">{booking.passenger_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">شركة الطيران الناقلة (Operating Airline):</span>
                  <span className="text-sm font-black text-indigo-950 block mt-0.5">{booking.airline_name} ({booking.airline_code})</span>
                </div>
              </div>

              {/* Flight Itinerary Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white p-3 text-xs font-bold flex justify-between items-center">
                  <span>جدول محطات ومسار الرحلة (Flight Segments)</span>
                  <span>درجة السفر: {booking.booking_class || "Y"} (اقتصادية)</span>
                </div>
                <div className="p-4 grid grid-cols-4 gap-4 text-center divide-x divide-x-reverse text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">محطة المغادرة (From)</span>
                    <strong className="text-base text-slate-900 block mt-1">{booking.origin_code}</strong>
                    <span className="text-xs text-slate-600 block mt-0.5">{booking.origin_name}</span>
                    <span className="text-[11px] text-emerald-800 font-bold block mt-1">🗓️ {booking.departure_date}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <Plane className="w-6 h-6 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-900 mt-1">{booking.flight_number}</span>
                    <span className="text-[11px] text-slate-500">مباشرة بدون توقف</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">محطة الوصول (To)</span>
                    <strong className="text-base text-slate-900 block mt-1">{booking.destination_code}</strong>
                    <span className="text-xs text-slate-600 block mt-0.5">{booking.destination_name}</span>
                    <span className="text-[11px] text-slate-600 block mt-1">🕒 وصول: {booking.departure_time || "08:15"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">تفاصيل الصعود</span>
                    <strong className="text-sm text-emerald-800 block mt-1">الصعود: {booking.boarding_time}</strong>
                    <span className="text-xs text-slate-700 block mt-0.5">البوابة: {booking.gate} • المقعد: {booking.seat}</span>
                    <span className="text-[11px] text-slate-600 block mt-1">الأمتعة: {booking.baggage_allowance}</span>
                  </div>
                </div>
              </div>

              {/* Barcode and Verification */}
              <div className="flex justify-between items-center border rounded-xl p-4 bg-slate-50/50">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900">التحقق الإلكتروني وصلاحية الوثيقة</div>
                  <div className="text-[11px] text-slate-500 max-w-md">
                    هذه التذكرة إلكترونية رسمية وصادرة ومسجلة في السجل المركزي لنظام أماديوس وجاليليو IATA GDS.
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    {booking.barcode_string}
                  </div>
                </div>
                <div className="bg-white p-2 border rounded-lg shadow-sm">
                  <QrCode className="w-16 h-16 text-slate-900" />
                </div>
              </div>

              {/* Terms and Advisory */}
              <div className="border-t pt-4 text-[10px] text-slate-500 space-y-1 leading-relaxed">
                <p className="font-bold text-slate-700">شروط وتعليمات السفر الهامة:</p>
                <p>1. يجب على المسافر التواجد في المطار قبل 3 ساعات من موعد إقلاع الرحلات الدولية، وساعتين للرحلات الداخلية.</p>
                <p>2. يُشترط وجود جواز سفر سارٍ لأكثر من 6 أشهر والتأكد من مطابقة شروط التأشيرات للدولة المقصودة.</p>
                <p>3. تغلق بوابات الصعود قبل 15 دقيقة من موعد الإقلاع المحدد، ولا تتحمل الوكالة مسؤولية التأخر عن الموعد.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
