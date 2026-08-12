/**
 * Reglas puras de los guards, sin efectos: patrones, matchers y el escaneo de un
 * archivo. Las consumen los ejecutables (`check-no-test-shortcuts.mjs`,
 * `check-layer-purity.mjs`) y el self-test (`check-guards-fire.mjs`).
 *
 * Vive aparte por una razon concreta: un self-test que reimplementa el escaneo
 * queda verde mientras el guard de verdad esta roto. Importando de aca, el test
 * ejercita el MISMO codigo que corre en CI. Y los ejecutables no pueden
 * importarse desde el test porque su cuerpo corre al importarlos.
 */

// ─── Atajos que hacen pasar un check sin comprobar nada ──────────────────────

export const SHORTCUT_PATTERNS = [
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

/** Motivos que dispara una linea. */
export function scanLine(line) {
  return SHORTCUT_PATTERNS.filter(({ re }) => re.test(line)).map(({ why }) => why);
}

// ─── Fronteras de capa ───────────────────────────────────────────────────────

export const UI = ["react", "react-dom", "react/jsx-runtime", "zustand"];

/**
 * Deliberadamente sin `window` ni `document`: en un dominio BIM son sustantivos
 * reales, no globales del navegador. `commands/windows.ts` tiene un
 * `private readonly window: Window` que es una ventana del edificio, y
 * `document` es el AxonDocument. Marcarlos daria falsos positivos sobre codigo
 * correcto, y un guard que grita termina desactivado. Las *librerias* DOM las
 * sigue cazando el chequeo de especificadores.
 */
export const BROWSER_GLOBALS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "XMLHttpRequest",
  "requestAnimationFrame",
  "navigator",
];

/** Capas, de pura a impura. `forbidden` lista prefijos de modulo. */
export const LAYERS = [
  {
    name: "dominio",
    packages: ["shared", "families", "model", "geometry", "commands", "tools", "persistence"],
    forbidden: [...UI, "three", "@axonbim/viewer", "@axonbim/web"],
    globals: BROWSER_GLOBALS,
    why: "el dominio es TypeScript puro: sin React, Three, DOM ni viewer",
  },
  {
    name: "viewer",
    packages: ["viewer"],
    // Three es la razon de ser de esta capa; React y el store no.
    forbidden: [...UI, "@axonbim/web"],
    globals: [],
    why: "el viewer es adaptador de Three, no consume React ni el store de sesión",
  },
];

/**
 * ADR 0021 — el motor no conoce al CRM anfitrión. Se aplica a `packages/*`
 * entero, no sólo a viewer y tools: si `model` o `persistence` pudieran importar
 * el CRM, la promesa de extraer el motor seria falsa. `apps/web` queda fuera a
 * proposito: la capa adaptadora vive ahi.
 */
export const HOST_CRM = {
  /** Alias de import de su frontend y paquetes de su monorepo. */
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
  identifiers: ["company_id", "tenant_id", "kc_subject", "access_id", "permission_interface"],
  /** SQL embebido: la logica del CRM vive en su base de datos, la del motor no. */
  sql: /\b(?:SELECT\s+[\s\S]{1,200}?\sFROM\s|INSERT\s+INTO\s|UPDATE\s+[\w."]+\s+SET\s|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s)/i,
  why: "el motor no depende del CRM: ni auth, ni company_id, ni SQL (ADR 0021)",
};

export const SOURCE = /\.(ts|tsx)$/;
export const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;

/** Quita comentarios y cuerpos de string para que un global no matchee en texto. */
export function stripLiterals(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""');
}

/**
 * Quita comentarios pero CONSERVA strings: `"company_id"` en un fetch es justo
 * el acoplamiento que se prohibe, mientras que un comentario que diga «sin
 * company_id» no lo es. `stripLiterals` no sirve aqui porque borra ambos.
 */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

export function matches(specifier, forbiddenEntry) {
  return specifier === forbiddenEntry || specifier.startsWith(`${forbiddenEntry}/`);
}

/** Problemas de UNA capa en UN archivo. */
export function layerProblems(file, code, layer) {
  const problems = [];
  for (const m of code.matchAll(SPECIFIER)) {
    const hit = layer.forbidden.find((f) => matches(m[1], f));
    if (hit) problems.push(`${file}: importa "${m[1]}" — ${layer.why}`);
  }
  const bare = stripLiterals(code);
  for (const g of layer.globals) {
    // Acceso a miembro o llamada: `window.foo`, `localStorage.getItem(`.
    if (new RegExp(`\\b${g}\\s*(?:\\.|\\[)`).test(bare)) {
      problems.push(`${file}: usa el global de navegador "${g}" — ${layer.why}`);
    }
  }
  return problems;
}

/** ADR 0021 — acoplamiento al CRM en UN archivo del motor. */
export function engineProblems(file, code) {
  const problems = [];
  for (const m of code.matchAll(SPECIFIER)) {
    const hit = HOST_CRM.specifiers.find((f) => matches(m[1], f));
    if (hit) problems.push(`${file}: importa "${m[1]}" — ${HOST_CRM.why}`);
  }
  const bare = stripComments(code);
  for (const id of HOST_CRM.identifiers) {
    if (new RegExp(`\\b${id}\\b`).test(bare)) {
      problems.push(`${file}: nombra "${id}" — ${HOST_CRM.why}`);
    }
  }
  if (HOST_CRM.sql.test(bare)) {
    problems.push(`${file}: contiene SQL embebido — ${HOST_CRM.why}`);
  }
  // Especificador calculado: `const p = "re" + "act"; await import(p)` evade TODA
  // verificacion de arriba porque el nombre del modulo no existe hasta ejecutarlo.
  // No se resuelve estaticamente, asi que se prohibe la forma: hoy no hay ni uno
  // en packages/ — medido, no supuesto — y un motor puro no necesita ninguno.
  if (/\bimport\s*\(\s*(?!["'`])/.test(bare)) {
    problems.push(
      `${file}: import dinamico con especificador calculado — no es verificable, usa un literal`,
    );
  }
  return problems;
}
