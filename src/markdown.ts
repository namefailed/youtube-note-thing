import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ linkify: true, breaks: true });

// Note content can be attacker-influenced (imported via JSON). Force every link to
// open in a new context with no opener — a clicked link can't replace the SPA with
// an arbitrary page (the prod CSP doesn't govern top-level navigation).
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/** Render note Markdown to sanitized HTML. Never returns un-sanitized output. */
export function renderMarkdown(src: string): string {
  return DOMPurify.sanitize(md.render(src ?? ""));
}
