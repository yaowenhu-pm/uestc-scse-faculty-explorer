import test from "node:test";
import assert from "node:assert/strict";
import { GRADES, SUBGRADES, GRADE_FILTER_OPTIONS, subgradeFor, subgradeOf } from "../grade-bands.js";
import { filteredFaculty, normalizeFilters } from "../faculty.js";

const record = (grade, score) => ({ profileId: grade + score, name: grade + score, evidenceGrade: grade, evidenceScore: score, directoryOrder: 0 });
const records = [record("B", 62), record("A", 60), record("A", 82), record("S", 83), record("B", 35), record("A", 68), record("B", 51)];

test("all six grades use stable inclusive cutoffs within their existing evidence gates", () => {
  for (const [grade, score, expected] of [["A", 60, "A-"], ["A", 64, "A-"], ["A", 65, "A"], ["A", 74, "A"], ["A", 75, "A+"], ["A", 82, "A+"], ["B", 35, "B-"], ["B", 44, "B-"], ["B", 45, "B"], ["B", 54, "B"], ["B", 55, "B+"], ["B", 62, "B+"]]) assert.equal(subgradeFor(grade, score), expected);
  for (const [grade, score, expected] of [["S", 80, "S-"], ["S", 84, "S-"], ["S", 85, "S"], ["S", 89, "S"], ["S", 90, "S+"], ["S", 100, "S+"], ["C", 13, "C-"], ["C", 19, "C-"], ["C", 20, "C"], ["C", 29, "C"], ["C", 30, "C+"], ["D", 0, "D-"], ["D", 4, "D-"], ["D", 5, "D"], ["D", 9, "D"], ["D", 10, "D+"], ["E", 0, "E-"], ["E", 4, "E-"], ["E", 5, "E"], ["E", 9, "E"], ["E", 10, "E+"]]) assert.equal(subgradeFor(grade, score), expected);
});

test("subdivision never promotes a high-scoring B past A or an A past S", () => {
  assert.deepEqual(filteredFaculty(records).map(subgradeOf), ["S-", "A+", "A", "A-", "B+", "B", "B-"]);
  assert.equal(filteredFaculty(records)[3].evidenceScore, 60);
  assert.equal(filteredFaculty(records)[4].evidenceScore, 62);
});

test("legacy A/B filters still select the entire base grade; exact middle is separate", () => {
  assert.deepEqual(filteredFaculty(records, { grade: "A" }).map(subgradeOf), ["A+", "A", "A-"]);
  assert.deepEqual(filteredFaculty(records, { grade: "B" }).map(subgradeOf), ["B+", "B", "B-"]);
  for (const filter of ["A+", "A-", "B+", "B-", "exact:A", "exact:B"]) {
    assert.equal(normalizeFilters(records, { grade: filter }).grade, filter);
    assert.deepEqual(filteredFaculty(records, { grade: filter }).map(subgradeOf), [filter.replace("exact:", "")]);
  }
  assert.equal(normalizeFilters(records, { grade: "F+" }).grade, "");
  assert.equal(normalizeFilters(records, { grade: "exact:Z" }).grade, "");
});

test("all 18 subdivisions sort in order and all six legacy filters aggregate three bands", () => {
  const scores = { S: [90, 85, 80], A: [75, 65, 60], B: [55, 45, 35], C: [30, 20, 13], D: [10, 5, 0], E: [10, 5, 0] };
  const fixtures = GRADES.flatMap(grade => scores[grade].map(score => record(grade, score))).reverse();
  assert.equal(SUBGRADES.length, 18);
  assert.deepEqual(filteredFaculty(fixtures).map(subgradeOf), SUBGRADES);
  assert.equal(GRADE_FILTER_OPTIONS.length, 24);
  assert.equal(new Set(GRADE_FILTER_OPTIONS.map(option => option.value)).size, 24);
  for (const grade of GRADES) {
    assert.deepEqual(filteredFaculty(fixtures, { grade }).map(subgradeOf), [grade + "+", grade, grade + "-"]);
    for (const filter of [grade + "+", "exact:" + grade, grade + "-"]) {
      assert.equal(normalizeFilters(fixtures, { grade: filter }).grade, filter);
      assert.deepEqual(filteredFaculty(fixtures, { grade: filter }).map(subgradeOf), [filter.replace("exact:", "")]);
    }
  }
});

test("empty positive bands stay selectable without assigning different bands to equal scores", () => {
  const fixtures = [record("D", 0), { ...record("D", 0), profileId: "d2" }, record("E", 0)];
  assert.equal(normalizeFilters(fixtures, { grade: "E+" }).grade, "E+");
  assert.deepEqual(filteredFaculty(fixtures, { grade: "E+" }), []);
  assert.deepEqual(filteredFaculty(fixtures, { grade: "D-" }).map(subgradeOf), ["D-", "D-"]);
  assert.deepEqual(filteredFaculty(fixtures, { grade: "E-" }).map(subgradeOf), ["E-"]);
});

test("subgrade filters combine with search and survive URL encoding of plus", () => {
  const encoded = new URLSearchParams({ grade: "B+", search: "B62" });
  assert.ok(encoded.toString().includes("B%2B"));
  const filters = normalizeFilters(records, Object.fromEntries(new URLSearchParams(encoded.toString())));
  assert.deepEqual(filteredFaculty(records, filters).map(item => item.profileId), ["B62"]);
  assert.deepEqual(filteredFaculty(records, { grade: "A+", search: "B62" }), []);
});
