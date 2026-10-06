import { SpineDocument, SpineBoneData, SpineSlotData, SpineSkinData, SpineAttachmentData, VectorOutlineElement } from '../types';
import { Direction8Way } from '../../engine/types';

/**
 * Standard Humanoid Bone Presets for QuestForge Rig Studio
 * Coordinate Space:
 *   Origin (0,0) is at the ground level center between feet.
 *   X > 0 is viewer right (screen-right), X < 0 is viewer left (screen-left).
 *   Y < 0 is upwards (towards head), Y = 0 is ground.
 */

/**
 * Front Pose Preset: Facing the viewer (Mirror perspective)
 * Character's RIGHT limbs are to the LEFT of the head/centerline (screen-left, X < 0).
 * Character's LEFT limbs are to the RIGHT of the head/centerline (screen-right, X > 0).
 * Arms hang naturally down at the sides; legs go down from hip to knees and feet.
 */
export function getFrontBonesPreset(): SpineBoneData[] {
  return [
    { name: 'root', x: 0, y: 0, length: 15, rotation: 0 },
    { name: 'hip', parent: 'root', x: 0, y: -65, length: 20, rotation: -90 },
    { name: 'torso', parent: 'hip', x: 20, y: 0, length: 26, rotation: 0 },
    { name: 'head', parent: 'torso', x: 26, y: 0, length: 28, rotation: 0 },
    // Right arm (Viewer's LEFT, X < 0)
    { name: 'arm_upper_r', parent: 'torso', x: 24, y: -18, length: 26, rotation: 190 },
    { name: 'arm_lower_r', parent: 'arm_upper_r', x: 26, y: 0, length: 24, rotation: -5 },
    { name: 'hand_r', parent: 'arm_lower_r', x: 24, y: 0, length: 14, rotation: 0 },
    // Left arm (Viewer's RIGHT, X > 0)
    { name: 'arm_upper_l', parent: 'torso', x: 24, y: 18, length: 26, rotation: 170 },
    { name: 'arm_lower_l', parent: 'arm_upper_l', x: 26, y: 0, length: 24, rotation: 5 },
    { name: 'hand_l', parent: 'arm_lower_l', x: 24, y: 0, length: 14, rotation: 0 },
    // Right leg (Viewer's LEFT, X < 0)
    { name: 'leg_upper_r', parent: 'hip', x: 0, y: -9, length: 32, rotation: 180 },
    { name: 'leg_lower_r', parent: 'leg_upper_r', x: 32, y: 0, length: 28, rotation: 0 },
    { name: 'foot_r', parent: 'leg_lower_r', x: 28, y: 0, length: 14, rotation: 60 },
    // Left leg (Viewer's RIGHT, X > 0)
    { name: 'leg_upper_l', parent: 'hip', x: 0, y: 9, length: 32, rotation: 180 },
    { name: 'leg_lower_l', parent: 'leg_upper_l', x: 32, y: 0, length: 28, rotation: 0 },
    { name: 'foot_l', parent: 'leg_lower_l', x: 28, y: 0, length: 14, rotation: -60 }
  ];
}

/**
 * Back Pose Preset: Viewed from behind
 * Reverses left/right sides across the vertical centerline.
 * Character's RIGHT limbs are now to the RIGHT of the head (screen-right, X > 0).
 * Character's LEFT limbs are now to the LEFT of the head (screen-left, X < 0).
 */
