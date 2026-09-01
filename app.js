const state = { faculty: [], statistics: null, search: "", grade: "", department: "", title: "", sort: "score", visible: 24 };
const $ = (selector) => document.querySelector(selector);
const gradeColors = { S: "#7f172a", A: "#bc252a", B: "#246796", C: "#d2a31d", D: "#718092", E: "#aab3bd" };
const componentLabels = { hardSignal: ["硬信号", 30], projects: ["项目", 20], publications: ["论文成果", 20], recognition: ["荣誉任职", 20], training: ["培养合作", 10] };
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const compactVerdict = (value) => String(value || "").replace(/^[SABCDE]｜[^：]+：/, "");
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");

function initials(name) {
  const clean = String(name || "?").trim();
  return /^[A-Za-z]/.test(clean) ? clean.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : clean.slice(0, 1);
}

function updateUrl() {
  const params = new URLSearchParams();
  for (const key of ["search", "grade", "department", "title", "sort"]) if (state[key] && !(key === "sort" && state[key] === "score")) params.set(key, state[key]);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function filteredFaculty() {
  const needle = normalize(state.search);
  const result = state.faculty.filter((item) => {
    const haystack = normalize([item.name, item.title, ...item.departments, ...item.researchDirections, ...item.focusKeywords, ...item.hardSignals].join(" "));
    return (!needle || haystack.includes(needle))
      && (!state.grade || item.evidenceGrade === state.grade)
      && (!state.department || (state.department === "官网未列出" ? !item.departments.length : item.departments.includes(state.department)))
      && (!state.title || item.title === state.title);
  });
  return result.sort((a, b) => state.sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : state.sort === "directory" ? a.directoryOrder - b.directoryOrder : b.evidenceScore - a.evidenceScore || a.directoryOrder - b.directoryOrder);
}

function renderCard(item) {
  const keywords = [...new Set([...item.researchDirections, ...item.focusKeywords])].slice(0, 5);
  return `<article class="faculty-card" tabindex="0" role="button" aria-label="查看${esc(item.name)}的证据详情" data-id="${esc(item.profileId)}">
    <div class="card-top"><div class="identity"><span class="initial">${esc(initials(item.name))}</span><div><h3>${esc(item.name)}</h3><p>${esc(item.title)} · ${esc(item.departments.join(" / ") || "院系官网未列出")}</p></div></div><b class="badge grade-${esc(item.evidenceGrade)}">${esc(item.evidenceGrade)}</b></div>
    <div class="score-line"><strong>${item.evidenceScore}</strong><span>/ 100 · ${esc(item.evidenceLabel)}</span></div>
    <div class="keywords">${keywords.length ? keywords.map((keyword) => `<span>${esc(keyword)}</span>`).join("") : "<span>官网未列研究方向</span>"}</div>
    <p class="card-verdict">${esc(compactVerdict(item.verdict))}</p>
    <div class="card-footer"><span>${item.hardSignals.length ? `${item.hardSignals.length} 项硬信号` : "无头部硬信号"}</span><b>查看依据 →</b></div>
  </article>`;
}

function renderFaculty() {
  const result = filteredFaculty();
  $("#result-count").textContent = `找到 ${result.length} 位教师`;
  const visible = result.slice(0, state.visible);
  $("#faculty-grid").innerHTML = visible.length ? visible.map(renderCard).join("") : $("#empty-template").innerHTML;
  $("#load-more").hidden = visible.length >= result.length;
  document.querySelectorAll(".faculty-card").forEach((card) => {
    const open = () => openDialog(state.faculty.find((item) => item.profileId === card.dataset.id));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
  updateUrl();
}

function openDialog(item) {
  if (!item) return;
  const components = Object.entries(item.scoreComponents).map(([key, value]) => {
    const [label, max] = componentLabels[key];
    return `<div class="component-row"><span>${label}</span><div class="component-track"><div class="component-fill" style="width:${Math.round(value / max * 100)}%"></div></div><b>${value}/${max}</b></div>`;
  }).join("");
  const evidence = item.evidenceSnippets.length ? item.evidenceSnippets.map((entry) => `<div class="evidence-item"><b>${esc(entry.type)}｜${esc(entry.conclusion)}</b><blockquote>${esc(entry.excerpt)}</blockquote></div>`).join("") : "<p>学院官网公开证据有限，暂无可展示摘录。</p>";
  $("#dialog-content").innerHTML = `<div class="dialog-hero"><div><span class="kicker">OFFICIAL EVIDENCE PROFILE</span><h2 id="dialog-name">${esc(item.name)}</h2><p>${esc(item.title)} · ${esc(item.departments.join(" / ") || "院系官网未列出")}</p></div><div class="dialog-grade grade-${esc(item.evidenceGrade)}">${esc(item.evidenceGrade)}</div></div>
    <div class="dialog-body"><div class="score-line"><strong>${item.evidenceScore}</strong><span>/ 100 · ${esc(item.evidenceLabel)} · ${esc(item.rubricVersion)}</span></div><p>${esc(compactVerdict(item.verdict))}</p>
      <div class="component-list">${components}</div>
      <section class="dialog-section"><h3>研究方向</h3><div class="keywords">${[...new Set([...item.researchDirections, ...item.focusKeywords])].map((keyword) => `<span>${esc(keyword)}</span>`).join("") || "<span>官网未明确列出</span>"}</div></section>
      <section class="dialog-section"><h3>硬核信号</h3>${item.hardSignals.length ? `<ul>${item.hardSignals.map((signal) => `<li>${esc(signal)}</li>`).join("")}</ul>` : "<p>官网未出现可核验的国家级或国际头部门槛信号。</p>"}</section>
      <section class="dialog-section"><h3>主要局限</h3><ul>${item.limitations.map((text) => `<li>${esc(text)}</li>`).join("")}</ul></section>
      <section class="dialog-section"><h3>官网依据摘录</h3>${evidence}</section>
      <div class="dialog-actions"><a class="button primary" href="${esc(item.profileUrl)}" target="_blank" rel="noreferrer">打开教师官网 ↗</a><a class="button secondary" href="./methodology.html">查看评分方法</a></div>
    </div>`;
  $("#faculty-dialog").showModal();
}

function populateFilters() {
  const departments = [...new Set(state.faculty.flatMap((item) => item.departments.length ? item.departments : ["官网未列出"]))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const titles = [...new Set(state.faculty.map((item) => item.title))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  $("#department").insertAdjacentHTML("beforeend", departments.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
  $("#title").insertAdjacentHTML("beforeend", titles.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
}

function renderStats() {
  const stats = state.statistics;
  $("#stat-total").textContent = stats.teacherCount;
  $("#stat-s").textContent = stats.gradeDistribution.S;
  $("#stat-a").textContent = stats.gradeDistribution.A;
  $("#stat-review").textContent = stats.reviewDistribution.incomplete || 0;
  $("#updated-at").textContent = `数据版本 ${stats.rubricVersion}`;
  const max = Math.max(...Object.values(stats.gradeDistribution));
  $("#grade-bars").innerHTML = Object.entries(stats.gradeDistribution).map(([grade, count]) => `<div class="grade-bar"><span>${grade}</span><div class="bar-track"><div class="bar-fill" style="width:${count / max * 100}%;background:${gradeColors[grade]}"></div></div><b>${count}</b></div>`).join("");
}

function bindControls() {
  $("#search").addEventListener("input", (event) => { state.search = event.target.value; state.visible = 24; renderFaculty(); });
  ["department", "title", "sort"].forEach((id) => $("#" + id).addEventListener("change", (event) => { state[id] = event.target.value; state.visible = 24; renderFaculty(); }));
  $("#grade-filter").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-grade]"); if (!button) return;
    state.grade = button.dataset.grade; state.visible = 24;
    document.querySelectorAll("#grade-filter button").forEach((item) => item.classList.toggle("active", item === button)); renderFaculty();
  });
  $("#reset-filters").addEventListener("click", () => {
    Object.assign(state, { search: "", grade: "", department: "", title: "", sort: "score", visible: 24 });
    $("#search").value = ""; $("#department").value = ""; $("#title").value = ""; $("#sort").value = "score";
    document.querySelectorAll("#grade-filter button").forEach((item) => item.classList.toggle("active", item.dataset.grade === "")); renderFaculty();
  });
  $("#load-more").addEventListener("click", () => { state.visible += 24; renderFaculty(); });
  $("#dialog-close").addEventListener("click", () => $("#faculty-dialog").close());
  $("#faculty-dialog").addEventListener("click", (event) => { if (event.target === $("#faculty-dialog")) $("#faculty-dialog").close(); });
}

async function init() {
  const [facultyResponse, statisticsResponse] = await Promise.all([fetch("./data/faculty.public.json"), fetch("./data/statistics.json")]);
  if (!facultyResponse.ok || !statisticsResponse.ok) throw new Error("数据加载失败");
  state.faculty = await facultyResponse.json(); state.statistics = await statisticsResponse.json();
  const params = new URLSearchParams(location.search);
  for (const key of ["search", "grade", "department", "title", "sort"]) if (params.has(key)) state[key] = params.get(key);
  populateFilters(); renderStats(); bindControls();
  $("#search").value = state.search; $("#department").value = state.department; $("#title").value = state.title; $("#sort").value = state.sort;
  document.querySelectorAll("#grade-filter button").forEach((item) => item.classList.toggle("active", item.dataset.grade === state.grade)); renderFaculty();
}

init().catch((error) => { $("#faculty-grid").innerHTML = `<div class="empty-state"><strong>数据加载失败</strong><p>${esc(error.message)}</p></div>`; });
