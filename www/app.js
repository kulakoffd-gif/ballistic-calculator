// BalisticNote Pro — главный модуль.

// ============== helpers ==============
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const view = $('#view');
const titleEl = $('#title');
const subEl = $('#subtitle');
const drawer = $('#drawer');
const btnBack = $('#btnBack');
const progressBar = $('#progress');

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; }
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return n;
}
function fmt(n, d = 1) { return (n == null || !isFinite(n)) ? '—' : Number(n).toFixed(d); }
function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 1800);
}
function setHeader({ title, sub, progress = null }) {
  titleEl.textContent = title || '';
  subEl.textContent = sub || '';
  subEl.hidden = !sub;
  if (progress == null) { progressBar.hidden = true; }
  else { progressBar.hidden = false; progressBar.firstElementChild.style.width = progress + '%'; }
}
function openSheet(content) {
  const back = el('div', { class: 'sheet-backdrop', onclick: e => { if (e.target === back) close(); } });
  const sheet = el('div', { class: 'sheet' });
  function close() { back.remove(); }
  if (typeof content === 'function') content(sheet, close);
  else sheet.appendChild(content);
  back.appendChild(sheet);
  document.body.appendChild(back);
  return close;
}

// ============== routing ==============
const routes = [];
function route(pat, fn) {
  const re = new RegExp('^' + pat.replace(/:[^/]+/g, '([^/]+)') + '$');
  const keys = (pat.match(/:[^/]+/g) || []).map(s => s.slice(1));
  routes.push({ re, keys, fn, pat });
}
async function navigate() {
  let hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  drawer.hidden = true;
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i+1]));
      view.innerHTML = '';
      await r.fn(params, query);
      btnBack.hidden = (path === '/' || path === '');
      return;
    }
  }
  view.innerHTML = '<div class="card">Страница не найдена.</div>';
}
window.addEventListener('hashchange', navigate);
btnBack.addEventListener('click', () => history.back());
$('#btnMenu').addEventListener('click', () => { drawer.hidden = !drawer.hidden; });
drawer.addEventListener('click', e => { if (e.target.tagName === 'A') drawer.hidden = true; });

// ============== wind / clock ==============
function windToClock(windToDirDeg, shotAzimuthDeg) {
  // 12:00 = headwind, 6:00 = tailwind, 3:00 = wind from right, 9:00 = wind from left
  // input: windToDir = compass direction wind blows TO
  // 30 min steps
  const relFromShooter = (((windToDirDeg + 180) - shotAzimuthDeg) % 360 + 360) % 360;
  const halfHours = Math.round(relFromShooter / 15) % 24;
  let hh = Math.floor(halfHours / 2);
  const mm = (halfHours % 2) ? 30 : 0;
  if (hh === 0) hh = 12;
  return hh + ':' + String(mm).padStart(2, '0');
}
function solverWindAngle(windToDirDeg, shotAzimuthDeg) {
  return ((windToDirDeg - shotAzimuthDeg) % 360 + 360) % 360;
}

// ============== compass SVG ==============
// fireDir (опц.) — азимут направления огня (gray стрелка). Если задан, рисуется
// вторая «фоновая» стрелка-винтовка для ориентира.
function createCompass({ value = 0, fireDir = null, onChange, size = 280 }) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200');
  svg.setAttribute('class', 'compass');
  // outer ring
  const ring = document.createElementNS(NS, 'circle');
  ring.setAttribute('cx', 0); ring.setAttribute('cy', 0); ring.setAttribute('r', 92);
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#2a4a35');
  ring.setAttribute('stroke-width', '1.5');
  svg.appendChild(ring);
  // ticks every 10°
  for (let a = 0; a < 360; a += 10) {
    const r1 = a % 30 === 0 ? 80 : 86;
    const r2 = 92;
    const rad = (a - 90) * Math.PI / 180;
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', Math.cos(rad) * r1);
    ln.setAttribute('y1', Math.sin(rad) * r1);
    ln.setAttribute('x2', Math.cos(rad) * r2);
    ln.setAttribute('y2', Math.sin(rad) * r2);
    ln.setAttribute('stroke', a % 30 === 0 ? '#7a8699' : '#2a4a35');
    ln.setAttribute('stroke-width', a % 90 === 0 ? '1.8' : '1');
    svg.appendChild(ln);
  }
  // letter labels
  for (const [lab, ang] of [['С',0],['В',90],['Ю',180],['З',270]]) {
    const rad = (ang - 90) * Math.PI / 180;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', Math.cos(rad) * 68);
    t.setAttribute('y', Math.sin(rad) * 68 + 4);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#ff8b3d'); t.setAttribute('font-size', '11');
    t.textContent = lab;
    svg.appendChild(t);
  }
  // degree labels every 30°
  for (let a = 30; a < 360; a += 30) {
    if (a % 90 === 0) continue;
    const rad = (a - 90) * Math.PI / 180;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', Math.cos(rad) * 70);
    t.setAttribute('y', Math.sin(rad) * 70 + 3);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#7a8699'); t.setAttribute('font-size', '7');
    t.textContent = a + '°';
    svg.appendChild(t);
  }
  // fire-direction arrow (gray, фоновая) — рисуется ПЕРВОЙ чтобы быть позади
  let fireArrow = null;
  if (fireDir != null) {
    fireArrow = document.createElementNS(NS, 'g');
    fireArrow.innerHTML = `
      <line x1="0" y1="0" x2="0" y2="-78" stroke="#7a8699" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <polygon points="0,-86 -5,-76 5,-76" fill="#7a8699" opacity="0.7"/>
    `;
    fireArrow.setAttribute('transform', `rotate(${fireDir})`);
    svg.appendChild(fireArrow);
    // подпись «огонь»
    const fireRad = (fireDir - 90) * Math.PI / 180;
    const fireLab = document.createElementNS(NS, 'text');
    fireLab.setAttribute('x', Math.cos(fireRad) * 96);
    fireLab.setAttribute('y', Math.sin(fireRad) * 96 + 2);
    fireLab.setAttribute('text-anchor', 'middle');
    fireLab.setAttribute('fill', '#7a8699'); fireLab.setAttribute('font-size', '7');
    fireLab.textContent = '🎯';
    svg.appendChild(fireLab);
  }

  // wind arrow group (orange, поверх)
  const arrow = document.createElementNS(NS, 'g');
  arrow.innerHTML = `
    <line x1="0" y1="0" x2="0" y2="-58" stroke="#ff8b3d" stroke-width="3" stroke-linecap="round"/>
    <polygon points="0,-72 -7,-58 7,-58" fill="#ff8b3d"/>
    <circle cx="0" cy="0" r="4" fill="#ff8b3d"/>
  `;
  svg.appendChild(arrow);
  // center number
  const centerNum = document.createElementNS(NS, 'text');
  centerNum.setAttribute('x', 0); centerNum.setAttribute('y', 22);
  centerNum.setAttribute('text-anchor', 'middle');
  centerNum.setAttribute('fill', '#ff8b3d'); centerNum.setAttribute('font-size', '14');
  centerNum.setAttribute('font-weight', '500');
  svg.appendChild(centerNum);
  const subNum = document.createElementNS(NS, 'text');
  subNum.setAttribute('x', 0); subNum.setAttribute('y', 36);
  subNum.setAttribute('text-anchor', 'middle');
  subNum.setAttribute('fill', '#7a8699'); subNum.setAttribute('font-size', '6');
  subNum.textContent = 'КУДА ДУЕТ';
  svg.appendChild(subNum);

  function setAngle(a) {
    value = ((a % 360) + 360) % 360;
    arrow.setAttribute('transform', `rotate(${value})`);
    centerNum.textContent = Math.round(value) + '°';
    if (onChange) onChange(value);
  }
  setAngle(value);

  function angleAt(e) {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - cx, dy = p.clientY - cy;
    let a = Math.atan2(dx, -dy) * 180 / Math.PI;
    return (a + 360) % 360;
  }
  let drag = false;
  function onDown(e) { drag = true; setAngle(angleAt(e)); e.preventDefault(); }
  function onMove(e) { if (drag) { setAngle(angleAt(e)); e.preventDefault(); } }
  function onUp() { drag = false; }
  svg.addEventListener('mousedown', onDown);
  svg.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

  return { svg, setAngle, get value() { return value; } };
}

// ============== wind clock picker ==============
// Часовой циферблат для ввода ветра. Цифры 1..12 расставлены по окружности.
// 12 = «откуда ветер из 12 часов = встречный (headwind)».
// При тапе на цифру / сектор — задаёт абсолютное направление «куда дует ветер»
// с учётом азимута выстрела:
//   windToDir = (shotAz + H * 30 + 180) % 360
function createWindClock({ value = 0, shotAz = 0, onChange, size = 280 }) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200');
  svg.setAttribute('class', 'compass');
  // фон
  const bg = document.createElementNS(NS, 'circle');
  bg.setAttribute('cx', 0); bg.setAttribute('cy', 0); bg.setAttribute('r', 88);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#2a4a35');
  bg.setAttribute('stroke-width', '1.5');
  svg.appendChild(bg);
  // сектора-кнопки 1..12 (каждый по 30°)
  const labels = [];
  for (let H = 1; H <= 12; H++) {
    const ang = H * 30 - 90; // 12 в самом верху
    const rad = ang * Math.PI / 180;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', Math.cos(rad) * 68);
    t.setAttribute('y', Math.sin(rad) * 68 + 7);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', H % 3 === 0 ? '20' : '15');
    t.setAttribute('font-weight', H % 3 === 0 ? '700' : '500');
    t.setAttribute('fill', '#7a8699');
    t.style.cursor = 'pointer';
    t.textContent = H;
    t.addEventListener('click', () => setHour(H));
    svg.appendChild(t);
    labels.push({ H, el: t });
  }
  // подписи направлений
  for (const [lab, H, color] of [['встр.',12,'#ff8b3d'],['справа',3,'#7a8699'],['попут.',6,'#7a8699'],['слева',9,'#7a8699']]) {
    const ang = H * 30 - 90;
    const rad = ang * Math.PI / 180;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', Math.cos(rad) * 86);
    t.setAttribute('y', Math.sin(rad) * 86 + 3);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '7');
    t.setAttribute('fill', color);
    t.textContent = lab;
    svg.appendChild(t);
  }
  // стрелка от центра к часовой позиции (откуда дует)
  const arrow = document.createElementNS(NS, 'g');
  arrow.innerHTML = `<line x1="0" y1="0" x2="0" y2="-50" stroke="#ff8b3d" stroke-width="3" stroke-linecap="round"/>
    <polygon points="0,-58 -6,-48 6,-48" fill="#ff8b3d"/>
    <circle cx="0" cy="0" r="4" fill="#ff8b3d"/>`;
  svg.appendChild(arrow);
  // центральная подпись
  const centerNum = document.createElementNS(NS, 'text');
  centerNum.setAttribute('x', 0); centerNum.setAttribute('y', 24);
  centerNum.setAttribute('text-anchor', 'middle');
  centerNum.setAttribute('fill', '#ff8b3d'); centerNum.setAttribute('font-size', '20');
  centerNum.setAttribute('font-weight', '600');
  svg.appendChild(centerNum);
  const subNum = document.createElementNS(NS, 'text');
  subNum.setAttribute('x', 0); subNum.setAttribute('y', 36);
  subNum.setAttribute('text-anchor', 'middle');
  subNum.setAttribute('fill', '#7a8699'); subNum.setAttribute('font-size', '6');
  subNum.textContent = 'ВЕТЕР ОТКУДА';
  svg.appendChild(subNum);

  let currentH = 12;
  function hourFromAbs(windToDir) {
    // обратное преобразование windToDir → H
    const rel = ((windToDir - shotAz - 180) % 360 + 360) % 360; // 0..360
    let H = Math.round(rel / 30); if (H === 0) H = 12;
    return H;
  }
  function setHour(H) {
    currentH = H;
    const ang = H * 30; // от верха по часовой
    arrow.setAttribute('transform', `rotate(${ang})`);
    centerNum.textContent = H + ':00';
    labels.forEach(l => l.el.setAttribute('fill', l.H === H ? '#ff8b3d' : '#7a8699'));
    const windToDir = ((shotAz + H * 30 + 180) % 360 + 360) % 360;
    if (onChange) onChange(windToDir, H);
  }
  function setFromAbs(windToDir) {
    setHour(hourFromAbs(windToDir));
  }
  // фон-сектор для тапа в любую часть круга
  bg.style.cursor = 'pointer';
  svg.addEventListener('click', (e) => {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    if (Math.hypot(dx, dy) < 6) return; // центр игнор
    let a = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = вверх (12 ч)
    if (a < 0) a += 360;
    let H = Math.round(a / 30); if (H === 0) H = 12; if (H > 12) H = H - 12;
    setHour(H);
  });
  setFromAbs(value);
  return { svg, setHour, setFromAbs, get hour() { return currentH; } };
}

// ============== forms ==============
function numInput(name, label, val, attrs = {}) {
  return el('div', {},
    el('label', { for: name }, label),
    el('input', { id: name, name, type: 'number', step: attrs.step || 'any', inputmode: 'decimal', value: val ?? '', ...attrs })
  );
}
function textInput(name, label, val, attrs = {}) {
  return el('div', {},
    el('label', { for: name }, label),
    el('input', { id: name, name, type: 'text', value: val ?? '', ...attrs })
  );
}
function selectInput(name, label, val, options) {
  const opts = options.map(o => {
    const op = document.createElement('option');
    op.value = o.value; op.textContent = o.label;
    if (o.value == val) op.selected = true;
    return op;
  });
  const sel = el('select', { id: name, name }, ...opts);
  return el('div', {}, el('label', { for: name }, label), sel);
}
function readForm(form) {
  const data = {};
  for (const e of form.querySelectorAll('input, select, textarea')) {
    if (!e.name) continue;
    if (e.type === 'number') data[e.name] = e.value === '' ? null : parseFloat(e.value);
    else if (e.type === 'checkbox') data[e.name] = e.checked;
    else data[e.name] = e.value;
  }
  return data;
}

// ============== prefs ==============
function loadPrefs() { try { return JSON.parse(localStorage.getItem('prefs') || '{}'); } catch { return {}; } }
function savePrefs(p) { localStorage.setItem('prefs', JSON.stringify(p)); }

// ============== ICAO стандартная атмосфера ==============
// h в метрах → давление в гПа (sea-level standard ICAO)
function pressureFromAltitude(altitude_m, sealevelMbar = 1013.25) {
  return sealevelMbar * Math.pow(1 - 0.0000225577 * altitude_m, 5.2559);
}
// читаем барометр телефона если доступен; иначе пробуем GPS высоту
async function getPressureFromDevice() {
  if ('AbsolutePressureSensor' in window) {
    try {
      const sensor = new window.AbsolutePressureSensor({ frequency: 1 });
      return await new Promise((resolve, reject) => {
        sensor.addEventListener('reading', () => { sensor.stop(); resolve(sensor.pressure); });
        sensor.addEventListener('error', e => reject(e.error || new Error('sensor error')));
        sensor.start();
        setTimeout(() => { sensor.stop(); reject(new Error('timeout')); }, 5000);
      });
    } catch {}
  }
  // fallback: GPS высота → ICAO давление
  const pos = await new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
  if (pos.coords.altitude == null) throw new Error('GPS не вернул высоту');
  return { source: 'gps', altitude: pos.coords.altitude, pressureMbar: pressureFromAltitude(pos.coords.altitude) };
}
function attachAtmoButtons(form, pressureField) {
  const wrap = el('div', { style: 'display:flex;gap:6px;margin-top:6px' });
  wrap.appendChild(el('button', { type: 'button', class: 'btn ghost', style: 'margin:0;flex:1', onclick: async () => {
    try {
      const r = await getPressureFromDevice();
      const mbar = typeof r === 'number' ? r : r.pressureMbar;
      form[pressureField].value = mbar.toFixed(0);
      toast(typeof r === 'number' ? 'Барометр' : `GPS h=${r.altitude.toFixed(0)}м → ${mbar.toFixed(0)} гПа`);
    } catch (e) { toast('Не удалось: ' + e.message); }
  }}, '📡 Барометр / GPS-высота'));
  wrap.appendChild(el('button', { type: 'button', class: 'btn outline', style: 'margin:0;flex:1', onclick: async () => {
    try {
      const w = await Weather.fetchByGPS();
      if (form.tempC) form.tempC.value = w.tempC.toFixed(1);
      if (form.pressureMbar) form.pressureMbar.value = w.pressureMbar.toFixed(0);
      if (form.humidity) form.humidity.value = w.humidity.toFixed(0);
      if (form.windSpeed) form.windSpeed.value = w.windSpeed.toFixed(1);
      // событие input на каждом поле — чтобы реактивный код подхватил изменения
      ['tempC','pressureMbar','humidity','windSpeed'].forEach(n => {
        if (form[n]) form[n].dispatchEvent(new Event('input', { bubbles: true }));
      });
      toast(`Open-Meteo: ${w.tempC.toFixed(1)}°C · ${w.pressureMbar.toFixed(0)} гПа · ${w.humidity.toFixed(0)}% · ветер ${w.windSpeed.toFixed(1)} м/с`);
    } catch (e) { toast('Open-Meteo: ' + e.message); }
  }}, '🌐 Погода по GPS'));
  return wrap;
}

// ============== per-field источники данных (AB Quantum-style) ==============
// Кэш Open-Meteo на 60 сек, чтобы 4 поля не дёргали API 4 раза.
let _wxCache = { t: 0, data: null };
async function getWeatherCached() {
  if (Date.now() - _wxCache.t < 60000 && _wxCache.data) return _wxCache.data;
  const w = await Weather.fetchByGPS();
  _wxCache = { t: Date.now(), data: w };
  return w;
}
function kestrelLast() {
  const conn = [...BT.connections.values()].find(c => c.profileId === 'kestrel-5700');
  return conn?.lastData || null;
}

// Возвращает обычный numInput, но с рядом мини-кнопок источников справа.
// sources: [{icon, title, action: async () => value, digits}]
function numInputWithSources(name, label, val, sources, attrs = {}) {
  const wrap = el('div', {});
  wrap.appendChild(el('label', { for: name }, label));
  const row = el('div', { class: 'input-row' });
  const input = el('input', { id: name, name, type: 'number',
    step: attrs.step || 'any', inputmode: 'decimal',
    value: val ?? '', ...attrs });
  row.appendChild(input);
  if (sources && sources.length) {
    const srcEl = el('div', { class: 'sources' });
    for (const s of sources) {
      const btn = el('button', { type: 'button', title: s.title, onclick: async () => {
        try {
          btn.disabled = true;
          const v = await s.action();
          if (v != null && isFinite(v)) {
            input.value = (s.digits != null) ? Number(v).toFixed(s.digits) : v;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            toast(s.title + ': ' + input.value);
          } else {
            toast(s.title + ': нет данных');
          }
        } catch (e) { toast(s.title + ': ' + e.message); }
        finally { btn.disabled = false; }
      }}, s.icon);
      srcEl.appendChild(btn);
    }
    row.appendChild(srcEl);
  }
  wrap.appendChild(row);
  return wrap;
}

// фабрики стандартных источников
function srcOpenMeteo(field, digits = 1) {
  return { icon: '🌐', title: 'Open-Meteo', digits,
    action: async () => (await getWeatherCached())[field] };
}
function srcKestrel(field, digits = 1) {
  return { icon: '📡', title: 'Kestrel', digits,
    action: async () => { const d = kestrelLast(); if (!d) throw new Error('не подключён'); return d[field]; } };
}
function srcPhoneBaro() {
  return { icon: '📱', title: 'Барометр телефона', digits: 0,
    action: async () => { const r = await getPressureFromDevice(); return typeof r === 'number' ? r : r.pressureMbar; } };
}
function srcGPSLat() {
  return { icon: '📱', title: 'GPS-широта', digits: 3,
    action: async () => {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
      return pos.coords.latitude;
    } };
}
function srcCompass() {
  return { icon: '📐', title: 'Завал по компасу', digits: 1,
    action: async () => {
      if (!Compass.supported()) throw new Error('нет датчика');
      if (!Compass.active) await Compass.start();
      // дать датчику пару тиков
      await new Promise(r => setTimeout(r, 200));
      const c = Compass.state.cant;
      if (c == null || !isFinite(c)) throw new Error('нет данных');
      return c;
    } };
}

// ============== ОБНУЛИ БАРАБАНЧИКИ flash ==============
function isZeroReminderOn() {
  const v = localStorage.getItem('zeroReminder');
  return v == null ? true : v === '1'; // вкл по умолчанию
}
function setZeroReminderOn(on) { localStorage.setItem('zeroReminder', on ? '1' : '0'); }
let _lastDistShown = null;
function flashZeroReminder(newDistance) {
  if (!isZeroReminderOn()) return;
  if (_lastDistShown != null && _lastDistShown === newDistance) return;
  _lastDistShown = newDistance;
  const f = el('div', { class: 'zero-flash' }, 'ОБНУЛИ БАРАБАНЧИКИ');
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 700);
}

// ============== HUD mode ==============
function isHudOn() { return localStorage.getItem('hudMode') === '1'; }
function setHudOn(on) {
  localStorage.setItem('hudMode', on ? '1' : '0');
  document.body.classList.toggle('hud-mode', on);
}
if (isHudOn()) document.body.classList.add('hud-mode');

// ============== Сдвиг от базового патрона (rezeroed?) ==============
// Сохраняем выбор в sessionStorage по cartridgeId. true = прицел обнулён под этот патрон.
function getScopeMode(cartId) {
  if (!cartId) return null;
  const v = sessionStorage.getItem('scope:' + cartId);
  return v == null ? null : v === '1';
}
function setScopeMode(cartId, rezeroed) {
  if (!cartId) return;
  sessionStorage.setItem('scope:' + cartId, rezeroed ? '1' : '0');
}
// Возвращает Promise<boolean>: true если прицел обнулён под этот патрон.
// Если выбор не сделан — открывает диалог. Базовый патрон → всегда true.
async function ensureScopeChoice(cart) {
  if (!cart || cart.isBase) return true;
  // нет сдвига — нечего применять, считай как «обнулён»
  if (!cart.offsetVertMil && !cart.offsetHorizMil && !cart.baseCartridgeId) return true;
  const prior = getScopeMode(cart.id);
  if (prior != null) return prior;
  return new Promise(resolve => {
    openSheet((sheet, close) => {
      sheet.appendChild(el('h3', {}, 'Прицел обнулён под этот патрон?'));
      sheet.appendChild(el('div', { class: 'sub' }, `Патрон: ${cart.name}`));
      sheet.appendChild(el('div', { class: 'banner accent' },
        `Сдвиг от базового: вертикаль ${fmt(cart.offsetVertMil || 0, 2)} mil, ` +
        `горизонталь ${fmt(cart.offsetHorizMil || 0, 2)} mil. Этот сдвиг будет автоматически добавлен к поправкам, если прицел НЕ обнулён под этот патрон.`));
      sheet.appendChild(el('div', { class: 'row-btn' },
        el('button', { type: 'button', class: 'btn ghost', onclick: () => {
          setScopeMode(cart.id, false); close(); resolve(false);
        }}, 'Нет, стреляю с базы'),
        el('button', { type: 'button', class: 'btn', onclick: () => {
          setScopeMode(cart.id, true); close(); resolve(true);
        }}, 'Да, обнулён')
      ));
    });
  });
}
// Применяет сдвиг к строке таблицы (row) при необходимости.
// row.drop_mil/drift_mil меняются in-place, плюс пересчитываются *_moa и *_m.
function applyCartridgeOffset(row, cart, rezeroed) {
  if (!row || !cart || rezeroed || cart.isBase) return row;
  const dv = cart.offsetVertMil || 0;
  const dh = cart.offsetHorizMil || 0;
  if (!dv && !dh) return row;
  // offsetVertMil положителен = пуля выше → нужно МЕНЬШЕ подкручивать вверх.
  // drop_mil положителен = подкрутка вверх. Значит вычитаем.
  row.drop_mil  = (row.drop_mil  || 0) - dv;
  row.drift_mil = (row.drift_mil || 0) - dh;
  row.drop_moa  = row.drop_mil  * 3.438;
  row.drift_moa = row.drift_mil * 3.438;
  row.drop_m  = row.range > 0 ? -row.drop_mil  / 1000 * row.range : 0;
  row.drift_m = row.range > 0 ?  row.drift_mil / 1000 * row.range : 0;
  return row;
}

