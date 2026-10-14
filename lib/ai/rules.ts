import { z } from "zod";
import type { PresentationStyle } from "@/lib/ai/contracts";

export interface StoreAiRules {
  brandTone: string;
  titleRule: string;
  descriptionRule: string;
  tagsRule: string;
  seoRule: string;
  customInstructions: string;
  presentationStyle?: PresentationStyle;
  modelFaceDirective?: string;
}

export const DEFAULT_AI_RULES: StoreAiRules = {
  brandTone:
    "You are a world-class e-commerce copywriter, SEO strategist, and catalog merchandising director. Produce compelling, premium, and high-converting catalog metadata.",
  titleRule:
    "Clean, premium, high-converting product title (e.g. '[Brand/Descriptor] [Key Feature/Material] [Product] - [Variant/Specs]'). Do not use clickbait, hyperbolic claims, or excessive punctuation.",
  descriptionRule:
    "Semantic, well-organized HTML structure:\n- 1 opening compelling narrative paragraph introducing the product.\n- A <ul> list of 4-6 Key Features / Benefits with <strong> headings in each <li>.\n- A <ul> list of Specifications (materials, dimensions/fit, care/usage).\n- Do NOT include the product title as an <h1>/<h2> heading.\n- Do NOT include price or currency symbols.\n- Do NOT include links or external URLs.",
  tagsRule:
    "6 to 12 relevant, search-friendly e-commerce tags in lowercase.",
  seoRule:
    "SEO Title: Highly optimized for Google snippet (50-65 characters).\nSEO Description: High-CTR meta description for Google snippet (140-160 characters).",
  customInstructions: "",
  presentationStyle: "product_only",
  modelFaceDirective: "",
};

export const storeAiRulesFormSchema = z.object({
  brandTone: z.string().trim().max(1000, "Brand tone must be under 1,000 characters"),
  titleRule: z.string().trim().max(1000, "Title rule must be under 1,000 characters"),
  descriptionRule: z.string().trim().max(1500, "Description rule must be under 1,500 characters"),
  tagsRule: z.string().trim().max(800, "Tags rule must be under 800 characters"),
  seoRule: z.string().trim().max(800, "SEO rule must be under 800 characters"),
  customInstructions: z.string().trim().max(2000, "Custom instructions must be under 2,000 characters"),
  presentationStyle: z
    .enum(["product_only", "on_model", "ghost_mannequin", "studio_mannequin"])
    .optional(),
  modelFaceDirective: z
    .string()
    .trim()
    .max(1000, "Model face directive must be under 1,000 characters")
    .optional(),
});

const IMAGE_RULES_TAG_START = "<!-- dockit:image_rules ";
const IMAGE_RULES_TAG_END = " -->";

export function extractImageRules(rawCustomInstructions?: string | null): {
  cleanCustomInstructions: string;
  presentationStyle?: PresentationStyle;
  modelFaceDirective?: string;
} {
  if (!rawCustomInstructions) {
    return { cleanCustomInstructions: "" };
  }

  const startIndex = rawCustomInstructions.indexOf(IMAGE_RULES_TAG_START);
  if (startIndex === -1) {
    return { cleanCustomInstructions: rawCustomInstructions };
  }

  const endIndex = rawCustomInstructions.indexOf(IMAGE_RULES_TAG_END, startIndex);
  if (endIndex === -1) {
    return { cleanCustomInstructions: rawCustomInstructions };
  }

  const jsonStr = rawCustomInstructions.slice(
    startIndex + IMAGE_RULES_TAG_START.length,
    endIndex
  );

  let presentationStyle: PresentationStyle | undefined;
  let modelFaceDirective: string | undefined;

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.presentationStyle) presentationStyle = parsed.presentationStyle;
    if (parsed.modelFaceDirective) modelFaceDirective = parsed.modelFaceDirective;
  } catch {
    // ignore parse error
  }

  const cleanCustomInstructions = (
    rawCustomInstructions.slice(0, startIndex) +
    rawCustomInstructions.slice(endIndex + IMAGE_RULES_TAG_END.length)
  ).trim();

  return {
    cleanCustomInstructions,
    presentationStyle,
    modelFaceDirective,
  };
}

export function encodeImageRules(
  customInstructions: string,
  imageRules: {
    presentationStyle?: PresentationStyle;
    modelFaceDirective?: string;
  }
): string {
  const { cleanCustomInstructions } = extractImageRules(customInstructions);
  const style = imageRules.presentationStyle;
  const directive = imageRules.modelFaceDirective?.trim();

  const payload: Record<string, string> = {};
  if (style) payload.presentationStyle = style;
  if (directive) payload.modelFaceDirective = directive;

  if (Object.keys(payload).length === 0) {
    return cleanCustomInstructions;
  }

  const tag = `${IMAGE_RULES_TAG_START}${JSON.stringify(payload)}${IMAGE_RULES_TAG_END}`;
  return cleanCustomInstructions ? `${cleanCustomInstructions}\n\n${tag}` : tag;
}

export function resolveEffectiveAiRules(savedRules?: Partial<StoreAiRules> | null): StoreAiRules {
  if (!savedRules) return { ...DEFAULT_AI_RULES };

  const extracted = extractImageRules(savedRules.customInstructions);

  return {
    brandTone: savedRules.brandTone?.trim() || DEFAULT_AI_RULES.brandTone,
    titleRule: savedRules.titleRule?.trim() || DEFAULT_AI_RULES.titleRule,
    descriptionRule: savedRules.descriptionRule?.trim() || DEFAULT_AI_RULES.descriptionRule,
    tagsRule: savedRules.tagsRule?.trim() || DEFAULT_AI_RULES.tagsRule,
    seoRule: savedRules.seoRule?.trim() || DEFAULT_AI_RULES.seoRule,
    customInstructions:
      savedRules.customInstructions !== undefined
        ? extracted.cleanCustomInstructions
        : DEFAULT_AI_RULES.customInstructions,
    presentationStyle:
      savedRules.presentationStyle ||
      extracted.presentationStyle ||
      DEFAULT_AI_RULES.presentationStyle,
    modelFaceDirective:
      savedRules.modelFaceDirective !== undefined
        ? savedRules.modelFaceDirective.trim()
        : extracted.modelFaceDirective || DEFAULT_AI_RULES.modelFaceDirective,
  };
}

