import { SpineDocument, SpineBoneData, SpineSlotData, SpineSkinData, SpineAttachmentData, VectorOutlineElement } from '../types';
import { Direction8Way } from '../../engine/types';

export class PoseRigManager {
  private doc: SpineDocument;
  private activePose = 'front';

  constructor(doc: SpineDocument) {
    this.doc = doc;
    this.ensureDefaultSkins();
  }

  public setDocument(doc: SpineDocument): void {
    this.doc = doc;
    this.ensureDefaultSkins();
  }

  public getDocument(): SpineDocument {
    return this.doc;
  }

  public getActivePose(): string {
    return this.activePose;
  }

  public setActivePose(pose: string): void {
    this.activePose = pose;
    this.ensureSkin(pose);
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
    this.activePose = name;
  }

  public removePose(name: string): void {
    if (this.doc.skins.length <= 1) return;
    this.doc.skins = this.doc.skins.filter(s => s.name !== name);
    if (this.doc.skeleton.questforge?.poseDirections) {
      delete this.doc.skeleton.questforge.poseDirections[name];
    }
    this.activePose = this.doc.skins[0].name;
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
   * Binds a sliced vector element to a slot in the active pose/skin.
   */
  public bindElementToSlot(
    slotName: string,
    element: VectorOutlineElement,
    offsetX = 0,
    offsetY = 0,
    rotation = 0
  ): void {
    const skin = this.getActiveSkin();
    if (!skin.attachments[slotName]) {
      skin.attachments[slotName] = {};
    }

    const attachment: SpineAttachmentData = {
      type: element.deformationMode === 'mesh' ? 'mesh' : 'region',
      name: element.name,
      x: offsetX,
      y: offsetY,
      rotation,
      width: element.bounds.width,
      height: element.bounds.height,
      scaleX: 1,
      scaleY: 1
    };

    skin.attachments[slotName][slotName] = attachment;

    // Ensure slot's attachment property points to this
    const slot = this.doc.slots.find(s => s.name === slotName);
    if (slot) {
      slot.attachment = slotName;
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
}
