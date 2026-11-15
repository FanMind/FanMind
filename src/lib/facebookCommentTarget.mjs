/** Build a browser target only from the authorized comment's own provenance.
 * Never use an operator page, a token, a contact profile or a global fallback.
 */
export function facebookCommentTarget({ permalink, postId, commentId }) {
  const comment = typeof commentId === "string" && /^\d+(?:_\d+)?$/u.test(commentId)
    ? commentId.split("_").at(-1) : null;
  if (typeof permalink === "string" && permalink.length <= 2048) {
    try {
      const url = new URL(permalink);
      if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
          ["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname) &&
          url.pathname !== "/" && !url.pathname.startsWith("//") &&
          !/^\/(?:l\.php|login|dialog|share|sharer|messages|profile\.php)(?:[/.]|$)/u.test(url.pathname)) {
        const safe = new URL("https://www.facebook.com");
        safe.pathname = url.pathname;
        for (const key of ["story_fbid", "id", "fbid", "v", "comment_id", "reply_comment_id"]) {
          const value = url.searchParams.get(key);
          if (value && /^[A-Za-z0-9_-]{1,255}$/u.test(value)) safe.searchParams.set(key, value);
        }
        if (comment && !safe.searchParams.has("reply_comment_id")) safe.searchParams.set("comment_id", comment);
        if (safe.searchParams.has("comment_id") || safe.searchParams.has("reply_comment_id")) return safe.href;
      }
    } catch { /* Try validated object IDs below. */ }
  }
  if (!comment || typeof postId !== "string" || !/^\d+_\d+$/u.test(postId)) return null;
  const [page, post] = postId.split("_");
  const url = new URL(`https://www.facebook.com/${page}/posts/${post}`);
  url.searchParams.set("comment_id", comment);
  return url.href;
}
