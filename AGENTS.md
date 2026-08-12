# AGENTS.md — AxonBIM Web

Punto de entrada para agentes de IA. Lee esto antes de cualquier cambio material.

## Cómo trabajar aquí

1. **Lee las reglas activas.** Canónicas en **`CLAUDE.md`** (raíz); `.cursor/rules/*.mdc` es su espejo para Cursor (mandatos cortos).
2. **Lee la documentación de soporte** bajo `docs/` para el dominio que toques. El detalle vive en docs, no en las rules. Política: `docs/product/doc-governance.md`.
3. **No copies ni traduzcas** el desktop Godot/Python. Portar = comportamiento → prueba → invariante → especificación → implementación nueva. Ver `docs/migration/migration-rules.md`.
4. **F5-S cerrado** (2026-08-07). **F8 o1 / F8-CI / o2 aprobados** (2026-08-08) — ver `docs/validation/playwright-f8.md`. No IFC/OCCT/Edit Mode/losas sin auth. Sketch: **SK-wall-profile-v1 cerrado** (Bloques 0–7; `.axon` v2).
5. **No dupliques controles UI** (cinta vs status vs opciones) salvo petición explícita. Ver `docs/ui/interface-base.md` (anti-redundancia).
6. **Ramas:** flujo Kaoru permitido (`feat/…`, PRs), pero **el agente no crea ramas sin frase explícita del usuario** (ante `cursor/…` / diff-tab create-branch no pedido: rechazar y avisar). Detalle: `docs/roadmap/github.md` + regla `40-git-and-scope`.
7. **Primacía del producto** (ADR 0006): «apruebo todo» no salta validación estricta de gates / SoT / evidencia.

## Índice de lectura

| Si vas a… | Lee primero |
|-----------|-------------|
| Entender el producto | `docs/product/vision.md`, `mvp-scope.md`, `non-negotiables.md`, `doc-governance.md` |
| Tocar arquitectura / capas | `docs/architecture/overview.md` + ADR: índice en `docs/decisions/README.md` (**0018** perfil muro) |
| Modelo / IDs / `.axon` | `docs/architecture/document-model.md` |
| Coordenadas / tolerancias / Projection Basis | `docs/architecture/coordinate-system.md` (LR3-D) |
| Geometría | `docs/architecture/geometry-policy.md`; OCCT parked: ADR 0013 |
| Paradigmas edición / workplanes | `docs/architecture/editing-paradigms.md`, `docs/roadmap/workplanes-roadmap.md` (**WP-v2 + SK-profile**; losas/Edit Mode con auth) |
| Contorno sketch (resultado ≠ eje) | **`docs/architecture/sketch-result-outline.md`** · perfil vertical: **ADR 0018** / `docs/validation/sk-wall-profile-*` |
| Comandos / historial | `docs/architecture/commands-and-history.md` |
| Invariantes: dominio vs UI | ADR 0017 + `docs/roadmap/domain-invariants-plan.md` (**F9-E cerrada** E1–E6) |
| **Plan maestro (fuente fundacional)** | **`docs/migration/plan-maestro-resumen.md`** → completo en `docs/migration/plan-maestro-axonbim-web.pdf` |
| **Integración selectiva legado (LR)** | **`docs/migration/plan-integracion-selectiva-resumen.md`** → PDF; cola **`docs/roadmap/legacy-reuse-roadmap.md`** |
| Legado desktop | `docs/migration/legacy-inventory.md`, `migration-rules.md` |
| Validar / auditoría | `docs/validation/acceptance-matrix.md`, `acceptance-matrix-post-mvp.md`, `technical-audit-2026-08.md`, `playwright-f8.md`, `navigation-3d-checklist.md` |
| **Auditoría externa 2026-08-08** | **`docs/validation/external-audit-2026-08-08.md`** (P0/P1 de integridad) |
| **SK wall profile (paquete 2026-08-10)** | **`docs/validation/sk-wall-profile-report-2026-08-10/`** · B0: `sk-wall-profile-bloque0-2026-08-10.md` · B5 checklist: `sk-wall-profile-bloque5-checklist-2026-08-10.md` · UX A/B: `sk-ux-ab-checklist-2026-08-10.md` · ADR **0018** |
| UI / layout | `docs/ui/interface-base.md`, `reference-shell-baseline.md`, `axonbim-shell-v0.md` |
| Fase / gates | `docs/roadmap/work-phases.md`, `gates.md`, **`f5-stabilization.md`** |
| **Pendientes y prioridad (hilo único)** | **`docs/roadmap/pending-work.md`** (avance = línea LR) |
| Refactor session/viewer | `docs/roadmap/refactor-session-viewer.md` |
| Remoto GitHub / git vs PR | `docs/roadmap/github.md` |
| Navegación 3D / gizmo | ADR 0014, `docs/validation/navigation-3d-checklist.md` |
| Cámaras geométricas | ADR 0015 |
| Región de recorte de vista | ADR 0016 |

## Prohibiciones

- Inventar APIs, valores normativos o comportamiento “porque el desktop lo tenía documentado”.
- Añadir IFC, DXF, OpenCascade, PWA, OPFS o paquetes fuera del alcance autorizado.
- Mutar el documento desde React o Three.js.
- Introducir JSON-RPC interno entre UI y dominio.
- Expansión silenciosa: terminar la tarea, proponer mejoras aparte, esperar autorización.
- Borrar o debilitar pruebas para hacer pasar CI.
- Recrear decisiones documentadas sin demostrar que el contrato vigente es insuficiente.
- Que el agente cree ramas sin frase explícita del usuario (el flujo de ramas lo dispara el humano, no la IA).

## Comandos

```bash
pnpm install
pnpm dev          # apps/web → http://localhost:5173
pnpm build
pnpm test
pnpm typecheck
```

## Paradas obligatorias

Tras F0, F1, Etapa 0, Etapa 1, MVP y F5-S: detenerse para evaluación humana. Ver `docs/roadmap/gates.md`. Playwright y expansiones parked requieren autorización nueva.

**Cola de trabajo:** lo abierto y su prioridad viven en **`docs/roadmap/pending-work.md`** — consultar antes de proponer la «siguiente tarea».
