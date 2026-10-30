# Рендеры и 3D дома: как сделано и как повторить

Как калькулятор получает картинки дома, которые похожи на фото: 3D-модель
строится из плана калькулятора, а Unreal Engine 5 рендерит её так, как это
делают архвиз-студии. Здесь собрано всё: программы, плагины, материалы,
настройки света и камеры с источниками, а также скрипты (в `tools/render/`).

## 1. Путь от калькулятора до картинки

```
калькулятор: план и размеры (src/engine/floorplan.ts, BRICK_FOOTPRINT)
   │  tools/render/blender/export_brick.ts   → plan.json
   ▼
Blender 5.2 без окна: tools/render/blender/build_brick.py
   │  → home_brick_ue.glb (дом, мощение, терраса, бассейн, навес, забор на участке 25 × 20 м)
   │  → cameras.json, lights.json, plants.json
   ├──────────────► public/models/brick-house.glb (сжатый, для 3D-вкладки на three.js)
   ▼
Unreal Engine 5.8: tools/render/unreal/Scripts/build_scene.py   (сцена)
                   tools/render/unreal/Scripts/render.py        (кадры)
   ▼
src/assets/gallery/brick-*.jpg  (галерея калькулятора)
```

Скрипты ждут рабочую папку `~/Desktop/home-3d` (модель, ассеты, результаты):

| Папка | Что в ней |
|---|---|
| `~/Desktop/home-3d/brick/` | модель дома и `cameras.json`, `lights.json`, `plants.json`; кадры в `renders_unreal/` |
| `~/Desktop/home-3d/assets/polyhaven/`, `assets/ambientcg/` | CC0-текстуры, HDRI, растения (`tools/render/blender/fetch_polyhaven.py`) |
| `~/Documents/Unreal Projects/BrickHouse/` | проект Unreal (копия `tools/render/unreal/` плюс импортированный контент). Старый путь `~/Desktop/home-3d/ue/BrickHouse` — симлинк сюда: Epic Launcher видит проекты только в `~/Documents/Unreal Projects` |

## 2. Программы

| Программа | Версия | Зачем |
|---|---|---|
| Unreal Engine | 5.8.4 (Epic Games Launcher → Unreal Engine → Library → Engine Versions → +) | фото-рендер |
| Xcode | из App Store | Unreal на macOS без него не запускается |
| Blender | 5.2 | строит 3D-дом из плана, без окна |
| Node.js | как для калькулятора | `export_brick.ts`, сжатие модели для сайта |
| Twinmotion | 2026.1 (необязательно) | ручной рендер той же модели со своей библиотекой |

## 3. Что умеет Mac на M1 Max (и чего нет)

По таблице возможностей Epic для macOS:

| Возможность | M1 / M1 Max |
|---|---|
| Lumen, программная трассировка | ✅ |
| Lumen, аппаратная трассировка, MegaLights | ❌ нужен M2+ (экспериментально) |
| Nanite, виртуальные тени (VSM), Nanite-растения | ❌ нужен M2+ (бета) |
| Path Tracer в Movie Render Queue | ❌ только Windows + DX12 + RTX |

Поэтому на M1 путь один: **программный Lumen, каскадные тени солнца и Movie
Render Queue с большим числом сэмплов**. Настройки `r.Shadow.Virtual.*` здесь
ничего не делают.

## 4. Плагины Unreal (включены в `BrickHouse.uproject`)

| Плагин | Зачем |
|---|---|
| Python Editor Script Plugin, Editor Scripting Utilities | сборка сцены и рендер скриптами |
| Movie Render Queue, Mask Render Pass | качественный рендер: сглаживание сэмплами, прогрев Lumen |
| Interchange, Interchange Editor | импорт `.glb` с положением всех объектов |
| Sun Position Calculator (`SunPosition`) | настоящее солнце по координатам, дате и времени (Ереван: 40.18° N, 44.51° E, UTC+4) |
| HDRI Backdrop | небо-панорама с полом-ловцом теней (для быстрых кадров) |
| Fab | библиотека Quixel Megascans и ассетов Fab прямо в редакторе |
| PCG, PCG Biome Core | процедурная расстановка травы и растений |
| Water | вода бассейна |
| Geometry Scripting | фаски на рёбрах в редакторе |
| Color Correct Regions | цветокоррекция зон кадра |

Bridge (старый Quixel Bridge) Epic выводит из употребления, Megascans теперь
берутся через Fab. Плагины Nanite Foliage, Dynamic Wind и Procedural
Vegetation Editor на M1 не работают.

## 5. Материалы: что берут профессионалы и что стоит у нас

Профессионалы берут сканированные материалы и растения (Quixel Megascans) и
готовые наборы мебели, а дом детализируют: фаски на всех рёбрах (3–10 мм),
настоящая толщина стен и откосы окон, отливы, глубина рам, шторы, плинтусы,
швы облицовки, неровная шероховатость, мелкие следы и декали.

### У нас сейчас: бесплатные CC0

