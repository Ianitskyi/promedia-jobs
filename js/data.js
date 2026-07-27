/* ProMedia Jobs — вигадані демо-дані (крім реальних вакансій, доданих вручну).
   Немає бекенду: усе живе в цьому файлі та в localStorage браузера. */

const CATEGORIES = [
  { id: "journalism", label: "Журналістика" },
  { id: "reporting", label: "Репортерська робота" },
  { id: "editing", label: "Редактура" },
  { id: "media-management", label: "Медіаменеджмент" },
  { id: "producing", label: "Продюсування" },
  { id: "tv", label: "Телебачення" },
  { id: "radio", label: "Радіо" },
  { id: "podcasts", label: "Подкасти" },
  { id: "photography", label: "Фотографія" },
  { id: "video-production", label: "Відеовиробництво" },
  { id: "video-editing", label: "Відеомонтаж" },
  { id: "design", label: "Дизайн" },
  { id: "smm", label: "SMM" },
  { id: "content", label: "Контент-менеджмент" },
  { id: "copywriting", label: "Копірайтинг" },
  { id: "pr", label: "PR" },
  { id: "strategic-comms", label: "Стратегічні комунікації" },
  { id: "internal-comms", label: "Внутрішні комунікації" },
  { id: "marketing", label: "Маркетинг" },
  { id: "advertising", label: "Реклама" },
  { id: "analytics", label: "Аналітика та дослідження" },
  { id: "factchecking", label: "Фактчекінг" },
  { id: "osint", label: "OSINT" },
  { id: "media-monitoring", label: "Медіамоніторинг" },
  { id: "fundraising", label: "Фандрейзинг" },
  { id: "partnerships", label: "Партнерства" },
  { id: "project-management", label: "Проєктний менеджмент" },
  { id: "education", label: "Освітні та тренерські позиції" },
  { id: "tech", label: "Технічні спеціальності в медіа" },
  { id: "product", label: "Розробка цифрових продуктів" },
  { id: "sales", label: "Продажі" },
  { id: "admin", label: "Адміністративні посади" },
  { id: "internship", label: "Стажування" },
  { id: "volunteering", label: "Волонтерство" },
  { id: "other", label: "Інше" },
];

function catLabel(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c.label : id;
}

const LEVELS = [
  { id: "intern", label: "Стажер" },
  { id: "junior", label: "Junior" },
  { id: "middle", label: "Middle" },
  { id: "senior", label: "Senior" },
  { id: "lead", label: "Керівник" },
  { id: "top", label: "Топменеджмент" },
];

const FORMATS = [
  { id: "office", label: "Офіс" },
  { id: "remote", label: "Дистанційно" },
  { id: "hybrid", label: "Гібридно" },
];

const EMPLOYMENT_TYPES = [
  { id: "full", label: "Повна зайнятість" },
  { id: "part", label: "Часткова зайнятість" },
  { id: "project", label: "Проєктна робота" },
  { id: "freelance", label: "Фриланс" },
  { id: "temporary", label: "Тимчасова" },
  { id: "internship", label: "Стажування" },
  { id: "volunteering", label: "Волонтерство" },
];

const REGIONS = [
  "м. Київ", "Вінницька область", "Волинська область", "Дніпропетровська область",
  "Донецька область", "Житомирська область", "Закарпатська область", "Запорізька область",
  "Івано-Франківська область", "Київська область", "Кіровоградська область", "Луганська область",
  "Львівська область", "Миколаївська область", "Одеська область", "Полтавська область",
  "Рівненська область", "Сумська область", "Тернопільська область", "Харківська область",
  "Херсонська область", "Хмельницька область", "Черкаська область", "Чернівецька область",
  "Чернігівська область",
];

function labelOf(list, id) {
  const it = list.find((x) => x.id === id);
  return it ? it.label : id;
}

