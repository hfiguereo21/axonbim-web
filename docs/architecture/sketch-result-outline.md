# Contorno resultante en Workplane (sketch)

**Estado:** 2026-08-10 · **SK-profile-one** en código · **SK-wall-profile-v1 cerrado**
(Bloques 0–7; `.axon` v2)
(contrato ADR 0018). Implementación de perfil vertical: Bloques 2–7 (auth por fase).

## Objetivo de producto (norma)

Al editar el perfil de un muro (u host futuro):

1. El usuario trabaja un **único perfil imaginario** en sesión (vértices/aristas libres).
2. Hasta **Terminar**, el documento **no** cambia.
3. Si el perfil es válido, **Terminar** materializa **un resultado coherente** que **sustituye**
   la definición vertical del **mismo** muro (ADR 0018) — no una nube de muros por arista
   ni un Delete+Create con id nuevo (eso era SK-replace v0 / deuda).
4. **Cancelar / Esc** descarta; el host original queda intacto.

**SK-profile-one (código hoy):** anti silueta→N muros en planta; Terminar aún puede
reemplazar por caja vía AABB en cara vertical. El croquis (pendiente/escalón) requiere
**SK-wall-profile-v1**.

## Definición (seed)

El **contorno resultante** es la silueta 2D del **sólido derivado** del elemento paramétrico
(hoy: muro caja), proyectada sobre el `activeWorkplane` de sesión.

```
Wall (eje + altura + espesor) → sólido derivado → silueta en activeWorkplane → sketchProfile
                                                          ↑
                    Terminar → 1 perfil convertible → 1 elemento nuevo (o rechazo)
```

No es el eje generador. No es la malla Three.js. No es SoT en `.axon`.

---

## Contrato UX (croquis Modo SK — 2026-08-10)

Fuente: esquema de producto «Modo SK» para editar muros. Extensible más adelante a
**pisos / losas, techos y terrenos** (misma frontera; auth + tipos aparte).

### Vistas de referencia

| Vista | Qué muestra del muro | Rol en SK |
|-------|----------------------|-----------|
| **Planta** | Huella (rectángulo delgado = largo × espesor) | Entrada (doble clic / Editar perfil); no es el lienzo preferido para perfil vertical |
| **Elevación** | Cara (largo × altura) sobre línea de suelo; **plano de trabajo / superficie de referencia** arriba; **plano trabajo planta** en la base | Lienzo preferido para editar el contorno completo |
| **3D / isométrica** | Prisma del muro en ejes X/Y | Alternativa válida al alzado para editar el mismo contorno |

### Flujo de la herramienta

1. En **planta**: **doble clic** o **Editar en modo SK** sobre el muro.
2. El sistema **pide abrir vista en elevación o 3D** para editar el contorno (mensaje de
   estado; alzado documental puede seguir stub — basta 3D o Workplane de cara).
3. En la vista de edición: host documental oculto; **overlay** = perfil provisional; **H3**
   sólido **preview derivado** del provisional (no es SoT; `AxonDocument` intacto).
4. **Edición (SK-UX-A/B):** snap/guía visibles en el Workplane; clic/arrastre en **vértice o
   arista** (grips a mitad de segmento); proyectar arista = arrastre o clic 2 (sin depender
   del ribbon Mover); Línea no añade sobre seed cerrado (Split / Redibujar); Mover actúa
   sobre la selección o el bucle; rechazos `profile.*` en español. Provisional hasta
   **Terminar** (commit in-place).
5. **Resultado después de la adición / Terminar:** un **único** elemento paramétrico
   coherente que sustituye al host (p. ej. muro con huella/cara convertible), no N
   muros por arista de silueta.

### Alcance SK-profile-one vs SK-wall-profile-v1

