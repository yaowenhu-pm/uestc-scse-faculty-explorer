export const RUBRIC_VERSION = "official-evidence-v2";
export const SOURCE_DATE = "2026-09-01";
export const REVIEW_DATE = "2026-09-21";
export const GRADES = ["S", "A", "B", "C", "D", "E"];
export const POINTS = Object.freeze({ signal: [0, 6, 12, 22, 30], projects: [0, 4, 10, 17, 25], outputs: [0, 3, 8, 17, 25] });
export const LABELS = { S: "高强度研究证据", A: "较强研究证据", B: "多项研究证据", C: "具体研究记录", D: "研究线索有限", E: "资料待补充" };

export function validateAssessment(item) {
  if (!item || typeof item.profileId !== "string" || item.reviewed !== true) throw new Error("缺少已复核的教师 ID");
  for (const key of Object.keys(POINTS)) {
    const part = item[key];
    if (!part || !Number.isInteger(part.level) || part.level < 0 || part.level > 4 || !part.reason?.trim() || !Array.isArray(part.evidence)) throw new Error(`${item.profileId}: ${key} 分档无效`);
    if (part.level > 0 && !part.evidence.length) throw new Error(`${item.profileId}: ${key} 缺少原文`);
    for (const e of part.evidence) if (!e.section?.trim() || !e.quote?.trim()) throw new Error(`${item.profileId}: 无效摘录`);
  }
  const year = item.recent?.year;
  if (item.outputs.level === 4) {
    if (!["papers", "research-prize"].includes(item.outputs.qualification)) throw new Error(`${item.profileId}: 成果最高档缺少资格类型`);
    if (item.outputs.qualification === "papers" && new Set(item.outputs.evidence.map(e => e.quote)).size < 3) throw new Error(`${item.profileId}: 成果最高档不足三条独立依据`);
  }
  if (!(year === null || (Number.isInteger(year) && year >= 1900 && year <= 2026)) || !Array.isArray(item.recent?.evidence)) throw new Error(`${item.profileId}: 科研年份无效`);
  if (year !== null && !item.recent.evidence.length) throw new Error(`${item.profileId}: 科研年份缺少依据`);
  for (const e of item.recent.evidence) if (!e.section?.trim() || !e.quote?.trim()) throw new Error(`${item.profileId}: 无效时间摘录`);
  if (!Array.isArray(item.notes) || !item.notes.every(n => typeof n === "string")) throw new Error(`${item.profileId}: 局限说明无效`);
  return item;
}

export function rateAssessment(assessment, { researchDirections = [] } = {}) {
  const a = validateAssessment(assessment);
  const signal = a.signal.level, projects = a.projects.level, outputs = a.outputs.level;
  const categories = Number(signal > 0) + Number(projects > 0) + Number(outputs >= 2);
  const strongCategories = Number(signal >= 3) + Number(projects >= 3) + Number(outputs >= 3);
  const year = a.recent.year;
  const scoreComponents = {
    hardSignal: POINTS.signal[signal], projects: POINTS.projects[projects], publications: POINTS.outputs[outputs],
    recency: year !== null && year >= 2022 ? 10 : year !== null && year >= 2017 ? 5 : 0,
    coverage: categories >= 2 ? 10 : categories === 1 ? 5 : 0,
  };
  const score = Object.values(scoreComponents).reduce((sum, n) => sum + n, 0);
  let grade;
  if (score >= 80 && signal >= 3 && (projects >= 3 || outputs >= 3)) grade = "S";
  else if (score >= 60 && strongCategories >= 2) grade = "A";
  else if (score >= 35 && (projects >= 2 || outputs >= 2)) grade = "B";
  else if (score >= 15 || categories > 0) grade = "C";
  else if (outputs > 0 || researchDirections.some(s => typeof s === "string" && s.trim())) grade = "D";
  else grade = "E";
  return { evidenceGrade: grade, evidenceScore: score, evidenceLabel: LABELS[grade], scoreComponents,
    ratingBasis: { signal, projects, outputs, latestResearchYear: year, categories, strongCategories }, rubricVersion: RUBRIC_VERSION };
}

export function verifyQuotes(assessment, packet) {
  validateAssessment(assessment);
  if (assessment.profileId !== packet.profileId) throw new Error("证据与教师 ID 不匹配");
  for (const key of ["signal", "projects", "outputs", "recent"]) {
    for (const e of assessment[key].evidence) {
      const original = e.section === "summary" ? packet.summary : packet.sections[e.section];
      if (typeof original !== "string" || !original.includes(e.quote)) throw new Error(`${assessment.profileId}: ${key}/${e.section} 摘录无法逐字定位`);
    }
  }
  return true;
}
