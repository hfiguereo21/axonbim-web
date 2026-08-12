# Changelog

## Unreleased

## [v0.1.0] — 2026-08-12

Primera línea base con nombre. **`0.x` significa inestable**: el contrato puede
cambiar entre versiones menores, y este corte no promete lo contrario.

### Qué es

El estado tras cerrar F0–F9, la línea LR, los Workplanes v1/v2 y
`SK-wall-profile-v1`, más la gobernanza documental de agosto: precedencia
normativa (ADR 0020), independencia del motor frente al CRM anfitrión con guard
en CI (ADR 0021), biblioteca de referencias técnicas (ADR 0022) y este esquema
de versionado (ADR 0023).

### Limitaciones conocidas

- **Edición del perfil de muro: mínimamente funcional.** El rechazo de una
  edición inválida no explica qué regla se violó ni dónde; no existe operación
  que añada aristas al contorno, sólo transformar las existentes; y el snap
  resuelve cuatro casos. Especificado en
  `docs/references/pilots/wall-profile-reference-study.md`. El refactor no está
  hecho.
- **IFC, DXF, OpenCascade, Edit Mode, Push/Pull y losas**: fuera de alcance,
  cada uno con su gate.
- El motor viaja embebido en el CRM anfitrión como SPA independiente; su
  extracción está garantizada por ADR 0021 pero no ejercitada.


### SK-UX-A/B — feedback, política Dibujar y aristas (2026-08-10)

- **A:** snap cue + guía en UV del Workplane con provisional activo; preview Modificar
- **A:** Línea/pick no hacen append sobre seed cerrado; Rect/arco solo tras Redibujar
- **A:** `REJECTION_TEXT` para `profile.*` / locks; Split/Mover reportan no-op
- **B:** selección de arista (`profileEdgeIndex` + highlight); grips a mitad de segmento
- **B:** proyectar arista con arrastre o clic 2 (sin ribbon Mover); Mover sigue válido
- Parada: checklist humana (snap · Línea bloqueada · proyectar arista)

### H4 — feedback si el clic falla el Workplane (2026-08-10)

- `pickOnWorkplane` null ya no es silencio en sketch / Modificar / muro / trazo WP
- Status: «Sin intersección con el Workplane — órbita menos rasante…»
- Helper `workplanePickFeedback` + tests

### H3 — preview sólido del provisional (2026-08-10)

- Mientras se edita el perfil, el viewport muestra un **sólido derivado** del
  `sketchProfile` (clone de display); `AxonDocument` no cambia hasta **Terminar**
- Helper `previewWallFromSketchProfile` + status «preview · Terminar confirma»
- Host documental sigue oculto; openings del host se dibujan sobre el preview

### Fix — Modificar H1/H2 + iconos (2026-08-10)

- **H1:** `setTool("select")` dejaba sketch abierto con `activeTool !== "wall"` → clics
  iban a selección; ahora Modificar fuerza `activeTool: "wall"`, Viewport prioriza
  sketch+modify, y Seleccionar en sketch = modo vértice
- **H2:** Desfase = equidistancia real en UV del Workplane (`offsetProfileInPlane`);
  clic +0,15 m · Shift contrae
- Iconos dedicados: `offset`, `fillet`, `splitPoint`, `splitLine`, `redraw`, `editProfile`
- El documento / malla sólida sigue actualizándose solo al **Terminar**

### Fix — herramientas Modificar en sketch (2026-08-10)

- Viewport robaba clics a grips/vértices y no llamaba `wallClick` → `sketchModifyClick`
- Mover / Rotar / Split / Fillet / Copiar vuelven a transformar el **provisional**
  (el documento sigue actualizándose solo al Terminar)

### SK-wall-profile-v1 — Bloque 7 persistencia `.axon` v2 (2026-08-10) — **cerrado**

