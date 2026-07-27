/* ProMedia Jobs — рендеринг і взаємодія прототипу.
   Усе працює на клієнті: localStorage замінює реальний бекенд і акаунти.
   Сервіс лише для вакансій: каталог відкритий без входу, реєстрація потрібна
   тільки роботодавцям (щоб додавати й керувати власними вакансіями). */

const LS = {
  authed: "pmj_authed",
  profileName: "pmj_profile_name",
  profileEmail: "pmj_profile_email",
  myVacancies: "pmj_my_vacancies",
  employerVerified: "pmj_employer_verified",
  companyProfile: "pmj_company_profile",
};

function lsGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function qs(name) { return new URLSearchParams(location.search).get(name); }

function formatSalary(v) {
  if (!v.salaryMin && !v.salaryMax) return "Не вказано роботодавцем";
  if (v.salaryMin && v.salaryMax && v.salaryMin !== v.salaryMax) return `${v.salaryMin.toLocaleString("uk-UA")}–${v.salaryMax.toLocaleString("uk-UA")} ${v.currency}`;
  return `${(v.salaryMax || v.salaryMin).toLocaleString("uk-UA")} ${v.currency}`;
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const d = Math.ceil((new Date(dateStr) - new Date("2026-07-27")) / 86400000);
  return d;
}

function locationText(v) {
  return v.country === "Україна" && v.region ? `${v.region}, Україна` : v.country;
}

function perkTagsHtml(v) {
  const tags = (v.perks || []).map((id) => `<span class="tag green">${labelOf(PERKS, id)}</span>`);
  (v.perksOther || []).forEach((p) => tags.push(`<span class="tag green">${p}</span>`));
  if (v.employmentArrangement === "labor") tags.push('<span class="tag green">Офіційне оформлення</span>');
  else if (v.employmentArrangement) tags.push(`<span class="tag">${labelOf(EMPLOYMENT_ARRANGEMENTS, v.employmentArrangement)}</span>`);
  return tags.join("");
}

function companyName(v) { return v.companyId ? companyOf(v.companyId).name : v.companyName; }
function companyLetter(v) { return v.companyId ? companyOf(v.companyId).letter : (v.companyName || "?")[0]; }
function companyColor(v) { return v.companyId ? companyOf(v.companyId).color : "#7c7c93"; }
function companyLogo(v) {
  if (v.companyId === "adhouse") { const cp = getCompanyProfile(); return cp.logoDataUrl || null; }
  return null;
}
function logoOrLetterHtml(v, size) {
  const logo = companyLogo(v);
  const s = size || 46;
  return logo
    ? `<img src="${logo}" alt="" style="width:${s}px;height:${s}px;border-radius:12px;object-fit:cover;flex:none" />`
    : `<div class="jc-logo" style="background:${companyColor(v)};width:${s}px;height:${s}px">${companyLetter(v)}</div>`;
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------------- Джерела імпорту (дедуплікація) ---------------- */

// Повертає всі підтверджені джерела вакансії. Якщо той самий запис
// прийшов з кількох каналів (наприклад, і з Work.ua, і з Єдиного порталу
// вакансій ДСЗ, який теж агрегує Work.ua), зберігаємо один запис із
// кількома джерелами замість дублікатів-карток.
function vacancySources(v) {
  if (Array.isArray(v.sources) && v.sources.length) return v.sources;
  if (v.source && v.source !== "direct") return [{ name: v.source, url: v.sourceUrl }];
  return [];
}

/* ---------------- Картки ---------------- */

function jobCardHtml(v) {
  const dl = daysLeft(v.expiresAt);
  const catLabels = v.categories.slice(0, 2).map(catLabel).join(" · ");
  const sources = vacancySources(v);
  const perks = (v.remoteOk ? '<span class="tag green">Дистанційно</span>' : "") + perkTagsHtml(v);
  return `
  <a class="job-card" href="vacancy.html?id=${v.id}">
    <div class="jc-top">
      ${logoOrLetterHtml(v)}
      <div>
        <div class="jc-title">${v.title}</div>
        <div class="jc-company">${companyName(v)} · ${locationText(v)}</div>
      </div>
    </div>
    <div class="jc-meta">
      <span class="tag ink">${labelOf(FORMATS, v.format)}</span>
      <span class="tag">${labelOf(EMPLOYMENT_TYPES, v.employmentType)}</span>
      <span class="tag">${labelOf(LEVELS, v.level)}</span>
      ${perks}
      ${sources.map((s) => `<span class="tag green">${s.name}</span>`).join("")}
    </div>
    <div class="jc-salary">${formatSalary(v)}</div>
    <div class="jc-foot">
      <span>${catLabels}</span>
      ${dl !== null ? `<span>${dl > 0 ? dl + " дн. до завершення" : "публікацію завершено"}</span>` : ""}
    </div>
  </a>`;
}

/* ---------------- Каталог вакансій ---------------- */

function initVacanciesFilters(list) {
  const arrBox = document.getElementById("f-arrangement");
  arrBox.innerHTML = EMPLOYMENT_ARRANGEMENTS.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
  const lvlBox = document.getElementById("f-level");
  lvlBox.innerHTML = LEVELS.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
  const regionSel = document.getElementById("f-region");
  regionSel.innerHTML = '<option value="">Будь-яка область</option>' + REGIONS.map((r) => `<option value="${r}">${r}</option>`).join("");

  document.querySelectorAll(".filters-panel input, .filters-panel select").forEach((el) => {
    el.addEventListener("change", () => renderFilteredVacancies(list));
  });
  document.getElementById("f-keyword").addEventListener("input", () => renderFilteredVacancies(list));
  const preQ = qs("q");
  if (preQ) document.getElementById("f-keyword").value = preQ;
  document.getElementById("f-reset").addEventListener("click", () => {
    document.querySelectorAll(".filters-panel input[type=checkbox]").forEach((c) => (c.checked = false));
    document.getElementById("f-keyword").value = "";
    document.getElementById("f-region").value = "";
    document.getElementById("f-sort").value = "new";
    renderFilteredVacancies(list);
  });
}

function checkedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map((i) => i.value);
}

