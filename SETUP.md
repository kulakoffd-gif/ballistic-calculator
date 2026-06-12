# СкайРейндж — сборка Android APK

Capacitor оборачивает веб-приложение из `www/` в нативный Android-APK.
В нативе работают: реальный Bluetooth (Kestrel, SIG KILO), GPS, барометр,
файловая система — без HTTPS, без ограничений iOS.

## Два пути сборки APK

| Путь | Что ставить | Сколько времени | Для кого |
|---|---|---|---|
| **A. Облачная сборка через GitHub Actions** | только Git | ~5 мин на первый APK | проще, ничего не ставить на Mac |
| **B. Локальная сборка** | Node + JDK + Android Studio | ~30 мин установка, потом мгновенно | удобнее для активной разработки |

---

# A. Облачная сборка (GitHub Actions)

Готовый workflow уже лежит в `.github/workflows/build-android.yml`.
GitHub сам поднимет JDK + Android SDK + Gradle, соберёт APK и положит его в артефакты.

## Шаги

### 1. Поставить Git (если ещё нет)
```bash
brew install git
git config --global user.name "Твоё Имя"
git config --global user.email "твой@email"
```

### 2. Создать репозиторий на GitHub
- Зайти на https://github.com → кнопка «New repository»
- Имя: `ballistic-calculator`
- Можно сделать **Private** (без публичного доступа)
- НЕ инициализировать README — мы зальём свой код
- Скопировать URL вида `https://github.com/имя/ballistic-calculator.git`

### 3. Залить проект
В терминале, из этой папки (`Ballistic Calculator/`):
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/имя/ballistic-calculator.git
git push -u origin main
```

GitHub при первом push спросит логин — используй [Personal Access Token](https://github.com/settings/tokens) вместо пароля.

### 4. Дождаться сборки
- Открыть свой репозиторий на GitHub
- Вкладка **Actions** → увидишь запущенный workflow «Build Android APK»
- ~3-5 минут на первую сборку
- По завершении: внизу страницы workflow run → **Artifacts** → `skyrange-debug-apk` → скачать .zip

### 5. Установить на телефон
- Распаковать .zip → получишь `app-debug.apk`
- Скинуть на телефон (Telegram, AirDrop через стороннее приложение, USB, или просто облако)
- На телефоне: открыть файл → Android спросит разрешение установки из неизвестных источников → разрешить → готово

### При следующих изменениях
```bash
git add .
git commit -m "что изменил"
git push
```
GitHub Actions автоматически пересоберёт APK при каждом push.

---

# B. Локальная сборка

---

## 1. Что нужно установить один раз

### Node.js
```bash
# macOS (через Homebrew)
brew install node
node -v   # должно быть ≥ 20
```

### Android Studio
1. Скачать с https://developer.android.com/studio
2. Открыть, дойти до «More Actions → SDK Manager»
3. Установить:
   - Android SDK Platform 34 (или новее)
   - Android SDK Build-Tools (последняя)
   - Android SDK Command-line Tools

### JDK 17
Идёт вместе с Android Studio. Если нужен отдельно:
```bash
brew install --cask temurin@17
```

### Переменные окружения (добавить в `~/.zshrc`)
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

После — `source ~/.zshrc`.

---

## 2. Первая инициализация проекта

В этой папке (`Ballistic Calculator/`):

```bash
# 1. установить зависимости
npm install

# 2. создать нативный Android-проект (один раз)
npx cap add android

# 3. синхронизировать www/ → android/
npx cap sync
```

После этих команд появится папка `android/` — это полноценный Gradle-проект.

---

## 3. Сборка APK

### Debug-APK (для теста, подписан debug-ключом)
```bash
npm run build:debug
# APK будет в: android/app/build/outputs/apk/debug/app-debug.apk
```

Установить на подключённый по USB телефон:
```bash
npm run install:debug
```

Или открыть Android Studio:
```bash
npm run open
```
…и нажать Run.

### Release-APK (для постоянной установки)
```bash
# Сначала создать keystore (один раз)
keytool -genkey -v -keystore release.keystore -alias skyrange -keyalg RSA -keysize 2048 -validity 10000

# В android/app/build.gradle добавить signingConfigs (Android Studio это умеет автоматически)

# Сборка
npm run build:release
# APK будет в: android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Когда что-то меняется в `www/`

После любых правок веб-кода:
```bash
npm run sync   # перекидывает www/ в android/app/src/main/assets/
```
И пересборка APK.

---

## 5. Bluetooth-разрешения

Плагин `@capacitor-community/bluetooth-le` сам добавляет нужные пермишены
в `AndroidManifest.xml` при `cap sync`. Если на телефоне Android 12+ —
при первом подключении система спросит «Найти соседние устройства» — нажми «Разрешить».

Для подключения к Kestrel / SIG KILO **не нужно** включать GPS на телефоне.

---

## 6. Подключение устройств

1. Запусти приложение
2. **Настройки → Устройства → 🌬 Kestrel** или **🎯 SIG KILO**
3. Система покажет диалог со списком найденных BLE-устройств — выбери своё
4. Дождись «подключено» и появления данных
5. Если данные парсятся неверно (например, температура 6553°C):
   - Нажми **Debug** — посмотри сырые байты
   - Нажми **Парсер** — подстрой оффсеты и масштабы для каждого поля
   - Сохрани — настройки запомнятся

---

## 7. Файлы проекта

```
Ballistic Calculator/
├── package.json              ← зависимости
├── capacitor.config.json     ← конфиг Capacitor
├── .gitignore
├── SETUP.md                  ← этот файл
├── www/                      ← веб-исходники (редактируй тут)
│   ├── index.html
│   ├── app.js                ← UI и роутинг
│   ├── ballistics.js         ← solver
│   ├── devices.js            ← компас + Bluetooth (dual: Web/Native)
│   ├── storage.js            ← IndexedDB
│   ├── style.css
│   ├── icon.svg
│   └── manifest.webmanifest
└── android/                  ← создаётся автоматически после cap add android
```

---

## 8. Типовые ошибки

**`SDK location not found`**
→ Не задан `ANDROID_HOME`. См. шаг 1.

**`A failure occurred while executing com.android.build.gradle.internal.tasks`**
→ Проверь, что в Android Studio установлен SDK Platform 34. SDK Manager → Android 14 (UpsideDownCake) → API Level 34.

**APK ставится, но при открытии — пустой экран**
→ `npx cap sync` после правок web-кода. Без sync — старая копия в APK.

**Bluetooth требует «доступ к местоположению»**
→ Это поведение Android до 12. На 12+ есть отдельный пермишен `BLUETOOTH_SCAN` с флагом `neverForLocation` — он уже выставлен плагином.

**Не находит Kestrel / KILO**
→ Проверь, что устройство в режиме сопряжения (для Kestrel — Connection → Mobile → Pair). Если в нативном Bluetooth настройках Android оно уже сопряжено — отвяжи, чтобы наше приложение могло найти его сразу.
