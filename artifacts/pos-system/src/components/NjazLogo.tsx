import React from "react";

interface NjazLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  theme?: "light" | "dark";
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
  theme = "light"
}: NjazLogoProps) {
  const iconSizes = {
    sm: 36,
    md: 48,
    lg: 64,
    xl: 84
  };

  const isDark = theme === "dark";

  return (
    <div className={`flex items-center gap-3 select-none ${className}`} dir="rtl">
      {/* Geometric Symbol */}
      <div className="relative p-1 rounded-2xl bg-gradient-to-br from-white to-slate-100 shadow-xs border border-slate-200/80">
        <NjazSymbol size={iconSizes[size]} />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight text-right">
          {/* Main Title: نـجـاز */}
          <div className="flex items-center gap-1.5">
            <span className="font-black text-2xl sm:text-3xl text-sky-600 tracking-tight">
              نـجــــاز
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
              Njaz
            </span>
          </div>

          {/* Subtitle: للمشاوير والسفريات والسياحة */}
          <span className={`text-xs sm:text-sm font-extrabold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            للمشاوير والسفريات والسياحة
          </span>

          {/* Handle: @Njaz */}
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-orange-600 font-black">
            <span>@Njaz</span>
            <div className="flex items-center gap-1 text-sky-600">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>طيران</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>مشاوير ونقل</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>فنادق</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>تأشيرات</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NjazLogo;
