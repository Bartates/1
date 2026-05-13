const fs = require('fs');
const path = require('path');

const inFile = process.argv[2];
const outFile = process.argv[3];
const encoding = 'utf8';

if (!inFile || !outFile) {
  console.error('Usage: node merge-cspell-words.cjs <cspell-output.txt> <out-tr-words.txt>');
  process.exit(2);
}

if (!fs.existsSync(inFile)) {
  console.error('Input file not found:', inFile);
  process.exit(3);
}

const text = fs.readFileSync(inFile, encoding);
const  regex= /\(([^)]+)\)/g;
const wordsSet = new Set();
let m;
while ((m = regex.exec(text)) !== null) {
  const w = m[1].trim();
  if (w && w.length > 1) wordsSet.add(w);
}

let existing = [];
if (fs.existsSync(outFile)) {
  existing = fs.readFileSync(outFile, encoding).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const w of existing) wordsSet.add(w);
}

const arr = Array.from(wordsSet).sort((a,b)=> a.localeCompare(b, 'tr'));
// backup
try {
  if (fs.existsSync(outFile)) fs.copyFileSync(outFile, outFile + '.bak');
} catch (e) {
  // ignore
}

fs.writeFileSync(outFile, arr.join('\n') + '\n', encoding);
console.log('MERGED_WORDS_COUNT=' + arr.length);
