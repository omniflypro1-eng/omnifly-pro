import { useQuery } from "@tanstack/react-query";

export function useAgencyConfig() {
  const { data: globalSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: travelConfig } = useQuery({
    queryKey: ["travel-settings"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  return {
    agencyName: globalSettings?.businessName || travelConfig?.company_name_ar || "وكالة أومني فلاي برو للسياحة والسفر",
    agencyNameEn: travelConfig?.company_name_en || "OMNIFLY PRO TRAVEL & TOURISM",
    logoUrl: globalSettings?.logoUrl || travelConfig?.logo_url || "/assets/images/omnisystem_pro_logo_1784250216808.png",
    currency: globalSettings?.currency || travelConfig?.default_currency || "ريال",
    address: globalSettings?.address || travelConfig?.address || "",
    phone: globalSettings?.phone || travelConfig?.phone_primary || "",
    taxNumber: globalSettings?.taxNumber || travelConfig?.tax_number || "",
    licenseNumber: travelConfig?.license_number || "",
    iataCode: travelConfig?.iata_code || "",
    promoText: "تم إصدار هذا المستند عبر نظام أومني فلاي برو المتكامل للسفريات",
    config: { ...travelConfig, ...globalSettings }
  };
}
