import {
  WEBSITE_CHAT_INSTALLATION_HEADER,
  WEBSITE_CHAT_INSTALLATION_QUERY,
} from "./websiteChatPolicy.mjs";

export const WEBSITE_CHAT_WIDGET_VERSION = "1.1.0";

export function buildWebsiteChatWidgetScript() {
  return `(() => {
  "use strict";
  const script = document.currentScript;
  if (!script || script.dataset.fanmindMounted === "true") return;
  script.dataset.fanmindMounted = "true";
  const installationId = (script.dataset.installationId || "").trim();
  const consentVersion = (script.dataset.consentVersion || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installationId) || !consentVersion || consentVersion.length > 80) return;
  const baseUrl = new URL(script.src, document.baseURI).origin;
  const endpoint = (path) => baseUrl + path + "?${WEBSITE_CHAT_INSTALLATION_QUERY}=" + encodeURIComponent(installationId);
  let sessionToken = null;
  let pendingClientMessageId = null;
  let pendingMessage = null;
  let pendingHandoffId = null;
  let sending = false;
  let requestingHandoff = false;
  const host = document.createElement("div");
  host.setAttribute("data-fanmind-widget", "${WEBSITE_CHAT_WIDGET_VERSION}");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = \`<style>
    :host{all:initial}.fm{position:fixed;right:20px;bottom:20px;z-index:2147483000;font:14px/1.4 Arial,sans-serif;color:#f7f9ff}
    button,textarea,input{font:inherit}.toggle,.send,.handoff-button{border:0;border-radius:999px;background:#0787f7;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;box-shadow:0 10px 30px #001b3d55}
    .panel{display:none;width:min(360px,calc(100vw - 32px));margin-bottom:10px;padding:18px;border:1px solid #1d5a92;border-radius:18px;background:#06111f;box-shadow:0 16px 48px #0009}.open{display:block}
    h2{font-size:18px;margin:0 0 6px}p{margin:0 0 12px;color:#c8d7e8}.consent{display:flex;gap:8px;align-items:flex-start;margin:10px 0}textarea,.email{box-sizing:border-box;width:100%;border:1px solid #477197;border-radius:10px;background:#0b2035;color:#fff;padding:10px}textarea{min-height:110px;resize:vertical}.status{min-height:20px;margin:10px 0 0;color:#a8c9e8}.send,.handoff-button{border-radius:10px;margin-top:10px}.send:disabled,.handoff-button:disabled{opacity:.55;cursor:not-allowed}.handoff{display:none;border-top:1px solid #24445f;margin-top:14px;padding-top:14px}.handoff.open{display:block}.handoff h3{font-size:15px;margin:0 0 6px}.handoff-status{min-height:20px;margin:10px 0 0;color:#a8c9e8}
  </style><div class="fm"><section class="panel" aria-label="FanMind Nachricht"><h2>Nachricht senden</h2><p>Ihre Nachricht wird an das Team übermittelt. Es erfolgt noch keine automatische KI-Antwort.</p><textarea maxlength="4000" aria-label="Nachricht" placeholder="Wie können wir helfen?"></textarea><label class="consent message-consent"><input type="checkbox"><span>Ich stimme der Verarbeitung meiner Nachricht gemäß Datenschutzhinweis zu.</span></label><button class="send" type="button">Nachricht senden</button><p class="status" role="status" aria-live="polite"></p><section class="handoff" aria-label="Persönliche Antwort"><h3>Persönliche Antwort erhalten</h3><p>Hinterlassen Sie freiwillig Ihre E-Mail-Adresse. Das Team sieht den gesamten Gesprächsverlauf und kann später persönlich antworten.</p><input class="email" type="email" maxlength="254" autocomplete="email" aria-label="E-Mail-Adresse" placeholder="name@beispiel.de"><label class="consent handoff-consent"><input type="checkbox"><span>Ich stimme zu, dass meine E-Mail-Adresse für diese persönliche Antwort gespeichert und verwendet wird.</span></label><button class="handoff-button" type="button">An Team übergeben</button><p class="handoff-status" role="status" aria-live="polite"></p></section></section><button class="toggle" type="button" aria-expanded="false">Nachricht</button></div>\`;
  const panel = root.querySelector(".panel");
  const toggle = root.querySelector(".toggle");
  const send = root.querySelector(".send");
  const textarea = root.querySelector("textarea");
  const consent = root.querySelector(".message-consent input");
  const status = root.querySelector(".status");
  const handoff = root.querySelector(".handoff");
  const email = root.querySelector(".email");
  const handoffConsent = root.querySelector(".handoff-consent input");
  const handoffButton = root.querySelector(".handoff-button");
  const handoffStatus = root.querySelector(".handoff-status");
  toggle.addEventListener("click", () => { const open = !panel.classList.contains("open"); panel.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); if (open) textarea.focus(); });
  async function ensureSession() {
    if (sessionToken) return sessionToken;
    const response = await fetch(endpoint("/api/website-chat/session"), { method:"POST", headers:{"content-type":"application/json","${WEBSITE_CHAT_INSTALLATION_HEADER}":installationId}, body:JSON.stringify({ consent:{ granted:true, version:consentVersion } }), credentials:"omit", cache:"no-store" });
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true || typeof payload?.session?.token !== "string") throw new Error("session");
    sessionToken = payload.session.token;
    return sessionToken;
  }
  send.addEventListener("click", async () => {
    const message = textarea.value.trim();
    if (sending) return;
    if (!consent.checked) { status.textContent = "Bitte stimmen Sie zuerst der Verarbeitung zu."; return; }
    if (!message) { status.textContent = "Bitte geben Sie eine Nachricht ein."; return; }
    sending = true; send.disabled = true; status.textContent = "Nachricht wird übermittelt …";
    try {
      const token = await ensureSession();
      if (!pendingClientMessageId || pendingMessage !== message) {
        pendingClientMessageId = crypto.randomUUID(); pendingMessage = message;
      }
      const response = await fetch(endpoint("/api/website-chat/message"), { method:"POST", headers:{"content-type":"application/json","authorization":"Bearer " + token,"${WEBSITE_CHAT_INSTALLATION_HEADER}":installationId}, body:JSON.stringify({ clientMessageId:pendingClientMessageId, message }), credentials:"omit", cache:"no-store" });
      if (response.status === 401) sessionToken = null;
      if (!response.ok) throw new Error("message");
      textarea.value = ""; pendingClientMessageId = null; pendingMessage = null; status.textContent = "Danke. Ihre Nachricht wurde übermittelt."; handoff.classList.add("open");
    } catch { status.textContent = "Die Nachricht konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut."; }
    finally { sending = false; send.disabled = false; }
  });
  handoffButton.addEventListener("click", async () => {
    const visitorEmail = email.value.trim();
    if (requestingHandoff) return;
    if (!visitorEmail || !email.validity.valid) { handoffStatus.textContent = "Bitte geben Sie eine gültige E-Mail-Adresse ein."; return; }
    if (!handoffConsent.checked) { handoffStatus.textContent = "Bitte stimmen Sie der Verwendung Ihrer E-Mail-Adresse für die Antwort zu."; return; }
    requestingHandoff = true; handoffButton.disabled = true; handoffStatus.textContent = "Übergabe wird gespeichert …";
    try {
      const token = await ensureSession();
      if (!pendingHandoffId) pendingHandoffId = crypto.randomUUID();
      const response = await fetch(endpoint("/api/website-chat/handoff"), { method:"POST", headers:{"content-type":"application/json","authorization":"Bearer " + token,"${WEBSITE_CHAT_INSTALLATION_HEADER}":installationId}, body:JSON.stringify({ clientHandoffId:pendingHandoffId, email:visitorEmail, consent:{ granted:true, version:consentVersion, purpose:"human_reply_by_email" } }), credentials:"omit", cache:"no-store" });
      if (response.status === 401) sessionToken = null;
      if (!response.ok) throw new Error("handoff");
      email.disabled = true; handoffConsent.disabled = true; pendingHandoffId = null; handoffStatus.textContent = "Danke. Ihre Anfrage wurde dem Team übergeben.";
    } catch { handoffStatus.textContent = "Die Übergabe konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut."; }
    finally { requestingHandoff = false; if (!email.disabled) handoffButton.disabled = false; }
  });
  (document.body || document.documentElement).appendChild(host);
})();`;
}
