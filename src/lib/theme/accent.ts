// src/lib/theme/accent.ts

export const DEFAULT_ACCENT_HEX = "#00E35B";

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "default", name: "Framebooks Green", hex: "#00E35B", description: "Default vibrant brand green" },
  { id: "emerald", name: "Emerald", hex: "#10B981", description: "Deep classic finance emerald" },
  { id: "teal", name: "Teal", hex: "#0D9488", description: "Balanced modern cyan-teal" },
  { id: "cyan", name: "Nordic Cyan", hex: "#06B6D4", description: "Vibrant crisp arctic cyan" },
  { id: "ocean", name: "Ocean Blue", hex: "#0284C7", description: "Crisp corporate sky blue" },
  { id: "royal", name: "Royal Blue", hex: "#2563EB", description: "High-contrast authoritative blue" },
  { id: "indigo", name: "Indigo", hex: "#4F46E5", description: "Modern SaaS indigo" },
  { id: "violet", name: "Electric Violet", hex: "#7C3AED", description: "Creative premium purple" },
  { id: "fuchsia", name: "Fuchsia Glow", hex: "#C026D3", description: "Modern high-energy magenta" },
  { id: "rose", name: "Rose", hex: "#E11D48", description: "Energetic deep magenta" },
  { id: "ruby", name: "Ruby Crimson", hex: "#BE123C", description: "Bold executive crimson" },
  { id: "sunset", name: "Sunset", hex: "#EA580C", description: "Warm amber-orange tone" },
  { id: "amber", name: "Amber Gold", hex: "#D97706", description: "Warm refined gold" },
  { id: "slate", name: "Monochrome Slate", hex: "#475569", description: "Minimalist executive slate" },
];

