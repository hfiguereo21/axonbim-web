# Pendientes — hilo único de trabajo

**Fuente de verdad** para lo que queda por hacer. Si otro documento contradice este,
**prevalece este** hasta que se actualice explícitamente.

Última revisión: **2026-08-12** — **SK-wall-profile-v1 cerrado pero mínimamente funcional**.
El dueño lo declara insuficiente para producto final; el piloto REF-0 mide por qué y esta cola
descompone el refactor en fases. Siguiente hilo: **SK-R1…SK-R5**, y solo después
losas / terreno / barridos u Edit Mode. ADR 0018, 0022.

Detalle de bloques LR: [`legacy-reuse-roadmap.md`](legacy-reuse-roadmap.md) ·
resumen [`../migration/plan-integracion-selectiva-resumen.md`](../migration/plan-integracion-selectiva-resumen.md).

---

## Hilo activo (solo adelante)

Secuencia obligatoria. **No saltar** bloques ni abrir IFC/OCCT/Edit Mode antes de su
prerrequisito. Cada bloque = frase explícita en chat + gate.

```
LR0–LR3 + WP + SK-* + SK-profile-one + SK-wall-profile-v1
  → SK-R1 rechazo explicable
  → SK-R2 ADR sustrato de edición  → SK-R3 sesión compartida
       → SK-R4 trazado incremental
       → LR1-C snaps geométricos
       → SK-R5 parámetros de operación
  → losas/terreno/barridos u Edit Mode (auth)
  ↘ LR3-D → LR4… (parked)
```

| Orden | Bloque | Estado | Gate de cierre |
|-------|--------|--------|----------------|
| — | **LR0** Formalización legado | **cerrada** 2026-08-09 | Docs indexados; inventario clasificado |
| — | **LR1** SnapSession + histéresis | **cerrada** 2026-08-09 | Enter 12° / hold 22°; session fuera de documento |
| — | **LR1-B** Restart Chain | **cerrada** 2026-08-09 | `restartChainAt`; cinta Reiniciar; sin historial |
| — | **LR2** Command Transactions | **cerrada** 2026-08-09 | `CompositeCommand` atómico + tests |
| — | **LR3-A…D** Spatial Reference Context | **cerrada** 2026-08-09 | Active Storey · Datum · Envelope · Projection Basis |
| — | **WP-v1** Workplane compartido | **cerrada** 2026-08-09 | [`workplanes-roadmap.md`](workplanes-roadmap.md) |
| — | **WP-v2** Planos tangibles | **cerrada** 2026-08-09 | Nivel · superficie · línea; overlay; sesión |
| — | **SK-v1** Sketch Mode (rectángulo) | **cerrada** 2026-08-09 | [`editing-paradigms.md`](../architecture/editing-paradigms.md) |
| — | **SK-sel** Sketch sobre selección | **cerrada** 2026-08-09 | Entrada UX; carga perfil (SK-profile) |
| — | **SK-draw** Dibujar completo | **cerrada** 2026-08-09 | Builders globales; commit muro = adaptador crear |
| — | **SK-profile** + **SK-replace v0** | **cerrada** 2026-08-09 | Provisional libre; replace Delete+Create |
| — | **SK-profile-one** | **cerrada** 2026-08-10 | Anti silueta→N muros; **no** perfil vertical persistente |
| — | **SK-wall-profile-v1** | **cerrada** 2026-08-10 | ADR 0018; `.axon` v2; Bloques 0–7 |
| **1** | **SK-R1** Superficie de rechazo explicable | auth | Los 11 códigos con regla, ubicación y remedio; 2 tests guardia |
| **2** | **SK-R2** ADR del sustrato de edición | auth | Decisión escrita: dibujo · transformación · snap · planos como base común |
| **3** | **SK-R3** Sesión de edición compartida | tras SK-R2 | Una sesión única que consumen todas las funciones, no lógica por función |
| **4** | **SK-R4** Trazado incremental | tras SK-R3 | Componer contorno arista a arista; hoy ninguna operación añade aristas |
| **5** | **LR1-C** Snaps geométricos | tras SK-R3 | midpoint · intersección · perpendicular · tangente (hoy: 4 casos) |
| **6** | **SK-R5** Parámetros de operación | tras SK-R3 | Radio de fillet y distancia de offset dejan de ser constantes |
| **7** | **Sketch → losas / terreno / barridos** u **Edit Mode** | auth, **tras SK-R3** | Frase explícita; no IFC/OCCT |

### Parked (no son el hilo actual)

Solo con auth **y** prerrequisitos. No reordenan la cola de arriba.