- Escritores: `formatVersion: 2`; muros siempre con `vertical` (sin `height` suelto)
- Lectores: v1 (`height` → uniform) y v2 (`vertical` obligatorio); memoria promovida a v2
- Strict: perfil inválido / v2 solo-`height` → reject; recover: muro descartado + warning
- Properties: altura máxima solo lectura si `kind === "profile"`
- Tests: migración, round-trip perfil, reject sin degradar (`axon.test.ts`)
- **Feature `SK-wall-profile-v1` cerrada** (Bloques 0–7). Siguiente: losas/Edit Mode con auth

### SK-wall-profile-v1 — Bloque 6 editor + toolkit (2026-08-10)

- **6A:** Terminar en cara → `SetWallVerticalProfileCommand` (mismo `wallId`);
  `worldRingToWallVertical`; Redibujar limpia provisional
- **6B:** Mover / Rotar / Split point / Split line / Fillet / Copiar (+ Desfase stub)
  sobre `sketchProfile` con **SnapSession + Workplane** (`sketchModifySlice`)
- Helpers `@axonbim/tools` `sketchProfileEdit.ts` (15 tests)
- Cinta Modificar: stubs → tools activos en sketch
- **Parada** auth Bloque 7 (persistencia `.axon` v2)

### SK-wall-profile-v1 — plan Bloque 6 ampliado (2026-08-10)

- Docs: Bloque 6 = **6A** núcleo (Terminar in-place) + **6B** toolkit Modificar
  (mover → **split point** → **split line** → rotar → fillet → copiar → desfase opcional)
  sobre provisional
- Invariante: tools **con SnapSession + Workplane** (no camino paralelo / Edit Mode)
- Sin código de implementación hasta frase de auth Bloque 6

### SK-wall-profile-v1 — Bloque 5 vista / picking / Workplane (2026-08-10)

- `WallHit` + `pickWallHit` (cara / punto / normal); doble clic usa hit → face WP
- Gate de vista: planta y cámara documental rechazados; perspectiva (presets gizmo OK)
- Entrada fija `workplaneFromWallFace`; Workplane congelado mientras `sketchTarget`
- Overlay/grips de perfil orientados en `axisU` × `axisV` con lift por `normal`
- Tests: WP-01…04 (plan reject, face seed, freeze); `wallProfileEditContext`
- **Parada** checklist manual frontal / lateral / isométrica → auth Bloque 6

### SK-wall-profile-v1 — Bloque 4 comando in-place (2026-08-10)

- `Wall.vertical` (sin `height` suelto); helpers `wallMaxHeightOf` / clone / equals
- `SetWallVerticalProfileCommand`: in-place, noop/reject, openings vía
  `validateOpeningInsideWallProfile` + `validateHostedOpening`
- `SetWallHeightCommand` bloquea perfil custom (`wall.profile.heightLocked`);
  `SetWallEndpointsCommand` bloquea cambio de longitud (`wall.profile.lengthLocked`)
- Persistencia: lee `height` legacy → uniform; escribe `height` si uniform / `vertical` si profile
- Tests: `wallVerticalProfile.test.ts` (6) — mismo `wallId` en Undo/Redo
- **Parada** auth Bloque 5 (vista / picking / Workplane de cara)

### SK-wall-profile-v1 — Bloque 3 geometría (2026-08-10)

- `wallProfileMesh`: extrusión U/V ± espesor; uniform → `wallBoxMesh` / slabs
- Pendiente/escalón: vértices de malla conservan alturas distintas (oráculos numéricos)
- Openings: notch sill=0; perfil rectangular → `wallMeshWithOpenings`; joins solo uniform
- `wallProfileMetrics` / `wallProfileSupportsMiter`; envelope Z vía `wallMaxHeightOf`
- Tests: `wallProfileMesh.test.ts` (7) — **parada** auth Bloque 4
- Revisión visual humana: checklist en matriz `04_…` (pendiente al cablear viewer)

### SK-wall-profile-v1 — Bloque 2 dominio puro (2026-08-10)

- Tipos: `WallProfilePoint`, `WallVerticalDefinition` (ADR 0018)
- API: `wallVerticalOf` / `wallVerticalLoop` / `wallLocalToWorld` / `worldToWallProfileUV`
- Validación: `validateWallProfile`, `validateOpeningInsideWallProfile` (+ autointersección, extremos, openings)
- Tests: `packages/model/src/wallVertical.test.ts` (11)
- `Wall.height` legacy intacto hasta Bloques 3–7 — **parada** auth Bloque 3

