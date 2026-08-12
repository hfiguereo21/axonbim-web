# CLAUDE.md — AxonBIM Web

Reglas nativas **canónicas** para agentes de IA en este repo. `.cursor/rules/*.mdc` es un **espejo**: al cambiar una regla, edita aquí primero y refleja allá. El detalle de dominio vive en `docs/` (índice al final vía `@AGENTS.md`), no en este archivo.

> **Contexto de integración.** AxonBIM se integrará a un **CRM anfitrión**, pero es un proyecto **distinto** y no se desvía de su propia arquitectura. Lo transversal va en §9. Las reglas propias del anfitrión (su stack y su operación) **NO aplican aquí**.

## 1. Arquitectura e invariantes

- **`AxonDocument` es la única fuente de verdad.** Comandos mutan; vistas representan.
- **React no muta el documento:** orquesta *tools → commands*. **Three.js** es adaptador de mallas/cámaras derivadas, no SoT.
- **Un solo runtime TypeScript. Sin JSON-RPC interno** UI↔dominio.
- **Dominio puro:** `model/commands/geometry` no importan React, Three, DOM ni almacenamiento del navegador.
- **IFC y OpenCascade fuera del MVP** salvo ADR + autorización explícita.
- Prohibido: portar Godot/Python/RPC; inventar una segunda geometría divergente planta/3D.

Lee: `docs/architecture/overview.md`, `docs/product/non-negotiables.md`, `docs/decisions/`.

## 2. Fronteras de capas

- **Dominio** (`model`, `commands`, `geometry`, `persistence`, `shared`): tipado estricto (`any` solo con justificación breve); **sin imports** de React/Three/DOM/`window`/IndexedDB; validación en el borde del comando con errores explícitos; unidades y tolerancias según `coordinate-system.md`; contratos de entidad según `document-model.md`. El comando **siempre revalida** (ADR 0017).
- **React UI:** dispara *tools/commands*, no escribe `walls[]` ni el documento a mano. Zustand solo para **sesión** (herramienta, preview, cámara, paneles). Una función no está terminada si no se puede usar desde la interfaz.
- **Three.js viewer:** meshes/edges se **derivan** del documento vía geometry; picking → IDs → capa tools/commands; cambiar cámara/vista **no** muta el documento; el preview de herramienta es efímero y fuera del historial.

- **Motor vs CRM (ADR 0021):** `packages/*` no depende de nada de Kaoru — ni auth, ni `company_id`/`tenant_id`, ni SQL, ni alias de su front. El motor persiste a `.axon` y debe poder correr sin el CRM; toda la conexión vive en una **capa adaptadora afuera** (`apps/web`). Lo verifica `pnpm check:layers` en CI, no la buena voluntad.

Prohibido: SoT en React state; verdad del edificio en `Object3D.userData`; saltarse el historial "para ir más rápido"; acoplar `packages/*` al CRM.
Lee: `docs/architecture/geometry-policy.md`, `commands-and-history.md`, ADR 0002, ADR 0021.

## 3. Método de trabajo del agente

1. **Lee los docs aplicables** (`AGENTS.md` + `docs/`) antes de cambios materiales. No reinventes contratos documentados.
2. **Alcance explícito, cero expansión silenciosa.** Mejoras → anótalas y pide autorización aparte.
3. **Evidencia antes de arreglar** fallos runtime. No inventes la causa.
4. **Detente al cumplir el objetivo** y en cada *gate* (`docs/roadmap/gates.md`).
5. **Primacía del producto (ADR 0006):** «apruebo todo» / prisa / clic de UI **no** salta la validación de gates/SoT/no-negociables. Puedes y debes decir «no aún».
6. **Cero placeholders** presentados como terminado; **cero APIs inventadas**.
7. Si el pedido contradice arquitectura/MVP, o si código/tests/docs/ADR discrepan, **señálalo antes** de implementar.
8. Documentación permanente nueva/movida/eliminada → **actualiza el índice en `AGENTS.md`** en la misma tarea.

Lee: `docs/decisions/0006-controlled-agent-changes.md`, `docs/product/mvp-scope.md`.

## 4. Git y alcance

- **Ramas:** se permite el flujo de Kaoru (`feat/…`, `fix/…`, `hotfix/…`, `chore/…`, `docs/…`, `test/…`, PRs). **El agente NO crea ramas sin instrucción explícita del dueño en el chat.** Ante una acción de UI que cree rama (*create-branch*, prefijo `cursor/…`): no crearla, avisar, y operar donde indique el usuario.
- **Commits:** mensaje que explique el **porqué**; un tema por commit; pequeños y enfocados. **No incluir `Co-Authored-By: Claude …`** (se firma solo con el autor humano). No `--no-verify`/`--no-gpg-sign` salvo pedido explícito.
- Sin sync destructivo (`force` a main, hard reset) sin pedido explícito.
- Presupuesto: pocos archivos; no tocar no relacionados. Microtareas: terminar, reportar, esperar la siguiente autorización en gates.

