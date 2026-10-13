import {
  AnatomicalJointDef,
  AnatomicalJointId,
  BonePartAttachment,
  JointToolMode,
  StudioView
} from '../types';
import {
  ANATOMICAL_JOINTS,
  ANATOMICAL_BONES,
  BONE_CONNECTIONS,
  DEFAULT_ENVELOPES,
  DEFAULT_BONE_DRAW_ORDER,
  getDefaultJointPositions,
  pathCapsule,
  poseJointPreservingBones
} from './AnatomicalRig';

export interface RigStudioCanvasEvents {
  onJointSelected?: (jointId: AnatomicalJointId | null) => void;
  onJointsModified?: (joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onPartModified?: (boneId: AnatomicalJointId, part: BonePartAttachment) => void;
  onBeforeModification?: (description: string) => void;
  onImageDropped?: (file: File) => void;
  onPartDroppedOnBone?: (boneId: AnatomicalJointId, partData: any) => void;
  onFileDroppedOnBone?: (boneId: AnatomicalJointId, file: File) => void;
}

export class RigStudioCanvas {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private currentView: StudioView = 'front';
  private toolMode: JointToolMode = 'select';
  private symmetryEnabled = true;
  private showBonesEnabled = true;
  private showEnvelopesEnabled = true;

  private sourceImage: HTMLImageElement | null = null;
  private imageName = '';
  private imageBounds = { width: 220, height: 420 };

  // Current placed joints in active view
  private restJoints: Record<AnatomicalJointId, { x: number; y: number }>;
  // Posed joints during Preview Mode
  private previewJoints: Record<AnatomicalJointId, { x: number; y: number }>;

  // Envelopes per bone
  private envelopes: Record<AnatomicalJointId, number> = { ...DEFAULT_ENVELOPES };

  // Attached parts per bone
  private parts: Record<string, BonePartAttachment> = {};

  // Z-Order / Layer Draw Order for bones and attached graphics (bottom to top)
  private boneDrawOrder: AnatomicalJointId[] = [...DEFAULT_BONE_DRAW_ORDER];

  // Lock graphic position in world space when dragging bone joints
  private lockGraphicPosition = false;

  // Reference artwork overlay behind parts
  private showReferenceArtwork = false;
  private referenceArtworkOpacity = 0.35;

  // On-Canvas WYSIWYG Graphic Transform Gizmo interaction
  private isTransformingPart = false;
  private transformAction: 'translate' | 'rotate' | 'scale' | 'pivot' | null = null;
  private transformHandle: 'body' | 'rotate' | 'pivot' | 'tl' | 'tr' | 'bl' | 'br' | null = null;
  private hoveredGizmoHandle: 'body' | 'rotate' | 'pivot' | 'tl' | 'tr' | 'bl' | 'br' | null = null;
  private transformStartWorld = { x: 0, y: 0 };
  private transformStartAngle = 0;
  private transformStartDist = 1;
  private transformStartSnapshot: {
    offsetX: number;
    offsetY: number;
    rotation: number;
    scale: number;
    pivotX: number;
    pivotY: number;
  } | null = null;

  private selectedJointId: AnatomicalJointId | null = null;
  private hoveredJointId: AnatomicalJointId | null = null;
  private dragHoverBoneId: AnatomicalJointId | null = null;
  private dragHoverPart: any | null = null;

  // Pan & Zoom
  private zoom = 1.35;
  private panX = 0;
  private panY = 0;
  // Ghost rest pose in preview mode
  private showGhostPose = false;

  private isPanning = false;
  private isSpacePressed = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Dragging Joint
  private isDraggingJoint = false;
  private draggedJointId: AnatomicalJointId | null = null;

  private events: RigStudioCanvasEvents;

  constructor(container: HTMLElement, events: RigStudioCanvasEvents = {}) {
    this.container = container;
    this.events = events;

    this.restJoints = getDefaultJointPositions('front', this.imageBounds.width, this.imageBounds.height);
    this.previewJoints = { ...this.restJoints };

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'studio-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext('2d')!;

    this.bindEvents();
    this.resizeCanvas();
    this.resetView();
  }

  public setToolMode(mode: JointToolMode): void {
    this.toolMode = mode;
    if (mode === 'preview') {
      // Initialize preview joints from current rest joints
      this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
    }
    this.render();
  }

  public getToolMode(): JointToolMode {
    return this.toolMode;
  }

  public setSymmetry(enabled: boolean): void {
    this.symmetryEnabled = enabled;
  }

  public setShowBones(enabled: boolean): void {
    this.showBonesEnabled = enabled;
    this.render();
  }

  public setShowEnvelopes(enabled: boolean): void {
    this.showEnvelopesEnabled = enabled;
    this.render();
  }

  public isShowEnvelopes(): boolean {
    return this.showEnvelopesEnabled;
  }

  public setEnvelopeRadius(jointId: AnatomicalJointId, radius: number): void {
    this.envelopes[jointId] = radius;
    this.render();
  }

  public getEnvelopeRadius(jointId: AnatomicalJointId): number {
    return this.envelopes[jointId] || DEFAULT_ENVELOPES[jointId] || 20;
  }

  public getEnvelopes(): Record<AnatomicalJointId, number> {
    return { ...this.envelopes };
  }

  public setEnvelopes(envs: Record<string, number>): void {
    this.envelopes = { ...DEFAULT_ENVELOPES, ...envs };
    this.render();
  }

  public setPart(boneId: AnatomicalJointId, part: BonePartAttachment | null): void {
    if (part) {
      this.parts[boneId] = part;
      if (part.image && (!part.image.complete || !part.image.naturalWidth)) {
        part.image.addEventListener('load', () => this.render(), { once: true });
      }
    } else {
      delete this.parts[boneId];
    }
    this.render();
  }

  public getParts(): Record<string, BonePartAttachment> {
    return { ...this.parts };
  }

  public setParts(partsMap: Record<string, BonePartAttachment>): void {
    this.parts = { ...partsMap };
    for (const p of Object.values(this.parts)) {
      if (p.image && (!p.image.complete || !p.image.naturalWidth)) {
        p.image.addEventListener('load', () => this.render(), { once: true });
      }
    }
    this.render();
  }

  public getBoneDrawOrder(): AnatomicalJointId[] {
    return [...this.boneDrawOrder];
  }

  public setBoneDrawOrder(order: AnatomicalJointId[]): void {
    if (!order || order.length === 0) return;
    const validSet = new Set(order);
    const newOrder = [...order];
    for (const b of DEFAULT_BONE_DRAW_ORDER) {
      if (!validSet.has(b)) {
        newOrder.push(b);
        validSet.add(b);
      }
    }
    this.boneDrawOrder = newOrder;
    this.render();
  }

  /**
   * Moves a bone one step up (forward / toward top layer in stacking order).
   */
  public moveBoneUp(boneId: AnatomicalJointId): boolean {
    const idx = this.boneDrawOrder.indexOf(boneId);
    if (idx >= 0 && idx < this.boneDrawOrder.length - 1) {
      const temp = this.boneDrawOrder[idx];
      this.boneDrawOrder[idx] = this.boneDrawOrder[idx + 1];
      this.boneDrawOrder[idx + 1] = temp;
      this.render();
      return true;
    }
    return false;
  }

  /**
   * Moves a bone one step down (backward / toward bottom layer in stacking order).
   */
  public moveBoneDown(boneId: AnatomicalJointId): boolean {
    const idx = this.boneDrawOrder.indexOf(boneId);
    if (idx > 0) {
      const temp = this.boneDrawOrder[idx];
      this.boneDrawOrder[idx] = this.boneDrawOrder[idx - 1];
      this.boneDrawOrder[idx - 1] = temp;
      this.render();
      return true;
    }
    return false;
  }

  /**
   * Raises a bone to the very top (front-most layer, drawn last).
   */
  public moveBoneToTop(boneId: AnatomicalJointId): boolean {
    const idx = this.boneDrawOrder.indexOf(boneId);
    if (idx >= 0 && idx < this.boneDrawOrder.length - 1) {
      this.boneDrawOrder.splice(idx, 1);
      this.boneDrawOrder.push(boneId);
      this.render();
      return true;
    }
    return false;
  }

  /**
   * Lowers a bone to the very bottom (back-most layer, drawn first).
   */
  public moveBoneToBottom(boneId: AnatomicalJointId): boolean {
    const idx = this.boneDrawOrder.indexOf(boneId);
    if (idx > 0) {
      this.boneDrawOrder.splice(idx, 1);
      this.boneDrawOrder.unshift(boneId);
      this.render();
      return true;
    }
    return false;
  }

