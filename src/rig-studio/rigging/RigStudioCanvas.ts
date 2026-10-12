import {
  AnatomicalJointDef,
  AnatomicalJointId,
  JointToolMode,
  StudioView
} from '../types';
import {
  ANATOMICAL_JOINTS,
  BONE_CONNECTIONS,
  getDefaultJointPositions,
  solveTwoBoneIK
} from './AnatomicalRig';

export interface RigStudioCanvasEvents {
  onJointSelected?: (jointId: AnatomicalJointId | null) => void;
  onJointsModified?: (joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onImageDropped?: (file: File) => void;
}

export class RigStudioCanvas {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private currentView: StudioView = 'front';
  private toolMode: JointToolMode = 'select';
  private symmetryEnabled = true;
  private showBonesEnabled = true;

  private sourceImage: HTMLImageElement | null = null;
  private imageName = '';
  private imageBounds = { width: 220, height: 420 };

  // Current placed joints in active view
  private restJoints: Record<AnatomicalJointId, { x: number; y: number }>;
  // Posed joints during Preview Mode
  private previewJoints: Record<AnatomicalJointId, { x: number; y: number }>;

  private selectedJointId: AnatomicalJointId | null = null;
  private hoveredJointId: AnatomicalJointId | null = null;

  // Pan & Zoom
  private zoom = 1.35;
  private panX = 0;
  private panY = 0;
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

  public setView(view: StudioView, joints?: Record<AnatomicalJointId, { x: number; y: number }>): void {
    this.currentView = view;
    if (joints) {
      this.restJoints = { ...joints };
    } else {
      this.restJoints = getDefaultJointPositions(view, this.imageBounds.width, this.imageBounds.height);
    }
    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
    this.selectedJointId = null;
    this.render();
  }

