import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GRADES, rateAssessment, RUBRIC_VERSION, SOURCE_DATE, REVIEW_DATE, verifyQuotes } from "./rating-rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "data");
// A public clone suffices to reproduce ratings. A private source is opt-in.
const sourcePath = process.env.FACULTY_SOURCE ? path.resolve(process.env.FACULTY_SOURCE) : path.join(outputDir, "faculty.public.json");
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const evidence = JSON.parse(await fs.readFile(path.join(outputDir, "rating-evidence.json"), "utf8"));
if (!Array.isArray(source) || source.length !== 189 || evidence.assessments.length !== source.length) throw new Error("要求完整的 189 位教师及逐人评估");
if (evidence.rubricVersion !== RUBRIC_VERSION || evidence.sourceDate !== SOURCE_DATE) throw new Error("证据版本或快照日期不一致");
const byId = new Map(evidence.assessments.map(a => [a.profileId, a]));
if (byId.size !== source.length || new Set(source.map(a => String(a.profileId))).size !== source.length) throw new Error("教师 ID 重复");
const normalizeText = value => String(value || "").replace(/\s+/g, " ").trim();
const redact = (value, max = 500) => normalizeText(value)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[联系方式见官网]")
  .replace(/(?:\+?86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g, "[联系方式见官网]").slice(0, max);
const list = (value, max = 16) => Array.isArray(value) ? value.filter(Boolean).slice(0, max).map(s => redact(s, 600)) : [];
const names = { signal: "研究荣誉", projects: "科研项目", outputs: "代表成果", recent: "近年记录" };
const faculty = [];
for (const record of source) {
  const a = byId.get(String(record.profileId));
  if (!a) throw new Error(`缺少 ${record.profileId} 的评估`);
  if (process.env.FACULTY_PACKETS) verifyQuotes(a, JSON.parse(await fs.readFile(path.join(process.env.FACULTY_PACKETS, `${a.profileId}.json`), "utf8")));
  const directions = list(record.researchDirections);
  const rating = rateAssessment(a, { researchDirections: directions });
  const snippets = Object.entries(names).flatMap(([key, type]) => a[key].evidence.map(e => ({
    type, conclusion: key === "recent" ? `最近可定位科研年份：${a.recent.year}` : a[key].reason,
    excerpt: e.quote, section: e.section, sourceUrl: record.profileUrl,
  })));
  const strong = Object.entries(names).filter(([key]) => ["signal", "projects", "outputs"].includes(key) && a[key].level >= 3).map(([, name]) => name);
  const gateNote = rating.evidenceGrade === "A" && rating.evidenceScore >= 80 ? "研究荣誉证据尚未满足 S 级门槛。" : rating.evidenceGrade === "B" && rating.evidenceScore >= 60 ? "尚未满足 A 级的两项强证据门槛。" : "";
  const verdict = (strong.length ? `${strong.join("、")}达到强证据档。` : rating.ratingBasis.categories ? `已定位 ${rating.ratingBasis.categories} 类具体研究记录。` : "当前快照缺少具体研究记录。") + gateNote + (a.recent.year ? `最近可定位科研年份为 ${a.recent.year}。` : "科研记录时间未明确。");
  faculty.push({
    profileId: String(record.profileId), name: redact(record.name, 60), title: redact(record.title, 80),
    departments: list(record.departments, 5), profileUrl: record.profileUrl, researchDirections: directions,
    focusKeywords: list(record.focusKeywords || record.evaluation?.focusKeywords), ...rating,
    verdict, hardSignals: a.signal.level ? [a.signal.reason] : [], highlights: "",
    limitations: [...new Set([...a.notes, "仅反映 2026-09-01 官网快照；未列出或贡献不明的材料不作高档依据。", ...["signal", "projects", "outputs"].filter(k => a[k].level === 0).map(k => a[k].reason)])],
    evidenceSnippets: snippets, directoryOrder: record.directoryOrder, collectedAt: record.collectedAt,
    reviewStatus: "AI 辅助逐条复核", sourceDate: SOURCE_DATE, ratedAt: REVIEW_DATE,
  });
}
faculty.sort((a, b) => GRADES.indexOf(a.evidenceGrade) - GRADES.indexOf(b.evidenceGrade) || b.evidenceScore - a.evidenceScore || a.directoryOrder - b.directoryOrder);
const statistics = {
  generatedAt: evidence.reviewedAt, sourceCollectedAt: SOURCE_DATE, teacherCount: faculty.length,
  gradeDistribution: Object.fromEntries(GRADES.map(g => [g, faculty.filter(f => f.evidenceGrade === g).length])),
  departmentDistribution: Object.fromEntries([...new Set(faculty.flatMap(f => f.departments.length ? f.departments : ["官网未列出"]))].map(d => [d, faculty.filter(f => f.departments.includes(d) || (d === "官网未列出" && !f.departments.length)).length])),
  reviewDistribution: { "AI 辅助逐条复核": faculty.length }, rubricVersion: RUBRIC_VERSION,
};
for (const [name, content] of Object.entries({ "faculty.public.json": faculty, "statistics.json": statistics, "data-version.json": {
  version: `${REVIEW_DATE}-${RUBRIC_VERSION}`, generatedAt: evidence.reviewedAt, sourceDate: SOURCE_DATE, reviewedAt: REVIEW_DATE,
  source: "电子科技大学计算机科学与工程学院公开教师目录及详情页", sourceUrl: "https://www.scse.uestc.edu.cn/js_sz.jsp?urltype=tree.TreeTempUrl&wbtreeid=1081",
  publicDataPolicy: "allowlist-v1", reviewMethod: "基于既有官网快照的 AI 辅助逐条复核；未重新抓取官网",
} })) await fs.writeFile(path.join(outputDir, name), JSON.stringify(content, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ records: faculty.length, distribution: statistics.gradeDistribution }, null, 2));
