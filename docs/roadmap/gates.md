# Gates — paradas de evaluación

El agente y el desarrollo humano **se detienen** en cada gate. “Continúa con el proyecto” no autoriza saltarse un gate ni refactorizaciones de riesgo.

**Validación estricta de lo crítico:** cuando un tramo acumula muchas decisiones (producto, arquitectura, git, alcance), los factores críticos de ADR 0006 / no negociables **se validan uno a uno** antes de cerrar. Una frase de aprobación global («apruebo todo») o un clic de UI **no** sustituye esa lista. El producto prevalece sobre el impulso del momento.

| Gate | Tras | Pregunta de salida | Siguiente solo si |
|------|------|--------------------|-------------------|
| **G-F0** | Fundación docs + rules | ¿Alcance MVP y rules sin inflación? | Autorias F1 cerrado o Etapa 0 |
| **G-F1** | Contratos de dominio | ¿Coords, documento, comandos, `.axon`, inventario OK? | Autorizas **Etapa 0 (código)** |
| **G-E0** | App abrible | ¿Layout/navegación útiles? | Autorizas Etapa 1 |
| **G-E1** | Primer muro | ¿Corte vertical usable? | Autorizas MVP estricto |
| **G-MVP** | MVP estricto | ¿Sensación de dibujo, claridad, utilidad? | Autorizas post-MVP (puertas/etc.) |
| **F5-S** | Estabilización IDs/historial/`.axon` | ¿Regresiones cerradas y uso manual OK? | Autorizas Playwright u otra cola |
| **G-GIT** | Gobernanza Git (ADR 0019/0023) | ¿La protección de `main` está **activa y verificada** con un PR que demuestre que los checks bloquean el merge? | Autorizas cortar releases |
| **G-REL** | Release | ¿Requisitos previos de `releases.md` cumplidos **sobre el SHA objetivo**? | Autorizas publicar el tag |

## Estado actual

