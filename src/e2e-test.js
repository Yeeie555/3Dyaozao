// 端到端桩环境测试：驱动真实页面脚本，断言演示模式完成塑形
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/);
if (!m) { console.error('未找到内联脚本'); process.exit(1); }
const js = m[1];

let clock = 0;
let rafCb = null;
const calls = [];          // 记录主画布 2D 调用
const hud = {};            // 记录 HUD 状态

function makeGradient() { return { addColorStop() {} }; }

function makeCtx(id) {
  const rec = id === 'clay';
  let path = [];
  const handler = {
    get(target, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return function () { if (rec) calls.push({ m: prop, a: [...arguments], f: frameNo }); return makeGradient(); };
      }
      if (typeof prop === 'string') {
        return function () {
          if (!rec) return;
          if (prop === 'moveTo' || prop === 'lineTo') path.push([arguments[0], arguments[1]]);
          else if (prop === 'fill') { calls.push({ m: prop, a: [...arguments], f: frameNo, pts: path.slice(), style: target._fs || '' }); path = []; }
          else calls.push({ m: prop, a: [...arguments], f: frameNo });
        };
      }
      return undefined;
    },
    set(t, p, v) { if (rec && p === 'fillStyle') t._fs = v; return true; }
  };
  return new Proxy({}, handler);
}

let frameNo = 0;
const els = {};
function makeEl(id) {
  const el = {
    id, style: {}, textContent: '', title: '', disabled: false, className: '',
    _html: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (el._ev ||= {})[type] = fn; },
    getContext(type) { return makeCtx(id); },
    getBoundingClientRect() { return { width: 320, height: 240, top: 0, left: 0 }; },
    setPointerCapture() {},
    click() {},
    querySelector(sel) {
      if (sel === '.ws-prog i') return { style: {} };
      return makeEl(id + ':q');
    },
    querySelectorAll(sel) {
      if (sel === '.ws-step') {
        var n = (el._html.match(/class="ws-step(?![-\w])/g) || []).length;
        var arr = [];
        for (var k = 0; k < n; k++) arr.push({ getAttribute() { return null; } });
        return arr;
      }
      return [];
    },
    getAttribute() { return null; },
    parentNode: null,
    width: 0, height: 0,
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) { el._html = v || ''; }
  });
  // HUD 记录
  if (['mH', 'mW', 'mWk', 'vesselName', 'gestureText', 'handCount',
    'hueName', 'clayName', 'wsStage'].includes(id)) {
    Object.defineProperty(el.style, 'width', {
      set(v) { hud[id] = v; }, get() { return hud[id] || ''; }
    });
    let _t = '';
    Object.defineProperty(el, 'textContent', { set(v) { _t = v; hud[id] = v; }, get() { return _t; } });
  }
  return el;
}

const sandbox = {
  console,
  performance: { now: () => clock },
  requestAnimationFrame(cb) { rafCb = cb; },
  setTimeout(cb, t) { sandbox.__timers.push({ cb, at: clock + t }); return sandbox.__timers.length; },
  clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
  addEventListener() {},
  location: { hash: '#demo' },
  navigator: {},
  devicePixelRatio: 1,
  innerWidth: 1440, innerHeight: 900,
  document: {
    getElementById(id) { return els[id] ||= makeEl(id); },
    createElement(tag) { return makeEl(tag); },
    head: { appendChild() {} },
  },
  URL: { createObjectURL() { return 'blob:x'; } },
  Blob: function () {},
  __timers: [],
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: 'app.js' });

function pump(frames) {
  for (let i = 0; i < frames; i++) {
    clock += 16.67;
    frameNo++;
    const cb = rafCb; rafCb = null;
    if (cb) cb(clock);
  }
}

