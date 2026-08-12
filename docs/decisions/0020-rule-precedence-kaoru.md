# ADR 0020 — Precedencia normativa entre Kaoru CRM y AxonBIM

## Estado

**Aceptado 2026-08-12.** Complementa [ADR 0019](0019-kaoru-branch-flow.md); no supersede ninguna
decisión previa. Fija el criterio de resolución cuando los dos cuerpos de reglas concurren.

## Contexto

AxonBIM se integra a Kaoru CRM y cada proyecto mantiene su propio cuerpo de reglas
(`CLAUDE.md` en cada repositorio). Hasta ahora la relación entre ambos se resolvía por
**exclusión**: `CLAUDE.md` §9 declara qué normas Kaoru-específicas *no*
aplican aquí (las de su stack y su operación).

La exclusión no cubre el caso de **concurrencia**: dos normas que hablan del mismo asunto y
difieren en el criterio. Sin una regla de precedencia, el mismo trabajo admite dos lecturas
igualmente defendibles y cada agente puede escoger la que le resulte cómoda. ADR 0019 ya resolvió
un caso puntual de este tipo (ramas) por decisión individual; conviene generalizar el criterio en
lugar de repetir la deliberación en cada choque.

## Decisión

1. **Las normas son acumulativas.** En `axonbim-web` rigen sus propias reglas y, adicionalmente,
   las de Kaoru CRM. Que una materia no esté tratada aquí no significa que carezca de norma: se
   consulta la de Kaoru.
2. **Ante contradicción prevalece la norma preexistente de Kaoru CRM**, por ser el proyecto
   anfitrión de la integración y el que fijó primero su marco.
3. **Ámbito de la precedencia: proceso y gobernanza.** Commits, ramas, pruebas, documentación,
   secretos, versionado, promoción de ambientes y conducta del agente.
4. **La precedencia no alcanza al stack ni a la arquitectura.** Cada proyecto conserva la suya.
   AxonBIM mantiene `AxonDocument` como única fuente de verdad, dominio TypeScript puro y un solo
   runtime, conforme a ADR 0001–0002 y a los principios no negociables. Una modificación
   arquitectónica exige su propio ADR (no negociable 13), nunca la aplicación indirecta de esta
   precedencia.
5. **La precedencia no relaja una norma más estricta de AxonBIM.** Cuando ambas persiguen el mismo
   fin y AxonBIM es más exigente por una razón documentada, se conserva la más exigente. Caso
   vigente: el remoto de AxonBIM es **público** y el de Kaoru **privado**; §5 (cero secretos,
   detenerse y avisar antes de subir cualquiera) se mantiene íntegro.

## Consecuencias

Efectos verificados sobre la integridad del proyecto:

- Los **21 principios no negociables** quedan intactos. Cuatro de ellos (documento como SoT, Three
  no es SoT, React no muta, dominio puro) no dependen de texto: los verifica
  `scripts/check-layer-purity.mjs` en `ci.yml`, que prohíbe a las capas de dominio importar
  `react`, `zustand`, `three`, `@axonbim/viewer`, `@axonbim/web` o globales del navegador.
- La **primacía del producto** (ADR 0006, no negociable 21) sale reforzada: las guidelines de
  Kaoru mandan explicitar tradeoffs, proponer el enfoque más simple y detenerse ante lo confuso.
- `check:history` sólo falla ante *force-push* o reescritura de historia en `main`, no ante
  merges: el flujo de PR de ADR 0019 es compatible.

Normas de Kaoru que pasan a regir aquí y antes no tenían equivalente:

- **Promoción de ambientes:** `localhost` es el destino por defecto. No se propone ni se ejecuta
  un despliegue a ningún servidor sin orden explícita del dueño.
- **Versionado de producto:** `v<MAJOR>.<MINOR>.<BUILD>` (`CLAUDE.md` §6). El `formatVersion` del
  `.axon` es un contrato de datos independiente y no se ve afectado.
- **Autoría de commits:** sin *trailer* `Co-Authored-By` de asistentes de IA; firma el autor humano.

Canónico: `CLAUDE.md` §9. Espejo: `.cursor/rules/10-agent-behavior.mdc`.

## Fuera de este ADR (autorización aparte)

- La integración técnica axonbim↔Kaoru (cómo el `.axon` local-first se conecta a un backend con
  base de datos) sigue pendiente de su propio ADR, según lo anunciado en ADR 0019.
- Las normas Kaoru-específicas de stack permanecen excluidas.

## Referencias

- Complementa: [ADR 0019](0019-kaoru-branch-flow.md)
- Primacía del producto: [ADR 0006](0006-controlled-agent-changes.md)
- Principios no negociables: [`../product/non-negotiables.md`](../product/non-negotiables.md)
