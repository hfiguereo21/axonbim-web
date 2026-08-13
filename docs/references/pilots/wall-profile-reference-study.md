# Piloto — edición del perfil vertical de muro

**Estado documental: REFERENCIA.** Ver [README](../README.md) y
[ADR 0022](../../decisions/0022-technical-reference-governance.md).

**Este documento no implementa nada.** Es el primer piloto de REF-0: sirve para
probar si el método —problema, datos, invariantes, referencias, traducción,
pruebas— produce una especificación mejor que resolver directamente.

## 1. Punto de partida: qué existe hoy

`SK-wall-profile-v1` está **cerrado y funciona** ([ADR 0018](../../decisions/0018-wall-vertical-profile.md)):
el muro tiene perfil vertical persistente, el `.axon` v2 lo guarda, y hay
comando in-place con Undo/Redo. Sobre eso, SK-UX-A/B añadió selección y
proyección de aristas, política de dibujo sobre semilla cerrada y textos de
rechazo.

El dueño lo califica de **mínimamente funcional**: sirve para demostrar el
contrato, no para producto final. Este documento parte de esa evaluación y la
convierte en especificación.

## 2. Problema

### 2.1 El rechazo es ciego

La validación **sabe** exactamente qué está mal y **no lo dice**. Medido:

| | |
|---|---|
| Códigos que emite la validación | **41**, medidos por el guardia de SK-R1 |
| Códigos que la UI traduce | **24 de 41**; los 17 restantes llegaban sin copia |
| Traducciones huérfanas | **0** |

> **Corrección 2026-08-13 (SK-R1).** La versión original de esta tabla decía
> «11 emitidos, 5 traducidos, 3 huérfanos». Los tres números eran falsos y se
> corrigen con la medición real:
>
> - El conteo de 11 sólo miró `profile.*` y `opening.*`; la superficie incluye
>   además `wall.*`, `door.*`, `window.*`, `camera.*` y `crop.*`.
> - Los tres supuestos huérfanos —`profile.u.bounds`, `profile.edge.short`,
>   `profile.height.min`— **sí se emiten**, en `packages/model/src/wallVertical.ts`.
> - Faltaba el defecto más grave: `commitSketchProfile` no pasaba por la tabla
>   de copia, así que toda la validación de `geometry` esquivaba la superficie.
>
> La lección para el método REF-0 (ADR 0022) es que **una cifra de diagnóstico
> se mide con un script y se deja reproducible**, no se cuenta a mano: el guardia
> `rejectionCoverage.test.ts` recalcula estos números en cada CI.

Consecuencia observada por el dueño: *«hay que jugar a ver cuál sketch es
aceptado»*. Un usuario final no sabría por dónde empezar.

El canal tampoco da para más: el rechazo viaja como un `string` de estado. No
lleva **dónde** ocurrió la violación, **qué** la causó ni **cómo** salir.

### 2.2 No se puede trazar, solo transformar

`sketchProfileEdit` expone catorce operaciones. Ninguna **añade aristas**:

- Cambian topología: `splitProfileAtPoint`, `splitProfileEdgeByLine`,
  `deleteProfileVertex`, `clearProfileEdges`.
- Transforman lo existente: `translateProfile(Edge)`, `copyProfileTranslated`,
  `rotateProfile(AboutAxis)`, `filletProfileVertex`, `offsetProfile(InPlane)`.

Por eso el resultado percibido es *«sube, baja o se desplaza»*. «Redibujar una
forma libre» no es implementable con esta API: sólo se puede vaciar y volver a
sembrar con las primitivas de dibujo, no componer un contorno arista a arista.

Detalle sintomático: el fillet usa **radio fijo** `SKETCH_OFFSET_DISTANCE = 0.15`
para todos los casos. No hay forma de pedir otro radio.

### 2.3 Las herramientas no forman un sistema

Snap resuelve **cuatro** casos: `endpoint`, `ortho`, `close`, `none`, más un
`AxisLock` horizontal/vertical. No hay midpoint, intersección, perpendicular,
tangente, centro ni referencia a otra arista.

Dibujo, transformación, snap y workplanes existen como piezas separadas y no
comparten una sesión de edición común. El dueño lo formula como principio:

> *«las herramientas de dibujo, transformación, planos y snap no tendrían
> sentido repetir la lógica nueva desde 0 en cada función»*

## 3. Comportamiento objetivo

### 3.1 El modelo de validación: dibujar libre, bloquear el cierre

Decisión del dueño, tomada por analogía explícita con Revit y CAD:

> *«si edito un perfil mal en Revit, el programa me permite dibujar, y una vez
> terminado no me permite cerrar la edición porque el perfil no cumple con los
> parámetros aceptados; eso no quita que lo pude dibujar»*

Traducido a contrato:

- **El trazado nunca se bloquea.** Las restricciones del muro no impiden dibujar.
- **`Terminar` es la única puerta.** Ahí se valida y ahí se rechaza.
- **Un rechazo debe decir tres cosas**: qué regla se violó, dónde (vértice,
  arista o hueco concreto), y qué haría falta para cumplirla.
- El documento permanece intacto mientras la edición esté abierta; `Cancelar` no
  toca el historial. Esto ya se cumple hoy y no debe perderse.

