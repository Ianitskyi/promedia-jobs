/* ProMedia Jobs — рендеринг і взаємодія прототипу.
   Усе працює на клієнті: localStorage замінює реальний бекенд і акаунти. */

const LS = {
  savedV: "pmj_saved_vacancies",
  savedR: "pmj_saved_resumes",
  notesV: "pmj_notes_vacancies",
  notesR: "pmj_notes_resumes",
  subsV: "pmj_subscriptions_vacancies",
  subsR: "pmj_subscriptions_resumes",
  applications: "pmj_applications",
  role: "pmj_role", // 'candidate' | 'employer'
};

function lsGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function qs(name) { return new URLSearchParams(location.search).get(name); }

function formatSalary(v) {
  if (v.salaryHidden || (!v.salaryMin && !v.salaryMax)) return "Не вказано";
  if (v.salaryMin && v.salaryMax && v.salaryMin !== v.salaryMax) return `${v.salaryMin.toLocaleString("uk-UA")}–${v.salaryMax.toLocaleString("uk-UA")} ${v.currency}`;
  return `${(v.salaryMax || v.salaryMin).toLocaleString("uk-UA")} ${v.currency}`;
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const d = Math.ceil((new Date(dateStr) - new Date("2026-07-26")) / 86400000);
  return d;
}

function companyName(v) { return v.companyId ? companyOf(v.companyId).name : v.companyName; }
function companyLetter(v) { return v.companyId ? companyOf(v.companyId).letter : (v.companyName || "?")[0]; }
function companyColor(v) { return v.companyId ? companyOf(v.companyId).color : "#7c7c93"; }

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

/* ---------------- Збережені вакансії / резюме ---------------- */

function isSaved(type, id) {
  const key = type === "vacancy" ? LS.savedV : LS.savedR;
  return lsGet(key, []).includes(id);
}
function toggleSaved(type, id, labelSave, labelUnsave) {
  const key = type === "vacancy" ? LS.savedV : LS.savedR;
  const list = lsGet(key, []);
  const idx = list.indexOf(id);
  if (idx >= 0) { list.splice(idx, 1); toast(labelUnsave || "Видалено зі збережених"); }
  else { list.push(id); toast(labelSave || "Збережено"); }
  lsSet(key, list);
  return idx < 0;
}

function bindSaveButtons(root) {
  (root || document).querySelectorAll(".save-btn").forEach((btn) => {
    const type = btn.dataset.type, id = btn.dataset.id;
    if (isSaved(type, id)) btn.classList.add("saved");
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const saved = toggleSaved(type, id, type === "vacancy" ? "Вакансію збережено" : "Резюме збережено", "Прибрано зі збережених");
      btn.classList.toggle("saved", saved);
    });
  });
}

/* ---------------- Картки ---------------- */

function jobCardHtml(v) {
  const dl = daysLeft(v.expiresAt);
  const catLabels = v.categories.slice(0, 2).map(catLabel).join(" · ");
  return `
  <a class="job-card" href="vacancy.html?id=${v.id}">
    ${v.promoted ? '<span class="promo-badge">Просунута вакансія</span>' : ""}
    <div class="jc-top">
      <div class="jc-logo" style="background:${companyColor(v)}">${companyLetter(v)}</div>
      <div>
        <div class="jc-title">${v.title}</div>
        <div class="jc-company">${companyName(v)} · ${v.city}</div>
      </div>
    </div>
    <div class="jc-meta">
      <span class="tag ink">${labelOf(FORMATS, v.format)}</span>
      <span class="tag">${labelOf(EMPLOYMENT_TYPES, v.employmentType)}</span>
      <span class="tag">${labelOf(LEVELS, v.level)}</span>
      ${!v.direct ? `<span class="tag green">${v.source}</span>` : ""}
    </div>
    <div class="jc-salary">${formatSalary(v)}</div>
    <div class="jc-foot">
      <span>${catLabels}</span>
      <span style="display:flex;align-items:center;gap:10px">
        ${dl !== null ? `<span>${dl > 0 ? dl + " дн. до дедлайну" : "дедлайн минув"}</span>` : ""}
        <button class="save-btn" data-type="vacancy" data-id="${v.id}" title="Зберегти" onclick="return false">☆</button>
      </span>
    </div>
  </a>`;
}

