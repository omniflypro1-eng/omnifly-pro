import React, { useEffect, useRef, useState } from "react";
import {
  Palette,
  RotateCcw,
  Upload,
  Trash2,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  Image as ImageIcon,
  Type,
  Sliders,
  ExternalLink,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  WebsiteThemeConfig,
  COLOR_FIELD_META,
  ARABIC_FONT_OPTIONS,
} from "@/lib/website-theme";

interface VisualIdentityEditorProps {
  formState: WebsiteThemeConfig;
  setFormState: React.Dispatch<React.SetStateAction<WebsiteThemeConfig | null>>;
  tenantCode?: string;
  tenantId?: number;
  onUploadAsset: (file: File, assetType: string) => Promise<string | null>;
}

const THEME_PRESETS = [
  {
    name: "اتقان سوفت الكلاسيكي",
    colors: {
      primary_color: "#0D6EFD",
      secondary_color: "#F59E0B",
      button_color: "#0D6EFD",
      button_hover_color: "#0B5ED7",
      background_color: "#F8FAFC",
      card_bg_color: "#FFFFFF",
      text_primary_color: "#0F172A",
      text_secondary_color: "#475569",
      link_color: "#0D6EFD",
      border_color: "#E2E8F0",
      navbar_bg_color: "#FFFFFF",
      footer_bg_color: "#0F294A"
    }
  },
  {
    name: "الزمردي السياحي",
    colors: {
      primary_color: "#059669",
      secondary_color: "#D97706",
      button_color: "#059669",
      button_hover_color: "#047857",
      background_color: "#F0FDF4",
      card_bg_color: "#FFFFFF",
      text_primary_color: "#064E3B",
      text_secondary_color: "#475569",
      link_color: "#059669",
      border_color: "#D1FAE5",
      navbar_bg_color: "#FFFFFF",
      footer_bg_color: "#064E3B"
    }
  },
  {
    name: "الذهبي الملكي",
    colors: {
      primary_color: "#B45309",
      secondary_color: "#1E293B",
      button_color: "#B45309",
      button_hover_color: "#92400E",
      background_color: "#FFFBEB",
      card_bg_color: "#FFFFFF",
      text_primary_color: "#1C1917",
      text_secondary_color: "#57534E",
      link_color: "#B45309",
      border_color: "#FDE68A",
      navbar_bg_color: "#FFFFFF",
      footer_bg_color: "#1C1917"
    }
  },
  {
    name: "الكحلي المؤسسي",
    colors: {
      primary_color: "#1E3A8A",
      secondary_color: "#0EA5E9",
      button_color: "#1E3A8A",
      button_hover_color: "#172554",
      background_color: "#F1F5F9",
      card_bg_color: "#FFFFFF",
      text_primary_color: "#0F172A",
      text_secondary_color: "#475569",
      link_color: "#1D4ED8",
      border_color: "#CBD5E1",
      navbar_bg_color: "#FFFFFF",
      footer_bg_color: "#0F172A"
    }
  }
];

