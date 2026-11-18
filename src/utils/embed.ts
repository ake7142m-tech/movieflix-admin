// Helpers for playing real streams (iframe embeds, HLS, or direct video files)

/** Accepts a plain URL OR a pasted <iframe ...> snippet and returns a clean URL. */
export function normalizeStreamUrl(input?: string): string {
  if (!input) return '';
  let value = input.trim();
  const match = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (match) value = match[1];
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/g, '&')
    .trim();
}

/** True when the URL should be rendered inside an <iframe> (not a raw video file). */
export function isEmbedUrl(url?: string): boolean {
  if (!url) return false;
  return !/\.(mp4|webm|ogg|ogv|mov|m4v|m3u8)(\?|#|$)/i.test(url);
}