function renderFilteredVacancies(list) {
  const kw = (document.getElementById("f-keyword").value || "").toLowerCase();
  const region = document.getElementById("f-region").value;
  const arrs = checkedValues("f-arrangement");
  const lvls = checkedValues("f-level");
  const remoteOnly = document.getElementById("f-remote").checked;
  const insuranceOnly = document.getElementById("f-insurance").checked;
  const sortBy = document.getElementById("f-sort").value;

  const filtered = list.filter((v) => {
    if (!v.active) return false;
    if (kw && !(v.title.toLowerCase().includes(kw) || companyName(v).toLowerCase().includes(kw) || v.skills.join(" ").toLowerCase().includes(kw))) return false;
    if (region && v.region !== region) return false;
    if (arrs.length && !arrs.includes(v.employmentArrangement)) return false;
    if (lvls.length && !lvls.includes(v.level)) return false;
    if (remoteOnly && !v.remoteOk) return false;
    if (insuranceOnly && !(v.perks || []).includes("insurance")) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === "salary-desc") return (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0);
    if (sortBy === "salary-asc") return (a.salaryMin || a.salaryMax || 0) - (b.salaryMin || b.salaryMax || 0);
    if (sortBy === "exp-asc") return (a.experienceYears || 0) - (b.experienceYears || 0);
    if (sortBy === "exp-desc") return (b.experienceYears || 0) - (a.experienceYears || 0);
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  document.getElementById("result-count").textContent = `Знайдено ${filtered.length} вакансій`;
  document.getElementById("results").innerHTML = filtered.length
    ? filtered.map(jobCardHtml).join("")
    : '<div class="empty-state">Нічого не знайдено. Спробуйте змінити фільтри.</div>';
}

function allVacancies() {
  return VACANCIES.concat(getMyVacancies().filter((v) => v.status === "active"));
}

function initVacanciesPage() {
  const list = allVacancies();
  initVacanciesFilters(list);
  renderFilteredVacancies(list);
}

/* ---------------- Деталі вакансії ---------------- */

function initVacancyDetail() {
  const v = allVacancies().find((x) => x.id === qs("id"));
  const el = document.getElementById("vacancy-detail");
  if (!v) { el.innerHTML = '<div class="empty-state">Вакансію не знайдено або її публікацію завершено. <a href="index.html">До каталогу вакансій →</a></div>'; return; }
  document.title = `${v.title} — ${companyName(v)} · ProMedia Jobs`;
  const dl = daysLeft(v.expiresAt);
  const sources = vacancySources(v);
  el.innerHTML = `
  <div class="detail-hero">
    ${logoOrLetterHtml(v, 56)}
    <div>
      <div class="eyebrow" style="margin-bottom:6px">${v.direct ? "Пряма вакансія" : "Імпортовано з " + sources.map((s) => s.name).join(" та ")}</div>
      <h1>${v.title}</h1>
      <a class="company-link" href="${v.companyId ? "company.html?id=" + v.companyId : "#"}">${companyName(v)}</a> · ${locationText(v)}
    </div>
  </div>
  <div class="jc-meta" style="margin:18px 0">
    <span class="tag ink">${labelOf(FORMATS, v.format)}</span>
    <span class="tag">${labelOf(EMPLOYMENT_TYPES, v.employmentType)}</span>
    <span class="tag">${labelOf(LEVELS, v.level)}</span>
    ${v.remoteOk ? '<span class="tag green">Дистанційно</span>' : ""}
    ${perkTagsHtml(v)}
    ${v.categories.map((c) => `<span class="tag">${catLabel(c)}</span>`).join("")}
  </div>
  <div class="panel">
    <h2>Опис вакансії</h2>
    <p><b>Зарплата:</b> ${formatSalary(v)}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Обов'язки</h3>
    <ul>${v.responsibilities.map((r) => `<li>${r}</li>`).join("")}</ul>
    ${v.mustHave.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Обов'язкові вимоги</h3><ul>${v.mustHave.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    ${v.niceToHave.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Бажані навички</h3><ul>${v.niceToHave.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Досвід та освіта</h3>
    <p>${v.experience}${v.education ? " · " + v.education : ""}</p>
    ${v.tools.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Інструменти</h3><p>${v.tools.join(", ")}</p>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Мови</h3>
    <p>${v.languages.join(", ")}</p>
    ${v.benefits.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Соціальний пакет і переваги</h3><ul>${v.benefits.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    ${!v.direct ? `<div class="source-note">Ця вакансія імпортована у скороченому й нейтралізованому вигляді.${sources.length > 1 ? " Знайдена одразу в кількох джерелах — показуємо один запис із посиланнями на всі:" : " Повне оголошення — за посиланням на джерело:"}<br>${sources.map((s) => s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.name} →</a>` : s.name).join(" · ")}</div>` : ""}
  </div>
  `;

  const apply = document.getElementById("apply-panel");
  apply.innerHTML = `
    <div class="panel">
      <div class="deadline">Вакансія активна до: <b>${v.expiresAt || "не вказано"}</b>${dl !== null ? ` (${dl > 0 ? dl + " дн." : "минуло"})` : ""}</div>
      ${v.direct
        ? (v.contactEmail
            ? `<a class="btn btn-primary btn-block" href="mailto:${v.contactEmail}?subject=${encodeURIComponent("Відгук на вакансію: " + v.title)}">Написати на ${v.contactEmail}</a>`
            : `<p style="color:var(--muted);font-size:13px">Контакти роботодавця не вказано.</p>`)
        : `<a class="btn btn-primary btn-block" href="${v.sourceUrl}" target="_blank" rel="noopener">Перейти до оригіналу →</a>`}
      <p style="font-size:12.5px;color:var(--muted);margin-top:10px">Подача — напряму на пошту роботодавця, без реєстрації на порталі.</p>
    </div>`;
}

/* ---------------- Вакансії роботодавця ---------------- */

function getMyVacancies() { return lsGet(LS.myVacancies, []); }
function saveMyVacancies(list) { lsSet(LS.myVacancies, list); }
function addMyVacancy(v) {
  const list = getMyVacancies();
  list.unshift(v);
  saveMyVacancies(list);
}
function upsertMyVacancy(v) {
  const list = getMyVacancies();
  const idx = list.findIndex((x) => x.id === v.id);
  if (idx >= 0) list[idx] = v; else list.unshift(v);
  saveMyVacancies(list);
}
function deleteMyVacancy(id) {
  saveMyVacancies(getMyVacancies().filter((x) => x.id !== id));
}
function isEmployerVerified() { return lsGet(LS.employerVerified, false); }
function setEmployerVerified(v) { lsSet(LS.employerVerified, v); }

const COMPANY_PROFILE_SEED = { name: "AdHouse Digital", desc: "Перформанс-маркетинг та діджитал-реклама для e-commerce.", site: "adhouse.agency", city: "Дніпро", logoDataUrl: "" };
function getCompanyProfile() { return lsGet(LS.companyProfile, COMPANY_PROFILE_SEED); }
function saveCompanyProfile(p) { lsSet(LS.companyProfile, p); }

/* ---------------- Компанія ---------------- */

function initCompanyPage() {
  const seed = companyOf(qs("id"));
  if (!seed) {
    document.getElementById("company-hero").innerHTML = "";
    document.getElementById("company-desc").textContent = "";
    document.getElementById("company-vacancies").innerHTML = '<div class="empty-state">Компанію не знайдено.</div>';
    return;
  }
  // Профіль AdHouse Digital редагується роботодавцем у кабінеті — тут
  // показуємо збережені дані замість статичних, якщо їх редагували.
  const cp = seed.id === "adhouse" ? getCompanyProfile() : null;
  const c = cp ? Object.assign({}, seed, { name: cp.name, desc: cp.desc, site: cp.site, city: cp.city }) : seed;
  document.title = `${c.name} · ProMedia Jobs`;
  const logo = cp && cp.logoDataUrl
    ? `<img src="${cp.logoDataUrl}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;flex:none" />`
    : `<div class="jc-logo" style="background:${c.color};width:56px;height:56px">${c.letter}</div>`;
  document.getElementById("company-hero").innerHTML = `
    ${logo}
    <div>
      <h1>${c.name}</h1>
      <div class="jc-company">${c.industry} · ${c.city} · <a href="https://${c.site}" target="_blank" rel="noopener">${c.site}</a></div>
    </div>`;
  document.getElementById("company-desc").textContent = c.desc;
  const open = VACANCIES.filter((v) => v.companyId === c.id && v.active)
    .concat(cp ? getMyVacancies().filter((v) => v.status === "active") : []);
  document.getElementById("company-vacancies").innerHTML = open.length
    ? open.map(jobCardHtml).join("")
    : '<div class="empty-state">Наразі немає активних вакансій цієї компанії.</div>';
}

/* ---------------- Автентифікація роботодавця (демо) ---------------- */

function isAuthed() { return lsGet(LS.authed, false); }
function setAuthed(v) { lsSet(LS.authed, v); }

function getProfileName() { return lsGet(LS.profileName, ""); }
function getProfileEmail() { return lsGet(LS.profileEmail, ""); }
function setProfile(name, email) {
  if (name) lsSet(LS.profileName, name);
  if (email) lsSet(LS.profileEmail, email);
}

// Викликати першим рядком на кожній сторінці кабінету роботодавця.
// Повертає false і одразу веде на вхід/реєстрацію, якщо ще не увійшли.
function requireAuth() {
  if (isAuthed()) return true;
  const next = location.pathname.split("/").pop();
  location.href = `employer-login.html?next=${next}`;
  return false;
}

/* ---------------- Верхня панель: показ посилання на кабінет ---------------- */

function initEmployerLink() {
  const link = document.getElementById("employer-link");
  if (!link) return;
  if (isAuthed()) {
    link.textContent = "Кабінет роботодавця →";
    link.href = "employer-cabinet.html";
  } else {
    link.textContent = "Роботодавцям →";
    link.href = "employer-login.html";
  }
}
document.addEventListener("DOMContentLoaded", initEmployerLink);