| Tema | Prerreq. | Doc |
|------|----------|-----|
| LR4 Technical Views | LR3-D + auth doc 2D | `legacy-reuse-roadmap.md` |
| LR5 Render invalidation | evidencia de coste | idem |
| LR6 IFC Recognition Policy | auth IFC | ADR 0003 |
| LR7 Grid adaptativo | LR3 | UX only |
| OpenCascade | auth | ADR 0013 |
| IFC operativo | LR6 + auth | ADR 0003 |
| PWA / OPFS / IndexedDB | — | technical-audit §No introducir |
| Colaboración / más Playwright / nuevos tipos | gate + ADR | — |

### Informe mínimo por bloque LR (antes de programar)

Problema · comportamiento Desktop recuperado · datos · invariantes · componentes Web ·
qué **no** se reutiliza · tests. Tras: archivos · tests · Undo/Redo si aplica · docs.

### Próximo paso

**SK-R1 — superficie de rechazo explicable.** Es la fase de mayor alivio por unidad de
trabajo y la única que **no depende del sustrato**, así que puede ir primero:

> Autorizo SK-R1.

El problema, medido en
[`../references/pilots/wall-profile-reference-study.md`](../references/pilots/wall-profile-reference-study.md):
la validación emite **11 códigos** y la UI traduce **5**; los otros caen en un genérico
«Operación rechazada». Hay además **3 traducciones huérfanas** de códigos que nadie emite.
El usuario acaba adivinando qué contorno se acepta.

**Por qué el refactor va antes de losas/terreno/barridos.** Esas funciones consumirían las
mismas herramientas de dibujo, transformación y snap. Abrirlas sobre el sustrato actual
multiplicaría el problema por tres en vez de resolverlo una vez — y obligaría a rehacerlas
después. Es la razón de que la fila 7 quede detrás de SK-R3.

**SK-R2 es una decisión, no código.** El sustrato compartido cambia arquitectura y por eso
lleva ADR propio antes de tocar geometría. Implementar el perfil primero significaría volver
a construir sobre piezas sueltas.

Family Editor / Push&Pull / LR4+ / IFC / OCCT: parked.

Family Editor / Push&Pull / LR1-C / LR4+ / IFC / OCCT: parked.

---

## Cola histórica (cerrada — no reabrir salvo regresión)

| Fase | Estado | Gate |
|------|--------|------|
| **0–3** Desacople session/viewer + deuda | **cerrada** | Checklist A–E 2026-08-08 |
| **F9-E1…E6** Integridad | **cerrada** | ADR 0017; checklists humanas OK |
| **F9-E** (programa) | **cerrada** | 2026-08-09 |
| **4 · C3** Crop marco cámara | **cerrada** | Checklist OK 2026-08-09 |
| **LR0** Formalización legado | **cerrada** | Indexado 2026-08-09 |
| **LR1** SnapSession | **cerrada** | Histéresis orto; tests tools + session |
| **LR1-B** Restart Chain | **cerrada** | `restartChainAt` + cinta Reiniciar |
| **LR2** CompositeCommand | **cerrada** | Transacción atómica en history |
| **LR3-A…D** Spatial Reference | **cerrada** | `getActiveStorey` · datums · envelope · projection basis |
| **WP-v1** Workplane | **cerrada** | `resolveSpatialReference`; tools sin acoplar a cámara |
| **WP-v2** Planos tangibles | **cerrada** | Nivel · superficie · línea; `activeWorkplane` sesión |
| **SK-v1** Sketch Mode | **cerrada** | Rectángulo → 4 muros / CompositeCommand; arcos stub |
| **SK-sel** Sketch selección | **cerrada** | Doble clic / Editar perfil; `sketchTarget` |
| **SK-draw** Dibujar | **cerrada** | Arcos tessellados; pickLines/pickFace; preview polilínea |
| **SK-profile** + SK-replace v0 | **cerrada** | Provisional libre; replace Delete+Create |
| **SK-profile-one** | **cerrada** 2026-08-10 | Anti silueta→N muros; no perfil vertical |
| **SK-wall-profile-v1** | **cerrada** 2026-08-10 | Bloques 0–7; `.axon` v2 |

### Checklists humanas cerradas (referencia)