export function getBackBonesPreset(): SpineBoneData[] {
  return [
    { name: 'root', x: 0, y: 0, length: 15, rotation: 0 },
    { name: 'hip', parent: 'root', x: 0, y: -65, length: 20, rotation: -90 },
    { name: 'torso', parent: 'hip', x: 20, y: 0, length: 26, rotation: 0 },
    { name: 'head', parent: 'torso', x: 26, y: 0, length: 28, rotation: 0 },
    // Left arm (Viewer's LEFT, X < 0)
    { name: 'arm_upper_l', parent: 'torso', x: 24, y: -18, length: 26, rotation: 190 },
    { name: 'arm_lower_l', parent: 'arm_upper_l', x: 26, y: 0, length: 24, rotation: -5 },
    { name: 'hand_l', parent: 'arm_lower_l', x: 24, y: 0, length: 14, rotation: 0 },
    // Right arm (Viewer's RIGHT, X > 0)
    { name: 'arm_upper_r', parent: 'torso', x: 24, y: 18, length: 26, rotation: 170 },
    { name: 'arm_lower_r', parent: 'arm_upper_r', x: 26, y: 0, length: 24, rotation: 5 },
    { name: 'hand_r', parent: 'arm_lower_r', x: 24, y: 0, length: 14, rotation: 0 },
    // Left leg (Viewer's LEFT, X < 0)
    { name: 'leg_upper_l', parent: 'hip', x: 0, y: -9, length: 32, rotation: 180 },
    { name: 'leg_lower_l', parent: 'leg_upper_l', x: 32, y: 0, length: 28, rotation: 0 },
    { name: 'foot_l', parent: 'leg_lower_l', x: 28, y: 0, length: 14, rotation: 60 },
    // Right leg (Viewer's RIGHT, X > 0)
    { name: 'leg_upper_r', parent: 'hip', x: 0, y: 9, length: 32, rotation: 180 },
    { name: 'leg_lower_r', parent: 'leg_upper_r', x: 32, y: 0, length: 28, rotation: 0 },
    { name: 'foot_r', parent: 'leg_lower_r', x: 28, y: 0, length: 14, rotation: -60 }
  ];
}

/**
 * Side Pose Preset: Profile view facing right (+X)
 * Limbs are aligned along the profile/depth axis, and feet point forward horizontally (+X).
 */
export function getSideBonesPreset(): SpineBoneData[] {
  return [
    { name: 'root', x: 0, y: 0, length: 15, rotation: 0 },
    { name: 'hip', parent: 'root', x: 0, y: -65, length: 20, rotation: -90 },
    { name: 'torso', parent: 'hip', x: 20, y: 0, length: 26, rotation: 0 },
    { name: 'head', parent: 'torso', x: 26, y: 0, length: 28, rotation: 0 },
    // Foreground limbs (left side in profile facing right)
    { name: 'arm_upper_l', parent: 'torso', x: 24, y: -3, length: 26, rotation: 176 },
    { name: 'arm_lower_l', parent: 'arm_upper_l', x: 26, y: 0, length: 24, rotation: 10 },
    { name: 'hand_l', parent: 'arm_lower_l', x: 24, y: 0, length: 14, rotation: 0 },
    { name: 'leg_upper_l', parent: 'hip', x: 0, y: -3, length: 32, rotation: 178 },
    { name: 'leg_lower_l', parent: 'leg_upper_l', x: 32, y: 0, length: 28, rotation: 4 },
    { name: 'foot_l', parent: 'leg_lower_l', x: 28, y: 0, length: 16, rotation: -92 },
    // Background limbs (right side in profile, slight depth offset)
    { name: 'arm_upper_r', parent: 'torso', x: 24, y: 3, length: 26, rotation: 184 },
    { name: 'arm_lower_r', parent: 'arm_upper_r', x: 26, y: 0, length: 24, rotation: -6 },
    { name: 'hand_r', parent: 'arm_lower_r', x: 24, y: 0, length: 14, rotation: 0 },
    { name: 'leg_upper_r', parent: 'hip', x: 0, y: 3, length: 32, rotation: 182 },
    { name: 'leg_lower_r', parent: 'leg_upper_r', x: 32, y: 0, length: 28, rotation: -4 },
    { name: 'foot_r', parent: 'leg_lower_r', x: 28, y: 0, length: 16, rotation: -88 }
  ];
}

export class PoseRigManager {
  private doc: SpineDocument;
  private activePose = 'front';

  constructor(doc: SpineDocument) {
    this.doc = doc;
    this.ensureDefaultSkins();
    this.ensurePoseBones();
  }

  public setDocument(doc: SpineDocument): void {
    this.doc = doc;
    this.activePose = 'front';
    this.ensureDefaultSkins();
    this.ensurePoseBones();
  }

