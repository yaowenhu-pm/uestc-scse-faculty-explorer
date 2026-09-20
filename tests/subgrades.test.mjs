import test from "node:test";
import assert from "node:assert/strict";
import { subgradeFor, subgradeOf } from "../grade-bands.js";
import { filteredFaculty, normalizeFilters } from "../faculty.js";

const record = (grade, score) => ({ profileId: grade + score, name: grade + score, evidenceGrade: grade, evidenceScore: score, directoryOrder: 0 });
const records = [record("B", 62), record("A", 60), record("A", 82), record("S", 83), record("B", 35), record("A", 68), record("B", 51)];

test("A/B subdivisions use stable inclusive cutoffs within the existing grade", () => {
  for (const [grade, score, expected] of [["A", 60, "A-"], ["A", 64, "A-"], ["A", 65, "A"], ["A", 74, "A"], ["A", 75, "A+"], ["A", 82, "A+"], ["B", 35, "B-"], ["B", 44, "B-"], ["B", 45, "B"], ["B", 54, "B"], ["B", 55, "B+"], ["B", 62, "B+"]]) assert.equal(subgradeFor(grade, score), expected);
  for (const grade of ["S", "C", "D", "E"]) assert.equal(subgradeFor(grade, 40), grade);
});

test("subdivision never promotes a high-scoring B past A or an A past S", () => {
  assert.deepEqual(filteredFaculty(records).map(subgradeOf), ["S", "A+", "A", "A-", "B+", "B", "B-"]);
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
  assert.equal(normalizeFilters(records, { grade: "S+" }).grade, "");
  assert.equal(normalizeFilters(records, { grade: "exact:C" }).grade, "");
});

test("subgrade filters combine with search and survive URL encoding of plus", () => {
  const encoded = new URLSearchParams({ grade: "B+", search: "B62" });
  assert.ok(encoded.toString().includes("B%2B"));
  const filters = normalizeFilters(records, Object.fromEntries(new URLSearchParams(encoded.toString())));
  assert.deepEqual(filteredFaculty(records, filters).map(item => item.profileId), ["B62"]);
  assert.deepEqual(filteredFaculty(records, { grade: "A+", search: "B62" }), []);
});