// ============== compass helper ==============
function createMiniCompass(size = 64) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-50 -50 100 100');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.innerHTML = `
    <circle r="46" fill="none" stroke="#2a4a35" stroke-width="1"/>
    <text x="0" y="-32" text-anchor="middle" fill="#ff8b3d" font-size="10">С</text>
    <text x="32" y="4" text-anchor="middle" fill="#7a8699" font-size="8">В</text>
    <text x="0" y="40" text-anchor="middle" fill="#7a8699" font-size="8">Ю</text>
    <text x="-32" y="4" text-anchor="middle" fill="#7a8699" font-size="8">З</text>
    <g id="arr"><line x1="0" y1="0" x2="0" y2="-30" stroke="#ff8b3d" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="0,-36 -4,-28 4,-28" fill="#ff8b3d"/></g>
  `;
  function setHeading(h) { svg.querySelector('#arr').setAttribute('transform', `rotate(${h || 0})`); }
  return { svg, setHeading };
}

function attachCompassCantButton(form, fieldName) {
  if (!Compass.supported()) return el('div', { class: 'muted', style: 'font-size:12px' }, 'Компас не поддерживается');
  const status = el('span', { style: 'font-size:12px;color:var(--muted);margin-left:8px' }, '');
  const wrap = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:6px' });
  const btn = el('button', { type: 'button', class: 'btn ghost', style: 'margin:0;flex:1', onclick: async () => {
    try {
      await Compass.start();
      btn.textContent = '📐 Зафиксировать завал';
      btn.onclick = () => {
        if (Compass.state.cant != null) {
          form[fieldName].value = Compass.state.cant.toFixed(1);
          toast('Завал: ' + Compass.state.cant.toFixed(1) + '°');
        }
      };
      Compass.subscribe(s => {
        status.textContent = `завал ${s.cant?.toFixed(1) ?? '—'}° · азимут ${s.heading?.toFixed(0) ?? '—'}°${s.absolute ? '' : ' (rel)'}`;
      });
    } catch (e) { toast('Компас: ' + e.message); }
  }}, '📱 Включить компас');
  wrap.appendChild(btn);
  wrap.appendChild(status);
  return wrap;
}

function attachCompassAzimuthButton(form, fieldName) {
  if (!Compass.supported()) return el('div', { class: 'muted', style: 'font-size:12px' }, 'Компас не поддерживается');
  const mini = createMiniCompass(40);
  const status = el('span', { style: 'font-size:12px;color:var(--muted)' }, '—');
  const btn = el('button', { type: 'button', class: 'btn ghost', style: 'flex:1;margin:0', onclick: async () => {
    try {
      await Compass.start();
      btn.textContent = '🎯 Зафиксировать азимут';
      btn.onclick = () => {
        if (Compass.state.heading != null) {
          form[fieldName].value = Compass.state.heading.toFixed(0);
          toast('Азимут: ' + Compass.state.heading.toFixed(0) + '°');
        }
      };
      Compass.subscribe(s => {
        mini.setHeading(s.heading);
        status.textContent = (s.heading?.toFixed(0) ?? '—') + '°' + (s.absolute ? '' : ' rel');
      });
    } catch (e) { toast('Компас: ' + e.message); }
  }}, '📱 Включить компас');
  return el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:6px' }, mini.svg, btn, status);
}

// ============== Bluetooth helpers (Kestrel auto-fill, KILO range) ==============
function attachKestrelButton(form) {
  const wrap = el('div', { style: 'margin-top:6px' });
  function render() {
    wrap.innerHTML = '';
    const kestrelConn = [...BT.connections.values()].find(c => c.profileId === 'kestrel-5700');
    if (!kestrelConn || !kestrelConn.lastData) {
      wrap.appendChild(el('div', { class: 'muted', style: 'font-size:12px' },
        'Kestrel: ' + (kestrelConn ? 'подключён, ждём данные…' : 'не подключён (Настройки → Устройства)')));
      return;
    }
    const d = kestrelConn.lastData;
    const summary = [
      d.tempC != null && `${d.tempC.toFixed(1)}°C`,
      d.pressureMbar != null && `${d.pressureMbar.toFixed(0)} гПа`,
      d.humidity != null && `${d.humidity.toFixed(0)}%`,
      d.windSpeed != null && `${d.windSpeed.toFixed(1)} м/с`
    ].filter(Boolean).join(' · ');
    wrap.appendChild(el('button', { type: 'button', class: 'btn outline', onclick: () => {
      if (d.tempC != null) form.tempC.value = d.tempC.toFixed(1);
      if (d.pressureMbar != null) form.pressureMbar.value = d.pressureMbar.toFixed(0);
      if (d.humidity != null) form.humidity.value = d.humidity.toFixed(0);
      if (d.windSpeed != null && form.elements.windSpeed) form.windSpeed.value = d.windSpeed.toFixed(1);
      toast('Применено из Kestrel');
    }}, '⥃ Применить Kestrel: ' + summary));
  }
  render();
  BT.subscribe(ev => { if (ev.type === 'data' || ev.type === 'connect' || ev.type === 'disconnect') render(); });
  return wrap;
}

async function connectAndRefresh(profile) {
  try {
    const c = await BT.connect(profile);
    const info = await BT.readBatteryAndInfo(c.device.id);
    toast('Подключено: ' + (c.device.name || profile.label) + (info?.battery != null ? ' (bat ' + info.battery + '%)' : ''));
    navigate();
  } catch (e) {
    toast('Ошибка: ' + e.message);
  }
}

function openParserOverrideSheet(profile) {
  const cur = BT.overrides[profile.id] || {};
  openSheet((sh, close) => {
    sh.appendChild(el('h3', {}, 'Парсер: ' + profile.label));
    sh.appendChild(el('div', { class: 'sub' }, 'Подстройка оффсетов байтов'));
    sh.appendChild(el('div', { class: 'banner' },
      'Если данные парсятся неверно (например, температура показывает 6553°C), открой Debug и посмотри сырые байты. Подбери оффсет и масштаб для каждого поля.'));
    const fields = ['tempC','pressureMbar','humidity','windSpeed','windDir','range_yd','angle_deg'];
    const inputs = {};
    for (const f of fields) {
      const o = cur[f] || {};
      const row = el('div', { class: 'row' },
        el('div', {}, el('label', {}, f + ' offset'),
          el('input', { type: 'number', value: o.off ?? '', placeholder: 'байт' })),
        el('div', {}, el('label', {}, f + ' scale'),
          el('input', { type: 'number', step: 'any', value: o.scale ?? '', placeholder: 'множит.' }))
      );
      inputs[f] = { off: row.querySelectorAll('input')[0], scale: row.querySelectorAll('input')[1] };
      sh.appendChild(row);
    }
    sh.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: () => {
        delete BT.overrides[profile.id]; BT.saveOverrides(); close(); toast('Сброшено');
      }}, 'Сбросить'),
      el('button', { type: 'button', class: 'btn', onclick: () => {
        const newOv = {};
        for (const f of fields) {
          const off = parseFloat(inputs[f].off.value);
          const scale = parseFloat(inputs[f].scale.value);
          if (isFinite(off) && isFinite(scale)) newOv[f] = { off, scale };
        }
        BT.overrides[profile.id] = newOv; BT.saveOverrides(); close(); toast('Сохранено');
      }}, 'Применить')
    ));
  });
}

function attachKiloButton(targetSheetGetters) {
  // targetSheetGetters: { setDistance: fn(m), setAzimuth: fn(deg) }
  if (!BT.supported()) return null;
  const wrap = el('div', { style: 'margin-top:6px' });
  function render() {
    wrap.innerHTML = '';
    const conn = [...BT.connections.values()].find(c => c.profileId === 'sig-kilo-bdx');
    if (!conn || !conn.lastData) {
      wrap.appendChild(el('div', { class: 'muted', style: 'font-size:12px' },
        'SIG KILO: ' + (conn ? 'подключён, наведи и стрельни замером' : 'не подключён')));
      return;
    }
    const d = conn.lastData;
    wrap.appendChild(el('button', { type: 'button', class: 'btn outline', onclick: () => {
      if (d.range_m != null && targetSheetGetters.setDistance) targetSheetGetters.setDistance(d.range_m);
      toast('Дист.: ' + d.range_m?.toFixed(0) + ' м');
    }}, `⥃ Применить KILO: ${d.range_m?.toFixed(0)} м${d.angle_deg != null ? ', ' + d.angle_deg.toFixed(1) + '°' : ''}`));
  }
  render();
  BT.subscribe(ev => { if (ev.type === 'data' || ev.type === 'connect') render(); });
  return wrap;
}

// ============== SPLASH ==============
route('/', async () => {
  setHeader({ title: 'BalisticNote Pro' });
  const ranges = await Store.getAll('ranges');
  const splash = el('div', { class: 'splash' });
  splash.appendChild(h(`<svg class="logo" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="36" fill="none" stroke="#4a6a55" stroke-width="2"/>
    <circle cx="50" cy="50" r="3" fill="#4a6a55"/>
    <line x1="50" y1="6" x2="50" y2="22" stroke="#4a6a55" stroke-width="2"/>
    <line x1="50" y1="78" x2="50" y2="94" stroke="#4a6a55" stroke-width="2"/>
    <line x1="6" y1="50" x2="22" y2="50" stroke="#4a6a55" stroke-width="2"/>
    <line x1="78" y1="50" x2="94" y2="50" stroke="#4a6a55" stroke-width="2"/>
  </svg>`));
  splash.appendChild(el('div', { class: 'name' }, 'BalisticNote Pro'));
  splash.appendChild(el('div', { class: 'tag' }, 'Баллистика · Релоадинг · Журнал'));
  const actions = el('div', { class: 'actions' });
  actions.appendChild(el('a', { class: 'btn good', href: '#/ranges' }, ranges.length ? 'Выбор полигона' : 'Создать полигон'));
  actions.appendChild(el('a', { class: 'btn outline', href: '#/calc' }, 'Быстрый калькулятор'));

  // — чекбокс «Движка» —
  const movWrap = el('div', { style: 'margin-top:14px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--panel)' });
  const movCb = el('input', { type: 'checkbox', style: 'width:22px;height:22px;accent-color:var(--accent)' });
  const movLabel = el('label', { class: 'checkbox', style: 'padding:0' },
    movCb,
    el('span', { class: 'lbl', style: 'font-size:16px;letter-spacing:1px' }, '🎯 Движка (движущаяся цель)',
      el('span', { class: 'sub' }, 'Расчёт упреждения (lead)'))
  );
  movWrap.appendChild(movLabel);
  const movSubBox = el('div', { style: 'display:none;margin-top:12px;gap:8px;flex-direction:column' });
  movSubBox.appendChild(el('button', { type: 'button', class: 'btn', onclick: () => {
    const st = JSON.parse(localStorage.getItem('moving:last') || '{}');
    st.mode = 'linear';
    localStorage.setItem('moving:last', JSON.stringify(st));
    location.hash = '#/moving-target';
  }}, '↔ Линейная цель'));
  movSubBox.appendChild(el('button', { type: 'button', class: 'btn outline', onclick: () => {
    const st = JSON.parse(localStorage.getItem('moving:last') || '{}');
    st.mode = 'rotor';
    localStorage.setItem('moving:last', JSON.stringify(st));
    location.hash = '#/moving-target';
  }}, '⟲ Ротор / вращающаяся'));
  movWrap.appendChild(movSubBox);
  movCb.addEventListener('change', () => {
    movSubBox.style.display = movCb.checked ? 'flex' : 'none';
  });
  actions.appendChild(movWrap);

  splash.appendChild(actions);
  view.appendChild(splash);
});

// ============== RANGES list ==============
route('/ranges', async () => {
  setHeader({ title: 'Полигоны' });
  const ranges = await Store.getAll('ranges');
  if (ranges.length === 0) {
    view.appendChild(el('div', { class: 'banner' }, 'Создай первый полигон — стрельбище, на котором тренируешься.'));
  }
  for (const r of ranges) {
    const positions = await Store.byRange('positions', r.id);
    const targets = await Store.byRange('targets', r.id);
    view.appendChild(el('a', { class: 'tile', href: '#/range/' + r.id },
      el('div', { class: 'ttl' }, r.name || 'Без названия'),
      el('div', { class: 'sub' }, `${positions.length} позиций · ${targets.length} целей`)
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/range/new', 'aria-label': 'Новый' }, '+'));
});

// ============== RANGE edit ==============
route('/range/new', async () => editRange(null));
route('/range/:id/edit', async ({ id }) => editRange(id));

async function editRange(id) {
  const isNew = !id;
  const r = isNew ? { id: Store.uid() } : await Store.get('ranges', id);
  if (!r) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новый полигон' : 'Полигон' });

  const form = el('form', { class: 'card' });
  form.appendChild(el('h2', {}, 'Полигон'));
  form.appendChild(textInput('name', 'Название', r.name, { required: true, placeholder: 'МФОЦ Патриот' }));
  form.appendChild(el('div', { class: 'row' },
    numInput('lat', 'Широта', r.lat),
    numInput('lon', 'Долгота', r.lon)
  ));
  form.appendChild(el('div', { class: 'row' },
    numInput('altitude_m', 'Высота, м', r.altitude_m),
    el('div', {},
      el('label', {}, 'GPS'),
      el('button', { type: 'button', class: 'btn ghost', style: 'margin-top:0', onclick: async () => {
        try {
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
          form.lat.value = pos.coords.latitude.toFixed(6);
          form.lon.value = pos.coords.longitude.toFixed(6);
          if (pos.coords.altitude != null) form.altitude_m.value = pos.coords.altitude.toFixed(0);
          toast('GPS получено');
        } catch { toast('Не удалось'); }
      }}, '📍 Захватить')
    )
  ));
  form.appendChild(el('label', { for: 'notes' }, 'Заметки'));
  form.appendChild(el('textarea', { id: 'notes', name: 'notes' }, r.notes || ''));
  form.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сохранить'));
  if (!isNew) {
    form.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
      if (confirm('Удалить полигон и всё связанное?')) {
        await Store.del('ranges', id);
        for (const p of await Store.byRange('positions', id)) await Store.del('positions', p.id);
        for (const t of await Store.byRange('targets', id)) await Store.del('targets', t.id);
        location.hash = '#/ranges';
      }
    }}, 'Удалить полигон'));
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(form);
    await Store.put('ranges', { ...r, ...d });
    toast('Сохранено');
    location.hash = '#/range/' + r.id;
  });
  view.appendChild(form);

  if (!isNew) {
    view.appendChild(await renderPositionsCard(id));
    view.appendChild(await renderTargetsCard(id));
  }
}

async function renderPositionsCard(rangeId) {
  const positions = await Store.byRange('positions', rangeId);
  const card = el('div', { class: 'card' }, el('h2', {}, 'Огневые позиции'));
  if (positions.length === 0) card.appendChild(el('div', { class: 'muted' }, 'Пока нет.'));
  for (const p of positions) {
    card.appendChild(el('div', { class: 'option' },
      el('span', {}, p.name),
      el('span', { class: 'meta', style: 'cursor:pointer', onclick: () => editPositionSheet(rangeId, p) }, '✎'),
      el('span', { class: 'ico', style: 'width:auto;font-size:18px', onclick: async () => {
        if (confirm('Удалить позицию?')) { await Store.del('positions', p.id); navigate(); }
      }}, '×')
    ));
  }
  card.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => editPositionSheet(rangeId, null) }, '+ Добавить позицию'));
  return card;
}

function editPositionSheet(rangeId, existing) {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, existing ? 'Редактировать позицию' : 'Новая позиция'));
    sheet.appendChild(textInput('name', 'Название', existing?.name, { placeholder: 'Башня закрытая' }));
    sheet.appendChild(numInput('elev', 'Высота над уровнем стрельбища, м', existing?.elev_m));
    sheet.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Отмена'),
      el('button', { type: 'button', class: 'btn', onclick: async () => {
        const name = sheet.querySelector('[name=name]').value.trim();
        if (!name) { toast('Укажи название'); return; }
        const elev_m = parseFloat(sheet.querySelector('[name=elev]').value) || null;
        await Store.put('positions', { ...(existing || { id: Store.uid() }), rangeId, name, elev_m });
        close(); navigate();
      }}, 'Сохранить')
    ));
  });
}

async function renderTargetsCard(rangeId) {
  const targets = await Store.byRange('targets', rangeId);
  const card = el('div', { class: 'card' }, el('h2', {}, 'Цели'));
  if (targets.length === 0) card.appendChild(el('div', { class: 'muted' }, 'Пока нет.'));
  // group by series (буква в имени после цифры) или "Именные"
  const groups = {};
  for (const t of targets) {
    const m = t.name && t.name.match(/^(\d+)([А-ЯA-Z])$/);
    const g = m ? 'Серия ' + m[2] : 'Именные';
    (groups[g] = groups[g] || []).push(t);
  }
  for (const [g, list] of Object.entries(groups)) {
    card.appendChild(el('div', { class: 'muted', style: 'margin-top:10px;letter-spacing:1px;font-size:11px;text-transform:uppercase' }, g));
    for (const t of list.sort((a,b)=>(a.distance_m||0)-(b.distance_m||0))) {
      card.appendChild(el('div', { class: 'option' },
        el('span', {}, t.name),
        el('span', { class: 'meta' }, (t.distance_m || '?') + ' м'),
        el('span', { style: 'cursor:pointer;margin-left:8px', onclick: () => editTargetSheet(rangeId, t) }, '✎'),
        el('span', { style: 'cursor:pointer;margin-left:4px;font-size:18px', onclick: async () => {
          if (confirm('Удалить цель?')) { await Store.del('targets', t.id); navigate(); }
        }}, '×')
      ));
    }
  }
  card.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => editTargetSheet(rangeId, null) }, '+ Добавить цель'));
  return card;
}

async function editTargetSheet(rangeId, existing) {
  const positions = await Store.byRange('positions', rangeId);
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, existing ? 'Редактировать цель' : 'Новая цель'));
    sheet.appendChild(textInput('name', 'Название', existing?.name, { placeholder: 'Свиньи, 12A...' }));
    sheet.appendChild(el('div', { class: 'row' },
      numInput('distance_m', 'Дистанция, м', existing?.distance_m),
      numInput('azimuth_deg', 'Азимут, °', existing?.azimuth_deg, { min: 0, max: 360 })
    ));
    sheet.appendChild(numInput('elev_diff_m', 'Превышение цели над позицией, м', existing?.elev_diff_m));
    sheet.appendChild(selectInput('positionId', 'Привязка к позиции (опц.)', existing?.positionId,
      [{ value: '', label: '— любая —' }, ...positions.map(p => ({ value: p.id, label: p.name }))]));
    const cbWrap = el('label', { class: 'checkbox' },
      el('input', { type: 'checkbox', name: 'onBerm' }),
      el('span', { class: 'lbl' }, 'На бруствере',
        el('span', { class: 'sub' }, 'Цель на пике вершины бруствера — учесть тень/завихрения'))
    );
    if (existing?.onBerm) cbWrap.querySelector('input').checked = true;
    sheet.appendChild(cbWrap);
    sheet.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Отмена'),
      el('button', { type: 'button', class: 'btn', onclick: async () => {
        const d = readForm(sheet);
        if (!d.name) { toast('Укажи название'); return; }
        await Store.put('targets', { ...(existing || { id: Store.uid() }), rangeId,
          name: d.name, distance_m: d.distance_m, azimuth_deg: d.azimuth_deg,
          elev_diff_m: d.elev_diff_m, positionId: d.positionId || null, onBerm: d.onBerm });
        close(); navigate();
      }}, 'Сохранить')
    ));
  });
}

// ============== RANGE menu ==============
route('/range/:id', async ({ id }) => {
  const r = await Store.get('ranges', id);
  if (!r) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: r.name });
  const hits = (await Store.getAll('hits')).filter(x => x.rangeId === id);
  view.appendChild(makeTile('#/range/' + id + '/single', '🎯', 'Одиночная цель', 'Расчёт поправки для одной цели'));
  view.appendChild(makeTile('#/range/' + id + '/map', '🗺', 'Карта целей', 'Поправки для нескольких целей одновременно'));
  view.appendChild(makeTile('#/range/' + id + '/history', '🏆', 'История попаданий', `${hits.length} записей · обучение активно`));
  view.appendChild(makeTile('#/range/' + id + '/edit', '⚙', 'Настройки полигона', 'Позиции и цели'));
});
function makeTile(href, icon, ttl, sub) {
  return el('a', { class: 'tile', href },
    el('div', { class: 'ttl' }, el('span', { style: 'font-size:22px' }, icon), ttl),
    el('div', { class: 'sub' }, sub)
  );
}

// ============== SINGLE TARGET WIZARD ==============
const Wiz = {
  rangeId: null,
  step: 1,
  positionId: null,
  targetId: null,
  customTarget: null,
  weaponId: null,
  cartridgeId: null,
  wind: { dir: 0, speed: 0 },
  weather: { tempC: 15, pressureMbar: 1013, humidity: 50, shotAngle_deg: 0 },
  result: null
};

route('/range/:id/single', async ({ id }) => {
  const r = await Store.get('ranges', id);
  if (!r) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  if (Wiz.rangeId !== id) {
    Object.assign(Wiz, { rangeId: id, step: 1, positionId: null, targetId: null, customTarget: null, result: null });
    const p = loadPrefs();
    Wiz.weaponId = p.weaponId || null;
    Wiz.cartridgeId = p.cartridgeId || null;
    Wiz.weather = p.weather || Wiz.weather;
  }
  await renderWizard(r);
});

async function renderWizard(range) {
  view.innerHTML = '';
  const totalSteps = 4;
  setHeader({ title: stepTitle(Wiz.step), sub: `Шаг ${Wiz.step} из ${totalSteps}`, progress: (Wiz.step / totalSteps) * 100 });
  if (Wiz.step === 1) await renderStepPosition(range);
  else if (Wiz.step === 2) await renderStepTarget(range);
  else if (Wiz.step === 3) await renderStepWind(range);
  else if (Wiz.step === 4) await renderStepResult(range);
}
function stepTitle(s) {
  return ({1:'Огневая позиция',2:'Выбор цели',3:'Ввод ветра',4:'Результат'})[s] || '';
}
function wizNext() { Wiz.step = Math.min(4, Wiz.step + 1); renderWizardCurrent(); }
function wizBack() { Wiz.step = Math.max(1, Wiz.step - 1); renderWizardCurrent(); }
async function renderWizardCurrent() {
  const r = await Store.get('ranges', Wiz.rangeId);
  renderWizard(r);
}

// ---- Step 1: position ----
async function renderStepPosition(range) {
  const positions = await Store.byRange('positions', range.id);
  if (positions.length === 0) {
    view.appendChild(el('div', { class: 'banner' }, 'Сначала добавь огневые позиции в настройках полигона.'));
    view.appendChild(el('a', { class: 'btn', href: '#/range/' + range.id + '/edit' }, 'Открыть настройки'));
    return;
  }
  const list = el('div', { class: 'option-list' });
  // also offer "no specific position"
  positions.unshift({ id: '__any__', name: 'Любая / не указана' });
  for (const p of positions) {
    const opt = el('div', { class: 'option' + (Wiz.positionId === p.id ? ' selected' : '') },
      el('span', { class: 'dot' }),
      el('span', {}, p.name)
    );
    opt.addEventListener('click', () => {
      Wiz.positionId = p.id;
      list.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
    list.appendChild(opt);
  }
  view.appendChild(list);
  view.appendChild(bottomBar(
    el('button', { type: 'button', class: 'btn' + (Wiz.positionId ? '' : ' disabled'),
      disabled: !Wiz.positionId, onclick: wizNext }, 'Далее')
  ));
}

function bottomBar(...children) {
  const bar = el('div', { class: 'bottom-bar' });
  for (const c of children) bar.appendChild(c);
  return bar;
}

// ---- Step 2: target ----
async function renderStepTarget(range) {
  let targets = await Store.byRange('targets', range.id);
  if (Wiz.positionId && Wiz.positionId !== '__any__') {
    targets = targets.filter(t => !t.positionId || t.positionId === Wiz.positionId);
  }
  targets.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));

  // group
  const groups = {};
  for (const t of targets) {
    const m = t.name && t.name.match(/^(\d+)([А-ЯA-Z])$/);
    const g = m ? 'Серия ' + m[2] : 'Именные цели';
    (groups[g] = groups[g] || []).push(t);
  }
  for (const [g, list] of Object.entries(groups)) {
    view.appendChild(el('div', { class: 'muted', style: 'margin:14px 0 6px;letter-spacing:1.5px;font-size:11px;text-transform:uppercase' }, g));
    const ol = el('div', { class: 'option-list' });
    for (const t of list) {
      const opt = el('div', { class: 'option' + (Wiz.targetId === t.id ? ' selected' : '') },
        el('span', { class: 'dot' }),
        el('span', {}, t.name),
        el('span', { class: 'meta' }, (t.distance_m || '?') + ' м')
      );
      opt.addEventListener('click', () => {
        Wiz.targetId = t.id; Wiz.customTarget = null;
        view.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
      ol.appendChild(opt);
    }
    view.appendChild(ol);
  }
  view.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => addAdHocTargetSheet() }, '+ Цель вне списка'));
  if (Wiz.customTarget) {
    view.appendChild(el('div', { class: 'info-card' },
      el('div', { class: 'label' }, 'Произвольная цель'),
      el('div', { class: 'kv' },
        el('div', { class: 'k' }, 'Дистанция'), el('div', { class: 'v' }, Wiz.customTarget.distance_m + ' м'),
        el('div', { class: 'k' }, 'Азимут'), el('div', { class: 'v' }, Wiz.customTarget.azimuth_deg + '°')
      )
    ));
  }
  view.appendChild(bottomBar(
    el('div', { class: 'row', style: 'display:flex;gap:8px;max-width:720px;margin:0 auto' },
      el('button', { type: 'button', class: 'btn ghost', onclick: wizBack }, 'Назад'),
      el('button', { type: 'button',
        class: 'btn' + ((Wiz.targetId || Wiz.customTarget) ? '' : ' disabled'),
        disabled: !(Wiz.targetId || Wiz.customTarget), onclick: wizNext }, 'Далее')
    )
  ));
}
function addAdHocTargetSheet() {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, 'Произвольная цель'));
    sheet.appendChild(el('div', { class: 'sub' }, 'не сохраняется в каталог'));
    sheet.appendChild(numInput('distance_m', 'Дистанция, м', null, { required: true }));
    sheet.appendChild(attachKiloButton({
      setDistance: m => sheet.querySelector('[name=distance_m]').value = m.toFixed(0)
    }));
    sheet.appendChild(numInput('azimuth_deg', 'Азимут, °', null, { min: 0, max: 360, required: true }));
    sheet.appendChild(attachCompassAzimuthButton(sheet, 'azimuth_deg'));
    sheet.appendChild(numInput('elev_diff_m', 'Превышение, м', 0));
    sheet.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Отмена'),
      el('button', { type: 'button', class: 'btn', onclick: () => {
        const d = readForm(sheet);
        if (!d.distance_m || d.azimuth_deg == null) { toast('Заполни поля'); return; }
        Wiz.customTarget = { name: 'Произвольная', ...d };
        Wiz.targetId = null;
        close(); renderWizardCurrent();
      }}, 'Применить')
    ));
  });
}

// ---- Step 3: wind ----
async function renderStepWind(range) {
  // determine target for azimuth shown
  let tgt = null;
  if (Wiz.targetId) tgt = await Store.get('targets', Wiz.targetId);
  else tgt = Wiz.customTarget;
  if (!tgt) { Wiz.step = 2; return renderWizardCurrent(); }
  const positions = await Store.byRange('positions', range.id);
  const pos = positions.find(p => p.id === Wiz.positionId);

  view.appendChild(el('div', { class: 'info-card' },
    el('div', { class: 'label' }, 'Азимут стрельбы'),
    el('div', { class: 'big-num' }, (tgt.azimuth_deg ?? 0) + '°'),
    el('div', { class: 'muted center' }, `${pos?.name || 'позиция'} → ${tgt.name} (${tgt.distance_m} м)`)
  ));

  view.appendChild(el('div', { class: 'banner' }, 'Укажи направление ветра — компасом (куда дует) или по часам (откуда дует относительно цели).'));

  // переключатель компас/часы
  const windMode = localStorage.getItem('windPickerMode') || 'compass';
  const wmRow = el('div', { class: 'chips', style: 'justify-content:center;margin:6px 0' });
  const cmChip = el('div', { class: 'chip' + (windMode === 'compass' ? ' active' : ''),
    onclick: () => { localStorage.setItem('windPickerMode', 'compass'); renderWizardCurrent(); }}, '🧭 Компас');
  const clChip = el('div', { class: 'chip' + (windMode === 'clock' ? ' active' : ''),
    onclick: () => { localStorage.setItem('windPickerMode', 'clock'); renderWizardCurrent(); }}, '🕐 Часы');
  wmRow.appendChild(cmChip); wmRow.appendChild(clChip);
  view.appendChild(wmRow);

  view.appendChild(el('div', { class: 'compass-sub' },
    windMode === 'compass' ? 'Направление ветра (куда дует)' : 'Откуда дует ветер (часы)'));

  const wrap = el('div', { class: 'compass-wrap' });
  if (windMode === 'clock') {
    const clock = createWindClock({
      value: Wiz.wind.dir,
      shotAz: tgt.azimuth_deg ?? 0,
      onChange: (windToDir) => { Wiz.wind.dir = windToDir; updateAux(); }
    });
    wrap.appendChild(clock.svg);
  } else {
    const comp = createCompass({
      value: Wiz.wind.dir,
      fireDir: tgt.azimuth_deg ?? null,
      onChange: v => { Wiz.wind.dir = v; updateAux(); }
    });
    wrap.appendChild(comp.svg);
  }
  view.appendChild(wrap);

  const aux = el('div', { class: 'kv', style: 'padding:0 14px' });
  view.appendChild(aux);

  view.appendChild(el('label', {}, 'Скорость ветра, м/с'));
  const speed = el('input', { type: 'number', step: '0.1', value: Wiz.wind.speed, oninput: e => { Wiz.wind.speed = parseFloat(e.target.value) || 0; updateAux(); } });
  view.appendChild(speed);
  view.appendChild(el('div', { class: 'big-num' }, fmt(Wiz.wind.speed, 1), el('span', { class: 'unit' }, 'м/с')));

  // weather
  const w = Wiz.weather;
  const wcard = el('div', { class: 'card' });
  wcard.appendChild(el('h2', {}, 'Атмосфера'));
  wcard.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', w.tempC),
    numInput('pressureMbar', 'Давл., гПа', w.pressureMbar)
  ));
  wcard.appendChild(el('div', { class: 'row' },
    numInput('humidity', 'Влажн., %', w.humidity),
    numInput('shotAngle_deg', 'Угол места, °', w.shotAngle_deg)
  ));
  wcard.appendChild(el('div', { class: 'row' },
    numInput('cant_deg', 'Завал винтовки, ° (+ вправо)', w.cant_deg ?? 0),
    numInput('ammoTempC', 'Темп. боеприпасов, °C', w.ammoTempC)
  ));
  // компас телефона — поймать завал
  wcard.appendChild(attachCompassCantButton(wcard, 'cant_deg'));
  wcard.appendChild(attachAtmoButtons(wcard, 'pressureMbar'));
  // автозаполнение от Kestrel, если подключён
  wcard.appendChild(attachKestrelButton(wcard));
  view.appendChild(wcard);
  wcard.addEventListener('input', () => {
    Wiz.weather = readForm(wcard);
  });

  function updateAux() {
    const az = tgt.azimuth_deg ?? 0;
    aux.innerHTML = '';
    aux.appendChild(el('div', { class: 'k' }, 'Часы (циферблат)'));
    aux.appendChild(el('div', { class: 'v', style: 'color:var(--accent)' }, windToClock(Wiz.wind.dir, az)));
    aux.appendChild(el('div', { class: 'k' }, 'Угол относ. ствола'));
    aux.appendChild(el('div', { class: 'v' }, fmt(solverWindAngle(Wiz.wind.dir, az), 0) + '°'));
  }
  updateAux();

  // weapon/cartridge selector
  const weapons = await Store.getAll('weapons');
  const cartridges = await Store.getAll('cartridges');
  const profCard = el('div', { class: 'card' });
  profCard.appendChild(el('h2', {}, 'Оружие / Патрон'));
  if (weapons.length === 0 || cartridges.length === 0) {
    profCard.appendChild(el('div', { class: 'banner accent' }, 'Сначала создай профиль оружия и патрона.'));
    profCard.appendChild(el('div', { class: 'row', style: 'display:flex;gap:8px' },
      el('a', { class: 'btn ghost', href: '#/weapons' }, 'Оружие'),
      el('a', { class: 'btn ghost', href: '#/cartridges' }, 'Патроны')
    ));
  } else {
    const wSel = selectInput('weaponId', 'Оружие', Wiz.weaponId,
      [{ value: '', label: '— выбери —' }, ...weapons.map(w => ({ value: w.id, label: w.name }))]);
    const cSel = selectInput('cartridgeId', 'Патрон', Wiz.cartridgeId,
      [{ value: '', label: '— выбери —' }, ...cartridges.map(c => ({ value: c.id, label: c.name }))]);
    profCard.appendChild(wSel); profCard.appendChild(cSel);
    profCard.querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
      Wiz.weaponId = profCard.querySelector('[name=weaponId]').value || null;
      Wiz.cartridgeId = profCard.querySelector('[name=cartridgeId]').value || null;
    }));
  }
  view.appendChild(profCard);

  view.appendChild(bottomBar(
    el('div', { style: 'display:flex;gap:8px;max-width:720px;margin:0 auto' },
      el('button', { type: 'button', class: 'btn ghost', onclick: wizBack }, 'Назад'),
      el('button', { type: 'button', class: 'btn', onclick: async () => {
        // persist prefs
        savePrefs({ weaponId: Wiz.weaponId, cartridgeId: Wiz.cartridgeId, weather: Wiz.weather });
        await computeResult();
        wizNext();
      }}, 'Рассчитать')
    )
  ));
}

async function computeResult() {
  let tgt = Wiz.targetId ? await Store.get('targets', Wiz.targetId) : Wiz.customTarget;
  const weapon = Wiz.weaponId ? await Store.get('weapons', Wiz.weaponId) : null;
  const cart = Wiz.cartridgeId ? await Store.get('cartridges', Wiz.cartridgeId) : null;
  if (!weapon || !cart || !tgt) { Wiz.result = null; return; }
  const dist = tgt.distance_m || 500;
  const az = tgt.azimuth_deg ?? 0;
  const range = await Store.get('ranges', Wiz.rangeId);
  const input = buildSolverInputFor(weapon, cart, [dist], {
    tempC: Wiz.weather.tempC, pressureMbar: Wiz.weather.pressureMbar, humidity: Wiz.weather.humidity,
    windSpeed: Wiz.wind.speed,
    windAngle_deg: solverWindAngle(Wiz.wind.dir, az),
    shotAngle_deg: Wiz.weather.shotAngle_deg || 0,
    latitude_deg: range?.lat || 0,
    azimuth_deg: az
  });
  const res = Ballistics.solve(input);
  const row = res.rows[0] || null;
  Wiz.result = { res, row, dist, az, clock: windToClock(Wiz.wind.dir, az), weapon, cart, tgt };
}

// ---- Step 4: result ----
async function renderStepResult(range) {
  if (!Wiz.result) {
    view.appendChild(el('div', { class: 'banner' }, 'Не хватает данных оружия/патрона для расчёта.'));
    view.appendChild(bottomBar(el('button', { type: 'button', class: 'btn ghost', onclick: wizBack }, 'Назад')));
    return;
  }
  const { row, dist, az, clock, weapon, cart, tgt } = Wiz.result;
  const positions = await Store.byRange('positions', range.id);
  const pos = positions.find(p => p.id === Wiz.positionId);

  view.appendChild(el('div', { class: 'card', style: 'padding:10px 14px' },
    el('div', { class: 'muted', style: 'font-size:13px' }, `Позиция: ${pos?.name || '—'}`),
    el('div', { class: 'muted', style: 'font-size:13px' }, `Цель: ${tgt.name}`),
    el('div', { class: 'muted', style: 'font-size:13px' }, `Дистанция: ${dist} м · Азимут: ${az}°`)
  ));

  // данные для калькулятора (ветер по часам)
  view.appendChild(el('div', { class: 'info-card' },
    el('div', { class: 'label' }, 'Ветер для калькулятора'),
    el('div', { class: 'clock-display' }, fmt(Wiz.wind.speed, 1), el('span', { style: 'font-size:14px;color:var(--muted)' }, 'м/с'), '·', clock),
    el('div', { class: 'muted center', style: 'margin-top:6px' }, 'Направление по циферблату')
  ));

  // расчётные поправки
  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'Поправки от калькулятора'),
    el('table', { class: 'table' },
      h(`<thead><tr><th>Парам.</th><th>mil</th><th>MOA</th><th>см</th></tr></thead>`),
      el('tbody', {},
        h(`<tr><td>Вертикаль</td><td class="accent">${fmt(row.drop_mil,2)}</td><td class="accent">${fmt(row.drop_moa,1)}</td><td>${fmt(-row.drop_m*100,1)}</td></tr>`),
        h(`<tr><td>Боковая</td><td class="accent">${fmt(row.drift_mil,2)}</td><td class="accent">${fmt(row.drift_moa,1)}</td><td>${fmt(row.drift_m*100,1)}</td></tr>`)
      )
    ),
    el('div', { class: 'kv', style: 'margin-top:10px' },
      el('div', { class: 'k' }, 'Скорость пули у цели'), el('div', { class: 'v' }, fmt(row.vel_mps,0) + ' м/с'),
      el('div', { class: 'k' }, 'Время полёта'), el('div', { class: 'v' }, fmt(row.tof_s,2) + ' с'),
      el('div', { class: 'k' }, 'Плотность воздуха'), el('div', { class: 'v' }, fmt(Wiz.result.res.airDensity,3) + ' кг/м³'),
      Wiz.result.res.Sg ? el('div', { class: 'k' }, 'Sg (Miller)') : null,
      Wiz.result.res.Sg ? el('div', { class: 'v', style: Wiz.result.res.stable ? '' : 'color:var(--bad)' },
        fmt(Wiz.result.res.SgCorrected, 2) + (Wiz.result.res.stable ? ' ✓' : ' ⚠ неуст.')) : null
    )
  ));

  // — разбивка по составляющим (Litz) —
  const c = row.components;
  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'Разбивка по составляющим'),
    el('div', { class: 'banner' },
      'Чистая point-mass + Кориолис уже включены в основной расчёт. Литцовские добавки:'),
    el('div', { class: 'kv' },
      el('div', { class: 'k' }, 'Гравитация + drag'), el('div', { class: 'v' }, fmt(-c.gravity_drop_m*100, 1) + ' см ↓'),
      el('div', { class: 'k' }, 'Ветер point-mass'), el('div', { class: 'v' }, fmt(c.wind_drift_m*100, 1) + ' см'),
      el('div', { class: 'k' }, 'Spin drift (Miller/Litz)'), el('div', { class: 'v', style: 'color:var(--accent)' }, (c.spin_drift_m >= 0 ? '+' : '') + fmt(c.spin_drift_m*100, 1) + ' см'),
      el('div', { class: 'k' }, 'Aerodynamic jump'), el('div', { class: 'v', style: 'color:var(--accent)' }, (c.aero_jump_m >= 0 ? '+' : '') + fmt(c.aero_jump_m*100, 1) + ' см')
    )
  ));

  // история — коррекция по последним попаданиям при близких условиях
  const corr = await learnFromHistory({ rangeId: range.id, positionId: Wiz.positionId, targetId: Wiz.targetId, windSpeed: Wiz.wind.speed, windDir: Wiz.wind.dir, az });
  if (corr) {
    view.appendChild(el('div', { class: 'info-card good' },
      el('div', { class: 'label' }, 'Коррекция по истории'),
      el('div', { class: 'muted center', style: 'margin-bottom:6px' }, `на основе ${corr.n} попаданий (уверенность ${corr.conf}%)`),
      el('div', { class: 'kv' },
        el('div', { class: 'k' }, 'Сред. отклонение по вертикали'), el('div', { class: 'v', style: 'color:var(--good)' }, fmt(corr.dropOffsetMil, 2) + ' mil'),
        el('div', { class: 'k' }, 'Сред. отклонение по горизонтали'), el('div', { class: 'v', style: 'color:var(--good)' }, fmt(corr.driftOffsetMil, 2) + ' mil'),
        el('div', { class: 'k' }, 'Скорректированная вертикаль'), el('div', { class: 'v', style: 'color:var(--good)' }, fmt(row.drop_mil + corr.dropOffsetMil, 2) + ' mil'),
        el('div', { class: 'k' }, 'Скорректированная горизонталь'), el('div', { class: 'v', style: 'color:var(--good)' }, fmt(row.drift_mil + corr.driftOffsetMil, 2) + ' mil')
      )
    ));
  }

  view.appendChild(bottomBar(
    el('div', { style: 'display:flex;flex-direction:column;gap:8px;max-width:720px;margin:0 auto' },
      el('button', { type: 'button', class: 'btn', onclick: () => saveHitSheet() }, 'В историю попаданий'),
      el('div', { style: 'display:flex;gap:8px' },
        el('button', { type: 'button', class: 'btn ghost', onclick: () => { Wiz.step = 1; Wiz.targetId = null; Wiz.customTarget = null; renderWizardCurrent(); } }, 'Новый расчёт'),
        el('a', { class: 'btn outline', href: '#/range/' + range.id, style: 'text-decoration:none' }, 'Меню')
      )
    )
  ));
}

async function learnFromHistory({ rangeId, positionId, targetId, windSpeed, windDir, az }) {
  const hits = (await Store.getAll('hits')).filter(h => h.rangeId === rangeId);
  if (hits.length === 0) return null;
  // фильтр по позиции/цели; считаем близость по скорости и направлению ветра
  const relWindAng = solverWindAngle(windDir, az);
  const candidates = hits.filter(h =>
    (!positionId || h.positionId === positionId || positionId === '__any__') &&
    (!targetId || h.targetId === targetId || !h.targetId)
  );
  if (candidates.length === 0) return null;
  // веса: близость скорости и угла
  let wSum = 0, dropSum = 0, driftSum = 0, n = 0;
  for (const h of candidates) {
    const dWind = Math.abs((h.windSpeed || 0) - windSpeed);
    const dAng = Math.min(Math.abs((h.windRelAngle || 0) - relWindAng), 360 - Math.abs((h.windRelAngle || 0) - relWindAng));
    if (dWind > 3 || dAng > 45) continue;
    const w = Math.max(0, 1 - dWind/3) * Math.max(0, 1 - dAng/45);
    wSum += w; dropSum += w * (h.dropOffsetMil || 0); driftSum += w * (h.driftOffsetMil || 0);
    n++;
  }
  if (n === 0 || wSum === 0) return null;
  return {
    n, conf: Math.round(Math.min(1, wSum / 3) * 100),
    dropOffsetMil: dropSum / wSum,
    driftOffsetMil: driftSum / wSum
  };
}

function saveHitSheet() {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, 'Записать попадание'));
    sheet.appendChild(el('div', { class: 'sub' }, 'фактические отклонения от точки прицеливания'));
    sheet.appendChild(el('div', { class: 'row' },
      numInput('actualDropMil', 'Факт. поправка вертикаль, mil', Wiz.result.row.drop_mil.toFixed(2)),
      numInput('actualDriftMil', 'Факт. поправка горизонталь, mil', Wiz.result.row.drift_mil.toFixed(2))
    ));
    sheet.appendChild(el('label', { class: 'checkbox' },
      el('input', { type: 'checkbox', name: 'hit' }),
      el('span', { class: 'lbl' }, 'Попадание (отметить как успешное)')
    ));
    sheet.appendChild(textInput('notes', 'Заметка', ''));
    sheet.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Отмена'),
      el('button', { type: 'button', class: 'btn', onclick: async () => {
        const d = readForm(sheet);
        const az = Wiz.result.az;
        const rec = {
          id: Store.uid(),
          rangeId: Wiz.rangeId, positionId: Wiz.positionId, targetId: Wiz.targetId,
          date: new Date().toISOString(),
          weather: { ...Wiz.weather },
          windSpeed: Wiz.wind.speed, windDir: Wiz.wind.dir,
          windRelAngle: solverWindAngle(Wiz.wind.dir, az),
          clock: Wiz.result.clock,
          weaponId: Wiz.weaponId, cartridgeId: Wiz.cartridgeId,
          distance_m: Wiz.result.dist,
          calcDropMil: Wiz.result.row.drop_mil,
          calcDriftMil: Wiz.result.row.drift_mil,
          actualDropMil: d.actualDropMil,
          actualDriftMil: d.actualDriftMil,
          dropOffsetMil: (d.actualDropMil ?? 0) - Wiz.result.row.drop_mil,
          driftOffsetMil: (d.actualDriftMil ?? 0) - Wiz.result.row.drift_mil,
          hit: d.hit, notes: d.notes
        };
        await Store.put('hits', rec);
        toast('Сохранено'); close();
      }}, 'Сохранить')
    ));
  });
}

// ============== HITS history ==============
route('/range/:id/history', async ({ id }) => {
  const r = await Store.get('ranges', id);
  setHeader({ title: 'История попаданий', sub: r?.name });
  const hits = (await Store.getAll('hits')).filter(h => h.rangeId === id).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if (hits.length === 0) {
    view.appendChild(el('div', { class: 'banner' }, 'Записей нет. Делай выстрел, фиксируй фактическую поправку — приложение будет учиться.'));
    return;
  }
  const targets = await Store.byRange('targets', id);
  const positions = await Store.byRange('positions', id);
  const tName = id => targets.find(t => t.id === id)?.name || '—';
  const pName = id => positions.find(p => p.id === id)?.name || '—';
  for (const h of hits) {
    view.appendChild(el('div', { class: 'list-item' },
      el('div', { class: 'ttl' }, `${pName(h.positionId)} → ${tName(h.targetId)} · ${h.distance_m} м`),
      el('div', { class: 'sub' },
        `ветер ${fmt(h.windSpeed,1)} м/с ${h.clock} · ` +
        `расч. ${fmt(h.calcDropMil,2)} / ${fmt(h.calcDriftMil,2)} mil · ` +
        `факт. ${fmt(h.actualDropMil,2)} / ${fmt(h.actualDriftMil,2)} mil · ` +
        new Date(h.date).toLocaleDateString('ru')),
      h.notes ? el('div', { class: 'sub' }, h.notes) : null,
      el('div', { style: 'margin-top:8px;text-align:right' },
        el('button', { class: 'ico', style: 'width:auto;padding:4px 10px;font-size:14px;color:var(--bad)', onclick: async () => {
          if (confirm('Удалить запись?')) { await Store.del('hits', h.id); navigate(); }
        }}, 'Удалить'))
    ));
  }
});

// ============== MAP (multi target) ==============
route('/range/:id/map', async ({ id }) => {
  const r = await Store.get('ranges', id);
  setHeader({ title: 'Карта целей', sub: r?.name });

  const positions = await Store.byRange('positions', id);
  const targets = await Store.byRange('targets', id);
  const weapons = await Store.getAll('weapons');
  const cartridges = await Store.getAll('cartridges');
  const p = loadPrefs();

  if (positions.length === 0 || targets.length === 0) {
    view.appendChild(el('div', { class: 'banner' }, 'Добавь хотя бы одну позицию и одну цель.'));
    return;
  }

  const form = el('div', { class: 'card' });
  form.appendChild(el('h2', {}, 'Условия'));
  form.appendChild(selectInput('positionId', 'Позиция', null,
    positions.map(p => ({ value: p.id, label: p.name }))));
  form.appendChild(selectInput('weaponId', 'Оружие', p.weaponId,
    [{ value: '', label: '—' }, ...weapons.map(w => ({ value: w.id, label: w.name }))]));
  form.appendChild(selectInput('cartridgeId', 'Патрон', p.cartridgeId,
    [{ value: '', label: '—' }, ...cartridges.map(c => ({ value: c.id, label: c.name }))]));
  form.appendChild(el('div', { class: 'row' },
    numInput('windDir', 'Ветер куда дует, °', 0),
    numInput('windSpeed', 'Ветер, м/с', 0)
  ));
  form.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', (p.weather||{}).tempC ?? 15),
    numInput('pressureMbar', 'Давл., гПа', (p.weather||{}).pressureMbar ?? 1013)
  ));
  form.appendChild(attachAtmoButtons(form, 'pressureMbar'));
  form.appendChild(el('button', { class: 'btn', onclick: () => recompute() }, 'Рассчитать'));
  view.appendChild(form);

  const out = el('div'); view.appendChild(out);

  async function recompute() {
    const d = readForm(form);
    const weapon = weapons.find(x => x.id === d.weaponId);
    const cart = cartridges.find(x => x.id === d.cartridgeId);
    if (!weapon || !cart) { toast('Нужно выбрать оружие и патрон'); return; }
    const pos = positions.find(x => x.id === d.positionId);
    const tList = targets.filter(t => !t.positionId || t.positionId === pos.id).sort((a,b)=>a.distance_m-b.distance_m);
    out.innerHTML = '';
    out.appendChild(el('div', { class: 'card' },
      el('h2', {}, `${pos.name} · ${tList.length} целей · ${fmt(d.windSpeed,1)} м/с / ${Math.round(d.windDir)}°`),
      el('table', { class: 'table' },
        h(`<thead><tr><th>Цель</th><th>Дист.</th><th>Часы</th><th>Верт. mil</th><th>Гор. mil</th></tr></thead>`),
        el('tbody', {}, ...tList.map(t => {
          const az = t.azimuth_deg ?? 0;
          const input = buildSolverInputFor(weapon, cart, [t.distance_m], {
            tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: 50,
            windSpeed: d.windSpeed,
            windAngle_deg: solverWindAngle(d.windDir, az),
            shotAngle_deg: 0,
            azimuth_deg: az
          });
          const r = Ballistics.solve(input);
          const row = r.rows[0];
          return h(`<tr>
            <td>${t.name}</td>
            <td>${t.distance_m}</td>
            <td>${windToClock(d.windDir, az)}</td>
            <td class="accent">${fmt(row?.drop_mil, 2)}</td>
            <td class="accent">${fmt(row?.drift_mil, 2)}</td>
          </tr>`);
        }))
      )
    ));
  }
});

// ============== JOURNAL (поиск с фильтрами по всем попаданиям) ==============
route('/journal', async () => {
  setHeader({ title: 'Журнал' });
  const [hits, ranges, positions, targets, cartridges, weapons] = await Promise.all([
    Store.getAll('hits'), Store.getAll('ranges'), Store.getAll('positions'),
    Store.getAll('targets'), Store.getAll('cartridges'), Store.getAll('weapons')
  ]);
  const rangeName = id => ranges.find(r => r.id === id)?.name || '—';
  const posName   = id => positions.find(p => p.id === id)?.name || '—';
  const tgtName   = id => targets.find(t => t.id === id)?.name || '—';
  const cartName  = id => cartridges.find(c => c.id === id)?.name || '—';
  const wpnName   = id => weapons.find(w => w.id === id)?.name || '—';

  // --- состояние фильтров (хранится в localStorage) ---
  let F = JSON.parse(localStorage.getItem('journal:F') || '{}');
  F.rangeIds      = F.rangeIds || [];
  F.cartridgeIds  = F.cartridgeIds || [];
  F.weaponIds     = F.weaponIds || [];
  F.positionIds   = F.positionIds || [];
  ['tempMin','tempMax','humMin','humMax','windMin','windMax','distMin','distMax']
    .forEach(k => F[k] = (F[k] ?? null));
  F.dateFrom = F.dateFrom || '';
  F.dateTo   = F.dateTo || '';
  F.hitOnly  = F.hitOnly || 'all'; // all|hit|miss
  F.sortBy   = F.sortBy || 'date_desc';
  F.groupBy  = F.groupBy || 'none'; // none|cartridge|range|distance
  function saveF() { localStorage.setItem('journal:F', JSON.stringify(F)); render(); }

  if (hits.length === 0) {
    view.appendChild(el('div', { class: 'banner' },
      'Записей в журнале пока нет. После расчёта в мастере жми «В историю попаданий» и фиксируй фактическое снижение/боковую — здесь они появятся.'));
    return;
  }

  // --- основной layout ---
  const filterCard = el('div', { class: 'card' });
  const statsCard  = el('div', { class: 'card' });
  const resultsEl  = el('div');
  view.appendChild(filterCard);
  view.appendChild(statsCard);
  view.appendChild(resultsEl);

  // --- фильтры ---
  function buildChipRow(label, items, getId, getLabel, fieldName) {
    const wrap = el('div', { style: 'margin-bottom:10px' });
    wrap.appendChild(el('label', {}, label));
    const chips = el('div', { class: 'chips' });
    chips.appendChild(el('div', {
      class: 'chip' + (F[fieldName].length === 0 ? ' active' : ''),
      onclick: () => { F[fieldName] = []; saveF(); }
    }, 'Все'));
    for (const it of items) {
      const id = getId(it);
      chips.appendChild(el('div', {
        class: 'chip' + (F[fieldName].includes(id) ? ' active' : ''),
        onclick: () => {
          if (F[fieldName].includes(id)) F[fieldName] = F[fieldName].filter(x => x !== id);
          else F[fieldName] = [...F[fieldName], id];
          saveF();
        }
      }, getLabel(it)));
    }
    wrap.appendChild(chips);
    return wrap;
  }
  function buildRangeRow(label, unit, minKey, maxKey) {
    const wrap = el('div', { style: 'margin-bottom:8px' });
    wrap.appendChild(el('label', {}, `${label}${unit ? ', ' + unit : ''}`));
    const row = el('div', { class: 'row', style: 'display:flex;gap:8px' });
    const mn = el('input', { type: 'number', placeholder: 'от', value: F[minKey] ?? '',
      onchange: e => { F[minKey] = e.target.value === '' ? null : parseFloat(e.target.value); saveF(); } });
    const mx = el('input', { type: 'number', placeholder: 'до', value: F[maxKey] ?? '',
      onchange: e => { F[maxKey] = e.target.value === '' ? null : parseFloat(e.target.value); saveF(); } });
    row.appendChild(mn); row.appendChild(mx);
    wrap.appendChild(row);
    return wrap;
  }

  function renderFilters() {
    filterCard.innerHTML = '';
    filterCard.appendChild(el('h2', {}, 'Фильтры'));

    if (ranges.length)
      filterCard.appendChild(buildChipRow('Полигон', ranges, r => r.id, r => r.name, 'rangeIds'));

    // огневые позиции — только из выбранных полигонов (или все, если ни один не выбран)
    const visiblePositions = F.rangeIds.length
      ? positions.filter(p => F.rangeIds.includes(p.rangeId))
      : positions;
    if (visiblePositions.length)
      filterCard.appendChild(buildChipRow('Огневая позиция', visiblePositions, p => p.id, p => p.name, 'positionIds'));

    if (cartridges.length)
      filterCard.appendChild(buildChipRow('Патрон', cartridges, c => c.id,
        c => c.name + (c.bulletMass_gr ? ' ' + c.bulletMass_gr + 'gr' : ''), 'cartridgeIds'));

    if (weapons.length)
      filterCard.appendChild(buildChipRow('Оружие', weapons, w => w.id, w => w.name, 'weaponIds'));

    filterCard.appendChild(el('hr'));
    filterCard.appendChild(el('div', { class: 'row', style: 'display:flex;gap:8px' },
      buildRangeRow('Темп.', '°C', 'tempMin', 'tempMax'),
      buildRangeRow('Влажн.', '%', 'humMin', 'humMax')
    ));
    filterCard.appendChild(el('div', { class: 'row', style: 'display:flex;gap:8px' },
      buildRangeRow('Ветер', 'м/с', 'windMin', 'windMax'),
      buildRangeRow('Дист.', 'м', 'distMin', 'distMax')
    ));
    filterCard.appendChild(el('div', { class: 'row', style: 'display:flex;gap:8px' },
      el('div', {}, el('label', {}, 'Дата от'),
        el('input', { type: 'date', value: F.dateFrom,
          onchange: e => { F.dateFrom = e.target.value; saveF(); } })),
      el('div', {}, el('label', {}, 'до'),
        el('input', { type: 'date', value: F.dateTo,
          onchange: e => { F.dateTo = e.target.value; saveF(); } }))
    ));

    filterCard.appendChild(el('label', {}, 'Только'));
    const hitChips = el('div', { class: 'chips' });
    for (const [v, lbl] of [['all','Все'],['hit','Попадания'],['miss','Промахи']]) {
      hitChips.appendChild(el('div', {
        class: 'chip' + (F.hitOnly === v ? ' active' : ''),
        onclick: () => { F.hitOnly = v; saveF(); }
      }, lbl));
    }
    filterCard.appendChild(hitChips);

    filterCard.appendChild(el('hr'));
    filterCard.appendChild(el('div', { class: 'row', style: 'display:flex;gap:8px' },
      el('div', {},
        el('label', {}, 'Сортировка'),
        el('select', { onchange: e => { F.sortBy = e.target.value; saveF(); } }, ...[
          ['date_desc','По дате (новые)'], ['date_asc','По дате (старые)'],
          ['dist_asc','По дист. (ближние)'], ['dist_desc','По дист. (дальние)'],
          ['cart','По патрону'], ['range','По полигону'],
          ['offset_asc','По точности (лучшие)'], ['offset_desc','По точности (худшие)']
        ].map(([v,l]) => {
          const o = document.createElement('option');
          o.value = v; o.textContent = l;
          if (F.sortBy === v) o.selected = true;
          return o;
        }))),
      el('div', {},
        el('label', {}, 'Группировка'),
        el('select', { onchange: e => { F.groupBy = e.target.value; saveF(); } }, ...[
          ['none','Без'], ['cartridge','По патрону'], ['range','По полигону'], ['distance','По дист. (100м)']
        ].map(([v,l]) => {
          const o = document.createElement('option');
          o.value = v; o.textContent = l;
          if (F.groupBy === v) o.selected = true;
          return o;
        })))
    ));

    filterCard.appendChild(el('button', { type: 'button', class: 'btn ghost',
      onclick: () => { localStorage.removeItem('journal:F'); location.reload(); } }, 'Сбросить фильтры'));
  }

  // --- логика фильтрации/сортировки ---
  function applyFilters() {
    let res = hits.slice();
    if (F.rangeIds.length)     res = res.filter(h => F.rangeIds.includes(h.rangeId));
    if (F.cartridgeIds.length) res = res.filter(h => F.cartridgeIds.includes(h.cartridgeId));
    if (F.weaponIds.length)    res = res.filter(h => F.weaponIds.includes(h.weaponId));
    if (F.positionIds.length)  res = res.filter(h => F.positionIds.includes(h.positionId));
    if (F.tempMin != null) res = res.filter(h => (h.weather?.tempC ?? Infinity) >= F.tempMin);
    if (F.tempMax != null) res = res.filter(h => (h.weather?.tempC ?? -Infinity) <= F.tempMax);
    if (F.humMin != null)  res = res.filter(h => (h.weather?.humidity ?? Infinity) >= F.humMin);
    if (F.humMax != null)  res = res.filter(h => (h.weather?.humidity ?? -Infinity) <= F.humMax);
    if (F.windMin != null) res = res.filter(h => (h.windSpeed ?? Infinity) >= F.windMin);
    if (F.windMax != null) res = res.filter(h => (h.windSpeed ?? -Infinity) <= F.windMax);
    if (F.distMin != null) res = res.filter(h => (h.distance_m ?? Infinity) >= F.distMin);
    if (F.distMax != null) res = res.filter(h => (h.distance_m ?? -Infinity) <= F.distMax);
    if (F.dateFrom) res = res.filter(h => (h.date || '') >= F.dateFrom);
    if (F.dateTo)   res = res.filter(h => (h.date || '') <= F.dateTo + 'T23:59:59');
    if (F.hitOnly === 'hit')  res = res.filter(h => h.hit);
    if (F.hitOnly === 'miss') res = res.filter(h => !h.hit);

    const cmp = (a, b) => {
      switch (F.sortBy) {
        case 'date_desc':   return (b.date || '').localeCompare(a.date || '');
        case 'date_asc':    return (a.date || '').localeCompare(b.date || '');
        case 'dist_asc':    return (a.distance_m || 0) - (b.distance_m || 0);
        case 'dist_desc':   return (b.distance_m || 0) - (a.distance_m || 0);
        case 'cart':        return cartName(a.cartridgeId).localeCompare(cartName(b.cartridgeId));
        case 'range':       return rangeName(a.rangeId).localeCompare(rangeName(b.rangeId));
        case 'offset_asc':  return Math.abs(a.dropOffsetMil || 0) - Math.abs(b.dropOffsetMil || 0);
        case 'offset_desc': return Math.abs(b.dropOffsetMil || 0) - Math.abs(a.dropOffsetMil || 0);
        default: return 0;
      }
    };
    return res.sort(cmp);
  }

  // --- статистика ---
  function renderStats(arr) {
    statsCard.innerHTML = '';
    statsCard.appendChild(el('h2', {}, 'Сводка'));
    const total = arr.length;
    const withOffs = arr.filter(h => h.dropOffsetMil != null);
    const avgDrop  = withOffs.length ? withOffs.reduce((s,h)=>s+(h.dropOffsetMil||0),0)/withOffs.length : null;
    const avgDrift = withOffs.length ? withOffs.reduce((s,h)=>s+(h.driftOffsetMil||0),0)/withOffs.length : null;
    const hitCount = arr.filter(h => h.hit).length;
    const hitPct = total ? (hitCount/total*100) : 0;
    statsCard.appendChild(el('div', { class: 'kv' },
      el('div', { class: 'k' }, 'Найдено'), el('div', { class: 'v' }, total),
      el('div', { class: 'k' }, 'Попаданий'), el('div', { class: 'v' }, `${hitCount} (${fmt(hitPct,0)}%)`),
      el('div', { class: 'k' }, 'Ср. отклонение вертикаль'), el('div', { class: 'v' }, fmt(avgDrop,2) + ' mil'),
      el('div', { class: 'k' }, 'Ср. отклонение горизонталь'), el('div', { class: 'v' }, fmt(avgDrift,2) + ' mil')
    ));
    statsCard.appendChild(el('button', { type: 'button', class: 'btn ghost',
      onclick: () => exportCSV(arr) }, '⬇ Экспорт CSV'));
  }

  function exportCSV(arr) {
    const head = ['date','range','position','target','weapon','cartridge','distance_m','tempC','humidity','pressureMbar','windSpeed_mps','windDir_deg','clock','calcDropMil','actualDropMil','dropOffsetMil','calcDriftMil','actualDriftMil','driftOffsetMil','hit','notes'];
    const lines = [head.join(',')];
    for (const h of arr) {
      lines.push([
        h.date || '', rangeName(h.rangeId), posName(h.positionId), tgtName(h.targetId),
        wpnName(h.weaponId), cartName(h.cartridgeId), h.distance_m ?? '',
        h.weather?.tempC ?? '', h.weather?.humidity ?? '', h.weather?.pressureMbar ?? '',
        h.windSpeed ?? '', h.windDir ?? '', h.clock || '',
        h.calcDropMil ?? '', h.actualDropMil ?? '', h.dropOffsetMil ?? '',
        h.calcDriftMil ?? '', h.actualDriftMil ?? '', h.driftOffsetMil ?? '',
        h.hit ? '1' : '0', (h.notes || '').replace(/[\n,]/g,' ')
      ].map(v => typeof v === 'string' && v.includes(',') ? '"'+v+'"' : v).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'journal-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  // --- рендер результатов ---
  function renderResults(arr) {
    resultsEl.innerHTML = '';
    if (arr.length === 0) {
      resultsEl.appendChild(el('div', { class: 'banner' }, 'По заданным фильтрам ничего не найдено.'));
      return;
    }

    // группировка
    const groups = new Map();
    for (const h of arr) {
      let key = '';
      if (F.groupBy === 'cartridge') key = cartName(h.cartridgeId);
      else if (F.groupBy === 'range') key = rangeName(h.rangeId);
      else if (F.groupBy === 'distance') key = (Math.floor((h.distance_m||0)/100)*100) + '–' + (Math.floor((h.distance_m||0)/100)*100+99) + ' м';
      else key = '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(h);
    }

    for (const [key, items] of groups) {
      if (F.groupBy !== 'none') {
        resultsEl.appendChild(el('div', {
          style: 'margin:14px 0 8px;padding:6px 12px;background:var(--panel-2);border-radius:8px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent-2)'
        }, `${key} (${items.length})`));
      }
      for (const h of items) {
        const card = el('div', { class: 'list-item' });
        card.appendChild(el('div', { class: 'ttl' },
          `${rangeName(h.rangeId)} → ${tgtName(h.targetId)} · ${h.distance_m || '?'} м`,
          h.hit ? el('span', { style: 'color:var(--good);margin-left:8px' }, '✓') : null
        ));
        card.appendChild(el('div', { class: 'sub' },
          [
            cartName(h.cartridgeId),
            posName(h.positionId),
            h.weather?.tempC != null ? `${fmt(h.weather.tempC,0)}°C` : null,
            h.weather?.humidity != null ? `${fmt(h.weather.humidity,0)}%` : null,
            h.windSpeed != null ? `${fmt(h.windSpeed,1)} м/с ${h.clock || ''}` : null
          ].filter(Boolean).join(' · ')
        ));
        card.appendChild(el('div', { class: 'sub' },
          `расч. ${fmt(h.calcDropMil,2)}/${fmt(h.calcDriftMil,2)} · ` +
          `факт. ${fmt(h.actualDropMil,2)}/${fmt(h.actualDriftMil,2)} · ` +
          `Δ ${fmt(h.dropOffsetMil,2)}/${fmt(h.driftOffsetMil,2)} mil · ` +
          new Date(h.date).toLocaleDateString('ru')
        ));
        if (h.notes) card.appendChild(el('div', { class: 'sub', style: 'font-style:italic' }, h.notes));
        resultsEl.appendChild(card);
      }
    }
  }

  function render() {
    renderFilters();
    const arr = applyFilters();
    renderStats(arr);
    renderResults(arr);
  }
  render();
});

// ============== QUICK CALC ==============
route('/calc', async () => {
  setHeader({ title: 'Калькулятор' });
  const weapons = await Store.getAll('weapons');
  const cartridges = await Store.getAll('cartridges');
  const state = JSON.parse(localStorage.getItem('calc:last') || '{}');

  const form = el('form', { class: 'card' });

  // === Tabs row ===
  const ctrlTabs = el('div', { class: 'calc-ctrl-tabs' });
  form.appendChild(ctrlTabs);

  function makeSection(tabId) {
    return el('div', { class: 'form-section', 'data-tab': tabId });
  }

  // === БЫСТРО — то что чаще меняется на стрельбище ===
  const secQuick = makeSection('quick');
  secQuick.appendChild(el('div', { class: 'row' },
    numInput('v0', 'V₀, м/с', state.v0 ?? 830),
    numInput('azimuth_deg', 'Азимут цели, °', state.azimuth_deg ?? 0)
  ));
  secQuick.appendChild(el('div', { class: 'row' },
    numInputWithSources('windSpeed', 'Ветер, м/с', state.windSpeed ?? 0,
      [srcOpenMeteo('windSpeed', 1), srcKestrel('windSpeed', 1)]),
    numInputWithSources('windAngle_deg', 'Угол ветра, °', state.windAngle_deg ?? 90,
      [srcOpenMeteo('windDir', 0), srcKestrel('windDir', 0)])
  ));
  form.appendChild(secQuick);

  // === ПУЛЯ ===
  const secBullet = makeSection('bullet');
  secBullet.appendChild(selectInput('weaponId', 'Оружие', state.weaponId,
    [{ value: '', label: '— вручную —' }, ...weapons.map(w => ({ value: w.id, label: w.name }))]));
  secBullet.appendChild(selectInput('cartridgeId', 'Патрон', state.cartridgeId,
    [{ value: '', label: '— вручную —' }, ...cartridges.map(c => ({ value: c.id, label: c.name }))]));
  secBullet.appendChild(el('div', { class: 'row' },
    numInput('bc', 'BC (lb/in²)', state.bc ?? 0.45),
    selectInput('dragModel', 'Модель', state.dragModel || 'G1', [{value:'G1',label:'G1'},{value:'G7',label:'G7'}])
  ));
  secBullet.appendChild(el('div', { class: 'row' },
    numInput('bulletMass_gr', 'Масса, gr', state.bulletMass_gr ?? 175),
    numInput('sightHeight_mm', 'Высота прицела, мм', state.sightHeight_mm ?? 50)
  ));
  secBullet.appendChild(numInput('zeroDistance', 'Пристрелка, м', state.zeroDistance ?? 100));
  form.appendChild(secBullet);

  // === АТМОСФЕРА ===
  const secAtmo = makeSection('atmo');
  secAtmo.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-bottom:6px' },
    '🌐 Open-Meteo · 📱 датчик · 📡 Kestrel'));
  secAtmo.appendChild(el('div', { class: 'row' },
    numInputWithSources('tempC', 'Темп., °C', state.tempC ?? 15,
      [srcOpenMeteo('tempC', 1), srcKestrel('tempC', 1)]),
    numInputWithSources('pressureMbar', 'Давл., гПа', state.pressureMbar ?? 1013,
      [srcOpenMeteo('pressureMbar', 0), srcPhoneBaro(), srcKestrel('pressureMbar', 0)])
  ));
  secAtmo.appendChild(el('div', { class: 'row' },
    numInputWithSources('humidity', 'Влажн., %', state.humidity ?? 50,
      [srcOpenMeteo('humidity', 0), srcKestrel('humidity', 0)]),
    numInput('shotAngle_deg', 'Угол места, °', state.shotAngle_deg ?? 0)
  ));
  secAtmo.appendChild(el('div', { class: 'row' },
    numInputWithSources('cant_deg', 'Завал, °', state.cant_deg ?? 0, [srcCompass()]),
    numInput('ammoTempC', 'Темп. боеприп., °C', state.ammoTempC)
  ));
  secAtmo.appendChild(numInputWithSources('latitude_deg', 'Широта (Кориолис), °', state.latitude_deg ?? 55,
    [srcGPSLat()]));
  form.appendChild(secAtmo);

  // === ПРОЧЕЕ ===
  const secMisc = makeSection('misc');
  secMisc.appendChild(el('div', { class: 'banner' }, 'Ветер 2 — для расчёта при порывах.'));
  secMisc.appendChild(el('div', { class: 'row' },
    numInput('windSpeed2', 'Ветер 2, м/с', state.windSpeed2 ?? 0),
    numInput('windAngle_deg2', 'Угол ветра 2, °', state.windAngle_deg2 ?? 90)
  ));
  secMisc.appendChild(textInput('distances', 'Дистанции для таблицы (через запятую, м)',
    state.distances || '100, 200, 300, 400, 500, 600, 800, 1000'));
  form.appendChild(secMisc);

  // === Заполнение tab-bar ===
  const tabs = [
    { id: 'quick',  label: '⚡ Быстро' },
    { id: 'bullet', label: '🔫 Пуля' },
    { id: 'atmo',   label: '🌡 Атмо' },
    { id: 'misc',   label: '⚙ Прочее' }
  ];
  let activeCtrlTab = state.activeCtrlTab || 'quick';
  function showCtrlTab(id) {
    activeCtrlTab = id;
    state.activeCtrlTab = id;
    form.querySelectorAll('.form-section').forEach(sec => {
      sec.hidden = sec.dataset.tab !== id;
    });
    [...ctrlTabs.children].forEach(ch => ch.classList.toggle('active', ch.dataset.tab === id));
  }
  for (const t of tabs) {
    ctrlTabs.appendChild(el('div', { class: 'chip', 'data-tab': t.id,
      onclick: () => showCtrlTab(t.id) }, t.label));
  }
  showCtrlTab(activeCtrlTab);

  form.weaponId.addEventListener('change', () => {
    const w = weapons.find(x => x.id === form.weaponId.value);
    if (w) {
      form.sightHeight_mm.value = w.sightHeight_mm ?? form.sightHeight_mm.value;
      form.zeroDistance.value = w.zeroDistance ?? form.zeroDistance.value;
    }
  });
  form.cartridgeId.addEventListener('change', () => {
    const c = cartridges.find(x => x.id === form.cartridgeId.value);
    if (c) {
      form.bc.value = effectiveBC(c);
      form.dragModel.value = effectiveDragModel(c) === 'CUSTOM' ? (c.dragModel || 'G1') : (c.dragModel || 'G1');
      form.v0.value = c.v0 ?? form.v0.value;
      form.bulletMass_gr.value = c.bulletMass_gr ?? form.bulletMass_gr.value;
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(form);
    localStorage.setItem('calc:last', JSON.stringify(d));
    const distances = (d.distances || '').split(/[,\s]+/).map(s=>parseFloat(s)).filter(x=>x>0);
    flashZeroReminder(distances.join('|'));
    const c = cartridges.find(x => x.id === d.cartridgeId);
    const w = weapons.find(x => x.id === d.weaponId);
    const rezeroed = c ? await ensureScopeChoice(c) : true;
    const ammoT_calc = d.ammoTempC ?? d.tempC;
    const v0FromTable_calc = v0FromMvTable(c, ammoT_calc);
    const useTable_calc = v0FromTable_calc != null;
    const input = {
      bc: d.bc, dragModel: (c && effectiveDragModel(c) === 'CUSTOM') ? 'CUSTOM' : d.dragModel,
      customDrag: c?.customDrag || null,
      v0: useTable_calc ? v0FromTable_calc : d.v0,
      bulletMass_gr: d.bulletMass_gr,
      bulletLength_in: c?.bulletLength_in, caliber_in: c?.caliber_in,
      twist_in: w?.twist_in, twistRight: w ? (w.twistRight !== false) : true,
      cant_deg: d.cant_deg, ammoTempC: ammoT_calc,
      v0_baseTempC: useTable_calc ? ammoT_calc : c?.v0_baseTempC,
      v0_tempSens_mps_per_C: useTable_calc ? 0 : c?.v0_tempSens_mps_per_C,
      truingPoints: c?.truingPoints || null,
      sightHeight: (d.sightHeight_mm || 50) / 1000,
      zeroDistance: d.zeroDistance, targetDistance: Math.max(...distances, 1000),
      tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: d.humidity,
      windSpeed: d.windSpeed, windAngle_deg: d.windAngle_deg, shotAngle_deg: d.shotAngle_deg,
      latitude_deg: d.latitude_deg, azimuth_deg: d.azimuth_deg,
      steps: distances
    };
    const res = Ballistics.solve(input);
    const out = $('#result');
    out.innerHTML = '';
    out.appendChild(el('hr'));
    // применяем сдвиг ко всем строкам
    for (const row of res.rows) if (c) applyCartridgeOffset(row, c, rezeroed);

    // плашка о применённом сдвиге, если есть
    if (c && !c.isBase && !rezeroed && (c.offsetVertMil || c.offsetHorizMil)) {
      out.appendChild(el('div', { class: 'info-card' },
        el('div', { class: 'label' }, 'Прицел нулями базового патрона'),
        el('div', { class: 'muted center' },
          `К поправкам добавлен сдвиг: V ${fmt(-(c.offsetVertMil||0),2)} mil, H ${fmt(-(c.offsetHorizMil||0),2)} mil`)));
    }

    // — БОЛЬШАЯ карточка решения (AB Quantum-style: live ± stepper + стрелки направления) —
    const lastBig = parseFloat(localStorage.getItem('calc:bigDist')) || res.rows[Math.floor(res.rows.length / 2)].range;
    let bigDist = res.rows.find(r => r.range === lastBig)?.range ?? res.rows[0].range;
    const lastStep = parseFloat(localStorage.getItem('calc:bigStep')) || 50;
    let stepSize = lastStep;
    const solCard = el('div', { class: 'solution-card' });
    const distLabel = el('div', { class: 'dist-pick' }, '');
    const mainGrid = el('div', { class: 'main-values' });
    const stepperRow = el('div', { class: 'range-stepper' });
    const spotBtn = el('button', { type: 'button', class: 'spot-btn',
      onclick: () => {
        const row = res.rows.find(r => r.range === bigDist) || res.rows[0];
        if (row) openSpottingSheet(row.drop_mil, row.drift_mil, bigDist);
      } }, '🎯 Промах — пересчитать поправку');
    solCard.appendChild(distLabel);
    solCard.appendChild(mainGrid);
    solCard.appendChild(stepperRow);
    solCard.appendChild(spotBtn);
    out.appendChild(solCard);

    // живой single-distance solve (быстрее чем full table)
    function solveAt(dist, useW2 = false) {
      const inp = { ...input, steps: [dist], targetDistance: Math.max(dist, input.zeroDistance || 100) };
      if (useW2) {
        inp.windSpeed = d.windSpeed2 || 0;
        inp.windAngle_deg = d.windAngle_deg2 ?? 90;
      }
      const r2 = Ballistics.solve(inp);
      const row = r2.rows[0];
      if (row && c) applyCartridgeOffset(row, c, rezeroed);
      return row;
    }
    function dirArrow(value, axis) {
      // axis='v': положит. = подкрутить ВВЕРХ → ▲; отриц. = ▼
      // axis='h': положит. = подкрутить ВПРАВО → ►; отриц. = ◄
      const v = Number(value) || 0;
      const eps = 0.005;
      if (axis === 'v') return Math.abs(v) < eps ? '·' : (v > 0 ? '▲' : '▼');
      return Math.abs(v) < eps ? '·' : (v > 0 ? '►' : '◄');
    }

    function renderBig() {
      const row = solveAt(bigDist);
      if (!row) return;
      const w2Active = (d.windSpeed2 || 0) > 0;
      const row2 = w2Active ? solveAt(bigDist, true) : null;
      distLabel.textContent = `ДИСТАНЦИЯ ${bigDist} м`;
      mainGrid.innerHTML = '';
      mainGrid.classList.toggle('has-w2', w2Active);

      const dropAxis = el('div', { class: 'axis' });
      dropAxis.appendChild(el('div', { class: 'lbl' }, 'Вертикаль'));
      const dropVal = el('div', { class: 'val' });
      dropVal.appendChild(el('span', { class: 'dir-arrow' }, dirArrow(row.drop_mil, 'v')));
      dropVal.appendChild(document.createTextNode(fmt(Math.abs(row.drop_mil), 2)));
      dropVal.appendChild(el('span', { class: 'unit' }, 'mil'));
      dropAxis.appendChild(dropVal);
      dropAxis.appendChild(el('div', { class: 'sub-val' }, `${fmt(Math.abs(row.drop_moa), 1)} MOA · ${fmt(Math.abs(row.drop_m) * 100, 0)} см`));
      mainGrid.appendChild(dropAxis);

      const driftAxis = el('div', { class: 'axis' });
      driftAxis.appendChild(el('div', { class: 'lbl' }, w2Active ? 'Гор. W1' : 'Горизонталь'));
      const drVal = el('div', { class: 'val' });
      drVal.appendChild(el('span', { class: 'dir-arrow' }, dirArrow(row.drift_mil, 'h')));
      drVal.appendChild(document.createTextNode(fmt(Math.abs(row.drift_mil), 2)));
      drVal.appendChild(el('span', { class: 'unit' }, 'mil'));
      driftAxis.appendChild(drVal);
      driftAxis.appendChild(el('div', { class: 'sub-val' }, `${fmt(Math.abs(row.drift_moa), 1)} MOA · ${fmt(Math.abs(row.drift_m) * 100, 0)} см`));
      mainGrid.appendChild(driftAxis);

      if (w2Active && row2) {
        const driftAxis2 = el('div', { class: 'axis axis-w2' });
        driftAxis2.appendChild(el('div', { class: 'lbl' }, 'Гор. W2'));
        const drVal2 = el('div', { class: 'val' });
        drVal2.appendChild(el('span', { class: 'dir-arrow' }, dirArrow(row2.drift_mil, 'h')));
        drVal2.appendChild(document.createTextNode(fmt(Math.abs(row2.drift_mil), 2)));
        drVal2.appendChild(el('span', { class: 'unit' }, 'mil'));
        driftAxis2.appendChild(drVal2);
        driftAxis2.appendChild(el('div', { class: 'sub-val' }, `${fmt(Math.abs(row2.drift_moa), 1)} MOA · ${fmt(Math.abs(row2.drift_m) * 100, 0)} см`));
        mainGrid.appendChild(driftAxis2);
      }
    }

    // — Дистанция: тап → очищается + цифровая клавиатура. Отмена → старое значение —
    function renderDistanceEditor() {
      stepperRow.innerHTML = '';
      let savedDist = bigDist;
      const inp = el('input', {
        class: 'range-input',
        type: 'number', inputmode: 'numeric', pattern: '[0-9]*',
        value: bigDist
      });
      const unit = el('span', { class: 'range-unit' }, 'м');
      const cancelBtn = el('button', { type: 'button', class: 'range-cancel', hidden: true }, 'Отмена');

      inp.addEventListener('focus', () => {
        savedDist = bigDist;
        inp.value = '';
        cancelBtn.hidden = false;
      });
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (isFinite(v) && v > 0) {
          bigDist = v;
          localStorage.setItem('calc:bigDist', String(bigDist));
          renderBig();
        }
      });
      inp.addEventListener('blur', () => {
        // если поле пустое или невалидное — вернём saved
        const v = parseFloat(inp.value);
        if (!isFinite(v) || v <= 0) {
          bigDist = savedDist;
          inp.value = bigDist;
          renderBig();
        } else if (v !== savedDist) {
          flashZeroReminder(bigDist);
        }
        cancelBtn.hidden = true;
      });
      cancelBtn.addEventListener('mousedown', e => e.preventDefault()); // не теряем фокус до click
      cancelBtn.addEventListener('click', () => {
        bigDist = savedDist;
        inp.value = bigDist;
        localStorage.setItem('calc:bigDist', String(bigDist));
        renderBig();
        cancelBtn.hidden = true;
        inp.blur();
      });

      stepperRow.appendChild(inp);
      stepperRow.appendChild(unit);
      stepperRow.appendChild(cancelBtn);
    }
    renderDistanceEditor();
    renderBig();

    // — параметры мелким kv —
    const DA_ft = Ballistics.densityAltitude_ft({tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: d.humidity});
    const rowAt = res.rows.find(r => r.range === bigDist) || res.rows[0];
    const massGr = d.bulletMass_gr || c?.bulletMass_gr;
    const calIn  = c?.caliber_in;
    const E_J  = massGr ? Ballistics.kineticEnergyJ(massGr, rowAt.vel_mps) : null;
    const E_fl = massGr ? Ballistics.kineticEnergyFtLb(massGr, rowAt.vel_mps) : null;
    const TKO  = (massGr && calIn) ? Ballistics.taylorKO(massGr, rowAt.vel_mps, calIn) : null;
    const paramCard = el('div', { class: 'card' });
    paramCard.appendChild(el('h2', {}, 'Атмосфера и баллистика'));
    const kvParams = el('div', { class: 'kv' },
      el('div', { class: 'k' }, 'V на цели'),
      el('div', { class: 'v' }, fmt(rowAt.vel_mps, 0) + ' м/с'),
      el('div', { class: 'k' }, 'Время полёта'),
      el('div', { class: 'v' }, fmt(rowAt.tof_s, 2) + ' с'),
      el('div', { class: 'k' }, 'Плотность воздуха'), el('div', { class: 'v' }, fmt(res.airDensity,3) + ' кг/м³'),
      el('div', { class: 'k' }, 'Density Altitude'), el('div', { class: 'v' }, fmt(DA_ft,0) + ' ft'),
      el('div', { class: 'k' }, 'Скорость звука'), el('div', { class: 'v' }, fmt(res.speedOfSound,1) + ' м/с'),
      el('div', { class: 'k' }, 'Угол бросания'), el('div', { class: 'v' }, fmt(res.launchAngle_deg,3) + '°')
    );
    if (E_J != null) {
      kvParams.appendChild(el('div', { class: 'k' }, 'Энергия'));
      kvParams.appendChild(el('div', { class: 'v' }, `${fmt(E_J,0)} Дж · ${fmt(E_fl,0)} ft·lb`));
    }
    if (TKO != null) {
      kvParams.appendChild(el('div', { class: 'k' }, 'Taylor KO'));
      kvParams.appendChild(el('div', { class: 'v' }, fmt(TKO, 1)));
    }
    paramCard.appendChild(kvParams);
    out.appendChild(paramCard);

    // — табы «Поправки | Прицел» —
    const reticle = w?.reticleId ? await Store.get('reticles', w.reticleId) : null;
    const tabsRow = el('div', { class: 'chips', style: 'margin:10px 0' });
    const tabBody = el('div');
    let activeTab = 'table';
    function renderActive() {
      tabBody.innerHTML = '';
      [...tabsRow.children].forEach(ch => ch.classList.toggle('active', ch.dataset.tab === activeTab));
      if (activeTab === 'table') {
        const t = el('table', { class: 'table' });
        t.appendChild(h(`<thead><tr><th>Дист.</th><th>Верт. mil</th><th>MOA</th><th>Гор. mil</th><th>V, м/с</th><th>t, с</th></tr></thead>`));
        const tb = el('tbody');
        for (const row of res.rows) {
          tb.appendChild(h(`<tr>
            <td>${row.range}</td>
            <td class="accent">${fmt(row.drop_mil,2)}</td>
            <td>${fmt(row.drop_moa,1)}</td>
            <td class="accent">${fmt(row.drift_mil,2)}</td>
            <td>${fmt(row.vel_mps,0)}</td>
            <td>${fmt(row.tof_s,2)}</td>
          </tr>`));
        }
        t.appendChild(tb);
        tabBody.appendChild(el('div', { style: 'overflow-x:auto' }, t));
      } else {
        tabBody.appendChild(renderReticleViewer(reticle, res.rows));
      }
    }
    const tabT = el('div', { class: 'chip active', 'data-tab': 'table',
      onclick: () => { activeTab = 'table'; renderActive(); }}, 'Все дистанции');
    const tabR = el('div', { class: 'chip', 'data-tab': 'reticle',
      onclick: () => { activeTab = 'reticle'; renderActive(); }}, 'Прицел');
    tabsRow.appendChild(tabT); tabsRow.appendChild(tabR);
    out.appendChild(tabsRow);
    out.appendChild(tabBody);
    renderActive();
  });

  // === HUD area (sticky сверху, всегда видна) ===
  const hudArea = el('div', { class: 'calc-hud-area' });
  const incBanner = el('button', { type: 'button', class: 'incl-banner', hidden: true });
  hudArea.appendChild(incBanner);
  hudArea.appendChild(el('div', { id: 'result' }));
  view.appendChild(hudArea);
  view.appendChild(el('div', { class: 'calc-hint' }, '↓ изменяй параметры — пересчёт мгновенный'));
  view.appendChild(form);

  // === Inclination live-warning ===
  // Подписка на Compass. Если |measured| > 3° или |measured - input| > 1° — баннер.
  // Tap по баннеру → копируем measured в инпут (live-recalc сработает).
  const INC_THRESHOLD_ABS = 3;     // ° — «винтовка наклонена»
  const INC_THRESHOLD_DIFF = 1;    // ° — расхождение с инпутом
  let lastMeasuredCant = null;
  function refreshIncBanner() {
    const m = lastMeasuredCant;
    const inp = form.cant_deg;
    const inputVal = inp ? parseFloat(inp.value) || 0 : 0;
    if (m == null || !isFinite(m)) { incBanner.hidden = true; return; }
    const big = Math.abs(m) > INC_THRESHOLD_ABS;
    const diff = Math.abs(m - inputVal) > INC_THRESHOLD_DIFF;
    if (!big && !diff) { incBanner.hidden = true; return; }
    incBanner.hidden = false;
    incBanner.textContent =
      `⚠ Завал по компасу ${m.toFixed(1)}° (введено ${inputVal.toFixed(1)}°) — тапни чтобы синхронизировать`;
  }
  incBanner.addEventListener('click', () => {
    const m = lastMeasuredCant;
    if (m == null || !isFinite(m)) return;
    form.cant_deg.value = m.toFixed(1);
    form.cant_deg.dispatchEvent(new Event('input', { bubbles: true }));
    incBanner.hidden = true;
  });
  const unsubCompass = Compass.subscribe(st => {
    lastMeasuredCant = (st && isFinite(st.cant)) ? st.cant : null;
    refreshIncBanner();
  });
  // обновлять баннер при ручном изменении инпута тоже
  form.addEventListener('input', e => { if (e.target && e.target.name === 'cant_deg') refreshIncBanner(); });
  // пассивный запуск компаса (без gesture-permission, т.е. только на Android-WebView)
  if (Compass.supported() && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    Compass.start().catch(() => {});
  }
  // отписка при уходе с роута
  const cleanup = () => { try { unsubCompass(); } catch {} window.removeEventListener('hashchange', cleanup); };
  window.addEventListener('hashchange', cleanup);

  // Live-recalc: любое изменение в форме перезапускает submit (debounced).
  let recalcTimer = null;
  function scheduleRecalc() {
    clearTimeout(recalcTimer);
    recalcTimer = setTimeout(() => form.dispatchEvent(new Event('submit')), 120);
  }
  form.addEventListener('input', scheduleRecalc);
  form.addEventListener('change', scheduleRecalc);

  // первый прогон — всегда (а не только если state.bc заполнен)
  form.dispatchEvent(new Event('submit'));
});

// ============== WEAPONS / CARTRIDGES ==============
route('/weapons', async () => {
  setHeader({ title: 'Оружие' });
  const items = await Store.getAll('weapons');
  if (items.length === 0) view.appendChild(el('div', { class: 'banner' }, 'Создай первый профиль оружия.'));
  for (const w of items) {
    view.appendChild(el('a', { class: 'list-item', href: '#/weapon/' + w.id },
      el('div', { class: 'ttl' }, w.name || 'Без названия'),
      el('div', { class: 'sub' }, [w.caliber, 'h. прицела ' + (w.sightHeight_mm||50) + ' мм', 'ноль ' + (w.zeroDistance||100) + ' м'].filter(Boolean).join(' · '))
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/weapon/new' }, '+'));
});
route('/weapon/:id', async ({ id }) => {
  const isNew = id === 'new';
  const w = isNew ? { id: Store.uid(), sightHeight_mm: 50, zeroDistance: 100 } : await Store.get('weapons', id);
  if (!w) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новое оружие' : (w.name || 'Оружие') });
  const reticles = await Store.getAll('reticles');
  const f = el('form', { class: 'card' });
  f.appendChild(textInput('name', 'Название', w.name, { required: true }));
  f.appendChild(el('div', { class: 'row' },
    textInput('caliber', 'Калибр', w.caliber, { placeholder: '.308 Win' }),
    textInput('action', 'Тип', w.action, { placeholder: 'болт' })
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('sightHeight_mm', 'Высота прицела, мм', w.sightHeight_mm),
    numInput('zeroDistance', 'Дистанция нуля, м', w.zeroDistance)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('twist_in', 'Твист, in', w.twist_in),
    selectInput('twistRight', 'Направление нарезов', w.twistRight === false ? 'false' : 'true',
      [{ value: 'true', label: 'Правое (RH)' }, { value: 'false', label: 'Левое (LH)' }])
  ));
  f.appendChild(numInput('barrelLength_mm', 'Длина ствола, мм', w.barrelLength_mm));
  // — сетка прицела —
  f.appendChild(selectInput('reticleId', 'Сетка прицела', w.reticleId || '',
    [{ value: '', label: '— не выбрана —' }, ...reticles.map(r => ({ value: r.id, label: r.name }))]));
  if (reticles.length === 0) {
    f.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:-6px' },
      'Создай сетку в разделе «Сетки прицелов»: загрузи фото своей сетки и откалибруй по двум точкам.'));
  }
  // — Cold Bore Adjustment (первый «холодный» выстрел) —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Cold Bore Adjustment'));
  f.appendChild(el('div', { class: 'banner' },
    'Поправка для первого выстрела из холодного ствола. Если знаешь, куда «уходит» первый выстрел — внеси сюда в mil. Будет применяться только к первому расчёту в сессии.'));
  f.appendChild(el('div', { class: 'row' },
    numInput('cba_vert_mil', 'Вертикаль, mil (+ вверх)', w.cba_vert_mil ?? 0, { step: '0.05' }),
    numInput('cba_horiz_mil', 'Горизонталь, mil (+ вправо)', w.cba_horiz_mil ?? 0, { step: '0.05' })
  ));

  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сохранить'));
  if (!isNew) f.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
    if (confirm('Удалить?')) { await Store.del('weapons', id); location.hash = '#/weapons'; }
  }}, 'Удалить'));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(f);
    d.twistRight = d.twistRight !== 'false';
    await Store.put('weapons', { ...w, ...d });
    toast('Сохранено'); location.hash = '#/weapons';
  });
  view.appendChild(f);
});

route('/cartridges', async () => {
  setHeader({ title: 'Патроны' });
  const items = await Store.getAll('cartridges');
  if (items.length === 0) view.appendChild(el('div', { class: 'banner' }, 'Создай первый профиль патрона.'));
  for (const c of items) {
    view.appendChild(el('a', { class: 'list-item', href: '#/cartridge/' + c.id },
      el('div', { class: 'ttl' }, c.name || 'Без названия'),
      el('div', { class: 'sub' }, `BC ${c.bc} ${c.dragModel || 'G1'} · V₀ ${c.v0} м/с · ${c.bulletMass_gr || '?'} gr`)
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/cartridge/new' }, '+'));
});
route('/cartridge/:id', async ({ id }) => {
  const isNew = id === 'new';
  const c = isNew ? { id: Store.uid(), dragModel: 'G1' } : await Store.get('cartridges', id);
  if (!c) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новый патрон' : (c.name || 'Патрон') });
  const allCartridges = await Store.getAll('cartridges');
  const f = el('form', { class: 'card' });
  f.appendChild(textInput('name', 'Название', c.name, { required: true }));
  f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => openBulletLibrarySheet(b => {
    f.name.value = b.name;
    f.bc.value = b.bcG7;
    f.dragModel.value = 'G7';
    f.bulletMass_gr.value = b.mass_gr;
    f.bulletLength_in.value = b.len_in;
    f.caliber_in.value = b.caliber_in;
    toast('Заполнено: ' + b.name);
  })}, '📚 Выбрать из библиотеки'));
  f.appendChild(el('div', { class: 'row' },
    numInput('bc', 'BC (lb/in²)', c.bc),
    selectInput('dragModel', 'Модель', c.dragModel || 'G1', [{value:'G1',label:'G1'},{value:'G7',label:'G7'}])
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('v0', 'V₀, м/с', c.v0),
    numInput('bulletMass_gr', 'Масса, gr', c.bulletMass_gr)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('bulletLength_in', 'Длина пули, in', c.bulletLength_in),
    numInput('caliber_in', 'Калибр, in', c.caliber_in)
  ));

  // — Базовый патрон и сдвиг —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Базовый патрон и сдвиг'));
  f.appendChild(el('div', { class: 'banner' },
    'Базовый патрон — тот, под который пристрелян прицел. Для остальных укажи фактический сдвиг от базового нуля. При расчёте приложение спросит: «Прицел обнулён?» — если нет, добавит этот сдвиг к поправкам.'));
  f.appendChild(el('label', { class: 'checkbox' },
    el('input', { type: 'checkbox', name: 'isBase', checked: c.isBase ? true : undefined }),
    el('span', { class: 'lbl' }, 'Это базовый патрон',
      el('span', { class: 'sub' }, 'Прицел пристрелян именно под него'))
  ));
  const others = allCartridges.filter(x => x.id !== c.id);
  f.appendChild(selectInput('baseCartridgeId', 'Сдвиг отсчитывается от', c.baseCartridgeId || '',
    [{ value: '', label: '— нет, этот патрон базовый —' },
     ...others.map(x => ({ value: x.id, label: x.name + (x.isBase ? ' (базовый)' : '') }))]));
  f.appendChild(el('div', { class: 'row' },
    numInput('offsetVertMil', 'Сдвиг по вертикали, mil (+вверх)', c.offsetVertMil ?? 0, { step: '0.05' }),
    numInput('offsetHorizMil', 'Сдвиг по горизонтали, mil (+вправо)', c.offsetHorizMil ?? 0, { step: '0.05' })
  ));

  // — Хронограф: серия скоростей → ES/SD/SD% —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Хронограф: ES / SD / SD%'));
  f.appendChild(el('div', { class: 'banner' },
    'Вставь серию замеров V₀ (м/с) — через перенос строки или запятую. Приложение посчитает среднее, SD, ES и SD%. Целевые показатели: SD < 3.5 м/с, SD% < 0.5%.'));
  const chronoInitial = (c.chronoVelocities || []).join('\n');
  const chronoTA = el('textarea', { id: 'chronoVelocitiesText', name: 'chronoVelocitiesText',
    placeholder: '820\n822\n819\n821\n823' }, chronoInitial);
  f.appendChild(el('label', { for: 'chronoVelocitiesText' }, 'Скорости, м/с'));
  f.appendChild(chronoTA);
  const chronoStatsBox = el('div', { class: 'kv', style: 'margin-top:8px;font-size:13px' });
  f.appendChild(chronoStatsBox);
  function recalcChrono() {
    const vels = (chronoTA.value || '').split(/[,\s\n]+/).map(s => parseFloat(s)).filter(v => isFinite(v) && v > 0);
    chronoStatsBox.innerHTML = '';
    if (vels.length < 2) {
      chronoStatsBox.appendChild(el('div', { class: 'k' }, 'Замеров'));
      chronoStatsBox.appendChild(el('div', { class: 'v muted' }, vels.length + ' (нужно ≥2)'));
      return;
    }
    const st = Ballistics.chronoStats(vels);
    const color = st.sdPct < 0.5 ? 'var(--good)' : st.sdPct < 0.8 ? 'var(--accent)' : 'var(--bad)';
    chronoStatsBox.appendChild(el('div', { class: 'k' }, 'N'));
    chronoStatsBox.appendChild(el('div', { class: 'v' }, String(st.n)));
    chronoStatsBox.appendChild(el('div', { class: 'k' }, 'Avg'));
    chronoStatsBox.appendChild(el('div', { class: 'v' }, fmt(st.avg,1) + ' м/с'));
    chronoStatsBox.appendChild(el('div', { class: 'k' }, 'SD'));
    chronoStatsBox.appendChild(el('div', { class: 'v' }, fmt(st.sd,2) + ' м/с'));
    chronoStatsBox.appendChild(el('div', { class: 'k' }, 'ES'));
    chronoStatsBox.appendChild(el('div', { class: 'v' }, fmt(st.es,1) + ' м/с'));
    chronoStatsBox.appendChild(el('div', { class: 'k' }, 'SD%'));
    chronoStatsBox.appendChild(el('div', { class: 'v', style: 'color:' + color }, fmt(st.sdPct,2) + ' %'));
    chronoStatsBox.appendChild(el('div', { class: 'k' }, 'Min – Max'));
    chronoStatsBox.appendChild(el('div', { class: 'v' }, fmt(st.min,1) + ' – ' + fmt(st.max,1)));
  }
  chronoTA.addEventListener('input', recalcChrono);
  recalcChrono();
  f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
    const vels = (chronoTA.value || '').split(/[,\s\n]+/).map(s => parseFloat(s)).filter(v => isFinite(v) && v > 0);
    if (vels.length < 2) { toast('Нужно ≥2 значений'); return; }
    const st = Ballistics.chronoStats(vels);
    f.v0.value = st.avg.toFixed(1);
    toast('V₀ ← ' + st.avg.toFixed(1) + ' м/с (avg)');
  }}, 'Avg → V₀'));

  // — Powder temperature sensitivity —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Темп. чувствительность пороха'));
  f.appendChild(el('div', { class: 'banner' },
    'Если V₀ указан при определённой температуре пороха, укажи её и коэффициент чувствительности. Типично: 0.3–0.7 м/с на °C для одноосновных порохов, 0.05–0.2 для термостабильных (Hodgdon Extreme).'));
  f.appendChild(el('div', { class: 'row' },
    numInput('v0_baseTempC', 'Базовая темп. для V₀, °C', c.v0_baseTempC ?? 21),
    numInput('v0_tempSens_mps_per_C', 'Чувствит., м/с / °C', c.v0_tempSens_mps_per_C ?? 0)
  ));
  // — MV Temp Table (альтернатива линейному коэф.) —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'MV Temp Table (опц., приоритет над линейным коэф.)'));
  f.appendChild(el('div', { class: 'banner' },
    'Таблица «температура °C, V₀ м/с» по строкам — если задана (≥2 точки), при расчёте V₀ берётся интерполяцией по ammoTempC, а линейный коэф. выше игнорируется.'));
  f.appendChild(el('label', { for: 'mvTempText' }, 'Точки: «°C, V₀»'));
  const mvInitial = (c.mvTempTable || []).map(p => `${p.tempC}, ${p.v0}`).join('\n');
  f.appendChild(el('textarea', { id: 'mvTempText', name: 'mvTempText',
    placeholder: '-10, 805\n0, 815\n15, 828\n30, 840' }, mvInitial));

  // — Custom drag (CDM) —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Пользовательская drag-таблица (опц.)'));
  f.appendChild(el('div', { class: 'banner' },
    'Если у тебя есть измеренная Cd(Mach) для этой пули из радарных данных, введи пары «Mach,Cd» через перенос строки. Если поле пустое — используется стандартная G1/G7.'));
  f.appendChild(el('label', { for: 'customDragText' }, 'Mach, Cd по строкам'));
  const cdmInitial = (c.customDrag || []).map(p => p.join(',')).join('\n');
  f.appendChild(el('textarea', { id: 'customDragText', name: 'customDragText',
    placeholder: '0.5, 0.119\n1.0, 0.380\n1.5, 0.344\n2.0, 0.298' }, cdmInitial));

  // — Multi-point Truing (BC banding) —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Калибровка BC по DOPE (Litz banding)'));
  f.appendChild(el('div', { class: 'banner' },
    'Добавляй точки на разных дистанциях — solver интерполирует BC по Mach. Литц рекомендует ≥3 точки от ближней (полный сверхзвук) до дальней (трансзвук).'));
  const pts = (c.truingPoints || []).slice().sort((a, b) => b.machAt - a.machAt);
  if (pts.length) {
    const tbl = el('table', { class: 'table' });
    tbl.appendChild(h(`<thead><tr><th>Mach</th><th>BC×</th><th>Дист., м</th><th>факт. mil</th><th></th></tr></thead>`));
    const tb = el('tbody');
    pts.forEach((p, i) => {
      const tr = el('tr');
      tr.appendChild(h(`<td>${fmt(p.machAt, 2)}</td>`));
      tr.appendChild(h(`<td class="accent">${fmt(p.bcFactor, 3)}</td>`));
      tr.appendChild(h(`<td>${p.range_m ?? '—'}</td>`));
      tr.appendChild(h(`<td>${fmt(p.observedDropMil, 2)}</td>`));
      tr.appendChild(el('td', {}, el('span', { style: 'cursor:pointer;color:var(--bad)', onclick: async () => {
        if (confirm('Удалить точку?')) {
          const np = (c.truingPoints || []).filter(x => x !== p);
          await Store.put('cartridges', { ...c, truingPoints: np });
          navigate();
        }
      }}, '×')));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    f.appendChild(el('div', { style: 'overflow-x:auto' }, tbl));
  } else if (c.truedBC) {
    // backward compat: legacy single-point
    f.appendChild(el('div', { class: 'banner accent' },
      `Старая single-point калибровка: BC ${fmt(c.truedBC,3)} на ${c.truedAt} м. Можешь добавить новые точки или сбросить.`));
    f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (confirm('Сбросить старую калибровку?')) {
        await Store.put('cartridges', { ...c, truedBC: null, truedAt: null, truedObservedMil: null, truedNotes: null });
        navigate();
      }
    }}, 'Сбросить'));
  } else {
    f.appendChild(el('div', { class: 'muted' }, 'Пока ни одной точки.'));
  }
  f.appendChild(el('button', { type: 'button', class: 'btn outline', onclick: () => openTruingSheet(c) }, '🎯 Добавить точку калибровки'));
  if (pts.length) {
    f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (confirm('Удалить ВСЕ точки калибровки?')) {
        await Store.put('cartridges', { ...c, truingPoints: [] });
        navigate();
      }
    }}, 'Очистить все точки'));
  }

  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сохранить'));
  if (!isNew) f.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
    if (confirm('Удалить?')) { await Store.del('cartridges', id); location.hash = '#/cartridges'; }
  }}, 'Удалить'));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(f);
    const cdm = (d.customDragText || '').split('\n')
      .map(s => s.trim()).filter(Boolean)
      .map(s => s.split(/[,\s]+/).map(x => parseFloat(x)))
      .filter(p => p.length === 2 && isFinite(p[0]) && isFinite(p[1]));
    delete d.customDragText;
    const chronoVels = (d.chronoVelocitiesText || '').split(/[,\s\n]+/)
      .map(s => parseFloat(s)).filter(v => isFinite(v) && v > 0);
    delete d.chronoVelocitiesText;
    d.chronoVelocities = chronoVels;
    d.chronoStats = chronoVels.length >= 2 ? Ballistics.chronoStats(chronoVels) : null;
    const mvPts = (d.mvTempText || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
      const [t, v] = s.split(/[,\s]+/).map(parseFloat);
      return (isFinite(t) && isFinite(v) && v > 0) ? { tempC: t, v0: v } : null;
    }).filter(Boolean).sort((a, b) => a.tempC - b.tempC);
    delete d.mvTempText;
    d.mvTempTable = mvPts.length >= 2 ? mvPts : null;
    // базовый патрон — взаимоисключающие условия
    if (d.isBase) {
      d.baseCartridgeId = null;
      d.offsetVertMil = 0;
      d.offsetHorizMil = 0;
      // снять флаг с других патронов
      for (const x of allCartridges) {
        if (x.id !== c.id && x.isBase) {
          await Store.put('cartridges', { ...x, isBase: false });
        }
      }
    }
    await Store.put('cartridges', { ...c, ...d, customDrag: cdm.length >= 2 ? cdm : null });
    toast('Сохранено'); location.hash = '#/cartridges';
  });
  view.appendChild(f);
});

// — Библиотека пуль (BC из общедоступных мануфактурер-таблиц; всегда можно править) —
const BULLET_PRESETS = [
  // .224 (5.56)
  { name: 'Berger 80.5 Fullbore', cal: '.224', caliber_in: 0.224, mass_gr: 80.5, len_in: 1.045, bcG7: 0.247, bcG1: 0.480 },
  { name: 'Berger 88 Hybrid Target', cal: '.224', caliber_in: 0.224, mass_gr: 88, len_in: 1.171, bcG7: 0.274, bcG1: 0.545 },
  { name: 'Sierra MK 77 HPBT', cal: '.224', caliber_in: 0.224, mass_gr: 77, len_in: 0.985, bcG7: 0.186, bcG1: 0.372 },
  { name: 'Hornady ELD-M 75', cal: '.224', caliber_in: 0.224, mass_gr: 75, len_in: 0.975, bcG7: 0.190, bcG1: 0.395 },
  // 6mm
  { name: 'Berger 105 Hybrid', cal: '6mm', caliber_in: 0.243, mass_gr: 105, len_in: 1.215, bcG7: 0.278, bcG1: 0.545 },
  { name: 'Berger 109 LRHT', cal: '6mm', caliber_in: 0.243, mass_gr: 109, len_in: 1.265, bcG7: 0.298, bcG1: 0.585 },
  { name: 'Hornady ELD-M 108', cal: '6mm', caliber_in: 0.243, mass_gr: 108, len_in: 1.250, bcG7: 0.275, bcG1: 0.536 },
  // 6.5mm
  { name: 'Berger 140 Hybrid', cal: '6.5mm', caliber_in: 0.264, mass_gr: 140, len_in: 1.350, bcG7: 0.299, bcG1: 0.595 },
  { name: 'Berger 153.5 LRHT', cal: '6.5mm', caliber_in: 0.264, mass_gr: 153.5, len_in: 1.430, bcG7: 0.328, bcG1: 0.661 },
  { name: 'Sierra MK 142 HPBT', cal: '6.5mm', caliber_in: 0.264, mass_gr: 142, len_in: 1.375, bcG7: 0.292, bcG1: 0.595 },
  { name: 'Hornady ELD-M 147', cal: '6.5mm', caliber_in: 0.264, mass_gr: 147, len_in: 1.404, bcG7: 0.314, bcG1: 0.617 },
  { name: 'Hornady ELD-M 140', cal: '6.5mm', caliber_in: 0.264, mass_gr: 140, len_in: 1.345, bcG7: 0.281, bcG1: 0.580 },
  { name: 'Lapua Scenar-L 136', cal: '6.5mm', caliber_in: 0.264, mass_gr: 136, len_in: 1.310, bcG7: 0.270, bcG1: 0.530 },
  // .284 (7mm)
  { name: 'Berger 180 Hybrid', cal: '7mm', caliber_in: 0.284, mass_gr: 180, len_in: 1.555, bcG7: 0.345, bcG1: 0.683 },
  { name: 'Berger 195 EOL Elite', cal: '7mm', caliber_in: 0.284, mass_gr: 195, len_in: 1.640, bcG7: 0.381, bcG1: 0.755 },
  { name: 'Sierra MK 183 HPBT', cal: '7mm', caliber_in: 0.284, mass_gr: 183, len_in: 1.555, bcG7: 0.343, bcG1: 0.700 },
  { name: 'Hornady ELD-M 180', cal: '7mm', caliber_in: 0.284, mass_gr: 180, len_in: 1.541, bcG7: 0.359, bcG1: 0.712 },
  // .308 (7.62)
  { name: 'Berger 200.20X Hybrid', cal: '.308', caliber_in: 0.308, mass_gr: 200.2, len_in: 1.561, bcG7: 0.328, bcG1: 0.640 },
  { name: 'Berger 215 Hybrid', cal: '.308', caliber_in: 0.308, mass_gr: 215, len_in: 1.560, bcG7: 0.345, bcG1: 0.691 },
  { name: 'Sierra MK 175 HPBT', cal: '.308', caliber_in: 0.308, mass_gr: 175, len_in: 1.240, bcG7: 0.243, bcG1: 0.505 },
  { name: 'Sierra MK 168 HPBT', cal: '.308', caliber_in: 0.308, mass_gr: 168, len_in: 1.215, bcG7: 0.218, bcG1: 0.462 },
  { name: 'Sierra MK 220 HPBT', cal: '.308', caliber_in: 0.308, mass_gr: 220, len_in: 1.470, bcG7: 0.310, bcG1: 0.629 },
  { name: 'Hornady ELD-M 178', cal: '.308', caliber_in: 0.308, mass_gr: 178, len_in: 1.355, bcG7: 0.243, bcG1: 0.500 },
  { name: 'Hornady ELD-M 208', cal: '.308', caliber_in: 0.308, mass_gr: 208, len_in: 1.493, bcG7: 0.315, bcG1: 0.648 },
  { name: 'Lapua Scenar 167', cal: '.308', caliber_in: 0.308, mass_gr: 167, len_in: 1.236, bcG7: 0.222, bcG1: 0.470 },
  // .338
  { name: 'Berger 300 Hybrid', cal: '.338', caliber_in: 0.338, mass_gr: 300, len_in: 1.823, bcG7: 0.418, bcG1: 0.821 },
  { name: 'Sierra MK 300 HPBT', cal: '.338', caliber_in: 0.338, mass_gr: 300, len_in: 1.795, bcG7: 0.385, bcG1: 0.768 },
  { name: 'Lapua Scenar 250', cal: '.338', caliber_in: 0.338, mass_gr: 250, len_in: 1.495, bcG7: 0.322, bcG1: 0.675 },
  { name: 'Lapua Scenar 300', cal: '.338', caliber_in: 0.338, mass_gr: 300, len_in: 1.795, bcG7: 0.391, bcG1: 0.780 },
  // .50 BMG
  { name: 'Hornady A-MAX 750', cal: '.50 BMG', caliber_in: 0.510, mass_gr: 750, len_in: 2.290, bcG7: 0.515, bcG1: 1.050 },
];
function openBulletLibrarySheet(applyFn) {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, 'Библиотека пуль'));
    sheet.appendChild(el('div', { class: 'sub' }, 'Тапни — заполнит поля. BC уточни под свою партию.'));
    const search = el('input', { type: 'search', placeholder: 'Поиск: «6.5», «Berger 140», «308»…' });
    sheet.appendChild(search);
    const list = el('div', { style: 'max-height:60vh;overflow-y:auto;margin-top:8px' });
    sheet.appendChild(list);
    function render() {
      list.innerHTML = '';
      const q = (search.value || '').toLowerCase().trim();
      const items = BULLET_PRESETS.filter(b =>
        !q || b.name.toLowerCase().includes(q) || b.cal.toLowerCase().includes(q));
      if (!items.length) { list.appendChild(el('div', { class: 'muted center' }, 'Ничего не найдено')); return; }
      for (const b of items) {
        const item = el('button', { type: 'button', class: 'list-item', style: 'width:100%;text-align:left',
          onclick: () => { applyFn(b); close(); } });
        item.appendChild(el('div', { class: 'ttl' }, b.name));
        item.appendChild(el('div', { class: 'sub' },
          `${b.cal} · ${b.mass_gr} gr · G7 ${b.bcG7} / G1 ${b.bcG1}`));
        list.appendChild(item);
      }
    }
    search.addEventListener('input', render);
    render();
  });
}

// helper: V₀ из MV Temp Table при заданной темп. боеприпаса (линейная интерполяция между точками)
function v0FromMvTable(cart, ammoTempC) {
  const t = cart?.mvTempTable;
  if (!t || t.length < 2 || ammoTempC == null || !isFinite(ammoTempC)) return null;
  if (ammoTempC <= t[0].tempC) return t[0].v0;
  if (ammoTempC >= t[t.length - 1].tempC) return t[t.length - 1].v0;
  for (let i = 1; i < t.length; i++) {
    if (t[i].tempC >= ammoTempC) {
      const a = t[i - 1], b = t[i];
      return a.v0 + (b.v0 - a.v0) * (ammoTempC - a.tempC) / (b.tempC - a.tempC);
    }
  }
  return null;
}

// helper: эффективные параметры баллистики из weapon + cartridge
function effectiveBC(c) { return c.truedBC || c.bc; }
function effectiveDragModel(c) {
  if (c.customDrag && c.customDrag.length >= 2) return 'CUSTOM';
  return c.dragModel || 'G1';
}
function buildSolverInputFor(weapon, cart, distances, weather, opts = {}) {
  const ammoT = weather.ammoTempC ?? weather.tempC;
  const v0FromTable = v0FromMvTable(cart, ammoT);
  const useTable = v0FromTable != null;
  return {
    bc: effectiveBC(cart),
    dragModel: effectiveDragModel(cart),
    customDrag: cart.customDrag || null,
    v0: useTable ? v0FromTable : cart.v0,
    bulletMass_gr: cart.bulletMass_gr,
    bulletLength_in: cart.bulletLength_in,
    caliber_in: cart.caliber_in,
    twist_in: weapon?.twist_in,
    twistRight: weapon ? (weapon.twistRight !== false) : true,
    sightHeight: (weapon?.sightHeight_mm || 50) / 1000,
    zeroDistance: weapon?.zeroDistance || 100,
    targetDistance: Math.max(...(distances || [1000])),
    tempC: weather.tempC ?? 15, pressureMbar: weather.pressureMbar ?? 1013,
    humidity: weather.humidity ?? 50,
    windSpeed: weather.windSpeed ?? 0,
    windAngle_deg: weather.windAngle_deg ?? 0,
    shotAngle_deg: weather.shotAngle_deg ?? 0,
    cant_deg: weather.cant_deg ?? 0,
    ammoTempC: ammoT,
    v0_baseTempC: useTable ? ammoT : cart.v0_baseTempC,
    v0_tempSens_mps_per_C: useTable ? 0 : cart.v0_tempSens_mps_per_C,
    truingPoints: cart.truingPoints || null,
    latitude_deg: weather.latitude_deg ?? 0,
    azimuth_deg: weather.azimuth_deg ?? 0,
    steps: distances,
    ...opts
  };
}

function openTruingSheet(cart) {
  openSheet(async (sheet, close) => {
    const weapons = await Store.getAll('weapons');
    sheet.appendChild(el('h3', {}, 'Новая точка калибровки'));
    sheet.appendChild(el('div', { class: 'sub' }, 'Контрольный выстрел на известной дистанции'));
    sheet.appendChild(el('div', { class: 'banner' }, 'Лучше — безветренная погода. Запиши mil-поправку, которая попала «в ноль» (фактически отстреливаемая просадка).'));
    sheet.appendChild(selectInput('weaponId', 'Оружие', null,
      weapons.map(w => ({ value: w.id, label: w.name }))));
    sheet.appendChild(el('div', { class: 'row' },
      numInput('range', 'Дистанция, м', 600, { required: true }),
      numInput('observedDropMil', 'Факт. mil', 4.0, { required: true })
    ));
    sheet.appendChild(el('div', { class: 'row' },
      numInput('tempC', 'Темп., °C', 15),
      numInput('pressureMbar', 'Давл., гПа', 1013)
    ));
    sheet.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Отмена'),
      el('button', { type: 'button', class: 'btn', onclick: async () => {
        const d = readForm(sheet);
        const weapon = weapons.find(w => w.id === d.weaponId);
        if (!weapon) { toast('Выбери оружие'); return; }
        const input = buildSolverInputFor(weapon, cart, [d.range], {
          tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: 50, windSpeed: 0
        });
        const p = Ballistics.addTruingPoint(input, d.observedDropMil, d.range);
        if (!p || !isFinite(p.bcFactor)) { toast('Не удалось подобрать factor'); return; }
        const existing = cart.truingPoints || [];
        // если уже есть точка с близким Mach (±0.05) — заменяем
        const filtered = existing.filter(x => Math.abs(x.machAt - p.machAt) > 0.05);
        const newPoints = [...filtered, { ...p, addedAt: new Date().toISOString() }];
        await Store.put('cartridges', { ...cart, truingPoints: newPoints });
        toast(`Точка: Mach ${p.machAt.toFixed(2)} × ${p.bcFactor.toFixed(3)}`);
        close(); navigate();
      }}, 'Добавить')
    ));
  });
}

// ============== RETICLES (библиотека сеток прицелов) ==============
route('/reticles', async () => {
  setHeader({ title: 'Сетки прицелов' });
  const items = await Store.getAll('reticles');
  if (items.length === 0) view.appendChild(el('div', { class: 'banner' },
    'Загрузи фото сетки своего прицела (или скачай PNG с сайта производителя), потом откалибруй: центр + одна известная метка с её mil-значением. После этого в результате расчёта появится вкладка «Прицел» с точками куда целиться.'));
  for (const r of items) {
    view.appendChild(el('a', { class: 'list-item', href: '#/reticle/' + r.id },
      el('div', { class: 'ttl' }, r.name || 'Без названия'),
      el('div', { class: 'sub' }, [
        r.type || 'mil',
        r.cal ? `калибровка: ${fmt(r.cal.p1_mil_v ?? 0, 1)} mil вниз` : 'без калибровки',
        r.imageDataUrl ? 'фото есть' : 'без фото'
      ].filter(Boolean).join(' · '))
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/reticle/new' }, '+'));
});

route('/reticle/:id', async ({ id }) => {
  const isNew = id === 'new';
  const r = isNew ? { id: Store.uid(), type: 'mil', clickValue: 0.1 } : await Store.get('reticles', id);
  if (!r) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новая сетка' : (r.name || 'Сетка') });

  const f = el('form', { class: 'card' });
  f.appendChild(textInput('name', 'Название', r.name, { required: true, placeholder: 'Mil-XT, MOAR, MSR-2, ...' }));
  f.appendChild(el('div', { class: 'row' },
    selectInput('type', 'Тип', r.type || 'mil', [{value:'mil',label:'mil/MRAD'},{value:'moa',label:'MOA'}]),
    numInput('clickValue', 'Цена клика', r.clickValue ?? 0.1, { step: '0.01' })
  ));
  f.appendChild(el('label', { class: 'checkbox' },
    el('input', { type: 'checkbox', name: 'ffp', checked: r.ffp ? true : undefined }),
    el('span', { class: 'lbl' }, 'FFP (первая фокальная плоскость)',
      el('span', { class: 'sub' }, 'У SFP-прицелов размер сетки зависит от кратности'))
  ));
  view.appendChild(f);

  // --- фото и калибровка ---
  const photoCard = el('div', { class: 'card' });
  photoCard.appendChild(el('h2', {}, 'Фото и калибровка'));

  // file input — НЕ display:none (в Android WebView это иногда блокирует клик).
  // Скрываем через position:absolute + opacity:0 — клик через label-обёртку работает гарантированно.
  const fileInput = el('input', { type: 'file', accept: 'image/*',
    style: 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0' });
  photoCard.appendChild(fileInput);

  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  // Кнопка загрузки. На нативе → Capacitor Camera (prompt camera/gallery).
  // В браузере или fallback → fileInput.click().
  async function pickPhoto() {
    if (isNative && window.Capacitor?.Plugins?.Camera) {
      try {
        const Cam = window.Capacitor.Plugins.Camera;
        const photo = await Cam.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: 'dataUrl',
          source: 'Prompt',
          width: 1500
        });
        if (photo?.dataUrl) await applyPhoto(photo.dataUrl);
        else throw new Error('Camera не вернула dataUrl');
      } catch (e) {
        toast('Camera: ' + (e?.message || 'отмена'));
        // fallback на file input
        fileInput.click();
      }
    } else {
      fileInput.click();
    }
  }

  photoCard.appendChild(el('button', { type: 'button', class: 'btn ghost',
    onclick: pickPhoto }, '📷 Загрузить фото сетки'));

  const calStateInfo = el('div', { class: 'banner', style: 'margin-top:8px' },
    r.imageDataUrl
      ? (r.cal ? 'Калибровка готова. Можно изменить — тап на центр или ссылочную точку.' : 'Фото загружено. Откалибруй: тапни центр сетки, потом ссылочную метку и введи её mil-значение.')
      : 'Загрузи фото или PNG сетки.');
  photoCard.appendChild(calStateInfo);

  const canvas = el('canvas', { style: 'max-width:100%;height:auto;display:block;border:1px solid var(--border);border-radius:8px;background:#000;touch-action:none;cursor:crosshair' });
  photoCard.appendChild(canvas);

  // mode state
  let mode = 'center'; // 'center' | 'ref'
  let img = null;
  let scale = 1; // отображение → натуральные пиксели
  // локальные копии калибровки
  let cal = r.cal ? { ...r.cal } : null;

  const modeRow = el('div', { class: 'chips', style: 'margin-top:8px' },
    el('div', { class: 'chip active', onclick: () => { mode = 'center'; updateModeChips(); } }, 'Тап центра'),
    el('div', { class: 'chip', onclick: () => { mode = 'ref'; updateModeChips(); } }, 'Тап ссылочной точки')
  );
  photoCard.appendChild(modeRow);
  function updateModeChips() {
    [...modeRow.children].forEach((c, i) => c.classList.toggle('active', (i === 0 && mode === 'center') || (i === 1 && mode === 'ref')));
  }

  const refRow = el('div', { class: 'row', style: 'margin-top:8px' },
    numInput('refMilV', 'Ссыл. точка — вниз от центра, mil (+)', cal?.p1_mil_v ?? 5, { step: '0.1' }),
    numInput('refMilH', 'вбок (+ вправо), mil', cal?.p1_mil_h ?? 0, { step: '0.1' })
  );
  photoCard.appendChild(refRow);

  function drawCanvas() {
    if (!img) return;
    const maxW = Math.min(window.innerWidth - 60, 640);
    const w = Math.min(img.naturalWidth, maxW);
    scale = w / img.naturalWidth;
    canvas.width = w;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (cal) {
      if (cal.p0_x != null) {
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cal.p0_x * scale, cal.p0_y * scale, 12, 0, 2 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cal.p0_x * scale - 20, cal.p0_y * scale); ctx.lineTo(cal.p0_x * scale + 20, cal.p0_y * scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cal.p0_x * scale, cal.p0_y * scale - 20); ctx.lineTo(cal.p0_x * scale, cal.p0_y * scale + 20); ctx.stroke();
        ctx.fillStyle = '#4ade80'; ctx.font = '12px monospace'; ctx.fillText('центр', cal.p0_x * scale + 16, cal.p0_y * scale - 16);
      }
      if (cal.p1_x != null) {
        ctx.strokeStyle = '#ff8b3d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cal.p1_x * scale, cal.p1_y * scale, 10, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = '#ff8b3d';
        ctx.fillText(`ref ${fmt(cal.p1_mil_v ?? 0,1)}/${fmt(cal.p1_mil_h ?? 0,1)}`, cal.p1_x * scale + 14, cal.p1_y * scale + 4);
      }
    }
  }

  canvas.addEventListener('click', (e) => {
    if (!img) return;
    const rect = canvas.getBoundingClientRect();
    const x_disp = e.clientX - rect.left;
    const y_disp = e.clientY - rect.top;
    const x_nat = x_disp / scale;
    const y_nat = y_disp / scale;
    cal = cal || {};
    if (mode === 'center') {
      cal.p0_x = x_nat; cal.p0_y = y_nat;
      mode = 'ref'; updateModeChips();
      calStateInfo.textContent = 'Центр зафиксирован. Теперь тап на ссылочную точку (например, метку 5 mil под центром).';
    } else {
      cal.p1_x = x_nat; cal.p1_y = y_nat;
      const d = readForm(refRow);
      cal.p1_mil_v = d.refMilV;
      cal.p1_mil_h = d.refMilH;
      calStateInfo.textContent = `Ссылочная точка: (${fmt(x_nat,0)}, ${fmt(y_nat,0)}) px = (${fmt(d.refMilH,1)} mil вбок, ${fmt(d.refMilV,1)} mil вниз).`;
    }
    drawCanvas();
  });

  // Применить полученное dataUrl: сжать до 1500px, обновить img + canvas, сохранить в r.
  async function applyPhoto(dataUrl) {
    try {
      toast('Обрабатываю фото…');
      const resized = await resizeDataUrl(dataUrl, 1500);
      r.imageDataUrl = resized;
      img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('img.onerror'));
        img.src = resized;
      });
      drawCanvas();
      const kb = Math.round(resized.length * 0.75 / 1024);
      toast(`Загружено: ${img.naturalWidth}×${img.naturalHeight}, ~${kb} КБ`);
    } catch (e) {
      toast('Ошибка загрузки фото: ' + e.message);
    }
  }

  // Resize dataUrl через canvas (max ширина в px).
  function resizeDataUrl(dataUrl, maxW) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        try {
          if (im.naturalWidth <= maxW) { resolve(dataUrl); return; }
          const w = maxW;
          const h = Math.round(im.naturalHeight * (w / im.naturalWidth));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(im, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.85));
        } catch (e) { reject(e); }
      };
      im.onerror = () => reject(new Error('не удалось декодировать картинку'));
      im.src = dataUrl;
    });
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) { toast('Файл не выбран'); return; }
    if (!file.type.startsWith('image/')) { toast('Не картинка: ' + file.type); return; }
    const fr = new FileReader();
    fr.onload = async () => {
      try { await applyPhoto(fr.result); }
      catch (e) { toast('Ошибка: ' + e.message); }
    };
    fr.onerror = () => toast('FileReader ошибка: ' + (fr.error?.message || 'неизвестно'));
    fr.readAsDataURL(file);
  });

  // загрузить уже сохранённое фото
  if (r.imageDataUrl) {
    img = new Image();
    img.onload = () => drawCanvas();
    img.src = r.imageDataUrl;
  }

  view.appendChild(photoCard);

  // --- сохранение ---
  const buttons = el('div', { class: 'card' });
  buttons.appendChild(el('button', { type: 'button', class: 'btn', onclick: async () => {
    const d = readForm(f);
    d.ffp = !!d.ffp;
    // если калибровка содержит обе точки и хотя бы одно mil — сохраняем
    if (cal && cal.p0_x != null && cal.p1_x != null) {
      const ref = readForm(refRow);
      cal.p1_mil_v = ref.refMilV;
      cal.p1_mil_h = ref.refMilH;
    }
    await Store.put('reticles', { ...r, ...d, cal });
    toast('Сохранено'); location.hash = '#/reticles';
  }}, 'Сохранить'));
  if (!isNew) buttons.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
    if (confirm('Удалить?')) { await Store.del('reticles', id); location.hash = '#/reticles'; }
  }}, 'Удалить'));
  view.appendChild(buttons);
});

// --- хелпер: построить пикс/mil из cal ---
function reticleScale(cal) {
  if (!cal || cal.p0_x == null || cal.p1_x == null) return null;
  const dx = cal.p1_x - cal.p0_x;
  const dy = cal.p1_y - cal.p0_y;
  const mh = cal.p1_mil_h || 0;
  const mv = cal.p1_mil_v || 0;
  let px_per_mil_h, px_per_mil_v;
  if (mh !== 0) px_per_mil_h = dx / mh;
  if (mv !== 0) px_per_mil_v = dy / mv;
  // если одна ось не задана — берём другую как изотропную
  if (px_per_mil_h == null && px_per_mil_v != null) px_per_mil_h = Math.abs(px_per_mil_v);
  if (px_per_mil_v == null && px_per_mil_h != null) px_per_mil_v = Math.abs(px_per_mil_h);
  if (px_per_mil_h == null || px_per_mil_v == null) return null;
  return { cx: cal.p0_x, cy: cal.p0_y, hx: px_per_mil_h, vy: px_per_mil_v };
}

// --- хелпер: отрисовать сетку с метками целей + subtension-режим + pinch-zoom ---
function renderReticleViewer(reticle, rows) {
  const wrap = el('div', { class: 'card' });
  if (!reticle || !reticle.imageDataUrl) {
    wrap.appendChild(el('div', { class: 'banner' }, 'Нет сетки прицела. Создай в разделе «Сетки прицелов» и привяжи к оружию.'));
    return wrap;
  }
  const sc = reticleScale(reticle.cal);
  if (!sc) {
    wrap.appendChild(el('div', { class: 'banner' }, 'Сетка не откалибрована. Открой её в библиотеке и укажи центр + ссылочную точку.'));
    return wrap;
  }

  // — тулбар зума + сброс метки —
  const toolbar = el('div', { class: 'reticle-toolbar' });
  const btnZoomOut = el('button', { type: 'button', class: 'btn-mini' }, '−');
  const btnReset   = el('button', { type: 'button', class: 'btn-mini' }, '1:1');
  const btnZoomIn  = el('button', { type: 'button', class: 'btn-mini' }, '+');
  const btnClear   = el('button', { type: 'button', class: 'btn-mini ghost' }, '✕ метка');
  toolbar.appendChild(btnZoomOut);
  toolbar.appendChild(btnReset);
  toolbar.appendChild(btnZoomIn);
  toolbar.appendChild(btnClear);
  wrap.appendChild(toolbar);
  wrap.appendChild(el('div', { class: 'reticle-hint' }, 'Тап по сетке → «эта точка ≈ NNN м». Pinch — зум, drag — pan'));

  // — viewport + canvas —
  const viewport = el('div', { class: 'reticle-viewport' });
  const canvas = el('canvas', { class: 'reticle-canvas' });
  viewport.appendChild(canvas);
  wrap.appendChild(viewport);

  const subtensionLabel = el('div', { class: 'reticle-subtension' });
  wrap.appendChild(subtensionLabel);
  const legend = el('div', { class: 'kv', style: 'margin-top:10px;font-size:13px' });
  wrap.appendChild(legend);

  let imgEl = null, displayScale = 1;
  let zoom = 1, panX = 0, panY = 0;
  let marker = null;        // { cx, cy, range, drop_mil, drift_mil }
  let pinchStart = null, panStart = null, dragHappened = false;

  function applyTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }
  function setZoom(z, focusX, focusY) {
    z = Math.max(0.5, Math.min(z, 6));
    if (focusX != null) {
      const k = z / zoom;
      panX = focusX - (focusX - panX) * k;
      panY = focusY - (focusY - panY) * k;
    }
    zoom = z;
    applyTransform();
  }

  const colors = ['#4ade80','#ffb072','#ff8b3d','#f87171','#a78bfa','#67e8f9','#fde047','#fb923c','#22d3ee','#f472b6'];

  function draw() {
    if (!imgEl) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    legend.innerHTML = '';
    rows.forEach((row, i) => {
      const px = sc.cx + (row.drift_mil || 0) * sc.hx;
      const py = sc.cy + (row.drop_mil || 0) * sc.vy;
      const x = px * displayScale, y = py * displayScale;
      if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
      const color = colors[i % colors.length];
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill();
      ctx.font = 'bold 13px monospace';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(row.range + 'м', x + 12, y + 4);
      ctx.fillText(row.range + 'м', x + 12, y + 4);
      legend.appendChild(el('div', { class: 'k', style: 'color:' + color }, '● ' + row.range + ' м'));
      legend.appendChild(el('div', { class: 'v' },
        `${fmt(row.drop_mil,2)} mil ↓ · ${fmt(row.drift_mil,2)} mil →`));
    });

    if (marker) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      const m = marker;
      ctx.beginPath();
      ctx.moveTo(m.cx - 12, m.cy); ctx.lineTo(m.cx + 12, m.cy);
      ctx.moveTo(m.cx, m.cy - 12); ctx.lineTo(m.cx, m.cy + 12);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(m.cx, m.cy, 14, 0, 2 * Math.PI); ctx.stroke();
      const lbl = `≈ ${m.range} м`;
      ctx.font = 'bold 14px monospace';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.strokeText(lbl, m.cx + 18, m.cy - 12);
      ctx.fillStyle = '#fff';
      ctx.fillText(lbl, m.cx + 18, m.cy - 12);
      subtensionLabel.textContent =
        `Точка сетки ≈ ${m.range} м · drop ${fmt(m.drop_mil,2)} mil · drift ${fmt(m.drift_mil,2)} mil`;
    } else {
      subtensionLabel.textContent = '';
    }
  }

  function tapToSubtension(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const cx = (clientX - rect.left) / rect.width  * canvas.width;
    const cy = (clientY - rect.top)  / rect.height * canvas.height;
    const drift_mil = (cx / displayScale - sc.cx) / sc.hx;
    const drop_mil  = (cy / displayScale - sc.cy) / sc.vy;
    let best = null, bestD = Infinity;
    rows.forEach(r => {
      const dr = (r.drift_mil || 0) - drift_mil;
      const dd = (r.drop_mil  || 0) - drop_mil;
      const d2 = dr * dr + dd * dd;
      if (d2 < bestD) { bestD = d2; best = r; }
    });
    if (best) {
      marker = { cx, cy, range: best.range, drop_mil, drift_mil };
      draw();
    }
  }

  // click → subtension (срабатывает после touchend на мобиле и на десктопе)
  canvas.addEventListener('click', (e) => {
    if (dragHappened) { dragHappened = false; return; }
    tapToSubtension(e.clientX, e.clientY);
  });

  // tap-кнопки
  btnClear.addEventListener('click', () => { marker = null; draw(); });
  btnZoomIn.addEventListener('click', () => {
    const r = viewport.getBoundingClientRect();
    setZoom(zoom * 1.4, r.width / 2, r.height / 2);
  });
  btnZoomOut.addEventListener('click', () => {
    const r = viewport.getBoundingClientRect();
    setZoom(zoom / 1.4, r.width / 2, r.height / 2);
  });
  btnReset.addEventListener('click', () => {
    zoom = 1; panX = 0; panY = 0; applyTransform();
  });

  // touch: 1 палец = pan (если zoom>1); 2 пальца = pinch
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchStart = {
        dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        zoom, panX, panY,
        cx: (a.clientX + b.clientX) / 2,
        cy: (a.clientY + b.clientY) / 2
      };
      panStart = null;
      dragHappened = true;
    } else if (e.touches.length === 1) {
      panStart = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, panX, panY };
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const k = dist / pinchStart.dist;
      const newZ = Math.max(0.5, Math.min(pinchStart.zoom * k, 6));
      const rect = viewport.getBoundingClientRect();
      const focusX = pinchStart.cx - rect.left;
      const focusY = pinchStart.cy - rect.top;
      zoom = newZ;
      panX = focusX - (focusX - pinchStart.panX) * (newZ / pinchStart.zoom);
      panY = focusY - (focusY - pinchStart.panY) * (newZ / pinchStart.zoom);
      applyTransform();
    } else if (e.touches.length === 1 && panStart && zoom > 1.001) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panStart.sx;
      const dy = e.touches[0].clientY - panStart.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragHappened = true;
      panX = panStart.panX + dx;
      panY = panStart.panY + dy;
      applyTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', () => {
    pinchStart = null; panStart = null;
  }, { passive: true });

  const img = new Image();
  img.onload = () => {
    const maxW = Math.min(window.innerWidth - 60, 640);
    const w = Math.min(img.naturalWidth, maxW);
    displayScale = w / img.naturalWidth;
    canvas.width = w; canvas.height = img.naturalHeight * displayScale;
    imgEl = img;
    draw();
  };
  img.src = reticle.imageDataUrl;
  return wrap;
}

// ============== справка по стрельбе по ротору ==============
function openRotorHelpSheet() {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, 'Стрельба по ротор-мишеням'));
    sheet.appendChild(el('div', { class: 'sub' }, 'Методики и тайминг'));

    const body = el('div', { style: 'max-height:60vh;overflow-y:auto;padding-right:6px;line-height:1.5;font-size:14px' });
    body.innerHTML = `
      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Что такое ротор-мишень</h4>
      <p>Конструкция, вращающаяся вокруг оси с N лопастями. Каждая лопасть закреплена на радиусе R от оси. В точке «3 часов» кончик лопасти движется касательно к окружности со скоростью v = R · ω, где ω — угловая скорость (рад/с).</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Ключевая физика</h4>
      <p>Пуля летит к цели за время TOF (например, 0.6 с на 500 м). За это время лопасть пройдёт расстояние v · TOF по своей окружности. Поэтому если стрелять в момент, когда лопасть «на 3 часах», к моменту прилёта пули она уже уйдёт вперёд по вращению.</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Методика 1 — Sustained lead (упреждение)</h4>
      <p><b>Куда целить:</b> в точку, которая находится впереди текущего положения лопасти на расстоянии v · TOF по направлению вращения. Эта точка лежит на той же окружности.</p>
      <p><b>В сетке прицела:</b> приложение даёт lead в mil. Удерживай эту отметку в стороне от 3 часов по направлению вращения и веди ствол неподвижно.</p>
      <p><b>Когда жать:</b> в момент, когда лопасть подходит к воображаемой точке за «lead» до точки прицеливания. То есть: если lead = 0.5 mil, а лопасть в данный момент в проекции 4 часа — стреляй, когда лопасть подойдёт к точке на сетке.</p>
      <p><b>Подходит:</b> когда окно поражения сравнимо с TOF (то есть лопасти большие или ротор медленный).</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Методика 2 — Стрельба в ось вращения (центр)</h4>
      <p><b>Куда целить:</b> в центр оси, без упреждения.</p>
      <p><b>Идея:</b> при коротких лопастях и большом радиусе кончик движется быстро. Но рядом с осью лопасти проходят медленнее (касательная скорость = r · ω, где r — расстояние от оси). Стреляя в ось, ты ловишь лопасть в момент пересечения центральной зоны — окно поражения здесь шире.</p>
      <p><b>Минус:</b> попасть нужно во внутренний радиус лопасти (не в кончик). Требует, чтобы крепление лопасти к оси было целевой зоной.</p>
      <p><b>Подходит:</b> когда окно поражения на кончике сильно меньше TOF и упреждение нестабильное.</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Методика 3 — Серия выстрелов</h4>
      <p><b>Куда целить:</b> в точку «3 часа» (или другую фиксированную) с упреждением как в методе 1.</p>
      <p><b>Темп:</b> 2–4 быстрых выстрела с интервалом меньше окна поражения. Не дольше периода оборота / N (то есть менее интервала прохождения соседних лопастей).</p>
      <p><b>Подходит:</b> когда фаза вращения неизвестна и время реакции на конкретную лопасть мало. Стандарт на PRS-стейджах с короткими тайм-лимитами.</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Методика 4 — Tracking</h4>
      <p><b>Идея:</b> плавно поворачиваешь ствол за лопастью, прицельная отметка идёт по сетке туда же, выстрел в момент готовности.</p>
      <p><b>Минусы:</b> требует много тренировки, малоэффективен на быстром роторе; против лопасти на круге траектория ствола нелинейная (не подходит обычное «sustained lead» как для линейной цели).</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Тайминг выстрела</h4>
      <p>Реакция стрелка + ход спускового механизма ≈ 0.15–0.3 с. Прибавляй к TOF, чтобы найти момент жмака:<br>
      <b>t_шага = t_прилёта_лопасти − TOF − реакция</b></p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Окно поражения</h4>
      <p>Время, за которое лопасть проходит точку прицеливания:<br>
      <b>окно = L / v_касательная</b><br>
      Например, L = 10 см, v = 2 м/с → окно = 50 мс. Очень мало — нужен точный тайминг или метод 2/3.</p>

      <h4 style="color:var(--accent);margin:14px 0 4px;letter-spacing:1px">Что выбрать</h4>
      <ul style="padding-left:20px;margin:6px 0">
        <li><b>Окно >> TOF</b> — метод 1 (упреждение, расслабленно)</li>
        <li><b>Окно ≈ TOF</b> — метод 1 (точный тайминг) или 3 (серия)</li>
        <li><b>Окно &lt;&lt; TOF</b> — метод 2 (в ось) или 3 (серия с минимальным интервалом)</li>
      </ul>
    `;
    sheet.appendChild(body);

    sheet.appendChild(el('button', { type: 'button', class: 'btn', onclick: close, style: 'margin-top:14px' }, 'Понятно'));
  });
}

// ============== MOVING TARGET (линейная цель + секундомер + ротор) ==============
route('/moving-target', async () => {
  setHeader({ title: 'Движущаяся цель' });
  const [weapons, cartridges] = await Promise.all([Store.getAll('weapons'), Store.getAll('cartridges')]);
  const p = loadPrefs();
  const state = JSON.parse(localStorage.getItem('moving:last') || '{}');
  state.weaponId    = state.weaponId    ?? p.weaponId    ?? (weapons[0]?.id || '');
  state.cartridgeId = state.cartridgeId ?? p.cartridgeId ?? (cartridges[0]?.id || '');
  state.distance_m  = state.distance_m  ?? 300;
  state.weather     = state.weather     || p.weather || { tempC: 15, pressureMbar: 1013, humidity: 50 };
  state.mode        = state.mode        || 'linear';   // linear | rotor
  state.angle_deg   = state.angle_deg   ?? 90;          // угол движения к LOS, 90 = полный фланг
  // линейная цель
  state.speedMode   = state.speedMode   || 'mps';       // mps | mils | stopwatch
  state.speed_mps   = state.speed_mps   ?? 1.4;         // м/с
  state.speed_mils  = state.speed_mils  ?? 5;           // mil/сек
  // ротор
  state.rpm         = state.rpm         ?? 30;
  state.radius_m    = state.radius_m    ?? 0.5;
  state.blades      = state.blades      ?? 4;
  state.bladeSize_m = state.bladeSize_m ?? 0.1;
  function save() { localStorage.setItem('moving:last', JSON.stringify(state)); render(); }

  // — солвер для TOF —
  function computeTOF() {
    const w = weapons.find(x => x.id === state.weaponId);
    const c = cartridges.find(x => x.id === state.cartridgeId);
    if (!w || !c) return null;
    const input = buildSolverInputFor(w, c, [state.distance_m], state.weather);
    const r = Ballistics.solve(input);
    return r.rows[0]?.tof_s || null;
  }

  // — главный layout —
  const headCard = el('div', { class: 'card' });
  const modeCard = el('div', { class: 'card' });
  const resultCard = el('div', { class: 'card' });
  view.appendChild(headCard);
  view.appendChild(modeCard);
  view.appendChild(resultCard);

  function render() {
    // --- профили + дистанция ---
    headCard.innerHTML = '';
    headCard.appendChild(el('h2', {}, 'Параметры выстрела'));
    headCard.appendChild(selectInput('weaponId', 'Оружие', state.weaponId,
      [{ value: '', label: '—' }, ...weapons.map(w => ({ value: w.id, label: w.name }))]));
    headCard.appendChild(selectInput('cartridgeId', 'Патрон', state.cartridgeId,
      [{ value: '', label: '—' }, ...cartridges.map(c => ({ value: c.id, label: c.name }))]));
    const distInp = numInput('distance_m', 'Дистанция, м', state.distance_m);
    headCard.appendChild(distInp);
    headCard.addEventListener('change', () => {
      const d = readForm(headCard);
      state.weaponId = d.weaponId; state.cartridgeId = d.cartridgeId;
      state.distance_m = d.distance_m;
      save();
    });
    headCard.addEventListener('input', () => {
      const d = readForm(headCard);
      state.distance_m = d.distance_m;
      // только дистанция дёргает мгновенно, чтобы не перерисовывать всё на каждый клик
      localStorage.setItem('moving:last', JSON.stringify(state));
      flashZeroReminder(state.distance_m);
      renderResult();
    });

    // --- режим ---
    modeCard.innerHTML = '';
    const tabs = el('div', { class: 'chips' });
    for (const [v, lbl] of [['linear','Линейная цель'],['rotor','Ротор']]) {
      tabs.appendChild(el('div', { class: 'chip' + (state.mode === v ? ' active' : ''),
        onclick: () => { state.mode = v; save(); } }, lbl));
    }
    modeCard.appendChild(tabs);

    if (state.mode === 'linear') renderLinear();
    else renderRotor();
    renderResult();
  }

  // ───────── ЛИНЕЙНАЯ ─────────
  function renderLinear() {
    modeCard.appendChild(el('h2', { style: 'margin-top:14px' }, 'Скорость цели'));
    const speedTabs = el('div', { class: 'chips' });
    for (const [v, lbl] of [['mps','м/с'],['mils','mil/сек'],['stopwatch','Секундомер']]) {
      speedTabs.appendChild(el('div', { class: 'chip' + (state.speedMode === v ? ' active' : ''),
        onclick: () => { state.speedMode = v; save(); } }, lbl));
    }
    modeCard.appendChild(speedTabs);

    if (state.speedMode === 'mps') {
      const presets = el('div', { class: 'chips' });
      for (const [lbl, v] of [['пешеход 1.4', 1.4], ['бег 3.5', 3.5], ['вело 6', 6], ['авто 14', 14]]) {
        presets.appendChild(el('div', { class: 'chip', onclick: () => { state.speed_mps = v; save(); }}, lbl));
      }
      modeCard.appendChild(presets);
      const inp = el('input', { type: 'number', step: '0.1', value: state.speed_mps,
        oninput: e => { state.speed_mps = parseFloat(e.target.value) || 0; renderResult(); } });
      modeCard.appendChild(inp);
    } else if (state.speedMode === 'mils') {
      const inp = el('input', { type: 'number', step: '0.1', value: state.speed_mils,
        oninput: e => { state.speed_mils = parseFloat(e.target.value) || 0; renderResult(); } });
      modeCard.appendChild(el('label', {}, 'Угловая скорость по сетке, mil/сек'));
      modeCard.appendChild(inp);
      modeCard.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' },
        `На ${state.distance_m} м это ${fmt(state.speed_mils * state.distance_m / 1000, 1)} м/с`));
    } else {
      // секундомер
      modeCard.appendChild(el('div', { class: 'banner' },
        'Засекай: сколько миллирадиан (mil) сетки прошла цель за время Т. Например, цель прошла 5 mil за 1.3 секунды → 3.85 mil/сек.'));
      modeCard.appendChild(el('label', {}, 'Пройденное расстояние, mil'));
      const distMil = el('input', { type: 'number', step: '0.5', value: state.swDistMil ?? 5,
        oninput: e => { state.swDistMil = parseFloat(e.target.value) || 0; renderSWResult(); } });
      modeCard.appendChild(distMil);

      const time = el('div', { class: 'big-num', id: 'sw-time' }, '0.00', el('span', { class: 'unit' }, 'с'));
      modeCard.appendChild(time);
      const speedOut = el('div', { class: 'big-cap', id: 'sw-speed' }, '— mil/сек');
      modeCard.appendChild(speedOut);

      let timer = null, t0 = 0, accum = 0;
      const btnStart = el('button', { type: 'button', class: 'btn', onclick: () => {
        if (timer) {
          clearInterval(timer); timer = null;
          accum += (performance.now() - t0) / 1000;
          btnStart.textContent = 'Старт';
          state.swElapsed = accum;
          renderSWResult();
        } else {
          t0 = performance.now();
          btnStart.textContent = 'Стоп';
          timer = setInterval(() => {
            const t = accum + (performance.now() - t0) / 1000;
            time.firstChild.nodeValue = t.toFixed(2);
          }, 50);
        }
      }}, 'Старт');
      modeCard.appendChild(btnStart);
      modeCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
        if (timer) { clearInterval(timer); timer = null; }
        accum = 0; state.swElapsed = 0;
        time.firstChild.nodeValue = '0.00';
        btnStart.textContent = 'Старт';
        renderSWResult();
      }}, 'Сброс'));

      function renderSWResult() {
        const T = state.swElapsed || 0;
        const N = state.swDistMil || 0;
        if (T > 0 && N > 0) {
          state.speed_mils = N / T;
          speedOut.textContent = `${(N/T).toFixed(2)} mil/сек · ${(N * state.distance_m / 1000 / T).toFixed(1)} м/с на ${state.distance_m}м`;
        } else {
          speedOut.textContent = '— mil/сек';
        }
        renderResult();
      }
      renderSWResult();
    }

    // — угол движения —
    modeCard.appendChild(el('hr'));
    modeCard.appendChild(el('label', {}, 'Угол движения относительно линии прицеливания'));
    const angChips = el('div', { class: 'chips' });
    for (const [a, lbl] of [[0,'0° на тебя'],[30,'30°'],[45,'45°'],[60,'60°'],[90,'90° полный фланг']]) {
      angChips.appendChild(el('div', { class: 'chip' + (state.angle_deg === a ? ' active' : ''),
        onclick: () => { state.angle_deg = a; save(); }}, lbl));
    }
    modeCard.appendChild(angChips);
    modeCard.appendChild(el('div', { class: 'muted', style: 'font-size:12px' },
      'Угол 0° — цель идёт прямо на стрелка/от стрелка (lead не нужен). 90° — полный фланг (максимальный lead).'));
  }

  // ───────── РОТОР ─────────
  function renderRotor() {
    const hRow = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:14px' });
    hRow.appendChild(el('h2', { style: 'margin:0;flex:1' }, 'Параметры ротора'));
    hRow.appendChild(el('button', {
      type: 'button',
      style: 'width:36px;height:36px;border-radius:50%;background:var(--panel-2);border:1px solid var(--border);color:var(--accent);font-size:18px;font-weight:600;cursor:pointer',
      onclick: () => openRotorHelpSheet()
    }, 'i'));
    modeCard.appendChild(hRow);
    modeCard.appendChild(el('div', { class: 'banner' },
      'Поражение лопастей вращающейся мишени (например, ротор-таргет на PRS). Расчёт даёт линейную скорость кончика лопасти, lead на «3 часах» и временное окно поражения.'));
    modeCard.appendChild(el('div', { class: 'row' },
      numInput('rpm', 'Обороты, RPM', state.rpm),
      numInput('radius_m', 'Радиус, м', state.radius_m, { step: '0.05' })
    ));
    modeCard.appendChild(el('div', { class: 'row' },
      numInput('blades', 'Кол-во лопастей', state.blades),
      numInput('bladeSize_m', 'Размер лопасти, м', state.bladeSize_m, { step: '0.01' })
    ));
    modeCard.addEventListener('input', () => {
      const d = readForm(modeCard);
      Object.assign(state, {
        rpm: d.rpm, radius_m: d.radius_m, blades: d.blades, bladeSize_m: d.bladeSize_m
      });
      localStorage.setItem('moving:last', JSON.stringify(state));
      renderResult();
    });
  }

  // ───────── РЕЗУЛЬТАТ ─────────
  function renderResult() {
    resultCard.innerHTML = '';
    const tof = computeTOF();
    if (!tof) {
      resultCard.appendChild(el('div', { class: 'banner' }, 'Выбери оружие и патрон.'));
      return;
    }
    resultCard.appendChild(el('div', { class: 'kv' },
      el('div', { class: 'k' }, 'Время полёта пули'), el('div', { class: 'v' }, fmt(tof, 2) + ' с'),
      el('div', { class: 'k' }, 'Дистанция'), el('div', { class: 'v' }, state.distance_m + ' м')
    ));

    if (state.mode === 'linear') {
      let vmps = 0;
      if (state.speedMode === 'mps') vmps = state.speed_mps || 0;
      else vmps = (state.speed_mils || 0) * state.distance_m / 1000;
      const v_perp = vmps * Math.sin(state.angle_deg * Math.PI / 180);
      const lead_m = v_perp * tof;
      const lead_mil = state.distance_m > 0 ? (lead_m / state.distance_m) * 1000 : 0;
      const lead_moa = lead_mil * 3.438;
      resultCard.appendChild(el('hr'));
      resultCard.appendChild(el('div', { class: 'info-card' },
        el('div', { class: 'label' }, 'Lead (упреждение)'),
        el('div', { class: 'clock-display' }, fmt(lead_mil, 2), el('span', { style: 'font-size:14px;color:var(--muted)' }, 'mil')),
        el('div', { class: 'muted center' }, `${fmt(lead_moa, 1)} MOA · ${fmt(lead_m, 2)} м впереди цели`)
      ));
      resultCard.appendChild(el('div', { class: 'kv' },
        el('div', { class: 'k' }, 'Скорость цели'), el('div', { class: 'v' }, fmt(vmps, 2) + ' м/с'),
        el('div', { class: 'k' }, 'Перпендикулярная'), el('div', { class: 'v' }, fmt(v_perp, 2) + ' м/с'),
        el('div', { class: 'k' }, 'Угол к LOS'), el('div', { class: 'v' }, state.angle_deg + '°')
      ));
      resultCard.appendChild(el('div', { class: 'banner accent' },
        `Прицеливайся ${fmt(Math.abs(lead_mil), 2)} mil ${lead_mil >= 0 ? 'вперёд по направлению движения' : 'назад'} от цели. Удерживай при стрельбе (sustained lead) или стреляй когда цель «догонит» отметку (trapping).`));
    } else {
      // ротор
      const omega = (state.rpm * 2 * Math.PI) / 60; // рад/с
      const v_tan = omega * state.radius_m; // м/с по кончику
      const lead_m = v_tan * tof;
      const lead_mil = state.distance_m > 0 ? (lead_m / state.distance_m) * 1000 : 0;
      const windowSec = v_tan > 0 ? state.bladeSize_m / v_tan : 0;
      const periodSec = state.rpm > 0 ? 60 / state.rpm : 0;
      const bladePassesPerSec = state.blades * (state.rpm / 60);

      resultCard.appendChild(el('hr'));
      resultCard.appendChild(el('div', { class: 'info-card' },
        el('div', { class: 'label' }, 'Lead для лопасти на 3 ч.'),
        el('div', { class: 'clock-display' }, fmt(lead_mil, 2), el('span', { style: 'font-size:14px;color:var(--muted)' }, 'mil')),
        el('div', { class: 'muted center' }, `касательная скорость ${fmt(v_tan, 1)} м/с`)
      ));
      resultCard.appendChild(el('div', { class: 'kv' },
        el('div', { class: 'k' }, 'Период оборота'), el('div', { class: 'v' }, fmt(periodSec, 2) + ' с'),
        el('div', { class: 'k' }, 'Лопастей в секунду'), el('div', { class: 'v' }, fmt(bladePassesPerSec, 1)),
        el('div', { class: 'k' }, 'Окно поражения'), el('div', { class: 'v' }, fmt(windowSec * 1000, 0) + ' мс'),
        el('div', { class: 'k' }, 'TOF / окно'), el('div', { class: 'v' }, fmt(tof / Math.max(windowSec, 0.001), 1) + '×')
      ));
      const hard = tof > windowSec * 3;
      resultCard.appendChild(el('div', { class: hard ? 'banner accent' : 'banner', style: hard ? '' : 'border-color:var(--good-dim)' },
        hard
          ? `Окно поражения короче TOF в ${fmt(tof/windowSec, 0)} раз — нужен sustained lead и точный тайминг. Стреляй в момент, когда лопасть ещё не дошла до 3 ч., на ${fmt(lead_mil, 1)} mil вперёд.`
          : `Окно ≈${fmt(windowSec*1000, 0)} мс — лопасть «видна» в зоне прицеливания дольше TOF. Стандартная техника: целишься в 3 ч., стреляешь когда лопасть подходит к зоне.`));
      resultCard.appendChild(el('div', { class: 'banner' },
        'Альтернативные методики: 1) стрельба в ось вращения — для коротких лопастей лопасти «прилетают» сами; 2) сериями выстрелов — повышает шанс попасть в окно при неизвестной фазе; 3) tracking — поворот ствола за лопастью, требует много тренировки.'));
    }
  }

  render();
});

// ============== MIL-RANGING TOOL ==============
route('/mil-ranging', async () => {
  setHeader({ title: 'Мил-рейнджинг' });
  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'Дистанция по известному размеру цели'),
    el('div', { class: 'banner' },
      'Формула: дистанция = (размер цели, м × 1000) ÷ наблюдаемые mils. Удобно когда нет дальномера.')));

  const state = JSON.parse(localStorage.getItem('milRange') || '{}');
  const form = el('form', { class: 'card' });
  form.appendChild(el('label', {}, 'Высота/ширина цели (м)'));
  const presetChips = el('div', { class: 'chips' });
  for (const [lbl, v] of [['Ростовая 1.7', 1.7], ['Поясная 1.0', 1.0], ['ИПСК 0.5', 0.5], ['Голова 0.25', 0.25]]) {
    presetChips.appendChild(el('div', { class: 'chip', onclick: () => {
      form.targetSize.value = v; form.dispatchEvent(new Event('input', { bubbles: true }));
    }}, lbl));
  }
  form.appendChild(presetChips);
  form.appendChild(el('input', { id: 'targetSize', name: 'targetSize', type: 'number', step: '0.01',
    value: state.targetSize ?? 1.7, inputmode: 'decimal' }));
  form.appendChild(el('div', { class: 'row' },
    numInput('observedMils', 'Наблюдаемые mils', state.observedMils),
    numInput('observedMOA', 'либо MOA', state.observedMOA)
  ));
  const out = el('div', { class: 'info-card' });
  form.appendChild(out);

  function recalc() {
    const d = readForm(form);
    const sz = d.targetSize;
    let mils = d.observedMils;
    if (!mils && d.observedMOA) mils = d.observedMOA / 3.438;
    if (!sz || !mils || mils <= 0) {
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'label' }, 'Дистанция'));
      out.appendChild(el('div', { class: 'big-num' }, '—'));
      return;
    }
    const distM = (sz * 1000) / mils;
    out.innerHTML = '';
    out.appendChild(el('div', { class: 'label' }, 'Дистанция'));
    out.appendChild(el('div', { class: 'big-num' }, fmt(distM, 0), el('span', { class: 'unit' }, 'м')));
    out.appendChild(el('div', { class: 'muted center' },
      `${fmt(distM * 1.0936, 0)} ярдов · ${fmt(sz, 2)} м / ${fmt(mils, 2)} mil`));
    localStorage.setItem('milRange', JSON.stringify(d));
  }
  form.addEventListener('input', recalc);
  recalc();
  view.appendChild(form);

  // обратный режим: размер цели + дистанция → ожидаемые mils
  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'Обратный расчёт'),
    el('div', { class: 'banner' }, 'Размер цели + дистанция → ожидаемые mils для прицеливания/ранжирования.'),
    (() => {
      const f2 = el('form');
      f2.appendChild(el('div', { class: 'row' },
        numInput('sz', 'Размер цели, м', null, { step: '0.01' }),
        numInput('dist', 'Дистанция, м', null)
      ));
      const out2 = el('div', { class: 'info-card' });
      f2.appendChild(out2);
      f2.addEventListener('input', () => {
        const d = readForm(f2);
        if (!d.sz || !d.dist) { out2.innerHTML = ''; return; }
        const mils = (d.sz * 1000) / d.dist;
        const moa = mils * 3.438;
        out2.innerHTML = '';
        out2.appendChild(el('div', { class: 'label' }, 'Ожидаемые mils'));
        out2.appendChild(el('div', { class: 'big-num' }, fmt(mils, 2), el('span', { class: 'unit' }, 'mil')));
        out2.appendChild(el('div', { class: 'muted center' }, fmt(moa, 1) + ' MOA'));
      });
      return f2;
    })()
  ));
});

// ============== SETTINGS ==============
route('/settings', async () => {
  setHeader({ title: 'Настройки' });

  // — настройки приложения —
  const prefsCard = el('div', { class: 'card' });
  prefsCard.appendChild(el('h2', {}, 'Предупреждения и режимы'));

  const zr = el('label', { class: 'checkbox', style: 'padding:12px 0' });
  const zrCb = el('input', { type: 'checkbox' });
  zrCb.checked = isZeroReminderOn();
  zrCb.addEventListener('change', () => { setZeroReminderOn(zrCb.checked); toast(zrCb.checked ? 'Напоминание включено' : 'Выключено'); });
  zr.appendChild(zrCb);
  zr.appendChild(el('span', { class: 'lbl' }, '«ОБНУЛИ БАРАБАНЧИКИ» при смене дистанции',
    el('span', { class: 'sub' }, 'Полноэкранный красный flash, чтобы не забыть сбросить барабаны прицела перед накруткой новой поправки')));
  prefsCard.appendChild(zr);

  const hud = el('label', { class: 'checkbox', style: 'padding:12px 0' });
  const hudCb = el('input', { type: 'checkbox' });
  hudCb.checked = isHudOn();
  hudCb.addEventListener('change', () => { setHudOn(hudCb.checked); toast(hudCb.checked ? 'HUD-режим вкл.' : 'выкл.'); });
  hud.appendChild(hudCb);
  hud.appendChild(el('span', { class: 'lbl' }, 'HUD-режим (увеличенный шрифт результатов)',
    el('span', { class: 'sub' }, 'Для быстрого чтения mil-поправки при ярком солнце')));
  prefsCard.appendChild(hud);

  view.appendChild(prefsCard);

  // — устройства —
  const devicesCard = el('div', { class: 'card' });
  devicesCard.appendChild(el('h2', {}, 'Устройства'));
  if (!BT.supported()) {
    devicesCard.appendChild(el('div', { class: 'banner' },
      'Web Bluetooth недоступен. Нужен Chrome/Edge на Android и HTTPS-соединение. iOS не поддерживается.'));
  } else {
    devicesCard.appendChild(el('div', { class: 'banner' },
      'Совместимость: Kestrel 5700/5500 (метеостанция) и SIG KILO 8K (дальномер BDX). ' +
      'Протоколы закрытые — если данные парсятся неверно, открой debug-вывод и подстрой оффсеты.'));
    devicesCard.appendChild(el('div', { class: 'split', style: 'gap:8px;display:flex' },
      el('button', { type: 'button', class: 'btn outline', onclick: () => connectAndRefresh(DeviceProfiles.KESTREL_5700) }, '🌬 Kestrel'),
      el('button', { type: 'button', class: 'btn outline', onclick: () => connectAndRefresh(DeviceProfiles.SIG_KILO_BDX) }, '🎯 SIG KILO')
    ));
    devicesCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      try {
        const c = await BT.connect({ id: 'scan', label: 'Любое BLE', services: [] });
        toast('Подключено: ' + c.device.name);
        navigate();
      } catch (e) { toast('Отмена: ' + e.message); }
    }}, '🔍 Сканировать любое устройство'));
    // список подключённых
    const connList = el('div', { style: 'margin-top:10px' });
    devicesCard.appendChild(connList);
    function rebuildConnList() {
      connList.innerHTML = '';
      const conns = [...BT.connections.values()];
      if (conns.length === 0) { connList.appendChild(el('div', { class: 'muted' }, 'Нет подключённых')); return; }
      for (const c of conns) {
        const profile = Object.values(DeviceProfiles).find(p => p.id === c.profileId);
        const item = el('div', { class: 'list-item' });
        item.appendChild(el('div', { class: 'ttl' }, (c.device.name || '?') + ' · ' + (profile?.label || c.profileId)));
        const dataLine = c.lastData ? Object.entries(c.lastData).filter(([k]) => !k.startsWith('_') && k !== 'ts').map(([k,v]) => `${k}: ${typeof v === 'number' ? v.toFixed(1) : v}`).join(' · ') : 'нет данных';
        item.appendChild(el('div', { class: 'sub' }, dataLine));
        if (c.lastData?._raw) {
          item.appendChild(el('div', { class: 'muted', style: 'font-family:monospace;font-size:11px;word-break:break-all' }, 'raw: ' + c.lastData._raw));
        }
        item.appendChild(el('div', { style: 'display:flex;gap:6px;margin-top:8px' },
          el('button', { type: 'button', class: 'btn ghost', style: 'margin:0', onclick: async () => {
            const dump = await BT.dumpServices(c.device.id);
            if (!dump) return;
            openSheet((sh, close) => {
              sh.appendChild(el('h3', {}, 'Сервисы устройства'));
              for (const s of dump) {
                sh.appendChild(el('div', { class: 'muted', style: 'font-family:monospace;font-size:11px;margin-top:8px' }, s.uuid));
                for (const ch of s.chars) {
                  sh.appendChild(el('div', { style: 'font-family:monospace;font-size:11px;padding-left:12px' },
                    ch.uuid + ' [' + ch.props.join(',') + ']' + (ch.value_hex ? ' = ' + ch.value_hex : '')));
                }
              }
              sh.appendChild(el('button', { type: 'button', class: 'btn', onclick: close }, 'OK'));
            });
          }}, 'Debug'),
          el('button', { type: 'button', class: 'btn ghost', style: 'margin:0', onclick: async () => {
            if (profile) openParserOverrideSheet(profile);
          }}, 'Парсер'),
          el('button', { type: 'button', class: 'btn danger', style: 'margin:0', onclick: async () => {
            await BT.disconnect(c.device.id); navigate();
          }}, '✕')
        ));
        connList.appendChild(item);
      }
    }
    rebuildConnList();
    BT.subscribe(() => rebuildConnList());
  }
  view.appendChild(devicesCard);

  // — компас тест —
  if (Compass.supported()) {
    const compCard = el('div', { class: 'card' });
    compCard.appendChild(el('h2', {}, 'Компас и тилт-датчик'));
    const mini = createMiniCompass(80);
    const kv = el('div', { class: 'kv' });
    function updateKv(s) {
      kv.innerHTML = '';
      kv.appendChild(el('div', { class: 'k' }, 'Азимут'));
      kv.appendChild(el('div', { class: 'v' }, (s.heading?.toFixed(0) ?? '—') + '°' + (s.absolute ? '' : ' (rel)')));
      kv.appendChild(el('div', { class: 'k' }, 'Завал (gamma)'));
      kv.appendChild(el('div', { class: 'v' }, (s.cant?.toFixed(1) ?? '—') + '°'));
      kv.appendChild(el('div', { class: 'k' }, 'Тангаж (beta)'));
      kv.appendChild(el('div', { class: 'v' }, (s.pitch?.toFixed(1) ?? '—') + '°'));
    }
    updateKv(Compass.state);
    compCard.appendChild(el('div', { style: 'display:flex;gap:14px;align-items:center' }, mini.svg, kv));
    compCard.appendChild(el('button', { type: 'button', class: 'btn outline', onclick: async () => {
      try { await Compass.start(); Compass.subscribe(s => { mini.setHeading(s.heading); updateKv(s); }); toast('Включён'); }
      catch (e) { toast(e.message); }
    }}, '📱 Включить'));
    view.appendChild(compCard);
  }

  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'Данные'),
    el('div', { class: 'banner' }, 'Все записи хранятся локально в браузере. Регулярно делай экспорт.'),
    el('button', { type: 'button', class: 'btn', onclick: async () => {
      const p = await Store.exportAll();
      const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'skyrange-' + new Date().toISOString().slice(0,10) + '.json';
      a.click(); URL.revokeObjectURL(url);
    }}, '⬇ Экспорт JSON'),
    el('input', { type: 'file', accept: 'application/json', id: 'imp', style: 'display:none', onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { await Store.importAll(JSON.parse(await f.text())); toast('Импортировано'); navigate(); }
      catch (err) { alert('Ошибка: ' + err.message); }
    }}),
    el('button', { type: 'button', class: 'btn ghost', onclick: () => $('#imp').click() }, '⬆ Импорт JSON')
  ));

  // — Auto-backup в публичную папку /Documents/BalisticNote/backup.json —
  if (window.Backup) {
    const backupCard = el('div', { class: 'card' });
    backupCard.appendChild(el('h2', {}, 'Авто-бэкап в /Documents (пережит удаление APK)'));
    const statusEl = el('div', { class: 'muted center', style: 'font-size:12px;margin:6px 0' }, '…');
    backupCard.appendChild(statusEl);
    backupCard.appendChild(el('div', { class: 'banner' },
      'Каждое изменение автоматически дублируется в файл /storage/emulated/0/Documents/BalisticNote/backup.json. ' +
      'Этот файл переживает удаление приложения, поэтому при переустановке данные восстановятся одним тапом.'));
    backupCard.appendChild(el('button', { type: 'button', class: 'btn', onclick: async () => {
      const r = await Backup.save();
      if (r.ok) toast(`Сохранено: ${r.size||'?'} байт`);
      else toast('Ошибка: ' + r.reason);
      refresh();
    }}, '💾 Сохранить бэкап сейчас'));
    backupCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (!confirm('Восстановить базу данных из /Documents/BalisticNote/backup.json?\nТекущие записи будут перезаписаны при совпадении ID.')) return;
      const r = await Backup.restore();
      if (r.ok) { toast('Восстановлено (snapshot ' + (r.exportedAt?.slice(0,16) || '—') + ')'); navigate(); }
      else toast('Ошибка: ' + r.reason);
    }}, '⤵ Восстановить из /Documents'));
    async function refresh() {
      try {
        if (await Backup.exists()) {
          const F = window.Capacitor?.Plugins?.Filesystem;
          const stat = F ? await F.stat({ path: 'BalisticNote/backup.json', directory: 'DOCUMENTS' }) : null;
          const when = stat?.mtime ? new Date(stat.mtime).toLocaleString() : '—';
          const kb = stat?.size ? (stat.size / 1024).toFixed(1) + ' KB' : '—';
          statusEl.textContent = `✓ Бэкап есть · ${kb} · обновлён ${when}`;
        } else if (!window.Capacitor?.isNativePlatform?.()) {
          statusEl.textContent = 'Auto-backup работает только в нативном APK (не в браузере)';
        } else {
          statusEl.textContent = 'Бэкапа пока нет — нажми «Сохранить сейчас»';
        }
      } catch (e) { statusEl.textContent = 'Статус: ' + e.message; }
    }
    refresh();
    view.appendChild(backupCard);
  }

  // — Яндекс.Диск sync —
  if (window.Yadisk) {
    const ydCard = el('div', { class: 'card' });
    ydCard.appendChild(el('h2', {}, 'Яндекс.Диск — авто-синхронизация'));
    const ydStatus = el('div', { class: 'muted center', style: 'font-size:12px;margin:6px 0' }, '…');
    ydCard.appendChild(ydStatus);
    ydCard.appendChild(el('div', { class: 'banner' },
      'После настройки каждое изменение базы данных дублируется в /BalisticNote/backup.json на твоём Яндекс.Диске. ' +
      'При установке приложения на другой телефон или после переустановки — данные подтянутся автоматически.'));

    // — поле Client ID —
    const cidInp = el('input', { type: 'text', placeholder: '12 знаков из oauth.yandex.ru', value: Yadisk.getClientId() });
    ydCard.appendChild(el('label', { for: '' }, 'Client ID (OAuth-приложение)'));
    ydCard.appendChild(cidInp);
    cidInp.addEventListener('change', () => Yadisk.setClientId(cidInp.value.trim()));

    // — кнопка получить токен —
    ydCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
      const cid = cidInp.value.trim();
      if (!cid) { toast('Сначала укажи Client ID'); return; }
      Yadisk.setClientId(cid);
      const url = Yadisk.getAuthUrl();
      window.open(url, '_blank');
      toast('Откроется страница Яндекса. Разреши доступ и скопируй access_token из URL.');
    }}, '🔑 Получить токен на oauth.yandex.ru'));

    // — поле токена —
    const tokInp = el('input', { type: 'password', placeholder: 'y0_AgAAAA... (вставь сюда)', value: Yadisk.getToken() });
    ydCard.appendChild(el('label', { for: '' }, 'Access Token'));
    ydCard.appendChild(tokInp);

    // — кнопки —
    ydCard.appendChild(el('button', { type: 'button', class: 'btn', onclick: async () => {
      Yadisk.setToken(tokInp.value.trim());
      try {
        const i = await Yadisk.info();
        toast(`Подключён: ${i.user?.display_name || i.user?.login || 'OK'} (${(i.used_space/1e9).toFixed(2)} / ${(i.total_space/1e9).toFixed(0)} ГБ занято)`);
        refreshYD();
      } catch (e) { toast('Ошибка: ' + e.message); }
    }}, '✅ Проверить токен'));
    ydCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (!Yadisk.isConfigured()) { toast('Сначала введи токен и проверь'); return; }
      try {
        const r = await Backup.uploadToYandex();
        if (r.ok) toast('Залито на Я.Диск');
        else toast('Ошибка: ' + r.reason);
        refreshYD();
      } catch (e) { toast('Ошибка: ' + e.message); }
    }}, '↑ Залить на Я.Диск сейчас'));
    ydCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (!Yadisk.isConfigured()) { toast('Сначала введи токен и проверь'); return; }
      if (!confirm('Скачать /BalisticNote/backup.json с Я.Диска и применить?\nТекущие записи будут перезаписаны при совпадении ID.')) return;
      try {
        const r = await Backup.restore('yandex');
        if (r.ok) { toast('Восстановлено с Я.Диска'); navigate(); }
        else toast('Ошибка: ' + r.reason);
      } catch (e) { toast('Ошибка: ' + e.message); }
    }}, '↓ Скачать и применить с Я.Диска'));
    ydCard.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: () => {
      if (!confirm('Удалить локальные настройки Я.Диска (токен и client_id)?')) return;
      Yadisk.setToken(''); Yadisk.setClientId('');
      tokInp.value = ''; cidInp.value = '';
      toast('Сброшено'); refreshYD();
    }}, 'Отвязать'));

    // — встроенная памятка (всегда видна) —
    ydCard.appendChild(el('div', { class: 'help-card' },
      el('div', { class: 'help-title' }, '📖 Памятка по настройке (≈2 минуты, один раз)'),
      h(`<ol class="help-steps">
        <li><b>Создай OAuth-приложение.</b> На любом устройстве открой
            <code>oauth.yandex.ru/client/new</code> (Яндекс ID, кнопка «Зарегистрировать новое приложение»).</li>
        <li><b>Заполни форму.</b>
          <ul>
            <li>Название: <i>BalisticNote backup</i> (любое)</li>
            <li>Платформа: <b>Веб-сервисы</b></li>
            <li>Redirect URI: <code>https://oauth.yandex.ru/verification_code</code></li>
            <li>Доступ → блок «Яндекс.Диск REST API» → отметь <b>3 галочки</b>:
              <code>cloud_api:disk.write</code>, <code>cloud_api:disk.read</code>, <code>cloud_api:disk.info</code></li>
          </ul>
        </li>
        <li><b>Скопируй Client ID.</b> Появится 32-символьная строка в карточке приложения → вставь её в поле <b>Client ID</b> выше и тапни вне поля (значение сохранится).</li>
        <li><b>Тапни «🔑 Получить токен».</b> Откроется страница Яндекс ID — войди в свой аккаунт, разреши приложению доступ к Диску.</li>
        <li><b>Найди токен в URL.</b> После «Разрешить» Яндекс редиректит на страницу с длинным URL вида:
          <div class="code-block">https://oauth.yandex.ru/verification_code#<b>access_token=y0_AgAAAA...очень_длинная_строка</b>&token_type=bearer&expires_in=...</div>
          Скопируй значение между <code>access_token=</code> и первым <code>&</code> (это и есть токен, начинается на <code>y0_</code>).
          <br><i>На некоторых браузерах Яндекс показывает токен сразу в виде кода подтверждения на странице — копируй его.</i></li>
        <li><b>Вставь токен.</b> В поле «Access Token» выше → тапни «✅ Проверить токен» — появится тост с твоим логином и занятым местом на Диске.</li>
        <li><b>Готово.</b> С этого момента каждое изменение базы (debounced ~2 сек) уходит в <code>Disk:/BalisticNote/backup.json</code>. После переустановки приложение само спросит «Найден бэкап в Я.Диске, восстановить?».</li>
      </ol>
      <div class="help-tip">
        <b>Зачем это надо.</b> Локальный бэкап в <code>/Documents/</code> на телефоне отлично работает, но если ты сменишь телефон или потеряешь его — данные не вернуть.
        Яндекс.Диск держит копию в облаке и доступен с любого устройства.
        <b>Токен живёт 1 год</b>; за неделю до истечения Я.Диск пришлёт уведомление — обновишь через ту же процедуру.
      </div>
      <div class="help-tip">
        <b>Безопасность.</b> Токен хранится только локально (в браузерном <code>localStorage</code>) и в экспорте JSON не сохраняется. Если потерял телефон — отзови токен на <code>id.yandex.ru/security/oauth</code>.
      </div>`)
    ));

    // — отдельная кнопка для полноэкранной памятки —
    ydCard.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => openSheet((sheet, close) => {
      sheet.appendChild(el('h3', {}, 'Подробная инструкция'));
      sheet.appendChild(el('div', { class: 'sub' }, 'Подключение Яндекс.Диска к BalisticNote'));
      const body = el('div', { style: 'max-height:65vh;overflow-y:auto;padding-right:6px;line-height:1.55;font-size:14px' });
      body.innerHTML = `
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Шаг 1 — Регистрация OAuth-приложения</h4>
        <p>В браузере открой <a href="https://oauth.yandex.ru/client/new" target="_blank" style="color:var(--accent)">oauth.yandex.ru/client/new</a>. Авторизуйся через свой Яндекс ID.</p>
        <p>В форме создания приложения:</p>
        <ul>
          <li><b>Название</b>: «BalisticNote backup» (или любое)</li>
          <li><b>Иконка</b>: можно пропустить</li>
          <li><b>Платформа</b>: выбери <b>Веб-сервисы</b></li>
          <li><b>Redirect URI</b>: <code>https://oauth.yandex.ru/verification_code</code> (скопируй и вставь точно так)</li>
        </ul>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Шаг 2 — Права доступа</h4>
        <p>В разделе «Доступ» найди блок <b>«Яндекс.Диск REST API»</b> и отметь три галочки:</p>
        <ul>
          <li><code>cloud_api:disk.write</code> — запись файлов</li>
          <li><code>cloud_api:disk.read</code> — чтение файлов</li>
          <li><code>cloud_api:disk.info</code> — информация о диске (нужно для «Проверить токен»)</li>
        </ul>
        <p>Другие галочки не нужны. Тапни «Создать приложение».</p>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Шаг 3 — Client ID</h4>
        <p>В карточке только что созданного приложения скопируй <b>ClientID</b> (32 символа). Вернись в приложение и вставь его в поле «Client ID». Тапни вне поля чтобы значение сохранилось.</p>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Шаг 4 — Получение токена</h4>
        <p>В приложении тапни «🔑 Получить токен». Откроется страница Яндекс ID. Авторизуйся (если ещё не вошёл), нажми «Разрешить».</p>
        <p>Яндекс редиректит на длинный URL вида:</p>
        <pre style="background:#000;padding:8px;border-radius:6px;font-size:11px;overflow-x:auto">