| Поверхность (слот материала в модели) | Текстура | Источник |
|---|---|---|
| Фасад 1 этажа и пилон (`Facade_Travertine`) | Travertine009, бежевый травертин | ambientCG |
| 2 этаж (`Facade_WoodPanel`) | WoodSiding008, тёмная деревянная обшивка | ambientCG |
| Софиты под кровлей (`Soffit_Wood`) | WoodFloor064, тёплое дерево | ambientCG |
| Забор (`Fence_Render`) | Plaster001 | ambientCG |
| Газон (`Lawn`) | Grass004 | ambientCG |
| Мощение (`Paving`, `Paving_Terrace`, `Paving_Drive`) | granite_tile_04, concrete_tiles | Poly Haven |
| Паркет (`Floor_Oak`, вся кухня-гостиная и спальни) | laminate_floor_03, тёплый дуб, roughness ×0.6 → ~0.31, даёт блики солнца | Poly Haven |
| Стены, потолки | painted_plaster_wall | Poly Haven |
| Диван, подушки (`Fabric_Sofa`, `Fabric_Accent`) | poly_wool_herringbone, плетение видно в нормалях | Poly Haven |
| Постель, шторы-лён (`Fabric_Bedding`, `Curtain_Linen`) | rough_linen, обесцвечена (`Desat` 1), цвет задаёт `Tint` | Poly Haven |
| Ковры (`Rug_Wool`), плед и акцентная подушка | knitted_fleece, cotton_jersey | Poly Haven |
| Тюль (`Curtain_Sheer`) | `M_Sheer`: полупрозрачный, двусторонний, opacity 0.55 | — |
| Кровля, рамы, карнизы | тёмный металл, без текстуры | — |
| Растения | wild_rooibos_bush, jacaranda_tree | Poly Haven |
| Декор | book_encyclopedia_set_01, ceramic_vase_01/02/03, standing_picture_frame_01, wooden_bowl_01, side_table_01 | Poly Haven (модели, glTF 1k) |

Все текстуры и модели Poly Haven качает `python3 tools/render/blender/fetch_polyhaven.py`
(в `~/Desktop/home-3d/assets/polyhaven`, уже скачанное пропускает). Тон
обесцвеченных тканей подобран по средней яркости текстуры: `Tint = нужное
альбедо / средняя линейная яркость` (rough_linen 0.40, knitted_fleece 0.075,
poly_wool_herringbone 0.18, cotton_jersey 0.43, laminate_floor_03 0.19).

### Мастер-материал `M_PBR3`

Все текстурные слоты идут через один мастер. Параметры поверх текстуры:

| Параметр | Что делает | Травертин |
|---|---|---|
| `Tiling` | плотность текстуры (UV в метрах) | 1/1.5 |
| `Desat` | 0..1 обесцветить текстуру, цвет берётся из `Tint` | 0 |
| `JointSize` | размер плиты (u, v) в метрах | 1.2 × 0.6 (цоколь 1.2 × 0.45) |
| `JointHalfWidth` | половина шва; 0 — швов нет | 0.004 (шов 8 мм) |
| `JointDarken` | насколько темнее шов (шов ещё и полностью матовый) | 0.3 |
| `PanelVariation` | ± тон каждой плиты, как у настоящего камня | 0.07 |

Видимые швы и разный тон плит — главное, чем фасад Vinode отличается от
«однотонной заливки».

### Интерьер: что делает кадр «жилым»

Разбор шаблона Vinode (youtu.be/5VOTfkBfgCI) показал: дело не в редких
материалах, а в трёх вещах — шторы в каждом окне, много мелких предметов и
текстиля, тёплый деревянный пол с бликами низкого солнца. У нас в
`build_brick.py`:
- **шторы**: в каждом остеклении по краям льняная портьера 0.5 м (складки
  13 см, глубина 5 см) и тюль у стекла (складки 9 см); это синусоидальные
  панели с толщиной 6 мм (`write_curtain`), а не бруски;
- **пол** кухни-гостиной — дуб вместо камня;
- **декор**: на ТВ-тумбе фоторамка, книги, ваза и растение, на столике чаша
  и ваза, приставной столик с вазой у дивана, ваза на острове;
- **текстиль**: плед на подлокотнике, терракотовая подушка, ковёр под каждой
  кроватью.
Мебель из Fab (диваны, кровать, наборы) после загрузки заменит коробочную.

Свою CC0-текстуру добавляют так: скачать с ambientcg.com (2K-JPG) в
`~/Desktop/home-3d/assets/ambientcg/<Имя>/` и прописать `"acg:<Имя>"` в
таблице `PBR` в `build_scene.py`.

### Лучше: Fab (нужен вход в Epic-аккаунт)

- **Бесплатный стартовый набор Megascans:** более 1500 ассетов, 5 пакетов
  деревьев, 11 сцен (только для Unreal). Раздача «забери всё бесплатно»
  закончилась в 2024 году; остальные Megascans стоят от $0.99.
- **Бесплатные пакеты Twinmotion для Unreal:** мебель, двор, декор и 497
  материалов Twinmotion, только для Unreal.
- Каждые две недели на Fab бывает временно бесплатный набор.
- **Megaplants** бесплатные, но рассчитаны на Nanite (UE 5.8+); на M1 они
  показываются упрощёнными.

Как добавить: открыть проект → **Window → Fab** → войти → фильтры **Free** →
на ассете **Add to Project**. Что искать: `olive tree`, `cypress`, `boxwood`,
`hedge`, `lavender`, `ornamental grass`, `grass`, `travertine`, `limestone`,
`paving`, `wood cladding`, `sofa`, `bed`, `armchair`, `rug`, `plant pot`.

### Как это прошло в первый раз (30.10.2026) — повторять так же

1. **Вход.** Аккаунт Epic в лаунчере уже был, но сайт fab.com требует своего
   входа. Claude открыл fab.com в браузере Playwright и нажал **Sign in**,
   владелец ввёл логин и пароль сам (Claude их не видит).
