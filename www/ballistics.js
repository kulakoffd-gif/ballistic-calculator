// Баллистический solver: G1/G7 + пользовательские CDM-таблицы,
// RK4-интегратор, modified point-mass с добавками по Литцу:
//   - Spin drift через стабильность Миллера
//   - Aerodynamic jump (эмпирическая поправка Литца)
//   - Полный Кориолис (горизонтальная + вертикальная составляющие)
// + поддержка truing (подгонка BC под фактическое DOPE)
//
// Все формулы из открытых источников:
//   • McCoy, "Modern Exterior Ballistics" — point-mass / MPM
//   • Litz, "Applied Ballistics for Long-Range Shooting" — AJ, spin drift, truing
//   • Pejsa, "New Exact Small Arms Ballistics" — drop-формулы в замкнутой форме
//   • Miller, "A New Rule for Estimating Rifling Twist" — стабильность Sg
//   • BRL — таблицы G1/G7 (открытые данные U.S. Army)

// ───────────────────────────── Drag tables ─────────────────────────────
const G1_TABLE = [
  [0.00,0.2629],[0.05,0.2558],[0.10,0.2487],[0.15,0.2413],[0.20,0.2344],
  [0.25,0.2278],[0.30,0.2214],[0.35,0.2155],[0.40,0.2104],[0.45,0.2061],
  [0.50,0.2032],[0.55,0.2020],[0.60,0.2034],[0.70,0.2165],[0.725,0.2230],
  [0.75,0.2313],[0.775,0.2417],[0.80,0.2546],[0.825,0.2706],[0.85,0.2901],
  [0.875,0.3136],[0.90,0.3415],[0.925,0.3734],[0.95,0.4084],[0.975,0.4448],
  [1.00,0.4805],[1.025,0.5136],[1.05,0.5427],[1.075,0.5677],[1.10,0.5883],
  [1.125,0.6053],[1.15,0.6191],[1.20,0.6393],[1.25,0.6518],[1.30,0.6589],
  [1.35,0.6621],[1.40,0.6625],[1.45,0.6607],[1.50,0.6573],[1.55,0.6528],
  [1.60,0.6474],[1.65,0.6413],[1.70,0.6347],[1.75,0.6280],[1.80,0.6210],
  [1.85,0.6141],[1.90,0.6072],[1.95,0.6003],[2.00,0.5934],[2.05,0.5867],
  [2.10,0.5804],[2.15,0.5743],[2.20,0.5685],[2.25,0.5630],[2.30,0.5577],
  [2.35,0.5527],[2.40,0.5481],[2.45,0.5438],[2.50,0.5397],[2.60,0.5325],
  [2.70,0.5264],[2.80,0.5211],[2.90,0.5168],[3.00,0.5133],[3.10,0.5105],
  [3.20,0.5084],[3.30,0.5067],[3.40,0.5054],[3.50,0.5040],[3.60,0.5030],
  [3.70,0.5022],[3.80,0.5016],[3.90,0.5010],[4.00,0.5006],[4.20,0.4998],
  [4.40,0.4995],[4.60,0.4992],[4.80,0.4990],[5.00,0.4988]
];

