# GitHub — remoto principal

## Intención

- Copia de trabajo: este directorio (`~/Documentos/axonbim-web`)
- Remoto principal: `origin` → GitHub repo `axonbim-web`

## Estado

- Remoto `origin`: https://github.com/hfiguereo/axonbim-web
- CLI local (si se instaló): `~/.local/bin/gh`
- Visibilidad: **público** (2026-08-08)
- Branch protection en `main`: sin force-push, sin borrado, `enforce_admins`; **sin checks requeridos**
- Guardia fast-forward: `pnpm check:history` en CI (`scripts/check-main-fast-forward.mjs`)

### Fase 0 — repo público + branch protection (2026-08-08) · **hecho**

Repo público + branch protection activados con `scripts/setup-github-protection.sh`.
Implicación de licencia: ADR 0007 (propietario, no OSS automático al hacer público).

Cinturón extra en CI: en cada push a `main`, `check:history` falla si el push no es
fast-forward (detecta force-push aunque alguien desactive protection un día).

Reaplicar protection si hace falta:

```bash
./scripts/setup-github-protection.sh
```

### Por qué `main` no exige status checks (2026-08-08)

Al activar protection se pidieron como requeridos los jobs `Typecheck + unit tests` y
`Playwright F8`. Resultado: **todo push directo a `main` quedó rechazado** con
`GH006 … 2 of 2 required status checks are expected`. La causa no es un fallo de CI: los
workflows se disparan **con** el push, así que en el momento en que GitHub evalúa la regla
el commit todavía no tiene ninguna ejecución, y con `enforce_admins` el dueño tampoco
queda exento.

Los checks requeridos asumen flujo de **Pull Request** (empujar a otra rama → CI verde →
merge). Este repo trabaja con push directo a `main` por decisión explícita
(`40-git-and-scope`), así que se **retiraron los checks requeridos** y se conservó lo que
sí protege: nada de force-push, nada de borrar `main`, `enforce_admins`, más
`check:history` en CI. Actions sigue corriendo en cada push: informa, no bloquea.

Si algún día entra un colaborador o se adopta PR, los checks requeridos vuelven a tener
sentido — en la PR, no en el push.

