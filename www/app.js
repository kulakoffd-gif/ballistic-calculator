// Скай-Рейндж — главный модуль.

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
function createCompass({ value = 0, onChange, size = 280 }) {
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
  // arrow group
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
  setHeader({ title: 'СкайРейндж' });
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
  splash.appendChild(el('div', { class: 'name' }, 'СКАЙ-РЕЙНДЖ'));
  splash.appendChild(el('div', { class: 'tag' }, 'Precision Ballistics & Log'));
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
    const comp = createCompass({ value: Wiz.wind.dir, onChange: v => { Wiz.wind.dir = v; updateAux(); } });
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
  form.appendChild(el('h2', {}, 'Профили'));
  form.appendChild(selectInput('weaponId', 'Оружие', state.weaponId,
    [{ value: '', label: '— вручную —' }, ...weapons.map(w => ({ value: w.id, label: w.name }))]));
  form.appendChild(selectInput('cartridgeId', 'Патрон', state.cartridgeId,
    [{ value: '', label: '— вручную —' }, ...cartridges.map(c => ({ value: c.id, label: c.name }))]));
  form.appendChild(el('h2', {}, 'Параметры'));
  form.appendChild(el('div', { class: 'row' },
    numInput('bc', 'BC (lb/in²)', state.bc ?? 0.45),
    selectInput('dragModel', 'Модель', state.dragModel || 'G1', [{value:'G1',label:'G1'},{value:'G7',label:'G7'}])
  ));
  form.appendChild(el('div', { class: 'row' },
    numInput('v0', 'V₀ (м/с)', state.v0 ?? 830),
    numInput('bulletMass_gr', 'Масса (гран)', state.bulletMass_gr ?? 175)
  ));
  form.appendChild(el('div', { class: 'row' },
    numInput('sightHeight_mm', 'Высота прицела (мм)', state.sightHeight_mm ?? 50),
    numInput('zeroDistance', 'Пристрелка (м)', state.zeroDistance ?? 100)
  ));
  form.appendChild(el('h2', {}, 'Атмосфера'));
  form.appendChild(el('div', { class: 'row' },
    numInput('tempC', 'Темп., °C', state.tempC ?? 15),
    numInput('pressureMbar', 'Давл., гПа', state.pressureMbar ?? 1013)
  ));
  form.appendChild(attachAtmoButtons(form, 'pressureMbar'));
  form.appendChild(el('div', { class: 'row' },
    numInput('humidity', 'Влажн., %', state.humidity ?? 50),
    numInput('shotAngle_deg', 'Угол места, °', state.shotAngle_deg ?? 0)
  ));
  form.appendChild(el('div', { class: 'row' },
    numInput('cant_deg', 'Завал, °', state.cant_deg ?? 0),
    numInput('ammoTempC', 'Темп. боеприпасов, °C', state.ammoTempC)
  ));
  form.appendChild(el('h2', {}, 'Ветер'));
  form.appendChild(el('div', { class: 'row' },
    numInput('windSpeed', 'Скорость, м/с', state.windSpeed ?? 0),
    numInput('windAngle_deg', 'Угол отн. ствола, °', state.windAngle_deg ?? 90)
  ));
  form.appendChild(el('h2', {}, 'Кориолис (опц.)'));
  form.appendChild(el('div', { class: 'banner' },
    'Для учёта эффекта Кориолиса заполни широту места выстрела и азимут к цели. Без них Кориолис нулевой.'));
  form.appendChild(el('div', { class: 'row' },
    numInput('latitude_deg', 'Широта, ° (+ север)', state.latitude_deg ?? 55),
    numInput('azimuth_deg', 'Азимут к цели, °', state.azimuth_deg ?? 0)
  ));
  form.appendChild(el('button', { type: 'button', class: 'btn ghost', style: 'margin-top:6px',
    onclick: async () => {
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
        form.latitude_deg.value = pos.coords.latitude.toFixed(3);
        toast('Широта с GPS');
      } catch (e) { toast('GPS: ' + e.message); }
    }}, '📍 Взять широту с GPS'));
  form.appendChild(el('h2', {}, 'Дистанции'));
  form.appendChild(textInput('distances', 'через запятую, м', state.distances || '100, 200, 300, 400, 500, 600, 800, 1000'));
  form.appendChild(el('button', { type: 'submit', class: 'btn' }, 'Рассчитать'));
  form.appendChild(el('div', { id: 'result' }));

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
    const input = {
      bc: d.bc, dragModel: (c && effectiveDragModel(c) === 'CUSTOM') ? 'CUSTOM' : d.dragModel,
      customDrag: c?.customDrag || null,
      v0: d.v0, bulletMass_gr: d.bulletMass_gr,
      bulletLength_in: c?.bulletLength_in, caliber_in: c?.caliber_in,
      twist_in: w?.twist_in, twistRight: w ? (w.twistRight !== false) : true,
      cant_deg: d.cant_deg, ammoTempC: d.ammoTempC,
      v0_baseTempC: c?.v0_baseTempC, v0_tempSens_mps_per_C: c?.v0_tempSens_mps_per_C,
      truingPoints: c?.truingPoints || null,
      sightHeight: (d.sightHeight_mm || 50) / 1000,
      zeroDistance: d.zeroDistance, targetDistance: Math.max(...distances, 1000),
      tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: d.humidity,
      windSpeed: d.windSpeed, windAngle_deg: d.windAngle_deg, shotAngle_deg: d.shotAngle_deg,
      latitude_deg: d.latitude_deg, azimuth_deg: d.azimuth_deg,
      steps: distances
    };
    const res = Ballistics.solve(input);
    const out = $('#result', form);
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
    solCard.appendChild(distLabel);
    solCard.appendChild(mainGrid);
    solCard.appendChild(stepperRow);
    out.appendChild(solCard);

    // живой single-distance solve (быстрее чем full table)
    function solveAt(dist) {
      const inp = { ...input, steps: [dist], targetDistance: Math.max(dist, input.zeroDistance || 100) };
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
      distLabel.textContent = `ДИСТАНЦИЯ ${bigDist} м`;
      mainGrid.innerHTML = '';
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
      driftAxis.appendChild(el('div', { class: 'lbl' }, 'Горизонталь'));
      const drVal = el('div', { class: 'val' });
      drVal.appendChild(el('span', { class: 'dir-arrow' }, dirArrow(row.drift_mil, 'h')));
      drVal.appendChild(document.createTextNode(fmt(Math.abs(row.drift_mil), 2)));
      drVal.appendChild(el('span', { class: 'unit' }, 'mil'));
      driftAxis.appendChild(drVal);
      driftAxis.appendChild(el('div', { class: 'sub-val' }, `${fmt(Math.abs(row.drift_moa), 1)} MOA · ${fmt(Math.abs(row.drift_m) * 100, 0)} см`));
      mainGrid.appendChild(driftAxis);
    }

    function renderStepper() {
      stepperRow.innerHTML = '';
      stepperRow.appendChild(el('button', { type: 'button', class: 'step', onclick: () => {
        bigDist = Math.max(0, bigDist - stepSize);
        localStorage.setItem('calc:bigDist', String(bigDist));
        flashZeroReminder(bigDist);
        renderBig();
        rangeInp.value = bigDist;
      }}, '−'));
      const rangeInp = el('input', { class: 'range-input', type: 'number', inputmode: 'numeric', value: bigDist });
      rangeInp.addEventListener('input', () => {
        const v = parseFloat(rangeInp.value);
        if (isFinite(v) && v > 0) {
          bigDist = v;
          localStorage.setItem('calc:bigDist', String(bigDist));
          renderBig();
        }
      });
      stepperRow.appendChild(rangeInp);
      stepperRow.appendChild(el('button', { type: 'button', class: 'step', onclick: () => {
        bigDist = bigDist + stepSize;
        localStorage.setItem('calc:bigDist', String(bigDist));
        flashZeroReminder(bigDist);
        renderBig();
        rangeInp.value = bigDist;
      }}, '+'));
      const stepBtn = el('button', { type: 'button', class: 'step-size', onclick: () => {
        const opts = [10, 25, 50, 100, 200];
        const i = opts.indexOf(stepSize);
        stepSize = opts[(i + 1) % opts.length];
        localStorage.setItem('calc:bigStep', String(stepSize));
        stepBtn.textContent = '±' + stepSize + 'м';
      }}, '±' + stepSize + 'м');
      stepperRow.appendChild(stepBtn);
    }
    renderStepper();
    renderBig();

    // — параметры мелким kv —
    const DA_ft = Ballistics.densityAltitude_ft({tempC: d.tempC, pressureMbar: d.pressureMbar, humidity: d.humidity});
    const paramCard = el('div', { class: 'card' });
    paramCard.appendChild(el('h2', {}, 'Атмосфера и баллистика'));
    paramCard.appendChild(el('div', { class: 'kv' },
      el('div', { class: 'k' }, 'V на цели'),
      el('div', { class: 'v' }, fmt((res.rows.find(r=>r.range===bigDist) || res.rows[0]).vel_mps, 0) + ' м/с'),
      el('div', { class: 'k' }, 'Время полёта'),
      el('div', { class: 'v' }, fmt((res.rows.find(r=>r.range===bigDist) || res.rows[0]).tof_s, 2) + ' с'),
      el('div', { class: 'k' }, 'Плотность воздуха'), el('div', { class: 'v' }, fmt(res.airDensity,3) + ' кг/м³'),
      el('div', { class: 'k' }, 'Density Altitude'), el('div', { class: 'v' }, fmt(DA_ft,0) + ' ft'),
      el('div', { class: 'k' }, 'Скорость звука'), el('div', { class: 'v' }, fmt(res.speedOfSound,1) + ' м/с'),
      el('div', { class: 'k' }, 'Угол бросания'), el('div', { class: 'v' }, fmt(res.launchAngle_deg,3) + '°')
    ));
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

  view.appendChild(form);
  if (state.bc) form.dispatchEvent(new Event('submit'));
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

  // — Powder temperature sensitivity —
  f.appendChild(el('hr'));
  f.appendChild(el('h2', {}, 'Темп. чувствительность пороха'));
  f.appendChild(el('div', { class: 'banner' },
    'Если V₀ указан при определённой температуре пороха, укажи её и коэффициент чувствительности. Типично: 0.3–0.7 м/с на °C для одноосновных порохов, 0.05–0.2 для термостабильных (Hodgdon Extreme).'));
  f.appendChild(el('div', { class: 'row' },
    numInput('v0_baseTempC', 'Базовая темп. для V₀, °C', c.v0_baseTempC ?? 21),
    numInput('v0_tempSens_mps_per_C', 'Чувствит., м/с / °C', c.v0_tempSens_mps_per_C ?? 0)
  ));

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

