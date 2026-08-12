# ADR 0006 — Cambios de agente controlados

## Estado

Aceptado (reforzado 2026-08-08).

> La fila **«Rama git»** de los factores críticos queda **superseded por [ADR 0019](0019-kaoru-branch-flow.md)** (2026-08-10): se adopta el flujo de ramas de Kaoru; el agente sigue sin crear ramas sin instrucción explícita. El resto de este ADR sigue vigente.

## Contexto

Los agentes tienden a expandir alcance, refactorizar sin pedido y alucinar APIs.  
El dueño en solitario también puede apresurar: «apruebo todo», botones de UI (crear rama, push) o «continúa» sin haber validado lo crítico.

## Decisión

- Alcance explícito por tarea
- Presupuesto orientativo: pocos archivos; docs solo si cambia contrato
- Sin expansión silenciosa ni refactor de riesgo sin plan autorizado (“Sí, autoriza este plan”)
- Evidencia antes de “arreglar” fallos runtime
- Detenerse al cumplir el objetivo y en cada gate de fase
- Reglas Cursor cortas; detalle en `docs/`
- **Primacía del producto:** AxonBIM (contratos, gates, no negociables, ADRs) prevalece **incluso sobre el impulso del dueño**. Una aprobación apresurada o un clic de UI **no** sustituye la validación estricta de factores críticos.

### Factores críticos (validación estricta — ya documentados)

Antes de implementar o de dar por cerrado un tramo de muchas decisiones, el agente **debe** comprobar y, si falta, **detenerse y señalar**:

| Factor | Dónde |
|--------|--------|
| Fuente de verdad / capas | `non-negotiables`, ADR arquitectura |
| Alcance MVP / parked | `mvp-scope`, gates |
| Gate o ADR aplicable | `gates.md`, `docs/decisions/` |
| Evidencia runtime | regla de evidencia; no inventar causa |
| Rama git | flujo Kaoru; el agente no crea ramas sin instrucción explícita — **[ADR 0019](0019-kaoru-branch-flow.md)** (supersede «solo main») |
| Secretos / IFC / OCCT / CI-e2e | prohibiciones vigentes |

No se crean reglas nuevas por cada incidente: se **aplican** estas con más rigor.

## Consecuencias

- `.cursor/rules/` unificadas
- `AGENTS.md` como índice
- Gates en `docs/roadmap/gates.md`
- El agente puede (y debe) decir «no aún» aunque el dueño apresure
