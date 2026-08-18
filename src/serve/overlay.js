import { IR_SCRIPT_TYPE } from '../core/ir.js'
import {
  COMMENTS_PATH,
  DEV_RUNTIME_MARKER,
  ERROR_EVENT,
  EVENTS_PATH,
  RELOAD_EVENT,
} from './protocol.js'

/**
 * The dev-only runtime: live-reload listener plus the block-anchored comment
 * overlay (CONTRACT E1/E2, SPEC §13.1).
 *
 * **It is injected at serve time and never written to disk.** An artifact is a
 * self-contained, offline, read-only document; a comment widget baked into one
 * would POST to a server that no longer exists, and the file that a reader
 * receives would carry behaviour they never asked for. So the artifact bytes
 * on disk stay exactly what `render` produced, and the preview is the artifact
 * *plus* this script — which is also why `render`/`replay` stay byte-identical
 * while `serve` is running.
 *
 * **Anchoring reads the IR, it does not guess.** The overlay offers the block
 * list straight out of the artifact's own embedded IR, so the id that reaches
 * the log is one the artifact really contains and the human really chose. A
 * click-to-anchor overlay would have to map DOM elements back onto blocks
 * heuristically, and a heuristic that mis-anchors is worse than no anchor at
 * all: the Agent would confidently edit the wrong block. Structured picking is
 * the entire point of §13.1's「非自然語言猜謎」.
 */

/** Rendered inside the injected `<style>`; kept small and namespaced. */
const OVERLAY_CSS = `
.${DEV_RUNTIME_MARKER}{position:fixed;right:16px;bottom:16px;z-index:2147483000;
font:13px/1.6 system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#1a1a1a}
.${DEV_RUNTIME_MARKER} button{font:inherit;cursor:pointer;border:1px solid #3a3a3a;
background:#fff;color:#1a1a1a;border-radius:6px;padding:6px 12px}
.${DEV_RUNTIME_MARKER}-panel{display:none;width:320px;max-height:60vh;overflow:auto;
background:#fff;border:1px solid #3a3a3a;border-radius:8px;padding:12px;
box-shadow:0 8px 24px rgba(0,0,0,.18);margin-bottom:8px}
.${DEV_RUNTIME_MARKER}[data-open="1"] .${DEV_RUNTIME_MARKER}-panel{display:block}
.${DEV_RUNTIME_MARKER} select,.${DEV_RUNTIME_MARKER} textarea{width:100%;font:inherit;
margin:4px 0 8px;box-sizing:border-box;border:1px solid #bbb;border-radius:4px;padding:4px}
.${DEV_RUNTIME_MARKER} textarea{height:72px;resize:vertical}
.${DEV_RUNTIME_MARKER}-list{margin:8px 0 0;padding:0;list-style:none}
.${DEV_RUNTIME_MARKER}-list li{border-top:1px solid #eee;padding:6px 0}
.${DEV_RUNTIME_MARKER}-status{color:#8a4b00;min-height:1.6em}
`.trim()

/**
 * The runtime source. Written as one string rather than a bundled module
 * because it must survive being read by a browser with no build step and no
 * network — the same constraint the artifacts themselves live under.
 */