### 3.2 Las herramientas de dibujo son primitivas reales

Referencia del dueño: *«un comando de línea real: dibujas una línea de un punto
A a un punto B con snaps y demás»*. Hoy las primitivas siembran un contorno
completo (rect, arco); falta el trazado incremental.

### 3.3 Sustrato compartido

Dibujo, transformación, snap y workplanes deben ser **una base común** que cada
función consume, no lógica reimplementada por función. Es el punto de mayor
coste y el que más deuda evita: el perfil de muro es el primer consumidor, pero
losas, terreno y barridos consumirán el mismo sustrato.

Esto merece **ADR propio** antes de implementarse: es un cambio de arquitectura,
no una función.

## 4. Datos necesarios

- `wallId` estable, eje, espesor, nivel y familia.
- Perfil vertical persistente (`Wall.vertical`, `.axon` v2).
- Workplane vertical resoluble y su base de proyección.
- Huecos hospedados con sus restricciones (`opening.*`).
- Tolerancias geométricas según `coordinate-system.md`.
- **Nuevo**: catálogo de reglas activas, legible por la UI — hoy no existe como
  concepto, sólo como funciones que devuelven un código.

## 5. Invariantes

Los de ADR 0018 siguen vigentes y no se renegocian:

1. Un muro antes y después; mismo `wallId`.
2. Documento intacto hasta `Terminar`; `Cancelar` no muta historial.
3. Contorno cerrado, simple y con área no degenerada.
4. Hospedados preservados, o el commit se rechaza.
5. Undo/Redo exacto de perfil y hospedados.
6. El viewer deriva; nunca es fuente de verdad.

Se añaden dos que el comportamiento objetivo exige:

7. **Todo rechazo es explicable**: ningún código de validación puede llegar al
   usuario sin traducción, ubicación y remedio. Un `??` genérico es un defecto.
8. **Trazar nunca destruye**: el provisional puede ser inválido en cualquier
   momento intermedio sin poner en riesgo el documento.

## 6. Referencias consultadas y qué aporta cada una

| Fuente | Aporta | No aporta |
|---|---|---|
| **Blender** (BMesh, operadores modales) | Ciclo modal con inicio/actualización/confirmación/cancelación; edición provisional separada del resultado; selección explícita de vértices y aristas | El modelo BIM. Una malla editable no puede ser fuente de verdad |
| **FreeCAD** (`App::Document`) | Transacción con commit y abort; recompute sólo de lo afectado; nombrar la operación de Undo | Su arquitectura C++ ni su dependencia de OCCT |
| **AxonBIM** (ADR 0002, 0017, 0018) | El contrato final: comandos, invariantes en dominio, perfil persistente | — |
| **buildingSMART** | Nada en este gesto. IFC es adaptador de intercambio, fuera del trazado | — |
| **OpenCascade** | Nada todavía: un contorno poligonal cerrado no necesita B-Rep ([ADR 0013](../../decisions/0013-geometry-api-occt-candidate.md)) | — |

**Traducción, que es el paso que no se puede saltar:** de Blender se toma el
*ciclo* del operador, no su modelo de datos. De FreeCAD se toma la *frontera* de
la transacción, no su implementación. El contrato resultante es de AxonBIM y se
expresa en `AxonDocument`, Commands y Workplanes.

## 7. Pruebas que exigirá la implementación

**Validación y su superficie**

- Cada código produce un mensaje con regla, ubicación y remedio.
- Ningún código llega sin traducir: un test que recorra los códigos emitidos y
  falle si alguno cae en el genérico.
- Ninguna traducción huérfana: falla si la UI traduce un código que nadie emite.

**Trazado**

- Contorno cerrado y no autointersectado se acepta.
- Área degenerada se rechaza con su motivo.
- Trazar un provisional inválido no altera el documento.
- Composición incremental arista a arista produce el mismo perfil que la
  primitiva equivalente.

**Identidad y hospedados**

- `wallId` preservado.
- Hueco que deja de caber → commit rechazado, con el hueco identificado.
- Undo/Redo restaura perfil y hospedados exactamente.

**Transformación de coordenadas**

- Ida y vuelta Workplane-local ↔ mundo dentro de tolerancia.

**Validación humana**

- Redibujar libre, `Terminar` y `Cancelar` con un perfil válido y uno inválido,
  comprobando que el motivo del rechazo es accionable sin leer código.

## 8. Lo que este documento NO decide

- **No autoriza implementar.** Ni el sustrato compartido, ni el trazado
  incremental, ni el nuevo canal de rechazo.
- **No abre** IFC, DXF, OCCT, Edit Mode, Push/Pull ni losas.
- El sustrato compartido (§3.3) **exige ADR propio** por ser cambio de
  arquitectura.
- El alcance del refactor no está dimensionado aquí. El dueño anticipa que **no
  será pequeño**, y la evidencia de §2 lo respalda.

## 9. Evidencia pendiente

- Cuántos de los 11 códigos son alcanzables desde la UI actual y cuántos sólo
  desde el dominio.
- Si el `AxisLock` actual estorba más de lo que ayuda al trazar libre.
- Qué tipos de snap hacen falta de verdad para este gesto, medido sobre casos
  reales y no por analogía con CAD.
