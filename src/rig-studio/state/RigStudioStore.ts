import {
  AnatomicalJointId,
  BonePartAttachment,
  EyeRigMode,
  FacialRigConfig,
  MouthRigMode,
  RigPartItem,
  RigProjectData,
  StudioAnimationDefinition,
  StudioView,
  VectorOutlineElement,
  ViewArtworkData
} from '../types';
import {
  DEFAULT_BONE_DRAW_ORDER,
  DEFAULT_ENVELOPES,
  copyJointsFromFront,
  getDefaultJointPositions,
  mirrorAttachedParts,
  mirrorBoneLayerOrder,
  mirrorEnvelopes,
  mirrorJointPositions,
  suggestMirroredPoseId,
  suggestMirroredPoseName
} from '../rigging/AnatomicalRig';
import { HistoryManager } from './HistoryManager';

export interface RigStudioStoreSnapshot {
  characterName: string;
  activeView: StudioView;
  views: Record<string, {
    label: string;
    joints: Record<string, { x: number; y: number }>;
    envelopes: Record<string, number>;
    parts: Record<string, BonePartAttachment>;
    boneOrder?: AnatomicalJointId[];
    facialRig?: FacialRigConfig;
  }>;
  commonEyeMode: EyeRigMode;
  commonMouthMode: MouthRigMode;
}

export type StoreListener = () => void;

/**
 * Headless, observable state store for Character Rig Studio.
 * Completely decoupled from DOM, Canvas, and browser-only APIs.
 */
export class RigStudioStore {
  private characterName = 'Character';
  private activeView: StudioView = 'front';
  private activeStudioMode: 'rig' | 'slicer' | 'animate' = 'rig';
  private kinematicsMode: 'ik' | 'fk' = 'ik';
  private symmetryEnabled = true;

  private views: Record<string, ViewArtworkData> = {};
  private partsLibrary: RigPartItem[] = [];
  private commonEyeMode: EyeRigMode = 'procedural';
  private commonMouthMode: MouthRigMode = 'procedural';

  private animations: Record<string, StudioAnimationDefinition> = {};
  private activeAnimationName = 'idle';

  private history: HistoryManager<RigStudioStoreSnapshot>;
  private listeners: Set<StoreListener> = new Set();

  constructor() {
    this.history = new HistoryManager<RigStudioStoreSnapshot>(50);
    this.resetToDefaults();
  }

  public resetToDefaults(): void {
    this.characterName = 'Character';
    this.activeView = 'front';
    this.activeStudioMode = 'rig';
    this.kinematicsMode = 'ik';
    this.symmetryEnabled = true;
    this.commonEyeMode = 'procedural';
    this.commonMouthMode = 'procedural';
    this.partsLibrary = [];

    this.views = {
      front: {
        viewId: 'front',
        label: 'Front View',
        image: null,
        imageUrl: '',
        fileName: 'character_front.png',
        fileSize: '420 KB',
        joints: getDefaultJointPositions('front'),
        envelopes: { ...DEFAULT_ENVELOPES },
        parts: {},
        boneOrder: [...DEFAULT_BONE_DRAW_ORDER],
        visible: true,
        facialRig: this.createDefaultFacialRigForView('front')
      },
      back: {
        viewId: 'back',
        label: 'Back View',
        image: null,
        imageUrl: '',
        fileName: 'character_back.png',
        fileSize: '',
        joints: getDefaultJointPositions('back'),
        envelopes: { ...DEFAULT_ENVELOPES },
        parts: {},
        boneOrder: mirrorBoneLayerOrder(DEFAULT_BONE_DRAW_ORDER),
        visible: true,
        facialRig: this.createDefaultFacialRigForView('back')
      },
      left: {
        viewId: 'left',
        label: 'Side (Left)',
        image: null,
        imageUrl: '',
        fileName: 'character_side.png',
        fileSize: '',
        joints: getDefaultJointPositions('left'),
        envelopes: { ...DEFAULT_ENVELOPES },
        parts: {},
        boneOrder: [...DEFAULT_BONE_DRAW_ORDER],
        visible: true,
        facialRig: this.createDefaultFacialRigForView('left')
      },
      right: {
        viewId: 'right',
        label: 'Side (Right)',
        image: null,
        imageUrl: '',
        fileName: 'character_side_r.png',
        fileSize: '',
        joints: getDefaultJointPositions('right'),
        envelopes: { ...DEFAULT_ENVELOPES },
        parts: {},
        boneOrder: mirrorBoneLayerOrder(DEFAULT_BONE_DRAW_ORDER),
        visible: true,
        facialRig: this.createDefaultFacialRigForView('right')
      }
    };

    this.history.init(this.createSnapshot(), 'Default Rig State');
    this.notify();
  }

