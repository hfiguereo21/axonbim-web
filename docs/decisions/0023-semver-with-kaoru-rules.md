# ADR 0023 — SemVer con las reglas de versionado de Kaoru

## Estado

**Aceptado 2026-08-12.** Modifica el esquema declarado en `CLAUDE.md` §6 y es una
**excepción explícita** a [ADR 0020](0020-rule-precedence-kaoru.md), que sitúa el
versionado entre las materias donde prevalece la norma preexistente del CRM
anfitrión.

## Contexto

`CLAUDE.md` §6 adoptó el esquema del anfitrión: `v<MAJOR>.<MINOR>.<BUILD>`, con
MAJOR y MINOR manuales y BUILD derivado de git. Se adoptó por coherencia de
proceso entre los dos proyectos, no por análisis del caso de AxonBIM.

Ese esquema comunica **cuándo** se construyó algo, no **qué compatibilidad**
ofrece. Para una aplicación de línea de negocio desplegada por su dueño eso
basta: quien la usa la recibe entera y no depende de sus internos.

AxonBIM no está en ese caso. [ADR 0021](0021-engine-independent-of-crm.md)
establece que el motor debe poder extraerse en cualquier momento y que su
conexión con el anfitrión vive en una capa adaptadora fuera de `packages/*`. Un
motor extraíble es una biblioteca, y una biblioteca tiene consumidores que
necesitan saber si una versión rompe la anterior. `v1.04.0102` no dice nada de
eso; `v1.4.0 → v2.0.0` sí.

El repositorio no tiene todavía ningún tag: la primera versión nace de cero, y
es el momento barato para elegir bien.

## Decisión

1. **El formato es SemVer**: `vMAJOR.MINOR.PATCH`.
2. **El gobierno es el de Kaoru**, sin cambios:
   - **MAJOR y MINOR son manuales**, los decide el dueño y entran por PR.
   - **PATCH se deriva de git**, no se almacena. La historia es la fuente de
     verdad, igual que el BUILD del anfitrión.
3. **Derivación del PATCH:** número de commits en `main` desde el tag
   `vMAJOR.MINOR.0`.

   ```bash
   git rev-list --count "v${MAJOR}.${MINOR}.0..main"
   ```

   Con la protección de rama en vigor —PR obligatorio, historia lineal, merge
   por squash— cada PR fusionado es exactamente un commit en `main`, así que el
   PATCH cuenta cambios integrados, que es lo que el BUILD de Kaoru cuenta con
   números de PR.
4. **MAJOR y MINOR viven en un archivo `VERSION`** en la raíz, con formato
   `MAJOR.MINOR`. Mismo mecanismo que el anfitrión. Los `package.json` del
   workspace **no** son la fuente de verdad de la versión de producto.
5. **Antes de 1.0 no se usan sufijos de prerelease.** `0.x` ya significa
   inestable en SemVer; añadir `-alpha.1` repite la misma información con más
   sintaxis que mantener.
6. **El `formatVersion` del `.axon` sigue siendo independiente** y no se toca:
   entero monotónico, hoy v2 ([ADR 0018](0018-wall-vertical-profile.md)). La
   versión del producto y la del formato de datos cambian por motivos distintos
   y no deben acoplarse.

## Consecuencias

- Un consumidor del motor puede leer compatibilidad en el número. Es la ganancia
  y el motivo de la excepción.
- **El PATCH no significa «arreglo de bug»**, como manda SemVer estricto:
  significa «cambios integrados desde el último MINOR». Se declara aquí para que
  nadie lo interprete de más. Lo que sí conserva la semántica de SemVer es lo
  que importa para un consumidor: **romper compatibilidad exige MAJOR y añadir
  capacidad exige MINOR**, y ambos los decide un humano.
- Divergimos del anfitrión en el formato de la versión. Es una excepción
  documentada, no un descuido, y **no se extiende a ninguna otra materia** de
  ADR 0020: commits, ramas, pruebas, docs, secretos, promoción de ambientes y
  conducta del agente siguen rigiéndose por la norma preexistente de Kaoru.
- El día que ambos proyectos compartan monorepo habrá que decidir si conviven
  dos esquemas o se unifica. Este ADR no lo prejuzga.

## Alternativas descartadas

**Mantener `v<MAJOR>.<MINOR>.<BUILD>` del anfitrión.** Es lo que ADR 0020 pide
por defecto y tiene la ventaja de la uniformidad. Se descarta porque no comunica
compatibilidad y AxonBIM se declara extraíble: cumpliría la letra de la
precedencia contradiciendo lo que ADR 0021 promete.

**SemVer puro, con PATCH manual.** Es lo que propuso el paquete de auditoría
externa, con `v0.1.0-alpha.1` como línea base. Se descarta la parte manual
porque obliga a recordar incrementarlo en cada cambio, y un número que depende
de la memoria acaba desincronizado. Derivarlo de git lo hace imposible de
olvidar.

**Versionar cada paquete del workspace por separado.** Diez versiones
independientes para un motor que se libera junto. Se descarta hasta que exista
un consumidor real que dependa de un paquete suelto.

## Pendiente

- `docs/roadmap/releases.md` con el procedimiento operativo: requisitos previos,
  corte de changelog, tags anotados, hotfix y rollback.
- Adaptar el `dev:sync-version` del anfitrión —que inyecta la versión derivada—
  a un script `pnpm` equivalente. Es la deuda que `CLAUDE.md` §6 ya anotaba.
- La primera línea base (`0.1`) requiere gate humano y no se corta en este ADR.

## Referencias

- Precedencia normativa: [ADR 0020](0020-rule-precedence-kaoru.md)
- Motor extraíble: [ADR 0021](0021-engine-independent-of-crm.md)
- Formato de datos: [ADR 0018](0018-wall-vertical-profile.md)
- Especificación SemVer 2.0.0: https://semver.org/ (consultada 2026-08-12)
