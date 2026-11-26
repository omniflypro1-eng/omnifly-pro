import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@workspace/api-client-react";
import { PageLoader } from "@/components/PageLoader";
import {
  getStoredAuthToken,
  setStoredAuthToken,
  clearStoredAuthToken,
} from "@/lib/safe-storage";
import {
  isPathAllowedForUser,
  getDefaultLandingRoute,
  isFullAdminUser,
  isModuleAllowed,
} from "@/lib/permissions";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user?: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredToken(): string | null {
  return getStoredAuthToken();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(getStoredToken);
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  useEffect(() => {
    // If the server returns an explicit authentication error (401/403)
    if (error && token) {
      clearStoredAuthToken();
      setToken(null);
      queryClient.setQueryData(getGetMeQueryKey(), null);
      if (location !== "/login") {
        setLocation("/login");
      }
    }
  }, [error, token, location, setLocation, queryClient]);

  const login = (newToken: string, newUser?: User) => {
    setStoredAuthToken(newToken);
    setToken(newToken);
    if (newUser) {
      queryClient.setQueryData(getGetMeQueryKey(), newUser);
    }
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const logout = () => {
    clearStoredAuthToken();
    setToken(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading: !!token && isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

const ADMIN_ONLY_PREFIXES = [
  "/users",
  "/audit",
  "/licenses",
  "/branches",
  "/currencies",
  "/backup-restore",
  "/backup",
  "/system-backup",
  "/settings",
  "/document-print-settings",
];

function computeRouteAccess(user: User, path: string, requireAdmin: boolean, requireDeveloper: boolean): boolean {
  const role = String(user.role || "");
  const isDev = role === "developer" || user.username?.toLowerCase() === "developer";
  if (requireDeveloper && !isDev) return false;
  if (isDev) return true;

  // Enforce module-based path permissions
  if (!isPathAllowedForUser(user, path)) {
    return false;
  }

  const isAdminOnlyPath = ADMIN_ONLY_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  const hasExplicitModules = Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0;
  const isStrictAdmin = isFullAdminUser(user);

  if (isAdminOnlyPath) {
    if (hasExplicitModules) {
      return isModuleAllowed(user, "sys_admin");
    }
    return isStrictAdmin;
  }

  if (requireAdmin) {
    const isStaff =
      isStrictAdmin ||
      [
        "website_manager",
        "مدير الموقع الإلكتروني",
        "accountant",
        "محاسب",
        "sales",
        "موظف مبيعات",
        "موظف مبيعات وحجوزات سياحية",
        "gds_spec",
        "أخصائي أنظمة GDS وإصدار التذاكر",
        "purchasing",
        "موظف مشتريات",
        "مسؤول مشتريات الخدمات والموردين",
        "storekeeper",
        "inventory",
        "أمين مخزن",
        "hr",
        "شؤون موظفين",
        "cashier",
        "كاشير",
      ].includes(role);
    return isStaff || hasExplicitModules;
  }

  return true;
}

export function ProtectedRoute({ children, requireAdmin = false, requireDeveloper = false }: { children: React.ReactNode; requireAdmin?: boolean; requireDeveloper?: boolean }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const storedToken = getStoredToken();
  const currentPath = (typeof window !== "undefined" ? window.location.pathname : location) || "/";

  useEffect(() => {
    if (!storedToken && !isLoading) {
      setLocation("/login");
      return;
    }

    if (!isLoading && user) {
      if (!computeRouteAccess(user, currentPath, requireAdmin, requireDeveloper)) {
        const fallbackRoute = getDefaultLandingRoute(user);
        const fallbackPath = fallbackRoute.split("?")[0];
        if (currentPath !== fallbackPath) {
          setLocation(fallbackRoute);
        }
      }
    }
  }, [user, isLoading, storedToken, requireAdmin, requireDeveloper, currentPath, setLocation]);

  if (!storedToken) {
    return <PageLoader message="جاري التوجيه إلى شاشة تسجيل الدخول..." />;
  }

  if (isLoading || !user) {
    return <PageLoader message="جاري التحقق من الصلاحيات وتجهيز بيئة العمل..." />;
  }

  const hasAccess = computeRouteAccess(user, currentPath, requireAdmin, requireDeveloper);

  if (!hasAccess) {
    return <PageLoader message="جاري التحويل للصفحة المصرحة..." />;
  }

  return <>{children}</>;
}