https://oauth.yandex.ru/verification_code#access_token=y0_AgAAAAB...&token_type=bearer&expires_in=31536000</pre>
        <p>Скопируй значение токена — то, что идёт <b>после</b> <code>access_token=</code> и <b>до</b> первого <code>&</code>. Он начинается на <code>y0_</code> и довольно длинный (~90 символов).</p>
        <p><i>Альтернатива:</i> на некоторых телефонах Яндекс показывает «код подтверждения» прямо на странице — это и есть токен, его и копируй.</p>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Шаг 5 — Применение</h4>
        <p>Вставь токен в поле «Access Token», тапни «✅ Проверить токен». Должен появиться тост с твоим логином Яндекса и занятым/общим местом на Диске.</p>
        <p>Тапни «↑ Залить на Я.Диск сейчас» — создастся файл <code>/BalisticNote/backup.json</code>.</p>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Что дальше</h4>
        <ul>
          <li>Каждое изменение базы (новый патрон, выстрел, заметка) автоматически отправляется на Я.Диск через ~2 секунды</li>
          <li>На новом телефоне после установки → при первом запуске спросит «Найден бэкап на Я.Диске, восстановить?» (если токен задан)</li>
          <li>Если хочешь принудительно подтянуть свежее с Диска — «↓ Скачать и применить с Я.Диска»</li>
        </ul>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Срок жизни токена</h4>
        <p>По умолчанию <b>1 год</b>. За 7 дней до истечения Яндекс пришлёт уведомление. Чтобы продлить — просто повтори Шаг 4.</p>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Безопасность и отзыв доступа</h4>
        <ul>
          <li>Токен хранится только в <code>localStorage</code> WebView — НЕ попадает в экспорт JSON</li>
          <li>Если потерял телефон — отзови токен через <a href="https://id.yandex.ru/security/oauth" target="_blank" style="color:var(--accent)">id.yandex.ru/security/oauth</a> → «Выйти из всех сессий приложения»</li>
          <li>Приложение видит ТОЛЬКО твой Диск — других данных аккаунта не получает</li>
        </ul>
        <h4 style="color:var(--accent);margin:14px 0 6px;letter-spacing:1px">Решение проблем</h4>
        <ul>
          <li><b>«401» или «invalid token»</b> — токен просрочен или отозван, повтори Шаг 4</li>
          <li><b>«403 Forbidden»</b> — забыл отметить нужные права в Шаге 2 — пересоздай приложение</li>
          <li><b>«Сначала укажи Client ID»</b> — поле Client ID пустое, заполни и тапни вне поля</li>
          <li><b>Тост «Подключён» приходит, но «Залить» падает</b> — проверь, что не закончилось место на Диске</li>
        </ul>
      `;
      sheet.appendChild(body);
      sheet.appendChild(el('button', { type: 'button', class: 'btn', onclick: close }, 'Понятно, закрыть'));
    })}, '📖 Полная памятка (sheet)'));

    async function refreshYD() {
      try {
        if (!Yadisk.isConfigured()) {
          ydStatus.textContent = 'Не настроен — введи Client ID и токен ниже';
          return;
        }
        const stat = await Yadisk.statBackup();
        if (stat) {
          const when = new Date(stat.modified).toLocaleString();
          const kb = (stat.size / 1024).toFixed(1) + ' KB';
          ydStatus.textContent = `✓ /BalisticNote/backup.json · ${kb} · обновлён ${when}`;
        } else {
          ydStatus.textContent = '✓ токен валиден, но файла бэкапа ещё нет';
        }
      } catch (e) { ydStatus.textContent = 'Ошибка: ' + e.message; }
    }
    refreshYD();
    view.appendChild(ydCard);
  }

  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'О приложении'),
    el('div', { class: 'muted', style: 'line-height:1.5' },
      'Полноценный баллистический калькулятор (G1/G7) и журнал стрельб. Работает офлайн. ',
      'Для установки на главный экран: Chrome → меню → «Добавить на главный экран», Safari → «Поделиться» → «На экран Домой».')
  ));
});

// ============== CASE PREPS (Wave 2.4) ==============
route('/casepreps', async () => {
  setHeader({ title: 'Подготовка гильз' });
  const items = await Store.getAll('casePreps');
  const cartridges = await Store.getAll('cartridges');
  const cartName = id => cartridges.find(c => c.id === id)?.name || '—';
  if (!items.length) view.appendChild(el('div', { class: 'banner' }, 'Нет ни одной записи подготовки. Создай первую.'));
  for (const cp of items.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''))) {
    view.appendChild(el('a', { class: 'list-item', href: '#/caseprep/' + cp.id },
      el('div', { class: 'ttl' }, cp.name || ('Цикл ' + (cp.cycleNum ?? '?'))),
      el('div', { class: 'sub' },
        `${cartName(cp.cartridgeId)} · цикл ${cp.cycleNum ?? '?'} · ${cp.annealed ? 'отжиг ✓' : 'без отжига'}` +
        (cp.cbto_in ? ` · CBTO ${cp.cbto_in}"` : '')
      )
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/caseprep/new' }, '+'));
});
route('/caseprep/:id', async ({ id }) => {
  const isNew = id === 'new';
  const cp = isNew ? { id: Store.uid() } : await Store.get('casePreps', id);
  if (!cp) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новый цикл подготовки' : (cp.name || 'Цикл подготовки') });
  const cartridges = await Store.getAll('cartridges');
  const f = el('form', { class: 'card' });
  f.appendChild(textInput('name', 'Название', cp.name));
  f.appendChild(el('div', { class: 'row' },
    selectInput('cartridgeId', 'Патрон', cp.cartridgeId || '',
      [{ value: '', label: '—' }, ...cartridges.map(c => ({ value: c.id, label: c.name }))]),
    numInput('cycleNum', 'Номер цикла', cp.cycleNum)
  ));
  f.appendChild(el('label', { class: 'checkbox' },
    el('input', { type: 'checkbox', name: 'annealed', checked: cp.annealed ? true : undefined }),
    el('span', { class: 'lbl' }, 'Отжиг шейки выполнен')
  ));
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Матрицы и геометрия'));
  f.appendChild(el('div', { class: 'row' },
    textInput('fl_die', 'FL-die (бренд/модель)', cp.fl_die),
    numInput('bushing_in', 'Bushing, in', cp.bushing_in, { step: '0.001' })
  ));
  f.appendChild(el('div', { class: 'row' },
    textInput('neck_turning', 'Проточка дульца', cp.neck_turning),
    numInput('trim_length_in', 'Длина после подрезки, in', cp.trim_length_in, { step: '0.001' })
  ));
  f.appendChild(el('div', { class: 'row' },
    textInput('mandrel', 'Mandrel', cp.mandrel),
    textInput('primer_seating', 'Посадка капса', cp.primer_seating)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('coal_in', 'COAL, in', cp.coal_in, { step: '0.001' }),
    numInput('cbto_in', 'CBTO, in', cp.cbto_in, { step: '0.001' })
  ));
  f.appendChild(numInput('die_height_mm', 'Высота головки матрицы, мм', cp.die_height_mm, { step: '0.01' }));
  f.appendChild(el('hr'));
  f.appendChild(el('label', { for: 'notes' }, 'Заметки и наблюдения'));
  f.appendChild(el('textarea', { id: 'notes', name: 'notes' }, cp.notes || ''));
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Фото мишени (опц.)'));
  const targetPreview = el('div', { style: 'text-align:center;margin:8px 0' });
  if (cp.targetImageDataUrl) {
    targetPreview.appendChild(el('img', { src: cp.targetImageDataUrl,
      style: 'max-width:100%;max-height:240px;border:1px solid var(--border);border-radius:8px' }));
  }
  f.appendChild(targetPreview);
  let pendingTargetImage = cp.targetImageDataUrl || null;
  f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
    try {
      const dataUrl = await pickImageDataUrl();
      if (dataUrl) {
        pendingTargetImage = dataUrl;
        targetPreview.innerHTML = '';
        targetPreview.appendChild(el('img', { src: dataUrl,
          style: 'max-width:100%;max-height:240px;border:1px solid var(--border);border-radius:8px' }));
        toast('Фото загружено');
      }
    } catch (e) { toast('Ошибка: ' + e.message); }
  }}, '📷 Загрузить фото мишени'));
  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сохранить'));
  if (!isNew) f.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
    if (confirm('Удалить?')) { await Store.del('casePreps', id); location.hash = '#/casepreps'; }
  }}, 'Удалить'));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(f);
    await Store.put('casePreps', { ...cp, ...d, targetImageDataUrl: pendingTargetImage });
    toast('Сохранено'); location.hash = '#/casepreps';
  });
  view.appendChild(f);
});

