import * as PIXI from 'pixi.js';
import { Vector2D, SkeletalVisualConfig, SkeletalBoneData, SkeletalKeyframe } from '../types';
import { AssetManager } from '../core/AssetManager';
import { ICharacterVisualizer, CharacterRenderState } from './ICharacterVisualizer';

interface BoneNode {
  data: SkeletalBoneData;
  parent: BoneNode | null;
  children: BoneNode[];
  container: PIXI.Container;
  localX: number;
  localY: number;
  localRotation: number; // in degrees
  localScaleX: number;
  localScaleY: number;
}

export class SkeletalCharacterVisualizer implements ICharacterVisualizer {
  public readonly container: PIXI.Container;
  public config: SkeletalVisualConfig;

  private boneNodes: Map<string, BoneNode> = new Map();
  private rootBones: BoneNode[] = [];
  private slotContainers: Map<string, PIXI.Container> = new Map();
  private slotGraphics: Map<string, PIXI.Graphics> = new Map();
  private slotSprites: Map<string, PIXI.Sprite> = new Map();

  private currentAnimation = 'idle';
  private currentSkin = 'front';
  private animationTimer = 0;
  private isTextureLoaded = false;
  private loadedTexture: PIXI.Texture | null = null;
  private elementTextures: Map<string, PIXI.Texture> = new Map();

  constructor(config: SkeletalVisualConfig) {
    this.config = config;
    this.container = new PIXI.Container();
    this.currentAnimation = config.defaultAnimation || Object.keys(config.animations || {})[0] || 'idle';
    this.currentSkin = config.skin || 'front';
  }

  public async init(): Promise<void> {
    if (this.config.textureUrl) {
      try {
        this.loadedTexture = await AssetManager.getInstance().loadTexture(this.config.textureUrl);
        this.isTextureLoaded = true;
        this.buildElementSubTextures();
      } catch (err) {
        console.warn('Failed to load skeletal texture, using vector bone rendering fallback', err);
      }
    }

    this.buildBoneHierarchy();
    this.buildSlots();
    this.evaluateAnimation(0);
  }

  private buildElementSubTextures(): void {
    if (!this.loadedTexture) return;
    this.elementTextures.clear();

    const elements = this.config.spineDoc?.skeleton?.questforge?.elements || [];
    for (const elem of elements) {
      try {
        const frame = new PIXI.Rectangle(
          elem.bounds.x,
          elem.bounds.y,
          Math.max(1, elem.bounds.width),
          Math.max(1, elem.bounds.height)
        );
        const sub = new PIXI.Texture({
          source: this.loadedTexture.source,
          frame
        });
        this.elementTextures.set(elem.name, sub);
        this.elementTextures.set(elem.id, sub);
      } catch (e) {
        console.warn('Failed to build sub-texture for element', elem.name, e);
      }
    }
  }

  private buildBoneHierarchy(): void {
    this.boneNodes.clear();
    this.rootBones = [];

    const bones = this.config.skeleton?.bones || [];

    // Create all bone nodes
    for (const b of bones) {
      const node: BoneNode = {
        data: b,
        parent: null,
        children: [],
        container: new PIXI.Container(),
        localX: b.x,
        localY: b.y,
        localRotation: b.rotation || 0,
        localScaleX: b.scaleX !== undefined ? b.scaleX : 1,
        localScaleY: b.scaleY !== undefined ? b.scaleY : 1
      };
      node.container.label = b.name;
      this.boneNodes.set(b.name, node);
    }

    // Link parent-child hierarchy
    for (const node of this.boneNodes.values()) {
      if (node.data.parent && this.boneNodes.has(node.data.parent)) {
        const parent = this.boneNodes.get(node.data.parent)!;
        node.parent = parent;
        parent.children.push(node);
        parent.container.addChild(node.container);
      } else {
        this.rootBones.push(node);
        this.container.addChild(node.container);
      }
    }
  }

