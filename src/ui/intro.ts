const KEY = "ej.introSeen";

/** First-visit control legend + a "skip to résumé" link. Dismissable and remembered
 *  (localStorage), so returning visitors aren't nagged. Degrades to a no-op if storage
 *  is unavailable (private browsing) — it just shows every visit instead of throwing. */
export function mountIntro(resumeUrl: string): void {
  try { if (localStorage.getItem(KEY) === "1") return; } catch { /* show anyway */ }

  const card = document.createElement("section");
  card.setAttribute("aria-label", "How to explore");
  card.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:8;max-width:min(460px,92vw);" +
    "background:rgba(244,236,216,.96);border:1px solid #d8cba8;border-radius:14px;box-shadow:0 12px 34px rgba(46,42,34,.28);" +
    "padding:16px 18px;font:14px/1.55 'Iowan Old Style',Georgia,serif;color:#2e2a22";
  const title = document.createElement("strong");
  title.textContent = "Walk Gandalf through an engineer's journey.";
  const legend = document.createElement("span");
  legend.style.opacity = ".85";
  legend.textContent = "WASD / arrows to walk · Shift to run · E to recall a tale · M for the map";
  card.append(title, document.createElement("br"), legend);

  const row = document.createElement("div");
  row.style.cssText = "margin-top:13px;display:flex;gap:10px;align-items:center";

  const resume = document.createElement("a");
  resume.href = resumeUrl;
  resume.target = "_blank";
  resume.rel = "noopener";
  resume.textContent = "View résumé (PDF)";
  resume.style.cssText = "text-decoration:none;color:#fff;background:#b03a48;border-radius:999px;padding:8px 15px";

  const dismiss = document.createElement("button");
  dismiss.textContent = "Start exploring";
  dismiss.style.cssText =
    "margin-left:auto;background:none;border:1px solid #d8cba8;border-radius:999px;padding:8px 15px;cursor:pointer;font:inherit;color:#2e2a22";
  dismiss.onclick = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } card.remove(); };

  row.append(resume, dismiss);
  card.appendChild(row);
  document.body.appendChild(card);
}