  public getDocument(): SpineDocument {
    return this.doc;
  }

  public getActivePose(): string {
    return this.activePose;
  }

  public setActivePose(pose: string): void {
    if (this.activePose === pose && this.doc.bones && this.doc.bones.length > 0) {
      this.ensureSkin(pose);
      return;
    }

    // 1. Save bones of previous pose
    this.saveActivePoseBones();

    this.activePose = pose;
    this.ensureSkin(pose);

    // 2. Load or generate bones for newly selected pose
    const pb = this.getOrCreatePoseBonesMap();
    if (!pb[pose] || pb[pose].length === 0) {
      if (pose === 'front') pb.front = getFrontBonesPreset();
      else if (pose === 'back') pb.back = getBackBonesPreset();
      else if (pose === 'side') pb.side = getSideBonesPreset();
      else pb[pose] = JSON.parse(JSON.stringify(this.doc.bones));
    }

    this.doc.bones = JSON.parse(JSON.stringify(pb[pose]));
  }

  public saveActivePoseBones(): void {
    const pb = this.getOrCreatePoseBonesMap();
    pb[this.activePose] = JSON.parse(JSON.stringify(this.doc.bones));
  }

  public getPoseList(): string[] {
    const skins = this.doc.skins || [];
    return skins.map(s => s.name);
  }

  public addPose(name: string, directions: Direction8Way[] = []): void {
    if (this.doc.skins.some(s => s.name === name)) return;
    this.doc.skins.push({
      name,
      attachments: {}
    });

    if (!this.doc.skeleton.questforge) {
      this.doc.skeleton.questforge = {
        posePreset: 'custom',
        poseDirections: {},
        elements: []
      };
    }
    this.doc.skeleton.questforge.poseDirections[name] = directions;
    this.setActivePose(name);
  }

  public removePose(name: string): void {
    if (this.doc.skins.length <= 1) return;
    this.doc.skins = this.doc.skins.filter(s => s.name !== name);
    if (this.doc.skeleton.questforge?.poseDirections) {
      delete this.doc.skeleton.questforge.poseDirections[name];
    }
    if (this.doc.skeleton.questforge?.poseBones) {
      delete this.doc.skeleton.questforge.poseBones[name];
    }
    this.setActivePose(this.doc.skins[0].name);
  }

  public getBones(): SpineBoneData[] {
    return this.doc.bones || [];
  }

  public addBone(name: string, parentName?: string, x = 0, y = 0, length = 20, rotation = 0): SpineBoneData {
    // Avoid duplicate names
    let finalName = name;
    let counter = 1;
    while (this.doc.bones.some(b => b.name === finalName)) {
      finalName = `${name}_${counter++}`;
    }

    const bone: SpineBoneData = {
      name: finalName,
      parent: parentName,
      x,
      y,
      length,
      rotation,
      scaleX: 1,
      scaleY: 1
    };
    this.doc.bones.push(bone);
    this.saveActivePoseBones();

    // Also create a matching slot by default
    this.addSlot(finalName, finalName);
    return bone;
  }

  public removeBone(name: string): void {
    if (name === 'root') return; // Cannot delete root
    // Reparent children to parent
    const bone = this.doc.bones.find(b => b.name === name);
    if (!bone) return;

    for (const b of this.doc.bones) {
      if (b.parent === name) {
        b.parent = bone.parent;
      }
    }

    this.doc.bones = this.doc.bones.filter(b => b.name !== name);
    this.saveActivePoseBones();

    // Remove slots associated with this bone
    this.doc.slots = this.doc.slots.filter(s => s.bone !== name);
  }

  public getSlots(): SpineSlotData[] {
    return this.doc.slots || [];
  }

  public addSlot(name: string, boneName: string): SpineSlotData {
    let finalName = name;
    let counter = 1;
    while (this.doc.slots.some(s => s.name === finalName)) {
      finalName = `${name}_slot_${counter++}`;
    }

    const slot: SpineSlotData = {
      name: finalName,
      bone: boneName,
      attachment: finalName
    };
    this.doc.slots.push(slot);
    return slot;
  }

