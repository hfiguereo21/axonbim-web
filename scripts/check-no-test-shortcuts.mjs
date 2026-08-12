#!/usr/bin/env node
/**
 * Fails when tracked source uses a shortcut that makes a check pass without
 * actually checking: a disabled or narrowed test, or a silenced type error.
 *
 * The repo rule already forbids weakening tests to get a green run; this makes
 * the rule enforceable instead of aspirational. The scan is repo-wide on purpose
 * (a shortcut in app code is as harmful as one in a test).
 *
 * Los patrones viven en `lib/guard-rules.mjs` para que `check:guards` pueda
 * probarlos sin ejecutar este CLI.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { scanLine, SHORTCUT_PATTERNS } from "./lib/guard-rules.mjs";

const SCANNED = /\.(ts|tsx|mts|cts|js|mjs|cjs|json)$/;
/** Legitimate exceptions. Add here with a reason, never by weakening a pattern. */
const SKIPPED = [
  /^scripts\/lib\/guard-rules\.mjs$/, // define los patrones, asi que los contiene
  /^scripts\/check-guards-fire\.mjs$/, // el self-test alimenta a los guards con las formas prohibidas
];

// Un patron borrado no deja rastro en la salida: sin esto, vaciar la lista
// dejaria el guard "verde" para siempre.
if (SHORTCUT_PATTERNS.length === 0) {
  console.error("SHORTCUT_PATTERNS quedo vacio: el guard no prohibe nada.");
  process.exit(1);
}

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && SCANNED.test(f) && !SKIPPED.some((re) => re.test(f)));

const hits = [];
for (const file of files) {
  try {
    statSync(file);
  } catch {
    continue; // tracked but removed in the working tree
  }
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const why of scanLine(line)) {
      hits.push(`${file}:${i + 1}  ${why}\n    ${line.trim()}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`Atajos encontrados (${hits.length}):\n`);
  console.error(hits.join("\n"));
  console.error(
    "\nSi alguno es legítimo, justifícalo en el chat y añádelo a SKIPPED con su motivo.",
  );
  process.exit(1);
}

console.log(`Sin atajos de test ni supresiones de tipos (${files.length} archivos).`);
