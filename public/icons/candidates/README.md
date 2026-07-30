# Icon candidates — NOT wired into the manifest

`ss-mark-b2.svg` is a **candidate** SS mark for the app icon, drafted July 30 2026
after Bailey said *"I gotta get on that icon asap"*. It is deliberately NOT
referenced by `src/app/manifest.ts` or `apple-touch-icon.png`.

**Bailey holds approval.** The SS reconstruction is marked not-approved and a prior
session was told to stop guessing at it. Do not ship this as the icon without her
explicit sign-off.

## Why this one

Three directions were drafted, rendered, and **looked at** at 512/180/40/32px —
not judged from source. That discipline exists because `f7e4d23` and `4c57f78` both
"fixed" the mark without checking the rendered result.

- **A, stacked ribbon** (Bailey's figure-eight rotated vertical): REJECTED. The two
  S's fused into an unreadable blob at every size — the same swallowing failure
  `4c57f78` recorded.
- **C, mirrored pair**: REJECTED. Reads as a butterfly, not "SS". A mirrored S is a
  reversed letter.
- **B2, twin S sharing an overlap + base rule**: the only one that still reads as
  "SS" at 40px and at 32px.

## Why Bailey's Canva draft can't be the icon as-drawn

Her mark (two S's as a continuous calligraphic ribbon) is a good idea and should
become the **logo/wordmark**. It fails as an *icon* because hairline tapers vanish
below ~60px, the interior counters collapse, and a figure-eight is horizontal while
an icon is square (letterboxing loses ~40% of usable area). Two deliverables from
one family is standard practice, not a compromise.

## Constraints any replacement must meet

- Pure path geometry. **No `<text>`** — the old `icon-512.svg` depended on Georgia
  being installed.
- Explicit `width`/`height` **and** `viewBox` (`f7e4d23`: an SVG with no intrinsic
  size renders nothing in an `<img>`).
- Legible at **32px**. Render it and look before shipping.
- iOS ignores the manifest for home-screen icons and **cannot use SVG** — ship PNG
  (180/192/512 + maskable). See `f70d937`.
