# Releases y versionado

Procedimiento operativo de [ADR 0023](../decisions/0023-semver-with-kaoru-rules.md),
que decide el esquema. Aquí está el cómo.

## El esquema en una línea

`vMAJOR.MINOR.PATCH` — **SemVer en formato, gobierno de Kaoru**: MAJOR y MINOR
los mueve el dueño a mano por PR; el PATCH lo deriva git y **no se almacena en
ningún archivo**.

| Parte | Quién | Dónde |
|---|---|---|
| MAJOR, MINOR | el dueño, vía PR | archivo `VERSION` en la raíz, formato `MAJOR.MINOR` |
| PATCH | derivado | `git rev-list --count vMAJOR.MINOR.0..main` |

```bash
pnpm version:show     # imprime la versión derivada
pnpm version:check    # falla si no hay tag de línea base — para el proceso de release
```

Un número que hay que acordarse de incrementar acaba desincronizado. Por eso el
PATCH se deriva: es imposible olvidarlo.

**Antes de 1.0 no se usan sufijos de prerelease.** `0.x` ya significa inestable
en SemVer; `-alpha.1` repite la misma información con más sintaxis que mantener.

**El `formatVersion` del `.axon` es independiente** y no se toca al publicar:
entero monotónico, hoy v2 ([ADR 0018](../decisions/0018-wall-vertical-profile.md)).
Producto y formato de datos cambian por motivos distintos.

## Cuándo sube cada parte

| Cambio | Parte |
|---|---|
| Rompe compatibilidad para un consumidor del motor | **MAJOR** |
| Añade capacidad sin romper | **MINOR** |
| Todo lo demás integrado en `main` | **PATCH**, solo |

La salvedad de ADR 0023, repetida aquí para que no sorprenda: **el PATCH no
significa «arreglo de bug»**, significa «cambios integrados desde el último
MINOR». Lo que sí conserva la semántica de SemVer es lo que le importa a quien
consume: romper exige MAJOR y añadir exige MINOR, y **ambos los decide un
humano**.

## Requisitos previos de una release

Ninguno es opcional. Si falta uno, no hay release:

- [ ] El PR está fusionado en `main`.
- [ ] El SHA objetivo existe en `origin/main`.
- [ ] Los checks requeridos están **verdes para ese SHA** — no para uno anterior.
- [ ] `CHANGELOG.md` cortado, con fecha real.
- [ ] Árbol local limpio.
- [ ] Limitaciones conocidas enumeradas en el changelog.
- [ ] **Gate humano de release aprobado** (`gates.md`, G-REL).

## Cortar una release

```bash
# 1. Situarse en el main integrado
git checkout main && git pull --ff-only origin main

# 2. Comprobar que la versión es derivable
pnpm version:check

# 3. Verificación completa sobre ese SHA
pnpm check:docs && pnpm check:links && pnpm check:shortcuts \
  && pnpm check:layers && pnpm check:coverage && pnpm check:guards \
  && pnpm typecheck && pnpm lint && pnpm test && pnpm build

# 4. Tag ANOTADO, nunca ligero
git tag -a "$(pnpm -s version:show)" -m "AxonBIM Web $(pnpm -s version:show)"

# 5. Publicar el tag
git push origin "$(pnpm -s version:show)"
```

El tag va **anotado** (`-a`): lleva autor, fecha y mensaje, y es lo que permite
auditar quién publicó qué. Un tag ligero no deja rastro.

## La primera línea base

Todavía **no existe ningún tag** en el repositorio. Cortar `v0.1.0` es una
decisión con gate humano y no se hace de paso:

```bash
git tag -a v0.1.0 -m "AxonBIM Web v0.1.0 — primera línea base"
git push origin v0.1.0
```

A partir de ahí `pnpm version:show` empieza a derivar el PATCH. Antes de ese
tag, el script informa `v0.1.0+dev.<commits>` y avisa de que no hay línea base;
`version:check` falla, que es lo que impide publicar sin querer.

## Subir MAJOR o MINOR

1. Editar `VERSION` con el nuevo `MAJOR.MINOR`.
2. PR con la justificación: qué rompe (MAJOR) o qué añade (MINOR).
3. Al fusionar, cortar el tag `vMAJOR.MINOR.0`.
4. El PATCH vuelve a contar desde cero, solo.

## Hotfix

Sobre una versión ya publicada que no puede esperar al siguiente corte:

1. Rama `hotfix/…` desde el **tag** afectado, no desde `main`.
2. El arreglo mínimo, con su prueba de regresión.
3. PR a `main` con los checks verdes.
4. Tag nuevo desde el `main` resultante.

No se publica un tag desde una rama sin integrar: el tag debe apuntar a un
commit que esté en `main`.

## Rollback

Un tag publicado **no se borra ni se reescribe**. Si una versión sale mala:

1. Arreglar en `main` por el camino normal.
2. Cortar un tag nuevo.
3. Anotar en `CHANGELOG.md` qué versión quedó desaconsejada y por qué.

Borrar un tag rompe a cualquiera que ya lo tenga y no arregla nada.

## Changelog

`CHANGELOG.md` mantiene `## Unreleased` arriba. Al cortar, esa sección pasa a
`## [vX.Y.Z] — AAAA-MM-DD` y se abre una `Unreleased` vacía.

Agrupar por **Added / Changed / Fixed / Removed**, describiendo el efecto para
quien usa el producto, no el archivo que se tocó.

## Lo que falta

- **La protección de `main` no está activa.** Verificado: la API responde
  `Branch not protected`. Todo este procedimiento asume que los checks bloquean
  el merge; hasta que exista, esa garantía la sostiene la disciplina, no el
  servidor. Es el gate **G-GIT** de `gates.md`.
- La versión derivada no se inyecta todavía en la aplicación. `version:show` la
  imprime; embeberla en el build es trabajo aparte.
