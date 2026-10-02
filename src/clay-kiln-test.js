// 快速验证：5 种泥料在生坯渲染上彼此可辨
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/);
if (!m) { console.error('未找到内联脚本'); process.exit(1); }
const js = m[1];

let clock = 0, rafCb = null, frameNo = 0;
const calls = [];
function makeGradient() {
  const stops = [];
  return { addColorStop(o, c) { stops.push(o + ':' + c); }, stops };
}
function makeCtx(id) {
  let path2 = [];
  const handler = {
    get(t, p) {
      if (p === 'createLinearGradient' || p === 'createRadialGradient')
        return function () { const gr = makeGradient(); calls.push({ m: p, f: frameNo, a: [...arguments], stops: gr.stops }); return gr; };
      if (typeof p === 'string') return function () {
        if (p === 'moveTo' || p === 'lineTo') path2.push([arguments[0], arguments[1]]);
        else if (p === 'fill') { calls.push({ m: p, f: frameNo, pts: path2.slice(), style: t._fs || '' }); path2 = []; }
        else calls.push({ m: p, f: frameNo });
      };
      return undefined;
    },
    set(t, p, v) { if (p === 'fillStyle') t._fs = v; return true; }
  };
  return new Proxy({}, handler);
}
const els = {};
function makeEl(id) {
  const el = {
    id, style: {}, textContent: '', title: '', className: '', _html: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (el._ev ||= {})[type] = fn; },
    getContext() { return makeCtx(id); },
    getBoundingClientRect() { return { width: 320, height: 240, top: 0, left: 0 }; },
    setPointerCapture() {}, click() {},
    querySelector(s) { return s === '.ws-prog i' ? { style: {} } : makeEl(id + ':q'); },
    querySelectorAll() { return []; },
    getAttribute() { return null; }, parentNode: null, width: 0, height: 0,
  };
  Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = v || ''; } });
  return el;
}
const sandbox = {
  console, performance: { now: () => clock },
  requestAnimationFrame(cb) { rafCb = cb; },
  setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
  addEventListener() {}, location: { hash: '' },
  navigator: {}, devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
  document: { getElementById(id) { return els[id] ||= makeEl(id); }, createElement(t) { return makeEl(t); }, head: { appendChild() {} } },
  URL: { createObjectURL() { return 'blob:x'; } }, Blob() {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: 'app.js' });

function pump(n) { for (let i = 0; i < n; i++) { clock += 16.67; frameNo++; const cb = rafCb; rafCb = null; if (cb) cb(clock); } }
function fakeTarget(a) { return { getAttribute: (k) => (k in a ? a[k] : null), parentNode: null }; }
function fp() {
  const fs2 = calls.filter(c => c.f === frameNo && c.style && String(c.style).startsWith('rgb'));
  const sig = fs2.map(c => String(c.style)).sort().join('|');
  let r = 0, g = 0, b = 0, n = 0;
  for (const c of fs2) { const mm = /rgb\((\d+),(\d+),(\d+)\)/.exec(c.style); if (mm) { r += +mm[1]; g += +mm[2]; b += +mm[3]; n++; } }
  return { sig, ar: n ? Math.round(r / n) : 0, ag: n ? Math.round(g / n) : 0, ab: n ? Math.round(b / n) : 0 };
}
const rail = els['wsRail'], body = els['wsBody'];
function clickRail(s) { rail._ev.click({ target: fakeTarget({ 'data-step': String(s) }) }); pump(4); }
function clickBody(act, v) { body._ev.click({ target: fakeTarget({ 'data-act': act, 'data-v': v }) }); pump(6); }

pump(4);
clickRail(1);   // 备泥
const CLAYS = ['coarse', 'red', 'fine', 'zisha', 'blend'];
const sigs = {};
for (const c of CLAYS) { clickBody('clay', c); sigs[c] = fp(); }
const uniq = new Set(CLAYS.map(c => sigs[c].sig));
console.log('  泥料色指纹(平均RGB):', CLAYS.map(c => c + '=' + sigs[c].ar + ',' + sigs[c].ag + ',' + sigs[c].ab).join('  '));
console.log(uniq.size === 5 ? '✅ 5 种泥料渲染可辨' : '❌ 泥料指纹有重复: ' + uniq.size + '/5');

// 窑位 / 薪柴：火焰高度（gradient 参数）与柴堆颜色（rgb 填充）随选择变化
clickRail(6);   // 烧成
function frameSig() {
  return calls.filter(c => c.f === frameNo)
    .map(c => c.m + '(' + (c.a ? c.a.map(v => typeof v === 'number' ? v.toFixed(1) : String(v)).join(',') : '') + ')'
      + (c.stops && c.stops.length ? '{' + c.stops.join(';') + '}' : '')
      + (c.style ? '[' + String(c.style) + ']' : ''))
    .sort().join('|');
}
const posSigs = {};
for (const pos of ['front', 'back', 'shade']) {
  clickBody('pos', pos); pump(4);
  posSigs[pos] = frameSig();
}
const posDiffer = new Set(Object.values(posSigs)).size === 3;
const wSigs = {};
for (const w of ['pine', 'straw']) {
  clickBody('wood', w); pump(4);
  wSigs[w] = frameSig();
}
const woodDiffer = wSigs['pine'] !== wSigs['straw'];
console.log(posDiffer ? '✅ 窑位切换画面有差异' : '❌ 窑位画面无差异');
console.log(woodDiffer ? '✅ 薪柴切换画面有差异' : '❌ 薪柴画面无差异');
process.exit(uniq.size === 5 && posDiffer && woodDiffer ? 0 : 1);
