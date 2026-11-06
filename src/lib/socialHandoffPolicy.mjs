// These links open a human-controlled browser. No provider/API access or send.
export function onlyFansManualTarget(value) {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["onlyfans.com", "www.onlyfans.com"].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash) return null;
    // Accept a stored account/message URL only. Never manufacture a thread ID.
    if (!/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]*$/u.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