### SK-wall-profile-v1 — Bloque 1 ADR y contrato (2026-08-10)

- ADR 0018: `WallVerticalDefinition`, U/V, openings, in-place, planta bloqueada, `.axon` v2
- Docs: `document-model`, `sketch-result-outline`, `editing-paradigms`, `geometry-policy`, cola
- **Sin código de editor** — parada auth Bloque 2 (dominio puro)

### SK-wall-profile-v1 — Bloque 0 diagnóstico (2026-08-10)

- Paquete externo archivado: `docs/validation/sk-wall-profile-report-2026-08-10/` (+ ZIP)
- Diagnóstico reproducible: `docs/validation/sk-wall-profile-bloque0-2026-08-10.md`
- Evidencia: AABB en `invertVerticalFaceOutline`; commit Delete+Create sin perfil; `Wall.height` caja
- **Parada:** auth Bloque 1 (ADR/contrato) — sin código de editor aún

### SK-profile-one — un único perfil + contrato UX croquis (2026-08-10)

- Contrato UX: planta → pide elevación/3D; solo contorno; niveles + plano de referencia
- Terminar: silueta `result` de 1 host → **1** muro convertible o **rechazo** (nunca N por arista)
- Extensión a pisos/techos/terreno: nota; auth aparte
- Docs: `sketch-result-outline.md`, `editing-paradigms.md`, `pending-work.md`

### BUG-UI-NUM — props numéricas teclado (2026-08-10)

- `PropsNumberInput`: draft local; commit en blur/Enter; spinners al valor completo
- Aplica a altura/espesor muro, altura nueva, crop, cámara (ojo/FOV)
- Tests: `apps/web/src/components/propsNumberCommit.test.ts`

### WP-v2 — planos de trabajo tangibles (2026-08-09)

- Kinds: `storey` | `surface` | `line` (sesión; no `.axon`)
- UI: **Arquitectura** Seleccionar / Dibujar / Nivel; **Modificar** Seleccionar / Nivel (si hay geometría)
- Overlay parche + ejes; pick `pickWorkplane` sobre el plano activo
- Sketch Mode edita el perímetro sobre `activeWorkplane` (surface/line, no solo storey)
- APIs: `workplaneFromWallFace`, `workplaneFromLineTrace`, `intersectRayWorkplane`

### SK-replace — provisional libre → muros nuevos (2026-08-09, v0)

- Vértices/aristas del provisional **independientes** (sin corner constricted)
- **Terminar** = validar → **delete** hosts + **create** muros nuevos (no update in-place)
- Huella caja → 1 muro nuevo; (v0) huella libre → N muros — **retirado en SK-profile-one**
- APIs: `isWallBoxFootprint`, `commitSketchProfile` (replace), `validateSketchProfileForHost`
- Contrato: `docs/architecture/sketch-result-outline.md`

### SK-profile — perímetro en Workplane (2026-08-09)

- Contorno del **sólido resultante** en `activeWorkplane` (huella / cara / silueta), no el eje
- Semilla + overlay provisional; muro intacto hasta Terminar
- APIs: `outlineOnWorkplane`, `profileFromClosedRing`, `validateSketchProfileForHost`

### SK-draw — herramientas Dibujar completas (2026-08-09)

- Línea · rectángulo · arco I-F-R · arco centro · pick líneas · pick cara
- Arcos → polilínea tessellada (12 segs) → muros vía `CompositeCommand`
- APIs reutilizables en `@axonbim/tools` (`sampleArc*`, `wallAxesFromPolyline`)
- Preview polilínea en viewer; pick cara fija Workplane del storey del muro

### SK-sel — Sketch sobre selección (2026-08-09)

- Doble clic en muro o **Modificar → Editar perfil** entra en Sketch del elemento
- `sketchTarget` en sesión; Workplane = storey del muro; mismas herramientas Dibujar
- Terminar / Cancelar / Esc salen a Paramétrico y conservan la selección

