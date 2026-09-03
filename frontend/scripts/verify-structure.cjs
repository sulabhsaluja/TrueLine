#!/usr/bin/env node
/**
 * Dependency-free structural verification.
 *
 * The project's real toolchain (vite/rolldown, oxlint, vitest) ships native
 * binaries that were installed for win32-x64 and cannot execute in this Linux
 * VM, and the npm registry is blocked by policy, so the genuine build cannot be
 * run here. These checks are a substitute for the classes of defect that a
 * build would have caught, not a replacement for the build itself.
 *
 * Checks:
 *   1. CSS  — brace balance, and declarations stranded outside any block
 *   2. JS   — brace/paren/bracket balance
 *   3. JSX  — element open/close pairing
 *   4. imports — relative targets exist, and named imports really are exported
 *   5. tests — the literal strings existing tests assert on still exist
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || '.';
const SRC = path.join(ROOT, 'src');

let failures = 0;
let checks = 0;

function fail(file, msg) {
  failures++;
  console.log(`  FAIL  ${file}\n        ${msg}`);
}
function pass(label) {
  checks++;
  console.log(`  ok    ${label}`);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(SRC);
const jsFiles = files.filter((f) => /\.jsx?$/.test(f) && !f.includes('/tests/'));
const cssFiles = files.filter((f) => f.endsWith('.css'));

/**
 * Strip comments, string/template literals and regex literals, preserving line
 * structure. Regex literals matter: /[",\n\r]/ in export.js contains a bare
 * double quote, and treating it as a string opener throws off every count that
 * follows it.
 */
function scrub(src, { css = false } = {}) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const skipped = src.slice(i, end === -1 ? n : end + 2);
      out += skipped.replace(/[^\n]/g, ' '); // keep line numbers honest
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (!css && c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    // Regex literal: a '/' in a position where a value may begin.
    if (!css && c === '/') {
      const before = out.replace(/\s+$/, '');
      const prev = before[before.length - 1] ?? '';
      // '<' and '>' are deliberately absent: in JSX, '</div>' is far more
      // common than a comparison against a regex literal, and treating the
      // slash in a closing tag as a regex start eats the tag name.
      const valuePosition = prev === '' || '(,=:[!&|?{};+-*%~^'.includes(prev)
        || /\b(return|typeof|case|in|of|do|else)$/.test(before);
      if (valuePosition) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) { closed = true; j++; break; }
          j++;
        }
        if (closed) {
          while (j < n && /[gimsuyd]/.test(src[j])) j++; // flags
          out += 'RE';
          i = j;
          continue;
        }
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        // Template expressions carry real code — keep them.
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1;
          i += 2;
          const start = i;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
          }
          out += scrub(src.slice(start, i - 1));
          continue;
        }
        i++;
      }
      out += '""';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

console.log('\n1. CSS structure');
for (const file of cssFiles) {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, 'utf8');
  const src = scrub(raw, { css: true });

  let depth = 0;
  let ok = true;
  const lines = src.split('\n');

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    const trimmed = line.trim();

    // A declaration at depth 0 is orphaned — the symptom of a botched edit.
    // A one-line rule such as `a:hover { color: … }` has the same prop:value;
    // shape, so require that no block opens before the semicolon.
    const declLike = /^[-a-zA-Z]+\s*:\s*([^;{]+);/.exec(trimmed);
    if (depth === 0 && declLike && !trimmed.startsWith('@')) {
      fail(rel, `line ${ln + 1}: declaration outside any block — "${trimmed}"`);
      ok = false;
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth < 0) {
        fail(rel, `line ${ln + 1}: unbalanced closing brace`);
        ok = false;
        depth = 0;
      }
    }
  }
  if (depth !== 0) {
    fail(rel, `${depth} unclosed block(s) at end of file`);
    ok = false;
  }
  if (ok) pass(`${rel} — braces balanced, no stranded declarations`);
}

console.log('\n2. JS/JSX delimiter balance');
for (const file of jsFiles) {
  const rel = path.relative(ROOT, file);
  const src = scrub(fs.readFileSync(file, 'utf8'));
  const counts = { '{': 0, '(': 0, '[': 0 };
  const pairs = { '}': '{', ')': '(', ']': '[' };
  let ok = true;
  for (const ch of src) {
    if (counts[ch] !== undefined) counts[ch]++;
    else if (pairs[ch]) {
      counts[pairs[ch]]--;
      if (counts[pairs[ch]] < 0) { fail(rel, `unbalanced "${ch}"`); ok = false; break; }
    }
  }
  if (ok) {
    for (const [open, count] of Object.entries(counts)) {
      if (count !== 0) { fail(rel, `${count} unclosed "${open}"`); ok = false; }
    }
  }
  if (ok) pass(`${rel} — delimiters balanced`);
}

