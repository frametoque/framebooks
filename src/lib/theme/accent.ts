// src/lib/theme/accent.ts

export const DEFAULT_ACCENT_HEX = "#00E35B";

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  description: string;
  paletteId?: string;
}

export interface ColorPaletteGroup {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  description: string;
  gradient: string;
  presets: AccentPreset[];
}

export const GTA6_PALETTE_GROUP: ColorPaletteGroup = {
  id: "gta6",
  name: "GTA VI Palette",
  tagline: "Vice City Neon, Twilight & Coastal Sunset",
  badge: "Featured Edition",
  description: "Inspired by the high-contrast neon lights, tropical dusk, and oceanfront nightlife of Leonida.",
  gradient: "linear-gradient(135deg, #3B146B 0%, #7B208F 16%, #C9349B 33%, #F36A78 50%, #F87572 67%, #FF9B55 83%, #FFB458 100%)",
  presets: [
    {
      id: "gta6-deep-violet",
      name: "Deep Violet",
      hex: "#3B146B",
      description: "Depth, nighttime vibes and contrast.",
      paletteId: "gta6",
    },
    {
      id: "gta6-purple",
      name: "Purple",
      hex: "#7B208F",
      description: "Adds mood, mystery and atmosphere.",
      paletteId: "gta6",
    },
    {
      id: "gta6-magenta",
      name: "Magenta",
      hex: "#C9349B",
      description: "Electric energy, nightlife and bold expression.",
      paletteId: "gta6",
    },
    {
      id: "gta6-coral-pink",
      name: "Coral Pink",
      hex: "#F36A78",
      description: "Warmth, vibrance and tropical energy.",
      paletteId: "gta6",
    },
    {
      id: "gta6-coral",
      name: "Coral",
      hex: "#F87572",
      description: "Bridges pink and orange, creating smooth transitions.",
      paletteId: "gta6",
    },
    {
      id: "gta6-orange",
      name: "Orange",
      hex: "#FF9B55",
      description: "Sunsets, heat and golden light.",
      paletteId: "gta6",
    },
    {
      id: "gta6-warm-yellow",
      name: "Warm Yellow",
      hex: "#FFB458",
      description: "Daylight, optimism and coastal brightness.",
      paletteId: "gta6",
    },
  ],
};

export const F1_PALETTE_GROUP: ColorPaletteGroup = {
  id: "f1",
  name: "F1: The Movie",
  tagline: "High-Octane Cinematic Racing Tones",
  badge: "Cinema Edition",
  description: "Official color palette inspired by F1: The Movie — Deep Crimson, Paddock White, Championship Gold, Warm Bronze, and Carbon Black.",
  gradient: "linear-gradient(135deg, #8C3041 0%, #F2F2F2 25%, #D9C077 50%, #A6877C 75%, #0D0D0D 100%)",
  presets: [
    {
      id: "f1-crimson",
      name: "Crimson Red",
      hex: "#8C3041",
      description: "Hero buttons, accents & primary energy",
      paletteId: "f1",
    },
    {
      id: "f1-white",
      name: "Paddock White",
      hex: "#F2F2F2",
      description: "High-contrast clean surfaces & text",
      paletteId: "f1",
    },
    {
      id: "f1-gold",
      name: "Championship Gold",
      hex: "#D9C077",
      description: "Warm golden highlights & status accents",
      paletteId: "f1",
    },
    {
      id: "f1-bronze",
      name: "Warm Bronze",
      hex: "#A6877C",
      description: "Subtle neutral borders & transitions",
      paletteId: "f1",
    },
    {
      id: "f1-black",
      name: "Carbon Black",
      hex: "#0D0D0D",
      description: "Sleek pitlane contrast & dark background",
      paletteId: "f1",
    },
  ],
};

export const SL_CRICKET_PALETTE_GROUP: ColorPaletteGroup = {
  id: "sl_cricket",
  name: "SL Cricket",
  tagline: "Lions of Cricket — National Blue & Gold",
  badge: "Sports Edition",
  description: "Official colors inspired by Sri Lanka Cricket — Royal Ocean Blue, Deep Navy, Tangerine Yellow, Lion Orange, Crimson Maroon, and Pure White.",
  gradient: "linear-gradient(135deg, #0A50A1 0%, #15295E 25%, #FFCC00 50%, #CC6600 75%, #8C0026 100%)",
  presets: [
    {
      id: "sl-blue",
      name: "Sri Lanka Blue",
      hex: "#0A50A1",
      description: "Hero blue, buttons & primary energy",
      paletteId: "sl_cricket",
    },
    {
      id: "sl-dark-blue",
      name: "Deep Navy",
      hex: "#15295E",
      description: "Jersey base & dark contrasts",
      paletteId: "sl_cricket",
    },
    {
      id: "sl-yellow",
      name: "Tangerine Yellow",
      hex: "#FFCC00",
      description: "Golden Lion highlights & active badges",
      paletteId: "sl_cricket",
    },
    {
      id: "sl-orange",
      name: "Lion Orange",
      hex: "#CC6600",
      description: "Sunset warm secondary accent",
      paletteId: "sl_cricket",
    },
    {
      id: "sl-crimson",
      name: "Crimson Maroon",
      hex: "#8C0026",
      description: "National flag maroon & contrast borders",
      paletteId: "sl_cricket",
    },
    {
      id: "sl-white",
      name: "Pure White",
      hex: "#FFFFFF",
      description: "Crisp white text & clean surfaces",
      paletteId: "sl_cricket",
    },
  ],
};

