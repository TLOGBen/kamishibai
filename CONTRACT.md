# CONTRACT — S5: serve/reload + comment loop + template namespace (VC2) + delivery polish
> STATUS: sealed（2026-08-18）— five points compliant: E1–E7 pass first-hand (F1 anchor-drift fixed under the living-canonical ruling, red-capable both directions), Verbatim zero drift, cross-UI pinned on real paths, S4 bundled verification passed (two ride-along pin notes, none blocking)

## Goal
The SDK's delivery layer completes: a live preview server with auto-reload, the block-anchored
comment loop (human leaves comments on a served artifact; an agent reads them as data), and the
central store gains a template namespace holding a minimal Kami template package with a TOML
manifest — the capability victory criterion VC2 requires. Existing 148 tests stay green.

## Premises
- P1 `verified`: base = S3b sealed (commit f921399); store, list/open/replay, export machinery live.
- P2 `verified` (auditor correction, sixth consolidation): VC2's producing capability belongs to
  THIS slice — template namespace + minimal `.toml` manifest; full template authoring (init/fork/
  import) remains post-campaign S7.
- P3 `verified` (proportionality ruling): v0.1 `serve` is file-watch + auto-reload (SSE), NOT full
  Vite HMR — a dev-preview need does not justify a bundler integration; the deviation from SPEC
  §10's long-term wording is recorded here deliberately.
- P4 `verified`: comment anchoring rides on block ids already present in the IR (S1 A2).

## Assertable criteria
G2 traps promoted: a serve daemon must not outlive its session unnoticed → E1's close/pid contract;
comments are DATA, never edits → E2 write-path is append-only JSONL.
- [ ] E1 `serve <input> [--port N]` starts a local server (deterministic port when given; prints the
      URL), renders on start, re-renders and pushes a reload event (SSE) when the source file
      changes; `close` terminates it via a pidfile under `<KAMISHIBAI_HOME>/run/` and exits 0 even
      when nothing runs (idempotent); **the session canonical is a living document (seal patch F1):
      each successful re-render atomically refreshes the archived copy this session itself created —
      live IR and canonical IR can never drift; pre-existing store artifacts remain untouchable**. Server never touches files outside KAMISHIBAI_HOME + the
      declared output. Tests drive a real server on an ephemeral port (curl the URL, touch the
      source, observe a reload event) with explicit timeouts.
- [ ] E2 Comment loop: the served page carries a dev-only overlay (never present in exported/
      rendered artifacts — pinned) that POSTs {blockId, text} to the server; the server appends
      {id, blockId, text, ts, status:"open"} to `<canonical artifact>.comments.jsonl` (atomic
      append discipline). `comments <artifact> --json` lists entries; `comments resolve <artifact>
      <id>` flips status to "resolved" (append-a-resolution, never rewrite history). Block ids in
      comments must exist in the artifact's IR — unknown id → exit 1 KSB_ code.
- [ ] E3 Template namespace (VC2): `<KAMISHIBAI_HOME>/templates/<ns>/<name>/` holds a package =
      `manifest.toml` (name, namespace, version, engine, root, blocks — mirroring the JS manifest
      byte-consistently) + the template identifier resolvable by render `-t`. `setup` (or first
      touch) registers the built-in `kami/long-form` and `kami/slides` packages; `templates --json`
      lists them. Probe surface for VC2: the manifest.toml exists and parses.
- [ ] E4 `debug --json`: single JSON object reporting store root, template count, browser status,
      engine version; human path via the shared formatter.
- [ ] E5 List human path pinned (F10 closure): createdAt, generator, and every copies line asserted
      on the real CLI path; empty-project string pinned verbatim `（此專案尚無產物）`.
- [ ] E6 open-chain unit tests (F9 closure): via the injectable runner — chain order honoured,
      first success returns, all-fail → KSB_OPEN_FAILED naming every tried launcher.
- [ ] E7 Regression: 148 existing tests green; S4 corpus (proofread/journal fixtures) renders and
      lints clean — its bundled verification happens in this slice's seal round; layering, ≤800
      lines, --json/exit conventions, formatter single-source all hold.

## Can't-miss surfaces
| Surface | Format | Pinning test |
|---|---|---|
| serve stdout | URL line contains `http://127.0.0.1:<port>/`; `--json` `{"ok":true,"url":…,"pid":<int>}` | test_serve_json_shape |
| reload event | SSE event received after source touch | test_serve_reload_on_change |
| comments --json | array of `{id,blockId,text,ts,status}` exactly | test_comments_json_shape |
| exported artifact | contains NO comment-overlay script (dev-only) | test_overlay_absent_from_artifacts |
| templates --json | array of `{namespace,name,version,root}`; both built-ins present after setup | test_templates_json_shape |
| manifest.toml | parses; fields byte-consistent with the JS manifest | test_template_manifest_toml |

## Verbatim Constants
```
comments sidecar:    <canonical>.comments.jsonl   (append-only; status: open|resolved)
comment fields:      id, blockId, text, ts, status
templates layout:    templates/<namespace>/<name>/manifest.toml
manifest.toml keys:  name, namespace, version, engine, root, blocks
run dir / pidfile:   <KAMISHIBAI_HOME>/run/serve.pid
new KSB codes:       KSB_BLOCK_NOT_FOUND, KSB_SERVE_* (prefix fixed; suffixes yours)
carried from S3b:    KSB_EXPORT_FAILED joins the Verbatim register (seal ride-along)
criteria patch:      format-mismatch = exit 1 KSB_EXPORT_FORMAT_MISMATCH (validation class);
                     unknown --to value = exit 2 KSB_USAGE (D3 wording corrected)
empty-project line:  （此專案尚無產物）
```
