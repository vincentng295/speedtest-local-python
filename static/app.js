(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const T = {
  en: { menu:'Menu', test:'Speedtest', results:'Results', settings:'Settings', download:'Download', signin:'Sign In',
    copy:'Copy LAN link', export:'Export results (CSV)', connections:'Connections', multi:'Multi', single:'Single',
    change:'Change Server', desktop:'Desktop Apps', wifi:'Troubleshoot Your Wifi', ping:'Ping', jitter:'Jitter',
    dl:'Download', ul:'Upload', date:'Date', clear:'Clear history', empty:'No results yet. Press GO to run a test.',
    duration:'Test duration per phase', streams:'Parallel streams (Multi)', unit:'Speed unit',
    onlyone:'This LAN has only one test server.', copied:'Link copied', nologin:'Sign in is not available on a local server.',
    cancelled:'Test cancelled', failed:'Test failed. Is the server reachable?', nodata:'No results to export.' },
  vi: { menu:'Menu', test:'Đo tốc độ', results:'Kết quả', settings:'Cài đặt', download:'Tải về', signin:'Đăng nhập',
    copy:'Sao chép liên kết LAN', export:'Xuất kết quả (CSV)', connections:'Kết nối', multi:'Đa luồng', single:'Đơn luồng',
    change:'Đổi máy chủ', desktop:'Ứng dụng máy tính', wifi:'Khắc phục lỗi Wifi', ping:'Ping', jitter:'Jitter',
    dl:'Tải xuống', ul:'Tải lên', date:'Thời gian', clear:'Xóa lịch sử', empty:'Chưa có kết quả. Nhấn GO để đo.',
    duration:'Thời lượng mỗi giai đoạn', streams:'Số luồng song song (Đa luồng)', unit:'Đơn vị tốc độ',
    onlyone:'Mạng LAN này chỉ có một máy chủ đo.', copied:'Đã sao chép liên kết', nologin:'Máy chủ cục bộ không hỗ trợ đăng nhập.',
    cancelled:'Đã hủy phép đo', failed:'Đo thất bại. Máy chủ có truy cập được không?', nodata:'Chưa có kết quả để xuất.' }
};
const LANG_NAME = { en: 'English', vi: 'Tiếng Việt' };

const st = Object.assign({ theme: 'dark', lang: 'en', mode: 'multi', duration: 10, streams: 6, unit: 'mbps' }, LS.get('st', {}));
const save = () => LS.set('st', st);
const t = k => (T[st.lang] && T[st.lang][k]) || T.en[k] || k;
let hist = LS.get('hist', []);

/* ---------- UI helpers ---------- */
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}
function applyTheme() { document.documentElement.dataset.theme = st.theme; }
function applyLang() {
  document.documentElement.lang = st.lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('#langLabel').textContent = LANG_NAME[st.lang];
}
function applyMode() {
  $('#mMulti').classList.toggle('on', st.mode === 'multi');
  $('#mSingle').classList.toggle('on', st.mode === 'single');
}
function unitLabel() { return st.unit === 'MBps' ? 'MB/s' : 'Mbps'; }
function fmtSpeed(mbps) {
  if (mbps == null || isNaN(mbps)) return '—';
  const v = st.unit === 'MBps' ? mbps / 8 : mbps;
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
}
function fmtMs(v) { return v == null ? '—' : v < 10 ? v.toFixed(2) : v.toFixed(1); }
function refreshUnits() { $$('.stat .u').forEach(e => e.textContent = unitLabel()); }

function showView(name) {
  ['test', 'results', 'settings'].forEach(v => { $('#view-' + v).hidden = v !== name; });
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  $('#mnav').classList.remove('open');
  $$('.dd.open').forEach(d => d.classList.remove('open'));
  if (name === 'results') renderHist();
  window.scrollTo(0, 0);
}

/* ---------- dropdowns / nav ---------- */
$$('[data-dd]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  const dd = b.closest('.dd'); const open = dd.classList.contains('open');
  $$('.dd.open').forEach(d => d.classList.remove('open'));
  if (!open) dd.classList.add('open');
}));
document.addEventListener('click', () => $$('.dd.open').forEach(d => d.classList.remove('open')));
$$('[data-view]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;
  showView(b.classList.contains('tab') && !$('#view-' + v).hidden ? 'test' : v);
}));
$$('[data-lang]').forEach(b => b.addEventListener('click', () => {
  st.lang = b.dataset.lang; save(); applyLang(); renderHist(); $('#mnav').classList.remove('open');
}));
$('#theme').addEventListener('click', () => { st.theme = st.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); });
$('#burger').addEventListener('click', () => $('#mnav').classList.toggle('open'));
$('#signin').addEventListener('click', () => toast(t('nologin')));
$('#chg').addEventListener('click', e => { e.preventDefault(); toast(t('onlyone')); });
$('#scrolldown').addEventListener('click', () => $('.conn').scrollIntoView({ behavior: 'smooth' }));
$('#mMulti').addEventListener('click', () => { st.mode = 'multi'; save(); applyMode(); });
$('#mSingle').addEventListener('click', () => { st.mode = 'single'; save(); applyMode(); });
$('#mToggle').addEventListener('click', () => { st.mode = st.mode === 'multi' ? 'single' : 'multi'; save(); applyMode(); });

