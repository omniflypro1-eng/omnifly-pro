import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { db } from "./sqlite";
import { logger } from "./logger";
import { getSystemAgencyProfile, type SystemAgencyProfile } from "./agency-profile";

const UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads/passengers_pdfs");
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch {}
}

let fontsRegistered = false;
function ensureArabicFontsRegistered() {
  if (fontsRegistered) return;
  const repoFontDir = path.resolve(process.cwd(), "artifacts/api-server/assets/fonts");
  const sysFontDir = "/usr/share/fonts/truetype/noto";

  const registerFirst = (fileName: string, family: string) => {
    const candidates = [
      path.join(repoFontDir, fileName),
      path.join(sysFontDir, fileName),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          GlobalFonts.registerFromPath(p, family);
          return true;
        } catch {}
      }
    }
    return false;
  };

  registerFirst("NotoKufiArabic-Regular.ttf", "NotoKufi");
  registerFirst("NotoKufiArabic-Bold.ttf", "NotoKufiBold");
  registerFirst("NotoSans-Regular.ttf", "NotoSans");
  registerFirst("NotoSans-Bold.ttf", "NotoSansBold");
  fontsRegistered = true;
}

export type TravelPdfDocKind = "passenger" | "flight" | "bus" | "hotel" | "visa";

export interface PdfFieldItem {
  labelAr: string;
  labelEn: string;
  value: string;
  icon:
    | "passport"
    | "globe"
    | "doc"
    | "calendar"
    | "clock"
    | "exit"
    | "status"
    | "phone"
    | "hash"
    | "plane"
    | "ticket"
    | "seat"
    | "baggage"
    | "bus"
    | "map"
    | "hotel"
    | "room"
    | "money"
    | "user";
  isLtr?: boolean;
  highlight?: "normal" | "success" | "warning" | "danger";
}

export interface TravelPdfSpec {
  kind: TravelPdfDocKind;
  fileName: string;
  titleAr: string;
  titleEn: string;
  heroTitle: string;
  heroSubtitle: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "info";
  docRef: string;
  qrPayload: string;
  fields: PdfFieldItem[]; // up to 10 items (5 rows x 2 cols)
  footerNote?: string;
}

interface KindTheme {
  primaryNavy: string;
  secondaryNavy: string;
  accentSky: string;
  accentWarm: string;
  bgTintTop: string;
  bgTintBottom: string;
  cardBgTop: string;
  cardBgBottom: string;
  cardBorder: string;
  iconBg: string;
  iconStroke: string;
}

const KIND_THEMES: Record<TravelPdfDocKind, KindTheme> = {
  passenger: {
    primaryNavy: "#0B3B75",
    secondaryNavy: "#125CA8",
    accentSky: "#1B85D6",
    accentWarm: "#F28B1A",
    bgTintTop: "#EDF5FF",
    bgTintBottom: "#DCEBFF",
    cardBgTop: "#F2F8FF",
    cardBgBottom: "#FFFFFF",
    cardBorder: "#B9D5F4",
    iconBg: "#EBF4FF",
    iconStroke: "#0B4B8C",
  },
  flight: {
    primaryNavy: "#092D5C",
    secondaryNavy: "#0E569E",
    accentSky: "#0EA5E9",
    accentWarm: "#F59E0B",
    bgTintTop: "#EAF7FF",
    bgTintBottom: "#D6EEFF",
    cardBgTop: "#F0F9FF",
    cardBgBottom: "#FFFFFF",
    cardBorder: "#BAE0FD",
    iconBg: "#E6F4FE",
    iconStroke: "#0369A1",
  },
  bus: {
    primaryNavy: "#0A3A4A",
    secondaryNavy: "#0F627A",
    accentSky: "#0D9488",
    accentWarm: "#EA7B15",
    bgTintTop: "#EAF7F8",
    bgTintBottom: "#D5EDF0",
    cardBgTop: "#EFFAFB",
    cardBgBottom: "#FFFFFF",
    cardBorder: "#B3DDE2",
    iconBg: "#E6F6F7",
    iconStroke: "#0F5E73",
  },
  hotel: {
    primaryNavy: "#1E2952",
    secondaryNavy: "#314483",
    accentSky: "#4F6AD0",
    accentWarm: "#D98218",
    bgTintTop: "#F3F4FC",
    bgTintBottom: "#E3E6F8",
    cardBgTop: "#F6F7FE",
    cardBgBottom: "#FFFFFF",
    cardBorder: "#C5CBEF",
    iconBg: "#EEF0FC",
    iconStroke: "#2B3D78",
  },
  visa: {
    primaryNavy: "#0C345E",
    secondaryNavy: "#14578C",
    accentSky: "#059669",
    accentWarm: "#F28B1A",
    bgTintTop: "#ECF6F9",
    bgTintBottom: "#D7ECEE",
    cardBgTop: "#F2F9FA",
    cardBgBottom: "#FFFFFF",
    cardBorder: "#B7DCE3",
    iconBg: "#E7F5F2",
    iconStroke: "#0E526A",
  },
};

export function safeFormatDate(val?: string | null, fallback = "غير محدد"): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (!s || s === "---" || s === "null" || s === "undefined" || s === "N/A") return fallback;
  // ISO datetime or YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return s.replace(/-/g, "/");
}

function wrapLtrIsolate(val: string): string {
  return `\u2066${val}\u2069`;
}

function sanitizeFileSegment(val: string, maxLen = 36): string {
  return (val || "doc")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, maxLen);
}

function drawRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawFittedText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  minSize: number,
  bold: boolean,
  align: "left" | "right" | "center",
  direction: "rtl" | "ltr"
) {
  let size = startSize;
  const family = bold ? "NotoKufiBold, NotoSansBold, sans-serif" : "NotoKufi, NotoSans, sans-serif";
  ctx.textAlign = align;
  ctx.direction = direction;
  while (size > minSize) {
    ctx.font = `${bold ? "bold " : ""}${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${bold ? "bold " : ""}${size}px ${family}`;
  let display = text;
  while (ctx.measureText(display).width > maxWidth && display.length > 4) {
    display = display.slice(0, -2) + "…";
  }
  ctx.fillText(display, x, y);
}

function drawVectorIcon(
  ctx: SKRSContext2D,
  icon: PdfFieldItem["icon"],
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (icon) {
    case "passport":
      drawRoundedRect(ctx, cx - 13, cy - 16, 26, 32, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 2);
      ctx.lineTo(cx + 7, cy - 2);
      ctx.moveTo(cx - 6, cy + 10);
      ctx.lineTo(cx + 6, cy + 10);
      ctx.stroke();
      break;
    case "globe":
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 7, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy);
      ctx.lineTo(cx + 15, cy);
      ctx.moveTo(cx - 12, cy - 7);
      ctx.lineTo(cx + 12, cy - 7);
      ctx.moveTo(cx - 12, cy + 7);
      ctx.lineTo(cx + 12, cy + 7);
      ctx.stroke();
      break;
    case "calendar":
      drawRoundedRect(ctx, cx - 14, cy - 12, 28, 26, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 4);
      ctx.lineTo(cx + 14, cy - 4);
      ctx.moveTo(cx - 7, cy - 16);
      ctx.lineTo(cx - 7, cy - 9);
      ctx.moveTo(cx + 7, cy - 16);
      ctx.lineTo(cx + 7, cy - 9);
      ctx.stroke();
      ctx.fillRect(cx - 8, cy + 1, 5, 4);
      ctx.fillRect(cx + 2, cy + 1, 5, 4);
      ctx.fillRect(cx - 8, cy + 7, 5, 4);
      break;
    case "clock":
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 7, cy + 4);
      ctx.stroke();
      break;
    case "exit":
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy - 14);
      ctx.lineTo(cx - 12, cy - 14);
      ctx.lineTo(cx - 12, cy + 14);
      ctx.lineTo(cx + 4, cy + 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy);
      ctx.lineTo(cx + 14, cy);
      ctx.moveTo(cx + 8, cy - 6);
      ctx.lineTo(cx + 14, cy);
      ctx.lineTo(cx + 8, cy + 6);
      ctx.stroke();
      break;
    case "status":
      ctx.fillRect(cx - 13, cy + 4, 6, 10);
      ctx.fillRect(cx - 3, cy - 3, 6, 17);
      ctx.fillRect(cx + 7, cy - 12, 6, 26);
      break;
    case "phone":
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy - 13);
      ctx.lineTo(cx - 5, cy - 13);
      ctx.lineTo(cx - 2, cy - 5);
      ctx.lineTo(cx - 6, cy - 1);
      ctx.quadraticCurveTo(cx - 2, cy + 6, cx + 4, cy + 8);
      ctx.lineTo(cx + 8, cy + 4);
      ctx.lineTo(cx + 14, cy + 8);
      ctx.lineTo(cx + 12, cy + 14);
      ctx.quadraticCurveTo(cx - 12, cy + 12, cx - 13, cy - 10);
      ctx.closePath();
      ctx.stroke();
      break;
    case "plane":
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy + 3);
      ctx.lineTo(cx + 16, cy - 4);
      ctx.lineTo(cx + 12, cy + 1);
      ctx.lineTo(cx - 3, cy + 4);
      ctx.lineTo(cx - 9, cy + 13);
      ctx.lineTo(cx - 13, cy + 13);
      ctx.lineTo(cx - 9, cy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 1);
      ctx.lineTo(cx - 10, cy - 12);
      ctx.lineTo(cx - 4, cy - 12);
      ctx.lineTo(cx + 4, cy - 2);
      ctx.closePath();
      ctx.fill();
      break;
    case "bus":
      drawRoundedRect(ctx, cx - 14, cy - 14, 28, 24, 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy);
      ctx.lineTo(cx + 14, cy);
      ctx.moveTo(cx - 9, cy + 10);
      ctx.lineTo(cx - 9, cy + 15);
      ctx.moveTo(cx + 9, cy + 10);
      ctx.lineTo(cx + 9, cy + 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 7, cy + 5, 2.2, 0, Math.PI * 2);
      ctx.arc(cx + 7, cy + 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "hotel":
      ctx.strokeRect(cx - 14, cy - 14, 28, 28);
      ctx.fillRect(cx - 9, cy - 9, 5, 5);
      ctx.fillRect(cx + 4, cy - 9, 5, 5);
      ctx.fillRect(cx - 9, cy - 1, 5, 5);
      ctx.fillRect(cx + 4, cy - 1, 5, 5);
      ctx.fillRect(cx - 4, cy + 6, 8, 8);
      break;
    case "ticket":
      drawRoundedRect(ctx, cx - 15, cy - 10, 30, 20, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 10);
      ctx.lineTo(cx - 4, cy + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy - 3);
      ctx.lineTo(cx + 10, cy - 3);
      ctx.moveTo(cx + 2, cy + 3);
      ctx.lineTo(cx + 10, cy + 3);
      ctx.stroke();
      break;
    case "seat":
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 13);
      ctx.lineTo(cx - 9, cy + 5);
      ctx.lineTo(cx + 10, cy + 5);
      ctx.lineTo(cx + 10, cy + 14);
      ctx.moveTo(cx - 9, cy + 11);
      ctx.lineTo(cx + 10, cy + 11);
      ctx.stroke();
      break;
    case "baggage":
      drawRoundedRect(ctx, cx - 11, cy - 7, 22, 21, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 7);
      ctx.lineTo(cx - 5, cy - 14);
      ctx.lineTo(cx + 5, cy - 14);
      ctx.lineTo(cx + 5, cy - 7);
      ctx.stroke();
      break;
    case "map":
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 10, Math.PI, 0, false);
      ctx.lineTo(cx, cy + 15);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "room":
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 10);
      ctx.lineTo(cx - 15, cy - 4);
      ctx.moveTo(cx - 15, cy + 5);
      ctx.lineTo(cx + 15, cy + 5);
      ctx.lineTo(cx + 15, cy + 10);
      ctx.stroke();
      drawRoundedRect(ctx, cx - 2, cy - 4, 15, 7, 2);
      ctx.stroke();
      break;
    case "money":
      drawRoundedRect(ctx, cx - 15, cy - 10, 30, 20, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "user":
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 14, 12, Math.PI, 0, false);
      ctx.stroke();
      break;
    case "hash":
    case "doc":
    default:
      drawRoundedRect(ctx, cx - 12, cy - 15, 24, 30, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 6);
      ctx.lineTo(cx + 6, cy - 6);
      ctx.moveTo(cx - 6, cy + 1);
      ctx.lineTo(cx + 6, cy + 1);
      ctx.moveTo(cx - 6, cy + 8);
      ctx.lineTo(cx + 3, cy + 8);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