export const SL_FLAG_PALETTE_GROUP: ColorPaletteGroup = {
  id: "sl_flag",
  name: "Sri Lanka Flag",
  tagline: "National Pride — Lion, Saffron & Teal",
  badge: "National Heritage",
  description: "Official colors inspired by the National Flag of Sri Lanka — Dark Red Maroon, Yellow Gold, Saffron Orange, Green Teal, and Pitch Black.",
  gradient: "linear-gradient(135deg, #8D153A 0%, #FFBE29 25%, #EB7400 50%, #00534E 75%, #000000 100%)",
  presets: [
    {
      id: "sl-flag-maroon",
      name: "Dark Maroon",
      hex: "#8D153A",
      description: "National flag lion field & primary hero tone",
      paletteId: "sl_flag",
    },
    {
      id: "sl-flag-gold",
      name: "Yellow Gold",
      hex: "#FFBE29",
      description: "Golden border, sword & four bo leaves",
      paletteId: "sl_flag",
    },
    {
      id: "sl-flag-saffron",
      name: "Saffron Orange",
      hex: "#EB7400",
      description: "Saffron vertical stripe representing unity",
      paletteId: "sl_flag",
    },
    {
      id: "sl-flag-teal",
      name: "Green Teal",
      hex: "#00534E",
      description: "Deep emerald teal stripe of harmony",
      paletteId: "sl_flag",
    },
    {
      id: "sl-flag-black",
      name: "Pitch Black",
      hex: "#000000",
      description: "Lion outline & high-contrast dark tone",
      paletteId: "sl_flag",
    },
  ],
};

export const CHRISTMAS_PALETTE_GROUP: ColorPaletteGroup = {
  id: "christmas",
  name: "Christmas",
  tagline: "Holiday Festive Magic — Santa Red & Evergreen Pine",
  badge: "Holiday Edition",
  description: "Official festive palette inspired by Christmas — Santa Crimson Red (main), Deep Pine Green (#062601), Mulled Wine Berry, Gingerbread Cream, and Winter Snow.",
  gradient: "linear-gradient(135deg, #A60311 0%, #73020C 25%, #062601 50%, #F2C49B 75%, #F2F2F2 100%)",
  presets: [
    {
      id: "xmas-crimson",
      name: "Santa Crimson",
      hex: "#A60311",
      description: "Hero festive red buttons & active energy (Main)",
      paletteId: "christmas",
    },
    {
      id: "xmas-pine",
      name: "Evergreen Pine",
      hex: "#062601",
      description: "Deep Pine Green / Evergreen Forest contrast borders & dark tones",
      paletteId: "christmas",
    },
    {
      id: "xmas-berry",
      name: "Mulled Wine Berry",
      hex: "#73020C",
      description: "Deep berry red & rich borders",
      paletteId: "christmas",
    },
    {
      id: "xmas-gingerbread",
      name: "Gingerbread Cream",
      hex: "#F2C49B",
      description: "Warm pastry glow & holiday highlights",
      paletteId: "christmas",
    },
    {
      id: "xmas-snow",
      name: "Winter Snow",
      hex: "#F2F2F2",
      description: "Crisp white snow surfaces & contrast text",
      paletteId: "christmas",
    },
  ],
};

export const CORE_PALETTE_GROUP: ColorPaletteGroup = {
  id: "core",
  name: "Framebooks Core",
  tagline: "Essential Financial & SaaS Accents",
  description: "Balanced, high-contrast brand tones engineered for clean financial reporting and executive dashboards.",
  gradient: "linear-gradient(135deg, #00E35B 0%, #06B6D4 33%, #4F46E5 66%, #BE123C 100%)",
  presets: [
    { id: "default", name: "Framebooks Green", hex: "#00E35B", description: "Default vibrant brand green", paletteId: "core" },
    { id: "emerald", name: "Emerald", hex: "#10B981", description: "Deep classic finance emerald", paletteId: "core" },
    { id: "teal", name: "Teal", hex: "#0D9488", description: "Balanced modern cyan-teal", paletteId: "core" },
    { id: "cyan", name: "Nordic Cyan", hex: "#06B6D4", description: "Vibrant crisp arctic cyan", paletteId: "core" },
    { id: "ocean", name: "Ocean Blue", hex: "#0284C7", description: "Crisp corporate sky blue", paletteId: "core" },
    { id: "royal", name: "Royal Blue", hex: "#2563EB", description: "High-contrast authoritative blue", paletteId: "core" },
    { id: "indigo", name: "Indigo", hex: "#4F46E5", description: "Modern SaaS indigo", paletteId: "core" },
    { id: "violet", name: "Electric Violet", hex: "#7C3AED", description: "Creative premium purple", paletteId: "core" },
    { id: "fuchsia", name: "Fuchsia Glow", hex: "#C026D3", description: "Modern high-energy magenta", paletteId: "core" },
    { id: "rose", name: "Rose", hex: "#E11D48", description: "Energetic deep magenta", paletteId: "core" },
    { id: "ruby", name: "Ruby Crimson", hex: "#BE123C", description: "Bold executive crimson", paletteId: "core" },
    { id: "sunset", name: "Sunset", hex: "#EA580C", description: "Warm amber-orange tone", paletteId: "core" },
    { id: "amber", name: "Amber Gold", hex: "#D97706", description: "Warm refined gold", paletteId: "core" },
    { id: "slate", name: "Monochrome Slate", hex: "#475569", description: "Minimalist executive slate", paletteId: "core" },
  ],
};

