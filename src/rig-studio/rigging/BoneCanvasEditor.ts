import { SpineBoneData, VectorOutlineElement } from '../types';
import { PoseRigManager } from './PoseRigManager';

export interface BoneCanvasEvents {
  onBoneSelected?: (bone: SpineBoneData | null) => void;
  onBoneModified?: (bone: SpineBoneData) => void;
}

interface WorldBoneTransform {
  bone: SpineBoneData;
  worldX: number;
  worldY: number;
  worldRotation: number;
  tipX: number;
  tipY: number;
}

export class BoneCanvasEditor {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private rigManager: PoseRigManager;
  private sourceImage: HTMLImageElement | null = null;
  private elements: VectorOutlineElement[] = [];

  private selectedBoneName: string | null = null;

  // Pan & Zoom
  private zoom = 1.5;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private isSpacePressed = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Bone Manipulation
  private isDraggingBoneBase = false;
  private isDraggingBoneTip = false;

  private events: BoneCanvasEvents;

  constructor(container: HTMLElement, rigManager: PoseRigManager, events: BoneCanvasEvents = {}) {
    this.container = container;
    this.rigManager = rigManager;
    this.events = events;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bone-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    this.bindEvents();
    this.resizeCanvas();
    this.resetView();
  }

  public setSourceImage(img: HTMLImageElement | null): void {
    this.sourceImage = img;
    this.render();
  }

  public setElements(elements: VectorOutlineElement[]): void {
    this.elements = elements;
    this.render();
  }

  public selectBone(boneName: string | null): void {
    this.selectedBoneName = boneName;
    this.render();
    if (this.events.onBoneSelected) {
      const bone = this.rigManager.getBones().find(b => b.name === boneName) || null;
      this.events.onBoneSelected(bone);
    }
  }

  public getSelectedBone(): SpineBoneData | null {
    return this.rigManager.getBones().find(b => b.name === this.selectedBoneName) || null;
  }

  public resetView(): void {
    const rect = this.container.getBoundingClientRect();
    this.panX = Math.round(rect.width / 2);
    this.panY = Math.round(rect.height * 0.75);
    this.zoom = 1.8;
    this.render();
  }

  public resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  private computeWorldTransforms(): Map<string, WorldBoneTransform> {
    const map = new Map<string, WorldBoneTransform>();
    const bones = this.rigManager.getBones();

    // Helper to evaluate bone world transform recursively
    const evaluate = (b: SpineBoneData): WorldBoneTransform => {
      if (map.has(b.name)) return map.get(b.name)!;

      let parentX = 0;
      let parentY = 0;
      let parentRot = 0;

      if (b.parent) {
        const parentBone = bones.find(p => p.name === b.parent);
        if (parentBone) {
          const pt = evaluate(parentBone);
          parentX = pt.worldX;
          parentY = pt.worldY;
          parentRot = pt.worldRotation;
        }
      }

      // Rotate local coords by parent rotation
      const rad = (parentRot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const worldX = parentX + b.x * cos - b.y * sin;
      const worldY = parentY + b.x * sin + b.y * cos;
      const worldRotation = parentRot + (b.rotation || 0);

      const length = b.length || 20;
      const tipRad = (worldRotation * Math.PI) / 180;
      const tipX = worldX + Math.cos(tipRad) * length;
      const tipY = worldY + Math.sin(tipRad) * length;

      const wt: WorldBoneTransform = {
        bone: b,
        worldX,
        worldY,
        worldRotation,
        tipX,
        tipY
      };
      map.set(b.name, wt);
      return wt;
    };

    for (const b of bones) {
      evaluate(b);
    }

    return map;
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

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.max(0.3, Math.min(6.0, this.zoom * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.render();
    }, { passive: false });

    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 1 || this.isSpacePressed) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        return;
      }

      if (e.button !== 0) return;

      const world = this.screenToWorld(e.clientX, e.clientY);
      const transforms = this.computeWorldTransforms();

      // Check if clicking selected bone tip or base
      if (this.selectedBoneName && transforms.has(this.selectedBoneName)) {
        const wt = transforms.get(this.selectedBoneName)!;
        const distTip = Math.hypot(world.x - wt.tipX, world.y - wt.tipY) * this.zoom;
        if (distTip < 14) {
          this.isDraggingBoneTip = true;
          return;
        }

        const distBase = Math.hypot(world.x - wt.worldX, world.y - wt.worldY) * this.zoom;
        if (distBase < 14) {
          this.isDraggingBoneBase = true;
          return;
        }
      }

      // Check hit on any bone
      for (const wt of transforms.values()) {
        const distBase = Math.hypot(world.x - wt.worldX, world.y - wt.worldY) * this.zoom;
        const distTip = Math.hypot(world.x - wt.tipX, world.y - wt.tipY) * this.zoom;

        if (distBase < 14 || distTip < 14) {
          this.selectBone(wt.bone.name);
          if (distTip < 14) this.isDraggingBoneTip = true;
          else this.isDraggingBoneBase = true;
          return;
        }
      }

      // Clicked background
      this.selectBone(null);
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
      const transforms = this.computeWorldTransforms();

