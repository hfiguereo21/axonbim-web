#!/usr/bin/env node
/**
 * Deriva la versión de producto según ADR 0023: SemVer con gobierno de Kaoru.
 *
 *   MAJOR.MINOR  →  manuales, viven en el archivo VERSION, los mueve el dueño
 *   PATCH        →  derivado de git, nunca almacenado
 *
 * El PATCH cuenta los commits en `main` desde el tag `vMAJOR.MINOR.0`. Con la
 * protección de rama en vigor (PR obligatorio, historia lineal, squash) cada PR
 * fusionado es exactamente un commit, así que el número cuenta cambios
 * integrados — lo mismo que el BUILD del CRM anfitrión cuenta con números de PR.
 *
 * Un número que hay que acordarse de incrementar acaba desincronizado; por eso
 * se deriva y no se guarda. El archivo VERSION sólo lleva `MAJOR.MINOR`.
 *
 *   node scripts/version.mjs            imprime la versión
 *   node scripts/version.mjs --strict   falla si no hay tag de línea base
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_FILE = join(ROOT, "VERSION");
const strict = process.argv.includes("--strict");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(VERSION_FILE)) {
  fail("Falta el archivo VERSION en la raíz. Debe contener `MAJOR.MINOR` (ADR 0023).");
}

const raw = readFileSync(VERSION_FILE, "utf8").trim();
const parsed = /^(\d+)\.(\d+)$/.exec(raw);
if (!parsed) {
  fail(
    `VERSION contiene ${JSON.stringify(raw)} y debe contener sólo \`MAJOR.MINOR\`` +
      " (por ejemplo `0.1`). El PATCH se deriva de git y no se escribe aquí.",
  );
}
const [, major, minor] = parsed;

function git(args, { quiet = false } = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    // El probe del tag falla a proposito cuando no existe: su `fatal:` en
    // stderr no es un error del script y no debe ensuciar la salida.
    stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
  }).trim();
}

const baseline = `v${major}.${minor}.0`;
let hasBaseline = true;
try {
  git(["rev-parse", "--verify", `refs/tags/${baseline}`], { quiet: true });
} catch {
  hasBaseline = false;
}

if (!hasBaseline) {
  // Antes de la primera línea base no hay desde dónde contar. Se informa el
  // estado con metadata de build (`+dev.N`), que SemVer ignora para comparar
  // precedencia: sirve para verlo en pantalla, no para publicar.
  const commits = git(["rev-list", "--count", "HEAD"]);
  const version = `v${major}.${minor}.0+dev.${commits}`;
  if (strict) {
    fail(
      `No existe el tag de línea base ${baseline}: no se puede derivar un PATCH` +
        ` publicable. Estado actual: ${version}. Cortar la línea base requiere` +
        " gate humano (ADR 0023, docs/roadmap/releases.md).",
    );
  }
  console.error(`aviso: sin tag ${baseline}; PATCH no derivable todavía`);
  console.log(version);
  process.exit(0);
}

const patch = git(["rev-list", "--count", `${baseline}..HEAD`]);
console.log(`v${major}.${minor}.${patch}`);