| Caso | SK-profile-one (código) | SK-wall-profile-v1 (ADR 0018) |
|------|-------------------------|-------------------------------|
| Huella caja en planta | Invert → 1 muro (replace id) | Parametric / fuera del perfil vertical |
| Huella libre no-caja `result` | **Rechazar** Terminar | Igual (no N muros) |
| Cara vertical → pendiente/escalón | AABB → `height` caja; id nuevo | **Perfil U/V persistente**; mismo `wallId` |
| Entrada planta | Hint elevación/3D | **Bloqueo** de edición vertical |
| Openings | Bloquean replace | Conservar si caben; si no, rechazo |
| Persistencia | Sin perfil | `.axon` v2 `vertical` |
| Pisos / techos / terrenos | Nota | Auth aparte |

Detalle normativo: [ADR 0018](../decisions/0018-wall-vertical-profile.md).
Paquete: [`../validation/sk-wall-profile-report-2026-08-10/`](../validation/sk-wall-profile-report-2026-08-10/).

---

## Historial de cortes

| Corte | Fecha | Qué entregó | Límite / deuda |
|-------|-------|-------------|----------------|
| **SK-v1** | 2026-08-09 | Sketch Mode: rectángulo → 4 muros; paradigma sobre Workplane | Solo prueba de patrón |
| **SK-sel** | 2026-08-09 | Entrada: doble clic / Editar perfil; `sketchTarget` sesión | Solo muro |
| **SK-draw** | 2026-08-09 | Línea · rect · arcos · pick; builders globales | Commit crear ≠ editar perfil |
| **SK-profile** | 2026-08-09 | Seed = contorno **resultado** (no eje); overlay; grips | Commit aún pensado como invert al host |
| **SK-provisional** | 2026-08-09 | Gestos solo sesión; validar al Terminar; Cancelar descarta | Huella 1-corner **constricted** (rectángulo) |
| **SK-replace v0** | 2026-08-09 | Vértices **libres**; Terminar = Delete+Create; noop; openings bloquean | **Huella libre → N muros** (solape) |
| **SK-profile-one** | 2026-08-10 | Contrato UX croquis; **un** perfil al Terminar; silueta `result` 1-host no → N muros | Perfil elevación custom |
| **SK-wall-profile-v1** | 2026-08-10 | Bloques 0–7: ADR + dominio + mesh + comando + vista + editor + `.axon` v2 | **Cerrada** |

Detalle de paradigmas: [`editing-paradigms.md`](editing-paradigms.md).
Cola: [`../roadmap/pending-work.md`](../roadmap/pending-work.md).

---

## SK-replace + SK-profile-one (comportamiento normativo)

Mientras hay `sketchTarget`, el usuario edita un **sketch provisional** en sesión
(vértices y aristas **independientes**). El muro del documento **no** cambia hasta
**Terminar** con perfil válido. Entonces el adaptador **reemplaza**: elimina los
hosts del perfil y crea **muros nuevos** (nuevos ids) — **uno** cuando el seed es
silueta de resultado convertible.

```
outlineOnWorkplane → sketchProfile (sesión, libre)
       ↑                    │
  Dibujar + snap + WP       │ grips (vértices independientes)
                            ▼
                 validateSketchProfileForHost
                     │ ok              │ fail
                     ▼                 ▼
         Delete sources + Create    seguir en Sketch
         (1 muro si result 1-host)  (mensaje; sin N-por-arista)
```

### Reglas fijas

1. Con `sketchTarget` activo, **ningún gesto muta** `AxonDocument` (solo sesión).
2. Overlay = sketch provisional; sólidos host ocultos (**solo contorno**).
3. **Terminar / Aplicar** = validar → si ok, **replace** (delete + create); si no, mensaje y se conserva el provisional.
4. **Cancelar / Esc** = descartar provisional; documento intacto.
5. Entrada de trazo: herramientas **Dibujar** + **snap** + `activeWorkplane`.
6. Si la geometría propuesta coincide con los hosts → **noop** (sin comandos; se mantiene el sketch).
7. Hosts con puertas/ventanas → Terminar **bloqueado** (replace borraría openings).
8. **SK-profile-one:** `semantic: "result"` + **1** host → **nunca** `profileToAxes` (N muros por arista de silueta). Solo invert a **1** muro o **rechazo**.

### Commit (reglas cerradas)