  /**
   * Reorders a bone from an arbitrary index to another index.
   */
  public reorderBone(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= this.boneDrawOrder.length) return false;
    if (toIndex < 0 || toIndex >= this.boneDrawOrder.length) return false;
    if (fromIndex === toIndex) return false;
    const item = this.boneDrawOrder.splice(fromIndex, 1)[0];
    this.boneDrawOrder.splice(toIndex, 0, item);
    this.render();
    return true;
  }

  public setDragHoverPart(part: any | null): void {
    this.dragHoverPart = part;
    this.render();
  }

  public setShowGhost(show: boolean): void {
    this.showGhostPose = show;
    this.render();
  }

  public getShowGhost(): boolean {
    return this.showGhostPose;
  }

  public setLockGraphicPosition(locked: boolean): void {
    this.lockGraphicPosition = locked;
  }

  public isLockGraphicPosition(): boolean {
    return this.lockGraphicPosition;
  }

  public setShowReferenceArtwork(show: boolean): void {
    this.showReferenceArtwork = show;
    this.render();
  }

  public isShowReferenceArtwork(): boolean {
    return this.showReferenceArtwork;
  }

  public setReferenceArtworkOpacity(opacity: number): void {
    this.referenceArtworkOpacity = Math.max(0, Math.min(1, opacity));
    this.render();
  }

  public getReferenceArtworkOpacity(): number {
    return this.referenceArtworkOpacity;
  }

  public centerPartOnBone(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (!part) return;
    const seg = this.getBoneSegmentJoints(boneId, this.toolMode === 'preview' ? this.previewJoints : this.restJoints);
    if (!seg) return;

    const boneDef = ANATOMICAL_BONES.find(b => b.id === boneId);
    const isSpine = boneDef?.category === 'spine';
    const boneLen = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);

