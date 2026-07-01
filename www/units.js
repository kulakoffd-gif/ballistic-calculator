// Единицы измерения. База (в которой считает солвер и хранятся данные) — метрическая:
// дистанция — м, поправки — mil, темп — °C, давление — гПа, скорость — м/с,
// вес — гран, длина — дюйм, энергия — Дж, DA — фут.
// Пользователь выбирает единицы ОТОБРАЖЕНИЯ на экране «Единицы»; здесь — хранение
// выбора + форматтеры (перевод из базы в выбранную единицу для показа).

const U_DEFAULTS = {
  dist:   'm',    // m | yd
  corr:   'mil',  // mil | moa   (основная единица поправок)
  corr2:  'cm',   // none | moa | cm   (вторичная подпись рядом)
  temp:   'C',    // C | F
  press:  'hPa',  // hPa | inHg | mmHg
  vel:    'mps',  // mps | fps
  wind:   'mps',  // mps | mph | fps
  weight: 'gr',   // gr | g
  length: 'in',   // in | mm
  energy: 'J',    // J | ftlb | both
  da:     'ft',   // ft | m
};

// Метки для выпадающих списков (экран «Единицы»)
const U_OPTIONS = {
  dist:   [['m', 'метры (м)'], ['yd', 'ярды (yd)']],
  corr:   [['mil', 'миллирадианы (mil)'], ['moa', 'угловые минуты (MOA)']],
  corr2:  [['cm', 'см (рядом)'], ['moa', 'MOA (рядом)'], ['none', 'ничего']],
  temp:   [['C', '°C'], ['F', '°F']],
  press:  [['hPa', 'гПа / мбар'], ['inHg', 'дюймы рт.ст. (inHg)'], ['mmHg', 'мм рт.ст.']],
  vel:    [['mps', 'м/с'], ['fps', 'фут/с (fps)']],
  wind:   [['mps', 'м/с'], ['mph', 'миль/ч (mph)'], ['fps', 'фут/с']],
  weight: [['gr', 'граны (gr)'], ['g', 'граммы (g)']],
  length: [['in', 'дюймы (in)'], ['mm', 'мм']],
  energy: [['J', 'джоули (Дж)'], ['ftlb', 'фут-фунты (ft·lb)'], ['both', 'оба']],
  da:     [['ft', 'футы (ft)'], ['m', 'метры (м)']],
};

const U_LABELS = {
  dist: 'Дистанция', corr: 'Поправки (основные)', corr2: 'Поправки (вторая подпись)',
  temp: 'Температура', press: 'Давление', vel: 'Скорость (V₀, у цели)',
  wind: 'Скорость ветра', weight: 'Вес пули / навеска', length: 'Длина / калибр пули',
  energy: 'Энергия пули', da: 'Density Altitude',
};

function loadUnits() {
  try { return { ...U_DEFAULTS, ...(JSON.parse(localStorage.getItem('units') || '{}')) }; }
  catch { return { ...U_DEFAULTS }; }
}
function saveUnits(u) { localStorage.setItem('units', JSON.stringify({ ...U_DEFAULTS, ...u })); }

const nf = (v, d) => (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(d);

const Units = {
  get: loadUnits,
  save: saveUnits,
  OPTIONS: U_OPTIONS, LABELS: U_LABELS, DEFAULTS: U_DEFAULTS,

  // дистанция из метров → строка/число
  distStr(m) { const u = loadUnits().dist; return u === 'yd' ? `${nf(m * 1.09361, 0)} yd` : `${nf(m, 0)} м`; },
  distUnit() { return loadUnits().dist === 'yd' ? 'yd' : 'м'; },
  distFromM(m) { return loadUnits().dist === 'yd' ? m * 1.09361 : m; },
  distToM(v) { return loadUnits().dist === 'yd' ? v / 1.09361 : v; },

  // поправка: вход mil и (опц.) метры на дистанции для см
  corrStr(mil, moa, drop_m) {
    const u = loadUnits();
    const primary = u.corr === 'moa' ? `${nf(moa, 1)} MOA` : `${nf(mil, 2)} mil`;
    return primary;
  },
  corrVal(mil, moa) { const u = loadUnits(); return u.corr === 'moa' ? nf(moa, 1) : nf(mil, 2); },
  corrUnit() { return loadUnits().corr === 'moa' ? 'MOA' : 'mil'; },
  corrSecondary(mil, moa, drop_m) {
    const u = loadUnits();
    if (u.corr2 === 'none') return '';
    if (u.corr2 === 'moa') return `${nf(moa, 1)} MOA`;
    return `${nf((drop_m || 0) * 100, 0)} см`;
  },

  tempStr(c) { const u = loadUnits().temp; return u === 'F' ? `${nf(c * 9 / 5 + 32, 0)} °F` : `${nf(c, 0)} °C`; },
  pressStr(hpa) { const u = loadUnits().press; if (u === 'inHg') return `${nf(hpa * 0.02953, 2)} inHg`; if (u === 'mmHg') return `${nf(hpa * 0.750062, 0)} мм`; return `${nf(hpa, 0)} гПа`; },
  velStr(mps) { const u = loadUnits().vel; return u === 'fps' ? `${nf(mps * 3.28084, 0)} fps` : `${nf(mps, 0)} м/с`; },
  windStr(mps) { const u = loadUnits().wind; if (u === 'mph') return `${nf(mps * 2.23694, 1)} mph`; if (u === 'fps') return `${nf(mps * 3.28084, 0)} fps`; return `${nf(mps, 1)} м/с`; },
  windUnit() { const u = loadUnits().wind; return u === 'mph' ? 'mph' : (u === 'fps' ? 'fps' : 'м/с'); },
  energyStr(J) {
    const u = loadUnits().energy; const fl = J * 0.737562;
    if (u === 'ftlb') return `${nf(fl, 0)} ft·lb`;
    if (u === 'both') return `${nf(J, 0)} Дж · ${nf(fl, 0)} ft·lb`;
    return `${nf(J, 0)} Дж`;
  },
  daStr(ft) { const u = loadUnits().da; return u === 'm' ? `${nf(ft * 0.3048, 0)} м` : `${nf(ft, 0)} ft`; },
};

window.Units = Units;
