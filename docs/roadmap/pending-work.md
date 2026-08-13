# Pendientes — hilo único de trabajo

**Fuente de verdad** para lo que queda por hacer. Si otro documento contradice este,
**prevalece este** hasta que se actualice explícitamente.

**Todo trabajo entra aquí, en un único orden.** No sólo el producto: docs, infraestructura,
gobernanza y deuda técnica comparten esta cola. Antes de empezar algo nuevo hay que decir dónde
encaja en la secuencia y si desplaza a otra cosa; si es más importante, **se reordena la cola**
en vez de abrirlo aparte. **Nunca hilos en paralelo** — un PR abierto sin mergear ya es un hilo
abierto (`CLAUDE.md` §3.3).

Última revisión: **2026-08-13** — **SK-R1 cerrada**. Siguiente: **FAM-1**.

Contexto previo: **SK-wall-profile-v1 cerrado pero mínimamente funcional**.
El dueño lo declara insuficiente para producto final; el piloto REF-0 mide por qué y esta cola
descompone el refactor en fases. Siguiente hilo: **SK-R1…SK-R5**, y solo después
losas / terreno / barridos u Edit Mode. ADR 0018, 0022.

**Reordenada el 2026-08-12 por el sistema de familias.** El dueño señala que las familias son
transversales a casi todo: una herramienta no instancia nada si su familia no existe antes. Se
intercalan **FAM-1, FAM-2 y FAM-4** en la secuencia; SK-R2 baja un puesto. Ver
«[Por qué las familias reordenan la cola](#por-qué-las-familias-reordenan-la-cola)».

Detalle de bloques LR: [`legacy-reuse-roadmap.md`](legacy-reuse-roadmap.md) ·
resumen [`../migration/plan-integracion-selectiva-resumen.md`](../migration/plan-integracion-selectiva-resumen.md).

---

## Hilo activo (solo adelante)

Secuencia obligatoria. **No saltar** bloques ni abrir IFC/OCCT/Edit Mode antes de su
prerrequisito. Cada bloque = frase explícita en chat + gate.

```
LR0–LR3 + WP + SK-* + SK-profile-one + SK-wall-profile-v1
  → SK-R1 rechazo explicable ✔
  → FAM-1 concepto de familia + árbol maqueta
  → SK-R2 ADR sustrato de edición
  → FAM-2 biblioteca, carga y copia
  → SK-R3 sesión de edición compartida
  → SK-R4 trazado incremental
  → LR1-C snaps geométricos
  → SK-R5 parámetros de operación
  → FAM-4 familias compuestas (anidadas)
  → losas / terreno / barridos u Edit Mode (auth)
  ↘ LR3-D → LR4… (parked)

Una sola secuencia. Un bloque abierto a la vez: se cierra con su gate antes de abrir
el siguiente. Nada de hilos en paralelo.
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
| — | **SK-R1** Superficie de rechazo explicable | **cerrada** 2026-08-13 | Los **41** códigos con regla, ubicación y remedio; guardias de cobertura y de huérfanos, probados por mutación |
| **1** | **FAM-1** Concepto de familia + árbol maqueta | tras SK-R1 | Un solo tipo `Family`: categoría · tipología · parámetros · versión. Árbol declarado completo con los nodos sin realizar marcados. `.axon` v3 + migración v2→v3 |
| **2** | **SK-R2** ADR del sustrato de edición | tras FAM-1 | Decisión escrita: dibujo · transformación · snap · planos como base común, **con la familia de perfil como entrada de primera clase** |
| **3** | **FAM-2** Biblioteca, carga y copia | tras SK-R2 | Puerto de fuente de familias en el motor, adaptadores fuera (BD / paquete local). Cargar **copia** al proyecto; el `.axon` nunca lleva la biblioteca entera |
| **4** | **SK-R3** Sesión de edición compartida | tras SK-R2 | Una sesión única que consumen todas las funciones, no lógica por función |
| **5** | **SK-R4** Trazado incremental | tras SK-R3 | Componer contorno arista a arista; hoy ninguna operación añade aristas |
| **6** | **LR1-C** Snaps geométricos | tras SK-R4 | midpoint · intersección · perpendicular · tangente (hoy: 4 casos) |
| **7** | **SK-R5** Parámetros de operación | tras LR1-C | Radio de fillet y distancia de offset dejan de ser constantes |
| **8** | **FAM-4** Familias compuestas | tras SK-R5 | Una familia anida familias y declara reglas entre partes: escalera → tramos + baranda; baranda → pasamanos + balaustres/paños + soportes |
| **9** | **Sketch → losas / terreno / barridos** u **Edit Mode** | auth, **tras SK-R3** | Frase explícita; no IFC/OCCT. Escalera y baranda exigen además FAM-4 |

**No existe FAM-3, y el hueco es deliberado.** Ocupaba «definir las familias base» y se eliminó:
las familias concretas **no son un bloque**, llegan emparejadas con su herramienta (ver la regla
de emparejamiento abajo). Se conserva la numeración para que el hueco recuerde la decisión.

### Parked (no son el hilo actual)

Solo con auth **y** prerrequisitos. No reordenan la cola de arriba.

| Tema | Prerreq. | Doc |
|------|----------|-----|
| **Vínculos entre `.axon`** | FAM-2 + auth | Ver otro proyecto **por referencia, sin copiarlo** (estructural, levantamiento, terreno). Concepto distinto de cargar una familia: el vínculo refleja los cambios del origen, la copia no |
| **Family Editor** (que el usuario cree familias) | FAM-1 + FAM-2 + auth | `editing-paradigms.md`. Precargar catálogo **no** lo abre |
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

**SK-R1 cerrada 2026-08-13.** Siguiente: **FAM-1 — concepto de familia y árbol maqueta**,
que requiere frase explícita:

> Autorizo FAM-1.

**Lo que SK-R1 dejó medido, y no coincide con el piloto.** La superficie real son **41
códigos**, de los que **17 no tenían copia** — no 11 y 5. El defecto de fondo no era el
conteo sino que `commitSketchProfile` **esquivaba la tabla de copia**, así que toda la
validación de `geometry` llegaba al usuario sin remedio. La ubicación (vértice/arista) ya
se calculaba y se perdía en `rejected()`. Corregido el piloto; el guardia
`rejectionCoverage.test.ts` recalcula la cifra en cada CI para que no vuelva a estimarse
a mano.

**Queda abierto de SK-R1:** el mensaje dice dónde está el fallo, pero la vista todavía no
lo **resalta**. El marco visible de la restricción que pidió el dueño depende del sustrato
compartido y entra con SK-R3.

**Por qué el refactor va antes de losas/terreno/barridos.** Esas funciones consumirían las
mismas herramientas de dibujo, transformación y snap. Abrirlas sobre el sustrato actual
multiplicaría el problema por tres en vez de resolverlo una vez — y obligaría a rehacerlas
después. Es la razón de que la fila 7 quede detrás de SK-R3.

**SK-R2 es una decisión, no código.** El sustrato compartido cambia arquitectura y por eso
lleva ADR propio antes de tocar geometría. Implementar el perfil primero significaría volver
a construir sobre piezas sueltas.

**Por qué los snaps (LR1-C) van DESPUÉS del trazado (SK-R4) y no antes.** El propio piloto deja
como evidencia pendiente *qué tipos de snap hacen falta de verdad para este gesto, medido sobre
casos reales y no por analogía con CAD*. Construir los snaps sin su consumidor arriesga construir
los equivocados; con el trazado incremental funcionando, la lista se mide en vez de suponerse.

**Por qué SK-R1 va antes que SK-R2 pese a que SK-R2 es la decisión de fondo.** El canal de rechazo
viaja de dominio a comando a UI, y eso no lo cambia el sustrato: SK-R1 no se rehace al integrarse.
El riesgo de reproceso es bajo y el alivio es inmediato.

Family Editor / Push&Pull / LR4+ / IFC / OCCT: parked.

## Por qué las familias reordenan la cola

Decisiones del dueño, 2026-08-12. Se registran aquí porque **ordenan la cola**; el contrato
técnico lo fijará el ADR de FAM-1.

### La regla de emparejamiento

> **Ninguna herramienta entra en la cola sin su familia delante.** Acotar exige antes la familia
> de cota; colocar texto exige antes la familia de texto con sus propiedades y parámetros. La
> familia es **prerrequisito del bloque**, no una tarea dentro de él.

El dominio ya impone el principio: [`validate.ts`](../../packages/model/src/validate.ts) rechaza
un elemento cuyo `familyId` no esté en el catálogo del documento. Lo que falta es alcance, no
criterio. Crear el tipo en el momento de dibujarlo mezcla dos problemas difíciles —«qué es un
muro» y «dibujo este muro»— en un solo gesto.

### El árbol se declara entero; se realiza por partes

Mismo criterio que la maqueta de UI ([`axonbim-shell-v0.md`](../ui/axonbim-shell-v0.md)):
distribución completa, la mayoría de nodos sin realizar, y un corte vertical real. Definir hoy
todas las familias es inviable —son demasiadas y cada tipo es trabajo propio—, pero el árbol
declarado da sitio a cada una cuando llegue.

Hoy no hay taxonomía alguna: `WallFamily`, `DoorFamily` y `WindowFamily` son **tres tipos
sueltos** con tres arrays, tres buscadores y tres ramas de validación. Añadir losa son cuatro de
cada cosa. Por eso la escalera no es difícil, es **inexpresable**.

### Geometría: 3D procedural, 2D vectores

- **3D → siempre procedural.** La familia lleva parámetros y reglas; el motor construye la forma.
  Guardar mallas dispara el peso del archivo y rompe lo paramétrico, que es el no negociable 1.
- **2D con vectores → se guarda tal cual.** Un símbolo anotativo *son* sus vectores; no hay
  fórmula que parametrizar. El **perfil** cae de este lado sin ser anotativo, y ya hay precedente:
  ADR 0018 guarda el perfil vertical del muro como contorno.

**Consecuencia de costo:** una familia 3D no es una fila de catálogo, es **un generador escrito
por nosotros** más su esquema de parámetros. «La familia de escalera» significa el generador de
escalera. Esto encarece la regla de emparejamiento y hay que presupuestarlo por bloque.

### Cargar es copiar; vincular es otra cosa

Al cargar una familia, su definición **entra al proyecto** y viaja con él. Así el `.axon` lleva
sólo lo cargado —nunca la biblioteca entera— y sigue siendo autocontenido: enlazar dejaría los
elementos huérfanos al abrir el archivo en otra máquina.

Ver otro `.axon` **por referencia** es una función distinta y está parked arriba.

### Dónde vive la biblioteca, sin romper ADR 0021

Las imprescindibles viajan en el `.axon`; las complementarias viven en base de datos. Eso es
legal porque **la familia es un componente, no la fuente de verdad**: el motor conoce un puerto
abstracto de fuente de familias —listar, traer por id— y los adaptadores viven fuera, en
`apps/web`. `packages/*` no sabe que existe una BD ni el CRM anfitrión. El paquete local para
quien no tenga CRM sale gratis: es otro adaptador del mismo puerto.

### Versiones: dos tipos de archivo, una sola línea

Proyecto y familia son **dos tipos de archivo**, cada uno con su `formatVersion`, pero sobre
**una sola línea de versión compartida** en vez de dos numeraciones con tabla de compatibilidad:
al cargar, la familia se copia dentro del proyecto y sus datos *son* datos del proyecto. Mantener
dos numeraciones para algo que acaba fusionado es coste sin beneficio.

- **Hacia atrás, obligatorio:** una familia v1 en un proyecto v5 **se migra a v5** al cargarse.
- **Hacia adelante, prohibido:** una familia v5 **no abre** en un lector v1. Leer a medias lo que
  no se entiende corrompe en silencio.

Ya hay base: el lector sube `.axon` v1 → v2 en memoria
([`parse.ts`](../../packages/persistence/src/parse.ts)) y el lector normal rechaza versiones no
soportadas ([`shape.ts`](../../packages/persistence/src/shape.ts)).

**Deuda detectada al decidir esto (DEUDA-VER-1):** `parseDocumentRecover` —la ruta de *Recuperar
copia*— ante un `formatVersion` desconocido avisa `treating as 2` y **continúa**. Salvar un
archivo dañado del pasado es correcto; salvar uno del **futuro** descarta en silencio lo que no
entiende. Debe negarse igual que el lector normal. Arreglo pequeño; entra con FAM-1.

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
