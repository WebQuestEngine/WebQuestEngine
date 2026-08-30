/**
 * TemplateUtils — Core engine for the 3-Tier Presentation Architecture.
 *
 * Provides type-safe {{placeholder}} substitution, XSS-safe HTML escaping,
 * and list rendering helpers used by all *.template.ts view adapters.
 */
export class TemplateUtils {
  /**
   * Replaces {{placeholder}} tokens in a raw HTML string with type-safe parameters.
   * Missing keys resolve to empty string.
   */
  public static populate<T extends Record<string, any>>(template: string, data: T): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = data[key];
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  /**
   * Sanitizes user-supplied strings to prevent XSS and broken HTML attribute values.
   */
  public static escapeHtml(str: string | undefined | null): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Renders and concatenates an array of items using a render function.
   * Safe against undefined/null arrays.
   */
  public static renderList<T>(
    items: T[] | undefined | null,
    renderFn: (item: T, index: number) => string
  ): string {
    return (items || []).map((item, index) => renderFn(item, index)).join('');
  }
}
