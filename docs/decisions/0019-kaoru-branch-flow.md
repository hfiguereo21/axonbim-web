# ADR 0019 — Flujo de ramas Kaoru (supersede «solo main» de ADR 0006)

## Estado

**Aceptado 2026-08-10.** Supersede la fila **«Rama git»** de la tabla de factores críticos de
[ADR 0006](0006-controlled-agent-changes.md); el resto de 0006 sigue vigente.

## Contexto

La política original era **«solo `main`»** (dueño en solitario): no crear ramas sin frase
explícita, commits y push directos a `main` (ADR 0006, `docs/roadmap/github.md`). Esa regla
mezclaba dos cosas distintas:

1. *No usar ramas* (elección de un repo de un solo autor).
2. *Que el agente no cree ramas por su cuenta* (protección contra improvisación de la IA).

**AxonBIM se integrará a Kaoru CRM**, cuyo flujo de trabajo es **branch-per-feature + PR**
(`feat/…`, `fix/…`, `hotfix/…`, `chore/…`, `docs/…`, `test/…`). Mantener «solo `main`» chocaría
con ese flujo. AxonBIM sigue siendo un proyecto **distinto** que no se desvía de su arquitectura
(ADR 0001–0002, no-negociables), pero **sí** puede adoptar la convención de ramas del monorepo.

## Decisión

1. **Se permite el flujo de ramas de Kaoru:** `feat/…`, `fix/…`, `hotfix/…`, `chore/…`,
   `docs/…`, `test/…` + Pull Requests. Se abandona la restricción «solo `main`».
2. **El agente NO crea ramas sin instrucción explícita del dueño en el chat** (p. ej.
   «crea la rama X»). El flujo de ramas lo dispara **el humano**, no la IA. Se conserva íntegra
   la protección (2) del contexto.
3. Ante una acción de UI que cree rama sin que el usuario lo pidiera (*create-branch*, prefijo
   `cursor/…`): **no crearla**, avisar en una frase, y operar donde indique el usuario.
4. «Continúa», aprobar un plan de producto o autorizar un ADR **no** autoriza al agente a crear
   una rama por cuenta propia.
5. Se mantienen sin cambio los demás factores críticos de ADR 0006 (SoT/capas, alcance MVP,
   gates/ADR, evidencia runtime, secretos/IFC/OCCT) y la **primacía del producto**.

## Consecuencias

- Canónico: `CLAUDE.md` §4 (Git y alcance) refleja esta decisión; `.cursor/rules/40-git-and-scope`
  y `10-agent-behavior` y `AGENTS.md` son su espejo — ya actualizados.
- `docs/roadmap/github.md` (§ «Solo tú, solo `main`») apunta a este ADR.
- La fila «Rama git» de ADR 0006 queda anotada como superseded por este ADR (no se reescribe la
  decisión histórica).
- Versionado y frontera de runtime con Kaoru se tratan aparte (`CLAUDE.md` §6 y §1;
  `.cursor/rules/60-versioning`).

## Fuera de este ADR (auth aparte)

- Integración técnica axonbim↔Kaoru (cómo local-first `.axon` se conecta a un backend con DB):
  toca ADR 0001/0003 y **merece su propio ADR** cuando llegue.
- Reglas Kaoru-específicas (las de su stack y su operación): no aplican a axonbim.

## Referencias

- Supersede (parcial): [ADR 0006](0006-controlled-agent-changes.md)
- Remoto / git vs PR: [`../roadmap/github.md`](../roadmap/github.md)
- Reglas canónicas: `CLAUDE.md` (raíz)
