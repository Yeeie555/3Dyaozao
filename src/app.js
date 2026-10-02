/* =========================================================
   捏陶 · 手势陶艺手作
   —— 拉坯物理：体积守恒，拉高变细、捏细变高
   —— 手势识别：MediaPipe Hands（21 关键点）
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- DOM ---------------- */
  var cv = document.getElementById('clay');
  var ctx = cv.getContext('2d');
  var video = document.getElementById('video');
  var overlay = document.getElementById('overlay');
  var octx = overlay.getContext('2d');
  var screenOff = document.getElementById('screenOff');
  var btnCam = document.getElementById('btnCam');
  var rec = document.getElementById('rec');
  var gestureText = document.getElementById('gestureText');
  var handCountEl = document.getElementById('handCount');
  var diagEl = document.getElementById('diag');
  var mH = document.getElementById('mH');
  var mW = document.getElementById('mW');
  var mWk = document.getElementById('mWk');
  var btnView = document.getElementById('btnView');
  var btnSpin = document.getElementById('btnSpin');
  var btnReset = document.getElementById('btnReset');
  var btnSave = document.getElementById('btnSave');
  var vesselNameEl = document.getElementById('vesselName');

  /* =========================================================
     零、工艺知识库（源自「窑创未来」柴烧知识库 + 陶瓷工艺通识）
     ========================================================= */

  /* ---------------- 泥料：颗粒 / 含铁 / 耐火 ---------------- */
  var CLAYS = [
    {
      id: 'coarse', name: '粗陶砂泥', grain: 1.00, iron: 0.90, fire: 0.95, shrink: 0.55,
      desc: '含砂量大、颗粒粗，耐火度高。烧成多呈粗粝哑光肌理，火痕层次明显，柴烧最常用。'
    },
    {
      id: 'red', name: '马坝红泥', grain: 0.62, iron: 1.00, fire: 0.80, shrink: 0.70,
      desc: '本地红土，含铁量高。氧化呈赭石茶褐，还原转赤红锈色，是曲江柴烧的呈色基础。'
    },
    {
      id: 'fine', name: '细白泥', grain: 0.22, iron: 0.22, fire: 0.70, shrink: 0.85,
      desc: '颗粒细腻含铁低，胎色浅。落灰薄处显月白霜色，适合呈现草木灰的清透感。'
    },
    {
      id: 'zisha', name: '紫金泥', grain: 0.48, iron: 1.10, fire: 0.88, shrink: 0.60,
      desc: '紫砂类泥料，铁钛含量高。强还原下发色深沉，易出黑褐与窑变紫。'
    },
    {
      id: 'blend', name: '混合练泥', grain: 0.70, iron: 0.75, fire: 0.85, shrink: 0.65,
      desc: '粗砂与细泥混合练制，兼顾可塑与肌理。排气均匀，开裂风险较低。'
    }
  ];

  /* ---------------- 成型手法 ---------------- */
  var METHODS = [
    { id: 'wheel', name: '轮制拉坯', ring: 1.0, even: 0.95, mark: '拉坯螺旋纹', desc: '转盘拉坯，器形规整圆融，壁薄均匀，表面留下规律的螺旋指痕。' },
    { id: 'pinch', name: '手捏成型', ring: 0.15, even: 0.25, mark: '指印与捏痕', desc: '徒手捏塑，器形不完全对称，保留指腹压痕，最有手工温度。' },
    { id: 'coil', name: '泥条盘筑', ring: 0.55, even: 0.45, mark: '横向盘筑纹', desc: '泥条一圈圈盘叠再抹平，器壁偏厚，横向层理是窑内积灰的天然沟槽。' },
    { id: 'slab', name: '泥板围合', ring: 0.30, even: 0.55, mark: '板面接缝', desc: '泥板卷合拼接，棱面转折清晰，受火时转折处火痕对比强烈。' },
    { id: 'mold', name: '模具辅助', ring: 0.10, even: 1.00, mark: '规整无手痕', desc: '模具定型，形制统一、表面平整，手工痕迹少但烧成稳定。' }
  ];

  /* ---------------- 器型预设（口沿·颈·肩·腹·足） ---------------- */
  var SHAPES = [
    { id: 'bowl', name: '斗笠碗', foot: 0.34, footT: 0.07, belly: 1.18, bellyPos: 0.60, neck: 1.24, neckPos: 0.92, mouth: 1.30, shoulder: 0.05, height: 0.66, use: '茶器 · 敞口浅腹，内膛进火充分' },
    { id: 'cup', name: '茶盏', foot: 0.34, footT: 0.10, belly: 0.94, bellyPos: 0.50, neck: 0.84, neckPos: 0.86, mouth: 0.86, shoulder: 0.10, height: 0.72, use: '茶器 · 口微收弧腹，聚香保温' },
    { id: 'jar', name: '圆罐', foot: 0.56, footT: 0.09, belly: 1.18, bellyPos: 0.46, neck: 0.60, neckPos: 0.84, mouth: 0.64, shoulder: 0.35, height: 1.00, use: '储物 · 鼓腹短颈，肩部易积灰' },
    { id: 'vase', name: '梅瓶', foot: 0.46, footT: 0.08, belly: 1.16, bellyPos: 0.62, neck: 0.30, neckPos: 0.88, mouth: 0.28, shoulder: 0.45, height: 1.55, use: '陈设 · 小口短颈丰肩瘦底，重心下沉' },
    { id: 'yuhu', name: '玉壶春', foot: 0.42, footT: 0.09, belly: 1.04, bellyPos: 0.34, neck: 0.30, neckPos: 0.74, mouth: 0.54, shoulder: 0.20, height: 1.48, use: '陈设:撇口细颈垂腹，S 形线条' },
    { id: 'zun', name: '折肩尊', foot: 0.68, footT: 0.10, belly: 1.12, bellyPos: 0.56, neck: 0.70, neckPos: 0.84, mouth: 1.04, shoulder: 0.95, height: 1.06, use: '礼器 · 大口折肩，肩线处灰釉堆积' },
    { id: 'plate', name: '浅盘', foot: 0.52, footT: 0.06, belly: 1.42, bellyPos: 0.82, neck: 1.42, neckPos: 0.96, mouth: 1.46, shoulder: 0.02, height: 0.46, use: '食器 · 极浅大口，火痕铺展面广' },
    { id: 'pot', name: '钵', foot: 0.48, footT: 0.08, belly: 1.22, bellyPos: 0.48, neck: 1.08, neckPos: 0.90, mouth: 1.12, shoulder: 0.15, height: 0.84, use: '食器 · 敞口深腹，稳重敦厚' },
    { id: 'tube', name: '筒瓶', foot: 0.86, footT: 0.07, belly: 0.92, bellyPos: 0.50, neck: 0.90, neckPos: 0.92, mouth: 0.92, shoulder: 0.05, height: 1.40, use: '陈设 · 直筒挺拔，线条少转折' }
  ];

  /* ---------------- 气质（审美取向，作用于器型比例） ---------------- */
  var TEMPER = [
    { id: 'upright', name: '挺拔', low: '稳重', hi: '挺拔', v: 0.55, hint: '最大腹径上移则挺拔，下移则稳重' },
    { id: 'open', name: '开阔', low: '内敛', hi: '开阔', v: 0.55, hint: '口径加大显开阔，收小显内敛张力' },
    { id: 'slim', name: '清秀', low: '沉稳', hi: '清秀', v: 0.50, hint: '颈细腹收显清秀，颈粗腹厚显沉稳' },
    { id: 'lofty', name: '昂然', low: '拙朴', hi: '昂然', v: 0.45, hint: '高足显昂然，矮足显拙朴' }
  ];

  /* ---------------- 木柴：灰分碱性与灰量 ---------------- */
  var WOODS = [
    { id: 'pine', name: '松木', alkali: 0.78, ash: 0.85, desc: '油脂多、火旺，灰分碱性高，易出金黄琥珀玻璃质与流釉。' },
    { id: 'longan', name: '龙眼木', alkali: 0.62, ash: 0.70, desc: '木质致密耐烧，火力平稳，灰釉温润少流挂。' },
    { id: 'lychee', name: '荔枝木', alkali: 0.55, ash: 0.62, desc: '火力温和，落灰细密，常得赭石与茶褐色。' },
    { id: 'misc', name: '杂木', alkali: 0.45, ash: 0.55, desc: '杂木混烧，灰分复杂，窑变层次最丰富也最难控。' },
    { id: 'straw', name: '稻草谷壳', alkali: 0.88, ash: 0.40, desc: '碱性极高、灰量薄，薄灰处易现灰青与月白。' }
  ];

  /* ---------------- 窑位：受火强度与落灰量 ---------------- */
  var KILNPOS = [
    { id: 'front', name: '近火口', fire: 1.00, ash: 0.92, desc: '温度冲击强，火痕直接有力，迎火面常出赤红与黑褐。' },
    { id: 'main', name: '主火道', fire: 0.85, ash: 0.78, desc: '火焰主流经处，火痕方向感清晰，灰釉厚薄过渡明显。' },
    { id: 'mid', name: '窑室中段', fire: 0.62, ash: 0.58, desc: '受火均匀，色调最协调，是出稳定成品的位置。' },
    { id: 'back', name: '后段远火', fire: 0.34, ash: 0.36, desc: '温度偏低，灰釉薄，多呈哑光粗粝与冷调。' },
    { id: 'top', name: '上层', fire: 0.72, ash: 0.68, desc: '热气上升聚集，上部受火强，易形成向下的流釉。' },
    { id: 'wall', name: '靠壁', fire: 0.45, ash: 0.50, desc: '一侧受火一侧背火，正反面色差大，适合留白对比。' },
    { id: 'shade', name: '遮挡位', fire: 0.18, ash: 0.24, desc: '被其他器物遮挡，色彩柔和内敛，火痕含蓄。' }
  ];

  /* ---------------- 装饰 / 肌理手法 ---------------- */
  var TEXTURES = [
    { id: 'none', name: '素面', desc: '不做额外处理，保留泥料与火的本来面目。' },
    { id: 'paddle', name: '拍打', desc: '木拍拍打器壁，留下平面与凹痕，转折处火痕更清晰。' },
    { id: 'scrape', name: '刮削', desc: '工具刮出纵向或斜向刀痕，灰釉在沟槽中沉积。' },
    { id: 'incise', name: '刻划', desc: '刻出线纹，凹线内积灰，形成深浅对比的线条感。' },
    { id: 'burnish', name: '磨光', desc: '坯体半干时磨压表面，烧成后局部晶亮，与粗粝形成对比。' },
    { id: 'slip', name: '化装土', desc: '涂刷白化妆土，与胎色形成层次，落灰薄处显出底纹。' }
  ];

  /* ---------------- 中国传统色（按柴烧呈色成因分组） ---------------- */
  var HUE_GROUPS = [
    {
      id: 'brown', name: '暖褐系', cause: '氧化焰下铁元素呈色',
      hues: [
        { n: '赭石', p: 'zhě shí', c: [158, 91, 61], cond: { atmos: 0.12, temp: 1240, ash: 0.50, alkali: 0.40 } },
        { n: '茶褐', p: 'chá hè', c: [139, 90, 56], cond: { atmos: 0.20, temp: 1220, ash: 0.55, alkali: 0.45 } },
        { n: '栗壳', p: 'lì ké', c: [107, 66, 38], cond: { atmos: 0.30, temp: 1260, ash: 0.62, alkali: 0.35 } },
        { n: '驼色', p: 'tuó sè', c: [168, 132, 98], cond: { atmos: 0.10, temp: 1200, ash: 0.38, alkali: 0.55 } },
        { n: '缃色', p: 'xiāng sè', c: [232, 194, 106], cond: { atmos: 0.08, temp: 1210, ash: 0.30, alkali: 0.72 } },
        { n: '秋香', p: 'qiū xiāng', c: [217, 182, 17], cond: { atmos: 0.15, temp: 1225, ash: 0.34, alkali: 0.66 } }
      ]
    },
    {
      id: 'red', name: '赤红系', cause: '还原气氛下铁的呈色',
      hues: [
        { n: '朱砂', p: 'zhū shā', c: [195, 39, 43], cond: { atmos: 0.52, temp: 1250, ash: 0.45, alkali: 0.50 } },
        { n: '胭脂', p: 'yān zhī', c: [157, 41, 51], cond: { atmos: 0.60, temp: 1240, ash: 0.50, alkali: 0.45 } },
        { n: '绛红', p: 'jiàng hóng', c: [169, 59, 59], cond: { atmos: 0.48, temp: 1230, ash: 0.55, alkali: 0.42 } },
        { n: '酡红', p: 'tuó hóng', c: [220, 48, 35], cond: { atmos: 0.55, temp: 1265, ash: 0.40, alkali: 0.58 } },
        { n: '海棠红', p: 'hǎi táng hóng', c: [219, 90, 107], cond: { atmos: 0.44, temp: 1225, ash: 0.36, alkali: 0.62 } },
        { n: '锈红', p: 'xiù hóng', c: [138, 51, 36], cond: { atmos: 0.66, temp: 1275, ash: 0.58, alkali: 0.38 } }
      ]
    },
    {
      id: 'celadon', name: '青灰系', cause: '还原气氛 · 薄灰釉 · 草木灰',
      hues: [
        { n: '天青', p: 'tiān qīng', c: [123, 163, 166], cond: { atmos: 0.82, temp: 1245, ash: 0.28, alkali: 0.70 } },
        { n: '粉青', p: 'fěn qīng', c: [169, 200, 193], cond: { atmos: 0.76, temp: 1230, ash: 0.34, alkali: 0.66 } },
        { n: '梅子青', p: 'méi zǐ qīng', c: [111, 140, 107], cond: { atmos: 0.88, temp: 1260, ash: 0.30, alkali: 0.62 } },
        { n: '影青', p: 'yǐng qīng', c: [175, 196, 203], cond: { atmos: 0.72, temp: 1220, ash: 0.26, alkali: 0.74 } },
        { n: '蟹壳青', p: 'xiè ké qīng', c: [59, 78, 74], cond: { atmos: 0.90, temp: 1280, ash: 0.42, alkali: 0.50 } },
        { n: '鸦青', p: 'yā qīng', c: [66, 76, 80], cond: { atmos: 0.94, temp: 1290, ash: 0.46, alkali: 0.44 } },
        { n: '苍青', p: 'cāng qīng', c: [115, 151, 171], cond: { atmos: 0.80, temp: 1255, ash: 0.32, alkali: 0.68 } }
      ]
    },
    {
      id: 'amber', name: '金黄系', cause: '灰分碱性成分与硅形成玻璃质',
      hues: [
        { n: '琥珀', p: 'hǔ pò', c: [202, 105, 36], cond: { atmos: 0.22, temp: 1280, ash: 0.78, alkali: 0.85 } },
        { n: '琉璃黄', p: 'liú lí huáng', c: [228, 169, 0], cond: { atmos: 0.18, temp: 1290, ash: 0.82, alkali: 0.90 } },
        { n: '金盏', p: 'jīn zhǎn', c: [242, 190, 69], cond: { atmos: 0.14, temp: 1265, ash: 0.72, alkali: 0.82 } },
        { n: '蜜蜡黄', p: 'mì là huáng', c: [233, 185, 15], cond: { atmos: 0.20, temp: 1270, ash: 0.75, alkali: 0.80 } },
        { n: '缃色', p: 'xiāng sè', c: [240, 194, 57], cond: { atmos: 0.12, temp: 1250, ash: 0.66, alkali: 0.78 } }
      ]
    },
    {
      id: 'dark', name: '黑褐系', cause: '强还原 · 过烧 · 局部碳化',
      hues: [
        { n: '玄色', p: 'xuán sè', c: [61, 59, 79], cond: { atmos: 0.96, temp: 1300, ash: 0.68, alkali: 0.40 } },
        { n: '漆黑', p: 'qī hēi', c: [22, 24, 35], cond: { atmos: 1.00, temp: 1315, ash: 0.80, alkali: 0.35 } },
        { n: '乌色', p: 'wū sè', c: [75, 59, 58], cond: { atmos: 0.92, temp: 1295, ash: 0.62, alkali: 0.42 } },
        { n: '墨色', p: 'mò sè', c: [80, 97, 109], cond: { atmos: 0.88, temp: 1285, ash: 0.52, alkali: 0.55 } },
        { n: '黑褐', p: 'hēi hè', c: [59, 50, 44], cond: { atmos: 0.85, temp: 1305, ash: 0.70, alkali: 0.38 } }
      ]
    },
    {
      id: 'pale', name: '灰白系', cause: '薄灰 · 草木灰 · 低铁胎',
      hues: [
        { n: '月白', p: 'yuè bái', c: [214, 236, 240], cond: { atmos: 0.35, temp: 1215, ash: 0.20, alkali: 0.80 } },
        { n: '霜色', p: 'shuāng sè', c: [233, 241, 242], cond: { atmos: 0.30, temp: 1205, ash: 0.16, alkali: 0.85 } },
        { n: '缟色', p: 'gǎo sè', c: [242, 236, 222], cond: { atmos: 0.25, temp: 1200, ash: 0.22, alkali: 0.75 } },
        { n: '蛤粉', p: 'gé fěn', c: [245, 233, 215], cond: { atmos: 0.28, temp: 1195, ash: 0.18, alkali: 0.78 } },
        { n: '芦灰', p: 'lú huī', c: [184, 169, 154], cond: { atmos: 0.40, temp: 1225, ash: 0.30, alkali: 0.60 } }
      ]
    },
    {
      id: 'purple', name: '紫系', cause: '锰铁在临界气氛下的偶然呈色',
      hues: [
        { n: '玫瑰紫', p: 'méi guī zǐ', c: [112, 43, 87], cond: { atmos: 0.70, temp: 1290, ash: 0.60, alkali: 0.52 } },
        { n: '茄皮紫', p: 'qié pí zǐ', c: [92, 42, 66], cond: { atmos: 0.74, temp: 1300, ash: 0.64, alkali: 0.48 } },
        { n: '葡萄紫', p: 'pú táo zǐ', c: [106, 61, 92], cond: { atmos: 0.68, temp: 1285, ash: 0.56, alkali: 0.55 } },
        { n: '紫檀', p: 'zǐ tán', c: [92, 34, 35], cond: { atmos: 0.78, temp: 1305, ash: 0.66, alkali: 0.45 } }
      ]
    }
  ];

  /* ---------------- 可调参数状态 ---------------- */
  var CRAFT = {
    clay: 'coarse', method: 'wheel', shape: 'vase', texture: 'none',
    temper: { upright: 0.55, open: 0.55, slim: 0.50, lofty: 0.45 },
    trimfocus: 'foot',
    firing: {
      temp: 1240, atmos: 0.20, pos: 'mid', wood: 'pine',
      ash: 0.55, fireDir: 0.0, cool: 0.25, load: 0.5
    },
    hue: null,          // {group, index} 锁定色；null = 由烧成参数推算
    glazed: false,      // 是否已完成施釉（湿釉态）
    fired: false,       // 是否已入窑
    stage: 0            // 工序阶段
  };

  function clayOf(id) { for (var i = 0; i < CLAYS.length; i++) if (CLAYS[i].id === id) return CLAYS[i]; return CLAYS[0]; }
  function methodOf(id) { for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return METHODS[i]; return METHODS[0]; }
  function shapeOf(id) { for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].id === id) return SHAPES[i]; return SHAPES[0]; }
  function woodOf(id) { for (var i = 0; i < WOODS.length; i++) if (WOODS[i].id === id) return WOODS[i]; return WOODS[0]; }
  function posOf(id) { for (var i = 0; i < KILNPOS.length; i++) if (KILNPOS[i].id === id) return KILNPOS[i]; return KILNPOS[2]; }
  function texOf(id) { for (var i = 0; i < TEXTURES.length; i++) if (TEXTURES[i].id === id) return TEXTURES[i]; return TEXTURES[0]; }

  /* ---------------- 器型曲线：预设 + 气质偏移 ---------------- */
  function smoother(u) { return u <= 0 ? 0 : (u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10)); }

  function shapeParams() {
    var s = shapeOf(CRAFT.shape), t = CRAFT.temper;
    var p = {};
    p.foot = s.foot;
    p.footT = s.footT;
    p.belly = s.belly;
    p.bellyPos = s.bellyPos;
    p.neck = s.neck;
    p.neckPos = s.neckPos;
    p.mouth = s.mouth;
    p.shoulder = s.shoulder;
    p.height = s.height;

    // 挺拔 ↔ 稳重：最大腹径位置
    p.bellyPos += (t.upright - 0.5) * 0.44;
    // 开阔 ↔ 内敛：口径
    p.mouth *= 1 + (t.open - 0.5) * 0.70;
    // 清秀 ↔ 沉稳：颈细腹收 / 颈粗腹厚
    p.neck *= 1 + (0.5 - t.slim) * 0.62;
    p.belly *= 1 + (0.5 - t.slim) * 0.26;
    // 昂然 ↔ 拙朴：足高
    p.footT += (t.lofty - 0.5) * 0.14;
    // 手法影响：手工成型不做极细颈、器壁更厚实
    var m = methodOf(CRAFT.method);
    if (m.id === 'pinch' || m.id === 'coil') { p.belly *= 1.06; p.mouth *= 0.96; }

    p.bellyPos = clamp(p.bellyPos, 0.16, 0.88);
    p.neckPos = clamp(Math.max(p.neckPos, p.bellyPos + 0.12), 0.30, 0.97);
    p.footT = clamp(p.footT, 0.04, 0.26);
    p.mouth = clamp(p.mouth, 0.16, 1.60);
    p.neck = clamp(p.neck, 0.14, 1.50);
    p.belly = clamp(p.belly, 0.60, 1.55);
    return p;
  }

  // 由参数生成归一化半径曲线（t=0 足 → t=1 口）
  function profileAt(t, p) {
    if (t <= p.footT) {                                  // 收足段
      var u = p.footT > 1e-4 ? t / p.footT : 1;
      return p.foot * (0.86 + 0.14 * smoother(u));
    }
    if (t <= p.bellyPos) {                               // 足 → 腹
      var u2 = (t - p.footT) / Math.max(1e-4, p.bellyPos - p.footT);
      return p.foot + (p.belly - p.foot) * smoother(u2);
    }
    if (t <= p.neckPos) {                                // 腹 → 颈（肩型在此体现）
      var u3 = (t - p.bellyPos) / Math.max(1e-4, p.neckPos - p.bellyPos);
      var soft = smoother(u3);                                    // 溜肩：平缓
      var hard = u3 < 0.34 ? 0 : Math.pow((u3 - 0.34) / 0.66, 0.55); // 折肩：先平后急收
      var f = soft + (hard - soft) * p.shoulder;
      return p.belly + (p.neck - p.belly) * f;
    }
    var u4 = (t - p.neckPos) / Math.max(1e-4, 1 - p.neckPos);     // 颈 → 口
    return p.neck + (p.mouth - p.neck) * smoother(u4);
  }

  function applyShape() {
    var p = shapeParams();
    hN = clamp(p.height, H_MIN, H_MAX);      // 先定高度，再按新高度做体积守恒归一
    for (var i = 0; i < SEG; i++) {
      var t = i / (SEG - 1);
      rN[i] = clamp(profileAt(t, p), R_MIN, R_MAX);
    }
    // 保持体积守恒：按 V0 归一化
    var v = 0;
    for (i = 0; i < SEG; i++) v += rN[i] * rN[i];
    var k = Math.sqrt(V0 / Math.max(1e-6, v * hN));
    for (i = 0; i < SEG; i++) rN[i] = clamp(rN[i] * k, R_MIN, R_MAX);
    initLump();
  }

  /* ---------------- 烧成模型：参数 → 呈色 / 肌理 ---------------- */
  function firingResult() {
    var f = CRAFT.firing;
    var clay = clayOf(CRAFT.clay), wood = woodOf(f.wood), pos = posOf(f.pos);
    var T = clamp((f.temp - 1150) / 180, 0, 1);       // 温度归一
    var A = clamp(f.atmos, 0, 1);                      // 0 氧化 → 1 强还原
    var ash = clamp(f.ash * 0.45 + pos.ash * 0.55, 0, 1);
    var alk = wood.alkali * (0.35 + 0.65 * ash);
    var iron = clay.iron;
    var fire = pos.fire;

    // 六种呈色倾向的权重（对应知识库中的色彩成因）
    var w = {
      brown: Math.max(0, (1 - A)) * (0.35 + 0.65 * iron) * (0.5 + 0.5 * T),
      red: Math.max(0, A * (1 - A) * 4) * (0.30 + 0.70 * iron),
      celadon: Math.pow(A, 1.6) * (1 - ash * 0.72) * (0.45 + 0.55 * alk),
      amber: alk * Math.max(0, (f.temp - 1200) / 110) * (0.30 + 0.70 * ash) * (1 - A * 0.45),
      dark: Math.pow(A, 2.6) * Math.max(0, (f.temp - 1235) / 90) * (0.4 + 0.6 * ash),
      pale: (1 - iron) * (1 - ash) * (1 - A * 0.5) * 1.35
    };
    var sum = 0, k;
    for (k in w) sum += w[k];
    if (sum < 1e-4) sum = 1;
    for (k in w) w[k] /= sum;

    // 各倾向代表色
    var REP = {
      brown: [150, 96, 62], red: [178, 60, 52], celadon: [128, 165, 163],
      amber: [216, 158, 52], dark: [52, 48, 50], pale: [226, 222, 208]
    };
    var r = 0, g = 0, b = 0;
    for (k in w) { r += REP[k][0] * w[k]; g += REP[k][1] * w[k]; b += REP[k][2] * w[k]; }
    // 成瓷后呈色以釉色 / 窑变为主，胎色只做最弱底色参与，避免仍像素坯
    var tb = clayBaseRGB();
    r = r * 0.90 + tb[0] * 0.10; g = g * 0.90 + tb[1] * 0.10; b = b * 0.90 + tb[2] * 0.10;
    // 提升饱和度，让烧成色明显区别于灰陶感的生坯
    var gl = (r + g + b) / 3;
    r = clamp(gl + (r - gl) * 1.28, 0, 255);
    g = clamp(gl + (g - gl) * 1.28, 0, 255);
    b = clamp(gl + (b - gl) * 1.28, 0, 255);

    // 肌理参数
    var gloss = clamp(Math.max(0, (f.temp - 1195) / 105) * (0.25 + 0.75 * ash) * (1 - f.cool * 0.45) + alk * 0.18, 0, 1);
    var run = clamp(ash * Math.max(0, (f.temp - 1215) / 95) * (0.4 + 0.6 * alk), 0, 1);
    var grain = clamp(clay.grain * (1 - T * 0.42) + (1 - ash) * 0.12, 0.05, 1);
    var fireStr = clamp(fire * (0.45 + 0.55 * T) * (0.5 + 0.5 * f.load), 0, 1);
    var blotch = clamp(ash * 0.6 + (1 - fire) * 0.3, 0, 1);
    var crack = clamp(f.cool * 0.62 + Math.max(0, (f.temp - 1290) / 60) * 0.5 + clay.shrink * 0.14 - 0.16, 0, 1);
    var slag = clamp(Math.max(0, (f.temp - 1265) / 70) * ash * 0.9, 0, 1);   // 过烧起泡

    return {
      rgb: [r, g, b], weight: w,
      gloss: gloss, run: run, grain: grain, fireStr: fireStr,
      blotch: blotch, crack: crack, slag: slag,
      fireDir: f.fireDir, ash: ash, temp: f.temp, atmos: A
    };
  }

  function clayBaseRGB() {
    var c = clayOf(CRAFT.clay);
    // 五种泥料胎色拉开差距，让生坯一眼可辨
    if (c.id === 'coarse') return [148, 124, 98];    // 粗陶砂泥：暖灰褐、偏暗
    if (c.id === 'red')    return [186, 96, 60];     // 马坝红泥：明显红褐
    if (c.id === 'fine')   return [228, 218, 202];   // 细白泥：近白的浅米色
    if (c.id === 'zisha')  return [108, 72, 78];     // 紫金泥：深紫褐、明显偏冷
    return [200, 166, 126];                            // 混合练泥：中调暖砂
  }

  // 在色库中找最接近的传统色
  function nearestHue(rgb) {
    var best = null, bd = 1e9, gi = -1, hi = -1;
    for (var i = 0; i < HUE_GROUPS.length; i++) {
      var hs = HUE_GROUPS[i].hues;
      for (var j = 0; j < hs.length; j++) {
        var c = hs[j].c;
        var d = (c[0] - rgb[0]) * (c[0] - rgb[0]) + (c[1] - rgb[1]) * (c[1] - rgb[1]) + (c[2] - rgb[2]) * (c[2] - rgb[2]);
        if (d < bd) { bd = d; best = hs[j]; gi = i; hi = j; }
      }
    }
    return { hue: best, group: HUE_GROUPS[gi], gi: gi, hi: hi, dist: Math.sqrt(bd) };
  }

  function currentHueRGB() {
    if (CRAFT.hue) return HUE_GROUPS[CRAFT.hue.gi].hues[CRAFT.hue.hi].c;
    return firingResult().rgb;
  }

  function currentHueName() {
    if (CRAFT.hue) {
      var h = HUE_GROUPS[CRAFT.hue.gi].hues[CRAFT.hue.hi];
      return h.n + '（' + HUE_GROUPS[CRAFT.hue.gi].name + '）';
    }
    var n = nearestHue(firingResult().rgb);
    return n.hue.n + '（' + n.group.name + '）';
  }

  // 选色 → 反推推荐烧成条件（教学闭环）
  function applyHueCond(h) {
    var f = CRAFT.firing, c = h.cond;
    f.atmos = c.atmos; f.temp = c.temp; f.ash = c.ash;
    // 碱性：找最接近的木柴
    var bw = WOODS[0], bd = 9;
    for (var i = 0; i < WOODS.length; i++) {
      var d = Math.abs(WOODS[i].alkali - c.alkali);
      if (d < bd) { bd = d; bw = WOODS[i]; }
    }
    f.wood = bw.id;
    // 落灰量：找最接近的窑位
    var bp = KILNPOS[2], bd2 = 9;
    for (i = 0; i < KILNPOS.length; i++) {
      var d2 = Math.abs(KILNPOS[i].ash - c.ash);
      if (d2 < bd2) { bd2 = d2; bp = KILNPOS[i]; }
    }
    f.pos = bp.id;
  }

  /* ---------------- 鉴赏报告（按知识库维度） ---------------- */
  function appraise() {
    var p = shapeParams();
    var fr = firingResult();
    var nh = nearestHue(currentHueRGB());
    var clay = clayOf(CRAFT.clay), m = methodOf(CRAFT.method), pos = posOf(CRAFT.firing.pos), w = woodOf(CRAFT.firing.wood);
    var L = [];

    // 器型比例
    var bellyUp = p.bellyPos > 0.5 ? '偏上' : (p.bellyPos < 0.34 ? '偏下' : '居中');
    L.push(['器型比例', '最大腹径位于器身' + bellyUp + '（' + Math.round(p.bellyPos * 100) + '%），'
      + (p.bellyPos > 0.5 ? '挺拔有上升感，但需注意重心；' : '重心下沉，观感稳重；')
      + '口径与腹径之比约 ' + (p.mouth / p.belly).toFixed(2) + '，'
      + (p.mouth > p.belly ? '敞口取势，内膛进火充分。' : '敛口收势，内膛受火较缓。')]);

    // 线条与肩
    var sh = p.shoulder > 0.66 ? '折肩' : (p.shoulder > 0.33 ? '圆肩' : '溜肩');
    L.push(['肩线与线条', sh + (p.shoulder > 0.66 ? '转折明确，是灰釉自然堆积的位置；' : '过渡平缓，落灰易顺势流下；')
      + '足高占器身 ' + Math.round(p.footT * 100) + '%，' + (p.footT > 0.13 ? '高足显昂然。' : '矮足显拙朴。')]);

    // 泥料与手法
    L.push(['泥料与手法', clay.name + '（颗粒 ' + clay.grain.toFixed(2) + ' · 含铁 ' + clay.iron.toFixed(2) + '）：' + clay.desc
      + ' 成型取' + m.name + '，器表可见' + m.mark + '。']);

    // 火痕
    var dirTxt = (Math.cos(fr.fireDir) >= 0 ? '自右向左' : '自左向右');
    L.push(['火痕方向', '窑位「' + pos.name + '」，受火强度 ' + Math.round(pos.fire * 100) + '%；'
      + '当前火痕呈' + dirTxt + '走向，强度 ' + Math.round(fr.fireStr * 100) + '%。' + pos.desc]);

    // 落灰与釉
    L.push(['落灰与灰釉', '木柴用' + w.name + '，灰分碱性 ' + w.alkali.toFixed(2) + '，有效落灰量 ' + Math.round(fr.ash * 100) + '%。'
      + (fr.run > 0.55 ? '灰釉充分熔融并向下流动，可见流釉与釉泪。' : (fr.run > 0.28 ? '灰釉半熔，厚处微有流动。' : '灰釉偏薄，多呈哑光粗粝。'))]);

    // 呈色
    L.push(['呈色判断', '主色趋近中国传统色「' + nh.hue.n + '」，属' + nh.group.name + '（' + nh.group.cause + '）。'
      + '烧成气氛' + (fr.atmos < 0.33 ? '偏氧化焰' : (fr.atmos < 0.7 ? '弱还原' : '强还原')) + '，温度 ' + fr.temp + '℃。']);

    // 肌理节奏
    var tex = [];
    if (fr.grain > 0.6) tex.push('粗粝');
    if (fr.gloss > 0.55) tex.push('晶亮');
    else if (fr.gloss < 0.25) tex.push('哑光');
    if (fr.blotch > 0.5) tex.push('斑驳');
    if (fr.run > 0.45) tex.push('流动');
    if (texOf(CRAFT.texture).id !== 'none') tex.push(texOf(CRAFT.texture).name);
    L.push(['肌理节奏', tex.length ? ('器表呈现：' + tex.join('、') + '。层次与器型转折'
      + (fr.run > 0.4 ? '相互支撑，折肩与凹线处有沉积。' : '基本协调。')) : '肌理较单一，可尝试调整落灰量或温度。']);

    // 风险提示（知识库要求：不作真伪/价格判断）
    var risks = [];
    if (fr.crack > 0.5) risks.push('冷却偏快且温度高，惊裂与开裂风险上升');
    if (fr.slag > 0.4) risks.push('接近过烧，可能出现起泡');
    if (clay.shrink > 0.8 && CRAFT.firing.cool > 0.5) risks.push('泥料收缩大且急冷，需充分阴干');
    L.push(['风险提示', risks.length ? risks.join('；') + '。' : '当前参数下烧成风险较低。'
      + '本说明为工艺学习参考，不作为真伪、年代或价格判断依据。']);

    return L;
  }

  /* ---------------- 常量 ---------------- */
  var SEG = 56;              // 器型纵向分段
  var KY = 0.20;             // 俯视压缩（椭圆短半轴 / 长半轴）
  var V0 = SEG;              // 体积常量：初始 hN=1、所有 rN=1 => V = 1 * Σr² = SEG
  var SIGMA = 0.17;          // 塑形作用范围（纵向高斯）
  var H_MIN = 0.40;
  var H_MAX = 2.25;
  var R_MIN = 0.055;
  var R_MAX = 1.95;

  /* ---------------- 状态 ---------------- */
  var rN = new Float32Array(SEG);   // 归一化半径（1 = 初始泥块半径）
  var lump = new Float32Array(SEG); // 未处理泥块的不规则起伏
  var hN = 1.0;                     // 归一化高度（1 = 初始泥块高度）
  var work = 0;                     // 成形度 / 处理度 0~1
  var phase = 0;                    // 转盘角度
  var spin = 0;                     // 当前角速度 rad/s
  var started = false;              // 是否已开始做手势（转盘启动）
  var spinOn = true;                // 用户是否允许旋转

  /* ---------------- 布局 ---------------- */
  var W = 0, Hp = 0, DPR = 1;
  var cx = 0, baseY = 0, S = 200, RBASE = 88, HRAW = 136;

  /* ---------------- 工具 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixRGB(a, b, t) {
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' +
      Math.round(lerp(a[1], b[1], t)) + ',' +
      Math.round(lerp(a[2], b[2], t)) + ')';
  }

  /* =========================================================
     一、器型数据
     ========================================================= */
  function initShape() {
    for (var i = 0; i < SEG; i++) rN[i] = 1;
    hN = 1.0;
    work = 0;
    phase = 0;
    spin = 0;
    started = false;
    initLump();
  }

  // 未处理陶泥：表面不平整（平滑叠加正弦，模拟手揉泥团的起伏）
  function initLump() {
    var i, t, v, m = 0;
    for (i = 0; i < SEG; i++) {
      t = i / (SEG - 1);
      v = 0.52 * Math.sin(t * 9.1 + 1.3) + 0.30 * Math.sin(t * 16.4 + 0.4) + 0.14 * Math.sin(t * 23.3 + 2.2);
      lump[i] = v;
      m = Math.max(m, Math.abs(v));
    }
    if (m > 0) for (i = 0; i < SEG; i++) lump[i] /= m;
  }

  function sumSq() {
    var s = 0;
    for (var i = 0; i < SEG; i++) s += rN[i] * rN[i];
    return s;
  }

  // 让半径整体缩放，使 hN 下的体积恰好等于 V0
  function fitVolume() {
    var s = sumSq();
    var k = Math.sqrt(V0 / (hN * s));
    for (var i = 0; i < SEG; i++) rN[i] *= k;
  }

  /* =========================================================
     二、手势 -> 塑形
     ========================================================= */
  var g = { pull: 0, squeeze: 0, focus: 0.5, hands: 0, label: '', active: false, act: '' };

  function deadzone(v, d) {
    if (Math.abs(v) < d) return 0;
    return v > 0 ? (v - d) / (1 - d) : (v + d) / (1 - d);
  }

  function updateClay(dt) {
    var pull = deadzone(g.pull, 0.13);
    var sq = deadzone(g.squeeze, 0.13);
    var i, w, t;

    // 避免同时做两个动作时互相抵消：允许主导动作，压制次要动作
    var ap = Math.abs(pull), as = Math.abs(sq);
    if (ap > 0.14 && as > 0.14) {
      if (ap >= as) sq *= 0.22; else pull *= 0.22;
    }

    if (pull !== 0) {
      // 提 / 压：先改高度，再整体缩放到体积守恒 —— 拉高自然变细
      hN *= (1 + pull * 0.40 * dt);
      hN = clamp(hN, H_MIN, H_MAX);
      fitVolume();
    }

    if (sq !== 0) {
      // 捏 / 扩：以手的高度为落点做局部塑形
      for (i = 0; i < SEG; i++) {
        t = i / (SEG - 1);
        w = Math.exp(-0.5 * Math.pow((t - g.focus) / SIGMA, 2));
        if (w < 0.02) continue;
        rN[i] *= (1 + sq * 0.55 * dt * w);
        rN[i] = clamp(rN[i], R_MIN, R_MAX);
      }
      // 体积守恒：变粗则变矮，捏细则长高
      hN = clamp(V0 / sumSq(), H_MIN, H_MAX);
      fitVolume();
    }

    if (Math.abs(pull) > 0.1 || Math.abs(sq) > 0.1) {
      started = true;
      work = Math.min(1, work + (Math.abs(pull) + Math.abs(sq)) * dt * 0.26);
    }
  }

  function updateSpin(dt) {
    var target = (started && spinOn) ? 0.62 : 0;   // ≈10 秒一圈
    spin += (target - spin) * Math.min(1, dt * 1.6);
    phase += spin * dt;
    if (phase > Math.PI * 2) phase -= Math.PI * 2;
  }

  /* =========================================================
     三、三维渲染（软件光栅化）
     —— 陶器是回转体：按「高度层 × 环向段」生成杆体网格
     —— 外壁 / 内壁 / 口沿 / 内腔底，构成可俯视内看的空心器
     —— 透视投影 → 背面剔除 → 画家算法排序 → 朗伯 + 高光着色
     ========================================================= */

  /* ---------------- 相机 ---------------- */
  var cam = { yaw: 0.62, pitch: 0.34, zoom: 1, tYaw: 0.62, tPitch: 0.34, tZoom: 1 };
  var PITCH_MIN = -0.06, PITCH_MAX = 1.16, ZOOM_MIN = 0.60, ZOOM_MAX = 2.0;
  var HOME = { yaw: 0.62, pitch: 0.34, zoom: 1 };
  var camRotT = 0;                  // 最近一次「转动视角」手势的时间戳

  /* ---------------- 网格参数 ---------------- */
  var RL = 38;                      // 纵向层数
  var NA = 44;                      // 环向分段
  var TAU = Math.PI * 2;
  var FLOOR_LV = 0.10;              // 内腔底面（占器高比例）
  var WALLPX = 18;                  // 壁厚（resize 时按轮盘尺寸换算）

  var COSA = new Float32Array(NA), SINA = new Float32Array(NA);
  (function () {
    for (var k = 0; k < NA; k++) { var a = k * TAU / NA; COSA[k] = Math.cos(a); SINA[k] = Math.sin(a); }
  })();

  /* ---------------- 顶点缓冲 ---------------- */
  var NV = RL * NA;
  var oPX = new Float32Array(NV), oPY = new Float32Array(NV), oPZ = new Float32Array(NV);  // 外壁投影
  var oVX = new Float32Array(NV), oVY = new Float32Array(NV), oVZ = new Float32Array(NV);  // 外壁相机空间
  var oNX = new Float32Array(NV), oNY = new Float32Array(NV), oNZ = new Float32Array(NV);  // 外壁法线（世界）
  var uPX = new Float32Array(NV), uPY = new Float32Array(NV), uPZ = new Float32Array(NV);  // 内壁投影
  var uVX = new Float32Array(NV), uVY = new Float32Array(NV), uVZ = new Float32Array(NV);
  var uNX = new Float32Array(NV), uNY = new Float32Array(NV), uNZ = new Float32Array(NV);

  var prof = new Float32Array(RL);      // 每层外半径
  var profIn = new Float32Array(RL);    // 每层内半径（0 = 实心）
  var profY = new Float32Array(RL);     // 每层高度
  var lvlR = new Float32Array(RL), lvlG = new Float32Array(RL), lvlB = new Float32Array(RL);

  /* ---------------- 面缓冲（画家算法） ---------------- */
  var MAXQ = 7200;
  var qZ = new Float32Array(MAXQ);
  var qP = new Float32Array(MAXQ * 8);
  var qC = new Array(MAXQ);
  var qCnt = 0;
  var order = new Uint32Array(MAXQ);

  function pushQuad(z, x0, y0, x1, y1, x2, y2, x3, y3, col) {
    if (qCnt >= MAXQ) return;
    var b = qCnt * 8;
    // 按边法线外扩 0.45px：消除相邻面之间的 AA 细缝。
    // （沿质心外扩对细长三角形无效——顶盖扇形的放射缝就是教训）
    var px = [x0, x1, x2, x3], py = [y0, y1, y2, y3];
    var area = (x0 * y1 - x1 * y0) + (x1 * y2 - x2 * y1) + (x2 * y3 - x3 * y2) + (x3 * y0 - x0 * y3);
    var s = area > 0 ? 1 : -1, i;
    for (i = 0; i < 4; i++) {
      var pv = (i + 3) & 3, nx = (i + 1) & 3;
      var e1x = px[i] - px[pv], e1y = py[i] - py[pv];
      var n1x = s * e1y, n1y = -s * e1x;
      var l1 = Math.sqrt(n1x * n1x + n1y * n1y);
      var e2x = px[nx] - px[i], e2y = py[nx] - py[i];
      var n2x = s * e2y, n2y = -s * e2x;
      var l2 = Math.sqrt(n2x * n2x + n2y * n2y);
      var ox = 0, oy = 0;
      if (l1 > 1e-6) { ox += n1x / l1; oy += n1y / l1; }
      if (l2 > 1e-6) { ox += n2x / l2; oy += n2y / l2; }
      var ol = Math.sqrt(ox * ox + oy * oy);
      if (ol > 1e-6) { ox = ox / ol * 0.45; oy = oy / ol * 0.45; }
      qP[b + i * 2] = px[i] + ox;
      qP[b + i * 2 + 1] = py[i] + oy;
    }
    qZ[qCnt] = z; qC[qCnt] = col; qCnt++;
  }

  /* ---------------- 投影 ---------------- */
  var sA = 0, cA = 0, sE = 0, cE = 0, camD = 1, focal = 1, cy0 = 0, tyW = 0, sc0 = 1;
  var _px = 0, _py = 0, _pz = 0, _vx = 0, _vy = 0, _vz = 0;

  // 主光（左前上）与补光（右前）
  var LX, LY, LZ, FX, FY, FZ, HX, HY, HZ;
  (function () {
    var l = Math.sqrt(0.35 * 0.35 + 0.62 * 0.62 + 0.70 * 0.70);
    LX = -0.35 / l; LY = 0.62 / l; LZ = -0.70 / l;
    l = Math.sqrt(0.78 * 0.78 + 0.38 * 0.38 + 0.48 * 0.48);
    FX = 0.78 / l; FY = 0.38 / l; FZ = -0.48 / l;
    // 半程向量 ≈ normalize(L + V)，V 为指向相机的大致方向
    l = Math.sqrt(0.24 * 0.24 + 0.97 * 0.97 + 1.42 * 1.42);
    HX = 0.24 / l; HY = 0.97 / l; HZ = -1.42 / l;
  })();

  function camUpdate(dt) {
    var k = 1 - Math.exp(-dt * 13);
    cam.yaw += (cam.tYaw - cam.yaw) * k;
    cam.pitch += (cam.tPitch - cam.pitch) * k;
    cam.zoom += (cam.tZoom - cam.zoom) * k;
  }

  function camProject() {
    sA = Math.sin(cam.yaw); cA = Math.cos(cam.yaw);
    sE = Math.sin(cam.pitch); cE = Math.cos(cam.pitch);
    focal = 6.4 * S;
    camD = 7.5 * S * cam.zoom;
    sc0 = focal / camD;
    tyW = hpx * 0.45;
    cy0 = baseY - tyW * sc0;
  }

  function project(x, y, z) {
    var x1 = x * cA + z * sA;
    var z1 = -x * sA + z * cA;
    var yy = y - tyW;
    var y2 = yy * cE + z1 * sE;
    var z2 = -yy * sE + z1 * cE;
    var zc = z2 + camD;
    var s = focal / zc;
    _px = cx + x1 * s; _py = cy0 - y2 * s; _pz = zc;
    _vx = x1; _vy = y2; _vz = z2;
  }

  // 面朝向相机？
  function facing(nx, ny, nz, vx, vy, vz) {
    var x1 = nx * cA + nz * sA;
    var z1 = -nx * sA + nz * cA;
    var y2 = ny * cE + z1 * sE;
    var z2 = -ny * sE + z1 * cE;
    return (x1 * (-vx) + y2 * (-vy) + z2 * (-camD - vz)) > 0;
  }

  /* ---------------- 布局 ---------------- */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    Hp = window.innerHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(Hp * DPR);
    cv.style.width = W + 'px';
    cv.style.height = Hp + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    S = Math.max(112, Math.min(W * 0.235, Hp * 0.295));
    cx = W / 2;
    baseY = Hp * 0.655;
    RBASE = S * 0.44;
    HRAW = S * 0.62;
    WALLPX = RBASE * 0.20;
  }

  var R = new Float32Array(SEG);
  var hpx = 100, topY = 0;

  function buildRadii() {
    var amb = 1 - work;
    hpx = hN * HRAW;
    topY = baseY - hpx * sc0;
    for (var i = 0; i < SEG; i++) {
      var rough = 1 + lump[i] * 0.048 * amb;
      R[i] = Math.max(0.6, rN[i] * RBASE * rough);
    }
  }

  function radiusAt(level) {
    var x = clamp(level, 0, 1) * (SEG - 1);
    var i0 = Math.floor(x), i1 = Math.min(SEG - 1, i0 + 1);
    return lerp(R[i0], R[i1], x - i0);
  }

  function levelY(level) { return baseY - clamp(level, 0, 1) * hpx * sc0; }

  /* ---------------- 陶土色阶 ---------------- */
  var PAL_RAW = [[128, 118, 106], [161, 149, 134], [179, 167, 152], [161, 149, 133], [132, 121, 107], [105, 96, 85]];
  var PAL_WRK = [[141, 115, 88], [193, 154, 116], [218, 180, 138], [200, 156, 115], [164, 127, 93], [131, 105, 79]];
  var STOPS = [0, 0.18, 0.42, 0.62, 0.85, 1];
  var _c0 = [0, 0, 0], _c1 = [0, 0, 0];

  function clayRGB(k, out) {
    var a = PAL_RAW[k], b = PAL_WRK[k];
    var r = a[0] + (b[0] - a[0]) * work;
    var g = a[1] + (b[1] - a[1]) * work;
    var bl = a[2] + (b[2] - a[2]) * work;
    var tb = clayBaseRGB();                    // 泥料胎色参与生坯呈色（权重提高，差异更明显）
    out[0] = r * 0.45 + tb[0] * 0.55;
    out[1] = g * 0.45 + tb[1] * 0.55;
    out[2] = bl * 0.45 + tb[2] * 0.55;
  }

  function buildPalette() {
    // 3D 里明暗交给光照，基色取中间调，只在上下端轻微压暗
    var br, bg, bb;
    if (CRAFT.fired) {
      var h = currentHueRGB();                 // 出窑后按呈色结果显示
      br = h[0]; bg = h[1]; bb = h[2];
    } else {
      clayRGB(2, _c0);
      // 生坯：哑光素胎、略偏灰陶，与成瓷的釉色明显拉开
      br = _c0[0] * 0.92 + 16; bg = _c0[1] * 0.92 + 14; bb = _c0[2] * 0.92 + 12;
    }
    for (var i = 0; i < RL; i++) {
      var t = i / (RL - 1);
      var f = 0.93 + 0.07 * Math.sin(t * Math.PI);
      lvlR[i] = br * f;
      lvlG[i] = bg * f;
      lvlB[i] = bb * f;
    }
  }

  function rgbStr(r, g, b) {
    r = r < 0 ? 0 : (r > 255 ? 255 : r | 0);
    g = g < 0 ? 0 : (g > 255 ? 255 : g | 0);
    b = b < 0 ? 0 : (b > 255 ? 255 : b | 0);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // 廉价 2D 噪声：火痕条纹、落灰斑驳、过烧起泡都用它
  function nz2(a, b) {
    return Math.sin(a * 3.1 + b * 1.7) * 0.52 +
      Math.sin(a * 7.3 - b * 4.1 + 1.3) * 0.30 +
      Math.sin(a * 13.1 + b * 9.2 + 2.6) * 0.18;
  }

  var FIR = null;   // 当前烧成结果，每帧刷新

  // 入窑动画：关窑(封门) → 烧制(模拟约 3 秒) → 开窑
  var KILN_CLOSE_MS = 900, KILN_FIRE_MS = 3000, KILN_OPEN_MS = 900;
  var GLAZE_APPLY_MS = 1900, GLAZE_SETTLE_MS = 800;   // 施釉：上釉 1.9s + 收光 0.8s
  var glazeAnim = null;   // { method:'dip'|'brush'|'spray'|'pour', t0:now }
  var GLAZE_MSG = {
    dip: '浸釉中 · 器物缓缓沉入釉缸',
    brush: '刷釉中 · 毛刷沿器身层层刷涂',
    spray: '喷釉中 · 雾状釉浆均匀喷布',
    pour: '荡釉中 · 釉浆自上荡入器身'
  };
  // 釉浆目标色（锁定色优先，否则由烧成推算）
  function glazeHueRGB() {
    return CRAFT.hue ? HUE_GROUPS[CRAFT.hue.gi].hues[CRAFT.hue.hi].c : currentHueRGB();
  }
  function mixRGB(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function rgbaOf(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a.toFixed(3) + ')';
  }
  var kilnAnim = null;   // { phase:'closing'|'firing'|'opening', t0:now }
  // 当前窑火强度 0..1：只有烧制过程中才有明火；开窑后火熄、只余暗烬
  function kilnFirePower() {
    if (!kilnAnim) return 0;
    if (kilnAnim.phase === 'closing') return 0.55;
    if (kilnAnim.phase === 'firing') return 1;
    return Math.max(0, 1 - (tNow - kilnAnim.t0) / (KILN_OPEN_MS * 0.6));
  }

  // 成型手法 + 装饰肌理的程序化表面表达：让「轮制/手捏/盘筑/泥板/模具」与
  // 「素面/拍打/刮削/刻划/磨光/化装土」在 3D 上一眼可辨（此前这些参数完全没进渲染）
  function surfaceDetail(t, am, inner, fired) {
    var lum = 1, rA = 0, gA = 0, bA = 0;
    var glossBase = 0.05 + 0.30 * work;   // 生坯湿泥反光基线
    var glossAdd = 0, ring = 1;
    var m = methodOf(CRAFT.method);
    var tx = texOf(CRAFT.texture);

    // ---- 成型手法 ----
    if (m.id === 'wheel') {
      ring = 1 + 0.10 * Math.sin(t * 50);                 // 细密拉坯螺旋纹
      ring *= 1 + 0.04 * Math.sin(am * 3 + t * 9);        // 叠加螺旋起伏，转动可见
    } else if (m.id === 'pinch') {
      var pd = nz2(am * 4.3 + 1.1, t * 9.3 + 0.4);
      lum *= 1 - 0.22 * Math.max(0, pd);                  // 指腹压痕，不规则、明显
      lum *= 1 + 0.10 * Math.max(0, -pd);
    } else if (m.id === 'coil') {
      var cb_ = Math.sin(t * 15);
      lum *= 1 + 0.20 * cb_;                              // 横向盘筑层理，棱明显
      lum *= 1 - 0.09 * Math.max(0, -nz2(am * 2 + 0.5, t * 3));
    } else if (m.id === 'slab') {
      var fc = 6, pa = am * fc / TAU;
      lum *= 0.74 + 0.26 * Math.cos(pa * TAU);            // 板面受光差，棱面分明
      var seam = Math.abs(((pa % 1) + 1) % 1 - 0.5);
      lum *= 1 - 0.42 * Math.max(0, 0.5 - seam) * 2;      // 接缝压暗，明显拼缝
    } else if (m.id === 'mold') {
      lum *= 1 + 0.008 * Math.sin(t * 26);                // 极平整，几乎无手痕（与手作对比）
      glossBase += 0.10;
    }

    // ---- 装饰肌理 ----
    if (tx.id === 'paddle') {
      var cell = Math.sin(am * 9) * Math.sin(t * 8);
      lum *= 1 - 0.18 * Math.max(0, cell);                // 拍打凹痕
    } else if (tx.id === 'scrape') {
      var gro = Math.sin(am * 28 + t * 5);
      lum *= 1 - 0.22 * Math.max(0, gro);                 // 刮削纵纹，凹槽分明
    } else if (tx.id === 'incise') {
      var ln = Math.abs(Math.sin(am * 22 + t * 3));
      lum *= 1 - 0.32 * Math.max(0, 0.88 - ln);           // 刻线（清晰暗沟）
      var hln = Math.abs(Math.sin(t * 14));
      lum *= 1 - 0.20 * Math.max(0, 0.90 - hln);
    } else if (tx.id === 'burnish') {
      var bp = 0.5 + 0.5 * nz2(am * 3 + 2, t * 5);
      glossAdd += 0.24 * bp;                              // 磨光：局部晶亮
    } else if (tx.id === 'slip') {
      var sp2 = 0.5 + 0.5 * nz2(am * 5 + 1, t * 6);
      rA += 48 * sp2; gA += 38 * sp2; bA += 28 * sp2;     // 化装土浅亮覆盖，明显提亮
    }

    // 入窑后釉面会把浅刻 / 环纹填平，对比随玻化减弱
    if (fired) {
      ring = 1 + (ring - 1) * (1 - 0.55 * FIR.gloss);
      lum = 1 + (lum - 1) * (1 - 0.40 * FIR.gloss);
    }
    return { lum: lum, rA: rA, gA: gA, bA: bA, glossBase: glossBase, glossAdd: glossAdd, ring: ring };
  }

  // 陶泥着色：环境光 + 朗伯 + 补光 + 高光 + 接触阴影 + 拉坯横纹
  // 入窑后叠加火痕方向性、落灰斑驳、灰釉流挂、光泽与粗粝（对应知识库的成因描述）
  function clayShade(nx, ny, nz, t, inner, cr, cg, cb, am) {
    var d = nx * LX + ny * LY + nz * LZ; if (d < 0) d = 0;
    var fl = nx * FX + ny * FY + nz * FZ; if (fl < 0) fl = 0;
    var lum = 0.52 + 0.14 * (ny > 0 ? ny : 0) + d * 0.46 + fl * 0.20;
    var ao = 0.70 + 0.30 * clamp((t - 0.015) / 0.22, 0, 1);      // 接触阴影
    if (inner) {
      var deep = clamp((t - FLOOR_LV) / (1 - FLOOR_LV), 0, 1);
      ao *= 0.40 + 0.60 * deep;                                   // 越往腔内越暗
      lum *= 0.76;
    }
    lum *= ao;

    var r = cr, g = cg, b = cb;
    var fired = CRAFT.fired && FIR;
    // 成型手法 + 肌理：让不同选择一眼可辨（程序化表面）
    var sd = surfaceDetail(t, am, inner, fired);
    lum *= sd.lum;
    r += sd.rA; g += sd.gA; b += sd.bA;
    var glossK = sd.glossBase + sd.glossAdd;

    if (fired) {
      var A = am || 0;

      // 火痕：迎火面更深更暖，背火面浅而冷，沿火路带方向性条纹（压暗收敛，保釉色亮度）
      var fa = Math.cos(A - FIR.fireDir);
      var warm = clamp(fa * 0.5 + 0.5, 0, 1);
      var streak = 0.5 + 0.5 * nz2(A * 2.4, t * 4.6);
      var fireAmt = FIR.fireStr * (0.30 + 0.70 * warm) * (0.55 + 0.45 * streak);
      r *= 1 - 0.20 * fireAmt; g *= 1 - 0.24 * fireAmt; b *= 1 - 0.28 * fireAmt;
      var ember = fireAmt * 0.55;
      r += ember * 42; g += ember * 18; b += ember * 4;

      // 落灰斑驳：灰厚处偏黄亮，薄处哑光（内壁落灰明显更少）
      var blot = nz2(A * 1.7 + 3.1, t * 6.2 + 0.7);
      var ashAmt = clamp(FIR.ash * (0.45 + 0.55 * (blot * 0.5 + 0.5)) * (inner ? 0.35 : 1), 0, 1);
      r += ashAmt * 20; g += ashAmt * 16; b += ashAmt * 9;
      lum *= 1 - 0.10 * FIR.blotch * (1 - (blot * 0.5 + 0.5));

      // 灰釉流挂：受重力向下堆积，竖直流痕宽度不一
      if (FIR.run > 0.02) {
        var flow = clamp((1 - t) * 0.72 + 0.28, 0, 1);
        var vein = 0.5 + 0.5 * Math.sin(A * 5.3 + nz2(A * 2.1, t * 2.4) * 2.2);
        var runAmt = FIR.run * flow * (0.35 + 0.65 * vein) * (inner ? 0.5 : 1);
        r += runAmt * 30; g += runAmt * 24; b += runAmt * 12;
        lum *= 1 + 0.10 * runAmt;
      }

      // 成瓷：比生坯更亮、更通透、釉色更饱满，与素坯拉开差距
      lum *= 1.16 + 0.10 * FIR.gloss;
      // 粗粝（欠烧/粗胎），但大幅收敛，避免满脸像素点
      lum *= 1 - 0.05 * FIR.grain * (0.5 + 0.5 * nz2(A * 8.3, t * 17.0));
      // 过烧起泡
      if (FIR.slag > 0.02 && nz2(A * 6.7 + 1.1, t * 13.3) > 0.72 - FIR.slag * 0.5) lum *= 0.84;

      // 成瓷光泽明显高于生坯
      glossK = 0.10 + FIR.gloss * 0.66 + sd.glossAdd;

      // 施釉方式落在釉面上的痕迹：浸釉匀 / 刷釉条 / 喷釉雾 / 荡釉积
      if (glazeMethod === 'brush') {
        var bk = 0.5 + 0.5 * Math.sin((am || 0) * 9.5 + nz2((am || 0) * 3.2, t * 3.1) * 1.6);
        lum *= 1 - 0.13 * bk;                                  // 竖向刷痕暗条
        glossK += 0.10 * (1 - bk);                             // 刷痕棱脊更亮
        r += 7 * bk; g += 5 * bk; b += 4 * bk;
      } else if (glazeMethod === 'spray') {
        var mn = nz2((am || 0) * 14.0 + 2.0, t * 11.0);
        lum *= 1 - 0.09 * Math.max(0, mn);                     // 细雾状微斑
        glossK -= 0.12;                                        // 雾面更哑
      } else if (glazeMethod === 'pour') {
        var pv = clamp((0.32 - t) / 0.32, 0, 1);               // 下半段积釉更厚
        var dr = 0.5 + 0.5 * Math.sin((am || 0) * 7.3 + nz2((am || 0) * 2.4, t * 1.8) * 2.0);
        lum *= 1 + 0.10 * pv;
        r += 10 * pv; g += 8 * pv; b += 6 * pv;
        var tear = clamp((t - 0.55) / 0.45, 0, 1) * Math.max(0, dr - 0.55) * 2.2;
        lum *= 1 - 0.10 * tear;                                // 垂流泪痕
        glossK += 0.14 * tear;
      } else {                                                 // dip 浸釉：最匀、釉膜完整
        glossK += 0.06;
        lum *= 1 + 0.03 * nz2((am || 0) * 2.6, t * 3.4);
      }
    } else {
      // 生坯：干燥哑光、略偏灰陶，让成瓷前后对比鲜明
      lum *= 0.90;
      // 泥料颗粒在明暗上的细碎起伏：粗泥糙、细泥润
      var cg0 = clayOf(CRAFT.clay).grain;
      lum *= 1 - 0.07 * cg0 * (0.5 + 0.5 * nz2((am || 0) * 9.1, t * 23.0));
      // 已施釉：釉浆湿润覆盖素坯，釉色提前显现，且带方式痕迹
      if (CRAFT.glazed) {
        var hw = glazeHueRGB(), hp = 0.34;
        r = r * (1 - hp) + hw[0] * hp;
        g = g * (1 - hp) + hw[1] * hp;
        b = b * (1 - hp) + hw[2] * hp;
        if (glazeMethod === 'brush') {                    // 刷痕：竖向明暗条
          var bs = 0.5 + 0.5 * Math.sin((am || 0) * 9.5 + nz2((am || 0) * 3.2, t * 3.1) * 1.6);
          lum *= 1 - 0.12 * bs; glossK += 0.16 * (1 - bs);
        } else if (glazeMethod === 'spray') {             // 喷釉：雾面更哑
          lum *= 1 - 0.06 * Math.max(0, nz2((am || 0) * 14.0 + 2.0, t * 11.0));
          glossK -= 0.06;
        } else if (glazeMethod === 'pour') {              // 荡釉：下半积釉更厚
          var pvv = clamp((0.36 - t) / 0.36, 0, 1);
          lum *= 1 + 0.10 * pvv; glossK += 0.10 * pvv;
        } else {                                          // 浸釉：最匀最亮
          lum *= 1 + 0.03 * nz2((am || 0) * 2.6, t * 3.4);
          glossK += 0.24;
        }
        lum *= 1.04;                                      // 湿釉比干坯亮
      }
    }

    var sp = nx * HX + ny * HY + nz * HZ; if (sp < 0) sp = 0;
    sp = Math.pow(sp, fired ? (10 + 26 * FIR.gloss) : 24) * glossK;
    return rgbStr(r * lum * sd.ring + sp * 232, g * lum * sd.ring + sp * 228, b * lum * sd.ring + sp * 216);
  }

  // 木轮盘着色
  function woodShade(nx, ny, nz, ao, base) {
    var d = nx * LX + ny * LY + nz * LZ; if (d < 0) d = 0;
    var fl = nx * FX + ny * FY + nz * FZ; if (fl < 0) fl = 0;
    var lum = (0.42 + d * 0.62 + fl * 0.22) * ao;
    return rgbStr(base[0] * lum, base[1] * lum, base[2] * lum);
  }

  /* ---------------- 网格构建 ---------------- */
  // 未处理泥团的表面起伏（随转盘旋转）
  function bumpAt(t, a) {
    return 0.55 * Math.sin(a * 3 + t * 9.3) +
      0.32 * Math.sin(a * 5 - t * 5.1 + 1.7) +
      0.20 * Math.sin(a * 2 + t * 14.2 + 0.6);
  }
  // 手工拉坯不会是正圆：一点低频的不圆度，让转动视角时能看出差别
  function asyAt(t, a) {
    return 1 + (0.024 - 0.013 * work) * (Math.sin(a * 2 + 0.9) + 0.6 * Math.sin(a * 3 - t * 2.2 + 2.4));
  }

  function buildProfile() {
    var e = clamp(work / 0.55, 0, 1);      // 内腔随拉坯逐渐形成
    var shoulder = (1 - work) * 0.30;      // 未处理泥团：顶部圆肩
    for (var i = 0; i < RL; i++) {
      var t = i / (RL - 1);
      var r = radiusAt(t);
      if (t > 0.55) {
        var u = (t - 0.55) / 0.45;
        r *= 1 - shoulder * u * u * (3 - 2 * u);
      }
      prof[i] = r;
      profY[i] = t * hpx;
      var th = lerp(r * 1.02, WALLPX, e);
      profIn[i] = Math.max(0, r - th);
    }
  }

  function buildVerts() {
    var amp = 0.055 * (1 - work) + 0.005;
    var cs = Math.cos(phase), sn = Math.sin(phase);
    for (var i = 0; i < RL; i++) {
      var t = i / (RL - 1), y = profY[i];
      var up = Math.min(RL - 1, i + 1), dn = Math.max(0, i - 1);
      var dy = Math.max(1e-3, profY[up] - profY[dn]);
      var drO = (prof[up] - prof[dn]) / dy;
      var drI = (profIn[up] - profIn[dn]) / dy;
      var nO = Math.sqrt(1 + drO * drO), nI = Math.sqrt(1 + drI * drI);
      var base = i * NA;
      for (var k = 0; k < NA; k++) {
        var ca = COSA[k], sa = SINA[k], am = k * TAU / NA;
        var cw = ca * cs - sa * sn;          // cos(am + phase)
        var sw = sa * cs + ca * sn;          // sin(am + phase)
        var bm = 1 + amp * bumpAt(t, am);
        var idx = base + k;

        var ro = prof[i] * bm * asyAt(t, am);
        project(ro * cw, y, ro * sw);
        oPX[idx] = _px; oPY[idx] = _py; oPZ[idx] = _pz;
        oVX[idx] = _vx; oVY[idx] = _vy; oVZ[idx] = _vz;
        oNX[idx] = cw / nO; oNY[idx] = -drO / nO; oNZ[idx] = sw / nO;

        var ri = profIn[i];
        if (ri > 0.4) {
          var rim = ri * (1 + amp * 0.35 * bumpAt(t, am)) * asyAt(t, am);
          project(rim * cw, y, rim * sw);
          uPX[idx] = _px; uPY[idx] = _py; uPZ[idx] = _pz;
          uVX[idx] = _vx; uVY[idx] = _vy; uVZ[idx] = _vz;
          uNX[idx] = -cw / nI; uNY[idx] = drI / nI; uNZ[idx] = -sw / nI;   // 内壁：朝内腔
        } else {
          uPZ[idx] = 0;
        }
      }
    }
  }

  /* ---------------- 陶器 ---------------- */
  function emitClay() {
    var i, k, k2, a, b, c, d, mx, my, mz, nx, ny, nz, z;
    var fl = Math.round(FLOOR_LV * (RL - 1));
    var showIn = profIn[RL - 1] > 1.2;

    // 外壁
    for (i = 0; i < RL - 1; i++) {
      var t = i / (RL - 1);
      var cr = lvlR[i], cg = lvlG[i], cb = lvlB[i];
      for (k = 0; k < NA; k++) {
        k2 = (k + 1) % NA;
        a = i * NA + k; b = i * NA + k2; c = (i + 1) * NA + k2; d = (i + 1) * NA + k;
        mx = (oVX[a] + oVX[b] + oVX[c] + oVX[d]) * 0.25;
        my = (oVY[a] + oVY[b] + oVY[c] + oVY[d]) * 0.25;
        mz = (oVZ[a] + oVZ[b] + oVZ[c] + oVZ[d]) * 0.25;
        nx = (oNX[a] + oNX[b] + oNX[c] + oNX[d]) * 0.25;
        ny = (oNY[a] + oNY[b] + oNY[c] + oNY[d]) * 0.25;
        nz = (oNZ[a] + oNZ[b] + oNZ[c] + oNZ[d]) * 0.25;
        if (!facing(nx, ny, nz, mx, my, mz)) continue;
        z = (oPZ[a] + oPZ[b] + oPZ[c] + oPZ[d]) * 0.25;
        pushQuad(z, oPX[a], oPY[a], oPX[b], oPY[b], oPX[c], oPY[c], oPX[d], oPY[d],
          clayShade(nx, ny, nz, t, false, cr, cg, cb, (k + 0.5) * TAU / NA));
      }
    }

    // 器底（朝下，正常看不到，防止极低视角穿帮）
    ringA(0.6, prof[0]); ringB(0.6, 0);
    emitBand(0, -1, 0, function (qx, qy, qz, am) { return clayShade(0, -1, 0, 0, false, lvlR[0], lvlG[0], lvlB[0], am); });

    // 实心（还没开出内腔）：顶部封盖，用 3 圈同心环带做径向明暗，避免扇形接缝
    if (!showIn) {
      var cty = profY[RL - 1] + 0.5, crr = prof[RL - 1];
      var cb0 = [lvlR[RL - 1] * 1.04, lvlG[RL - 1] * 1.04, lvlB[RL - 1] * 1.04];
      var cb1 = [lvlR[RL - 1] * 0.99, lvlG[RL - 1] * 0.99, lvlB[RL - 1] * 0.99];
      var cb2 = [lvlR[RL - 1] * 0.93, lvlG[RL - 1] * 0.93, lvlB[RL - 1] * 0.93];
      ringA(cty, 0); ringB(cty, crr * 0.45);
      emitBand(0, 1, 0, function (qx, qy, qz, am) { return clayShade(0, 1, 0, 1, false, cb0[0], cb0[1], cb0[2], am); });
      ringA(cty, crr * 0.45); ringB(cty, crr * 0.75);
      emitBand(0, 1, 0, function (qx, qy, qz, am) { return clayShade(0, 1, 0, 1, false, cb1[0], cb1[1], cb1[2], am); });
      ringA(cty, crr * 0.75); ringB(cty, crr);
      emitBand(0, 1, 0, function (qx, qy, qz, am) { return clayShade(0, 1, 0, 1, false, cb2[0], cb2[1], cb2[2], am); });
    }

    if (!showIn) return;

    // 内壁：法线朝内腔，只有「对侧」内壁会朝向相机 —— 正好是透过口沿看到的那一片
    for (i = fl; i < RL - 1; i++) {
      var t2 = i / (RL - 1);
      var ir = lvlR[i], ig = lvlG[i], ib = lvlB[i];
      for (k = 0; k < NA; k++) {
        k2 = (k + 1) % NA;
        a = i * NA + k; b = i * NA + k2; c = (i + 1) * NA + k2; d = (i + 1) * NA + k;
        if (uPZ[a] === 0 || uPZ[b] === 0 || uPZ[c] === 0 || uPZ[d] === 0) continue;
        mx = (uVX[a] + uVX[b] + uVX[c] + uVX[d]) * 0.25;
        my = (uVY[a] + uVY[b] + uVY[c] + uVY[d]) * 0.25;
        mz = (uVZ[a] + uVZ[b] + uVZ[c] + uVZ[d]) * 0.25;
        nx = (uNX[a] + uNX[b] + uNX[c] + uNX[d]) * 0.25;
        ny = (uNY[a] + uNY[b] + uNY[c] + uNY[d]) * 0.25;
        nz = (uNZ[a] + uNZ[b] + uNZ[c] + uNZ[d]) * 0.25;
        if (!facing(nx, ny, nz, mx, my, mz)) continue;
        z = (uPZ[a] + uPZ[b] + uPZ[c] + uPZ[d]) * 0.25;
        pushQuad(z, uPX[a], uPY[a], uPX[b], uPY[b], uPX[c], uPY[c], uPX[d], uPY[d],
          clayShade(nx, ny, nz, t2, true, ir, ig, ib, (k + 0.5) * TAU / NA));
      }
    }

    // 内腔底面
    var fr = profIn[fl];
    if (fr > 1.0) {
      ringA(profY[fl] + 0.4, fr); ringB(profY[fl] + 0.4, 0);
      emitBand(0, 1, 0, function (qx, qy, qz, am) { return clayShade(0, 1, 0, FLOOR_LV, true, lvlR[fl], lvlG[fl], lvlB[fl], am); });
    }

    // 口沿环面（外沿 -> 内沿）
    var top = (RL - 1) * NA;
    for (k = 0; k < NA; k++) {
      k2 = (k + 1) % NA;
      a = top + k; b = top + k2;
      mx = (oVX[a] + oVX[b] + uVX[b] + uVX[a]) * 0.25;
      my = (oVY[a] + oVY[b] + uVY[b] + uVY[a]) * 0.25;
      mz = (oVZ[a] + oVZ[b] + uVZ[b] + uVZ[a]) * 0.25;
      if (!facing(0, 1, 0, mx, my, mz)) continue;
      z = (oPZ[a] + oPZ[b] + uPZ[b] + uPZ[a]) * 0.25;
      pushQuad(z, oPX[a], oPY[a], oPX[b], oPY[b], uPX[b], uPY[b], uPX[a], uPY[a],
        clayShade(0, 1, 0, 1, false, lvlR[RL - 1], lvlG[RL - 1], lvlB[RL - 1], (k + 0.5) * TAU / NA));
    }
  }

  /* ---------------- 轮盘 ---------------- */
  var rAX = new Float32Array(NA), rAY = new Float32Array(NA), rAZ = new Float32Array(NA);
  var rAVX = new Float32Array(NA), rAVY = new Float32Array(NA), rAVZ = new Float32Array(NA);
  var rBX = new Float32Array(NA), rBY = new Float32Array(NA), rBZ = new Float32Array(NA);
  var rBVX = new Float32Array(NA), rBVY = new Float32Array(NA), rBVZ = new Float32Array(NA);

  function ringA(y, r) {
    for (var k = 0; k < NA; k++) {
      project(r * COSA[k], y, r * SINA[k]);
      rAX[k] = _px; rAY[k] = _py; rAZ[k] = _pz; rAVX[k] = _vx; rAVY[k] = _vy; rAVZ[k] = _vz;
    }
  }
  function ringB(y, r) {
    for (var k = 0; k < NA; k++) {
      project(r * COSA[k], y, r * SINA[k]);
      rBX[k] = _px; rBY[k] = _py; rBZ[k] = _pz; rBVX[k] = _vx; rBVY[k] = _vy; rBVZ[k] = _vz;
    }
  }
  // 由 ringA / ringB 组成的环带；nx 传 null 表示「圆顶」：
  // 剔除仍用真实几何法线(0,1,0)，只有着色用法线随环向微倾，避免斜视时误剔除
  function emitBand(nx, ny, nz, colFn) {
    for (var k = 0; k < NA; k++) {
      var k2 = (k + 1) % NA;
      var mx = (rAVX[k] + rAVX[k2] + rBVX[k2] + rBVX[k]) * 0.25;
      var my = (rAVY[k] + rAVY[k2] + rBVY[k2] + rBVY[k]) * 0.25;
      var mz = (rAVZ[k] + rAVZ[k2] + rBVZ[k2] + rBVZ[k]) * 0.25;
      var cnx = nx, cny = ny, cnz = nz;
      if (cnx === null) {
        var am = (k + 0.5) * TAU / NA;
        cnx = Math.cos(am) * 0.15; cnz = Math.sin(am) * 0.15;
        var nl = Math.sqrt(cnx * cnx + 1 + cnz * cnz);
        cnx /= nl; cny = 1 / nl; cnz /= nl;
        nx = 0; ny = 1; nz = 0;
      }
      if (!facing(nx, ny, nz, mx, my, mz)) continue;
      var z = (rAZ[k] + rAZ[k2] + rBZ[k2] + rBZ[k]) * 0.25;
      pushQuad(z, rAX[k], rAY[k], rBX[k], rBY[k], rBX[k2], rBY[k2], rAX[k2], rAY[k2], colFn(cnx, cny, cnz, (k + 0.5) * TAU / NA));
    }
  }

  var WOOD_TOP = [242, 233, 220], WOOD_SIDE = [226, 213, 195], WOOD_COL = [222, 208, 188];

  // 陶泥在轮面上留下的接触阴影
  function wheelAO(r) {
    var rb = prof[0];
    var dd = r - rb;
    if (dd < 0) return 0.60;
    var f = clamp(dd / (rb * 1.15 + 10), 0, 1);
    return 0.62 + 0.38 * f * f;
  }

  function emitWheel() {
    var bands = [0, 0.34, 0.60, 0.82, 1.0];
    var i, k;

    // 台面（分环带，便于按半径做接触阴影）
    for (i = 0; i < bands.length - 1; i++) {
      var r0 = bands[i] * S, r1 = bands[i + 1] * S;
      var rm = (r0 + r1) * 0.5;
      ringA(0, r0); ringB(0, r1);
      emitBand(0, 1, 0, function () { return woodShade(0, 1, 0, wheelAO(rm), WOOD_TOP); });
    }

    // 台面上的同心圈
    var rings = [0.34, 0.56, 0.75, 0.92];
    for (i = 0; i < rings.length; i++) {
      var rr = rings[i] * S;
      ringA(0.7, rr - 0.8); ringB(0.7, rr + 0.8);
      emitBand(0, 1, 0, function () { return 'rgb(196,178,152)'; });
    }

    // 旋转刻痕：随转盘转动，是「在转」的主要线索
    var N = 26;
    for (i = 0; i < N; i++) {
      var ang = phase + i * TAU / N;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var r0s = S * 0.895, r1s = S * 0.965;
      var w = 0.6;
      var x0 = r0s * ca - (-sa) * w, z0 = r0s * sa - ca * w;
      var x1 = r0s * ca + (-sa) * w, z1 = r0s * sa + ca * w;
      var x2 = r1s * ca + (-sa) * w, z2 = r1s * sa + ca * w;
      var x3 = r1s * ca - (-sa) * w, z3 = r1s * sa - ca * w;
      project(x0, 0.8, z0); var ax = _px, ay = _py, az = _pz, avx = _vx, avy = _vy, avz = _vz;
      project(x1, 0.8, z1); var bx = _px, by = _py, bz2 = _pz;
      project(x2, 0.8, z2); var cx2 = _px, cy2 = _py, cz2 = _pz;
      project(x3, 0.8, z3); var dx2 = _px, dy2 = _py, dz2 = _pz;
      if (!facing(0, 1, 0, avx, avy, avz)) continue;
      pushQuad((az + bz2 + cz2 + dz2) * 0.25, ax, ay, bx, by, cx2, cy2, dx2, dy2, 'rgb(183,163,135)');
    }

    // 轮盘侧壁
    ringA(0, S); ringB(-12, S);
    for (k = 0; k < NA; k++) {
      var k2 = (k + 1) % NA;
      var nx = (COSA[k] + COSA[k2]) * 0.5, nz = (SINA[k] + SINA[k2]) * 0.5;
      var nl = Math.sqrt(nx * nx + nz * nz) || 1;
      nx /= nl; nz /= nl;
      var mx = (rAVX[k] + rAVX[k2] + rBVX[k2] + rBVX[k]) * 0.25;
      var my = (rAVY[k] + rAVY[k2] + rBVY[k2] + rBVY[k]) * 0.25;
      var mz = (rAVZ[k] + rAVZ[k2] + rBVZ[k2] + rBVZ[k]) * 0.25;
      if (!facing(nx, 0, nz, mx, my, mz)) continue;
      var zz = (rAZ[k] + rAZ[k2] + rBZ[k2] + rBZ[k]) * 0.25;
      pushQuad(zz, rAX[k], rAY[k], rBX[k], rBY[k], rBX[k2], rBY[k2], rAX[k2], rAY[k2],
        woodShade(nx, 0, nz, 1, WOOD_SIDE));
    }

    // 支柱（下粗上细的锥台）
    var yTop = -12, yBot = -12 - S * 0.42;
    var rT = S * 0.30, rB = S * 0.46;
    var slp = (rB - rT) / (yBot - yTop);
    var nl2 = Math.sqrt(1 + slp * slp);
    ringA(yTop, rT); ringB(yBot, rB);
    for (k = 0; k < NA; k++) {
      var k3 = (k + 1) % NA;
      var px2 = (COSA[k] + COSA[k3]) * 0.5, pz2 = (SINA[k] + SINA[k3]) * 0.5;
      var pl = Math.sqrt(px2 * px2 + pz2 * pz2) || 1;
      var nx3 = px2 / pl / nl2, nz3 = pz2 / pl / nl2, ny3 = -slp / nl2;
      var mx3 = (rAVX[k] + rAVX[k3] + rBVX[k3] + rBVX[k]) * 0.25;
      var my3 = (rAVY[k] + rAVY[k3] + rBVY[k3] + rBVY[k]) * 0.25;
      var mz3 = (rAVZ[k] + rAVZ[k3] + rBVZ[k3] + rBVZ[k]) * 0.25;
      if (!facing(nx3, ny3, nz3, mx3, my3, mz3)) continue;
      var z3 = (rAZ[k] + rAZ[k3] + rBZ[k3] + rBZ[k]) * 0.25;
      pushQuad(z3, rAX[k], rAY[k], rBX[k], rBY[k], rBX[k3], rBY[k3], rAX[k3], rAY[k3],
        woodShade(nx3, ny3, nz3, 1, WOOD_COL));
    }
  }

  /* ---------------- 泥面颗粒 ---------------- */
  var SPECK = (function () {
    var a = [];
    for (var i = 0; i < 120; i++) {
      a.push({
        ang: Math.random() * TAU,
        lv: Math.pow(Math.random(), 0.9),
        s: 0.5 + Math.random() * 1.1,
        al: 0.08 + Math.random() * 0.18,
        dark: Math.random() < 0.5
      });
    }
    return a;
  })();

  function profAt(t) {
    var x = clamp(t, 0, 1) * (RL - 1);
    var i0 = Math.floor(x), i1 = Math.min(RL - 1, i0 + 1);
    return lerp(prof[i0], prof[i1], x - i0);
  }

  function drawSpecks() {
    var amp = 0.055 * (1 - work) + 0.005;
    var clayId = clayOf(CRAFT.clay).id, clayGrain = clayOf(CRAFT.clay).grain;
    // 每种泥料一套专属颗粒特征：大小 / 密度 / 深浅两色——质地肉眼可辨
    // grain: 粗陶1.0 > 混合0.7 > 红泥0.62 > 紫金0.48 > 细白0.22
    var LOOK = {
      coarse: { szMul: 2.6, dens: 0.92, dark: '#4e3a28', lite: '#d3b890' },
      blend:  { szMul: 1.8, dens: 0.72, dark: '#5c4430', lite: '#e2c9a5' },
      red:    { szMul: 1.1, dens: 0.95, dark: '#6e3226', lite: '#c48a68' },   // 铁质细黑点密布
      zisha:  { szMul: 1.4, dens: 0.55, dark: '#3c2830', lite: '#b58a90' },   // 紫砂双气孔：砂点+云母亮点
      fine:   { szMul: 0.7, dens: 0.18, dark: '#9a8a76', lite: '#f4ead8' }    // 几乎无颗粒
    };
    var LK = LOOK[clayId] || LOOK.blend;
    // 生坯：颗粒随泥料粗细；成瓷：釉面把颗粒盖住，越亮越平滑
    var roughAmt = (0.22 + 0.78 * clayGrain) * (1 - work * 0.40);
    if (CRAFT.fired && FIR) roughAmt *= Math.max(0, 0.25 - 0.55 * FIR.gloss);
    if (roughAmt < 0.04) return;                                 // 釉面平滑，无需颗粒
    // 实心时顶部是近乎侧视的盖子，颗粒投上去会形成摩尔纹，跳过
    var capLim = profIn[RL - 1] > 1.2 ? 1.01 : 0.55;
    ctx.globalAlpha = 1;
    var alphaCap = 0.14 + 0.30 * clayGrain;                      // 越粗颗粒越醒目
    for (var i = 0; i < SPECK.length; i++) {
      var sp = SPECK[i];
      var am = sp.ang;                       // 材料角
      var aw = am + phase;                   // 世界角（随转盘转动）
      var ca = Math.cos(aw), sa = Math.sin(aw);
      var t = sp.lv;
      if (t > capLim) continue;
      // 密度筛：确定性散列，粗泥几乎全保留、细泥大片剔除
      var hv = ((i * 40503 + 7919) % 1000) / 1000;
      if (hv > LK.dens) continue;
      // 紫砂云母亮点：少量小颗粒反光
      var mica = clayId === 'zisha' && hv < 0.08;
      var r = profAt(t) * (1 + amp * bumpAt(t, am)) * asyAt(t, am);
      var y = t * hpx;
      project(r * ca, y, r * sa);
      if (!facing(ca, 0, sa, _vx, _vy, _vz)) continue;          // 背面
      var sc = focal / _pz;
      var sz = sp.s * sc * (0.55 + 0.35 * (1 - work)) * 0.7 * (mica ? 0.6 : LK.szMul);
      if (sz < 0.2) continue;
      var al = sp.al * roughAmt * (0.35 + 0.65 * sc / sc0) * (mica ? 1.6 : 1);
      if (t > 0.8) al *= 1 - (t - 0.8) / 0.2 * 0.7;              // 顶部圆肩上颗粒渐隐
      if (al < 0.012) continue;
      ctx.globalAlpha = Math.min(alphaCap, al);                  // 粗泥允许更醒目
      ctx.fillStyle = mica ? '#f2e2c8' : (sp.dark ? LK.dark : LK.lite);
      ctx.beginPath();
      ctx.ellipse(_px, _py, sz, sz * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 地面投影 ---------------- */
  function drawGround() {
    var y = -12 - S * 0.42;
    project(0, y, 0);
    var gx = _px, gy = _py, sc = focal / _pz;
    var rx = S * 1.25 * sc;
    var sq = Math.max(0.06, Math.sin(cam.pitch));
    var ry = rx * sq;
    var rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rx);
    rg.addColorStop(0, 'rgba(199,180,156,0.40)');
    rg.addColorStop(0.5, 'rgba(201,183,159,0.15)');
    rg.addColorStop(1, 'rgba(203,185,161,0)');
    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- 绘制主流程 ---------------- */
  function paintScene() {
    var n = qCnt, i;
    for (i = 0; i < n; i++) order[i] = i;
    var idx = order.subarray(0, n);
    idx.sort(function (a, b) { return qZ[b] - qZ[a]; });
    for (i = 0; i < n; i++) {
      var q = idx[i], b = q * 8;
      ctx.beginPath();
      ctx.moveTo(qP[b], qP[b + 1]);
      ctx.lineTo(qP[b + 2], qP[b + 3]);
      ctx.lineTo(qP[b + 4], qP[b + 5]);
      ctx.lineTo(qP[b + 6], qP[b + 7]);
      ctx.closePath();
      ctx.fillStyle = qC[q];
      ctx.fill();
    }
  }

  // 入窑后：窑火氛围的暖光晕，强度随受火强度与温度变化
  function drawKilnGlow() {
    if (!FIR) return;
    var yc = baseY - hpx * sc0 * 0.45;
    var rg = ctx.createRadialGradient(cx, yc, 8, cx, yc, S * 1.7);
    var a = 0.06 + FIR.fireStr * 0.15;
    rg.addColorStop(0, 'rgba(222,124,54,' + (a * 0.85).toFixed(3) + ')');
    rg.addColorStop(0.55, 'rgba(200,104,46,' + (a * 0.30).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(184,94,42,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, Hp);
    ctx.restore();
  }

  /* ---------------- 制作环境（随工序切换，增强沉浸感） ---------------- */
  function groundPt() {
    project(0, -12 - S * 0.42, 0);
    var gx = _px, gy = _py, sc = focal / _pz;
    var rx = S * 1.25 * sc;
    var sq = Math.max(0.06, Math.sin(cam.pitch));
    return { x: gx, y: gy, rx: rx, ry: rx * sq, sc: sc };
  }
  function darker(c, k) {  // c: [r,g,b]
    return 'rgb(' + Math.max(0, c[0] + k) + ',' + Math.max(0, c[1] + k) + ',' + Math.max(0, c[2] + k) + ')';
  }

  function drawBackdrop() {
    if (envKind === 'studio') drawStudio();
    else if (envKind === 'wheel') drawWheelEnv();
    else if (envKind === 'glaze') drawGlazeEnv();
    else if (envKind === 'kiln') drawKilnBack();
  }
  // 工作室：柔和聚焦暖光
  function drawStudio() {
    var rg = ctx.createRadialGradient(cx, baseY - S * 0.55, S * 0.15, cx, baseY - S * 0.55, S * 2.6);
    rg.addColorStop(0, 'rgba(255,250,242,0.55)');
    rg.addColorStop(1, 'rgba(245,239,230,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, Hp);
  }
  // 转盘工序：木作台面
  function drawWheelEnv() {
    var g = groundPt();
    ctx.save();
    ctx.fillStyle = 'rgba(58,47,40,0.13)';
    ctx.fillRect(0, g.y + g.ry * 0.55, W, Hp - (g.y + g.ry * 0.55));
    ctx.fillStyle = 'rgba(58,47,40,0.20)';
    ctx.fillRect(0, g.y + g.ry * 0.55, W, 1.5);
    ctx.restore();
  }
  // 釉缸缸口：对齐器物底座（世界 y=0 的台面），器物因而"立于缸中"
  // 同时给出器物在屏幕上的真实上下界与半宽，供上釉动画精确覆盖
  function glazeMouth() {
    project(0, 0, 0);
    var mx = _px, my = _py, sc = focal / _pz;
    var sq = Math.max(0.06, Math.sin(cam.pitch));
    var maxR = 0;
    for (var i = 0; i < SEG; i++) if (rN[i] > maxR) maxR = rN[i];
    project(0, Math.max(hpx, S * 0.30), 0);
    var ty = _py;
    var rx = S * 1.06 * sc;
    return {
      x: mx, y: my, rx: rx, ry: rx * sq, sc: sc, h: S * 0.42 * sc,
      top: Math.min(ty, my - S * 0.30), halfW: Math.max(24, maxR * RBASE * sc)
    };
  }

  // 施釉工序（背景层）：缸口内圈 + 釉浆液面（远侧）
  function drawGlazeEnv() {
    var m = glazeMouth();
    var rgb = glazeHueRGB();
    ctx.save();
    // 缸口内圈（深色陶壁）
    ctx.beginPath(); ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2e27'; ctx.fill();
    // 釉浆液面
    ctx.save();
    ctx.beginPath(); ctx.ellipse(m.x, m.y, m.rx * 0.93, m.ry * 0.93, 0, 0, Math.PI * 2); ctx.clip();
    var lg = ctx.createRadialGradient(m.x - m.rx * 0.35, m.y - m.ry * 0.42, m.ry * 0.12, m.x, m.y, m.rx * 1.05);
    lg.addColorStop(0, rgbaOf(mixRGB(rgb, [255, 255, 255], 0.34), 0.99));
    lg.addColorStop(0.55, rgbaOf(rgb, 0.97));
    lg.addColorStop(1, rgbaOf(mixRGB(rgb, [18, 12, 8], 0.34), 0.99));
    ctx.fillStyle = lg;
    ctx.fillRect(m.x - m.rx, m.y - m.ry, m.rx * 2, m.ry * 2);
    // 釉浆缓慢流动的漩涡
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3;
    for (var sI = 0; sI < 3; sI++) {
      ctx.beginPath();
      for (var aI = 0; aI <= 28; aI++) {
        var aa = aI / 28 * Math.PI * 2;
        var rr = m.rx * (0.20 + sI * 0.24) * (1 + 0.07 * Math.sin(aa * 3 + tNow * 0.0012 + sI));
        var px2 = m.x + Math.cos(aa + tNow * 0.0004 * (sI + 1)) * rr;
        var py2 = m.y + Math.sin(aa + tNow * 0.0004 * (sI + 1)) * rr * (m.ry / m.rx);
        if (aI === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 缸口沿（远半圈高光）
    ctx.strokeStyle = 'rgba(242,230,214,0.55)'; ctx.lineWidth = Math.max(1, m.rx * 0.022);
    ctx.beginPath(); ctx.ellipse(m.x, m.y, m.rx * 0.985, m.ry * 0.985, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke();
    ctx.restore();
  }

  // 釉缸（前景层）：近侧缸壁遮住器物下端 + 缸口前沿高光，形成"立于缸中"的进深
  function drawGlazeFront() {
    var m = glazeMouth();
    var R = m.rx, rY = m.ry, H = m.h;
    ctx.save();
    // 近侧缸壁：上缘为缸口近半圈弧，向下收成陶缸
    ctx.beginPath();
    ctx.moveTo(m.x + R, m.y);
    ctx.ellipse(m.x, m.y, R, rY, 0, 0, Math.PI);          // 右 → 下 → 左
    ctx.bezierCurveTo(m.x - R * 1.14, m.y + H * 0.42, m.x - R * 0.90, m.y + H * 0.78, m.x - R * 0.58, m.y + H * 0.94);
    ctx.lineTo(m.x + R * 0.58, m.y + H * 0.94);
    ctx.bezierCurveTo(m.x + R * 0.90, m.y + H * 0.78, m.x + R * 1.14, m.y + H * 0.42, m.x + R, m.y);
    ctx.closePath();
    var wg = ctx.createLinearGradient(m.x - R, 0, m.x + R, 0);
    wg.addColorStop(0, '#5b4a3e'); wg.addColorStop(0.26, '#8b7561');
    wg.addColorStop(0.50, '#a18972'); wg.addColorStop(0.76, '#7b6553'); wg.addColorStop(1, '#483b33');
    ctx.fillStyle = wg; ctx.fill();
    // 近侧缸口沿高光弧
    ctx.strokeStyle = 'rgba(246,236,222,0.62)'; ctx.lineWidth = Math.max(1.2, R * 0.020);
    ctx.beginPath(); ctx.ellipse(m.x, m.y, R * 0.985, rY * 0.985, 0, 0.02, Math.PI - 0.02); ctx.stroke();
    ctx.restore();
  }

  // 毛刷道具
  function drawBrush(x, y, rgb) {
    ctx.save();
    // 刷杆
    var hg = ctx.createLinearGradient(x, y - S * 0.5, x, y - S * 0.2);
    hg.addColorStop(0, '#a97f4e'); hg.addColorStop(1, '#7d5a34');
    ctx.fillStyle = hg;
    ctx.fillRect(x - S * 0.035, y - S * 0.52, S * 0.07, S * 0.34);
    // 金属箍
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(x - S * 0.045, y - S * 0.20, S * 0.09, S * 0.05);
    // 刷头（沾釉）
    ctx.fillStyle = rgbaOf(rgb, 0.95);
    ctx.beginPath();
    ctx.moveTo(x - S * 0.05, y - S * 0.15);
    ctx.lineTo(x + S * 0.05, y - S * 0.15);
    ctx.lineTo(x + S * 0.035, y - S * 0.02);
    ctx.lineTo(x - S * 0.035, y - S * 0.02);
    ctx.closePath(); ctx.fill();
    // 刷毛
    ctx.strokeStyle = rgbaOf(mixRGB(rgb, [255, 255, 255], 0.3), 0.85);
    ctx.lineWidth = 1;
    for (var i = 0; i < 6; i++) {
      var bx = x - S * 0.04 + i * S * 0.016;
      ctx.beginPath(); ctx.moveTo(bx, y - S * 0.05); ctx.lineTo(bx, y + S * 0.02); ctx.stroke();
    }
    ctx.restore();
  }

  // 喷枪道具
  function drawSprayer(x, y, rgb) {
    ctx.save();
    var bg = ctx.createLinearGradient(x - S * 0.12, y, x + S * 0.12, y);
    bg.addColorStop(0, '#7d838a'); bg.addColorStop(0.5, '#b6bcc2'); bg.addColorStop(1, '#6d737a');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x - S * 0.16, y + S * 0.10);
    ctx.lineTo(x + S * 0.14, y - S * 0.02);
    ctx.lineTo(x + S * 0.14, y + S * 0.10);
    ctx.lineTo(x - S * 0.16, y + S * 0.20);
    ctx.closePath(); ctx.fill();
    // 喷嘴
    ctx.fillStyle = '#4f555b';
    ctx.beginPath(); ctx.arc(x + S * 0.15, y + S * 0.05, S * 0.03, 0, Math.PI * 2); ctx.fill();
    // 壶体
    ctx.fillStyle = '#8b9199';
    ctx.beginPath(); ctx.ellipse(x - S * 0.20, y + S * 0.26, S * 0.10, S * 0.13, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgbaOf(rgb, 0.85);
    ctx.beginPath(); ctx.ellipse(x - S * 0.20, y + S * 0.22, S * 0.07, S * 0.05, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 上釉动画：p 0→1，不同施釉方式动作不同
  function drawGlazeApply(p, method) {
    var m = glazeMouth();
    var rgb = glazeHueRGB();
    var R = m.rx, rY = m.ry, sc = m.sc;
    var top = m.top;                            // 器物顶端（屏幕坐标）
    var halfW = m.halfW;                        // 器物半宽（屏幕坐标）
    // 动画末段随湿釉色接管而淡出，避免收尾突兀
    var fade = p > 0.72 ? Math.max(0, 1 - (p - 0.72) / 0.28) : 1;

    if (method === 'dip') {
      // 釉浆沿器身向上漫过（器物下沉感），末段淡出交给湿釉色
      var climb = clamp(p / 0.62, 0, 1);
      var span = Math.max(40, m.y - m.top + S * 0.10 * sc);
      var level = m.y - climb * span;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.rect(m.x - R, level, R * 2, m.y - level + 8);
      ctx.clip();
      var wg = ctx.createLinearGradient(0, level, 0, m.y);
      wg.addColorStop(0, rgbaOf(mixRGB(rgb, [255, 255, 255], 0.30), 0.80));
      wg.addColorStop(0.35, rgbaOf(rgb, 0.86));
      wg.addColorStop(1, rgbaOf(mixRGB(rgb, [22, 15, 10], 0.30), 0.95));
      ctx.fillStyle = wg;
      ctx.fillRect(m.x - R, level, R * 2, m.y - level + 10);
      // 液面波纹
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.2;
      for (var wI = 0; wI < 3; wI++) {
        ctx.beginPath();
        for (var xI = 0; xI <= 22; xI++) {
          var xx = m.x - halfW * 1.8 + (xI / 22) * halfW * 3.6;
          var yy = level + wI * 5 + Math.sin(xI * 0.85 + tNow * 0.004 + wI) * 2.4;
          if (xI === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
      // 釉面（随器物下沉而起的缸内釉面）
      ctx.save();
      ctx.globalAlpha = fade * 0.8;
      ctx.beginPath(); ctx.ellipse(m.x, level, R, rY, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgbaOf(mixRGB(rgb, [255, 255, 255], 0.12), 0.5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      drawGlazeFront();
      return;
    }

    ctx.save();
    ctx.globalAlpha = fade;
    if (method === 'brush') {
      // 釉痕自上而下逐段出现
      var n = 7;
      for (var bI = 0; bI < n; bI++) {
        var seg = clamp(p * n - bI, 0, 1);
        if (seg <= 0) continue;
        var y0 = top + (m.y - top) * (bI / n);
        var y1 = top + (m.y - top) * ((bI + 1) / n);
        ctx.save();
        ctx.beginPath();
        ctx.rect(m.x - halfW * 1.45, y0, halfW * 2.9, (y1 - y0) * seg);
        ctx.clip();
        ctx.fillStyle = rgbaOf(rgb, 0.46);
        ctx.fillRect(m.x - halfW * 1.45, y0, halfW * 2.9, y1 - y0);
        // 刷毛竖痕
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
        for (var sI = 0; sI < 9; sI++) {
          var sx = m.x - halfW * 1.25 + sI * (halfW * 2.5 / 8);
          ctx.beginPath(); ctx.moveTo(sx, y0); ctx.lineTo(sx, y1); ctx.stroke();
        }
        ctx.restore();
      }
      var by = top + (m.y - top) * clamp(p * 1.06, 0, 1);
      drawBrush(m.x + halfW * 1.62, by, rgb);
      ctx.restore();
      drawGlazeFront();
      return;
    }

    if (method === 'spray') {
      var nz = { x: m.x - R * 1.15, y: top - S * 0.20 * sc };
      var tg = { x: m.x - halfW * 0.15, y: top + (m.y - top) * 0.46 };
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var cone = ctx.createLinearGradient(nz.x, nz.y, tg.x, tg.y);
      cone.addColorStop(0, rgbaOf(mixRGB(rgb, [255, 255, 255], 0.55), 0.0));
      cone.addColorStop(0.55, rgbaOf(rgb, 0.15 * p));
      cone.addColorStop(1, rgbaOf(rgb, 0.05 * p));
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(nz.x, nz.y);
      ctx.lineTo(tg.x + R * 0.70, tg.y - S * 0.34 * sc);
      ctx.lineTo(tg.x + R * 0.70, tg.y + S * 0.44 * sc);
      ctx.closePath(); ctx.fill();
      // 雾滴
      ctx.fillStyle = rgbaOf(mixRGB(rgb, [255, 255, 255], 0.5), 0.42);
      for (var dI = 0; dI < 28; dI++) {
        var pr = ((dI * 137) % 100) / 100;
        var tt2 = clamp(p * 1.25 - pr * 0.35, 0, 1);
        var dx = nz.x + (tg.x - nz.x) * tt2 + Math.sin(dI * 2.1 + tNow * 0.004) * 7;
        var dy = nz.y + (tg.y - nz.y) * tt2 + Math.cos(dI * 1.7 + tNow * 0.005) * 9;
        ctx.beginPath(); ctx.arc(dx, dy, 1.2 + pr * 2.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // 器表逐渐覆盖的雾面釉层
      var cover = clamp(p * 1.05, 0, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.x - halfW * 1.4, top, halfW * 2.8, (m.y - top) * cover);
      ctx.clip();
      ctx.fillStyle = rgbaOf(rgb, 0.32);
      ctx.fillRect(m.x - halfW * 1.4, top, halfW * 2.8, m.y - top);
      // 细密雾点
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      for (var mI = 0; mI < 40; mI++) {
        var mx2 = m.x - halfW * 1.3 + ((mI * 977) % 1000) / 1000 * halfW * 2.6;
        var my2 = top + ((mI * 613) % 1000) / 1000 * (m.y - top);
        ctx.beginPath(); ctx.arc(mx2, my2, 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      drawSprayer(nz.x, nz.y, rgb);
      ctx.restore();
      drawGlazeFront();
      return;
    }

    // pour 荡釉：自上而下的釉流 + 器身流挂
    var streamX = m.x + halfW * 0.18;
    var hit = top + (m.y - top) * 0.24;
    var sg = ctx.createLinearGradient(streamX, top - S * 0.6 * sc, streamX, hit);
    sg.addColorStop(0, rgbaOf(mixRGB(rgb, [255, 255, 255], 0.38), 0.95));
    sg.addColorStop(1, rgbaOf(rgb, 0.94));
    ctx.strokeStyle = sg;
    ctx.lineWidth = S * 0.07 * sc * (0.75 + 0.25 * Math.sin(tNow * 0.012));
    ctx.beginPath();
    ctx.moveTo(streamX + Math.sin(tNow * 0.003) * 3.5, top - S * 0.62 * sc);
    ctx.quadraticCurveTo(streamX, hit - S * 0.12 * sc, streamX, hit);
    ctx.stroke();
    // 落在器身上并向下流挂
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.x - halfW * 1.4, hit, halfW * 2.8, m.y - hit + 6);
    ctx.clip();
    ctx.fillStyle = rgbaOf(rgb, 0.44 * clamp(p * 1.4, 0, 1));
    ctx.fillRect(m.x - halfW * 1.4, hit, halfW * 2.8, m.y - hit + 6);
    ctx.strokeStyle = rgbaOf(mixRGB(rgb, [22, 15, 10], 0.18), 0.45);
    ctx.lineWidth = 2.2;
    for (var fI = 0; fI < 6; fI++) {
      var fx2 = m.x - halfW + fI * (halfW * 2 / 5);
      var flen = (m.y - hit) * clamp(p * 1.35 - fI * 0.06, 0, 1);
      ctx.beginPath(); ctx.moveTo(fx2, hit); ctx.lineTo(fx2, hit + flen); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    drawGlazeFront();
  }
  // 烧成工序：砖砌窑炉（窑身与窑门在器物之后，火苗在器物之前）
  // 窑门拱形几何（封窑门动画与窑腔共用）
  function kilnMouthGeom() {
    var g = groundPt();
    var bw = S * 1.75, top = g.y - S * 1.85, depth = g.y - top;
    var ow = bw * 0.60, oh = depth * 0.84;
    return { x: g.x, y: g.y, bw: bw, top: top, depth: depth, ow: ow, oh: oh, sc: g.sc };
  }
  function drawKilnBack() {
    var g = groundPt();
    var bw = S * 1.75, top = g.y - S * 1.85, depth = g.y - top;
    var pos = posOf(CRAFT.firing.pos), wood = woodOf(CRAFT.firing.wood);
    ctx.save();
    // 落地投影：让窑体立于地面而非浮空
    ctx.fillStyle = 'rgba(40,26,18,0.16)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y + S * 0.07, bw * 1.16, S * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    // 左右窑壁（竖直渐变：底部落地处最暗）
    var wg = ctx.createLinearGradient(0, top, 0, g.y);
    wg.addColorStop(0, '#7a4e35'); wg.addColorStop(0.55, '#5f3c2a'); wg.addColorStop(1, '#462c20');
    ctx.fillStyle = wg;
    ctx.fillRect(g.x - bw, top, S * 0.40, depth);
    ctx.fillRect(g.x + bw - S * 0.40, top, S * 0.40, depth);
    // 拱顶（径向渐变：顶部受光、两肩沉暗，呈半球体积）
    ctx.beginPath();
    ctx.moveTo(g.x - bw, top);
    ctx.arc(g.x, top, bw, Math.PI, 0);
    ctx.lineTo(g.x + bw, top + S * 0.34);
    ctx.lineTo(g.x - bw, top + S * 0.34);
    ctx.closePath();
    var dg = ctx.createRadialGradient(g.x, top - bw * 0.25, bw * 0.15, g.x, top - bw * 0.1, bw * 1.25);
    dg.addColorStop(0, '#8f5e3e'); dg.addColorStop(0.55, '#6b4230'); dg.addColorStop(1, '#4a2e21');
    ctx.fillStyle = dg; ctx.fill();
    // 拱顶放射状砖缝（顺着半球曲面走，立体感来源之一）
    ctx.strokeStyle = 'rgba(28,17,11,0.38)'; ctx.lineWidth = 1;
    for (var ai = 0; ai <= 8; ai++) {
      var aa = Math.PI + Math.PI * (ai / 8);
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(aa) * bw * 0.30, top + Math.sin(aa) * bw * 0.30);
      ctx.lineTo(g.x + Math.cos(aa) * bw, top + Math.sin(aa) * bw);
      ctx.stroke();
    }
    // 拱顶两道弧形砖带
    for (var bi = 1; bi <= 2; bi++) {
      ctx.beginPath();
      ctx.arc(g.x, top, bw * (0.45 + bi * 0.27), Math.PI, 0);
      ctx.stroke();
    }
    // 墙面砖纹：横缝 + 上下层错缝竖线
    var rows = 6, brickW = bw * 0.5;
    for (var rI = 1; rI <= rows; rI++) {
      var yy = top + S * 0.34 + (depth - S * 0.34) * (rI / (rows + 1));
      ctx.beginPath(); ctx.moveTo(g.x - bw, yy); ctx.lineTo(g.x + bw, yy); ctx.stroke();
      var off = (rI % 2) * brickW * 0.5;
      for (var bx = -bw + off; bx < bw; bx += brickW) {
        if (Math.abs(bx) < bw - S * 0.42) continue;   // 竖缝只画在两侧墙面上
        ctx.beginPath(); ctx.moveTo(g.x + bx, yy - (depth - S * 0.34) / (rows + 1)); ctx.lineTo(g.x + bx, yy); ctx.stroke();
      }
    }
    // 窑门
    var ow = bw * 0.60, oh = depth * 0.84;
    // 门框砖圈（凸出描边一圈，包住门洞）
    ctx.lineWidth = S * 0.055;
    ctx.strokeStyle = '#7d5138';
    ctx.beginPath();
    ctx.moveTo(g.x - ow - S * 0.03, g.y);
    ctx.lineTo(g.x - ow - S * 0.03, g.y - oh);
    ctx.arc(g.x, g.y - oh, ow + S * 0.03, Math.PI, 0);
    ctx.lineTo(g.x + ow + S * 0.03, g.y);
    ctx.stroke();
    // 门洞（径向暗腔：洞口微暖、深处近黑，有进深）
    ctx.beginPath();
    ctx.moveTo(g.x - ow, g.y);
    ctx.lineTo(g.x - ow, g.y - oh);
    ctx.arc(g.x, g.y - oh, ow, Math.PI, 0);
    ctx.lineTo(g.x + ow, g.y);
    ctx.closePath();
    var grd = ctx.createRadialGradient(g.x, g.y - oh * 0.35, ow * 0.08, g.x, g.y - oh * 0.40, ow * 1.5);
    grd.addColorStop(0, '#1c1008'); grd.addColorStop(0.72, '#251509'); grd.addColorStop(1, '#37220f');
    ctx.fillStyle = grd; ctx.fill();
    ctx.restore();

    // 窑腔余烬：受火强度（窑位）越高，窑门内辉光越亮越暖——让「窑位」一眼可辨
    // 烧制中火势最旺；开窑后熄火，只余暗淡余温
    var glowA = 0.10 + pos.fire * 0.50;
    if (kilnAnim) glowA *= 0.45 + 0.85 * kilnFirePower();
    else if (CRAFT.fired) glowA *= 0.28;
    var rg = ctx.createRadialGradient(g.x, g.y - oh * 0.55, 4, g.x, g.y - oh * 0.55, ow * 1.15);
    rg.addColorStop(0, 'rgba(255,150,60,' + (glowA * 0.9).toFixed(3) + ')');
    rg.addColorStop(0.6, 'rgba(220,110,46,' + (glowA * 0.32).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(180,90,40,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(g.x - ow, g.y);
    ctx.lineTo(g.x - ow, g.y - oh);
    ctx.arc(g.x, g.y - oh, ow, Math.PI, 0);
    ctx.lineTo(g.x + ow, g.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 窑前柴堆：颜色随薪柴种类变化——让「薪柴」一眼可辨
    drawWoodPile(g.x - ow - S * 0.62, g.y, wood, 1.0);
    drawWoodPile(g.x + ow + S * 0.42, g.y, wood, 0.62);   // 右侧一小垛，平衡构图
  }

  // 薪柴柴堆（圆柱原木，上亮下暗、端面见年轮，呈垛堆叠；mul 控制整垛缩放）
  function drawWoodPile(x, y, wood, mul) {
    var COL = {
      pine: [122, 74, 44], longan: [96, 60, 40], lychee: [112, 70, 44],
      misc: [84, 64, 50], straw: [182, 156, 88]
    };
    var c = COL[wood.id] || [110, 70, 44];
    var lw = S * 0.56 * mul, lr = S * 0.062 * mul;
    var logs = [
      { dx: -lw * 0.42, dy: 0 }, { dx: lw * 0.30, dy: 0 },
      { dx: -lw * 0.06, dy: -(lr * 2 + S * 0.012) }
    ];
    ctx.save();
    for (var k = 0; k < logs.length; k++) {
      var lx = x + logs[k].dx, ly = y + logs[k].dy;
      // 落地阴影
      ctx.fillStyle = 'rgba(30,18,10,0.22)';
      ctx.beginPath(); ctx.ellipse(lx + lw * 0.4, y + lr * 0.85, lw * 0.62, lr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      // 圆柱木身：上亮下暗的圆柱渐变
      var bg = ctx.createLinearGradient(0, ly - lr, 0, ly + lr);
      bg.addColorStop(0, 'rgb(' + Math.min(255, c[0] + 40) + ',' + Math.min(255, c[1] + 32) + ',' + Math.min(255, c[2] + 22) + ')');
      bg.addColorStop(0.45, 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')');
      bg.addColorStop(1, 'rgb(' + Math.max(0, c[0] - 38) + ',' + Math.max(0, c[1] - 30) + ',' + Math.max(0, c[2] - 22) + ')');
      ctx.fillStyle = bg;
      ctx.fillRect(lx, ly - lr, lw, lr * 2);
      // 树皮刻痕
      ctx.strokeStyle = 'rgba(24,14,8,0.30)'; ctx.lineWidth = 1;
      for (var bI = 0; bI < 4; bI++) {
        var sx = lx + lw * (0.14 + bI * 0.22) + (k % 2) * 3;
        ctx.beginPath(); ctx.moveTo(sx, ly - lr * 0.7); ctx.lineTo(sx - 2, ly + lr * 0.7); ctx.stroke();
      }
      // 端面（椭圆截面，朝向观者微亮）
      var ex = lx + lw;
      var eg = ctx.createRadialGradient(ex - lr * 0.2, ly - lr * 0.3, lr * 0.1, ex, ly, lr * 1.1);
      eg.addColorStop(0, 'rgb(' + Math.min(255, c[0] + 52) + ',' + Math.min(255, c[1] + 42) + ',' + Math.min(255, c[2] + 30) + ')');
      eg.addColorStop(1, 'rgb(' + Math.max(0, c[0] - 14) + ',' + Math.max(0, c[1] - 12) + ',' + Math.max(0, c[2] - 8) + ')');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.ellipse(ex, ly, lr * 0.62, lr, 0, 0, Math.PI * 2); ctx.fill();
      // 年轮两圈 + 髓心
      ctx.strokeStyle = 'rgba(64,40,24,0.55)'; ctx.lineWidth = 1;
      for (var ri = 1; ri <= 2; ri++) {
        ctx.beginPath(); ctx.ellipse(ex, ly, lr * 0.62 * ri / 3, lr * ri / 3, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(70,44,26,0.8)';
      ctx.beginPath(); ctx.arc(ex, ly, Math.max(0.6, lr * 0.08), 0, Math.PI * 2); ctx.fill();
      // 稻草：竖向草秆纹理覆盖
      if (wood.id === 'straw') {
        ctx.strokeStyle = 'rgba(240,220,150,0.55)';
        for (var si = 0; si < 6; si++) {
          var tx = lx + lw * (0.08 + si * 0.16);
          ctx.beginPath(); ctx.moveTo(tx, ly - lr); ctx.lineTo(tx + 2, ly + lr); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // 窑火（叠加在器物前，营造火光窜动；高度随窑位受火强度、颜色随薪柴；p 为火势 0..1）
  function drawKilnFront(p) {
    var g = groundPt();
    var pos = posOf(CRAFT.firing.pos), wood = woodOf(CRAFT.firing.wood);
    // 薪柴 → 火色：碱性越高越金黄，越低越红
    var wa = wood.alkali;
    var fcr = 255, fcg = Math.round(140 + (wa - 0.45) * 120), fcb = Math.round(70 - (wa - 0.45) * 55);
    var scl = (0.42 + pos.fire * 0.85) * p;    // 窑位受火越强，火苗越高；火势收放
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var flames = 11;
    for (var i = 0; i < flames; i++) {
      var fx = g.x + (i / (flames - 1) - 0.5) * S * 1.5;
      var ph = tNow * 0.004 + i * 1.7;
      var h = S * scl * (0.55 + 0.32 * Math.sin(ph * 1.3) + 0.18 * Math.sin(ph * 2.7));
      var w = S * 0.16;
      var grd = ctx.createLinearGradient(fx, g.y, fx, g.y - h);
      grd.addColorStop(0, 'rgba(' + fcr + ',' + fcg + ',' + fcb + ',0)');
      grd.addColorStop(0.45, 'rgba(' + fcr + ',' + Math.round(fcg - 20) + ',' + Math.max(20, fcb - 18) + ',' + ((0.40 + 0.18 * Math.sin(ph * 3.1)) * p).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(' + Math.round(fcr - 40) + ',80,24,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(fx - w, g.y);
      ctx.quadraticCurveTo(fx - w * 0.4, g.y - h * 0.6, fx, g.y - h);
      ctx.quadraticCurveTo(fx + w * 0.4, g.y - h * 0.6, fx + w, g.y);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // 封窑门 / 开窑门：p=0 全开，p=1 全封（从底部升起的窑门板）
  function drawKilnDoor(p) {
    if (p <= 0.001) return;
    var m = kilnMouthGeom();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(m.x - m.ow, m.y);
    ctx.lineTo(m.x - m.ow, m.y - m.oh);
    ctx.arc(m.x, m.y - m.oh, m.ow, Math.PI, 0);
    ctx.lineTo(m.x + m.ow, m.y);
    ctx.closePath();
    ctx.clip();
    // 窑门板（从底向上封，p=1 全封）
    var fillTop = m.y - p * m.oh;
    var dr = ctx.createLinearGradient(0, fillTop, 0, m.y);
    dr.addColorStop(0, '#4a2e1d'); dr.addColorStop(1, '#39230f');
    ctx.fillStyle = dr;
    ctx.fillRect(m.x - m.ow, fillTop, m.ow * 2, m.y - fillTop);
    // 横木纹
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 1;
    for (var r = 1; r <= 4; r++) {
      var yy = m.y - (m.oh * 0.84) * (r / 5);
      if (yy < fillTop) continue;
      ctx.beginPath(); ctx.moveTo(m.x - m.ow, yy); ctx.lineTo(m.x + m.ow, yy); ctx.stroke();
    }
    // 投柴口（封门时透出窑内火光）
    if (p > 0.55) {
      var a = (p - 0.55) / 0.45;
      var grd = ctx.createRadialGradient(m.x, m.y - m.oh * 0.30, 1, m.x, m.y - m.oh * 0.30, m.ow * 0.42);
      grd.addColorStop(0, 'rgba(255,150,55,' + (0.85 * a).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(m.x, m.y - m.oh * 0.30, m.ow * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  var tNow = 0;
  function draw() {
    tNow = performance.now();
    FIR = CRAFT.fired ? firingResult() : null;   // 每帧重算烧成效果（参数可调，实时预览）
    ctx.clearRect(0, 0, W, Hp);
    camProject();
    buildRadii();
    buildProfile();
    buildPalette();
    buildVerts();
    drawGround();
    drawBackdrop();                 // 当前工序的环境：工作室 / 转盘 / 釉缸 / 窑炉
    qCnt = 0;
    if (envKind !== 'glaze' && envKind !== 'kiln') emitWheel();
    emitClay();
    paintScene();
    if (envKind === 'kiln') {                       // 明火只在烧制过程中出现，开窑后熄火
      var fp = kilnFirePower();
      if (fp > 0.02) drawKilnFront(fp);
    }
    drawSpecks();
    if (CRAFT.fired || envKind === 'kiln') drawKilnGlow();

    // 施釉动画：上釉(按方式不同) → 收光 → 完成取釉
    if (glazeAnim) {
      var gt = tNow - glazeAnim.t0;
      var gp2 = clamp(gt / GLAZE_APPLY_MS, 0, 1);
      if (gp2 >= 0.72) CRAFT.glazed = true;     // 釉膜已挂上，湿釉色接管，动画层随后淡出
      drawGlazeApply(gp2, glazeAnim.method);
      if (gt < GLAZE_APPLY_MS) {
        statusMsg = GLAZE_MSG[glazeAnim.method] || '上釉中';
      } else if (gt < GLAZE_APPLY_MS + GLAZE_SETTLE_MS) {
        statusMsg = '釉面收光 · 釉膜均匀附着';
      } else {
        glazeAnim = null; CRAFT.glazed = true; statusMsg = '';
        toastMsg = '施釉完成 · 釉面已挂匀，可以入窑烧制'; toastT = tNow;
      }
    } else if (envKind === 'glaze') {
      drawGlazeFront();               // 常态：缸口前沿 + 近侧缸壁，器物立于缸中
    }

    // 入窑动画：关窑 → 烧制(模拟约 3 秒) → 开窑
    if (kilnAnim) {
      var kt = tNow - kilnAnim.t0;
      if (kilnAnim.phase === 'closing') {
        var cp = clamp(kt / KILN_CLOSE_MS, 0, 1);
        drawKilnDoor(cp);
        statusMsg = '关窑 · 封闭窑门，点火升温';
        if (cp >= 1) { kilnAnim.phase = 'firing'; kilnAnim.t0 = tNow; }
      } else if (kilnAnim.phase === 'firing') {
        drawKilnDoor(1);
        statusMsg = '烧制中 · 窑内高温，请稍候';
        drawKilnLabel('烧制中');
        if (kt >= KILN_FIRE_MS) { kilnAnim.phase = 'opening'; kilnAnim.t0 = tNow; }
      } else if (kilnAnim.phase === 'opening') {
        var op = clamp(kt / KILN_OPEN_MS, 0, 1);
        drawKilnDoor(1 - op);
        statusMsg = '开窑 · 取出窑器';
        drawKilnLabel('开窑');
        if (op >= 1) {
          CRAFT.fired = true; kilnAnim = null; statusMsg = '';
          toastMsg = '开窑 · 出窑后可看鉴赏报告'; toastT = tNow;
        }
      }
    }
  }
  // 窑口上方工序提示文字（让烧窑参与感更强）
  function drawKilnLabel(txt) {
    var m = kilnMouthGeom();
    ctx.save();
    ctx.font = '600 ' + Math.round(S * 0.16) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,236,212,0.92)';
    ctx.strokeStyle = 'rgba(40,24,14,0.55)'; ctx.lineWidth = 3;
    ctx.strokeText(txt, m.x, m.top - S * 0.12);
    ctx.fillText(txt, m.x, m.top - S * 0.12);
    ctx.restore();
  }

  // ========================================================
  // 器型识别：依据器身轮廓给作品起名字
  // ========================================================
  function vesselName() {
    var rim = rN[SEG - 1], base = rN[0];
    var maxR = 0, maxI = 0, minV = 1e9;
    for (var i = 0; i < SEG; i++) {
      if (rN[i] > maxR) { maxR = rN[i]; maxI = i; }
      if (rN[i] < minV) minV = rN[i];
    }
    var pos = maxI / (SEG - 1);          // 最宽处位置（0 底 / 1 口沿）
    var neck = rim / maxR;               // 口沿相对最宽处
    var waist = minV / maxR;             // 收腰程度
    if (hN <= 0.62 && maxR >= 1.2 && neck > 0.8) return '陶盘';
    if (hN <= 0.95 && maxR >= 0.95 && pos < 0.55 && neck > 0.55) return '陶碗';
    if (waist < 0.60 && hN >= 0.9) return '细颈瓶';
    if (neck < 0.72 && hN >= 1.05) return '花瓶';
    if (neck > 0.86 && waist > 0.85 && hN >= 1.1) return '直筒罐';
    if (hN <= 0.78 && maxR >= 0.8) return '矮罐';
    if (hN >= 1.6) return '长颈瓶';
    return '器坯';
  }

  // 保存作品：当前画面合成到暖底色后导出 PNG
  function saveArtwork() {
    var out = document.createElement('canvas');
    out.width = cv.width;
    out.height = cv.height;
    var g = out.getContext('2d');
    g.fillStyle = '#f7f1e8';
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(cv, 0, 0);
    var a = document.createElement('a');
    a.download = '我的陶器-' + new Date().toISOString().slice(0, 10) + '.png';
    a.href = out.toDataURL('image/png');
    a.click();
    setStatus(work > 0.05 ? '作品已保存' : '还未开始捏，保存的是一块陶泥');
  }

  // 隐藏调试/展示入口：#pot=vase / #pot=bowl 直接摆出一件已拉好的坯
  // #pot=xxx：直接用参数化器型系统生成成品坯（调试与展示用）
  function seedShape(kind) {
    var known = false;
    for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].id === kind) known = true;
    CRAFT.shape = known ? kind : 'vase';
    CRAFT.temper = { upright: 0.55, open: 0.55, slim: 0.50, lofty: 0.45 };
    work = 0.94;
    started = true;
    applyShape();
  }

  // 进入塑形类步骤时，若还没有泥坯，先给一团待塑的泥（work=0 表示尚未塑形）
  function ensureStarted() {
    if (started) return;
    started = true;
    work = 0;
    CRAFT.shape = CRAFT.shape || 'vase';
    applyShape();
  }

  /* =========================================================
     四、输入合成（摄像头 + 鼠标）
     ========================================================= */
  var camOn = false;

  var camIn = { pull: 0, squeeze: 0, focus: 0.5, hands: 0, ts: 0, active: false, act: '', vx: 0, vy: 0, spread: 1 };
  var mouIn = { pull: 0, squeeze: 0, focus: 0.5, ts: 0, dragging: false, lastY: 0, lastX: 0, act: '' };

  // ---------- 自动演示模式（URL 带 #demo）----------
  var demoMode = false, demoT0 = 0;

  // 一段「提拉 → 收颈 → 鼓腹 → 收足 → 整器」的示范，收尾是一只敞口小瓶
  // 走完真实工序：练泥 → 开窝 → 拉坯 → 塑形 → 修坯 → 装饰，收尾停在「入窑」
  function demoInput(now) {
    var t = (now - demoT0) / 1000;
    if (t < 0.6) return { pull: 0, squeeze: 0, focus: 0.50, act: '', label: '演示模式 · 即将开始' };
    if (t < 2.7) return { pull: 0, squeeze: 0, focus: 0.50, act: 'knead', label: '演示 · 双手揉泥排气' };
    if (t < 4.7) return { pull: 0, squeeze: 0, focus: 0.30, act: 'bore', label: '演示 · 食指开窝' };
    if (t < 10.0) return { pull: 0.62, squeeze: 0, focus: 0.50, act: 'pull', label: '演示 · 双手提拉' };
    if (t < 12.1) return { pull: 0, squeeze: -0.78, focus: 0.78, act: 'pinch', label: '演示 · 捏合收颈' };
    if (t < 12.6) return { pull: 0, squeeze: 0, focus: 0.40, act: 'pinch', label: '演示 · 手移到器腹' };
    if (t < 15.3) return { pull: 0, squeeze: 0.20, focus: 0.30, act: 'spread', label: '演示 · 外扩鼓腹' };
    if (t < 18.9) return { pull: 0, squeeze: 0, focus: 0.12, act: 'trim', label: '演示 · 修坯收足' };
    if (t < 21.6) return { pull: 0, squeeze: 0, focus: 0.55, act: 'smooth', label: '演示 · 抹光器表' };
    return { pull: 0, squeeze: 0, focus: 0.50, act: '', label: '演示完成 · 调好烧成参数即可入窑', done: true };
  }

  function resolveInput(dt) {
    var now = performance.now();
    var t, k;

    if (demoMode) {
      var d = demoInput(now);
      t = {
        pull: d.pull, squeeze: d.squeeze, focus: d.focus,
        hands: d.done ? 0 : 2, active: !d.done, demoLabel: d.label, act: d.act || ''
      };
    } else if (camOn && camIn.hands > 0 && (now - camIn.ts) < 600) {
      t = {
        pull: camIn.pull, squeeze: camIn.squeeze, focus: camIn.focus,
        hands: camIn.hands, active: true, act: camIn.act
      };
    } else if ((now - mouIn.ts) < 1200) {
      t = {
        pull: mouIn.pull, squeeze: mouIn.squeeze, focus: mouIn.focus,
        hands: 0, active: true, act: mouIn.act
      };
    } else if (camOn) {
      t = { pull: 0, squeeze: 0, focus: g.focus, hands: 0, active: false, act: '' };
    } else {
      t = { pull: 0, squeeze: 0, focus: g.focus, hands: 0, active: false, act: '' };
    }

    k = 1 - Math.exp(-dt * 9);
    g.pull += (t.pull - g.pull) * k;
    g.squeeze += (t.squeeze - g.squeeze) * k;
    g.focus += (t.focus - g.focus) * (1 - Math.exp(-dt * 5));
    g.hands = t.hands;
    g.active = t.active;
    g.act = t.act || '';
    g.label = labelFor(t);
    updateStage(g.act, dt, g.focus);

    // 鼠标信号自然衰减
    mouIn.pull *= Math.pow(0.02, dt);
    mouIn.squeeze *= Math.pow(0.05, dt);
    if (Math.abs(mouIn.pull) < 0.01) mouIn.pull = 0;
    if (Math.abs(mouIn.squeeze) < 0.01) mouIn.squeeze = 0;
  }

  function labelFor(t) {
    if (demoMode && t.demoLabel) return t.demoLabel;
    if (!camOn && !t.active) return '开启摄像头，开始捏陶';
    if (camOn && t.hands === 0) return '未检测到手 · 请把手放进画面';
    var stN = STAGES[ST.i].n;
    var a = t.act ? ACT_MAP[t.act] : null;
    if (a && t.act !== 'hold') return '「' + stN + '」' + a.name;
    if (!t.active) return '就位 · 准备动作';
    var parts = [];
    if (camOn && (performance.now() - camRotT) < 450) parts.push('转动 · 换视角');
    if (g.pull > 0.17) parts.push('上提 · 拉坯');
    else if (g.pull < -0.17) parts.push('下压 · 收形');
    if (g.squeeze < -0.17) parts.push('捏合 · 收细');
    else if (g.squeeze > 0.17) parts.push('张开 · 外扩');
    if (!parts.length) parts.push(camOn ? '就位 · 准备动作' : '手动塑形');
    return parts.join(' ＋ ');
  }

  // 第二行手作说明：动作名 + 手指姿态与作用的完整描述
  function actDetail(actId) {
    var a = actId ? (ACT_MAP[actId] || null) : null;
    if (!a) return '';
    return a.name + '：' + a.desc;
  }

  /* =========================================================
     五、摄像头 + 手部识别
     ========================================================= */
  var CDN = [
    { tag: 'jsdelivr', base: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' },
    { tag: 'fastly', base: 'https://fastly.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' },
    { tag: 'npmmirror', base: 'https://registry.npmmirror.com/@mediapipe/hands/0.4.1675469240/files/' },
    { tag: 'gcore', base: 'https://gcore.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' },
    { tag: 'unpkg', base: 'https://unpkg.com/@mediapipe/hands@0.4.1675469240/' }
  ];
  var CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
  var TIPS = [4, 8, 12, 16, 20];

  var solver = null, pumpTimer = null, busy = false, loadingModel = false;
  var prevPalmY = null, prevPalmX = null, palmV = 0, lastAnalyzeT = 0;
  var firstResultSeen = false, modelWatchdog = null, handSeenOnce = false;
  var srcName = '', badSrc = {}, autoRetried = false;
  var D = { model: '未加载', src: '—', sent: 0, got: 0, hands: 0, vw: 0, vh: 0, err: '' };

  function renderDiag() {
    if (!diagEl) return;
    var cls = D.model === '就绪' ? 'ok' : (D.model === '失败' ? 'bad' : 'warn');
    var line1 = '<span class="' + cls + '">模型 ' + D.model + '</span>'
      + ' · 源 ' + D.src
      + ' · 推理 ' + D.got + '/' + D.sent
      + ' · 手 ' + D.hands;
    var line2 = D.vw ? ('画面 ' + D.vw + '×' + D.vh) : '画面未接入';
    var line3 = D.err ? ('<span class="bad">' + D.err + '</span>') : '';
    diagEl.innerHTML = '<div class="row"><span>' + line1 + '</span>'
      + '<button class="btn btn-mini sp" id="btnRetry2" style="display:'
      + (D.model === '失败' || D.model === '加载中' ? 'inline-block' : 'none')
      + '">重试模型</button></div>'
      + '<div>' + line2 + '</div>' + (line3 ? '<div>' + line3 + '</div>' : '');
    var b = document.getElementById('btnRetry2');
    if (b) b.addEventListener('click', retryModel);
  }

  function retryModel() {
    D.model = '加载中'; D.err = ''; D.sent = 0; D.got = 0; D.hands = 0;
    renderDiag();
    ensureSolver(true).then(function () {
      D.model = '就绪'; renderDiag();
      startPump();
      setStatus('把手放进画面开始捏陶');
    }).catch(function (e) {
      D.model = '失败';
      D.err = (e && e.message) ? e.message : '未知错误';
      renderDiag();
    });
  }

  function loadScript(src, ms) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        if (done) return; done = true;
        s.onload = s.onerror = null;
        rej(new Error('下载超时'));
      }, ms || 15000);
      s.src = src;
      s.async = true;
      s.onload = function () { if (done) return; done = true; clearTimeout(timer); res(); };
      s.onerror = function () { if (done) return; done = true; clearTimeout(timer); rej(new Error('下载失败')); };
      document.head.appendChild(s);
    });
  }

  var statusMsg = '';
  function setStatus(msg) {
    statusMsg = msg;
  }

  function sizeOverlay() {
    var rect = overlay.getBoundingClientRect();
    var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    overlay.width = Math.round(w * DPR);
    overlay.height = Math.round(h * DPR);
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function drawOverlay(list) {
    var rect = overlay.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    octx.clearRect(0, 0, w, h);
    for (var n = 0; n < list.length; n++) {
      var lm = list[n], i;
      octx.strokeStyle = 'rgba(226,166,120,.95)';
      octx.lineWidth = 1.6;
      octx.lineCap = 'round';
      for (i = 0; i < CONN.length; i++) {
        var A = lm[CONN[i][0]], B = lm[CONN[i][1]];
        octx.beginPath();
        octx.moveTo((1 - A.x) * w, A.y * h);
        octx.lineTo((1 - B.x) * w, B.y * h);
        octx.stroke();
      }
      octx.fillStyle = '#f7e2cd';
      for (i = 0; i < lm.length; i++) {
        octx.beginPath();
        octx.arc((1 - lm[i].x) * w, lm[i].y * h, 1.9, 0, Math.PI * 2);
        octx.fill();
      }
      octx.fillStyle = 'rgba(192,122,82,.95)';
      for (i = 0; i < TIPS.length; i++) {
        var p = lm[TIPS[i]];
        octx.beginPath();
        octx.arc((1 - p.x) * w, p.y * h, 3.2, 0, Math.PI * 2);
        octx.fill();
      }
    }
  }

  /* =========================================================
     手势动作库：按真实手作陶瓷工序识别
     ========================================================= */
  var ACTS = [
    { id: 'knead', name: '揉泥', hand: '双手', icon: '◐', desc: '双手一上一下交替搓揉，排出泥料中的气泡，练泥到位可减少烧成开裂。' },
    { id: 'bore', name: '开窝', hand: '单手', icon: '↓', desc: '食指伸直、其余四指收拢，向下戳入泥团中心开出内腔。' },
    { id: 'pull', name: '提拉', hand: '单/双手', icon: '↑', desc: '手掌贴住器壁匀速上移，器身变高变细（体积守恒）。' },
    { id: 'press', name: '下压', hand: '单/双手', icon: '↓', desc: '手掌匀速下移，器身变矮变宽，用于收形与整底。' },
    { id: 'pinch', name: '捏合收细', hand: '单/双手', icon: '⊂', desc: '拇指与食指靠近做捏合状，作用于手所在的高度，可收颈、收腹、收足。' },
    { id: 'spread', name: '外扩鼓腹', hand: '单/双手', icon: '⊃', desc: '五指张开向外撑，把器壁向外推成鼓腹或敞口。' },
    { id: 'trim', name: '修坯横刮', hand: '单手', icon: '↔', desc: '拇指食指捏成持刀状，横向快速划过，修整器壁与圈足。' },
    { id: 'pat', name: '拍打定型', hand: '单手', icon: '⇅', desc: '手掌在竖直方向快速小幅往复，如木拍拍打器壁使其致密平整。' },
    { id: 'smooth', name: '抹光', hand: '单手', icon: '→', desc: '五指张开掌心平贴，缓慢水平抚过器表，抹平颗粒、为磨光做准备。' },
    { id: 'rotate', name: '转动视角', hand: '单手', icon: '⟳', desc: '张开手掌水平划动，绕器身环视各个角度。' }
  ];
  var ACT_MAP = {};
  (function () { for (var i = 0; i < ACTS.length; i++) ACT_MAP[ACTS[i].id] = ACTS[i]; })();

  /* ---------------- 工序阶段 ---------------- */
  var STAGES = [
    { n: '练泥', acts: ['knead'], need: 3.0, tip: '双手交替上下搓揉，排出气泡', eff: '减少烧成开裂风险' },
    { n: '开窝', acts: ['bore'], need: 2.2, tip: '食指伸直向下戳入泥团中心', eff: '开出内腔' },
    { n: '拉坯', acts: ['pull', 'press'], need: 6.0, tip: '手掌贴壁上提 / 下压', eff: '决定器身高度' },
    { n: '塑形', acts: ['pinch', 'spread'], need: 6.0, tip: '捏合收细 / 张开外扩', eff: '决定器型曲线' },
    { n: '修坯', acts: ['trim', 'pat'], need: 4.0, tip: '横向刮削修整 / 拍打定型', eff: '修圈足、致密度' },
    { n: '装饰', acts: ['smooth'], need: 3.0, tip: '掌心平抚器表', eff: '表面光洁度' },
    { n: '入窑', acts: [], need: 0, tip: '调好烧成参数后点火', eff: '温度 / 气氛 / 窑位 / 木柴' },
    { n: '出窑', acts: [], need: 0, tip: '查看鉴赏报告', eff: '器型·火痕·落灰·呈色·肌理' }
  ];

  /* =========================================================
     工序流程（宏）：从「有想法」到「烧成一件窑器」的完整旅程
     —— 每一步对应一个制作环境，让用户身临其境
     ========================================================= */
  var FLOW = [
    { id: 'idea',  n: '立意',  icon: '✦', env: 'studio',
      desc: '想清楚这件器物用来做什么、想传达什么气韵。',
      brief: '先定用途与气韵',
      params: '用途取向（茶器 / 花器 / 食器 / 文房 / 陈设）与主题灵感。' },
    { id: 'clay',  n: '备泥',  icon: '◧', env: 'studio',
      desc: '为你的构想选一块对的泥，再反复揉练排除气泡。',
      brief: '选泥料，揉练排气',
      params: '泥料（颗粒 / 含铁 / 耐火 / 收缩）与练泥程度。' },
    { id: 'form',  n: '拉坯',  icon: '↺', env: 'wheel',
      desc: '把泥放上转盘，借手势提拉、收束、鼓腹，拉出初步器型。',
      brief: '转盘提拉，定器型',
      params: '目标器型、气质取向、成型手法；实时手势塑形。' },
    { id: 'trim',  n: '修坯',  icon: '↔', env: 'wheel',
      desc: '倒置修整圈足、修薄器壁、规整口沿。',
      brief: '修圈足、口沿、器壁',
      params: '足高、口沿、器壁厚薄（手势横刮 / 拍打）。' },
    { id: 'decor', n: '装饰',  icon: '❀', env: 'wheel',
      desc: '在素坯上施加肌理、刻划或纹饰，赋予个性。',
      brief: '加肌理与刻划纹饰',
      params: '装饰与肌理（刻花 / 跳刀 / 印纹 / 镂空 等）。' },
    { id: 'glaze', n: '施釉',  icon: '◍', env: 'glaze',
      desc: '浸入或刷涂釉浆，釉色与厚薄决定出窑呈色。',
      brief: '上釉，定出窑呈色',
      params: '中国传统色目标、施釉方式、釉层厚薄。' },
    { id: 'fire',  n: '烧成',  icon: '🔥', env: 'kiln',
      desc: '装窑点火，温度、气氛、落灰、窑位与薪柴共同塑造窑变。',
      brief: '调火候，入窑烧制',
      params: '温度、气氛（氧化/还原）、落灰、迎火面、窑位、薪柴、冷却。' },
    { id: 'done',  n: '成器',  icon: '✧', env: 'studio',
      desc: '开窑取出，对照鉴赏维度读懂这件窑器的来历。',
      brief: '出窑，读鉴赏报告',
      params: '鉴赏报告：器型·火痕·落灰·呈色·肌理·风险提示。' }
  ];
  var flowIdx = 0;
  var envKind = 'studio';
  function setFlow(i) {
    flowIdx = clamp(i, 0, FLOW.length - 1);
    envKind = FLOW[flowIdx].env;
    if (FLOW[flowIdx].env === 'wheel') ensureStarted();
    if (wsStageEl) wsStageEl.textContent = FLOW[flowIdx].n;
    renderPanel();
    renderRail();
  }

  var ST = { i: 0, prog: 0, knead: 0, bore: 0, trimAmt: 0, smoothAmt: 0, wedge: 0 };

  function stageActs() {
    var s = STAGES[ST.i];
    var out = [];
    for (var i = 0; i < s.acts.length; i++) out.push(ACT_MAP[s.acts[i]]);
    return out;
  }

  /* ---------------- 单手特征提取 ---------------- */
  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  function handFeat(lm) {
    var px = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    var py = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    var size = Math.max(0.03, d2(lm[9], lm[0]));
    var pinch = d2(lm[4], lm[8]) / size;
    var c = { x: px, y: py };
    var tips = [8, 12, 16, 20], sp = 0, i;
    for (i = 0; i < 4; i++) sp += d2(lm[tips[i]], c) / size;
    var spread = sp / 4;
    var ext = 0;
    if (d2(lm[8], lm[0]) > d2(lm[6], lm[0]) * 1.16) ext++;      // 食指
    if (d2(lm[12], lm[0]) > d2(lm[10], lm[0]) * 1.16) ext++;    // 中指
    if (d2(lm[16], lm[0]) > d2(lm[14], lm[0]) * 1.16) ext++;    // 无名指
    if (d2(lm[20], lm[0]) > d2(lm[18], lm[0]) * 1.16) ext++;    // 小指
    if (d2(lm[4], lm[0]) > d2(lm[2], lm[0]) * 1.10) ext++;      // 拇指
    var indexOnly = (d2(lm[8], lm[0]) > d2(lm[6], lm[0]) * 1.16) && ext <= 2;
    return { px: px, py: py, size: size, pinch: pinch, spread: spread, ext: ext, indexOnly: indexOnly };
  }

  /* ---------------- 状态：速度、翻转、双手交替 ---------------- */
  var palmVX = 0, vySign = 0, vyFlips = 0, lastFlipT = 0;
  var prevHY = [null, null], kneadAcc = 0;

  function classify(H, dtA, now) {
    var i;
    var meanX = 0, meanY = 0, pinchAvg = 0, spreadAvg = 0, extAvg = 0, idxOnly = 0;
    for (i = 0; i < H.length; i++) {
      meanX += H[i].px; meanY += H[i].py; pinchAvg += H[i].pinch;
      spreadAvg += H[i].spread; extAvg += H[i].ext; if (H[i].indexOnly) idxOnly++;
    }
    meanX /= H.length; meanY /= H.length; pinchAvg /= H.length; spreadAvg /= H.length; extAvg /= H.length;

    var dxRaw = prevPalmX !== null ? (prevPalmX - meanX) : 0;
    var dyRaw = prevPalmY !== null ? (prevPalmY - meanY) : 0;
    var vx = dxRaw / dtA, vy = dyRaw / dtA;                 // 镜像画面：向右为正；向上为正
    palmVX = palmVX * 0.55 + vx * 0.45;

    // 竖直方向快速往复 -> 拍打
    var sg = vy > 0.30 ? 1 : (vy < -0.30 ? -1 : 0);
    if (sg !== 0) {
      if (vySign !== 0 && sg !== vySign) { vyFlips++; lastFlipT = now; }
      vySign = sg;
    }
    if (now - lastFlipT > 900) vyFlips = 0;

    // 双手交替上下 -> 揉泥
    if (H.length >= 2) {
      var d0 = prevHY[0] !== null ? (prevHY[0] - H[0].py) : 0;
      var d1 = prevHY[1] !== null ? (prevHY[1] - H[1].py) : 0;
      if (d0 * d1 < -1e-7 && (Math.abs(d0) + Math.abs(d1)) > 0.0035) kneadAcc += 0.9;
      prevHY[0] = H[0].py; prevHY[1] = H[1].py;
    } else { prevHY[0] = prevHY[1] = null; }
    kneadAcc *= 0.94;

    var act = 'hold';
    if (Math.abs(palmVX) > 0.55 && Math.abs(palmVX) > Math.abs(vy) * 1.15 && pinchAvg > 0.95 && spreadAvg > 1.15) {
      act = 'rotate';                                        // 张开手掌水平划动 = 转视角
    } else if (kneadAcc > 1.1) {
      act = 'knead';
    } else if (idxOnly > 0 && extAvg <= 2.2 && vy < -0.15) {
      act = 'bore';                                          // 单指下戳
    } else if (vyFlips >= 3) {
      act = 'pat';
    } else if (Math.abs(palmVX) > 0.42 && Math.abs(palmVX) > Math.abs(vy) * 1.3) {
      act = (pinchAvg < 0.95) ? 'trim' : 'smooth';           // 捏刀=修坯，平掌=抹光
    } else if (Math.abs(vy) > 0.42) {
      act = vy > 0 ? 'pull' : 'press';
    } else if (pinchAvg < 0.86) {
      act = 'pinch';
    } else if (spreadAvg > 1.22 && extAvg >= 3) {
      act = 'spread';
    }

    return {
      act: act, vx: palmVX, vy: vy, pinch: pinchAvg, spread: spreadAvg,
      ext: extAvg, meanX: meanX, meanY: meanY
    };
  }

  /* ---------------- 工序推进 ---------------- */
  function updateStage(act, dt, focus) {
    var s = STAGES[ST.i];
    if (s.need <= 0) return;
    var match = s.acts.indexOf(act) >= 0;
    if (!match) return;
    ST.prog += dt * (act === 'knead' ? 1.35 : 1) * 1.15;

    // 各工序的额外效果
    if (act === 'knead') ST.wedge = Math.min(1, ST.wedge + dt * 0.34);
    if (act === 'bore') ST.bore = Math.min(1, ST.bore + dt * 0.52);
    if (act === 'trim') ST.trimAmt = Math.min(1, ST.trimAmt + dt * 0.24);
    if (act === 'smooth') ST.smoothAmt = Math.min(1, ST.smoothAmt + dt * 0.30);

    if (ST.prog >= s.need) {
      ST.prog = 0;
      if (ST.i < STAGES.length - 1) {
        ST.i++;
        stageToast();
      }
    }
  }

  var toastT = 0, toastMsg = '';
  function stageToast() {
    var s = STAGES[ST.i];
    toastMsg = '工序推进 → ' + s.n + ' · ' + s.tip;
    toastT = performance.now();
  }

  function resetStages() {
    ST.i = 0; ST.prog = 0; ST.knead = 0; ST.bore = 0; ST.trimAmt = 0; ST.smoothAmt = 0; ST.wedge = 0;
    kneadAcc = 0; vyFlips = 0; vySign = 0; palmVX = 0;
    prevHY[0] = prevHY[1] = null;
  }

  function analyze(list) {
    var now = performance.now();
    var dtA = clamp((now - lastAnalyzeT) / 1000, 0.016, 0.25);
    lastAnalyzeT = now;
    camIn.ts = now;
    camIn.hands = list.length;
    if (list.length) handSeenOnce = true;

    if (!list.length) {
      camIn.active = false;
      camIn.pull = 0;
      camIn.squeeze = 0;
      palmV *= 0.6;
      prevPalmY = null;
      prevPalmX = null;
      return;
    }

    var H = [], i;
    for (i = 0; i < list.length; i++) H.push(handFeat(list[i]));
    // 必须在 prevPalm* 被更新之前调用：classify 依赖上一帧位置做差分
    var cl = classify(H, dtA, now);
    camIn.act = cl.act;
    camIn.vx = cl.vx; camIn.vy = cl.vy; camIn.spread = cl.spread;

    // 手的高度 -> 塑形落点（画面下方 = 靠近底部）
    var meanY = 0;
    for (i = 0; i < H.length; i++) meanY += H[i].py;
    meanY /= H.length;
    camIn.focus = clamp(1 - (meanY - 0.22) / 0.52, 0.05, 0.95);

    // 竖直速度 -> 提 / 压
    var dyRaw = (prevPalmY !== null) ? (prevPalmY - meanY) : 0;
    if (prevPalmY !== null) {
      var v = (prevPalmY - meanY) / dtA;   // 向上为正
      v = clamp(v, -3, 3);
      palmV = palmV * 0.6 + v * 0.4;
    }
    prevPalmY = meanY;
    camIn.pull = clamp(palmV * 1.5, -1, 1);

    // 张开的手掌左右划动 -> 转动视角（绕器身环视）
    var meanX = 0, pinchAvg = 0;
    for (i = 0; i < H.length; i++) { meanX += H[i].px; pinchAvg += H[i].pinch; }
    meanX /= H.length; pinchAvg /= H.length;
    if (cl.act === 'rotate') {                                // 张开手掌水平划动 = 环视器身
      var dm = prevPalmX !== null ? (prevPalmX - meanX) : 0;  // 镜像画面里「向右」为正
      cam.tYaw += clamp(dm, -0.10, 0.10) * 2.6;
      camRotT = now;
    }
    prevPalmX = meanX;

    // 横向 -> 捏 / 扩
    var sq;
    if (H.length >= 2) {
      var d = Math.hypot(H[0].px - H[1].px, H[0].py - H[1].py);
      var ratio = d / ((H[0].size + H[1].size) / 2);
      var byDist = clamp((ratio - 2.1) / 1.2, -1, 1);
      var byPinch = clamp((((H[0].pinch + H[1].pinch) / 2) - 0.85) / 0.6, -1, 1);
      sq = byDist * 0.65 + byPinch * 0.35;
    } else {
      sq = clamp((H[0].pinch - 0.85) / 0.6, -1, 1);
    }
    camIn.squeeze = clamp(sq, -1, 1);
    camIn.active = true;
  }

  function onResults(res) {
    firstResultSeen = true;
    D.got++;
    if (modelWatchdog) { clearTimeout(modelWatchdog); modelWatchdog = null; }
    var list = (res.multiHandLandmarks || []).filter(function (h) { return h && h.length >= 21; });
    D.hands = list.length;
    if (D.model !== '就绪') {
      D.model = '就绪';
      if (camOn && !handSeenOnce) setStatus('把手放进画面开始捏陶');
      renderDiag();
    } else if (D.got % 15 === 0) renderDiag();
    drawOverlay(list);
    analyze(list);
  }

  function ensureSolver(force) {
    if (solver && !force) return Promise.resolve(solver);
    if (loadingModel) return Promise.resolve(solver);
    loadingModel = true;
    D.model = '加载中'; D.err = ''; renderDiag();
    setStatus('正在加载手部识别模型…');

    // 依次尝试各个镜像源（跳过已确认不可用的），任一可用即停止
    function trySources() {
      var i = 0;
      function next() {
        while (i < CDN.length && badSrc[CDN[i].tag]) i++;
        if (i >= CDN.length) return Promise.reject(new Error('所有模型源均不可达（网络或扩展拦截）'));
        var c = CDN[i++];
        D.src = c.tag; renderDiag();
        return loadScript(c.base + 'hands.js', 12000).then(function () {
          if (!window.Hands) throw new Error('脚本已下载但 Hands 未定义');
          return c;
        }).catch(function () { badSrc[c.tag] = true; return next(); });
      }
      return next();
    }

    return trySources().then(function (c) {
      var Hands = window.Hands;
      var s = new Hands({ locateFile: function (f) { return c.base + f; } });
      s.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,            // full 模型：检出率显著高于 lite
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        selfieMode: false
      });
      s.onResults(onResults);
      solver = s;
      srcName = c.tag;
      loadingModel = false;
      D.model = '加载中'; D.src = c.tag; renderDiag();
      return solver;
    }).catch(function (e) {
      loadingModel = false;
      D.model = '失败';
      D.err = (e && e.message) ? e.message : '未知错误';
      renderDiag();
      throw e;
    });
  }

  function startPump() {
    if (pumpTimer) return;
    pumpTimer = setInterval(function () {
      if (!solver || busy) return;
      if (video.readyState < 2 || !video.videoWidth) return;
      D.vw = video.videoWidth; D.vh = video.videoHeight;
      busy = true;
      D.sent++;
      var settled = false;
      function release() {                 // 无论如何都必须复位，否则识别永久停摆
        if (settled) return;
        settled = true;
        busy = false;
        if (D.sent % 20 === 0) renderDiag();
      }
      try {
        var p = solver.send({ image: video });
        if (p && typeof p.then === 'function') p.then(release, release);
        else release();
      } catch (err) {
        D.err = '推理异常：' + ((err && err.message) ? err.message : err);
        release();
      }
      // 单帧推理通常仅几十毫秒；挂起时 3 秒放行重试，避免整个识别永久停摆
      setTimeout(release, 3000);
    }, 40);
  }

  function camErrorText(e) {
    var n = e && e.name ? e.name : '';
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError') return '摄像头权限被拒绝，请在浏览器地址栏允许后重试';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return '未检测到可用摄像头设备';
    if (n === 'NotReadableError' || n === 'TrackStartError') return '摄像头被其他程序占用';
    if (n === 'OverconstrainedError') return '摄像头参数不受支持';
    return '摄像头开启失败，请重试';
  }

  function startCamera() {
    if (camOn) return;
    btnCam.disabled = true;
    btnCam.textContent = '开启中…';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      failCamera('当前环境不支持摄像头，请通过 localhost 或 https 打开本页面');
      return;
    }
    // 权限弹窗长时间未响应时的兜底
    var timedOut = false;
    var guard = setTimeout(function () {
      timedOut = true;
      failCamera('请求摄像头超时，请确认是否已允许权限弹窗');
    }, 15000);

    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    }).then(function (stream) {
      if (timedOut) {                       // 兜底已触发，不再继续
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      clearTimeout(guard);
      video.srcObject = stream;
      return video.play();
    }).then(function () {
      if (timedOut) return;
      camOn = true;
      D.err = '';                          // 摄像头确实拿到了，清掉之前的推测性提示
      screenOff.classList.add('hide');
      rec.classList.add('on');
      sizeOverlay();
      btnCam.disabled = false;
      setStatus('模型加载中…');
      return ensureSolver();
    }).then(function () {
      if (timedOut) return;
      startPump();
      // 首次 send 时才真正下载约 8MB 的 wasm+模型，这期间不可误导为「已就绪」
      setStatus('识别模型首次加载中 · 约 5~20 秒');
      handCountEl.textContent = '0 只手';
      renderDiag();
      // 分两级诊断：模型是否跑起来 / 跑起来了但画面里没找到手
      modelWatchdog = setTimeout(function () {
        if (!firstResultSeen) {
          // 第一次无响应：自动换个镜像源再来一次，用户无需操作
          if (!autoRetried) {
            autoRetried = true;
            if (srcName) badSrc[srcName] = true;
            solver = null; loadingModel = false; busy = false;
            setStatus('模型未响应 · 正在自动切换镜像源…');
            D.err = '源 ' + srcName + ' 无响应，自动切换…'; renderDiag();
            ensureSolver(true).then(function () {
              startPump();
              setStatus('把手放进画面开始捏陶');
              D.err = ''; renderDiag();
            }).catch(function () {
              setStatus('识别模型不可用 · 可点「重试模型」或先用鼠标塑形');
            });
            return;
          }
          D.err = '模型无响应（多为网络或扩展拦截），可点「重试模型」';
          renderDiag();
          setStatus('模型未响应 · 可点「重试模型」或先用鼠标塑形');
        } else if (!handSeenOnce) {
          setStatus('画面已接入但未识别到手 · 手掌正对镜头、距 40~70cm');
          D.err = '识别已运行但未检出手：请把整只手掌正对镜头、光线充足';
          renderDiag();
        }
      }, 15000);
    }).catch(function (e) {
      clearTimeout(guard);
      if (timedOut) return;
      // 摄像头其实已打开，只是识别模型没起来 —— 保留画面，不要误报成摄像头失败
      if (D.model === '失败') {
        btnCam.disabled = false;
        btnCam.textContent = '重试模型';
        btnCam.onclick = retryModel;
        setStatus('识别模型加载失败 · 点「重试模型」或先用鼠标塑形');
        renderDiag();
        console.warn('[模型]', e);
        return;
      }
      failCamera(camErrorText(e));
      console.warn('[摄像头]', e);
    });
  }

  function failCamera(msg) {
    camOn = false;
    btnCam.disabled = false;
    btnCam.textContent = '重试';
    btnCam.onclick = startCamera;
    screenOff.classList.remove('hide');
    rec.classList.remove('on');
    setStatus('摄像头不可用 · 可用鼠标拖动塑形');
    gestureText.title = msg;
    D.err = msg;
    renderDiag();
    console.warn('[摄像头]', msg);
  }

  /* =========================================================
     五·五、摄影区域可随意拖拽
     ========================================================= */
  (function bindMonitorDrag() {
    var monitor = document.getElementById('monitor');
    if (!monitor) return;
    var dragging = false, ox = 0, oy = 0;

    monitor.addEventListener('pointerdown', function (e) {
      // 开启摄像头按钮不触发拖动
      var t = e.target;
      if (t && (t.id === 'btnCam' || (t.closest && t.closest('#screenOff')))) return;
      dragging = true;
      var r = monitor.getBoundingClientRect();
      // 切换为 left/top 定位，便于自由拖动
      monitor.style.right = 'auto';
      monitor.style.left = r.left + 'px';
      monitor.style.top = r.top + 'px';
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      try { monitor.setPointerCapture(e.pointerId); } catch (err) { }
      e.preventDefault();
    });
    monitor.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var w = monitor.offsetWidth, h = monitor.offsetHeight;
      var x = Math.max(4, Math.min(window.innerWidth - w - 4, e.clientX - ox));
      var y = Math.max(4, Math.min(window.innerHeight - h - 4, e.clientY - oy));
      monitor.style.left = x + 'px';
      monitor.style.top = y + 'px';
    });
    function end() { dragging = false; }
    monitor.addEventListener('pointerup', end);
    monitor.addEventListener('pointercancel', end);
  })();

  /* =========================================================
     六、鼠标兜底交互
     ========================================================= */
  var drag = { on: false, shape: false, lx: 0, ly: 0 };

  function bindMouse() {
    cv.addEventListener('pointerdown', function (e) {
      drag.on = true;
      drag.shape = e.shiftKey;          // 按住 Shift = 塑形，否则 = 转视角
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
    });
    cv.addEventListener('pointerup', function () { drag.on = false; });
    cv.addEventListener('pointercancel', function () { drag.on = false; });

    cv.addEventListener('pointermove', function (e) {
      var t = clamp(1 - (e.clientY / Hp - 0.20) / 0.52, 0.05, 0.95);
      mouIn.focus = t;
      if (!drag.on) return;
      var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      if (drag.shape) {
        mouIn.pull = clamp(mouIn.pull - dy * 0.05, -1, 1);
        mouIn.squeeze = clamp(mouIn.squeeze + dx * 0.028, -1, 1);
        mouIn.ts = performance.now();
        // 鼠标也归入同一套动作体系，便于在无摄像头时走完工序
        if (Math.abs(dy) > Math.abs(dx) * 1.25) mouIn.act = dy < 0 ? 'pull' : 'press';
        else if (Math.abs(dx) > Math.abs(dy) * 1.25) mouIn.act = 'trim';
        else if (mouIn.squeeze < -0.18) mouIn.act = 'pinch';
        else if (mouIn.squeeze > 0.18) mouIn.act = 'spread';
      } else {
        // 左右 = 绕轴转，上下 = 俯仰
        cam.tYaw -= dx * 0.0085;
        cam.tPitch = clamp(cam.tPitch + dy * 0.0062, PITCH_MIN, PITCH_MAX);
      }
    });

    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.shiftKey) {
        mouIn.squeeze = clamp(-e.deltaY * 0.016, -1, 1);
        mouIn.act = e.deltaY > 0 ? 'pinch' : 'spread';
        mouIn.ts = performance.now();
      } else {
        var k = e.deltaY > 0 ? 1.08 : 1 / 1.08;
        cam.tZoom = clamp(cam.tZoom * k, ZOOM_MIN, ZOOM_MAX);
      }
    }, { passive: false });
  }

  /* =========================================================
     八、工艺工坊面板（左侧）：工序 / 器型 / 泥料 / 烧成 / 釉色 / 鉴赏
     ========================================================= */
  var wsBody = document.getElementById('wsBody');
  var wsRail = document.getElementById('wsRail');
  var wsStageEl = document.getElementById('wsStage');
  var clayNameEl = document.getElementById('clayName');
  var hueNameEl = document.getElementById('hueName');

  var INTENTS = [
    { id: 'tea', name: '茶器', desc: '壶、盏、杯、公道，讲究出水利落与握感温润。' },
    { id: 'flower', name: '花器', desc: '瓶、筒、罐，重瓶口收束与腹身留白。' },
    { id: 'food', name: '食器', desc: '碗、盘、钵，体量适中、釉面易洁。' },
    { id: 'study', name: '文房', desc: '笔筒、水盂、印泥盒，小而精。' },
    { id: 'display', name: '陈设', desc: '雕塑感器型，重造型与釉色表现。' }
  ];
  var GLAZE_METHODS = [
    { id: 'dip', name: '浸釉', desc: '整器浸入釉浆，釉膜均匀完整，釉面最平滑光洁。' },
    { id: 'brush', name: '刷釉', desc: '毛刷层层刷涂，留下竖向刷痕，釉色深浅随笔路起伏。' },
    { id: 'spray', name: '喷釉', desc: '雾状喷布，釉层薄而多微斑，呈细腻的哑光雾面。' },
    { id: 'pour', name: '荡釉', desc: '釉浆荡入内腔再倒出，下半段积釉厚、有色泽垂流。' }
  ];
  function glazeMethodOf(id) {
    for (var i = 0; i < GLAZE_METHODS.length; i++) if (GLAZE_METHODS[i].id === id) return GLAZE_METHODS[i];
    return GLAZE_METHODS[0];
  }
  var glazeMethod = 'dip';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function chips(list, cur, act) {
    var h = '<div class="ws-grid">';
    for (var i = 0; i < list.length; i++) {
      var on = list[i].id === cur ? ' on' : '';
      h += '<button class="ws-chip' + on + '" data-act="' + act + '" data-v="' + list[i].id + '">' + esc(list[i].name) + '</button>';
    }
    return h + '</div>';
  }
  function slider(label, act, min, max, step, val, fmt) {
    return '<div class="ws-row"><label>' + label + '</label>'
      + '<input type="range" data-act="' + act + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">'
      + '<span class="val">' + fmt + '</span></div>';
  }
  function stepHead() {
    var f = FLOW[flowIdx];
    var h = '<div class="ws-h">第' + (flowIdx + 1) + '/' + FLOW.length + '步 ' + esc(f.n) + '</div>';
    h += '<div class="ws-note" style="margin-top:-2px;color:#8a6a4c;font-weight:600">' + esc(f.desc) + '</div>';
    h += '<div class="ws-h mt">这一步你能调节的参数</div>';
    return h;
  }
  function stepNav() {
    var h = '';
    if (flowIdx > 0)
      h += '<button class="btn btn-mini ws-prev" data-act="prev">上一步 ' + esc(FLOW[flowIdx - 1].n) + '</button>';
    if (flowIdx < FLOW.length - 1)
      h += '<button class="btn btn-mini ws-next" data-act="next">下一步 ' + esc(FLOW[flowIdx + 1].n) + '</button>';
    else
      h += '<button class="btn btn-mini ws-next" data-act="restart">重新取泥 再做一件</button>';
    return h;
  }

  /* ---------------- 各步骤参数面板 ---------------- */
  function pageIdea() {
    var h = stepHead();
    h += '<div class="ws-h mt">用途取向</div>';
    h += chips(INTENTS, CRAFT.intent, 'intent');
    var cur = null;
    for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i].id === CRAFT.intent) cur = INTENTS[i];
    if (cur) h += '<div class="ws-note">' + esc(cur.desc) + '</div>';
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  function pageClay() {
    var h = stepHead();
    h += '<div class="ws-note">含铁量决定氧化焰下的暖褐深浅与还原焰下的赤红走向；颗粒度决定烧成后的粗粝或细腻；收缩大 + 急冷会显著提高开裂风险。选好泥后记得「揉练」排气。</div>';
    h += '<div class="ws-h mt">泥料选择</div>';
    for (var i = 0; i < CLAYS.length; i++) {
      var c = CLAYS[i];
      var on = c.id === CRAFT.clay ? ' on' : '';
      h += '<div class="ws-card' + on + '" data-act="clay" data-v="' + c.id + '">'
        + '<b>' + esc(c.name) + '</b>'
        + '<em>颗粒 ' + c.grain.toFixed(2) + ' · 含铁 ' + c.iron.toFixed(2) + ' · 耐火 ' + c.fire.toFixed(2) + ' · 收缩 ' + c.shrink.toFixed(2) + '</em>'
        + '<p>' + esc(c.desc) + '</p></div>';
    }
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  function pageForm() {
    var h = stepHead();
    var acts = stageActs();
    if (acts.length) {
      h += '<div class="ws-h mt">本工序可用手势</div>';
      for (var i = 0; i < acts.length; i++)
        h += '<div class="ws-act on"><div class="tx"><b>' + esc(acts[i].name) + '</b><span>' + esc(acts[i].desc) + '</span></div></div>';
    }
    // 器型 / 气质 / 手法
    h += '<div class="ws-h mt">目标器型</div>';
    h += chips(SHAPES, CRAFT.shape, 'shape');
    h += '<div class="ws-note">' + esc(shapeOf(CRAFT.shape).use) + '</div>';
    h += '<div class="ws-h mt">气质取向</div>';
    for (i = 0; i < TEMPER.length; i++) {
      var t = TEMPER[i], v = CRAFT.temper[t.id];
      var hiOn = v >= 0.5;
      h += '<div class="ws-row wide temper">'
        + '<label class="ep lo' + (hiOn ? '' : ' on') + '" data-v="' + t.id + '">' + esc(t.low) + '</label>'
        + '<input type="range" data-act="temper" data-v="' + t.id + '" min="0" max="1" step="0.01" value="' + v + '">'
        + '<label class="ep hi' + (hiOn ? ' on' : '') + '" data-v="' + t.id + '">' + esc(t.hi) + '</label></div>';
    }
    h += '<div class="ws-h mt">成型手法</div>';
    h += chips(METHODS, CRAFT.method, 'method');
    h += '<div class="ws-note">' + esc(methodOf(CRAFT.method).desc) + '</div>';
    h += '<div class="ws-note" style="margin-top:9px">没有摄像头时用鼠标也能走：<b>Shift+拖动</b> 竖直=提拉/下压、横向=修坯；<b>Shift+滚轮</b>=捏合/外扩。</div>';
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  // 修整重点：各自的介绍与对应的一套手势
  var TRIM_INFO = {
    foot: { desc: '倒扣坯体，从足心向外走刀，修出利落的圈足。圈足是器物与桌面接触之处，修得干净，整体气韵就立住了。', acts: ['trim', 'pat'] },
    rim:  { desc: '手指抵住口沿内侧，刀随转盘轻靠外壁，把口沿修得厚薄均匀、视觉周正。', acts: ['trim'] },
    wall: { desc: '从下往上分层走刀修薄器壁，边修边弹指听声，壁薄而声清是修到位的标志。', acts: ['trim', 'pat'] },
    base: { desc: '修平底时以足心为基准找平，最后把底心微微修凹，烧成后不易变形翘裂。', acts: ['trim', 'pat'] }
  };
  function pageTrim() {
    var h = stepHead();
    h += '<div class="ws-note">这一步决定器物能不能稳稳立住、口沿是否周正。</div>';
    h += '<div class="ws-h mt">修整重点</div>';
    h += chips([{ id: 'foot', name: '修圈足' }, { id: 'rim', name: '规整口沿' }, { id: 'wall', name: '修薄器壁' }, { id: 'base', name: '平底找平' }], CRAFT.trimfocus, 'trimfocus');
    var info = TRIM_INFO[CRAFT.trimfocus] || TRIM_INFO.foot;
    h += '<div class="ws-note">' + esc(info.desc) + '</div>';
    h += '<div class="ws-h mt">对应手势</div>';
    for (var i = 0; i < info.acts.length; i++) {
      var a = ACT_MAP[info.acts[i]];
      if (a) h += '<div class="ws-act on"><div class="tx"><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div></div>';
    }
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  function pageDecor() {
    var h = stepHead();
    h += '<div class="ws-h mt">装饰与肌理</div>';
    h += chips(TEXTURES, CRAFT.texture, 'texture');
    h += '<div class="ws-note">' + esc(texOf(CRAFT.texture).desc) + '</div>';
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  function pageGlaze() {
    var h = stepHead();
    h += '<div class="ws-note" style="margin-bottom:8px">釉浆浸入或刷涂在素坯上，釉色与厚薄决定出窑呈色。点一个传统色，系统会把烧成条件反推到能烧出它的区间。</div>';
    h += '<div class="ws-h mt">施釉方式</div>';
    h += chips(GLAZE_METHODS, glazeMethod, 'glazemethod');
    h += '<div class="ws-note">' + esc(glazeMethodOf(glazeMethod).desc) + '</div>';
    h += '<div class="ws-h mt">呈色选择</div>';
    for (var i = 0; i < HUE_GROUPS.length; i++) {
      var gp = HUE_GROUPS[i];
      h += '<div class="ws-h mt">' + esc(gp.name) + ' ' + esc(gp.cause) + '</div>';
      h += '<div class="ws-swatches">';
      for (var j = 0; j < gp.hues.length; j++) {
        var hu = gp.hues[j];
        var on = (CRAFT.hue && CRAFT.hue.gi === i && CRAFT.hue.hi === j) ? ' on' : '';
        h += '<div class="ws-sw' + on + '" data-act="hue" data-g="' + i + '" data-i="' + j + '" style="background:rgb(' + hu.c.join(',') + ')" title="' + esc(hu.n + ' ' + hu.p) + '"></div>';
      }
      h += '</div>';
    }
    h += '<div class="ws-h mt">当前呈色</div>';
    h += '<div class="ws-note"><b style="color:#8a6a4c">' + esc(currentHueName()) + '</b></div>';
    h += '<div style="margin-top:10px;display:flex;gap:6px">'
      + '<button class="btn btn-mini" data-act="hueauto" style="flex:1">重设呈色</button>'
      + '<button class="btn btn-mini" data-act="glazestart" style="flex:1">开始施釉</button></div>';
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  function pageFire() {
    var h = stepHead();
    var f = CRAFT.firing, fr = firingResult(), nh = nearestHue(fr.rgb);
    h += slider('温度', 'temp', 1180, 1320, 5, f.temp, f.temp + ' ℃');
    h += slider('气氛', 'atmos', 0, 1, 0.01, f.atmos, f.atmos < 0.33 ? '氧化焰' : (f.atmos < 0.7 ? '弱还原' : '强还原'));
    h += slider('落灰量', 'ash', 0, 1, 0.01, f.ash, Math.round(f.ash * 100) + '%');
    h += slider('迎火面', 'fireDir', 0, 360, 5, Math.round(f.fireDir * 57.2958), Math.round(f.fireDir * 57.2958) + '°');
    h += slider('冷却', 'cool', 0, 1, 0.01, f.cool, f.cool < 0.33 ? '慢冷' : (f.cool < 0.66 ? '自然' : '急冷'));
    h += '<div class="ws-h mt">窑位</div>';
    h += chips(KILNPOS, f.pos, 'pos');
    h += '<div class="ws-note">' + esc(posOf(f.pos).desc) + '</div>';
    h += '<div class="ws-h mt">薪柴</div>';
    h += chips(WOODS, f.wood, 'wood');
    h += '<div class="ws-note">' + esc(woodOf(f.wood).desc) + '</div>';
    h += '<div class="ws-h mt">当前推算</div>';
    var sw = 'rgb(' + fr.rgb.map(function (v) { return Math.round(v); }).join(',') + ')';
    h += '<div class="ws-act"><div class="ic" style="background:' + sw + ';border:1px solid rgba(120,96,70,.2)"></div><div class="tx">'
      + '<b>' + esc(nh.hue.n) + ' · ' + esc(nh.group.name) + '</b><span>' + esc(nh.group.cause) + '</span></div></div>';
    h += '<div class="ws-note">光泽 ' + Math.round(fr.gloss * 100) + '% · 流釉 ' + Math.round(fr.run * 100)
      + '% · 粗粝 ' + Math.round(fr.grain * 100) + '% · 火痕 ' + Math.round(fr.fireStr * 100) + '%</div>';
    if (fr.crack > 0.5) h += '<div class="ws-warn">开裂风险 ' + Math.round(fr.crack * 100) + '%：冷却偏快或温度过高，建议放慢冷却或充分阴干。</div>';
    if (fr.slag > 0.4) h += '<div class="ws-warn">接近过烧（' + Math.round(fr.slag * 100) + '%）：可能出现起泡与釉面异常。</div>';
    if (fr.crack <= 0.5 && fr.slag <= 0.4) h += '<div class="ws-ok">当前参数下烧成风险较低。</div>';
    h += '<div style="margin-top:12px;display:flex;gap:6px">'
      + '<button class="btn btn-mini" data-act="kiln">点击烧制</button>'
      + (CRAFT.fired ? '<button class="btn btn-mini" data-act="unfire">退回生坯</button>' : '') + '</div>';
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }
  function pageDone() {
    var f = FLOW[flowIdx];
    var h = '<div class="ws-h">第' + (flowIdx + 1) + '/' + FLOW.length + '步 ' + esc(f.n) + '</div>';
    h += '<div class="ws-note" style="margin-top:-2px;color:#8a6a4c;font-weight:600">' + esc(f.desc) + '</div>';
    var L = appraise();
    for (var i = 0; i < L.length; i++) {
      h += '<div class="ws-rep"><b>' + esc(L[i][0]) + '</b><span>' + esc(L[i][1]) + '</span></div>';
      if (L[i][0] === '风险提示') h += '<div class="ws-warn">' + esc(L[i][1]) + '</div>';
    }
    h += '<div class="ws-note" style="margin-top:4px">口径说明：本说明用于工艺学习与审美分析，不作真伪、年代、窑口或价格判断依据。</div>';
    h += '<div class="ws-nav">' + stepNav() + '</div>';
    return h;
  }

  /* ---------------- 步骤导航条 ---------------- */
  function renderRail() {
    if (!wsRail) return;
    var h = '';
    for (var i = 0; i < FLOW.length; i++) {
      var st = i === flowIdx ? 'on' : '';
      h += '<button class="ws-step ' + st + '" data-step="' + i + '">'
        + '<span class="ws-step-no">' + (i + 1) + '</span>'
        + '<span class="ws-step-tx"><b>' + esc(FLOW[i].n) + '</b><em>' + esc(FLOW[i].brief) + '</em></span>'
        + '</button>';
    }
    wsRail.innerHTML = h;
  }

  function renderPanel() {
    if (!wsBody) return;
    var h = '';
    if (flowIdx === 0) h = pageIdea();
    else if (flowIdx === 1) h = pageClay();
    else if (flowIdx === 2) h = pageForm();
    else if (flowIdx === 3) h = pageTrim();
    else if (flowIdx === 4) h = pageDecor();
    else if (flowIdx === 5) h = pageGlaze();
    else if (flowIdx === 6) h = pageFire();
    else h = pageDone();
    wsBody.innerHTML = h;
    if (wsStageEl) wsStageEl.textContent = FLOW[flowIdx].n;
  }

  function upTo(el, attr) {
    while (el && el !== wsBody) {
      if (el.getAttribute && el.getAttribute(attr)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function bindPanel() {
    if (wsRail) {
      wsRail.addEventListener('click', function (e) {
        var el = e.target;
        while (el && el !== wsRail) {
          if (el.getAttribute && el.getAttribute('data-step') != null) { setFlow(parseInt(el.getAttribute('data-step'), 10)); return; }
          el = el.parentNode;
        }
      });
    }
    if (!wsBody) return;
    wsBody.addEventListener('click', function (e) {
      var el = upTo(e.target, 'data-act');
      if (!el) return;
      var act = el.getAttribute('data-act');
      var v = el.getAttribute('data-v');
      if (act === 'next') { setFlow(Math.min(FLOW.length - 1, flowIdx + 1)); return; }
      if (act === 'prev') { setFlow(Math.max(0, flowIdx - 1)); return; }
      if (act === 'restart') { CRAFT.fired = false; CRAFT.glazed = false; glazeAnim = null; kilnAnim = null; statusMsg = ''; initShape(); resetStages(); renderRail(); renderPanel(); toastMsg = '重新取泥，开始新的 journey'; toastT = performance.now(); return; }
      if (act === 'shape') { CRAFT.shape = v; applyShape(); }
      else if (act === 'clay') CRAFT.clay = v;
      else if (act === 'method') { CRAFT.method = v; applyShape(); }
      else if (act === 'texture') CRAFT.texture = v;
      else if (act === 'intent') CRAFT.intent = v;
      else if (act === 'trimfocus') { CRAFT.trimfocus = v; }
      else if (act === 'glazemethod') { glazeMethod = v; CRAFT.glazed = false; }
      else if (act === 'pos') CRAFT.firing.pos = v;
      else if (act === 'wood') CRAFT.firing.wood = v;
      else if (act === 'kiln') {
        if (kilnAnim) return;                       // 动画进行中忽略重复点击
        kilnAnim = { phase: 'closing', t0: performance.now() };
        toastMsg = '入窑 · 关窑烧制中'; toastT = performance.now();
      }
      else if (act === 'unfire') { CRAFT.fired = false; kilnAnim = null; statusMsg = ''; }
      else if (act === 'hue') {
        var g = parseInt(el.getAttribute('data-g'), 10), i2 = parseInt(el.getAttribute('data-i'), 10);
        CRAFT.hue = { gi: g, hi: i2 };
        applyHueCond(HUE_GROUPS[g].hues[i2]);
        CRAFT.fired = true;
        toastMsg = '已锁定「' + HUE_GROUPS[g].hues[i2].n + '」，并反推烧成条件';
        toastT = performance.now();
      }
      else if (act === 'hueauto') { CRAFT.hue = null; CRAFT.glazed = false; }
      else if (act === 'glazestart') {
        if (glazeAnim) return;                       // 动画进行中忽略重复点击
        glazeAnim = { method: glazeMethod, t0: performance.now() };
        CRAFT.glazed = false;                        // 重新上釉，先回到素坯
        toastMsg = '开始施釉 · ' + glazeMethodOf(glazeMethod).name; toastT = performance.now();
      }
      else return;
      renderPanel();
    });

    wsBody.addEventListener('input', function (e) {
      var el = upTo(e.target, 'data-act');
      if (!el) return;
      var act = el.getAttribute('data-act');
      var val = parseFloat(el.value);
      var f = CRAFT.firing;
      if (act === 'temp') f.temp = val;
      else if (act === 'atmos') f.atmos = val;
      else if (act === 'ash') f.ash = val;
      else if (act === 'fireDir') f.fireDir = val / 57.2958;
      else if (act === 'cool') f.cool = val;
      else if (act === 'temper') { CRAFT.temper[el.getAttribute('data-v')] = val; applyShape(); }
      else return;
      syncSliderLabels();
    });
  }

  function syncSliderLabels() {
    if (!wsBody) return;
    var rs = wsBody.querySelectorAll('input[type=range]');
    for (var i = 0; i < rs.length; i++) {
      var el = rs[i], act = el.getAttribute('data-act');
      // 气质滑条：两端标签高亮当前所偏的一端
      if (act === 'temper') {
        var tv = parseFloat(el.value), row = el.parentNode;
        var lo = row.querySelector('.ep.lo'), hi = row.querySelector('.ep.hi');
        if (lo) lo.className = 'ep lo' + (tv >= 0.5 ? '' : ' on');
        if (hi) hi.className = 'ep hi' + (tv >= 0.5 ? ' on' : '');
        continue;
      }
      var box = el.parentNode.querySelector('.val');
      if (!box) continue;
      var v = parseFloat(el.value), f = CRAFT.firing;
      if (act === 'temp') box.textContent = v + ' ℃';
      else if (act === 'atmos') box.textContent = v < 0.33 ? '氧化焰' : (v < 0.7 ? '弱还原' : '强还原');
      else if (act === 'ash') box.textContent = Math.round(v * 100) + '%';
      else if (act === 'fireDir') box.textContent = Math.round(v) + '°';
      else if (act === 'cool') box.textContent = v < 0.33 ? '慢冷' : (v < 0.66 ? '自然' : '急冷');
    }
  }

  var panelTick = 0, lastFlow = -1, lastStage = -1;
  function tickPanel() {
    if (!wsBody) return;
    if (wsStageEl) wsStageEl.textContent = FLOW[flowIdx].n;
    if (clayNameEl) clayNameEl.textContent = clayOf(CRAFT.clay).name;
    if (hueNameEl) hueNameEl.textContent = CRAFT.fired ? currentHueName().split('（')[0] : '生坯';

    if (flowIdx !== lastFlow) { lastFlow = flowIdx; renderRail(); renderPanel(); }
    if (flowIdx === 2) {  // 拉坯步骤：实时更新工序进度条
      var p = wsBody.querySelector('.ws-prog i');
      if (p) p.style.width = Math.round(ST.prog / Math.max(0.01, STAGES[ST.i].need) * 100) + '%';
      if (ST.i !== lastStage) { lastStage = ST.i; renderPanel(); }
    } else if (panelTick % 45 === 0 && (flowIdx === 5 || flowIdx === 6 || flowIdx === 7)) {
      renderPanel();   // 施釉 / 烧成 / 成器 页需随参数刷新推算
    }
    panelTick++;
  }

  /* =========================================================
     七、HUD
     ========================================================= */
  var lastHud = 0;

  function updateHUD(now) {
    if (now - lastHud < 90) return;
    lastHud = now;

    // 工序推进 / 参数变更的提示优先显示 2.4 秒
    var toastOn = toastT && (now - toastT) < 2400;

    // 第一行：检测到几只手（摄影区域下方）
    var hc = g.hands | 0;
    handCountEl.textContent =
      hc <= 0 ? '未检测到手部动作' :
      (hc === 1 ? '检测到单手手部动作' : '检测到双手手部动作');

    // 第二行：实时显示当前手势 + 对应作用（摄影区域下方）
    var detail = (g.act && (g.active || demoMode)) ? actDetail(g.act) : '';
    if (toastOn) gestureText.textContent = toastMsg;
    else if (detail) gestureText.textContent = detail;
    else if (statusMsg) gestureText.textContent = statusMsg;
    else gestureText.textContent = '等待手部动作';

    vesselNameEl.textContent = vesselName();

    var maxR = 0;
    for (var i = 0; i < SEG; i++) maxR = Math.max(maxR, rN[i]);
    var vh = clamp((hN - 0.35) / (2.25 - 0.35), 0, 1);
    var vw = clamp((maxR - 0.35) / (1.95 - 0.35), 0, 1);
    mH.style.width = (vh * 100).toFixed(1) + '%';
    mW.style.width = (vw * 100).toFixed(1) + '%';
    mWk.style.width = (work * 100).toFixed(1) + '%';
    btnSpin.textContent = spinOn ? '暂停转盘' : '继续转盘';
  }

  /* =========================================================
     八、主循环
     ========================================================= */
  var last = 0;

  function frame() {
    var now = performance.now();
    if (!last) last = now;
    var dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;

    resolveInput(dt);
    updateClay(dt);
    updateSpin(dt);
    camUpdate(dt);
    draw();
    updateHUD(now);
    tickPanel();

    requestAnimationFrame(frame);
  }

  /* =========================================================
     九、初始化
     ========================================================= */
  function init() {
    resize();
    initShape();
    bindMouse();
    bindPanel();
    var mstep = /step=(\w+)/.exec(location.hash || '');   // #step=fire 直达某工序，便于调试与展示
    var mtab = /tab=(\w+)/.exec(location.hash || '');
    if (mstep) { for (var fi = 0; fi < FLOW.length; fi++) if (FLOW[fi].id === mstep[1]) setFlow(fi); }
    renderRail();
    renderPanel();

    btnCam.addEventListener('click', startCamera);
    btnSave.addEventListener('click', saveArtwork);
    btnView.addEventListener('click', function () {
      cam.tYaw = HOME.yaw; cam.tPitch = HOME.pitch; cam.tZoom = HOME.zoom;
    });
    btnSpin.addEventListener('click', function () {
      spinOn = !spinOn;
      btnSpin.textContent = spinOn ? '暂停转盘' : '继续转盘';
    });
    btnReset.addEventListener('click', function () {
      initShape();
      resetStages();
      CRAFT.fired = false;
      CRAFT.glazed = false;
      glazeAnim = null;
      kilnAnim = null;
      g.pull = 0; g.squeeze = 0;
      renderPanel();
      setStatus(camOn ? '重新取泥，请开始捏陶' : '等待手势');
    });

    window.addEventListener('resize', function () {
      resize();
      if (camOn) sizeOverlay();
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { resize(); if (camOn) sizeOverlay(); }, 300);
    });

    // 链接参数：#cam 自动开摄像头，#demo 自动演示，#yaw=..&pitch=.. 指定视角
    var hh = location.hash || '';
    var myaw = /yaw=(-?[\d.]+)/.exec(hh), mpit = /pitch=(-?[\d.]+)/.exec(hh), mzoom = /zoom=(-?[\d.]+)/.exec(hh);
    if (myaw) { cam.tYaw = cam.yaw = parseFloat(myaw[1]); }
    if (mpit) { cam.tPitch = cam.pitch = clamp(parseFloat(mpit[1]), PITCH_MIN, PITCH_MAX); }
    if (mzoom) { cam.tZoom = cam.zoom = clamp(parseFloat(mzoom[1]), ZOOM_MIN, ZOOM_MAX); }
    var mpot = /pot=(\w+)/.exec(hh);
    if (mpot) seedShape(mpot[1]);
    // 内嵌预览面板里摄像头常被限制，提前告知，避免用户以为识别坏了
    var inFrame = false;
    try { inFrame = window.self !== window.top; } catch (err) { inFrame = true; }
    if (inFrame) {
      D.err = '当前嵌在预览面板内，摄像头可能被限制 · 建议用浏览器直接打开本文件';
      renderDiag();
    }
    if (hh.indexOf('cam') >= 0) startCamera();
    if (location.hash && location.hash.indexOf('demo') >= 0) {
      demoMode = true;
      demoT0 = performance.now();
      setFlow(2);   // 演示从「拉坯」开始
      ensureStarted();
    }
    if (mpot) setFlow(2);   // 直接展示器型时定位到拉坯步骤
    if (mtab) { for (var fi2 = 0; fi2 < FLOW.length; fi2++) if (FLOW[fi2].id === mtab[1]) setFlow(fi2); }
    renderRail();

    requestAnimationFrame(frame);
  }

  init();
})();
