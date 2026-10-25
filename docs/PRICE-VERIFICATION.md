# Сверка цен

Заполняется вручную. Открытых машинных источников цен на стройматериалы в РА
нет: товарный бетон, блок и работы котируются по запросу, Минфин публикует
только раздел без данных, Статкомитет — индексы, а не абсолютные цены.

## Как пользоваться

1. Возьмите позицию, откройте источник из последней колонки.
2. Впишите найденную цену и дату в пустые колонки.
3. Отдайте файл мне — я перенесу значения в `src/data/prices.ts`,
   выставлю `provenance: 'quoted'` и `verifiedAt`, обновлю `PRICES_UPDATED`.

Пока `provenance` не равен `quoted`, интерфейс честно показывает позицию как
«не сверено» и не выдаёт её за котировку.

## Состояние на 26.10.2026

- всего позиций: 88
- сверено с прайсом (`quoted`): 31 — бетон (Waelcon, с НДС), арматура, туф, газоблок, песок, гидроизоляция, утеплители, окна, двери, напольное покрытие, солнечные панели, леса, проект, бойлер ГВС, фанкойлы, аккумулятор, зарядка, насос (за м³ и выезд)
- собрано из сверенных цен или оценено (`estimate`): 39 — раствор, стяжка, штукатурка/покраска, плитка, облицовка лестницы, лестница, тёплый пол, тепловой насос, сантехника, плоская кровля, вывоз грунта и мусора, стеклянная перегородка, ограждения, опалубка, насос, подключения, рекуперация, радиаторы и прочие строки с пометкой ОЦЕНКА
- ориентир (`unverified`): 9 — кирпич, клей для газоблока, плита ПК, отмостка, витраж, разуклонка кровли, скатная кровля, премиум-отделка, панельный потолок
- госпошлина и тарифы (`official`): 9 (в т.ч. подключение электричества по тарифу КРОУ)

Источники 26.09.2026: прайс MM Leader на yell.am (бетон, обновлён 10.07.2026),
rms-price.xlsx RMS Group и каталог Стальметгрупп (арматура, утеплитель),
list.am (газоблок, туф, песок, гидроизоляция, вата), Armenpress (заводская
цена цемента «Араратцемент» — 51 000 ֏/т с НДС), FarmPlast на flagma.am
(окна), Domus и Nor Tun (двери), laminat.am (ламинат), erkatproff.am и
domus.am (штукатурка, краска). list.am отвечает 403 на запросы без браузера,
в браузере страницы открываются.

Источники 26.10.2026 (работы и инженерия): NewHome (newhome.am/gnacucak) —
штукатурка от 3 000, шпаклёвка и покраска от 3 500 ֏/м², кладка в один ряд
4 000 ֏/м², установка двери 18 000 ֏, тёплый пол от 8 000 ֏/м², плитка от
10 000 ֏/м²; бригада монолитного каркаса 10 000–14 000 ֏/м² (list.am 21615364);
sip.am — проект 5 000 ֏/м² (без ОВ/ВК/ЭО); Accurate Group — леса 650 ֏/м² в
месяц; electro.am — тепловые насосы 12–18 кВт 1 750 000–1 900 000 ֏;
ShinShin — бойлер Apamet 200 л 288 500 ֏; Midea — фанкойлы 92 000–192 000 ֏;
Solaron — Deye 5,12 кВт·ч 518 000 ֏; evolt.am, Solaron, EnerGo — зарядки
180 000–295 000 ֏; КамАЗ 30 000 ֏ за рейс (list.am 24239515).

Вторая сверка рынка (26.10.2026, четыре независимых поиска + второе мнение):
основная цена — самая низкая надёжная розничная (без акций, распродаж и
оптовых минимумов), максимум — самая высокая найденная. Бетон — прайс Waelcon
с 01.10.2026 (с НДС и доставкой); HSKA дешевле на 4 000–5 500 ֏/м³, но не
указывает НДС и доставку — уточнить звонком. Экскаватор — расценки Газпром
Армения и Veolia Jur (июнь 2026), 723 ֏/м³ без НДС для грунта III кат.
NewHome и Varpet — один подрядчик (общий телефон), считаются одним источником.
Без данных (нужна котировка): стеклянная перегородка, витраж, подоконники и
отливы, ограждения, кухня, работа по фасаду, молниезащита, геодезия, водосток,
внутренний газопровод, подключение газа, воды и канализации.