## Crear y publicar el remoto

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Documentos/axonbim-web
gh auth login
gh repo create axonbim-web --private --source=. --remote=origin --push
```

O crear el repo vacío en la web y:

```bash
git remote add origin git@github.com:<usuario>/axonbim-web.git
git push -u origin main
```

## Integración continua (Actions)

Dos workflows independientes, para que un fallo de navegador y un fallo de tipos/tests
se distingan de un vistazo:

| Workflow | Corre | Desde |
|----------|-------|-------|
| `.github/workflows/ci.yml` | `check:shortcuts` → `check:docs` → `check:links` → `check:layers` → `typecheck` → `lint` → `test` → `build` | 2026-08-08 (+ links 2026-08-09) |
| `.github/workflows/e2e.yml` | `pnpm test:e2e` (Playwright F8 o1 + o2) | 2026-08-08 (F8-CI) |

Los tres `check:*` son guardias de reglas: convierten mandatos de `.cursor/rules/` en algo
que **falla** si se incumple. Todos se validaron incumpliéndolos a propósito.

| Guardia | Regla que respalda | Falla si… |
|---------|--------------------|-----------|
| `check:shortcuts` | `30-testing-validation` §3 | hay `.skip` / `.only` / `.todo` / `xit`, `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`, o `--passWithNoTests` |
| `check:docs` | `10-agent-behavior` §10 | un `.md` o `.pdf` rastreado no es alcanzable desde el índice de `AGENTS.md` (se permite **un salto** vía doc índice) |
| `check:links` | F9-E6 / DOC-06 | un enlace Markdown relativo no resuelve a un archivo existente |
| `check:layers` | `00-architecture` §5, `20-typescript-domain` §2 | el dominio importa React / Three / viewer / `@axonbim/web` o usa `localStorage`, `indexedDB`, `navigator`…; o el viewer importa React / Zustand |

`check:layers` **no** vigila los identificadores `window` ni `document`: en este dominio son
sustantivos legítimos (una ventana BIM, el `AxonDocument`), y un guardia con falsos
positivos acaba desactivado. Las librerías DOM sí se detectan por el import.

Excepciones legítimas: añadirlas a la lista `SKIPPED` / `NOT_INDEXED` del script con su
motivo, nunca relajando un patrón.

### Guardia de atajos (`pnpm check:shortcuts`)

`scripts/check-no-test-shortcuts.mjs` recorre los archivos rastreados y **falla** si
encuentra `.skip` / `.only` / `.todo` / `xit`, `@ts-ignore` / `@ts-nocheck` /
`@ts-expect-error`, o `--passWithNoTests`. Convierte la regla «no debilitar pruebas para
pasar CI» en algo que se comprueba solo, en vez de depender de la disciplina del agente.

Se verificó **en negativo**: inyectando un `.skip` en un test y un `@ts-ignore` en código
de app, el guardia sale con código 1 e indica archivo, línea y motivo.

Excepciones legítimas: añadirlas a `SKIPPED` en el script con su motivo, nunca relajando
un patrón. Hoy la única es el propio script, que necesita nombrar lo que busca.

Ambos en `push` y `pull_request` sobre `main`. Actions con runtime Node 24
(`checkout@v5`, `setup-node@v5`, `pnpm/action-setup@v6`); toolchain Node 22, pnpm 10.12.1.

**Por qué `ci.yml` existe (2026-08-08):** hasta esa fecha el único workflow era el de
Playwright, así que «typecheck y tests verdes» era siempre la palabra de quien lo hubiera
corrido en local — nunca verificación independiente. Ahora cada push lo comprueba solo.

Cobertura de `pnpm test`: los **9 paquetes** tienen script de test y al menos un test
(2026-08-08). Ya no hay paquete que reporte verde sin ejecutar nada.

### Lint (`pnpm lint`, desde 2026-08-08)

`eslint.config.mjs`. Alcance **estrecho a propósito**: no repite lo que ya cubren
`tsconfig.base` (variables sin usar), `check:layers` (imports entre capas) ni
`check:shortcuts`. Tampoco usa `recommendedTypeChecked`, que en un código con Three.js
inunda de avisos `unsafe-*` y acaba silenciándose.

Lo que sí vigila, porque ni los tipos ni los tests lo ven: `react-hooks/exhaustive-deps` y
`rules-of-hooks` (hay 15 `useEffect`), promesas sin `await`, `async` usado donde se espera
algo `void`, `any` explícito (regla 20 §1) y `eqeqeq`. Las tres reglas clave se validaron
en negativo. El repo pasó con **0 errores** salvo una inicialización muerta.

Límites conocidos que **no** cubre este CI:

- `scripts/*.mjs` y `eslint.config.mjs` no pasan por `typecheck`: son JavaScript. Los
  guardias se validan ejecutándolos en negativo, no por tipos.
- Ningún control detecta un test que pasa sin comprobar lo que su nombre afirma.

## Política

- Rama por defecto: **`main`**
- No mezclar historial del desktop AxonBIM
- Sin secretos en el repositorio (tokens de GitHub viven en `gh` / `~/.config/gh`, no en el repo)

### Protección frente a ramas accidentales (solo dueño)

Trabajo habitual **solo en `main`**. El agente **no** crea ramas nuevas salvo autorización **explícita en el chat** (p. ej. «autorizo crear la rama X»).

No cuentan como autorización de rama: aprobar un plan/ADR, «continúa», ni el botón de Cursor *create-branch-and-commit*. Ante esa acción de UI, el agente debe **rechazar crear la rama**, avisar, y operar en `main` si también se pidió commit/push.

Regla operativa: `.cursor/rules/40-git-and-scope.mdc`. Primacía del producto sobre el impulso: ADR 0006.

### Evento 2026-08-08 — merge de rama Cursor

- Rama de trabajo `cursor/windows-and-gizmo-cameras` (creada por diff-tab el 2026-08-07) **fusionada en `main`** a petición del dueño.
- Contenido principal: ventanas, gizmo/cámaras/crop (ADR 0014–0016), F5-S, Playwright F8 o1.
- A partir de aquí: **no** abrir más ramas `cursor/…` sin frase explícita; commits y push van a `main`.
- Refuerzo paralelo (sin reglas nuevas): ADR 0006 y gates — validación estricta de factores críticos aunque el dueño apresure.

## Git vs PR (uso diario)

### Flujo de ramas (ADR 0019)

> **Actualizado 2026-08-10 ([ADR 0019](../decisions/0019-kaoru-branch-flow.md)):** se abandona «solo `main`» y se adopta el flujo de ramas de Kaoru (`feat/…`, `fix/…`, PRs). **El agente no crea ramas sin instrucción explícita del dueño.**

Para cambios directos del dueño en `main`, con **git** basta:

1. Cambios locales → `commit`
2. `git push` / `git pull` en `main`

Para trabajo por feature (o antes de tocar `main`): rama `feat/…` + PR (ver abajo). No hace falta PR para un cambio trivial propio en `main`.

### Qué es un PR

Un **PR** (Pull Request) es una petición en GitHub para **meter commits de una rama en otra** (casi siempre hacia `main`), con diff, comentarios y opción de revisión antes del merge.

### Si hay colaborador (o quieres revisar antes de tocar `main`)

1. Trabajar en **otra rama** (no directamente en `main`)
2. `git push` de esa rama
3. Abrir un **PR** hacia `main` (web de GitHub, o terminal con `gh pr create`)
4. Revisar y fusionar (`merge`)

Eso se puede hacer en la **web** o en **tu terminal** con `gh` (ya autenticado fuera del repo). El agente de Cursor puede usar `git` en el proyecto; `gh api` / `gh pr` desde el agente pueden estar limitados por la red del sandbox — en ese caso usar tu terminal o la web.

### Resumen

| Necesitas… | Herramienta |
|------------|-------------|
| Subir/bajar código | `git push` / `git pull` |
| Revisar e integrar rama → `main` | PR (web o `gh`) |