2. **Соглашение.** При первом «Add to My Library» Fab показывает EULA с
   отказом от коллективных исков. Принимает только владелец: ставит галочку
   «I have read and agree…» и нажимает **Accept**. Это один раз на аккаунт.
3. **Добавление в библиотеку.** Дальше Claude добавил бесплатные ассеты сам,
   скриптом Playwright. Нажимается только «Add to My Library» (так выглядит
   бесплатный ассет); где этой кнопки нет — ассет платный, он пропускается.
4. **Скачать файлами нельзя.** У этих ассетов на сайте единственный формат —
   Unreal Engine, FBX или GLB для скачивания нет. В проект их переносят
   вручную: Epic Games Launcher → **Unreal Engine → Library → Fab Library** →
   на каждом ассете **Add to Project** → **BrickHouse** (версия 5.8). Того же
   можно добиться в редакторе: **Window → Fab → My Library**.
5. **Лицензия и ИИ.** У Megascans стоит «Allows usage with AI: No». Кадры с
   ними нельзя прогонять через Gemini и другие генераторы. Значит, выбирать
   одно из двух: чистый Unreal с Megascans или Gemini поверх рендера без
   Megascans.

Добавлено в библиотеку (бесплатно, `https://www.fab.com/listings/<id>`):

| Что | Ассет | id |
|---|---|---|
| Деревья | European Hornbeam (Megascans) | c6f917b6-ffcb-4b86-9d9f-5274ba7f6a8e |
| | Norway Maple (Megascans) | 1f65d477-f44e-4ccb-95c1-788c99e33b56 |
| | Common Hazel (Megascans) | 81bc7ba6-4686-4f94-9d2b-83eb1fdc4079 |
| | Olive Tree for Italian Panorama | 7e103045-81b6-41dd-82a8-5a1d1e276115 |
| | Cypress Tree | b7d4ef3b-2a17-4431-9821-2b5e760b258c |
| Кусты, цветы | Elderberry (Megascans) | d72dd7bb-d514-4a14-8b4b-3333c99057fb |
| | European Spindle (Megascans) | f3c45cd9-f301-4358-8699-b5bbf436c851 |
| | Bigleaf Hydrangea (Megascans) | b8220edc-bf7f-4ab4-8618-3ae8209ac433 |
| | Spineless Yucca (Megascans) | 9edae3d8-38c4-416d-a4b3-0fe62e61c676 |
| | Mediterranean Vegetation: Plant Pack I | 41b3889d-1a98-41e1-850e-c8b417840da0 |
| | Mediterranean Vegetation: Plant Pack II | 757b4a6b-a933-4da4-b712-6870b72badd6 |
| Газон | Wild Grass (Megascans) | 50d9a417-73ed-4132-9421-6be3d4f7432e |
| | Kikuyu Grass (Megascans) | 4a7f5036-b879-4910-a5f2-271ccff93b32 |
| | Uncut Grass (Megascans) | 69f0e5f2-0fce-43f5-b737-b3d18de2eb62 |
| | Ground Cover (Megascans) | e1f6a034-919c-4f31-8260-7b1a878986b0 |
| Мебель | Modern Luxury Sofa 1 / Sofa 2 | c5563b16-8463-4f56-864b-a37092e14a9e, 87c9b4a4-eee9-4c7d-aa5c-787316eca5fe |
| | Modern Luxury Bed 1 | bb7fe4c1-1882-4c52-8db0-dc09a0e8302c |
| | Modern Luxury Table 1 | e92af436-711b-4aca-a573-23d50c55d315 |
| | Furniture cosy pack free | 61f2d5cf-8348-4235-8d7b-548be73329c3 |
| | 50+ Interior Props & Furniture Starter Kit (UE5) | 3230e8b4-a63a-44c6-8d8d-5ea3630c5627 |
| | Luxury Modern Bedroom Interior | 867a445e-7578-44b2-8a4e-01c276c45a05 |
| | Monstera Plant in Pot | cdc5c05d-cc51-4fc5-8534-04d897228fd1 |
| | Optimized Potted Plants | f37cf699-c332-49a3-ba04-d45575936802 |
| Twinmotion | Twinmotion Materials Pack | a04e4f4e-f659-450a-8ec8-1d9cb234fe0a |
| | Datasmith Twinmotion Content for Unreal Engine (обновлён 11.2024, совместимость с 5.8 не проверена) | e8c0d5bf-57cf-4c70-830b-8aec43044822 |

### Добавление в проект из Launcher — что выяснилось

- Launcher показывает только проекты из `~/Documents/Unreal Projects`
  (симлинк туда не работает) и находит их только при запуске — после переноса
  проекта перезапустить Launcher. При первом запуске он предлагает связать
  `.uproject` с движком (**Fix Now**, затем macOS спросит программу —
  UnrealEditorServices).
- **Add To Project** → «No compatible user projects found»: ассет заявлен для
  более старых версий. Поставить **Show all projects**, выбрать BrickHouse,
  внизу **Select Version** — самую новую из списка (Megascans: 5.6,
  Mediterranean Pack I: 5.4); контент старой версии открывается в 5.8.