// helper: pickImageDataUrl — Capacitor Camera + fallback на input[type=file]
async function pickImageDataUrl() {
  if (window.Capacitor?.Plugins?.Camera) {
    const Camera = window.Capacitor.Plugins.Camera;
    const photo = await Camera.getPhoto({
      quality: 70, resultType: 'dataUrl', source: 'PROMPT', allowEditing: false,
      promptLabelHeader: 'Источник', promptLabelPhoto: 'Из галереи', promptLabelPicture: 'Камера'
    });
    return photo?.dataUrl || null;
  }
  return await new Promise(resolve => {
    const inp = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    document.body.appendChild(inp); inp.click();
    setTimeout(() => inp.remove(), 60000);
  });
}

// ============== NOTES (Wave 2.5) ==============
route('/notes', async () => {
  setHeader({ title: 'Заметки' });
  const items = await Store.getAll('notes');
  const cartridges = await Store.getAll('cartridges');
  const weapons = await Store.getAll('weapons');
  const ranges = await Store.getAll('ranges');
  function attachedLabel(n) {
    if (n.attachedType === 'cartridge') return '🎯 ' + (cartridges.find(x => x.id === n.attachedId)?.name || '—');
    if (n.attachedType === 'weapon')    return '🔫 ' + (weapons.find(x => x.id === n.attachedId)?.name || '—');
    if (n.attachedType === 'range')     return '🗺 ' + (ranges.find(x => x.id === n.attachedId)?.name || '—');
    return '';
  }
  if (!items.length) view.appendChild(el('div', { class: 'banner' }, 'Заметок нет. Создай первую.'));
  for (const n of items.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''))) {
    view.appendChild(el('a', { class: 'list-item', href: '#/note/' + n.id },
      el('div', { class: 'ttl' }, n.title || 'Без названия'),
      el('div', { class: 'sub' },
        [attachedLabel(n), (n.tags || []).join(' · ')].filter(Boolean).join(' · ') || '—')
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/note/new' }, '+'));
});
route('/note/:id', async ({ id }) => {
  const isNew = id === 'new';
  const n = isNew ? { id: Store.uid() } : await Store.get('notes', id);
  if (!n) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новая заметка' : (n.title || 'Заметка') });
  const cartridges = await Store.getAll('cartridges');
  const weapons = await Store.getAll('weapons');
  const ranges = await Store.getAll('ranges');
  const f = el('form', { class: 'card' });
  f.appendChild(textInput('title', 'Заголовок', n.title));
  f.appendChild(el('label', { for: 'body' }, 'Текст заметки'));
  f.appendChild(el('textarea', { id: 'body', name: 'body', style: 'min-height:160px' }, n.body || ''));
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Прикрепление'));
  f.appendChild(selectInput('attachedType', 'Тип', n.attachedType || '',
    [{value:'', label:'— не прикреплена —'},
     {value:'cartridge', label:'Патрон'},
     {value:'weapon', label:'Оружие'},
     {value:'range', label:'Полигон'}]));
  const attachWrap = el('div');
  f.appendChild(attachWrap);
  function rebuildAttach() {
    attachWrap.innerHTML = '';
    const t = f.attachedType.value;
    const src = t === 'cartridge' ? cartridges : t === 'weapon' ? weapons : t === 'range' ? ranges : [];
    if (!t) return;
    attachWrap.appendChild(selectInput('attachedId', 'Объект', n.attachedId || '',
      [{ value: '', label: '— выбери —' }, ...src.map(x => ({ value: x.id, label: x.name || x.id }))]));
  }
  f.attachedType.addEventListener('change', rebuildAttach);
  rebuildAttach();
  f.appendChild(textInput('tagsRaw', 'Теги (через запятую)', (n.tags || []).join(', ')));
  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сохранить'));
  if (!isNew) f.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
    if (confirm('Удалить?')) { await Store.del('notes', id); location.hash = '#/notes'; }
  }}, 'Удалить'));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(f);
    d.tags = (d.tagsRaw || '').split(',').map(s => s.trim()).filter(Boolean);
    delete d.tagsRaw;
    if (!d.attachedType) { d.attachedType = null; d.attachedId = null; }
    await Store.put('notes', { ...n, ...d });
    toast('Сохранено'); location.hash = '#/notes';
  });
  view.appendChild(f);
});

