import type { AxonDocument, Camera, ViewCrop } from "@axonbim/model";
import {
  cloneViewCrop,
  defaultCameraCrop,
  normalizeViewCrop,
  validateCamera,
} from "@axonbim/model";
import { restoreAt } from "./restoreOrder";
import { CHANGED, NOOP, rejected, type Command, type CommandResult } from "./types";

let cameraSeq = 0;

export function resetCameraIdSeq(n = 0): void {
  cameraSeq = n;
}

export function createCameraId(): string {
  cameraSeq += 1;
  return `camera.${cameraSeq}`;
}

function snapshotCamera(c: Camera): Camera {
  return {
    ...c,
    eye: { ...c.eye },
    target: { ...c.target },
    crop: cloneViewCrop(c.crop),
  };
}

function ensureCrop(camera: Camera): ViewCrop {
  if (camera.crop) return cloneViewCrop(normalizeViewCrop(camera.crop));
  return defaultCameraCrop(camera.eye, camera.target, camera.fov);
}

function notFound(cameraId: string): CommandResult {
  return rejected({ code: "camera.notFound", message: `camera ${cameraId}: not found` });
}

/** Validates the camera as it would look after the change. */
function checkCamera(candidate: Camera): CommandResult | null {
  const issue = validateCamera(candidate);
  return issue ? rejected(issue) : null;
}

export class CreateCameraCommand implements Command {
  readonly id: string;
  readonly type = "camera.create";
  constructor(private readonly camera: Camera) {
    this.id = `cmd.create.${camera.id}`;
  }

