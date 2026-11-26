import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { db } from "./sqlite";
import { logger } from "./logger";
import { getSystemAgencyProfile, type SystemAgencyProfile } from "./agency-profile";
import { markPostgresDbDirty } from "./pg-persistence";

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
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const buf = fs.readFileSync(p);
        if (buf.length > 20) {
          const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
          const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
          const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
          const isWebp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
          const isSvg = buf.subarray(0, 200).toString("utf8").toLowerCase().includes("<svg");
          if (isPng || isJpg || isGif || isWebp || isSvg) {
            return await loadImage(buf);
          }
        }
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
  markPostgresDbDirty("master", 1000);

  const relativeUrl = `/uploads/passengers_pdfs/${encodeURIComponent(spec.fileName)}`;
  return {
    fileUrl: relativeUrl,
    fileName: spec.fileName,
    filePath,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL BOARDING-PASS & VOUCHER RENDERER (Flight / Bus / Hotel)
// Modeled cleanly after Omni_flyPro_Boarding_Pass_990b2325.png with live Agency Settings
// ─────────────────────────────────────────────────────────────────────────────

export interface BoardingPassSpec {
  kind: "flight" | "bus" | "hotel";
  fileName: string;
  stubHeaderEn: string;
  stubHeaderAr: string;
  sloganAr: string;
  sloganEn: string;
  holderLabelAr: string;
  holderLabelEn: string;
  holderName: string;
  secondaryHolder?: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "info";
  leftLabel: string;
  leftCode: string;
  leftSub: string;
  rightLabel: string;
  rightCode: string;
  rightSub: string;
  middleTag: string;
  specs: Array<{
    icon: PdfFieldItem["icon"];
    label: string;
    value: string;
    isLtr?: boolean;
  }>;
  extraDetails: Array<{ label: string; value: string }>;
  wishAr: string;
  wishEn: string;
  barcodeSeed: string;
  docRef: string;
  qrPayload: string;
  stubItems: Array<{
    icon: PdfFieldItem["icon"];
    label: string;
    value: string;
    isLtr?: boolean;
  }>;
  footerCreditText: string;
}

function fmtAirportCodePdf(city: string, explicitCode?: string): { code: string; name: string } {
  if (explicitCode && explicitCode.trim()) {
    return { code: explicitCode.trim().toUpperCase().slice(0, 4), name: city || explicitCode };
  }
  const paren = (city || "").match(/\(([A-Za-z]{3,4})\)/);
  if (paren) {
    return { code: paren[1].toUpperCase(), name: city.replace(/\([A-Za-z]{3,4}\)/, "").trim() || paren[1] };
  }
  const clean = (city || "---").trim();
  const known: Record<string, string> = {
    "عدن": "ADE",
    "الرياض": "RUH",
    "جدة": "JED",
    "مكة": "MKX",
    "مكة المكرمة": "MKX",
    "المدينة": "MED",
    "المدينة المنورة": "MED",
    "الدمام": "DMM",
    "صنعاء": "SAH",
    "سيئون": "GXF",
    "المكلا": "RIY",
    "القاهرة": "CAI",
    "دبي": "DXB",
    "أبوظبي": "AUH",
    "الدوحة": "DOH",
    "الكويت": "KWI",
    "مسقط": "MCT",
    "عمان": "AMM",
    "إسطنبول": "IST",
  };
  for (const [k, v] of Object.entries(known)) {
    if (clean.includes(k)) return { code: v, name: clean };
  }
  const letters = clean.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (letters.length >= 3) return { code: letters.slice(0, 3), name: clean };
  return { code: clean.slice(0, 10), name: clean };
}

function drawWorldDotsWatermark(ctx: SKRSContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = "rgba(29, 101, 184, 0.10)";
  const clusters = [
    { x: cx - 230, y: cy - 35, rx: 120, ry: 75 },
    { x: cx + 25, y: cy - 10, rx: 210, ry: 110 },
    { x: cx + 290, y: cy + 20, rx: 115, ry: 75 },
  ];
  for (const cl of clusters) {
    for (let dy = -cl.ry; dy <= cl.ry; dy += 13) {
      for (let dx = -cl.rx; dx <= cl.rx; dx += 13) {
        const norm = (dx * dx) / (cl.rx * cl.rx) + (dy * dy) / (cl.ry * cl.ry);
        if (norm <= 1.0 && Math.abs(Math.sin(dx * 0.14 + dy * 0.19)) > 0.25) {
          ctx.beginPath();
          ctx.arc(cl.x + dx, cl.y + dy, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

function drawHorizontalSkyline(ctx: SKRSContext2D, rightX: number, baseY: number) {
  ctx.save();
  ctx.fillStyle = "rgba(16, 78, 150, 0.17)";
  const startX = rightX - 310;
  const cols: Array<[number, number, number]> = [
    [10, 42, 16],
    [30, 68, 14],
    [48, 48, 22],
    [74, 86, 15],
    [94, 44, 24],
    [122, 96, 18],
    [146, 56, 20],
    [172, 80, 16],
    [194, 104, 22],
    [222, 62, 18],
    [245, 88, 16],
    [266, 52, 22],
    [292, 36, 14],
  ];
  for (const [ox, bh, bw] of cols) {
    ctx.fillRect(startX + ox, baseY - bh, bw, bh);
  }
  // Tower spire & dome details
  ctx.fillRect(startX + 129, baseY - 118, 4, 22);
  ctx.beginPath();
  ctx.arc(startX + 205, baseY - 104, 11, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(startX + 204, baseY - 122, 2, 12);
  ctx.restore();
}

function draw1DBarcode(ctx: SKRSContext2D, seedText: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  const clean = (seedText || "OMNIFLY-PRO").toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  ctx.fillStyle = "#0A254D";
  let curX = x;
  let step = 0;
  while (curX < x + w - 4) {
    hash = Math.imul(hash ^ (step + 17), 16777619) >>> 0;
    const barW = ((hash % 3) + 1) * 2.1;
    const gapW = (((hash >> 4) % 3) + 1) * 2.0;
    if (curX + barW <= x + w) {
      ctx.fillRect(curX, y, barW, h);
    }
    curX += barW + gapW;
    step++;
  }
  ctx.restore();
}

export async function renderBoardingPassPdfDocument(spec: BoardingPassSpec): Promise<{
  fileUrl: string;
  fileName: string;
  filePath: string;
}> {
  ensureArabicFontsRegistered();

  const agency: SystemAgencyProfile = getSystemAgencyProfile();
  const W = 1684;
  const H = 1190;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Clean Light Outer Backdrop
  const outerBg = ctx.createLinearGradient(0, 0, 0, H);
  outerBg.addColorStop(0, "#F8FBFF");
  outerBg.addColorStop(1, "#EDF4FC");
  ctx.fillStyle = outerBg;
  ctx.fillRect(0, 0, W, H);

  // Card Container Geometry (matches Omni_flyPro_Boarding_Pass_990b2325.png landscape ratio)
  const cardX = 52;
  const cardY = 44;
  const cardW = 1580;
  const cardH = 986;
  const mainW = 1136;
  const tearX = cardX + mainW; // 1188
  const stubX = tearX;
  const stubW = cardW - mainW; // 444

  // Outer Card Shadow & Rounded Clip
  ctx.save();
  ctx.shadowColor = "rgba(8, 52, 112, 0.15)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "#C5D8EE";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();

  // Clip interior of Boarding Pass Card
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.clip();

  // 2. Main Panel Sky Atmospheric Gradient
  const mainGrad = ctx.createLinearGradient(cardX, cardY, tearX, cardY + cardH);
  mainGrad.addColorStop(0, "#FFFFFF");
  mainGrad.addColorStop(0.45, "#F2F8FF");
  mainGrad.addColorStop(1, "#D6EAFC");
  ctx.fillStyle = mainGrad;
  ctx.fillRect(cardX, cardY, mainW, cardH);

  // Stub clean white base
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(stubX, cardY, stubW, cardH);

  // Subtle dotted World Map + Skyline Watermarks in Main Panel
  drawWorldDotsWatermark(ctx, cardX + mainW * 0.56, cardY + 420);
  drawHorizontalSkyline(ctx, tearX - 24, cardY + cardH - 36);

  // 3. Top Header Bar (y: cardY .. cardY + 148)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(cardX, cardY, mainW, 148);
  ctx.strokeStyle = "#D8E6F5";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + 148);
  ctx.lineTo(tearX, cardY + 148);
  ctx.stroke();

  // Agency Logo + Dynamic Name/Address/Phones on Left Side of Main Header (replaces Omni System Pro)
  const logoImg = await resolveLogoImage(agency.logoUrl);
  const logoBoxX = cardX + 34;
  const logoBoxY = cardY + 24;
  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, logoBoxX, logoBoxY, 100, 100, 18);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#D3E2F4";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    drawRoundedRect(ctx, logoBoxX + 6, logoBoxY + 6, 88, 88, 14);
    ctx.clip();
    const scale = Math.min(82 / logoImg.width, 82 / logoImg.height);
    const dw = logoImg.width * scale;
    const dh = logoImg.height * scale;
    ctx.drawImage(logoImg, logoBoxX + 50 - dw / 2, logoBoxY + 50 - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.save();
    drawRoundedRect(ctx, logoBoxX, logoBoxY, 100, 100, 20);
    const embGrad = ctx.createLinearGradient(logoBoxX, logoBoxY, logoBoxX + 100, logoBoxY + 100);
    embGrad.addColorStop(0, "#083470");
    embGrad.addColorStop(1, "#1261B8");
    ctx.fillStyle = embGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(logoBoxX + 50, logoBoxY + 50, 34, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawVectorIcon(ctx, spec.kind === "flight" ? "plane" : spec.kind === "bus" ? "bus" : "hotel", logoBoxX + 50, logoBoxY + 50, "#F59E0B");
    ctx.restore();
  }

  // Vertical divider + Agency Business Name & Contact
  const brandTextX = logoBoxX + 118;
  const brandMaxW = 470;
  ctx.fillStyle = "#083470";
  drawFittedText(ctx, agency.businessName, brandTextX, cardY + 68, brandMaxW, 30, 18, true, "left", "rtl");

  const subLineParts: string[] = [];
  if (agency.address) subLineParts.push(agency.address);
  if (agency.allPhones.length > 0) subLineParts.push(agency.allPhones.map((p) => wrapLtrIsolate(p)).join(" | "));
  const subLineText = subLineParts.join(" · ") || "نظام إدارة السفريات والسياحة";
  ctx.fillStyle = "#475569";
  drawFittedText(ctx, subLineText, brandTextX, cardY + 108, brandMaxW, 17, 12, false, "left", "rtl");

  // Top-Right Navy + Amber Curved Slogan Ribbon in Main Panel
  ctx.save();
  // Amber accent edge curve
  ctx.beginPath();
  ctx.moveTo(cardX + 635, cardY);
  ctx.lineTo(tearX, cardY);
  ctx.lineTo(tearX, cardY + 148);
  ctx.lineTo(cardX + 715, cardY + 148);
  ctx.quadraticCurveTo(cardX + 665, cardY + 95, cardX + 635, cardY);
  ctx.closePath();
  ctx.fillStyle = "#F59E0B";
  ctx.fill();

  // Deep Navy overlay curve
  const hdrGrad = ctx.createLinearGradient(cardX + 650, cardY, tearX, cardY + 140);
  hdrGrad.addColorStop(0, "#083470");
  hdrGrad.addColorStop(1, "#1258AC");
  ctx.beginPath();
  ctx.moveTo(cardX + 648, cardY);
  ctx.lineTo(tearX, cardY);
  ctx.lineTo(tearX, cardY + 138);
  ctx.lineTo(cardX + 725, cardY + 138);
  ctx.quadraticCurveTo(cardX + 675, cardY + 88, cardX + 648, cardY);
  ctx.closePath();
  ctx.fillStyle = hdrGrad;
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  drawFittedText(ctx, spec.sloganAr, cardX + 935, cardY + 62, 410, 28, 18, true, "center", "rtl");
  ctx.fillStyle = "#FDE68A";
  drawFittedText(ctx, spec.sloganEn, cardX + 935, cardY + 104, 410, 19, 13, false, "center", "ltr");
  ctx.restore();

  // Stub Header Bar (Top-Right of Card)
  ctx.save();
  const stubHdrGrad = ctx.createLinearGradient(stubX, cardY, stubX + stubW, cardY + 148);
  stubHdrGrad.addColorStop(0, "#083470");
  stubHdrGrad.addColorStop(1, "#0F54A6");
  ctx.fillStyle = stubHdrGrad;
  ctx.fillRect(stubX, cardY, stubW, 138);
  ctx.fillStyle = "#F59E0B";
  ctx.fillRect(stubX, cardY + 138, stubW, 10);

  // Stub icon badge
  drawRoundedRect(ctx, stubX + 34, cardY + 34, 72, 72, 16);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  drawVectorIcon(ctx, spec.kind === "flight" ? "plane" : spec.kind === "bus" ? "bus" : "hotel", stubX + 70, cardY + 70, "#FFFFFF");

  ctx.fillStyle = "#FFFFFF";
  drawFittedText(ctx, spec.stubHeaderEn, stubX + 124, cardY + 66, stubW - 144, 24, 15, true, "left", "ltr");
  ctx.fillStyle = "#FDE68A";
  drawFittedText(ctx, spec.stubHeaderAr, stubX + stubW - 26, cardY + 104, stubW - 144, 19, 13, true, "right", "rtl");
  ctx.restore();

  // 4. Main Body Row 1: Holder Name + Flight/Booking Status Pill (y: 215..305)
  const bodyL = cardX + 38;
  const bodyR = tearX - 38;
  const bodyW = bodyR - bodyL;

  // User icon box
  ctx.save();
  drawRoundedRect(ctx, bodyR - 64, cardY + 178, 64, 64, 14);
  ctx.fillStyle = "#E6F0FB";
  ctx.fill();
  ctx.strokeStyle = "#BBD5F2";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  drawVectorIcon(ctx, "user", bodyR - 32, cardY + 210, "#083470");

  ctx.fillStyle = "#475569";
  drawFittedText(ctx, `${spec.holderLabelAr}  |  ${spec.holderLabelEn}`, bodyR - 80, cardY + 198, 620, 17, 13, true, "right", "rtl");
  ctx.fillStyle = "#08264D";
  drawFittedText(ctx, spec.holderName, bodyR - 80, cardY + 236, 620, 29, 18, true, "right", "rtl");
  if (spec.secondaryHolder) {
    ctx.fillStyle = "#334155";
    drawFittedText(ctx, spec.secondaryHolder, bodyR - 80, cardY + 266, 620, 15, 12, false, "right", "rtl");
  }

  // Status Pill on Left of Row 1
  const statusPalette = {
    success: { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
    warning: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
    danger: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
    info: { bg: "#E0F2FE", text: "#075985", border: "#7DD3FC" },
  }[spec.statusTone];

  drawRoundedRect(ctx, bodyL, cardY + 186, 295, 52, 26);
  ctx.fillStyle = statusPalette.bg;
  ctx.fill();
  ctx.strokeStyle = statusPalette.border;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = statusPalette.text;
  drawFittedText(ctx, spec.statusLabel, bodyL + 147, cardY + 219, 265, 18, 13, true, "center", "rtl");
  ctx.restore();

  // 5. Row 2: Route / Stay Showcase Box (y: cardY + 288 .. cardY + 462)
  const routeY = cardY + 286;
  const routeH = 166;
  ctx.save();
  drawRoundedRect(ctx, bodyL, routeY, bodyW, routeH, 20);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "#C9DCF2";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Left Terminal (From / Check-In)
  drawVectorIcon(ctx, "map", bodyL + 36, routeY + 34, "#0F54A6");
  ctx.fillStyle = "#0F54A6";
  drawFittedText(ctx, spec.leftLabel, bodyL + 60, routeY + 40, 290, 16, 12, true, "left", "rtl");
  ctx.fillStyle = "#08264D";
  drawFittedText(ctx, spec.leftCode, bodyL + 34, routeY + 100, 320, 44, 24, true, "left", "ltr");
  ctx.fillStyle = "#475569";
  drawFittedText(ctx, spec.leftSub, bodyL + 34, routeY + 140, 320, 20, 13, true, "left", "rtl");

  // Right Terminal (To / Check-Out)
  drawVectorIcon(ctx, "map", bodyR - 36, routeY + 34, "#0F54A6");
  ctx.fillStyle = "#0F54A6";
  drawFittedText(ctx, spec.rightLabel, bodyR - 60, routeY + 40, 290, 16, 12, true, "right", "rtl");
  ctx.fillStyle = "#08264D";
  drawFittedText(ctx, spec.rightCode, bodyR - 34, routeY + 100, 320, 44, 24, true, "right", "ltr");
  ctx.fillStyle = "#475569";
  drawFittedText(ctx, spec.rightSub, bodyR - 34, routeY + 140, 320, 20, 13, true, "right", "rtl");

  // Center Dashed Route Connector + Middle Pill + Hero Icon
  const midX = bodyL + bodyW / 2;
  drawRoundedRect(ctx, midX - 135, routeY + 24, 270, 36, 18);
  ctx.fillStyle = "#E8F2FC";
  ctx.fill();
  ctx.strokeStyle = "#BFD7F2";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "#083470";
  drawFittedText(ctx, spec.middleTag, midX, routeY + 48, 248, 16, 11, true, "center", "rtl");

  ctx.strokeStyle = "#5D96D8";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(midX - 155, routeY + 102);
  ctx.lineTo(midX - 36, routeY + 102);
  ctx.moveTo(midX + 36, routeY + 102);
  ctx.lineTo(midX + 155, routeY + 102);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head pointing right-to-left or left-to-right visually
  drawVectorIcon(ctx, spec.kind === "flight" ? "plane" : spec.kind === "bus" ? "bus" : "hotel", midX, routeY + 102, "#083470");
  ctx.restore();

  // 6. Row 3: 5-Cell Horizontal Spec Strip (y: cardY + 474 .. cardY + 592)
  const specY = cardY + 474;
  const specH = 116;
  ctx.save();
  drawRoundedRect(ctx, bodyL, specY, bodyW, specH, 16);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#C9DCF2";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const specItems = spec.specs.slice(0, 5);
  const cellW = bodyW / 5;
  specItems.forEach((sp, idx) => {
    const cx0 = bodyR - (idx + 1) * cellW; // RTL order right-to-left
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(cx0 + cellW, specY + 16);
      ctx.lineTo(cx0 + cellW, specY + specH - 16);
      ctx.strokeStyle = "#DCE8F6";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    drawVectorIcon(ctx, sp.icon, cx0 + cellW - 28, specY + 34, "#0F54A6");
    ctx.fillStyle = "#475569";
    drawFittedText(ctx, sp.label, cx0 + cellW - 52, specY + 40, cellW - 64, 15, 11, true, "right", "rtl");
    ctx.fillStyle = "#08264D";
    const valStr = sp.value && String(sp.value).trim() ? String(sp.value).trim() : "---";
    drawFittedText(
      ctx,
      sp.isLtr ? wrapLtrIsolate(valStr) : valStr,
      cx0 + cellW - 18,
      specY + 86,
      cellW - 34,
      20,
      13,
      true,
      "right",
      sp.isLtr && /^[\x00-\x7F\u2066\u2069]+$/.test(valStr) ? "ltr" : "rtl"
    );
  });
  ctx.restore();

  // 7. Row 4: Complementary Full Details Bar (y: cardY + 610 .. cardY + 718)
  const extraY = cardY + 612;
  const extraH = 104;
  ctx.save();
  drawRoundedRect(ctx, bodyL, extraY, bodyW, extraH, 14);
  ctx.fillStyle = "rgba(241, 246, 253, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "#D1E1F4";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const details = spec.extraDetails.slice(0, 6);
  const detCols = 3;
  const detColW = (bodyW - 36) / detCols;
  details.forEach((d, idx) => {
    const col = idx % detCols;
    const row = Math.floor(idx / detCols);
    const dxRight = bodyR - 18 - col * detColW;
    const dy = extraY + 38 + row * 42;
    const lineText = `${d.label}: ${d.value}`;
    ctx.fillStyle = "#0F3D73";
    drawFittedText(ctx, lineText, dxRight, dy, detColW - 14, 16, 11, true, "right", "rtl");
  });
  ctx.restore();

  // 8. Row 5: Scannable 1D Barcode + Pleasant Trip Wish + QR Code (y: cardY + 738 .. cardY + 918)
  const botY = cardY + 742;
  // Barcode card on Left
  ctx.save();
  drawRoundedRect(ctx, bodyL, botY + 12, 340, 146, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#C9DCF2";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  draw1DBarcode(ctx, spec.barcodeSeed, bodyL + 18, botY + 26, 304, 86);
  ctx.fillStyle = "#475569";
  drawFittedText(ctx, spec.barcodeSeed, bodyL + 170, botY + 140, 300, 15, 11, true, "center", "ltr");
  ctx.restore();

  // Center Pleasant Trip / Stay Wish with Amber Underline
  ctx.save();
  const wishCenterX = bodyL + 530;
  ctx.fillStyle = "#083470";
  drawFittedText(ctx, spec.wishAr, wishCenterX, botY + 62, 330, 24, 15, true, "center", "rtl");
  ctx.fillStyle = "#1D65B8";
  drawFittedText(ctx, spec.wishEn, wishCenterX, botY + 98, 330, 19, 13, true, "center", "ltr");
  const swGrad = ctx.createLinearGradient(wishCenterX - 110, 0, wishCenterX + 110, 0);
  swGrad.addColorStop(0, "rgba(245, 158, 11, 0)");
  swGrad.addColorStop(0.5, "#F59E0B");
  swGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
  ctx.fillStyle = swGrad;
  drawRoundedRect(ctx, wishCenterX - 110, botY + 114, 220, 6, 3);
  ctx.fill();
  ctx.restore();

  // Scannable QR Code on Right of Main Panel Bottom
  const qrSize = 148;
  const qrX = bodyR - qrSize;
  const qrY = botY + 10;
  ctx.save();
  drawRoundedRect(ctx, qrX - 8, qrY - 6, qrSize + 16, qrSize + 16, 16);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#083470";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  try {
    const qrBuf = await QRCode.toBuffer(spec.qrPayload, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#08264D", light: "#FFFFFF" },
    });
    const qrImg = await loadImage(qrBuf);
    ctx.drawImage(qrImg, qrX, qrY + 2, qrSize, qrSize);
  } catch (e) {
    logger.warn({ e }, "QR generation warning in BoardingPass PDF");
  }
  ctx.restore();

  // 9. Bottom Navy & Amber Curved Footer Wave inside Main Panel
  ctx.save();
  const baseWaveY = cardY + cardH;
  ctx.beginPath();
  ctx.moveTo(cardX, baseWaveY - 38);
  ctx.bezierCurveTo(cardX + 340, baseWaveY - 22, cardX + 760, baseWaveY - 6, tearX, baseWaveY - 12);
  ctx.lineTo(tearX, baseWaveY);
  ctx.lineTo(cardX, baseWaveY);
  ctx.closePath();
  ctx.fillStyle = "#F59E0B";
  ctx.fill();

  const footWaveGrad = ctx.createLinearGradient(cardX, baseWaveY - 34, tearX, baseWaveY);
  footWaveGrad.addColorStop(0, "#083470");
  footWaveGrad.addColorStop(1, "#0E4C9A");
  ctx.beginPath();
  ctx.moveTo(cardX, baseWaveY - 26);
  ctx.bezierCurveTo(cardX + 380, baseWaveY - 10, cardX + 780, baseWaveY + 2, tearX, baseWaveY - 6);
  ctx.lineTo(tearX, baseWaveY);
  ctx.lineTo(cardX, baseWaveY);
  ctx.closePath();
  ctx.fillStyle = footWaveGrad;
  ctx.fill();
  ctx.restore();

  // 10. Stub Panel Items (y: cardY + 178 .. cardY + 868)
  const stubItems = spec.stubItems.slice(0, 6);
  const stubStartY = cardY + 176;
  const stubRowH = 112;
  stubItems.forEach((st, idx) => {
    const sy = stubStartY + idx * stubRowH;
    drawVectorIcon(ctx, st.icon, stubX + stubW - 42, sy + 28, "#083470");
    ctx.fillStyle = "#475569";
    drawFittedText(ctx, st.label, stubX + stubW - 70, sy + 34, stubW - 96, 15, 11, true, "right", "rtl");
    ctx.fillStyle = "#08264D";
    const sVal = st.value && String(st.value).trim() ? String(st.value).trim() : "---";
    drawFittedText(
      ctx,
      st.isLtr ? wrapLtrIsolate(sVal) : sVal,
      stubX + stubW - 28,
      sy + 76,
      stubW - 56,
      20,
      13,
      true,
      "right",
      st.isLtr && /^[\x00-\x7F\u2066\u2069]+$/.test(sVal) ? "ltr" : "rtl"
    );
    if (idx < stubItems.length - 1) {
      ctx.beginPath();
      ctx.moveTo(stubX + 26, sy + stubRowH - 8);
      ctx.lineTo(stubX + stubW - 26, sy + stubRowH - 8);
      ctx.strokeStyle = "#E2ECF7";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  });

  // Stub Bottom Mini Barcode
  draw1DBarcode(ctx, `${spec.barcodeSeed}-STUB`, stubX + 34, cardY + cardH - 112, stubW - 68, 72);

  // End inner card clip
  ctx.restore();

  // 11. Perforated Tear Line & Top/Bottom Semicircular Cutouts
  ctx.save();
  ctx.strokeStyle = "#8EB1D8";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(tearX, cardY + 18);
  ctx.lineTo(tearX, cardY + cardH - 18);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const ny of [cardY, cardY + cardH]) {
    ctx.beginPath();
    ctx.arc(tearX, ny, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#F4F8FE";
    ctx.fill();
    ctx.strokeStyle = "#C5D8EE";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // 12. Bottom Credit Strip Outside Card ("تم إنشاء هذه التذكرة من نظام أومني فلاي برو" + Agency Contact)
  const creditY = cardY + cardH + 26; // 1056
  const creditH = 88;
  ctx.save();
  drawRoundedRect(ctx, cardX, creditY, cardW, creditH, 18);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#C5D8EE";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Right bold requested credit line
  ctx.fillStyle = "#083470";
  drawFittedText(ctx, spec.footerCreditText, cardX + cardW - 28, creditY + 54, 720, 22, 15, true, "right", "rtl");

  // Left dynamic Agency Contact info
  const footerContact: string[] = [agency.businessName];
  if (agency.address) footerContact.push(agency.address);
  if (agency.allPhones.length > 0) footerContact.push(agency.allPhones.map((p) => wrapLtrIsolate(p)).join(" | "));
  if (agency.licenseNumber) footerContact.push(`ترخيص: ${agency.licenseNumber}`);
  ctx.fillStyle = "#475569";
  drawFittedText(ctx, footerContact.join("  ·  "), cardX + 28, creditY + 53, 760, 17, 12, true, "left", "rtl");
  ctx.restore();

  // 13. Convert crisp Landscape PNG -> A4 Landscape PDF via pdf-lib
  const pngBuffer = canvas.toBuffer("image/png");
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape in points
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: 841.89,
    height: 595.28,
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(UPLOADS_DIR, spec.fileName);
  fs.writeFileSync(filePath, Buffer.from(pdfBytes));
  markPostgresDbDirty("master", 1000);

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
// 2. FLIGHT TICKET & BOARDING PASS PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateFlightTicketPdf(
  data: any,
  hostBase?: string
): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
  const cleanName = sanitizeFileSegment(data.passenger_name || data.customer_name || "traveler", 32);
  const cleanRef = sanitizeFileSegment(data.pnr || data.ticket_number || data.booking_number || `FLT-${data.id || Date.now()}`, 24);
  const fileName = `تذكرة_طيران_${cleanName}_${cleanRef}.pdf`;
  const originRaw = data.origin || data.origin_city || "نقطة المغادرة";
  const destRaw = data.destination || data.destination_city || "مدينة الوصول";
  const origin = fmtAirportCodePdf(originRaw, data.origin_airport_code);
  const dest = fmtAirportCodePdf(destRaw, data.destination_airport_code);
  const docRef = `OMNI-FLT-${cleanRef}`;
  const paxName = data.passenger_name || data.customer_name || "المسافر الكريم";
  const flightStatusRaw = String(data.flight_status || "مؤكدة").trim();
  const statusTone =
    flightStatusRaw === "ملغاة" || flightStatusRaw === "cancelled"
      ? "danger"
      : flightStatusRaw === "بانتظار التأكيد" || flightStatusRaw === "مؤجلة"
      ? "warning"
      : flightStatusRaw === "مكتملة"
      ? "info"
      : "success";

  const saved = await renderBoardingPassPdfDocument({
    kind: "flight",
    fileName,
    stubHeaderEn: "AIRLINE TICKET",
    stubHeaderAr: "تذكرة سفر جوي",
    sloganAr: "رحلتك .. بكل سهولة",
    sloganEn: "Your Journey .. Made Easy",
    holderLabelAr: "اسم المسافر",
    holderLabelEn: "Passenger Name",
    holderName: paxName,
    secondaryHolder:
      data.customer_name && data.customer_name !== paxName ? `العميل المتعاقد: ${data.customer_name}` : undefined,
    statusLabel: `حالة الرحلة: ${flightStatusRaw}`,
    statusTone,
    leftLabel: "من / From",
    leftCode: origin.code,
    leftSub: origin.name,
    rightLabel: "إلى / To",
    rightCode: dest.code,
    rightSub: dest.name,
    middleTag: `${data.airline || data.airline_supplier || "الناقل الجوي"} ${data.flight_no || data.flight_number || ""}`.trim(),
    specs: [
      { icon: "calendar", label: "تاريخ الرحلة", value: safeFormatDate(data.departure_date), isLtr: true },
      { icon: "clock", label: "وقت الإقلاع", value: data.departure_time || "حسب الجدول", isLtr: true },
      { icon: "plane", label: "رقم الرحلة", value: data.flight_no || data.flight_number || "---", isLtr: true },
      { icon: "ticket", label: "PNR / التذكرة", value: data.ticket_number || data.pnr || "---", isLtr: true },
      { icon: "seat", label: "المقعد والدرجة", value: `${data.seat || "تم التعيين"} - ${data.travel_class || "اقتصادية"}` },
    ],
    extraDetails: [
      { label: "رقم الحجز", value: data.booking_number || data.pnr || "---" },
      { label: "رقم PNR", value: data.pnr || "---" },
      { label: "رقم التذكرة", value: data.ticket_number || "قيد الإصدار" },
      { label: "الأمتعة المسموحة", value: `${data.baggage_weight || 30} كجم (${data.baggage_pieces || 1} قطعة)` },
      { label: "الإجمالي", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}` },
      { label: "تنبيه المطار", value: data.notes || "الحضور قبل الإقلاع بـ 3 ساعات مع الجواز" },
    ],
    wishAr: "نتمنى لكم رحلة سعيدة",
    wishEn: "Have a pleasant trip",
    barcodeSeed: data.ticket_number || data.pnr || data.booking_number || docRef,
    docRef,
    qrPayload: `FLIGHT|${docRef}|${paxName}|PNR:${data.pnr || ""}|TKT:${data.ticket_number || ""}|STATUS:${flightStatusRaw}`,
    stubItems: [
      { icon: "user", label: "المسافر / Passenger", value: paxName },
      { icon: "plane", label: "المسار / Route", value: `${origin.code} -> ${dest.code}`, isLtr: true },
      { icon: "calendar", label: "التاريخ / Date", value: safeFormatDate(data.departure_date), isLtr: true },
      { icon: "clock", label: "الوقت / Time", value: data.departure_time || "حسب التذكرة", isLtr: true },
      { icon: "seat", label: "المقعد / الدرجة", value: `${data.seat || "مخصص"} · ${data.travel_class || "اقتصادية"}` },
      { icon: "status", label: "حالة الرحلة / PNR", value: `${flightStatusRaw} · ${data.pnr || "---"}` },
    ],
    footerCreditText: "تم إنشاء هذه التذكرة من نظام أومني فلاي برو",
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
  const origin = data.origin || data.origin_city || "محطة الانطلاق";
  const destination = data.destination || data.destination_city || "محطة الوصول";
  const docRef = `OMNI-BUS-${cleanRef}`;
  const paxName = data.passenger_name || data.customer_name || "المسافر الكريم";

  const saved = await renderBoardingPassPdfDocument({
    kind: "bus",
    fileName,
    stubHeaderEn: "BUS TICKET",
    stubHeaderAr: "تذكرة نقل بري",
    sloganAr: "سفر بري مريح .. بكل أمان",
    sloganEn: "Safe & Comfortable Land Travel",
    holderLabelAr: "اسم الراكب",
    holderLabelEn: "Passenger Name",
    holderName: paxName,
    secondaryHolder:
      data.customer_name && data.customer_name !== paxName ? `العميل المتعاقد: ${data.customer_name}` : undefined,
    statusLabel: "تذكرة نقل بري مؤكدة",
    statusTone: "success",
    leftLabel: "محطة الانطلاق / From",
    leftCode: origin,
    leftSub: data.origin_station || "المحطة الرئيسية",
    rightLabel: "محطة الوصول / To",
    rightCode: destination,
    rightSub: data.destination_station || "المحطة المركزية",
    middleTag: data.company_name || "شركة النقل البري المعتمدة",
    specs: [
      { icon: "calendar", label: "تاريخ الانطلاق", value: safeFormatDate(data.departure_date), isLtr: true },
      { icon: "clock", label: "التحرك / الحضور", value: `${data.departure_time || "---"} / ${data.boarding_time || "---"}`, isLtr: true },
      { icon: "bus", label: "رقم الحافلة", value: data.bus_number || "VIP", isLtr: true },
      { icon: "seat", label: "رقم المقعد", value: data.seat_no || data.seat_number || "مخصص", isLtr: true },
      { icon: "money", label: "قيمة التذكرة", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}` },
    ],
    extraDetails: [
      { label: "رقم التذكرة", value: data.ticket_number || data.booking_number || "---" },
      { label: "رقم الحجز", value: data.booking_number || "---" },
      { label: "الشركة الناقلة", value: data.company_name || "النقل البري" },
      { label: "الأمتعة", value: `${data.luggage_weight || 30} كجم (${data.luggage_pieces || 2} حقائب)` },
      { label: "نوع الرحلة", value: data.trip_type === "round_trip" ? "ذهاب وعودة" : "ذهاب فقط" },
      { label: "تنبيه التجمع", value: "التواجد بالمحطة قبل الانطلاق بـ 30 دقيقة" },
    ],
    wishAr: "نتمنى لكم سفراً آمناً ومريحاً",
    wishEn: "Have a pleasant journey",
    barcodeSeed: data.ticket_number || data.booking_number || docRef,
    docRef,
    qrPayload: `BUS|${docRef}|${paxName}|${origin}->${destination}|SEAT:${data.seat_no || data.seat_number || ""}`,
    stubItems: [
      { icon: "user", label: "الراكب / Passenger", value: paxName },
      { icon: "bus", label: "المسار / Route", value: `${origin} - ${destination}` },
      { icon: "calendar", label: "التاريخ / Date", value: safeFormatDate(data.departure_date), isLtr: true },
      { icon: "clock", label: "التحرك / Departure", value: data.departure_time || "---", isLtr: true },
      { icon: "seat", label: "المقعد / الحافلة", value: `${data.seat_no || data.seat_number || "حر"} · ${data.bus_number || "VIP"}` },
      { icon: "ticket", label: "التذكرة / القيمة", value: `${data.ticket_number || "---"} · ${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}` },
    ],
    footerCreditText: "تم إنشاء تذكرة النقل البري هذه من نظام أومني فلاي برو",
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
  const fileName = `تأكيد_حجز_فندق_${cleanName}_${cleanRef}.pdf`;
  const docRef = `OMNI-HTL-${cleanRef}`;
  const guestName = data.passenger_name || data.guest_name || data.customer_name || "النزيل الكريم";
  const cityText = [data.city, data.country].filter(Boolean).join(" - ") || data.city_country || "الوجهة السياحية";

  const saved = await renderBoardingPassPdfDocument({
    kind: "hotel",
    fileName,
    stubHeaderEn: "HOTEL VOUCHER",
    stubHeaderAr: "تأكيد حجز فندق",
    sloganAr: "إقامة مريحة .. ضيافة متميزة",
    sloganEn: "Fine Hospitality .. Comfortable Stay",
    holderLabelAr: "اسم النزيل",
    holderLabelEn: "Guest Name",
    holderName: guestName,
    secondaryHolder:
      data.customer_name && data.customer_name !== guestName ? `العميل المتعاقد: ${data.customer_name}` : undefined,
    statusLabel: "حجز فندقي مؤكد",
    statusTone: "success",
    leftLabel: "تاريخ الدخول / Check-In",
    leftCode: safeFormatDate(data.check_in),
    leftSub: data.hotel_name || "الفندق المعتمد",
    rightLabel: "تاريخ المغادرة / Check-Out",
    rightCode: safeFormatDate(data.check_out),
    rightSub: cityText,
    middleTag: `${data.nights || 1} ليالٍ · ${data.rooms_count || 1} غرفة`,
    specs: [
      { icon: "hotel", label: "الفندق", value: data.hotel_name || "---" },
      { icon: "room", label: "نوع الغرفة", value: data.room_type || "قياسية" },
      { icon: "doc", label: "الوجبات", value: data.meal_plan || "إفطار شامل" },
      { icon: "ticket", label: "رقم القسيمة", value: data.voucher_number || data.booking_ref || "---", isLtr: true },
      { icon: "money", label: "قيمة الإقامة", value: `${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}` },
    ],
    extraDetails: [
      { label: "رقم التأكيد", value: data.confirmation_number || data.booking_ref || "---" },
      { label: "المدينة", value: cityText },
      { label: "عدد النزلاء", value: `${data.guests_count || 1} نزيل · ${data.rooms_count || 1} غرفة` },
      { label: "عدد الليالي", value: `${data.nights || 1} ليلة` },
      { label: "سياسة الاستقبال", value: "الدخول 2:00 م والمغادرة 12:00 م" },
      { label: "ملاحظات", value: data.notes || "يرجى إبراز القسيمة مع أصل جواز السفر" },
    ],
    wishAr: "نتمنى لكم إقامة سعيدة ومريحة",
    wishEn: "Have a pleasant stay",
    barcodeSeed: data.voucher_number || data.confirmation_number || data.booking_ref || docRef,
    docRef,
    qrPayload: `HOTEL|${docRef}|${data.hotel_name || ""}|${guestName}|VCH:${data.voucher_number || ""}`,
    stubItems: [
      { icon: "user", label: "النزيل / Guest", value: guestName },
      { icon: "hotel", label: "الفندق / Hotel", value: data.hotel_name || "---" },
      { icon: "calendar", label: "الدخول / Check-In", value: safeFormatDate(data.check_in), isLtr: true },
      { icon: "exit", label: "المغادرة / Check-Out", value: safeFormatDate(data.check_out), isLtr: true },
      { icon: "room", label: "الغرفة / الليالي", value: `${data.nights || 1} ليلة · ${data.rooms_count || 1} غرفة` },
      { icon: "ticket", label: "الفوتشر / القيمة", value: `${data.voucher_number || "---"} · ${Number(data.total_amount || 0).toLocaleString()} ${data.currency || "ريال"}` },
    ],
    footerCreditText: "تم إنشاء تأكيد حجز الفندق هذا من نظام أومني فلاي برو",
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