// helper: эффективные параметры баллистики из weapon + cartridge
function effectiveBC(c) { return c.truedBC || c.bc; }
function effectiveDragModel(c) {
  if (c.customDrag && c.customDrag.length >= 2) return 'CUSTOM';
  return c.dragModel || 'G1';
}
function buildSolverInputFor(weapon, cart, distances, weather, opts = {}) {
  return {
    bc: effectiveBC(cart),
    dragModel: effectiveDragModel(cart),
    customDrag: cart.customDrag || null,
    v0: cart.v0,
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
    ammoTempC: weather.ammoTempC ?? weather.tempC,
    v0_baseTempC: cart.v0_baseTempC,
    v0_tempSens_mps_per_C: cart.v0_tempSens_mps_per_C,
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

  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  photoCard.appendChild(fileInput);
  photoCard.appendChild(el('button', { type: 'button', class: 'btn ghost',
    onclick: () => fileInput.click() }, '📷 Загрузить фото сетки'));

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

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      r.imageDataUrl = fr.result;
      img = new Image();
      img.onload = () => { drawCanvas(); };
      img.src = fr.result;
    };
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

// --- хелпер: отрисовать сетку с метками целей ---
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
  const canvas = el('canvas', { style: 'max-width:100%;height:auto;display:block;border:1px solid var(--border);border-radius:8px;background:#000' });
  wrap.appendChild(canvas);
  const legend = el('div', { class: 'kv', style: 'margin-top:10px;font-size:13px' });
  wrap.appendChild(legend);

  const img = new Image();
  img.onload = () => {
    const maxW = Math.min(window.innerWidth - 60, 640);
    const w = Math.min(img.naturalWidth, maxW);
    const scale = w / img.naturalWidth;
    canvas.width = w; canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const colors = ['#4ade80','#ffb072','#ff8b3d','#f87171','#a78bfa','#67e8f9','#fde047','#fb923c','#22d3ee','#f472b6'];
    legend.innerHTML = '';
    rows.forEach((row, i) => {
      // позиция в натуральных пикселях сетки
      const px = sc.cx + (row.drift_mil || 0) * sc.hx;
      const py = sc.cy + (row.drop_mil || 0) * sc.vy;
      const x = px * scale, y = py * scale;
      // только если в пределах канваса
      if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
      const color = colors[i % colors.length];
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill();
      ctx.font = 'bold 13px monospace';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(row.range + 'м', x + 12, y + 4);
      ctx.fillText(row.range + 'м', x + 12, y + 4);
      // легенда
      legend.appendChild(el('div', { class: 'k', style: 'color:' + color }, '● ' + row.range + ' м'));
      legend.appendChild(el('div', { class: 'v' },
        `${fmt(row.drop_mil,2)} mil ↓ · ${fmt(row.drift_mil,2)} mil →`));
    });
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
  view.appendChild(el('div', { class: 'card' },
    el('h2', {}, 'О приложении'),
    el('div', { class: 'muted', style: 'line-height:1.5' },
      'Полноценный баллистический калькулятор (G1/G7) и журнал стрельб. Работает офлайн. ',
      'Для установки на главный экран: Chrome → меню → «Добавить на главный экран», Safari → «Поделиться» → «На экран Домой».')
  ));
});

// ============== boot ==============
navigate();
