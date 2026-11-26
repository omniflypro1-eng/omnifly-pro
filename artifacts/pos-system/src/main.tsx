import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  installSafeWebStorageShim,
  safeGetSessionItem,
  safeSetLocalItem,
  safeRemoveLocalItem,
  getStoredAuthToken,
} from "./lib/safe-storage";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

installSafeWebStorageShim();

// Gracefully suppress benign Vite HMR WebSocket closed notices in sandboxed preview / dev mode
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (
      event.reason &&
      (String(event.reason).includes("WebSocket") ||
        String(event.reason?.message).includes("WebSocket"))
    ) {
      event.preventDefault();
    }
  });
  window.addEventListener("error", (event) => {
    const msg = String(event?.message || event?.error?.message || "");
    if (msg.includes("WebSocket") && msg.includes("vite")) {
      event.preventDefault();
    }
  });
}

if (typeof window !== "undefined") {
  try {
    const sessionToken = safeGetSessionItem("pos_token");
    if (!sessionToken) {
      // Fresh app open or closed window: wipe stale tokens to force login screen
      safeRemoveLocalItem("pos_token");
      safeRemoveLocalItem("token");
    } else {
      // Active session (e.g. page refresh): ensure localStorage is in sync
      safeSetLocalItem("pos_token", sessionToken);
    }
  } catch (e) {}
}

setBaseUrl("");

setAuthTokenGetter(() => {
  if (typeof window === "undefined") return null;
  return getStoredAuthToken();
});

const root = document.getElementById("root");
if (root) {
  root.setAttribute("dir", "rtl");
}

createRoot(root!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