### SK-v1 — Sketch Mode rectángulo (2026-08-09)

- Invariante: Sketch Mode **solo** con elementos paramétricos sobre Workplane definido
- Destino de producto: pisos/losas, terreno, perfiles para barridos (SK-v1 = prueba de patrón)
- Sketch reutiliza las herramientas Dibujar del muro (sin segunda barra)
- `editingParadigm` en sesión (`parametric` \| `sketch`); no en `.axon`
- Modo **Rectángulo**: 2 clics → 4 muros vía `CompositeCommand` (1 undo)
- Preview de contorno; losas/terreno/barridos y arcos/pick parked hasta auth

### WP-v1 — Workplane compartido (2026-08-09)

- `Workplane` / `SpatialReferenceContext` en `@axonbim/model` (derivado del storey activo)
- Muros y pick de Viewport usan el plano; no se persiste en `.axon`
- Fuera de alcance: Sketch/Edit Mode, Family Editor, Push&Pull, planos custom
- Docs de lógica alineadas: overview, document-model, geometry-policy, non-negotiables,
  editing-paradigms, coordinate-system, inventario, auditorías (nota supersede)

### LR3 — Spatial Reference Context (2026-08-09)

- **A** `activeStoreyId` + `getActiveStorey` / reconcile; muros usan nivel activo (no `storeys[0]`)
- **B** `deriveStoreyDatums` — datums visuales derivados
- **C** `computeModelEnvelope` — AABB regenerable; pivot de órbita lo consume
- **D** `getProjectionBasis` TOP/N/S/E/W (+Y = Project North); contrato para Viewer / LR4
- Docs: coordinate-system, pending-work, legacy-reuse-roadmap, inventario

### LR1-C — Snaps geométricos (parked, documentado 2026-08-09)

- Midpoint / perpendicular / proyecciones: roadmap §LR1-C; no implementar sin auth

### LR2 — CompositeCommand (2026-08-09)

- `CompositeCommand` en `@axonbim/commands`: N pasos → 1 historial; fallo = rollback
- Tests: undo/redo, rechazo mid-flight, noop

### LR1-B — Restart Chain (2026-08-09)

- `restartChainAt(point)` en tools + session; cinta **Reiniciar**
- No muta documento ni historial; mantiene tool Muro

### LR1 — SnapSession + histéresis orto (2026-08-09)

- `SnapSession.axisLock` en `@axonbim/tools` / session (no en `AxonDocument`)
- Entrada orto ~12°; mantenimiento ~22°; Esc / cambio de tool / nuevo segmento limpian
- Prioridad intacta: cierre → extremo → orto; tests unitarios + session

### Docs — plan LR indexado y hilo de trabajo reestructurado (2026-08-09)

- PDF + resumen en `docs/migration/plan-integracion-selectiva-*`
- Cola LR0–LR7: `docs/roadmap/legacy-reuse-roadmap.md`
- `pending-work.md`: hilo activo = LR1→…→Workplanes; F9-E/C3/LR0 en historial cerrado
- Inventario, AGENTS, workplanes, gates, work-phases alineados
- Sin cambio de comportamiento de producto (solo documentación)

### Vista cámara — navegación bloqueada (2026-08-09)

- Zoom/órbita bloqueados en vista cámara (pose del documento)
- Doble clic dentro del marco → edición temporal; Esc / doble clic / cambiar vista → salir y restaurar pose

### Fase 4 · C3 — grips de marco en cámara/3D — **cerrada 2026-08-09**

- Marco CSS (inicio `inset: 8%`) + grips: al arrastrar solo el marco de pantalla
- No muta `Camera.crop` / clip (alcance de planta intacto)
- Vista cámara: grips solo con zoom bloqueado; en nav-edit se ocultan
- Planta: grips mundo = edición real del crop
- Checklist humana OK; ciclo cerrado

### F9-E6 — docs y guardias — **cerrada 2026-08-09** (cierra F9-E)

- Sync: `commands-and-history`, `overview`, README, `geometry-policy`
- `pnpm check:links` en CI; matriz [`acceptance-matrix-post-mvp.md`](docs/validation/acceptance-matrix-post-mvp.md)
- Checklist humana OK; programa F9-E (E1–E6) cerrado