const t0 = clock;
// 与 app.js 的 demoInput 时间轴保持一致（练泥→开窝→拉坯→塑形→修坯→装饰）
const marks = [
  [0.8, '待机结束'],
  [2.8, '揉泥结束'],
  [4.8, '开窝结束'],
  [10.1, '提拉结束'],
  [12.2, '收颈结束'],
  [15.4, '鼓腹结束'],
  [19.0, '修坯结束'],
  [21.7, '抹光结束'],
  [22.0, '演示完成'],
  [25.2, '提示结束'],
];
let prev = t0 / 1000;
const gtexts = [], hcounts = [];
for (const [t, name] of marks) {
  pump(Math.round((t - prev) * 60));
  prev = t;
  gtexts.push(hud.gestureText);
  hcounts.push(hud.handCount);
  console.log(name.padEnd(5), ' 高度条 =', String(hud.mH).padStart(6), ' 最宽条 =', String(hud.mW).padStart(6),
    ' 成形度 =', String(hud.mWk).padStart(6), ' 器型 =', hud.vesselName,
    ' 手势行 =', hud.gestureText, ' 手数行 =', hud.handCount);
}

console.log('--- 最终 ---');
console.log('动作 =', hud.gestureText);
console.log('器型 =', hud.vesselName);
console.log('高度 =', hud.mH, ' 最宽 =', hud.mW, ' 成形度 =', hud.mWk);

// ---- 3D 渲染断言：末帧面数、场景包围盒、拖动转视角真实生效 ----
const lastF = frameNo;
const lastFrameCalls = calls.filter(c => c.f === lastF);
const quads = lastFrameCalls.filter(c => c.m === 'fill' && c.pts && c.pts.length >= 3);
console.log('末帧 2D 调用数 =', lastFrameCalls.length, '，其中填充面 =', quads.length);

function sceneBbox(frame) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
  for (const c of calls) {
    if (c.f !== frame || c.m !== 'fill' || !c.pts || c.pts.length < 3) continue;
    for (const p of c.pts) {
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
    n++;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, n };
}
const bb0 = sceneBbox(lastF);
console.log('场景 bbox = [' + bb0.x0.toFixed(0) + ',' + bb0.y0.toFixed(0) + ' ~ ' + bb0.x1.toFixed(0) + ',' + bb0.y1.toFixed(0) + ']',
  '宽 =', bb0.w.toFixed(0), '高 =', bb0.h.toFixed(0));

