import { z } from "zod";

export interface StoreAiRules {
  brandTone: string;
  titleRule: string;
  descriptionRule: string;
  tagsRule: string;
  seoRule: string;
  customInstructions: string;
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
};

export const storeAiRulesFormSchema = z.object({
  brandTone: z.string().trim().max(1000, "Brand tone must be under 1,000 characters"),
  titleRule: z.string().trim().max(1000, "Title rule must be under 1,000 characters"),
  descriptionRule: z.string().trim().max(1500, "Description rule must be under 1,500 characters"),
  tagsRule: z.string().trim().max(800, "Tags rule must be under 800 characters"),
  seoRule: z.string().trim().max(800, "SEO rule must be under 800 characters"),
  customInstructions: z.string().trim().max(2000, "Custom instructions must be under 2,000 characters"),
});

export function resolveEffectiveAiRules(savedRules?: Partial<StoreAiRules> | null): StoreAiRules {
  if (!savedRules) return { ...DEFAULT_AI_RULES };
  return {
    brandTone: savedRules.brandTone?.trim() || DEFAULT_AI_RULES.brandTone,
    titleRule: savedRules.titleRule?.trim() || DEFAULT_AI_RULES.titleRule,
    descriptionRule: savedRules.descriptionRule?.trim() || DEFAULT_AI_RULES.descriptionRule,
    tagsRule: savedRules.tagsRule?.trim() || DEFAULT_AI_RULES.tagsRule,
    seoRule: savedRules.seoRule?.trim() || DEFAULT_AI_RULES.seoRule,
    customInstructions: savedRules.customInstructions?.trim() || "",
  };
}
