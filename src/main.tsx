import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Intercept benign dev-mode WebSocket HMR disconnection events in sandbox iframe
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reasonStr = String(event.reason?.message || event.reason || "");
    if (reasonStr.includes("WebSocket") || reasonStr.includes("websocket")) {
      event.preventDefault();
    }
  });
}

if (typeof window !== "undefined") {
  try {
    const sessionToken = sessionStorage.getItem("pos_token");
    if (!sessionToken) {
      localStorage.removeItem("pos_token");
      localStorage.removeItem("token");
    } else {
      localStorage.setItem("pos_token", sessionToken);
    }
  } catch (e) {}
}

setBaseUrl("");
setAuthTokenGetter(() => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token");
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
