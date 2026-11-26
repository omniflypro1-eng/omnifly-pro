import type { User } from "@workspace/api-client-react";

export interface SystemModuleMeta {
  id: string;
  label: string;
  description: string;
  defaultRoute: string;
}

export const SYSTEM_MODULES_META: SystemModuleMeta[] = [
  {
    id: "sys_website",
    label: "إدارة الموقع الإلكتروني للعملاء",
    description: "تصميم الموقع، الهوية البصرية، الحجوزات الإلكترونية، الاستفسارات وبوابات B2B/B2C",
    defaultRoute: "/website-management"
  },
  {
    id: "sys_travel",
    label: "نظام السفريات والسياحة ERP",
    description: "العمليات اليومية، الحجز السريع، العملاء، المسافرين والوثائق",
    defaultRoute: "/travel-operations"
  },
  {
    id: "sys_services",
    label: "خدمات وحجوزات السفر",
    description: "تذاكر الطيران، الفنادق، التأشيرات، الباقات، الباصات والتأمين",
    defaultRoute: "/travel-bookings"
  },
  {
    id: "sys_sales",
    label: "المبيعات والفواتير السياحية",
    description: "الفواتير المركزية، عروض الأسعار، العمولات والتقارير السياحية",
    defaultRoute: "/travel-invoices"
  },
  {
    id: "sys_purchases",
    label: "مشتريات الخدمات والموردين",
    description: "طلبات الشراء، عروض الموردين، فواتير الموردين والتسويات",
    defaultRoute: "/travel-procurement?tab=requests"
  },
  {
    id: "sys_accounting",
    label: "نظام الحسابات العامة والقيود",
    description: "شجرة الحسابات، اليومية، سندات القبض والصرف، الصناديق والبنوك والتقارير المالية",
    defaultRoute: "/accounting?tab=dashboard"
  },
  {
    id: "sys_hr",
    label: "نظام شؤون الموظفين والوكلاء",
    description: "الموظفون، الحضور والانصراف، مسير الرواتب، السلف والإجازات",
    defaultRoute: "/hr?view=employees"
  },
  {
    id: "sys_enterprise",
    label: "الأنظمة العالمية المتقدمة (NDC / GDS)",
    description: "بوابة NDC، شاشة GDS، مجمع الفنادق، ZATCA ومركز التنبيهات",
    defaultRoute: "/travel-ndc-hub"
  },
  {
    id: "sys_admin",
    label: "إدارة وتهيئة النظام والأمان",
    description: "المستخدمون والصلاحيات، التدقيق، العملات، الفروع، النسخ الاحتياطي والإعدادات",
    defaultRoute: "/settings"
  },
  {
    id: "sys_help",
    label: "المساعدة والدعم والبرشورات",
    description: "دليل التشغيل والبرشورات التعريفية",
    defaultRoute: "/system-guide"
  }
];

export const ALL_MODULE_IDS = SYSTEM_MODULES_META.map((m) => m.id);

export function isFullAdminUser(user?: User | null): boolean {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  const uname = String(user.username || "").toLowerCase();
  if (role === "developer" || uname === "developer") return true;
  if (uname === "admin") return true;
  return (
    role === "admin" ||
    role === "general_manager" ||
    role === "manager" ||
    role === "مدير" ||
    role === "مدير عام" ||
    role === "مدير عام الشركة"
  );
}

/**
 * Returns the explicit list of permitted module IDs when configured,
 * OR computes the legacy role-based list when `allowed_modules` is null/undefined.
 */
export function getEffectiveAllowedModules(user?: User | null): string[] {
  if (!user) return [];

  if (Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0) {
    return Array.from(new Set(user.allowed_modules.filter((m) => ALL_MODULE_IDS.includes(m))));
  }

  if (isFullAdminUser(user)) {
    return [...ALL_MODULE_IDS];
  }

  const role = String(user.role || "");
  if (role === "website_manager" || role === "مدير الموقع الإلكتروني") {
    return ["sys_website"];
  }
  if (role === "cashier" || role === "كاشير") {
    return ["sys_enterprise", "sys_travel", "sys_services", "sys_sales", "sys_help"];
  }
  if (role === "sales" || role === "gds_spec" || role === "موظف مبيعات" || role === "موظف مبيعات وحجوزات سياحية" || role === "أخصائي أنظمة GDS وإصدار التذاكر") {
    return ["sys_travel", "sys_services", "sys_sales", "sys_help"];
  }
  if (role === "purchasing" || role === "موظف مشتريات" || role === "مسؤول مشتريات الخدمات والموردين") {
    return ["sys_purchases", "sys_help"];
  }
  if (role === "accountant" || role === "محاسب") {
    return ["sys_enterprise", "sys_travel", "sys_services", "sys_sales", "sys_purchases", "sys_accounting", "sys_help"];
  }
  if (role === "inventory" || role === "storekeeper" || role === "أمين مخزن") {
    return ["sys_services", "sys_purchases", "sys_help"];
  }
  if (role === "hr" || role === "شؤون موظفين") {
    return ["sys_hr", "sys_help"];
  }

  return ["sys_travel", "sys_services", "sys_sales", "sys_help"];
}

