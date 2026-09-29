#!/usr/bin/env node
// =============================================================
//  Cross-platform gate runner (same ordered step list as tools/gate.ps1).
//
//  Usage:
//     node tools/gate.mjs
//     node tools/gate.mjs --skip=lint,test:cache
//     node tools/gate.mjs --list        (show the resolved step list only)
//     node tools/gate.mjs --root=C:\path\to\repo
//       (--root lets a copy of this runner gate ANY checkout, e.g. a merge
//        checkpoint whose tree does not contain tools/ yet)
//
//  Behaviour matches tools/gate.ps1:
//   - steps are restricted to the ones present in Frontend/package.json of the
//     CURRENT tree, so one runner serves every merge checkpoint,
//   - per-step log in .gate-logs/<step>.txt, summary in .gate-logs/summary.txt,
//   - exit 0 = all green, 1 = at least one failure, 2 = abort.
// =============================================================
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const rootArg = argv.find((a) => a.startsWith('--root='));
const rootIdx = argv.indexOf('--root');
const rootValue = rootArg ? rootArg.slice('--root='.length) : (rootIdx >= 0 ? argv[rootIdx + 1] : '');
// --root / --root= lets a copy of this runner gate ANY checkout (e.g. a merge
// checkpoint whose tree does not contain tools/ yet). Default: the repo this file lives in.
const root = rootValue ? path.resolve(rootValue) : path.resolve(here, '..');
const fe = path.join(root, 'Frontend');
const logs = path.join(root, '.gate-logs');

// Ordered gate steps. New waves append their guard at the end.
const STEPS = [
  'lint',
  'test:cache', 'test:denied', 'test:toast',
  'test:weekly', 'test:weekly:report', 'test:weekly:groups', 'test:weekly:history',
  'test:weekly:history:body', 'test:weekly:cards:body',
  'test:weekly:surface', 'test:weekly:body',
  'test:halls:surface', 'test:halls:body', 'test:hatchery:body',
  'test:customer-fields', 'test:customer-detail',
  'test:hatchery-utils', 'test:hatchery-surface', 'test:dashboard-surface',
  'test:dashboard:bookmarks:body',
  'test:hatchery:sms-body',
  'test:chart-dashboard:body',
  'test:weekly:flock-report:body',
  'test:dashboard:sms-status:body',
  'test:chart-dashboard:all:body',
  'test:dashboard:setup-charts:body',
  'audit:size', 'audit:dead-exports', 'audit:surface', 'audit:big-methods',
];

const pkgPath = path.join(fe, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.log(`GATE-ABORT: package.json not found at ${pkgPath}`);
  process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const declared = Object.keys(pkg.scripts || {});

const skipArg = argv.find((a) => a.startsWith('--skip='));
const skip = skipArg ? skipArg.slice('--skip='.length).split(',').map((s) => s.trim()).filter(Boolean) : [];
const listOnly = argv.includes('--list');

fs.mkdirSync(logs, { recursive: true });

const run = [];
for (const step of STEPS) {
  if (skip.includes(step)) { console.log(`GATE-SKIP (requested)   :: ${step}`); continue; }
  if (!declared.includes(step)) { console.log(`GATE-SKIP (not in tree) :: ${step}`); continue; }
  run.push(step);
}

console.log(`GATE-START root=${root} steps=${run.length} of ${STEPS.length}`);
if (listOnly) {
  for (const step of run) console.log(`  ${step}`);
  console.log('GATE-LIST');
  process.exit(0);
}

const summary = [];
let anyFail = false;

for (const step of run) {
  const out = path.join(logs, `${step.replace(/[:]/g, '_')}.txt`);
  const res = spawnSync('npm', ['run', step], {
    cwd: fe,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = `${res.stdout || ''}${res.stderr || ''}`;
  fs.writeFileSync(out, text);

  const pass = (text.match(/^PASS - /gm) || []).length;
  const fail = (text.match(/^FAIL - /gm) || []).length;
  const code = typeof res.status === 'number' ? res.status : 1;
  const green = code === 0 && fail === 0;

  const line = `${step} :: exit=${code} pass=${pass} fail=${fail}`;
  if (!green) { anyFail = true; summary.push(`**${line}**`); } else { summary.push(`  ${line}`); }
  console.log(green ? `  ${line}` : `**${line}**`);
}

fs.writeFileSync(path.join(logs, 'summary.txt'), `${summary.join('\n')}\n`);

if (anyFail) {
  console.log('GATE-FAIL');
  process.exit(1);
}
console.log('GATE-PASS');
process.exit(0);