Remoto: `docs/roadmap/github.md`.

## 5. 🔐 Secretos y entorno

- El remoto `origin` es **público**. **Cero secretos** en commits, logs o docs.
- `.env` va **ignorado por git y nunca al remoto**; claves RSA/PEM/KEY se generan localmente, no se versionan. (`gitignore.txt` de Kaoru se mantiene local, sin trackear.)
- Ante un secreto a punto de subirse: **detente y avisa** antes de continuar.

## 6. Versionado

- **Producto (ADR 0023):** **SemVer** `vMAJOR.MINOR.PATCH` con el **gobierno de Kaoru** — MAJOR/MINOR manuales del dueño vía PR (viven en `VERSION`, formato `MAJOR.MINOR`); **PATCH derivado de git**: `git rev-list --count vMAJOR.MINOR.0..main`. Antes de 1.0 sin sufijos de prerelease: `0.x` ya significa inestable. Es **excepción documentada** a ADR 0020, que no se extiende a ninguna otra materia. *(Deuda: adaptar `dev:sync-version` a un script pnpm equivalente.)*
- **Datos:** el `.axon formatVersion` (entero monotónico) es **independiente** del anterior y se mantiene: **v2 vigente** (`Wall.vertical`, ADR 0018); los lectores rechazan versiones futuras desconocidas.

## 7. Tests y validación

- Portar **casos e invariantes**, no archivos de test tal cual. Equivalencia = comportamiento + tolerancias (`geometry-policy.md`), no bytes idénticos al desktop.
- **No eliminar ni debilitar pruebas** para ocultar fallos. `pnpm check:shortcuts` (CI) falla ante `.skip/.only/.todo/xit`, `@ts-ignore/@ts-nocheck/@ts-expect-error` y `--passWithNoTests`: no lo esquives; si una excepción es legítima, pídela en el chat.
- Aceptación MVP: `docs/validation/acceptance-matrix.md`. Un criterio de UI **no** está hecho solo porque hay un unit test.

## 8. Docs, migración y legal

- Cambio de contrato/comportamiento → **actualiza el doc en `docs/` en el mismo cambio** (índice `docs/product/doc-governance.md`).
- Legado desktop (Godot/Python): ficha en `legacy-inventory.md`, reglas en `migration-rules.md`. **No copiar código**; portar = comportamiento → prueba → invariante → especificación → implementación TS nueva. Recuperación selectiva por **bloques LR** con auth por bloque (`docs/roadmap/legacy-reuse-roadmap.md`).
- Licencia: **propietaria / All Rights Reserved** (ADR 0007). Estándares abiertos (IFC) ≠ licencia del producto. Sin secretos ni valores normativos inventados.

## 9. Convenciones compartidas con Kaoru CRM

Lo transversal a ambos proyectos (germen del `CLAUDE.md` raíz del futuro monorepo):

- **Comportamiento (guidelines Karpathy):** pensar antes de codear (desglosar el problema, plantear hipótesis, simular); **simplicidad primero** (código mínimo, sin abstracciones especulativas); **cambios quirúrgicos** (tocar solo lo necesario, respetar el estilo existente, no refactorear lo que no está roto); ejecución dirigida a **objetivos verificables** (criterios de éxito → loop hasta cumplir).
- **Commits / tests / docs:** ver §4, §7 y §8 — idénticos en ambos proyectos.
- **Precedencia normativa (ADR 0020):** las normas son **acumulativas** — aquí rigen las de este repo y, adicionalmente, las de Kaoru. Ante contradicción **prevalece la norma preexistente de Kaoru**, y solo en **proceso y gobernanza** (commits, ramas, pruebas, docs, secretos, versionado, promoción de ambientes, conducta del agente). **No alcanza al stack ni a la arquitectura** (§1–§2, ADR 0001–0002, no negociables): eso exige ADR propio. Y **nunca relaja una norma más estricta de axonbim** — p. ej. §5, cuyo remoto es público frente al privado de Kaoru.
- **De Kaoru, sin equivalente previo aquí:** `localhost` es el destino por defecto y **no se propone ni ejecuta despliegue a servidor alguno** sin orden explícita del dueño.

> Lo Kaoru-específico (las de su stack y su operación) **no aplica a axonbim**.

## 10. Deudas abiertas (radar)

No perder de vista: **AX-P2-10** (doble política de tolerancia geométrica), **AX-P2-11** (scene sync global), **SEC-01…04** (hardening de importación `.axon`/red), cobertura **E2E** del camino geométrico/visual real, `plan-maestro-resumen.md` obsoleto (D6). Detalle: `docs/validation/external-audit-2026-08-08.md`.

## Comandos

```bash
pnpm install
pnpm dev          # apps/web → http://localhost:5173
pnpm build
pnpm test
pnpm typecheck
```

## Índice de documentación (verdad de consulta)

El índice maestro de `docs/` vive en `AGENTS.md` y se importa aquí:

@AGENTS.md