  execute(doc: AxonDocument): CommandResult {
    if (doc.cameras.some((c) => c.id === this.camera.id)) {
      return rejected({
        code: "camera.duplicateId",
        message: `camera ${this.camera.id}: id already exists`,
      });
    }
    const next: Camera = {
      ...this.camera,
      eye: { ...this.camera.eye },
      target: { ...this.camera.target },
      crop: ensureCrop(this.camera),
    };
    const invalid = checkCamera(next);
    if (invalid) return invalid;
    doc.cameras.push(next);
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    doc.cameras = doc.cameras.filter((c) => c.id !== this.camera.id);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class DeleteCameraCommand implements Command {
  readonly id: string;
  readonly type = "camera.delete";
  private snapshot: Camera | null = null;
  private index = 0;

  constructor(private readonly cameraId: string) {
    this.id = `cmd.delete.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const index = doc.cameras.findIndex((c) => c.id === this.cameraId);
    if (index < 0) return notFound(this.cameraId);
    this.snapshot = snapshotCamera(doc.cameras[index]);
    this.index = index;
    doc.cameras = doc.cameras.filter((c) => c.id !== this.cameraId);
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    if (!this.snapshot) return;
    if (!doc.cameras.some((c) => c.id === this.snapshot!.id)) {
      restoreAt(doc.cameras, this.index, snapshotCamera(this.snapshot));
    }
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetCameraNameCommand implements Command {
  readonly id: string;
  readonly type = "camera.name";
  private prev = "";

  constructor(
    private readonly cameraId: string,
    private readonly name: string,
  ) {
    this.id = `cmd.camera.name.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return notFound(this.cameraId);
    if (c.name === this.name) return NOOP;
    const invalid = checkCamera({ ...c, name: this.name });
    if (invalid) return invalid;
    this.prev = c.name;
    c.name = this.name;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return;
    c.name = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetCameraFovCommand implements Command {
  readonly id: string;
  readonly type = "camera.fov";
  private prev = 0;

  constructor(
    private readonly cameraId: string,
    private readonly fov: number,
  ) {
    this.id = `cmd.camera.fov.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return notFound(this.cameraId);
    if (c.fov === this.fov) return NOOP;
    const invalid = checkCamera({ ...c, fov: this.fov });
    if (invalid) return invalid;
    this.prev = c.fov;
    c.fov = this.fov;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return;
    c.fov = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetCameraEyeHeightCommand implements Command {
  readonly id: string;
  readonly type = "camera.eyeHeight";
  private prevZ = 0;

  constructor(
    private readonly cameraId: string,
    private readonly eyeZ: number,
  ) {
    this.id = `cmd.camera.eyeZ.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return notFound(this.cameraId);
    if (c.eye.z === this.eyeZ) return NOOP;
    const invalid = checkCamera({ ...c, eye: { ...c.eye, z: this.eyeZ } });
    if (invalid) return invalid;
    this.prevZ = c.eye.z;
    c.eye = { ...c.eye, z: this.eyeZ };
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return;
    c.eye = { ...c.eye, z: this.prevZ };
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetCameraTargetCommand implements Command {
  readonly id: string;
  readonly type = "camera.target";
  private prev = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly cameraId: string,
    private readonly target: { x: number; y: number; z: number },
  ) {
    this.id = `cmd.camera.target.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return notFound(this.cameraId);
    if (
      c.target.x === this.target.x &&
      c.target.y === this.target.y &&
      c.target.z === this.target.z
    ) {
      return NOOP;
    }
    const invalid = checkCamera({ ...c, target: { ...this.target } });
    if (invalid) return invalid;
    this.prev = { ...c.target };
    c.target = { ...this.target };
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return;
    c.target = { ...this.prev };
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetCameraCropCommand implements Command {
  readonly id: string;
  readonly type = "camera.crop";
  private prev: ViewCrop | null = null;

  constructor(
    private readonly cameraId: string,
    private readonly crop: ViewCrop,
  ) {
    this.id = `cmd.camera.crop.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return notFound(this.cameraId);
    const next = normalizeViewCrop(this.crop);
    const cur = c.crop;
    if (
      cur &&
      cur.enabled === next.enabled &&
      cur.minX === next.minX &&
      cur.minY === next.minY &&
      cur.maxX === next.maxX &&
      cur.maxY === next.maxY &&
      cur.minZ === next.minZ &&
      cur.maxZ === next.maxZ
    ) {
      return NOOP;
    }
    const invalid = checkCamera({ ...c, crop: next });
    if (invalid) return invalid;
    this.prev = cloneViewCrop(c.crop);
    c.crop = cloneViewCrop(next);
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c || !this.prev) return;
    c.crop = cloneViewCrop(this.prev);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

/** Move camera eye/target XY and crop together in plan (frame drag). */
export class TranslateCameraPlanCommand implements Command {
  readonly id: string;
  readonly type = "camera.translatePlan";
  private prevEye = { x: 0, y: 0, z: 0 };
  private prevTarget = { x: 0, y: 0, z: 0 };
  private prevCrop: ViewCrop | null = null;

  constructor(
    private readonly cameraId: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    this.id = `cmd.camera.translatePlan.${cameraId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c) return notFound(this.cameraId);
    if (this.dx === 0 && this.dy === 0) return NOOP;
    const eye = { ...c.eye, x: c.eye.x + this.dx, y: c.eye.y + this.dy };
    const target = { ...c.target, x: c.target.x + this.dx, y: c.target.y + this.dy };
    const crop = normalizeViewCrop({
      ...c.crop,
      minX: c.crop.minX + this.dx,
      maxX: c.crop.maxX + this.dx,
      minY: c.crop.minY + this.dy,
      maxY: c.crop.maxY + this.dy,
    });
    const invalid = checkCamera({ ...c, eye, target, crop });
    if (invalid) return invalid;
    this.prevEye = { ...c.eye };
    this.prevTarget = { ...c.target };
    this.prevCrop = cloneViewCrop(c.crop);
    c.eye = eye;
    c.target = target;
    c.crop = crop;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const c = doc.cameras.find((x) => x.id === this.cameraId);
    if (!c || !this.prevCrop) return;
    c.eye = { ...this.prevEye };
    c.target = { ...this.prevTarget };
    c.crop = cloneViewCrop(this.prevCrop);
    doc.meta.updatedAt = new Date().toISOString();
  }
}
