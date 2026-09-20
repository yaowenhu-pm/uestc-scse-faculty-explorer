export const GRADES = ["S", "A", "B", "C", "D", "E"];
export const SUBGRADES = GRADES.flatMap(grade => [grade + "+", grade, grade + "-"]);
export const SUBGRADE_VERSION = "subgrades-v2";
export const SUBGRADE_BANDS = {
  S: { middle: 85, plus: 90 },
  A: { middle: 65, plus: 75 },
  B: { middle: 45, plus: 55 },
  C: { middle: 20, plus: 30 },
  D: { middle: 5, plus: 10 },
  E: { middle: 5, plus: 10 },
};

// Apply only after the evidence gate has determined the base grade.
export function subgradeFor(grade, score) {
  if (!GRADES.includes(grade)) return "";
  const bands = SUBGRADE_BANDS[grade];
  if (!bands || !Number.isFinite(score)) return grade;
  return score >= bands.plus ? grade + "+" : score >= bands.middle ? grade : grade + "-";
}

export const displayGrade = grade => String(grade).replace(/-$/, "−");
export const subgradeOf = item => subgradeFor(item.evidenceGrade, item.evidenceScore);
export const GRADE_FILTER_OPTIONS = GRADES.flatMap(grade => SUBGRADE_BANDS[grade] ? [
  { value: grade, label: `${grade} 级全部` },
  { value: grade + "+", label: grade + "+" },
  { value: "exact:" + grade, label: `${grade}（中档）` },
  { value: grade + "-", label: grade + "−" },
] : [{ value: grade, label: `${grade} 级` }]);
export const gradeFilterLabel = value => GRADE_FILTER_OPTIONS.find(option => option.value === value)?.label || "";
export const validGradeFilter = value => GRADE_FILTER_OPTIONS.some(option => option.value === value);
export function matchesGrade(item, filter) {
  if (!filter) return true;
  if (GRADES.includes(filter)) return item.evidenceGrade === filter;
  return validGradeFilter(filter) && subgradeOf(item) === filter.replace(/^exact:/, "");
}