// ============== ATMO PRESETS (Wave 3.1) ==============
function loadAtmoPresets() {
  try { return JSON.parse(localStorage.getItem('atmoPresets') || '[]'); } catch { return []; }
}
function saveAtmoPresets(arr) { localStorage.setItem('atmoPresets', JSON.stringify(arr)); }
route('/atmo-presets', async () => {
  setHeader({ title: 'Атмо-пресеты' });
  const presets = loadAtmoPresets();
  view.appendChild(el('div', { class: 'banner' },
    'Сохрани атмо-снепшот «утро на МФОЦ» или «зимой в Подмосковье» — применяй одной кнопкой в Калькуляторе.'));
  if (!presets.length) view.appendChild(el('div', { class: 'card muted center' }, 'Пресетов нет'));
  for (const p of presets) {
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'ttl' }, p.name));
    card.appendChild(el('div', { class: 'kv', style: 'font-size:13px' },
      el('div', { class: 'k' }, 'T / P / RH'),
      el('div', { class: 'v' }, `${p.tempC}°C · ${p.pressureMbar} гПа · ${p.humidity}%`),
      el('div', { class: 'k' }, 'Ветер'),
      el('div', { class: 'v' }, `${p.windSpeed ?? 0} м/с @ ${p.windAngle_deg ?? 0}°`)
    ));
    card.appendChild(el('div', { class: 'row-btn', style: 'margin-top:10px' },
      el('button', { type: 'button', class: 'btn', onclick: () => {
        const cur = JSON.parse(localStorage.getItem('calc:last') || '{}');
        Object.assign(cur, {
          tempC: p.tempC, pressureMbar: p.pressureMbar, humidity: p.humidity,
          windSpeed: p.windSpeed, windAngle_deg: p.windAngle_deg
        });
        localStorage.setItem('calc:last', JSON.stringify(cur));
        toast('Применено');
        location.hash = '#/calc';
      }}, 'Применить'),
      el('button', { type: 'button', class: 'btn danger', onclick: () => {
        if (!confirm('Удалить?')) return;
        const next = loadAtmoPresets().filter(x => x.id !== p.id);
        saveAtmoPresets(next); navigate();
      }}, 'Удалить')
    ));
    view.appendChild(card);
  }
  view.appendChild(el('button', { class: 'btn', onclick: () => {
    const name = prompt('Название пресета (например, «утро на МФОЦ»)');
    if (!name) return;
    const cur = JSON.parse(localStorage.getItem('calc:last') || '{}');
    const p = {
      id: Store.uid(), name,
      tempC: cur.tempC ?? 15, pressureMbar: cur.pressureMbar ?? 1013, humidity: cur.humidity ?? 50,
      windSpeed: cur.windSpeed ?? 0, windAngle_deg: cur.windAngle_deg ?? 90,
      savedAt: new Date().toISOString()
    };
    const next = [...loadAtmoPresets(), p];
    saveAtmoPresets(next); navigate();
  }}, '＋ Снепшот текущей атмо из Калькулятора'));
});

