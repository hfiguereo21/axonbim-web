# Registro de fuentes

**Estado documental: REFERENCIA.** Ver [README](README.md) y
[ADR 0022](../decisions/0022-technical-reference-governance.md).

Solo fuentes **oficiales o primarias**. Nada de tutoriales, blogs ni respuestas
de foros: una decisión de arquitectura no se sostiene sobre material sin
autoridad.

**No se descargan manuales al repositorio.** Se guardan resúmenes con redacción
propia, y aquí queda la URL, la fecha de consulta y la licencia para poder
volver.

## Fuentes admitidas

| Fuente | Área | URL oficial | Consultada | Licencia | Uso permitido | Uso prohibido |
|---|---|---|---|---|---|---|
| Blender Developer Docs (BMesh, Operators, Depsgraph) | Interacción y edición | https://developer.blender.org/docs/ | 2026-08-12 | GPL (código) · docs CC | Patrones de operador modal, selección, edición provisional, invalidación derivada | Copiar código GPL. Tratar una malla editable como fuente de verdad BIM |
| FreeCAD Source Documentation (`App::Document`) | Modelado paramétrico | https://freecad.github.io/SourceDoc/ | 2026-08-12 | LGPL (código) | Transacciones, recompute selectivo, identidad vs etiqueta, nombrado de Undo/Redo | Portar su arquitectura C++, Workbenches o su dependencia de OCCT |
| Bonsai / IfcOpenShell | BIM sobre IFC | https://docs.bonsaibim.org/ · https://docs.ifcopenshell.org/ | 2026-08-12 | LGPL / GPL | Organización por dominios BIM, validación de datos, casos de intercambio | Su paradigma Native OpenBIM: IFC en memoria como fuente de verdad |
| buildingSMART (IFC, IDS, BCF) | Semántica y estándares | https://technical.buildingsmart.org/standards/ | 2026-08-12 | Estándar abierto | Vocabulario, semántica de intercambio, requisitos comprobables (IDS), incidencias (BCF) | Que IFC intervenga en el gesto de modelado |
| AutoCAD DXF Reference | Intercambio 2D | https://help.autodesk.com/view/OARX/2026/ENU/ | 2026-08-12 | Documentación propietaria de Autodesk | Contrato de entidades, capas, códigos y unidades para un adaptador futuro | Copiar texto del manual. Suponer que DXF define Sketch Mode o restricciones |
| Three.js | Viewer web | https://threejs.org/docs/ | 2026-08-12 | MIT | Raycasting, cámaras, clipping, `BufferGeometry`, rendimiento GPU | Que defina cómo mutar `AxonDocument` o validar una entidad BIM |
| OpenCascade / OCAF | Kernel B-Rep | https://occt3d.com/dev/doc/overview/html/ | 2026-08-12 | LGPL con excepción | Estudio comparativo de B-Rep, booleanas y persistencia de referencias | Integrarlo. Sigue **aplazado** por ADR 0013 |
| CGAL | Geometría computacional | https://doc.cgal.org/ | 2026-08-12 | GPL / comercial dual | Referencia algorítmica: predicados robustos, intersecciones, reparación de mallas | Adoptarlo como dependencia sin evaluar licencia comercial |
| Khronos glTF | Entrega 3D | https://registry.khronos.org/glTF/ | 2026-08-12 | Estándar abierto | Formato de publicación o intercambio visual futuro | Usarlo como persistencia paramétrica; el `.axon` es la persistencia |
| xeokit SDK | Viewer BIM web | https://xeokit.github.io/xeokit-sdk/docs/ | 2026-08-12 | AGPL / comercial dual | **Benchmark**: modelos grandes, doble precisión, clipping, viewpoints | Sustituir Three.js sin evaluación separada de coste, licencia y arquitectura |

## Advertencia de licencias

Tres de estas fuentes son **GPL o AGPL** (Blender, CGAL, xeokit) y AxonBIM es
**propietario / All Rights Reserved** ([ADR 0007](../decisions/0007-proprietary-license.md)).
Leer su documentación para entender un patrón es legítimo; **copiar su código no
lo es**. Cualquier fragmento que se plantee incorporar exige auditoría de
licencia previa y decisión explícita.

DXF es documentación propietaria de Autodesk: se puede implementar el formato,
no reproducir el manual.

## Cómo añadir una fuente

1. Que sea oficial o primaria.
2. Rellenar la fila completa — sin licencia y sin fecha, no entra.
3. Declarar el uso prohibido, no sólo el permitido: es lo que evita que la
   siguiente sesión la use para lo que no debe.
4. Si la fuente va a influir en una decisión, además hace falta una ficha.