| Bloque | Resultado |
|--------|-----------|
| Fases 1–3 (A–E) | OK 2026-08-08 (D4 obs. aceptada; BUG-C corregido) |
| F9-E2…E6 | OK 2026-08-09 |
| C3 crop/marco | OK 2026-08-09 — marco CSS + nav lock; crop real en planta |
| LR0 docs | OK 2026-08-09 — PDF + resumen + roadmap + inventario |
| LR1 SnapSession | OK 2026-08-09 — enter/hold; Esc limpia; no en historial |
| LR1-B Restart Chain | OK 2026-08-09 — reinicio sin mutar doc/historial |
| LR2 CompositeCommand | OK 2026-08-09 — undo/redo atómico; fallo = rollback |
| LR3 Spatial Reference | OK 2026-08-09 — A–D en `@axonbim/model` + session; tests verdes |
| WP-v1 Workplane | OK 2026-08-09 — plano storey derivado; muro/Viewport; sin persistir |
| WP-v2 Planos tangibles | OK 2026-08-09 — select/línea/nivel; overlay; tests |
| SK-v1 Sketch Mode | OK 2026-08-09 — rectángulo en Workplane; undo atómico de 4 muros |
| SK-sel Sketch selección | OK 2026-08-09 — muro; Dibujar reutilizado |
| SK-draw Dibujar | OK 2026-08-09 — 6 modos; tests tools + session |
| SK-profile / SK-replace v0 | OK código 2026-08-09 |
| SK-profile-one | OK 2026-08-10 — anti N muros; croquis vertical = parked |
| SK-wall-profile-v1 Bloque 0 | OK 2026-08-10 — diagnóstico |
| SK-wall-profile-v1 Bloque 1 | OK 2026-08-10 — ADR 0018 |
| SK-wall-profile-v1 Bloque 2 | OK 2026-08-10 — `wallVertical.ts` |
| SK-wall-profile-v1 Bloque 3 | OK 2026-08-10 — `wallProfileMesh` + 7 tests |
| SK-wall-profile-v1 Bloque 4 | OK 2026-08-10 — `SetWallVerticalProfileCommand` + 6 tests Undo/Redo IDs |
| SK-wall-profile-v1 Bloque 5 | OK código 2026-08-10 — `WallHit` / gate planta / WP freeze; checklist humana frontal·lateral·iso |
| SK-wall-profile-v1 Bloque 6 | OK 2026-08-10 — Terminar in-place + toolkit Modificar (snap+WP) |
| SK-wall-profile-v1 Bloque 7 | OK 2026-08-10 — `.axon` v2; migración; round-trip; Properties perfil RO — **feature cerrada** |

### Bugs de checklist (cerrados / aceptados)

| ID | Estado |
|----|--------|
| **BUG-C** máscara crop cámara | **corregido** 2026-08-08 |
| **BUG-D4** flip controls vs zoom | **aceptado por ahora** 2026-08-08 |

### Bugs UI

| ID | Estado | Notas |
|----|--------|-------|
| **BUG-UI-NUM** | **corregido** 2026-08-10 | `PropsNumberInput`: draft local; commit blur/Enter (y valor completo / spinner). Tests: `propsNumberCommit.test.ts`. |

---

## Hilos de soporte (no desplazan la cola LR)

### Proceso (Hilo A)

| ID | Pendiente | Estado |
|----|-----------|--------|
| **A1** | Repo público + branch protection | **cerrado** 2026-08-08 |
| **A2** | Mantener docs al cerrar gates | Práctica continua |
| **A3** | Límite conocido de CI | Contract tests + e2e |

### Deuda técnica (Hilo B) — cerrada

| ID | Estado |
|----|--------|
| **B5** session / viewer monolitos | **cerrado** |
| **B6** invariantes en dominio | **cerrado** — ADR 0017 · F9-E |

### Decisiones de producto (Hilo C) — cerradas

| ID | Estado |
|----|--------|
| **C1** Umbrales clic | **cerrado (MVP)** |
| **C2** Bundle ~834 kB | **cerrado (MVP)** |
| **C3** Crop en más vistas | **cerrado** 2026-08-09 |

---

## Qué está cerrado (referencia rápida)

| Área | Cierre | Dónde |
|------|--------|-------|
| F5-S, F8, ADR 0014–0016 | 2026-08-07/08 | gates |
| Auditoría P1–P5 | 2026-08-08 | technical-audit |
| Desacople Fases 0–3 | 2026-08-08 | este doc, gates |
| A1 protección remota | 2026-08-08 | github.md |
| F9-E E1–E6 | 2026-08-09 | ADR 0017, domain-invariants-plan |
| Fase 4 · C3 | 2026-08-09 | ADR 0016 |
| LR0 plan integración selectiva | 2026-08-09 | legacy-reuse-roadmap + migration |
| LR1 SnapSession + histéresis | 2026-08-09 | `@axonbim/tools` snap + session `snapSession` |
| LR1-B Restart Chain | 2026-08-09 | `restartChainAt` + Ribbon Reiniciar |
| LR2 CompositeCommand | 2026-08-09 | `packages/commands` composite + tests |

F9-E detalle: [`domain-invariants-plan.md`](domain-invariants-plan.md).