// Helper: parse hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Helper: RGB to hex
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper: RGB to HSL
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Helper: HSL to RGB
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// Relative luminance (WCAG definition)
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Contrast ratio between two colors (1:1 to 21:1)
export function getContrastRatio(rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number {
  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface AccentPalette {
  base: string;
  hover: string;
  active: string;
  soft: string;
  softDark: string;
  softForeground: string;
  softForegroundDark: string;
  border: string;
  borderDark: string;
  ring: string;
  foreground: string;
  textLight: string;
  textDark: string;
  shades: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
  bgLight: string;
  bgDark: string;
  popoverLight: string;
  popoverDark: string;
  cardDark: string;
  borderLight: string;
  textPrimaryLight: string;
  brand900: string;
  chartPalette: string[];
  warningNotice?: string;
  contrastOnAccent: number;
}

// Generate an 8-color harmonious categorical chart palette anchored by the accent color
export function generateChartPalette(inputHex?: string | null, count = 8): string[] {
  let hex = (inputHex || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    hex = DEFAULT_ACCENT_HEX;
  }
  const rgb = hexToRgb(hex) || { r: 0, g: 227, b: 91 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const palette: string[] = [];
  palette.push(hex.toUpperCase()); // 0: Hero accent

  // 1: Harmonious analogous +24° (vibrant companion)
  const c1 = hslToRgb((hsl.h + 24) % 360, Math.min(hsl.s, 90), Math.min(hsl.l + 4, 66));
  palette.push(rgbToHex(c1.r, c1.g, c1.b));

  // 2: Harmonious analogous -24° (anchor companion)
  const c2 = hslToRgb((hsl.h - 24 + 360) % 360, Math.min(hsl.s, 90), Math.max(hsl.l - 6, 32));
  palette.push(rgbToHex(c2.r, c2.g, c2.b));

  // 3: High-energy tint (+8° hue, elevated lightness)
  const c3 = hslToRgb((hsl.h + 8) % 360, Math.min(hsl.s, 85), Math.min(hsl.l + 18, 76));
  palette.push(rgbToHex(c3.r, c3.g, c3.b));

  // 4: Deep rich tone for heavy contrast
  const c4 = hslToRgb(hsl.h, hsl.s, Math.max(hsl.l - 16, 26));
  palette.push(rgbToHex(c4.r, c4.g, c4.b));

  // 5: Soft pastel highlight (-10° hue)
  const c5 = hslToRgb((hsl.h - 10 + 360) % 360, Math.min(hsl.s, 70), Math.min(hsl.l + 26, 82));
  palette.push(rgbToHex(c5.r, c5.g, c5.b));

  // 6: Extended analogous +48°
  const c6 = hslToRgb((hsl.h + 48) % 360, Math.min(hsl.s, 85), Math.min(hsl.l + 10, 68));
  palette.push(rgbToHex(c6.r, c6.g, c6.b));

  // 7: Delicate tinted mist
  const c7 = hslToRgb(hsl.h, Math.min(hsl.s * 0.7, 55), Math.min(hsl.l + 34, 88));
  palette.push(rgbToHex(c7.r, c7.g, c7.b));

  return palette.slice(0, count);
}

export function generateAccentPalette(inputHex?: string | null): AccentPalette {
  let hex = (inputHex || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    hex = DEFAULT_ACCENT_HEX;
  }

  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_ACCENT_HEX)!;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Check warnings
  let warningNotice: string | undefined;
  if ((hsl.h >= 345 || hsl.h <= 20) && hsl.s > 40) {
    warningNotice = "Resembles danger/expense red. Negative amounts and expenses will always remain red.";
  } else if (hsl.h >= 25 && hsl.h <= 55 && hsl.s > 40) {
    warningNotice = "Resembles pending/warning amber. Warning states and overdue indicators will remain distinct.";
  }

  // Generate shades
  const s50  = rgbToHex(...Object.values(hslToRgb(hsl.h, Math.min(hsl.s, 60), 96)) as [number, number, number]);
  const s100 = rgbToHex(...Object.values(hslToRgb(hsl.h, Math.min(hsl.s, 70), 90)) as [number, number, number]);
  const s200 = rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, 80)) as [number, number, number]);
  const s300 = rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, 68)) as [number, number, number]);
  const s400 = rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, 56)) as [number, number, number]);
  const s500 = hex;
  const s600 = rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.max(hsl.l - 7, 28))) as [number, number, number]);
  const s700 = rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.max(hsl.l - 15, 20))) as [number, number, number]);
  const s800 = rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.max(hsl.l - 24, 14))) as [number, number, number]);
  const s900 = rgbToHex(...Object.values(hslToRgb(hsl.h, Math.min(hsl.s, 75), 13)) as [number, number, number]);
  const s950 = rgbToHex(...Object.values(hslToRgb(hsl.h, Math.min(hsl.s, 70), 8)) as [number, number, number]);

  // Determine button text color on accent (WCAG AA)
  const white = { r: 255, g: 255, b: 255 };
  const dark = { r: 4, g: 20, b: 24 };
  const contrastWhite = getContrastRatio(rgb, white);
  const contrastDark = getContrastRatio(rgb, dark);

  const foreground = contrastWhite >= 3.8 ? "#FFFFFF" : "#041418";
  const contrastOnAccent = Math.max(contrastWhite, contrastDark);
  const brand900 = foreground === "#FFFFFF" ? "#FFFFFF" : s900;

  // Soft backgrounds & borders
  const soft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
  const softDark = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
  const border = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  const borderDark = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
  const ring = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;

  // Text color on white / dark background
  const textLight = rgbToHex(...Object.values(hslToRgb(hsl.h, Math.min(hsl.s, 85), Math.min(hsl.l, 36))) as [number, number, number]);
  const textDark = rgbToHex(...Object.values(hslToRgb(hsl.h, Math.min(hsl.s, 95), Math.max(hsl.l, 68))) as [number, number, number]);

  // Dynamic Dashboard Backgrounds harmonized with accent
  const bgDarkRgb = hslToRgb(hsl.h, Math.max(14, Math.min(hsl.s * 0.38, 26)), 6.8);
  const bgDark = rgbToHex(bgDarkRgb.r, bgDarkRgb.g, bgDarkRgb.b);

  const popoverDarkRgb = hslToRgb(hsl.h, Math.max(16, Math.min(hsl.s * 0.42, 30)), 10.5);
  const popoverDark = rgbToHex(popoverDarkRgb.r, popoverDarkRgb.g, popoverDarkRgb.b);

  const cardDark = "rgba(255, 255, 255, 0.05)";

  const bgLightRgb = hslToRgb(hsl.h, Math.min(hsl.s * 0.15, 10), 97.2);
  const bgLight = rgbToHex(bgLightRgb.r, bgLightRgb.g, bgLightRgb.b);

  const borderLightRgb = hslToRgb(hsl.h, Math.min(hsl.s * 0.12, 10), 90);
  const borderLight = rgbToHex(borderLightRgb.r, borderLightRgb.g, borderLightRgb.b);

  const textPrimaryLightRgb = hslToRgb(hsl.h, Math.min(hsl.s * 0.35, 20), 12);
  const textPrimaryLight = rgbToHex(textPrimaryLightRgb.r, textPrimaryLightRgb.g, textPrimaryLightRgb.b);

  const chartPalette = generateChartPalette(hex, 8);

  return {
    base: hex,
    hover: s600,
    active: s700,
    soft,
    softDark,
    softForeground: textLight,
    softForegroundDark: textDark,
    border,
    borderDark,
    ring,
    foreground,
    textLight,
    textDark,
    shades: {
      50: s50,
      100: s100,
      200: s200,
      300: s300,
      400: s400,
      500: s500,
      600: s600,
      700: s700,
      800: s800,
      900: s900,
      950: s950,
    },
    bgLight,
    bgDark,
    popoverLight: "#FFFFFF",
    popoverDark,
    cardDark,
    borderLight,
    textPrimaryLight,
    brand900,
    chartPalette,
    warningNotice,
    contrastOnAccent,
  };
}

