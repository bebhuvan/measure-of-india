// src/pwa/app.js, on every page (src/layouts/Base.astro): registers the service worker
// (src/pwa/sw.js) and makes a quiet offer to install, one line in the footer, shown at most once a
// quarter after "Not now", never in the installed app itself.
(() => {
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  const box = document.querySelector(".sitefoot .install");
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;
  let quiet = false; try { quiet = Date.now() - (+localStorage.getItem("moi-install-later") || 0) < 7776e6; } catch {}
  if (!box || standalone || quiet) return;
  const say = (t, offer) => { box.querySelector("span").textContent = t; box.querySelector("[data-act=install]").hidden = !offer; box.hidden = false; };
  let ask = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); ask = e; say("Read this site as an app, with the pages you open kept for offline reading.", true); });
  if (/iP(hone|ad|od)/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent))
    say("To keep this site as an app, tap Share, then Add to Home Screen.", false);
  box.addEventListener("click", async (e) => {
    const act = e.target.closest("button")?.dataset.act; if (!act) return;
    if (act === "install" && ask) { ask.prompt(); await ask.userChoice.catch(() => {}); ask = null; }
    if (act === "later") try { localStorage.setItem("moi-install-later", String(Date.now())); } catch {}
    box.hidden = true;
  });
  window.addEventListener("appinstalled", () => { box.hidden = true; });
})();
