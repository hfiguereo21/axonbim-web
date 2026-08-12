import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isSketchDrawMode, isSketchTool, type DrawMode } from "@axonbim/tools";
import type { RibbonTab } from "../session/sessionTypes";
import { useSessionStore } from "../sessionStore";
import { Icon } from "./RibbonIcons";

const TABS: { id: RibbonTab; label: string }[] = [
  { id: "architecture", label: "Arquitectura" },
  { id: "structure", label: "Estructura" },
  { id: "insert", label: "Insertar" },
  { id: "annotate", label: "Anotar" },
  { id: "analyze", label: "Analizar" },
  { id: "massing", label: "Masas" },
  { id: "collaborate", label: "Colaborar" },
  { id: "view", label: "Vista" },
  { id: "manage", label: "Gestionar" },
  { id: "modify", label: "Modificar" },
];

const DRAW_MODES: { id: DrawMode; icon: string; tip: string }[] = [
  { id: "line", icon: "line", tip: "Línea" },
  { id: "rectangle", icon: "rect", tip: "Rectángulo" },
  { id: "arcSER", icon: "arc", tip: "Arco I-F-R" },
  { id: "arcCE", icon: "arc", tip: "Arco centro" },
  { id: "pickLines", icon: "pickLines", tip: "Seleccionar líneas" },
  { id: "pickFace", icon: "pickFace", tip: "Seleccionar cara" },
];

type TipState = { text: string; x: number; y: number } | null;
type TipHandlers = {
  show: (el: HTMLElement, text: string) => void;
  hide: () => void;
};

function Stub({
  icon,
  label,
  tip,
  tips,
}: {
  icon: string;
  label: string;
  /** Short hover text, e.g. "Puerta" */
  tip?: string;
  tips: TipHandlers;
}) {
  const text = tip ?? label;
  return (
    <button
      type="button"
      className="ribbon__tool"
      disabled
      aria-label={label}
      onMouseEnter={(e) => tips.show(e.currentTarget, text)}
      onMouseLeave={tips.hide}
      onFocus={(e) => tips.show(e.currentTarget, text)}
      onBlur={tips.hide}
    >
      <Icon name={icon} />
    </button>
  );
}

function Tool({
  icon,
  label,
  tip,
  onClick,
  active,
  tips,
}: {
  icon: string;
  label: string;
  tip?: string;
  onClick: () => void;
  active?: boolean;
  tips: TipHandlers;
}) {
  const text = tip ?? label;
  return (
    <button
      type="button"
      className={active ? "ribbon__tool ribbon__tool--on" : "ribbon__tool"}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      onMouseEnter={(e) => tips.show(e.currentTarget, text)}
      onMouseLeave={tips.hide}
      onFocus={(e) => tips.show(e.currentTarget, text)}
      onBlur={tips.hide}
    >
      <Icon name={icon} />
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ribbon__group">
      <div className="ribbon__group-tools">{children}</div>
      <span className="ribbon__group-label">{title}</span>
    </div>
  );
}