let fail = 0;
function expect(name, cond, detail) {
  console.log((cond ? '✅ ' : '❌ ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) fail++;
}
expect('演示过程中摄影区第二行实时显示手势+作用（含“：”）', gtexts.some(s => /：/.test(s || '')), gtexts.filter(Boolean).slice(0, 3).join(' | '));
expect('摄影区第一行正确报告手数（单手/双手/未检测）', hcounts.some(s => /单手|双手|未检测/.test(s || '')), hcounts.filter(Boolean).slice(0, 3).join(' | '));
expect('演示完成后动作标签更新', /演示完成|等待手部动作/.test(hud.gestureText || ''), hud.gestureText);
expect('高度显著增加（>55%）', parseFloat(hud.mH) > 55, hud.mH);
expect('成形度增长（>20%）', parseFloat(hud.mWk) > 20, hud.mWk);
expect('器型已被识别命名', hud.vesselName && hud.vesselName !== '器坯', hud.vesselName);
expect('3D 场景被绘制（末帧 400~4500 个面）', quads.length > 400 && quads.length < 4500, quads.length + ' 个面');

// ---- 拖动转视角：pointer 事件 -> 相机 -> 投影包围盒变化 ----
const cvEl = els['clay'];
const evh = cvEl && cvEl._ev;
if (evh && evh.pointerdown && evh.pointermove && evh.pointerup) {
  pump(3);
  const before = sceneBbox(frameNo);
  evh.pointerdown({ clientX: 700, clientY: 300, pointerId: 1, shiftKey: false });
  evh.pointermove({ clientX: 700, clientY: 300, shiftKey: false });
  evh.pointermove({ clientX: 700, clientY: 300, shiftKey: false });
  evh.pointermove({ clientX: 700, clientY: 300, shiftKey: false });
  evh.pointermove({ clientX: 700, clientY: 560, shiftKey: false });   // 向下拖 260px -> 抬高俯视角
  evh.pointermove({ clientX: 700, clientY: 560, shiftKey: false });
  evh.pointerup({ pointerId: 1 });
  pump(50);                                                            // 相机缓动到位
  const after = sceneBbox(frameNo);
  console.log('拖动前 bbox =', before.w.toFixed(0) + '×' + before.h.toFixed(0),
    ' 拖动后 =', after.w.toFixed(0) + '×' + after.h.toFixed(0), '（俯视时轮盘投影变宽）');
  expect('拖动画面改变视角（俯仰生效）',
    Math.abs(after.w - before.w) > 12 || Math.abs(after.h - before.h) > 12,
    before.w.toFixed(0) + '×' + before.h.toFixed(0) + ' -> ' + after.w.toFixed(0) + '×' + after.h.toFixed(0));

  // Shift+拖动 = 塑形
  evh.pointerdown({ clientX: 700, clientY: 400, pointerId: 1, shiftKey: true });
  evh.pointermove({ clientX: 700, clientY: 460, shiftKey: true });
  evh.pointermove({ clientX: 700, clientY: 460, shiftKey: true });
  evh.pointerup({ pointerId: 1 });
  pump(3);
  console.log('Shift+拖动后 动作 =', hud.gestureText, ' 高度条 =', hud.mH);
} else {
  expect('鼠标事件已绑定（拖动转视角）', false, '缺少 pointer 事件句柄');
}

// ---- 工艺工坊：流程步骤导航 + 各步骤参数面板渲染不报错 ----
const wsRailEl = els['wsRail'], wsBodyEl = els['wsBody'];
const STEPS = ['立意', '备泥', '拉坯', '修坯', '装饰', '施釉', '烧成', '成器'];
let railOk = true, railErr = '';
function fakeTarget(attrs) {
  return { getAttribute: (k) => (k in attrs ? attrs[k] : null), parentNode: null };
}
// 先确认导航条渲染出 8 个步骤
const railSteps = wsRailEl ? wsRailEl.querySelectorAll('.ws-step') : [];
expect('流程导航渲染出 8 个步骤', railSteps.length === 8, railSteps.length + ' 步');

// 逐个点击步骤，确认 wsStage 标题与面板均不报错
if (wsRailEl && wsRailEl._ev && wsRailEl._ev.click) {
  for (let s = 0; s < 8; s++) {
    try {
      wsRailEl._ev.click({ target: fakeTarget({ 'data-step': String(s) }) });
      pump(3);
      const stageTxt = hud.wsStage || '';
      if (stageTxt !== STEPS[s]) { railOk = false; railErr = '步骤' + s + ' 标题=' + stageTxt; }
      if (!(wsBodyEl && wsBodyEl.innerHTML && wsBodyEl.innerHTML.length > 20)) { railOk = false; railErr = '步骤' + s + ' 面板为空'; }
    } catch (e) { railOk = false; railErr = '步骤' + s + ': ' + e.message; }
  }
}
expect('8 个步骤均可切换且标题正确、面板非空', railOk, railErr);

// 中部步骤：底部应为“上一步 / 下一步”同行双按钮；标题“第N/8步 X”（无中间小圆点）
(function () {
  try {
    wsRailEl._ev.click({ target: fakeTarget({ 'data-step': '5' }) }); pump(3); // 施釉(索引5)
    const html = wsBodyEl.innerHTML || '';
    expect('中部步骤底部有“上一步”按钮', /data-act="prev"/.test(html), 'prev' + (/data-act="prev"/.test(html)));
    expect('中部步骤底部有“下一步”按钮', /data-act="next"/.test(html), 'next' + (/data-act="next"/.test(html)));
    expect('上一步/下一步在同一行(ws-nav)', /class="ws-nav"/.test(html) && html.indexOf('ws-prev') >= 0 && html.indexOf('ws-next') >= 0, 'same-row');
    const navBtns = (html.match(/<button[^>]*ws-(?:prev|next)[^>]*>[^<]*/g) || []).join('|');
    expect('底部按键无箭头符号', !/[←→]/.test(navBtns), navBtns);
    const headOk = /第6\/8步 施釉/.test(html) && !/第\d+\/8步 · /.test(html);
    expect('步骤标题为“第6/8步 施釉”且无中间小圆点', headOk, (html.match(/第[^<]*/) || [''])[0]);
    wsRailEl._ev.click({ target: fakeTarget({ 'data-step': '0' }) }); pump(3); // 第一步
    expect('第一步无“上一步”按钮', !/data-act="prev"/.test(wsBodyEl.innerHTML || ''), 'no-prev');
  } catch (e) { expect('导航按钮/标题校验', false, e.message); }
})();

// 流程导航：左侧编号保持数字（不再变绿勾），只高亮当前步骤；每步一行极简简介
(function () {
  try {
    const railHtml = wsRailEl.innerHTML || '';
    expect('流程导航：编号始终为数字（无绿勾）', !/✓/.test(railHtml) && /<span class="ws-step-no">1<\/span>/.test(railHtml) && /<span class="ws-step-no">8<\/span>/.test(railHtml), 'numbers');
    const stairs = (railHtml.match(/class="ws-step-no">([^<]*)</g) || []).map(s => s.replace(/.*>/, '').replace(/<$/, ''));
    expect('流程导航：1~8 编号俱全', stairs.join(',') === '1,2,3,4,5,6,7,8', stairs.join(','));
    wsRailEl._ev.click({ target: fakeTarget({ 'data-step': '3' }) }); pump(3);
    const rh = wsRailEl.innerHTML || '';
    const onCnt = (rh.match(/class="ws-step on"/g) || []).length;
    expect('流程导航：仅当前步骤高亮（.on 唯一）', onCnt === 1 && /class="ws-step on" data-step="3"/.test(rh), 'on=' + onCnt);
    expect('流程导航：编号不因点击而改变', /<span class="ws-step-no">4<\/span>/.test(rh), 'still-4');
    const briefs = (rh.match(/<em>([^<]*)<\/em>/g) || []).map(s => s.replace(/<\/?em>/g, ''));
    const allShort = briefs.length === 8 && briefs.every(b => b.length > 0 && b.length <= 12 && !/[…\.]{3}/.test(b));
    expect('流程导航：每步一句极简简介（≤12字、无省略号）', allShort, briefs.join(' | '));
  } catch (e) { expect('流程导航校验', false, e.message); }
})();

// ---- 各步骤文案细调回归 ----
(function () {
  const CLICK = (s) => { wsRailEl._ev.click({ target: fakeTarget({ 'data-step': String(s) }) }); pump(3); };
  try {
    CLICK(0);
    let html = wsBodyEl.innerHTML || '';
    expect('立意：已去掉“先想清楚…”一句', !/先想清楚/.test(html), 'idea');

    CLICK(1);
    html = wsBodyEl.innerHTML || '';
    const iNote = html.indexOf('含铁量决定'), iSel = html.indexOf('泥料选择');
    expect('备泥：含铁量段落位于 泥料选择 之前', iNote >= 0 && iSel > iNote, iNote + '<' + iSel);

    CLICK(2);
    html = wsBodyEl.innerHTML || '';
    expect('拉坯：已去掉“当前拉坯工序”小块', !/当前拉坯工序/.test(html), 'form-stage');
    expect('拉坯：手势条目无图标、无“· 双手”', !/class="ic"/.test(html) && !/·\s*双手/.test(html), 'form-act');
    expect('拉坯：成型手法介绍与鼠标提示分两段', /<\/div>\s*<div class="ws-note"[^>]*>没有摄像头时用鼠标/.test(html), 'form-gap');
    expect('拉坯：气质无“中和/中立”中间档', !/中和|中立/.test(html), 'temper');
    expect('拉坯：气质两端词分列滑条左右（如 沉稳 … 清秀）',
      /<label class="ep lo[^"]*"[^>]*>沉稳<\/label><input[^>]*data-act="temper"[^>]*data-v="slim"[^>]*><label class="ep hi[^"]*"[^>]*>清秀<\/label>/.test(html)
      && !/沉稳↔清秀/.test(html), 'temper-ends');

    CLICK(3);
    html = wsBodyEl.innerHTML || '';
    expect('修坯：已去掉“待坯体半干…”句', !/待坯体半干/.test(html), 'trim');
    expect('修坯：修整重点默认选中修圈足', /class="ws-chip on" data-act="trimfocus" data-v="foot"/.test(html), 'trim-on');
    expect('修坯：默认重点下有介绍文字与对应手势', /倒扣坯体，从足心向外走刀/.test(html) && /对应手势/.test(html) && /修坯横刮/.test(html), 'trim-info');
    // 点击“规整口沿”后应可选中（修复点击无效），并切换为口沿介绍与手势
    wsBodyEl._ev.click({ target: fakeTarget({ 'data-act': 'trimfocus', 'data-v': 'rim' }) }); pump(3);
    html = wsBodyEl.innerHTML || '';
    expect('修坯：修整重点可点选', /class="ws-chip on" data-act="trimfocus" data-v="rim"/.test(html), 'trim-click');
    expect('修坯：点击后切换为该重点的介绍与手势', /口沿内侧/.test(html) && /拍打定型/.test(html) === false, 'trim-rim-acts');

    CLICK(4);
    html = wsBodyEl.innerHTML || '';
    expect('装饰：已去掉“素坯上的刻花…”句', !/素坯上的刻花/.test(html), 'decor');

    CLICK(5);
    html = wsBodyEl.innerHTML || '';
    expect('施釉：标题改为“呈色选择”', /呈色选择/.test(html) && !/按呈色成因分组/.test(html), 'glaze-title');
    expect('施釉：按钮改为“重设呈色”', /重设呈色/.test(html) && !/取消锁定/.test(html), 'glaze-btn');
    expect('施釉：分组标题圆点改为空格', /赤红系\s+还原气氛下铁的呈色/.test(html) && !/·\s*还原气氛/.test(html), 'glaze-group');
    expect('施釉：“重设呈色”旁有“开始施釉”按钮', /data-act="glazestart"[^>]*>开始施釉</.test(html), 'glaze-start-btn');
    expect('施釉：紫系分组文案正确', /紫系\s*<span[^>]*>·\s*锰铁在临界气氛下的偶然呈色/.test(html) === false && /紫系\s+锰铁在临界气氛下的偶然呈色/.test(html), 'purple');
    expect('施釉：施釉方式带介绍文字', /整器浸入釉浆/.test(html), 'glaze-way-desc');
    // 切换施釉方式，介绍随选择变化
    wsBodyEl._ev.click({ target: fakeTarget({ 'data-act': 'glazemethod', 'data-v': 'pour' }) }); pump(3);
    expect('施釉：切换方式后介绍更新', /荡入内腔/.test(wsBodyEl.innerHTML || ''), 'glaze-way-switch');

    CLICK(6);
    html = wsBodyEl.innerHTML || '';
    expect('烧成：按钮文字为“点击烧制”', />点击烧制</.test(html) && !/重新烧制|入窑烧制/.test(html), 'fire-btn');

    CLICK(7);
    html = wsBodyEl.innerHTML || '';
    expect('成器：已去掉“先在「烧成」步骤入窑…”说明', !/先在「烧成」步骤入窑/.test(html), 'done');
    expect('成器：无“这一步你能调节的参数”空标题', !/这一步你能调节的参数/.test(html), 'done-head');
  } catch (e) { expect('文案细调校验', false, e.message); }
})();


// 施釉动画：点「开始施釉」→ 按施釉方式播放上釉动画 → 收光 → 素坯呈湿釉色
function avgRGBInFrame(frame) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const c of calls) {
    if (c.f !== frame || !c.style) continue;
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(String(c.style));
    if (m) { r += +m[1]; g += +m[2]; b += +m[3]; n++; }
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
}
let glazeOk = true, glazeErr = '', gBefore = null, gAfter = null, methodSigs = {};
const cntIn = (frame, m) => calls.filter(c => c.f === frame && c.m === m).length;
try {
  wsRailEl._ev.click({ target: fakeTarget({ 'data-step': '5' }) }); pump(4);   // 施釉
  pump(2); gBefore = avgRGBInFrame(frameNo);
  // 四种施釉方式分别播一遍动画（确认各有专属动作、均不报错）
  for (const w of ['dip', 'brush', 'spray', 'pour']) {
    wsBodyEl._ev.click({ target: fakeTarget({ 'data-act': 'glazemethod', 'data-v': w }) }); pump(2);
    wsBodyEl._ev.click({ target: fakeTarget({ 'data-act': 'glazestart' }) });
    pump(40);                                                        // 动画进行中
    methodSigs[w] = [cntIn(frameNo, 'fillRect'), cntIn(frameNo, 'arc'), cntIn(frameNo, 'quadraticCurveTo')].join('/');
    pump(180);                                                       // 跑完上釉 + 收光
  }
  pump(3); gAfter = avgRGBInFrame(frameNo);
} catch (e) { glazeOk = false; glazeErr = e.message; }
expect('施釉：四种方式的动画均不报错', glazeOk, glazeErr);
expect('施釉：各方式动画的画笔特征互不相同', new Set(Object.values(methodSigs)).size === 4,
  Object.keys(methodSigs).map(k => k + '=' + methodSigs[k]).join(' '));
const sig = methodSigs;
expect('施釉动画：刷釉多段刷痕 / 喷釉大量雾滴 / 荡釉连续釉流',
  sig.brush && sig.spray && sig.pour &&
  +sig.brush.split('/')[0] > +sig.dip.split('/')[0] &&
  +sig.spray.split('/')[1] > 20 &&
  +sig.pour.split('/')[2] > 0,
  JSON.stringify(sig));
const gdist = gBefore && gAfter
  ? Math.sqrt(Math.pow(gBefore[0] - gAfter[0], 2) + Math.pow(gBefore[1] - gAfter[1], 2) + Math.pow(gBefore[2] - gAfter[2], 2)) : 0;
expect('施釉后素坯呈湿釉色（颜色明显变化）', gdist > 8,
  JSON.stringify(gBefore) + ' -> ' + JSON.stringify(gAfter) + ' 色距=' + gdist.toFixed(1));

// 烧成步骤：入窑 → 关窑动画 → 烧制约3秒 → 开窑动画 → 烧成着色分支不报错
let kilnOk = true, kilnErr = '';
try {
  wsRailEl._ev.click({ target: fakeTarget({ 'data-step': '6' }) }); pump(3);   // 烧成
  wsBodyEl._ev.click({ target: fakeTarget({ 'data-act': 'kiln' }) });
  pump(360);   // 关窑(0.9s) + 烧制(3s) + 开窑(0.9s) ≈ 4.8s，需跑完整动画
} catch (e) { kilnOk = false; kilnErr = e.message; }
expect('入窑后烧成着色分支渲染不报错', kilnOk, kilnErr);

const firedBbox = sceneBbox(frameNo);
console.log('入窑后 呈色徽章 =', hud.hueName || '(未设置)', ' 场景 bbox =',
  firedBbox.w.toFixed(0) + '×' + firedBbox.h.toFixed(0));
expect('入窑后呈色徽章已更新为传统色名', !!hud.hueName && hud.hueName !== '生坯', hud.hueName);

// 施釉步骤：点选一个传统色（反向推导烧成条件）
let hueOk = true;
try {
  wsRailEl._ev.click({ target: fakeTarget({ 'data-step': '5' }) }); pump(3);   // 施釉
  wsBodyEl._ev.click({ target: fakeTarget({ 'data-act': 'hue', 'data-g': '2', 'data-i': '0' }) });
  pump(20);
} catch (e) { hueOk = false; kilnErr = e.message; }
expect('点选传统色并反推烧成条件不报错', hueOk, kilnErr);
console.log('选「天青」后 呈色徽章 =', hud.hueName);

process.exit(fail ? 1 : 0);