Сети по точкам (26.10.2026): число точек берётся с планов — розетки по
СП 31-110-2003 п. 14.29, свет и выключатель в каждой комнате, вода и
канализация по приборам. Цены точки: FastModernHouse (протяжка 5 000,
установка 3 500, подрозетник 1 000; вода и канализация по 10 000 ֏), кабель
ВВГ — Vida, трубы — ShinShin и Erkatproff, котёл BAXI ECO4S — Onlineshinanyut,
бак — Santex House, вентиляторы — Domus и Onlineshinanyut, воздуховоды — Lanka.
Длины кабеля и труб на точку — допущения (10 м кабеля, 2 × 8 м трубы, 3 м
канализации, 20 м подводки к радиатору); фитинги и мелочь не посчитаны.
Бетон — прайс Waelcon от 29.08.2026 с НДС и доставкой до 15 км; насос —
80 000 ֏ за выезд + 3 000 ֏/м³. Подключение электричества — тариф КРОУ
(psrc.am): 1 фаза 14 кВА 199 000 ֏; 0,4 кВ 229 000 + 16 000 ֏/кВА.

Перекрёстная сверка вне list.am (26.10.2026): дешевле нашлись только зарядки
для электромобиля. Солнечные станции по котировкам установщиков (SolarPortal,
август 2026) — медиана 185 000–191 000 ֏/кВт, т.е. 163 000 уже у нижней
границы. Манипулятор вне list.am — 70 000 ֏ за смену. Бетон: прайс MM Leader
может быть без НДС; HSKA — 39 500 ֏/м³ за М350.

Источники 26.10.2026 (солнечные панели): list.am, объявление 22616313 —
сетевая станция 10,4 кВт (Longi 650 Вт + Solax) под ключ за 1 700 000 ֏;
Smart Solar (страница на engineering10.com) — 10,32 кВт за 1 485 000 ֏
наличными (24.08.2026), рассрочка 220 000 ֏/кВт (14.07.2026). Аккумулятор
в строку не входит.

## Таблица

