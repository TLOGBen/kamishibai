# CONTRACT — S3b: diagram block v1 + export chains (pdf/pptx) + snapshot
> STATUS: sealed（2026-08-18）— five points compliant: D1–D7 pass first-hand, cross-UI pinned at rejection strength, Verbatim 6/6 zero drift, probes 1/2 caught (five ride-along coverage notes, none blocking)

## Goal
The IR's `diagram` block becomes renderable: a structured node-and-edge spec turns into
deterministic, offline SVG through the template pipeline. Artifacts gain an export path
(document → PDF, deck → PPTX) and a `snapshot` command (artifact → PNG) so an agent can
*see* what it rendered. Existing 112 tests stay green.

## Premises
- P1 `verified`: base = S3a sealed (commit ee882ee); two-layer template guard (vocabulary +
  root form) is live — `diagram` enters via `manifest.blocks` declarations.
- P2 `verified`: SPEC §3 lists `diagram` as a v1 core type carried by structured spec;
  the 18 legacy diagram-type taxonomy is a SPEC nicety, NOT a victory predicate (auditor
  ruling) — v1 ships exactly ONE type: directed node/edge graph ("architecture/flow").
- P3 `verified`: Playwright browser binaries land in `~/.cache/ms-playwright` — outside git
  AND outside KAMISHIBAI_HOME. They are a disposable cache, never a protected asset;
  recovery for this slice = git revert + that cache may be freely deleted or re-fetched.
- P4 `verified`: sidecar atomic-write hardening (tmp+rename) rides along — this slice
  touches the store when archiving exports/snapshots.

## Assertable criteria
G2 traps promoted: SVG determinism vs layout randomness → D1; export needs a real browser →
D4 gates it; store writes → D6.
- [ ] D1 `diagram` block `{type:"diagram", kind:"graph", nodes:[{id,label}...], edges:[{from,to,label?}...]}`
      renders to inline SVG: every node id appears exactly once as a drawn node, every edge as a
      drawn connector; layout is DETERMINISTIC (same input → byte-identical SVG under fixed
      KAMISHIBAI_BUILD_TIME); no external refs inside the SVG; lint exit 0.
- [ ] D2 Unknown `kind` or a dangling edge endpoint → exit 1 with a `KSB_` code and the block path
      (never a silently empty SVG). Markdown superset gains a ```diagram fence (JSON or YAML body —
      pick one, pin it) that parses into the block; `example diagram` round-trips.
- [ ] D3 `export <artifact> --to pdf` (document artifacts) and `--to pptx` (deck artifacts) produce
      the file; wrong pairing → exit 1 `KSB_` usage-class code. PPTX: one slide per `<section
      class="slide">`, slide count equals the deck's. PDF: non-zero pages, file opens (magic-bytes
      check suffices as the pin).
- [ ] D4 Browser dependency is honest: when the Playwright browser is absent, `export`/`snapshot`
      exit 1 with a `KSB_` code whose message names the exact setup command; `setup` installs it.
      Tests that need the browser install it once in CI-safe fashion (or skip with a LOUD reason
      pinned as a test-level assertion — absence must never fake green).
- [ ] D5 `snapshot <artifact> -o out.png` renders a PNG (non-zero dimensions, PNG magic bytes);
      deck artifacts snapshot slide 1 by default, `--slide N` selects.
- [ ] D6 Store writes introduced by this slice (archived exports/snapshots, if archived) use the
      wx/merge discipline; sidecar writes become atomic (tmp+rename) — the S2 ride-along lands here.
- [ ] D7 Regression: all 112 existing tests green; layering intact (export/snapshot machinery in
      delivery/ or a new export/ layer, cli stays vue-free, files ≤800 lines); `--json` on all new
      commands (single JSON object, stable exit classes).

## Can't-miss surfaces
| Surface | Format | Pinning test |
|---|---|---|
| diagram SVG | node count ≡ nodes[], edge count ≡ edges[], deterministic bytes | test_diagram_svg_deterministic |
| export --json | `{"ok":true,"artifact":"<abs>","format":"pdf"|"pptx"}` exactly these keys | test_export_json_shape |
| snapshot --json | `{"ok":true,"artifact":"<abs>","width":<int>,"height":<int>}` | test_snapshot_json_shape |
| missing-browser error | single JSON, `KSB_` code, message contains the setup command verbatim | test_export_requires_browser |
| ```diagram fence | invalid body → exit 1 with block path | test_diagram_fence_invalid |

## Verbatim Constants
```
diagram IR fields:   type:"diagram", kind:"graph", nodes[{id,label}], edges[{from,to,label?}]
fence tag:           diagram
export formats:      pdf (document root) / pptx (deck root)
new KSB codes:       KSB_DIAGRAM_INVALID, KSB_EXPORT_FORMAT_MISMATCH, KSB_BROWSER_MISSING
                     (final names may vary only by suffix; prefix KSB_ fixed)
browser cache:       ~/.cache/ms-playwright  (disposable; never a protected asset)
snapshot defaults:   deck → slide 1; --slide N to select
```