console.log('\n3. JSX element pairing');
/**
 * Scan tags by walking to the matching '>' while tracking {} () [] depth, so a
 * '>' belonging to an arrow function inside an attribute does not look like the
 * end of the tag. Runs on scrubbed source so prose in comments — this project
 * has a JSDoc block that discusses <ol> and <li> — is not mistaken for markup.
 */
function scanJsxTags(src) {
  const tags = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    if (src[i] !== '<') { i++; continue; }
    const m = /^<(\/?)([A-Za-z][\w.]*)/.exec(src.slice(i, i + 64));
    if (!m) { i++; continue; }

    let j = i + m[0].length;
    let depth = 0;
    let end = -1;
    while (j < n) {
      const ch = src[j];
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') depth--;
      else if (ch === '>' && depth === 0) { end = j; break; }
      j++;
    }
    if (end === -1) break;

    const body = src.slice(i, end);
    tags.push({
      closing: m[1] === '/',
      name: m[2],
      selfClosing: body.trimEnd().endsWith('/'),
      line: src.slice(0, i).split('\n').length,
    });
    i = end + 1;
  }
  return tags;
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area']);

for (const file of jsFiles.filter((f) => f.endsWith('.jsx'))) {
  const rel = path.relative(ROOT, file);
  const src = scrub(fs.readFileSync(file, 'utf8'));
  const stack = [];
  let ok = true;

  for (const tag of scanJsxTags(src)) {
    if (tag.selfClosing) continue;
    if (tag.closing) {
      const top = stack.pop();
      if (top !== tag.name) {
        fail(rel, `line ${tag.line}: </${tag.name}> closes <${top ?? 'nothing'}>`);
        ok = false;
        break;
      }
    } else {
      // A void element written without a slash is a JSX error worth reporting.
      if (VOID_TAGS.has(tag.name)) {
        fail(rel, `line ${tag.line}: <${tag.name}> must be self-closing in JSX`);
        ok = false;
        continue;
      }
      stack.push(tag.name);
    }
  }
  if (ok && stack.length) { fail(rel, `unclosed JSX: <${stack.join('>, <')}>`); ok = false; }
  if (ok) pass(`${rel} — JSX elements paired`);
}

console.log('\n4. Import resolution and named exports');
for (const file of files.filter((f) => /\.jsx?$/.test(f))) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, 'utf8');
  const importRe = /import\s+(?:([\w*\s{},$]+?)\s+from\s+)?['"](\.[^'"]+)['"]/g;
  let m;
  let ok = true;

  while ((m = importRe.exec(src)) !== null) {
    const [, clause, spec] = m;
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')];
    const target = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());

    if (!target) { fail(rel, `cannot resolve import "${spec}"`); ok = false; continue; }
    if (!clause || target.endsWith('.css')) continue;

    const named = clause.match(/\{([^}]*)\}/);
    if (!named) continue;

    const targetSrc = fs.readFileSync(target, 'utf8');
    for (const rawName of named[1].split(',')) {
      const name = rawName.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      const exported =
        new RegExp(`export\\s+(?:const|let|var|function|class|async function)\\s+${name}\\b`).test(targetSrc) ||
        new RegExp(`export\\s*\\{[^}]*\\b${name}\\b`).test(targetSrc);
      if (!exported) {
        fail(rel, `"${name}" is not exported by ${path.relative(ROOT, target)}`);
        ok = false;
      }
    }
  }
  if (ok) pass(`${rel} — imports resolve`);
}

console.log('\n5. Strings the existing tests assert on');
const testDir = path.join(SRC, 'tests');
if (fs.existsSync(testDir)) {
  const REQUIRED = {
    'components/AuditTable.jsx': ['Time', 'Rule', 'Group Key'],
    'components/UploadDropzone.jsx': [
      'Drag and drop your 3 CSV files here', 'Bank', 'Ledger', 'Gateway',
    ],
  };
  for (const [rel, strings] of Object.entries(REQUIRED)) {
    const p = path.join(SRC, rel);
    if (!fs.existsSync(p)) { fail(rel, 'file missing'); continue; }
    const src = fs.readFileSync(p, 'utf8');
    const missing = strings.filter((s) => !src.includes(s));
    if (missing.length) fail(rel, `test-asserted string(s) gone: ${missing.join(', ')}`);
    else pass(`${rel} — retains ${strings.length} test-asserted string(s)`);
  }
}

console.log(`\n${'-'.repeat(60)}`);
console.log(failures === 0
  ? `PASS — ${checks} checks, 0 failures`
  : `FAIL — ${failures} failure(s) across ${checks + failures} checks`);
console.log(`${'-'.repeat(60)}\n`);
process.exit(failures === 0 ? 0 : 1);
