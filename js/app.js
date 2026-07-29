/* ProMedia Jobs — рендеринг і взаємодія статичного сайту.
   Кабінет роботодавця тимчасово працює на клієнті: localStorage замінює
   реальний бекенд і акаунти до підключення серверної авторизації.
   Сервіс лише для вакансій: каталог відкритий без входу, реєстрація потрібна
   тільки роботодавцям (щоб додавати й керувати власними вакансіями). */

const LS = {
  authed: "pmj_authed",
  profileName: "pmj_profile_name",
  profileEmail: "pmj_profile_email",
  myVacancies: "pmj_my_vacancies",
  employerVerified: "pmj_employer_verified",
  companyProfile: "pmj_company_profile",
  subscriptions: "pmj_subscriptions",
  employerRegistered: "pmj_employer_registered",
};

function lsGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function qs(name) { return new URLSearchParams(location.search).get(name); }

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch (e) {
    return "";
  }
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSalary(v) {
  if (!v.salaryMin && !v.salaryMax) return "Не вказано роботодавцем";
  if (v.salaryMin && v.salaryMax && v.salaryMin !== v.salaryMax) return `${v.salaryMin.toLocaleString("uk-UA")}–${v.salaryMax.toLocaleString("uk-UA")} ${v.currency}`;
  return `${(v.salaryMax || v.salaryMin).toLocaleString("uk-UA")} ${v.currency}`;
}