export function VisualIdentityEditor({
  formState,
  setFormState,
  tenantCode,
  tenantId,
  onUploadAsset
}: VisualIdentityEditorProps) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const previewUrl = `/portal?preview=1&live=1${
    tenantCode ? `&tenant=${encodeURIComponent(tenantCode)}` : tenantId ? `&tenant=${tenantId}` : ""
  }`;

  const pushConfigToIframe = () => {
    if (!iframeRef.current?.contentWindow || typeof window === "undefined") return;
    iframeRef.current.contentWindow.postMessage(
      { type: "WEBSITE_LIVE_PREVIEW_UPDATE", config: formState },
      window.location.origin
    );
  };

  useEffect(() => {
    pushConfigToIframe();
  }, [formState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "WEBSITE_LIVE_PREVIEW_READY") {
        pushConfigToIframe();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  const handleFieldChange = (key: keyof WebsiteThemeConfig, value: any) => {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: string,
    targetField: keyof WebsiteThemeConfig
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKey(assetType);
    try {
      const url = await onUploadAsset(file, assetType);
      if (url) {
        handleFieldChange(targetField, url);
      }
    } finally {
      setUploadingKey(null);
      e.target.value = "";
    }
  };

  const assetSlots: Array<{
    label: string;
    hint: string;
    field: keyof WebsiteThemeConfig;
    assetType: string;
  }> = [
    { label: "شعار المؤسسة / الوكالة", hint: "PNG أو SVG بخلفية شفافة", field: "logo_url", assetType: "logo" },
    { label: "أيقونة المتصفح (Favicon)", hint: "32x32 أو 64x64 بكسل", field: "favicon_url", assetType: "favicon" },
    { label: "صورة البنر الرئيسي (Hero Image)", hint: "أبعاد مقترحة 1440x600 (الافتراضي: بنر السفر البانورامي)", field: "hero_image_url", assetType: "hero_image" }
  ];

  const serviceAssetSlots: Array<{
    label: string;
    field: keyof WebsiteThemeConfig;
    assetType: string;
  }> = [
    { label: "صورة خدمة الطيران", field: "flight_image_url", assetType: "flight_image" },
    { label: "صورة خدمة الفنادق", field: "hotel_image_url", assetType: "hotel_image" },
    { label: "صورة خدمة التأشيرات", field: "visas_image_url", assetType: "visas_image" },
    { label: "صورة خدمة الباقات", field: "packages_image_url", assetType: "packages_image" },
    { label: "صورة المشاوير والنقل", field: "rides_image_url", assetType: "rides_image" }
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* ─── LEFT/MAIN CONTROLS COLUMN ─── */}
      <div className="xl:col-span-6 space-y-6">
        {/* 1. Quick Palette Presets + 12 Full Color Controls */}
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">التحكم الكامل بالألوان (12 لوناً)</h3>
                <p className="text-[11px] text-slate-500">اختر من لوحة الألوان أو أدخل كود HEX مباشرة</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    setFormState((prev) => (prev ? { ...prev, ...preset.colors } : prev))
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/10"
                    style={{ backgroundColor: preset.colors.primary_color }}
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COLOR_FIELD_META.map((meta) => {
              const currentHex = String(formState[meta.key] || meta.defaultHex);
              return (
                <div
                  key={meta.key}
                  className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-800">{meta.label}</span>
                    <button
                      type="button"
                      onClick={() => handleFieldChange(meta.key, meta.defaultHex)}
                      title={`استعادة الافتراضي (${meta.defaultHex})`}
                      className="text-[10px] font-bold text-slate-500 hover:text-blue-600 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>افتراضي</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(currentHex) ? currentHex : meta.defaultHex}
                      onChange={(e) => handleFieldChange(meta.key, e.target.value.toUpperCase())}
                      aria-label={meta.label}
                      className="w-10 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white shrink-0"
                    />
                    <Input
                      value={currentHex}
                      maxLength={7}
                      onChange={(e) => handleFieldChange(meta.key, e.target.value.toUpperCase())}
                      className="h-9 text-xs font-mono font-bold uppercase flex-1"
                    />
                    <span
                      className="w-7 h-9 rounded-lg border border-slate-200 shrink-0"
                      style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(currentHex) ? currentHex : meta.defaultHex }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{meta.hint}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Logos & Assets Uploads + Header/Footer Logo Selector */}
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">الشعارات والوسائط والصور</h3>
              <p className="text-[11px] text-slate-500">تحكم مستقل بعرض أو إخفاء الصور، شعار المؤسسة، وصورة البنر الرئيسي</p>
            </div>
          </div>

          {/* Image Visibility Controls */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {(formState.show_website_images ?? 1) !== 0 ? (
                  <Eye className="w-4 h-4 text-emerald-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <div className="text-xs font-extrabold text-slate-900">التحكم بعرض الصور في الموقع</div>
                  <div className="text-[10px] text-slate-500">إظهار أو إخفاء الصور بالصفحة الرئيسية والخدمات والعروض</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${(formState.show_website_images ?? 1) !== 0 ? "text-emerald-700" : "text-slate-500"}`}>
                  {(formState.show_website_images ?? 1) !== 0 ? "ظاهرة" : "مخفية"}
                </span>
                <Switch
                  checked={(formState.show_website_images ?? 1) !== 0}
                  onCheckedChange={(checked) => handleFieldChange("show_website_images", checked ? 1 : 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                (formState.show_website_images ?? 1) === 0 ? "bg-slate-50 opacity-50 cursor-not-allowed" : "bg-slate-50/70 cursor-pointer"
              }`}>
                <span className="font-bold text-slate-700 text-[11px]">صورة البنر الرئيسي</span>
                <Switch
                  disabled={(formState.show_website_images ?? 1) === 0}
                  checked={(formState.show_website_images ?? 1) !== 0 && (formState.show_hero_image ?? 1) !== 0}
                  onCheckedChange={(checked) => handleFieldChange("show_hero_image", checked ? 1 : 0)}
                />
              </label>
              <label className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                (formState.show_website_images ?? 1) === 0 ? "bg-slate-50 opacity-50 cursor-not-allowed" : "bg-slate-50/70 cursor-pointer"
              }`}>
                <span className="font-bold text-slate-700 text-[11px]">صور الخدمات</span>
                <Switch
                  disabled={(formState.show_website_images ?? 1) === 0}
                  checked={(formState.show_website_images ?? 1) !== 0 && (formState.show_services_images ?? 1) !== 0}
                  onCheckedChange={(checked) => handleFieldChange("show_services_images", checked ? 1 : 0)}
                />
              </label>
              <label className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                (formState.show_website_images ?? 1) === 0 ? "bg-slate-50 opacity-50 cursor-not-allowed" : "bg-slate-50/70 cursor-pointer"
              }`}>
                <span className="font-bold text-slate-700 text-[11px]">الشعارات المصورة</span>
                <Switch
                  disabled={(formState.show_website_images ?? 1) === 0}
                  checked={(formState.show_website_images ?? 1) !== 0 && (formState.show_site_logos ?? 1) !== 0}
                  onCheckedChange={(checked) => handleFieldChange("show_site_logos", checked ? 1 : 0)}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">الشعار المعروض في الهيدر</label>
              <select
                value={formState.header_logo_type === "company" || !formState.header_logo_type ? "company" : formState.header_logo_type}
                onChange={(e) => handleFieldChange("header_logo_type", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="company">شعار المؤسسة / الوكالة</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">الشعار المعروض في الفوتر</label>
              <select
                value={formState.footer_logo_type === "company" || !formState.footer_logo_type ? "company" : formState.footer_logo_type}
                onChange={(e) => handleFieldChange("footer_logo_type", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="company">شعار المؤسسة / الوكالة</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {assetSlots.map((slot) => {
              const currentUrl = String(formState[slot.field] || "");
              return (
                <div
                  key={slot.assetType}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3.5"
                >
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {currentUrl ? (
                      <img src={currentUrl} alt={slot.label} className="w-full h-full object-contain" />
                    ) : slot.assetType === "hero_image" ? (
                      <img src="/assets/travel_hero_default.jpg" alt={slot.label} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">{slot.label}</div>
                    <div className="text-[11px] text-slate-400 mb-2">{slot.hint}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={(e) => handleFilePick(e, slot.assetType, slot.field)}
                        />
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingKey === slot.assetType ? "جارٍ الرفع..." : "رفع صورة"}</span>
                        </span>
                      </label>
                      {currentUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFieldChange(slot.field, "")}
                          className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50 gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>إزالة</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <div className="text-xs font-extrabold text-slate-800">صور بطاقات الخدمات بالموقع (اختياري)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {serviceAssetSlots.map((slot) => {
                const currentUrl = String(formState[slot.field] || "");
                return (
                  <div
                    key={slot.assetType}
                    className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2.5"
                  >
                    <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {currentUrl ? (
                        <img src={currentUrl} alt={slot.label} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-slate-800 truncate">{slot.label}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => handleFilePick(e, slot.assetType, slot.field)}
                          />
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700">
                            <Upload className="w-3 h-3" />
                            <span>{uploadingKey === slot.assetType ? "..." : "رفع"}</span>
                          </span>
                        </label>
                        {currentUrl && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange(slot.field, "")}
                            className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                          >
                            إزالة
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Design Style, Theme Mode, Typography & Layout Geometry */}
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Sliders className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">أنماط التصميم والخطوط والتنسيق</h3>
              <p className="text-[11px] text-slate-500">تخصيص شكل البطاقات والأزرار والخط العربي واتساع الصفحة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">نمط التصميم العام</label>
              <select
                value={formState.design_style}
                onChange={(e) => handleFieldChange("design_style", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="modern">عصري تفاعلي (Modern)</option>
                <option value="minimal">بسيط ناعم (Minimal)</option>
                <option value="formal">رسمي مؤسسي (Formal)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">وضع العرض (Theme Mode)</label>
              <select
                value={formState.theme_mode}
                onChange={(e) => handleFieldChange("theme_mode", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="light">فاتح (Light)</option>
                <option value="dark">داكن (Dark)</option>
                <option value="auto">تلقائي حسب جهاز الزائر (Auto)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-blue-600" />
                <span>الخط العربي</span>
              </label>
              <select
                value={formState.font_family}
                onChange={(e) => handleFieldChange("font_family", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                {ARABIC_FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">حجم الخط الأساسي ({formState.base_font_size}px)</label>
              <input
                type="range"
                min={14}
                max={18}
                step={1}
                value={formState.base_font_size}
                onChange={(e) => handleFieldChange("base_font_size", Number(e.target.value))}
                className="w-full h-10 accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">استدارة الأزرار</label>
              <select
                value={formState.button_radius}
                onChange={(e) => handleFieldChange("button_radius", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="pill">دائري بالكامل (Pill)</option>
                <option value="rounded">مستدير عصري (Rounded)</option>
                <option value="square">زوايا هندسية حادة (Square)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">استدارة البطاقات</label>
              <select
                value={formState.card_radius}
                onChange={(e) => handleFieldChange("card_radius", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="none">حواف حادة</option>
                <option value="md">استدارة متوسطة</option>
                <option value="lg">استدارة ناعمة (الافتراضي)</option>
                <option value="2xl">استدارة واسعة</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">مستوى الظلال</label>
              <select
                value={formState.shadow_level}
                onChange={(e) => handleFieldChange("shadow_level", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="none">بدون ظلال (Flat)</option>
                <option value="soft">ظلال ناعمة (Soft)</option>
                <option value="medium">ظلال واضحة (Elevated)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">نمط خلفية الصفحة</label>
              <select
                value={formState.background_pattern}
                onChange={(e) => handleFieldChange("background_pattern", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="solid">لون موحد صافي</option>
                <option value="gradient">تدرج لوني خفيف</option>
                <option value="dots">نقاط هندسية ناعمة</option>
                <option value="grid">شبكة هندسية خفيفة</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">اتساع المحتوى</label>
              <select
                value={formState.content_width}
                onChange={(e) => handleFieldChange("content_width", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="compact">مضغوط (Compact)</option>
                <option value="standard">قياسي متوازن (Standard)</option>
                <option value="wide">عريض كامل (Wide)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">المسافات بين الأقسام</label>
              <select
                value={formState.section_spacing}
                onChange={(e) => handleFieldChange("section_spacing", e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold"
              >
                <option value="compact">متقاربة</option>
                <option value="normal">متوازنة (الافتراضي)</option>
                <option value="relaxed">واسعة ومريحة</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT STICKY LIVE PREVIEW PANEL ─── */}
      <div className="xl:col-span-6 xl:sticky xl:top-4 space-y-3">
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-xs font-black">المعاينة الحية الفورية (Live Preview)</div>
              <div className="text-[10px] text-slate-400">تحديث لحظي بدون إعادة تحميل أو نشر</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                previewDevice === "desktop" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>كمبيوتر</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("tablet")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                previewDevice === "tablet" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>تابلت</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                previewDevice === "mobile" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>جوال</span>
            </button>
            <a
              href={`/portal?preview=1${tenantCode ? `&tenant=${encodeURIComponent(tenantCode)}` : ""}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1"
              title="فتح المعاينة في تبويب مستقل"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="bg-slate-200/75 border border-slate-300 rounded-2xl p-2 sm:p-3 flex justify-center overflow-hidden">
          <div
            className="bg-white rounded-xl overflow-hidden shadow-xl border border-slate-300 transition-all duration-300"
            style={{
              width:
                previewDevice === "mobile"
                  ? "390px"
                  : previewDevice === "tablet"
                  ? "768px"
                  : "100%",
              maxWidth: "100%",
              height: "680px"
            }}
          >
            <iframe
              ref={iframeRef}
              src={previewUrl}
              onLoad={pushConfigToIframe}
              title="معاينة الموقع الإلكتروني"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