- **Медленные загрузки Launcher** (было 0,7–1,8 МБ/с при канале 145+ Мбит/с):
  создать `~/Library/Application Support/Epic/EpicGamesLauncher/Saved/Config/MacEditor/Engine.ini`
  (на Mac конфиг Launcher-а лежит в `MacEditor`, рядом с `GameUserSettings.ini`):
  ```ini
  [HTTP]
  HttpTimeout=10
  HttpConnectionTimeout=10
  HttpReceiveTimeout=10
  HttpSendTimeout=10

  [Portal.BuildPatch]
  ChunkDownloads=8
  ChunkRetries=20
  RetryTime=0.5
  ```
  ⚠ Launcher **удаляет этот файл при выходе**, поэтому его надо закрепить:
  `chflags uchg <файл>` (править: сначала `chflags nouchg <файл>`).
  Затем перезапустить Launcher (загрузки продолжатся с места). Стало ~40 МБ/с
  (~320 Мбит/с, 30.10.2026). Epic советует `ChunkDownloads=3`; 8 — по числу ядер
  M1 Max. Скорость проверять по росту папки
  `/Users/Shared/UnrealEngine/Launcher/VaultCache/<ассет>` (`/usr/bin/du -sk`).
- Деревья Megascans в формате UE огромные (European Hornbeam 11,1 ГБ). ⚠ Они сделаны под Nanite; на M1 будет
  упрощённая замена — сначала проверить одно дерево, потом качать остальные.
- У многих ассетов (кусты и травы Megascans, часть мебели) на вкладке **Fab
  → My Library** вместо «+» стоит «↓»: это файлы FBX/glTF/GLB, качаются за
  секунды в `/Users/Shared/UnrealEngine/Launcher/VaultCache/FabLibrary/<имя>-<id>/`.
  Для Megascans брать `…_ue_high.zip` (glTF под Unreal).
- Launcher тормозит: клик, сделанный пока открыто окно, может сработать на
  кнопке под ним. Не кликать по пустому месту диалога.

Пропущены как платные: Rosemary Shrub, Green Flowering Blue Fescue Grass,
Granite Boulder. Megaplants (бесплатные) не брали: они рассчитаны на Nanite, а
на M1 его нет.

Другие бесплатные источники: Poly Haven и ambientCG (CC0), Blendkit (CC0 или
royalty-free, коммерческое использование разрешено).

## 6. Свет, камера, цвет — настройки, как у архитекторов

### Свет
- **Снаружи:** SunSky (Sun Position Calculator) с атмосферой неба и солнцем, у
  которого включено *Atmosphere Sun Light*; объёмные облака (VolumetricCloud);
  небесный свет с захватом в реальном времени. Атмосфера сама делает низкое
  солнце тёплым и слабым.
  - Наш кадр: Ереван, 30 октября, 16:36 по местному времени, золотой час.
  - Север: при `NorthOffset = 0` солнце оказалось за домом и фасад был в
    тени; рабочее значение `180` (`BRICK_NORTH`, по умолчанию в скрипте). Для
    более тёплого и низкого солнца — `BRICK_SOLAR_TIME=17.0`.
  - Плоское HDRI «только небо» давало пустоту под горизонтом, а пол HDRI
    Backdrop перекрывал газон (пришлось опустить актёр на 30 см). SunSky с
    атмосферой эти проблемы снимает.
- **HDRI Backdrop** годится только для быстрых кадров. Его «пол» — плоскость-
  ловец теней размером около 100 м, центр проекции примерно на высоте 0.9 м.
  HDRI «только небо» без земли дают пустоту под горизонтом.
- **Внутри:** солнце плюс прямоугольные светильники в проёмах окон для
  заполняющего света с неба (так устроен пример Epic для архвиза), лампы в
  люменах (1000–3000) при 2700–3000 K, профили IES работают с Lumen.

### Экспозиция, как у фотоаппарата
Metering = Manual, включены *Apply Physical Camera Exposure* и *Extend default
luminance range*. Формула: EV100 = log2(N² / t × 100 / ISO).

| Сцена | Камера | EV100 |
|---|---|---|
| Полдень | — | 13–15 |
| Золотой час (наш экстерьер) | f/8, 1/60 с, ISO 100 | ≈ 12 |
| Интерьер (наш) | f/2.8, 1/30 с, ISO 400 | ≈ 6 |

**Локальная экспозиция** обязательна при ярких окнах в интерьере: Highlight
Contrast 0.6–1, Shadow Contrast 0.6–1, Detail Strength 1, Blurred Luminance
Blend 0.4–0.6. Отношение света к тени на закате около 3:1.

### Lumen для финальных кадров
Final Gather Quality, Scene Detail, Scene Lighting Quality и Reflection
Quality от 2 до 4 (у нас 4). Skylight Leaking 0, Diffuse Color Boost не больше 2.
Стены должны быть толщиной от 20 см, иначе свет просачивается.

### Тени солнца (каскадные)
`r.Shadow.MaxCSMResolution 4096`, 4–5 каскадов, контактные тени около 0.03,
угол источника около 0.5°.

### Пост-обработка, которая делает кадр похожим на фото
Тонмаппер по умолчанию (filmic, совпадает с ACES); для профессиональной
цветокоррекции выводят линейный EXR и грейдят в DaVinci Resolve через OCIO.
Хроматическая аберрация около 0.2, виньетка около 0.4, зерно 0.05–0.15,
блики объектива 0, bloom слабый. Баланс белого около 6500 K снаружи и
4500–5500 K внутри при тёплых лампах. Интерьер: 24–35 мм, f/5.6–8, камера
ровно, вертикали прямые.

### Movie Render Queue
- Рецепт высокого качества от Epic: Spatial 1 / Temporal 64, сглаживание None,
  прогрев движка и рендера по 120 кадров.
