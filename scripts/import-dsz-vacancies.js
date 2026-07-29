#!/usr/bin/env node
/* Щоденний імпорт вакансій з відкритих даних Єдиного порталу вакансій ДСЗ
 * (форма №3-ПН, data.gov.ua) — відфільтрований за темами медіа/PR/маркетингу
 * й обмежений обов'язковою наявністю зарплати (те саме правило, що діє для
 * вакансій, які подають роботодавці напряму через post-vacancy.html).
 *
 * Принцип: якщо джерело не вдалося впевнено розпізнати (немає очікуваних
 * колонок), скрипт падає з помилкою і НЕ чіпає js/imported-vacancies.js —
 * краще залишити вчорашній стан, ніж мовчки записати сміття чи вигадані дані.
 *
 * Дата.gov.ua — CKAN-портал; API описаний тут:
 * https://data.gov.ua/pages/instructions
 */

const fs = require("fs");
const path = require("path");

const CKAN_BASE = "https://data.gov.ua/api/3/action";
// Найкращий відомий кандидат на slug датасету "Перелік актуальних вакансій
// станом на дату" (форма №3-ПН). Якщо портал перейменує/перенесе датасет,
// нижче є резервний пошук за ключовими словами.
const KNOWN_DATASET_ID = process.env.DSZ_DATASET_ID || "0000000";
const OUTPUT_FILE = path.join(__dirname, "..", "js", "imported-vacancies.js");
const MAX_IMPORTED = 20;

const TOPIC_KEYWORDS = [
  "журналіст", "редактор", "репортер", "продюсер", "тележурналіст",
  "радіоведуч", "подкаст", "фотограф", "оператор", "відеомонтаж",
  "відеооператор", "дизайнер", "smm", "смм", "контент-менеджер",
  "копірайтер", "піар", "pr-менеджер", "pr менеджер", "прес-секретар",
  "комунікац", "маркетолог", "реклам", "таргетолог", "медіа",
  "факт-чек", "фактчек", "медіамоніторинг", "монтажер", "сценарист",
];

const HEADER_CANDIDATES = {
  title: ["назва вакансії", "назва посади", "посада", "професія", "найменування вакансії", "вакансія"],
  company: ["роботодавець", "назва роботодавця", "найменування роботодавця", "підприємство", "організація", "юридична особа"],
  region: ["область", "регіон", "адміністративно-територіальна одиниця", "територія"],
  salary: ["заробітна плата", "зарплата", "оплата праці", "розмір заробітної плати", "зп"],
  description: ["опис вакансії", "опис", "додаткова інформація", "вимоги", "умови"],
};

function log(...args) { console.log("[import-dsz-vacancies]", ...args); }
function fail(msg) {
  console.error("[import-dsz-vacancies] ПОМИЛКА:", msg);
  console.error("[import-dsz-vacancies] js/imported-vacancies.js залишено без змін.");
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "promedia-jobs-import/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "promedia-jobs-import/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  return res.text();
}

async function resolveDataset() {
  try {
    const data = await fetchJson(`${CKAN_BASE}/package_show?id=${KNOWN_DATASET_ID}`);
    if (data && data.success && data.result) return data.result;
  } catch (e) {
    log("package_show для відомого ID не спрацював:", e.message);
  }
  log("Пробую резервний пошук за ключовими словами...");
  const search = await fetchJson(`${CKAN_BASE}/package_search?q=${encodeURIComponent("вакансії ДСЗ")}&rows=5`);
  if (!search || !search.success || !search.result || !search.result.results || !search.result.results.length) {
    throw new Error("Не вдалося знайти датасет вакансій ДСЗ ні за відомим ID, ні пошуком.");
  }
  return search.result.results[0];
}

function pickResource(pkg) {
  const resources = (pkg.resources || []).slice();
  if (!resources.length) throw new Error("У датасеті немає жодного ресурсу (файлу).");
  // Найновіший ресурс у форматі CSV (уряд зазвичай додає новий файл на кожну дату,
  // а не оновлює один і той самий URL).
  const csvResources = resources.filter((r) => (r.format || "").toUpperCase().includes("CSV"));
  const pool = csvResources.length ? csvResources : resources;
  pool.sort((a, b) => new Date(b.created || b.last_modified || 0) - new Date(a.created || a.last_modified || 0));
  return pool[0];
}

function parseCsv(text) {
  // Мінімальний RFC4180-парсер: лапки, коми й переноси рядків усередині полів.
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && r.some((c) => c.trim() !== ""));
}

