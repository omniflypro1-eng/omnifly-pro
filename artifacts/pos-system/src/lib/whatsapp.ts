/**
 * WhatsApp Dispatch Utility for OmniFly Pro / Njaz
 * Supports direct native dispatch (whatsapp://send) to activate the installed WhatsApp application
 * directly on Windows, macOS, Android, or iOS without opening the intermediate wa.me/web webpage.
 */

export type WhatsAppSendMode = "installed_app" | "manual_web";

export interface WhatsAppPermissionConfig {
  authorized: boolean;
  mode: WhatsAppSendMode;
  alwaysRemember: boolean;
}

const STORAGE_KEY = "pos_whatsapp_permission_config";

export function getWhatsAppPermission(): WhatsAppPermissionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}

  const legacyAuth = localStorage.getItem("pos_whatsapp_authorized");
  if (legacyAuth === "true") {
    return { authorized: true, mode: "installed_app", alwaysRemember: true };
  }

  return { authorized: false, mode: "installed_app", alwaysRemember: true };
}

export function saveWhatsAppPermission(config: Partial<WhatsAppPermissionConfig>): WhatsAppPermissionConfig {
  const current = getWhatsAppPermission();
  const updated: WhatsAppPermissionConfig = {
    authorized: true,
    mode: config.mode || current.mode || "installed_app",
    alwaysRemember: config.alwaysRemember ?? true
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem("pos_whatsapp_authorized", "true");
  return updated;
}

export function resetWhatsAppPermission(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("pos_whatsapp_authorized");
}

/**
 * Format standard phone number for WhatsApp
 */
export function formatWhatsAppPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  }
  if (clean.startsWith("05") && clean.length === 10) {
    clean = "966" + clean.slice(1);
  } else if (clean.startsWith("5") && clean.length === 9) {
    clean = "966" + clean;
  }
  return clean;
}

/**
 * Dispatches a message to WhatsApp.
 * - When mode is "installed_app" (default upon authorization): uses whatsapp://send
 *   which activates the installed app directly and completely avoids wa.me / web intermediary pages.
 * - Prompts for permission once if not already authorized.
 */
export function dispatchWhatsApp({
  phone,
  text,
  onRequirePermission
}: {
  phone?: string;
  text: string;
  onRequirePermission?: (pendingAction: () => void) => void;
}): void {
  const perm = getWhatsAppPermission();
  const cleanPhone = phone ? formatWhatsAppPhone(phone) : "";

  // If permission has not been granted yet, show the permission dialog once
  if (!perm.authorized && onRequirePermission) {
    onRequirePermission(() => {
      executeDispatch(cleanPhone, text);
    });
    return;
  }

  executeDispatch(cleanPhone, text);
}

function executeDispatch(cleanPhone: string, text: string): void {
  const perm = getWhatsAppPermission();
  const mode = perm.mode || "installed_app";
  const encodedText = encodeURIComponent(text);

  if (mode === "installed_app") {
    // Direct Native WhatsApp Protocol:
    // This directly tells the OS (Windows / macOS / Android / iOS) to open the installed WhatsApp application
    const nativeUri = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
      : `whatsapp://send?text=${encodedText}`;

    // Electron desktop integration
    if (typeof window !== "undefined" && (window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(nativeUri).catch(() => {
        // Fallback
        launchProtocolViaAnchor(nativeUri);
      });
      return;
    }

    launchProtocolViaAnchor(nativeUri);
  } else {
    // Manual / Web mode fallback
    const webUri = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://web.whatsapp.com/send?text=${encodedText}`;
    window.open(webUri, "_blank");
  }
}

function launchProtocolViaAnchor(uri: string): void {
  try {
    const a = document.createElement("a");
    a.href = uri;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 300);
  } catch (e) {
    window.location.href = uri;
  }
}
