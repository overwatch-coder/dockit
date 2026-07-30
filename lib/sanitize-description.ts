import DOMPurify from "isomorphic-dompurify";

// Shared by app/(dashboard)/products/actions.ts (sanitizing before persisting
// a save) and components/product-form.tsx (sanitizing again client-side for
// the live preview panel) — same allowlist either way, since the rich text
// editor's HTML is client-generated and isn't trustworthy just because it
// came from a constrained toolbar (e.g. a pasted <script>/event handler).
export const DESCRIPTION_ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "span",
];

let linkHookRegistered = false;

export function sanitizeDescriptionHtml(html: string): string {
  if (!linkHookRegistered) {
    // Force any surviving link to open safely in a new tab, per DOMPurify's
    // own documented recipe — registered once on the shared instance.
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    linkHookRegistered = true;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: DESCRIPTION_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href"],
  });
}
