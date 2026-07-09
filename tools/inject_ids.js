const fs = require('fs');
const path = '/Users/zana/Documents/MeuTreino/index.html';
const lines = fs.readFileSync(path, 'utf8').split('\n');

let scope = null;              // current WK letter (a/b/c/d) or home template key
const counters = {};           // per-scope counter
const exLine = /^(\s*)\{n:"(.*?)",\s*s:/;   // exercise object line (excludes FOOD_DB which uses , q:)
const wkScope = /^\s*([ABCD]):\{name:/;      // WK day opener
const homeScope = /^  ([a-z][a-z0-9_]*):\{$/;// home template opener (2-space indent, bare {)
const report = [];

const out = lines.map(line => {
  let m;
  if ((m = line.match(wkScope))) { scope = m[1].toLowerCase(); return line; }
  if ((m = line.match(homeScope))) { scope = m[1]; return line; }
  if ((m = line.match(exLine))) {
    if (line.includes('id:"')) return line;            // already has id
    if (!scope) throw new Error('exercise line before any scope: ' + line);
    counters[scope] = (counters[scope] || 0) + 1;
    const id = `${scope}_${counters[scope]}`;
    report.push(`${id}\t${m[2]}`);
    // insert id right after the opening brace: {n:"..."  ->  {id:"x", n:"..."
    return line.replace(/^(\s*)\{n:/, `$1{id:"${id}", n:`);
  }
  return line;
});

fs.writeFileSync(path, out.join('\n'));
console.log('Injected', report.length, 'ids');
console.log(report.join('\n'));