- В Game Overrides — кинематографическое качество, стриминг текстур выключен.
- Консольные переменные:
  - `r.DepthOfFieldQuality 4`, `r.BloomQuality 5`, `r.Tonemapper.Quality 5`;
  - `r.Lumen.ScreenProbeGather.DownsampleFactor 8`,
    `r.Lumen.ScreenProbeGather.TracingOctahedronResolution 16`,
    `r.Lumen.ScreenProbeGather.Temporal.MaxFramesAccumulated 32`;
  - `r.Lumen.Reflections.MaxRoughnessToTrace 0.6`,
    `r.Lumen.TranslucencyReflections.FrontLayer.Enable 1` (стекло);
  - `r.ScreenPercentage 150–200`.
- На 4K и выше: (разрешение ÷ DownsampleFactor) × OctahedronResolution не
  должно превышать максимальный размер текстуры, иначе артефакты.
- Высокое разрешение тайлами не поддерживает TAA, отражения в экранном
  пространстве и bloom свёрткой; лучше рендерить сразу в 4K.

## 7. Команды

```bash
# 1) модель из калькулятора
cd ~/Desktop/armenia-home-calculator && npx vite-node tools/render/blender/export_brick.ts
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python tools/render/blender/build_brick.py -- --ue --no-render

# 2) сцена и все кадры (окно Unreal откроется и закроется само)
cp tools/render/unreal/Scripts/*.py ~/Documents/"Unreal Projects"/BrickHouse/Scripts/
cd ~/Documents/"Unreal Projects"/BrickHouse
U="/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
BRICK_RENDER=all "$U" "$PWD/BrickHouse.uproject" -ExecCmds="py $PWD/Scripts/build_scene.py" -nosplash

# только перерендерить выбранные камеры
BRICK_SHOTS=front,living "$U" "$PWD/BrickHouse.uproject" -ExecCmds="py $PWD/Scripts/render.py" -nosplash

# время и сторона солнца: часы местного времени и поворот участка
BRICK_SOLAR_TIME=17.0 BRICK_NORTH=40 BRICK_RENDER=front "$U" ...

# 3) модель для 3D-вкладки сайта
bash scripts/house-3d-assets.sh
```

Сколько это занимает на M1 Max (64 ГБ):

| Шаг | Время |
|---|---|
| Первый запуск Unreal (компиляция шейдеров) | 10–30 мин, один раз |
| Сборка сцены скриптом | 2–3 мин |
| Кадр 1920×1200, 8 temporal-сэмплов, прогрев 32 | ~20 с |
| Кадр 2560×1600, 64 сэмпла, прогрев 120 (финал) | ~2–3 мин |

Главная потеря времени — перезапуски редактора: рендерить все камеры одним
запуском (`BRICK_RENDER=all`).

Тонкости запуска на macOS:
- `-ExecutePythonScript` закрывает редактор сразу после скрипта, поэтому
  запуск идёт через `-ExecCmds="py …"`, а скрипт ждёт загрузки мира.
- Повторный импорт мешей, которые Unreal ещё собирает, роняет редактор, поэтому
  `build_scene.py` удаляет прошлый импорт дома и не трогает уже импортированные
  растения, небо и текстуры.
- У каждого образца в мастер-материале должна быть текстура по умолчанию своего
  типа (цвет, нормаль, линейная), иначе материал не компилируется и Unreal
  рисует «шахматку».
- `unreal.Rotator(roll, pitch, yaw)`: порядок аргументов не тот, к которому
  привыкаешь.

### Ассеты Fab в сцене (30.10.2026)

В проекте: European Hornbeam, Norway Maple, Common Hazel (Megascans, Nanite + 6–7
LOD), Mediterranean Plant Pack I/II, Modern Luxury Sofa 1, 50+ Interior Props,
Twinmotion Materials. Опись мешей (размер, полигоны, LOD, Nanite):
`Scripts/inventory.py` → `~/Desktop/home-3d/brick/inventory.json`.

- **Megascans на M1 работают**: Nanite не поддерживается, Unreal рисует их
  упрощённые версии (fallback 2–16 тыс. треугольников). Деревья большие
  (Hornbeam 15–17 м, Maple до 25 м) — на участок 25×20 брать Hazel Field (густая
  крона) с масштабом 0.7–0.75; «Forest»-варианты с редкой кроной — только у соседей.
- **Расстановка**: Blender (`build_brick.py --ue`) пишет `props.json` — имя меша,
  точка в плане, направление «лицом к», масштаб (функция `fab(...)`); Unreal
  (`props()` в `build_scene.py`) находит меш по имени в реестре ассетов и ставит
  его по габаритам (центр по x/y, низ по z), поэтому точка привязки модели не
  важна. Собственный «перёд» моделей — `FRONT_YAW` (у Sofa 1 это +Y).
- **Растения участка** (`plants.json`): изгородь вдоль забора — Hazel
  Forest_03/04 под высоту 1.9–3 м; клумбы — кусты, травы, агавы и цветы
  Mediterranean в натуральном размере и по 3 пучка травы вокруг (`PLANT_MODELS`, `TUFTS`).
- **Гостиная**: в Unreal коробочный диван заменён набором Sofa 1 (диван, столики,
  торшер, фикус, декор); в Blender-превью остаются коробки.
- **Launcher может зависнуть на копировании в проект** («0.0 B / 0.0 B», в логе
  `Timed out waiting for startup ack from EpicWebHelper`). Скачанное уже лежит в
  `/Users/Shared/UnrealEngine/Launcher/VaultCache/<пак>/data/Content/` — скопировать
  папку пака в `Content` проекта (`cp -R`), а `MSPresets` — с `cp -Rn`, не затирая.

## 8. Какие ещё плагины стоят того (исследование 30.10.2026)