export function Ribbon() {
  const ribbonTab = useSessionStore((s) => s.ribbonTab);
  const setRibbonTab = useSessionStore((s) => s.setRibbonTab);
  const setTool = useSessionStore((s) => s.setTool);
  const activeTool = useSessionStore((s) => s.activeTool);
  const drawMode = useSessionStore((s) => s.drawMode);
  const editingParadigm = useSessionStore((s) => s.editingParadigm);
  const sketchTarget = useSessionStore((s) => s.sketchTarget);
  const sketchModifyMode = useSessionStore((s) => s.sketchModifyMode);
  const setSketchModifyMode = useSessionStore((s) => s.setSketchModifyMode);
  const redrawSketchProfile = useSessionStore((s) => s.redrawSketchProfile);
  const deleteSelectedProfileVertex = useSessionStore(
    (s) => s.deleteSelectedProfileVertex,
  );
  const setDrawMode = useSessionStore((s) => s.setDrawMode);
  const cancelWallDraw = useSessionStore((s) => s.cancelWallDraw);
  const enterSketchOnSelection = useSessionStore((s) => s.enterSketchOnSelection);
  const finishSketchOnSelection = useSessionStore((s) => s.finishSketchOnSelection);
  const exitSketchOnSelection = useSessionStore((s) => s.exitSketchOnSelection);
  const resetWorkplaneToLevel = useSessionStore((s) => s.resetWorkplaneToLevel);
  const activeWorkplane = useSessionStore((s) => s.activeWorkplane);
  const wallCount = useSessionStore((s) => s.document.walls.length);
  const wallChain = useSessionStore((s) => s.wallChain);
  const setWallChain = useSessionStore((s) => s.setWallChain);
  const splitWallChain = useSessionStore((s) => s.splitWallChain);
  const releaseWallChain = useSessionStore((s) => s.releaseWallChain);
  const restartChainAt = useSessionStore((s) => s.restartChainAt);
  const wallHover = useSessionStore((s) => s.wallHover);
  const wallPending = useSessionStore((s) => s.wallPending);
  const addView = useSessionStore((s) => s.addView);
  const requestFitView = useSessionStore((s) => s.requestFitView);
  const newProject = useSessionStore((s) => s.newProject);
  const openDemo = useSessionStore((s) => s.openDemo);

  const browserVisible = useSessionStore((s) => s.browserVisible);
  const propertiesVisible = useSessionStore((s) => s.propertiesVisible);
  const systemBrowserVisible = useSessionStore((s) => s.systemBrowserVisible);
  const iconBarVisible = useSessionStore((s) => s.iconBarVisible);
  const statusBarVisible = useSessionStore((s) => s.statusBarVisible);
  const setPanelVisible = useSessionStore((s) => s.setPanelVisible);
  const setSystemBrowserVisible = useSessionStore((s) => s.setSystemBrowserVisible);
  const setIconBarVisible = useSessionStore((s) => s.setIconBarVisible);
  const setStatusBarVisible = useSessionStore((s) => s.setStatusBarVisible);

  const [tip, setTip] = useState<TipState>(null);
  const show = useCallback((el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    setTip({
      text,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top - 6),
    });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const tips: TipHandlers = { show, hide };

  const sketching = isSketchTool(activeTool) || sketchTarget != null;
  /** Modificar: seleccionar plano con geometría o trazo (precursor model-in-place). */
  const modifyWorkplaneSelect = wallCount > 0 || sketching;
  const modifyTabLabel =
    activeTool === "door"
      ? "Modificar | Colocar puerta"
      : activeTool === "window"
        ? "Modificar | Colocar ventana"
        : sketching && activeTool === "wall"
          ? "Modificar | Colocar muro"
          : sketching
            ? "Modificar | Trazar"
            : "Modificar";

  return (
    <div className="ribbon">
      <div className="ribbon__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={
              ribbonTab === tab.id ? "ribbon__tab ribbon__tab--active" : "ribbon__tab"
            }
            aria-selected={ribbonTab === tab.id}
            onClick={() => setRibbonTab(tab.id)}
          >
            {tab.id === "modify" ? modifyTabLabel : tab.label}
          </button>
        ))}
      </div>

      <div className="ribbon__panels">
        {ribbonTab === "architecture" && (
          <>
            <Group title="Construir">
              <Tool tips={tips} icon="wall" label="Muro" tip="Muro" active={activeTool === "wall"} onClick={() => setTool("wall")} />
              <Tool tips={tips} icon="door" label="Puerta" tip="Puerta" active={activeTool === "door"} onClick={() => setTool("door")} />
              <Tool tips={tips} icon="window" label="Ventana" tip="Ventana" active={activeTool === "window"} onClick={() => setTool("window")} />
              <Stub tips={tips} icon="component" label="Componente" tip="Componente" />
              <Stub tips={tips} icon="column" label="Columna" tip="Columna" />
              <Stub tips={tips} icon="roof" label="Cubierta" tip="Cubierta" />
              <Stub tips={tips} icon="ceiling" label="Techo" tip="Techo" />
              <Stub tips={tips} icon="floor" label="Suelo" tip="Suelo" />
              <Stub tips={tips} icon="curtain" label="Muro cortina" tip="Muro cortina" />
            </Group>
            <Group title="Plano de trabajo">
              <Tool
                tips={tips}
                icon="pickFace"
                label="Seleccionar"
                tip="Seleccionar plano — cara de muro o vacío = nivel (base para model-in-place)"
                active={activeTool === "workplaneSelect"}
                onClick={() => setTool("workplaneSelect")}
              />
              <Tool
                tips={tips}
                icon="line"
                label="Dibujar"
                tip="Dibujar plano de trabajo — 2 clics → plano vertical en XYZ"
                active={activeTool === "workplaneLine"}
                onClick={() => setTool("workplaneLine")}
              />
              <Tool
                tips={tips}
                icon="finish"
                label="Nivel"
                tip={`Volver al plano del nivel (${activeWorkplane?.label ?? "—"})`}
                active={activeWorkplane?.kind === "storey"}
                onClick={() => resetWorkplaneToLevel()}
              />
            </Group>
            <Group title="Circulación">
              <Stub tips={tips} icon="rail" label="Barandilla" tip="Barandilla" />
              <Stub tips={tips} icon="ramp" label="Rampa" tip="Rampa" />
              <Stub tips={tips} icon="stair" label="Escalera" tip="Escalera" />
            </Group>
            <Group title="Modelo">
              <Stub tips={tips} icon="line" label="Línea de modelo" tip="Línea de modelo" />
              <Stub tips={tips} icon="group" label="Grupo de modelo" tip="Grupo" />
              <Stub tips={tips} icon="text" label="Texto de modelo" tip="Texto" />
            </Group>
            <Group title="Habitación">
              <Stub tips={tips} icon="room" label="Habitación" tip="Habitación" />
              <Stub tips={tips} icon="area" label="Área" tip="Área" />
              <Stub tips={tips} icon="separator" label="Separador" tip="Separador" />
              <Stub tips={tips} icon="fill" label="Relleno de color" tip="Relleno" />
            </Group>
            <Group title="Hueco">
              <Stub tips={tips} icon="opening" label="Por cara" tip="Hueco por cara" />
              <Stub tips={tips} icon="opening" label="Hueco en muro" tip="Hueco en muro" />
              <Stub tips={tips} icon="opening" label="Hueco de pozo" tip="Hueco de pozo" />
            </Group>
          </>
        )}

        {ribbonTab === "structure" && (
          <Group title="Estructura">
            <Stub tips={tips} icon="beam" label="Viga" tip="Viga" />
            <Stub tips={tips} icon="column" label="Pilar" tip="Pilar" />
            <Stub tips={tips} icon="floor" label="Losa" tip="Losa" />
            <Stub tips={tips} icon="foundation" label="Cimentación" tip="Cimentación" />
            <Stub tips={tips} icon="rebar" label="Refuerzo" tip="Refuerzo" />
          </Group>
        )}

        {ribbonTab === "insert" && (
          <>
            <Group title="Vínculo">
              <Stub tips={tips} icon="link" label="Vincular" tip="Vincular (stub)" />
              <Stub tips={tips} icon="link" label="Vincular CAD" tip="Vincular CAD" />
              <Stub tips={tips} icon="cloud" label="Nube de puntos" tip="Nube de puntos" />
            </Group>
            <Group title="Importar">
              <Stub tips={tips} icon="import" label="Importar CAD" tip="Importar CAD" />
              <Stub tips={tips} icon="import" label="Imagen" tip="Imagen" />
              <Stub tips={tips} icon="sheet" label="PDF" tip="PDF" />
            </Group>
            <Group title="Cargar">
              <Stub tips={tips} icon="load" label="Cargar familia" tip="Cargar familia" />
              <Stub tips={tips} icon="group" label="Cargar como grupo" tip="Cargar grupo" />
            </Group>
          </>
        )}

        {ribbonTab === "annotate" && (
          <>
            <Group title="Cota">
              <Stub tips={tips} icon="dim" label="Alineada" tip="Cota alineada" />
              <Stub tips={tips} icon="dim" label="Lineal" tip="Cota lineal" />
              <Stub tips={tips} icon="dim" label="Angular" tip="Cota angular" />
              <Stub tips={tips} icon="dim" label="Radial" tip="Cota radial" />
              <Stub tips={tips} icon="dim" label="Cota de punto" tip="Cota de punto" />
            </Group>
            <Group title="Texto">
              <Stub tips={tips} icon="text" label="Texto" tip="Texto" />
              <Stub tips={tips} icon="text" label="Nota de texto" tip="Nota de texto" />
            </Group>
            <Group title="Etiqueta">
              <Stub tips={tips} icon="tag" label="Etiqueta por categoría" tip="Etiqueta" />
              <Stub tips={tips} icon="tag" label="Etiqueta de material" tip="Etiqueta material" />
            </Group>
            <Group title="Detalle">
              <Stub tips={tips} icon="detail" label="Línea de detalle" tip="Línea de detalle" />
              <Stub tips={tips} icon="fill" label="Región" tip="Región" />
              <Stub tips={tips} icon="component" label="Símbolo" tip="Símbolo" />
              <Stub tips={tips} icon="cloud" label="Nube de revisión" tip="Nube revisión" />
            </Group>
          </>
        )}

        {ribbonTab === "analyze" && (
          <Group title="Analizar">
            <Stub tips={tips} icon="analyze" label="Comprobar interferencias" tip="Interferencias" />
            <Stub tips={tips} icon="sheet" label="Informe" tip="Informe" />
          </Group>
        )}

        {ribbonTab === "massing" && (
          <Group title="Masas">
            <Stub tips={tips} icon="mass" label="Masa in situ" tip="Masa in situ" />
            <Stub tips={tips} icon="component" label="Componente de masa" tip="Componente masa" />
            <Stub tips={tips} icon="topo" label="Superficie topográfica" tip="Topografía" />
            <Stub tips={tips} icon="area" label="Parcela" tip="Parcela" />
          </Group>
        )}

        {ribbonTab === "collaborate" && (
          <Group title="Colaborar">
            <Stub tips={tips} icon="sync" label="Sincronizar" tip="Sincronizar" />
            <Stub tips={tips} icon="analyze" label="Revisar avisos" tip="Avisos" />
          </Group>
        )}

        {ribbonTab === "view" && (
          <>
            <Group title="Crear">
              <Tool tips={tips} icon="plan" label="Planta" tip="Planta" onClick={() => addView("plan")} />
              <Tool tips={tips} icon="view3d" label="3D" tip="Vista 3D" onClick={() => addView("perspective")} />
              <Stub tips={tips} icon="elevation" label="Alzado" tip="Alzado" />
              <Stub tips={tips} icon="section" label="Sección" tip="Sección" />
              <Stub tips={tips} icon="detail" label="Llamada" tip="Llamada" />
              <Stub tips={tips} icon="sheet" label="Vista de dibujo" tip="Dibujo" />
              <Stub tips={tips} icon="sheet" label="Leyenda" tip="Leyenda" />
              <Stub tips={tips} icon="sheet" label="Tabla de planificación" tip="Tabla" />
              <Stub tips={tips} icon="sheet" label="Plano / Sheet" tip="Plano" />
              <Tool
                tips={tips}
                icon="camera"
                label="Cámara"
                tip="Colocar cámara geométrica en planta"
                active={activeTool === "camera"}
                onClick={() => setTool("camera")}
              />
            </Group>
            <Group title="Gráficos">
              <Stub tips={tips} icon="vg" label="Visibilidad/Gráficos" tip="Visibilidad" />
              <Stub tips={tips} icon="line" label="Líneas finas" tip="Líneas finas" />
              <Stub tips={tips} icon="settings" label="Plantilla de vista" tip="Plantilla" />
            </Group>
            <Group title="Plano">
              <Stub tips={tips} icon="sheet" label="Cartela" tip="Cartela" />
              <Stub tips={tips} icon="plan" label="Vista en plano" tip="Vista en plano" />
              <Stub tips={tips} icon="tile" label="Rejilla guía" tip="Rejilla" />
            </Group>
            <Group title="Ventanas">
              <Tool tips={tips} icon="fit" label="Ajustar" tip="Ajustar vista" onClick={requestFitView} />
              <Stub tips={tips} icon="tile" label="Mosaico" tip="Mosaico" />
              <Stub tips={tips} icon="tile" label="Cascada" tip="Cascada" />
              <Stub tips={tips} icon="cancel" label="Cerrar ocultas" tip="Cerrar ocultas" />
            </Group>
          </>
        )}

        {ribbonTab === "manage" && (
          <>
            <Group title="Configuración">
              <Stub tips={tips} icon="settings" label="Información del proyecto" tip="Info proyecto" />
              <Stub tips={tips} icon="units" label="Unidades" tip="Unidades" />
              <Stub tips={tips} icon="line" label="Referencias" tip="Referencias" />
              <Stub tips={tips} icon="settings" label="Estilos de objeto" tip="Estilos objeto" />
              <Stub tips={tips} icon="material" label="Materiales" tip="Materiales" />
              <Stub tips={tips} icon="line" label="Estilos de línea" tip="Estilos línea" />
            </Group>
            <Group title="Proyecto">
              <Tool tips={tips} icon="new" label="Nuevo" tip="Nuevo" onClick={newProject} />
              <Tool tips={tips} icon="demo" label="Demo" tip="Demo" onClick={openDemo} />
              <Stub tips={tips} icon="delete" label="Purgar no usados" tip="Purgar" />
              <Stub tips={tips} icon="sync" label="Transferir normas" tip="Transferir" />
            </Group>
            <Group title="Consulta">
              <Stub tips={tips} icon="select" label="Seleccionar por ID" tip="Por ID" />
              <Stub tips={tips} icon="analyze" label="Advertencias" tip="Advertencias" />
            </Group>
            <Group title="Interfaz">
              <label className="ribbon__check ribbon__check--tool">
                <input
                  type="checkbox"
                  checked={propertiesVisible}
                  onChange={(e) => setPanelVisible("properties", e.target.checked)}
                />
                Propiedades
              </label>
              <label className="ribbon__check ribbon__check--tool">
                <input
                  type="checkbox"
                  checked={browserVisible}
                  onChange={(e) => setPanelVisible("browser", e.target.checked)}
                />
                Navegador
              </label>
              <label className="ribbon__check ribbon__check--tool">
                <input
                  type="checkbox"
                  checked={systemBrowserVisible}
                  onChange={(e) => setSystemBrowserVisible(e.target.checked)}
                />
                Explorador
              </label>
              <label className="ribbon__check ribbon__check--tool">
                <input
                  type="checkbox"
                  checked={iconBarVisible}
                  onChange={(e) => setIconBarVisible(e.target.checked)}
                />
                Barra vista
              </label>
              <label className="ribbon__check ribbon__check--tool">
                <input
                  type="checkbox"
                  checked={statusBarVisible}
                  onChange={(e) => setStatusBarVisible(e.target.checked)}
                />
                Estado
              </label>
            </Group>
          </>
        )}

        {ribbonTab === "modify" && (
          <>
            {sketching && (
              <>
                <Group title="Modo">
                  <Tool
                    tips={tips}
                    icon="finish"
                    label="Terminar"
                    tip={
                      sketchTarget
                        ? "Aplicar perfil abstracto al host → Paramétrico"
                        : "Terminar trazo actual (sin salir de la herramienta)"
                    }
                    onClick={() =>
                      sketchTarget ? finishSketchOnSelection() : cancelWallDraw()
                    }
                  />
                  <Tool
                    tips={tips}
                    icon="cancel"
                    label="Cancelar"
                    tip={
                      sketchTarget
                        ? "Descartar perfil y salir de Sketch"
                        : "Cancelar herramienta"
                    }
                    onClick={() =>
                      sketchTarget ? exitSketchOnSelection() : setTool("none")
                    }
                  />
                </Group>
                <Group title="Dibujar">
                  {DRAW_MODES.map((m) => {
                    const tip =
                      sketchTarget && m.id === "line"
                        ? "Editar vértices del perímetro (Workplane)"
                        : sketchTarget &&
                            (m.id === "rectangle" ||
                              m.id === "arcSER" ||
                              m.id === "arcCE")
                          ? `${m.tip} — redibuja el perímetro en el plano`
                          : m.tip;
                    return (
                      <Tool
                        key={m.id}
                        tips={tips}
                        icon={m.icon}
                        label={sketchTarget && m.id === "line" ? "Vértices" : m.tip}
                        tip={tip}
                        active={drawMode === m.id}
                        onClick={() => setDrawMode(m.id)}
                      />
                    );
                  })}
                </Group>
                {activeTool === "wall" && !isSketchDrawMode(drawMode) && (
                  <Group title="Cadena">
                    <Tool
                      tips={tips}
                      icon="chain"
                      label="Encadenar"
                      tip="Encadenar (activo por defecto)"
                      active={wallChain}
                      onClick={() => setWallChain(true)}
                    />
                    <Tool
                      tips={tips}
                      icon="unlink"
                      label="Soltar"
                      tip="Soltar cadena"
                      active={!wallChain}
                      onClick={releaseWallChain}
                    />
                    <Tool
                      tips={tips}
                      icon="split"
                      label="Dividir"
                      tip="Dividir cadena — nuevo tramo"
                      onClick={splitWallChain}
                    />
                    <Tool
                      tips={tips}
                      icon="restart"
                      label="Reiniciar"
                      tip="Reiniciar cadena en cursor/P1 (sin historial)"
                      onClick={() => {
                        const p = wallHover ?? wallPending;
                        if (p) restartChainAt(p);
                        else splitWallChain();
                      }}
                    />
                  </Group>
                )}
              </>
            )}
            {modifyWorkplaneSelect && (
              <Group title="Plano de trabajo">
                <Tool
                  tips={tips}
                  icon="pickFace"
                  label="Seleccionar"
                  tip="Seleccionar plano de trabajo — cara de muro o vacío = nivel"
                  active={activeTool === "workplaneSelect"}
                  onClick={() => setTool("workplaneSelect")}
                />
                <Tool
                  tips={tips}
                  icon="finish"
                  label="Nivel"
                  tip={`Volver al plano del nivel (${activeWorkplane?.label ?? "—"})`}
                  active={activeWorkplane?.kind === "storey"}
                  onClick={() => resetWorkplaneToLevel()}
                />
              </Group>
            )}
            <Group title="Modificar">
              <Tool
                tips={tips}
                icon="select"
                label="Seleccionar"
                tip={
                  sketchTarget
                    ? "Volver a editar vértices del perfil"
                    : "Seleccionar elementos"
                }
                active={
                  sketchTarget
                    ? sketchModifyMode === "vertex"
                    : activeTool === "select"
                }
                onClick={() => {
                  if (sketchTarget) setSketchModifyMode("vertex");
                  else setTool("select");
                }}
              />
              <Tool
                tips={tips}
                icon="editProfile"
                label="Editar perfil"
                tip="Sketch Mode sobre el elemento seleccionado (doble clic también)"
                active={sketchTarget != null}
                onClick={() => enterSketchOnSelection()}
              />
              <Tool
                tips={tips}
                icon="move"
                label="Mover"
                tip="Mover arista/vértice seleccionado o bucle (también: arrastrar arista)"
                active={sketchModifyMode === "move"}
                onClick={() => setSketchModifyMode("move")}
              />
              <Tool
                tips={tips}
                icon="copy"
                label="Copiar"
                tip="Desplazar copia del provisional en el plano"
                active={sketchModifyMode === "copy"}
                onClick={() => setSketchModifyMode("copy")}
              />
              <Tool
                tips={tips}
                icon="rotate"
                label="Rotar"
                tip="Rotar perfil en el Workplane"
                active={sketchModifyMode === "rotate"}
                onClick={() => setSketchModifyMode("rotate")}
              />
              <Stub tips={tips} icon="tile" label="Matriz" tip="Matriz" />
              <Stub tips={tips} icon="mirror" label="Reflejar" tip="Reflejar" />
              <Stub tips={tips} icon="align" label="Alinear" tip="Alinear" />
              <Tool
                tips={tips}
                icon="offset"
                label="Desfase"
                tip="Equidistancia del contorno en el Workplane (clic; Shift = contraer)"
                active={sketchModifyMode === "offset"}
                onClick={() => setSketchModifyMode("offset")}
              />
              <Stub tips={tips} icon="trim" label="Recortar/Extender" tip="Recortar" />
              <Tool
                tips={tips}
                icon="splitPoint"
                label="Split point"
                tip="Insertar vértice en arista"
                active={sketchModifyMode === "splitPoint"}
                onClick={() => setSketchModifyMode("splitPoint")}
              />
              <Tool
                tips={tips}
                icon="splitLine"
                label="Split line"
                tip="Dividir aristas con una traza"
                active={sketchModifyMode === "splitLine"}
                onClick={() => setSketchModifyMode("splitLine")}
              />
              <Tool
                tips={tips}
                icon="fillet"
                label="Fillet"
                tip="Empalme en vértice (radio 0,15 m)"
                active={sketchModifyMode === "fillet"}
                onClick={() => setSketchModifyMode("fillet")}
              />
              <Tool
                tips={tips}
                icon="redraw"
                label="Redibujar"
                tip="Vacía el provisional (no el documento)"
                onClick={() => redrawSketchProfile()}
              />
              <Stub tips={tips} icon="link" label="Anclar" tip="Anclar" />
              <Tool
                tips={tips}
                icon="delete"
                label="Eliminar"
                tip="Eliminar vértice seleccionado del perfil"
                onClick={() => deleteSelectedProfileVertex()}
              />
            </Group>
            <Group title="Portapapeles">
              <Stub tips={tips} icon="cut" label="Cortar" tip="Cortar" />
              <Stub tips={tips} icon="copy" label="Copiar" tip="Copiar" />
              <Stub tips={tips} icon="import" label="Pegar" tip="Pegar" />
            </Group>
            <Group title="Geometría">
              <Stub tips={tips} icon="join" label="Unir" tip="Unir" />
              <Stub tips={tips} icon="unlink" label="Desunir" tip="Desunir" />
              <Stub tips={tips} icon="trim" label="Cortar" tip="Cortar geometría" />
            </Group>
          </>
        )}
      </div>

      <div className="ribbon__options" aria-label="Opciones de herramienta">
        {activeTool === "none" ? (
          <span className="ribbon__options-idle">
            Opciones de herramienta — selecciona una herramienta en la cinta
          </span>
        ) : (
          <>
            <span className="ribbon__options-title">
              {activeTool === "wall"
                ? "Colocar muro"
                : activeTool === "door"
                  ? "Colocar puerta"
                  : activeTool === "window"
                    ? "Colocar ventana"
                    : activeTool === "select"
                      ? "Seleccionar"
                      : activeTool}
            </span>
            <div className="ribbon__options-list">
              {activeTool === "door" && (
                <span className="ribbon__options-hint">
                  Clic en un muro · familia en Propiedades
                </span>
              )}
              {activeTool === "window" && (
                <span className="ribbon__options-hint">
                  Clic en un muro · familia en Propiedades
                </span>
              )}
              {activeTool === "wall" && (
                <>
                  <span className="ribbon__options-hint">
                    {sketchTarget
                      ? "Sketch · elemento activo"
                      : editingParadigm === "sketch"
                        ? "Sketch Mode"
                        : "Paramétrico"}
                    {" · "}
                    {DRAW_MODES.find((m) => m.id === drawMode)?.tip ?? drawMode}
                  </span>
                  <label className="ribbon__opt">
                    Altura
                    <select disabled defaultValue="level2">
                      <option value="level2">Hasta Nivel 2</option>
                      <option value="unconnected">No conectada</option>
                    </select>
                  </label>
                  <label className="ribbon__opt">
                    Espesor
                    <select disabled defaultValue="150">
                      <option value="150">150 mm</option>
                      <option value="200">200 mm</option>
                    </select>
                  </label>
                  <label className="ribbon__check">
                    <input
                      type="checkbox"
                      checked={wallChain}
                      onChange={(e) => setWallChain(e.target.checked)}
                    />
                    Cadena
                  </label>
                  <label className="ribbon__check">
                    <input type="checkbox" disabled defaultChecked />
                    Loc. línea
                  </label>
                </>
              )}
              {activeTool === "select" && (
                <span className="ribbon__options-hint">Filtro / multi-selección (stub)</span>
              )}
              <button
                type="button"
                className="ribbon__options-cancel"
                onClick={() => setTool("none")}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>

      {tip &&
        createPortal(
          <div
            className="ribbon__tip"
            role="tooltip"
            style={{ left: tip.x, top: tip.y }}
          >
            {tip.text}
          </div>,
          window.document.body,
        )}
    </div>
  );
}