  private buildSlots(): void {
    this.slotContainers.clear();
    this.slotGraphics.clear();
    this.slotSprites.clear();

    const slots = this.config.skeleton?.slots || [];
    const skinName = this.currentSkin || this.config.skin || Object.keys(this.config.skeleton?.attachments || {})[0] || 'default';
    const skinAttachments = this.config.skeleton?.attachments?.[skinName] || this.config.skeleton?.attachments?.['default'] || {};
    const elements = this.config.spineDoc?.skeleton?.questforge?.elements || [];

    for (const s of slots) {
      const boneNode = this.boneNodes.get(s.bone);
      if (!boneNode) continue;

      const slotCont = new PIXI.Container();
      slotCont.label = `slot_${s.name}`;
      this.slotContainers.set(s.name, slotCont);
      boneNode.container.addChild(slotCont);

      const attachment = skinAttachments[s.name];
      const elem = elements.find((e: any) => e.name === attachment?.name);
      const subTex = attachment?.name ? this.elementTextures.get(attachment.name) : null;

      if (this.isTextureLoaded && (subTex || this.loadedTexture)) {
        const spr = new PIXI.Sprite(subTex || this.loadedTexture!);
        if (elem && elem.bounds) {
          spr.anchor.set(elem.pivot.x / elem.bounds.width, elem.pivot.y / elem.bounds.height);
        } else {
          spr.anchor.set(0.5, 0.5);
        }

        if (attachment) {
          spr.x = attachment.x || 0;
          spr.y = attachment.y || 0;
          spr.rotation = ((attachment.rotation || 0) * Math.PI) / 180;
          spr.scale.set(attachment.scaleX ?? 1, attachment.scaleY ?? 1);
        }
        slotCont.addChild(spr);
        this.slotSprites.set(s.name, spr);
      } else {
        // Draw bone shape attachment
        const gfx = new PIXI.Graphics();
        const boneLength = Math.max(boneNode.data.length || 20, 16);
        const col = s.color ? parseInt(s.color.replace('#', ''), 16) : 0x38bdf8;

        gfx.circle(0, 0, 4);
        gfx.fill({ color: 0x0284c7 });
        gfx.roundRect(0, -3, boneLength, 6, 2);
        gfx.fill({ color: isNaN(col) ? 0x38bdf8 : col });
        gfx.circle(boneLength, 0, 3);
        gfx.fill({ color: 0x0284c7 });

        slotCont.addChild(gfx);
        this.slotGraphics.set(s.name, gfx);
      }
    }
  }

  private resolveTargetSkin(state: CharacterRenderState): string {
    const dir = state.direction8Way || 'down';
    const customPoseDirections = this.config.spineDoc?.skeleton?.questforge?.poseDirections;
    if (customPoseDirections) {
      for (const [poseName, dirs] of Object.entries(customPoseDirections)) {
        if (Array.isArray(dirs) && (dirs as any).includes(dir)) return poseName;
      }
    }
    if (dir === 'up' || dir === 'up_left' || dir === 'up_right') return 'back';
    if (dir === 'left' || dir === 'right') return 'side';
    return 'front';
  }

  private applyPoseBones(skinName: string): void {
    const poseBones = this.config.spineDoc?.skeleton?.questforge?.poseBones?.[skinName];
    if (!poseBones || poseBones.length === 0) return;
    for (const b of poseBones) {
      const node = this.boneNodes.get(b.name);
      if (node) {
        node.localX = b.x;
        node.localY = b.y;
        node.localRotation = b.rotation || 0;
        node.data = b;
        node.container.x = b.x;
        node.container.y = b.y;
        node.container.rotation = ((b.rotation || 0) * Math.PI) / 180;
      }
    }
  }

  public update(delta: number, state: CharacterRenderState): void {
    if (!this.container || (this.container as any).destroyed) return;

    // Resolve directional pose/skin
    const targetSkin = this.resolveTargetSkin(state);
    if (targetSkin !== this.currentSkin && this.config.skeleton?.attachments?.[targetSkin]) {
      this.currentSkin = targetSkin;
      this.applyPoseBones(targetSkin);
      this.buildSlots();
    }

    // Horizontal mirroring
    const baseScale = state.scale || 1.5;
    this.container.scale.x = state.isFacingLeft ? -Math.abs(baseScale) : Math.abs(baseScale);
    this.container.scale.y = baseScale;

    // Resolve target animation
    const animMap = this.config.animations || {};
    let targetAnim = 'idle';

    if (state.currentCustomAnimKey && animMap[state.currentCustomAnimKey]) {
      targetAnim = state.currentCustomAnimKey;
    } else if (state.state === 'walking') {
      targetAnim = animMap.walk ? 'walk' : (animMap.run ? 'run' : Object.keys(animMap)[0] || 'idle');
    } else if (state.state === 'talking') {
      targetAnim = animMap.talk ? 'talk' : (animMap.speak ? 'speak' : (animMap.idle ? 'idle' : Object.keys(animMap)[0] || 'idle'));
    } else {
      targetAnim = animMap.idle ? 'idle' : Object.keys(animMap)[0] || 'idle';
    }

    if (targetAnim !== this.currentAnimation && animMap[targetAnim]) {
      this.currentAnimation = targetAnim;
      this.animationTimer = 0;
    }

    this.animationTimer += delta;
    this.evaluateAnimation(this.animationTimer);
  }

