/**
 * Single project transition for new / demo / open (F9-E4 + F9-E3 reconcile).
 */
import { HistoryStack, syncIdSequencesFromDocument } from "@axonbim/commands";
import {
  getActiveStorey,
  reconcileActiveFamilyIds,
  reconcileActiveStoreyId,
  workplaneFromStorey,
  type AxonDocument,
} from "@axonbim/model";
import { clearSnapSession } from "@axonbim/tools";
import { mergeViewsWithDocument } from "./cameraViews.js";
import { applyPresentationToViews } from "./presentationViews.js";
import { clearElementSelection } from "./sliceContracts.js";
import { defaultViews } from "./defaultViews.js";
import type { SessionState } from "./sliceTypes.js";

type FamilyPrefs = Pick<
  SessionState,
  "activeFamilyId" | "activeDoorFamilyId" | "activeWindowFamilyId" | "activeStoreyId"
>;

/** Fresh session shell bound to `document` (views derived for cameras). */
export function resetSessionForDocument(
  document: AxonDocument,
  prefs: FamilyPrefs,
): Partial<SessionState> {
  syncIdSequencesFromDocument(document);
  const families = reconcileActiveFamilyIds(document, prefs);
  const views = applyPresentationToViews(
    mergeViewsWithDocument(defaultViews(), document.cameras),
    document.presentation,
  );
  const activeStoreyId = reconcileActiveStoreyId(document, prefs.activeStoreyId);
  const storey = getActiveStorey(document, activeStoreyId);
  return {
    document,
    history: new HistoryStack(),
    views,
    activeViewId: "view.plan.level1",
    activeTool: "none",
    drawMode: "line",
    editingParadigm: "parametric",
    sketchTarget: null,
    sketchProfile: null,
    sketchProfileStroke: false,
    profileVertexIndex: null,
    sketchModifyMode: "vertex" as const,
    sketchModifyPending: null,
    profileEdgeIndex: null,
    ribbonTab: "architecture",
    activeStoreyId,
    activeWorkplane: workplaneFromStorey(storey),
    workplaneLock: "auto-level",
    workplaneLinePending: null,
    ...clearElementSelection(),
    wallPending: null,
    wallChainOrigin: null,
    wallHover: null,
    drawPoints: [],
    lastSnapKind: "none",
    snapSession: clearSnapSession(),
    cropDragMeta: null,
    cropDragLive: null,
    cameraPoseDragLive: null,
    cameraViewNavEdit: false,
    ...families,
  };
}
