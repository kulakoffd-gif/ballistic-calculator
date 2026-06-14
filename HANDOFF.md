# BalisticNote Pro — handoff в новую ветку

Этот файл — конспект текущего состояния проекта для продолжения работы в новой сессии Claude Code. Читай его первым.

---

## 1. Что это и где лежит

**BalisticNote Pro** — Android-приложение: баллистический калькулятор (стиль Strelok Pro / AB Quantum) + журнал стрельб и релоадинга. Собрано как Capacitor-проект (нативный APK с веб-движком внутри).

| Что | Путь |
|---|---|
| Активный проект | `/Users/User1/Library/Mobile Documents/com~apple~CloudDocs/Ballistic Calculator/` |
| Старая PWA-версия (заморожена) | `/Users/User1/Library/Mobile Documents/com~apple~CloudDocs/Приложение для стрельбы/` |
| GitHub-репо | `kulakoffd-gif/ballistic-calculator` (private, main branch) |
| APK на Mac | `~/Downloads/BalisticNote-Pro-debug.apk` |
| AB Quantum manual (для UI-паттернов) | `~/Library/CloudStorage/GoogleDrive-kulakoff.d@gmail.com/Мой диск/Снайпинг/Книги/Manuals/AB Quantum User Manual.pdf` (620 стр.) |
| Референс-видео Skyrange (UI-паттерны wizard'а) | `Приложение для стрельбы/IMG_3990.MP4` (можно удалить если не нужно) |

**AppId**: `com.balisticnote.pro` (Android package name). Раньше был `com.skyrange.ballistic` — менять не нужно, переезд уже сделан.

---

## 2. Стек

- **Capacitor 8.4.0** (нативный Android-wrapper)
- **Vanilla JS** (без React/Vue — намеренно, чтобы избежать сборщиков)
- **IndexedDB** для хранения (8+ stores)
- **Capacitor BLE plugin** (`@capacitor-community/bluetooth-le` 8.2.0) для нативного Bluetooth
- **Capacitor Camera plugin** (`@capacitor/camera` 8.2.0) для фото
- **Capacitor Geolocation, Preferences** — для GPS
- **Шрифт**: Chakra Petch (Google Fonts) — operator/HUD vibe
- **Цвета**: тёмный (`#0a0e14`) + оранжевый акцент (`#ff8b3d`) + зелёный (good) + красный (danger)

---

## 3. Структура файлов

```
Ballistic Calculator/
├── package.json                   ← Capacitor deps
├── capacitor.config.json          ← appId=com.balisticnote.pro, appName=BalisticNote Pro
├── debug.keystore                 ← фиксированный keystore (важно, см. §10)
├── assets/
│   ├── icon.png (1024×1024)       ← source для @capacitor/assets
│   └── icon-foreground.png
├── .github/workflows/build-android.yml   ← GitHub Actions CI
├── SETUP.md                       ← инструкция сборки (можно использовать как есть)
├── HANDOFF.md                     ← этот файл
└── www/
    ├── index.html                 ← оболочка + загрузка скриптов и шрифта
    ├── style.css                  ← вся стилизация (~600 строк)
    ├── app.js                     ← главный UI-модуль, все роуты (~3300 строк)
    ├── ballistics.js              ← solver + helpers (~500 строк)
    ├── storage.js                 ← IndexedDB-обёртка
    ├── devices.js                 ← Compass + Bluetooth dual-mode + Open-Meteo
    ├── manifest.webmanifest       ← PWA-манифест (используется и для веб-фоллбэка)
    └── icon.svg                   ← веб-иконка
```

---

## 4. GitHub Actions / CI

Каждый `git push` в `main` → собирается APK на Ubuntu runner за ~5-8 мин:

1. Setup JDK 21, Node 22, Android SDK 35
2. Копирует `debug.keystore` → `~/.android/debug.keystore`
3. `npm install`
4. `npx cap add android` (если папки android/ нет)
5. **Патчит** `android/app/build.gradle` — добавляет explicit signingConfig с явным путём к `debug.keystore` (последний фикс, см. §10)
6. `npx capacitor-assets generate --android` — генерит PNG-иконки из `assets/icon.png` во все mipmap-* папки
7. `npx cap sync android`
8. `./gradlew assembleDebug`
9. `apksigner verify --print-certs` — печатает SHA подписи в лог (диагностика)
10. Upload APK как artifact

**Скрипт мониторинга на Mac-стороне** (примеры в логах сессии):
- Поллит `https://api.github.com/repos/kulakoffd-gif/ballistic-calculator/actions/runs?per_page=1`
- При `conclusion=success` качает artifact zip и кладёт `app-debug.apk` → `~/Downloads/BalisticNote-Pro-debug.apk`

**GitHub PAT (token)**: `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` — был использован в чате, можно отозвать и создать новый на `github.com/settings/tokens`. Нужны scopes: `repo` + `workflow`.

---

## 5. UI и маршруты

Главное меню — drawer (правое боковое меню, кнопка `≡` в topbar).

| Роут | Что |
|---|---|
| `/` | Splash: логотип «БалистикНоут Про» + кнопки Выбор полигона / Быстрый калькулятор + **чекбокс «🎯 Движка»** → разворачивает Линейная/Ротор |
| `/ranges` | Список полигонов |
| `/range/:id` | Меню полигона (4 плитки: Одиночная цель / Карта целей / История попаданий / Настройки) |
| `/range/:id/edit` | Управление позициями + целями полигона |
| `/range/:id/single` | **Wizard в 4 шага**: позиция → цель → ввод ветра (компас+часы) → результат с часами-нотацией |
| `/range/:id/history` | История попаданий по полигону |
| `/range/:id/map` | Multi-target solution для одного выстрела |
| `/journal` | **Глобальный поиск** по всем попаданиям с фильтрами (полигон / позиция / патрон / темп. / влажн. / ветер / дист. / дата / hit-only) + сортировка + группировка + **CSV-экспорт** |
| `/calc` | **Главный калькулятор**: HUD-карточка (sticky сверху) + 4 таб-секции снизу (⚡Быстро / 🔫Пуля / 🌡Атмо / ⚙Прочее) + live-recalc на любое изменение |
| `/moving-target` | Линейная цель (с секундомером для замера mil/sec) или Ротор (RPM, радиус, лопасти, **(i)** справка по методикам) |
| `/mil-ranging` | Мил-рейнджинг tool: размер цели + mils → дистанция, и обратно |
| `/weapons`, `/weapon/:id` | Профили оружия (твист, RH/LH, sight height, нолевая дист., **Cold Bore Adjustment**, привязка к сетке прицела) |
| `/cartridges`, `/cartridge/:id` | Профили патронов (BC, dragModel, V₀, масса, длина/калибр, темп. чувствит. пороха, **базовый патрон+сдвиг для остальных**, **custom drag CDM**, **multi-point truing по Mach**) |
| `/reticles`, `/reticle/:id` | Сетки прицелов: загрузка фото (через нативный Camera plugin) + калибровка тапом 2-х точек + просмотр с метками целей |
| `/settings` | Toggle «обнули барабанчики» flash + HUD mode + Bluetooth-устройства (Kestrel/KILO) + экспорт-импорт IndexedDB в JSON |

---

## 6. Solver — что считает (`www/ballistics.js`)

### Модель
- **G1 / G7 drag tables** (BRL public-domain) или **custom CDM-таблица** {Mach, Cd}
- **RK4 интегратор** трёхмерного point-mass
- **Modified Point-Mass** с добавками по Литцу

### Эффекты учитываются
- ✅ Drag (G1/G7/CUSTOM)
- ✅ Гравитация (с компонентой угла места)
- ✅ Поперечный ветер (полный 3D-вектор)
- ✅ Coriolis (полный векторный `-2 ω × v`, нужны lat + azimuth)
- ✅ Spin drift (Miller-стабильность + эмпирика Литца)
- ✅ Aerodynamic jump (Литц: 0.01 MOA на 1 mph поперечного ветра)
- ✅ Cant (завал) — постпроцесс поворотом (drop, drift) на cant_deg
- ✅ Powder temperature sensitivity (V₀ зависит от темп. боеприпаса)
- ✅ Plotnost воздуха (Tetens formula с влажностью)
- ✅ Multi-point BC truing (piecewise-linear factor по Mach band'ам)

### Не реализовано (Wave 3+)
- ❌ WEZ (hit probability Monte Carlo)
- ❌ Magnus effect (мал, опущен по согласованию)
- ❌ Powell effect (мал)
- ❌ Velocity truing (хроно на дист.) — есть только BC truing

### Хелперы
- `Ballistics.solve(input)` — основной solver, возвращает rows[] для steps
- `Ballistics.trueBC(input, observedDropMil, range_m)` — single-point truing
- `Ballistics.addTruingPoint(input, observed, range)` — multi-point banding
- `Ballistics.chronoStats(velocities)` → {avg, sd, es, sdPct}
- `Ballistics.densityAltitude_ft(atm)` → DA в футах
- `Ballistics.kineticEnergyJ/FtLb`, `taylorKO`

---

## 7. Хранилище (IndexedDB)

DB: `skyrange`, version 3. Stores:
- `ranges` — полигоны
- `positions` — огневые позиции, привязаны к полигону
- `targets` — цели (дист., азимут, имя)
- `weapons` — оружие (twist, sight height, нолевая дист., reticleId, CBA)
- `cartridges` — патроны (включая reload-fields, truingPoints, isBase/baseCartridgeId/offset, customDrag, темп. чувствит.)
- `sessions` — выходы (полный журнал — на будущее)
- `hits` — фиксированные попадания (для глобального журнала)
- `shots` — расчёты (короткая история)
- `reticles` — сетки прицелов (imageDataUrl + calibration p0/p1)
- `bullets` — библиотека пуль (заглушка для Wave 2)
- `casePreps` — подготовка гильз (заглушка для Wave 2)
- `notes` — заметки прикреплённые к сущностям (заглушка для Wave 2)

---

## 8. Стиль и предпочтения пользователя

**Язык**: русский. Все UI-тексты, лейблы, тосты — на русском.

**Поведение, которое пользователь хочет**:
- Делай сам — он не хочет лазить в терминал. Сам ставлю JDK через brew, сам пушу, сам мониторю билды, сам кладу APK в Downloads.
- Лаконичность. Не вываливай длинных таблиц без причины — делай 2-3 sentence ответ.
- Брендинг — иконки строго свои (пуля на тёмном фоне с трекинговой пунктирной траекторией). Шрифт — Chakra Petch (operator/HUD vibe).
- AB Quantum как референс для UI. Сейчас HUD-карточка вверху + табы инпутов внизу.

**Привычки**:
- На стрельбище меняет **V₀, ветер, азимут** — это вынесено в таб «⚡ Быстро»
- Часто стреляет разными патронами с одного оружия — поэтому сделан **базовый патрон + сдвиг** + диалог «обнулил барабан или с базы стреляешь?»
- Жмёт «ОБНУЛИ БАРАБАНЧИКИ» flash при любой смене дистанции — это включено по умолчанию, можно выключить в /settings
- Хочет HUD-режим (огромный шрифт результата) — toggle есть, по умолчанию off

**Чего пользователь НЕ хочет**:
- Декомпилировать Strelok Pro APK (это поднимал он, я отказался по лицензии — правильно)
- Сложные многошаговые setup'ы для одной правки
- Терять данные между переустановками APK (фиксированный keystore это решает)

---

## 9. UX-правила в UI

- **Все числовые инпуты** центрированы (`input[type=number] { text-align:center }`)
- **Все лейблы** центрированы
- **HUD-карточка** — числа адаптивные через `clamp(26px, 10vw, 44px)`, чтобы не вылазили за рамку
- **Бесполезных кнопок «Рассчитать»** нет — везде live-recalc на изменение
- **Стрелки направления** ▲▼◄► рядом с mil-значениями в HUD (положит. mil вверх = ▲)
- **Дистанция в HUD** — простое поле, тап → очистка + цифровая клавиатура, справа красная «Отмена»
- **Sheet'ы**: `max-height: 88dvh; overflow-y: auto` — клавиатура не выкидывает контент
- **Per-field источники погоды** — мини-кнопки 🌐 (Open-Meteo по GPS) / 📱 (барометр или GPS-высота) / 📡 (Kestrel BT). Каждое поле имеет свой набор.
- **Компас ветра** — два указателя: серый 🎯 = направление выстрела, оранжевый = направление ветра. В wizard'е есть переключатель Компас ↔ Часы (циферблат относительно ствола).

---

## 10. Подписание APK — ВАЖНО

**Проблема**: GitHub Actions по умолчанию генерит случайный debug-keystore на каждой сборке. Из-за этого:
- Каждый новый APK подписан другим ключом
- Android считает их **разными приложениями с одним package name**
- При установке поверх — **«ругается на конфликт»** и блокирует

**Фикс** (уже сделан):
1. Сгенерирован `debug.keystore` локально через `keytool` (alias `androiddebugkey`, pass `android`/`android`, validity 10000 days)
2. Закоммичен в репо (debug-keystore не секрет)
3. Workflow копирует его → `~/.android/debug.keystore` + кладёт в `android/app/debug.keystore`
4. **Патчит `android/app/build.gradle`** — добавляет explicit `signingConfigs { debug { storeFile file('debug.keystore') ... } }`
5. `apksigner verify --print-certs` в логе печатает SHA подписи — должно быть **одинаково** между сборками

**Подвох**: APK, установленные ДО этого фикса (commit a0faef9), имеют случайные подписи. Один раз нужно **удалить старое приложение** перед установкой первого APK с фиксом. После этого все следующие — поверх без удаления.

**Подтверждение фикса**: SHA-256 подписи Wave 1c (`ba6e4b7`) и Wave 2-4 (`26692d7`) идентичны: `14038202d24363a7f2f9735d8a95105e6f430b411124f6a626111dbbc20d2151`.

**Защита от потери данных** (`www/backup.js`):
- Каждое изменение в IndexedDB через `Store.put`/`del`/`importAll` (debounced 2 сек) дублируется в `/storage/emulated/0/Documents/BalisticNote/backup.json` через Capacitor Filesystem с `Directory.Documents`.
- Documents-папка переживает удаление приложения — файл остаётся.
- На старте приложения: если IndexedDB пустая И бэкап-файл существует → confirm «Восстановить?».
- В `/settings` — карточка «Авто-бэкап в /Documents» с кнопками «💾 Сохранить сейчас» и «⤵ Восстановить».

---

## 11. Bluetooth-интеграции

**Профили в `devices.js`**:
- `KESTREL_5700` (метеостанция) — pulls T/P/RH/wind
- `SIG_KILO_BDX` (дальномер) — pulls range_m + angle

**UUIDы** в коде — из публичных reverse-engineering проектов (kestrel-link, esp32-bdx). **На реальной прошивке могут не совпасть.** Поэтому встроен **debug-режим** и **редактор парсера** (offset + scale per field) в /settings → Устройства → конкретное устройство → Парсер.

**Web Bluetooth НЕ работает на iOS Safari** (Apple блокирует). На Android Chrome работает с HTTPS. **В нативе** (Capacitor APK) — работает напрямую через `@capacitor-community/bluetooth-le` (общий интерфейс `window.BT`).

---

## 12. Что ещё на TODO

### Wave 1c (мелкое незавершённое) — ✅ всё сделано
- ✅ ~~W2 (второй ветер)~~ — HUD рендерит 3-ю колонку «Гор. W2» когда `windSpeed2 > 0` (`renderBig()` + `.main-values.has-w2` CSS)
- ✅ ~~Subtension mode~~ — тап по сетке прицела → крест + подпись «≈ NNNм» (ищет ближайший row по евклиду drift/drop_mil). Кнопка «✕ метка» сбрасывает.
- ✅ ~~Pinch-zoom~~ — двумя пальцами pinch с focal point, drag одним пальцем при zoom>1, кнопки `+`/`−`/`1:1` в тулбаре. CSS transform на canvas в overflow:hidden viewport.
- ✅ ~~Inclination warning~~ — `srcCompass()` для cant_deg + live-баннер в HUD: «⚠ Завал по компасу X° (введено Y°) — тапни чтобы синхронизировать». Пороги: `|cant| > 3°` ИЛИ `|cant - input| > 1°`. Compass.start() запускается пассивно на Android (где нет requestPermission); на iOS — только по кнопке 📐.

### Wave 2 (релоадинг) — ✅ всё сделано
- ✅ ~~Библиотека пуль~~ — `BULLET_PRESETS` (~30 пуль Berger/SMK/Hornady/Lapua) + sheet «📚 Выбрать из библиотеки» в форме патрона
- ✅ ~~Подготовка гильз~~ — стор `casePreps`, роуты `/casepreps` и `/caseprep/:id` (отжиг, FL-die, bushing, проточка, COAL/CBTO, высота головки, фото мишени, заметки)
- ✅ ~~Хронограф ES/SD/SD%~~ — textarea в форме патрона, live-stats avg/SD/ES/SD%, кнопка «Avg → V₀»
- ✅ ~~Универсальные заметки~~ — стор `notes`, роуты `/notes` и `/note/:id` с прикреплением к патрону/оружию/полигону + теги
- ✅ ~~Энергия / Taylor KO~~ — в карточке параметров `/calc`

### Wave 3 (анализ) — ✅ всё сделано
- ✅ ~~Анализ кучности по фото~~ — `/group-analyzer`: загрузка фото, 2 калибровочные точки + длина в см, тап пробоин → Mean Radius / Extreme Spread / MOA / mil. Кнопка «Отменить» откатывает последнюю точку.
- ✅ ~~Spotting corrections~~ — кнопка «🎯 Промах» в HUD `/calc` → sheet «вертикаль/горизонталь промаха» → новая поправка
- ✅ ~~Атмосферные пресеты~~ — `/atmo-presets` (snapshot текущей атмо из `/calc`, применение одной кнопкой)
- ✅ ~~WEZ Monte Carlo~~ — `/wez`: задаёшь σ дальности/V₀/ветра/ствола → 800 симуляций с numeric derivatives, canvas с эллипсом и % попаданий
- ✅ ~~Сравнение релоадов~~ — `/compare`: чекбоксы патронов + общая атмо/оружие → таблица drop/drift на N дистанциях бок о бок

### Wave 4 (соревнования / тюнинг) — ✅ всё сделано
- ✅ ~~PRS multi-target stage~~ — стор `stages`, роуты `/stages` и `/stage/:id` (название, лимит, патронов, описание, список целей), кнопка «↗ Поделиться JSON» (navigator.share или clipboard)
- ✅ ~~Range Card печать~~ — `/range-card` с белой карточкой и `@media print` CSS, кнопка «🖨 Печать / Сохранить PDF»
- ✅ ~~Custom drag builder из DOPE~~ — `/drag-builder`: textarea «дист, mil» по строкам → пакетный вызов `addTruingPoint`, превью результата + «💾 Записать в патрон»
- ✅ ~~Long-press tooltips~~ — touchstart-таймер 600ms на `label[for]`, словарь `FIELD_HELP` (BC, dragModel, V₀, twist, sight height, zero, wind, temp, pressure, cant и др.) → sheet с пояснением
- ✅ ~~MV Temp Table~~ — textarea «°C, V₀» в форме патрона (`cart.mvTempTable`), приоритет над линейным коэф. Применяется в `buildSolverInputFor` и в `/calc` submit через `v0FromMvTable()`.

### Wave 5 (iOS) — заблокирована железом
- **Не сделано** — требует Mac с Xcode и аккаунт Apple Developer ($99/год). Капкан: `@capacitor/camera` и `@capacitor-community/bluetooth-le` уже совместимы с iOS, останется только `npx cap add ios` + Info.plist (NSBluetoothAlwaysUsageDescription, NSCameraUsageDescription, NSLocationWhenInUseUsageDescription, NSMotionUsageDescription для DeviceOrientation).

---

## 13. Чего я НЕ должен делать (важные feedback'и)

- ❌ Не реверс-инжинирить APK Стрелка Про или другого коммерческого приложения
- ❌ Не публиковать iOS-версию без понимания процедур (отдельная тема)
- ❌ Не выдавать факты из памяти без проверки (был эпизод с «автор Strelok Pro — Игорь Борисов» → пришлось проверять через WebFetch и AppBrain; оказалось верно, но валидацию надо делать ДО утверждения)

---

## 14. Список последних коммитов (контекст для git log)

Свежие коммиты на main:
```
a0faef9  fix: жёстко патчим android/app/build.gradle с явным signingConfig + apksigner verify в логах
95d6d06  feat: ± stepper заменён на простой ввод дистанции — тап → очистка + numeric keyboard + Отмена
2f4c6d4  feat: /calc на табы (Быстро/Пуля/Атмо/Прочее) + clamp() для HUD-чисел + центрирование инпутов
ef6624a  feat: HUD-разделение в /calc — sticky карточка решения сверху, инпуты ниже, live-recalc
e137f0e  fix: фото сетки — Capacitor Camera plugin + resize до 1500px + диагностика toast
78dfbda  fix: Chakra Petch шрифт + центрированные number-инпуты + dvh-overflow + Android иконки через @capacitor/assets
a645970  rebrand: BalisticNote Pro (com.balisticnote.pro) + иконка-пуля + фиксированный debug.keystore + W2-каркас
82e0c22  feat: per-field источники погоды (🌐 📱 📡) + кэш 60с
0a84683  feat: двухстрелочный компас ветра (Fire 🎯 серый + Wind оранжевый)
5e77bd0  feat: hero-card со стрелками направления + ± stepper с live-recalc дистанции
```

---

## 15. Открытые вопросы и решения, которые откладывали

1. **Шрифт** — пользователь выбрал Chakra Petch. Лежит через Google Fonts CDN. В оффлайне (без интернета) подгрузка может не работать — для надёжности можно скачать .woff2 и положить в `www/fonts/`.

2. **Bullet drag tables от Литца** — пользователь хочет «по Литцу». Мы НЕ копируем его таблицы из книги (copyright). Юзер сам копирует Mach/Cd пары в поле «Custom drag» в патроне.

3. **Strelok Pro APK** — пользователь предлагал реверс. Я отказался. Реализую методически по открытым формулам (Litz, Pejsa, McCoy, Miller, BRL).

4. **Темп. чувствительность пороха** — линейная (`v0_tempSens_mps_per_C`). Литц рекомендует таблицу (MV temp table). Можно сделать опционально.

---

## 16. Команды для быстрого старта в новой ветке

```bash
# проверить состояние репо
cd "/Users/User1/Library/Mobile Documents/com~apple~CloudDocs/Ballistic Calculator"
git log --oneline -10
git status

# собрать APK локально (если поставлен Android Studio)
npm install
npx cap add android   # если папки нет
npx cap sync
cd android && ./gradlew assembleDebug

# или просто пушить — CI соберёт сам
git push origin main
```

Token PAT для пуша в самом начале сессии лучше попросить у пользователя заново (старый протух или отозван).

---

Это всё, что нужно для старта в новой ветке. Удачи, следующая Claude-сессия 🎯