async function resolveLogoImage(logoUrl?: string) {
  if (!logoUrl) return null;
  try {
    if (logoUrl.startsWith("data:image/")) {
      const idx = logoUrl.indexOf("base64,");
      if (idx !== -1) {
        const b64 = logoUrl.slice(idx + 7);
        return await loadImage(Buffer.from(b64, "base64"));
      }
    }
    const cleanRel = logoUrl.replace(/^\/+/, "").split("?")[0];
    const candidates = [
      path.resolve(process.cwd(), "public", cleanRel),
      path.resolve(process.cwd(), cleanRel),
      path.resolve(process.cwd(), "public/omnisystem-logo.png"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return await loadImage(fs.readFileSync(p));
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not load agency logo for PDF");
  }
  return null;
}

function drawSecurityShield(ctx: SKRSContext2D, x: number, y: number, primary: string, warm: string) {
  ctx.save();
  // Shield outer gold/warm border
  ctx.beginPath();
  ctx.moveTo(x + 58, y);
  ctx.lineTo(x + 112, y + 18);
  ctx.quadraticCurveTo(x + 114, y + 82, x + 58, y + 124);
  ctx.quadraticCurveTo(x + 2, y + 82, x + 4, y + 18);
  ctx.closePath();

  const goldGrad = ctx.createLinearGradient(x, y, x + 116, y + 124);
  goldGrad.addColorStop(0, "#F5B041");
  goldGrad.addColorStop(0.5, warm);
  goldGrad.addColorStop(1, "#B9690A");
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // Inner blue shield
  ctx.beginPath();
  ctx.moveTo(x + 58, y + 11);
  ctx.lineTo(x + 101, y + 26);
  ctx.quadraticCurveTo(x + 102, y + 77, x + 58, y + 111);
  ctx.quadraticCurveTo(x + 14, y + 77, x + 15, y + 26);
  ctx.closePath();

  const blueGrad = ctx.createLinearGradient(x + 15, y + 11, x + 101, y + 111);
  blueGrad.addColorStop(0, "#1D75CC");
  blueGrad.addColorStop(1, primary);
  ctx.fillStyle = blueGrad;
  ctx.fill();

  // Bold white checkmark
  ctx.beginPath();
  ctx.moveTo(x + 36, y + 60);
  ctx.lineTo(x + 53, y + 77);
  ctx.lineTo(x + 83, y + 43);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 9.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Bottom golden ribbon
  ctx.fillStyle = "#E7941D";
  drawRoundedRect(ctx, x + 16, y + 106, 84, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 11px NotoSansBold, sans-serif";
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText("VERIFIED", x + 58, y + 121);
  ctx.restore();
}

function drawSkylineWatermark(ctx: SKRSContext2D, W: number, baseY: number) {
  ctx.save();
  ctx.fillStyle = "rgba(25, 95, 165, 0.14)";
  const blocks = [
    [95, 45, 32],
    [135, 70, 26],
    [170, 52, 42],
    [225, 88, 34],
    [275, 44, 52],
    [340, 105, 30],
    [385, 65, 44],
    [445, 92, 36],
    [515, 118, 46],
    [578, 72, 34],
    [630, 96, 38],
    [685, 58, 44],
    [745, 112, 30],
    [795, 66, 48],
    [860, 82, 36],
    [915, 54, 42],
    [970, 90, 28],
    [1015, 50, 38],
  ];
  for (const [bx, bh, bw] of blocks) {
    ctx.fillRect(bx, baseY - bh, bw, bh);
  }
  // Subtle dome
  ctx.beginPath();
  ctx.arc(538, baseY - 118, 22, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(536, baseY - 154, 4, 16);
  // Subtle spire
  ctx.fillRect(353, baseY - 125, 4, 22);
  ctx.fillRect(758, baseY - 135, 4, 24);
  ctx.restore();
}

export async function renderTravelPdfDocument(spec: TravelPdfSpec): Promise<{
  fileUrl: string;
  fileName: string;
  filePath: string;
}> {
  ensureArabicFontsRegistered();

  const agency: SystemAgencyProfile = getSystemAgencyProfile();
  const theme = KIND_THEMES[spec.kind];
  const W = 1190;
  const H = 1684;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Background Soft Sky Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#FFFFFF");
  bgGrad.addColorStop(0.28, theme.bgTintTop);
  bgGrad.addColorStop(0.78, theme.bgTintBottom);
  bgGrad.addColorStop(1, "#E7F1FC");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative soft world/arc watermarks in top header
  ctx.save();
  ctx.strokeStyle = "rgba(27, 133, 214, 0.08)";
  ctx.lineWidth = 2;
  for (let r = 120; r <= 320; r += 55) {
    ctx.beginPath();
    ctx.arc(160, 85, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Top Agency Header (Right side RTL: Real Logo + Real Business Name + Address + Phones)
  const logoImg = await resolveLogoImage(agency.logoUrl);
  const headerRightX = 1125;

  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, headerRightX - 116, 28, 116, 116, 20);
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(11, 59, 117, 0.12)";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(11, 59, 117, 0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    drawRoundedRect(ctx, headerRightX - 110, 34, 104, 104, 16);
    ctx.clip();
    const scale = Math.min(96 / logoImg.width, 96 / logoImg.height);
    const dw = logoImg.width * scale;
    const dh = logoImg.height * scale;
    ctx.drawImage(logoImg, headerRightX - 58 - dw / 2, 86 - dh / 2, dw, dh);
    ctx.restore();
  } else {
    // Clean executive vector emblem fallback when no custom logo is uploaded
    ctx.save();
    drawRoundedRect(ctx, headerRightX - 110, 32, 110, 110, 22);
    const embGrad = ctx.createLinearGradient(headerRightX - 110, 32, headerRightX, 142);
    embGrad.addColorStop(0, theme.primaryNavy);
    embGrad.addColorStop(1, theme.accentSky);
    ctx.fillStyle = embGrad;
    ctx.shadowColor = "rgba(11, 59, 117, 0.16)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Gold inner ring + vector globe/plane
    ctx.beginPath();
    ctx.arc(headerRightX - 55, 87, 36, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawVectorIcon(ctx, "globe", headerRightX - 55, 87, "#FFFFFF");
    ctx.restore();
  }

  const textRightX = headerRightX - 134;
  ctx.fillStyle = theme.primaryNavy;
  drawFittedText(ctx, agency.businessName, textRightX, 66, 620, 32, 20, true, "right", "rtl");

  let headerSubY = 100;
  if (agency.address) {
    ctx.fillStyle = "#334E68";
    drawFittedText(ctx, agency.address, textRightX, headerSubY, 620, 18, 14, false, "right", "rtl");
    headerSubY += 28;
  }

  if (agency.allPhones.length > 0) {
    ctx.fillStyle = theme.accentSky;
    const phonesLine = agency.allPhones.map((p) => wrapLtrIsolate(p)).join("  |  ");
    drawFittedText(ctx, `للتواصل: ${phonesLine}`, textRightX, headerSubY, 620, 18, 14, true, "right", "rtl");
  } else if (agency.email) {
    ctx.fillStyle = theme.accentSky;
    drawFittedText(ctx, wrapLtrIsolate(agency.email), textRightX, headerSubY, 620, 18, 14, true, "right", "ltr");
  }

  // Top-left Electronic Document Meta Box
  ctx.save();
  drawRoundedRect(ctx, 65, 34, 290, 104, 18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fill();
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = theme.primaryNavy;
  drawFittedText(ctx, "مستند إلكتروني معتمد", 335, 66, 250, 17, 13, true, "right", "rtl");

  ctx.fillStyle = "#475569";
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  drawFittedText(ctx, `الإصدار: ${wrapLtrIsolate(todayStr)}`, 335, 94, 250, 15, 12, false, "right", "rtl");

  ctx.fillStyle = theme.accentSky;
  drawFittedText(ctx, spec.docRef, 85, 122, 250, 15, 11, true, "left", "ltr");
  ctx.restore();

  // 3. Signature Orange + Royal Navy Wavy Ribbon Banner (y: 162..308)
  ctx.save();
  // Warm amber/orange swoosh peaking along top curve of banner
  ctx.beginPath();
  ctx.moveTo(0, 152);
  ctx.bezierCurveTo(310, 140, 680, 182, W, 164);
  ctx.lineTo(W, 298);
  ctx.lineTo(0, 298);
  ctx.closePath();
  ctx.fillStyle = theme.accentWarm;
  ctx.fill();

  // Deep Navy wavy ribbon spanning cleanly behind all banner titles
  const waveGrad = ctx.createLinearGradient(0, 165, W, 305);
  waveGrad.addColorStop(0, theme.primaryNavy);
  waveGrad.addColorStop(0.55, theme.secondaryNavy);
  waveGrad.addColorStop(1, "#146EB8");
  ctx.beginPath();
  ctx.moveTo(0, 172);
  ctx.bezierCurveTo(320, 154, 720, 192, W, 170);
  ctx.lineTo(W, 296);
  ctx.bezierCurveTo(840, 316, 420, 286, 0, 302);
  ctx.closePath();
  ctx.fillStyle = waveGrad;
  ctx.fill();

  // Subtle sky-blue bottom wave highlight
  ctx.beginPath();
  ctx.moveTo(0, 296);
  ctx.bezierCurveTo(420, 280, 840, 310, W, 290);
  ctx.lineTo(W, 302);
  ctx.bezierCurveTo(840, 322, 420, 292, 0, 308);
  ctx.closePath();
  ctx.fillStyle = "#5CB4F5";
  ctx.fill();
  ctx.restore();

  // Document Type Icon Badge on Banner (Left) & Title RTL (Right)
  ctx.save();
  drawRoundedRect(ctx, 76, 194, 86, 86, 18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const bannerIcon: PdfFieldItem["icon"] =
    spec.kind === "flight"
      ? "plane"
      : spec.kind === "bus"
      ? "bus"
      : spec.kind === "hotel"
      ? "hotel"
      : spec.kind === "visa"
      ? "globe"
      : "passport";
  drawVectorIcon(ctx, bannerIcon, 119, 237, "#FFFFFF");
  ctx.restore();

  // Title Ar & En inside Banner
  ctx.fillStyle = "#FFFFFF";
  drawFittedText(ctx, spec.titleAr, 1115, 232, 910, 34, 22, true, "right", "rtl");
  ctx.fillStyle = "#CBE7FF";
  drawFittedText(ctx, spec.titleEn, 1115, 268, 910, 19, 14, true, "right", "ltr");

  // 4. Main Glassmorphic Card Container (y: 326..1250)
  ctx.save();
  ctx.shadowColor = "rgba(11, 59, 117, 0.10)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, 64, 326, W - 128, 922, 30);
  const cardGrad = ctx.createLinearGradient(0, 326, 0, 1248);
  cardGrad.addColorStop(0, theme.cardBgTop);
  cardGrad.addColorStop(1, theme.cardBgBottom);
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();

  // 4a. Top Navy Hero Strip Inside Card
  ctx.save();
  const heroGrad = ctx.createLinearGradient(94, 354, W - 94, 444);
  heroGrad.addColorStop(0, theme.primaryNavy);
  heroGrad.addColorStop(1, theme.secondaryNavy);
  drawRoundedRect(ctx, 94, 354, W - 188, 92, 20);
  ctx.fillStyle = heroGrad;
  ctx.fill();

  // Status Badge Pill on the Left side of Hero Strip
  const pillColors = {
    success: { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
    warning: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
    danger: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
    info: { bg: "#E0F2FE", text: "#075985", border: "#7DD3FC" },
  }[spec.statusTone];

  drawRoundedRect(ctx, 114, 376, 215, 48, 24);
  ctx.fillStyle = pillColors.bg;
  ctx.fill();
  ctx.strokeStyle = pillColors.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = pillColors.text;
  drawFittedText(ctx, spec.statusLabel, 221, 407, 190, 18, 13, true, "center", "rtl");

  // Hero Icon Badge on the Right side
  drawRoundedRect(ctx, W - 178, 369, 62, 62, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fill();
  drawVectorIcon(ctx, bannerIcon === "passport" ? "user" : bannerIcon, W - 147, 400, "#FFFFFF");

  // Hero Title & Subtitle
  ctx.fillStyle = "#FFFFFF";
  drawFittedText(ctx, spec.heroTitle, W - 196, 396, 635, 27, 18, true, "right", "rtl");
  ctx.fillStyle = "#CBE4FF";
  drawFittedText(ctx, spec.heroSubtitle, W - 196, 428, 635, 17, 12, false, "right", "rtl");
  ctx.restore();

  // 4b. 2-Column Grid of Rounded Info Sub-Cards (up to 10 fields -> 5 rows x 2 cols)
  const gridFields = spec.fields.slice(0, 10);
  const colW = 486;
  const colGap = 30;
  const rightColX = 94 + colW + colGap; // 610
  const leftColX = 94;
  const rowH = 136;
  const rowGap = 18;
  let curY = 468;

  for (let i = 0; i < gridFields.length; i += 2) {
    const pair = [
      { item: gridFields[i], x: rightColX }, // Right column first in RTL
      ...(gridFields[i + 1] ? [{ item: gridFields[i + 1], x: leftColX }] : []),
    ];

    for (const { item, x } of pair) {
      ctx.save();
      ctx.shadowColor = "rgba(11, 59, 117, 0.05)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      drawRoundedRect(ctx, x, curY, colW, rowH, 18);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "#C9DDF4";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Icon rounded square on right edge of card
      const iconBoxX = x + colW - 92;
      const iconBoxY = curY + 32;
      drawRoundedRect(ctx, iconBoxX, iconBoxY, 72, 72, 15);
      ctx.fillStyle = theme.iconBg;
      ctx.fill();
      ctx.strokeStyle = "#D4E6FA";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      drawVectorIcon(ctx, item.icon, iconBoxX + 36, iconBoxY + 36, theme.iconStroke);

      // Top labels: Arabic on right, English subtle on left
      const textRight = x + colW - 108;
      const textLeft = x + 18;
      const labelMaxW = 215;

      ctx.fillStyle = "#3A5B82";
      drawFittedText(ctx, item.labelAr, textRight, curY + 42, labelMaxW, 18, 13, true, "right", "rtl");

      ctx.fillStyle = "#7D93AE";
      drawFittedText(ctx, item.labelEn, textLeft, curY + 42, 155, 13, 10, false, "left", "ltr");

      // Subtle divider line under labels
      ctx.beginPath();
      ctx.moveTo(textLeft, curY + 56);
      ctx.lineTo(textRight, curY + 56);
      ctx.strokeStyle = "#EDF3FA";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Value text
      const valColor =
        item.highlight === "danger"
          ? "#B91C1C"
          : item.highlight === "warning"
          ? "#B45309"
          : item.highlight === "success"
          ? "#047857"
          : "#0B1F3A";
      ctx.fillStyle = valColor;

      const rawVal = item.value && String(item.value).trim() ? String(item.value).trim() : "غير محدد";
      const valText = item.isLtr ? wrapLtrIsolate(rawVal) : rawVal;
      drawFittedText(
        ctx,
        valText,
        textRight,
        curY + 102,
        textRight - textLeft,
        24,
        14,
        true,
        "right",
        item.isLtr && /^[\x00-\x7F\u2066\u2069]+$/.test(valText) ? "ltr" : "rtl"
      );

      ctx.restore();
    }

    curY += rowH + rowGap;
  }

  // 5. Official Verification & Scannable QR Code Section (y: 1268..1468)
  ctx.save();
  drawRoundedRect(ctx, 64, 1268, W - 128, 198, 22);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Left Gold/Navy Shield Emblem
  drawSecurityShield(ctx, 92, 1298, theme.primaryNavy, theme.accentWarm);

  // Right Scannable QR Code Box
  const qrBoxX = W - 252;
  const qrBoxY = 1284;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, 166, 166, 18);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = theme.primaryNavy;
  ctx.lineWidth = 3;
  ctx.stroke();

  try {
    const qrBuf = await QRCode.toBuffer(spec.qrPayload, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0B2545", light: "#FFFFFF" },
    });
    const qrImg = await loadImage(qrBuf);
    ctx.drawImage(qrImg, qrBoxX + 8, qrBoxY + 8, 150, 150);
  } catch (e) {
    logger.warn({ e }, "QR generation warning in PDF");
  }

  // Center Verification Text Block (x: 230 .. qrBoxX - 24)
  const verRight = qrBoxX - 26;
  const verMaxW = verRight - 228;
  const secHash = crypto
    .createHash("sha256")
    .update(`${spec.docRef}-${Date.now()}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();

  ctx.fillStyle = theme.primaryNavy;
  drawFittedText(
    ctx,
    "التوثيق والتحقق الرقمي الرسمي  |  OFFICIAL VERIFICATION",
    verRight,
    1312,
    verMaxW,
    20,
    14,
    true,
    "right",
    "rtl"
  );

  ctx.fillStyle = "#1E3A5F";
  drawFittedText(
    ctx,
    `وثيقة إلكترونية صادرة ومعتمدة من ${agency.businessName}`,
    verRight,
    1348,
    verMaxW,
    18,
    13,
    true,
    "right",
    "rtl"
  );

  ctx.fillStyle = "#475569";
  drawFittedText(
    ctx,
    `المرجع: ${wrapLtrIsolate(spec.docRef)}  |  رمز التحقق: ${wrapLtrIsolate(`SHA256-${secHash}`)}`,
    verRight,
    1382,
    verMaxW,
    15,
    12,
    false,
    "right",
    "rtl"
  );

  const contactBits: string[] = [];
  if (agency.address) contactBits.push(agency.address);
  if (agency.allPhones.length > 0) contactBits.push(agency.allPhones.map((p) => wrapLtrIsolate(p)).join(" / "));
  if (contactBits.length > 0) {
    ctx.fillStyle = "#0F5E9C";
    drawFittedText(ctx, contactBits.join("  —  "), verRight, 1418, verMaxW, 15, 12, true, "right", "rtl");
  }

  if (spec.footerNote) {
    ctx.fillStyle = "#64748B";
    drawFittedText(ctx, spec.footerNote, verRight, 1448, verMaxW, 14, 11, false, "right", "rtl");
  }
  ctx.restore();

  // 6. Skyline Silhouette + Orange/Navy Footer Wave (y: 1475..1684)
  drawSkylineWatermark(ctx, W, 1595);

  ctx.save();
  // Orange/Amber swoosh curve
  ctx.beginPath();
  ctx.moveTo(0, 1568);
  ctx.bezierCurveTo(280, 1556, 620, 1612, 920, 1602);
  ctx.bezierCurveTo(1040, 1598, 1130, 1580, W, 1562);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = theme.accentWarm;
  ctx.fill();

  // Deep Navy bottom wave
  const footGrad = ctx.createLinearGradient(0, 1585, W, H);
  footGrad.addColorStop(0, theme.primaryNavy);
  footGrad.addColorStop(1, "#062144");
  ctx.beginPath();
  ctx.moveTo(0, 1590);
  ctx.bezierCurveTo(320, 1572, 680, 1628, 960, 1608);
  ctx.bezierCurveTo(1070, 1600, 1140, 1576, W, 1556);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = footGrad;
  ctx.fill();

  // Footer text
  ctx.fillStyle = "#FFFFFF";
  drawFittedText(ctx, agency.businessName, 1125, 1648, 560, 19, 13, true, "right", "rtl");

  const leftFooterText =
    agency.allPhones.length > 0
      ? `للاستفسار والتواصل: ${agency.allPhones.map((p) => wrapLtrIsolate(p)).join(" | ")}`
      : "سفرك بأمان .. رحلتك برعاية متميزة";
  ctx.fillStyle = "#CFE6FF";
  drawFittedText(ctx, leftFooterText, 65, 1648, 500, 16, 12, false, "left", "rtl");
  ctx.restore();

  // 7. Convert crisp PNG -> standard A4 PDF via pdf-lib
  const pngBuffer = canvas.toBuffer("image/png");
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(UPLOADS_DIR, spec.fileName);
  fs.writeFileSync(filePath, Buffer.from(pdfBytes));

  const relativeUrl = `/uploads/passengers_pdfs/${encodeURIComponent(spec.fileName)}`;
  return {
    fileUrl: relativeUrl,
    fileName: spec.fileName,
    filePath,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PASSENGER & VISA CARD PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePassengerCardPdf(
  pax: any,
  hostBase?: string
): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
  const paxId = pax.id || Date.now();
  const rawName = (pax.name_ar || pax.name_en || `pax_${paxId}`).trim();
  const cleanPaxName = sanitizeFileSegment(rawName, 40);
  const cleanPassport = sanitizeFileSegment(pax.passport_number || `pax_${paxId}`, 30);
  const fileName = `بطاقة_مسافر_${cleanPaxName}_${cleanPassport}.pdf`;

  const displayName =
    pax.name_ar && pax.name_en
      ? `${pax.name_ar} (${pax.name_en})`
      : pax.name_ar || pax.name_en || "المسافر الكريم";

  const remainingDays =
    pax.remaining_days !== null && pax.remaining_days !== undefined ? Number(pax.remaining_days) : null;
  const remainingStr =
    remainingDays !== null
      ? remainingDays < 0
        ? `متجاوز (${Math.abs(remainingDays)} يوم)`
        : `${remainingDays} يوم`
      : "غير محدد";

  const isUrgent = remainingDays !== null && remainingDays <= 3;
  const isWarning = remainingDays !== null && remainingDays <= 10;
  const statusTone = isUrgent ? "danger" : isWarning ? "warning" : "success";
  const statusLabel = pax.travel_status || (isUrgent ? "تنبيه خروج عاجل" : "سجل معتمد");
  const docRef = `OMNI-PAX-${paxId}-${cleanPassport}`;

  const saved = await renderTravelPdfDocument({
    kind: "passenger",
    fileName,
    titleAr: "بطاقة المسافر والتأشيرة الرسمية",
    titleEn: "Official Passenger & Visa Card",
    heroTitle: `المسافر: ${displayName}`,
    heroSubtitle: `رقم الجواز: ${wrapLtrIsolate(pax.passport_number || "غير مسجل")}  |  الجنسية: ${pax.nationality || "غير محددة"}`,
    statusLabel,
    statusTone,
    docRef,
    qrPayload: `PASSENGER|${docRef}|${displayName}|${pax.passport_number || ""}|${pax.phone || ""}`,
    fields: [
      { labelAr: "رقم الجواز", labelEn: "Passport Number", value: pax.passport_number || "غير مسجل", icon: "passport", isLtr: true },
      { labelAr: "الجنسية", labelEn: "Nationality", value: pax.nationality || "غير محددة", icon: "globe" },
      { labelAr: "نوع التأشيرة", labelEn: "Visa Type", value: pax.visa_type || "تأشيرة عمرة", icon: "doc" },
      { labelAr: "مدة البرنامج", labelEn: "Program Duration", value: `${pax.program_duration_days || 90} يوم`, icon: "calendar" },
      { labelAr: "تاريخ الدخول / السفر", labelEn: "Travel / Entry Date", value: safeFormatDate(pax.travel_date), icon: "calendar", isLtr: true },
      { labelAr: "تاريخ الخروج المتوقع", labelEn: "Expected Exit Date", value: safeFormatDate(pax.expected_exit_date), icon: "exit", isLtr: true },
      {
        labelAr: "الأيام المتبقية",
        labelEn: "Remaining Days",
        value: remainingStr,
        icon: "clock",
        highlight: isUrgent ? "danger" : isWarning ? "warning" : "success",
      },
      { labelAr: "حالة المسافر", labelEn: "Travel Status", value: pax.travel_status || "داخل مكة", icon: "status" },
      { labelAr: "رقم الهاتف والتواصل", labelEn: "Contact Phone", value: pax.phone || pax.mobile || "غير مسجل", icon: "phone", isLtr: true },
      { labelAr: "المرجع الرقمي", labelEn: "Document Reference", value: docRef, icon: "hash", isLtr: true },
    ],
  });

  const fullUrl = hostBase ? `${hostBase}${saved.fileUrl}` : saved.fileUrl;

  try {
    const paxExists = db.prepare("SELECT id FROM travel_passengers WHERE id = ?").get(paxId) as any;
    if (paxExists) {
      const existing = db.prepare("SELECT id FROM travel_documents WHERE passenger_id = ? AND title LIKE '%بطاقة مسافر%'").get(paxId) as any;
      if (existing) {
        db.prepare("UPDATE travel_documents SET file_url = ?, file_name = ?, created_at = datetime('now', 'localtime') WHERE id = ?")
          .run(fullUrl, saved.fileName, existing.id);
      } else {
        db.prepare(`
          INSERT INTO travel_documents (
            document_type, title, file_url, file_name, customer_id, passenger_id, expiry_date, notes
          ) VALUES (
            'بطاقة مسافر وتأشيرة', ?, ?, ?, ?, ?, ?, 'تم التوليد والحفظ التلقائي بصيغة PDF'
          )
        `).run(
          `بطاقة مسافر (PDF) - ${displayName}`,
          fullUrl,
          saved.fileName,
          pax.customer_id || null,
          paxId,
          pax.expected_exit_date || null
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not record passenger document in travel_documents");
  }

  return { ...saved, fileUrl: fullUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FLIGHT TICKET & ITINERARY PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateFlightTicketPdf(
  data: any,
  hostBase?: string
): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
  const cleanName = sanitizeFileSegment(data.passenger_name || data.customer_name || "traveler", 32);
  const cleanRef = sanitizeFileSegment(data.pnr || data.ticket_number || `FLT-${data.id || Date.now()}`, 24);
  const fileName = `تذكرة_طيران_${cleanName}_${cleanRef}.pdf`;
  const origin = data.origin || "نقطة المغادرة";
  const destination = data.destination || "الوجهة";
  const docRef = `OMNI-FLT-${cleanRef}`;

  const saved = await renderTravelPdfDocument({
    kind: "flight",
    fileName,
    titleAr: "تذكرة وتأكيد حجز طيران إلكترونية",
    titleEn: "Electronic Flight Ticket & Itinerary",
    heroTitle: `المسافر: ${data.passenger_name || data.customer_name || "المسافر الكريم"}`,
    heroSubtitle: `خط السير: ${origin}  إلى  ${destination}  |  PNR: ${wrapLtrIsolate(data.pnr || "---")}`,
    statusLabel: data.ticket_number && data.ticket_number !== "قيد الإصدار" ? "تذكرة صادرة ومؤكدة" : "حجز طيران مؤكد",
    statusTone: "info",
    docRef,
    qrPayload: `FLIGHT|${docRef}|${data.passenger_name || ""}|PNR:${data.pnr || ""}|TKT:${data.ticket_number || ""}`,
    fields: [
      { labelAr: "اسم المسافر", labelEn: "Passenger Name", value: data.passenger_name || data.customer_name || "المسافر الكريم", icon: "user" },
      { labelAr: "رقم الحجز (PNR)", labelEn: "Booking Reference", value: data.pnr || "---", icon: "hash", isLtr: true },
      { labelAr: "رقم التذكرة الإلكترونية", labelEn: "E-Ticket Number", value: data.ticket_number || "قيد الإصدار", icon: "ticket", isLtr: true },
      { labelAr: "الناقل الجوي ورقم الرحلة", labelEn: "Airline & Flight", value: `${data.airline || "الناقل الجوي"} ${data.flight_no ? `(${data.flight_no})` : ""}`.trim(), icon: "plane" },
      { labelAr: "مدينة / مطار المغادرة", labelEn: "Origin", value: origin, icon: "map" },
      { labelAr: "مدينة / مطار الوصول", labelEn: "Destination", value: destination, icon: "map" },
      { labelAr: "تاريخ الإقلاع", labelEn: "Departure Date", value: safeFormatDate(data.departure_date), icon: "calendar", isLtr: true },
      { labelAr: "وقت الإقلاع", labelEn: "Departure Time", value: data.departure_time || "حسب التذكرة", icon: "clock", isLtr: true },
      { labelAr: "المقعد والدرجة", labelEn: "Seat & Class", value: `${data.seat || "تم التعيين"} - ${data.travel_class || "السياحية"}`, icon: "seat" },
      { labelAr: "القيمة الإجمالية", labelEn: "Total Amount", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}`, icon: "money" },
    ],
    footerNote: "يرجى التواجد في المطار قبل موعد الإقلاع بـ 3 ساعات للرحلات الدولية مع أصل الجواز",
  });

  return { ...saved, fileUrl: hostBase ? `${hostBase}${saved.fileUrl}` : saved.fileUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LAND TRANSPORT & BUS TICKET PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateBusTicketPdf(
  data: any,
  hostBase?: string
): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
  const cleanName = sanitizeFileSegment(data.passenger_name || data.customer_name || "passenger", 32);
  const cleanRef = sanitizeFileSegment(data.ticket_number || data.booking_number || `BUS-${data.id || Date.now()}`, 24);
  const fileName = `تذكرة_نقل_بري_${cleanName}_${cleanRef}.pdf`;
  const origin = data.origin || "محطة الانطلاق";
  const destination = data.destination || "محطة الوصول";
  const docRef = `OMNI-BUS-${cleanRef}`;

  const saved = await renderTravelPdfDocument({
    kind: "bus",
    fileName,
    titleAr: "تذكرة سفر النقل البري والباصات",
    titleEn: "Land Transport & Coach E-Ticket",
    heroTitle: `المسافر: ${data.passenger_name || data.customer_name || "المسافر الكريم"}`,
    heroSubtitle: `خط السير: ${origin}  إلى  ${destination}  |  التذكرة: ${wrapLtrIsolate(data.ticket_number || data.booking_number || "---")}`,
    statusLabel: "تذكرة نقل بري مؤكدة",
    statusTone: "success",
    docRef,
    qrPayload: `BUS|${docRef}|${data.passenger_name || ""}|${origin}->${destination}|SEAT:${data.seat_no || ""}`,
    fields: [
      { labelAr: "اسم المسافر", labelEn: "Passenger Name", value: data.passenger_name || data.customer_name || "المسافر الكريم", icon: "user" },
      { labelAr: "رقم التذكرة / الحجز", labelEn: "Ticket Number", value: data.ticket_number || data.booking_number || "---", icon: "ticket", isLtr: true },
      { labelAr: "الشركة الناقلة", labelEn: "Transport Company", value: data.company_name || "شركة النقل البري", icon: "bus" },
      { labelAr: "خط السير", labelEn: "Travel Route", value: `${origin} - ${destination}`, icon: "map" },
      { labelAr: "تاريخ الانطلاق", labelEn: "Departure Date", value: safeFormatDate(data.departure_date), icon: "calendar", isLtr: true },
      { labelAr: "موعد التجمع والانطلاق", labelEn: "Boarding & Departure", value: `${data.boarding_time || "---"} / ${data.departure_time || "---"}`, icon: "clock", isLtr: true },
      { labelAr: "رقم الحافلة والمقعد", labelEn: "Bus & Seat No.", value: `حافلة ${data.bus_number || "---"} | مقعد ${data.seat_no || "مخصص"}`, icon: "seat" },
      { labelAr: "محطة الانطلاق", labelEn: "Departure Station", value: data.origin_station || origin, icon: "map" },
      { labelAr: "الوزن والأمتعة", labelEn: "Luggage Allowance", value: `${data.luggage_weight || 30} كجم (${data.luggage_pieces || 2} حقائب)`, icon: "baggage" },
      { labelAr: "قيمة التذكرة", labelEn: "Ticket Amount", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}`, icon: "money" },
    ],
    footerNote: "يرجى التواجد في محطة الانطلاق قبل موعد التحرك بـ 30 دقيقة على الأقل",
  });

  return { ...saved, fileUrl: hostBase ? `${hostBase}${saved.fileUrl}` : saved.fileUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HOTEL ACCOMMODATION VOUCHER PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateHotelVoucherPdf(
  data: any,
  hostBase?: string
): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
  const cleanName = sanitizeFileSegment(data.passenger_name || data.customer_name || "guest", 32);
  const cleanRef = sanitizeFileSegment(data.voucher_number || data.confirmation_number || data.booking_ref || `HTL-${data.id || Date.now()}`, 24);
  const fileName = `قسيمة_فندق_${cleanName}_${cleanRef}.pdf`;
  const docRef = `OMNI-HTL-${cleanRef}`;

  const saved = await renderTravelPdfDocument({
    kind: "hotel",
    fileName,
    titleAr: "قسيمة وتأكيد حجز فندقي معتمد",
    titleEn: "Official Hotel Accommodation Voucher",
    heroTitle: `الفندق: ${data.hotel_name || "حجز فندقي"}`,
    heroSubtitle: `اسم النزيل: ${data.passenger_name || data.customer_name || "النزيل الكريم"}  |  رقم الفوتشر: ${wrapLtrIsolate(data.voucher_number || cleanRef)}`,
    statusLabel: "حجز فندقي مؤكد",
    statusTone: "success",
    docRef,
    qrPayload: `HOTEL|${docRef}|${data.hotel_name || ""}|${data.passenger_name || ""}|VCH:${data.voucher_number || ""}`,
    fields: [
      { labelAr: "اسم النزيل / الضيف", labelEn: "Guest Name", value: data.passenger_name || data.customer_name || "النزيل الكريم", icon: "user" },
      { labelAr: "اسم الفندق", labelEn: "Hotel Name", value: data.hotel_name || "الفندق المحجوز", icon: "hotel" },
      { labelAr: "المدينة والوجهة", labelEn: "City & Country", value: [data.city, data.country].filter(Boolean).join(" - ") || "غير محددة", icon: "map" },
      { labelAr: "رقم قسيمة السكن (Voucher)", labelEn: "Voucher Number", value: data.voucher_number || data.booking_ref || "---", icon: "ticket", isLtr: true },
      { labelAr: "رقم التأكيد المرجعي", labelEn: "Confirmation No.", value: data.confirmation_number || data.booking_ref || "---", icon: "hash", isLtr: true },
      { labelAr: "تاريخ تسجيل الدخول", labelEn: "Check-In Date", value: safeFormatDate(data.check_in), icon: "calendar", isLtr: true },
      { labelAr: "تاريخ المغادرة", labelEn: "Check-Out Date", value: safeFormatDate(data.check_out), icon: "exit", isLtr: true },
      { labelAr: "عدد الليالي والغرف", labelEn: "Nights & Rooms", value: `${data.nights || 1} ليلة / ${data.rooms_count || 1} غرفة`, icon: "clock" },
      { labelAr: "نوع الغرفة والوجبات", labelEn: "Room & Meal Plan", value: `${data.room_type || "قياسية"}`, icon: "room" },
      { labelAr: "إجمالي قيمة الإقامة", labelEn: "Total Stay Amount", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}`, icon: "money" },
    ],
    footerNote: "يرجى إبراز قسيمة السكن الفندقية مع أصل جواز السفر عند مكتب الاستقبال",
  });

  return { ...saved, fileUrl: hostBase ? `${hostBase}${saved.fileUrl}` : saved.fileUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. VISA APPLICATION / ISSUANCE CERTIFICATE PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateVisaCertificatePdf(
  data: any,
  hostBase?: string
): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
  const cleanName = sanitizeFileSegment(data.passenger_name || data.customer_name || "applicant", 32);
  const cleanRef = sanitizeFileSegment(data.visa_code || data.application_number || `VSA-${data.id || Date.now()}`, 24);
  const fileName = `معاملة_تأشيرة_${cleanName}_${cleanRef}.pdf`;
  const docRef = `OMNI-VSA-${cleanRef}`;

  const rawStatus = String(data.status || "قيد المعالجة");
  const isRejected = ["rejected", "مرفوضة"].includes(rawStatus);
  const isReady = ["approved", "issued", "ready", "completed", "delivered", "جاهزة", "مؤشرة", "مسلمة للعميل"].includes(rawStatus);
  const statusArMap: Record<string, string> = {
    approved: "تمت الموافقة والاعتماد",
    issued: "تأشيرة صادرة ومؤشرة",
    ready: "جاهزة للاستلام",
    completed: "مكتملة",
    delivered: "مسلمة للعميل",
    under_process: "قيد الإجراء والمعالجة",
    rejected: "مرفوضة",
  };
  const statusDisplay = statusArMap[rawStatus] || rawStatus;

  const saved = await renderTravelPdfDocument({
    kind: "visa",
    fileName,
    titleAr: "وثيقة وإشعار معاملة التأشيرة",
    titleEn: "Official Visa Processing & Issuance Notice",
    heroTitle: `مقدم الطلب: ${data.passenger_name || data.customer_name || "المسافر الكريم"}`,
    heroSubtitle: `دولة الوجهة: ${data.country || "---"}  |  رقم المعاملة: ${wrapLtrIsolate(data.application_number || data.visa_code || "---")}`,
    statusLabel: statusDisplay,
    statusTone: isRejected ? "danger" : isReady ? "success" : "warning",
    docRef,
    qrPayload: `VISA|${docRef}|${data.passenger_name || ""}|PASSPORT:${data.passport_no || ""}|VISA:${data.visa_code || ""}`,
    fields: [
      { labelAr: "اسم صاحب الطلب", labelEn: "Applicant Name", value: data.passenger_name || data.customer_name || "المسافر الكريم", icon: "user" },
      { labelAr: "رقم جواز السفر", labelEn: "Passport Number", value: data.passport_no || "غير مسجل", icon: "passport", isLtr: true },
      { labelAr: "الدولة الوجهة", labelEn: "Destination Country", value: data.country || "غير محددة", icon: "globe" },
      { labelAr: "نوع وفئة التأشيرة", labelEn: "Visa Category", value: data.visa_type || "تأشيرة سفر", icon: "doc" },
      { labelAr: "رقم المعاملة", labelEn: "Application Number", value: data.application_number || data.visa_code || "---", icon: "hash", isLtr: true },
      { labelAr: "رقم التأشيرة الصادرة", labelEn: "Issued Visa Number", value: data.visa_code || "قيد الإصدار", icon: "ticket", isLtr: true },
      { labelAr: "تاريخ التقديم", labelEn: "Submission Date", value: safeFormatDate(data.application_date), icon: "calendar", isLtr: true },
      { labelAr: "تاريخ الصلاحية / الانتهاء", labelEn: "Expiry Date", value: safeFormatDate(data.expiry_date), icon: "exit", isLtr: true },
      { labelAr: "حالة المعاملة", labelEn: "Processing Status", value: statusDisplay, icon: "status", highlight: isRejected ? "danger" : isReady ? "success" : "warning" },
      { labelAr: "رسوم المعاملة", labelEn: "Visa Fees", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}`, icon: "money" },
    ],
    footerNote: "يرجى مطابقة بيانات الجواز والتأشيرة قبل موعد السفر والتأكد من الصلاحية",
  });

  return { ...saved, fileUrl: hostBase ? `${hostBase}${saved.fileUrl}` : saved.fileUrl };
}
