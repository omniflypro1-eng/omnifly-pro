export interface AgencyTemplateBrand {
  agencyName: string;
  agencyNameEn?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  licenseNumber?: string;
  currency?: string;
}

function esc(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(val: any, fallback = "غير محدد"): string {
  if (!val) return fallback;
  const s = String(val).trim();
  if (!s || s === "null" || s === "undefined") return fallback;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return s;
}

function fmtAirportCode(city: string, explicitCode?: string): { code: string; name: string } {
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
  return { code: clean.slice(0, 8), name: clean };
}

function buildBarcodeSvg(seedText: string, width = 220, height = 46): string {
  const clean = (seedText || "OMNIFLY-PRO").toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: string[] = [];
  let x = 2;
  let step = 0;
  while (x < width - 4) {
    hash = Math.imul(hash ^ (step + 13), 16777619) >>> 0;
    const barW = ((hash % 3) + 1) * 1.4;
    const gapW = (((hash >> 4) % 3) + 1) * 1.3;
    if (x + barW < width - 2) {
      bars.push(`<rect x="${x.toFixed(1)}" y="2" width="${barW.toFixed(1)}" height="${height - 4}" fill="#0a254d" />`);
    }
    x += barW + gapW;
    step++;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;max-width:100%;height:${height}px;">${bars.join("")}</svg>`;
}

const ICONS = {
  plane: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
  bus: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`,
  hotel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/></svg>`,
  user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>`,
  pin: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/></svg>`,
  calendar: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
  ticket: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
  seat: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13V5a2 2 0 0 1 4 0v6h5a2 2 0 0 1 2 2v4H7z"/><path d="M5 17h14"/></svg>`,
  star: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>`,
  bed: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  money: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
};

interface BoardingSpecItem {
  icon: string;
  label: string;
  value: string;
  ltr?: boolean;
}

interface BoardingPassConfig {
  docTitle: string;
  serviceKind: "flight" | "bus" | "hotel";
  stubHeaderEn: string;
  stubHeaderAr: string;
  heroIcon: string;
  sloganAr: string;
  sloganEn: string;
  holderLabel: string;
  holderName: string;
  secondaryHolder?: string;
  statusBadgeText: string;
  statusBadgeBg: string;
  statusBadgeColor: string;
  leftPrimaryLabel: string;
  leftPrimaryCode: string;
  leftPrimarySub: string;
  rightPrimaryLabel: string;
  rightPrimaryCode: string;
  rightPrimarySub: string;
  middleTagText: string;
  specs: BoardingSpecItem[];
  extraLines: Array<{ label: string; value: string }>;
  wishTextAr: string;
  wishTextEn: string;
  barcodeSeed: string;
  stubItems: Array<{ icon: string; label: string; value: string; ltr?: boolean }>;
  footerCreditText: string;
}

function buildAgencyLogoHtml(brand: AgencyTemplateBrand): string {
  const hasLogo = Boolean(brand.logoUrl && brand.logoUrl.trim());
  const fallbackEmblem = `
    <div style="display:${hasLogo ? "none" : "flex"};width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#083470 0%,#1261b8 100%);align-items:center;justify-content:center;color:#ffffff;box-shadow:0 4px 10px rgba(8,52,112,0.22);flex-shrink:0;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="#ffffff"/>
        <path d="M2 12h20" stroke="rgba(255,255,255,0.65)"/>
        <path d="M12 2a14 14 0 0 1 0 20" stroke="rgba(255,255,255,0.65)"/>
        <path d="M17 7l-6 5-3-1-1 2 4 2 2 4 2-1-1-3 5-6z" fill="#f59e0b" stroke="#f59e0b"/>
      </svg>
    </div>
  `;

  if (!hasLogo) return fallbackEmblem;

  return `
    <div style="display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <img
        src="${esc(brand.logoUrl)}"
        alt="${esc(brand.agencyName)}"
        style="max-width:54px;max-height:54px;width:auto;height:auto;object-fit:contain;border-radius:10px;border:1px solid #dbe7f5;background:#ffffff;padding:3px;"
        onerror="this.style.display='none';if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}"
      />
      ${fallbackEmblem}
    </div>
  `;
}

function renderBoardingPassInnerHtml(cfg: BoardingPassConfig, brand: AgencyTemplateBrand): string {
  const businessName = brand.agencyName || "إدارة السفريات والسياحة";
  const barcodeMain = buildBarcodeSvg(cfg.barcodeSeed, 240, 44);
  const barcodeStub = buildBarcodeSvg(`${cfg.barcodeSeed}-STUB`, 170, 34);

  const contactBits: string[] = [];
  if (brand.address) contactBits.push(brand.address);
  if (brand.phone) contactBits.push(brand.phone);
  if (brand.licenseNumber) contactBits.push(`ترخيص: ${brand.licenseNumber}`);
  if (brand.taxNumber) contactBits.push(`الرقم الضريبي: ${brand.taxNumber}`);

  const worldDotsPattern = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 600 260" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;opacity:0.10;pointer-events:none;">
      <defs>
        <pattern id="bp-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.5" fill="#1d65b8"/>
        </pattern>
      </defs>
      <ellipse cx="320" cy="120" rx="220" ry="90" fill="url(#bp-dots)"/>
      <ellipse cx="140" cy="90" rx="85" ry="50" fill="url(#bp-dots)"/>
      <ellipse cx="475" cy="145" rx="75" ry="55" fill="url(#bp-dots)"/>
    </svg>
  `;

  const skylineSvg = `
    <svg width="240" height="58" viewBox="0 0 240 58" fill="rgba(16, 78, 150, 0.16)" style="display:block;">
      <rect x="8" y="30" width="12" height="28"/>
      <rect x="24" y="18" width="10" height="40"/>
      <rect x="38" y="25" width="14" height="33"/>
      <rect x="56" y="10" width="11" height="48"/>
      <polygon points="61,2 56,10 67,10"/>
      <rect x="72" y="24" width="18" height="34"/>
      <rect x="95" y="14" width="14" height="44"/>
      <circle cx="102" cy="14" r="7"/>
      <rect x="115" y="22" width="16" height="36"/>
      <rect x="136" y="8" width="12" height="50"/>
      <rect x="153" y="26" width="15" height="32"/>
      <rect x="172" y="16" width="12" height="42"/>
      <rect x="188" y="20" width="16" height="38"/>
      <rect x="208" y="28" width="18" height="30"/>
    </svg>
  `;

  return `
  <div dir="rtl" style="font-family:'Tajawal','Cairo','Segoe UI',Tahoma,sans-serif;color:#0a254d;width:100%;max-width:1020px;margin:0 auto;">
    <!-- MAIN HORIZONTAL BOARDING PASS / VOUCHER SHELL -->
    <div style="display:flex;flex-direction:row;align-items:stretch;border-radius:20px;overflow:hidden;border:1.5px solid #c7d9ee;background:#ffffff;box-shadow:0 12px 30px rgba(8,52,112,0.12);position:relative;">

      <!-- RIGHT SIDE IN RTL: MAIN TICKET BODY (72%) -->
      <div style="flex:1 1 72%;min-width:0;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(155deg,#ffffff 0%,#f5f9ff 48%,#dcebfb 100%);position:relative;">

        <!-- TOP HEADER STRIP: AGENCY BRANDING (LEFT IN VISUAL/END) + NAVY CURVED SLOGAN BAR -->
        <div style="display:flex;justify-content:space-between;align-items:stretch;min-height:74px;border-bottom:1px solid #d7e5f5;position:relative;z-index:2;background:#ffffff;">
          <!-- Dynamic Business Name & Logo (Replaces Omni System Pro) -->
          <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;flex:1 1 56%;min-width:0;">
            ${buildAgencyLogoHtml(brand)}
            <div style="min-width:0;">
              <div style="font-size:17px;font-weight:900;color:#083470;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(businessName)}
              </div>
              <div style="font-size:10.5px;color:#475569;font-weight:600;margin-top:2px;">
                ${esc(brand.address || brand.agencyNameEn || "إدارة السفريات والسياحة المعتمدة")}
                ${brand.phone ? ` · <span dir="ltr" style="font-family:monospace;font-weight:700;color:#0f4c9a;">${esc(brand.phone)}</span>` : ""}
              </div>
            </div>
          </div>

          <!-- Navy + Orange Curved Top Accent Ribbon with Slogan -->
          <div style="flex:0 0 43%;background:linear-gradient(135deg,#083470 0%,#0f54a6 100%);color:#ffffff;padding:10px 22px 12px 18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border-bottom-right-radius:34px;border-bottom:3px solid #f59e0b;box-shadow:-4px 2px 10px rgba(8,52,112,0.14);">
            <div style="font-size:14px;font-weight:900;letter-spacing:0.2px;color:#ffffff;">${esc(cfg.sloganAr)}</div>
            <div style="font-size:10.5px;font-weight:600;color:#fde68a;font-style:italic;margin-top:1px;" dir="ltr">${esc(cfg.sloganEn)}</div>
          </div>
        </div>

        <!-- BODY AREA WITH WORLD MAP WATERMARK -->
        <div style="padding:14px 20px 10px;position:relative;flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
          ${worldDotsPattern}

          <!-- ROW 1: HOLDER NAME & BOOKING / FLIGHT STATUS BADGE -->
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;position:relative;z-index:2;">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <div style="width:32px;height:32px;border-radius:9px;background:#e6f0fb;border:1px solid #c3daf5;display:flex;align-items:center;justify-content:center;color:#083470;flex-shrink:0;">
                ${ICONS.user}
              </div>
              <div style="min-width:0;">
                <div style="font-size:10px;color:#475569;font-weight:700;">${esc(cfg.holderLabel)}</div>
                <div style="font-size:16px;font-weight:900;color:#08264d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${esc(cfg.holderName)}
                </div>
                ${cfg.secondaryHolder ? `<div style="font-size:10.5px;color:#334155;font-weight:600;">${esc(cfg.secondaryHolder)}</div>` : ""}
              </div>
            </div>

            <div style="background:${cfg.statusBadgeBg};color:${cfg.statusBadgeColor};padding:5px 14px;border-radius:999px;font-size:11.5px;font-weight:800;border:1px solid rgba(8,52,112,0.12);white-space:nowrap;flex-shrink:0;">
              ${esc(cfg.statusBadgeText)}
            </div>
          </div>

          <!-- ROW 2: ROUTE / HOTEL STAY SHOWCASE (ADE ---> RUH STYLE) -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(255,255,255,0.82);border:1px solid #d4e3f4;border-radius:14px;padding:10px 16px;position:relative;z-index:2;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#0f54a6;font-weight:700;">
                ${ICONS.pin} <span>${esc(cfg.leftPrimaryLabel)}</span>
              </div>
              <div style="font-size:21px;font-weight:900;color:#08264d;line-height:1.15;margin-top:2px;font-family:'Cairo','Tajawal',monospace;" dir="ltr">
                ${esc(cfg.leftPrimaryCode)}
              </div>
              <div style="font-size:11px;color:#475569;font-weight:700;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(cfg.leftPrimarySub)}
              </div>
            </div>

            <div style="flex:0 0 185px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
              <div style="font-size:10px;font-weight:800;color:#083470;background:#e8f2fc;padding:2px 10px;border-radius:999px;border:1px solid #bfd7f2;">
                ${esc(cfg.middleTagText)}
              </div>
              <div style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center;color:#083470;">
                <div style="flex:1;border-top:2px dashed #6ca0dc;"></div>
                <div style="color:#083470;display:flex;align-items:center;justify-content:center;">${cfg.heroIcon}</div>
                <div style="flex:1;border-top:2px dashed #6ca0dc;"></div>
              </div>
            </div>

            <div style="flex:1;min-width:0;text-align:left;">
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:10px;color:#0f54a6;font-weight:700;">
                <span>${esc(cfg.rightPrimaryLabel)}</span> ${ICONS.pin}
              </div>
              <div style="font-size:21px;font-weight:900;color:#08264d;line-height:1.15;margin-top:2px;font-family:'Cairo','Tajawal',monospace;" dir="ltr">
                ${esc(cfg.rightPrimaryCode)}
              </div>
              <div style="font-size:11px;color:#475569;font-weight:700;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(cfg.rightPrimarySub)}
              </div>
            </div>
          </div>

          <!-- ROW 3: 5-CELL HORIZONTAL SPEC STRIP -->
          <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#ffffff;border:1px solid #d4e3f4;border-radius:12px;overflow:hidden;position:relative;z-index:2;">
            ${cfg.specs
              .slice(0, 5)
              .map(
                (sp, idx) => `
              <div style="padding:8px 10px;${idx > 0 ? "border-right:1px solid #e2ecf7;" : ""}min-width:0;">
                <div style="display:flex;align-items:center;gap:4px;font-size:9.5px;color:#475569;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  <span style="color:#0f54a6;display:inline-flex;flex-shrink:0;">${sp.icon}</span>
                  <span>${esc(sp.label)}</span>
                </div>
                <div style="font-size:12px;font-weight:900;color:#08264d;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${sp.ltr ? "font-family:monospace;direction:ltr;text-align:right;" : ""}">
                  ${esc(sp.value || "---")}
                </div>
              </div>`
              )
              .join("")}
          </div>

          <!-- ROW 4: COMPLEMENTARY FULL DATA BAR -->
          ${
            cfg.extraLines.length > 0
              ? `<div style="display:flex;flex-wrap:wrap;gap:6px 14px;background:rgba(241,246,253,0.92);border:1px solid #dbe7f5;border-radius:10px;padding:7px 12px;font-size:10.5px;color:#1e3a5f;position:relative;z-index:2;">
                  ${cfg.extraLines
                    .map(
                      (item) => `<div><strong style="color:#083470;">${esc(item.label)}:</strong> <span>${esc(item.value)}</span></div>`
                    )
                    .join("")}
                </div>`
              : ""
          }

          <!-- ROW 5: BARCODE + PLEASANT TRIP PHRASE + SKYLINE SILHOUETTE -->
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding-top:2px;position:relative;z-index:2;">
            <div style="background:#ffffff;border:1px solid #d4e3f4;border-radius:10px;padding:6px 10px;">
              ${barcodeMain}
              <div style="font-family:monospace;font-size:9.5px;color:#475569;text-align:center;margin-top:2px;letter-spacing:1.2px;" dir="ltr">${esc(cfg.barcodeSeed)}</div>
            </div>

            <div style="text-align:center;padding-bottom:6px;flex:0 0 auto;">
              <div style="font-size:13.5px;font-weight:800;font-style:italic;color:#083470;">${esc(cfg.wishTextAr)}</div>
              <div style="font-size:11px;font-weight:700;font-style:italic;color:#1d65b8;" dir="ltr">${esc(cfg.wishTextEn)}</div>
              <div style="height:3px;width:120px;margin:4px auto 0;background:linear-gradient(90deg,transparent,#f59e0b,transparent);border-radius:4px;"></div>
            </div>

            <div style="flex:0 0 auto;opacity:0.9;">
              ${skylineSvg}
            </div>
          </div>
        </div>

        <!-- BOTTOM NAVY & ORANGE WAVE BAR -->
        <div style="height:18px;background:linear-gradient(90deg,#083470 0%,#0e4c9a 62%,#f59e0b 62%,#f59e0b 100%);position:relative;z-index:2;"></div>
      </div>

      <!-- PERFORATED VERTICAL TEAR LINE WITH NOTCHES -->
      <div style="width:2px;border-right:2.5px dashed #94b3d8;background:#f8fbff;position:relative;flex-shrink:0;">
        <div style="width:20px;height:20px;border-radius:50%;background:#ffffff;border:1.5px solid #c7d9ee;position:absolute;top:-11px;right:-11px;"></div>
        <div style="width:20px;height:20px;border-radius:50%;background:#ffffff;border:1.5px solid #c7d9ee;position:absolute;bottom:-11px;right:-11px;"></div>
      </div>

      <!-- LEFT SIDE IN RTL: STUB PANEL (28%) -->
      <div style="flex:0 0 27%;min-width:210px;display:flex;flex-direction:column;justify-content:space-between;background:#ffffff;position:relative;">
        <!-- Stub Header -->
        <div style="background:linear-gradient(135deg,#083470 0%,#0f54a6 100%);color:#ffffff;padding:12px 14px;display:flex;align-items:center;justify-content:center;gap:10px;border-bottom:4px solid #f59e0b;">
          <div style="color:#ffffff;display:flex;align-items:center;">${cfg.heroIcon}</div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:900;letter-spacing:0.6px;line-height:1.15;" dir="ltr">${esc(cfg.stubHeaderEn)}</div>
            <div style="font-size:10.5px;font-weight:700;color:#fde68a;margin-top:2px;">${esc(cfg.stubHeaderAr)}</div>
          </div>
        </div>

        <!-- Stub Metadata List -->
        <div style="padding:10px 14px;flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:5px;">
          ${cfg.stubItems
            .map(
              (item) => `
            <div style="border-bottom:1px solid #e6eef8;padding-bottom:4px;">
              <div style="display:flex;align-items:center;gap:5px;font-size:9.5px;color:#475569;font-weight:700;">
                <span style="color:#083470;display:inline-flex;">${item.icon}</span>
                <span>${esc(item.label)}</span>
              </div>
              <div style="font-size:11.5px;font-weight:900;color:#08264d;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${item.ltr ? "font-family:monospace;direction:ltr;text-align:right;" : ""}">
                ${esc(item.value || "---")}
              </div>
            </div>`
            )
            .join("")}
        </div>

        <!-- Stub Mini Barcode -->
        <div style="padding:6px 14px 12px;text-align:center;">
          <div style="display:inline-block;">${barcodeStub}</div>
        </div>
      </div>
    </div>

    <!-- BOTTOM DOCUMENT CREDIT & AGENCY BAR -->
    <div style="margin-top:12px;padding:10px 18px;border-radius:12px;background:#f8fbff;border:1px solid #d4e3f4;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:#1e3a5f;">
      <div style="font-weight:900;color:#083470;">
        ${esc(cfg.footerCreditText)}
      </div>
      <div style="font-size:10.5px;color:#475569;font-weight:600;">
        ${contactBits.length > 0 ? esc(contactBits.join(" · ")) : esc(businessName)}
      </div>
    </div>
  </div>`;
}

function wrapFullHtmlDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      background: #ffffff;
      color: #0a254d;
      margin: 0;
      padding: 14px;
      direction: rtl;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media print {
      body { padding: 0 !important; background: #ffffff !important; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function getFlightStatusStyle(flightStatus: string): { label: string; bg: string; color: string } {
  const s = (flightStatus || "مؤكدة").trim();
  if (s === "ملغاة" || s === "cancelled") {
    return { label: "حالة الرحلة: ملغاة", bg: "#fee2e2", color: "#991b1b" };
  }
  if (s === "بانتظار التأكيد" || s === "pending") {
    return { label: "حالة الرحلة: بانتظار التأكيد", bg: "#fef3c7", color: "#92400e" };
  }
  if (s === "مؤجلة" || s === "delayed") {
    return { label: "حالة الرحلة: مؤجلة", bg: "#ffedd5", color: "#9a3412" };
  }
  if (s === "مكتملة" || s === "completed") {
    return { label: "حالة الرحلة: مكتملة", bg: "#e0e7ff", color: "#3730a3" };
  }
  return { label: `حالة الرحلة: ${s}`, bg: "#dcfce7", color: "#166534" };
}

export function buildFlightBoardingPassBody(bk: any, brand: AgencyTemplateBrand): string {
  const origin = fmtAirportCode(bk.origin_city || "نقطة المغادرة", bk.origin_airport_code);
  const dest = fmtAirportCode(bk.destination_city || "مدينة الوصول", bk.destination_airport_code);
  const fStatus = getFlightStatusStyle(bk.flight_status || (bk.status === "cancelled" ? "ملغاة" : bk.status === "pending_issue" ? "بانتظار التأكيد" : "مؤكدة"));
  const paxName = bk.passenger_name_ar || bk.passenger_name_en || bk.passenger_name || bk.customer_name || "المسافر الكريم";
  const amountText = `${Number(bk.selling_price || 0).toLocaleString()} ${bk.customer_currency || brand.currency || "SAR"}`;
  const ticketStatusMap: Record<string, string> = {
    confirmed: "حجز مؤكد",
    issued: "مصدرة",
    pending_issue: "بانتظار الإصدار",
    cancelled: "ملغاة",
    refunded: "مسترجعة",
    reissued: "معاد إصدارها",
  };
  const cfg: BoardingPassConfig = {
    docTitle: `تذكرة طيران - ${bk.pnr || bk.booking_number || "FLIGHT"}`,
    serviceKind: "flight",
    stubHeaderEn: "AIRLINE TICKET",
    stubHeaderAr: "تذكرة سفر جوي",
    heroIcon: ICONS.plane,
    sloganAr: "رحلتك .. بكل سهولة",
    sloganEn: "Your Journey .. Made Easy",
    holderLabel: "اسم المسافر / Passenger Name",
    holderName: paxName,
    secondaryHolder: bk.customer_name && bk.customer_name !== paxName ? `العميل: ${bk.customer_name}` : undefined,
    statusBadgeText: fStatus.label,
    statusBadgeBg: fStatus.bg,
    statusBadgeColor: fStatus.color,
    leftPrimaryLabel: "من / From",
    leftPrimaryCode: origin.code,
    leftPrimarySub: origin.name,
    rightPrimaryLabel: "إلى / To",
    rightPrimaryCode: dest.code,
    rightPrimarySub: dest.name,
    middleTagText: bk.airline_supplier || bk.airline_name || "رحلة جوية",
    specs: [
      { icon: ICONS.calendar, label: "تاريخ الرحلة", value: fmtDate(bk.departure_date), ltr: true },
      { icon: ICONS.clock, label: "الوقت / الإقلاع", value: bk.departure_time || "حسب الجدول", ltr: true },
      { icon: ICONS.plane, label: "رقم الرحلة", value: bk.flight_number || "---", ltr: true },
      { icon: ICONS.ticket, label: "PNR / التذكرة", value: bk.ticket_number || bk.pnr || bk.booking_number || "---", ltr: true },
      { icon: ICONS.star, label: "الدرجة", value: bk.travel_class || "اقتصادية" },
    ],
    extraLines: [
      { label: "رقم الحجز", value: bk.booking_number || "---" },
      ...(bk.pnr ? [{ label: "PNR", value: bk.pnr }] : []),
      { label: "حالة التذكرة", value: ticketStatusMap[bk.status] || bk.status || "مؤكدة" },
      { label: "الأمتعة", value: `${bk.baggage_weight || 30} كجم (${bk.baggage_pieces || 1} قطعة)` },
      ...(bk.return_date ? [{ label: "تاريخ العودة", value: fmtDate(bk.return_date) }] : []),
      { label: "الإجمالي", value: `${amountText} (${bk.payment_status === "paid" ? "مدفوع" : "آجل / متبقي"})` },
      ...(bk.notes ? [{ label: "ملاحظات", value: bk.notes }] : []),
    ],
    wishTextAr: "نتمنى لكم رحلة سعيدة",
    wishTextEn: "Have a pleasant trip",
    barcodeSeed: bk.ticket_number || bk.pnr || bk.booking_number || "OMNI-FLT",
    stubItems: [
      { icon: ICONS.user, label: "المسافر / Passenger", value: paxName },
      { icon: ICONS.plane, label: "المسار / From → To", value: `${origin.code} → ${dest.code}`, ltr: true },
      { icon: ICONS.calendar, label: "التاريخ / Date", value: fmtDate(bk.departure_date), ltr: true },
      { icon: ICONS.clock, label: "الرحلة / Flight", value: `${bk.flight_number || "---"}${bk.departure_time ? ` · ${bk.departure_time}` : ""}`, ltr: true },
      { icon: ICONS.ticket, label: "PNR / التذكرة", value: bk.pnr || bk.ticket_number || bk.booking_number || "---", ltr: true },
      { icon: ICONS.money, label: "القيمة / الحالة", value: `${amountText} · ${bk.flight_status || "مؤكدة"}` },
    ],
    footerCreditText: "تم إنشاء هذه التذكرة من نظام أومني فلاي برو",
  };
  return renderBoardingPassInnerHtml(cfg, brand);
}

export function buildFlightBoardingPassHtml(bk: any, brand: AgencyTemplateBrand): string {
  const title = `تذكرة طيران - ${bk.pnr || bk.booking_number || "FLIGHT"}`;
  return wrapFullHtmlDocument(title, buildFlightBoardingPassBody(bk, brand));
}

export function buildBusBoardingPassBody(bk: any, brand: AgencyTemplateBrand): string {
  const paxName = bk.passenger_name || bk.customer_name || "المسافر الكريم";
  const amountText = `${Number(bk.selling_price || 0).toLocaleString()} ${bk.customer_currency || brand.currency || "SAR"}`;
  const busStatusMap: Record<string, { label: string; bg: string; color: string }> = {
    confirmed: { label: "مؤكدة ومصدرة", bg: "#dcfce7", color: "#166534" },
    pending: { label: "قيد التأكيد", bg: "#dbeafe", color: "#1e40af" },
    waiting_payment: { label: "بانتظار السداد", bg: "#fef3c7", color: "#92400e" },
    completed: { label: "منفذة / مكتملة", bg: "#e0e7ff", color: "#3730a3" },
    cancelled: { label: "ملغاة", bg: "#fee2e2", color: "#991b1b" },
    refunded: { label: "مسترجعة", bg: "#f3e8ff", color: "#6b21a8" },
  };
  const st = busStatusMap[bk.status] || { label: bk.status || "مؤكدة", bg: "#dcfce7", color: "#166534" };

  const cfg: BoardingPassConfig = {
    docTitle: `تذكرة نقل بري - ${bk.booking_number || bk.ticket_number || "BUS"}`,
    serviceKind: "bus",
    stubHeaderEn: "BUS TICKET",
    stubHeaderAr: "تذكرة نقل بري",
    heroIcon: ICONS.bus,
    sloganAr: "سفر بري مريح .. بكل أمان",
    sloganEn: "Safe & Comfortable Land Travel",
    holderLabel: "اسم الراكب / Passenger Name",
    holderName: paxName,
    secondaryHolder: bk.passenger_phone || bk.passenger_national_id
      ? `${bk.passenger_national_id ? `هوية/جواز: ${bk.passenger_national_id}` : ""}${bk.passenger_phone ? ` · جوال: ${bk.passenger_phone}` : ""}`
      : undefined,
    statusBadgeText: st.label,
    statusBadgeBg: st.bg,
    statusBadgeColor: st.color,
    leftPrimaryLabel: "محطة الانطلاق / From",
    leftPrimaryCode: bk.origin_city || "الرياض",
    leftPrimarySub: bk.origin_station || "المحطة الرئيسية",
    rightPrimaryLabel: "محطة الوصول / To",
    rightPrimaryCode: bk.destination_city || "جدة",
    rightPrimarySub: bk.destination_station || "المحطة المركزية",
    middleTagText: bk.trip_type === "round_trip" ? "ذهاب وعودة" : "رحلة مباشرة",
    specs: [
      { icon: ICONS.calendar, label: "تاريخ السفر", value: fmtDate(bk.departure_date), ltr: true },
      { icon: ICONS.clock, label: "التحرك / الحضور", value: bk.departure_time || bk.boarding_time || "08:00", ltr: true },
      { icon: ICONS.bus, label: "الناقل / الحافلة", value: bk.bus_number || bk.company_name || bk.company_name_joined || "VIP" },
      { icon: ICONS.seat, label: "رقم المقعد", value: bk.seat_number || "مخصص", ltr: true },
      { icon: ICONS.star, label: "فئة الحافلة", value: bk.bus_type || "حافلة VIP" },
    ],
    extraLines: [
      { label: "رقم التذكرة", value: bk.ticket_number || bk.booking_number || "---" },
      { label: "شركة النقل", value: bk.company_name || bk.company_name_joined || "الناقل المعتمد" },
      { label: "العميل المتعاقد", value: bk.customer_name || paxName },
      { label: "وقت الحضور", value: bk.boarding_time || "قبل التحرك بـ 30 دقيقة" },
      { label: "الأمتعة", value: `${bk.luggage_weight || 30} كجم (${bk.luggage_pieces || 2} حقيبة)` },
      { label: "الإجمالي", value: `${amountText} (${bk.payment_status === "paid" ? "مدفوع بالكامل" : "آجل"})` },
    ],
    wishTextAr: "نتمنى لكم سفراً آمناً ومريحاً",
    wishTextEn: "Have a pleasant journey",
    barcodeSeed: bk.ticket_number || bk.booking_number || "OMNI-BUS",
    stubItems: [
      { icon: ICONS.user, label: "الراكب / Passenger", value: paxName },
      { icon: ICONS.bus, label: "المسار / Route", value: `${bk.origin_city || "---"} → ${bk.destination_city || "---"}` },
      { icon: ICONS.calendar, label: "التاريخ / Date", value: fmtDate(bk.departure_date), ltr: true },
      { icon: ICONS.clock, label: "التحرك / Departure", value: bk.departure_time || "08:00", ltr: true },
      { icon: ICONS.seat, label: "المقعد / الحافلة", value: `${bk.seat_number || "حر"} · ${bk.bus_number || "VIP"}` },
      { icon: ICONS.money, label: "قيمة التذكرة", value: amountText },
    ],
    footerCreditText: "تم إنشاء تذكرة النقل البري هذه من نظام أومني فلاي برو",
  };
  return renderBoardingPassInnerHtml(cfg, brand);
}

export function buildBusBoardingPassHtml(bk: any, brand: AgencyTemplateBrand): string {
  const title = `تذكرة نقل بري - ${bk.booking_number || bk.ticket_number || "BUS"}`;
  return wrapFullHtmlDocument(title, buildBusBoardingPassBody(bk, brand));
}

export function buildHotelVoucherPassBody(bk: any, brand: AgencyTemplateBrand): string {
  const guestName = bk.guest_name || bk.customer_name || "النزيل الكريم";
  const amountText = `${Number(bk.selling_price || 0).toLocaleString()} ${bk.customer_currency || brand.currency || "SAR"}`;
  const hotelStatusMap: Record<string, { label: string; bg: string; color: string }> = {
    confirmed: { label: "حجز مؤكد Confirmed", bg: "#dcfce7", color: "#166534" },
    issued: { label: "قسيمة مصدرة Issued", bg: "#dbeafe", color: "#1e40af" },
    pending: { label: "بانتظار التأكيد Pending", bg: "#fef3c7", color: "#92400e" },
    cancelled: { label: "حجز ملغى Cancelled", bg: "#fee2e2", color: "#991b1b" },
    refunded: { label: "مسترجع Refunded", bg: "#f3e8ff", color: "#6b21a8" },
  };
  const st = hotelStatusMap[bk.status] || { label: bk.status || "حجز مؤكد", bg: "#dcfce7", color: "#166534" };

  const cfg: BoardingPassConfig = {
    docTitle: `تأكيد_حجز_فندق_${bk.booking_ref || bk.voucher_number || "HOTEL"}`,
    serviceKind: "hotel",
    stubHeaderEn: "HOTEL VOUCHER",
    stubHeaderAr: "تأكيد حجز فندق",
    heroIcon: ICONS.hotel,
    sloganAr: "إقامة مريحة .. ضيافة متميزة",
    sloganEn: "Fine Hospitality .. Comfortable Stay",
    holderLabel: "اسم النزيل / Guest Name",
    holderName: guestName,
    secondaryHolder: bk.customer_name && bk.customer_name !== guestName
      ? `العميل: ${bk.customer_name}${bk.guest_passport ? ` · جواز: ${bk.guest_passport}` : ""}`
      : bk.guest_passport
      ? `رقم الجواز: ${bk.guest_passport}`
      : undefined,
    statusBadgeText: st.label,
    statusBadgeBg: st.bg,
    statusBadgeColor: st.color,
    leftPrimaryLabel: "تاريخ الدخول / Check-In",
    leftPrimaryCode: fmtDate(bk.check_in),
    leftPrimarySub: bk.hotel_name || "الفندق المعتمد",
    rightPrimaryLabel: "تاريخ المغادرة / Check-Out",
    rightPrimaryCode: fmtDate(bk.check_out),
    rightPrimarySub: bk.city_country || bk.city || "الوجهة السياحية",
    middleTagText: `${bk.nights || 1} ليالي · ${bk.rooms_count || 1} غرفة`,
    specs: [
      { icon: ICONS.hotel, label: "الفندق", value: bk.hotel_name || "---" },
      { icon: ICONS.bed, label: "نوع الغرفة", value: (bk.room_type || "غرفة مزدوجة").split("(")[0].trim() },
      { icon: ICONS.star, label: "الوجبات", value: (bk.meal_plan || "إفطار شامل").split("(")[0].trim() },
      { icon: ICONS.ticket, label: "رقم القسيمة / التأكيد", value: bk.voucher_number || bk.confirmation_number || bk.booking_ref || "---", ltr: true },
      { icon: ICONS.money, label: "قيمة الإقامة", value: amountText },
    ],
    extraLines: [
      { label: "رقم المرجع", value: bk.booking_ref || "---" },
      ...(bk.confirmation_number ? [{ label: "تأكيد الفندق", value: bk.confirmation_number }] : []),
      { label: "النزلاء", value: `${bk.guests_count || 1} نزيل · ${bk.rooms_count || 1} غرفة` },
      { label: "حالة السداد", value: bk.payment_status === "paid" ? "مدفوع بالكامل" : bk.payment_status === "partial" ? "مدفوع جزئياً" : "آجل" },
      ...(bk.notes ? [{ label: "ملاحظات", value: bk.notes }] : []),
      { label: "سياسة الفندق", value: "الدخول 02:00 ظهراً والمغادرة 12:00 ظهراً مع إبراز جواز السفر" },
    ],
    wishTextAr: "نتمنى لكم إقامة سعيدة ومريحة",
    wishTextEn: "Have a pleasant stay",
    barcodeSeed: bk.voucher_number || bk.confirmation_number || bk.booking_ref || "OMNI-HTL",
    stubItems: [
      { icon: ICONS.user, label: "النزيل / Guest", value: guestName },
      { icon: ICONS.hotel, label: "الفندق / Hotel", value: bk.hotel_name || "---" },
      { icon: ICONS.calendar, label: "الدخول / Check-In", value: fmtDate(bk.check_in), ltr: true },
      { icon: ICONS.calendar, label: "المغادرة / Check-Out", value: fmtDate(bk.check_out), ltr: true },
      { icon: ICONS.bed, label: "الغرفة / الليالي", value: `${bk.nights || 1} ليلة · ${bk.rooms_count || 1} غرفة` },
      { icon: ICONS.ticket, label: "المرجع / Voucher", value: bk.voucher_number || bk.booking_ref || "---", ltr: true },
    ],
    footerCreditText: "تم إنشاء تأكيد حجز الفندق هذا من نظام أومني فلاي برو",
  };
  return renderBoardingPassInnerHtml(cfg, brand);
}

export function buildHotelVoucherPassHtml(bk: any, brand: AgencyTemplateBrand): string {
  const title = `تأكيد_حجز_فندق_${bk.booking_ref || bk.voucher_number || "HOTEL"}`;
  return wrapFullHtmlDocument(title, buildHotelVoucherPassBody(bk, brand));
}
