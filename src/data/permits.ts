export interface PermitStep {
  ru: string
  hy: string
  en: string
  descRu: string
  descHy: string
  descEn: string
}

export const PERMIT_STEPS: PermitStep[] = [
  {
    ru: 'Правоустанавливающие документы на землю',
    hy: 'Հողի սեփականության փաստաթղթեր',
    descRu: 'Свидетельство о собственности / кадастровая выписка на участок.',
    descHy: 'Սեփականության վկայական / կադաստրային տեղեկանք։',
    en: 'Land title documents',
    descEn: 'Ownership certificate or cadastral extract for the plot.',
  },
  {
    ru: 'Архитектурно-планировочное задание (АПЗ)',
    hy: 'Ճարտարապետահատակագծային առաջադրանք',
    descRu: 'Выдаётся муниципалитетом, задаёт условия застройки участка.',
    descHy: 'Տրամադրում է համայնքը, սահմանում է կառուցապատման պայմանները։',
    en: 'Architectural planning assignment (APZ)',
    descEn: 'Issued by the municipality; sets the building conditions for the plot.',
  },
  {
    ru: 'Эскизный проект и согласование',
    hy: 'Էսքիզային նախագիծ և համաձայնեցում',
    descRu: 'Предварительное архитектурное решение, согласуется с муниципалитетом.',
    descHy: 'Նախնական ճարտ. լուծում, համաձայնեցվում է համայնքի հետ։',
    en: 'Sketch design and approval',
    descEn: 'Preliminary architectural design, agreed with the municipality.',
  },
  {
    ru: 'Рабочий архитектурно-строительный проект',
    hy: 'Աշխատանքային ճարտ.-շին. նախագիծ',
    descRu: 'Разрабатывается лицензированной проектной организацией.',
    descHy: 'Մշակվում է լիցենզավորված նախագծային կազմակերպության կողմից։',
    en: 'Working architectural and structural design',
    descEn: 'Prepared by a licensed design firm.',
  },
  {
    ru: 'Инженерно-геологические изыскания',
    hy: 'Ինժեներաերկրաբանական հետազոտություններ',
    descRu: 'Исследование грунтов участка для расчёта фундамента.',
    descHy: 'Հողերի հետազոտություն հիմքի հաշվարկի համար։',
    en: 'Engineering geological survey',
    descEn: 'Soil investigation of the plot for the foundation design.',
  },
  {
    ru: 'Экспертиза проекта',
    hy: 'Նախագծի փորձաքննություն',
    descRu: 'Требуется по этажности/площади сверх упрощённой процедуры.',
    descHy: 'Պահանջվում է հարկայնության/մակերեսի դեպքում։',
    en: 'Design expertise',
    descEn: 'Required above the storeys or area of the simplified procedure.',
  },
  {
    ru: 'Разрешение на строительство',
    hy: 'Շինարարության թույլտվություն',
    descRu: 'Выдаёт уполномоченный орган (муниципалитет / Комитет градостроительства).',
    descHy: 'Տրամադրում է լիազոր մարմինը (համայնք / Քաղաքաշին. կոմիտե)։',
    en: 'Building permit',
    descEn: 'Issued by the authority in charge (municipality / Urban Development Committee).',
  },
  {
    ru: 'Технадзор и акт ввода в эксплуатацию',
    hy: 'Տեխնիկական հսկողություն և շահագործման ակտ',
    descRu: 'Сопровождение строительства и приёмка объекта по завершении.',
    descHy: 'Շինարարության ուղեկցում և ավարտին ընդունում։',
    en: 'Technical supervision and commissioning act',
    descEn: 'Supervision during construction and acceptance of the finished building.',
  },
]
