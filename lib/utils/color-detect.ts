export type PresetSwatch = {
  name: string;
  hex: string;
};

export const PRESET_SWATCHES: PresetSwatch[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Heather Grey", hex: "#9CA3AF" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Navy Blue", hex: "#001F3F" },
  { name: "Royal Blue", hex: "#1D4ED8" },
  { name: "Sky Blue", hex: "#38BDF8" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Forest Green", hex: "#15803D" },
  { name: "Olive", hex: "#556B2F" },
  { name: "Sage", hex: "#87A96B" },
  { name: "Red", hex: "#EF4444" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Rust", hex: "#B7410E" },
  { name: "Coral", hex: "#FF7F50" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Dusty Rose", hex: "#DCAE96" },
  { name: "Lavender", hex: "#A855F7" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Tan", hex: "#D2B48C" },
  { name: "Brown", hex: "#78350F" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Orange", hex: "#F97316" },
  { name: "Gold", hex: "#FFD700" },
];

// Ordered dictionary: Compound phrases must appear before single words so
// "Navy Blue" matches before "Blue", "Heather Grey" matches before "Grey", etc.
const COLOR_NAME_TO_HEX: [string, string][] = [
  ["heather grey", "#9CA3AF"],
  ["heather gray", "#9CA3AF"],
  ["navy blue", "#001F3F"],
  ["royal blue", "#1D4ED8"],
  ["sky blue", "#38BDF8"],
  ["baby blue", "#89CFF0"],
  ["army green", "#4B5320"],
  ["forest green", "#15803D"],
  ["sage green", "#87A96B"],
  ["olive green", "#556B2F"],
  ["emerald green", "#10B981"],
  ["mint green", "#98FF98"],
  ["dusty rose", "#DCAE96"],
  ["dusty pink", "#DCAE96"],
  ["rose gold", "#B76E79"],
  ["off white", "#FAF9F6"],
  ["off-white", "#FAF9F6"],
  ["light blue", "#93C5FD"],
  ["dark blue", "#1E3A8A"],
  ["light grey", "#D1D5DB"],
  ["light gray", "#D1D5DB"],
  ["dark grey", "#4B5563"],
  ["dark gray", "#4B5563"],
  ["black", "#000000"],
  ["white", "#FFFFFF"],
  ["navy", "#001F3F"],
  ["charcoal", "#374151"],
  ["grey", "#6B7280"],
  ["gray", "#6B7280"],
  ["red", "#EF4444"],
  ["blue", "#3B82F6"],
  ["green", "#10B981"],
  ["olive", "#556B2F"],
  ["sage", "#87A96B"],
  ["burgundy", "#800020"],
  ["maroon", "#800000"],
  ["wine", "#722F37"],
  ["beige", "#F5F5DC"],
  ["sand", "#C2B280"],
  ["khaki", "#C3B091"],
  ["tan", "#D2B48C"],
  ["camel", "#C19A6B"],
  ["brown", "#78350F"],
  ["chocolate", "#3D1C06"],
  ["pink", "#EC4899"],
  ["blush", "#DE5D83"],
  ["coral", "#FF7F50"],
  ["peach", "#FFDAB9"],
  ["orange", "#F97316"],
  ["rust", "#B7410E"],
  ["terracotta", "#E2725B"],
  ["yellow", "#F59E0B"],
  ["mustard", "#FFDB58"],
  ["gold", "#FFD700"],
  ["silver", "#C0C0C0"],
  ["purple", "#8B5CF6"],
  ["violet", "#7C3AED"],
  ["plum", "#8E4585"],
  ["lavender", "#E6E6FA"],
  ["lilac", "#C8A2C8"],
  ["teal", "#0D9488"],
  ["turquoise", "#40E0D0"],
  ["cyan", "#06B6D4"],
  ["cream", "#FFFDD0"],
  ["ivory", "#FFFFF0"],
];

const HEX_REGEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

/**
 * Validates whether a given string is a valid 3 or 6-digit hex code with leading #.
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}

/**
 * Automatically detects a hex color from an option name string (e.g. "Small / Navy Blue",
 * "XL - Burgundy", "Off White", "#3498DB").
 */
export function detectColorFromName(optionName: string): string | null {
  if (!optionName || !optionName.trim()) return null;

  const hexMatch = optionName.match(HEX_REGEX);
  if (hexMatch) {
    const raw = hexMatch[0].toUpperCase();
    if (raw.length === 4) {
      // Expand 3-digit hex to 6-digit
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    }
    return raw;
  }

  // Normalize string by converting separators to spaces
  const clean = optionName
    .toLowerCase()
    .replace(/[/_,\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Check for compound phrases and exact matches first
  for (const [name, hex] of COLOR_NAME_TO_HEX) {
    const wordBoundaryRegex = new RegExp(`\\b${name.replace("-", "[ -]")}\\b`, "i");
    if (wordBoundaryRegex.test(clean)) {
      return hex;
    }
  }

  return null;
}
