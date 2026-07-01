// Единицы измерения — зафиксированы один раз (см. UNITS.md в корне проекта).
// Расчёт всегда в метрической базе (м, mil, °C, гПа, м/с, гран, дюйм, Дж, фут).
// Это просто форматтеры для отображения — без переключателей и настроек в приложении.
// Чтобы поменять единицу — правь константы ниже и UNITS.md, пересобирать/включать
// ничего не нужно.

const nf = (v, d) => (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(d);

const Units = {
  // дистанция — метры
  distStr(m) { return `${nf(m, 0)} м`; },

  // поправки — только mil (MOA и см убраны по решению пользователя)
  corrVal(mil) { return nf(mil, 2); },
  corrUnit() { return 'mil'; },
  corrSecondary() { return ''; },

  tempStr(c) { return `${nf(c, 0)} °C`; },
  pressStr(hpa) { return `${nf(hpa, 0)} гПа`; },
  velStr(mps) { return `${nf(mps, 0)} м/с`; },
  windStr(mps) { return `${nf(mps, 1)} м/с`; },
  windUnit() { return 'м/с'; },
  energyStr(J) { return `${nf(J, 0)} Дж`; },
  daStr(ft) { return `${nf(ft, 0)} ft`; },
};

window.Units = Units;
