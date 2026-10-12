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
  getDefaultJointPositions,
  pathCapsule,
  poseJointPreservingBones
} from './AnatomicalRig';

export interface RigStudioCanvasEvents {
  onJointSelected?: (jointId: AnatomicalJointId | null) => void;
  onJointsModified?: (joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
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
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

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
    this.render();
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
    partsMap?: Record<string, BonePartAttachment>
  ): void {
    this.currentView = view;
    if (joints) {
      this.restJoints = { ...joints };
    } else {
      this.restJoints = getDefaultJointPositions(view, this.imageBounds.width, this.imageBounds.height);
    }
    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
    if (envelopes) {
      this.envelopes = { ...DEFAULT_ENVELOPES, ...envelopes };
    }
    if (partsMap) {
      this.parts = { ...partsMap };
    } else {
      this.parts = {};
    }
    this.selectedJointId = null;
    this.render();
  }

  public setSourceImage(img: HTMLImageElement | null, name = ''): void {
    this.sourceImage = img;
    this.imageName = name;
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      const targetHeight = 380;
      this.imageBounds = {
        width: Math.round(targetHeight * aspect),
        height: targetHeight
      };
      this.restJoints = getDefaultJointPositions(this.currentView, this.imageBounds.width, this.imageBounds.height);
      this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
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
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
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

      // Hit test joints
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
        this.isDraggingJoint = true;
        this.draggedJointId = clickedJointId;
        return;
      }