### Crop de presentación persistente (ADR 0016, 2026-08-09)

- Planta / perspectiva libre: si el crop está **activado**, se guarda en `presentation.viewCrops` al Exportar y se restaura al Abrir
- Cámaras: sin cambio (`Camera.crop` ya persistía)

### F9-E5 — frontera `.axon` (híbrido A3) — **cerrada 2026-08-09**

- Abrir…: `parseDocument` estricto (forma + semántica E1/E2; sin defaults ni crop silencioso)
- Recuperar copia…: `parseDocumentRecover` + avisos en status; Exportar solo `.axon` limpio
- Caps de tamaño/entidades; checklist humana OK

### F9-E4 — cámaras derivadas del documento (política A) — **cerrada 2026-08-09**

- Pestañas `kind=camera` se reconstruyen desde `document.cameras` tras comando/undo/redo/import
- `resetSessionForDocument` unifica Nuevo / Demo / Abrir; `touchDoc` clona `cameras`
- Cierra la doble verdad tab↔entidad (AX-P1-05/06); checklist humana OK

### Gobernanza — merge a `main` y primacía del producto (2026-08-08)

- Rama `cursor/windows-and-gizmo-cameras` fusionada en `main`; política **solo `main`** en adelante
- ADR 0006 / gates / no negociable 21: validación estricta de factores críticos aunque el dueño apresure (sin reglas nuevas)

### Región de recorte de vista (ADR 0016) — **aprobado 2026-08-08**

- Tipo `ViewCrop` (AABB); `Camera.crop` en `.axon`; crop de sesión independiente en planta/perspectiva
- Planta: crop de sesión con **máscara + clip**; cámaras: cono + marco solo si la cámara está seleccionada
- Seleccionar el **marco** de cámara → grips y arrastre (mueve cámara+crop juntos)
- Vista cámara: clip + marco en pantalla; el crop de cámara no clipea la planta
- Props **Viewport** (sin selección / con cámara); convención «producto(s) de referencia»; baseline → `reference-shell-baseline.md`

### Cámaras geométricas (ADR 0015) — **aprobado 2026-08-08**

- Herramienta **Vista → Cámara**: colocar en planta (ojo → mira)
- Entidad `Camera` (eye, target, FOV, crop); vista 3D ligada e independiente de Perspectiva 3D
- Navegador: grupo **Cámaras**; props: nombre, altura ojo, FOV, recorte
- Persistencia en `.axon` (`cameras[]`)

### Navegación 3D — gizmo tríada, ortho y pivot (ADR 0014) — **aprobado 2026-08-08**

- Gizmo: ejes ±X/±Y/±Z (vistas orto) + hub isométrica; **hold/arrastre** = órbita del modelo
- Órbita también con clic medio/derecho; pivot **Modelo | Selección** en la barra de iconos
- Picking con tolerancia al zoom (líneas/grips + proximidad en pantalla)

### F8 — Playwright oleada 1 — **aprobado 2026-08-08**

- Humo A: carga, demo, nuevo, export/abrir `.axon`, undo tras borrar muro
- Capturas B: layout con canvas enmascarado (`pnpm test:e2e`)
- Config: no reutilizar Vite ajeno en 5173 (evita timeouts del menú Archivo)
- Ver `docs/validation/playwright-f8.md`

### Refactor controlado session/viewer — cortes 1–7c (2026-08-08)