export function isModuleAllowed(user: User | null | undefined, moduleId: string): boolean {
  if (!user) return false;
  // Explicit custom module restrictions override even admin/role defaults unless developer or system admin with no restriction
  if (Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0) {
    // Allow developer account safety valve only if developer
    if (String(user.role || "").toLowerCase() === "developer" || String(user.username || "").toLowerCase() === "developer") {
      return true;
    }
    return user.allowed_modules.includes(moduleId);
  }
  return getEffectiveAllowedModules(user).includes(moduleId);
}

const ROUTE_MODULE_RULES: Array<{ prefixes: string[]; moduleId: string }> = [
  {
    prefixes: [
      "/website-management",
      "/travel/website-management"
    ],
    moduleId: "sys_website"
  },
  {
    prefixes: [
      "/travel-ndc",
      "/travel/ndc",
      "/travel-gds",
      "/travel/gds",
      "/travel-hotel-aggregator",
      "/travel/hotel-aggregator",
      "/travel/markup-rules",
      "/travel-charter",
      "/travel/charter",
      "/travel/allotments",
      "/travel-zatca",
      "/travel/zatca",
      "/travel-vcc",
      "/travel/vcc",
      "/travel-smart-itinerary",
      "/travel/smart-itinerary",
      "/travel/ai-itinerary",
      "/travel-b2b",
      "/travel/b2b",
      "/travel-b2c",
      "/travel/b2c",
      "/travel-bsp",
      "/travel/bsp",
      "/travel-notifications",
      "/travel/notifications",
      "/whatsapp",
      "/notifications",
      "/travel-atb",
      "/travel/atb"
    ],
    moduleId: "sys_enterprise"
  },
  {
    prefixes: [
      "/travel-operations",
      "/travel/operations",
      "/travel-wizard",
      "/travel/wizard",
      "/pos",
      "/travel-manager",
      "/travel/manager",
      "/travel-approvals",
      "/travel/approvals",
      "/travel-branches",
      "/travel/branches",
      "/travel-tasks",
      "/travel/tasks",
      "/customers",
      "/passengers",
      "/travel/passengers",
      "/travel-documents",
      "/travel/documents",
      "/travel-settings",
      "/travel/settings"
    ],
    moduleId: "sys_travel"
  },
  {
    prefixes: [
      "/travel-bookings",
      "/travel/bookings",
      "/products",
      "/travel-bus",
      "/travel/bus",
      "/travel-refunds",
      "/travel/refunds",
      "/returns",
      "/travel-modifications",
      "/travel/modifications",
      "/travel-hotels",
      "/travel/hotels",
      "/travel-visas",
      "/travel/visas",
      "/travel-packages",
      "/travel/packages",
      "/travel-tours",
      "/travel/tours",
      "/travel-transport",
      "/travel/transport",
      "/travel-insurance",
      "/travel/insurance",
      "/travel-airlines",
      "/travel/airlines",
      "/categories",
      "/travel-airports",
      "/travel/airports",
      "/inventory"
    ],
    moduleId: "sys_services"
  },
  {
    prefixes: [
      "/travel-invoices",
      "/travel/invoices",
      "/orders",
      "/travel-quotations",
      "/travel/quotations",
      "/travel-commissions",
      "/travel/commissions",
      "/reports",
      "/travel-reports",
      "/travel/reports",
      "/travel-customer-statement",
      "/travel/customer-statement",
      "/travel/sales-statement"
    ],
    moduleId: "sys_sales"
  },
  {
    prefixes: [
      "/travel-procurement",
      "/travel/procurement",
      "/purchases",
      "/travel-suppliers",
      "/travel/suppliers",
      "/suppliers"
    ],
    moduleId: "sys_purchases"
  },
  {
    prefixes: [
      "/accounting",
      "/expenses",
      "/onyx-erp"
    ],
    moduleId: "sys_accounting"
  },
  {
    prefixes: ["/hr"],
    moduleId: "sys_hr"
  },
  {
    prefixes: [
      "/users",
      "/audit",
      "/currencies",
      "/document-print-settings",
      "/branches",
      "/backup-restore",
      "/backup",
      "/system-backup",
      "/sync-center",
      "/cloud-sync",
      "/licenses",
      "/print-log",
      "/settings",
      "/tables",
      "/shifts"
    ],
    moduleId: "sys_admin"
  },
  {
    prefixes: ["/brochures", "/system-guide"],
    moduleId: "sys_help"
  }
];

