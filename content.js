(() => {
  "use strict";

  // ---- settings you can tweak -------------------------------------------
  const MIN_DELAY_MS = 1000; // earliest click after the chest appears
  const MAX_DELAY_MS = 3000; // latest click after the chest appears
  const COOLDOWN_MS = 5000; // ignore the button this long after a click
  const HEARTBEAT_MS = 10000; // backstop check + "still alive" tick
  const SHOW_BADGE = true; // default visibility on a fresh browser profile
  const TOGGLE_KEY = "KeyB"; // Alt + this key shows/hides the badge
  // -----------------------------------------------------------------------

  const PREF_KEY = "bonusCollectorBadgeHidden";

  // Match on aria-label, not the class name: Twitch's classes are generated
  // hashes (ScCoreButton-sc-ocjdkq-0) that change on every deploy.
  const SELECTOR = [
    'button[aria-label*="Bonus"]',
    'button[data-a-target="live-bonus-claim-button"]',
  ].join(",");

  let lastClick = 0;
  let claimed = 0;
  let pending = false; // a click is already scheduled; don't queue another
  let badgeVisible = true;

  const clock = () => new Date().toLocaleTimeString();

  // ---- remembered preference --------------------------------------------
  // localStorage can throw outright (private mode, blocked site data), so
  // every access is guarded and falls back to the SHOW_BADGE default.
  function readPref() {
    try {
      const v = localStorage.getItem(PREF_KEY);
      if (v === null) return null;
      return v === "1";
    } catch (e) {
      return null;
    }
  }

  function writePref(hidden) {
    try {
      localStorage.setItem(PREF_KEY, hidden ? "1" : "0");
    } catch (e) {
      /* preference just won't persist; not worth interrupting over */
    }
  }

  // ---- status badge ------------------------------------------------------
  let badge = null;
  let badgeLine = null;

  function buildBadge() {
    if (badge) return;
    badge = document.createElement("div");
    // pointer-events:none so the badge can never swallow a click meant for
    // Twitch. The close button re-enables them for itself only.
    badge.style.cssText = [
      "position:fixed",
      "bottom:12px",
      "right:12px",
      "z-index:2147483647",
      "pointer-events:none",
      "font:12px/1.45 Inter,Roobert,Helvetica,Arial,sans-serif",
      "background:rgba(14,14,16,.88)",
      "color:#efeff1",
      "border:1px solid rgba(145,71,255,.5)",
      "border-radius:6px",
      "padding:7px 10px",
      "max-width:240px",
      "box-shadow:0 2px 10px rgba(0,0,0,.45)",
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;gap:10px;margin-bottom:2px";

    const name = document.createElement("span");
    name.textContent = "Bonus collector";
    name.style.cssText = "font-weight:600;color:#bf94ff";

    const close = document.createElement("span");
    close.textContent = "×";
    close.title = "Hide — Alt+B brings it back";
    close.style.cssText = [
      "margin-left:auto",
      "pointer-events:auto", // the one clickable part of the badge
      "cursor:pointer",
      "color:#adadb8",
      "font-size:15px",
      "line-height:1",
      "padding:0 1px",
    ].join(";");
    close.addEventListener("click", () => setBadgeVisible(false));
    close.addEventListener("mouseenter", () => (close.style.color = "#efeff1"));
    close.addEventListener("mouseleave", () => (close.style.color = "#adadb8"));

    badgeLine = document.createElement("div");
    badgeLine.textContent = "starting…";

    header.append(name, close);
    badge.append(header, badgeLine);
    document.body.appendChild(badge);
  }

  function setBadgeVisible(visible) {
    badgeVisible = visible;
    if (badge) badge.style.display = visible ? "block" : "none";
    writePref(!visible);
    console.log(
      `[bonus] badge ${visible ? "shown" : "hidden"} — Alt+B toggles`
    );
  }

  function setStatus(text) {
    console.log(`[bonus] ${text}`);
    if (badgeLine) badgeLine.textContent = text;
  }

  // ---- the actual work ---------------------------------------------------
  function tryClaim() {
    if (pending) return; // already counting down to a click
    if (Date.now() - lastClick < COOLDOWN_MS) return; // just clicked one
    if (!document.querySelector(SELECTOR)) return; // no chest on screen

    pending = true;
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    setStatus(`chest spotted — clicking in ${(delay / 1000).toFixed(1)}s`);

    setTimeout(() => {
      pending = false;

      // Re-query: Twitch may have re-rendered during the wait, which would
      // leave any reference captured earlier stale and unclickable.
      const live = document.querySelector(SELECTOR);
      if (!live || !live.isConnected) {
        setStatus(`chest vanished before the click · ${clock()}`);
        return;
      }

      lastClick = Date.now();
      try {
        live.click();
      } catch (e) {
        setStatus(`click failed: ${e.message}`);
        return;
      }
      claimed += 1;
      setStatus(`claimed ×${claimed} · ${clock()}`);
    }, delay);
  }

  function heartbeat() {
    tryClaim();
    // Only overwrite the status when nothing more interesting is happening,
    // so a recent "claimed" line stays readable instead of being wiped.
    if (!pending && badgeLine && !badgeLine.textContent.startsWith("chest")) {
      const tally = claimed ? ` · ${claimed} claimed this session` : "";
      badgeLine.textContent = `watching · ${clock()}${tally}`;
    }
  }

  // ---- wiring ------------------------------------------------------------
  // Twitch mutates the DOM constantly, so coalesce bursts into one check
  // per animation frame rather than running on every single mutation.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tryClaim();
    });
  });

  // e.code rather than e.key: Alt+B emits a different character on some
  // keyboard layouts, but the physical key code is stable everywhere.
  document.addEventListener("keydown", (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === TOGGLE_KEY) {
      e.preventDefault();
      setBadgeVisible(!badgeVisible);
    }
  });

  buildBadge();
  const stored = readPref();
  setBadgeVisible(stored === null ? SHOW_BADGE : !stored);

  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(heartbeat, HEARTBEAT_MS);

  tryClaim();
  setStatus(`active on ${location.pathname} · ${clock()}`);
})();
