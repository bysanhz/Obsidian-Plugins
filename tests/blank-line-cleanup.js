const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../bysan-style-controller/main.js'), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('const BLANK_LINE_OPTIONS'), source.indexOf('const CONTENT_GEOMETRY_CONTROLS')) + '\nthis.clean = buildParagraphBlankLineChanges;', context);
function clean(text, options, keepBoundaries) {
  const lines = text.split('\n');
  const offset = p => lines.slice(0, p.line).reduce((n, s) => n + s.length + 1, 0) + p.ch;
  for (const c of context.clean(text, options, keepBoundaries).reverse()) text = text.slice(0, offset(c.from)) + c.text + text.slice(offset(c.to));
  return text;
}
const cases = {
  paragraph: 'ordinary text', heading: '# Heading', list: '- item', quote: '> quote',
  code: '```python\na\n\nb\n```', image: '![[picture.png]]',
  table: 'A | B\n--- | ---\na | b', math: '$$\na\n\nb\n$$',
  divider: '***', html: '<div>\na\n\nb\n</div>'
};
const off = Object.fromEntries(Object.keys(cases).map(k => [k, false]));
for (const [type, block] of Object.entries(cases)) {
  const input = 'before\n\n\n' + block + '\n\n\nafter';
  assert.equal(clean(input, {...off, [type]: true}), 'before\n\n' + block + '\n\nafter', type);
  assert.equal(clean(input, off), 'before\n' + block + '\nafter', type);
  assert.equal(clean(clean(input)), clean(input), 'idempotent ' + type);
}
for (const fence of ['~~~', '````']) {
  const input = `a\n\n${fence}\nx\n\ny\n${fence}\n\nb`;
  assert.equal(clean(input), input);
}
assert.equal(clean('text\n\n\n------\n\nnext', off), 'text\n\n------\nnext');
assert.equal(clean('---\na: 1\n\nb: 2\n---\n\ntext', off), '---\na: 1\n\nb: 2\n---\ntext');
assert.equal(clean('first\n\n\nsecond\n\nthird', off, true), 'first\n\nsecond\n\nthird');
assert.equal(clean('text\n\n---\n\nnext', off, true), 'text\n\n---\n\nnext');
assert.equal(clean('a\n\n\n```js\n\nx();\n\n```\n\n\nb', off, true), 'a\n\n```js\n\nx();\n\n```\n\nb');
console.log('Passed: 10 preservation categories, safe paragraph boundaries, idempotence, fences, Setext safety, frontmatter.');
