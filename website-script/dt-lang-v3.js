/**
 * Dar AlTamaiz Tours — Website Language Switcher v3
 *
 * Drop into dt-tours.com <head>. Floating button appears top-right.
 * No HTML changes needed. Skips admin/back-office pages automatically.
 *
 * Languages: EN / AR / HI / UR / TL — all translated via API.
 * AR and UR get dir="rtl" applied to translated elements automatically.
 * Default: EN on first visit.
 */
(function () {
  'use strict';

  var API_URL   = 'https://tours-dar-tamaiz--engalialfoudari.replit.app/api/translate-page';
  var QUERY_URL = 'https://tours-dar-tamaiz--engalialfoudari.replit.app/api/translate-query';

  var LANGS = { en: 'English', ar: 'العربية', hi: 'Hindi', ur: 'اردو', tl: 'Filipino' };
  var LABELS = { en: 'EN / ع', ar: 'ع / AR', hi: 'HI / ع', ur: 'UR / ع', tl: 'TL / ع' };
  var OPT_LABELS = {
    en: 'EN — English',
    ar: 'ع — العربية',
    hi: 'HI — हिंदी',
    ur: 'UR — اردو',
    tl: 'TL — Filipino'
  };

  /* RTL languages — translated elements get dir="rtl" */
  var RTL = { ar: true, ur: true };

  var currentLang = localStorage.getItem('dt_lang') || 'en';
  var txCache = {};
  var origTextMap = [], origPhMap = [], origValMap = [];
  var _sN = new WeakSet(), _sP = new WeakSet(), _sV = new WeakSet();
  var rtlElements = [];   /* elements we set dir=rtl on */
  var obs = null, busy = false;

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function inTicker(el) {
    var p = el;
    while (p) {
      if (p.id && p.id.indexOf('ticker') !== -1) return true;
      if (p.className && typeof p.className === 'string' && p.className.indexOf('ticker') !== -1) return true;
      p = p.parentElement;
    }
    return false;
  }

  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

  function collect(onlyVisible) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (p.id === '__dt_langbtn' || p.id === '__dt_langname' || p.id === '__dt_dropdown') return NodeFilter.FILTER_REJECT;
        if (inTicker(p)) return NodeFilter.FILTER_REJECT;
        var t = (node.textContent || '').trim();
        if (t.length < 2) return NodeFilter.FILTER_SKIP;
        if (onlyVisible && !visible(p)) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var tn = [], n;
    while ((n = walker.nextNode())) tn.push(n);
    var ph = Array.prototype.filter.call(
      document.querySelectorAll('input[placeholder],textarea[placeholder]'),
      function (el) { return !inTicker(el) && (!onlyVisible || visible(el)); }
    );
    var vs = Array.prototype.filter.call(
      document.querySelectorAll('input[type="submit"],input[type="button"]'),
      function (el) { return !inTicker(el) && (el.value || '').trim().length >= 2 && (!onlyVisible || visible(el)); }
    );
    return { tn: tn, ph: ph, vs: vs };
  }

  function uniq(c) {
    var seen = {}, out = [];
    function add(t) { t = (t || '').trim(); if (t.length >= 2 && !seen[t]) { seen[t] = 1; out.push(t); } }
    c.tn.forEach(function (n) { add(n.textContent); });
    c.ph.forEach(function (e) { add(e.getAttribute('placeholder')); });
    c.vs.forEach(function (e) { add(e.value); });
    return out;
  }

  function saveOriginals(c) {
    c.tn.forEach(function (n) { if (!_sN.has(n)) { _sN.add(n); origTextMap.push({ node: n, orig: n.textContent }); } });
    c.ph.forEach(function (e) { if (!_sP.has(e)) { _sP.add(e); origPhMap.push({ el: e, orig: e.getAttribute('placeholder') }); } });
    c.vs.forEach(function (e) { if (!_sV.has(e)) { _sV.add(e); origValMap.push({ el: e, orig: e.value }); } });
  }

  /* Reset DOM to original captured text (called before each new translation) */
  function resetDOM() {
    origTextMap.forEach(function (e) { e.node.textContent = e.orig; });
    origPhMap.forEach(function (e) { e.el.setAttribute('placeholder', e.orig); });
    origValMap.forEach(function (e) { e.el.value = e.orig; });
  }

  function applyCache(lang) {
    var m = txCache[lang] || {};
    origTextMap.forEach(function (e) { var k = e.orig.trim(); if (m[k]) e.node.textContent = e.orig.replace(k, m[k]); });
    origPhMap.forEach(function (e) { var k = (e.orig || '').trim(); if (m[k]) e.el.setAttribute('placeholder', m[k]); });
    origValMap.forEach(function (e) { var k = (e.orig || '').trim(); if (m[k]) e.el.value = m[k]; });
  }

  /* ── RTL support for Arabic and Urdu ───────────────────────────────────── */
  function applyRTL(lang) {
    /* Set dir="rtl" on each parent of a translated text node */
    var m = txCache[lang] || {};
    origTextMap.forEach(function (e) {
      var k = e.orig.trim();
      if (!m[k]) return;
      var p = e.node.parentElement;
      if (p && !p.__dtRtl) {
        p.__dtRtl = p.hasAttribute('dir') ? p.getAttribute('dir') : null;
        p.setAttribute('dir', 'rtl');
        p.style.textAlign = p.style.textAlign || 'right';
        rtlElements.push(p);
      }
    });
  }

  function clearRTL() {
    rtlElements.forEach(function (p) {
      if (p.__dtRtl === null) { p.removeAttribute('dir'); p.style.textAlign = ''; }
      else p.setAttribute('dir', p.__dtRtl);
      delete p.__dtRtl;
    });
    rtlElements = [];
  }

  /* ── Fetch ──────────────────────────────────────────────────────────────── */
  function fetchChunk(texts, lang, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      try { var d = JSON.parse(xhr.responseText); cb(null, Array.isArray(d.translations) ? d.translations : texts); }
      catch (e) { cb(e, texts); }
    };
    xhr.onerror = function () { cb(new Error('net'), texts); };
    xhr.send(JSON.stringify({ texts: texts, lang: lang }));
  }

  function fetchAll(missing, lang, done) {
    if (!missing.length) { done(); return; }
    var CHUNK = 120, chunks = [], pend;
    for (var i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));
    pend = chunks.length;
    chunks.forEach(function (chunk) {
      fetchChunk(chunk, lang, function (err, res) {
        if (!err) chunk.forEach(function (t, j) { txCache[lang][t] = res[j] || t; });
        applyCache(lang);
        if (RTL[lang]) applyRTL(lang);
        if (--pend === 0) done();
      });
    });
  }

  /* ── Translate ──────────────────────────────────────────────────────────── */
  function translate(lang) {
    if (!LANGS[lang]) return;
    if (busy) return;
    busy = true; setBar(true);

    /* Reset to native DOM and remove any previous RTL dir attributes */
    clearRTL();
    resetDOM();
    stopObs();

    txCache[lang] = txCache[lang] || {};
    var cv = collect(true);
    saveOriginals(cv);
    applyCache(lang);
    if (RTL[lang]) applyRTL(lang);

    var m1 = uniq(cv).filter(function (t) { return txCache[lang][t] === undefined; });
    fetchAll(m1, lang, function () {
      hideBar();
      currentLang = lang;
      localStorage.setItem('dt_lang', lang);
      updateBtn();
      busy = false;
      startObs(lang);
      /* Translate off-screen content too */
      setTimeout(function () {
        var ca = collect(false); saveOriginals(ca);
        var m2 = uniq(ca).filter(function (t) { return txCache[lang][t] === undefined; });
        if (m2.length) fetchAll(m2, lang, function () {});
      }, 150);
    });
  }

  /* ── MutationObserver ───────────────────────────────────────────────────── */
  function startObs(lang) {
    stopObs();
    if (!window.MutationObserver) return;
    var timer = null;
    obs = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (currentLang !== lang) return;
        var c2 = collect(true); saveOriginals(c2);
        var fr = uniq(c2).filter(function (t) { return !txCache[lang][t]; });
        if (!fr.length) { applyCache(lang); if (RTL[lang]) applyRTL(lang); return; }
        fetchAll(fr, lang, function () {});
      }, 500);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function stopObs() { if (obs) { obs.disconnect(); obs = null; } }

  /* ── Progress bar ───────────────────────────────────────────────────────── */
  function setBar(show) {
    var b = document.getElementById('__dt_bar');
    if (!b) {
      b = document.createElement('div'); b.id = '__dt_bar';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;height:4px;background:linear-gradient(90deg,#1a3a6b,#3b7fd4);transition:opacity .4s;direction:ltr;';
      document.body.appendChild(b);
    }
    b.style.opacity = show ? '1' : '0';
  }

  function hideBar() { setTimeout(function () { setBar(false); }, 400); }

  /* ── Button ─────────────────────────────────────────────────────────────── */
  function updateBtn() {
    var el = document.getElementById('__dt_langname');
    if (el) el.textContent = LABELS[currentLang] || 'EN / ع';
  }

  var dropOpen = false;

  function buildDropdown() {
    var dd = document.createElement('div'); dd.id = '__dt_dropdown';
    dd.style.cssText = 'position:absolute;top:calc(100% + 4px);right:0;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);min-width:160px;z-index:2147483647;overflow:hidden;direction:ltr;';
    Object.keys(OPT_LABELS).forEach(function (lang) {
      var item = document.createElement('div');
      item.textContent = OPT_LABELS[lang];
      item.style.cssText = 'padding:11px 18px;cursor:pointer;font-size:14px;font-family:Arial,sans-serif;color:#1a3a6b;white-space:nowrap;border-bottom:1px solid #f0f0f0;';
      if (lang === currentLang) { item.style.background = '#eef3ff'; item.style.fontWeight = '700'; }
      item.onmouseover = function () { item.style.background = '#eef3ff'; };
      item.onmouseout  = function () { item.style.background = lang === currentLang ? '#eef3ff' : ''; };
      item.addEventListener('click', function (e) {
        e.stopPropagation(); closeDropdown(); translate(lang);
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'langChange', lang: lang })); } catch (_) {}
      });
      dd.appendChild(item);
    });
    return dd;
  }

  function closeDropdown() {
    var dd = document.getElementById('__dt_dropdown');
    if (dd && dd.parentNode) dd.parentNode.removeChild(dd);
    dropOpen = false;
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */
  function init() {
    if (document.getElementById('__dt_langbtn')) return;

    /* Slot first, fixed fallback second */
    var wrapper;
    var slot = document.querySelector('.dt-lang-slot');
    if (slot) {
      wrapper = slot;
      wrapper.style.display = 'inline-block';
    } else {
      wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483647;display:inline-block;';
      document.body.appendChild(wrapper);
    }

    var btn = document.createElement('button');
    btn.id = '__dt_langbtn'; btn.type = 'button';
    btn.style.cssText =
      'cursor:pointer;border:none;background:#1a3a6b;color:#fff;' +
      'font-size:14px;font-weight:700;padding:8px 14px;border-radius:6px;' +
      'font-family:Arial,sans-serif;position:relative;white-space:nowrap;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.25);letter-spacing:0.5px;';
    var label = document.createElement('span');
    label.id = '__dt_langname';
    label.textContent = LABELS[currentLang] || 'EN / ع';
    btn.appendChild(label);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dropOpen) { closeDropdown(); return; }
      dropOpen = true; btn.appendChild(buildDropdown());
    });
    document.addEventListener('click', function () { if (dropOpen) closeDropdown(); });
    wrapper.appendChild(btn);

    /* Snapshot native DOM before any translation */
    saveOriginals(collect(false));

    /* Auto-translate to saved language */
    if (currentLang) translate(currentLang);

    /* Background pre-warm — cache all languages silently after 4 s */
    setTimeout(function () {
      var PREWARM = ['en', 'ar', 'hi', 'ur', 'tl'];
      var cv = collect(false); saveOriginals(cv);
      var texts = uniq(cv);
      PREWARM.forEach(function (pl) {
        if (pl === currentLang) return;
        txCache[pl] = txCache[pl] || {};
        var miss = texts.filter(function (t) { return txCache[pl][t] === undefined; });
        if (miss.length) fetchAll(miss, pl, function () {});
      });
    }, 4000);

    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'langSync', lang: currentLang })); } catch (_) {}
    window.dtSyncLang = function (lang) {
      if (!LANGS[lang]) return;
      if (lang !== currentLang) translate(lang);
    };

    /* Arabic/Urdu search input → English for hotel/flight APIs */
    (function () {
      var ARABIC_RE      = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
      var PURE_ARABIC_RE = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s\d\u0660-\u0669.,()-]+$/;
      var searchCache = {}, searchPending = {};
      function isSearchInput(el) {
        var type = (el.getAttribute('type') || 'text').toLowerCase();
        if (type === 'email' || type === 'password' || type === 'tel' || type === 'number') return false;
        var form = el.closest && el.closest('form');
        if (form && form.querySelector('input[type="email"],input[type="password"]')) return false;
        return true;
      }
      function fireEvents(input, val) {
        try { var d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(input, val); else input.value = val; } catch (e) { input.value = val; }
        ['input', 'change', 'keyup'].forEach(function (ev) { input.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true })); });
        if (window.$) { try { window.$(input).trigger('input').trigger('change'); } catch (e) {} }
      }
      function schedSearch(input) {
        if (!isSearchInput(input)) return;
        var val = input.value.trim();
        if (!val || !ARABIC_RE.test(val) || !PURE_ARABIC_RE.test(val)) return;
        var id = input.__dtSearchId = input.__dtSearchId || (Math.random().toString(36).slice(2));
        if (searchPending[id]) clearTimeout(searchPending[id]);
        searchPending[id] = setTimeout(function () {
          var cur = input.value.trim();
          if (!cur || !ARABIC_RE.test(cur) || !PURE_ARABIC_RE.test(cur)) return;
          var key = 'ar:' + cur.toLowerCase();
          if (searchCache[key]) { fireEvents(input, searchCache[key]); return; }
          var xhr = new XMLHttpRequest();
          xhr.open('POST', QUERY_URL, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.onload = function () {
            try { var d = JSON.parse(xhr.responseText); if (d.translated && d.translated !== cur) { searchCache[key] = d.translated; fireEvents(input, d.translated); } } catch (e) {}
          };
          xhr.send(JSON.stringify({ text: cur, lang: 'ar' }));
        }, 800);
      }
      document.addEventListener('input', function (e) { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) schedSearch(e.target); }, true);
      document.addEventListener('keyup', function (e) { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) schedSearch(e.target); }, true);
    })();
  }

  /* Skip admin/back-office pages — .main-sidebar only renders when is_logged_in_user() */
  function isAdminPage() {
    if (document.querySelector('.main-sidebar') || document.querySelector('#main-sidebar')) return true;
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (!isAdminPage()) init(); });
  } else {
    if (!isAdminPage()) init();
  }

})();