function resumeCardHtml(r) {
  const catLabels = r.categories.slice(0, 2).map(catLabel).join(" · ");
  return `
  <a class="resume-card" href="resume.html?id=${r.id}">
    ${r.promoted ? '<span class="promo-badge">Просунуте резюме</span>' : ""}
    <div class="jc-top">
      <div class="jc-logo" style="background:#0d0c5c">${r.name[0]}</div>
      <div>
        <div class="jc-title">${r.name} ${r.visibility === "employers_only" ? "🔒" : ""}</div>
        <div class="jc-company">${r.title} · ${r.city}</div>
      </div>
    </div>
    <div class="jc-meta">
      <span class="tag ink">${labelOf(LEVELS, r.level)}</span>
      <span class="tag">${r.experienceYears} р. досвіду</span>
      ${r.remoteOk ? '<span class="tag green">Дистанційно ОК</span>' : ""}
    </div>
    <div class="jc-salary">${r.expectedSalary ? r.expectedSalary.toLocaleString("uk-UA") + " " + r.currency : "Не вказано"}</div>
    <div class="jc-foot">
      <span>${catLabels}</span>
      <button class="save-btn" data-type="resume" data-id="${r.id}" title="Зберегти" onclick="return false">☆</button>
    </div>
  </a>`;
}

/* ---------------- Каталог вакансій ---------------- */