const G7_TABLE = [
  [0.00,0.1198],[0.05,0.1197],[0.10,0.1196],[0.15,0.1194],[0.20,0.1193],
  [0.25,0.1194],[0.30,0.1194],[0.35,0.1194],[0.40,0.1193],[0.45,0.1193],
  [0.50,0.1194],[0.55,0.1193],[0.60,0.1194],[0.65,0.1197],[0.70,0.1202],
  [0.725,0.1207],[0.75,0.1215],[0.775,0.1226],[0.80,0.1242],[0.825,0.1266],
  [0.85,0.1306],[0.875,0.1368],[0.90,0.1464],[0.925,0.1660],[0.95,0.2054],
  [0.975,0.2993],[1.00,0.3803],[1.025,0.4015],[1.05,0.4043],[1.075,0.4034],
  [1.10,0.4014],[1.125,0.3987],[1.15,0.3955],[1.20,0.3884],[1.25,0.3810],
  [1.30,0.3732],[1.35,0.3657],[1.40,0.3580],[1.50,0.3440],[1.55,0.3376],
  [1.60,0.3315],[1.65,0.3260],[1.70,0.3209],[1.75,0.3160],[1.80,0.3117],
  [1.85,0.3078],[1.90,0.3042],[1.95,0.3010],[2.00,0.2980],[2.05,0.2951],
  [2.10,0.2922],[2.15,0.2892],[2.20,0.2864],[2.25,0.2835],[2.30,0.2807],
  [2.35,0.2779],[2.40,0.2752],[2.45,0.2725],[2.50,0.2697],[2.55,0.2670],
  [2.60,0.2643],[2.65,0.2615],[2.70,0.2588],[2.75,0.2561],[2.80,0.2533],
  [2.85,0.2506],[2.90,0.2479],[2.95,0.2451],[3.00,0.2424],[3.10,0.2368],
  [3.20,0.2313],[3.30,0.2258],[3.40,0.2205],[3.50,0.2154],[3.60,0.2106],
  [3.70,0.2060],[3.80,0.2017],[3.90,0.1975],[4.00,0.1935],[4.20,0.1861],
  [4.40,0.1793],[4.60,0.1730],[4.80,0.1672],[5.00,0.1618]
];

function interpDrag(table, mach) {
  if (mach <= table[0][0]) return table[0][1];
  const last = table.length - 1;
  if (mach >= table[last][0]) return table[last][1];
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    (table[mid][0] <= mach) ? (lo = mid) : (hi = mid);
  }
  const [m0, c0] = table[lo], [m1, c1] = table[hi];
  return c0 + (c1 - c0) * (mach - m0) / (m1 - m0);
}

// ───────────────────────────── Атмосфера ─────────────────────────────
// Плотность воздуха с учётом влажности (формула Тетенса для давления насыщ. пара)
function airDensity({ tempC, pressureMbar, humidity }) {
  const T = tempC + 273.15;
  const Rd = 287.058, Rv = 461.495;
  const es = 6.1078 * Math.pow(10, 7.5 * tempC / (237.3 + tempC));
  const e = (humidity / 100) * es;
  const pd = pressureMbar - e;
  return (pd * 100) / (Rd * T) + (e * 100) / (Rv * T);
}

// Скорость звука с поправкой на влажность (увеличивается с RH из-за γ_влажн)
function speedOfSound(tempC, humidity = 0) {
  const T = tempC + 273.15;
  // приближение Cramer'а к скорости звука во влажном воздухе
  return 331.3 + 0.606 * tempC + 0.0124 * humidity;
}

// ───────────────────────────── Miller stability ─────────────────────────────
// Sg = 30·m / (t²·d³·l·(1+l²))
//   m — масса пули в гранах
//   t — твист в калибрах (t_inches / d_inches)
//   d — калибр в дюймах
//   l — длина пули в калибрах (len_inches / d_inches)
function millerStability(massGr, twistIn, caliberIn, lengthIn) {
  if (!massGr || !twistIn || !caliberIn || !lengthIn) return null;
  const t = twistIn / caliberIn;
  const l = lengthIn / caliberIn;
  return (30 * massGr) / (t * t * Math.pow(caliberIn, 3) * l * (1 + l * l));
}

// Поправка Sg на скорость и атмосферу (Miller-McCoy, упрощённая)
function millerSgCorrected(Sg, v0_fps, tempF, pressureInHg) {
  if (Sg == null) return null;
  const fv = Math.pow(v0_fps / 2800, 1/3);
  const ft = Math.pow((tempF + 460) / 519, 1/3);
  const fp = 29.92 / pressureInHg;
  return Sg * fv * ft * fp;
}

