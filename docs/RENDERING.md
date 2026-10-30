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
| `~/Desktop/home-3d/ue/BrickHouse/` | проект Unreal (копия `tools/render/unreal/` плюс импортированный контент) |

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
| Паркет, стены, потолки | laminate_floor_02, painted_plaster_wall | Poly Haven |
| Кровля, рамы, карнизы | тёмный металл, без текстуры | — |
| Растения | wild_rooibos_bush, jacaranda_tree | Poly Haven |

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
cd ~/Desktop/home-3d/ue/BrickHouse
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

## 8. Другие пути к картинке «как фото»

- **Twinmotion** (вручную): импорт `home_brick.glb` и таблицы замены
  материалов `Home_Brick_Substitution.csv`.
- **Gemini, «фото из рендера»**: дать рендер и промпт «сохрани форму дома,
  сделай фото» (`~/Desktop/home-3d/brick/ai-photo/PROMPTS.md`). Форма
  сохраняется, свет и растения как на фото. Каждый кадр нужно сверять с
  планом: ИИ иногда добавляет окна или балконы.

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