  // --- Observability ---

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('RigStudioStore subscriber error:', err);
      }
    }
  }

  // --- Getters ---

  public getCharacterName(): string {
    return this.characterName;
  }

  public setCharacterName(name: string): void {
    this.characterName = name.trim() || 'Character';
    this.notify();
  }

  public getActiveView(): StudioView {
    return this.activeView;
  }

  public switchView(viewId: StudioView): void {
    if (this.views[viewId]) {
      this.activeView = viewId;
      this.notify();
    }
  }

  public getViews(): Record<string, ViewArtworkData> {
    return this.views;
  }

  public getView(viewId: StudioView): ViewArtworkData | undefined {
    return this.views[viewId];
  }

  public getActiveViewData(): ViewArtworkData {
    return this.views[this.activeView];
  }

  public getPartsLibrary(): RigPartItem[] {
    return this.partsLibrary;
  }

  public setPartsLibrary(items: RigPartItem[]): void {
    this.partsLibrary = items;
    this.notify();
  }

  public getCommonEyeMode(): EyeRigMode {
    return this.commonEyeMode;
  }

  public setCommonEyeMode(mode: EyeRigMode): void {
    this.commonEyeMode = mode;
    for (const v of Object.values(this.views)) {
      if (v.facialRig?.eyes) {
        v.facialRig.eyes.mode = mode;
      }
      if (v.facialRig?.eyeInstances) {
        for (const inst of v.facialRig.eyeInstances) {
          inst.mode = mode;
        }
      }
    }
    this.recordHistory(`Change eye mode to ${mode}`);
  }

  public getCommonMouthMode(): MouthRigMode {
    return this.commonMouthMode;
  }

  public setCommonMouthMode(mode: MouthRigMode): void {
    this.commonMouthMode = mode;
    for (const v of Object.values(this.views)) {
      if (v.facialRig?.mouth) {
        v.facialRig.mouth.mode = mode;
      }
      if (v.facialRig?.mouthInstances) {
        for (const inst of v.facialRig.mouthInstances) {
          inst.mode = mode;
        }
      }
    }
    this.recordHistory(`Change mouth mode to ${mode}`);
  }

  // --- Pose / View Lifecycle ---

  public createPose(name: string, templateViewId = 'front', mirror = false): string {
    const rawId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    let viewId = rawId || 'pose';
    let counter = 1;
    while (this.views[viewId]) {
      viewId = `${rawId || 'pose'}_${counter++}`;
    }

    const template = this.views[templateViewId] || this.views.front;
    let initialJoints = copyJointsFromFront(template.joints, viewId as StudioView);
    let initialParts = { ...template.parts };
    let initialOrder = template.boneOrder ? [...template.boneOrder] : [...DEFAULT_BONE_DRAW_ORDER];
    let initialEnvelopes = { ...template.envelopes };

    if (mirror) {
      initialJoints = mirrorJointPositions(initialJoints, 'horizontal');
      initialParts = mirrorAttachedParts(initialParts);
      initialOrder = mirrorBoneLayerOrder(initialOrder);
      initialEnvelopes = mirrorEnvelopes(initialEnvelopes);
    }

    this.views[viewId] = {
      viewId,
      label: name.trim() || 'New Pose',
      image: null,
      imageUrl: '',
      fileName: '',
      fileSize: '',
      joints: initialJoints,
      envelopes: initialEnvelopes,
      parts: initialParts,
      boneOrder: initialOrder,
      visible: true,
      facialRig: this.createDefaultFacialRigForView(viewId)
    };

    this.activeView = viewId;
    this.recordHistory(`Create Pose: ${name}`);
    return viewId;
  }

  public duplicatePose(viewId: string): string {
    const src = this.views[viewId];
    if (!src) return '';
    return this.createPose(`${src.label} (Copy)`, viewId, false);
  }

  public duplicateAndMirrorPose(viewId: string): string {
    const src = this.views[viewId];
    if (!src) return '';
    const mirroredName = suggestMirroredPoseName(src.label);
    return this.createPose(mirroredName, viewId, true);
  }

  public deletePose(viewId: string): boolean {
    const reservedViews = ['front', 'back', 'left', 'right'];
    if (reservedViews.includes(viewId)) {
      return false; // Reserved directional views cannot be deleted
    }

    if (this.views[viewId]) {
      delete this.views[viewId];
      if (this.activeView === viewId) {
        this.activeView = 'front';
      }
      this.recordHistory(`Delete Pose: ${viewId}`);
      return true;
    }
    return false;
  }

  public renamePose(viewId: string, newLabel: string): boolean {
    if (this.views[viewId] && newLabel.trim()) {
      this.views[viewId].label = newLabel.trim();
      this.recordHistory(`Rename Pose: ${newLabel}`);
      return true;
    }
    return false;
  }

  public mirrorActivePose(mode: 'horizontal' | 'swap_limbs' = 'horizontal'): void {
    const current = this.views[this.activeView];
    if (!current) return;

    current.joints = mirrorJointPositions(current.joints, mode);
    current.parts = mirrorAttachedParts(current.parts);
    if (current.boneOrder) {
      current.boneOrder = mirrorBoneLayerOrder(current.boneOrder);
    }
    current.envelopes = mirrorEnvelopes(current.envelopes);
    this.recordHistory(`Mirror Pose: ${this.activeView}`);
  }

  // --- Joint & Part Mutations ---

  public setJoints(viewId: StudioView, joints: Record<AnatomicalJointId, { x: number; y: number }>): void {
    if (this.views[viewId]) {
      this.views[viewId].joints = { ...joints };
      this.notify();
    }
  }

  public setPart(viewId: StudioView, boneId: AnatomicalJointId, part: BonePartAttachment | null): void {
    const v = this.views[viewId];
    if (!v) return;
    if (part) {
      v.parts[boneId] = part;
    } else {
      delete v.parts[boneId];
    }
    this.notify();
  }

  public setEnvelopes(viewId: StudioView, envelopes: Record<string, number>): void {
    if (this.views[viewId]) {
      this.views[viewId].envelopes = { ...envelopes };
      this.notify();
    }
  }

  // --- Bone Layer Ordering ---

  public getBoneOrder(viewId: StudioView): AnatomicalJointId[] {
    const v = this.views[viewId];
    return v?.boneOrder ? [...v.boneOrder] : [...DEFAULT_BONE_DRAW_ORDER];
  }

  public setBoneOrder(viewId: StudioView, order: AnatomicalJointId[]): void {
    if (this.views[viewId]) {
      this.views[viewId].boneOrder = [...order];
      this.recordHistory(`Reorder Bones: ${viewId}`);
    }
  }

  public moveBoneUp(viewId: StudioView, boneId: AnatomicalJointId): boolean {
    const order = this.getBoneOrder(viewId);
    const idx = order.indexOf(boneId);
    if (idx === -1 || idx >= order.length - 1) return false;
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    this.setBoneOrder(viewId, order);
    return true;
  }

  public moveBoneDown(viewId: StudioView, boneId: AnatomicalJointId): boolean {
    const order = this.getBoneOrder(viewId);
    const idx = order.indexOf(boneId);
    if (idx <= 0) return false;
    [order[idx], order[idx - 1]] = [order[idx - 1], order[idx]];
    this.setBoneOrder(viewId, order);
    return true;
  }

  public moveBoneToTop(viewId: StudioView, boneId: AnatomicalJointId): boolean {
    const order = this.getBoneOrder(viewId);
    const idx = order.indexOf(boneId);
    if (idx === -1 || idx === order.length - 1) return false;
    order.splice(idx, 1);
    order.push(boneId);
    this.setBoneOrder(viewId, order);
    return true;
  }

  public moveBoneToBottom(viewId: StudioView, boneId: AnatomicalJointId): boolean {
    const order = this.getBoneOrder(viewId);
    const idx = order.indexOf(boneId);
    if (idx <= 0) return false;
    order.splice(idx, 1);
    order.unshift(boneId);
    this.setBoneOrder(viewId, order);
    return true;
  }

  public reorderBone(viewId: StudioView, fromIndex: number, toIndex: number): boolean {
    const order = this.getBoneOrder(viewId);
    if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) {
      return false;
    }
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    this.setBoneOrder(viewId, order);
    return true;
  }

  // --- Animations ---

  public getAnimations(): Record<string, StudioAnimationDefinition> {
    return this.animations;
  }

  public setAnimations(anims: Record<string, StudioAnimationDefinition>): void {
    this.animations = anims;
    this.notify();
  }

  public getActiveAnimationName(): string {
    return this.activeAnimationName;
  }

  public setActiveAnimationName(name: string): void {
    if (this.animations[name]) {
      this.activeAnimationName = name;
      this.notify();
    }
  }

  public createAnimation(name: string, relevantSides: StudioView[], initialDuration = 1.0): void {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'anim';
    const uniqueName = this.animations[cleanName] ? `${cleanName}_${Date.now()}` : cleanName;

    const tracks: Partial<Record<StudioView, any>> = {};
    for (const side of relevantSides) {
      const joints = this.views[side]?.joints || getDefaultJointPositions(side);
      tracks[side] = {
        duration: initialDuration,
        keyframes: [
          { time: 0.0, joints: { ...joints } },
          { time: initialDuration, joints: { ...joints } }
        ]
      };
    }

    this.animations[uniqueName] = {
      name: uniqueName,
      relevantSides,
      tracks
    };

    this.activeAnimationName = uniqueName;
    this.recordHistory(`Create Animation: ${uniqueName}`);
  }

  public deleteAnimation(animName: string): boolean {
    if (this.animations[animName]) {
      delete this.animations[animName];
      const remaining = Object.keys(this.animations);
      if (this.activeAnimationName === animName) {
        this.activeAnimationName = remaining.length > 0 ? remaining[0] : '';
      }
      this.recordHistory(`Delete Animation: ${animName}`);
      return true;
    }
    return false;
  }

  public renameAnimation(oldName: string, newName: string): boolean {
    const cleanNew = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!this.animations[oldName] || !cleanNew || this.animations[cleanNew]) {
      return false;
    }
    const animDef = this.animations[oldName];
    animDef.name = cleanNew;
    delete this.animations[oldName];
    this.animations[cleanNew] = animDef;
    if (this.activeAnimationName === oldName) {
      this.activeAnimationName = cleanNew;
    }
    this.recordHistory(`Rename Animation: ${cleanNew}`);
    return true;
  }

  public duplicateAnimation(animName: string): string {
    const src = this.animations[animName];
    if (!src) return '';
    const dupName = `${animName}_copy`;
    this.animations[dupName] = JSON.parse(JSON.stringify(src));
    this.animations[dupName].name = dupName;
    this.activeAnimationName = dupName;
    this.recordHistory(`Duplicate Animation: ${dupName}`);
    return dupName;
  }

  // --- Project Serialization ---

  public buildRigProjectData(): RigProjectData {
    const serializableViews: RigProjectData['views'] = {};

    for (const [vKey, vData] of Object.entries(this.views)) {
      const serializableParts: Record<string, any> = {};
      for (const [boneId, part] of Object.entries(vData.parts)) {
        serializableParts[boneId] = {
          id: part.id,
          boneId: part.boneId,
          fileName: part.fileName,
          imageUrl: part.imageUrl,
          scale: part.scale,
          offsetX: part.offsetX,
          offsetY: part.offsetY,
          rotation: part.rotation,
          pivotX: part.pivotX,
          pivotY: part.pivotY,
          width: part.width,
          height: part.height,
          flipX: part.flipX,
          flipY: part.flipY
        };
      }

      serializableViews[vKey] = {
        label: vData.label,
        imageUrl: vData.imageUrl,
        fileName: vData.fileName,
        fileSize: vData.fileSize,
        joints: { ...vData.joints },
        envelopes: { ...vData.envelopes },
        boneOrder: vData.boneOrder ? [...vData.boneOrder] : undefined,
        parts: serializableParts,
        facialRig: vData.facialRig ? JSON.parse(JSON.stringify(vData.facialRig)) : undefined
      };
    }

    const serializablePartsLibrary = this.partsLibrary.map(item => ({
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      width: item.width,
      height: item.height,
      assignedBoneId: item.assignedBoneId || null,
      pivotX: item.pivotX,
      pivotY: item.pivotY
    }));

    return {
      format: 'questforge-rig-project',
      version: '1.0',
      characterName: this.characterName,
      activeView: this.activeView,
      views: serializableViews,
      partsLibrary: serializablePartsLibrary,
      animations: JSON.parse(JSON.stringify(this.animations)),
      activeAnimation: this.activeAnimationName,
      commonEyeMode: this.commonEyeMode,
      commonMouthMode: this.commonMouthMode
    };
  }

  public loadRigProjectData(data: RigProjectData): void {
    if (!data) return;

    if (data.characterName) {
      this.characterName = data.characterName;
    }
    if (data.activeView && data.views && data.views[data.activeView]) {
      this.activeView = data.activeView;
    }
    if (data.commonEyeMode) {
      this.commonEyeMode = data.commonEyeMode;
    }
    if (data.commonMouthMode) {
      this.commonMouthMode = data.commonMouthMode;
    }

    if (data.views) {
      for (const [viewId, loadedView] of Object.entries(data.views)) {
        const existing = this.views[viewId];
        const label = loadedView.label || (existing ? existing.label : viewId);

        const restoredParts: Record<string, BonePartAttachment> = {};
        if (loadedView.parts) {
          for (const [boneId, partData] of Object.entries(loadedView.parts)) {
            restoredParts[boneId] = {
              id: partData.id,
              boneId: partData.boneId,
              image: null as any,
              imageUrl: partData.imageUrl || '',
              fileName: partData.fileName || '',
              scale: partData.scale ?? 1.0,
              offsetX: partData.offsetX ?? 0,
              offsetY: partData.offsetY ?? 0,
              rotation: partData.rotation ?? 0,
              pivotX: partData.pivotX,
              pivotY: partData.pivotY,
              width: partData.width,
              height: partData.height,
              flipX: partData.flipX,
              flipY: partData.flipY
            };
          }
        }

        this.views[viewId] = {
          viewId: viewId as StudioView,
          label,
          image: null,
          imageUrl: loadedView.imageUrl || '',
          fileName: loadedView.fileName || '',
          fileSize: loadedView.fileSize || '',
          joints: loadedView.joints ? { ...loadedView.joints } : getDefaultJointPositions(viewId as StudioView),
          envelopes: loadedView.envelopes ? { ...loadedView.envelopes } : { ...DEFAULT_ENVELOPES },
          parts: restoredParts,
          boneOrder: loadedView.boneOrder ? [...loadedView.boneOrder] : [...DEFAULT_BONE_DRAW_ORDER],
          visible: true,
          facialRig: loadedView.facialRig ? JSON.parse(JSON.stringify(loadedView.facialRig)) : this.createDefaultFacialRigForView(viewId)
        };
      }
    }

    if (data.animations) {
      this.animations = JSON.parse(JSON.stringify(data.animations));
      if (data.activeAnimation && this.animations[data.activeAnimation]) {
        this.activeAnimationName = data.activeAnimation;
      }
    }

    this.history.init(this.createSnapshot(), 'Loaded Project');
    this.notify();
  }

  // --- Undo / Redo ---

  public recordHistory(description: string): void {
    this.history.push(this.createSnapshot(), description);
    this.notify();
  }

  public undo(): boolean {
    const prevState = this.history.undo();
    if (prevState) {
      this.restoreSnapshot(prevState);
      this.notify();
      return true;
    }
    return false;
  }

  public redo(): boolean {
    const nextState = this.history.redo();
    if (nextState) {
      this.restoreSnapshot(nextState);
      this.notify();
      return true;
    }
    return false;
  }

  public get canUndo(): boolean {
    return this.history.canUndo;
  }

  public get canRedo(): boolean {
    return this.history.canRedo;
  }

  private createSnapshot(): RigStudioStoreSnapshot {
    const viewsSnap: RigStudioStoreSnapshot['views'] = {};
    for (const [k, v] of Object.entries(this.views)) {
      viewsSnap[k] = {
        label: v.label,
        joints: JSON.parse(JSON.stringify(v.joints)),
        envelopes: JSON.parse(JSON.stringify(v.envelopes)),
        parts: JSON.parse(JSON.stringify(v.parts)),
        boneOrder: v.boneOrder ? [...v.boneOrder] : undefined,
        facialRig: v.facialRig ? JSON.parse(JSON.stringify(v.facialRig)) : undefined
      };
    }

    return {
      characterName: this.characterName,
      activeView: this.activeView,
      views: viewsSnap,
      commonEyeMode: this.commonEyeMode,
      commonMouthMode: this.commonMouthMode
    };
  }

  private restoreSnapshot(snap: RigStudioStoreSnapshot): void {
    this.characterName = snap.characterName;
    this.activeView = snap.activeView;
    this.commonEyeMode = snap.commonEyeMode;
    this.commonMouthMode = snap.commonMouthMode;

    // Prune views that were not present in the snapshot
    for (const k of Object.keys(this.views)) {
      if (!snap.views[k]) {
        delete this.views[k];
      }
    }

    for (const [k, vSnap] of Object.entries(snap.views)) {
      if (this.views[k]) {
        this.views[k].label = vSnap.label;
        this.views[k].joints = JSON.parse(JSON.stringify(vSnap.joints));
        this.views[k].envelopes = JSON.parse(JSON.stringify(vSnap.envelopes));
        this.views[k].parts = JSON.parse(JSON.stringify(vSnap.parts));
        if (vSnap.boneOrder) this.views[k].boneOrder = [...vSnap.boneOrder];
        if (vSnap.facialRig) this.views[k].facialRig = JSON.parse(JSON.stringify(vSnap.facialRig));
      } else {
        this.views[k] = {
          viewId: k as StudioView,
          label: vSnap.label,
          image: null,
          imageUrl: '',
          fileName: '',
          fileSize: '',
          joints: JSON.parse(JSON.stringify(vSnap.joints)),
          envelopes: JSON.parse(JSON.stringify(vSnap.envelopes)),
          parts: JSON.parse(JSON.stringify(vSnap.parts)),
          boneOrder: vSnap.boneOrder ? [...vSnap.boneOrder] : [...DEFAULT_BONE_DRAW_ORDER],
          visible: true,
          facialRig: vSnap.facialRig ? JSON.parse(JSON.stringify(vSnap.facialRig)) : undefined
        };
      }
    }
  }

  public createDefaultFacialRigForView(viewId: string): FacialRigConfig {
    const isProfile = viewId === 'left' || viewId === 'right';
    const isBack = viewId === 'back';

    return {
      enabled: !isBack,
      enabledViews: ['front', 'left', 'right'],
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      eyeInstances: isBack
        ? []
        : isProfile
        ? [
            {
              id: 'eye_profile',
              name: viewId === 'left' ? 'Left Eye (Profile)' : 'Right Eye (Profile)',
              mode: this.commonEyeMode,
              offsetX: viewId === 'left' ? -8 : 8,
              offsetY: -3,
              blinkChannel: 'blinkL'
            }
          ]
        : [
            {
              id: 'eye_l',
              name: 'Left Eye',
              mode: this.commonEyeMode,
              offsetX: 14,
              offsetY: -3,
              blinkChannel: 'blinkL'
            },
            {
              id: 'eye_r',
              name: 'Right Eye',
              mode: this.commonEyeMode,
              offsetX: -14,
              offsetY: -3,
              blinkChannel: 'blinkR'
            }
          ],
      eyebrowInstances: isBack
        ? []
        : isProfile
        ? [
            {
              id: 'eyebrow_profile',
              name: 'Eyebrow',
              offsetX: viewId === 'left' ? -8 : 8,
              offsetY: -13,
              channel: 'eyebrows_height_l'
            }
          ]
        : [
            {
              id: 'eyebrow_l',
              name: 'Left Eyebrow',
              offsetX: 14,
              offsetY: -13,
              channel: 'eyebrows_height_l'
            },
            {
              id: 'eyebrow_r',
              name: 'Right Eyebrow',
              offsetX: -14,
              offsetY: -13,
              channel: 'eyebrows_height_r'
            }
          ],
      mouthInstances: isBack
        ? []
        : [
            {
              id: 'mouth_main',
              name: 'Main Mouth',
              mode: this.commonMouthMode,
              offsetX: 0,
              offsetY: 16
            }
          ],
      eyes: { mode: this.commonEyeMode },
      mouth: { mode: this.commonMouthMode },
      eyebrows: {}
    };
  }
}