export function generateTenantThemeCss(accentColor?: string | null): string {
  const p = generateAccentPalette(accentColor);
  return `
:root {
  --bg-primary: ${p.bgLight};
  --popover-bg: ${p.popoverLight};
  --card-bg: #FFFFFF;
  --border-color: ${p.borderLight};
  --text-primary: ${p.textPrimaryLight};

  --accent: ${p.base};
  --accent-hover: ${p.hover};
  --accent-active: ${p.active};
  --accent-soft: ${p.soft};
  --accent-soft-foreground: ${p.softForeground};
  --accent-border: ${p.border};
  --accent-ring: ${p.ring};
  --accent-foreground: ${p.foreground};
  --accent-text: ${p.textLight};

  --brand-900: ${p.brand900};
  --brand-950: ${p.shades[950]};

  --accent-50: ${p.shades[50]};
  --accent-100: ${p.shades[100]};
  --accent-200: ${p.shades[200]};
  --accent-300: ${p.shades[300]};
  --accent-400: ${p.shades[400]};
  --accent-500: ${p.shades[500]};
  --accent-600: ${p.shades[600]};
  --accent-700: ${p.shades[700]};
  --accent-800: ${p.shades[800]};
  --accent-900: ${p.shades[900]};
  --accent-950: ${p.shades[950]};

  --chart-1: ${p.chartPalette[0]};
  --chart-2: ${p.chartPalette[1]};
  --chart-3: ${p.chartPalette[2]};
  --chart-4: ${p.chartPalette[3]};
  --chart-5: ${p.chartPalette[4]};
  --chart-6: ${p.chartPalette[5]};
  --chart-7: ${p.chartPalette[6]};
  --chart-8: ${p.chartPalette[7]};
}

.dark {
  --bg-primary: ${p.bgDark};
  --popover-bg: ${p.popoverDark};
  --card-bg: ${p.cardDark};
  --border-color: rgba(255, 255, 255, 0.1);
  --text-primary: #FFFFFF;

  --accent-soft: ${p.softDark};
  --accent-soft-foreground: ${p.softForegroundDark};
  --accent-border: ${p.borderDark};
  --accent-text: ${p.textDark};
}
`.trim();
}