const COMPANIES = [
  { id: "suspilne", name: "Суспільне мовлення", letter: "С", color: "#0d0c5c", city: "Київ", industry: "Телебачення / Радіо",
    desc: "Національна суспільна медіаплатформа: телебачення, радіо, онлайн-редакція.", site: "suspilne.media" },
  { id: "ukrainska-pravda", name: "Українська правда", letter: "П", color: "#201e78", city: "Київ", industry: "Онлайн-медіа",
    desc: "Одне з найбільших онлайн-видань України.", site: "pravda.com.ua" },
  { id: "the-village", name: "The Village Україна", letter: "V", color: "#d98a17", city: "Київ", industry: "Медіа / Лайфстайл",
    desc: "Медіа про місто, культуру та людей.", site: "village.com.ua" },
  { id: "promedia-agency", name: "PR-агенція «Резонанс»", letter: "Р", color: "#1c9a56", city: "Львів", industry: "PR / Комунікації",
    desc: "Комунікаційна агенція повного циклу для бізнесу та НГО.", site: "rezonans-agency.ua" },
  { id: "adhouse", name: "AdHouse Digital", letter: "A", color: "#c9932c", city: "Дніпро", industry: "Реклама / Маркетинг",
    desc: "Перформанс-маркетинг та діджитал-реклама для e-commerce.", site: "adhouse.agency" },
  { id: "ngo-medialab", name: "МедіаЛаб (ГО)", letter: "М", color: "#8b8fa0", city: "Харків", industry: "Медіаграмотність / Освіта",
    desc: "Громадська організація: тренінги з медіаграмотності та фактчекінгу.", site: "medialab.org.ua" },
  { id: "ti-ukraine", name: "Transparency International Ukraine", letter: "T", color: "#0f4c81", city: "Київ", industry: "Громадська організація / Антикорупція",
    desc: "Акредитований представник глобального руху Transparency International: з 2012 року допомагає Україні ставати сильнішою, розробляючи й впроваджуючи зміни для зниження рівня корупції. Допомогла створити Prozorro, Prozorro.Продажі, eHealth та Prozvit, впровадила Рейтинги прозорості та підзвітності міст, розбудувала спільноту DOZORRO.", site: "ti-ukraine.org" },
];

function companyOf(id) { return COMPANIES.find((c) => c.id === id); }

/* Реальні вакансії надійшли до того, як портал почав вимагати обов'язкову
   вказану зарплату від нових оголошень — зарплата тут чесно позначена як
   не вказана роботодавцем, а не прихована. */