const runtimeSource = () => `
(function () {
  var MARKER = ${JSON.stringify(DEV_RUNTIME_MARKER)};
  var EVENTS = ${JSON.stringify(EVENTS_PATH)};
  var COMMENTS = ${JSON.stringify(COMMENTS_PATH)};
  var IR_TYPE = ${JSON.stringify(IR_SCRIPT_TYPE)};
  var RELOAD = ${JSON.stringify(RELOAD_EVENT)};
  var ERRORED = ${JSON.stringify(ERROR_EVENT)};

  function readIr() {
    var el = document.querySelector('script[type="' + IR_TYPE + '"]');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function snippet(block) {
    var text = block.title || block.text || block.html || '';
    text = String(text).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
    return text.length > 28 ? text.slice(0, 28) + '…' : text;
  }

  /** Document-order walk over every nesting shape the IR uses. */
  function walk(node, out) {
    if (!node || typeof node !== 'object') return out;
    if (typeof node.id === 'string') {
      out.push({ id: node.id, type: node.type, label: snippet(node) });
    }
    var groups = [node.children, node.slides];
    for (var g = 0; g < groups.length; g += 1) {
      if (!Array.isArray(groups[g])) continue;
      for (var i = 0; i < groups[g].length; i += 1) walk(groups[g][i], out);
    }
    if (Array.isArray(node.items)) {
      for (var j = 0; j < node.items.length; j += 1) {
        var item = node.items[j];
        if (!Array.isArray(item)) continue;
        for (var k = 0; k < item.length; k += 1) walk(item[k], out);
      }
    }
    return out;
  }

  var ir = readIr();
  var blocks = ir ? walk(ir.doc, []) : [];

  var root = document.createElement('div');
  root.className = MARKER;
  root.setAttribute('data-open', '0');
  root.innerHTML =
    '<div class="' + MARKER + '-panel">' +
    '<strong>留言（錨定 block）</strong>' +
    '<select class="' + MARKER + '-block"></select>' +
    '<textarea class="' + MARKER + '-text" placeholder="這個 block 要怎麼改？"></textarea>' +
    '<button type="button" class="' + MARKER + '-send">送出</button>' +
    '<p class="' + MARKER + '-status"></p>' +
    '<ul class="' + MARKER + '-list"></ul>' +
    '</div>' +
    '<button type="button" class="' + MARKER + '-toggle">留言</button>';
  document.body.appendChild(root);

  var picker = root.querySelector('.' + MARKER + '-block');
  var textarea = root.querySelector('.' + MARKER + '-text');
  var status = root.querySelector('.' + MARKER + '-status');
  var list = root.querySelector('.' + MARKER + '-list');

  for (var b = 0; b < blocks.length; b += 1) {
    var option = document.createElement('option');
    option.value = blocks[b].id;
    option.textContent = blocks[b].id + ' · ' + blocks[b].type +
      (blocks[b].label ? ' · ' + blocks[b].label : '');
    picker.appendChild(option);
  }

  function paint(entries) {
    list.textContent = '';
    for (var i = 0; i < entries.length; i += 1) {
      var li = document.createElement('li');
      li.textContent = '[' + entries[i].status + '] ' + entries[i].id + ' → ' +
        entries[i].blockId + '：' + entries[i].text;
      list.appendChild(li);
    }
  }

  function refresh() {
    fetch(COMMENTS, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (entries) { if (Array.isArray(entries)) paint(entries); })
      .catch(function () { /* listing is a convenience; never block commenting */ });
  }

  root.querySelector('.' + MARKER + '-toggle').addEventListener('click', function () {
    root.setAttribute('data-open', root.getAttribute('data-open') === '1' ? '0' : '1');
    if (root.getAttribute('data-open') === '1') refresh();
  });

  root.querySelector('.' + MARKER + '-send').addEventListener('click', function () {
    var body = { blockId: picker.value, text: textarea.value };
    status.textContent = '送出中…';
    fetch(COMMENTS, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (out) {
        if (!out.ok) {
          var first = out.json && out.json.errors && out.json.errors[0];
          status.textContent = '失敗：' + (first ? first.code + ' ' + first.message : '未知錯誤');
          return;
        }
        status.textContent = '已記錄 ' + out.json.id;
        textarea.value = '';
        refresh();
      })
      .catch(function (e) { status.textContent = '失敗：' + e.message; });
  });

  if (typeof EventSource === 'function') {
    var source = new EventSource(EVENTS);
    source.addEventListener(RELOAD, function () { location.reload(); });
    source.addEventListener(ERRORED, function (event) {
      status.textContent = '來源渲染失敗：' + event.data;
      root.setAttribute('data-open', '1');
    });
  }
})();
`.trim()

/**
 * The full injected fragment: style, runtime, and a marker attribute so the
 * "absent from artifacts" pin has one unambiguous thing to look for.
 */
export function devRuntimeFragment() {
  return [
    `<style data-${DEV_RUNTIME_MARKER}="1">${OVERLAY_CSS}</style>`,
    `<script data-${DEV_RUNTIME_MARKER}="1">${runtimeSource()}</script>`,
  ].join('\n')
}

const BODY_CLOSE = '</body>'

/**
 * Inject the dev runtime into a rendered artifact, in memory.
 *
 * The artifact is not re-parsed and not modified anywhere else: the fragment
 * goes immediately before `</body>`, after the template's own behaviour and
 * after the IR payload, so the runtime can read the IR that is already there.
 * When there is no `</body>` (a hand-written fixture, say) the fragment is
 * appended — a preview without live reload is a bug, but a preview that throws
 * is worse.
 */
export function injectDevRuntime(html) {
  const source = String(html ?? '')
  const fragment = devRuntimeFragment()
  const index = source.lastIndexOf(BODY_CLOSE)
  if (index === -1) return `${source}\n${fragment}\n`
  return `${source.slice(0, index)}${fragment}\n${source.slice(index)}`
}

export { DEV_RUNTIME_MARKER }
