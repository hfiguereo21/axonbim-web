#!/usr/bin/env node
/**
 * Fails when a package imports across a layer boundary the architecture forbids.
 *
 * Rules 00 §5 and 20 §2 say the domain must not reach for React, Three, the DOM
 * or browser storage, and must not couple to the viewer. Until now nothing
 * checked it: the domain happened to be clean, but only by habit (finding D2).
 *
 * ADR 0021 añade la segunda frontera: `packages/*` no depende de nada del CRM
 * anfitrión — ni auth, ni `company_id`, ni SQL — para que el motor pueda
 * extraerse. `apps/web` queda fuera a propósito: la capa adaptadora vive ahí.
 *
 * Las reglas viven en `lib/guard-rules.mjs` para que `check:guards` las pruebe
 * sin ejecutar este CLI.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { engineProblems, LAYERS, layerProblems, SOURCE } from "./lib/guard-rules.mjs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && SOURCE.test(f));

const problems = [];
let checked = 0;

for (const layer of LAYERS) {
  for (const pkg of layer.packages) {
    const files = tracked.filter((f) => f.startsWith(`packages/${pkg}/`));
    if (files.length === 0) {
      problems.push(`packages/${pkg}: la capa "${layer.name}" lo nombra pero no existe`);
      continue;
    }
    for (const file of files) {
      checked++;
      problems.push(...layerProblems(file, readFileSync(file, "utf8"), layer));
    }
  }
}

// ADR 0021 — independencia del motor frente al CRM anfitrión.
const engineFiles = tracked.filter((f) => f.startsWith("packages/"));
if (engineFiles.length === 0) {
  problems.push("packages/: no hay fuentes trackeadas — el guard de ADR 0021 no verifica nada");
}
for (const file of engineFiles) {
  problems.push(...engineProblems(file, readFileSync(file, "utf8")));
}

if (problems.length > 0) {
  console.error(`Violaciones de capa (${problems.length}):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nSi el cambio es deliberado necesita ADR y autorización" +
      " (docs/architecture/overview.md, reglas 00 y 20).",
  );
  process.exit(1);
}

console.log(
  `Capas respetadas (${checked} archivos de dominio y viewer) e independencia del` +
    ` motor verificada (${engineFiles.length} archivos de packages/, ADR 0021).`,
);
