#!/usr/bin/env node
/**
 * Fails when tracked source uses a shortcut that makes a check pass without
 * actually checking: a disabled or narrowed test, or a silenced type error.
 *
 * The repo rule already forbids weakening tests to get a green run; this makes
 * the rule enforceable instead of aspirational. The scan is repo-wide on purpose
 * (a shortcut in app code is as harmful as one in a test).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  // `\s*` alrededor del punto: `it . skip(` evadia el patron original. Nadie lo
  // escribe por descuido — justamente por eso hay que cazarlo.
  { re: /\b(?:describe|it|test)\s*\.\s*skip\s*\(/, why: "test deshabilitado (.skip)" },
  { re: /\b(?:describe|it|test)\s*\.\s*only\s*\(/, why: "suite reducida a .only" },
  { re: /\b(?:describe|it|test)\s*\.\s*todo\s*\(/, why: "test declarado pero no escrito (.todo)" },
  // Acceso con corchetes: `it["skip"](...)` es lo mismo con otra sintaxis.
  {
    re: /\b(?:describe|it|test)\s*\[\s*["'`](?:skip|only|todo)["'`]\s*\]/,
    why: "test deshabilitado por acceso con corchetes",
  },
  { re: /\b(?:xit|xdescribe)\s*\(/, why: "test deshabilitado (xit/xdescribe)" },
  { re: /@ts-ignore/, why: "error de tipos silenciado (@ts-ignore)" },
  { re: /@ts-nocheck/, why: "archivo excluido del typecheck (@ts-nocheck)" },
  { re: /@ts-expect-error/, why: "error de tipos esperado (@ts-expect-error)" },
  { re: /--passWithNoTests/, why: "paquete que puede reportar verde sin tests" },
];

const SCANNED = /\.(ts|tsx|mts|cts|js|mjs|cjs|json)$/;
/** Legitimate exceptions. Add here with a reason, never by weakening a pattern. */
const SKIPPED = [
  /^scripts\/check-no-test-shortcuts\.mjs$/, // this file names the patterns it looks for
];

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
    for (const { re, why } of PATTERNS) {
      if (re.test(line)) hits.push(`${file}:${i + 1}  ${why}\n    ${line.trim()}`);
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