    part.offsetX = 0;
    if (isSpine) {
      part.offsetY = 0;
    } else {
      part.offsetY = Math.round(boneLen / 2);
    }
    this.render();
    this.notifyPartModified(boneId);
  }

  public snapPartPivotToJoint(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (!part) return;
    part.offsetX = 0;
    part.offsetY = 0;
    this.render();
    this.notifyPartModified(boneId);
  }

  public alignPartRotationToBone(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (!part) return;
    this.events.onBeforeModification?.('Align Angle to Bone');
    part.rotation = 0;
    this.render();
    this.notifyPartModified(boneId);
  }

  public setPartRotation(boneId: AnatomicalJointId, angleRad: number): void {
    const part = this.parts[boneId];
    if (!part) return;
    this.events.onBeforeModification?.('Rotate Graphic');
    let normalized = angleRad;
    while (normalized > Math.PI) normalized -= 2 * Math.PI;
    while (normalized < -Math.PI) normalized += 2 * Math.PI;
    part.rotation = normalized;
    this.render();
    this.notifyPartModified(boneId);
  }

  public rotatePartBy(boneId: AnatomicalJointId, deltaRad: number): void {
    const part = this.parts[boneId];
    if (!part) return;
    this.events.onBeforeModification?.('Rotate Graphic');
    let newRot = (part.rotation || 0) + deltaRad;
    while (newRot > Math.PI) newRot -= 2 * Math.PI;
    while (newRot < -Math.PI) newRot += 2 * Math.PI;
    part.rotation = newRot;
    this.render();
    this.notifyPartModified(boneId);
  }

  public rotatePart90(boneId: AnatomicalJointId, clockwise = true): void {
    this.rotatePartBy(boneId, clockwise ? Math.PI / 2 : -Math.PI / 2);
  }

  public flipPartHorizontal(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (!part) return;
    this.events.onBeforeModification?.('Flip Graphic H');
    part.flipX = !part.flipX;
    this.render();
    this.notifyPartModified(boneId);
  }

  public flipPartVertical(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (!part) return;
    this.events.onBeforeModification?.('Flip Graphic V');
    part.flipY = !part.flipY;
    this.render();
    this.notifyPartModified(boneId);
  }

  public resetPartTransform(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (!part) return;
    this.events.onBeforeModification?.('Reset Graphic Transforms');
    part.offsetX = 0;
    part.offsetY = 0;
    part.rotation = 0;
    part.scale = 1.0;
    part.flipX = false;
    part.flipY = false;
    const boneDef = ANATOMICAL_BONES.find(b => b.id === boneId);
    const isSpine = boneDef?.category === 'spine';
    part.pivotX = 0.5;
    part.pivotY = isSpine ? (boneId === 'head' ? 0.78 : 0.5) : 0.15;
    this.render();
    this.notifyPartModified(boneId);
  }

  private notifyPartModified(boneId: AnatomicalJointId): void {
    const part = this.parts[boneId];
    if (part && this.events.onPartModified) {
      this.events.onPartModified(boneId, part);
    }
  }

  /**
   * Automatically slices and extracts each anatomical bone segment
   * from the loaded character artwork into individual BonePartAttachments.
   */
  public autoExtractBoneParts(): Record<string, BonePartAttachment> {
    if (!this.sourceImage || !this.imageBounds.width || !this.imageBounds.height) {
      return {};
    }

    const img = this.sourceImage;
    const bw = this.imageBounds.width;
    const bh = this.imageBounds.height;
    const results: Record<string, BonePartAttachment> = {};

    for (const joint of ANATOMICAL_JOINTS) {
      const seg = this.getBoneSegmentJoints(joint.id, this.restJoints);
      if (!seg) continue;

      const radius = this.getEnvelopeRadius(joint.id);
      const offCanvas = document.createElement('canvas');
      offCanvas.width = bw;
      offCanvas.height = bh;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) continue;

      offCtx.save();
      offCtx.translate(bw / 2, bh);
      pathCapsule(offCtx, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, radius);
      offCtx.clip();
      offCtx.drawImage(img, -bw / 2, -bh, bw, bh);
      offCtx.restore();

      const dataUrl = offCanvas.toDataURL('image/png');
      const partImg = new Image();
      partImg.src = dataUrl;

      results[joint.id] = {
        boneId: joint.id,
        image: partImg,
        imageUrl: dataUrl,
        fileName: `${joint.id}_extracted.png`,
        fileSize: `${Math.round((dataUrl.length * 0.75) / 1024)} KB`,
        scale: 1.0,
        offsetX: 0,
        offsetY: 0
      };
    }

    return results;
  }

  public setView(
    view: StudioView,
    joints?: Record<AnatomicalJointId, { x: number; y: number }>,
    envelopes?: Record<string, number>,
    partsMap?: Record<string, BonePartAttachment>,
    boneOrder?: AnatomicalJointId[]
  ): void {
    this.currentView = view;
    if (joints && Object.keys(joints).length > 0) {
      this.restJoints = JSON.parse(JSON.stringify(joints));
    } else {
      this.restJoints = getDefaultJointPositions(view, this.imageBounds.width, this.imageBounds.height);
    }
    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
    if (envelopes) {
      this.envelopes = { ...DEFAULT_ENVELOPES, ...envelopes };
    }
    if (partsMap) {
      this.parts = { ...partsMap };
      for (const p of Object.values(this.parts)) {
        if (p.image && (!p.image.complete || !p.image.naturalWidth)) {
          p.image.addEventListener('load', () => this.render(), { once: true });
        }
      }
    } else {
      this.parts = {};
    }
    if (boneOrder && boneOrder.length > 0) {
      this.setBoneDrawOrder(boneOrder);
    } else {
      this.boneDrawOrder = [...DEFAULT_BONE_DRAW_ORDER];
    }
    this.selectedJointId = null;
    this.render();
  }

  public setSourceImage(img: HTMLImageElement | null, name = '', resetJoints = false): void {
    this.sourceImage = img;
    this.imageName = name;
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      const targetHeight = 380;
      this.imageBounds = {
        width: Math.round(targetHeight * aspect),
        height: targetHeight
      };
      if (resetJoints || !this.restJoints || Object.keys(this.restJoints).length === 0) {
        this.restJoints = getDefaultJointPositions(this.currentView, this.imageBounds.width, this.imageBounds.height);
        this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
      }
    }
    this.render();
  }

  public getJoints(): Record<AnatomicalJointId, { x: number; y: number }> {
    return { ...this.restJoints };
  }

  public setJoints(joints: Record<AnatomicalJointId, { x: number; y: number }>): void {
    this.restJoints = { ...joints };
    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
    this.render();
  }

  public selectJoint(id: AnatomicalJointId | null): void {
    this.selectedJointId = id;
    this.render();
    if (this.events.onJointSelected) {
      this.events.onJointSelected(id);
    }
  }

  public getSelectedJoint(): AnatomicalJointId | null {
    return this.selectedJointId;
  }

  public resetPose(): void {
    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
    this.render();
  }

  public resetView(): void {
    const rect = this.container.getBoundingClientRect();
    this.panX = Math.round(rect.width / 2);
    this.panY = Math.round(rect.height * 0.82);
    this.zoom = 1.35;
    this.render();
  }

  public resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
    this.render();
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = (sx - rect.left - this.panX) / this.zoom;
    const y = (sy - rect.top - this.panY) / this.zoom;
    return { x, y };
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.max(0.35, Math.min(5.0, this.zoom * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.render();
    }, { passive: false });

    // Drag and drop onto bones or workspace
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      this.container.classList.add('drag-over');

      const world = this.screenToWorld(e.clientX, e.clientY);
      const hoveredBone = this.getBoneAtPoint(world.x, world.y);
      if (this.dragHoverBoneId !== hoveredBone) {
        this.dragHoverBoneId = hoveredBone;
        this.render();
      }
    });

    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
      if (this.dragHoverBoneId || this.dragHoverPart) {
        this.dragHoverBoneId = null;
        this.dragHoverPart = null;
        this.render();
      }
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
      const targetBone = this.dragHoverBoneId;
      this.dragHoverBoneId = null;
      this.dragHoverPart = null;

      // 1. Check if dragging an element/part from the Parts Library
      const partJson = e.dataTransfer?.getData('application/rig-part');
      if (partJson && targetBone) {
        try {
          const partData = JSON.parse(partJson);
          this.events.onPartDroppedOnBone?.(targetBone, partData);
          this.render();
          return;
        } catch {}
      }

      // 2. Check if dragging image files from desktop
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          if (targetBone) {
            this.events.onFileDroppedOnBone?.(targetBone, file);
          } else if (this.events.onImageDropped) {
            this.events.onImageDropped(file);
          }
        }
      }
      this.render();
    });

    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 1 || this.isSpacePressed) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        return;
      }

      if (e.button !== 0) return;

      const world = this.screenToWorld(e.clientX, e.clientY);
      const activeJoints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;

      // 1. If currently selected bone has an attached part and not in preview mode, test gizmo handles
      if (this.selectedJointId && this.parts[this.selectedJointId] && this.toolMode !== 'preview') {
        const hitHandle = this.hitTestPartGizmo(this.selectedJointId, world.x, world.y);
        if (hitHandle) {
          this.events.onBeforeModification?.(`Transform ${hitHandle} Graphic`);
          const part = this.parts[this.selectedJointId];
          const info = this.getPartTransformInfo(this.selectedJointId);
          this.isTransformingPart = true;
          this.transformHandle = hitHandle;
          this.transformStartWorld = { ...world };
          this.transformStartAngle = info ? Math.atan2(world.y - info.pivotWorldY, world.x - info.pivotWorldX) : 0;
          this.transformStartDist = info ? Math.hypot(world.x - info.pivotWorldX, world.y - info.pivotWorldY) : 1;
          this.transformStartSnapshot = {
            offsetX: part.offsetX ?? 0,
            offsetY: part.offsetY ?? 0,
            rotation: part.rotation ?? 0,
            scale: part.scale ?? 1.0,
            pivotX: part.pivotX ?? (info?.anchorX ?? 0.5),
            pivotY: part.pivotY ?? (info?.anchorY ?? 0.5)
          };

          if (hitHandle === 'rotate') {
            this.transformAction = 'rotate';
          } else if (hitHandle === 'pivot') {
            this.transformAction = 'pivot';
          } else if (hitHandle === 'body') {
            this.transformAction = 'translate';
          } else {
            this.transformAction = 'scale';
          }
          this.render();
          return;
        }
      }

      // 2. Hit test joints
      let clickedJointId: AnatomicalJointId | null = null;
      let closestDist = 18 / this.zoom;

      for (const joint of ANATOMICAL_JOINTS) {
        const pt = activeJoints[joint.id];
        if (!pt) continue;
        const d = Math.hypot(world.x - pt.x, world.y - pt.y);
        if (d < closestDist) {
          closestDist = d;
          clickedJointId = joint.id;
        }
      }

      if (clickedJointId) {
        this.selectJoint(clickedJointId);
        this.events.onBeforeModification?.('Move Joint Pin');
        this.isDraggingJoint = true;
        this.draggedJointId = clickedJointId;
        return;
      }

      // 3. Add Joint Mode: clicking empty space places/moves selected joint or next joint
      if (this.toolMode === 'add_joint' && this.sourceImage) {
        const targetId = this.selectedJointId || 'head';
        this.moveJointWithSymmetry(targetId, world.x, world.y);
        this.selectJoint(targetId);
        this.isDraggingJoint = true;
        this.draggedJointId = targetId;
        return;
      }

      // 4. Hit test attached parts on the canvas (click any part to select its bone and begin translating)
      if (this.toolMode !== 'preview') {
        const clickedPartBone = this.getPartAtPoint(world.x, world.y);
        if (clickedPartBone) {
          this.selectJoint(clickedPartBone);
          this.events.onBeforeModification?.('Translate Graphic');
          const part = this.parts[clickedPartBone];
          const info = this.getPartTransformInfo(clickedPartBone);
          this.isTransformingPart = true;
          this.transformAction = 'translate';
          this.transformHandle = 'body';
          this.transformStartWorld = { ...world };
          this.transformStartSnapshot = {
            offsetX: part.offsetX ?? 0,
            offsetY: part.offsetY ?? 0,
            rotation: part.rotation ?? 0,
            scale: part.scale ?? 1.0,
            pivotX: part.pivotX ?? (info?.anchorX ?? 0.5),
            pivotY: part.pivotY ?? (info?.anchorY ?? 0.5)
          };
          this.render();
          return;
        }
      }

      // 5. Hit test bone capsules
      const clickedBone = this.getBoneAtPoint(world.x, world.y);
      if (clickedBone) {
        this.selectJoint(clickedBone);
        return;
      }

      this.selectJoint(null);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX += e.clientX - this.lastMouseX;
        this.panY += e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.render();
        return;
      }

      const world = this.screenToWorld(e.clientX, e.clientY);

      // Transforming active graphic (Translate, Rotate, Scale, Pivot)
      if (this.isTransformingPart && this.selectedJointId && this.parts[this.selectedJointId]) {
        const part = this.parts[this.selectedJointId];
        const info = this.getPartTransformInfo(this.selectedJointId);
        if (info && this.transformStartSnapshot) {
          const snap = this.transformStartSnapshot;

          if (this.transformAction === 'translate') {
            const dwX = world.x - this.transformStartWorld.x;
            const dwY = world.y - this.transformStartWorld.y;
            part.offsetX = Math.round(snap.offsetX + dwX);
            part.offsetY = Math.round(snap.offsetY + dwY);
          } else if (this.transformAction === 'rotate') {
            const curAng = Math.atan2(world.y - info.pivotWorldY, world.x - info.pivotWorldX);
            let deltaAng = curAng - this.transformStartAngle;
            if (e.shiftKey) {
              const step = Math.PI / 12; // 15 degrees snap
              deltaAng = Math.round(deltaAng / step) * step;
            }
            let newRot = snap.rotation + deltaAng;
            while (newRot > Math.PI) newRot -= 2 * Math.PI;
            while (newRot < -Math.PI) newRot += 2 * Math.PI;
            part.rotation = newRot;
          } else if (this.transformAction === 'scale') {
            const curDist = Math.hypot(world.x - info.pivotWorldX, world.y - info.pivotWorldY);
            const ratio = curDist / (this.transformStartDist || 1);
            let newScale = Math.max(0.1, Math.min(5.0, snap.scale * ratio));
            if (e.shiftKey) {
              newScale = Math.round(newScale * 20) / 20; // 5% snap
            }
            part.scale = Math.round(newScale * 100) / 100;
          } else if (this.transformAction === 'pivot') {
            const dx = world.x - info.pivotWorldX;
            const dy = world.y - info.pivotWorldY;
            const cos = Math.cos(-info.rotAngle);
            const sin = Math.sin(-info.rotAngle);
            let lx = dx * cos - dy * sin;
            let ly = dx * sin + dy * cos;
            if (info.flipX) lx = -lx;
            if (info.flipY) ly = -ly;

            let newAnchorX = (lx - info.imgLocalX) / info.targetW;
            let newAnchorY = (ly - info.imgLocalY) / info.targetH;
            if (Math.abs(newAnchorX - 0.5) < 0.04) newAnchorX = 0.5;
            if (Math.abs(newAnchorY - 0.5) < 0.04) newAnchorY = 0.5;
            newAnchorX = Math.max(0, Math.min(1, newAnchorX));
            newAnchorY = Math.max(0, Math.min(1, newAnchorY));

            const oldLocalX = -info.targetW * (part.pivotX ?? info.anchorX);
            const oldLocalY = -info.targetH * (part.pivotY ?? info.anchorY);
            const newLocalX = -info.targetW * newAnchorX;
            const newLocalY = -info.targetH * newAnchorY;
            const deltaX = (oldLocalX - newLocalX) * (info.flipX ? -1 : 1);
            const deltaY = (oldLocalY - newLocalY) * (info.flipY ? -1 : 1);

            part.offsetX = Math.round((part.offsetX || 0) - deltaX);
            part.offsetY = Math.round((part.offsetY || 0) - deltaY);
            part.pivotX = Math.round(newAnchorX * 100) / 100;
            part.pivotY = Math.round(newAnchorY * 100) / 100;
          }

          this.render();
          this.notifyPartModified(this.selectedJointId);
        }
        return;
      }

      if (this.isDraggingJoint && this.draggedJointId) {
        if (this.toolMode === 'preview') {
          // Preview posing mode with bone length preservation for all nodes
          this.poseJointInPreview(this.draggedJointId, world.x, world.y);
        } else {
          // Standard setup mode (places / moves joint pins with symmetry and graphic lock)
          this.moveJointWithSymmetry(this.draggedJointId, world.x, world.y);
        }
        this.render();
        return;
      }

      // Cursor and gizmo handle hover detection
      if (this.selectedJointId && this.parts[this.selectedJointId] && this.toolMode !== 'preview') {
        const gizmoHit = this.hitTestPartGizmo(this.selectedJointId, world.x, world.y);
        if (this.hoveredGizmoHandle !== gizmoHit) {
          this.hoveredGizmoHandle = gizmoHit;
          this.render();
        }
        if (gizmoHit === 'rotate') {
          this.container.style.cursor = 'grab';
        } else if (gizmoHit === 'pivot') {
          this.container.style.cursor = 'crosshair';
        } else if (gizmoHit === 'body') {
          this.container.style.cursor = 'move';
        } else {
          this.container.style.cursor = '';
        }
      } else {
        if (this.hoveredGizmoHandle !== null) {
          this.hoveredGizmoHandle = null;
          this.render();
        }
        this.container.style.cursor = '';
      }

      // Hover detection on joints
      const activeJoints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;
      let hovered: AnatomicalJointId | null = null;
      const hoverThreshold = 14 / this.zoom;

      for (const joint of ANATOMICAL_JOINTS) {
        const pt = activeJoints[joint.id];
        if (!pt) continue;
        if (Math.hypot(world.x - pt.x, world.y - pt.y) < hoverThreshold) {
          hovered = joint.id;
          break;
        }
      }

      if (this.hoveredJointId !== hovered) {
        this.hoveredJointId = hovered;
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;

      if (this.isTransformingPart) {
        this.isTransformingPart = false;
        this.transformAction = null;
        this.transformHandle = null;
        if (this.selectedJointId && this.parts[this.selectedJointId]) {
          this.notifyPartModified(this.selectedJointId);
        }
      }

      if (this.isDraggingJoint) {
        this.isDraggingJoint = false;
        this.draggedJointId = null;
        if (this.events.onJointsModified) {
          this.events.onJointsModified(this.restJoints);
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        this.container.style.cursor = 'grab';
        return;
      }

      // Keyboard nudges when a bone with attached graphic is selected
      if (this.selectedJointId && this.parts[this.selectedJointId] && this.toolMode !== 'preview') {
        const part = this.parts[this.selectedJointId];
        const step = e.shiftKey ? 10 : 1;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          part.offsetX = (part.offsetX || 0) - step;
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          part.offsetX = (part.offsetX || 0) + step;
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          part.offsetY = (part.offsetY || 0) - step;
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          part.offsetY = (part.offsetY || 0) + step;
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === '[') {
          e.preventDefault();
          const ang = e.shiftKey ? Math.PI / 12 : Math.PI / 180;
          part.rotation = (part.rotation || 0) - ang;
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === ']') {
          e.preventDefault();
          const ang = e.shiftKey ? Math.PI / 12 : Math.PI / 180;
          part.rotation = (part.rotation || 0) + ang;
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          const sDelta = e.shiftKey ? 0.05 : 0.01;
          part.scale = Math.max(0.1, Math.round(((part.scale || 1.0) - sDelta) * 100) / 100);
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const sDelta = e.shiftKey ? 0.05 : 0.01;
          part.scale = Math.min(5.0, Math.round(((part.scale || 1.0) + sDelta) * 100) / 100);
          this.render();
          this.notifyPartModified(this.selectedJointId);
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          this.flipPartHorizontal(this.selectedJointId);
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          this.flipPartVertical(this.selectedJointId);
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          this.resetPartTransform(this.selectedJointId);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.container.style.cursor = '';
      }
    });
  }

  private moveJointWithSymmetry(jointId: AnatomicalJointId, wx: number, wy: number): void {
    const jointDef = ANATOMICAL_JOINTS.find(j => j.id === jointId);
    if (!jointDef) return;

    // Capture world-space transforms before moving joints if graphics are locked in world space
    const prevWorldParts: Record<string, { pivotWorldX: number; pivotWorldY: number; worldAngle: number }> = {};
    if (this.lockGraphicPosition && Object.keys(this.parts).length > 0) {
      for (const bId of Object.keys(this.parts) as AnatomicalJointId[]) {
        const info = this.getPartTransformInfo(bId, this.restJoints);
        if (info) {
          prevWorldParts[bId] = {
            pivotWorldX: info.pivotWorldX,
            pivotWorldY: info.pivotWorldY,
            worldAngle: info.rotAngle
          };
        }
      }
    }

    const oldPos = this.restJoints[jointId];
    const dx = Math.round(wx) - (oldPos ? oldPos.x : Math.round(wx));
    const dy = Math.round(wy) - (oldPos ? oldPos.y : Math.round(wy));

    if (jointId === 'hand_l' || jointId === 'hand_r' || jointId === 'foot_l' || jointId === 'foot_r') {
      this.restJoints = poseJointPreservingBones(jointId, wx, wy, this.restJoints, this.restJoints);
      if (this.symmetryEnabled && jointDef.symmetricWith) {
        const symId = jointDef.symmetricWith;
        this.restJoints = poseJointPreservingBones(symId, -wx, wy, this.restJoints, this.restJoints);
      }
    } else if (jointDef.isCenter) {
      this.restJoints[jointId] = { x: 0, y: Math.round(wy) };
      if (jointId === 'chest') {
        if (this.restJoints.neck) this.restJoints.neck = { x: 0, y: this.restJoints.neck.y + dy };
        if (this.restJoints.head) this.restJoints.head = { x: 0, y: this.restJoints.head.y + dy };
      } else if (jointId === 'neck') {
        if (this.restJoints.head) this.restJoints.head = { x: 0, y: this.restJoints.head.y + dy };
      }
    } else {
      this.restJoints[jointId] = { x: Math.round(wx), y: Math.round(wy) };

      // Carry child edge tips when dragging wrist or ankle
      if (jointId === 'wrist_l' && this.restJoints.hand_l) {
        this.restJoints.hand_l = { x: this.restJoints.hand_l.x + dx, y: this.restJoints.hand_l.y + dy };
      } else if (jointId === 'wrist_r' && this.restJoints.hand_r) {
        this.restJoints.hand_r = { x: this.restJoints.hand_r.x + dx, y: this.restJoints.hand_r.y + dy };
      } else if (jointId === 'ankle_l' && this.restJoints.foot_l) {
        this.restJoints.foot_l = { x: this.restJoints.foot_l.x + dx, y: this.restJoints.foot_l.y + dy };
      } else if (jointId === 'ankle_r' && this.restJoints.foot_r) {
        this.restJoints.foot_r = { x: this.restJoints.foot_r.x + dx, y: this.restJoints.foot_r.y + dy };
      }

      if (this.symmetryEnabled && jointDef.symmetricWith) {
        const symId = jointDef.symmetricWith;
        this.restJoints[symId] = { x: -Math.round(wx), y: Math.round(wy) };

        if (jointId === 'wrist_l' && this.restJoints.hand_r && this.restJoints.hand_l) {
          this.restJoints.hand_r = { x: -this.restJoints.hand_l.x, y: this.restJoints.hand_l.y };
        } else if (jointId === 'wrist_r' && this.restJoints.hand_l && this.restJoints.hand_r) {
          this.restJoints.hand_l = { x: -this.restJoints.hand_r.x, y: this.restJoints.hand_r.y };
        } else if (jointId === 'ankle_l' && this.restJoints.foot_r && this.restJoints.foot_l) {
          this.restJoints.foot_r = { x: -this.restJoints.foot_l.x, y: this.restJoints.foot_l.y };
        } else if (jointId === 'ankle_r' && this.restJoints.foot_l && this.restJoints.foot_r) {
          this.restJoints.foot_l = { x: -this.restJoints.foot_r.x, y: this.restJoints.foot_r.y };
        }
      }
    }

    // Maintain graphics in world space if locked
    if (this.lockGraphicPosition && Object.keys(prevWorldParts).length > 0) {
      for (const [bId, prev] of Object.entries(prevWorldParts)) {
        const boneId = bId as AnatomicalJointId;
        const part = this.parts[boneId];
        if (!part) continue;
        const seg = this.getBoneSegmentJoints(boneId, this.restJoints);
        if (!seg) continue;
        const boneDef = ANATOMICAL_BONES.find(b => b.id === boneId);
        const isSpine = boneDef?.category === 'spine';
        const newPosedAngle = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
        const newBaseAngle = isSpine ? (newPosedAngle + Math.PI / 2) : (newPosedAngle - Math.PI / 2);

        let newRot = prev.worldAngle - newBaseAngle;
        while (newRot > Math.PI) newRot -= 2 * Math.PI;
        while (newRot < -Math.PI) newRot += 2 * Math.PI;
        part.rotation = newRot;

        part.offsetX = Math.round(prev.pivotWorldX - seg.p1.x);
        part.offsetY = Math.round(prev.pivotWorldY - seg.p1.y);
        this.notifyPartModified(boneId);
      }
    }

    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
  }

  /**
   * Poses a joint during Preview Mode while strictly preserving bone lengths across all nodes.
   */
  private poseJointInPreview(jointId: AnatomicalJointId, wx: number, wy: number): void {
    this.previewJoints = poseJointPreservingBones(jointId, wx, wy, this.restJoints, this.previewJoints);
  }

  public render(): void {
    if (!this.ctx) return;
    const rect = this.container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    // 1. Draw Grid
    this.drawGrid(w, h);

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // 2. Draw Empty State Mannequin or Character Artwork
    if (!this.sourceImage && Object.keys(this.parts).length === 0) {
      this.drawEmptyMannequin();
    } else {
      this.drawCharacterArtwork();
    }

    // 3. Draw Envelopes
    if ((this.sourceImage || Object.keys(this.parts).length > 0) && this.showEnvelopesEnabled) {
      this.drawEnvelopes();
    }

    // 4. Draw Bones
    if ((this.sourceImage || Object.keys(this.parts).length > 0) && this.showBonesEnabled) {
      this.drawBones();
    }

    // 5. Draw Joint Pins
    if (this.sourceImage || Object.keys(this.parts).length > 0) {
      if (this.showBonesEnabled || this.toolMode !== 'preview') {
        this.drawJointPins();
      }
    }

    // 6. Draw Part Transform Gizmo (WYSIWYG UX for aligning bone and graphic)
    if (this.selectedJointId && this.parts[this.selectedJointId] && this.toolMode !== 'preview') {
      this.drawPartTransformGizmo(this.selectedJointId);
    }

    this.ctx.restore();
  }

  private drawGrid(w: number, h: number): void {
    const gridSize = 24 * this.zoom;
    const majorGridSize = gridSize * 5;

    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    this.ctx.lineWidth = 1;

    const startX = this.panX % gridSize;
    const startY = this.panY % gridSize;

    for (let x = startX; x < w; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
    }
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;

    const majorStartX = this.panX % majorGridSize;
    const majorStartY = this.panY % majorGridSize;

    for (let x = majorStartX; x < w; x += majorGridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
    }
    for (let y = majorStartY; y < h; y += majorGridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
    }
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    this.ctx.lineWidth = 1.5;
    this.ctx.moveTo(0, this.panY);
    this.ctx.lineTo(w, this.panY);
    this.ctx.stroke();
  }

  private drawEmptyMannequin(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    this.ctx.lineWidth = 1.5 / this.zoom;

    // Head
    this.ctx.beginPath();
    this.ctx.arc(0, -290, 28, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Neck & Torso
    this.ctx.beginPath();
    this.ctx.roundRect(-34, -250, 68, 120, 14);
    this.ctx.fill();
    this.ctx.stroke();

    // Arms
    this.ctx.beginPath();
    this.ctx.roundRect(-62, -240, 20, 140, 10);
    this.ctx.roundRect(42, -240, 20, 140, 10);
    this.ctx.fill();
    this.ctx.stroke();

    // Legs
    this.ctx.beginPath();
    this.ctx.roundRect(-30, -125, 24, 125, 10);
    this.ctx.roundRect(6, -125, 24, 125, 10);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '600 13px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Drop a character image', 0, 45);
    this.ctx.fillText('to get started', 0, 65);

    this.ctx.restore();
  }

  private drawCharacterArtwork(): void {
    const bw = this.imageBounds.width;
    const bh = this.imageBounds.height;
    const imgX = -bw / 2;
    const imgY = -bh;

    const hasParts = Object.keys(this.parts).length > 0 || (this.dragHoverBoneId && this.dragHoverPart);

    // Reference artwork ghost underlay (helps user align graphics and bones with original artwork)
    if (this.showReferenceArtwork && this.sourceImage) {
      this.ctx.save();
      this.ctx.globalAlpha = this.referenceArtworkOpacity;
      this.ctx.drawImage(this.sourceImage, imgX, imgY, bw, bh);
      this.ctx.restore();
    }

    // In Preview Mode: Draw faint ghost of original rest pose if enabled
    if (this.toolMode === 'preview') {
      if (this.sourceImage && this.showGhostPose && !this.showReferenceArtwork) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.15;
        this.ctx.drawImage(this.sourceImage, imgX, imgY, bw, bh);
        this.ctx.restore();
      }

      // Draw posed character artwork with limb deformation and attached parts
      this.drawCharacterModel(this.previewJoints, this.restJoints);
    } else {
      // Setup / Editing Mode
      if (!hasParts && this.sourceImage) {
        // No parts attached yet: render intact base character artwork
        this.ctx.save();
        this.ctx.drawImage(this.sourceImage, imgX, imgY, bw, bh);
        this.ctx.restore();
      } else {
        // When parts are attached or preview-dragged, render character model where attached parts
        // cleanly replace the base body segments without drawing both!
        this.drawCharacterModel(this.restJoints, this.restJoints);
      }
    }
  }

  private getBoneSegmentJoints(
    boneId: AnatomicalJointId,
    joints: Record<AnatomicalJointId, { x: number; y: number }>
  ): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
    const part = this.parts[boneId];
    if (part && (part.originJointId || part.targetJointId)) {
      const boneDef = ANATOMICAL_BONES.find(b => b.id === boneId);
      const resolvePoint = (jId?: string): { x: number; y: number } | null => {
        if (!jId) return null;
        if (jId === 'hip_mid') {
          if (joints.hip_l && joints.hip_r) {
            return { x: (joints.hip_l.x + joints.hip_r.x) / 2, y: (joints.hip_l.y + joints.hip_r.y) / 2 };
          }
        }
        return joints[jId as AnatomicalJointId] || null;
      };

      const origId = part.originJointId || (boneDef?.originJointId || boneId);
      const tgtId = part.targetJointId || boneDef?.targetJointId;
      const p1 = resolvePoint(origId);
      let p2 = resolvePoint(tgtId);
      if (!p2 && boneDef?.defaultLength && p1) {
        p2 = { x: p1.x, y: p1.y + boneDef.defaultLength };
      }
      if (p1 && p2) {
        return { p1, p2 };
      }
    }

    switch (boneId) {
      case 'head':
        return { p1: joints.neck, p2: joints.head };
      case 'neck': {
        const p1 = joints.chest || { x: 0, y: joints.neck.y + 28 };
        return { p1, p2: joints.neck };
      }
      case 'chest': {
        const hipMid = { x: (joints.hip_l.x + joints.hip_r.x) / 2, y: (joints.hip_l.y + joints.hip_r.y) / 2 };
        const p2 = joints.chest || { x: 0, y: joints.neck.y + 28 };
        return { p1: hipMid, p2 };
      }
      case 'shoulder_l':
        return { p1: joints.shoulder_l, p2: joints.elbow_l };
      case 'elbow_l':
        return { p1: joints.elbow_l, p2: joints.wrist_l };
      case 'wrist_l': {
        const dx = joints.wrist_l.x - joints.elbow_l.x;
        const dy = joints.wrist_l.y - joints.elbow_l.y;
        const len = Math.hypot(dx, dy) || 1;
        const p2 = joints.hand_l || { x: joints.wrist_l.x + (dx / len) * 28, y: joints.wrist_l.y + (dy / len) * 28 };
        return { p1: joints.wrist_l, p2 };
      }
      case 'shoulder_r':
        return { p1: joints.shoulder_r, p2: joints.elbow_r };
      case 'elbow_r':
        return { p1: joints.elbow_r, p2: joints.wrist_r };
      case 'wrist_r': {
        const dx = joints.wrist_r.x - joints.elbow_r.x;
        const dy = joints.wrist_r.y - joints.elbow_r.y;
        const len = Math.hypot(dx, dy) || 1;
        const p2 = joints.hand_r || { x: joints.wrist_r.x + (dx / len) * 28, y: joints.wrist_r.y + (dy / len) * 28 };
        return { p1: joints.wrist_r, p2 };
      }
      case 'hip_l':
        return { p1: joints.hip_l, p2: joints.knee_l };
      case 'knee_l':
        return { p1: joints.knee_l, p2: joints.ankle_l };
      case 'ankle_l': {
        const p2 = joints.foot_l || { x: joints.ankle_l.x + 4, y: joints.ankle_l.y + 36 };
        return { p1: joints.ankle_l, p2 };
      }
      case 'hip_r':
        return { p1: joints.hip_r, p2: joints.knee_r };
      case 'knee_r':
        return { p1: joints.knee_r, p2: joints.ankle_r };
      case 'ankle_r': {
        const p2 = joints.foot_r || { x: joints.ankle_r.x - 4, y: joints.ankle_r.y + 36 };
        return { p1: joints.ankle_r, p2 };
      }
      default:
        return null;
    }
  }

  /**
   * Renders the articulated character model.
   * If a bone has an attached part (or is currently being hovered with a dragged part),
   * the attached part is rendered in place of the base artwork.
   * Otherwise, if base sourceImage exists, renders the clipped limb segment.
   */
  private drawCharacterModel(
    pj: Record<AnatomicalJointId, { x: number; y: number }>,
    rj: Record<AnatomicalJointId, { x: number; y: number }>
  ): void {
    const img = this.sourceImage;

    const getPart = (boneId: AnatomicalJointId): BonePartAttachment | null => {
      if (this.dragHoverBoneId === boneId && this.dragHoverPart) {
        return {
          boneId,
          image: this.dragHoverPart.image,
          imageUrl: this.dragHoverPart.imageUrl,
          fileName: this.dragHoverPart.name,
          scale: 1.0,
          offsetX: 0,
          offsetY: 0,
          pivotX: this.dragHoverPart.pivotX,
          pivotY: this.dragHoverPart.pivotY
        };
      }
      return this.parts[boneId] || null;
    };

    this.ctx.save();
    for (const boneId of this.boneDrawOrder) {
      this.drawBoneSegment(boneId, pj, rj, img, getPart);
    }
    this.ctx.restore();
  }

  private drawBoneSegment(
    boneId: AnatomicalJointId,
    pj: Record<AnatomicalJointId, { x: number; y: number }>,
    rj: Record<AnatomicalJointId, { x: number; y: number }>,
    img: HTMLImageElement | null,
    getPart: (bId: AnatomicalJointId) => BonePartAttachment | null
  ): void {
    const part = getPart(boneId);
    if (part) {
      const seg = this.getBoneSegmentJoints(boneId, pj);
      const rSeg = this.getBoneSegmentJoints(boneId, rj);
      if (seg && rSeg) {
        this.drawAttachedPart(part, seg.p1, seg.p2, rSeg.p1);
      }
      return;
    }

    if (!img) return;

    switch (boneId) {
      case 'shoulder_r':
        if (rj.shoulder_r && rj.elbow_r && pj.shoulder_r && pj.elbow_r) {
          this.drawLimbSegment(img, rj.shoulder_r, rj.elbow_r, pj.shoulder_r, pj.elbow_r, this.getEnvelopeRadius('shoulder_r'));
        }
        break;
      case 'elbow_r':
        if (rj.elbow_r && rj.wrist_r && pj.elbow_r && pj.wrist_r) {
          this.drawLimbSegment(img, rj.elbow_r, rj.wrist_r, pj.elbow_r, pj.wrist_r, this.getEnvelopeRadius('elbow_r'));
        }
        break;
      case 'wrist_r': {
        const rSeg = this.getBoneSegmentJoints('wrist_r', rj);
        const pSeg = this.getBoneSegmentJoints('wrist_r', pj);
        if (rSeg && pSeg) {
          this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('wrist_r'));
        }
        break;
      }
      case 'hip_r':
        if (rj.hip_r && rj.knee_r && pj.hip_r && pj.knee_r) {
          this.drawLimbSegment(img, rj.hip_r, rj.knee_r, pj.hip_r, pj.knee_r, this.getEnvelopeRadius('hip_r'));
        }
        break;
      case 'knee_r':
        if (rj.knee_r && rj.ankle_r && pj.knee_r && pj.ankle_r) {
          this.drawLimbSegment(img, rj.knee_r, rj.ankle_r, pj.knee_r, pj.ankle_r, this.getEnvelopeRadius('knee_r'));
        }
        break;
      case 'ankle_r': {
        const rSeg = this.getBoneSegmentJoints('ankle_r', rj);
        const pSeg = this.getBoneSegmentJoints('ankle_r', pj);
        if (rSeg && pSeg) {
          this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('ankle_r'));
        }
        break;
      }
      case 'chest': {
        if (rj.hip_l && rj.hip_r && pj.hip_l && pj.hip_r) {
          const restHipMid = { x: (rj.hip_l.x + rj.hip_r.x) / 2, y: (rj.hip_l.y + rj.hip_r.y) / 2 };
          const posedHipMid = { x: (pj.hip_l.x + pj.hip_r.x) / 2, y: (pj.hip_l.y + pj.hip_r.y) / 2 };
          const chestPosed = pj.chest || pj.neck;
          const chestRest = rj.chest || rj.neck;
          if (chestRest && chestPosed) {
            this.drawLimbSegment(img, restHipMid, chestRest, posedHipMid, chestPosed, this.getEnvelopeRadius('chest'));
          }
        }
        break;
      }
      case 'neck': {
        const seg = this.getBoneSegmentJoints('neck', pj);
        const rSeg = this.getBoneSegmentJoints('neck', rj);
        if (seg && rSeg) {
          this.drawLimbSegment(img, rSeg.p1, rSeg.p2, seg.p1, seg.p2, this.getEnvelopeRadius('neck'));
        }
        break;
      }
      case 'hip_l':
        if (rj.hip_l && rj.knee_l && pj.hip_l && pj.knee_l) {
          this.drawLimbSegment(img, rj.hip_l, rj.knee_l, pj.hip_l, pj.knee_l, this.getEnvelopeRadius('hip_l'));
        }
        break;
      case 'knee_l':
        if (rj.knee_l && rj.ankle_l && pj.knee_l && pj.ankle_l) {
          this.drawLimbSegment(img, rj.knee_l, rj.ankle_l, pj.knee_l, pj.ankle_l, this.getEnvelopeRadius('knee_l'));
        }
        break;
      case 'ankle_l': {
        const rSeg = this.getBoneSegmentJoints('ankle_l', rj);
        const pSeg = this.getBoneSegmentJoints('ankle_l', pj);
        if (rSeg && pSeg) {
          this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('ankle_l'));
        }
        break;
      }
      case 'head':
        if (rj.neck && rj.head && pj.neck && pj.head) {
          this.drawLimbSegment(img, rj.neck, rj.head, pj.neck, pj.head, this.getEnvelopeRadius('head'));
        }
        break;
      case 'shoulder_l':
        if (rj.shoulder_l && rj.elbow_l && pj.shoulder_l && pj.elbow_l) {
          this.drawLimbSegment(img, rj.shoulder_l, rj.elbow_l, pj.shoulder_l, pj.elbow_l, this.getEnvelopeRadius('shoulder_l'));
        }
        break;
      case 'elbow_l':
        if (rj.elbow_l && rj.wrist_l && pj.elbow_l && pj.wrist_l) {
          this.drawLimbSegment(img, rj.elbow_l, rj.wrist_l, pj.elbow_l, pj.wrist_l, this.getEnvelopeRadius('elbow_l'));
        }
        break;
      case 'wrist_l': {
        const rSeg = this.getBoneSegmentJoints('wrist_l', rj);
        const pSeg = this.getBoneSegmentJoints('wrist_l', pj);
        if (rSeg && pSeg) {
          this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('wrist_l'));
        }
        break;
      }
    }
  }

  public getPartTransformInfo(
    boneId: AnatomicalJointId,
    joints?: Record<AnatomicalJointId, { x: number; y: number }>
  ) {
    const part = this.parts[boneId];
    if (!part || !part.image || !part.image.width || !part.image.height) return null;

    const j = joints || (this.toolMode === 'preview' ? this.previewJoints : this.restJoints);
    const seg = this.getBoneSegmentJoints(boneId, j);
    if (!seg) return null;

    const pointA = seg.p1;
    const pointB = seg.p2;

    const bh = this.imageBounds.height;
    const srcNatH = this.sourceImage?.naturalHeight || 740;
    const charScale = bh / srcNatH;

    const scale = (part.scale ?? 1.0) * charScale;
    const targetW = part.image.width * scale;
    const targetH = part.image.height * scale;

    const boneDef = ANATOMICAL_BONES.find(b => b.id === boneId);
    const isSpine = boneDef?.category === 'spine';

    const anchorX = part.pivotX !== undefined ? part.pivotX : 0.5;
    const anchorY = part.pivotY !== undefined ? part.pivotY : (isSpine ? (boneId === 'head' ? 0.78 : 0.5) : 0.15);

    const posedAngle = Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x);
    const baseAngle = isSpine ? (posedAngle + Math.PI / 2) : (posedAngle - Math.PI / 2);
    const rotAngle = baseAngle + (part.rotation || 0);

    const offX = part.offsetX ?? 0;
    const offY = part.offsetY ?? 0;

    const pivotWorldX = pointA.x + offX;
    const pivotWorldY = pointA.y + offY;

    const imgLocalX = -targetW * anchorX;
    const imgLocalY = -targetH * anchorY;

    return {
      part,
      boneId,
      pointA,
      pointB,
      isSpine,
      targetW,
      targetH,
      charScale,
      anchorX,
      anchorY,
      baseAngle,
      rotAngle,
      offX,
      offY,
      pivotWorldX,
      pivotWorldY,
      imgLocalX,
      imgLocalY,
      flipX: !!part.flipX,
      flipY: !!part.flipY
    };
  }

  public hitTestPartGizmo(
    boneId: AnatomicalJointId,
    wx: number,
    wy: number
  ): 'rotate' | 'pivot' | 'body' | null {
    const info = this.getPartTransformInfo(boneId);
    if (!info) return null;

    const dx = wx - info.pivotWorldX;
    const dy = wy - info.pivotWorldY;
    const cos = Math.cos(-info.rotAngle);
    const sin = Math.sin(-info.rotAngle);
    let lx = dx * cos - dy * sin;
    let ly = dx * sin + dy * cos;

    // 1. Pivot handle (at 0,0)
    if (Math.hypot(lx, ly) <= 12 / this.zoom) {
      return 'pivot';
    }

    // 2. Rotate handle knob at (0, -rotRadius) or along the rotation guide circle
    const rotRadius = Math.max(48 / this.zoom, Math.hypot(info.targetW, info.targetH) * 0.45);
    const distToKnob = Math.hypot(lx - 0, ly - (-rotRadius));
    if (distToKnob <= 18 / this.zoom) {
      return 'rotate';
    }

    const distFromPivot = Math.hypot(lx, ly);
    if (Math.abs(distFromPivot - rotRadius) <= 7 / this.zoom) {
      return 'rotate';
    }

    if (info.flipX) lx = -lx;
    if (info.flipY) ly = -ly;

    const imgX = info.imgLocalX;
    const imgY = info.imgLocalY;
    const targetW = info.targetW;
    const targetH = info.targetH;

    // 3. Inside graphic body (for moving/translating)
    if (lx >= imgX && lx <= imgX + targetW && ly >= imgY && ly <= imgY + targetH) {
      return 'body';
    }

    return null;
  }

  public getPartAtPoint(wx: number, wy: number): AnatomicalJointId | null {
    // Check in reverse draw order so top-most rendered parts are clicked first
    for (let i = this.boneDrawOrder.length - 1; i >= 0; i--) {
      const bId = this.boneDrawOrder[i];
      if (this.parts[bId]) {
        const hit = this.hitTestPartGizmo(bId, wx, wy);
        if (hit) return bId;
      }
    }
    return null;
  }

  private drawAttachedPart(
    part: BonePartAttachment,
    pointA: { x: number; y: number },
    pointB: { x: number; y: number },
    _restJoint?: { x: number; y: number }
  ): void {
    const img = part.image;
    if (!img.width || !img.height) return;

    const bh = this.imageBounds.height;
    const posedAngle = Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x);

    const boneDef = ANATOMICAL_BONES.find(b => b.id === part.boneId);
    const isSpine = boneDef?.category === 'spine';

    const srcNatH = this.sourceImage?.naturalHeight || 740;
    const charScale = bh / srcNatH;

    const scale = (part.scale ?? 1.0) * charScale;
    const targetW = img.width * scale;
    const targetH = img.height * scale;

    const anchorX = part.pivotX !== undefined ? part.pivotX : 0.5;
    const anchorY = part.pivotY !== undefined ? part.pivotY : (isSpine ? (part.boneId === 'head' ? 0.78 : 0.5) : 0.15);

    const baseAngle = isSpine ? (posedAngle + Math.PI / 2) : (posedAngle - Math.PI / 2);
    const rotAngle = baseAngle + (part.rotation || 0);

    this.ctx.save();
    this.ctx.translate(pointA.x + (part.offsetX ?? 0), pointA.y + (part.offsetY ?? 0));
    this.ctx.rotate(rotAngle);

    if (part.flipX || part.flipY) {
      this.ctx.scale(part.flipX ? -1 : 1, part.flipY ? -1 : 1);
    }

    this.ctx.drawImage(img, -targetW * anchorX, -targetH * anchorY, targetW, targetH);
    this.ctx.restore();
  }

  private drawPartTransformGizmo(boneId: AnatomicalJointId): void {
    const info = this.getPartTransformInfo(boneId);
    if (!info) return;

    const { targetW, targetH, rotAngle, offX, offY, pointA } = info;

    this.ctx.save();
    this.ctx.translate(pointA.x + offX, pointA.y + offY);
    this.ctx.rotate(rotAngle);

    // Dynamic rotation handle distance based on graphic size
    const rotRadius = Math.max(48 / this.zoom, Math.hypot(targetW, targetH) * 0.45);
    const isRotHover = this.hoveredGizmoHandle === 'rotate' || (this.isTransformingPart && this.transformAction === 'rotate');

    // 1. Sleek circular rotation guide ring around the pivot
    this.ctx.beginPath();
    this.ctx.arc(0, 0, rotRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = isRotHover ? 'rgba(56, 189, 248, 0.75)' : 'rgba(56, 189, 248, 0.3)';
    this.ctx.lineWidth = 1.5 / this.zoom;
    this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 2. Stem connecting pivot to the rotation knob
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, -rotRadius);
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2 / this.zoom;
    this.ctx.stroke();

    // 3. Prominent Rotation Handle Knob
    const knobR = (isRotHover ? 11 : 9.5) / this.zoom;

    // Glowing halo on hover/drag
    if (isRotHover) {
      this.ctx.beginPath();
      this.ctx.arc(0, -rotRadius, knobR + 4 / this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      this.ctx.fill();
    }

    // Handle knob circle
    this.ctx.beginPath();
    this.ctx.arc(0, -rotRadius, knobR, 0, Math.PI * 2);
    this.ctx.fillStyle = isRotHover ? '#38bdf8' : '#0284c7';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2 / this.zoom;
    this.ctx.stroke();

    // Curved rotate symbol (↻) inside the knob
    this.ctx.beginPath();
    const iconR = 4.5 / this.zoom;
    this.ctx.arc(0, -rotRadius, iconR, -Math.PI * 0.8, Math.PI * 0.6);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5 / this.zoom;
    this.ctx.stroke();

    // Arrow head
    const arrowX = Math.cos(Math.PI * 0.6) * iconR;
    const arrowY = -rotRadius + Math.sin(Math.PI * 0.6) * iconR;
    this.ctx.beginPath();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.arc(arrowX, arrowY, 1.8 / this.zoom, 0, Math.PI * 2);
    this.ctx.fill();

    // 4. Pivot Crosshair Anchor Marker (always at local 0,0)
    const isPivotHover = this.hoveredGizmoHandle === 'pivot';
    const pivotR = (isPivotHover ? 7.5 : 6) / this.zoom;

    this.ctx.beginPath();
    this.ctx.arc(0, 0, pivotR, 0, Math.PI * 2);
    this.ctx.fillStyle = isPivotHover ? 'rgba(34, 197, 94, 0.45)' : 'rgba(34, 197, 94, 0.2)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#22c55e';
    this.ctx.lineWidth = 1.5 / this.zoom;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 2 / this.zoom, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    const tickLen = 9 / this.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(-tickLen, 0);
    this.ctx.lineTo(tickLen, 0);
    this.ctx.moveTo(0, -tickLen);
    this.ctx.lineTo(0, tickLen);
    this.ctx.strokeStyle = '#22c55e';
    this.ctx.lineWidth = 1.2 / this.zoom;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawLimbSegment(
    img: HTMLImageElement,
    restA: { x: number; y: number },
    restB: { x: number; y: number },
    posedA: { x: number; y: number },
    posedB: { x: number; y: number },
    radius: number
  ): void {
    const bw = this.imageBounds.width;
    const bh = this.imageBounds.height;

    const restAngle = Math.atan2(restB.y - restA.y, restB.x - restA.x);
    const posedAngle = Math.atan2(posedB.y - posedA.y, posedB.x - posedA.x);
    const rotDelta = posedAngle - restAngle;

    this.ctx.save();
    this.ctx.translate(posedA.x, posedA.y);
    this.ctx.rotate(rotDelta);
    this.ctx.translate(-restA.x, -restA.y);

    // Accurate generous capsule clipping enclosing the anatomical limb
    const effectiveRadius = Math.max(radius, 25);
    pathCapsule(this.ctx, restA.x, restA.y, restB.x, restB.y, effectiveRadius);
    this.ctx.clip();

    this.ctx.drawImage(img, -bw / 2, -bh, bw, bh);
    this.ctx.restore();
  }

  public getBoneAtPoint(wx: number, wy: number): AnatomicalJointId | null {
    const joints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;
    let closestBone: AnatomicalJointId | null = null;
    let minDistance = Infinity;

    for (const bone of ANATOMICAL_BONES) {
      const seg = this.getBoneSegmentJoints(bone.id, joints);
      if (!seg) continue;

      const radius = this.getEnvelopeRadius(bone.id);
      const dist = this.distToSegment(wx, wy, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
      if (dist <= radius * 1.5 && dist < minDistance) {
        minDistance = dist;
        closestBone = bone.id;
      }
    }

    return closestBone;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  private drawEnvelopes(): void {
    const joints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;

    for (const bone of ANATOMICAL_BONES) {
      const seg = this.getBoneSegmentJoints(bone.id, joints);
      if (!seg) continue;

      const radius = this.getEnvelopeRadius(bone.id);
      const isSelected = this.selectedJointId === bone.id;
      const isDragHover = this.dragHoverBoneId === bone.id;

      this.ctx.save();
      pathCapsule(this.ctx, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, radius);

      if (isDragHover) {
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2.5 / this.zoom;
        this.ctx.setLineDash([]);
        this.ctx.stroke();

        // Draw drop target text badge with clear Bone name
        const midX = (seg.p1.x + seg.p2.x) / 2;
        const midY = (seg.p1.y + seg.p2.y) / 2;
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `600 ${Math.max(9, 11 / this.zoom)}px Inter, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(`Drop on ${bone.name}`, midX, midY);
        this.ctx.restore();
      } else if (isSelected) {
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.stroke();

        // Display bone name when selected
        const midX = (seg.p1.x + seg.p2.x) / 2;
        const midY = (seg.p1.y + seg.p2.y) / 2;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = `600 ${Math.max(8, 10 / this.zoom)}px Inter, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
        this.ctx.shadowBlur = 3;
        this.ctx.fillText(bone.name, midX, midY);
        this.ctx.restore();
      } else {
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }
  }

  private drawBones(): void {
    const joints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;
    const hipMid = {
      x: (joints.hip_l.x + joints.hip_r.x) / 2,
      y: (joints.hip_l.y + joints.hip_r.y) / 2
    };

    // Clean anatomical skeleton connections: each bone starts from a joint, has length and envelope
    const bonePairs: [{ x: number; y: number }, { x: number; y: number }][] = [
      // Spine & Head
      [hipMid, joints.neck],
      [joints.neck, joints.head],

      // Pelvis branches
      [hipMid, joints.hip_l],
      [hipMid, joints.hip_r],

      // Shoulders & Forearms
      [joints.neck, joints.shoulder_l],
      [joints.shoulder_l, joints.elbow_l],
      [joints.elbow_l, joints.wrist_l],

      [joints.neck, joints.shoulder_r],
      [joints.shoulder_r, joints.elbow_r],
      [joints.elbow_r, joints.wrist_r],

      // Legs
      [joints.hip_l, joints.knee_l],
      [joints.knee_l, joints.ankle_l],

      [joints.hip_r, joints.knee_r],
      [joints.knee_r, joints.ankle_r]
    ];

    // Include hand bones (starting at wrist joint, projecting outward)
    const wristLSeg = this.getBoneSegmentJoints('wrist_l', joints);
    const wristRSeg = this.getBoneSegmentJoints('wrist_r', joints);
    if (wristLSeg) bonePairs.push([wristLSeg.p1, wristLSeg.p2]);
    if (wristRSeg) bonePairs.push([wristRSeg.p1, wristRSeg.p2]);

    // Include foot bones (starting at ankle joint, projecting downward)
    const ankleLSeg = this.getBoneSegmentJoints('ankle_l', joints);
    const ankleRSeg = this.getBoneSegmentJoints('ankle_r', joints);
    if (ankleLSeg) bonePairs.push([ankleLSeg.p1, ankleLSeg.p2]);
    if (ankleRSeg) bonePairs.push([ankleRSeg.p1, ankleRSeg.p2]);

    for (const [p, c] of bonePairs) {
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const len = Math.hypot(dx, dy);
      if (len < 2) continue;

      const angle = Math.atan2(dy, dx);

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(angle);

      // Stylized tapered bone link
      const baseW = 3.6 / this.zoom;
      const tipW = 1.6 / this.zoom;

      this.ctx.beginPath();
      this.ctx.moveTo(0, -baseW);
      this.ctx.lineTo(len, -tipW);
      this.ctx.lineTo(len, tipW);
      this.ctx.lineTo(0, baseW);
      this.ctx.closePath();

      const grad = this.ctx.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0.3)');
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.2 / this.zoom;
      this.ctx.stroke();

      // Rounded base joint ring
      this.ctx.beginPath();
      this.ctx.arc(0, 0, baseW * 0.9, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  private drawJointPins(): void {
    const joints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;

    for (const joint of ANATOMICAL_JOINTS) {
      const pt = joints[joint.id];
      if (!pt) continue;

      const isSelected = this.selectedJointId === joint.id;
      const isHovered = this.hoveredJointId === joint.id;

      const pinRadius = (isSelected ? 7.5 : isHovered ? 6.5 : 5.5) / this.zoom;

      this.ctx.save();
      this.ctx.translate(pt.x, pt.y);

      // 1. Soft drop shadow underneath pin
      this.ctx.beginPath();
      this.ctx.arc(0, 1.2 / this.zoom, pinRadius + 1.5 / this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.ctx.fill();

      // 2. Outer Halo Selection / Hover Ring
      if (isSelected || isHovered) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, pinRadius + 4 / this.zoom, 0, Math.PI * 2);
        this.ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)';
        this.ctx.lineWidth = 1.8 / this.zoom;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, pinRadius + 2.5 / this.zoom, 0, Math.PI * 2);
        this.ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)';
        this.ctx.fill();
      }

      // 3. Dark Outer Rim
      this.ctx.beginPath();
      this.ctx.arc(0, 0, pinRadius + 0.5 / this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = '#0f172a';
      this.ctx.fill();

      // 4. Glossy 3D Spherical Radial Gradient
      const grad = this.ctx.createRadialGradient(
        -pinRadius * 0.35, -pinRadius * 0.35, pinRadius * 0.1,
        0, 0, pinRadius
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, joint.color);
      grad.addColorStop(1, this.shadeColor(joint.color, -0.3));

      this.ctx.beginPath();
      this.ctx.arc(0, 0, pinRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // 5. Delicate Center Core Dot
      this.ctx.beginPath();
      this.ctx.arc(0, 0, pinRadius * 0.35, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = joint.color;
      this.ctx.shadowBlur = 4;
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  private shadeColor(color: string, percent: number): string {
    let num = parseInt(color.replace('#', ''), 16);
    if (isNaN(num)) return color;
    let amt = Math.round(2.55 * percent * 100);
    let R = (num >> 16) + amt;
    let G = ((num >> 8) & 0x00FF) + amt;
    let B = (num & 0x0000FF) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
}