// Спин-дрифт по эмпирической формуле Литца (Applied Ballistics, ch. 7)
//   drift_inches = 1.25 · (Sg + 1.2) · tof^1.83
// Положителен вправо для правого нареза.
function spinDriftLitz(Sg, tofSec, rightTwist = true) {
  if (Sg == null) return 0;
  const inches = 1.25 * (Sg + 1.2) * Math.pow(tofSec, 1.83);
  const m = inches * 0.0254;
  return rightTwist ? m : -m;
}

// Aerodynamic jump (Литц): малый вертикальный сдвиг от поперечной составляющей ветра.
//   Для правого нареза: ветер слева → AJ вверх; ветер справа → AJ вниз.
//   Эмпирика Литца: ~0.01 MOA на 1 mph поперечного ветра.
// Возвращает угловое смещение в радианах (положительное = вверх).
function aeroJumpLitz(crosswind_mps, rightTwist = true) {
  const mph = crosswind_mps * 2.23694;
  const moa = -0.01 * mph; // ветер вправо (+) → AJ вниз для RH твиста
  const rad = moa * Math.PI / (180 * 60);
  return rightTwist ? rad : -rad;
}

// ───────────────────────────── RK4-интегратор ─────────────────────────────
// state = [x, y, z, vx, vy, vz]
function rk4Step(state, dt, accelFn) {
  const k1 = derivative(state, accelFn);
  const s2 = addScaled(state, k1, dt/2);
  const k2 = derivative(s2, accelFn);
  const s3 = addScaled(state, k2, dt/2);
  const k3 = derivative(s3, accelFn);
  const s4 = addScaled(state, k3, dt);
  const k4 = derivative(s4, accelFn);
  return state.map((v, i) => v + dt/6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
}
function derivative(state, accelFn) {
  const [, , , vx, vy, vz] = state;
  const [ax, ay, az] = accelFn(state);
  return [vx, vy, vz, ax, ay, az];
}
function addScaled(s, k, c) {
  const r = new Array(6);
  for (let i = 0; i < 6; i++) r[i] = s[i] + c * k[i];
  return r;
}

// ───────────────────────────── solve() ─────────────────────────────
// input: {
//   bc, dragModel: 'G1'|'G7'|'CUSTOM', customDrag: [[M,Cd], ...]
//   v0, sightHeight, zeroDistance, targetDistance,
//   tempC, pressureMbar, humidity,
//   windSpeed, windAngle_deg,            // ветер относительно оси стрельбы
//   shotAngle_deg,                        // угол места (наклон)
//   latitude_deg, azimuth_deg,            // для Кориолиса
//   twist_in, twistRight (default true),  // RH/LH для spin drift
//   bulletMass_gr, bulletLength_in, caliber_in, // для Miller
//   cant_deg,                             // завал винтовки от вертикали
//   v0_baseTempC, v0_tempSens_mps_per_C,  // темп-чувствительность пороха
//   ammoTempC,                            // температура боеприпасов (по умолч. = tempC)
//   truingPoints: [{ machAt, bcFactor }], // piecewise BC по Mach (Litz banding)
//   steps                                 // дистанции для таблицы (м)
// }
function solve(input) {
  // — выбор drag-таблицы —
  let table;
  if (input.dragModel === 'CUSTOM' && input.customDrag && input.customDrag.length >= 2) {
    table = input.customDrag.slice().sort((a, b) => a[0] - b[0]);
  } else {
    table = input.dragModel === 'G1' ? G1_TABLE : G7_TABLE;
  }

  const rho = airDensity(input);

  // — Powder temperature sensitivity: V₀ зависит от температуры боеприпаса —
  const ammoT = input.ammoTempC != null ? input.ammoTempC : input.tempC;
  const v0Base = input.v0_baseTempC != null ? input.v0_baseTempC : 21; // 70°F по умолч.
  const v0Sens = input.v0_tempSens_mps_per_C || 0;
  const v0 = input.v0 + v0Sens * (ammoT - v0Base);

  // — BC banding (Litz multi-point truing): BC меняется по Mach —
  // truingPoints отсортированы по machAt; piecewise-linear factor
  const trPts = (input.truingPoints || []).slice().sort((a, b) => a.machAt - b.machAt);
  function bcAtMach(M) {
    if (trPts.length === 0) return input.bc;
    if (trPts.length === 1) return input.bc * trPts[0].bcFactor;
    if (M <= trPts[0].machAt) return input.bc * trPts[0].bcFactor;
    if (M >= trPts[trPts.length - 1].machAt) return input.bc * trPts[trPts.length - 1].bcFactor;
    for (let i = 1; i < trPts.length; i++) {
      if (trPts[i].machAt >= M) {
        const a = trPts[i-1], b = trPts[i];
        const f = a.bcFactor + (b.bcFactor - a.bcFactor) * (M - a.machAt) / (b.machAt - a.machAt);
        return input.bc * f;
      }
    }
    return input.bc;
  }

  const cSound = speedOfSound(input.tempC, input.humidity);
  const g = 9.80665;
  const baseSigma = input.bc * 895; // используем как fallback если truingPoints пуст

  // — наклон выстрела (угол места) —
  const sa = (input.shotAngle_deg || 0) * Math.PI / 180;
  const gx = -g * Math.sin(sa);
  const gy = -g * Math.cos(sa);

  // — ветер (компоненты в системе цели: x вперёд, z вправо) —
  // windAngle_deg: 0 = попутный, 90 = справа, 180 = встречный
  const windRad = ((input.windAngle_deg || 0)) * Math.PI / 180;
  const wx = input.windSpeed * Math.cos(windRad);
  const wz = input.windSpeed * Math.sin(windRad);

  // — Кориолис: ω в системе стрелка-цель —
  // ω_x = Ω cos φ cos Az  (горизонт, в направлении цели)
  // ω_y = Ω sin φ          (вертикальная компонента)
  // ω_z = −Ω cos φ sin Az  (горизонт, перпендикулярно)
  const Omega = 7.2921159e-5;
  const lat = (input.latitude_deg || 0) * Math.PI / 180;
  const az  = (input.azimuth_deg  || 0) * Math.PI / 180;
  const wEx = Omega * Math.cos(lat) * Math.cos(az);
  const wEy = Omega * Math.sin(lat);
  const wEz = -Omega * Math.cos(lat) * Math.sin(az);

  // — функция ускорения (drag + gravity + Coriolis) —
  function accel(state) {
    const [, , , vx, vy, vz] = state;
    const vrx = vx - wx, vry = vy, vrz = vz - wz;
    const v = Math.hypot(vrx, vry, vrz);
    if (v < 1) return [0, gy, 0];
    const mach = v / cSound;
    const cd = interpDrag(table, mach);
    // BC banding: эффективная σ зависит от Mach (Литцовский подход)
    const sigmaEff = trPts.length ? bcAtMach(mach) * 895 : baseSigma;
    // a_drag_vector = -(Cd·ρ·V)/(2σ) · v_rel
    const k = (cd * rho * v) / (2 * sigmaEff);
    const ax_drag = -k * vrx;
    const ay_drag = -k * vry;
    const az_drag = -k * vrz;
    // Кориолис: -2 ω × v
    const cx = -2 * (wEy * vz - wEz * vy);
    const cy = -2 * (wEz * vx - wEx * vz);
    const cz = -2 * (wEx * vy - wEy * vx);
    return [ax_drag + gx + cx, ay_drag + gy + cy, az_drag + cz];
  }

  // — симуляция: интегрируем RK4 с шагом dt, собираем сэмплы на запрошенных дистанциях —
  function simulate(launchAngle, maxRange, captureSteps) {
    const dt = 0.0005;
    let state = [
      0, -input.sightHeight, 0,
      v0 * Math.cos(launchAngle),
      v0 * Math.sin(launchAngle),
      0
    ];
    let t = 0;
    const samples = [];
    let captureIdx = 0;
    while (state[0] < maxRange + 5) {
      const prevState = state;
      state = rk4Step(state, dt, accel);
      t += dt;
      // линейная интерполяция пересечения нужной дистанции
      while (captureSteps && captureIdx < captureSteps.length && state[0] >= captureSteps[captureIdx]) {
        const need = captureSteps[captureIdx];
        const frac = (need - prevState[0]) / (state[0] - prevState[0]);
        const interp = prevState.map((v, i) => v + frac * (state[i] - v));
        samples.push({
          range: need, x: interp[0], y: interp[1], z: interp[2],
          vx: interp[3], vy: interp[4], vz: interp[5],
          tof: t - (1 - frac) * dt
        });
        captureIdx++;
      }
      const v = Math.hypot(state[3], state[4], state[5]);
      if (v < 30) break;
      if (t > 30) break; // sanity
    }
    return { samples, finalState: state, t };
  }

  // — подбор угла бросания для попадания в "ноль" на zeroDistance —
  function yAtRange(angle, range) {
    const res = simulate(angle, range, [range]);
    return res.samples.length ? res.samples[0].y : 999;
  }
  let lo = -0.005, hi = 0.08;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    yAtRange(mid, input.zeroDistance) > 0 ? (hi = mid) : (lo = mid);
  }
  const launchAngle = (lo + hi) / 2;

  // — основная траектория —
  const defaultSteps = [50,100,150,200,250,300,400,500,600,700,800,900,1000,1100,1200];
  const steps = (input.steps && input.steps.length)
    ? input.steps.slice().sort((a,b)=>a-b)
    : defaultSteps.filter(d => d <= (input.targetDistance || 1000));
  const main = simulate(launchAngle, Math.max(...steps), steps);

  // — Sg (Miller) и spin drift для каждой точки таблицы —
  const Sg = millerStability(input.bulletMass_gr, input.twist_in, input.caliber_in, input.bulletLength_in);
  // velocity-corrected Sg по Miller-McCoy
  const v0_fps = input.v0 * 3.28084;
  const tempF = input.tempC * 9/5 + 32;
  const pressureInHg = input.pressureMbar * 0.02953;
  const SgCorr = Sg ? millerSgCorrected(Sg, v0_fps, tempF, pressureInHg) : null;
  const rightTwist = input.twistRight !== false;

  // — формирование строк таблицы —
  const moa = rad => rad * 60 * 180 / Math.PI;
  const mil = rad => rad * 1000;

  // Cant (завал винтовки от вертикали, положит. = вправо/по часовой с т.зр. стрелка).
  // По McCoy 8.30 / Litz AB ch.4: в канте-frame стрелок дозирует
  //   vert_dial  = D · cosθ − drift · sinθ
  //   horiz_dial = drift · cosθ + D · sinθ
  // где D — модуль вертикального снижения (положит.).
  const cant = (input.cant_deg || 0) * Math.PI / 180;
  const cosC = Math.cos(cant), sinC = Math.sin(cant);

  const rows = main.samples.map(s => {
    // base point-mass drop/drift
    const baseDrop = s.y;        // м, отрицательное = ниже линии прицела
    const baseDrift = s.z;       // м, положительное = вправо
    // Litz add-ons
    const sd_m = SgCorr ? spinDriftLitz(SgCorr, s.tof, rightTwist) : 0;
    const ajRad = aeroJumpLitz(wz, rightTwist); // угол в радианах
    const aj_m = ajRad * s.range; // линейное смещение по вертикали (положит. = вверх)

    const fullVert_m  = baseDrop + aj_m;             // вертикаль в мировой СК (без cant)
    const fullHoriz_m = baseDrift + sd_m;            // горизонталь в мировой СК

    // применяем поворот на cant (если 0 — без изменений)
    // D в формулах — модуль снижения, у нас fullVert_m отрицательное при просадке.
    const D = -fullVert_m;     // положит. = просадка
    const drift_w = fullHoriz_m;
    const vertDial_m  = D * cosC - drift_w * sinC;  // нужно подкрутить ВВЕРХ
    const horizDial_m = drift_w * cosC + D * sinC;  // нужно подкрутить ВПРАВО

    const dropRad  = s.range > 0 ? Math.atan2(vertDial_m, s.range)  : 0;
    const driftRad = s.range > 0 ? Math.atan2(horizDial_m, s.range) : 0;

    return {
      range: s.range,
      drop_m: -vertDial_m, drift_m: horizDial_m,
      drop_mil: mil(dropRad), drop_moa: moa(dropRad),
      drift_mil: mil(driftRad), drift_moa: moa(driftRad),
      vel_mps: Math.hypot(s.vx, s.vy, s.vz),
      energy_J: input.bulletMass_gr ? 0.5 * (input.bulletMass_gr * 0.0000648) * (s.vx*s.vx + s.vy*s.vy + s.vz*s.vz) : null,
      tof_s: s.tof,
      components: {
        gravity_drop_m: baseDrop,
        wind_drift_m:   baseDrift,
        spin_drift_m:   sd_m,
        aero_jump_m:    aj_m,
        cant_horiz_extra_m: horizDial_m - fullHoriz_m,
        cant_vert_loss_m:   (-vertDial_m) - fullVert_m,
        coriolis_included_in_base: true
      }
    };
  });

  return {
    launchAngle_deg: launchAngle * 180 / Math.PI,
    airDensity: rho,
    speedOfSound: cSound,
    Sg: Sg,
    SgCorrected: SgCorr,
    stable: Sg != null ? (SgCorr >= 1.4) : null,
    rows
  };
}

