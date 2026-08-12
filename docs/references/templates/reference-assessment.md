# Plantilla — ficha de evaluación de referencia

**Estado documental: REFERENCIA.** Ver [README](../README.md).

Copiar este archivo a la carpeta temática que corresponda y rellenar los trece
campos. Un campo vacío es una pregunta sin responder, no un detalle de formato:
la ficha existe para que la decisión sea auditable dentro de seis meses.

---

## 1. Fuente

Nombre, versión o fecha de publicación, y URL oficial. Debe estar en
[`../source-register.md`](../source-register.md); si no está, añadirla primero.

## 2. Licencia y restricciones

Licencia de la fuente y qué implica. Si es GPL/AGPL, decirlo aquí: se puede leer
para entender un patrón, no se puede copiar el código a un producto propietario
([ADR 0007](../../decisions/0007-proprietary-license.md)).

## 3. Problema que resuelve

En el dominio de la fuente, no en el nuestro. Sin traducir todavía.

## 4. Datos que utiliza

Qué entradas necesita el mecanismo: estructuras, identidades, estado previo.

## 5. Mecanismo observado

Cómo lo hace. Descrito con redacción propia — no pegar documentación ajena.

## 6. Invariantes y precondiciones

Qué garantiza y qué asume. Es el campo más útil de la ficha: los invariantes
viajan entre arquitecturas aunque el código no.

## 7. Supuestos, límites y fallos conocidos

Dónde se rompe, qué casos no cubre, qué deuda arrastra. Una fuente madura
documenta sus límites; si no los encuentras, dilo.

## 8. Componentes de AxonBIM afectados

`model`, `commands`, `geometry`, `tools`, `viewer`, `persistence`, UI. Sé
concreto: qué archivo o contrato.

## 9. Conflicto con contratos o ADR vigentes

Revisar no negociables, contratos y ADR. **Si hay conflicto, la ficha se detiene
aquí y se propone un ADR.** No se resuelve un conflicto dentro de una ficha.

## 10. Decisión

**ADOPTAR · ADAPTAR · RECHAZAR · APLAZAR · VERIFICAR** — y el motivo. Un estado
sin motivo escrito no es un estado.

## 11. Traducción a contrato AxonBIM

El campo que no se puede saltar. Qué queda escrito en **nuestro** lenguaje:
entidades, comandos, invariantes, errores. Si no se puede redactar sin nombrar
la fuente, la traducción no está hecha.

## 12. Oráculos y pruebas

Cómo se demostrará que la implementación futura es correcta: unitarias, de
integración, y qué debe validar un humano. Antes de implementar, no después.

## 13. Evidencia pendiente

Qué falta por comprobar y qué autorización hace falta para seguir.
