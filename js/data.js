/* ProMedia Jobs — вигадані демо-дані. Немає бекенду: усе живе в цьому файлі
   та в localStorage браузера (збережені вакансії/резюме, підписки, відгуки). */

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
  { id: "promedia-agency", name: "PR-агенція «レゾнанс»", letter: "Р", color: "#1c9a56", city: "Львів", industry: "PR / Комунікації",
    desc: "Комунікаційна агенція повного циклу для бізнесу та НГО.", site: "rezonans-agency.ua" },
  { id: "adhouse", name: "AdHouse Digital", letter: "A", color: "#c9932c", city: "Дніпро", industry: "Реклама / Маркетинг",
    desc: "Перформанс-маркетинг та діджитал-реклама для e-commerce.", site: "adhouse.agency" },
  { id: "ngo-medialab", name: "МедіаЛаб (ГО)", letter: "М", color: "#8b8fa0", city: "Харків", industry: "Медіаграмотність / Освіта",
    desc: "Громадська організація: тренінги з медіаграмотності та фактчекінгу.", site: "medialab.org.ua" },
];

function companyOf(id) { return COMPANIES.find((c) => c.id === id); }

const VACANCIES = [
  {
    id: "v1", title: "Редактор(-ка) новинного відділу", companyId: "ukrainska-pravda",
    categories: ["journalism", "editing"], level: "middle",
    city: "Київ", country: "Україна", format: "hybrid", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Редагувати новинні матеріали репортерів", "Формувати стрічку новин на сайті", "Стежити за фактчекінгом і стилістикою"],
    mustHave: ["Досвід роботи в новинній редакції від 2 років", "Грамотна українська мова", "Швидкість роботи з новинним потоком"],
    niceToHave: ["Досвід роботи з CMS", "Базове SEO"],
    experience: "Від 2 років у новинній журналістиці",
    education: "Вища освіта (журналістика, філологія — бажано)",
    skills: ["Редагування", "Фактчекінг", "Новинна журналістика"],
    tools: ["WordPress", "Google Docs"],
    languages: ["Українська — вільно", "Англійська — середній"],
    salaryMin: 25000, salaryMax: 35000, currency: "UAH", salaryHidden: false,
    benefits: ["Медичне страхування", "Гнучкий графік"],
    startDate: "2026-08-15", deadline: "2026-08-20",
    applyMethod: "internal", contactEmail: "hr@pravda.com.ua",
    publishedAt: "2026-07-20", expiresAt: "2026-08-19",
    source: "direct", sourceUrl: "", direct: true, promoted: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v2", title: "SMM-менеджер(ка)", companyId: "adhouse",
    categories: ["smm", "content"], level: "junior",
    city: "Дніпро", country: "Україна", format: "remote", remoteOk: true, fromAbroad: true,
    employmentType: "full",
    responsibilities: ["Вести соцмережі клієнтів (Instagram, TikTok, Facebook)", "Плюнувати контент-план", "Аналізувати статистику й пропонувати покращення"],
    mustHave: ["Досвід ведення соцмереж від 1 року", "Знання Instagram/TikTok алгоритмів", "Англійська мова — середній рівень"],
    niceToHave: ["Досвід з Google Analytics", "Базовий Photoshop/Canva"],
    experience: "Від 1 року",
    education: "Не обов'язкова",
    skills: ["SMM", "Контент-планування", "Копірайтинг"],
    tools: ["Canva", "Meta Business Suite", "TikTok Ads"],
    languages: ["Українська — рідна", "Англійська — середній"],
    salaryMin: 18000, salaryMax: 24000, currency: "UAH", salaryHidden: false,
    benefits: ["Повна дистанційна робота", "Навчання за рахунок компанії"],
    startDate: "2026-08-01", deadline: "2026-08-10",
    applyMethod: "internal", contactEmail: "jobs@adhouse.agency",
    publishedAt: "2026-07-22", expiresAt: "2026-08-21",
    source: "direct", sourceUrl: "", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v3", title: "Відеооператор(-ка) / монтажер(ка)", companyId: "suspilne",
    categories: ["video-production", "video-editing", "tv"], level: "middle",
    city: "Київ", country: "Україна", format: "office", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Знімати сюжети для телеефіру", "Монтувати відеоматеріали", "Співпрацювати з продюсерами й репортерами"],
    mustHave: ["Досвід зйомки й монтажу від 3 років", "Впевнене володіння Adobe Premiere Pro"],
    niceToHave: ["DaVinci Resolve", "Досвід роботи з дроном"],
    experience: "Від 3 років",
    education: "Не обов'язкова",
    skills: ["Відеомонтаж", "Операторська робота"],
    tools: ["Adobe Premiere Pro", "DaVinci Resolve"],
    languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: ["Офіційне працевлаштування", "Службове обладнання"],
    startDate: "2026-09-01", deadline: "2026-08-25",
    applyMethod: "internal", contactEmail: "hr@suspilne.media",
    publishedAt: "2026-07-15", expiresAt: "2026-08-14",
    source: "direct", sourceUrl: "", direct: true, promoted: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v4", title: "PR-менеджер(ка)", companyId: "promedia-agency",
    categories: ["pr", "strategic-comms"], level: "middle",
    city: "Львів", country: "Україна", format: "hybrid", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Розробляти й виконувати PR-стратегії клієнтів", "Готувати пресрелізи та коментарі", "Будувати стосунки з журналістами"],
    mustHave: ["Досвід у PR від 2 років", "Навички написання пресрелізів", "Нетворк серед медіа"],
    niceToHave: ["Досвід у кризових комунікаціях"],
    experience: "Від 2 років",
    education: "Вища (журналістика/PR/комунікації)",
    skills: ["PR", "Комунікації", "Медіарилейшнз"],
    tools: ["Google Workspace", "Trello"],
    languages: ["Українська — рідна", "Англійська — вище середнього"],
    salaryMin: 22000, salaryMax: 30000, currency: "UAH", salaryHidden: false,
    benefits: ["Бонуси за результат", "Гнучкий графік"],
    startDate: "2026-08-10", deadline: "2026-08-18",
    applyMethod: "internal", contactEmail: "hr@rezonans-agency.ua",
    publishedAt: "2026-07-18", expiresAt: "2026-08-17",
    source: "direct", sourceUrl: "", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v5", title: "Контент-менеджер(ка) сайту", companyId: "the-village",
    categories: ["content", "copywriting"], level: "junior",
    city: "Київ", country: "Україна", format: "remote", remoteOk: true, fromAbroad: true,
    employmentType: "part",
    responsibilities: ["Публікувати матеріали на сайті", "Стежити за версткою й SEO-оптимізацією", "Модерувати коментарі"],
    mustHave: ["Грамотна українська мова", "Досвід роботи з CMS"],
    niceToHave: ["Базовий HTML", "Досвід у медіа"],
    experience: "Від 6 місяців",
    education: "Не обов'язкова",
    skills: ["Контент-менеджмент", "SEO"],
    tools: ["WordPress"],
    languages: ["Українська — рідна"],
    salaryMin: 12000, salaryMax: 16000, currency: "UAH", salaryHidden: false,
    benefits: ["Часткова зайнятість", "Дистанційно"],
    startDate: "2026-08-05", deadline: "2026-08-12",
    applyMethod: "external", contactEmail: "", sourceUrl: "https://village.com.ua/jobs/content-manager",
    publishedAt: "2026-07-19", expiresAt: "2026-08-18",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v6", title: "Фактчекер(ка) / OSINT-аналітик(иня)", companyId: "ngo-medialab",
    categories: ["factchecking", "osint", "media-monitoring"], level: "middle",
    city: "Харків", country: "Україна", format: "remote", remoteOk: true, fromAbroad: true,
    employmentType: "project",
    responsibilities: ["Перевіряти факти та джерела", "Проводити OSINT-розслідування", "Готувати звіти для команди"],
    mustHave: ["Досвід фактчекінгу або OSINT від 1 року", "Уважність до деталей", "Англійська — вище середнього"],
    niceToHave: ["Досвід роботи з геолокацією зображень", "Знання інструментів верифікації (InVID, Yandex)"],
    experience: "Від 1 року",
    education: "Не обов'язкова",
    skills: ["Фактчекінг", "OSINT", "Аналітика"],
    tools: ["InVID", "Google Earth"],
    languages: ["Українська — рідна", "Англійська — вище середнього"],
    salaryMin: 20000, salaryMax: 28000, currency: "UAH", salaryHidden: false,
    benefits: ["Проєктна оплата", "Повна дистанційна робота"],
    startDate: "2026-08-01", deadline: "2026-08-15",
    applyMethod: "internal", contactEmail: "jobs@medialab.org.ua",
    publishedAt: "2026-07-21", expiresAt: "2026-08-20",
    source: "direct", direct: true, promoted: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v7", title: "Копірайтер(ка)", companyId: "adhouse",
    categories: ["copywriting", "marketing"], level: "junior",
    city: "Будь-яке місто", country: "Україна", format: "remote", remoteOk: true, fromAbroad: true,
    employmentType: "freelance",
    responsibilities: ["Писати рекламні тексти для соцмереж і сайтів", "Адаптувати тон комунікації під бренд клієнта"],
    mustHave: ["Портфоліо текстів", "Грамотна українська мова"],
    niceToHave: ["Досвід у e-commerce"],
    experience: "Без досвіду / від 6 місяців",
    education: "Не обов'язкова",
    skills: ["Копірайтинг", "Рекламні тексти"],
    tools: ["Google Docs"],
    languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: ["Оплата за проєкт", "Гнучкий графік"],
    startDate: "2026-08-01", deadline: "2026-08-30",
    applyMethod: "internal", contactEmail: "jobs@adhouse.agency",
    publishedAt: "2026-07-10", expiresAt: "2026-08-09",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v8", title: "Стажер(ка)-репортер(ка)", companyId: "suspilne",
    categories: ["journalism", "reporting", "internship"], level: "intern",
    city: "Київ", country: "Україна", format: "office", remoteOk: false, fromAbroad: false,
    employmentType: "internship",
    responsibilities: ["Допомагати репортерам у підготовці сюжетів", "Брати участь у зйомках", "Розшифровувати інтерв'ю"],
    mustHave: ["Студент(ка) журналістики або суміжної спеціальності", "Готовність вчитися"],
    niceToHave: [],
    experience: "Без досвіду",
    education: "Студент(ка) 3-4 курсу або магістратури",
    skills: ["Журналістика"],
    tools: [],
    languages: ["Українська — рідна"],
    salaryMin: 8000, salaryMax: 8000, currency: "UAH", salaryHidden: false,
    benefits: ["Оплачуване стажування", "Менторство"],
    startDate: "2026-09-01", deadline: "2026-08-22",
    applyMethod: "internal", contactEmail: "internship@suspilne.media",
    publishedAt: "2026-07-23", expiresAt: "2026-08-22",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v9", title: "Менеджер(ка) із партнерств", companyId: "ngo-medialab",
    categories: ["partnerships", "fundraising"], level: "senior",
    city: "Харків", country: "Україна", format: "hybrid", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Шукати й вести грантові партнерства", "Готувати заявки на гранти", "Звітувати перед донорами"],
    mustHave: ["Досвід фандрейзингу від 3 років", "Англійська — вільно", "Досвід написання грантових заявок"],
    niceToHave: ["Досвід роботи з міжнародними донорами (USAID, EU)"],
    experience: "Від 3 років",
    education: "Вища освіта",
    skills: ["Фандрейзинг", "Партнерства", "Грантрайтинг"],
    tools: ["MS Office"],
    languages: ["Українська — рідна", "Англійська — вільно"],
    salaryMin: 35000, salaryMax: 45000, currency: "UAH", salaryHidden: false,
    benefits: ["Медстрахування", "Відрядження"],
    startDate: "2026-09-01", deadline: "2026-08-28",
    applyMethod: "internal", contactEmail: "jobs@medialab.org.ua",
    publishedAt: "2026-07-17", expiresAt: "2026-08-16",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v10", title: "Дизайнер(ка) (соцмережі та друк)", companyId: "the-village",
    categories: ["design", "smm"], level: "middle",
    city: "Київ", country: "Україна", format: "remote", remoteOk: true, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Створювати візуали для соцмереж", "Розробляти банери та інфографіку", "Підтримувати брендбук"],
    mustHave: ["Впевнене володіння Figma та Adobe Photoshop/Illustrator", "Портфоліо"],
    niceToHave: ["Досвід у моушн-дизайні"],
    experience: "Від 2 років",
    education: "Не обов'язкова",
    skills: ["Дизайн", "Візуальні комунікації"],
    tools: ["Figma", "Adobe Illustrator", "Adobe Photoshop"],
    languages: ["Українська — рідна"],
    salaryMin: 26000, salaryMax: 32000, currency: "UAH", salaryHidden: false,
    benefits: ["Дистанційна робота", "Творча свобода"],
    startDate: "2026-08-15", deadline: "2026-08-25",
    applyMethod: "internal", contactEmail: "jobs@village.com.ua",
    publishedAt: "2026-07-24", expiresAt: "2026-08-23",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v11", title: "Продюсер(ка) подкастів", companyId: "suspilne",
    categories: ["podcasts", "producing"], level: "middle",
    city: "Київ", country: "Україна", format: "hybrid", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Планувати випуски подкастів", "Координувати запис і монтаж", "Працювати з гостями"],
    mustHave: ["Досвід продюсування аудіоконтенту", "Організаційні навички"],
    niceToHave: ["Досвід звукорежисури"],
    experience: "Від 2 років",
    education: "Не обов'язкова",
    skills: ["Продюсування", "Аудіоредагування"],
    tools: ["Adobe Audition", "Descript"],
    languages: ["Українська — рідна"],
    salaryMin: 24000, salaryMax: 30000, currency: "UAH", salaryHidden: false,
    benefits: ["Гнучкий графік"],
    startDate: "2026-08-20", deadline: "2026-08-27",
    applyMethod: "internal", contactEmail: "jobs@suspilne.media",
    publishedAt: "2026-07-16", expiresAt: "2026-08-15",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v12", title: "Маркетинг-аналітик(иня)", companyId: "adhouse",
    categories: ["marketing", "analytics"], level: "middle",
    city: "Дніпро", country: "Україна", format: "office", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Аналізувати ефективність рекламних кампаній", "Готувати звіти для клієнтів", "Пропонувати оптимізації"],
    mustHave: ["Досвід роботи з Google Analytics/Ads", "Аналітичне мислення"],
    niceToHave: ["SQL", "Power BI"],
    experience: "Від 2 років",
    education: "Вища (маркетинг/економіка)",
    skills: ["Аналітика", "Маркетинг"],
    tools: ["Google Analytics", "Google Ads", "Power BI"],
    languages: ["Українська — рідна", "Англійська — середній"],
    salaryMin: 28000, salaryMax: 36000, currency: "UAH", salaryHidden: false,
    benefits: ["Офіс у центрі", "Навчання"],
    startDate: "2026-09-01", deadline: "2026-08-24",
    applyMethod: "internal", contactEmail: "jobs@adhouse.agency",
    publishedAt: "2026-07-14", expiresAt: "2026-08-13",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v13", title: "Журналіст(ка)-розслідувач(ка)", companyId: "ukrainska-pravda",
    categories: ["journalism", "reporting", "osint"], level: "senior",
    city: "Київ", country: "Україна", format: "hybrid", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Проводити журналістські розслідування", "Працювати з відкритими даними та реєстрами", "Готувати матеріали з дотриманням стандартів"],
    mustHave: ["Досвід розслідувальної журналістики від 3 років", "Знання роботи з держреєстрами"],
    niceToHave: ["Досвід міжнародної співпраці з іншими редакціями"],
    experience: "Від 3 років",
    education: "Вища освіта",
    skills: ["Розслідування", "OSINT", "Журналістика"],
    tools: ["YouControl", "Google Docs"],
    languages: ["Українська — рідна", "Англійська — вище середнього"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: ["Юридичний супровід", "Гнучкий графік"],
    startDate: "2026-09-01", deadline: "2026-08-29",
    applyMethod: "internal", contactEmail: "hr@pravda.com.ua",
    publishedAt: "2026-07-12", expiresAt: "2026-08-11",
    source: "direct", direct: true, promoted: true,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v14", title: "Волонтер(ка) для інформаційної кампанії", companyId: "ngo-medialab",
    categories: ["volunteering", "pr", "smm"], level: "intern",
    city: "Дистанційно", country: "Україна", format: "remote", remoteOk: true, fromAbroad: true,
    employmentType: "volunteering",
    responsibilities: ["Допомагати з веденням соцмереж кампанії", "Поширювати інформаційні матеріали"],
    mustHave: ["Бажання допомагати", "Базові навички роботи з соцмережами"],
    niceToHave: [],
    experience: "Без досвіду",
    education: "Не обов'язкова",
    skills: ["SMM"],
    tools: [],
    languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: ["Досвід та рекомендаційний лист"],
    startDate: "2026-08-05", deadline: "2026-08-15",
    applyMethod: "internal", contactEmail: "volunteer@medialab.org.ua",
    publishedAt: "2026-07-25", expiresAt: "2026-08-24",
    source: "direct", direct: true, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v15", title: "Копірайтер(ка) для маркетплейсу", companyId: null,
    companyName: "Приватний підприємець (Work.ua)",
    categories: ["copywriting", "marketing"], level: "junior",
    city: "Одеса", country: "Україна", format: "remote", remoteOk: true, fromAbroad: false,
    employmentType: "part",
    responsibilities: ["Опис вакансії скорочено джерелом — повний текст за посиланням нижче."],
    mustHave: ["Див. оригінальне оголошення"],
    niceToHave: [],
    experience: "Не вказано джерелом",
    education: "Не вказано джерелом",
    skills: ["Копірайтинг"],
    tools: [],
    languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: [],
    startDate: "", deadline: "2026-08-20",
    applyMethod: "external", contactEmail: "", sourceUrl: "https://www.work.ua/jobs/example-15/",
    publishedAt: "2026-07-20", expiresAt: "2026-08-19",
    source: "Work.ua", direct: false, promoted: false,
    moderationStatus: "approved", active: true,
    // Той самий запис прийшов і з Work.ua, і з Єдиного порталу вакансій ДСЗ
    // (портал агрегує Work.ua/Robota.ua офіційно) — показуємо одну картку.
    sources: [
      { name: "Work.ua", url: "https://www.work.ua/jobs/example-15/" },
      { name: "Єдиний портал вакансій ДСЗ", url: "https://jobportal.dcz.gov.ua/" },
    ],
  },
  {
    id: "v16", title: "Фахівець(-чиня) із комунікацій комунального підприємства", companyId: null,
    companyName: "Комунальне підприємство (за відкритими даними ДСЗ)",
    categories: ["pr", "internal-comms"], level: "middle",
    city: "Львів", country: "Україна", format: "office", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Опис вакансії скорочено джерелом — повний текст за посиланням нижче."],
    mustHave: ["Див. оригінальне оголошення"],
    niceToHave: [],
    experience: "Не вказано джерелом",
    education: "Не вказано джерелом",
    skills: ["PR"],
    tools: [],
    languages: ["Українська — рідна"],
    salaryMin: 21000, salaryMax: 21000, currency: "UAH", salaryHidden: false,
    benefits: [],
    startDate: "", deadline: "2026-08-22",
    applyMethod: "external", contactEmail: "", sourceUrl: "https://jobportal.dcz.gov.ua/",
    publishedAt: "2026-07-21", expiresAt: "2026-08-20",
    source: "Єдиний портал вакансій ДСЗ", direct: false, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v17", title: "Редактор(ка) соцмереж медіапроєкту", companyId: null,
    companyName: "Незалежний медіапроєкт (з Telegram-каналу)",
    categories: ["smm", "content"], level: "junior",
    city: "Дистанційно", country: "Україна", format: "remote", remoteOk: true, fromAbroad: true,
    employmentType: "project",
    responsibilities: ["Опис вакансії скорочено джерелом — повний текст за посиланням нижче."],
    mustHave: ["Див. оригінальне оголошення"],
    niceToHave: [],
    experience: "Не вказано джерелом",
    education: "Не вказано джерелом",
    skills: ["SMM"],
    tools: [],
    languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: [],
    startDate: "", deadline: "2026-08-15",
    applyMethod: "external", contactEmail: "", sourceUrl: "https://t.me/thelede",
    publishedAt: "2026-07-23", expiresAt: "2026-08-14",
    source: "Telegram-канал «Стався, метч»", direct: false, promoted: false,
    moderationStatus: "approved", active: true,
  },
  {
    id: "v18", title: "Комунікаційний(на) менеджер(ка) громадської організації", companyId: null,
    companyName: "ГО-партнер (з дайджесту Lobby X)",
    categories: ["pr", "partnerships"], level: "middle",
    city: "Київ", country: "Україна", format: "hybrid", remoteOk: false, fromAbroad: false,
    employmentType: "full",
    responsibilities: ["Опис вакансії скорочено джерелом — повний текст за посиланням нижче."],
    mustHave: ["Див. оригінальне оголошення"],
    niceToHave: [],
    experience: "Не вказано джерелом",
    education: "Не вказано джерелом",
    skills: ["PR", "Партнерства"],
    tools: [],
    languages: ["Українська — рідна"],
    salaryMin: 0, salaryMax: 0, currency: "UAH", salaryHidden: true,
    benefits: [],
    startDate: "", deadline: "2026-08-18",
    applyMethod: "external", contactEmail: "", sourceUrl: "https://thelobbyx.com/digest/current-vacancies/",
    publishedAt: "2026-07-24", expiresAt: "2026-08-17",
    source: "Lobby X", direct: false, promoted: false,
    moderationStatus: "approved", active: true,
  },
];

const RESUMES = [
  {
    id: "r1", name: "Марія К.", title: "SMM-менеджерка", city: "Київ", country: "Україна",
    categories: ["smm", "content"], level: "junior",
    remoteOk: true, relocation: false, desiredFormat: "remote", desiredEmploymentType: "full",
    experienceYears: 1.5, education: "Бакалавр журналістики, КНУ ім. Шевченка",
    skills: ["SMM", "Копірайтинг", "Контент-план"], tools: ["Canva", "Meta Business Suite"],
    languages: ["Українська — рідна", "Англійська — середній"],
    profile: "Веду соцмережі малого бізнесу останні 1.5 роки: контент-план, візуали, комунікація з аудиторією.",
    desiredPositions: ["SMM-менеджер", "Контент-менеджер"],
    expectedSalary: 20000, currency: "UAH",
    availability: "Готова почати за 2 тижні",
    visibility: "open", contactsVisible: "employers", updatedAt: "2026-07-20", promoted: false,
  },
  {
    id: "r2", name: "Олег П.", title: "Відеомонтажер / videographer", city: "Львів", country: "Україна",
    categories: ["video-editing", "video-production"], level: "middle",
    remoteOk: true, relocation: true, desiredFormat: "hybrid", desiredEmploymentType: "full",
    experienceYears: 3, education: "Не вказано",
    skills: ["Відеомонтаж", "Кольорокорекція"], tools: ["Adobe Premiere Pro", "DaVinci Resolve", "After Effects"],
    languages: ["Українська — рідна", "Англійська — базовий"],
    profile: "3 роки монтую рекламні та документальні відео. Працював з YouTube-каналами та агенціями.",
    desiredPositions: ["Відеомонтажер", "Моушн-дизайнер"],
    expectedSalary: 26000, currency: "UAH",
    availability: "Готовий одразу",
    visibility: "open", contactsVisible: "everyone", updatedAt: "2026-07-22", promoted: true,
  },
  {
    id: "r3", name: "Ірина Т.", title: "PR та комунікації", city: "Львів", country: "Україна",
    categories: ["pr", "strategic-comms", "internal-comms"], level: "senior",
    remoteOk: false, relocation: false, desiredFormat: "hybrid", desiredEmploymentType: "full",
    experienceYears: 6, education: "Магістр, спеціальність «Зв'язки з громадськістю»",
    skills: ["PR", "Кризові комунікації", "Медіарилейшнз"], tools: ["Google Workspace"],
    languages: ["Українська — рідна", "Англійська — вільно", "Польська — середній"],
    profile: "6 років у стратегічних комунікаціях, з них 3 — на позиції керівниці PR-відділу.",
    desiredPositions: ["Керівник PR-відділу", "PR-менеджер"],
    expectedSalary: 45000, currency: "UAH",
    availability: "За місяць (відпрацювання)",
    visibility: "employers_only", contactsVisible: "employers", updatedAt: "2026-07-18", promoted: false,
  },
  {
    id: "r4", name: "Данило С.", title: "Журналіст / репортер", city: "Харків", country: "Україна",
    categories: ["journalism", "reporting", "factchecking"], level: "middle",
    remoteOk: true, relocation: true, desiredFormat: "office", desiredEmploymentType: "full",
    experienceYears: 4, education: "Бакалавр журналістики",
    skills: ["Журналістика", "Фактчекінг", "Інтерв'ю"], tools: [],
    languages: ["Українська — рідна", "Англійська — вище середнього"],
    profile: "4 роки писав репортажі й новини для регіональних та національних медіа.",
    desiredPositions: ["Журналіст", "Кореспондент"],
    expectedSalary: 28000, currency: "UAH",
    availability: "Готовий одразу",
    visibility: "open", contactsVisible: "everyone", updatedAt: "2026-07-24", promoted: false,
  },
  {
    id: "r5", name: "Софія В.", title: "Дизайнерка (Figma, Illustrator)", city: "Одеса", country: "Україна",
    categories: ["design", "smm"], level: "junior",
    remoteOk: true, relocation: false, desiredFormat: "remote", desiredEmploymentType: "freelance",
    experienceYears: 1, education: "Не вказано",
    skills: ["Дизайн", "Брендинг"], tools: ["Figma", "Adobe Illustrator"],
    languages: ["Українська — рідна"],
    profile: "Роблю візуали для соцмереж та невеликі брендбуки на фрилансі.",
    desiredPositions: ["Графічний дизайнер", "SMM-дизайнер"],
    expectedSalary: 15000, currency: "UAH",
    availability: "Готова одразу",
    visibility: "open", contactsVisible: "everyone", updatedAt: "2026-07-23", promoted: false,
  },
  {
    id: "r6", name: "Андрій М.", title: "Маркетинг-аналітик", city: "Дніпро", country: "Україна",
    categories: ["marketing", "analytics"], level: "middle",
    remoteOk: false, relocation: false, desiredFormat: "office", desiredEmploymentType: "full",
    experienceYears: 2.5, education: "Бакалавр економіки",
    skills: ["Аналітика", "Google Ads"], tools: ["Google Analytics", "Google Ads", "Excel"],
    languages: ["Українська — рідна", "Англійська — середній"],
    profile: "Аналізую рекламні кампанії та готую звіти для клієнтів агенції.",
    desiredPositions: ["Маркетинг-аналітик", "PPC-спеціаліст"],
    expectedSalary: 30000, currency: "UAH",
    availability: "За 2 тижні",
    visibility: "open", contactsVisible: "employers", updatedAt: "2026-07-15", promoted: false,
  },
  {
    id: "r7", name: "Христина Л.", title: "Фактчекерка / OSINT", city: "Дистанційно", country: "Україна",
    categories: ["factchecking", "osint", "media-monitoring"], level: "junior",
    remoteOk: true, relocation: false, desiredFormat: "remote", desiredEmploymentType: "project",
    experienceYears: 0.8, education: "Студентка магістратури журналістики",
    skills: ["Фактчекінг", "OSINT"], tools: ["InVID"],
    languages: ["Українська — рідна", "Англійська — вище середнього"],
    profile: "Проходила курс з верифікації інформації, шукаю першу проєктну роботу у фактчекінгу.",
    desiredPositions: ["Фактчекер", "OSINT-аналітик"],
    expectedSalary: 15000, currency: "UAH",
    availability: "Готова одразу",
    visibility: "open", contactsVisible: "everyone", updatedAt: "2026-07-21", promoted: false,
  },
  {
    id: "r8", name: "Максим Р.", title: "Продюсер відео/подкастів", city: "Київ", country: "Україна",
    categories: ["producing", "podcasts", "video-production"], level: "senior",
    remoteOk: false, relocation: false, desiredFormat: "hybrid", desiredEmploymentType: "full",
    experienceYears: 5, education: "Не вказано",
    skills: ["Продюсування", "Управління проєктами"], tools: ["Adobe Audition", "Premiere Pro"],
    languages: ["Українська — рідна", "Англійська — середній"],
    profile: "5 років продюсую відео та аудіоконтент для медіа й брендів.",
    desiredPositions: ["Продюсер", "Керівник відеовідділу"],
    expectedSalary: 40000, currency: "UAH",
    availability: "За місяць",
    visibility: "open", contactsVisible: "employers", updatedAt: "2026-07-11", promoted: false,
  },
];

/* ---------------- Синергія: проста прозора модель відповідності ---------------- */

function computeMatch(resume, vacancy) {
  // Критичні несумісності — не рекомендуємо взагалі
  if (!resume.remoteOk && vacancy.format === "remote" && resume.desiredFormat === "office") {
    return null;
  }
  if (resume.desiredFormat === "office" && vacancy.format === "remote" && !resume.relocation && resume.city !== vacancy.city) {
    // М'яке правило в демо — не критичне, просто знижує бал нижче
  }

  const reasons = [];
  const gaps = [];
  let score = 0;
  let maxScore = 0;

  // Категорії (вага 35)
  maxScore += 35;
  const catOverlap = resume.categories.filter((c) => vacancy.categories.includes(c));
  if (catOverlap.length > 0) {
    score += 35 * Math.min(1, catOverlap.length / Math.min(2, vacancy.categories.length));
    reasons.push(`професійна категорія «${catLabel(catOverlap[0])}» збігається з вакансією`);
  } else {
    gaps.push("жодна професійна категорія не збігається напряму");
  }

  // Навички (вага 25)
  maxScore += 25;
  const skillOverlap = resume.skills.filter((s) => vacancy.skills.includes(s));
  if (skillOverlap.length > 0) {
    score += 25 * Math.min(1, skillOverlap.length / Math.max(1, vacancy.skills.length));
    reasons.push(`збігаються навички: ${skillOverlap.join(", ")}`);
  } else {
    gaps.push("немає прямого збігу навичок із вимогами вакансії");
  }

  // Формат роботи (вага 15)
  maxScore += 15;
  if (resume.desiredFormat === vacancy.format || resume.remoteOk) {
    score += 15;
    reasons.push("формат роботи підходить (дистанційно/гібридно за потреби)");
  } else {
    gaps.push("бажаний формат роботи відрізняється від вакансії");
  }

  // Рівень посади (вага 15)
  maxScore += 15;
  const levelOrder = ["intern", "junior", "middle", "senior", "lead", "top"];
  const diff = Math.abs(levelOrder.indexOf(resume.level) - levelOrder.indexOf(vacancy.level));
  if (diff === 0) { score += 15; reasons.push("рівень посади збігається"); }
  else if (diff === 1) { score += 8; reasons.push("рівень посади близький до вимог вакансії"); }
  else { gaps.push("рівень посади суттєво відрізняється від вимог вакансії"); }

  // Місто/дистанційність (вага 10)
  maxScore += 10;
  if (vacancy.remoteOk || resume.city === vacancy.city || resume.relocation) {
    score += 10;
  } else {
    gaps.push("місто не збігається, а вакансія не дистанційна");
  }

  const pct = Math.round((score / maxScore) * 100);
  let level;
  if (pct >= 75) level = "high";
  else if (pct >= 45) level = "possible";
  else level = "partial";

  if (catOverlap.length === 0 && skillOverlap.length === 0) return null; // надто далеко — не показуємо

  return { pct, level, reasons, gaps };
}

const MATCH_LABELS = { high: "Висока відповідність", possible: "Можлива відповідність", partial: "Часткова відповідність" };
