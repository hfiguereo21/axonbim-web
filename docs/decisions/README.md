# Decisiones de arquitectura (ADR)

| ADR | Título |
|-----|--------|
| [0001](0001-web-first-local-first.md) | Web-first, local-first |
| [0002](0002-parametric-document-source-of-truth.md) | Documento paramétrico = SoT |
| [0003](0003-ifc-as-interchange-adapter.md) | IFC como adaptador |
| [0004](0004-no-cad-kernel-in-mvp.md) | Sin kernel CAD en MVP |
| [0005](0005-visible-progress-and-vertical-slices.md) | Progreso visible / cortes verticales |
| [0006](0006-controlled-agent-changes.md) | Cambios de agente controlados |
| [0007](0007-proprietary-license.md) | Licencia propietaria |
| [0008](0008-wall-corner-join-extension.md) | Esquinas de muro por inglete (miter) |
| [0009](0009-wall-snap-and-statusbar-toggles.md) | Snap de muro y conmutadores de la barra de estado |
| [0010](0010-doors-first-slice.md) | Puertas — primer corte post-MVP |
| [0011](0011-windows-slice.md) | Ventanas — segundo corte post-MVP |
| [0012](0012-gizmo-real-cameras.md) | Gizmo → cámaras reales (Top/Front/…) |
| [0013](0013-geometry-api-occt-candidate.md) | Geometry API propia; OCCT candidato (parked) |
| [0014](0014-view-cube-orbit-pivot.md) | Gizmo tríada ±ejes, ortho 3D, pivot / hold-orbit |
| [0015](0015-geometric-cameras.md) | Cámaras geométricas (vista 3D ligada) |
| [0016](0016-view-crop-region.md) | Región de recorte de vista (Crop Region; **C3 cerrada**) |
| [0017](0017-domain-invariants-in-commands.md) | Invariantes del documento en dominio (**F9-E cerrada** E1–E6) |
| [0018](0018-wall-vertical-profile.md) | Perfil vertical persistente de muro (`SK-wall-profile-v1` cerrado; `.axon` v2) |
| [0019](0019-kaoru-branch-flow.md) | Flujo de ramas Kaoru (supersede «solo main» de 0006) |
| [0020](0020-rule-precedence-kaoru.md) | Precedencia normativa Kaoru↔AxonBIM (proceso sí, arquitectura no) |
| [0021](0021-engine-independent-of-crm.md) | El motor no depende del CRM (guard en `check:layers`) |