      // Add Joint Mode: clicking empty space places/moves selected joint or next joint
      if (this.toolMode === 'add_joint' && this.sourceImage) {
        const targetId = this.selectedJointId || 'head';
        this.moveJointWithSymmetry(targetId, world.x, world.y);
        this.selectJoint(targetId);
        this.isDraggingJoint = true;
        this.draggedJointId = targetId;
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

      if (this.isDraggingJoint && this.draggedJointId) {
        if (this.toolMode === 'preview') {
          // Preview posing mode with bone length preservation for all nodes
          this.poseJointInPreview(this.draggedJointId, world.x, world.y);
        } else {
          // Standard setup mode (places / moves joint pins with symmetry)
          this.moveJointWithSymmetry(this.draggedJointId, world.x, world.y);
        }
        this.render();
        return;
      }

      // Hover detection
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
      if (this.isDraggingJoint) {
        this.isDraggingJoint = false;
        this.draggedJointId = null;
        if (this.events.onJointsModified) {
          this.events.onJointsModified(this.restJoints);
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        this.container.style.cursor = 'grab';
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

    if (jointDef.isCenter) {
      this.restJoints[jointId] = { x: 0, y: Math.round(wy) };
    } else {
      this.restJoints[jointId] = { x: Math.round(wx), y: Math.round(wy) };
      if (this.symmetryEnabled && jointDef.symmetricWith) {
        const symId = jointDef.symmetricWith;
        this.restJoints[symId] = { x: -Math.round(wx), y: Math.round(wy) };
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
      this.drawJointPins();
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

    // In Preview Mode: Draw faint ghost of original rest pose if enabled
    if (this.toolMode === 'preview') {
      if (this.sourceImage && this.showGhostPose) {
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
    switch (boneId) {
      case 'head':
        return { p1: joints.neck, p2: joints.head };
      case 'neck': {
        const hipMid = { x: (joints.hip_l.x + joints.hip_r.x) / 2, y: (joints.hip_l.y + joints.hip_r.y) / 2 };
        return { p1: hipMid, p2: joints.neck };
      }
      case 'shoulder_l':
        return { p1: joints.shoulder_l, p2: joints.elbow_l };
      case 'elbow_l':
        return { p1: joints.elbow_l, p2: joints.wrist_l };
      case 'wrist_l': {
        const dx = joints.wrist_l.x - joints.elbow_l.x;
        const dy = joints.wrist_l.y - joints.elbow_l.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
          p1: joints.wrist_l,
          p2: { x: joints.wrist_l.x + (dx / len) * 28, y: joints.wrist_l.y + (dy / len) * 28 }
        };
      }
      case 'shoulder_r':
        return { p1: joints.shoulder_r, p2: joints.elbow_r };
      case 'elbow_r':
        return { p1: joints.elbow_r, p2: joints.wrist_r };
      case 'wrist_r': {
        const dx = joints.wrist_r.x - joints.elbow_r.x;
        const dy = joints.wrist_r.y - joints.elbow_r.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
          p1: joints.wrist_r,
          p2: { x: joints.wrist_r.x + (dx / len) * 28, y: joints.wrist_r.y + (dy / len) * 28 }
        };
      }
      case 'hip_l':
        return { p1: joints.hip_l, p2: joints.knee_l };
      case 'knee_l':
        return { p1: joints.knee_l, p2: joints.ankle_l };
      case 'ankle_l': {
        return {
          p1: joints.ankle_l,
          p2: { x: joints.ankle_l.x + 4, y: joints.ankle_l.y + 36 }
        };
      }
      case 'hip_r':
        return { p1: joints.hip_r, p2: joints.knee_r };
      case 'knee_r':
        return { p1: joints.knee_r, p2: joints.ankle_r };
      case 'ankle_r': {
        return {
          p1: joints.ankle_r,
          p2: { x: joints.ankle_r.x - 4, y: joints.ankle_r.y + 36 }
        };
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
          offsetY: 0
        };
      }
      return this.parts[boneId] || null;
    };

    this.ctx.save();

    // Layer 1: Far Arm (Right Upper Arm, Forearm, Hand)
    const partShR = getPart('shoulder_r');
    if (partShR) {
      const seg = this.getBoneSegmentJoints('shoulder_r', pj);
      const rSeg = this.getBoneSegmentJoints('shoulder_r', rj);
      if (seg && rSeg) this.drawAttachedPart(partShR, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.shoulder_r, rj.elbow_r, pj.shoulder_r, pj.elbow_r, this.getEnvelopeRadius('shoulder_r'));
    }

    const partElbR = getPart('elbow_r');
    if (partElbR) {
      const seg = this.getBoneSegmentJoints('elbow_r', pj);
      const rSeg = this.getBoneSegmentJoints('elbow_r', rj);
      if (seg && rSeg) this.drawAttachedPart(partElbR, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.elbow_r, rj.wrist_r, pj.elbow_r, pj.wrist_r, this.getEnvelopeRadius('elbow_r'));
    }

    const partWriR = getPart('wrist_r');
    if (partWriR) {
      const seg = this.getBoneSegmentJoints('wrist_r', pj);
      const rSeg = this.getBoneSegmentJoints('wrist_r', rj);
      if (seg && rSeg) this.drawAttachedPart(partWriR, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      const rSeg = this.getBoneSegmentJoints('wrist_r', rj);
      const pSeg = this.getBoneSegmentJoints('wrist_r', pj);
      if (rSeg && pSeg) {
        this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('wrist_r'));
      }
    }

    // Layer 2: Far Leg (Right Thigh, Calf, Boot)
    const partHipR = getPart('hip_r');
    if (partHipR) {
      const seg = this.getBoneSegmentJoints('hip_r', pj);
      const rSeg = this.getBoneSegmentJoints('hip_r', rj);
      if (seg && rSeg) this.drawAttachedPart(partHipR, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.hip_r, rj.knee_r, pj.hip_r, pj.knee_r, this.getEnvelopeRadius('hip_r'));
    }

    const partKneR = getPart('knee_r');
    if (partKneR) {
      const seg = this.getBoneSegmentJoints('knee_r', pj);
      const rSeg = this.getBoneSegmentJoints('knee_r', rj);
      if (seg && rSeg) this.drawAttachedPart(partKneR, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.knee_r, rj.ankle_r, pj.knee_r, pj.ankle_r, this.getEnvelopeRadius('knee_r'));
    }

    const partAnkR = getPart('ankle_r');
    if (partAnkR) {
      const seg = this.getBoneSegmentJoints('ankle_r', pj);
      const rSeg = this.getBoneSegmentJoints('ankle_r', rj);
      if (seg && rSeg) this.drawAttachedPart(partAnkR, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      const rSeg = this.getBoneSegmentJoints('ankle_r', rj);
      const pSeg = this.getBoneSegmentJoints('ankle_r', pj);
      if (rSeg && pSeg) {
        this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('ankle_r'));
      }
    }

    // Layer 3: Torso (Spine between hip midpoint and neck)
    const partTorso = getPart('neck');
    if (partTorso) {
      const seg = this.getBoneSegmentJoints('neck', pj);
      const rSeg = this.getBoneSegmentJoints('neck', rj);
      if (seg && rSeg) this.drawAttachedPart(partTorso, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      const restHipMid = { x: (rj.hip_l.x + rj.hip_r.x) / 2, y: (rj.hip_l.y + rj.hip_r.y) / 2 };
      const posedHipMid = { x: (pj.hip_l.x + pj.hip_r.x) / 2, y: (pj.hip_l.y + pj.hip_r.y) / 2 };
      this.drawLimbSegment(img, restHipMid, rj.neck, posedHipMid, pj.neck, this.getEnvelopeRadius('neck') * 1.35);
    }

    // Layer 4: Near Leg (Left Thigh, Calf, Boot)
    const partHipL = getPart('hip_l');
    if (partHipL) {
      const seg = this.getBoneSegmentJoints('hip_l', pj);
      const rSeg = this.getBoneSegmentJoints('hip_l', rj);
      if (seg && rSeg) this.drawAttachedPart(partHipL, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.hip_l, rj.knee_l, pj.hip_l, pj.knee_l, this.getEnvelopeRadius('hip_l'));
    }

    const partKneL = getPart('knee_l');
    if (partKneL) {
      const seg = this.getBoneSegmentJoints('knee_l', pj);
      const rSeg = this.getBoneSegmentJoints('knee_l', rj);
      if (seg && rSeg) this.drawAttachedPart(partKneL, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.knee_l, rj.ankle_l, pj.knee_l, pj.ankle_l, this.getEnvelopeRadius('knee_l'));
    }

    const partAnkL = getPart('ankle_l');
    if (partAnkL) {
      const seg = this.getBoneSegmentJoints('ankle_l', pj);
      const rSeg = this.getBoneSegmentJoints('ankle_l', rj);
      if (seg && rSeg) this.drawAttachedPart(partAnkL, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      const rSeg = this.getBoneSegmentJoints('ankle_l', rj);
      const pSeg = this.getBoneSegmentJoints('ankle_l', pj);
      if (rSeg && pSeg) {
        this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('ankle_l'));
      }
    }

    // Layer 5: Head (Pivoting around neck)
    const partHead = getPart('head');
    if (partHead) {
      const seg = this.getBoneSegmentJoints('head', pj);
      const rSeg = this.getBoneSegmentJoints('head', rj);
      if (seg && rSeg) this.drawAttachedPart(partHead, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.neck, rj.head, pj.neck, pj.head, this.getEnvelopeRadius('head'));
    }

    // Layer 6: Near Arm (Left Upper Arm, Forearm, Hand)
    const partShL = getPart('shoulder_l');
    if (partShL) {
      const seg = this.getBoneSegmentJoints('shoulder_l', pj);
      const rSeg = this.getBoneSegmentJoints('shoulder_l', rj);
      if (seg && rSeg) this.drawAttachedPart(partShL, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.shoulder_l, rj.elbow_l, pj.shoulder_l, pj.elbow_l, this.getEnvelopeRadius('shoulder_l'));
    }

    const partElbL = getPart('elbow_l');
    if (partElbL) {
      const seg = this.getBoneSegmentJoints('elbow_l', pj);
      const rSeg = this.getBoneSegmentJoints('elbow_l', rj);
      if (seg && rSeg) this.drawAttachedPart(partElbL, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      this.drawLimbSegment(img, rj.elbow_l, rj.wrist_l, pj.elbow_l, pj.wrist_l, this.getEnvelopeRadius('elbow_l'));
    }

    const partWriL = getPart('wrist_l');
    if (partWriL) {
      const seg = this.getBoneSegmentJoints('wrist_l', pj);
      const rSeg = this.getBoneSegmentJoints('wrist_l', rj);
      if (seg && rSeg) this.drawAttachedPart(partWriL, seg.p1, seg.p2, rSeg.p1);
    } else if (img) {
      const rSeg = this.getBoneSegmentJoints('wrist_l', rj);
      const pSeg = this.getBoneSegmentJoints('wrist_l', pj);
      if (rSeg && pSeg) {
        this.drawLimbSegment(img, rSeg.p1, rSeg.p2, pSeg.p1, pSeg.p2, this.getEnvelopeRadius('wrist_l'));
      }
    }

    this.ctx.restore();
  }

  private drawAttachedPart(
    part: BonePartAttachment,
    pointA: { x: number; y: number },
    pointB: { x: number; y: number },
    restJoint?: { x: number; y: number }
  ): void {
    const img = part.image;
    if (!img.width || !img.height) return;

    const bw = this.imageBounds.width;
    const bh = this.imageBounds.height;
    const isFullCanvas = (img.width === bw && img.height === bh);

    const posedAngle = Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x);

    this.ctx.save();

    if (isFullCanvas && restJoint) {
      const restSeg = this.getBoneSegmentJoints(part.boneId, this.restJoints);
      const restAngle = restSeg ? Math.atan2(restSeg.p2.y - restSeg.p1.y, restSeg.p2.x - restSeg.p1.x) : posedAngle;
      const rotDelta = posedAngle - restAngle;

      this.ctx.translate(pointA.x, pointA.y);
      this.ctx.rotate(rotDelta);
      this.ctx.translate(-restJoint.x, -restJoint.y);
      this.ctx.drawImage(img, -bw / 2, -bh, bw, bh);
    } else {
      const boneDef = ANATOMICAL_BONES.find(b => b.id === part.boneId);
      const isSpine = boneDef?.category === 'spine';

      // Character scale factor from original spritesheet resolution (e.g. 1536) to canvas character height (380)
      const refHeight = this.sourceImage?.naturalHeight || 1536;
      const charScale = bh / refHeight;

      const scale = (part.scale ?? 1.0) * charScale;
      const targetW = img.width * scale;
      const targetH = img.height * scale;

      this.ctx.translate(pointA.x, pointA.y);

      if (isSpine) {
        // Spine parts (Head, Torso): upright sprites with bottom-center anchor at joint pointA
        // Bone vector points upwards (approx -90 deg). rotAngle = posedAngle + Math.PI / 2
        const rotAngle = posedAngle + Math.PI / 2 + (part.rotation || 0);
        this.ctx.rotate(rotAngle);

        const offX = (part.offsetX ?? 0) - targetW / 2;
        const offY = (part.offsetY ?? 0) - targetH;
        this.ctx.drawImage(img, offX, offY, targetW, targetH);
      } else {
        // Limb parts (Arms, Legs): sprites are drawn pointing vertically down along +Y axis.
        // We orient the sprite's +Y axis along the bone vector (posedAngle).
        // rotAngle = posedAngle - Math.PI / 2
        const rotAngle = posedAngle - Math.PI / 2 + (part.rotation || 0);
        this.ctx.rotate(rotAngle);

        // Proximal joint pointA connects to top-center of limb sprite (targetW / 2, 0)
        const offX = (part.offsetX ?? 0) - targetW / 2;
        const offY = (part.offsetY ?? 0);
        this.ctx.drawImage(img, offX, offY, targetW, targetH);
      }
    }

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

    // Accurate capsule clipping matching bone envelope
    pathCapsule(this.ctx, restA.x, restA.y, restB.x, restB.y, radius);
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

    // Draw fingertip and toe tip indicators
    const tips = [wristLSeg?.p2, wristRSeg?.p2, ankleLSeg?.p2, ankleRSeg?.p2].filter(Boolean) as { x: number; y: number }[];
    for (const tip of tips) {
      this.ctx.beginPath();
      this.ctx.arc(tip.x, tip.y, 2.5 / this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fill();
      this.ctx.strokeStyle = '#0f172a';
      this.ctx.lineWidth = 1 / this.zoom;
      this.ctx.stroke();
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