- Plan: `docs/roadmap/refactor-session-viewer.md`
- Corte 1: `viewCropResolve.ts` — active/clipping crop + tests
- Corte 2: `viewCropDrag.ts` — begin/update/commit drag + tests
- Corte 3: `sessionTypes.ts` — tipos de vista/docks/cinta
- Corte 4: `viewCropClip.ts` — clip GPU + máscara planta fuera de `createViewport` + tests
- Corte 5: `cameraPresetPose.ts` — pose pura de presets gizmo (ADR 0014) + tests
- Corte 6: `fitWallsFraming.ts` — AABB + framing planta/3D de `fitWalls` + tests
- Corte 7a: lote trivial — `defaultViews` + `displayCycles` + `touchDoc` + tests
- Corte 7b: `pickTolerance.ts` — umbral de raycaster + radios de grip en píxeles (contrato de selección) + tests
- Corte 7c: `documentMutation.ts` — aplicar comando / undo / redo con tests del invariante F5-S en sesión
- Política: 1 peel crítico / hasta 3 triviales; agente clasifica; Opus en críticos
- ADR 0016: nota de producto — marcos de recorte cliqueables/editables (requisito, no extra)

### Cola de pendientes ordenada (2026-08-08)

- Nuevo [`pending-work.md`](docs/roadmap/pending-work.md): fuente de verdad con **tres hilos** (Control /
  Refactor / Producto) y prioridad global de mayor a menor; desarrollo y features nuevas
  al final de la cola
- `AGENTS.md`, `gates.md`, `technical-audit-2026-08.md` y `refactor-session-viewer.md`
  apuntan ahí para no duplicar listas divergentes

### Lint real y cierre de la auditoría (2026-08-08)

- **P5:** `pnpm lint` ejecutaba **nada**; ahora es `eslint .` con `eslint.config.mjs` y está
  en CI. Alcance estrecho: sin reglas que dupliquen `tsconfig`, `check:layers` o
  `check:shortcuts`, y sin `recommendedTypeChecked` (ruido `unsafe-*` con Three.js)
- Reglas verificadas en negativo: `react-hooks/exhaustive-deps`, `rules-of-hooks` y
  `@typescript-eslint/no-floating-promises`
- El repo pasó con 0 errores salvo `viewCropDrag.ts`: `let baseline = null` que ambas ramas
  sobrescribían (código muerto, no bug); ahora es `const` con ternario
- CI queda en **siete pasos**; cortes del refactor **pausados** por decisión del dueño
- **Medición al pausar:** diez cortes redujeron los monolitos solo un 7 % (1696→1541,
  1380→1316). Compran testabilidad, no descomposición: B5 no se cierra por esta vía

### Reglas con respaldo mecánico: P1–P4 cerrados (2026-08-08)

- **P1 / D3:** `tsconfig.e2e.json` mete `e2e/` y `playwright.config.ts` en `pnpm typecheck`;
  el error inyectado que antes daba exit 0 ahora da exit 2
- **P2 / D1:** `pnpm check:docs` falla si un `.md` o `.pdf` rastreado no es alcanzable desde
  el índice de `AGENTS.md`. Al exigirlo apareció **D9**: el índice de ADR no listaba el 0009
- **P3 / D2:** `pnpm check:layers` falla si el dominio importa React / Three / viewer o usa
  `localStorage` / `indexedDB` / `navigator`, y si el viewer importa React o Zustand
- **P4 / D4:** paso `Production build` en CI; `typecheck` no es build
- Los tres guardias verificados en negativo (Three en `geometry`, React en `commands` y en
  `viewer`, `indexedDB` en `persistence`, doc y PDF sin indexar, error de tipos en un spec)
- `check:layers` ignora a propósito los identificadores `window` y `document`: son
  sustantivos del dominio BIM y producían un falso positivo en `commands/windows.ts`

### Auditoría del sistema de control: reglas sin comprobación (2026-08-08)

- Hallazgos D1–D8 en `docs/validation/technical-audit-2026-08.md`, con pendientes P1–P8
  consolidados para no perder el hilo
- **D1:** el plan maestro (PDF v1.0) y su resumen estaban fuera del índice de `AGENTS.md`
  desde el primer commit: existían pero ningún agente los leía. Índice corregido
- **D3:** ningún `tsconfig` incluye `e2e/`; verificado en negativo (un error de tipos en un
  spec deja `pnpm typecheck` en exit 0)
- **D2/D4/D5:** sin comprobación de pureza del dominio, sin `build` en CI, y la protección
  de rama no es posible en plan gratuito con repo privado (403 de GitHub)

### Guardia contra atajos de prueba (2026-08-08)

