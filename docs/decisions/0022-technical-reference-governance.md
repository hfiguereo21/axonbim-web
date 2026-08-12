# ADR 0022 — Gobernanza de referencias técnicas externas (REF-0)

## Estado

**Aceptado 2026-08-12.** No supersede ninguna decisión previa. Complementa
[ADR 0006](0006-controlled-agent-changes.md) (cambios controlados) y
[ADR 0021](0021-engine-independent-of-crm.md) (independencia del motor).

## Contexto

El desarrollo de AxonBIM ha avanzado por exploración empírica: el agente razona
el problema, propone una solución y se valida contra pruebas. Funciona para
prototipar y ha producido resultados, pero tiene cuatro debilidades que ya se
notan:

- la calidad depende del razonamiento puntual de una sesión;
- problemas que proyectos maduros resolvieron hace veinte años se vuelven a
  descubrir desde cero;
- los criterios cambian entre sesiones si no se convierten en contrato;
- que algo compile y pase los tests se confunde con que la decisión
  arquitectónica sea correcta.

Existe una biblioteca enorme de conocimiento aplicable —Blender, FreeCAD,
IfcOpenShell, buildingSMART, OpenCascade, CGAL, Three.js— y hoy no hay ninguna
forma establecida de consultarla. Consultarla sin método tiene su propio riesgo:
que «Blender lo hace así» se convierta en código sin pasar por el contrato
propio.

## Decisión

1. **Se crea una capa documental de referencias externas** en
   `docs/references/`, con autoridad **consultiva**.
2. **La autoridad se ordena así**, y no admite atajos:
   1. visión, alcance y no negociables de AxonBIM;
   2. contratos internos (`model`, `commands`, `geometry`, `tools`, `viewer`,
      `persistence`);
   3. ADR aceptadas y gates humanos;
   4. referencias externas calificadas.
3. **Una fuente externa puede justificar una decisión; nunca se convierte en
   contrato de AxonBIM por sí sola.** El paso de «esta aplicación lo hace así» a
   código está prohibido sin traducción explícita a contrato propio.
4. **Toda referencia que influya en una decisión se registra** mediante la ficha
   de `docs/references/templates/reference-assessment.md`, con decisión
   **ADOPTAR / ADAPTAR / RECHAZAR / APLAZAR / VERIFICAR**.
5. **No es lectura permanente.** `AGENTS.md` indexa únicamente
   `docs/references/README.md`, y se consulta cuando la tarea lo justifique:
   diseñar una capacidad nueva, evaluar una dependencia o resolver una decisión
   técnica. No se carga en cada sesión.
6. **No se copian manuales ni código externo.** Se guardan resúmenes con
   redacción propia, URL, fecha de consulta y licencia. Cualquier código
   incorporado exige auditoría de licencia previa.

## Consecuencias

- Diseñar una función nueva pasa a costar una ficha más. Es deliberado: el coste
  se paga una vez y evita rediseñar por tercera vez algo que ya estaba resuelto.
- **No autoriza nada de lo que sigue parked**: IFC, DXF, OpenCascade, Edit Mode,
  Push/Pull y losas continúan requiriendo su propia autorización. Una ficha que
  concluya «adoptar OCCT» no habilita instalarlo; habilita **proponer** un ADR.
- Una referencia **jamás** puede introducir en `packages/*` una dependencia del
  CRM anfitrión: ADR 0021 y su guard en `check:layers` mandan sobre cualquier
  ficha.
- `check:docs` exige que todo doc permanente sea alcanzable desde el índice. La
  biblioteca cuelga de un único punto de entrada para satisfacerlo sin inflar
  `AGENTS.md`.

## Fuera de este ADR (autorización aparte)

- **Instalar hooks, permisos, settings, skills o subagentes** de Claude Code
  para automatizar esta gobernanza. Se propone por separado y por acción.
- **Migrar `.cursor/rules/`** a otro formato. Hoy `CLAUDE.md` es canónico y las
  `.mdc` su espejo; cambiarlo es otro trabajo.
- Implementar cualquier capacidad que una ficha recomiende.

## Alternativas descartadas

**Una regla permanente en el contexto del agente.** Cargaría el método en cada
sesión aunque la tarea no lo necesite, y consumiría contexto sin aportar. El
índice bajo demanda hace lo mismo cuando hace falta.

**No documentar y confiar en el criterio del agente.** Es el estado actual, y es
el problema que este ADR corrige: sin registro, cada sesión reabre decisiones
cerradas.

**Adoptar directamente la arquitectura de un proyecto maduro** (Bonsai usa IFC
en memoria como fuente de verdad, FreeCAD usa OCCT). Contradice los no
negociables: `AxonDocument` es la fuente de verdad y OCCT sigue aplazado.

## Referencias

- Índice de la biblioteca: [`../references/README.md`](../references/README.md)
- Cambios controlados: [ADR 0006](0006-controlled-agent-changes.md)
- Independencia del motor: [ADR 0021](0021-engine-independent-of-crm.md)
- Gobernanza documental: [`../product/doc-governance.md`](../product/doc-governance.md)
