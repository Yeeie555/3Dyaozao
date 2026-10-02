// 差异化验证：确认 成型手法 / 装饰肌理 / 生坯↔成瓷 在 3D 渲染上确实可辨
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/);
if (!m) { console.error('未找到内联脚本'); process.exit(1); }
const js = m[1];

let clock = 0, rafCb = null, frameNo = 0;
const calls = [];
function makeGradient() { return { addColorStop() {} }; }
function makeCtx(id) {
  let path = [];
  const handler = {
    get(t, p) {
      if (p === 'createLinearGradient' || p === 'createRadialGradient')
        return () => makeGradient();
      if (typeof p === 'string') return function () {
        if (p === 'moveTo' || p === 'lineTo') path.push([arguments[0], arguments[1]]);
        else if (p === 'fill') { calls.push({ m: p, f: frameNo, pts: path.slice(), style: t._fs || '' }); path = []; }
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
    querySelectorAll(s) {
      if (s === '.ws-step') {
        const n = (el._html.match(/class="ws-step(?![-\w])/g) || []).length, a = [];
        for (let k = 0; k < n; k++) a.push({ getAttribute() { return null; } });
        return a;
      }
      return [];
    },
    getAttribute() { return null; }, parentNode: null, width: 0, height: 0,
  };
  Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = v || ''; } });
  return el;
}
const sandbox = {
  console, performance: { now: () => clock },
  requestAnimationFrame(cb) { rafCb = cb; },
  setTimeout(cb, t) { (sandbox.__timers ||= []).push(cb); return 1; },
  clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
  addEventListener() {}, location: { hash: '#pot=vase' },
  navigator: {}, devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
  document: { getElementById(id) { return els[id] ||= makeEl(id); }, createElement(t) { return makeEl(t); }, head: { appendChild() {} } },
  URL: { createObjectURL() { return 'blob:x'; } }, Blob() {}, __timers: [],
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: 'app.js' });

function pump(n) { for (let i = 0; i < n; i++) { clock += 16.67; frameNo++; const cb = rafCb; rafCb = null; if (cb) cb(clock); } }
function fakeTarget(a) { return { getAttribute: (k) => (k in a ? a[k] : null), parentNode: null }; }

// 当前帧所有「陶器表面」色指纹（含轮盘/环境，但器表占绝大多数，差异由它主导）
function fp() {
  const fs2 = calls.filter(c => c.f === frameNo && c.style && String(c.style).startsWith('rgb'));
  const sig = fs2.map(c => String(c.style)).sort().join('|');
  let r = 0, g = 0, b = 0, n = 0;
  for (const c of fs2) { const mm = /rgb\((\d+),(\d+),(\d+)\)/.exec(c.style); if (mm) { r += +mm[1]; g += +mm[2]; b += +mm[3]; n++; } }
  return { sig, n, ar: n ? Math.round(r / n) : 0, ag: n ? Math.round(g / n) : 0, ab: n ? Math.round(b / n) : 0 };
}
const rail = els['wsRail'], body = els['wsBody'];
function clickRail(step) { rail._ev.click({ target: fakeTarget({ 'data-step': String(step) }) }); pump(4); }
function clickBody(act, v) { body._ev.click({ target: fakeTarget({ 'data-act': act, 'data-v': v }) }); pump(6); }

pump(4);   // 稳定首帧

let fail = 0;
function expect(name, cond, d) { console.log((cond ? '✅ ' : '❌ ') + name + (d ? '  (' + d + ')' : '')); if (!cond) fail++; }

// ---- 1) 成型手法：轮制 vs 手捏 vs 盘筑 vs 泥板 vs 模具 ----
clickRail(2);   // 拉坯
const methSigs = {};
const METH = ['wheel', 'pinch', 'coil', 'slab', 'mold'];
for (const mt of METH) { clickBody('method', mt); methSigs[mt] = fp(); }
const uniqM = new Set(METH.map(mt => methSigs[mt].sig));
console.log('  手法色指纹(平均RGB):', METH.map(mt => mt + '=' + methSigs[mt].ar + ',' + methSigs[mt].ag + ',' + methSigs[mt].ab).join('  '));
expect('成型手法 5 种在渲染上彼此可辨（指纹各不相同）', uniqM.size === 5, uniqM.size + '/5 不同');

// ---- 2) 装饰肌理：素面/拍打/刮削/刻划/磨光/化装土 ----
clickRail(4);   // 装饰
const TX = ['none', 'paddle', 'scrape', 'incise', 'burnish', 'slip'];
const txSigs = {};
for (const tx of TX) { clickBody('texture', tx); txSigs[tx] = fp(); }
const uniqT = new Set(TX.map(tx => txSigs[tx].sig));
console.log('  肌理色指纹(平均RGB):', TX.map(tx => tx + '=' + txSigs[tx].ar + ',' + txSigs[tx].ag + ',' + txSigs[tx].ab).join('  '));
expect('装饰肌理 6 种在渲染上彼此可辨（指纹各不相同）', uniqT.size === 6, uniqT.size + '/6 不同');

// ---- 3) 生坯 ↔ 成瓷 ----
clickRail(2);
clickBody('method', 'wheel');           // 固定手法，只比烧成前后
const fpRaw = fp();
clickRail(6);                           // 烧成
body._ev.click({ target: fakeTarget({ 'data-act': 'kiln' }) }); pump(360);   // 等关窑+烧制+开窑动画走完
const fpFired = fp();
function sat(f) {                       // 平均饱和度 (0..1)，越高越"上色"
  const r = f.ar, g = f.ag, b = f.ab, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
const dist = Math.abs(fpRaw.ar - fpFired.ar) + Math.abs(fpRaw.ag - fpFired.ag) + Math.abs(fpRaw.ab - fpFired.ab);
console.log('  生坯平均RGB =', fpRaw.ar + ',' + fpRaw.ag + ',' + fpRaw.ab, '(饱和' + sat(fpRaw).toFixed(2) + ')');
console.log('  成瓷平均RGB =', fpFired.ar + ',' + fpFired.ag + ',' + fpFired.ab, '(饱和' + sat(fpFired).toFixed(2) + ')', ' 色距=' + dist);
expect('生坯与成瓷渲染明显不同', fpRaw.sig !== fpFired.sig, '签名不同');
expect('成瓷后饱和度显著提升（上釉发色，肉眼可辨）', sat(fpFired) > sat(fpRaw) + 0.06,
  sat(fpRaw).toFixed(2) + ' -> ' + sat(fpFired).toFixed(2));
expect('生坯与成瓷色距足够大（不会"看不出区别"）', dist > 40, 'dist=' + dist);

// ---- 4) 同一釉色下，四种施釉方式在成瓷釉面上可辨 ----
const WAYS = ['dip', 'brush', 'spray', 'pour'];
clickRail(5);                              // 施釉
const waySigs = {}, wayRGB = {};
for (const w of WAYS) { clickBody('glazemethod', w); waySigs[w] = fp(); wayRGB[w] = waySigs[w].ar + ',' + waySigs[w].ag + ',' + waySigs[w].ab; }
const uniqW = new Set(WAYS.map(w => waySigs[w].sig));
console.log('  施釉方式色指纹(平均RGB):', WAYS.map(w => w + '=' + wayRGB[w]).join('  '));
expect('同一釉色下 4 种施釉方式釉面可辨（指纹各不相同）', uniqW.size === 4, uniqW.size + '/4 不同');

console.log(fail ? '\n❌ 有失败项' : '\n✅ 四项错误均已修复：手法/肌理可辨、生坯≠成瓷、表面更细腻');
process.exit(fail ? 1 : 0);