// ============== SPOTTING CORRECTIONS (Wave 3.2) — sheet, вызывается из /calc ==============
function openSpottingSheet(currentDropMil, currentDriftMil, dist) {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h3', {}, 'Промах — поправка'));
    sheet.appendChild(el('div', { class: 'sub' }, `Дистанция ${dist} м, текущая поправка V ${fmt(currentDropMil,2)} mil, H ${fmt(currentDriftMil,2)} mil`));
    sheet.appendChild(el('div', { class: 'banner' },
      'Куда УШЛА пуля относительно цели. ВВЕРХ +, ВНИЗ −, ВПРАВО +, ВЛЕВО −. Приложение посчитает новую поправку.'));
    sheet.appendChild(el('div', { class: 'row' },
      numInput('vertMissMil', 'Вертикаль (mil)', 0, { step: '0.1' }),
      numInput('horizMissMil', 'Горизонталь (mil)', 0, { step: '0.1' })
    ));
    const result = el('div', { class: 'card', style: 'margin-top:10px' });
    sheet.appendChild(result);
    function recalc() {
      const d = readForm(sheet);
      const newDrop = currentDropMil - (d.vertMissMil || 0);
      const newDrift = currentDriftMil - (d.horizMissMil || 0);
      result.innerHTML = '';
      result.appendChild(el('div', { class: 'kv' },
        el('div', { class: 'k' }, 'Новая вертикаль'),
        el('div', { class: 'v accent' }, fmt(newDrop, 2) + ' mil'),
        el('div', { class: 'k' }, 'Новая горизонталь'),
        el('div', { class: 'v accent' }, fmt(newDrift, 2) + ' mil')
      ));
    }
    sheet.addEventListener('input', recalc);
    recalc();
    sheet.appendChild(el('div', { class: 'row-btn' },
      el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Закрыть')
    ));
  });
}