- **G-MVP:** aprobado (2026-08-06)
- **Post-MVP código:** puertas (0010), ventanas (0011), gizmo→cámaras (0012)
- **F5-S:** **aprobado** (2026-08-07) — validación técnica + humana; ver `f5-stabilization.md`
- **F8 Playwright oleada 1:** **aprobado** (2026-08-08) — humo A+B local; checklist humana OK. Ver `docs/validation/playwright-f8.md`
- **F8-CI + oleada 2:** **aprobado** (2026-08-08) — Actions verde sin avisos Node 20; o2 puerta/ventana/cámara
- **Navegación 3D (ADR 0014):** **aprobado** 2026-08-08 — gizmo tríada ±ejes + ortho + pivot / hold-orbit
- **Cámaras (ADR 0015):** **aprobado** 2026-08-08 — Vista → Cámara + vista 3D ligada
- **Crop Region (ADR 0016):** **aprobado** 2026-08-08 — clip por vista; planta vs cámara independientes
- **Parked:** OCCT (ADR 0013), LR1-C / LR4–LR7 / IFC sin auth
- **Refactor session/viewer:** desacople real Fases 0–3 **cerradas** (2026-08-08); checklist humana OK; ver `refactor-session-viewer.md`
- **Hilo activo:** **línea LR** — LR0–LR3 + WP-v1/**v2** + SK-* cerradas; siguiente losas/terreno/barridos u Edit Mode (`pending-work.md`)
- **F9-E integridad (ADR 0017):** **cerrada** 2026-08-09 (E1–E6) — `domain-invariants-plan.md`
- **C3 crop cámara:** **cerrada** 2026-08-09
- **Auditoría externa:** `docs/validation/external-audit-2026-08-08.md` — base arquitectónica aprobada
- **Pendientes (prioridad):** **`pending-work.md`**
- **GitHub:** https://github.com/hfiguereo21/axonbim-web (público). **Sin branch protection**: la API responde
  `Branch not protected` (verificado 2026-08-12). El remoto anterior `hfiguereo/axonbim-web` quedó como `old-origin`.
- **G-GIT:** **abierto** — la protección no está activa; ver `releases.md`
- **G-REL:** **abierto** — no existe ningún tag; la primera línea base `v0.1.0` requiere este gate

## Registro de aprobación

| Gate | Fecha | Decisión | Notas |
|------|-------|----------|-------|
| G-F0 | 2026-08-06 | aprobado | Autorización Etapa 0 |
| G-F1 | 2026-08-06 | aprobado | Autorización Etapa 0 |
| G-E0 | 2026-08-06 | aprobado | Base UI |
| G-E1 | 2026-08-06 | aprobado | Primer muro |
| G-MVP | 2026-08-06 | aprobado | Dibujo usable |
| Post-MVP puertas | 2026-08-06 | autorizado | ADR 0010 |
| Post-MVP ventanas | 2026-08-07 | autorizado | ADR 0011 |
| Gizmo→cámaras | 2026-08-07 | autorizado | ADR 0012 |
| F5-S (inicio) | 2026-08-07 | autorizado | Congelar features; estabilizar (A1+C ventanas) |
| **F5-S (cierre)** | **2026-08-07** | **aprobado** | Tests verdes + pruebas humanas; logs limpios |
| **F8 Playwright o1** | **2026-08-07** | **autorizado** | Estrecho + A/B; local; sin CI |
| **F8 Playwright o1 (cierre)** | **2026-08-08** | **aprobado** | `pnpm test:e2e` verde + checklist humana 1–5 OK |
| **F8-CI + oleada 2** | **2026-08-08** | **autorizado** | CI en main; o2 puerta/ventana/cámara (hooks) |
| **F8-CI + oleada 2 (cierre)** | **2026-08-08** | **aprobado** | Actions verde; actions Node 24 (sin aviso @v4) |
| **ADR 0014 gizmo** | **2026-08-08** | **aprobado** | Tríada ±ejes + hold-orbit |
| **ADR 0015 cámaras** | **2026-08-08** | **aprobado** | Cámara geométrica + vista ligada |
| **ADR 0016 crop** | **2026-08-08** | **aprobado** | Clip por vista; marco seleccionable en planta |
| **Merge → main** | **2026-08-08** | **hecho** | `cursor/windows-and-gizmo-cameras` → `main`; política solo-main + primacía producto (ADR 0006 reforzado) |
| **Refactor controlado** | **2026-08-08** | **autorizado** | Plan microcortes; ver `refactor-session-viewer.md` |
| **Refactor corte 1** | **2026-08-08** | **hecho** | `viewCropResolve` + 6 tests; e2e verdes |
| **Refactor corte 2** | **2026-08-08** | **hecho** | `viewCropDrag` + 6 tests; e2e verdes |
| **Refactor corte 3** | **2026-08-08** | **hecho** | `sessionTypes.ts`; UI importa tipos desde ahí |
| **Refactor corte 4** | **2026-08-08** | **hecho** | `viewCropClip` + 2 tests; e2e verdes |
| **Refactor corte 5** | **2026-08-08** | **hecho** | `cameraPresetPose` + 3 tests; e2e verdes; OK manual dueño |
| **Refactor corte 6** | **2026-08-08** | **hecho** | `fitWallsFraming` + 4 tests; e2e verdes |
| **Refactor corte 7a** | **2026-08-08** | **hecho** | lote trivial×3 shell session; e2e verdes |
| **Refactor corte 7b** | **2026-08-08** | **hecho** | crítico×1 `pickTolerance` + 6 tests; equivalencia verificada; e2e verdes |
| **Refactor corte 7c** | **2026-08-08** | **hecho** | crítico×1 `documentMutation` + 6 tests (invariante F5-S en sesión); e2e verdes |
| **CI typecheck + tests** | **2026-08-08** | **hecho** | `ci.yml` verde en Actions; antes solo corría e2e |
| **Cobertura de paquetes** | **2026-08-08** | **hecho** | `model`/`families`/`shared` pasan de 0 tests a cubiertos; 60 → 99 tests |
| **Guardia de atajos** | **2026-08-08** | **hecho** | `check:shortcuts` en CI; verificado en negativo |
| **Auditoría del control (serie D)** | **2026-08-08** | **hecho** | D1–D9; el plan maestro estaba fuera del índice desde el primer commit |
| **Guardias P1–P4** | **2026-08-08** | **hecho** | `e2e` en typecheck, `check:docs`, `check:layers`, `build` en CI; los cuatro verificados en negativo |
| **P5 lint real** | **2026-08-08** | **hecho** | `eslint .` en CI; react-hooks y promesas verificadas en negativo |
| **Refactor cortes 7d+** | **2026-08-08** | **sustituido** | R1 → desacople real; ver Fases 1–2 abajo |
| **Desacople session (Fase 1)** | **2026-08-08** | **hecho** | slices Zustand; B5 session cerrado |
| **Desacople viewer (Fase 2)** | **2026-08-08** | **hecho** | módulos compositor; B5 viewer cerrado |
| **Fase 3 residual** | **2026-08-08** | **hecho** | C1/C2 cerrados MVP; contract tests picking/crop |
| **Fase 0 protección remota** | **2026-08-08** | **hecho** | Repo público + branch protection; `check:history` en CI |
| **Checklist Fases 1–3** | **2026-08-08** | **aprobado** | A/B/E ready; C ready c/obs; D aprobado c/obs D4 |
| **Fase 4 (cola)** | **2026-08-08** | **autorizada** | Elegir ítem parked; no implementar sin gate/ADR |
| **Fase 4 · C3** | **2026-08-09** | **cerrada** | Marco CSS + nav lock; crop real en planta; checklist OK |
| **LR0 formalización** | **2026-08-09** | **cerrada** | Plan LR indexado; hilo de avance = cola LR en `pending-work.md` |
| **LR1 SnapSession** | **2026-08-09** | **cerrada** | Histéresis orto; session-only; tests `@axonbim/tools` + web |
| **LR1-B Restart Chain** | **2026-08-09** | **cerrada** | `restartChainAt`; sin historial |
| **LR2 CompositeCommand** | **2026-08-09** | **cerrada** | Transacción atómica; tests composite |
| **B6 invariantes al dominio** | **2026-08-09** | **cerrado** | ADR 0017 + F9-E E1–E6 |
| **Auditoría externa** | **2026-08-08** | **recibida** | 2 P0 + 4 P1 de integridad; A4 cerrado vía F9-E5 |
| **F9-E estabilización** | **2026-08-09** | **cerrada** | E1–E6; checklist E6 OK |
| **F9-E1 contrato validez** | **2026-08-09** | **cerrada** | Predicados `model` + `CommandResult`; dueño: verificación manual hecha |
| **F9-E2 huecos hospedados** | **2026-08-09** | **cerrada** | `openingFit` + checklist humana OK («E2 checklist OK») |
| **F9-E3 catálogo familias** | **2026-08-09** | **cerrada** | Política A; checklist humana OK («E3 checklist OK») |
| **F9-E4 cámaras/sesión** | **2026-08-09** | **cerrada** | Política A; checklist humana OK («E4 checklist OK») |
| **F9-E5 frontera `.axon`** | **2026-08-09** | **cerrada** | Híbrido A3; checklist humana OK («E5 checklist OK») |
| **F9-E6 docs/guardias** | **2026-08-09** | **cerrada** | checklist humana OK («E6 checklist OK») |