  public moveSlotDrawOrder(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.doc.slots.length || toIndex < 0 || toIndex >= this.doc.slots.length) return;
    const [moved] = this.doc.slots.splice(fromIndex, 1);
    this.doc.slots.splice(toIndex, 0, moved);
  }

  public getActiveSkin(): SpineSkinData {
    this.ensureSkin(this.activePose);
    return this.doc.skins.find(s => s.name === this.activePose)!;
  }

  /**
   * Computes intelligent default rotation and scale for a sliced element bound to a slot/bone.
   * - Head, torso, chest extend UP from pivot -> rotation: +90° to align with bone
   * - Limbs (arms, legs, feet) extend DOWN from pivot -> rotation: -90° to align with bone
   * - Scale is computed to fit bone length (typically 0.25 for 4x high-res graphics)
   */
  public computeDefaultElementTransform(
    slotName: string,
    element: VectorOutlineElement
  ): { rotation: number; scaleX: number; scaleY: number; x: number; y: number } {
    const slot = this.doc.slots.find(s => s.name === slotName);
    const bone = slot ? this.doc.bones.find(b => b.name === slot.bone) : null;
    const bName = (bone?.name || slotName).toLowerCase();

    // 1. Rotation alignment
    let rotation = -90;
    const isUpward = bName.includes('head') || bName.includes('torso') || bName.includes('chest') || bName.includes('hip') ||
      (element.bounds.height > 0 && (element.pivot.y / element.bounds.height > 0.55));
    if (isUpward) {
      rotation = 90;
    }

    // 2. Scale alignment
    let scale = 1.0;
    if (bone && bone.length && element.bounds.height > 0) {
      const rawScale = bone.length / element.bounds.height;
      if (element.bounds.height > 50 || rawScale < 0.6) {
        scale = Math.round(rawScale * 100) / 100;
        if (Math.abs(scale - 0.25) < 0.08) scale = 0.25;
        else if (Math.abs(scale - 0.5) < 0.08) scale = 0.5;
        scale = Math.max(0.05, Math.min(2.0, scale));
      }
    }

    return {
      rotation,
      scaleX: scale,
      scaleY: scale,
      x: 0,
      y: 0
    };
  }

  /**
   * Binds a sliced vector element to a slot in the active pose/skin.
   */
  public bindElementToSlot(
    slotName: string,
    element: VectorOutlineElement,
    offsetX?: number,
    offsetY?: number,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    const skin = this.getActiveSkin();
    if (!skin.attachments[slotName]) {
      skin.attachments[slotName] = {};
    }

    const def = this.computeDefaultElementTransform(slotName, element);
    const finalRot = rotation !== undefined ? rotation : def.rotation;
    const finalScaleX = scaleX !== undefined ? scaleX : def.scaleX;
    const finalScaleY = scaleY !== undefined ? scaleY : def.scaleY;
    const finalX = offsetX !== undefined ? offsetX : 0;
    const finalY = offsetY !== undefined ? offsetY : 0;

    const attachment: SpineAttachmentData = {
      type: element.deformationMode === 'mesh' ? 'mesh' : 'region',
      name: element.name,
      x: finalX,
      y: finalY,
      rotation: finalRot,
      width: element.bounds.width,
      height: element.bounds.height,
      scaleX: finalScaleX,
      scaleY: finalScaleY
    };

    skin.attachments[slotName][slotName] = attachment;

    // Ensure slot's attachment property points to this
    const slot = this.doc.slots.find(s => s.name === slotName);
    if (slot) {
      slot.attachment = slotName;
    }
  }

  public setSlotAttachmentTransform(
    slotName: string,
    transforms: { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number }
  ): void {
    const attachment = this.getSlotAttachment(slotName);
    if (!attachment) return;
    if (transforms.x !== undefined) attachment.x = transforms.x;
    if (transforms.y !== undefined) attachment.y = transforms.y;
    if (transforms.rotation !== undefined) attachment.rotation = transforms.rotation;
    if (transforms.scaleX !== undefined) attachment.scaleX = transforms.scaleX;
    if (transforms.scaleY !== undefined) attachment.scaleY = transforms.scaleY;
  }

  public autoAlignAllAttachments(targetScale?: number): void {
    const skin = this.getActiveSkin();
    const elements = this.doc.skeleton.questforge?.elements || [];

    // Calculate common scale if not provided
    let resolvedScale = targetScale;
    if (resolvedScale === undefined) {
      const limbScales: number[] = [];
      for (const slot of this.doc.slots) {
        const attach = skin.attachments[slot.name]?.[slot.name];
        if (!attach) continue;
        const elem = elements.find(e => e.name === attach.name);
        const bone = this.doc.bones.find(b => b.name === slot.bone);
        if (elem && bone && bone.length && elem.bounds.height > 0) {
          const s = bone.length / elem.bounds.height;
          if (s < 0.8) limbScales.push(s);
        }
      }
      if (limbScales.length > 0) {
        resolvedScale = Math.round((limbScales.reduce((a, b) => a + b, 0) / limbScales.length) * 100) / 100;
        if (Math.abs(resolvedScale - 0.25) < 0.08) resolvedScale = 0.25;
      } else {
        resolvedScale = 0.25;
      }
    }

    for (const slot of this.doc.slots) {
      const attach = skin.attachments[slot.name]?.[slot.name];
      if (!attach) continue;
      const elem = elements.find(e => e.name === attach.name);
      if (!elem) continue;

      const def = this.computeDefaultElementTransform(slot.name, elem);
      attach.rotation = def.rotation;
      attach.scaleX = resolvedScale;
      attach.scaleY = resolvedScale;
      attach.x = 0;
      attach.y = 0;
    }
  }

  public setGlobalAttachmentScale(scale: number): void {
    const skin = this.getActiveSkin();
    for (const slot of this.doc.slots) {
      const attach = skin.attachments[slot.name]?.[slot.name];
      if (attach) {
        attach.scaleX = scale;
        attach.scaleY = scale;
      }
    }
  }

  public unbindSlotAttachment(slotName: string): void {
    const skin = this.getActiveSkin();
    if (skin.attachments[slotName]) {
      delete skin.attachments[slotName];
    }
    const slot = this.doc.slots.find(s => s.name === slotName);
    if (slot) {
      delete slot.attachment;
    }
  }

  public getSlotAttachment(slotName: string): SpineAttachmentData | null {
    const skin = this.getActiveSkin();
    return skin.attachments[slotName]?.[slotName] || null;
  }

  private ensureDefaultSkins(): void {
    if (!this.doc.skins || this.doc.skins.length === 0) {
      this.doc.skins = [
        { name: 'front', attachments: {} },
        { name: 'side', attachments: {} },
        { name: 'back', attachments: {} }
      ];
    }
  }

  private ensureSkin(poseName: string): void {
    if (!this.doc.skins.some(s => s.name === poseName)) {
      this.doc.skins.push({
        name: poseName,
        attachments: {}
      });
    }
  }

  private getOrCreatePoseBonesMap(): Record<string, SpineBoneData[]> {
    if (!this.doc.skeleton.questforge) {
      this.doc.skeleton.questforge = {
        posePreset: '3-way',
        poseDirections: { front: ['down'], side: ['right', 'left'], back: ['up'] },
        elements: []
      };
    }
    if (!this.doc.skeleton.questforge.poseBones) {
      this.doc.skeleton.questforge.poseBones = {};
    }
    return this.doc.skeleton.questforge.poseBones;
  }

  private ensurePoseBones(): void {
    const pb = this.getOrCreatePoseBonesMap();

    if (!pb.front) {
      pb.front = (this.doc.bones && this.doc.bones.length > 0)
        ? JSON.parse(JSON.stringify(this.doc.bones))
        : getFrontBonesPreset();
    }
    if (!pb.back) {
      pb.back = getBackBonesPreset();
    }
    if (!pb.side) {
      pb.side = getSideBonesPreset();
    }

    if (pb[this.activePose]) {
      this.doc.bones = JSON.parse(JSON.stringify(pb[this.activePose]));
    }
  }
}