// ============== WEZ MONTE CARLO (Wave 3.3) ==============
function gaussN() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
route('/wez', async () => {
  setHeader({ title: 'WEZ Monte Carlo' });
  const cartridges = await Store.getAll('cartridges');
  const weapons = await Store.getAll('weapons');
  if (!cartridges.length || !weapons.length) {
    view.appendChild(el('div', { class: 'banner' }, 'Нужно хотя бы 1 оружие и 1 патрон.'));
    return;
  }
  const f = el('form', { class: 'card' });
  f.appendChild(selectInput('weaponId', 'Оружие', '', weapons.map(w => ({ value: w.id, label: w.name }))));
  f.appendChild(selectInput('cartridgeId', 'Патрон', '', cartridges.map(c => ({ value: c.id, label: c.name }))));
  f.appendChild(el('div', { class: 'row' },
    numInput('range', 'Дистанция, м', 600),
    numInput('targetRadius_cm', 'Радиус цели, см', 15)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', 15),
    numInput('pressureMbar', 'Давл., гПа', 1013)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('windSpeed', 'Ветер, м/с', 3),
    numInput('windAngle_deg', 'Угол ветра, °', 90)
  ));
  f.appendChild(el('h2', {}, 'σ (неопределённости)'));
  f.appendChild(el('div', { class: 'row' },
    numInput('sigmaRange_m', 'σ дальности, м', 5),
    numInput('sigmaV0_mps', 'σ V₀, м/с', 5)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('sigmaWind_mps', 'σ ветра, м/с', 1),
    numInput('sigmaRifle_mil', 'σ ствола, mil', 0.15)
  ));
  f.appendChild(numInput('n', 'Симуляций', 800));
  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Рассчитать'));
  const out = el('div', { id: 'wezOut', style: 'margin-top:14px' });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(f);
    const cart = cartridges.find(x => x.id === d.cartridgeId);
    const weap = weapons.find(x => x.id === d.weaponId);
    if (!cart || !weap) { toast('Выбери оружие и патрон'); return; }
    const baseInput = buildSolverInputFor(weap, cart, [d.range], {
      tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: 50,
      windSpeed: d.windSpeed, windAngle_deg: d.windAngle_deg
    });
    const baseSol = Ballistics.solve(baseInput);
    if (!baseSol.rows[0]) { toast('Solver не справился'); return; }
    const baseDropMil = baseSol.rows[0].drop_mil;
    const baseDriftMil = baseSol.rows[0].drift_mil;
    // numeric derivatives: ∂drop/∂range, ∂drop/∂v0, ∂drift/∂wind
    const dr = 10; // м
    const dv = 5; // м/с
    const dw = 1; // м/с
    const solDR = Ballistics.solve({ ...baseInput, steps: [d.range + dr], targetDistance: d.range + dr });
    const solDV = Ballistics.solve({ ...baseInput, v0: baseInput.v0 + dv });
    const solDW = Ballistics.solve({ ...baseInput, windSpeed: baseInput.windSpeed + dw });
    const dDrop_dR = solDR.rows[0] ? (solDR.rows[0].drop_mil - baseDropMil) / dr : 0;
    const dDrop_dV = solDV.rows[0] ? (solDV.rows[0].drop_mil - baseDropMil) / dv : 0;
    const dDrift_dW = solDW.rows[0] ? (solDW.rows[0].drift_mil - baseDriftMil) / dw : 0;
    // Monte Carlo
    const N = Math.min(Math.max(parseInt(d.n) || 800, 50), 5000);
    const hits = [];
    let hitCount = 0;
    const r_target_mil = (d.targetRadius_cm * 10) / d.range; // см→м→mil-on-distance (mil = m/Range_km/... actually mil ≈ m/km)
    // правильно: 1 mil ≈ 1 м на 1000 м. Радиус цели в м / range_m * 1000 = mil
    const r_mil = (d.targetRadius_cm / 100) / d.range * 1000;
    for (let i = 0; i < N; i++) {
      const dRange = gaussN() * d.sigmaRange_m;
      const dV0 = gaussN() * d.sigmaV0_mps;
      const dW = gaussN() * d.sigmaWind_mps;
      const rifleX = gaussN() * d.sigmaRifle_mil;
      const rifleY = gaussN() * d.sigmaRifle_mil;
      const dropErr = dDrop_dR * dRange + dDrop_dV * dV0 + rifleY;
      const driftErr = dDrift_dW * dW + rifleX;
      hits.push({ x: driftErr, y: dropErr });
      if (Math.hypot(driftErr, dropErr) <= r_mil) hitCount++;
    }
    // Render canvas
    out.innerHTML = '';
    const pct = (hitCount / N) * 100;
    out.appendChild(el('div', { class: 'card' },
      el('h2', {}, 'Hit probability'),
      el('div', { class: 'big-num', style: 'color:' + (pct > 70 ? 'var(--good)' : pct > 40 ? 'var(--accent)' : 'var(--bad)') },
        fmt(pct, 1) + '%'),
      el('div', { class: 'muted center' }, `${hitCount} попаданий из ${N} симуляций`),
      el('div', { class: 'kv', style: 'margin-top:8px;font-size:13px' },
        el('div', { class: 'k' }, '∂drop/∂range'),
        el('div', { class: 'v' }, fmt(dDrop_dR, 3) + ' mil/м'),
        el('div', { class: 'k' }, '∂drop/∂V₀'),
        el('div', { class: 'v' }, fmt(dDrop_dV, 3) + ' mil/(м/с)'),
        el('div', { class: 'k' }, '∂drift/∂ветер'),
        el('div', { class: 'v' }, fmt(dDrift_dW, 3) + ' mil/(м/с)'),
        el('div', { class: 'k' }, 'Радиус цели'),
        el('div', { class: 'v' }, fmt(r_mil, 2) + ' mil')
      )
    ));
    const cnv = el('canvas', { width: 360, height: 360, style: 'display:block;margin:0 auto;background:#000;border:1px solid var(--border);border-radius:8px' });
    out.appendChild(cnv);
    const cx = 180, cy = 180;
    // диапазон: max 3σ из эмпирического std
    const xs = hits.map(h => h.x), ys = hits.map(h => h.y);
    const maxR = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), r_mil * 1.2);
    const k = 160 / Math.max(maxR, 0.1);
    const ctx = cnv.getContext('2d');
    // цель
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    for (const r of [r_mil, r_mil * 2, r_mil * 3]) {
      ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.strokeStyle = '#666'; ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(340, cy); ctx.moveTo(cx, 20); ctx.lineTo(cx, 340); ctx.stroke();
    // точки
    for (const h of hits) {
      const inT = Math.hypot(h.x, h.y) <= r_mil;
      ctx.fillStyle = inT ? '#4ade80' : '#ff8b3d';
      ctx.fillRect(cx + h.x * k - 1, cy + h.y * k - 1, 2, 2);
    }
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
    ctx.fillText('mil', 340 - 18, cy - 4);
    ctx.fillText('mil', cx + 4, 28);
  });
  view.appendChild(f);
  view.appendChild(out);
});