- `pnpm check:shortcuts` (`scripts/check-no-test-shortcuts.mjs`) en CI: falla ante
  `.skip` / `.only` / `.todo` / `xit`, `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`
  y `--passWithNoTests`
- Verificado en negativo (inyectando atajos se obtiene exit 1, con archivo y línea)
- `--passWithNoTests` eliminado también de `persistence` y `apps/web`, que ya tenían tests

### Cobertura: fin del verde silencioso (2026-08-08)

- `packages/model` tenía **0 tests** con `--passWithNoTests`, y `families` / `shared` no
  tenían script de test: `pnpm test` los saltaba en silencio
- Nuevos tests: `viewCrop` (19) e integridad del documento (7) en `model`, catálogos (6) en
  `families`, tolerancias (7) en `shared` — de 60 a **99** tests; los 9 paquetes cubiertos
- Invariantes fijados: índices de esquina del crop (SW/SE/NE/NW) coherentes con el arrastre
  de grips, integridad referencial del demo, epsilons por debajo de las dimensiones mínimas

### CI: typecheck + tests unitarios verificados en Actions (2026-08-08)

- Nuevo `.github/workflows/ci.yml`; antes el único workflow era Playwright, así que
  «typecheck y tests verdes» nunca se verificaba de forma independiente
- Límite anotado en `docs/roadmap/github.md`: `lint` no ejecuta nada

### Marco de recorte más fácil de agarrar (2026-08-08)

- Tolerancia de clic del **marco de crop**: 12 px → **16 px** (era la más estrecha de la app, sobre línea fina)
- Invariante con prueba: el marco no puede ser más estrecho que la selección de entidades
- Auditoría técnica **reverificada** contra el código: hallazgos A1–A4 cerrados; B1–B5 y C1 registrados


### F5-S — estabilización (IDs, historial, `.axon`) — **aprobado 2026-08-07**

- `syncIdSequencesFromDocument` tras Nuevo / Demo / Abrir (evita colisión de IDs)
- `Command.execute` → `boolean`; historial solo registra mutaciones reales
- Parser `.axon` valida refs (storey/family/wall), geometría mínima e IDs duplicados
- Tests REG IDs, DeleteWall+puertas/ventanas undo/redo, no-op, round-trip
- Gate humano: pruebas manuales OK + logs limpios

### Post-MVP — puertas (ADR 0010)

- Entidad `Door`, familias 80/90/100; `door.create` / delete / familia / swing / hinge / hoja
- Hueco en muro (slabs); marco = forro interior (jambas + dintel, **sin umbral**)
- Hoja con paneles, bisagras, manilla horizontal; planta: arco + grips sentido/bisagra
- Familia editable en caliente; navegación: zoom, orbit 3D, pan planta

### Post-MVP — ventanas (ADR 0011)

- Entidad `Window`, familias 60×100 / 90×120 / 120×120; alféizar desde familia
- Comandos `window.create` / delete / familia / swing / hinge / hoja; solape con puertas y ventanas
- Cinta **Ventana**, colocación en muro, props + grips en planta; hoja por defecto cerrada

### Post-MVP — gizmo cámaras (ADR 0012)

- Clic en gizmo 3D aplica vistas reales: Z superior, Y frontal, X derecha, centro isométrica
- `setCameraPreset` en el viewer; orbit/zoom se conservan

## 2026-08-06 — MVP estricto (G-MVP)

- Snap muro + feedback; switch Snap en status; Cadena solo en opciones de muro (ADR 0009)
- Uniones L por **inglete** limpio (ADR 0008); zoom con rueda en planta/3D
- Demo vivienda 8×6 m; Fit; gizmo 3D animado (maqueta; texto al hover)
- Validación humana: dibujo usable — **G-MVP aprobado**

### Etapa 1 (G-E1)

- `wallBoxMesh`, comandos muro + historial, draw encadenado, props, undo/redo

### Etapa 0 (G-E0)

- Shell (inspirado en productos de referencia), compositor, visor, `.axon` v1

### Licencia / fundación

- ADR 0007 propietaria; F0/F1 docs; ADR 0001–0006
