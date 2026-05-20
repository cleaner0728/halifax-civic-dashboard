// Plain-string HTML helpers — kept dep-free so they can be used from server
// fetchers and the build-time Reddit script alike.

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}