export const COLOR_PALETTE_GROUPS: ColorPaletteGroup[] = [
  GTA6_PALETTE_GROUP,
  F1_PALETTE_GROUP,
  SL_CRICKET_PALETTE_GROUP,
  SL_FLAG_PALETTE_GROUP,
  CHRISTMAS_PALETTE_GROUP,
  CORE_PALETTE_GROUP,
];

export const ACCENT_PRESETS: AccentPreset[] = [
  ...CORE_PALETTE_GROUP.presets,
  ...GTA6_PALETTE_GROUP.presets,
  ...F1_PALETTE_GROUP.presets,
  ...SL_CRICKET_PALETTE_GROUP.presets,
  ...SL_FLAG_PALETTE_GROUP.presets,
  ...CHRISTMAS_PALETTE_GROUP.presets,
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

export const GTA6_PALETTE_ID = "palette:gta6";
export const F1_PALETTE_ID = "palette:f1";
export const SL_CRICKET_PALETTE_ID = "palette:sl_cricket";
export const SL_FLAG_PALETTE_ID = "palette:sl_flag";
export const CHRISTMAS_PALETTE_ID = "palette:christmas";

export function isGta6Palette(color?: string | null): boolean {
  if (!color) return false;
  const clean = color.trim().toLowerCase();
  return clean === "palette:gta6" || clean === "gta6" || clean === "#gta006" || clean === "#gta600";
}

export function isF1Palette(color?: string | null): boolean {
  if (!color) return false;
  const clean = color.trim().toLowerCase();
  return clean === "palette:f1" || clean === "f1" || clean === "f1-movie" || clean === "palette:f1_movie" || clean === "palette:f1-movie";
}

export function isSlCricketPalette(color?: string | null): boolean {
  if (!color) return false;
  const clean = color.trim().toLowerCase();
  return (
    clean === "palette:sl_cricket" ||
    clean === "palette:sl-cricket" ||
    clean === "sl_cricket" ||
    clean === "sl-cricket" ||
    clean === "slcricket" ||
    clean === "palette:slcricket"
  );
}

export function isSlFlagPalette(color?: string | null): boolean {
  if (!color) return false;
  const clean = color.trim().toLowerCase();
  return (
    clean === "palette:sl_flag" ||
    clean === "palette:sl-flag" ||
    clean === "sl_flag" ||
    clean === "sl-flag" ||
    clean === "slflag" ||
    clean === "palette:slflag" ||
    clean === "srilanka-flag" ||
    clean === "sri-lanka-flag"
  );
}

export function isChristmasPalette(color?: string | null): boolean {
  if (!color) return false;
  const clean = color.trim().toLowerCase();
  return (
    clean === "palette:christmas" ||
    clean === "palette:xmas" ||
    clean === "christmas" ||
    clean === "xmas" ||
    clean === "chirtmas" ||
    clean === "palette:chirtmas"
  );
}

// GTA 6 palette signature colors
export const GTA6_HEX_LIST = [
  "#3B146B",
  "#7B208F",
  "#C9349B",
  "#F36A78",
  "#F87572",
  "#FF9B55",
  "#FFB458",
];

// F1: The Movie palette signature colors
export const F1_HEX_LIST = [
  "#8C3041",
  "#F2F2F2",
  "#D9C077",
  "#A6877C",
  "#0D0D0D",
];

// SL Cricket palette signature colors
export const SL_CRICKET_HEX_LIST = [
  "#0A50A1",
  "#15295E",
  "#FFCC00",
  "#CC6600",
  "#8C0026",
  "#FFFFFF",
];

// Sri Lanka Flag palette signature colors
export const SL_FLAG_HEX_LIST = [
  "#8D153A",
  "#FFBE29",
  "#EB7400",
  "#00534E",
  "#000000",
];

// Christmas palette signature colors
export const CHRISTMAS_HEX_LIST = [
  "#A60311",
  "#062601",
  "#73020C",
  "#F2C49B",
  "#F2F2F2",
];

export function isGta6Color(hex?: string | null): boolean {
  if (!hex) return false;
  return isGta6Palette(hex) || GTA6_HEX_LIST.includes(hex.trim().toUpperCase());
}

export function isF1Color(hex?: string | null): boolean {
  if (!hex) return false;
  return isF1Palette(hex) || F1_HEX_LIST.includes(hex.trim().toUpperCase());
}

export function isSlCricketColor(hex?: string | null): boolean {
  if (!hex) return false;
  return isSlCricketPalette(hex) || SL_CRICKET_HEX_LIST.includes(hex.trim().toUpperCase());
}

export function isSlFlagColor(hex?: string | null): boolean {
  if (!hex) return false;
  return isSlFlagPalette(hex) || SL_FLAG_HEX_LIST.includes(hex.trim().toUpperCase());
}

export function isChristmasColor(hex?: string | null): boolean {
  if (!hex) return false;
  return isChristmasPalette(hex) || CHRISTMAS_HEX_LIST.includes(hex.trim().toUpperCase());
}

export function isNamedPalette(color?: string | null): boolean {
  if (!color) return false;
  return (
    isGta6Palette(color) ||
    isF1Palette(color) ||
    isSlCricketPalette(color) ||
    isSlFlagPalette(color) ||
    isChristmasPalette(color) ||
    color.trim().toLowerCase().startsWith("palette:")
  );
}

export function resolvePaletteId(color?: string | null): string | null {
  if (!color) return null;
  const clean = color.trim();
  if (isGta6Palette(clean)) return GTA6_PALETTE_ID;
  if (isF1Palette(clean)) return F1_PALETTE_ID;
  if (isSlCricketPalette(clean)) return SL_CRICKET_PALETTE_ID;
  if (isSlFlagPalette(clean)) return SL_FLAG_PALETTE_ID;
  if (isChristmasPalette(clean)) return CHRISTMAS_PALETTE_ID;
  if (/^#[0-9a-fA-F]{6}$/i.test(clean)) return clean.toUpperCase();
  return null;
}

export function resolveHeroAccentHex(color?: string | null): string {
  if (!color) return DEFAULT_ACCENT_HEX;
  if (isGta6Palette(color)) return "#C9349B";
  if (isF1Palette(color)) return "#8C3041";
  if (isSlCricketPalette(color)) return "#0A50A1";
  if (isSlFlagPalette(color)) return "#8D153A";
  if (isChristmasPalette(color)) return "#A60311";
  if (/^#[0-9a-fA-F]{6}$/i.test(color)) return color.toUpperCase();
  return DEFAULT_ACCENT_HEX;
}

// Generate an 8-color harmonious categorical chart palette anchored by the accent color
export function generateChartPalette(inputHex?: string | null, count = 8): string[] {
  let hex = (inputHex || "").trim();

  // If entire GTA 6 palette is active
  if (isGta6Palette(hex)) {
    return [
      "#C9349B", // Magenta (Hero)
      "#F36A78", // Coral Pink
      "#F87572", // Coral
      "#FF9B55", // Orange
      "#FFB458", // Warm Yellow
      "#7B208F", // Purple
      "#3B146B", // Deep Violet
      "#E040FB", // Neon Violet Highlight
    ].slice(0, count);
  }

  // If entire F1: The Movie palette is active
  if (isF1Palette(hex)) {
    return [
      "#8C3041", // Deep Crimson
      "#D9C077", // Championship Gold
      "#A6877C", // Warm Bronze
      "#4A1A24", // Burgundy
      "#C4A85B", // Champagne
      "#8A6E64", // Sand
      "#262626", // Carbon
      "#E0C888", // Warm Gold
    ].slice(0, count);
  }

  // If entire SL Cricket palette is active
  if (isSlCricketPalette(hex)) {
    return [
      "#0A50A1", // Sri Lanka Blue (Hero)
      "#FFCC00", // Tangerine Yellow
      "#15295E", // Deep Navy
      "#CC6600", // Lion Orange
      "#8C0026", // Crimson Maroon
      "#2563EB", // Bright Blue
      "#EAB308", // Golden Yellow
      "#0369A1", // Sky Navy
    ].slice(0, count);
  }

  // If entire Sri Lanka Flag palette is active
  if (isSlFlagPalette(hex)) {
    return [
      "#8D153A", // Dark Maroon (Hero)
      "#FFBE29", // Yellow Gold
      "#EB7400", // Saffron Orange
      "#00534E", // Green Teal
      "#B0234B", // Bright Maroon
      "#FFD066", // Light Gold
      "#00756E", // Bright Teal
      "#F59333", // Warm Saffron
    ].slice(0, count);
  }

  // If entire Christmas palette is active
  if (isChristmasPalette(hex)) {
    return [
      "#A60311", // Santa Crimson (Hero)
      "#062601", // Evergreen Pine
      "#F2C49B", // Gingerbread
      "#73020C", // Berry
      "#C22635", // Bright Holiday Red
      "#134E0A", // Forest Green
      "#F8D7B8", // Warm Cream
      "#8C1420", // Deep Crimson
    ].slice(0, count);
  }

  let cleanHex = hex.toUpperCase();
  if (!/^#[0-9a-fA-F]{6}$/.test(cleanHex)) {
    cleanHex = DEFAULT_ACCENT_HEX;
  }

  // If a Christmas palette color is selected
  const xmasIdx = CHRISTMAS_HEX_LIST.indexOf(cleanHex);
  if (xmasIdx !== -1) {
    const rotated = [...CHRISTMAS_HEX_LIST.slice(xmasIdx), ...CHRISTMAS_HEX_LIST.slice(0, xmasIdx)];
    if (count > rotated.length) {
      rotated.push("#C22635", "#134E0A", "#F8D7B8");
    }
    return rotated.slice(0, count);
  }

  // If a Sri Lanka Flag palette color is selected
  const slFlagIdx = SL_FLAG_HEX_LIST.indexOf(cleanHex);
  if (slFlagIdx !== -1) {
    const rotated = [...SL_FLAG_HEX_LIST.slice(slFlagIdx), ...SL_FLAG_HEX_LIST.slice(0, slFlagIdx)];
    if (count > rotated.length) {
      rotated.push("#B0234B", "#00756E", "#FFD066");
    }
    return rotated.slice(0, count);
  }

  // If an SL Cricket palette color is selected
  const slIdx = SL_CRICKET_HEX_LIST.indexOf(cleanHex);
  if (slIdx !== -1) {
    const rotated = [...SL_CRICKET_HEX_LIST.slice(slIdx), ...SL_CRICKET_HEX_LIST.slice(0, slIdx)];
    if (count > rotated.length) {
      rotated.push("#0284C7", "#D97706");
    }
    return rotated.slice(0, count);
  }

  // If an F1 palette color is selected
  const f1Idx = F1_HEX_LIST.indexOf(cleanHex);
  if (f1Idx !== -1) {
    const rotated = [...F1_HEX_LIST.slice(f1Idx), ...F1_HEX_LIST.slice(0, f1Idx)];
    if (count > rotated.length) {
      rotated.push("#5A202B", "#C4A85B", "#333333");
    }
    return rotated.slice(0, count);
  }

  // If a GTA 6 palette color is selected, rotate the GTA 6 palette so the selected color is hero
  const gtaIdx = GTA6_HEX_LIST.indexOf(cleanHex);
  if (gtaIdx !== -1) {
    const rotated = [...GTA6_HEX_LIST.slice(gtaIdx), ...GTA6_HEX_LIST.slice(0, gtaIdx)];
    if (count > rotated.length) {
      rotated.push("#2A0E4E");
    }
    return rotated.slice(0, count);
  }

  const rgb = hexToRgb(cleanHex) || { r: 0, g: 227, b: 91 };
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

export function generateGta6ThemeCss(): string {
  return `
:root {
  --bg-primary: #FAF5F9;
  --popover-bg: #FFFFFF;
  --card-bg: #FFFFFF;
  --border-color: rgba(123, 32, 143, 0.16);
  --text-primary: #1C0A33;

  --accent: #C9349B;
  --accent-hover: #F36A78;
  --accent-active: #F87572;
  --accent-soft: rgba(201, 52, 155, 0.12);
  --accent-soft-foreground: #7B208F;
  --accent-border: rgba(201, 52, 155, 0.3);
  --accent-ring: rgba(201, 52, 155, 0.45);
  --accent-foreground: #FFFFFF;
  --accent-text: #C9349B;

  --brand-900: #3B146B;
  --brand-950: #19082D;

  --accent-50: #FDF2F8;
  --accent-100: #FCE7F3;
  --accent-200: #FBCFE8;
  --accent-300: #FFB458;
  --accent-400: #F36A78;
  --accent-500: #C9349B;
  --accent-600: #F87572;
  --accent-700: #7B208F;
  --accent-800: #FF9B55;
  --accent-900: #3B146B;
  --accent-950: #19082D;

  --chart-1: #C9349B;
  --chart-2: #F36A78;
  --chart-3: #F87572;
  --chart-4: #FF9B55;
  --chart-5: #FFB458;
  --chart-6: #7B208F;
  --chart-7: #3B146B;
  --chart-8: #E040FB;

  --palette-deep-violet: #3B146B;
  --palette-purple: #7B208F;
  --palette-magenta: #C9349B;
  --palette-coral-pink: #F36A78;
  --palette-coral: #F87572;
  --palette-orange: #FF9B55;
  --palette-warm-yellow: #FFB458;
  --palette-gradient: linear-gradient(135deg, #3B146B 0%, #7B208F 18%, #C9349B 36%, #F36A78 54%, #F87572 70%, #FF9B55 86%, #FFB458 100%);
  --palette-sunset-gradient: linear-gradient(90deg, #C9349B 0%, #F36A78 30%, #F87572 60%, #FF9B55 85%, #FFB458 100%);
}

.dark {
  --bg-primary: #0D041A;
  --popover-bg: #1A0933;
  --card-bg: rgba(59, 20, 107, 0.35);
  --border-color: rgba(123, 32, 143, 0.35);
  --text-primary: #FFFFFF;

  --accent-soft: rgba(201, 52, 155, 0.22);
  --accent-soft-foreground: #FF9B55;
  --accent-border: rgba(201, 52, 155, 0.42);
  --accent-text: #F36A78;
}
`.trim();
}

export function generateF1ThemeCss(): string {
  return `
:root {
  --bg-primary: #F8F7F6;
  --popover-bg: #FFFFFF;
  --card-bg: #FFFFFF;
  --border-color: rgba(166, 135, 124, 0.22);
  --text-primary: #0D0D0D;

  --accent: #8C3041;
  --accent-hover: #A0374C;
  --accent-active: #B23D55;
  --accent-soft: rgba(140, 48, 65, 0.12);
  --accent-soft-foreground: #8C3041;
  --accent-border: rgba(140, 48, 65, 0.3);
  --accent-ring: rgba(140, 48, 65, 0.45);
  --accent-foreground: #FFFFFF;
  --accent-text: #8C3041;

  --brand-900: #4A1A24;
  --brand-950: #0D0D0D;

  --accent-50: #FDF5F6;
  --accent-100: #FCE8EB;
  --accent-200: #F8CCD3;
  --accent-300: #D9C077;
  --accent-400: #A6877C;
  --accent-500: #8C3041;
  --accent-600: #7A2A38;
  --accent-700: #65232F;
  --accent-800: #4A1A24;
  --accent-900: #2E1017;
  --accent-950: #0D0D0D;

  --chart-1: #8C3041;
  --chart-2: #D9C077;
  --chart-3: #A6877C;
  --chart-4: #4A1A24;
  --chart-5: #C4A85B;
  --chart-6: #8A6E64;
  --chart-7: #262626;
  --chart-8: #E0C888;

  --palette-crimson: #8C3041;
  --palette-paddock-white: #F2F2F2;
  --palette-gold: #D9C077;
  --palette-bronze: #A6877C;
  --palette-carbon-black: #0D0D0D;
  --palette-f1-gradient: linear-gradient(135deg, #8C3041 0%, #F2F2F2 25%, #D9C077 50%, #A6877C 75%, #0D0D0D 100%);
}

.dark {
  --bg-primary: #0A0A0C;
  --popover-bg: #141416;
  --card-bg: rgba(22, 22, 26, 0.75);
  --border-color: rgba(166, 135, 124, 0.25);
  --text-primary: #F2F2F2;

  --accent-soft: rgba(140, 48, 65, 0.22);
  --accent-soft-foreground: #D9C077;
  --accent-border: rgba(140, 48, 65, 0.42);
  --accent-text: #D9C077;
}
`.trim();
}

export function generateSlCricketThemeCss(): string {
  return `
:root {
  --bg-primary: #F8FAFC;
  --popover-bg: #FFFFFF;
  --card-bg: #FFFFFF;
  --border-color: rgba(21, 41, 94, 0.16);
  --text-primary: #0F172A;

  --accent: #0A50A1;
  --accent-hover: #0D62C4;
  --accent-active: #083F80;
  --accent-soft: rgba(10, 80, 161, 0.12);
  --accent-soft-foreground: #0A50A1;
  --accent-border: rgba(10, 80, 161, 0.3);
  --accent-ring: rgba(10, 80, 161, 0.45);
  --accent-foreground: #FFFFFF;
  --accent-text: #0A50A1;

  --brand-900: #15295E;
  --brand-950: #050B1A;

  --accent-50: #EFF6FF;
  --accent-100: #DBEAFE;
  --accent-200: #BFDBFE;
  --accent-300: #FFCC00;
  --accent-400: #60A5FA;
  --accent-500: #0A50A1;
  --accent-600: #083F80;
  --accent-700: #15295E;
  --accent-800: #0F1E44;
  --accent-900: #0B1530;
  --accent-950: #050B1A;

  --chart-1: #0A50A1;
  --chart-2: #FFCC00;
  --chart-3: #15295E;
  --chart-4: #CC6600;
  --chart-5: #8C0026;
  --chart-6: #2563EB;
  --chart-7: #EAB308;
  --chart-8: #0369A1;

  --palette-sl-blue: #0A50A1;
  --palette-sl-navy: #15295E;
  --palette-sl-yellow: #FFCC00;
  --palette-sl-orange: #CC6600;
  --palette-sl-crimson: #8C0026;
  --palette-sl-white: #FFFFFF;
  --palette-sl-gradient: linear-gradient(135deg, #0A50A1 0%, #15295E 25%, #FFCC00 50%, #CC6600 75%, #8C0026 100%);
}

.dark {
  --bg-primary: #080D1A;
  --popover-bg: #0F172A;
  --card-bg: rgba(15, 23, 42, 0.75);
  --border-color: rgba(255, 204, 0, 0.2);
  --text-primary: #FFFFFF;

  --accent-soft: rgba(10, 80, 161, 0.28);
  --accent-soft-foreground: #FFCC00;
  --accent-border: rgba(255, 204, 0, 0.35);
  --accent-text: #FFCC00;
}
`.trim();
}

export function generateSlFlagThemeCss(): string {
  return `
:root {
  --bg-primary: #FAF9F6;
  --popover-bg: #FFFFFF;
  --card-bg: #FFFFFF;
  --border-color: rgba(141, 21, 58, 0.18);
  --text-primary: #1A0F13;

  --accent: #8D153A;
  --accent-hover: #A51C45;
  --accent-active: #72102E;
  --accent-soft: rgba(141, 21, 58, 0.12);
  --accent-soft-foreground: #8D153A;
  --accent-border: rgba(141, 21, 58, 0.3);
  --accent-ring: rgba(141, 21, 58, 0.45);
  --accent-foreground: #FFFFFF;
  --accent-text: #8D153A;

  --brand-900: #4D0A1E;
  --brand-950: #1A030A;

  --accent-50: #FDF2F4;
  --accent-100: #FBE4E9;
  --accent-200: #F7C5D1;
  --accent-300: #FFBE29;
  --accent-400: #EB7400;
  --accent-500: #8D153A;
  --accent-600: #7A1131;
  --accent-700: #620B26;
  --accent-800: #4D0A1E;
  --accent-900: #360514;
  --accent-950: #1A030A;

  --chart-1: #8D153A;
  --chart-2: #FFBE29;
  --chart-3: #EB7400;
  --chart-4: #00534E;
  --chart-5: #B0234B;
  --chart-6: #FFD066;
  --chart-7: #00756E;
  --chart-8: #F59333;

  --palette-flag-maroon: #8D153A;
  --palette-flag-gold: #FFBE29;
  --palette-flag-saffron: #EB7400;
  --palette-flag-teal: #00534E;
  --palette-flag-black: #000000;
  --palette-flag-gradient: linear-gradient(135deg, #8D153A 0%, #FFBE29 25%, #EB7400 50%, #00534E 75%, #000000 100%);
}

.dark {
  --bg-primary: #0D0407;
  --popover-bg: #1A070E;
  --card-bg: rgba(26, 7, 14, 0.75);
  --border-color: rgba(255, 190, 41, 0.22);
  --text-primary: #FAF9F6;

  --accent-soft: rgba(141, 21, 58, 0.26);
  --accent-soft-foreground: #FFBE29;
  --accent-border: rgba(255, 190, 41, 0.35);
  --accent-text: #FFBE29;
}
`.trim();
}

export function generateChristmasThemeCss(): string {
  return `
:root {
  --bg-primary: #FAF9F6;
  --popover-bg: #FFFFFF;
  --card-bg: #FFFFFF;
  --border-color: rgba(6, 38, 1, 0.18);
  --text-primary: #07150A;

  --accent: #A60311;
  --accent-hover: #BF0E1E;
  --accent-active: #87010C;
  --accent-soft: rgba(166, 3, 17, 0.12);
  --accent-soft-foreground: #A60311;
  --accent-border: rgba(6, 38, 1, 0.28);
  --accent-ring: rgba(166, 3, 17, 0.45);
  --accent-foreground: #FFFFFF;
  --accent-text: #A60311;

  --brand-900: #062601;
  --brand-950: #031401;

  --accent-50: #FDF2F3;
  --accent-100: #FCE4E6;
  --accent-200: #F7C5C9;
  --accent-300: #F2C49B;
  --accent-400: #E63946;
  --accent-500: #A60311;
  --accent-600: #8E020E;
  --accent-700: #73020C;
  --accent-800: #0E3D0A;
  --accent-900: #062601;
  --accent-950: #031401;

  --chart-1: #A60311;
  --chart-2: #062601;
  --chart-3: #F2C49B;
  --chart-4: #73020C;
  --chart-5: #165B1D;
  --chart-6: #C22635;
  --chart-7: #2E7D32;
  --chart-8: #8C1420;

  --palette-xmas-crimson: #A60311;
  --palette-xmas-berry: #73020C;
  --palette-xmas-pine: #062601;
  --palette-xmas-gingerbread: #F2C49B;
  --palette-xmas-snow: #F2F2F2;
  --palette-xmas-gradient: linear-gradient(135deg, #A60311 0%, #73020C 25%, #062601 50%, #F2C49B 75%, #F2F2F2 100%);
}

.dark {
  --bg-primary: #050E07;
  --popover-bg: #0A180D;
  --card-bg: rgba(6, 38, 1, 0.35);
  --border-color: rgba(6, 38, 1, 0.55);
  --text-primary: #F2F2F2;

  --accent-soft: rgba(166, 3, 17, 0.22);
  --accent-soft-foreground: #F2C49B;
  --accent-border: rgba(166, 3, 17, 0.4);
  --accent-text: #F87171;
}
`.trim();
}

export function generateAccentPalette(inputHex?: string | null): AccentPalette {
  let hex = (inputHex || "").trim();

  // If entire GTA 6 palette theme is requested
  if (isGta6Palette(hex)) {
    return {
      base: "#C9349B",
      hover: "#F36A78",
      active: "#F87572",
      soft: "rgba(201, 52, 155, 0.12)",
      softDark: "rgba(201, 52, 155, 0.22)",
      softForeground: "#7B208F",
      softForegroundDark: "#FF9B55",
      border: "rgba(201, 52, 155, 0.3)",
      borderDark: "rgba(201, 52, 155, 0.42)",
      ring: "rgba(201, 52, 155, 0.5)",
      foreground: "#FFFFFF",
      textLight: "#C9349B",
      textDark: "#F36A78",
      shades: {
        50: "#FDF2F8",
        100: "#FCE7F3",
        200: "#FBCFE8",
        300: "#FFB458",
        400: "#F36A78",
        500: "#C9349B",
        600: "#F87572",
        700: "#7B208F",
        800: "#FF9B55",
        900: "#3B146B",
        950: "#19082D",
      },
      bgLight: "#FAF5F9",
      bgDark: "#0D041A",
      popoverLight: "#FFFFFF",
      popoverDark: "#1A0933",
      cardDark: "rgba(59, 20, 107, 0.35)",
      borderLight: "rgba(123, 32, 143, 0.16)",
      textPrimaryLight: "#1C0A33",
      brand900: "#3B146B",
      chartPalette: [
        "#C9349B",
        "#F36A78",
        "#F87572",
        "#FF9B55",
        "#FFB458",
        "#7B208F",
        "#3B146B",
        "#E040FB",
      ],
      contrastOnAccent: 4.5,
    };
  }

  // If entire F1: The Movie palette theme is requested
  if (isF1Palette(hex)) {
    return {
      base: "#8C3041",
      hover: "#A0374C",
      active: "#B23D55",
      soft: "rgba(140, 48, 65, 0.12)",
      softDark: "rgba(140, 48, 65, 0.22)",
      softForeground: "#8C3041",
      softForegroundDark: "#D9C077",
      border: "rgba(140, 48, 65, 0.3)",
      borderDark: "rgba(140, 48, 65, 0.42)",
      ring: "rgba(140, 48, 65, 0.5)",
      foreground: "#FFFFFF",
      textLight: "#8C3041",
      textDark: "#D9C077",
      shades: {
        50: "#FDF5F6",
        100: "#FCE8EB",
        200: "#F8CCD3",
        300: "#D9C077",
        400: "#A6877C",
        500: "#8C3041",
        600: "#7A2A38",
        700: "#65232F",
        800: "#4A1A24",
        900: "#2E1017",
        950: "#0D0D0D",
      },
      bgLight: "#F8F7F6",
      bgDark: "#0A0A0C",
      popoverLight: "#FFFFFF",
      popoverDark: "#141416",
      cardDark: "rgba(22, 22, 26, 0.75)",
      borderLight: "rgba(166, 135, 124, 0.22)",
      textPrimaryLight: "#0D0D0D",
      brand900: "#4A1A24",
      chartPalette: [
        "#8C3041",
        "#D9C077",
        "#A6877C",
        "#4A1A24",
        "#C4A85B",
        "#8A6E64",
        "#262626",
        "#E0C888",
      ],
      contrastOnAccent: 4.8,
    };
  }

  // If entire SL Cricket palette theme is requested
  if (isSlCricketPalette(hex)) {
    return {
      base: "#0A50A1",
      hover: "#0D62C4",
      active: "#083F80",
      soft: "rgba(10, 80, 161, 0.12)",
      softDark: "rgba(10, 80, 161, 0.24)",
      softForeground: "#0A50A1",
      softForegroundDark: "#FFCC00",
      border: "rgba(10, 80, 161, 0.3)",
      borderDark: "rgba(10, 80, 161, 0.42)",
      ring: "rgba(10, 80, 161, 0.5)",
      foreground: "#FFFFFF",
      textLight: "#0A50A1",
      textDark: "#60A5FA",
      shades: {
        50: "#EFF6FF",
        100: "#DBEAFE",
        200: "#BFDBFE",
        300: "#FFCC00",
        400: "#60A5FA",
        500: "#0A50A1",
        600: "#083F80",
        700: "#15295E",
        800: "#0F1E44",
        900: "#0B1530",
        950: "#050B1A",
      },
      bgLight: "#F8FAFC",
      bgDark: "#080D1A",
      popoverLight: "#FFFFFF",
      popoverDark: "#0F172A",
      cardDark: "rgba(15, 23, 42, 0.75)",
      borderLight: "rgba(21, 41, 94, 0.16)",
      textPrimaryLight: "#0F172A",
      brand900: "#15295E",
      chartPalette: [
        "#0A50A1",
        "#FFCC00",
        "#15295E",
        "#CC6600",
        "#8C0026",
        "#2563EB",
        "#EAB308",
        "#0369A1",
      ],
      contrastOnAccent: 4.8,
    };
  }

  // If entire Sri Lanka Flag palette theme is requested
  if (isSlFlagPalette(hex)) {
    return {
      base: "#8D153A",
      hover: "#A51C45",
      active: "#72102E",
      soft: "rgba(141, 21, 58, 0.12)",
      softDark: "rgba(141, 21, 58, 0.24)",
      softForeground: "#8D153A",
      softForegroundDark: "#FFBE29",
      border: "rgba(141, 21, 58, 0.3)",
      borderDark: "rgba(255, 190, 41, 0.35)",
      ring: "rgba(141, 21, 58, 0.5)",
      foreground: "#FFFFFF",
      textLight: "#8D153A",
      textDark: "#FFBE29",
      shades: {
        50: "#FDF2F4",
        100: "#FBE4E9",
        200: "#F7C5D1",
        300: "#FFBE29",
        400: "#EB7400",
        500: "#8D153A",
        600: "#7A1131",
        700: "#620B26",
        800: "#4D0A1E",
        900: "#360514",
        950: "#1A030A",
      },
      bgLight: "#FAF9F6",
      bgDark: "#0D0407",
      popoverLight: "#FFFFFF",
      popoverDark: "#1A070E",
      cardDark: "rgba(26, 7, 14, 0.75)",
      borderLight: "rgba(141, 21, 58, 0.18)",
      textPrimaryLight: "#1A0F13",
      brand900: "#4D0A1E",
      chartPalette: [
        "#8D153A",
        "#FFBE29",
        "#EB7400",
        "#00534E",
        "#B0234B",
        "#FFD066",
        "#00756E",
        "#F59333",
      ],
      contrastOnAccent: 4.8,
    };
  }

  // If entire Christmas palette theme is requested
  if (isChristmasPalette(hex)) {
    return {
      base: "#A60311",
      hover: "#BF0E1E",
      active: "#87010C",
      soft: "rgba(166, 3, 17, 0.12)",
      softDark: "rgba(166, 3, 17, 0.22)",
      softForeground: "#A60311",
      softForegroundDark: "#F2C49B",
      border: "rgba(6, 38, 1, 0.28)",
      borderDark: "rgba(6, 38, 1, 0.55)",
      ring: "rgba(166, 3, 17, 0.5)",
      foreground: "#FFFFFF",
      textLight: "#A60311",
      textDark: "#F87171",
      shades: {
        50: "#FDF2F3",
        100: "#FCE4E6",
        200: "#F7C5C9",
        300: "#F2C49B",
        400: "#E63946",
        500: "#A60311",
        600: "#8E020E",
        700: "#73020C",
        800: "#0E3D0A",
        900: "#062601",
        950: "#031401",
      },
      bgLight: "#FAF9F6",
      bgDark: "#050E07",
      popoverLight: "#FFFFFF",
      popoverDark: "#0A180D",
      cardDark: "rgba(6, 38, 1, 0.35)",
      borderLight: "rgba(6, 38, 1, 0.18)",
      textPrimaryLight: "#07150A",
      brand900: "#062601",
      chartPalette: [
        "#A60311",
        "#062601",
        "#F2C49B",
        "#73020C",
        "#165B1D",
        "#C22635",
        "#2E7D32",
        "#8C1420",
      ],
      contrastOnAccent: 4.8,
    };
  }

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
  if (isGta6Palette(accentColor)) {
    return generateGta6ThemeCss();
  }
  if (isF1Palette(accentColor)) {
    return generateF1ThemeCss();
  }
  if (isSlCricketPalette(accentColor)) {
    return generateSlCricketThemeCss();
  }
  if (isSlFlagPalette(accentColor)) {
    return generateSlFlagThemeCss();
  }
  if (isChristmasPalette(accentColor)) {
    return generateChristmasThemeCss();
  }
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
