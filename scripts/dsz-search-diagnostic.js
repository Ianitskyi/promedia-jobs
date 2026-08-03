#!/usr/bin/env node
/* Одноразовий діагностичний скрипт — шукає на data.gov.ua датасети, дотичні
 * до вакансій/ринку праці, і друкує їхні назви, організацію та список
 * ресурсів (назва + формат), щоб знайти той, що реально містить відкриті
 * вакансії із зарплатою (а не картки вже працевлаштованих осіб чи щось
 * інше). Нічого не записує й не комітить — лише виводить у консоль/лог.
 * Запускається вручну через .github/workflows/dsz-search-diagnostic.yml,
 * бо data.gov.ua недоступний із середовища розробки.
 */

const CKAN_BASE = "https://data.gov.ua/api/3/action";

const QUERIES = [
  "вакансії",
  "вакансія",
  "попит на робочу силу",
  "3-ПН",
  "ринок праці",
  "державна служба зайнятості вакансії",
  "актуальні вакансії",
];

function log(...args) { console.log(...args); }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "promedia-jobs-import/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  return res.json();
}

async function searchDatasets(query) {
  const url = `${CKAN_BASE}/package_search?q=${encodeURIComponent(query)}&rows=15`;
  const data = await fetchJson(url);
  if (!data || !data.success || !data.result) return [];
  return data.result.results || [];
}

async function main() {
  const seen = new Map(); // id -> package
  for (const q of QUERIES) {
    log(`\n=== Пошук: "${q}" ===`);
    let results = [];
    try {
      results = await searchDatasets(q);
    } catch (e) {
      log(`  помилка запиту: ${e.message}`);
      continue;
    }
    log(`  знайдено ${results.length} датасетів`);
    for (const pkg of results) {
      if (!seen.has(pkg.id)) seen.set(pkg.id, pkg);
      log(`  - [${pkg.id}] "${pkg.title}" · org: ${pkg.organization ? pkg.organization.title : "?"}`);
    }
  }

  log(`\n\n=== Деталі по кожному унікальному датасету (${seen.size}) ===`);
  for (const [id, pkg] of seen) {
    log(`\n--- ${pkg.title} (id: ${id}) ---`);
    log(`Організація: ${pkg.organization ? pkg.organization.title : "?"}`);
    log(`Опис: ${(pkg.notes || "").slice(0, 300)}`);
    const resources = pkg.resources || [];
    log(`Ресурсів: ${resources.length}`);
    for (const r of resources.slice(0, 5)) {
      log(`  · "${r.name || r.id}" · формат: ${r.format} · створено: ${r.created || r.last_modified || "?"}`);
      log(`    url: ${r.url}`);
    }
    if (resources.length > 5) log(`  ... і ще ${resources.length - 5} ресурсів`);
  }
}

main().catch((e) => {
  console.error("ПОМИЛКА:", e.message);
  process.exit(1);
});
