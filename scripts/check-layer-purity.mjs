#!/usr/bin/env node
/**
 * Fails when a package imports across a layer boundary the architecture forbids.
 *
 * Rules 00 §5 and 20 §2 say the domain must not reach for React, Three, the DOM
 * or browser storage, and must not couple to the viewer. Until now nothing
 * checked it: the domain happened to be clean, but only by habit (finding D2).
 *
 * Checks module specifiers, which is what the rules literally constrain, plus a
 * short list of browser globals that could never be a domain variable name.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const UI = ["react", "react-dom", "react/jsx-runtime", "zustand"];
/**
 * Deliberately excludes `window` and `document`: in a BIM domain those are real
 * nouns, not browser globals. `commands/windows.ts` legitimately holds
 * `private readonly window: Window` for a BIM window, and `document` means the
 * AxonDocument. Flagging them would produce false positives on correct code, and
 * a guard that cries wolf gets switched off. DOM *libraries* are still caught by
 * the specifier check below.
 */
const BROWSER_GLOBALS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "XMLHttpRequest",
  "requestAnimationFrame",
  "navigator",
];

/**
 * Layers, from pure to impure. `forbidden` lists module prefixes; a specifier
 * matches when it equals the entry or starts with it plus "/".
 */
const LAYERS = [
  {
    name: "dominio",
    packages: [
      "shared",
      "families",
      "model",
      "geometry",
      "commands",
      "tools",
      "persistence",
    ],
    forbidden: [...UI, "three", "@axonbim/viewer", "@axonbim/web"],
    globals: BROWSER_GLOBALS,
    why: "el dominio es TypeScript puro: sin React, Three, DOM ni viewer",
  },
  {
    name: "viewer",
    packages: ["viewer"],
    // Three is the whole point here; React and the store are not.
    forbidden: [...UI, "@axonbim/web"],
    globals: [],
    why: "el viewer es adaptador de Three, no consume React ni el store de sesión",
  },
];

/**
 * ADR 0021 — el motor no conoce al CRM anfitrión. Se aplica a `packages/*`
 * entero, no sólo a viewer y tools: si `model` o `persistence` pudieran
 * importar Kaoru, la promesa de extraer el motor sería falsa y el ADR no se
 * sostendría. `apps/web` queda fuera a propósito: la capa adaptadora vive ahí.
 */
const KAORU = {
  /** Alias de import del front de Kaoru y paquetes de su monorepo. */
  specifiers: [
    "@kaoru",
    "$components",
    "$hooks",
    "$interceptors",
    "$pages",
    "$services",
    "$signals",
    "$sdui",
    "devextreme",
    "devextreme-react",
    "hono",
    "prisma",
    "@prisma/client",
    "pg",
    "postgres",
    "keycloak-js",
  ],
  /** Identidades del CRM. El motor persiste a `.axon`, no a un tenant. */
  identifiers: [
    "company_id",
    "tenant_id",
    "kc_subject",
    "access_id",
    "permission_interface",
  ],
  /** SQL embebido: la lógica del CRM vive en su base de datos, la del motor no. */
  sql: /\b(?:SELECT\s+[\s\S]{1,200}?\sFROM\s|INSERT\s+INTO\s|UPDATE\s+[\w."]+\s+SET\s|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s)/i,
  why: "el motor no depende del CRM: ni auth, ni company_id, ni SQL (ADR 0021)",
};

const SOURCE = /\.(ts|tsx)$/;
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;

/** Remove comments and string/template bodies so globals are not matched in text. */
function stripLiterals(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""');
}

/**
 * Remove comments but KEEP strings: `"company_id"` en un fetch es justamente el
 * acoplamiento que se prohíbe, mientras que un comentario que diga «sin
 * company_id» no lo es. `stripLiterals` no sirve aquí porque borra ambos.
 */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

function matches(specifier, forbiddenEntry) {
  return specifier === forbiddenEntry || specifier.startsWith(`${forbiddenEntry}/`);
}

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
      const code = readFileSync(file, "utf8");

      for (const m of code.matchAll(SPECIFIER)) {
        const hit = layer.forbidden.find((f) => matches(m[1], f));
        if (hit) {
          problems.push(`${file}: importa "${m[1]}" — ${layer.why}`);
        }
      }

      const bare = stripLiterals(code);
      for (const g of layer.globals) {
        // Member access or a call: `window.foo`, `localStorage.getItem(`.
        if (new RegExp(`\\b${g}\\s*(?:\\.|\\[)`).test(bare)) {
          problems.push(`${file}: usa el global de navegador "${g}" — ${layer.why}`);
        }
      }
    }
  }
}

// ADR 0021 — independencia del motor frente al CRM anfitrión.
const engineFiles = tracked.filter((f) => f.startsWith("packages/"));
if (engineFiles.length === 0) {
  problems.push("packages/: no hay fuentes trackeadas — el guard de ADR 0021 no verifica nada");
}
for (const file of engineFiles) {
  const code = readFileSync(file, "utf8");

  for (const m of code.matchAll(SPECIFIER)) {
    const hit = KAORU.specifiers.find((f) => matches(m[1], f));
    if (hit) problems.push(`${file}: importa "${m[1]}" — ${KAORU.why}`);
  }

  const bare = stripComments(code);
  for (const id of KAORU.identifiers) {
    if (new RegExp(`\\b${id}\\b`).test(bare)) {
      problems.push(`${file}: nombra "${id}" — ${KAORU.why}`);
    }
  }
  if (KAORU.sql.test(bare)) {
    problems.push(`${file}: contiene SQL embebido — ${KAORU.why}`);
  }

  // Especificador calculado: `const p = "re" + "act"; await import(p)` evade
  // TODA verificacion de arriba, porque el guard lee texto y el nombre del
  // modulo no existe hasta ejecutarlo. No se puede resolver estaticamente, asi
  // que se prohibe la forma: hoy no hay ni un import dinamico con variable en
  // packages/ — medido, no supuesto — y en un motor puro no hay razon para uno.
  if (/\bimport\s*\(\s*(?!["'`])/.test(bare)) {
    problems.push(
      `${file}: import dinamico con especificador calculado — no es verificable, usa un literal`,
    );
  }
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