async function copyLink() {
  const url = location.origin;
  try { await navigator.clipboard.writeText(url); }
  catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
  toast(t('copied') + ': ' + url);
  $('#mnav').classList.remove('open');
}
$('#copyLink').addEventListener('click', copyLink);
$('.copyLink').addEventListener('click', copyLink);
function exportCsv() {
  if (!hist.length) return toast(t('nodata'));
  const rows = [['time', 'ip', 'ping_ms', 'jitter_ms', 'download_mbps', 'upload_mbps', 'mode']]
    .concat(hist.map(h => [new Date(h.t).toISOString(), h.ip, h.ping, h.jitter, h.dl, h.ul, h.mode]));
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'speedtest-results.csv';
  document.body.appendChild(a); a.click(); a.remove();
  $('#mnav').classList.remove('open');
}
$('#exportCsv').addEventListener('click', exportCsv);
$('.exportCsv').addEventListener('click', exportCsv);

/* ---------- settings & history ---------- */
function initSettings() {
  $('#s-duration').value = st.duration; $('#s-streams').value = st.streams; $('#s-unit').value = st.unit;
  $('#s-duration').addEventListener('change', e => { st.duration = +e.target.value; save(); });
  $('#s-streams').addEventListener('change', e => { st.streams = Math.max(2, Math.min(16, +e.target.value || 6)); e.target.value = st.streams; save(); });
  $('#s-unit').addEventListener('change', e => { st.unit = e.target.value; save(); refreshUnits(); if (lastRes) showResults(lastRes); });
}
function renderHist() {
  const tb = $('#histTable tbody'); tb.innerHTML = '';
  hist.slice().reverse().forEach(h => {
    const tr = document.createElement('tr');
    const d = new Date(h.t).toLocaleString(st.lang === 'vi' ? 'vi-VN' : 'en-GB');
    [d, fmtMs(h.ping) + ' ms', fmtMs(h.jitter) + ' ms', fmtSpeed(h.dl) + ' ' + unitLabel(), fmtSpeed(h.ul) + ' ' + unitLabel()]
      .forEach(x => { const td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  $('#histEmpty').hidden = hist.length > 0;
  $('#histTable').hidden = hist.length === 0;
}
$('#clearHist').addEventListener('click', () => { hist = []; LS.set('hist', hist); renderHist(); });

/* ---------- server info ---------- */
let clientIp = '';
fetch('/api/info', { cache: 'no-store' }).then(r => r.json()).then(i => {
  clientIp = i.ip;
  $('#isp').textContent = i.isp; $('#ip').textContent = i.ip;
  $('#srv').textContent = i.server; $('#loc').textContent = i.location;
}).catch(() => {});

/* ---------- measurement engine ---------- */
const go = $('#go'), ringFg = $('#ringFg'), RING = 666;
let running = false, cancelled = false, lastRes = null;
const setRing = p => { ringFg.style.strokeDashoffset = RING * (1 - Math.max(0, Math.min(1, p))); };
const setGauge = (phase, num, unit) => { $('#gPhase').textContent = phase; $('#gNum').textContent = num; $('#gUnit').textContent = unit; };
const setStat = (k, txt, active) => {
  const el = $(`.stat[data-k="${k}"]`); el.querySelector('b').textContent = txt; el.classList.toggle('act', !!active);
};

async function doPing() {
  const rtts = [];
  for (let i = 0; i < 14; i++) {
    if (cancelled) throw 'cancelled';
    const t0 = performance.now();
    await fetch('/api/ping?r=' + Math.random(), { cache: 'no-store' });
    const d = performance.now() - t0;
    if (i > 1) rtts.push(d);               // bỏ 2 mẫu đầu (mở kết nối)
    if (rtts.length) setGauge(t('ping'), fmtMs(d), 'ms');
    setRing((i + 1) / 14);
    await sleep(40);
  }
  const sorted = rtts.slice().sort((a, b) => a - b);
  const ping = sorted[Math.floor(sorted.length / 2)];
  let j = 0; for (let i = 1; i < rtts.length; i++) j += Math.abs(rtts[i] - rtts[i - 1]);
  return { ping, jitter: j / (rtts.length - 1) };
}

let upBlob = null;
function getUpBlob() {
  if (upBlob) return upBlob;
  const buf = new Uint8Array(8 << 20);
  for (let o = 0; o < buf.length; o += 65536) crypto.getRandomValues(buf.subarray(o, o + 65536));
  return (upBlob = new Blob([buf], { type: 'application/octet-stream' }));
}

function measure(kind) {
  return new Promise((resolve, reject) => {
    const dur = st.duration * 1000, warm = Math.min(1500, dur * 0.2);
    const n = st.mode === 'multi' ? st.streams : 1;
    const label = kind === 'download' ? t('dl') : t('ul');
    const ctrl = new AbortController(), xhrs = new Set();
    let bytes = 0, stop = false, wb = null, wt = null, shown = null;
    const samples = [];
    const t0 = performance.now();

    async function dlWorker() {
      while (!stop) {
        try {
          const r = await fetch(`/api/download?size=${64 << 20}&r=${Math.random()}`, { cache: 'no-store', signal: ctrl.signal });
          const rd = r.body.getReader();
          for (;;) { const { done, value } = await rd.read(); if (done) break; bytes += value.byteLength; }
        } catch { if (stop) return; await sleep(200); }
      }
    }
    function upWorker() {
      const blob = getUpBlob();
      const loop = () => {
        if (stop) return;
        const x = new XMLHttpRequest(); xhrs.add(x);
        let last = 0;
        x.open('POST', '/api/upload?r=' + Math.random());
        x.setRequestHeader('Content-Type', 'application/octet-stream');
        x.upload.onprogress = e => { bytes += e.loaded - last; last = e.loaded; };
        const next = () => { xhrs.delete(x); if (!stop) setTimeout(loop, 0); };
        x.onload = next; x.onerror = () => { xhrs.delete(x); if (!stop) setTimeout(loop, 300); };
        x.send(blob);
      };
      loop();
    }
    for (let i = 0; i < n; i++) kind === 'download' ? dlWorker() : upWorker();

    const timer = setInterval(() => {
      const el = performance.now() - t0;
      samples.push([el, bytes]);
      if (wb === null && el >= warm) { wb = bytes; wt = el; }
      let j = samples.length - 1;
      while (j > 0 && el - samples[j][0] < 1000) j--;
      const [pt, pb] = samples[j];
      if (el - pt > 150) {
        const inst = (bytes - pb) * 8 / ((el - pt) / 1000) / 1e6;
        shown = shown == null ? inst : shown * 0.6 + inst * 0.4;
        setGauge(label, fmtSpeed(shown), unitLabel());
        setStat(kind === 'download' ? 'dl' : 'ul', fmtSpeed(shown), true);
      }
      setRing(el / dur);
      if (el >= dur || cancelled) finish(el);
    }, 100);

    function finish(el) {
      clearInterval(timer); stop = true; ctrl.abort(); xhrs.forEach(x => x.abort());
      if (cancelled) return reject('cancelled');
      const mbps = (wb !== null && el - wt > 300)
        ? (bytes - wb) * 8 / ((el - wt) / 1000) / 1e6
        : bytes * 8 / (el / 1000) / 1e6;
      resolve(mbps);
    }
  });
}

function showResults(r) {
  setStat('ping', fmtMs(r.ping)); setStat('jitter', fmtMs(r.jitter));
  setStat('dl', fmtSpeed(r.dl)); setStat('ul', fmtSpeed(r.ul));
}

async function run() {
  running = true; cancelled = false;
  go.classList.add('running'); $('#stats').classList.add('show');
  ['ping', 'jitter', 'dl', 'ul'].forEach(k => setStat(k, '—'));
  refreshUnits(); setGauge(t('ping'), '…', 'ms'); setRing(0);
  const res = { t: Date.now(), ip: clientIp, mode: st.mode };
  try {
    setStat('ping', '…', true);
    Object.assign(res, await doPing());
    setStat('ping', fmtMs(res.ping)); setStat('jitter', fmtMs(res.jitter));
    setRing(0); res.dl = await measure('download'); setStat('dl', fmtSpeed(res.dl));
    setRing(0); res.ul = await measure('upload'); setStat('ul', fmtSpeed(res.ul));
    lastRes = res; hist.push(res); hist = hist.slice(-50); LS.set('hist', hist);
  } catch (e) {
    toast(e === 'cancelled' ? t('cancelled') : t('failed'));
  } finally {
    $$('.stat').forEach(s => s.classList.remove('act'));
    go.classList.remove('running'); setRing(0); running = false;
  }
}
go.addEventListener('click', () => { if (running) cancelled = true; else run(); });

/* ---------- init ---------- */
applyTheme(); applyLang(); applyMode(); initSettings(); refreshUnits(); showView('test');
})();