function initVacanciesFilters(list) {
  const catBox = document.getElementById("f-categories");
  catBox.innerHTML = CATEGORIES.map((c) => `
    <label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
  const fmtBox = document.getElementById("f-format");
  fmtBox.innerHTML = FORMATS.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
  const empBox = document.getElementById("f-employment");
  empBox.innerHTML = EMPLOYMENT_TYPES.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
  const lvlBox = document.getElementById("f-level");
  lvlBox.innerHTML = LEVELS.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");

  const preCat = qs("category");
  if (preCat) {
    const cb = catBox.querySelector(`input[value="${preCat}"]`);
    if (cb) cb.checked = true;
  }

  document.querySelectorAll(".filters-panel input, .filters-panel select").forEach((el) => {
    el.addEventListener("change", () => renderFilteredVacancies(list));
  });
  document.getElementById("f-keyword").addEventListener("input", () => renderFilteredVacancies(list));
  const preQ = qs("q");
  if (preQ) document.getElementById("f-keyword").value = preQ;
  document.getElementById("f-reset").addEventListener("click", () => {
    document.querySelectorAll(".filters-panel input[type=checkbox]").forEach((c) => (c.checked = false));
    document.getElementById("f-keyword").value = "";
    document.getElementById("f-direct").checked = false;
    document.getElementById("f-salary").checked = false;
    renderFilteredVacancies(list);
  });
}

function checkedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map((i) => i.value);
}

function renderFilteredVacancies(list) {
  const kw = (document.getElementById("f-keyword").value || "").toLowerCase();
  const cats = checkedValues("f-categories");
  const fmts = checkedValues("f-format");
  const emps = checkedValues("f-employment");
  const lvls = checkedValues("f-level");
  const directOnly = document.getElementById("f-direct").checked;
  const salaryOnly = document.getElementById("f-salary").checked;

  const filtered = list.filter((v) => {
    if (!v.active) return false;
    if (kw && !(v.title.toLowerCase().includes(kw) || companyName(v).toLowerCase().includes(kw) || v.skills.join(" ").toLowerCase().includes(kw))) return false;
    if (cats.length && !cats.some((c) => v.categories.includes(c))) return false;
    if (fmts.length && !fmts.includes(v.format)) return false;
    if (emps.length && !emps.includes(v.employmentType)) return false;
    if (lvls.length && !lvls.includes(v.level)) return false;
    if (directOnly && !v.direct) return false;
    if (salaryOnly && v.salaryHidden) return false;
    return true;
  });

  filtered.sort((a, b) => (b.promoted - a.promoted) || b.publishedAt.localeCompare(a.publishedAt));

  document.getElementById("result-count").textContent = `Знайдено ${filtered.length} вакансій`;
  document.getElementById("results").innerHTML = filtered.length
    ? filtered.map(jobCardHtml).join("")
    : '<div class="empty-state">Нічого не знайдено. Спробуйте змінити фільтри або зберегти пошук як підписку в кабінеті.</div>';
  bindSaveButtons();
}

function initVacanciesPage() {
  initVacanciesFilters(VACANCIES);
  renderFilteredVacancies(VACANCIES);
}

/* ---------------- Каталог резюме ---------------- */

function initResumesFilters(list) {
  const catBox = document.getElementById("f-categories");
  catBox.innerHTML = CATEGORIES.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");
  const lvlBox = document.getElementById("f-level");
  lvlBox.innerHTML = LEVELS.map((c) => `<label class="filter-check"><input type="checkbox" value="${c.id}"> ${c.label}</label>`).join("");

  document.querySelectorAll(".filters-panel input, .filters-panel select").forEach((el) => {
    el.addEventListener("change", () => renderFilteredResumes(list));
  });
  document.getElementById("f-keyword").addEventListener("input", () => renderFilteredResumes(list));
  document.getElementById("f-reset").addEventListener("click", () => {
    document.querySelectorAll(".filters-panel input[type=checkbox]").forEach((c) => (c.checked = false));
    document.getElementById("f-keyword").value = "";
    document.getElementById("f-remote").checked = false;
    renderFilteredResumes(list);
  });
}

function renderFilteredResumes(list) {
  const kw = (document.getElementById("f-keyword").value || "").toLowerCase();
  const cats = checkedValues("f-categories");
  const lvls = checkedValues("f-level");
  const remoteOnly = document.getElementById("f-remote").checked;

  const filtered = list.filter((r) => {
    if (r.visibility === "hidden") return false;
    if (kw && !(r.title.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw) || r.skills.join(" ").toLowerCase().includes(kw))) return false;
    if (cats.length && !cats.some((c) => r.categories.includes(c))) return false;
    if (lvls.length && !lvls.includes(r.level)) return false;
    if (remoteOnly && !r.remoteOk) return false;
    return true;
  });

  filtered.sort((a, b) => (b.promoted - a.promoted) || b.updatedAt.localeCompare(a.updatedAt));

  document.getElementById("result-count").textContent = `Знайдено ${filtered.length} резюме`;
  document.getElementById("results").innerHTML = filtered.length
    ? filtered.map(resumeCardHtml).join("")
    : '<div class="empty-state">Нічого не знайдено за цими фільтрами.</div>';
  bindSaveButtons();
}

function initResumesPage() {
  initResumesFilters(RESUMES);
  renderFilteredResumes(RESUMES);
}

/* ---------------- Деталі вакансії ---------------- */

function initVacancyDetail() {
  const v = VACANCIES.find((x) => x.id === qs("id"));
  const el = document.getElementById("vacancy-detail");
  if (!v) { el.innerHTML = '<div class="empty-state">Вакансію не знайдено або її публікацію завершено. <a href="vacancies.html">До каталогу вакансій →</a></div>'; return; }
  document.title = `${v.title} — ${companyName(v)} · ProMedia Jobs`;
  const dl = daysLeft(v.expiresAt);
  el.innerHTML = `
  <div class="detail-hero">
    <div class="jc-logo" style="background:${companyColor(v)}">${companyLetter(v)}</div>
    <div>
      <div class="eyebrow" style="margin-bottom:6px">${v.direct ? "Пряма вакансія" : "Імпортовано з " + v.source} ${v.promoted ? " · Просунута вакансія" : ""}</div>
      <h1>${v.title}</h1>
      <a class="company-link" href="${v.companyId ? "company.html?id=" + v.companyId : "#"}">${companyName(v)}</a> · ${v.city}, ${v.country}
    </div>
  </div>
  <div class="jc-meta" style="margin:18px 0">
    <span class="tag ink">${labelOf(FORMATS, v.format)}</span>
    <span class="tag">${labelOf(EMPLOYMENT_TYPES, v.employmentType)}</span>
    <span class="tag">${labelOf(LEVELS, v.level)}</span>
    ${v.categories.map((c) => `<span class="tag">${catLabel(c)}</span>`).join("")}
  </div>
  <div class="panel">
    <h2>Опис вакансії</h2>
    <p><b>Зарплата:</b> ${formatSalary(v)}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Обов'язки</h3>
    <ul>${v.responsibilities.map((r) => `<li>${r}</li>`).join("")}</ul>
    <h3 style="font-size:14px;margin:14px 0 6px">Обов'язкові вимоги</h3>
    <ul>${v.mustHave.map((r) => `<li>${r}</li>`).join("")}</ul>
    ${v.niceToHave.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Бажані навички</h3><ul>${v.niceToHave.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Досвід та освіта</h3>
    <p>${v.experience}${v.education ? " · " + v.education : ""}</p>
    ${v.tools.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Інструменти</h3><p>${v.tools.join(", ")}</p>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Мови</h3>
    <p>${v.languages.join(", ")}</p>
    ${v.benefits.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Переваги</h3><ul>${v.benefits.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
    ${!v.direct ? `<div class="source-note">Ця вакансія імпортована з джерела «${v.source}» у скороченому й нейтралізованому вигляді. Повний текст і подача — за посиланням на оригінал нижче.</div>` : ""}
  </div>
  `;

  const apply = document.getElementById("apply-panel");
  apply.innerHTML = `
    <div class="panel">
      <div class="deadline">Дедлайн подачі: <b>${v.deadline || "не вказано"}</b>${dl !== null ? ` (${dl > 0 ? dl + " дн." : "минув"})` : ""}<br>
      Публікація активна до: <b>${v.expiresAt}</b></div>
      ${v.direct
        ? `<button class="btn btn-primary btn-block" id="apply-btn">Відгукнутися</button>`
        : `<a class="btn btn-primary btn-block" href="${v.sourceUrl}" target="_blank" rel="noopener">Перейти до оригіналу →</a>`}
      <button class="save-btn" data-type="vacancy" data-id="${v.id}" style="margin-top:12px;font-size:22px" onclick="return false">☆ Зберегти вакансію</button>
    </div>`;
  bindSaveButtons(apply);

  const applyBtn = document.getElementById("apply-btn");
  if (applyBtn) applyBtn.addEventListener("click", () => openApplyModal(v));

  renderSynergyForVacancy(v);
}

function openApplyModal(v) {
  const already = lsGet(LS.applications, []).some((a) => a.vacancyId === v.id);
  if (already) { toast("Ви вже відгукнулися на цю вакансію"); return; }
  if (!confirm(`Перед надсиланням: роботодавець «${companyName(v)}» отримає ваше демо-резюме та контактні дані згідно з вашими налаштуваннями видимості.\n\nНадіслати відгук?`)) return;
  const apps = lsGet(LS.applications, []);
  apps.push({ vacancyId: v.id, title: v.title, company: companyName(v), date: "2026-07-26", status: "sent" });
  lsSet(LS.applications, apps);
  toast("Відгук надіслано");
}

function renderSynergyForVacancy(v) {
  const box = document.getElementById("synergy-box");
  if (!box) return;
  const myResume = RESUMES[0]; // демо: показуємо як "моє" перше резюме
  const m = computeMatch(myResume, v);
  if (!m) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <div class="synergy-box">
      <div class="sy-title"><span class="match-badge match-${m.level}">${MATCH_LABELS[m.level]} · ${m.pct}%</span> Синергія — чому ця вакансія може вам підійти</div>
      <p>${m.reasons.map((r) => "• " + r).join("<br>")}</p>
      ${m.gaps.length ? `<p class="sy-gap">Можливі невідповідності: ${m.gaps.join("; ")}</p>` : ""}
    </div>`;
}

/* ---------------- Деталі резюме ---------------- */

function initResumeDetail() {
  const r = RESUMES.find((x) => x.id === qs("id"));
  const el = document.getElementById("resume-detail");
  if (!r) { el.innerHTML = '<div class="empty-state">Резюме не знайдено або приховане кандидатом. <a href="resumes.html">До каталогу резюме →</a></div>'; return; }
  document.title = `${r.name} — ${r.title} · ProMedia Jobs`;
  el.innerHTML = `
  <div class="detail-hero">
    <div class="jc-logo" style="background:#0d0c5c">${r.name[0]}</div>
    <div>
      <div class="eyebrow" style="margin-bottom:6px">${r.visibility === "employers_only" ? "Видно лише зареєстрованим роботодавцям" : "Відкрите резюме"}</div>
      <h1>${r.name} — ${r.title}</h1>
      <span class="company-link">${r.city}, ${r.country}</span>
    </div>
  </div>
  <div class="jc-meta" style="margin:18px 0">
    <span class="tag ink">${labelOf(LEVELS, r.level)}</span>
    <span class="tag">${r.experienceYears} р. досвіду</span>
    <span class="tag">${labelOf(FORMATS, r.desiredFormat)}</span>
    ${r.remoteOk ? '<span class="tag green">Дистанційно ОК</span>' : ""}
    ${r.categories.map((c) => `<span class="tag">${catLabel(c)}</span>`).join("")}
  </div>
  <div class="panel">
    <h2>Професійний профіль</h2>
    <p>${r.profile}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Бажані посади</h3>
    <p>${r.desiredPositions.join(", ")}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Досвід та освіта</h3>
    <p>${r.experienceYears} років досвіду · ${r.education}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Навички</h3>
    <p>${r.skills.join(", ")}</p>
    ${r.tools.length ? `<h3 style="font-size:14px;margin:14px 0 6px">Інструменти</h3><p>${r.tools.join(", ")}</p>` : ""}
    <h3 style="font-size:14px;margin:14px 0 6px">Мови</h3>
    <p>${r.languages.join(", ")}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Очікувана зарплата</h3>
    <p>${r.expectedSalary ? r.expectedSalary.toLocaleString("uk-UA") + " " + r.currency : "Не вказано"}</p>
    <h3 style="font-size:14px;margin:14px 0 6px">Доступність</h3>
    <p>${r.availability}</p>
  </div>`;

  const apply = document.getElementById("apply-panel");
  apply.innerHTML = `
    <div class="panel">
      <p style="font-size:13px;color:var(--muted);margin:0 0 14px">Оновлено: ${r.updatedAt}</p>
      ${r.contactsVisible === "everyone"
        ? `<button class="btn btn-primary btn-block" onclick="toast('Контакти показано (демо): mail@example.com')">Показати контакти</button>`
        : `<button class="btn btn-primary btn-block" onclick="toast('Увійдіть як зареєстрований роботодавець, щоб побачити контакти')">Написати кандидату</button>`}
      <button class="save-btn" data-type="resume" data-id="${r.id}" style="margin-top:12px;font-size:22px" onclick="return false">☆ Зберегти резюме</button>
    </div>`;
  bindSaveButtons(apply);
}

/* ---------------- Компанія ---------------- */

function initCompanyPage() {
  const c = companyOf(qs("id"));
  const el = document.getElementById("company-detail");
  if (!c) { el.innerHTML = '<div class="empty-state">Компанію не знайдено.</div>'; return; }
  document.title = `${c.name} · ProMedia Jobs`;
  document.getElementById("company-hero").innerHTML = `
    <div class="jc-logo" style="background:${c.color}">${c.letter}</div>
    <div>
      <h1>${c.name}</h1>
      <div class="jc-company">${c.industry} · ${c.city} · <a href="https://${c.site}" target="_blank" rel="noopener">${c.site}</a></div>
    </div>`;
  document.getElementById("company-desc").textContent = c.desc;
  const open = VACANCIES.filter((v) => v.companyId === c.id && v.active);
  document.getElementById("company-vacancies").innerHTML = open.length
    ? open.map(jobCardHtml).join("")
    : '<div class="empty-state">Наразі немає активних вакансій цієї компанії.</div>';
  bindSaveButtons();
}

/* ---------------- Нотифікації (mock) ---------------- */

const MOCK_NOTIFICATIONS = [
  { ico: "🧭", title: "Синергія знайшла 2 нові вакансії", text: "На основі вашого резюме «SMM-менеджерка»" },
  { ico: "📬", title: "Нова вакансія за підпискою «SMM/Контент»", text: "SMM-менеджер(ка) — AdHouse Digital" },
  { ico: "⏳", title: "Публікація вакансії завершується за 3 дні", text: "Редактор(-ка) новинного відділу" },
  { ico: "✅", title: "Оплату підтверджено", text: "Просування вакансії на 7 днів" },
];

function initNotifBell() {
  const bell = document.getElementById("notif-bell");
  if (!bell) return;
  const panel = document.getElementById("notif-panel");
  panel.innerHTML = MOCK_NOTIFICATIONS.map((n) => `
    <div class="notif-item"><span class="ni-ico">${n.ico}</span><div><b>${n.title}</b><span>${n.text}</span></div></div>`).join("");
  bell.addEventListener("click", (e) => { e.stopPropagation(); panel.classList.toggle("open"); });
  document.addEventListener("click", () => panel.classList.remove("open"));
}

/* ---------------- Реакція шапки на вибір ролі ---------------- */

function onRoleChange(role) {
  const cabinetLink = document.getElementById("header-cabinet-link");
  if (cabinetLink) {
    cabinetLink.href = role === "employer" ? "employer-cabinet.html" : "candidate-cabinet.html";
    cabinetLink.textContent = role === "employer" ? "Кабінет роботодавця" : role === "candidate" ? "Кабінет кандидата" : "Кабінет";
    cabinetLink.classList.remove("btn-primary", "btn-candidate", "btn-light");
    cabinetLink.classList.add(role === "employer" ? "btn-primary" : role === "candidate" ? "btn-candidate" : "btn-light");
  }
}

/* ---------------- Роль: кандидат чи роботодавець ---------------- */

function getRole() { return lsGet(LS.role, null); }

function setRole(role) {
  lsSet(LS.role, role);
  applyRole(role);
  const path = location.pathname.split("/").pop();
  if (role === "employer" && path === "candidate-cabinet.html") location.href = "employer-cabinet.html";
  if (role === "candidate" && path === "employer-cabinet.html") location.href = "candidate-cabinet.html";
}

function applyRole(role) {
  document.body.dataset.role = role || "";
  document.querySelectorAll("[data-role-section]").forEach((el) => {
    const want = el.dataset.roleSection;
    el.style.display = (want === "both" || want === role || !role) ? "" : "none";
  });
  document.querySelectorAll(".role-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.role === role);
  });
  const gate = document.getElementById("role-gate");
  if (gate) gate.style.display = role ? "none" : "";
  const gateNote = document.getElementById("role-gate-note");
  if (gateNote) gateNote.style.display = role ? "" : "none";
  onRoleChange(role);
}

function initRoleGate() {
  document.querySelectorAll(".role-gate-card").forEach((c) => {
    c.addEventListener("click", () => setRole(c.dataset.role));
  });
  document.querySelectorAll(".role-switch button").forEach((b) => {
    b.addEventListener("click", () => setRole(b.dataset.role));
  });
  applyRole(getRole());
}

/* ---------------- Загальна ініціалізація шапки ---------------- */

function initChrome() {
  initNotifBell();
  bindSaveButtons();
  initRoleGate();
}
document.addEventListener("DOMContentLoaded", initChrome);
