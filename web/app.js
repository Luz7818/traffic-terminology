/* 交通用语转换器前端逻辑（配合 data.js 使用） */
(function () {
  'use strict';

  var DATA = window.TRAFFIC_DATA;
  var entries = DATA.entries;
  var phrases = DATA.phrases;
  var maxLen = DATA.maxLen || 16;

  /* ---------- 地区方言层：DATA.dialects 由 build_web.py 生成 ----------
     通用模式合并全部地区的方言（dialectAll，带来源地区）；选定地区后只叠加该地区。 */
  var regionCode = null;
  var dialectPhrases = null; // 当前生效的 { 方言说法: {i: 词条下标, s?: 句中改写, region: 来源地区} }
  var dialectAll = {};
  if (DATA.dialects) {
    Object.keys(DATA.dialects).forEach(function (code) {
      var d = DATA.dialects[code];
      Object.keys(d.phrases).forEach(function (p) {
        var it = d.phrases[p];
        dialectAll[p] = { i: it.i, s: it.s, n: it.n, region: d.region };
      });
    });
  }

  var ONE_CHAR_DIALECT = {}; // 当前地区方言库的单字键
  function setRegion(code) {
    var d = code && DATA.dialects ? DATA.dialects[code] : null;
    regionCode = d ? code : null;
    if (d) {
      // data.js 里地区层条目不带 region，这里补上来源地区，
      // 否则选中地区后结果徽标会渲染成「null方言」
      var withRegion = {};
      Object.keys(d.phrases).forEach(function (p) {
        withRegion[p] = { i: d.phrases[p].i, s: d.phrases[p].s, n: d.phrases[p].n, region: d.region };
      });
      dialectPhrases = withRegion;
    } else {
      dialectPhrases = dialectAll;
    }
    ONE_CHAR_DIALECT = {};
    if (dialectPhrases) {
      Object.keys(dialectPhrases).forEach(function (k) {
        if (k.length === 1) ONE_CHAR_DIALECT[k] = true;
      });
    }
    try { localStorage.setItem('tt_region', regionCode || ''); } catch (e) { /* ignore */ }
  }
  function getRegion() { return regionCode; }
  try { setRegion(localStorage.getItem('tt_region') || null); } catch (e) { /* ignore */ }

  /* ---------- 口语 → 术语 核心分析（纯函数，node 回归可直接加载） ---------- */
  var ONE_CHAR = {};
  Object.keys(phrases).forEach(function (k) {
    if (k.length === 1) ONE_CHAR[k] = true;
  });

  // 句中平滑规则：字面替换后按序各做一次字面修正，压掉高频病句（如「根本因拥堵」）
  var SMOOTH_RULES = [
    ['被发生', '发生'],
    ['根本因', '因'],
    ['实在因', '因'],
    ['违法变更车道太严重', '违法变更车道行为多发'],
    ['行为太严重', '行为多发'],
    ['现象太严重', '现象多发'],
    ['溢出了', '溢出'],
    ['中央中央分隔带', '中央分隔带'],
    ['中间中央分隔带', '中间的中央分隔带'],
  ];

  function analyze(text) {
    var scanText = maskForScan(text);
    var spans = [];
    var i = 0;
    while (i < scanText.length) {
      var found = null;
      var maxL = Math.min(maxLen, scanText.length - i);
      for (var L = maxL; L >= 2; L--) {
        var sub = scanText.slice(i, i + L);
        var base = phrases[sub];
        var dial = !base && dialectPhrases ? dialectPhrases[sub] : null;
        if (base) { found = { s: i, e: i + L, ids: base }; break; }
        if (dial) {
          found = { s: i, e: i + L, ids: [dial.i], dialect: true, ds: dial.s, dr: dial.region };
          break;
        }
      }
      if (!found && ONE_CHAR[scanText[i]]) {
        found = { s: i, e: i + 1, ids: phrases[scanText[i]] };
      }
      if (!found && ONE_CHAR_DIALECT[scanText[i]]) {
        var d1 = dialectPhrases[scanText[i]];
        found = { s: i, e: i + 1, ids: [d1.i], dialect: true, ds: d1.s, dr: d1.region };
      }
      if (found) { spans.push(found); i = found.e; } else { i++; }
    }

    var segments = [];
    var pos = 0;
    spans.forEach(function (sp) {
      if (sp.s > pos) segments.push({ type: 'text', text: text.slice(pos, sp.s) });
      segments.push({
        type: 'match', text: text.slice(sp.s, sp.e), ids: sp.ids,
        dialect: sp.dialect || false, ds: sp.ds || null, dr: sp.dr || null,
      });
      pos = sp.e;
    });
    if (pos < text.length) segments.push({ type: 'text', text: text.slice(pos) });

    var terms = [];
    var byIdx = {};
    segments.forEach(function (seg) {
      if (seg.type !== 'match') return;
      var primary = seg.ids[0];
      if (!byIdx[primary]) {
        byIdx[primary] = { idx: primary, frags: [], alts: [] };
        terms.push(byIdx[primary]);
      }
      var grp = byIdx[primary];
      if (grp.frags.indexOf(seg.text) === -1) grp.frags.push(seg.text);
      for (var j = 1; j < seg.ids.length; j++) {
        if (grp.alts.indexOf(seg.ids[j]) === -1) grp.alts.push(seg.ids[j]);
      }
    });

    return { segments: segments, terms: terms };
  }

  // 该口语片段在句中应替换成什么：方言片段用方言库的句中形式，
  // 其余优先 surface（句中改写），否则标准术语
  function surfaceOf(ent, seg) {
    if (seg.dialect) return seg.ds || ent.zh;
    return (ent.sf && ent.sf[seg.text]) || ent.zh;
  }

  // 扫描掩码：这些常用词内部含有可误匹配的键（如「电动车」含「动车」），
  // 扫描时逐字替换成哨兵字符使其不参与匹配；段落的展示文本仍取原文，
  // 两者按字符位一一对应，不影响高亮与替换定位。
  var MASK_TERMS = ['电动车'];
  function maskForScan(text) {
    var out = text;
    MASK_TERMS.forEach(function (t) {
      out = out.replaceAll(t, '\u0001'.repeat(t.length));
    });
    return out;
  }

  function smooth(text) {
    SMOOTH_RULES.forEach(function (r) {
      text = text.replaceAll(r[0], r[1]);
    });
    return text;
  }

  // 术语化改写文本：逐段替换 + 平滑
  function toConverted(segments) {
    var out = '';
    segments.forEach(function (seg) {
      out += seg.type === 'text' ? seg.text : surfaceOf(entries[seg.ids[0]], seg);
    });
    return smooth(out);
  }

  window.TrafficMatcher = { analyze: analyze, toConverted: toConverted, smooth: smooth, setRegion: setRegion, getRegion: getRegion };

  // 非浏览器环境（scripts/web_check.py 的 node 回归）到此为止，以下不碰 DOM
  if (typeof document === 'undefined') return;

  /* ---------- 浏览器端基础数据 ---------- */
  var catList = [];
  var catCount = {};
  entries.forEach(function (e) {
    if (!(e.cat in catCount)) { catCount[e.cat] = 0; catList.push(e.cat); }
    catCount[e.cat]++;
  });

  /* 领域色板：同一低饱和家族（S≈40%、L≈40%），按数据里的类别顺序一一对应。
     功能色仍要区分九个领域，但收进一个色族，避免满屏彩虹。 */
  var PALETTE = ['#4a6d8c', '#2e7f8a', '#b0802f', '#c0653a', '#5b6fb3',
    '#3e8258', '#7d59a0', '#b3524e', '#8a7048', '#5f6b64'];
  var catColor = {};
  catList.forEach(function (c, i) { catColor[c] = PALETTE[i % PALETTE.length]; });

  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function el(tag, cls, text, opts) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (opts && opts.html) node.innerHTML = opts.html;
    else if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function copyText(t, okMsg) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      return true;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast(okMsg); }, function () { legacy(); toast(okMsg); });
    } else {
      legacy();
      toast(okMsg);
    }
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  /* ---------- 口语转换视图 ---------- */
  var inputEl = document.getElementById('input');
  // 输入框随内容自动长高（上限约 8 行），长句不用来回拖滚动条
  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 208) + 'px';
  }
  inputEl.addEventListener('input', autoGrow);
  var resultEl = document.getElementById('result');

  function renderMarkSpans(container, segments, groupsByKey) {
    // groupsByKey: match 文本+首个id -> 分组序号
    segments.forEach(function (seg) {
      if (seg.type === 'text') {
        container.appendChild(el('span', null, seg.text));
      } else {
        var ent = entries[seg.ids[0]];
        var color = catColor[ent.cat] || '#4a6d8c';
        var m = el('mark', 'term' + (seg.dialect ? ' mark-dialect' : ''), seg.text);
        m.style.background = hexToRgba(color, 0.14);
        m.style.borderBottom = '2px solid ' + color;
        m.title = (seg.dialect ? (seg.dr || '方言') + '：' + seg.text + ' → ' : '') + ent.zh + ' · ' + ent.en;
        var gi = groupsByKey[seg.text + '|' + seg.ids[0]];
        if (gi !== undefined) m.dataset.gi = gi;
        container.appendChild(m);
      }
    });
  }

  function buildGroupKeyMap(terms) {
    // 分组序号 -> 以「原文片段|词条idx」为键(用 id 索引不便,直接以 idx 为键)
    var map = {};
    terms.forEach(function (g, i) {
      g.frags.forEach(function (f) {
        map[f + '|' + g.idx] = i;
      });
    });
    return map;
  }

  function convert() {
    autoGrow();
    var text = inputEl.value.trim();
    if (!text) { toast('请先输入内容'); inputEl.focus(); return; }
    saveHistory(text);

    var r = analyze(text);
    var converted = toConverted(r.segments);
    resultEl.innerHTML = '';

    var card = el('div', 'card result-card');
    var head = el('div', 'result-head');
    head.appendChild(el('h3', null, '转换结果'));
    var dialectSegs = r.segments.filter(function (s) { return s.type === 'match' && s.dialect; });
    if (dialectSegs.length) {
      var regions = [];
      dialectSegs.forEach(function (s) {
        if (regions.indexOf(s.dr) === -1) regions.push(s.dr);
      });
      var label = (regions.length === 1 ? regions[0] + '方言' : '方言') + ' ×' + dialectSegs.length;
      if (regions.length > 1) label += '（' + regions.join('、') + '）';
      head.appendChild(el('span', 'dialect-badge', label));
    }
    var headBtns = el('div');
    var copyAll = el('button', 'btn mini', '复制术语化表述');
    copyAll.addEventListener('click', function () { copyText(converted, '已复制术语化表述'); });
    headBtns.appendChild(copyAll);
    head.appendChild(headBtns);
    card.appendChild(head);

    if (!r.terms.length) {
      var empty = el('div', 'empty');
      empty.appendChild(el('div', 'icon', '', {
        html: '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M17 5 9 43M31 5l8 38"/><path d="M24 7v5M24 18v5M24 29v5" stroke-dasharray="1 6"/></svg>',
      }));
      empty.appendChild(el('p', null, '这段话里没有识别到可转换的交通表述'));
      empty.appendChild(el('p', null, '试试上方的示例对比，或浏览术语库了解可识别的说法'));
      card.appendChild(empty);
      resultEl.appendChild(card);
      return;
    }

    var gkey = buildGroupKeyMap(r.terms);

    card.appendChild(el('div', 'section-label', '术语化改写'));
    var convBox = el('div', 'converted-box');
    // 改写视图中以词条 id 定位分组（同一术语多次出现合并）
    var convGroups = {};
    r.terms.forEach(function (g, i) { convGroups[g.idx] = i; });
    r.segments.forEach(function (seg) {
      if (seg.type === 'text') {
        convBox.appendChild(el('span', null, seg.text));
      } else {
        var ent = entries[seg.ids[0]];
        // 改写视图统一用品牌绿标记术语，突出「口语 → 专业」的对比；分类色留在原文对照与卡片
        var m = el('mark', 'term term-out' + (seg.dialect ? ' mark-dialect' : ''), surfaceOf(ent, seg));
        m.title = ent.zh + ' · ' + ent.en + '（点击查看释义）';
        m.dataset.gi = convGroups[seg.ids[0]];
        convBox.appendChild(m);
      }
    });
    card.appendChild(convBox);

    card.appendChild(el('div', 'section-label', '原文对照'));
    var origBox = el('div', 'original-box');
    renderMarkSpans(origBox, r.segments, gkey);
    card.appendChild(origBox);

    card.appendChild(el('div', 'section-label', '涉及术语（' + r.terms.length + '）'));
    var grid = el('div', 'term-grid');
    r.terms.forEach(function (g, i) {
      grid.appendChild(termCard(g, i));
    });
    card.appendChild(grid);

    resultEl.appendChild(card);

    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // mark 点击 → 滚动到对应卡片并闪烁
    resultEl.querySelectorAll('mark.term[data-gi]').forEach(function (m) {
      m.addEventListener('click', function () {
        var tc = document.getElementById('tc-' + m.dataset.gi);
        if (!tc) return;
        tc.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tc.classList.remove('flash');
        void tc.offsetWidth;
        tc.classList.add('flash');
      });
    });
  }

  function termCard(g, i) {
    var ent = entries[g.idx];
    var color = catColor[ent.cat] || '#4a6d8c';
    var card = el('div', 'tcard');
    card.id = 'tc-' + i;
    card.style.setProperty('--c', color);
    card.style.setProperty('--cbg', hexToRgba(color, 0.1));
    card.style.animationDelay = (i * 60) + 'ms';

    var top = el('div', 'tcard-top');
    top.appendChild(el('span', 'badge', ent.cat));
    top.appendChild(el('span', 'tid', ent.id));
    card.appendChild(top);

    var term = el('div', 'tterm', ent.zh);
    var en = el('span', 'en', ent.en);
    term.appendChild(en);
    card.appendChild(term);

    card.appendChild(el('div', 'tdef', ent.def));

    var frag = el('div', 'tfrag', '原文：');
    g.frags.forEach(function (f, k) {
      if (k) frag.appendChild(el('span', null, '、'));
      frag.appendChild(el('b', null, f));
    });
    card.appendChild(frag);

    if (ent.rel && ent.rel.length) {
      var rel = el('div', 'trel');
      rel.appendChild(el('span', 'trel-label', '关联：'));
      ent.rel.slice(0, 5).forEach(function (rname) {
        var chip = el('button', 'rel-chip', rname);
        chip.addEventListener('click', function () {
          switchTab('browse');
          searchInput.value = rname;
          doSearch();
        });
        rel.appendChild(chip);
      });
      card.appendChild(rel);
    }

    if (ent.std) card.appendChild(el('div', 'tstd', '依据：' + ent.std));
    if (ent.dis) card.appendChild(el('div', 'tstd', '消歧：' + ent.dis));

    if (g.alts.length) {
      var alt = el('div', 'talt');
      alt.appendChild(el('span', null, '该说法也可指：'));
      g.alts.forEach(function (aid, k) {
        if (k) alt.appendChild(el('span', null, '、'));
        var a = el('a', null, entries[aid].zh);
        a.addEventListener('click', function () { openModal(aid); });
        alt.appendChild(a);
      });
      card.appendChild(alt);
    }

    var foot = el('div', 'tcard-foot');
    var cp = el('button', 'btn mini', '复制术语');
    cp.addEventListener('click', function () {
      copyText(ent.zh + '（' + ent.en + '）', '已复制：' + ent.zh);
    });
    foot.appendChild(cp);
    var more = el('button', 'btn mini', '详情');
    more.addEventListener('click', function () { openModal(g.idx); });
    foot.appendChild(more);
    card.appendChild(foot);

    return card;
  }

  /* ---------- 地区方言选择器 ---------- */
  function renderRegionChipsInto(wrap) {
    wrap.innerHTML = '';
    var chips = [{ code: null, name: '通用' }];
    if (DATA.dialects) {
      Object.keys(DATA.dialects).forEach(function (code) {
        chips.push({ code: code, name: DATA.dialects[code].region });
      });
    }
    chips.forEach(function (c) {
      var b = el('button', 'chip region' + (getRegion() === c.code ? ' active' : ''), c.name);
      b.setAttribute('aria-pressed', getRegion() === c.code ? 'true' : 'false');
      if (c.code && DATA.dialects[c.code].note) b.title = DATA.dialects[c.code].note;
      b.addEventListener('click', function () {
        setRegion(c.code);
        renderRegions();
        renderDialectPanel();
        var grid = document.getElementById('demo-grid');
        if (grid) { grid.innerHTML = ''; renderDemo(); }
        if (inputEl.value.trim()) convert();
      });
      wrap.appendChild(b);
    });
  }
  function renderRegions() {
    var wrap = document.getElementById('region-chips');
    if (wrap) renderRegionChipsInto(wrap);
  }

  /* ---------- 示例对比（口语 vs 术语化改写，由真实引擎渲染，不手写结果） ---------- */
  var DEMO_SENTENCES = [
    '早高峰那个红绿灯路口加塞太严重，车根本走不动',
    '骑电动车被拍了，说我压线',
    '导航说前面堵死了，是不是出事故了',
  ];

  function demoParagraph(container, segments, markCls, useSurface) {
    var p = el('p', 'demo-text');
    segments.forEach(function (seg) {
      if (seg.type === 'text') {
        p.appendChild(el('span', null, seg.text));
      } else {
        var ent = entries[seg.ids[0]];
        p.appendChild(el('mark', markCls, useSurface ? surfaceOf(ent, seg) : seg.text));
      }
    });
    container.appendChild(p);
  }

  function renderDemo() {
    var grid = document.getElementById('demo-grid');
    if (!grid) return;
    DEMO_SENTENCES.forEach(function (text) {
      var r = analyze(text);
      if (!r.terms.length) return;
      var card = el('div', 'demo-card');
      card.setAttribute('role', 'button');
      card.tabIndex = 0;

      var before = el('div', 'demo-box demo-before');
      before.appendChild(el('span', 'demo-tag demo-tag-before', '口语原句'));
      demoParagraph(before, r.segments, 'demo-mark', false);

      var after = el('div', 'demo-box demo-after');
      after.appendChild(el('span', 'demo-tag demo-tag-after', '术语化改写'));
      demoParagraph(after, r.segments, 'demo-mark demo-mark-term', true);

      card.appendChild(before);
      card.appendChild(el('div', 'demo-arrow', '', {
        html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16m0 0-5-5m5 5 5-5"/></svg>',
      }));
      card.appendChild(after);

      function open() {
        inputEl.value = text;
        convert();
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      grid.appendChild(card);
    });
  }

  /* ---------- 术语库：方言对照面板（随地区选择联动） ---------- */
  function renderDialectPanel() {
    var panel = document.getElementById('dialect-panel');
    if (!panel) return;
    panel.innerHTML = '';
    var groups = regionCode ? [regionCode] : Object.keys(DATA.dialects);
    if (!groups.length) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    var total = 0;
    groups.forEach(function (code) { total += Object.keys(DATA.dialects[code].phrases).length; });
    var head = el('div', 'dialect-head');
    head.appendChild(el('span', 'dialect-title',
      '方言对照 · ' + (regionCode ? DATA.dialects[regionCode].region : '全部地区')));
    head.appendChild(el('span', 'dialect-count',
      total + ' 条，点击查看术语详情' + (regionCode ? '' : '（通用已含全部地区）')));
    var chipsWrap = el('div', 'dialect-chips');
    head.appendChild(chipsWrap);
    renderRegionChipsInto(chipsWrap);
    panel.appendChild(head);
    groups.forEach(function (code) {
      var d = DATA.dialects[code];
      if (!regionCode) {
        panel.appendChild(el('div', 'dialect-group', d.region));
      }
      Object.keys(d.phrases).forEach(function (phrase) {
        var item = d.phrases[phrase];
        var ent = entries[item.i];
        var row = el('button', 'dialect-row');
        row.type = 'button';
        row.appendChild(el('span', 'dialect-phrase', phrase));
        if (item.n) row.appendChild(el('span', 'dialect-note', item.n));
        var right = el('span', 'dialect-term');
        right.appendChild(el('b', null, ent.zh));
        right.appendChild(el('span', 'dialect-en', ent.en));
        row.appendChild(right);
        row.addEventListener('click', function () { openModal(item.i); });
        panel.appendChild(row);
      });
    });
  }

  /* ---------- 术语库视图 ---------- */
  var searchInput = document.getElementById('browse-search');
  var browseCount = document.getElementById('browse-count');
  var browseList = document.getElementById('browse-list');
  var browseMore = document.getElementById('browse-more');
  var catChipsEl = document.getElementById('cat-chips');

  var state = { q: '', cat: null, shown: 80 };
  var PAGE = 80;
  var filtered = [];

  function buildCatChips() {
    var all = el('button', 'cat-chip active', '全部 ' + entries.length);
    all.style.setProperty('--c', '#4a6d8c');
    all.style.setProperty('--cshadow', 'rgba(74,109,140,.3)');
    all.addEventListener('click', function () { state.cat = null; state.shown = PAGE; refreshChips(); doSearch(); });
    all.dataset.cat = '';
    catChipsEl.appendChild(all);
    catList.forEach(function (c) {
      var b = el('button', 'cat-chip', c + ' ' + catCount[c]);
      b.style.setProperty('--c', catColor[c]);
      b.style.setProperty('--cshadow', hexToRgba(catColor[c], 0.35));
      b.dataset.cat = c;
      b.addEventListener('click', function () {
        state.cat = c; state.shown = PAGE; refreshChips(); doSearch();
      });
      catChipsEl.appendChild(b);
    });
  }

  function refreshChips() {
    catChipsEl.querySelectorAll('.cat-chip').forEach(function (chip) {
      var c = chip.dataset.cat;
      chip.classList.toggle('active', (state.cat || '') === c);
    });
  }

  function doSearch() {
    var q = state.q.trim().toLowerCase();
    filtered = [];
    entries.forEach(function (e, idx) {
      if (state.cat && e.cat !== state.cat) return;
      if (q) {
        var hit = e.zh.toLowerCase().indexOf(q) > -1 ||
          e.en.toLowerCase().indexOf(q) > -1 ||
          e.def.toLowerCase().indexOf(q) > -1;
        if (!hit && e.col) {
          for (var i = 0; i < e.col.length; i++) {
            if (e.col[i].toLowerCase().indexOf(q) > -1) { hit = true; break; }
          }
        }
        if (!hit) return;
      }
      filtered.push(idx);
    });
    renderBrowse();
  }

  function renderBrowse() {
    browseList.innerHTML = '';
    browseCount.textContent = '共 ' + filtered.length + ' 条';
    var showN = Math.min(state.shown, filtered.length);
    for (var i = 0; i < showN; i++) {
      browseList.appendChild(browseRow(filtered[i], i));
    }
    browseMore.classList.toggle('hidden', filtered.length <= showN);
    browseMore.textContent = '加载更多（还有 ' + (filtered.length - showN) + ' 条）';
  }

  function browseRow(idx, i) {
    var e = entries[idx];
    var color = catColor[e.cat] || '#4a6d8c';
    var row = el('div', 'brow');
    row.style.setProperty('--c', color);
    row.style.animationDelay = Math.min(i, 12) * 25 + 'ms';

    var top = el('div', 'brow-top');
    top.appendChild(el('span', 'bterm', e.zh));
    top.appendChild(el('span', 'ben', e.en));
    top.appendChild(el('span', 'badge', e.cat));
    row.appendChild(top);

    var badge = row.querySelector('.badge');
    badge.style.setProperty('--c', color);
    badge.style.setProperty('--cbg', hexToRgba(color, 0.1));

    row.appendChild(el('div', 'bdef', e.def));
    var col = el('div', 'bcol');
    col.appendChild(el('span', null, '口语：'));
    var maxShow = 4;
    for (var k = 0; k < Math.min(e.col.length, maxShow); k++) {
      if (k) col.appendChild(el('span', null, ' / '));
      col.appendChild(el('b', null, e.col[k]));
    }
    if (e.col.length > maxShow) col.appendChild(el('span', null, ' 等 ' + e.col.length + ' 个说法'));
    row.appendChild(col);

    row.addEventListener('click', function () { openModal(idx); });
    return row;
  }

  browseMore.addEventListener('click', function () {
    state.shown += PAGE;
    renderBrowse();
  });

  var searchTimer = null;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = searchInput.value;
      state.shown = PAGE;
      doSearch();
    }, 160);
  });

  /* ---------- 详情弹窗 ---------- */
  var modal = document.getElementById('modal');
  var modalBody = document.getElementById('modal-body');

  function openModal(idx) {
    var e = entries[idx];
    var color = catColor[e.cat] || '#4a6d8c';
    modalBody.innerHTML = '';

    modalBody.appendChild(el('div', 'm-title', e.zh));
    modalBody.appendChild(el('div', 'm-en', e.en));
    var meta = el('div', 'm-meta');
    var badge = el('span', 'badge', e.cat);
    badge.style.setProperty('--c', color);
    badge.style.setProperty('--cbg', hexToRgba(color, 0.1));
    meta.appendChild(badge);
    meta.appendChild(el('span', 'tid', e.id));
    modalBody.appendChild(meta);
    modalBody.appendChild(el('div', 'm-def', e.def));

    modalBody.appendChild(el('div', 'm-sec', '口语说法（' + e.col.length + '）'));
    var chips = el('div', 'm-chips');
    e.col.forEach(function (c) { chips.appendChild(el('span', 'rel-chip', c)); });
    modalBody.appendChild(chips);

    if (e.rel && e.rel.length) {
      modalBody.appendChild(el('div', 'm-sec', '关联术语'));
      var rel = el('div', 'm-chips');
      e.rel.forEach(function (rname) {
        var chip = el('button', 'rel-chip', rname);
        chip.addEventListener('click', function () {
          closeModal();
          switchTab('browse');
          searchInput.value = rname;
          state.q = rname;
          state.shown = PAGE;
          doSearch();
        });
        rel.appendChild(chip);
      });
      modalBody.appendChild(rel);
    }

    if (e.std) {
      modalBody.appendChild(el('div', 'm-sec', '依据标准'));
      modalBody.appendChild(el('div', 'm-std', e.std));
    }

    if (e.dis) {
      modalBody.appendChild(el('div', 'm-sec', '消歧说明'));
      modalBody.appendChild(el('div', 'm-std', e.dis));
    }

    modalBody.appendChild(el('div', 'm-sec', ''));
    var btnRow = el('div', 'm-chips');
    var cp = el('button', 'btn primary', '复制术语');
    cp.addEventListener('click', function () {
      copyText(e.zh + '（' + e.en + '）', '已复制：' + e.zh);
    });
    btnRow.appendChild(cp);
    modalBody.appendChild(btnRow);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ---------- 标签页切换 ---------- */
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('view-convert').classList.toggle('active', name === 'convert');
    document.getElementById('view-browse').classList.toggle('active', name === 'browse');
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.tab); });
  });

  /* ---------- 历史记录 ---------- */
  var HKEY = 'tt_history';
  var historyEl = document.getElementById('history');

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; }
  }
  function saveHistory(text) {
    var h = loadHistory().filter(function (x) { return x !== text; });
    h.unshift(text);
    h = h.slice(0, 8);
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) { /* ignore */ }
    renderHistory();
  }
  function renderHistory() {
    var h = loadHistory();
    historyEl.classList.toggle('hidden', !h.length);
    historyEl.innerHTML = '';
    historyEl.appendChild(el('span', 'history-label', '最近：'));
    h.forEach(function (q) {
      var chip = el('button', 'chip hist', q.length > 22 ? q.slice(0, 22) + '…' : q);
      chip.title = q;
      chip.addEventListener('click', function () {
        inputEl.value = q;
        convert();
      });
      historyEl.appendChild(chip);
    });
    var del = el('button', 'chip hist-del', '清空历史');
    del.addEventListener('click', function () {
      try { localStorage.removeItem(HKEY); } catch (e) { /* ignore */ }
      renderHistory();
    });
    historyEl.appendChild(del);
  }

  /* ---------- 初始化 ---------- */
  var statsEl = document.getElementById('stats');
  [
    [DATA.meta.entries, '条术语'],
    [DATA.meta.colloquial, '个口语匹配键'],
    [catList.length, '个领域'],
  ].forEach(function (s) {
    var chip = el('span', 'stat-chip');
    var b = el('b', null, String(s[0]));
    chip.appendChild(b);
    chip.appendChild(document.createTextNode(s[1]));
    statsEl.appendChild(chip);
  });
  document.getElementById('foot-count').textContent =
    DATA.meta.entries + ' 条术语 · ' + DATA.meta.colloquial + ' 个口语匹配键（去括注后去重）';

  document.getElementById('btn-convert').addEventListener('click', convert);
  document.getElementById('btn-clear').addEventListener('click', function () {
    inputEl.value = '';
    resultEl.innerHTML = '';
    inputEl.focus();
  });
  inputEl.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') convert();
  });
  document.querySelectorAll('.example').forEach(function (chip) {
    chip.addEventListener('click', function () {
      inputEl.value = chip.textContent;
      convert();
    });
  });

  buildCatChips();
  doSearch();
  renderHistory();
  renderRegions();
  renderDialectPanel();
  renderDemo();

  // 回链只在「确实有上一级站点」时保留：file: 下上一级只是本地目录，
  // 而本站跑在根路径时 ../ 解析回来就是本页自己，点了等于刷新
  var backEl = document.querySelector('.back');
  if (backEl) {
    var strip = function (p) { return p.replace(/index\.html$/, ''); };
    var up = strip(new URL('../', location.href).pathname);
    if (!/^https?:$/.test(location.protocol) || up === strip(location.pathname)) {
      backEl.parentNode.removeChild(backEl);
    }
  }
})();
