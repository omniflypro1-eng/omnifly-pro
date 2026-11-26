import React, { useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Megaphone,
  Layers,
  Upload,
  Sparkles,
  Share2,
  MapPin,
  Briefcase,
  Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WebsiteThemeConfig,
  WebsiteSectionConfig,
  WebsiteFeatureItem,
  WebsiteNavLink,
  WebsiteShowcaseServiceItem,
  WebsiteHeroSlide,
  WebsitePromotion,
  DEFAULT_SECTIONS_CONFIG,
  DEFAULT_FEATURES,
  DEFAULT_NAV_LINKS,
  DEFAULT_SHOWCASE_SERVICES,
  safeJsonParse
} from "@/lib/website-theme";

interface SectionsCustomizerProps {
  formState: WebsiteThemeConfig;
  setFormState: React.Dispatch<React.SetStateAction<WebsiteThemeConfig | null>>;
  promotions: WebsitePromotion[];
  onUploadAsset: (file: File, assetType: string) => Promise<string | null>;
  onCreatePromotion: (promo: WebsitePromotion) => Promise<void>;
  onUpdatePromotion: (id: number, promo: Partial<WebsitePromotion>) => Promise<void>;
  onDeletePromotion: (id: number) => Promise<void>;
}

export function SectionsCustomizer({
  formState,
  setFormState,
  promotions,
  onUploadAsset,
  onCreatePromotion,
  onUpdatePromotion,
  onDeletePromotion
}: SectionsCustomizerProps) {
  const [newPromo, setNewPromo] = useState<WebsitePromotion>({
    title: "",
    subtitle: "",
    badge: "عرض خاص",
    discount_text: "خصم 15%",
    image_url: "",
    link_url: "#booking-console",
    is_active: 1,
    sort_order: 0
  });
  const [promoSaving, setPromoSaving] = useState(false);

  const sections = useMemo<WebsiteSectionConfig[]>(() => {
    const parsed = safeJsonParse<WebsiteSectionConfig[]>(formState.sections_config_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SECTIONS_CONFIG;
    return parsed;
  }, [formState.sections_config_json]);

  const features = useMemo<WebsiteFeatureItem[]>(() => {
    const parsed = safeJsonParse<WebsiteFeatureItem[]>(formState.features_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FEATURES;
    return parsed;
  }, [formState.features_json]);

  const heroSlides = useMemo<WebsiteHeroSlide[]>(() => {
    const parsed = safeJsonParse<WebsiteHeroSlide[]>(formState.hero_slides_json, []);
    return Array.isArray(parsed) ? parsed : [];
  }, [formState.hero_slides_json]);

  const showcaseServices = useMemo<WebsiteShowcaseServiceItem[]>(() => {
    const parsed = safeJsonParse<WebsiteShowcaseServiceItem[]>(formState.services_showcase_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SHOWCASE_SERVICES;
    return parsed;
  }, [formState.services_showcase_json]);

  const navLinks = useMemo<WebsiteNavLink[]>(() => {
    const parsed = safeJsonParse<WebsiteNavLink[]>(formState.nav_links_json, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_NAV_LINKS;
    return parsed;
  }, [formState.nav_links_json]);

  const updateSections = (next: WebsiteSectionConfig[]) => {
    setFormState((prev) => (prev ? { ...prev, sections_config_json: JSON.stringify(next) } : prev));
  };

  const moveSection = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    updateSections(copy);
  };

  const updateFeatures = (next: WebsiteFeatureItem[]) => {
    setFormState((prev) => (prev ? { ...prev, features_json: JSON.stringify(next) } : prev));
  };

  const updateHeroSlides = (next: WebsiteHeroSlide[]) => {
    setFormState((prev) => (prev ? { ...prev, hero_slides_json: JSON.stringify(next) } : prev));
  };

  const updateShowcaseServices = (next: WebsiteShowcaseServiceItem[]) => {
    setFormState((prev) => (prev ? { ...prev, services_showcase_json: JSON.stringify(next) } : prev));
  };

  const updateNavLinks = (next: WebsiteNavLink[]) => {
    setFormState((prev) => (prev ? { ...prev, nav_links_json: JSON.stringify(next) } : prev));
  };

  const handleAddSlide = () => {
    const next: WebsiteHeroSlide[] = [
      ...heroSlides,
      {
        id: `slide-${Date.now()}`,
        title: formState.hero_title_2 || "سافر بكل راحة وأمان ..",
        highlight: formState.hero_title_3 || `مع ${formState.site_name}`,
        subtitle: formState.hero_subtitle || "",
        image_url: formState.hero_image_url || "",
        cta_text: formState.hero_cta_primary_text || "ابدأ البحث عن الرحلات",
        cta_link: "#booking-console"
      }
    ];
    updateHeroSlides(next);
  };

  const handleAddPromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.title.trim()) return;
    setPromoSaving(true);
    try {
      await onCreatePromotion(newPromo);
      setNewPromo({
        title: "",
        subtitle: "",
        badge: "عرض خاص",
        discount_text: "خصم 15%",
        image_url: "",
        link_url: "#booking-console",
        is_active: 1,
        sort_order: promotions.length
      });
    } finally {
      setPromoSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Section Ordering, Visibility & Section Titles */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <Layers className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-black text-slate-900">ترتيب وإظهار أقسام الموقع</h3>
            <p className="text-[11px] text-slate-500">تحكم في ترتيب كل قسم وإظهاره أو إخفائه وتعديل عنوانه</p>
          </div>
        </div>

        <div className="space-y-3">
          {sections.map((sec, idx) => (
            <div
              key={sec.id}
              className={`bg-white p-3.5 rounded-xl border transition-all ${
                sec.enabled ? "border-slate-200" : "border-slate-200 bg-slate-50/80 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-black text-slate-900">{sec.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                    className="h-8 w-8 p-0"
                    title="تحريك لأعلى"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={idx === sections.length - 1}
                    onClick={() => moveSection(idx, 1)}
                    className="h-8 w-8 p-0"
                    title="تحريك لأسفل"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const copy = [...sections];
                      copy[idx] = { ...sec, enabled: !sec.enabled };
                      updateSections(copy);
                    }}
                    className={`h-8 text-xs font-bold gap-1 px-2.5 ${
                      sec.enabled ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-600"
                    }`}
                  >
                    {sec.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{sec.enabled ? "ظاهر" : "مخفي"}</span>
                  </Button>
                </div>
              </div>

              {sec.id !== "footer" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <Input
                    placeholder="عنوان القسم"
                    value={sec.title || ""}
                    onChange={(e) => {
                      const copy = [...sections];
                      copy[idx] = { ...sec, title: e.target.value };
                      updateSections(copy);
                    }}
                    className="h-9 text-xs"
                  />
                  <Input
                    placeholder="الوصف الفرعي للقسم"
                    value={sec.subtitle || ""}
                    onChange={(e) => {
                      const copy = [...sections];
                      copy[idx] = { ...sec, subtitle: e.target.value };
                      updateSections(copy);
                    }}
                    className="h-9 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Hero CTA Buttons & Multi-Slide Banner Editor */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">أزرار الإجراء والشرائح في البنر الرئيسي (Hero CTA & Slides)</h3>
              <p className="text-[11px] text-slate-500">تخصيص أزرار الدعوة للإجراء وإضافة شرائح متعددة للبنر الرئيسي</p>
            </div>
          </div>
          <Button type="button" size="sm" onClick={handleAddSlide} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1 h-9">
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة شريحة بنر</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">نص الزر الأساسي</label>
            <Input
              value={formState.hero_cta_primary_text || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, hero_cta_primary_text: e.target.value } : prev))
              }
              className="h-9 text-xs bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">رابط الزر الأساسي</label>
            <Input
              value={formState.hero_cta_primary_link || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, hero_cta_primary_link: e.target.value } : prev))
              }
              placeholder="#booking-console"
              className="h-9 text-xs bg-white font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">نص الزر الثانوي</label>
            <Input
              value={formState.hero_cta_secondary_text || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, hero_cta_secondary_text: e.target.value } : prev))
              }
              className="h-9 text-xs bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">رابط الزر الثانوي</label>
            <Input
              value={formState.hero_cta_secondary_link || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, hero_cta_secondary_link: e.target.value } : prev))
              }
              placeholder="#services-showcase"
              className="h-9 text-xs bg-white font-mono"
            />
          </div>
        </div>

        {heroSlides.length > 0 && (
          <div className="space-y-3 pt-2">
            {heroSlides.map((slide, sIdx) => (
              <div key={slide.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800">شريحة البنر #{sIdx + 1}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => updateHeroSlides(heroSlides.filter((_, i) => i !== sIdx))}
                    className="h-7 px-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    placeholder="العنوان الأول"
                    value={slide.title}
                    onChange={(e) => {
                      const next = [...heroSlides];
                      next[sIdx] = { ...slide, title: e.target.value };
                      updateHeroSlides(next);
                    }}
                    className="h-9 text-xs"
                  />
                  <Input
                    placeholder="النص المميز (Highlight)"
                    value={slide.highlight}
                    onChange={(e) => {
                      const next = [...heroSlides];
                      next[sIdx] = { ...slide, highlight: e.target.value };
                      updateHeroSlides(next);
                    }}
                    className="h-9 text-xs"
                  />
                  <Input
                    placeholder="النص التوضيحي"
                    value={slide.subtitle}
                    onChange={(e) => {
                      const next = [...heroSlides];
                      next[sIdx] = { ...slide, subtitle: e.target.value };
                      updateHeroSlides(next);
                    }}
                    className="h-9 text-xs sm:col-span-2"
                  />
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Input
                      placeholder="رابط صورة الشريحة"
                      value={slide.image_url}
                      onChange={(e) => {
                        const next = [...heroSlides];
                        next[sIdx] = { ...slide, image_url: e.target.value };
                        updateHeroSlides(next);
                      }}
                      className="h-9 text-xs flex-1"
                    />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.svg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await onUploadAsset(file, "hero_image");
                          if (url) {
                            const next = [...heroSlides];
                            next[sIdx] = { ...slide, image_url: url };
                            updateHeroSlides(next);
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1 px-3 h-9 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold">
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Trust / Features Cards Editor */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="pb-2 border-b border-slate-200">
          <h3 className="text-sm font-black text-slate-900">تخصيص بطاقات المزايا والثقة</h3>
          <p className="text-[11px] text-slate-500">تظهر مباشرة أسفل البنر الرئيسي (4 بطاقات متجاوبة)</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {features.map((feat, fIdx) => (
            <div key={feat.id} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={feat.icon}
                  onChange={(e) => {
                    const next = [...features];
                    next[fIdx] = { ...feat, icon: e.target.value as any };
                    updateFeatures(next);
                  }}
                  className="h-8 border border-slate-300 rounded-lg px-2 text-xs font-bold"
                >
                  <option value="shield">أيقونة الدرع (أمان)</option>
                  <option value="zap">أيقونة البرق (سرعة)</option>
                  <option value="headphones">أيقونة الدعم الفني</option>
                  <option value="globe">أيقونة الكرة الأرضية</option>
                  <option value="award">أيقونة الجودة</option>
                  <option value="clock">أيقونة التواجد 24/7</option>
                </select>

                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feat.enabled !== false}
                    onChange={(e) => {
                      const next = [...features];
                      next[fIdx] = { ...feat, enabled: e.target.checked };
                      updateFeatures(next);
                    }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span>مفعل</span>
                </label>
              </div>
              <Input
                placeholder="عنوان الميزة"
                value={feat.title}
                onChange={(e) => {
                  const next = [...features];
                  next[fIdx] = { ...feat, title: e.target.value };
                  updateFeatures(next);
                }}
                className="h-9 text-xs font-bold"
              />
              <Input
                placeholder="وصف مختصر"
                value={feat.subtitle}
                onChange={(e) => {
                  const next = [...features];
                  next[fIdx] = { ...feat, subtitle: e.target.value };
                  updateFeatures(next);
                }}
                className="h-9 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 3.5 Showcase Services Cards Manager (Rename, Add, Disable, Delete) */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">إدارة بطاقات الخدمات المعروضة بالموقع</h3>
              <p className="text-[11px] text-slate-500">تعديل أسماء الخدمات، إضافة خدمة جديدة، تعطيل أو حذف أي بطاقة خدمة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => updateShowcaseServices(DEFAULT_SHOWCASE_SERVICES)}
              className="h-9 text-xs font-bold"
            >
              استعادة الافتراضي
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                updateShowcaseServices([
                  ...showcaseServices,
                  {
                    id: `srv-${Date.now()}`,
                    title: "خدمة جديدة",
                    subtitle: "وصف الخدمة المختصر",
                    icon: "globe",
                    target: "#booking-console",
                    tab: "rides",
                    enabled: true
                  }
                ])
              }
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-bold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة بطاقة خدمة</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {showcaseServices.map((srv, sIdx) => (
            <div
              key={srv.id}
              className={`bg-white p-3.5 rounded-xl border space-y-2.5 ${
                srv.enabled !== false ? "border-slate-200" : "border-slate-200 opacity-65"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <select
                    value={srv.icon}
                    onChange={(e) => {
                      const next = [...showcaseServices];
                      next[sIdx] = { ...srv, icon: e.target.value as any };
                      updateShowcaseServices(next);
                    }}
                    className="h-8 border border-slate-300 rounded-lg px-2 text-xs font-bold"
                  >
                    <option value="plane">طيران</option>
                    <option value="hotel">فنادق</option>
                    <option value="visa">تأشيرات</option>
                    <option value="passengers">إدارة المسافرين</option>
                    <option value="compass">سياحة وعمرة</option>
                    <option value="car">نقل VIP</option>
                    <option value="bus">باصات</option>
                    <option value="shield">تأمين</option>
                    <option value="globe">خدمات عامة</option>
                  </select>
                  <select
                    value={srv.tab || ""}
                    onChange={(e) => {
                      const next = [...showcaseServices];
                      next[sIdx] = {
                        ...srv,
                        tab: e.target.value || undefined,
                        target: e.target.value ? "#booking-console" : "#contact-section"
                      };
                      updateShowcaseServices(next);
                    }}
                    className="h-8 border border-slate-300 rounded-lg px-2 text-xs font-bold"
                  >
                    <option value="flights">تبويب الطيران</option>
                    <option value="hotels">تبويب الفنادق</option>
                    <option value="visas">تبويب التأشيرات</option>
                    <option value="lookup">تبويب تتبع المسافر</option>
                    <option value="packages">تبويب الباقات</option>
                    <option value="rides">تبويب المشاوير</option>
                    <option value="buses">تبويب الباصات</option>
                    <option value="">نموذج التواصل</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <label className="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer ml-1">
                    <input
                      type="checkbox"
                      checked={srv.enabled !== false}
                      onChange={(e) => {
                        const next = [...showcaseServices];
                        next[sIdx] = { ...srv, enabled: e.target.checked };
                        updateShowcaseServices(next);
                      }}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span>ظاهر</span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={sIdx === 0}
                    onClick={() => {
                      const next = [...showcaseServices];
                      const [moved] = next.splice(sIdx, 1);
                      next.splice(sIdx - 1, 0, moved);
                      updateShowcaseServices(next);
                    }}
                    className="h-7 w-7 p-0"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={sIdx === showcaseServices.length - 1}
                    onClick={() => {
                      const next = [...showcaseServices];
                      const [moved] = next.splice(sIdx, 1);
                      next.splice(sIdx + 1, 0, moved);
                      updateShowcaseServices(next);
                    }}
                    className="h-7 w-7 p-0"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => updateShowcaseServices(showcaseServices.filter((_, i) => i !== sIdx))}
                    className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <Input
                placeholder="اسم الخدمة"
                value={srv.title}
                onChange={(e) => {
                  const next = [...showcaseServices];
                  next[sIdx] = { ...srv, title: e.target.value };
                  updateShowcaseServices(next);
                }}
                className="h-9 text-xs font-bold"
              />
              <Input
                placeholder="وصف مختصر للخدمة"
                value={srv.subtitle}
                onChange={(e) => {
                  const next = [...showcaseServices];
                  next[sIdx] = { ...srv, subtitle: e.target.value };
                  updateShowcaseServices(next);
                }}
                className="h-9 text-xs"
              />
              <div className="flex items-center gap-2">
                <Input
                  placeholder="رابط صورة البطاقة (اختياري)"
                  value={srv.image_url || ""}
                  onChange={(e) => {
                    const next = [...showcaseServices];
                    next[sIdx] = { ...srv, image_url: e.target.value };
                    updateShowcaseServices(next);
                  }}
                  className="h-8 text-[11px] flex-1 font-mono"
                />
                <label className="cursor-pointer shrink-0">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await onUploadAsset(file, "service_card");
                      if (url) {
                        const next = [...showcaseServices];
                        next[sIdx] = { ...srv, image_url: url };
                        updateShowcaseServices(next);
                      }
                    }}
                  />
                  <span className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-300 bg-slate-50 text-[11px] font-bold">
                    <Upload className="w-3 h-3" />
                    <span>صورة</span>
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3.6 Header Main Navigation Links Manager */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">تخصيص القائمة الرئيسية (Header Menu)</h3>
              <p className="text-[11px] text-slate-500">تعديل أسماء الروابط وترتيبها وإظهارها في رأس الموقع</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              updateNavLinks([
                ...navLinks,
                { id: `nav-${Date.now()}`, label: "رابط جديد", target: "#services-showcase", enabled: true }
              ])
            }
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-bold gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة رابط</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {navLinks.map((lnk, lIdx) => (
            <div key={lnk.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
              <input
                type="checkbox"
                checked={lnk.enabled !== false}
                onChange={(e) => {
                  const next = [...navLinks];
                  next[lIdx] = { ...lnk, enabled: e.target.checked };
                  updateNavLinks(next);
                }}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
              <Input
                value={lnk.label}
                onChange={(e) => {
                  const next = [...navLinks];
                  next[lIdx] = { ...lnk, label: e.target.value };
                  updateNavLinks(next);
                }}
                className="h-8 text-xs font-bold flex-1"
                placeholder="اسم الرابط"
              />
              <select
                value={lnk.tab ? `${lnk.target}:${lnk.tab}` : lnk.target}
                onChange={(e) => {
                  const [tgt, tb] = e.target.value.split(":");
                  const next = [...navLinks];
                  next[lIdx] = { ...lnk, target: tgt, tab: tb || undefined };
                  updateNavLinks(next);
                }}
                className="h-8 border border-slate-300 rounded-lg px-2 text-[11px] font-bold"
              >
                <option value="#hero-section">الرئيسية</option>
                <option value="#services-showcase">الخدمات</option>
                <option value="#booking-console:flights">الرحلات</option>
                <option value="#booking-console:lookup">الحجوزات</option>
                <option value="#booking-console:visas">التأشيرات</option>
                <option value="#booking-console:hotels">الفنادق</option>
                <option value="#booking-console:packages">الباقات</option>
                <option value="#contact-section">تواصل معنا</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => updateNavLinks(navLinks.filter((_, i) => i !== lIdx))}
                className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Topbar, Geo Location, Auth Buttons & Social Links */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <Share2 className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-black text-slate-900">الموقع الجغرافي وأزرار الدخول والتواصل الاجتماعي</h3>
            <p className="text-[11px] text-slate-500">ضبط الشريط العلوي وروابط منصات التواصل</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>الموقع الجغرافي في الشريط العلوي</span>
            </label>
            <Input
              value={formState.geo_location || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, geo_location: e.target.value } : prev))
              }
              placeholder="مثال: الرياض • المملكة العربية السعودية"
              className="h-9 text-xs bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">العنوان في التذييل</label>
            <Input
              value={formState.footer_address || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, footer_address: e.target.value } : prev))
              }
              className="h-9 text-xs bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">رابط X (تويتر)</label>
            <Input
              value={formState.x_url || ""}
              onChange={(e) => setFormState((prev) => (prev ? { ...prev, x_url: e.target.value } : prev))}
              placeholder="https://x.com/..."
              className="h-9 text-xs bg-white font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">رابط Instagram</label>
            <Input
              value={formState.instagram_url || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, instagram_url: e.target.value } : prev))
              }
              placeholder="https://instagram.com/..."
              className="h-9 text-xs bg-white font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">رابط Facebook</label>
            <Input
              value={formState.facebook_url || ""}
              onChange={(e) =>
                setFormState((prev) => (prev ? { ...prev, facebook_url: e.target.value } : prev))
              }
              placeholder="https://facebook.com/..."
              className="h-9 text-xs bg-white font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={formState.show_social_links !== 0}
                onChange={(e) =>
                  setFormState((prev) =>
                    prev ? { ...prev, show_social_links: e.target.checked ? 1 : 0 } : prev
                  )
                }
                className="w-4 h-4 accent-blue-600"
              />
              <span>إظهار روابط التواصل</span>
            </label>
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={formState.show_login_btn !== 0}
                onChange={(e) =>
                  setFormState((prev) =>
                    prev ? { ...prev, show_login_btn: e.target.checked ? 1 : 0 } : prev
                  )
                }
                className="w-4 h-4 accent-blue-600"
              />
              <span>زر تسجيل الدخول</span>
            </label>
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={formState.show_register_btn !== 0}
                onChange={(e) =>
                  setFormState((prev) =>
                    prev ? { ...prev, show_register_btn: e.target.checked ? 1 : 0 } : prev
                  )
                }
                className="w-4 h-4 accent-blue-600"
              />
              <span>زر إنشاء حساب</span>
            </label>
          </div>
        </div>
      </div>

      {/* 5. Promotions & Ad Banners Manager */}
      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <Megaphone className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-black text-slate-900">البنرات الإعلانية والعروض الترويجية</h3>
            <p className="text-[11px] text-slate-500">إضافة وإدارة بنرات العروض الخاصة مع إمكانية رفع صورة مخصصة لكل بنر</p>
          </div>
        </div>

        <form onSubmit={handleAddPromoSubmit} className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <Input
            required
            placeholder="عنوان البنر الإعلاني *"
            value={newPromo.title}
            onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
            className="h-9 text-xs"
          />
          <Input
            placeholder="وصف العرض"
            value={newPromo.subtitle || ""}
            onChange={(e) => setNewPromo({ ...newPromo, subtitle: e.target.value })}
            className="h-9 text-xs"
          />
          <Input
            placeholder="نسبة/نص الخصم (مثال: خصم 15%)"
            value={newPromo.discount_text || ""}
            onChange={(e) => setNewPromo({ ...newPromo, discount_text: e.target.value })}
            className="h-9 text-xs"
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Input
              placeholder="رابط صورة البنر (اختياري)"
              value={newPromo.image_url || ""}
              onChange={(e) => setNewPromo({ ...newPromo, image_url: e.target.value })}
              className="h-9 text-xs flex-1"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await onUploadAsset(file, "promo_banner");
                  if (url) setNewPromo({ ...newPromo, image_url: url });
                }}
              />
              <span className="inline-flex items-center gap-1 px-3 h-9 rounded-lg border border-slate-300 bg-slate-50 font-bold">
                <Upload className="w-3.5 h-3.5" />
                <span>رفع صورة</span>
              </span>
            </label>
          </div>
          <Button type="submit" disabled={promoSaving} className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-bold gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>{promoSaving ? "جارٍ الإضافة..." : "إضافة بنر إعلاني"}</span>
          </Button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {promotions.map((p) => (
            <div key={p.id} className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url && (
                  <img src={p.image_url} alt={p.title} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">{p.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">{p.subtitle}</div>
                  {p.discount_text && (
                    <span className="text-[10px] font-bold text-amber-600">{p.discount_text}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => p.id && onUpdatePromotion(p.id, { is_active: p.is_active === 1 ? 0 : 1 })}
                  className="h-8 text-[11px]"
                >
                  {p.is_active === 1 ? "نشط" : "مخفي"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => p.id && onDeletePromotion(p.id)}
                  className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
