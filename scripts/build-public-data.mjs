import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = path.resolve(root, "../tools/uestc-faculty/data/normalized/faculty.json");
const sourcePath = process.env.FACULTY_SOURCE ? path.resolve(process.env.FACULTY_SOURCE) : defaultSource;
const outputDir = path.join(root, "data");

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const redactPublicText = (value, max = 260) => normalizeText(value)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[联系方式见官网]")
  .replace(/(?:\+?86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g, "[联系方式见官网]")
  .slice(0, max)
  .replace(/[；;，,。\s]+$/g, "");
const list = (value, maxItems = 12) => Array.isArray(value) ? value.filter(Boolean).slice(0, maxItems).map((item) => redactPublicText(item, 120)) : [];

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
if (!Array.isArray(source) || source.length !== 189) throw new Error(`公开导出要求 189 位教师，实际 ${source?.length ?? "非法"}`);

const faculty = source.map((record) => {
  const evidences = (record.evaluation?.evidences || [])
    .filter((item) => item.conclusion && item.evidence)
    .slice(0, 4)
    .map((item) => ({
      type: redactPublicText(item.type, 30),
      conclusion: redactPublicText(item.conclusion, 220),
      excerpt: redactPublicText(item.evidence, 240),
      sourceUrl: record.profileUrl,
    }));
  return {
    profileId: String(record.profileId),
    name: redactPublicText(record.name, 60),
    title: redactPublicText(record.title, 80),
    departments: list(record.departments, 5),
    profileUrl: record.profileUrl,
    researchDirections: list(record.researchDirections, 16),
    focusKeywords: list(record.evaluation?.focusKeywords, 16),
    evidenceGrade: record.ranking?.grade,
    evidenceScore: record.ranking?.score,
    evidenceLabel: redactPublicText(record.ranking?.label, 40),
    verdict: redactPublicText(record.ranking?.verdict, 260),
    scoreComponents: {
      hardSignal: record.ranking?.components?.hardSignal ?? 0,
      projects: record.ranking?.components?.projectScore ?? 0,
      publications: record.ranking?.components?.publicationScore ?? 0,
      recognition: record.ranking?.components?.recognitionScore ?? 0,
      training: record.ranking?.components?.trainingScore ?? 0,
    },
    hardSignals: list(record.ranking?.hardSignals, 8),
    highlights: redactPublicText(record.evaluation?.highlights, 320),
    limitations: list(record.ranking?.weaknesses, 5),
    evidenceSnippets: evidences,
    directoryOrder: record.directoryOrder,
    collectedAt: record.collectedAt,
    reviewStatus: record.reviewStatus,
    rubricVersion: record.ranking?.rubricVersion || "official-evidence-v1",
  };
}).sort((a, b) => b.evidenceScore - a.evidenceScore || a.directoryOrder - b.directoryOrder);

const grades = ["S", "A", "B", "C", "D", "E"];
const statistics = {
  generatedAt: new Date().toISOString(),
  sourceCollectedAt: [...new Set(faculty.map((item) => item.collectedAt))].sort().at(-1),
  teacherCount: faculty.length,
  gradeDistribution: Object.fromEntries(grades.map((grade) => [grade, faculty.filter((item) => item.evidenceGrade === grade).length])),
  departmentDistribution: Object.fromEntries([
    ...new Set(faculty.flatMap((item) => item.departments.length ? item.departments : ["官网未列出"])),
  ].map((department) => [department, faculty.filter((item) => item.departments.includes(department) || (department === "官网未列出" && !item.departments.length)).length])),
  reviewDistribution: Object.fromEntries([...new Set(faculty.map((item) => item.reviewStatus))].map((status) => [status, faculty.filter((item) => item.reviewStatus === status).length])),
  rubricVersion: "official-evidence-v1",
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "faculty.public.json"), JSON.stringify(faculty, null, 2), "utf8");
await fs.writeFile(path.join(outputDir, "statistics.json"), JSON.stringify(statistics, null, 2), "utf8");
await fs.writeFile(path.join(outputDir, "data-version.json"), JSON.stringify({
  version: `2026-09-01-${statistics.rubricVersion}`,
  generatedAt: statistics.generatedAt,
  source: "电子科技大学计算机科学与工程学院公开教师目录及详情页",
  sourceUrl: "https://www.scse.uestc.edu.cn/js_sz.jsp?urltype=tree.TreeTempUrl&wbtreeid=1081",
  publicDataPolicy: "allowlist-v1",
}, null, 2), "utf8");
console.log(JSON.stringify({ outputDir, records: faculty.length, distribution: statistics.gradeDistribution }, null, 2));