| Позиция | Ключ | Ед. | Материал сейчас, ֏ | Работа сейчас, ֏ | Статус | **Найденная цена, ֏** | **Дата сверки** | Где смотреть |
|---|---|---|---:|---:|---|---:|---|---|
| Бетон B15 / М200 | `concrete_b15` | м³ | 39000 | 18000 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am, hska.am, mmleader.am |
| Бетон B20 / М250 | `concrete_b20` | м³ | 41000 | 18000 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am, hska.am, mmleader.am |
| Бетон B22.5 / М300 | `concrete_b225` | м³ | 42500 | 18000 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am, hska.am, mmleader.am |
| Бетон B25 / М350 | `concrete_b25` | м³ | 45000 | 18000 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am, hska.am, mmleader.am |
| Бетон B30 / М400 | `concrete_b30` | м³ | 47500 | 18000 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am, hska.am, mmleader.am |
| Подбетонка М100 | `concrete_blinding` | м³ | 34000 | 8000 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am, hska.am, mmleader.am |
| Арматура А500С | `rebar_a500` | т | 305000 | 60000 | quoted | см. note в prices.ts | 26.10.2026 | rmsgroup.am, mikmetal.am, erkatproff.am |
| Арматура А400 (A-III) | `rebar_a400` | т | 300000 | 60000 | quoted | см. note в prices.ts | 26.10.2026 | rmsgroup.am, mikmetal.am, erkatproff.am |
| Туф (кладка) | `tuff_block` | м³ | 16000 | 15000 | quoted | 150–250 за камень ≈ 10 000–17 500 за м³ (list.am) | 26.09.2026 | list.am раздел стройматериалов / rmsgroup.am |
| Газоблок | `aerated_block` | м³ | 35000 | 12000 | quoted | 35 000 опт D600, 32 000 средний (list.am) | 26.09.2026 | list.am раздел стройматериалов / rmsgroup.am |
| Кирпич (кладка) | `brick` | м³ | 45000 | 18000 | unverified |  |  | list.am раздел стройматериалов / rmsgroup.am |
| Раствор кладочный | `mortar` | м³ | 24000 | 0 | estimate | см. note в prices.ts | 26.10.2026 | armenpress.am, www.list.am |
| Клей для газоблока | `glue_aerated` | м³ | 120000 | 0 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Плита перекрытия ПК | `precast_slab` | шт | 40000 | 8000 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Песок/щебень подсыпка | `sand_gravel` | м³ | 7000 | 3000 | quoted | 45 000–55 000 за ЗИЛ 7 м³ (list.am) | 26.09.2026 | list.am, звонок поставщику — в открытых прайсах РА нет |
| Выемка грунта экскаватором | `excavation` | м³ | 0 | 868 | quoted | см. note в prices.ts | 26.10.2026 | armenia-am.gazprom.com, www.veolia.am |
| Обратная засыпка экскаватором | `backfill` | м³ | 0 | 868 | quoted | см. note в prices.ts | 26.10.2026 | armenia-am.gazprom.com, www.veolia.am |
| Отмостка | `apron` | м² | 6000 | 4000 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Гидроизоляция (2 слоя) | `waterproofing` | м² | 1940 | 1500 | quoted | см. note в prices.ts | 26.10.2026 | erkatproff.am, shinshin.am |
| Утеплитель фасада | `insulation` | м² | 1556 | 4000 | quoted | см. note в prices.ts | 26.10.2026 | totalarmenia.am, www.list.am, rmsgroup.am, turn.am |
| Стяжка пола | `screed` | м² | 2100 | 3000 | estimate | см. note в prices.ts | 26.10.2026 | armenpress.am, www.list.am, turn.am, newhome.am |
| Окно обычное (поворотно-откидное) | `window_regular` | м² | 32000 | 8000 | quoted | см. note в prices.ts | 26.10.2026 | flagma.am, www.list.am, flagma.am |
| Окно витражное | `window_vitrage` | м² | 90000 | 12000 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Дверь входная | `door_exterior` | шт | 49900 | 10000 | quoted | см. note в prices.ts | 26.10.2026 | domus.am, nortun.am, domus.am, turn.am |
| Дверь межкомнатная | `door_interior` | шт | 36000 | 10000 | quoted | см. note в prices.ts | 26.10.2026 | domus.am, nortun.am, domus.am, turn.am, www.nortun.am |
| Штукатурка/шпаклёвка/покраска | `plaster` | м² | 1500 | 6500 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, totalarmenia.am, turn.am, newhome.am |
| Напольное покрытие | `floor_finish` | м² | 5600 | 4800 | quoted | см. note в prices.ts | 26.10.2026 | domus.am, laminat.am, domus.am, domus.am, fastmodernhouse.com, varpet.online |
| Фасадная отделка (тонкослойная штукатурка) | `facade` | м² | 3900 | 6000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, shinshin.am, domus.am, shinshin.am, totalarmenia.am, turn.am |
| Кровля плоская | `roof_flat` | м² | 2800 | 2500 | estimate | см. note в prices.ts | 26.10.2026 | rmsgroup.am, www.list.am |
| Кровля скатная | `roof_pitched` | м² | 14000 | 8000 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Электроточка (розетка, выключатель, свет) | `electrical` | точка | 5300 | 4000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, domus.am, shinmarket.am, shinshin.am, fastmodernhouse.com, varpet.online |
| Водопроводная точка (ГВС + ХВС) | `plumbing` | точка | 6240 | 10000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, erkatproff.am, fastmodernhouse.com, varpet.online |
| Котельная: газовый котёл, бак, насос | `heating` | компл | 228800 | 15000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, santex-house.am, santex-house.am, stalmetural.am, domus.am, onlineshinanyut.am, shinshin.am, santex-house.am |
| Радиатор с краном, термоголовкой и подводкой | `radiators` | шт | 35300 | 10000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, santex-house.am, santex-house.am, stalmetural.am, domus.am, stalmetural.am, shinshin.am, www.chipdip.am, domus.am, varpet.online |
| Тёплый пол (вместо радиаторов) | `opt_boiler_heating` | м² | 2700 | 6500 | estimate | см. note в prices.ts | 26.10.2026 | vida.am, shinshin.am, kelvin.am, santex-house.am, newhome.am, varpet.online |
| Тепловой насос (воздух-вода) | `opt_heat_pump` | компл | 1750000 | 600000 | estimate | см. note в prices.ts | 26.10.2026 | electro.am |
| Солнечные панели (фотовольтаика) | `opt_solar` | кВт | 163000 | 0 | quoted | см. note в prices.ts | 26.10.2026 | www.list.am, www.engineering10.com |
| Финишная отделка «под ключ» | `opt_finish_premium` | м² | 20000 | 0 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Панельный (реечный) потолок | `opt_panel_ceiling` | м² | 6000 | 4000 | unverified |  |  | list.am, звонок поставщику — в открытых прайсах РА нет |
| Лестница монолитная | `stair` | м³ | 95000 | 45000 | estimate | см. note в prices.ts | 26.10.2026 | www.yell.am, yerkir.am, rmsgroup.am, stalmetural.am |
| Раздвижная стеклянная перегородка | `glass_partition` | м² | 85000 | 15000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | звонок поставщику алюминиевых систем |
| Ограждение галереи и лестницы | `railing` | пог.м | 25000 | 6000 | estimate | НЕТ ДАННЫХ — нужна котировка | 26.09.2026 | мастер по металлу, list.am |
| Опалубка (аренда) | `formwork` | м² | 4500 | 2500 | estimate | см. note в prices.ts | 26.10.2026 | www.accurate.am, uyut.am |
| Подача бетона насосом (за м³) | `concrete_pump` | м³ | 3000 | 0 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am |
| Вытяжка: вентилятор с воздуховодом | `ventilation` | шт | 11750 | 5000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, lanka.am, domus.am, onlineshinanyut.am, lanka.am, fastmodernhouse.com, varpet.online |
| Вентиляция с рекуперацией (доплата) | `opt_mvhr` | м² | 6000 | 3000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | list.am (установки HVAC QRXF от 210 000 ֏), проект вентиляции |
| Молниезащита и заземление | `lightning` | компл | 180000 | 60000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Подключение электричества, 1 фаза 14 кВА | `conn_electricity` | компл | 199000 | 0 | official | см. note в prices.ts | 26.10.2026 | psrc.am |
| Подключение газа (ТУ + проект + врезка) | `conn_gas` | компл | 550000 | 0 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Подключение водопровода | `conn_water` | компл | 220000 | 0 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Подключение канализации | `conn_sewer` | компл | 200000 | 0 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Локальное очистное (септик) | `septic` | компл | 800000 | 150000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Забор с фундаментом | `fence` | пог.м | 32000 | 12000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Дорожки и площадки | `site_paving` | м² | 12000 | 5000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| Балкон / терраса | `balcony` | м² | 45000 | 18000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | техусловия сетевой организации / подрядчик |
| АПЗ (муниципалитет) | `permit_apz` | комплект | 40000 | 0 | official |  |  | urban.e-gov.am, муниципалитет |
| Проект (за м²) | `permit_design` | м² | 5000 | 0 | quoted | см. note в prices.ts | 26.10.2026 | sip.am |
| Геологические изыскания | `permit_geology` | комплект | 150000 | 0 | official |  |  | urban.e-gov.am, муниципалитет |
| Экспертиза проекта | `permit_expertise` | комплект | 25000 | 0 | official |  |  | urban.e-gov.am, муниципалитет |
| Разрешение на строительство | `permit_fee` | комплект | 70000 | 0 | official |  |  | urban.e-gov.am, муниципалитет |
| Присвоение адреса | `permit_address` | комплект | 15000 | 0 | official |  |  | urban.e-gov.am, муниципалитет |
| Технадзор (за м²) | `permit_supervision` | м² | 1500 | 0 | official |  |  | urban.e-gov.am, муниципалитет |
| Газоблок перегородок (10 см) | `aerated_partition` | м³ | 35000 | 40000 | quoted | см. note в prices.ts | 26.10.2026 | www.list.am, www.list.am, newhome.am |
| Аренда строительных лесов | `scaffolding` | м²·мес | 650 | 0 | quoted | см. note в prices.ts | 26.10.2026 | www.accurate.am |
| Манипулятор / кран (разгрузка, подача) | `crane` | смена | 60000 | 0 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Вывоз лишнего грунта | `soil_removal` | м³ | 3000 | 0 | estimate | см. note в prices.ts | 26.10.2026 | www.list.am |
| Вывоз строительного мусора | `waste_removal` | м³ | 3000 | 0 | estimate | см. note в prices.ts | 26.10.2026 | www.list.am |
| Геодезическая разбивка осей | `setting_out` | компл | 120000 | 0 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Утеплитель XPS (кровля, пол по грунту) | `insulation_xps` | м² | 4342 | 2000 | quoted | см. note в prices.ts | 26.10.2026 | totalarmenia.am, www.list.am, rmsgroup.am, shinshin.am, erkatproff.am |
| Подоконники и отливы | `window_sills` | пог.м | 7000 | 1500 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Плитка на стенах санузлов | `wall_tile` | м² | 4100 | 10000 | estimate | см. note в prices.ts | 26.10.2026 | domus.am, laminat.am, domus.am, domus.am, newhome.am |
| Облицовка лестницы (керамогранит) | `stair_finish` | м² | 5600 | 15000 | estimate | см. note в prices.ts | 26.10.2026 | domus.am, laminat.am, domus.am, domus.am, newhome.am |
| Разуклонка кровли (керамзитобетон) | `roof_slope` | м³ | 22000 | 9000 | unverified |  |  | оценка — нужна котировка |
| Парапетная крышка (оцинк. сталь) | `parapet_coping` | пог.м | 3500 | 1500 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Водосток: трубы, отвод от дома | `roof_drainage` | компл | 180000 | 60000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Сантехника санузла (унитаз, раковина, душевой поддон, смесители) | `sanitary_set` | компл | 144600 | 30000 | estimate | см. note в prices.ts | 26.10.2026 | nortun.am, domus.am, domus.am, nortun.am, domus.am, domus.am, fastmodernhouse.com, varpet.online |
| Внутренний газопровод (от счётчика) | `gas_internal` | компл | 150000 | 60000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Бойлер косвенного нагрева 200 л | `dhw_cylinder` | шт | 286000 | 40000 | quoted | см. note в prices.ts | 26.10.2026 | www.list.am, www.shinshin.am, www.shinshin.am |
| Фанкойл | `opt_fancoil` | шт | 92000 | 25000 | quoted | см. note в prices.ts | 26.10.2026 | www.list.am, mideaarmenia.am, mideaarmenia.am |
| Аккумулятор LiFePO4 | `opt_battery` | кВт·ч | 101000 | 5000 | quoted | см. note в prices.ts | 26.10.2026 | solaron.am |
| Зарядка электромобиля (wallbox) | `opt_ev_charger` | шт | 180000 | 35000 | quoted | см. note в prices.ts | 26.10.2026 | evolt.am, solaron.am, ener-go.am |
| Кухонная мебель (без техники) | `opt_kitchen` | пог.м | 100000 | 10000 | estimate | НЕТ ДАННЫХ — нужна котировка |  | оценка — нужна котировка |
| Электрощит с автоматами и УЗО | `electrical_panel` | компл | 49900 | 105000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, domus.am, shinmarket.am, shinshin.am, fastmodernhouse.com, varpet.online |
| Канализационная точка | `sewer_points` | точка | 1140 | 10000 | estimate | см. note в prices.ts | 26.10.2026 | shinshin.am, erkatproff.am, fastmodernhouse.com, varpet.online |
| Выезд бетононасоса | `pump_call` | выезд | 80000 | 0 | quoted | см. note в prices.ts | 26.10.2026 | www.waelcon.am |
| Подключение электричества, 0,4 кВ (3 фазы) | `conn_electricity_3ph` | кВА | 16000 | 0 | official | см. note в prices.ts | 26.10.2026 | psrc.am |
| Подключение 0,4 кВ: постоянная часть | `conn_electricity_3ph_base` | компл | 229000 | 0 | official | см. note в prices.ts | 26.10.2026 | psrc.am |
| Гибридный инвертор (для аккумулятора) | `opt_hybrid_inverter` | шт | 890000 | 0 | quoted | см. note в prices.ts | 26.10.2026 | www.list.am, www.list.am |