function experienceText(v) {
  return v.experienceYears ? `Від ${v.experienceYears} р. досвіду` : "Досвід не вказано";
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date(`${todayIsoDate()}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function locationText(v) {
  if (v.region === "Вся Україна") return "Вся Україна";
  return v.country === "Україна" && v.region ? `${v.region}, Україна` : v.country;
}

function perkTagsHtml(v) {
  const tags = (v.perks || []).map((id) => `<span class="tag green">${labelOf(PERKS, id)}</span>`);
  (v.perksOther || []).forEach((p) => tags.push(`<span class="tag green">${p}</span>`));
  if (v.employmentArrangement === "labor") tags.push('<span class="tag green">Офіційне оформлення</span>');
  else if (v.employmentArrangement) tags.push(`<span class="tag">${labelOf(EMPLOYMENT_ARRANGEMENTS, v.employmentArrangement)}</span>`);
  return tags.join("");
}

function companyName(v) {
  const company = v.companyId ? companyOf(v.companyId) : null;
  return company ? company.name : (v.companyName || "Компанія не вказана");
}
function companyLetter(v) {
  const company = v.companyId ? companyOf(v.companyId) : null;
  return company ? company.letter : (v.companyName || "?")[0];
}
function companyColor(v) {
  const company = v.companyId ? companyOf(v.companyId) : null;
  return company ? company.color : "#7c7c93";
}
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

function primarySource(v) {
  return vacancySources(v).find((s) => s.url) || null;
}

function isPromediaFound(v) {
  return v.foundBy === "promedia";
}

/* ---------------- Картки ---------------- */

function jobCardHtml(v) {
  const dl = daysLeft(v.expiresAt);
  const sources = vacancySources(v);
  const perks = (v.remoteOk ? '<span class="tag green">Дистанційно</span>' : "") + perkTagsHtml(v);
  const cardClasses = `job-card${isPromediaFound(v) ? " curated" : ""}`;
  return `
  <a class="${cardClasses}" href="vacancy.html?id=${encodeURIComponent(v.id)}">
    <div class="jc-top">
      ${logoOrLetterHtml(v)}
      <div>
        <div class="jc-title">${esc(v.title)}</div>
        <div class="jc-company">${esc(companyName(v))} · ${esc(locationText(v))}</div>
      </div>
    </div>
    <div class="jc-meta">
      <span class="tag ink">${labelOf(FORMATS, v.format)}</span>
      <span class="tag">${labelOf(EMPLOYMENT_TYPES, v.employmentType)}</span>
      ${perks}
      ${isPromediaFound(v) ? '<span class="tag promedia">Додано ПроМедіа</span>' : ""}
      ${sources.map((s) => `<span class="tag green">${esc(s.name)}</span>`).join("")}
    </div>
    <div class="jc-salary">${formatSalary(v)}</div>
    ${dl !== null ? `<div class="jc-foot"><span>${dl > 0 ? dl + " дн. до завершення" : "публікацію завершено"}</span></div>` : ""}
  </a>`;
}

/* ---------------- Каталог вакансій ---------------- */

function initVacanciesFilters(list) {
  const arrBox = document.getElementById("f-arrangement");
  arrBox.innerHTML = EMPLOYMENT_ARRANGEMENTS.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
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

function currentFilterSnapshot() {
  return {
    keyword: (document.getElementById("f-keyword").value || "").trim(),
    region: document.getElementById("f-region").value,
    arrangement: checkedValues("f-arrangement"),
    remoteOnly: document.getElementById("f-remote").checked,
    insuranceOnly: document.getElementById("f-insurance").checked,
  };
}

function filterMatches(v, f) {
  const kw = f.keyword.toLowerCase();
  const skillsText = (v.skills || []).join(" ").toLowerCase();
  if (kw && !(`${v.title} ${companyName(v)}`.toLowerCase().includes(kw) || skillsText.includes(kw))) return false;
  if (f.region && v.region !== f.region) return false;
  if (f.arrangement.length && !f.arrangement.includes(v.employmentArrangement)) return false;
  if (f.remoteOnly && !v.remoteOk) return false;
  if (f.insuranceOnly && !(v.perks || []).includes("insurance")) return false;
  return true;
}

function filterSummary(f) {
  const parts = [];
  if (f.keyword) parts.push(`«${f.keyword}»`);
  if (f.region) parts.push(f.region);
  if (f.arrangement.length) parts.push(f.arrangement.map((a) => labelOf(EMPLOYMENT_ARRANGEMENTS, a)).join(" / "));
  if (f.remoteOnly) parts.push("лише дистанційно");
  if (f.insuranceOnly) parts.push("лише з медстрахуванням");
  return parts.length ? parts.join(" · ") : "усі вакансії";
}

function renderFilteredVacancies(list) {
  const f = currentFilterSnapshot();
  const sortBy = document.getElementById("f-sort").value;
  const filtered = list.filter((v) => v.active && filterMatches(v, f));

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

/* ---------------- Підписки шукачів на фільтр ---------------- */

function getSubscriptions() { return lsGet(LS.subscriptions, []); }
function saveSubscriptions(list) { lsSet(LS.subscriptions, list); }

function addSubscription(email) {
  const subs = getSubscriptions();
  subs.unshift({ id: "sub-" + Date.now(), email, filter: currentFilterSnapshot(), createdAt: todayIsoDate() });
  saveSubscriptions(subs);
}

function removeSubscription(id) {
  saveSubscriptions(getSubscriptions().filter((s) => s.id !== id));
}

function renderSubscriptions(list) {
  const box = document.getElementById("sub-list");
  if (!box) return;
  const subs = getSubscriptions();
  box.innerHTML = subs.length
    ? subs.map((s) => {
        const count = list.filter((v) => v.active && filterMatches(v, s.filter)).length;
        return `<div class="sub-row">
          <div><b>${esc(filterSummary(s.filter))}</b><div class="hint">${esc(s.email)} · зараз відповідає: ${count}</div></div>
          <button class="btn btn-light btn-sm" onclick="removeSubscriptionAndRerender('${s.id}')">Відписатися</button>
        </div>`;
      }).join("")
    : '<p class="hint">Підписок ще немає.</p>';
}

window.removeSubscriptionAndRerender = function (id) {
  removeSubscription(id);
  renderSubscriptions(allVacancies());
  toast("Підписку скасовано");
};

function initSubscribeBox(list) {
  const btn = document.getElementById("sub-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const email = document.getElementById("sub-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Вкажіть коректний email"); return; }
    addSubscription(email);
    document.getElementById("sub-email").value = "";
    renderSubscriptions(list);
    toast("Підписку збережено в цьому браузері — листи поки не надсилаються");
  });
  renderSubscriptions(list);
}

function allVacancies() {
  return VACANCIES.filter((v) => v.active).concat(getMyVacancies().filter((v) => v.status === "active"));
}

function initVacanciesPage() {
  const list = allVacancies();
  initVacanciesFilters(list);
  renderFilteredVacancies(list);
  initSubscribeBox(list);
}

/* ---------------- Деталі вакансії ---------------- */

function initVacancyDetail() {
  const v = allVacancies().find((x) => x.id === qs("id"));
  const el = document.getElementById("vacancy-detail");
  if (!v) { el.innerHTML = '<div class="empty-state">Вакансію не знайдено або її публікацію завершено. <a href="index.html">До каталогу вакансій →</a></div>'; return; }
  document.title = `${v.title} — ${companyName(v)} · ProMedia Jobs`;
  const dl = daysLeft(v.expiresAt);
  const sources = vacancySources(v);
  const source = primarySource(v);
  const sourceLinks = sources.map((s) => s.url
    ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.name)} →</a>`
    : esc(s.name)).join(" · ");
  const sourceNote = isPromediaFound(v)
    ? `<div class="source-note promedia">Цю вакансію додала команда «ПроМедіа» з ${esc(source?.name || v.source || "публічного джерела")}. Ми показуємо скорочений опис і ключові умови, а повне оголошення та відгук — у першоджерелі:<br>${sourceLinks}</div>`
    : (!v.direct ? `<div class="source-note">Ця вакансія імпортована у скороченому й нейтралізованому вигляді.${sources.length > 1 ? " Знайдена одразу в кількох джерелах — показуємо один запис із посиланнями на всі:" : " Повне оголошення — за посиланням на джерело:"}<br>${sourceLinks}</div>` : "");
  el.innerHTML = `
  <div class="detail-hero">
    ${logoOrLetterHtml(v, 56)}
    <div>
      <div class="eyebrow" style="margin-bottom:6px">${v.direct ? "Пряма вакансія від роботодавця" : (isPromediaFound(v) ? "Додано командою «ПроМедіа»" : "Імпортовано з " + sources.map((s) => esc(s.name)).join(" та "))}</div>
      <h1>${esc(v.title)}</h1>
      <a class="company-link" href="${v.companyId ? "company.html?id=" + encodeURIComponent(v.companyId) : "#"}">${esc(companyName(v))}</a> · ${esc(locationText(v))}
    </div>
  </div>
  <div class="jc-meta" style="margin:18px 0">
    <span class="tag ink">${labelOf(FORMATS, v.format)}</span>
    <span class="tag">${labelOf(EMPLOYMENT_TYPES, v.employmentType)}</span>
    ${v.remoteOk ? '<span class="tag green">Дистанційно</span>' : ""}
    ${perkTagsHtml(v)}
  </div>
  <div class="panel">
    <h2>Опис вакансії</h2>
    <p><b>Зарплата:</b> ${formatSalary(v)}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Обов'язки</h3>
    <ul>${(v.responsibilities || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    ${(v.mustHave || []).length ? `<h3 style="font-size:14px;margin:14px 0 6px">Обов'язкові вимоги</h3><ul>${v.mustHave.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    ${(v.niceToHave || []).length ? `<h3 style="font-size:14px;margin:14px 0 6px">Бажані навички</h3><ul>${v.niceToHave.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Досвід та освіта</h3>
    <p>${esc(experienceText(v))}${v.education ? " · " + esc(v.education) : ""}</p>
    ${(v.tools || []).length ? `<h3 style="font-size:14px;margin:14px 0 6px">Інструменти</h3><p>${v.tools.map(esc).join(", ")}</p>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Мови</h3>
    <p>${(v.languages || []).map(esc).join(", ")}</p>
    ${(v.benefits || []).length ? `<h3 style="font-size:14px;margin:14px 0 6px">Соціальний пакет і переваги</h3><ul>${v.benefits.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    ${sourceNote}
  </div>
  `;

  const apply = document.getElementById("apply-panel");
  apply.innerHTML = `
    <div class="panel">
      <div class="deadline">Вакансія активна до: <b>${v.expiresAt || "не вказано"}</b>${dl !== null ? ` (${dl > 0 ? dl + " дн." : "минуло"})` : ""}</div>
      ${v.direct
        ? (v.contactEmail
            ? `<a class="btn btn-primary btn-block" href="mailto:${esc(v.contactEmail)}?subject=${encodeURIComponent("Відгук на вакансію: " + v.title)}">Написати на ${esc(v.contactEmail)}</a>`
            : `<p style="color:var(--muted);font-size:13px">Контакти роботодавця не вказано.</p>`)
        : `<a class="btn btn-primary btn-block" href="${esc(safeUrl(source?.url || v.sourceUrl))}" target="_blank" rel="noopener">Перейти до оригіналу →</a>`}
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
  const companySite = (c.site || "").replace(/^https?:\/\//, "");
  const logo = cp && cp.logoDataUrl
    ? `<img src="${cp.logoDataUrl}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;flex:none" />`
    : `<div class="jc-logo" style="background:${esc(c.color)};width:56px;height:56px">${esc(c.letter)}</div>`;
  document.getElementById("company-hero").innerHTML = `
    ${logo}
    <div>
      <h1>${esc(c.name)}</h1>
      <div class="jc-company">${esc(c.industry)} · ${esc(c.city)} · <a href="${esc(safeUrl("https://" + companySite))}" target="_blank" rel="noopener">${esc(companySite)}</a></div>
    </div>`;
  document.getElementById("company-desc").textContent = c.desc;
  const open = VACANCIES.filter((v) => v.companyId === c.id && v.active)
    .concat(cp ? getMyVacancies().filter((v) => v.status === "active") : []);
  document.getElementById("company-vacancies").innerHTML = open.length
    ? open.map(jobCardHtml).join("")
    : '<div class="empty-state">Наразі немає активних вакансій цієї компанії.</div>';
}

/* ---------------- Автентифікація роботодавця (тестовий локальний режим) ---------------- */

function isAuthed() { return lsGet(LS.authed, false); }
function setAuthed(v) { lsSet(LS.authed, v); }

// Тільки реєстрація (не вхід) відкриває доступ до кабінету й додавання
// вакансій — без попередньої реєстрації в цьому браузері вхід блокується.
function isEmployerRegistered() { return lsGet(LS.employerRegistered, false); }
function setEmployerRegistered(v) { lsSet(LS.employerRegistered, v); }

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