| Perfil | Terminar |
|--------|----------|
| 1 muro, huella **caja** (`isWallBoxFootprint`) | Invert → **1** muro nuevo |
| 1 muro, huella **libre** / no-caja (`result`) | **Rechazar** — no descomponer silueta |
| 1 muro, WP vertical convertible | Cara → **1** muro nuevo |
| Bucle N hosts (≥3) | Inset anillo → N muros |
| Axes / rect / arco (redibujo explícito) | Aristas → N muros (intención de ejes) |

### Validación al Terminar (`validateSketchProfileForHost`)

| Regla | Criterio |
|-------|----------|
| No vacío | ≥1 arista con longitud ≥ `MIN_WALL_LENGTH` |
| Openings | ningún source con huecos |
| Huella caja 1 muro | 4 aristas + `isWallBoxFootprint` → 1 muro vía invert |
| Huella libre 1 muro `result` | **fail** (`profile.footprint.one`) — no axes-por-arista |
| 1 muro / vertical | anillo ≥3 pts invertible a cara |
| Bucle | N≥3; inset recuperable |
| Axes / redibujo | aristas usable → muros |

### Edición del provisional

| Modo | Efecto |
|------|--------|
| Línea (default) | Grips de vértice **libres** + snap |
| Rect / arcos | Reemplazan el provisional (`semantic: "axes"`) |
| Pick líneas | P1/P2 con snap sobre WP → arista provisional |
| Pick cara | Solo Workplane; no pisa el provisional |

### Entrada UX (SK-sel + croquis)

| Entrada | Comportamiento |
|---------|----------------|
| Doble clic / **Editar perfil** | Entra Sketch + seed contorno resultante |
| WP storey (planta) | Status guía: abrir **elevación o 3D** / seleccionar cara para perfil vertical; huella en planta sigue editable |
| WP surface / line | Contorno de cara/silueta; edición en el plano activo |
| Vista | Host oculto; solo overlay del contorno completo |

---

## Por kind de Workplane (seed)

| `activeWorkplane.kind` | Contorno sembrado |
|------------------------|-------------------|
| `storey` | Huella en planta. Muro suelto → rectángulo **4** aristas. Bucle → anillo **exterior**. |
| `surface` | Rectángulo de la **cara** (largo × altura). |
| `line` | Silueta del prisma (convex hull UV). |

Huecos: contorno del prisma sin recortes (fuera de alcance).

## API canónica

| Capa | API |
|------|-----|
| Geometría | `outlineOnWorkplane` · `isWallBoxFootprint` · `validateSketchProfileForHost` |
| Perfil sesión | `profileFromClosedRing` · builders (`axes`) · `moveProfileVertex` |
| Seed UI | `enterSketchOnElement` / cancel reseed |
| Commit | `commitSketchProfile` — delete + create; **1** muro si `result` 1-host convertible |

## Oráculos de prueba

- Un vértice se mueve solo (no corner constricted).
- Huella caja alargada → Terminar → **nuevo** id, **1** muro.
- Huella libre no-caja `result` → Terminar **no** muta; permanece en Sketch.
- Perfil inválido / openings → Terminar no muta.
- Snap a endpoint; Cancelar descarta; Rect rebuild (`axes`) provisional hasta Terminar → N muros OK.

## Extensión futura (otros tipos)

Losas / techos / terreno / barridos: misma frontera provisional + validación + adaptador
**un perfil → un elemento**.
Perfil de elevación de muro: **SK-wall-profile-v1** (ADR 0018), no Edit Mode genérico.
Ver [`editing-paradigms.md`](editing-paradigms.md).

## Relación

- ADR: [`../decisions/0018-wall-vertical-profile.md`](../decisions/0018-wall-vertical-profile.md)
- Geometría: [`geometry-policy.md`](geometry-policy.md)
- Paradigmas: [`editing-paradigms.md`](editing-paradigms.md)
- Planos: [`../roadmap/workplanes-roadmap.md`](../roadmap/workplanes-roadmap.md)
- Cola: [`../roadmap/pending-work.md`](../roadmap/pending-work.md)
- Paquete auditoría: [`../validation/sk-wall-profile-report-2026-08-10/`](../validation/sk-wall-profile-report-2026-08-10/)
