import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ linkify: true, breaks: true });

/** Render note Markdown to sanitized HTML. Never returns un-sanitized output. */
export function renderMarkdown(src: string): string {
  return DOMPurify.sanitize(md.render(src ?? ""));
}