  public freezeFrame(state: CharacterRenderState): void {
    this.animationTimer = 0;
    this.evaluateAnimation(0);
  }

  private interpolateKeyframe(keyframes: SkeletalKeyframe[] | undefined, time: number, defaultValue: number): number {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].rotation ?? keyframes[0].x ?? keyframes[0].scaleX ?? defaultValue;

    // Find bounding keyframes
    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];

    if (time <= k0.time) return (k0.rotation ?? k0.x ?? k0.scaleX ?? defaultValue);
    if (time >= k1.time) return (k1.rotation ?? k1.x ?? k1.scaleX ?? defaultValue);

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
        k0 = keyframes[i];
        k1 = keyframes[i + 1];
        break;
      }
    }

    const t = (k1.time - k0.time) > 0 ? (time - k0.time) / (k1.time - k0.time) : 0;
    const v0 = k0.rotation ?? k0.x ?? k0.scaleX ?? defaultValue;
    const v1 = k1.rotation ?? k1.x ?? k1.scaleX ?? defaultValue;
    return v0 + (v1 - v0) * t;
  }

  private evaluateAnimation(time: number): void {
    const track = this.config.animations?.[this.currentAnimation];
    const duration = track?.duration || 1;
    const normalizedTime = duration > 0 ? time % duration : 0;

    for (const node of this.boneNodes.values()) {
      const boneTrack = track?.bones?.[node.data.name];

      // Reset to base transform
      let tx = node.data.x;
      let ty = node.data.y;
      let rot = node.data.rotation || 0;
      let sx = node.data.scaleX !== undefined ? node.data.scaleX : 1;
      let sy = node.data.scaleY !== undefined ? node.data.scaleY : 1;

      if (boneTrack) {
        if (boneTrack.translate && boneTrack.translate.length > 0) {
          tx += this.interpolateKeyframe(boneTrack.translate.map(k => ({ time: k.time, x: k.x })), normalizedTime, 0);
          ty += this.interpolateKeyframe(boneTrack.translate.map(k => ({ time: k.time, x: k.y })), normalizedTime, 0);
        }
        if (boneTrack.rotate && boneTrack.rotate.length > 0) {
          rot += this.interpolateKeyframe(boneTrack.rotate, normalizedTime, 0);
        }
        if (boneTrack.scale && boneTrack.scale.length > 0) {
          sx *= this.interpolateKeyframe(boneTrack.scale.map(k => ({ time: k.time, x: k.scaleX })), normalizedTime, 1);
          sy *= this.interpolateKeyframe(boneTrack.scale.map(k => ({ time: k.time, x: k.scaleY })), normalizedTime, 1);
        }
      }

      node.container.x = tx;
      node.container.y = ty;
      node.container.rotation = (rot * Math.PI) / 180;
      node.container.scale.set(sx, sy);
    }
  }

  public getBounds(): { width: number; height: number; anchorX: number; anchorY: number } {
    return {
      width: 64,
      height: 96,
      anchorX: 0.5,
      anchorY: 1.0
    };
  }

  public containsPoint(localPoint: Vector2D): boolean {
    const hw = 32;
    const hh = 96;
    return localPoint.x >= -hw && localPoint.x <= hw && localPoint.y >= -hh && localPoint.y <= 10;
  }

  public setAnimation(animName: string): void {
    if (this.config.animations?.[animName]) {
      this.currentAnimation = animName;
      this.animationTimer = 0;
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