// ============== GROUP ANALYZER (Wave 3.4) ==============
route('/group-analyzer', async () => {
  setHeader({ title: 'Анализ кучности' });
  view.appendChild(el('div', { class: 'banner' },
    'Загрузи фото мишени → задай 2 калибровочные точки с известной длиной → тапни пробоины. Получишь Mean Radius / Extreme Spread в см и MOA.'));
  const card = el('div', { class: 'card' });
  view.appendChild(card);
  let mode = 'idle';
  let imgEl = null, displayScale = 1;
  let cal = { p1: null, p2: null, lenCm: 10 };
  const shots = [];
  let dist_m = 100;

  const controls = el('div', { class: 'row-btn', style: 'flex-wrap:wrap;gap:6px' });
  card.appendChild(controls);
  const cnv = el('canvas', { style: 'display:block;max-width:100%;border:1px solid var(--border);border-radius:8px;background:#000;margin-top:8px' });
  card.appendChild(cnv);
  const stats = el('div', { class: 'kv', style: 'margin-top:10px;font-size:14px' });
  card.appendChild(stats);

  function draw() {
    if (!imgEl) return;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,cnv.width,cnv.height);
    ctx.drawImage(imgEl, 0, 0, cnv.width, cnv.height);
    // калибровочные точки
    if (cal.p1) { ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cal.p1.x, cal.p1.y, 8, 0, 2*Math.PI); ctx.stroke(); }
    if (cal.p2) { ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cal.p2.x, cal.p2.y, 8, 0, 2*Math.PI); ctx.stroke(); }
    if (cal.p1 && cal.p2) {
      ctx.strokeStyle = '#67e8f9'; ctx.setLineDash([5,5]); ctx.beginPath();
      ctx.moveTo(cal.p1.x, cal.p1.y); ctx.lineTo(cal.p2.x, cal.p2.y); ctx.stroke(); ctx.setLineDash([]);
    }
    // пробоины
    ctx.fillStyle = '#ff8b3d'; ctx.strokeStyle = '#fff';
    shots.forEach((s, i) => {
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, 2*Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, 2*Math.PI); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace';
      ctx.fillText(String(i+1), s.x + 8, s.y - 8);
      ctx.fillStyle = '#ff8b3d';
    });
    if (shots.length >= 2 && cal.p1 && cal.p2) {
      // центр группы
      const cx0 = shots.reduce((s,p)=>s+p.x,0)/shots.length;
      const cy0 = shots.reduce((s,p)=>s+p.y,0)/shots.length;
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx0, cy0, 4, 0, 2*Math.PI); ctx.stroke();
    }
    refreshStats();
  }
  function refreshStats() {
    stats.innerHTML = '';
    if (!cal.p1 || !cal.p2 || shots.length < 2) {
      stats.appendChild(el('div', { class: 'k' }, 'Статус'));
      stats.appendChild(el('div', { class: 'v muted' },
        !cal.p1 || !cal.p2 ? 'Задай 2 калибровочные точки' : 'Поставь хотя бы 2 пробоины'));
      return;
    }
    const dpx = Math.hypot(cal.p2.x - cal.p1.x, cal.p2.y - cal.p1.y);
    const cmPerPx = cal.lenCm / dpx;
    const cx0 = shots.reduce((s,p)=>s+p.x,0)/shots.length;
    const cy0 = shots.reduce((s,p)=>s+p.y,0)/shots.length;
    const radii_cm = shots.map(s => Math.hypot(s.x - cx0, s.y - cy0) * cmPerPx);
    const meanR = radii_cm.reduce((s,r)=>s+r,0) / radii_cm.length;
    // ES = max pairwise distance
    let es = 0;
    for (let i = 0; i < shots.length; i++) for (let j = i+1; j < shots.length; j++) {
      const dd = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y) * cmPerPx;
      if (dd > es) es = dd;
    }
    const moaFactor = (cm) => (cm * 10) / dist_m / (2.908882); // 1 MOA = 2.908882 cm at 100m → cm/m / 2.908... wait
    // 1 MOA ≈ 2.908 см на 100м → на расстоянии R(м) → 2.908 * R/100 см/MOA
    const moaPerCm = 100 / (2.908882 * dist_m);
    const milPerCm = 1000 / (dist_m * 100); // 1 mil = R/1000 м = R*100/1000 см → cm to mil: cm * (1/((R/1000)*100)) = cm*10/R
    stats.appendChild(el('div', { class: 'k' }, 'N'));
    stats.appendChild(el('div', { class: 'v' }, String(shots.length)));
    stats.appendChild(el('div', { class: 'k' }, 'Mean Radius'));
    stats.appendChild(el('div', { class: 'v' }, fmt(meanR,2) + ' см · ' + fmt(meanR*moaPerCm,2) + ' MOA · ' + fmt(meanR*milPerCm,2) + ' mil'));
    stats.appendChild(el('div', { class: 'k' }, 'Extreme Spread'));
    stats.appendChild(el('div', { class: 'v' }, fmt(es,2) + ' см · ' + fmt(es*moaPerCm,2) + ' MOA · ' + fmt(es*milPerCm,2) + ' mil'));
    stats.appendChild(el('div', { class: 'k' }, 'Дистанция'));
    stats.appendChild(el('div', { class: 'v' }, dist_m + ' м'));
  }
  controls.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
    try {
      const dataUrl = await pickImageDataUrl();
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(window.innerWidth - 60, 720);
        const w = Math.min(img.naturalWidth, maxW);
        const sc = w / img.naturalWidth;
        cnv.width = w; cnv.height = img.naturalHeight * sc;
        displayScale = sc;
        imgEl = img;
        cal = { p1: null, p2: null, lenCm: cal.lenCm };
        shots.length = 0;
        mode = 'cal1';
        toast('Тапни первую калибровочную точку');
        draw();
      };
      img.src = dataUrl;
    } catch (e) { toast('Ошибка: ' + e.message); }
  }}, '📷 Фото'));
  controls.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
    const v = prompt('Длина калибровочного отрезка, см', cal.lenCm);
    const n = parseFloat(v);
    if (isFinite(n) && n > 0) { cal.lenCm = n; refreshStats(); toast('Длина: ' + n + ' см'); }
  }}, '📏 Длина отрезка'));
  controls.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
    const v = prompt('Дистанция стрельбы, м', dist_m);
    const n = parseFloat(v);
    if (isFinite(n) && n > 0) { dist_m = n; refreshStats(); }
  }}, '🎯 Дистанция'));
  controls.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
    if (shots.length) { shots.pop(); draw(); }
    else if (cal.p2) { cal.p2 = null; mode = 'cal2'; draw(); }
    else if (cal.p1) { cal.p1 = null; mode = 'cal1'; draw(); }
  }}, '↶ Отменить'));
  controls.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
    shots.length = 0; draw();
  }}, '✕ Очистить пробоины'));
  cnv.addEventListener('click', (e) => {
    if (!imgEl) return;
    const r = cnv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * cnv.width;
    const y = (e.clientY - r.top) / r.height * cnv.height;
    if (!cal.p1) { cal.p1 = {x,y}; mode = 'cal2'; toast('Тапни вторую точку'); }
    else if (!cal.p2) { cal.p2 = {x,y}; mode = 'shots'; toast('Теперь тапай пробоины'); }
    else { shots.push({x,y}); }
    draw();
  });
});

// ============== COMPARE RELOADS (Wave 3.5) ==============
route('/compare', async () => {
  setHeader({ title: 'Сравнение релоадов' });
  const cartridges = await Store.getAll('cartridges');
  const weapons = await Store.getAll('weapons');
  if (!cartridges.length) {
    view.appendChild(el('div', { class: 'banner' }, 'Нет ни одного патрона.'));
    return;
  }
  const f = el('form', { class: 'card' });
  f.appendChild(el('h2', {}, 'Выбери патроны для сравнения'));
  const checks = el('div');
  cartridges.forEach(c => {
    const cb = el('label', { class: 'checkbox' },
      el('input', { type: 'checkbox', name: 'pick_' + c.id, value: c.id }),
      el('span', { class: 'lbl' }, c.name || c.id,
        el('span', { class: 'sub' }, `BC ${c.bc} ${c.dragModel||'G1'} · V₀ ${c.v0} · ${c.bulletMass_gr||'?'} gr`))
    );
    checks.appendChild(cb);
  });
  f.appendChild(checks);
  f.appendChild(el('hr'));
  f.appendChild(selectInput('weaponId', 'Оружие', '',
    weapons.map(w => ({ value: w.id, label: w.name }))));
  f.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', 15),
    numInput('pressureMbar', 'Давл., гПа', 1013)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('windSpeed', 'Ветер, м/с', 3),
    numInput('windAngle_deg', 'Угол, °', 90)
  ));
  f.appendChild(textInput('distances', 'Дистанции (через запятую, м)', '200, 400, 600, 800, 1000'));
  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сравнить'));
  const out = el('div');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const d = readForm(f);
    const ids = cartridges.filter(c => f['pick_' + c.id]?.checked).map(c => c.id);
    if (ids.length < 2) { toast('Выбери минимум 2 патрона'); return; }
    const w = weapons.find(x => x.id === d.weaponId);
    const dists = (d.distances || '').split(/[,\s]+/).map(s => parseFloat(s)).filter(n => n > 0);
    if (!dists.length) { toast('Введи дистанции'); return; }
    const results = ids.map(id => {
      const c = cartridges.find(x => x.id === id);
      const sol = Ballistics.solve(buildSolverInputFor(w, c, dists, {
        tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: 50,
        windSpeed: d.windSpeed, windAngle_deg: d.windAngle_deg
      }));
      return { c, sol };
    });
    out.innerHTML = '';
    const tbl = el('table', { class: 'table' });
    const head = '<thead><tr><th>Дист., м</th>' +
      results.map(r => `<th colspan="2">${r.c.name || r.c.id}<br><span style="font-size:10px;color:var(--muted)">drop · drift, mil</span></th>`).join('') +
      '</tr></thead>';
    tbl.appendChild(h(head));
    const tb = el('tbody');
    dists.forEach((dist, i) => {
      const tr = el('tr');
      tr.appendChild(h(`<td><b>${dist}</b></td>`));
      results.forEach(r => {
        const row = r.sol.rows[i];
        tr.appendChild(h(`<td>${row ? fmt(row.drop_mil,2) : '—'}</td>`));
        tr.appendChild(h(`<td>${row ? fmt(row.drift_mil,2) : '—'}</td>`));
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    out.appendChild(el('div', { class: 'card', style: 'overflow-x:auto' }, tbl));
  });
  view.appendChild(f);
  view.appendChild(out);
});

// ============== PRS STAGES (Wave 4.1) ==============
route('/stages', async () => {
  setHeader({ title: 'PRS стейджи' });
  const items = await Store.getAll('stages') ?? [];
  if (!items.length) view.appendChild(el('div', { class: 'banner' }, 'Стейджей нет.'));
  for (const s of items) {
    view.appendChild(el('a', { class: 'list-item', href: '#/stage/' + s.id },
      el('div', { class: 'ttl' }, s.name || 'Стейдж'),
      el('div', { class: 'sub' }, `${(s.targets || []).length} целей · ${s.timeLimit_s || '—'} с`)
    ));
  }
  view.appendChild(el('a', { class: 'fab', href: '#/stage/new' }, '+'));
});
route('/stage/:id', async ({ id }) => {
  const isNew = id === 'new';
  const s = isNew ? { id: Store.uid(), targets: [] } : await Store.get('stages', id);
  if (!s) return view.appendChild(el('div', { class: 'card' }, 'Не найдено'));
  setHeader({ title: isNew ? 'Новый стейдж' : (s.name || 'Стейдж') });
  const f = el('form', { class: 'card' });
  f.appendChild(textInput('name', 'Название', s.name, { required: true }));
  f.appendChild(el('div', { class: 'row' },
    numInput('timeLimit_s', 'Лимит времени, с', s.timeLimit_s ?? 90),
    numInput('roundCount', 'Патронов', s.roundCount ?? 10)
  ));
  f.appendChild(el('label', { for: 'description' }, 'Описание стейджа'));
  f.appendChild(el('textarea', { id: 'description', name: 'description' }, s.description || ''));
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Цели'));
  const tgtsBox = el('div');
  f.appendChild(tgtsBox);
  const targets = (s.targets || []).slice();
  function renderTargets() {
    tgtsBox.innerHTML = '';
    targets.forEach((t, i) => {
      const row = el('div', { class: 'card', style: 'padding:8px;margin-bottom:6px' });
      row.appendChild(el('div', { style: 'display:flex;gap:6px;align-items:center' },
        el('div', { style: 'min-width:24px;font-weight:600;color:var(--accent)' }, String(i + 1)),
        el('input', { type: 'text', value: t.name || '', placeholder: 'Имя цели',
          oninput: (e) => { targets[i].name = e.target.value; } }),
      ));
      row.appendChild(el('div', { class: 'row' },
        el('input', { type: 'number', placeholder: 'Дист., м', value: t.range ?? '',
          oninput: (e) => { targets[i].range = parseFloat(e.target.value); } }),
        el('input', { type: 'number', placeholder: 'Размер, см', value: t.size_cm ?? '',
          oninput: (e) => { targets[i].size_cm = parseFloat(e.target.value); } }),
        el('button', { type: 'button', class: 'btn danger', style: 'margin-top:0',
          onclick: () => { targets.splice(i, 1); renderTargets(); } }, '×')
      ));
      tgtsBox.appendChild(row);
    });
    if (!targets.length) tgtsBox.appendChild(el('div', { class: 'muted center' }, 'Нет целей'));
  }
  renderTargets();
  f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: () => {
    targets.push({ name: 'Цель ' + (targets.length + 1), range: 300, size_cm: 30 });
    renderTargets();
  }}, '+ Добавить цель'));

  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сохранить'));
  if (!isNew) {
    f.appendChild(el('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      const json = JSON.stringify({ ...s, targets });
      try {
        if (navigator.share) await navigator.share({ title: s.name, text: json });
        else { await navigator.clipboard.writeText(json); toast('Скопировано в буфер'); }
      } catch (e) { toast(e.message); }
    }}, '↗ Поделиться JSON'));
    f.appendChild(el('button', { type: 'button', class: 'btn danger', onclick: async () => {
      if (confirm('Удалить?')) { await Store.del('stages', id); location.hash = '#/stages'; }
    }}, 'Удалить'));
  }
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = readForm(f);
    await Store.put('stages', { ...s, ...d, targets });
    toast('Сохранено'); location.hash = '#/stages';
  });
  view.appendChild(f);
});

// ============== MV TEMP TABLE (Wave 4.2) — в форме патрона добавим textarea ==============
// (UI добавлен ниже как in-place extension; здесь хранение — массив {tempC, v0} в cart.mvTempTable)
// Solve использует это вместо линейного v0_tempSens_mps_per_C если присутствует.
// (Используется через хелпер ниже в submit-handler'е — см. ниже)

// ============== DRAG BUILDER из DOPE (Wave 4.3) ==============
route('/drag-builder', async () => {
  setHeader({ title: 'Drag из DOPE' });
  const cartridges = await Store.getAll('cartridges');
  const weapons = await Store.getAll('weapons');
  if (!cartridges.length || !weapons.length) {
    view.appendChild(el('div', { class: 'banner' }, 'Нужно ≥1 оружие и ≥1 патрон.'));
    return;
  }
  view.appendChild(el('div', { class: 'banner' },
    'Вставь DOPE-таблицу «дистанция, факт. mil» по строкам — приложение подберёт BC× для каждой точки (Litz banding) и запишет в патрон.'));
  const f = el('form', { class: 'card' });
  f.appendChild(selectInput('weaponId', 'Оружие', '', weapons.map(w => ({ value: w.id, label: w.name }))));
  f.appendChild(selectInput('cartridgeId', 'Патрон', '', cartridges.map(c => ({ value: c.id, label: c.name }))));
  f.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', 15),
    numInput('pressureMbar', 'Давл., гПа', 1013)
  ));
  f.appendChild(el('label', { for: 'dope' }, 'DOPE — «дист., факт.mil» по строкам'));
  f.appendChild(el('textarea', { id: 'dope', name: 'dope',
    placeholder: '300, 1.2\n500, 3.4\n800, 7.1\n1000, 10.8' }));
  f.appendChild(el('label', { class: 'checkbox' },
    el('input', { type: 'checkbox', name: 'replace' }),
    el('span', { class: 'lbl' }, 'Очистить существующие точки перед добавлением')));
  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Подобрать и записать'));
  const out = el('div');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const d = readForm(f);
    const c = cartridges.find(x => x.id === d.cartridgeId);
    const w = weapons.find(x => x.id === d.weaponId);
    if (!c || !w) { toast('Выбери оружие и патрон'); return; }
    const lines = (d.dope || '').split('\n').map(s => s.trim()).filter(Boolean);
    const points = lines.map(line => {
      const [r, m] = line.split(/[,\s]+/).map(parseFloat);
      return (isFinite(r) && isFinite(m) && r > 0) ? { range: r, mil: m } : null;
    }).filter(Boolean);
    if (!points.length) { toast('Не разобрал ни одной строки'); return; }
    out.innerHTML = '';
    const startingPoints = (d.replace ? [] : (c.truingPoints || [])).slice();
    let working = { ...c, truingPoints: startingPoints };
    const added = [];
    points.forEach(pt => {
      const inp = buildSolverInputFor(w, working, [pt.range], {
        tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: 50, windSpeed: 0
      });
      const p = Ballistics.addTruingPoint(inp, pt.mil, pt.range);
      if (p && isFinite(p.bcFactor)) {
        const filtered = working.truingPoints.filter(x => Math.abs(x.machAt - p.machAt) > 0.05);
        working = { ...working, truingPoints: [...filtered, { ...p, addedAt: new Date().toISOString() }] };
        added.push({ ...p, observedMil: pt.mil });
      }
    });
    out.appendChild(el('div', { class: 'card' },
      el('h2', {}, 'Подобрано ' + added.length + ' точек'),
      ...added.map(a => el('div', { class: 'kv', style: 'font-size:13px' },
        el('div', { class: 'k' }, fmt(a.range_m, 0) + ' м'),
        el('div', { class: 'v' }, `Mach ${fmt(a.machAt,2)} · BC× ${fmt(a.bcFactor,3)}`)
      )),
      el('button', { type: 'button', class: 'btn',
        onclick: async () => {
          await Store.put('cartridges', { ...c, truingPoints: working.truingPoints });
          toast('Сохранено в патроне'); location.hash = '#/cartridge/' + c.id;
        }}, '💾 Записать в патрон')
    ));
  });
  view.appendChild(f);
  view.appendChild(out);
});

// ============== LONG-PRESS TOOLTIPS (Wave 4.4) ==============
const FIELD_HELP = {
  bc: 'Баллистический коэффициент (BC, lb/in²). Чем больше — тем меньше торможение. Берётся из таблицы производителя или подбирается через Truing.',
  dragModel: 'G1 — стандарт для большинства спортивных и охотничьих пуль. G7 — для современных пуль с длинным боттейлом (Berger, ELD-M, Scenar).',
  v0: 'Начальная скорость пули (м/с) при выходе из ствола. Измеряется хронографом.',
  bulletMass_gr: 'Масса пули в гранах (gr). 1 gr = 0.0648 г.',
  bulletLength_in: 'Длина пули в дюймах — нужна для расчёта стабильности по Миллеру.',
  caliber_in: 'Калибр в дюймах: 6.5 mm = 0.264", .308 = 0.308".',
  twist_in: 'Шаг нарезов: «1 поворот за N дюймов». Меньше число → быстрее закрутка → выше стабильность тяжёлых пуль.',
  sightHeight_mm: 'Высота линии прицеливания над осью канала ствола (мм). Обычно 35–50 мм для скоп с верхним рычагом.',
  zeroDistance: 'Дистанция, на которую пристрелян прицел (м).',
  windSpeed: 'Скорость ветра (м/с). Полевая оценка: листва шевелится ≈1–2 м/с, ветви качаются ≈4–6 м/с.',
  windAngle_deg: 'Угол ветра относительно линии стрельбы. 0° = попутный (в спину), 90° = справа, 180° = встречный, 270° = слева.',
  windSpeed2: 'Второй ветер — для участков траектории, где ветер другой (ущелье, край леса). HUD покажет вторую колонку поправки.',
  windAngle_deg2: 'Угол второго ветра (см. подсказку «Ветер 2»).',
  tempC: 'Температура воздуха (°C). Влияет на плотность воздуха и через неё на сопротивление.',
  pressureMbar: 'Атмосферное давление (мбар = гПа). Важно: НЕ привести к уровню моря — нужно ФАКТИЧЕСКОЕ давление на стрельбище.',
  humidity: 'Относительная влажность (%). Влияет слабо, но при высокой жаре заметно.',
  shotAngle_deg: 'Угол места (наклон стрельбы). Положительный = вверх. Уменьшает эффективную просадку.',
  cant_deg: 'Завал винтовки от вертикали. Положительный — наклон вправо. На 1000 м даже 3° дают сантиметры смещения.',
  ammoTempC: 'Температура боеприпаса. V₀ зависит от темп. пороха: чем теплее — тем быстрее (~0.3–0.7 м/с/°C для несокращ. порохов).',
  latitude_deg: 'Широта точки стрельбы (для эффекта Кориолиса). На дистанциях <800 м влияет слабо.',
  azimuth_deg: 'Азимут выстрела (для Кориолиса). 0° = на север, 90° = на восток.'
};
(function setupLongPressHelp() {
  let timer = null, target = null;
  document.addEventListener('touchstart', (e) => {
    const lbl = e.target.closest('label');
    if (!lbl) return;
    const forName = lbl.getAttribute('for');
    const help = forName && FIELD_HELP[forName];
    if (!help) return;
    target = { lbl, help };
    timer = setTimeout(() => {
      navigator.vibrate?.(20);
      openSheet((sheet, close) => {
        sheet.appendChild(el('h3', {}, lbl.textContent));
        sheet.appendChild(el('div', { class: 'muted', style: 'line-height:1.5;font-size:14px' }, help));
        sheet.appendChild(el('button', { type: 'button', class: 'btn', onclick: close }, 'Понял'));
      });
      timer = null;
    }, 600);
  }, { passive: true });
  document.addEventListener('touchend',   () => { if (timer) clearTimeout(timer); timer = null; });
  document.addEventListener('touchmove',  () => { if (timer) clearTimeout(timer); timer = null; });
  document.addEventListener('touchcancel',() => { if (timer) clearTimeout(timer); timer = null; });
})();

// ============== RANGE CARD (Wave 4.5) ==============
route('/range-card', async () => {
  setHeader({ title: 'Range Card' });
  const cartridges = await Store.getAll('cartridges');
  const weapons = await Store.getAll('weapons');
  if (!cartridges.length || !weapons.length) {
    view.appendChild(el('div', { class: 'banner' }, 'Нужно ≥1 оружие и ≥1 патрон.'));
    return;
  }
  view.appendChild(el('div', { class: 'banner' },
    'Сформирует печатную таблицу с поправками — для наклейки на ложе или скотча на прикладе.'));
  const f = el('form', { class: 'card no-print' });
  f.appendChild(selectInput('weaponId', 'Оружие', '', weapons.map(w => ({ value: w.id, label: w.name }))));
  f.appendChild(selectInput('cartridgeId', 'Патрон', '', cartridges.map(c => ({ value: c.id, label: c.name }))));
  f.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', 15),
    numInput('pressureMbar', 'Давл., гПа', 1013)
  ));
  f.appendChild(el('div', { class: 'row' },
    numInput('humidity', 'Влажн., %', 50),
    numInput('windSpeed', 'Ветер для столбца, м/с', 3)
  ));
  f.appendChild(textInput('distances', 'Дистанции (через запятую)',
    '100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200'));
  f.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Сформировать'));
  const out = el('div', { class: 'range-card-out' });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const d = readForm(f);
    const c = cartridges.find(x => x.id === d.cartridgeId);
    const w = weapons.find(x => x.id === d.weaponId);
    if (!c || !w) { toast('Выбери патрон и оружие'); return; }
    const dists = (d.distances || '').split(/[,\s]+/).map(s => parseFloat(s)).filter(n => n > 0);
    const sol = Ballistics.solve(buildSolverInputFor(w, c, dists, {
      tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: d.humidity,
      windSpeed: d.windSpeed, windAngle_deg: 90
    }));
    out.innerHTML = '';
    const card = el('div', { class: 'range-card' });
    card.appendChild(el('div', { class: 'rc-head' },
      el('div', { class: 'rc-title' }, (w.name || '—') + ' · ' + (c.name || '—')),
      el('div', { class: 'rc-sub' },
        `V₀ ${c.v0} · BC ${c.bc} ${c.dragModel||'G1'} · ` +
        `T ${d.tempC}°C · P ${d.pressureMbar} гПа · RH ${d.humidity}% · ветер ${d.windSpeed} м/с @ 90°`)
    ));
    const tbl = el('table', { class: 'rc-table' });
    tbl.appendChild(h(`<thead><tr>
      <th>м</th><th>mil</th><th>MOA</th><th>см</th><th>ветер mil</th><th>V м/с</th><th>tof с</th>
    </tr></thead>`));
    const tb = el('tbody');
    sol.rows.forEach(r => {
      tb.appendChild(h(`<tr>
        <td><b>${r.range}</b></td>
        <td><b>${fmt(r.drop_mil,2)}</b></td>
        <td>${fmt(r.drop_moa,1)}</td>
        <td>${fmt(Math.abs(r.drop_m)*100,0)}</td>
        <td>${fmt(r.drift_mil,2)}</td>
        <td>${fmt(r.vel_mps,0)}</td>
        <td>${fmt(r.tof_s,2)}</td>
      </tr>`));
    });
    tbl.appendChild(tb);
    card.appendChild(tbl);
    out.appendChild(card);
    out.appendChild(el('button', { type: 'button', class: 'btn no-print', onclick: () => window.print() }, '🖨 Печать / Сохранить PDF'));
  });
  view.appendChild(f);
  view.appendChild(out);
});

// ============== boot ==============
(async () => {
  if (window.Backup) {
    Backup.instrumentStore();
    try {
      const empty = await Backup.isStoreEmpty();
      if (empty) {
        // 1. Сначала пытаемся Я.Диск
        let payload = null, source = null;
        if (window.Yadisk && Yadisk.isConfigured()) {
          payload = await Backup.downloadFromYandex();
          if (payload) source = 'Я.Диск';
        }
        // 2. Локальный Documents
        if (!payload && await Backup.exists()) {
          payload = await Backup.read();
          if (payload) source = '/Documents';
        }
        if (payload && payload.data) {
          const total = Object.values(payload.data).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
          if (total > 0 && confirm(
            `Найден бэкап (${source}, ${total} записей, ${payload.exportedAt?.slice(0,16) || '—'}).\n\nВосстановить базу данных?`
          )) {
            try { await Store.importAll(payload); toast('База восстановлена из ' + source); }
            catch (e) { toast('Ошибка восстановления: ' + e.message); }
          }
        }
      }
    } catch (e) { console.warn('[boot/backup]', e); }
  }
  navigate();
})();
