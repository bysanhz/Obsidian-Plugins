const assert = require("node:assert/strict");

globalThis.__bysanPdfApi = { Modal: class {} };
const { parsePageRange } = require("../bysan-style-controller/pdf-preview");
delete globalThis.__bysanPdfApi;

for (const [value, expected] of [
  ["all", [1, 2, 3, 4, 5, 6]],
  ["全部", [1, 2, 3, 4, 5, 6]],
  ["２，３", [2, 3]],
  ["2–4，4、5", [2, 3, 4, 5]],
  [" １ 至 ３ , ５ ", [1, 2, 3, 5]],
  ["5,3,3", [3, 5]]
]) {
  const { pages } = parsePageRange(value, 6);
  assert.deepEqual([...pages].sort((a, b) => a - b), expected, value);
}

for (const invalid of ["", "2-", "1,,3", ",", "abc", "1.5", "1;2", "2,"]) {
  assert.equal(parsePageRange(invalid, 6).error, "syntax", invalid);
  assert.equal(parsePageRange(invalid, 6).pages, undefined, invalid);
}
for (const invalid of ["0", "3-2", "7", "2-7", "1-1000000000"]) {
  assert.equal(parsePageRange(invalid, 6).error, "boundary", invalid);
}
console.log("Passed: Unicode page ranges, unique pages, and rejection of invalid output ranges.");