Проверено по файлам `.uplugin` в `/Users/Shared/Epic Games/UE_5.8/Engine/Plugins`
(вкл/выкл по умолчанию, платформы) и по страницам Fab и производителей.

| # | Плагин (имя в `.uproject`) | Что даст нам | Цена | 5.8 / Mac |
|---|---|---|---|---|
| 1 | Movie Render Graph (часть `MovieRenderPipeline`) | в 5.8 Production Ready; тайловый рендер высокого разрешения с Lumen и TSR, OCIO на выходе | бесплатно | да / да |
| 2 | `OpenColorIO` (Beta) | ACES/filmic-преобразование вместо стандартного тонмаппера — самый большой шаг к «фото» | бесплатно | да / да |
| 3 | Ultra Dynamic Sky (Fab) | готовые небо и облака золотого часа, солнце по координатам | от $59.98 | 5.0–5.8 / да |
| 4 | `ModelingToolsEditorMode` + Geometry Script | фаски на рёбрах плит и парапетов, откосы, запекание AO для потёртостей; можно из Python | бесплатно | да / да |
| 5 | `SpeedTreeImporter` (вкл.) + SpeedTree Modeler | деревья с LOD без Nanite | Modeler $19/мес | импорт да / да |
| 6 | `VariantManager` (Beta) | варианты отделки в одном уровне; экспортируются в glTF | бесплатно | да / да |
| 7 | `GLTFExporter` (вкл.) | сцена → `.glb` для сайта (`unreal.GLTFExporter.export_to_gltf`), без сжатия — потом gltf-transform | бесплатно | да / да |
| 8 | Substance 3D for Unreal | параметрические `.sbsar` материалы (жилки травертина, износ) | бесплатно | 5.0–5.8 / да |
| 9 | Twinmotion Materials Pack (в очереди) | ~500 архвиз-материалов | бесплатно | 5.0–5.6 заявлено, 5.8 проверить |
| 10 | `TextureGraph`, `DynamicMaterial` | убрать повтор текстуры на больших фасадах | бесплатно | да / да |
| 11 | `ChaosClothAsset` (+ EditorCore, DataflowNodes) | симуляция штор; проще — оставить шторы из Blender | бесплатно | да / да |
| 12 | Cesium for Unreal | рельеф Еревана и Арарат на горизонте | бесплатно (аккаунт Cesium ion) | да / да |
| 13 | `LightMixer`, `ColorGrading`, `ObjectMixer` (вкл.) | таблица всех светильников, панель грейдинга | бесплатно | да / да |

Не подходят M1: Procedural Vegetation Editor и Megaplants (Nanite Foliage),
`NaniteDisplacedMesh`, `GPULightmass` (DXR, Windows), денойзеры OIDN/OptiX/NFOR/NNE
(только для path tracer), MegaLights (ray tracing), `AxFImporter` и
`StaticMeshEditorModeling` (Windows), ArchVis Tools by Voulz (Windows), Dash
(Windows), DLSS/FSR.

Включить (всё есть в установленной 5.8):
```json
{"Name":"OpenColorIO","Enabled":true},
{"Name":"ModelingToolsEditorMode","Enabled":true},
{"Name":"VariantManager","Enabled":true},
{"Name":"TextureGraph","Enabled":true}
```
Не проверено: Ultra Dynamic Sky и Substance на Apple Silicon, Twinmotion
Materials Pack в 5.8, покрытие Еревана 3D-тайлами Google.

Похожие шаблоны с YouTube: ArchViz Template Lite (Miguel De Andrade, бесплатно на
Fab, UE 5.7+; в Pro заявлено 100+ материалов под Lumen), UPsqft UE 5.7 ArchViz Web
App (платный проект), BOTANICA (растительность на PCG).

## 9. Другие пути к картинке «как фото»

- **Twinmotion** (вручную): импорт `home_brick.glb` и таблицы замены
  материалов `Home_Brick_Substitution.csv`.
- **Gemini, «фото из рендера»**: дать рендер и промпт «сохрани форму дома,
  сделай фото» (`~/Desktop/home-3d/brick/ai-photo/PROMPTS.md`). Форма
  сохраняется, свет и растения как на фото. Каждый кадр нужно сверять с
  планом: ИИ иногда добавляет окна или балконы.

## Приложение: все материалы и ассеты сцены

Сгенерировано из скриптов (`python3 tools/render/list_materials.py`); после правок
таблиц `PBR`/`FLAT` или расстановки мебели перегенерировать и заменить блок между
метками. Текстуры: ambientCG 2K-JPG и Poly Haven 2k (diffuse, normal GL,
roughness), все CC0. Небо в Unreal — SunSky (без HDRI); HDRI
kloppenheim_06_puresky только для превью в Blender.