  public setSourceImage(img: HTMLImageElement | null, name = ''): void {
    this.sourceImage = img;
    this.imageName = name;
    if (img && img.width && img.height) {
      // Determine display bounds matching character proportions
      const aspect = img.width / img.height;
      const targetHeight = 380;
      this.imageBounds = {
        width: Math.round(targetHeight * aspect),
        height: targetHeight
      };
      // Scale and fit default joints if not previously custom-placed
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

    // Drag and drop images
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      this.container.classList.add('drag-over');
    });

    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          if (this.events.onImageDropped) this.events.onImageDropped(file);
        }
      }
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
          // Preview posing mode with inverse kinematics & limb manipulation
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
      // Central joints stay on symmetry axis X = 0
      this.restJoints[jointId] = { x: 0, y: Math.round(wy) };
    } else {
      this.restJoints[jointId] = { x: Math.round(wx), y: Math.round(wy) };
      // Symmetry mirroring
      if (this.symmetryEnabled && jointDef.symmetricWith) {
        const symId = jointDef.symmetricWith;
        this.restJoints[symId] = { x: -Math.round(wx), y: Math.round(wy) };
      }
    }

    this.previewJoints = JSON.parse(JSON.stringify(this.restJoints));
  }

  private poseJointInPreview(jointId: AnatomicalJointId, wx: number, wy: number): void {
    const target = { x: wx, y: wy };

    // Limb 2-bone IK solving for wrists and ankles
    if (jointId === 'wrist_l') {
      const root = this.previewJoints.shoulder_l;
      const mid = this.previewJoints.elbow_l;
      const ik = solveTwoBoneIK(root, mid, this.previewJoints.wrist_l, target, true);
      this.previewJoints.elbow_l = ik.mid;
      this.previewJoints.wrist_l = ik.end;
      return;
    }
    if (jointId === 'wrist_r') {
      const root = this.previewJoints.shoulder_r;
      const mid = this.previewJoints.elbow_r;
      const ik = solveTwoBoneIK(root, mid, this.previewJoints.wrist_r, target, false);
      this.previewJoints.elbow_r = ik.mid;
      this.previewJoints.wrist_r = ik.end;
      return;
    }
    if (jointId === 'ankle_l') {
      const root = this.previewJoints.hip_l;
      const mid = this.previewJoints.knee_l;
      const ik = solveTwoBoneIK(root, mid, this.previewJoints.ankle_l, target, false);
      this.previewJoints.knee_l = ik.mid;
      this.previewJoints.ankle_l = ik.end;
      return;
    }
    if (jointId === 'ankle_r') {
      const root = this.previewJoints.hip_r;
      const mid = this.previewJoints.knee_r;
      const ik = solveTwoBoneIK(root, mid, this.previewJoints.ankle_r, target, true);
      this.previewJoints.knee_r = ik.mid;
      this.previewJoints.ankle_r = ik.end;
      return;
    }

    // Direct movement for other joints
    this.previewJoints[jointId] = { x: Math.round(wx), y: Math.round(wy) };
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
    if (!this.sourceImage) {
      this.drawEmptyMannequin();
    } else {
      this.drawCharacterArtwork();
    }

    // 3. Draw Bones
    if (this.sourceImage && this.showBonesEnabled) {
      this.drawBones();
    }

    // 4. Draw Joint Pins
    if (this.sourceImage) {
      this.drawJointPins();
    }

    this.ctx.restore();
  }

  private drawGrid(w: number, h: number): void {
    const gridSize = 24 * this.zoom;
    const majorGridSize = gridSize * 5;

    // Background color
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, w, h);

    // Minor lines
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

    // Major lines
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

    // Center Origin Ground Line (X-axis at y=panY)
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    this.ctx.lineWidth = 1.5;
    this.ctx.moveTo(0, this.panY);
    this.ctx.lineTo(w, this.panY);
    this.ctx.stroke();
  }

  private drawEmptyMannequin(): void {
    this.ctx.save();
    // Faint standing humanoid silhouette
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

    // Empty state text
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '600 13px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Drop a character image', 0, 45);
    this.ctx.fillText('to get started', 0, 65);

    this.ctx.restore();
  }

  private drawCharacterArtwork(): void {
    if (!this.sourceImage) return;

    const bw = this.imageBounds.width;
    const bh = this.imageBounds.height;
    const imgX = -bw / 2;
    const imgY = -bh;

    // In Preview Mode: Draw faint ghost of original rest pose
    if (this.toolMode === 'preview') {
      this.ctx.save();
      this.ctx.globalAlpha = 0.22;
      this.ctx.drawImage(this.sourceImage, imgX, imgY, bw, bh);
      this.ctx.restore();

      // Draw posed character artwork with limb deformation
      this.drawPosedArtwork(bw, bh);
    } else {
      // Normal setup mode: crisp rest artwork
      this.ctx.save();
      this.ctx.drawImage(this.sourceImage, imgX, imgY, bw, bh);
      this.ctx.restore();
    }
  }

  /**
   * Articulates character artwork limbs according to the posed preview joints.
   */
  private drawPosedArtwork(bw: number, bh: number): void {
    if (!this.sourceImage) return;

    const img = this.sourceImage;
    const pj = this.previewJoints;
    const rj = this.restJoints;

    this.ctx.save();

    // Torso / Head
    const torsoDy = pj.neck.y - rj.neck.y;
    const torsoDx = pj.neck.x - rj.neck.x;
    this.ctx.save();
    this.ctx.translate(torsoDx, torsoDy);
    this.ctx.drawImage(
      img,
      0, 0, img.width, img.height * 0.65,
      -bw / 2, -bh, bw, bh * 0.65
    );
    this.ctx.restore();

    // Left Arm (upper arm, elbow to wrist)
    this.drawLimbSegment(img, rj.shoulder_l, rj.elbow_l, pj.shoulder_l, pj.elbow_l, bw * 0.35);
    this.drawLimbSegment(img, rj.elbow_l, rj.wrist_l, pj.elbow_l, pj.wrist_l, bw * 0.3);

    // Right Arm (upper arm, elbow to wrist)
    this.drawLimbSegment(img, rj.shoulder_r, rj.elbow_r, pj.shoulder_r, pj.elbow_r, bw * 0.35);
    this.drawLimbSegment(img, rj.elbow_r, rj.wrist_r, pj.elbow_r, pj.wrist_r, bw * 0.3);

    // Left Leg (thigh and calf/foot)
    this.drawLimbSegment(img, rj.hip_l, rj.knee_l, pj.hip_l, pj.knee_l, bw * 0.35);
    this.drawLimbSegment(img, rj.knee_l, rj.ankle_l, pj.knee_l, pj.ankle_l, bw * 0.35);

    // Right Leg (thigh and calf/foot)
    this.drawLimbSegment(img, rj.hip_r, rj.knee_r, pj.hip_r, pj.knee_r, bw * 0.35);
    this.drawLimbSegment(img, rj.knee_r, rj.ankle_r, pj.knee_r, pj.ankle_r, bw * 0.35);

    this.ctx.restore();
  }

  private drawLimbSegment(
    img: HTMLImageElement,
    restA: { x: number; y: number },
    restB: { x: number; y: number },
    posedA: { x: number; y: number },
    posedB: { x: number; y: number },
    segmentWidth: number
  ): void {
    const bw = this.imageBounds.width;
    const bh = this.imageBounds.height;

    const restAngle = Math.atan2(restB.y - restA.y, restB.x - restA.x);
    const posedAngle = Math.atan2(posedB.y - posedA.y, posedB.x - posedA.x);
    const rotDelta = posedAngle - restAngle;

    const restLen = Math.hypot(restB.x - restA.x, restB.y - restA.y) || 1;
    const posedLen = Math.hypot(posedB.x - posedA.x, posedB.y - posedA.y) || 1;
    const scale = posedLen / restLen;

    this.ctx.save();
    this.ctx.translate(posedA.x, posedA.y);
    this.ctx.rotate(rotDelta);
    this.ctx.scale(1, scale);
    this.ctx.translate(-restA.x, -restA.y);

    // Clip to limb bounding cylinder
    this.ctx.beginPath();
    const cx = (restA.x + restB.x) / 2;
    const cy = (restA.y + restB.y) / 2;
    const rad = Math.max(restLen / 2 + 10, segmentWidth / 2);
    this.ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    this.ctx.clip();

    this.ctx.drawImage(img, -bw / 2, -bh, bw, bh);
    this.ctx.restore();
  }

  private drawBones(): void {
    const joints = this.toolMode === 'preview' ? this.previewJoints : this.restJoints;

    for (const [parentKey, childKey] of BONE_CONNECTIONS) {
      const p = joints[parentKey];
      const c = joints[childKey];
      if (!p || !c) continue;

      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const len = Math.hypot(dx, dy);
      if (len < 2) continue;

      const angle = Math.atan2(dy, dx);

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(angle);

      // Stylized tapered bone link
      const baseW = 4.5 / this.zoom;
      const tipW = 2.0 / this.zoom;

      this.ctx.beginPath();
      this.ctx.moveTo(0, -baseW);
      this.ctx.lineTo(len, -tipW);
      this.ctx.lineTo(len, tipW);
      this.ctx.lineTo(0, baseW);
      this.ctx.closePath();

      // Semi-transparent bone fill with crisp outline
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      this.ctx.fill();

      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.2 / this.zoom;
      this.ctx.stroke();

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

      // Outer Selection Ring
      if (isSelected || isHovered) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, pinRadius + 4 / this.zoom, 0, Math.PI * 2);
        this.ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.stroke();
      }

      // Outer colored glow
      this.ctx.beginPath();
      this.ctx.arc(0, 0, pinRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = joint.color;
      this.ctx.shadowColor = joint.color;
      this.ctx.shadowBlur = (isSelected ? 10 : 6);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Inner white center
      this.ctx.beginPath();
      this.ctx.arc(0, 0, pinRadius * 0.45, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();

      // Pin stroke
      this.ctx.beginPath();
      this.ctx.arc(0, 0, pinRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1 / this.zoom;
      this.ctx.stroke();

      this.ctx.restore();
    }
  }
}
