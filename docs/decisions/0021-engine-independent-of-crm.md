# ADR 0021 — El motor no depende del CRM anfitrión

## Estado

**Aceptado 2026-08-12.** Complementa [ADR 0020](0020-rule-precedence-kaoru.md): aquélla fija la
precedencia de *normas*, ésta la frontera de *código*. No supersede ninguna decisión previa.

## Contexto

AxonBIM se integra a Kaoru CRM, pero el motor debe **poder correr aparte**: fuera del CRM, sin
sesión, sin empresa y sin base de datos. Esa capacidad no es un lujo — es lo que permite
desarrollar, probar y demostrar el modelador sin levantar el stack completo del CRM, y lo que
deja abierta la salida si la integración cambia de forma.

Nada lo garantizaba. Un `import` desde el viewer hacia un servicio del CRM compila igual, pasa los
tests igual y no rompe nada visible el día que se escribe. El acoplamiento no se nota hasta que
alguien intenta extraer el motor y descubre que arrastra media aplicación. Es exactamente el
patrón que ya se documentó en el hallazgo D2: *el dominio estaba limpio por costumbre, no porque
algo lo verificara*.

## Decisión

1. **Los paquetes del motor (`packages/*`) no dependen de nada de Kaoru.** Ni autenticación, ni
   `company_id`/`tenant_id`, ni SQL embebido, ni componentes o alias de import de su frontend.
2. **El motor persiste a `.axon`**, no a un tenant ni a una base de datos. El contrato de datos
   sigue siendo el `formatVersion` del propio archivo (ADR 0018).
3. **Toda la conexión con el CRM vive en una capa adaptadora, afuera del motor.** `apps/web` y
   cualquier cáscara futura pueden hospedarla; `packages/*` no.
4. La regla cubre los ocho paquetes, no sólo `viewer` y `tools`: si `model` o `persistence`
   pudieran importar Kaoru, la promesa de extraer el motor sería falsa.

## Consecuencias

- **El motor se puede extraer en cualquier momento.** Ésa es la ganancia, y es la razón de ser de
  la decisión.
- **El costo es escribir esa capa adaptadora.** Todo lo que el CRM necesite del modelador —
  identidad de empresa, permisos, almacenamiento remoto, telemetría — se traduce afuera. Lo que
  antes habría sido un `import` de una línea pasa a ser una función de frontera explícita.
- Un requisito del CRM que exija tocar `packages/*` es señal de que falta capa adaptadora, no de
  que sobre la regla.

## Enforcement

Un ADR es un documento: dentro de seis meses, con prisa, alguien mete ese `import` y nadie se
entera. La garantía es el chequeo automático.

`scripts/check-layer-purity.mjs` recorre los `.ts/.tsx` **trackeados** de `packages/` y falla con
exit 1 ante:

- **Especificadores del CRM:** `@kaoru/*`, los alias de su frontend (`$services`, `$signals`,
  `$components`, `$pages`, `$hooks`, `$interceptors`, `$sdui`), `devextreme`, y su backend
  (`hono`, `prisma`, `@prisma/client`, `pg`, `postgres`, `keycloak-js`).
- **Identidades del CRM:** `company_id`, `tenant_id`, `kc_subject`, `access_id`,
  `permission_interface`.
- **SQL embebido:** `SELECT … FROM`, `INSERT INTO`, `UPDATE … SET`, `CREATE FUNCTION`.

Corre en cada commit vía `pnpm check:layers` (`.github/workflows/ci.yml`). Comprobado en los
cuatro escenarios antes de aceptar el ADR: caza el import prohibido, el identificador y el SQL, y
**no** se dispara con un comentario que los mencione — un guard que da falsos positivos termina
apagado.

`apps/web` queda fuera del chequeo a propósito: es donde la capa adaptadora tiene permiso de
existir.

## Fuera de este ADR (autorización aparte)

- **Cómo** se conecta el `.axon` local-first a un backend con base de datos: sigue pendiente de su
  propio ADR, ya anunciado en ADR 0019 y 0020.
- La forma concreta de la capa adaptadora (contrato, dirección de las dependencias) se decidirá
  cuando exista un requisito real del CRM que la necesite.

## Referencias

- Precedencia normativa: [ADR 0020](0020-rule-precedence-kaoru.md)
- Fronteras de capas: [`../architecture/overview.md`](../architecture/overview.md)
- Principios no negociables: [`../product/non-negotiables.md`](../product/non-negotiables.md)
- Guard: `scripts/check-layer-purity.mjs`
