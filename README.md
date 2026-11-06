# Twitch Bonus Collector

A Chrome extension that claims the Twitch channel points bonus chest the moment
it appears, after a short randomised delay.

No permissions. No data collection. No network requests. Roughly 150 lines.

## Install

1. Download or clone this repository
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select this folder
5. Reload any open Twitch tab

A small badge appears in the bottom-right corner showing what the collector is
doing. Press **Alt+B** or click the **×** to hide it; the choice is remembered.

## Settings

All tunables sit in one block at the top of `content.js`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `MIN_DELAY_MS` | `1000` | Earliest click after the chest appears |
| `MAX_DELAY_MS` | `3000` | Latest click after the chest appears |
| `COOLDOWN_MS` | `5000` | Ignore the button this long after a click |
| `HEARTBEAT_MS` | `10000` | Backstop check interval |
| `SHOW_BADGE` | `true` | Default badge visibility |
| `TOGGLE_KEY` | `"KeyB"` | Alt + this key toggles the badge |

Keep `COOLDOWN_MS` comfortably above `MAX_DELAY_MS`. The cooldown is measured
from the click, so a 3s maximum delay against a 5s cooldown leaves only 2s of
real protection against a double-fire.

## How it works

**Event-driven, not polled.** A `MutationObserver` watches the DOM and reacts
within a frame of the chest rendering. An earlier version polled every 120
seconds and missed roughly half of them, since the chest only stays up for
about a minute.

**Throttled to one check per animation frame.** Twitch rebuilds large parts of
the DOM constantly, so an unthrottled observer callback fires thousands of
times a second. The first mutation of a burst schedules a check via
`requestAnimationFrame`; the rest return immediately. A thousand mutations
collapse into one `querySelector`.

**Selectors chosen for durability.** The button is matched on
`aria-label*="Bonus"`, not on its class. Twitch's classes are generated hashes
(`ScCoreButton-sc-ocjdkq-0`) that change on every deploy, so a class-based
selector works today and silently dies next week. Accessibility metadata is far
more stable. The older `data-a-target` form is kept as a fallback.

**Stale references are re-queried.** Twitch can re-render during the 1-3 second
delay, which would leave a previously captured handle pointing at a detached
node - the click would succeed silently and do nothing. The button is looked up
again immediately before clicking, and `isConnected` is checked.

**Defensive storage.** `localStorage` throws outright, rather than returning
null, when site data is blocked or in a private window. Every access is guarded
so a throw can't kill the script before the observer attaches.

## Limitations

- Twitch is a single-page app, so the startup log shows whichever channel you
  first landed on. The observer is attached to `document.body` and survives
  channel changes, so this is cosmetic.
- Only matches `https://www.twitch.tv/*`.
- English UI assumed - the selector looks for "Bonus" in the `aria-label`.

## Licence

MIT. See [LICENSE](LICENSE).
