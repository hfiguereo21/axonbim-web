# Referencias técnicas externas

**Estado documental: REFERENCIA.** Nada de lo que hay aquí es normativo.
La autoridad vive en los no negociables, los contratos internos y las ADR —
en ese orden. Ver [ADR 0022](../decisions/0022-technical-reference-governance.md).

## Para qué sirve

Antes de diseñar una capacidad nueva, comprobar cómo la resolvieron proyectos
maduros: qué datos usan, qué invariantes protegen, qué patrón de interacción
emplean y con qué pruebas lo demuestran. El objetivo es **no volver a descubrir
lo que ya está resuelto**, y a la vez no copiar arquitectura ajena.

## Para qué NO sirve

- No autoriza implementar nada. Una ficha que concluya «adoptar X» habilita
  **proponer un ADR**, no instalar X.
- No sustituye un contrato. Ninguna fuente externa entra en `model`, `commands`,
  `geometry`, `tools`, `viewer` o `persistence` sin traducción propia.
- No abre lo que sigue parked: IFC, DXF, OpenCascade, Edit Mode, Push/Pull y
  losas conservan su gate.
- No introduce dependencias del CRM anfitrión en `packages/*` — ADR 0021 y su
  guard en `check:layers` mandan sobre cualquier ficha.

## Cuándo consultarlo

Cuando la tarea sea **diseñar una capacidad**, **evaluar una dependencia** o
**resolver una decisión técnica** con más de una salida razonable. No es lectura
de cada sesión: se entra por este índice y se leen sólo las fichas aplicables.

## Flujo de uso

1. Definir el problema de producto **sin nombrar todavía ninguna biblioteca**.
2. Leer los contratos y ADR vigentes que apliquen.
3. Elegir las fuentes relacionadas en [`source-register.md`](source-register.md).
4. Completar una ficha por patrón relevante con
   [`templates/reference-assessment.md`](templates/reference-assessment.md).
5. Contrastar los invariantes externos con los de AxonBIM.
6. Si hay conflicto con un contrato o ADR: **detenerse y proponer ADR**.
7. Redactar la especificación AxonBIM, independiente de la fuente.
8. Definir oráculos y pruebas antes de implementar.
9. Pedir autorización del corte.

El paso 7 es el que no se puede saltar: **entre la fuente y el código siempre
hay una especificación propia**.

## Mapa

| Documento | Qué contiene |
|---|---|
| [`source-register.md`](source-register.md) | Las fuentes admitidas: URL oficial, fecha consultada, licencia, y qué usos permite cada una |
| [`adoption-matrix.md`](adoption-matrix.md) | Qué patrón se adoptó, adaptó, rechazó o aplazó, y a qué contrato de AxonBIM se tradujo |
| [`templates/reference-assessment.md`](templates/reference-assessment.md) | La ficha de evaluación, 13 campos |
| [`pilots/wall-profile-reference-study.md`](pilots/wall-profile-reference-study.md) | Primer piloto: edición del perfil vertical de muro. Problema medido, comportamiento objetivo y pruebas — sin implementación |

## Estados de una ficha

| Estado | Significado |
|---|---|
| **ADOPTAR** | El patrón entra tal cual en un contrato propio |
| **ADAPTAR** | Entra traducido; la ficha explica qué se cambió y por qué |
| **RECHAZAR** | No aplica a AxonBIM; la ficha explica el motivo para no reabrirlo |
| **APLAZAR** | Aplicable pero fuera de alcance; queda con su gate |
| **VERIFICAR** | Falta evidencia; la ficha dice qué evidencia haría falta |

Un estado sin motivo escrito no es un estado: es una opinión.