function findColumn(headers, candidates) {
  const norm = headers.map((h) => (h || "").trim().toLowerCase());
  for (const cand of candidates) {
    const idx = norm.findIndex((h) => h.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseSalary(raw) {
  if (!raw) return 0;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function matchRegion(raw) {
  if (!raw) return "";
  const norm = raw.trim().toLowerCase();
  const REGIONS = [
    "м. Київ", "Вінницька область", "Волинська область", "Дніпропетровська область",
    "Донецька область", "Житомирська область", "Закарпатська область", "Запорізька область",
    "Івано-Франківська область", "Київська область", "Кіровоградська область", "Луганська область",
    "Львівська область", "Миколаївська область", "Одеська область", "Полтавська область",
    "Рівненська область", "Сумська область", "Тернопільська область", "Харківська область",
    "Херсонська область", "Хмельницька область", "Черкаська область", "Чернівецька область",
    "Чернігівська область",
  ];
  const found = REGIONS.find((r) => norm.includes(r.toLowerCase().replace("м. ", "")));
  return found || "";
}

function isOnTopic(title, description) {
  const text = `${title} ${description || ""}`.toLowerCase();
  return TOPIC_KEYWORDS.some((kw) => text.includes(kw));
}

function stableId(title, company, region) {
  const raw = `${title}|${company}|${region}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return "dsz-" + hash.toString(36);
}

function todayPlusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  log("Шукаю датасет...");
  const pkg = await resolveDataset();
  log("Датасет:", pkg.title || pkg.name || pkg.id);

  const resource = pickResource(pkg);
  log("Обраний ресурс:", resource.name || resource.id, "·", resource.format, "·", resource.url);

  const csvText = await fetchText(resource.url);
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("Файл порожній або не розпізнався як CSV.");

  const headers = rows[0];
  const col = {
    title: findColumn(headers, HEADER_CANDIDATES.title),
    company: findColumn(headers, HEADER_CANDIDATES.company),
    region: findColumn(headers, HEADER_CANDIDATES.region),
    salary: findColumn(headers, HEADER_CANDIDATES.salary),
    description: findColumn(headers, HEADER_CANDIDATES.description),
  };
  log("Знайдені колонки:", JSON.stringify(col), "з заголовків:", JSON.stringify(headers));

  if (col.title === -1 || col.company === -1) {
    fail(
      "Не вдалося впевнено визначити колонки 'назва вакансії' та 'роботодавець' у файлі. " +
      "Заголовки, які реально прийшли: " + JSON.stringify(headers) +
      " — потрібно оновити HEADER_CANDIDATES у scripts/import-dsz-vacancies.js під реальну схему."
    );
  }

  const dataRows = rows.slice(1);
  const candidates = [];
  for (const r of dataRows) {
    const title = (r[col.title] || "").trim();
    const company = (r[col.company] || "").trim();
    if (!title || !company) continue;
    const description = col.description !== -1 ? (r[col.description] || "").trim() : "";
    if (!isOnTopic(title, description)) continue;
    const salary = col.salary !== -1 ? parseSalary(r[col.salary]) : 0;
    if (!salary) continue; // сайт публікує лише вакансії з указаною зарплатою
    const region = col.region !== -1 ? matchRegion(r[col.region]) : "";
    candidates.push({ title, company, description, salary, region });
  }

  log(`На тему сайту й із зарплатою: ${candidates.length} з ${dataRows.length} рядків.`);

  const picked = candidates.slice(0, MAX_IMPORTED);
  const vacancies = picked.map((c) => ({
    id: stableId(c.title, c.company, c.region),
    title: c.title,
    companyId: null,
    companyName: c.company,
    region: c.region,
    country: "Україна",
    format: "office",
    remoteOk: /дистанц|віддален/i.test(c.description),
    employmentType: "full",
    experienceYears: 0,
    responsibilities: c.description ? [c.description] : [],
    mustHave: [],
    niceToHave: [],
    education: "",
    skills: [],
    tools: [],
    languages: [],
    salaryMin: c.salary,
    salaryMax: c.salary,
    currency: "UAH",
    perks: [],
    perksOther: [],
    employmentArrangement: "",
    benefits: [],
    contactEmail: "",
    publishedAt: todayPlusDays(0),
    expiresAt: todayPlusDays(30),
    source: "Єдиний портал вакансій ДСЗ",
    sourceUrl: "https://www.dcz.gov.ua/job",
    direct: false,
    moderationStatus: "approved",
    active: true,
  }));

  const header = `/* Автоматично згенеровано scripts/import-dsz-vacancies.js — не редагувати вручну.
   Щоденний імпорт із відкритих даних Єдиного порталу вакансій ДСЗ (форма №3-ПН),
   відфільтрований за темами медіа/комунікацій/маркетингу. Порожньо, якщо імпорт
   ще жодного разу не запускався успішно.
   Останнє оновлення: ${new Date().toISOString()} */
`;
  const body = `const IMPORTED_VACANCIES = ${JSON.stringify(vacancies, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, header + body);
  log(`Записано ${vacancies.length} вакансій у ${OUTPUT_FILE}.`);
}

main().catch((e) => fail(e.message));
