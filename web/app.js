/* 交通用语转换器前端逻辑（配合 data.js 使用） */
(function () {
  'use strict';

  var DATA = window.TRAFFIC_DATA;
  var entries = DATA.entries;
  var phrases = DATA.phrases;
  var maxLen = DATA.maxLen || 16;

  /* ---------- 基础数据 ---------- */
  var ONE_CHAR = {};
  Object.keys(phrases).forEach(function (k) {
    if (k.length === 1) ONE_CHAR[k] = true;
  });

  var catList = [];
  var catCount = {};
  entries.forEach(function (e) {
    if (!(e.cat in catCount)) { catCount[e.cat] = 0; catList.push(e.cat); }
    catCount[e.cat]++;
  });

  var PALETTE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981',
    '#0ea5e9', '#6366f1', '#f97316', '#14b8a6', '#ec4899'];
  var catColor = {};
  catList.forEach(function (c, i) { catColor[c] = PALETTE[i % PALETTE.length]; });

  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
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

  /* ---------- 口语 → 术语 核心分析 ---------- */
  function analyze(text) {
    var spans = [];
    var i = 0;
    while (i < text.length) {
      var found = null;
      var maxL = Math.min(maxLen, text.length - i);
      for (var L = maxL; L >= 2; L--) {
        var sub = text.slice(i, i + L);
        if (phrases[sub]) { found = { s: i, e: i + L, ids: phrases[sub] }; break; }
      }
      if (!found && ONE_CHAR[text[i]]) {
        found = { s: i, e: i + 1, ids: phrases[text[i]] };
      }
      if (found) { spans.push(found); i = found.e; } else { i++; }
    }

    var segments = [];
    var pos = 0;
    spans.forEach(function (sp) {
      if (sp.s > pos) segments.push({ type: 'text', text: text.slice(pos, sp.s) });
      segments.push({ type: 'match', text: text.slice(sp.s, sp.e), ids: sp.ids });
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

    var converted = '';
    segments.forEach(function (seg) {
      converted += seg.type === 'text' ? seg.text : entries[seg.ids[0]].zh;
    });

    return { segments: segments, terms: terms, converted: converted };
  }

  /* ---------- 口语转换视图 ---------- */
  var inputEl = document.getElementById('input');
  var resultEl = document.getElementById('result');

  function renderMarkSpans(container, segments, groupsByKey) {
    // groupsByKey: match 文本+首个id -> 分组序号
    segments.forEach(function (seg) {
      if (seg.type === 'text') {
        container.appendChild(el('span', null, seg.text));
      } else {
        var ent = entries[seg.ids[0]];
        var color = catColor[ent.cat] || '#2563eb';
        var m = el('mark', 'term', seg.text);
        m.style.background = hexToRgba(color, 0.14);
        m.style.borderBottom = '2px solid ' + color;
        m.title = ent.zh + ' · ' + ent.en;
        var gi = groupsByKey[seg.text + '|' + seg.ids[0]];
        if (gi !== undefined) m.dataset.gi = gi;
        container.appendChild(m);
      }
    });
  }

  function buildGroupKeyMap(terms) {
    // 分组序号 -> 由原文片段与主词条定位
    var map = {};
    terms.forEach(function (g, i) {
      g.frags.forEach(function (f) {
        map[f + '|' + entries[g.idx].id] = i;
      });
    });
    // 用 id 索引不便，重建为 idx 索引
    var map2 = {};
    terms.forEach(function (g, i) {
      g.frags.forEach(function (f) {
        map2[f + '|' + g.idx] = i;
      });
    });
    return map2;
  }

  function convert() {
    var text = inputEl.value.trim();
    if (!text) { toast('请先输入内容'); inputEl.focus(); return; }
    saveHistory(text);

    var r = analyze(text);
    resultEl.innerHTML = '';

    var card = el('div', 'card result-card');
    var head = el('div', 'result-head');
    head.appendChild(el('h3', null, '转换结果'));
    var headBtns = el('div');
    var copyAll = el('button', 'btn mini', '复制术语化表述');
    copyAll.addEventListener('click', function () { copyText(r.converted, '已复制术语化表述'); });
    headBtns.appendChild(copyAll);
    head.appendChild(headBtns);
    card.appendChild(head);

    if (!r.terms.length) {
      var empty = el('div', 'empty');
      empty.appendChild(el('div', 'icon', '🛣️'));
      empty.appendChild(el('p', null, '这段话里没有识别到可转换的交通表述'));
      empty.appendChild(el('p', null, '试试下方的示例句子，或浏览术语库了解可识别的说法'));
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
        var color = catColor[ent.cat] || '#2563eb';
        var m = el('mark', 'term', ent.zh);
        m.style.background = hexToRgba(color, 0.16);
        m.style.borderBottom = '2px solid ' + color;
        m.title = '点击查看下方释义';
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
    var color = catColor[ent.cat] || '#2563eb';
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
    all.style.setProperty('--c', '#2563eb');
    all.style.setProperty('--cshadow', 'rgba(37,99,235,.3)');
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
    var color = catColor[e.cat] || '#2563eb';
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
    var color = catColor[e.cat] || '#2563eb';
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
      t.classList.toggle('active', t.dataset.tab === name);
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
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  buildCatChips();
  doSearch();
  renderHistory();

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
