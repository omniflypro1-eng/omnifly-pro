import React, { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer, X, FileDown, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Smartphone, FileText } from "lucide-react";
import { printA4Html, saveA4PdfToFile } from "@/lib/printUtils";
import { useToast } from "@/hooks/use-toast";

export function ReportViewerModal({
  isOpen,
  onClose,
  htmlContent,
  title = "استعراض التقرير",
  landscape = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  title?: string;
  landscape?: boolean;
}) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [containerWidth, setContainerWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [mobilePortraitMode, setMobilePortraitMode] = useState<boolean>(true);
  const [iframeDocHeight, setIframeDocHeight] = useState<number>(560);

  const isMobileViewport = containerWidth < 768;
  const useMobilePortraitLayout = isMobileViewport && mobilePortraitMode;

  // Target A4 pixel dimensions at 96 DPI (210mm ≈ 794px, 297mm ≈ 1123px)
  const docWidthPx = landscape ? 1123 : 794;
  const docHeightPx = landscape ? 794 : 1123;

  // Escape key & body scroll lock when modal portal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  // Responsive viewport listener
  useEffect(() => {
    if (!isOpen) return;
    const updateWidth = () => {
      if (viewportRef.current) {
        setContainerWidth(viewportRef.current.clientWidth);
      } else if (typeof window !== "undefined") {
        setContainerWidth(window.innerWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 60);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && viewportRef.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(viewportRef.current);
    }
    window.addEventListener("resize", updateWidth);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [isOpen, isFullScreen]);

  // Measure actual rendered document height accurately when in Mobile Adaptive mode
  const syncIframeHeight = useCallback(() => {
    const measure = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentDocument) return;
        const body = iframe.contentDocument.body;
        if (!body) return;
        const firstChild = body.firstElementChild as HTMLElement | null;
        const contentRectHeight = firstChild ? Math.ceil(firstChild.getBoundingClientRect().height + 24) : 0;
        const measured = Math.max(contentRectHeight, body.scrollHeight, 360);
        setIframeDocHeight(measured + 12);
      } catch {
        // Ignore cross-origin edge cases
      }
    };
    measure();
    setTimeout(measure, 150);
    setTimeout(measure, 450);
  }, []);

  // Calculate ideal display scale for desktop or explicit A4 paper mode
  const availablePx = Math.max(containerWidth - (containerWidth < 640 ? 16 : 48), 280);
  const fitRatio = Math.min(1, availablePx / docWidthPx);
  const effectiveScale = useMobilePortraitLayout
    ? 1
    : autoFit
      ? fitRatio * (zoom / 100)
      : zoom / 100;
  const scaledWidth = Math.round(docWidthPx * effectiveScale);
  const scaledMinHeight = Math.round(docHeightPx * effectiveScale);

  const isBoardingPassTemplate = htmlContent.includes("omni-bp-root");

  // Adaptive Mobile CSS (leaves bespoke omni-bp boarding pass mobile rules intact, and prevents super-tall vertical bloat on tables/statements)
  const mobileAdaptiveCss = useMobilePortraitLayout
    ? isBoardingPassTemplate
      ? `
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 8px !important;
          overflow-x: hidden !important;
          background: #f8fafc !important;
        }
      `
      : `
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 8px !important;
          overflow-x: hidden !important;
          font-size: 12.5px !important;
          line-height: 1.45 !important;
        }
        body > div,
        .page, .sheet, .a4-page, .report-container, .voucher-container, .container {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          min-height: auto !important;
          height: auto !important;
          padding: 10px !important;
          margin: 0 0 10px 0 !important;
          box-shadow: none !important;
        }
        [style*="width:"] { max-width: 100% !important; }
        [style*="min-width:"] { min-width: 0 !important; }
        [style*="display: flex"], [style*="display:flex"] {
          flex-wrap: wrap !important;
          gap: 6px !important;
        }
        [style*="grid-template-columns"] {
          grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)) !important;
          gap: 6px !important;
        }
        table {
          display: block !important;
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          white-space: nowrap !important;
          font-size: 11px !important;
        }
        th, td { padding: 5px 7px !important; }
        img { max-width: 100% !important; height: auto !important; }
      `
    : "";

  const baseStyles = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
      * { box-sizing: border-box; }
      body {
        font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
        color: #0f172a;
        background: #ffffff !important;
        margin: 0;
        padding: 18px;
        width: 100%;
      }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: auto; }
      th, td { border: 1px solid #94a3b8; padding: 6px 10px; text-align: center; }
      th { background: #f1f5f9; font-weight: bold; color: #1e293b; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      ${mobileAdaptiveCss}
    </style>
  `;

  // Inject responsive portrait adaptation into preview without mutating original htmlContent used for Print/PDF
  const fullHtml = htmlContent.includes("<!DOCTYPE html>")
    ? (useMobilePortraitLayout
        ? htmlContent.replace("</head>", `<meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${mobileAdaptiveCss}</style></head>`)
        : htmlContent)
    : `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${baseStyles}
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  const handlePrint = () => {
    printA4Html(htmlContent, title);
  };

  const handleExportPdf = async () => {
    const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "_").trim();
    setIsSaving(true);
    try {
      const res = await saveA4PdfToFile(htmlContent, cleanTitle, cleanTitle, landscape ? { landscape: true } : undefined);
      if (res.canceled) {
        setIsSaving(false);
        return;
      }
      if (res.success) {
        toast({
          title: "تم استخراج ملف الـ PDF بنجاح",
          description: res.filePath || "تم تنزيل المستند بنجاح"
        });
      } else {
        printA4Html(htmlContent, cleanTitle);
        toast({
          title: "جاري حفظ وتصدير PDF",
          description: "تم فتح نافذة الحفظ، اختر 'حفظ بتنسيق PDF' (Save as PDF) من قائمة الطابعات."
        });
      }
    } catch (err: any) {
      console.warn("Direct PDF export fallback triggered:", err);
      printA4Html(htmlContent, cleanTitle);
      toast({
        title: "جاري استخراج ملف PDF",
        description: "تم فتح نافذة المعاينة والطباعة للحفظ بصيغة PDF عالية الدقة."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayPercent = Math.round(effectiveScale * 100);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full flex flex-col overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl ${
          isFullScreen ? "h-[100dvh] rounded-none" : "h-[92dvh] max-w-6xl mx-3 rounded-2xl"
        }`}
      >
        {/* PINNED TOP TOOLBAR WITH GUARANTEED VISIBLE EXIT BUTTON */}
        <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-5 py-2.5 sm:py-3 flex flex-col lg:flex-row lg:items-center justify-between shadow-md z-30 shrink-0 gap-2">
          {/* Title + Unified Always-Visible Exit Button */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-xs sm:text-base truncate">
                  {title}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                  {useMobilePortraitLayout
                    ? "عرض عمودي ملاءم للهاتف • التصدير والطباعة بصيغة A4 الرسمية"
                    : "معاينة رسمية A4 • متوافقة مع الهواتف والأجهزة المكتبية"}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={onClose}
              size="sm"
              className="lg:hidden h-9 px-3 shrink-0 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold gap-1 shadow-md cursor-pointer"
              title="إغلاق والخروج"
            >
              <X className="w-4 h-4" />
              <span>إغلاق</span>
            </Button>
          </div>

          {/* Controls Row: Mobile Mode / Zoom / Export / Print / Desktop Close */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            {isMobileViewport && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMobilePortraitMode(prev => !prev)}
                className={`h-9 px-2.5 text-xs font-bold rounded-xl gap-1.5 border ${
                  mobilePortraitMode
                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-200"
                }`}
                title="تبديل بين العرض المريح للهاتف وورقة A4 الكاملة"
              >
                {mobilePortraitMode ? <Smartphone className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{mobilePortraitMode ? "عرض ملاءم للهاتف" : "ورقة A4 كاملة"}</span>
              </Button>
            )}

            {!useMobilePortraitLayout && (
              <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAutoFit(false);
                    setZoom(prev => Math.max(prev - 15, 35));
                  }}
                  disabled={effectiveScale <= 0.35}
                  className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono font-bold text-slate-200 min-w-11 text-center tabular-nums">
                  {displayPercent}%
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAutoFit(false);
                    setZoom(prev => Math.min(prev + 15, 160));
                  }}
                  disabled={zoom >= 160 && !autoFit}
                  className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAutoFit(true);
                    setZoom(100);
                  }}
                  className={`h-8 px-2 text-[11px] font-bold rounded-lg gap-1 ${
                    autoFit ? "bg-blue-600/30 text-blue-300" : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                  title="ملاءمة تلقائية للشاشة"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">ملاءمة</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAutoFit(false);
                    setZoom(100);
                  }}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                  title="الحجم الحقيقي (100%)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <Button
                type="button"
                onClick={handleExportPdf}
                disabled={isSaving}
                className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-bold px-3 sm:px-4 h-9 sm:h-10 rounded-xl shadow-md shadow-rose-600/25 text-xs sm:text-sm disabled:opacity-70 flex-1 sm:flex-initial whitespace-nowrap"
                title="تصدير وحفظ التقرير كملف PDF معتمد"
              >
                <FileDown className="w-4 h-4 shrink-0" />
                <span>{isSaving ? "جاري التصدير..." : "تصدير PDF"}</span>
              </Button>

              <Button
                type="button"
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-bold px-3 sm:px-4 h-9 sm:h-10 rounded-xl shadow-md shadow-blue-600/25 text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
                title="طباعة التقرير A4"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>طباعة A4</span>
              </Button>

              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setIsFullScreen(prev => !prev)}
                className="hidden sm:inline-flex h-10 w-10 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl"
                title={isFullScreen ? "تصغير النافذة" : "شاشة كاملة"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

              <Button
                type="button"
                onClick={onClose}
                className="hidden lg:inline-flex bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-bold px-4 h-10 rounded-xl text-xs sm:text-sm shadow-md"
              >
                <X className="w-4 h-4" />
                إغلاق
              </Button>
            </div>
          </div>
        </div>

        {/* HELPER BANNER */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-amber-200 shrink-0">
          <span className="truncate">
            {useMobilePortraitLayout
              ? "عرض مخصص ومضغوط لشاشة الهاتف دون تشويه أو إطالة. التصدير يحفظ التخطيط الكامل A4."
              : `تم ضبط المعاينة لتتلاءم مع عرض شاشتك (${displayPercent}%). اضغط "تصدير PDF" للحفظ بجودة A4.`}
          </span>
          <span className="hidden sm:inline text-slate-400 font-mono shrink-0">
            {landscape ? "A4 Landscape" : "A4 Portrait"}
          </span>
        </div>

        {/* DOCUMENT VIEWPORT */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-auto bg-slate-900/90 p-2 sm:p-6 flex justify-center items-start"
        >
          {useMobilePortraitLayout ? (
            <div className="w-full max-w-full bg-white rounded-xl shadow-xl border border-slate-700 overflow-hidden">
              <iframe
                ref={iframeRef}
                srcDoc={fullHtml}
                onLoad={syncIframeHeight}
                className="w-full border-none block bg-white"
                style={{ width: "100%", height: `${iframeDocHeight}px`, minHeight: "360px" }}
                title="Mobile Adaptive Report Preview"
              />
            </div>
          ) : (
            <div
              style={{
                width: `${scaledWidth}px`,
                minHeight: `${scaledMinHeight}px`,
              }}
              className="relative shrink-0 transition-all duration-150"
            >
              <div
                style={{
                  width: `${docWidthPx}px`,
                  minHeight: `${docHeightPx}px`,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: "top right",
                }}
                dir="rtl"
                className="bg-white shadow-2xl border border-slate-700 rounded-sm overflow-hidden"
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={fullHtml}
                  className="w-full border-none block"
                  style={{ width: `${docWidthPx}px`, minHeight: `${docHeightPx}px`, height: "100%" }}
                  title="Report Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ReportViewerModal;