const VACANCIES = [
  {
    id: "v1", title: "SMM-менеджер(ка)", companyId: "ti-ukraine",
    categories: ["smm", "content", "advertising"], level: "middle",
    city: "Київ", region: "м. Київ", country: "Україна", format: "hybrid", remoteOk: false,
    employmentType: "full", experienceYears: 2,
    responsibilities: [
      "Реалізація та розвиток стратегії просування організації у соціальних мережах (пріоритетні: Facebook, Telegram, Instagram)",
      "Формування контент-плану під визначені KPI, пошук нових форматів і трендів",
      "Генерування ідей, написання сценаріїв, самостійна зйомка та монтаж caption-відео й Reels",
      "Створення текстів та візуалів для публікацій, постановка ТЗ дизайнерам за потреби",
      "Планування, запуск і оптимізація рекламних кампаній, управління бюджетом платного просування",
      "Ведення комунікації з підписниками: відповіді на коментарі та повідомлення в директ",
      "Налагодження партнерства й колаборації у соціальних мережах із залученням комунікаційної команди",
      "Аналіз ефективності роботи (Meta Business Suite, TGStat, GA4), підготовка щомісячних звітів та висновків для команди",
    ],
    mustHave: [
      "Понад 2 роки досвіду у SMM, бажано в медіа чи громадському секторі",
      "Розуміння різниці між контекстною та таргетованою рекламою, кейси успішних рекламних кампаній у соцмережах",
      "Впевнене володіння аналітикою, вміння робити пропозиції, підкріплені цифрами",
      "Вміння пояснювати складні речі простою мовою та створювати контент, що викликає емоції й залучає",
      "Вільна українська; англійська — не нижче B1",
    ],
    niceToHave: ["Впевнене володіння графічними редакторами та програмами для відеомонтажу"],
    experience: "Понад 2 роки у SMM",
    education: "Не вказано",
    skills: ["SMM", "Контент-план", "Копірайтинг", "Таргетована реклама", "Відеомонтаж"],
    tools: ["Meta Business Suite", "TGStat", "GA4"],
    languages: ["Українська — вільно", "Англійська — не нижче B1"],
    salaryMin: 0, salaryMax: 0, currency: "UAH",
    hasInsurance: false, officialEmployment: false,
    benefits: [
      "Робота з суспільно-важливим інформаційним продуктом",
      "Open-minded команда, яка щиро вітає пропозиції щодо змін",
      "Конкурентна винагорода залежно від досвіду та результатів співбесіди",
      "Гнучкий гібридний формат роботи (online + offline)",
      "Офіс у центрі Києва (метро «Золоті Ворота»)",
      "Компенсація навчання для професійного зростання",
      "24 календарні дні відпустки на рік",
    ],
    startDate: "",
    contactEmail: "hr-tiu@ti-ukraine.org",
    publishedAt: "2026-07-27", expiresAt: "2026-07-31",
    source: "direct", sourceUrl: "", direct: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v2", title: "PR-менеджер(ка)", companyId: null, companyName: "NDA",
    categories: ["pr", "strategic-comms"], level: "middle",
    city: "Миколаїв", region: "Миколаївська область", country: "Україна", format: "hybrid", remoteOk: false,
    employmentType: "full", experienceYears: 0,
    responsibilities: [
      "Антикризова комунікація: розробка та реалізація стратегій реагування на кризові ситуації, робота з репутаційними ризиками, мінімізація негативу в інфопросторі",
      "Робота зі ЗМІ: взаємодія з регіональними та національними медіа, написання прес-релізів, коментарів, організація інтерв'ю та брифінгів",
      "Створення контенту: підготовка офіційних заяв, текстів для медіа, блогу чи соцмереж щодо критичних та важливих подій",
      "Моніторинг та аналітика: щоденне відстеження згадок про компанію в інформаційному полі (Media Monitoring), аналіз медіаполя",
    ],
    mustHave: [], niceToHave: [],
    experience: "Не вказано", education: "Не вказано",
    skills: ["PR", "Антикризові комунікації", "Робота зі ЗМІ", "Медіамоніторинг"],
    tools: [], languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH",
    hasInsurance: false, officialEmployment: true,
    benefits: [
      "Офіс — у разі кризової ситуації, решта часу — віддалена взаємодія з партнерськими регіонами",
      "Офіційне оформлення (деталі — на співбесіді)",
    ],
    startDate: "",
    contactEmail: "missionofficialca@gmail.com",
    publishedAt: "2026-07-27", expiresAt: "2026-08-26",
    source: "direct", sourceUrl: "", direct: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v3", title: "SMM-менеджер(ка)", companyId: null, companyName: "NDA",
    categories: ["smm", "content", "advertising"], level: "middle",
    city: "Київ", region: "м. Київ", country: "Україна", format: "hybrid", remoteOk: false,
    employmentType: "full", experienceYears: 0,
    responsibilities: [
      "Імплементація стратегії та планування: розробка контент-плану, вибір платформ (Instagram, TikTok, Facebook, LinkedIn тощо) під задану цільову аудиторію",
      "Створення контенту: написання текстів, зйомка та монтаж відео (Reels, TikTok), створення фото та дизайну (сторіс, пости)",
      "Ведення та оформлення сторінок: регулярна публікація постів, оформлення актуальних (Highlights), підтримка візуального стилю бренду",
      "Комунікація з аудиторією: відповіді на коментарі та повідомлення в Direct, робота із запереченнями, підвищення залученості (Engagement Rate)",
      "Таргетована реклама: налаштування та запуск платних рекламних кампаній (або робота в парі з таргетологом)",
      "Колаборації та інфлюенс-маркетинг: пошук блогерів для партнерства",
      "Аналітика та звітність: відстеження показників охоплень, приросту аудиторії, конверсій та ефективності контенту",
    ],
    mustHave: [], niceToHave: [],
    experience: "Не вказано", education: "Не вказано",
    skills: ["SMM", "Контент-план", "Таргетована реклама", "Відеомонтаж", "Аналітика"],
    tools: ["Instagram", "TikTok", "Facebook", "LinkedIn"], languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH",
    hasInsurance: false, officialEmployment: true,
    benefits: [
      "Офіційне оформлення",
      "Віддалений формат роботи з обов'язковими виїздами в офіс та на заходи компанії",
    ],
    startDate: "",
    contactEmail: "missionofficialca@gmail.com",
    publishedAt: "2026-07-27", expiresAt: "2026-08-26",
    source: "direct", sourceUrl: "", direct: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v4", title: "PR-менеджер(ка)", companyId: null, companyName: "NDA",
    categories: ["pr", "strategic-comms"], level: "middle",
    city: "Київ", region: "м. Київ", country: "Україна", format: "hybrid", remoteOk: false,
    employmentType: "full", experienceYears: 0,
    responsibilities: [
      "Імплементація існуючої стратегії, адаптація під аудиторію",
      "Робота зі ЗМІ: написання прес-релізів, статей, коментарів, організація інтерв'ю та пресконференцій, формування бази журналістів",
      "Підвищення впізнаваності, формування позитивного іміджу компанії та її перших осіб",
      "Пошук партнерів, блогерів для колаборацій та нативних інтеграцій",
      "Створення контенту: підготовка текстів для соцмереж, сайту, блогу, спецпроєктів чи презентацій",
    ],
    mustHave: [], niceToHave: ["Англійська мова"],
    experience: "Не вказано", education: "Не вказано",
    skills: ["PR", "Робота зі ЗМІ", "Копірайтинг", "Партнерства"],
    tools: [], languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH",
    hasInsurance: false, officialEmployment: true,
    benefits: [
      "Офіційне оформлення",
      "Віддалений формат роботи з можливими виїздами в офіс у Києві",
    ],
    startDate: "",
    contactEmail: "missionofficialca@gmail.com",
    publishedAt: "2026-07-27", expiresAt: "2026-08-26",
    source: "direct", sourceUrl: "", direct: true,
    moderationStatus: "approved", active: true,
  },
];
