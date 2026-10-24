/* Theme choice and remembered settings. Everything stays in this browser (localStorage). */
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  root.classList.add('js');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {});
    });
  }
  var theme = get('tz:theme');
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);

  var LABEL = { auto: 'Theme: Auto', light: 'Theme: Light', dark: 'Theme: Dark' };
  function current() { return root.getAttribute('data-theme') || 'auto'; }
  function paint(btn) { btn.textContent = LABEL[current()]; }

  document.addEventListener('DOMContentLoaded', function () {
    var btns = document.querySelectorAll('[data-theme-toggle]');
    Array.prototype.forEach.call(btns, function (btn) {
      paint(btn);
      btn.addEventListener('click', function () {
        var next = { auto: 'light', light: 'dark', dark: 'auto' }[current()];
        if (next === 'auto') { root.removeAttribute('data-theme'); set('tz:theme', null); }
        else { root.setAttribute('data-theme', next); set('tz:theme', next); }
        Array.prototype.forEach.call(btns, paint);
      });
    });

    var mb = document.querySelector('.menu-btn'), head = document.querySelector('.site-head');
    if (mb && head) {
      function setOpen(o) { head.classList.toggle('open', o); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); }
      mb.addEventListener('click', function () { setOpen(!head.classList.contains('open')); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && head.classList.contains('open')) { setOpen(false); mb.focus(); } });
    }

    /* Remembered settings: only dropdowns, sliders, colors and tick boxes.
       Never text, passwords, files or anything you typed. */
    var page = location.pathname.split('/').pop() || 'index.html';
    var skip = /(show|reveal|pass|secret|key)/i;
    var ctrls = document.querySelectorAll('select[id], input[type=range][id], input[type=color][id], input[type=checkbox][id]');
    Array.prototype.forEach.call(ctrls, function (el) {
      if (skip.test(el.id)) return;
      var key = 'tz:s:' + page + ':' + el.id;
      var saved = get(key);
      if (saved !== null) {
        var changed = false;
        if (el.type === 'checkbox') { var c = saved === '1'; if (el.checked !== c) { el.checked = c; changed = true; } }
        else if (el.tagName === 'SELECT') {
          var ok = Array.prototype.some.call(el.options, function (o) { return o.value === saved; });
          if (ok && el.value !== saved) { el.value = saved; changed = true; }
        } else if (el.value !== saved) { el.value = saved; changed = true; }
        if (changed) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      el.addEventListener('change', function () {
        set(key, el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value);
      });
      if (el.type === 'range' || el.type === 'color') {
        el.addEventListener('input', function () { set(key, el.value); });
      }
    });
  });
})();