/**
 * Shared routes accessible when a user owns ANY of several modules.
 */
const MULTI_MODULE_ROUTES: Array<{ prefixes: string[]; moduleIds: string[] }> = [
  {
    prefixes: [
      "/travel-b2b",
      "/travel/b2b",
      "/travel-b2b-portal",
      "/travel/b2b-portal",
      "/travel-b2c",
      "/travel/b2c",
      "/travel-b2c-portal",
      "/travel/b2c-portal",
      "/travel-notifications",
      "/travel/notifications",
      "/travel-notifications-hub",
      "/travel/notifications-hub",
      "/whatsapp",
      "/whatsapp-hub",
      "/notifications"
    ],
    moduleIds: ["sys_website", "sys_enterprise"]
  },
  {
    prefixes: ["/travel-dashboard", "/travel/dashboard", "/dashboard"],
    moduleIds: ["sys_travel", "sys_enterprise", "sys_admin"]
  }
];

export function isPathAllowedForUser(user: User | null | undefined, pathname: string): boolean {
  if (!user) return false;
  const cleanPath = (pathname || "/").split("?")[0] || "/";
  if (cleanPath === "/login" || cleanPath.startsWith("/portal") || cleanPath.startsWith("/site/") || cleanPath === "/online" || cleanPath === "/booking" || cleanPath === "/website") {
    return true;
  }

  const allowedModules = getEffectiveAllowedModules(user);

  // Root or dashboard path
  if (cleanPath === "/" || cleanPath === "/travel" || cleanPath === "/travel-dashboard" || cleanPath === "/travel/dashboard" || cleanPath === "/dashboard") {
    return allowedModules.some((m) => ["sys_travel", "sys_enterprise", "sys_admin"].includes(m));
  }

  for (const multi of MULTI_MODULE_ROUTES) {
    if (multi.prefixes.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"))) {
      if (multi.moduleIds.some((m) => allowedModules.includes(m))) {
        return true;
      }
      return false;
    }
  }

  for (const rule of ROUTE_MODULE_RULES) {
    if (rule.prefixes.some((p) => cleanPath === p || cleanPath.startsWith(p + "/") || cleanPath.startsWith(p))) {
      return allowedModules.includes(rule.moduleId);
    }
  }

  // Fallback: require general admin/travel permission if unmatched
  return isFullAdminUser(user);
}

export function getDefaultLandingRoute(user?: User | null): string {
  if (!user) return "/login";

  const hasExplicit = Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0;
  const allowed = getEffectiveAllowedModules(user);

  if (hasExplicit) {
    if (allowed.length === 1) {
      const meta = SYSTEM_MODULES_META.find((m) => m.id === allowed[0]);
      if (meta) return meta.defaultRoute;
    }
    if (allowed.includes("sys_travel") || allowed.includes("sys_enterprise") || allowed.includes("sys_admin")) {
      return "/travel-dashboard";
    }
    const firstMeta = SYSTEM_MODULES_META.find((m) => allowed.includes(m.id));
    if (firstMeta) return firstMeta.defaultRoute;
  }

  const role = String(user.role || "");
  if (role === "website_manager" || role === "مدير الموقع الإلكتروني") {
    return "/website-management";
  }
  if (role === "hr" || role === "شؤون موظفين") {
    return "/hr?view=employees";
  }
  if (role === "purchasing" || role === "موظف مشتريات" || role === "مسؤول مشتريات الخدمات والموردين") {
    return "/travel-procurement?tab=requests";
  }
  if (role === "accountant" || role === "محاسب") {
    return "/accounting?tab=dashboard";
  }
  if (role === "inventory" || role === "storekeeper" || role === "أمين مخزن") {
    return "/travel-bookings";
  }

  return "/travel-dashboard";
}