<!-- materials:begin -->
| Слот | Текстура | Плотность, м на повтор | Tint | Roughness × | Доп. параметры M_PBR3 |
|---|---|---|---|---|---|
| `Facade_Travertine` | [Travertine009](https://ambientcg.com/view?id=Travertine009) (ambientCG) | 1.50 | (1.0, 0.97, 0.9) | 1.0 | JointSize (1.2, 0.6), JointHalfWidth 0.004, JointDarken 0.3, PanelVariation 0.07 |
| `Facade_Plinth` | [Travertine009](https://ambientcg.com/view?id=Travertine009) (ambientCG) | 1.50 | (0.8, 0.77, 0.72) | 1.0 | JointSize (1.2, 0.45), JointHalfWidth 0.004, JointDarken 0.3, PanelVariation 0.07 |
| `Facade_WoodPanel` | [WoodSiding008](https://ambientcg.com/view?id=WoodSiding008) (ambientCG) | 2.00 | (1.0, 0.95, 0.9) | 1.0 | — |
| `Soffit_Wood` | [WoodFloor064](https://ambientcg.com/view?id=WoodFloor064) (ambientCG) | 2.00 | (1.0, 0.92, 0.82) | 0.9 | — |
| `Pergola_Wood` | [dark_wooden_planks](https://polyhaven.com/a/dark_wooden_planks) (Poly Haven) | 2.00 | (0.7, 0.58, 0.48) | 1.0 | — |
| `Fence_Render` | [Plaster001](https://ambientcg.com/view?id=Plaster001) (ambientCG) | 2.00 | (0.9, 0.87, 0.82) | 1.0 | — |
| `Wall_Paint` | [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) (Poly Haven) | 2.00 | (1.0, 0.98, 0.95) | 1.0 | — |
| `Ceiling_Paint` | [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) (Poly Haven) | 2.00 | (1.0, 1.0, 0.98) | 1.0 | — |
| `Floor_Oak` | [laminate_floor_03](https://polyhaven.com/a/laminate_floor_03) (Poly Haven) | 2.00 | (1.0, 0.95, 0.9) | 0.6 | — |
| `Stair_Wood` | [oak_veneer_01](https://polyhaven.com/a/oak_veneer_01) (Poly Haven) | 1.50 | (0.9, 0.75, 0.58) | 0.8 | — |
| `Paving` | [granite_tile_04](https://polyhaven.com/a/granite_tile_04) (Poly Haven) | 2.00 | (0.95, 0.95, 0.95) | 1.0 | — |
| `Paving_Terrace` | [granite_tile_04](https://polyhaven.com/a/granite_tile_04) (Poly Haven) | 2.00 | (1.0, 0.98, 0.95) | 1.0 | — |
| `Paving_Drive` | [concrete_tiles](https://polyhaven.com/a/concrete_tiles) (Poly Haven) | 2.00 | (0.85, 0.85, 0.85) | 1.0 | — |
| `Lawn` | [Grass004](https://ambientcg.com/view?id=Grass004) (ambientCG) | 1.50 | (0.95, 1.0, 0.9) | 1.0 | — |
| `Door_Entrance` | [dark_wooden_planks](https://polyhaven.com/a/dark_wooden_planks) (Poly Haven) | 2.00 | (0.55, 0.42, 0.32) | 0.8 | — |
| `Concrete` | [grey_plaster](https://polyhaven.com/a/grey_plaster) (Poly Haven) | 2.00 | (0.72, 0.7, 0.66) | 1.0 | — |
| `Pool_Shell` | [granite_tile_04](https://polyhaven.com/a/granite_tile_04) (Poly Haven) | 1.00 | (0.75, 0.85, 0.9) | 0.6 | — |
| `Floor_Stone` | [granite_tile_04](https://polyhaven.com/a/granite_tile_04) (Poly Haven) | 2.00 | (1.0, 0.98, 0.94) | 0.6 | — |
| `Floor_Tile` | [granite_tile_04](https://polyhaven.com/a/granite_tile_04) (Poly Haven) | 1.20 | (1.0, 1.0, 1.0) | 0.5 | — |
| `Fabric_Sofa` | [poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) (Poly Haven) | 0.50 | (1.05, 1.0, 0.95) | 1.0 | — |
| `Fabric_Accent` | [poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) (Poly Haven) | 0.50 | (0.8, 0.95, 0.85) | 1.0 | — |
| `Fabric_Bedding` | [rough_linen](https://polyhaven.com/a/rough_linen) (Poly Haven) | 0.60 | (1.85, 1.82, 1.75) | 1.0 | Desat 1.0 |
| `Curtain_Linen` | [rough_linen](https://polyhaven.com/a/rough_linen) (Poly Haven) | 0.60 | (0.76, 0.71, 0.63) | 1.0 | Desat 1.0 |
| `Rug_Wool` | [knitted_fleece](https://polyhaven.com/a/knitted_fleece) (Poly Haven) | 0.60 | (6.0, 5.5, 4.8) | 1.2 | Desat 1.0 |
| `Fabric_Throw` | [cotton_jersey](https://polyhaven.com/a/cotton_jersey) (Poly Haven) | 0.40 | (1.0, 0.97, 0.92) | 1.0 | — |
| `Fabric_Cushion` | [cotton_jersey](https://polyhaven.com/a/cotton_jersey) (Poly Haven) | 0.40 | (1.15, 0.65, 0.45) | 1.0 | — |

| Слот | Мастер | Цвет (линейный) | Roughness | Metallic |
|---|---|---|---|---|
| `Glass` | `M_Glass` | (0.02, 0.03, 0.03) | 0.02 | 0 |
| `Water` | `M_Glass` | (0.05, 0.25, 0.3) | 0.02 | 0 |
| `Window_Frame` | `M_Flat` | (0.03, 0.03, 0.035) | 0.35 | 0.6 |
| `Fascia_Metal` | `M_Flat` | (0.035, 0.035, 0.04) | 0.4 | 0.6 |
| `Metal_Dark` | `M_Flat` | (0.03, 0.03, 0.035) | 0.4 | 0.6 |
| `Railing_Steel` | `M_Flat` | (0.04, 0.04, 0.045) | 0.35 | 0.6 |
| `Light_Emissive` | `M_Glow` | (1.0, 0.78, 0.55) | 0.5 | 0 |
| `Curtain_Sheer` | `M_Sheer` | (0.85, 0.84, 0.82) | 0.9 | 0 |
| `Soil` | `M_Flat` | (0.05, 0.035, 0.025) | 1.0 | 0 |
| `Roof_MetalSeam` | `M_Flat` | (0.045, 0.047, 0.05) | 0.45 | 0.7 |

Остальные слоты модели идут в Unreal с цветом из glTF (без текстуры): `Door_Interior`, `Door_Frame`, `Wood_Oak`, `Bath_Wall_Tile`, `Foliage`, `Field`, `Pine`, `Bark`, `Lamp_Shade`, `Kitchen_Front`, `Countertop_Marble`, `Sanitary_Ceramic`, `Chrome`, `Mirror`, `Appliance_White`, `Black_Glass`.

Модели Poly Haven (CC0, glTF 1k):
- мебель и декор: [book_encyclopedia_set_01](https://polyhaven.com/a/book_encyclopedia_set_01), [ceramic_vase_01](https://polyhaven.com/a/ceramic_vase_01), [ceramic_vase_02](https://polyhaven.com/a/ceramic_vase_02), [ceramic_vase_03](https://polyhaven.com/a/ceramic_vase_03), [modern_arm_chair_01](https://polyhaven.com/a/modern_arm_chair_01), [modern_ceiling_lamp_01](https://polyhaven.com/a/modern_ceiling_lamp_01), [modern_coffee_table_01](https://polyhaven.com/a/modern_coffee_table_01), [modern_wooden_cabinet](https://polyhaven.com/a/modern_wooden_cabinet), [outdoor_table_chair_set_01](https://polyhaven.com/a/outdoor_table_chair_set_01), [potted_plant_01](https://polyhaven.com/a/potted_plant_01), [potted_plant_02](https://polyhaven.com/a/potted_plant_02), [potted_plant_04](https://polyhaven.com/a/potted_plant_04), [side_table_01](https://polyhaven.com/a/side_table_01), [standing_picture_frame_01](https://polyhaven.com/a/standing_picture_frame_01), [wooden_bowl_01](https://polyhaven.com/a/wooden_bowl_01)

Растения на участке (Fab: Megascans Common Hazel, Mediterranean Plant Pack I/II): `SM_CommonHazel_Forest_03`, `SM_CommonHazel_Forest_04`, `agave_03`, `agave_04`, `bush_01_03`, `bush_01_04`, `bush_02_03`, `flower_04`, `flower_05`, `grass_01_01`, `grass_01_03`, `grass_02_01`, `grass_02_02`, `grass_02_03`

Деревья и мебель Fab в props.json: см. `fab(...)` в build_brick.py.
<!-- materials:end -->

## Источники

- Возможности macOS (5.8): https://dev.epicgames.com/documentation/en-us/unreal-engine/macos-development-requirements-for-unreal-engine
- Path Tracer (5.8): https://dev.epicgames.com/documentation/en-us/unreal-engine/path-tracer-in-unreal-engine
- Качество рендера в MRQ (5.8): https://dev.epicgames.com/documentation/unreal-engine/cinematic-rendering-image-quality-settings-in-unreal-engine
- Рецепт MRQ (4.27): https://docs.unrealengine.com/4.27/en-US/RenderingAndGraphics/RayTracing/MovieRenderQueue/
- Lumen: https://dev.epicgames.com/documentation/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine
- Артефакты Lumen в 4K (ответ Epic): https://forums.unrealengine.com/t/artifacts-in-lumen-mode-when-rendered-in-4k/1905837
- Sky Atmosphere: https://dev.epicgames.com/documentation/en-us/unreal-engine/sky-atmosphere-component-in-unreal-engine
- Sun Position Calculator: https://dev.epicgames.com/documentation/en-us/unreal-engine/geographically-accurate-sun-positioning-tool-in-unreal-engine
- HDRI Backdrop: https://dev.epicgames.com/documentation/en-us/unreal-engine/hdri-backdrop-visualization-tool-in-unreal-engine
- Экспозиция и локальная экспозиция: https://dev.epicgames.com/documentation/en-us/unreal-engine/auto-exposure-in-unreal-engine
- Свет по законам фотографии (Magnopus): https://www.magnopus.com/blog/lighting-in-unreal-with-photography-principles
- Пример архвиз-интерьера Epic: https://dev.epicgames.com/documentation/en-us/unreal-engine/archviz-interior-rendering?application_version=4.27
- Стартовый набор Megascans на Fab: https://forums.unrealengine.com/t/megascans-starter-content-on-fab/2255322
- Fab FAQ: https://support.fab.com/s/article/Fab-Transition-FAQs?language=en_US
- Megaplants: https://quixel.com/news/discover-the-latest-quixel-megascans-and-free-megaplants
- Пакеты Twinmotion для Unreal: https://www.unrealengine.com/blog/three-twinmotion-cg-asset-packs-now-available-to-unreal-engine-users
- Лицензии Blendkit: https://www.blendkit.com/docs/licenses/
- 11 советов для фотореализма (Curved Axis): https://www.curvedaxis.com/news/11-tips-for-photorealistic-architectural-renders
- Детализация (D5): https://www.d5render.com/posts/detailing-architectural-rendering
- Making-of (Ronen Bekerman): https://www.ronenbekerman.com/making-of-arts-crafts/

Не проверено: точные настройки из видео William Faucher 2025 года (виден
только список глав) и то, что лучше сходится для Lumen на Metal: Spatial 8 ×
Temporal 8 или Spatial 1 × Temporal 64.