// ───────────────────────────── Truing ─────────────────────────────
// Single-point: подбирает масштаб BC, чтобы расчётное снижение на targetRange совпало с фактическим.
function trueBC(input, observedDropMil, targetRangeM) {
  const baseBC = input.bc;
  function dropMilAt(bc) {
    const r = solve({ ...input, bc, truingPoints: null, steps: [targetRangeM] });
    return r.rows[0]?.drop_mil ?? 0;
  }
  let lo = 0.5, hi = 2.0;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const d = dropMilAt(baseBC * mid);
    if (d > observedDropMil) lo = mid; else hi = mid;
  }
  const factor = (lo + hi) / 2;
  return { factor, truedBC: baseBC * factor };
}

// Multi-point truing: добавляет новую точку к input.truingPoints,
// подбирая bcFactor так, чтобы расчётное снижение на range совпало с фактическим.
// Mach для новой точки определяется по скорости пули на этой дистанции
// (с уже существующими точками).
function addTruingPoint(input, observedDropMil, range_m) {
  const existing = (input.truingPoints || []).slice();
  // baseline solve, чтобы найти Mach на дистанции
  const baseline = solve({ ...input, steps: [range_m] });
  if (!baseline.rows[0]) return null;
  const machAt = baseline.rows[0].vel_mps / baseline.speedOfSound;
  // бисекция bcFactor для новой точки на этом Mach
  function dropMilWithFactor(f) {
    const pts = [...existing, { machAt, bcFactor: f }];
    const r = solve({ ...input, truingPoints: pts, steps: [range_m] });
    return r.rows[0]?.drop_mil ?? 0;
  }
  let lo = 0.3, hi = 3.0;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const d = dropMilWithFactor(mid);
    if (d > observedDropMil) lo = mid; else hi = mid;
  }
  const bcFactor = (lo + hi) / 2;
  return { machAt, bcFactor, range_m, observedDropMil };
}

window.Ballistics = { solve, trueBC, addTruingPoint, airDensity, speedOfSound, pressureFromAltitude: null, millerStability, spinDriftLitz, aeroJumpLitz, interpDrag, G1_TABLE, G7_TABLE };
