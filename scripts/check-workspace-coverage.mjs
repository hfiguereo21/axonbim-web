#!/usr/bin/env node
/**
 * Fails when a workspace member escapes the checks that are supposed to cover it.
 *
 * `pnpm -r --if-present test` and `--if-present typecheck` skip, silently, any
 * package that does not declare that script. A new package therefore lands with
 * zero tests and zero typecheck and CI stays green: the suite reports success
 * over the packages it happens to know about, which is not the same as success.
 * Demonstrated, not theorised — a probe package with only a `build` script
 * passed `pnpm test`, `pnpm typecheck` and `pnpm check:layers` at once.
 *
 * The layer guard has the same shape of hole from the other side: `LAYERS` in
 * check-layer-purity.mjs lists the packages it inspects, so a package nobody
 * added to a layer is never checked for domain purity. Only the ADR 0021 pass
 * sweeps `packages/*` wholesale.
 *
 * Both are the same bug: a guard only checks what someone remembered to tell it
 * about. This one closes the loop by deriving the list from the workspace
 * itself.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Scripts every workspace member must declare, and why. */
const REQUIRED_SCRIPTS = {
  test: "sin el, `pnpm -r --if-present test` salta el paquete en silencio",
  typecheck: "sin el, `pnpm -r --if-present typecheck` salta el paquete en silencio",
};

/**
 * Globs de pnpm-workspace.yaml. Se leen del archivo en vez de hardcodearse: si
 * alguien agrega un directorio raiz nuevo, el guard lo sigue solo.
 */
function workspaceGlobs() {
  const yaml = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8");
  const globs = [...yaml.matchAll(/^\s*-\s*["']?([^"'\s]+)["']?\s*$/gm)].map((m) => m[1]);
  if (globs.length === 0) throw new Error("pnpm-workspace.yaml sin globs de packages");
  return globs;
}

/** Solo se soporta un nivel (`apps/*`), que es lo unico que el repo usa. */
function membersFor(glob) {
  const [base, star] = glob.split("/");
  if (star !== "*") throw new Error(`glob no soportado en pnpm-workspace.yaml: ${glob}`);
  const dir = join(ROOT, base);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "package.json")))
    .map((e) => `${base}/${e.name}`);
}

const members = workspaceGlobs().flatMap(membersFor).sort();
if (members.length === 0) {
  console.error("No se encontro ni un miembro del workspace: el guard no verifica nada.");
  process.exit(1);
}

const problems = [];

for (const member of members) {
  const pkg = JSON.parse(readFileSync(join(ROOT, member, "package.json"), "utf8"));
  const scripts = pkg.scripts ?? {};
  for (const [name, why] of Object.entries(REQUIRED_SCRIPTS)) {
    if (!scripts[name]) problems.push(`${member}: no declara el script "${name}" — ${why}`);
  }
}

/**
 * Segunda puerta: todo paquete bajo `packages/` tiene que estar nombrado por
 * alguna capa de check-layer-purity, o su pureza de dominio no se verifica.
 */
const layerSource = readFileSync(join(ROOT, "scripts/check-layer-purity.mjs"), "utf8");
for (const member of members.filter((m) => m.startsWith("packages/"))) {
  const name = member.slice("packages/".length);
  if (!new RegExp(`"${name}"`).test(layerSource)) {
    problems.push(
      `${member}: ninguna capa de check-layer-purity.mjs lo nombra — su pureza no se verifica`,
    );
  }
}

if (problems.length > 0) {
  console.error(`Miembros del workspace fuera de cobertura (${problems.length}):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nAgrega el script que falta, o la capa en check-layer-purity.mjs." +
      " Un paquete sin cobertura deja el CI verde sin haberlo mirado.",
  );
  process.exit(1);
}

// Cinturon: el guard no sirve de nada si el workspace crece por un camino que
// no mira. Si git ve un package.json fuera de los globs, avisa.
const tracked = execFileSync("git", ["ls-files", "-z", "*/package.json", "*/*/package.json"], {
  encoding: "utf8",
}).split("\0").filter(Boolean);
const unknown = tracked.filter((f) => !members.includes(dirname(f)));
if (unknown.length > 0) {
  console.error(`package.json fuera de los globs del workspace (${unknown.length}):\n`);
  for (const f of unknown) console.error(`  ${f}`);
  console.error("\nO entra al workspace, o se documenta por que queda afuera.");
  process.exit(1);
}

console.log(`Cobertura del workspace: ${members.length} miembros con test, typecheck y capa.`);
