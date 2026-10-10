import React from "react";

interface NjazLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  theme?: "light" | "dark";
  customLogoUrl?: string;
  siteName?: string;
  siteSlogan?: string;
  socialHandle?: string;
}

export function NjazSymbol({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-sm ${className}`}
    >
      {/* Background Soft Glow */}
      <rect width="100" height="100" rx="20" fill="url(#njaz_bg_gradient)" opacity="0.1" />

      {/* Main Blue Chevron / Diagonal 'N' Shape */}
      <path
        d="M20 20 H38 L72 80 H54 Z"
        fill="#0284c7"
      />
      <path
        d="M20 20 V50 L38 80 V20 Z"
        fill="#0369a1"
        opacity="0.3"
      />

      {/* Top-Right Vibrant Orange Triangle */}
      <path
        d="M52 20 H80 L52 52 Z"
        fill="#ea580c"
      />

      {/* Bottom-Left Vibrant Orange Triangle */}
      <path
        d="M20 48 L48 80 H20 Z"
        fill="#f97316"
      />

      {/* Dynamic Forward Accent Dots */}
      <circle cx="80" cy="80" r="4" fill="#0284c7" />
      <circle cx="20" cy="20" r="4" fill="#ea580c" />

      <defs>
        <linearGradient id="njaz_bg_gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284c7" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function NjazLogo({
  className = "",
  size = "md",
  showText = true,
  theme = "light",
  customLogoUrl,
  siteName = "نـجــــاز",
  siteSlogan = "للمشاوير والسفريات والسياحة",
  socialHandle = "@Njaz"
}: NjazLogoProps) {
  const iconSizes = {
    sm: 32,
    md: 42,
    lg: 56,
    xl: 72
  };

  const isDark = theme === "dark";
  const [imgError, setImgError] = React.useState(false);

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2.5 select-none ${className}`} dir="rtl">
      {/* Geometric Symbol or Uploaded Logo Image */}
      <div className="relative p-1 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white to-slate-100 shadow-xs border border-slate-200/80 shrink-0 flex items-center justify-center overflow-hidden">
        {customLogoUrl && !imgError ? (
          <img
            src={customLogoUrl}
            alt={siteName}
            onError={() => setImgError(true)}
            style={{ width: iconSizes[size], height: iconSizes[size] }}
            className="object-contain rounded-lg sm:rounded-xl max-w-full max-h-full"
          />
        ) : (
          <NjazSymbol size={iconSizes[size]} />
        )}
      </div>

      {showText && (
        <div className="flex flex-col leading-tight text-right min-w-0">
          {/* Main Title */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap">
            <span className="font-black text-base xs:text-lg sm:text-2xl text-sky-600 tracking-tight shrink-0">
              {siteName.includes("نجاز") ? "نـجــــاز" : siteName}
            </span>
            <span className="text-[9px] xs:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
              {socialHandle ? socialHandle.replace(/^@/, "") : "Njaz"}
            </span>
          </div>

          {/* Subtitle */}
          <span className={`hidden xs:block text-[10px] sm:text-xs font-extrabold truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            {siteSlogan || "للمشاوير والسفريات والسياحة"}
          </span>

          {/* Handle & Quick Badges */}
          <div className="hidden sm:flex items-center gap-2 mt-0.5 text-[9px] text-orange-600 font-black">
            <span>{socialHandle || "@Njaz"}</span>
            <div className="flex items-center gap-1 text-sky-600">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>مشاوير</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>طيران</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>فنادق</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NjazLogo;
