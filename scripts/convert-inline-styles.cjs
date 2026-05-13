const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcPath = path.join(projectRoot, 'src', 'pages', 'Settings.tsx');
const cssPath = path.join(projectRoot, 'src', 'pages', 'Settings.module.css');

let content = fs.readFileSync(srcPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

const camelToKebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase();
const unitless = new Set(['opacity','zIndex','fontWeight','lineHeight','flex','flexGrow','flexShrink','order','zoom','WebkitLineClamp']);
let genCount = 0;
const genMap = {};

function makeClassFromObj(obj) {
  const key = JSON.stringify(obj);
  if (genMap[key]) return genMap[key];
  genCount++;
  const className = `gen${genCount}`;
  const lines = [];
  for (const k of Object.keys(obj)) {
    let v = obj[k];
    const prop = camelToKebab(k);
    if (typeof v === 'number') {
      if (unitless.has(k)) lines.push(`  ${prop}: ${v};`);
      else lines.push(`  ${prop}: ${v}px;`);
    } else if (typeof v === 'string') {
      lines.push(`  ${prop}: ${v};`);
    } else if (Array.isArray(v)) {
      lines.push(`  ${prop}: ${v.join(' ')};`);
    }
  }
  const rule = `.${className} {\n${lines.join('\n')}\n}\n`;
  css += '\n' + rule;
  genMap[key] = className;
  return className;
}

// Step 1: simple replacements for references to lbl/inp/btnPrimary
content = content.replace(/style=\{lbl\}/g, 'className={styles.lbl}');
content = content.replace(/style=\{inp\}/g, 'className={styles.inp}');
content = content.replace(/style=\{btnPrimary\}/g, 'className={styles.btnPrimary}');

// Step 2: handle spread usage like style={{ ...btnPrimary, marginTop: 16 }}
content = content.replace(/style=\{\{\s*\.\.\.btnPrimary\s*,([\s\S]*?)\}\}/g, (m, group) => {
  const inner = `{${group}}`;
  try {
    const obj = eval('(' + inner + ')');
    const cls = makeClassFromObj(obj);
    return `className={\`${"${styles.btnPrimary}"} ${"${styles." + cls + "}"}\`}`.replace(/"\$\{styles\.(gen\d+)\}"/g, 'styles.$1').replace(/"\$\{styles\.btnPrimary\}"/g, 'styles.btnPrimary');
  } catch (e) {
    return m; // skip
  }
});

// The above approach produces template strings needing normal JSX form. We'll clean afterwards.
content = content.replace(/className=\{`\$\{styles\.btnPrimary\} \$\{styles\.(gen\d+)\}`\}/g, (m, g1) => {
  return `className={\`${"${styles.btnPrimary}"} ${"${styles." + g1 + "}"}\`}`;
});

// fallback: simpler regex for any remaining pattern we created
content = content.replace(/className=\{`\$\{styles\.btnPrimary\} \$\{styles\.(gen(\d+))\}`\}/g, (m, g1, g2) => {
  return `className={\`${"${styles.btnPrimary}"} ${"${styles." + g2 + "}"}\`}`;
});

// convert template-like artifacts to proper JSX: className={`${styles.btnPrimary} ${styles.genX}`}
content = content.replace(/className=\{`\$\{styles\.btnPrimary\} \$\{styles\.(gen(\d+))\}`\}/g, (m, g1) => {
  const gen = g1;
  return `className={\`${"${styles.btnPrimary}"} ${"${styles." + gen + "}"}\`}`;
});

// Simplify further: the preceding transformations are messy; we'll instead post-process occurrences of the original spread matches
// Re-scan for original pattern and replace with className={`${styles.btnPrimary} ${styles.genX}`}

// Step 3: general static style={{ ... }} replacement
const styleRegex = /style=\{\{([\s\S]*?)\}\}/g;
let match;
const toReplace = [];
while ((match = styleRegex.exec(content)) !== null) {
  const whole = match[0];
  const inner = match[1];
  if (inner.includes('...') || inner.includes('=>') || /\{.*\}/.test(inner)) continue; // skip complex
  try {
    const obj = eval('({' + inner + '})');
    // ensure all values are primitives
    let ok = true;
    for (const v of Object.values(obj)) {
      if (typeof v === 'function' || typeof v === 'object') ok = false;
    }
    if (!ok) continue;
    const cls = makeClassFromObj(obj);
    toReplace.push({whole, cls});
  } catch (e) {
    // skip if eval fails
  }
}
for (const r of toReplace) {
  content = content.replace(r.whole, `className={styles.${r.cls}}`);
}

// Clean up duplicated .btnPrimary earlier: remove first occurrence if it defines only margin-top
css = css.replace(/\.btnPrimary\s*\{\s*margin-top:\s*16px;\s*\}/, '');

fs.writeFileSync(cssPath, css, 'utf8');
fs.writeFileSync(srcPath, content, 'utf8');
console.log('Conversion complete. Generated classes:', Object.values(genMap).length);
console.log('Added classes:', Object.values(genMap).join(', '));
