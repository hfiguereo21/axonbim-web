# Matriz de adopción

**Estado documental: REFERENCIA.** Ver [README](README.md) y
[ADR 0022](../decisions/0022-technical-reference-governance.md).

Qué se hizo con cada patrón externo y **a qué contrato propio se tradujo**. Una
fila sin destino en AxonBIM es una fila incompleta.

## Ya adoptado — está en el código

Estas filas no son propuestas: describen decisiones tomadas antes de que
existiera esta biblioteca, registradas aquí para no volver a discutirlas.

| Patrón | Fuente | Decisión | Dónde vive hoy |
|---|---|---|---|
| Transacción con commit y abort | FreeCAD | ADAPTADO | `commands` + `CompositeCommand` + historial ([ADR 0002](../decisions/0002-parametric-document-source-of-truth.md)) |
| Operación modal: inicio, actualización, confirmar, cancelar | Blender | ADAPTADO | `tools` + estado de sesión; el preview es efímero y no entra al historial |
| Separar dato de edición provisional del resultado final | Blender | ADAPTADO | Perfil provisional del sketch vs perfil persistente ([ADR 0018](../decisions/0018-wall-vertical-profile.md)) |
| Picking, cámaras y clipping | Three.js | ADOPTADO | `@axonbim/viewer`; el picking devuelve IDs, nunca mallas mutables |
| Representación derivada, no autoritativa | Blender depsgraph | ADAPTADO | `model` → `geometry` → `viewer`; el viewer nunca es fuente de verdad |

## Pendiente de evaluación

| Patrón | Fuente | Decisión | Destino propuesto | Gate |
|---|---|---|---|---|
| Recompute selectivo por objeto afectado | FreeCAD + Blender | VERIFICAR | Invalidación granular `model → geometry` | Hace falta medir si el recompute total ya es suficiente |
| Edit Mode / modelado in-place | Blender | APLAZAR | Family Editor futuro | Sin autorización; ver `editing-paradigms.md` |
| Semántica de intercambio | buildingSMART IFC | APLAZAR | Adaptador IFC de importación/exportación | IFC fuera del MVP |
| Requisitos comprobables por máquina | buildingSMART IDS | APLAZAR | Validación de entregables | Después del adaptador IFC |
| Incidencias y viewpoints | buildingSMART BCF | APLAZAR | Coordinación, separada del modelo | Sin caso de uso todavía |
| Validación de datos y geometría | IfcOpenShell | ADAPTAR | `persistence` / interoperabilidad | Junto al adaptador IFC |
| Intercambio 2D | DXF oficial | APLAZAR | Adaptador DXF | DXF fuera del MVP |
| B-Rep y booleanas | OpenCascade | APLAZAR | Backend detrás de la Geometry API propia | [ADR 0013](../decisions/0013-geometry-api-occt-candidate.md); sólo se reevalúa ante una operación que la geometría propia no resuelva |
| Predicados robustos y reparación de mallas | CGAL | VERIFICAR | Por problema concreto, no como dependencia general | Licencia dual: exige decisión explícita |
| Publicación 3D | glTF | APLAZAR | Export visual | Sin caso de uso; el `.axon` es la persistencia |
| Viewer de modelos grandes, doble precisión | xeokit | VERIFICAR | Benchmark de rendimiento | No sustituye Three.js sin evaluar coste, licencia AGPL y arquitectura |

## Rechazado

| Patrón | Fuente | Motivo |
|---|---|---|
| IFC en memoria como fuente de verdad | Bonsai | Contradice el no negociable 1: el documento paramétrico es la fuente de verdad. IFC es adaptador de intercambio |
| Malla editable como modelo autoritativo | Blender | Contradice los no negociables 1 y 2. Una malla no puede sostener parámetros BIM |
| Arquitectura C++ con Workbenches | FreeCAD | Otro lenguaje, otro modelo de extensión y dependencia de OCCT. Se toma el patrón de transacción, no la implementación |

## Cómo se actualiza

Una fila cambia de estado **sólo con una ficha que lo justifique**. Pasar de
APLAZAR a ADOPTAR exige además el ADR y la autorización que su gate indique.