      if (this.isDraggingBoneTip && this.selectedBoneName && transforms.has(this.selectedBoneName)) {
        const wt = transforms.get(this.selectedBoneName)!;
        const dx = world.x - wt.worldX;
        const dy = world.y - wt.worldY;
        const newLen = Math.max(10, Math.round(Math.hypot(dx, dy)));
        const targetWorldAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

        // Convert world angle to local rotation
        const parentRot = wt.worldRotation - (wt.bone.rotation || 0);
        const localRot = Math.round(targetWorldAngle - parentRot);

        wt.bone.length = newLen;
        wt.bone.rotation = localRot;

        this.render();
        if (this.events.onBoneModified) this.events.onBoneModified(wt.bone);
      } else if (this.isDraggingBoneBase && this.selectedBoneName && transforms.has(this.selectedBoneName)) {
        const wt = transforms.get(this.selectedBoneName)!;
        if (wt.bone.parent) {
          const parentWt = transforms.get(wt.bone.parent);
          if (parentWt) {
            const rad = (-parentWt.worldRotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx = world.x - parentWt.worldX;
            const dy = world.y - parentWt.worldY;
            wt.bone.x = Math.round(dx * cos - dy * sin);
            wt.bone.y = Math.round(dx * sin + dy * cos);
          }
        } else {
          wt.bone.x = Math.round(world.x);
          wt.bone.y = Math.round(world.y);
        }

        this.render();
        if (this.events.onBoneModified) this.events.onBoneModified(wt.bone);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.isDraggingBoneBase = false;
      this.isDraggingBoneTip = false;
    });

    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        this.isSpacePressed = true;
        this.container.classList.add('panning');
      }
    });

    window.addEventListener('keyup', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.container.classList.remove('panning');
      }
    });
  }

  public render(): void {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // 1. Draw Origin Axis (Ground center)
    this.ctx.lineWidth = 1 / this.zoom;
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    this.ctx.beginPath();
    this.ctx.moveTo(-100, 0);
    this.ctx.lineTo(100, 0);
    this.ctx.stroke();

    this.ctx.fillStyle = '#64748b';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3 / this.zoom, 0, Math.PI * 2);
    this.ctx.fill();

    const transforms = this.computeWorldTransforms();

    // 2. Draw Slot Attachments (Draw order)
    const slots = this.rigManager.getSlots();
    for (const slot of slots) {
      const wt = transforms.get(slot.bone);
      if (!wt) continue;

      const attachment = this.rigManager.getSlotAttachment(slot.name);
      if (!attachment) continue;

      // Find element
      const elem = this.elements.find(e => e.name === attachment.name);
      if (elem && this.sourceImage) {
        this.ctx.save();
        this.ctx.translate(wt.worldX, wt.worldY);
        this.ctx.rotate(((wt.worldRotation + (attachment.rotation || 0)) * Math.PI) / 180);
        this.ctx.translate(attachment.x || 0, attachment.y || 0);

        // Draw cropped element from source image
        this.ctx.save();
        // Pivot offset
        this.ctx.translate(-elem.pivot.x, -elem.pivot.y);

        // Polygon clip
        this.ctx.beginPath();
        for (let i = 0; i < elem.polygon.length; i++) {
          const pt = elem.polygon[i];
          const px = pt.x - elem.bounds.x;
          const py = pt.y - elem.bounds.y;
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.clip();

        this.ctx.drawImage(
          this.sourceImage,
          elem.bounds.x,
          elem.bounds.y,
          elem.bounds.width,
          elem.bounds.height,
          0,
          0,
          elem.bounds.width,
          elem.bounds.height
        );
        this.ctx.restore();
        this.ctx.restore();
      }
    }

    // 3. Draw Bone Hierarchy
    for (const wt of transforms.values()) {
      const isSelected = wt.bone.name === this.selectedBoneName;
      const length = wt.bone.length || 20;

      this.ctx.save();
      this.ctx.translate(wt.worldX, wt.worldY);
      this.ctx.rotate((wt.worldRotation * Math.PI) / 180);

      // Bone body (trapezoid polygon)
      const bRad = 5 / this.zoom;
      const tRad = 2.5 / this.zoom;

      this.ctx.beginPath();
      this.ctx.moveTo(0, -bRad);
      this.ctx.lineTo(length, -tRad);
      this.ctx.lineTo(length, tRad);
      this.ctx.lineTo(0, bRad);
      this.ctx.closePath();

      this.ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.7)' : 'rgba(2, 132, 199, 0.45)';
      this.ctx.fill();

      this.ctx.strokeStyle = isSelected ? '#38bdf8' : '#0284c7';
      this.ctx.lineWidth = (isSelected ? 2.2 : 1.2) / this.zoom;
      this.ctx.stroke();

      // Base joint
      this.ctx.beginPath();
      this.ctx.arc(0, 0, (isSelected ? 5.5 : 4) / this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = isSelected ? '#38bdf8' : '#0284c7';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1 / this.zoom;
      this.ctx.stroke();

      // Tip joint
      this.ctx.beginPath();
      this.ctx.arc(length, 0, (isSelected ? 4.5 : 3) / this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = isSelected ? '#f59e0b' : '#38bdf8';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1 / this.zoom;
      this.ctx.stroke();

      // Bone Label
      this.ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
      this.ctx.font = `${Math.round(10 / this.zoom)}px monospace`;
      this.ctx.fillText(wt.bone.name, 4 / this.zoom, -8 / this.zoom);

      this.ctx.restore();
    }

    this.ctx.restore();
  }
}
