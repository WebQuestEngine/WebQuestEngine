import { Direction8Way } from '../engine/types';

/**
 * Vector-outlined element cut out from the source graphic sheet.
 */
export interface VectorOutlineElement {
  id: string;
  name: string;
  polygon: { x: number; y: number }[]; // Pixels in source texture space
  pivot: { x: number; y: number };     // Local normalized [0..1] or pixel offset relative to bounds
  bounds: { x: number; y: number; width: number; height: number };
  deformationMode: 'cutout' | 'mesh';
  assignedBoneId?: AnatomicalJointId;
  originJointId?: AnatomicalJointId | 'hip_mid';
  targetJointId?: AnatomicalJointId;
  sheetId?: string;
  meshOptions?: {
    triangles: number[];          // Vertex index triplets for Earcut triangulation
    bendBones?: [string, string]; // [parentBone, childBone] for dual-joint bending
  };
}

/**
 * Image Sheet / Spritesheet asset container for organizing character assets
 */
export interface StudioImageSheet {
  id: string;
  name: string;
  imageUrl: string;
  fileName: string;
  fileSize?: string;
  image?: HTMLImageElement | null;
  elements: VectorOutlineElement[];
}

/**
 * Saved vector element outlines export document format (.json)
 */
export interface SavedElementsDocument {
  format: 'questforge-elements';
  version: '1.0';
  characterName?: string;
  imageFileName?: string;
  imageFileSize?: string;
  imageUrl?: string;
  elementCount: number;
  elements: VectorOutlineElement[];
  sheets?: Array<{
    id: string;
    name: string;
    imageUrl: string;
    fileName: string;
    fileSize?: string;
    elements: VectorOutlineElement[];
  }>;
}

/**
 * Editor-specific metadata stored in skeleton.questforge
 */
export interface SpineQuestForgeMetadata {
  textureUrl?: string;
  posePreset: '3-way' | '5-way' | 'custom';
  poseDirections: Record<string, Direction8Way[]>; // e.g. front: ['down'], side: ['right', 'left']
  elements: VectorOutlineElement[];
  activePose?: string;
  activeAnimation?: string;
  poseBones?: Record<string, SpineBoneData[]>;
  poseSlots?: Record<string, string[]>;
  animations?: Record<string, StudioAnimationDefinition>;
  facialRig?: FacialRigConfig;
}

/**
 * Spine 2D Bone definition
 */
export interface SpineBoneData {
  name: string;
  parent?: string;
  length?: number;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  color?: string;
}

/**
 * Spine 2D Slot definition
 */
export interface SpineSlotData {
  name: string;
  bone: string;
  attachment?: string;
  color?: string;
  blend?: 'normal' | 'additive' | 'multiply' | 'screen';
}

/**
 * Spine 2D Region / Mesh Attachment
 */
export interface SpineAttachmentData {
  type?: 'region' | 'mesh' | 'boundingbox';
  name?: string;
  path?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  color?: string;
  // Mesh fields
  uvs?: number[];
  triangles?: number[];
  vertices?: number[];
  hull?: number;
  edges?: number[];
}

/**
 * Spine 2D Skin definition
 */
export interface SpineSkinData {
  name: string;
  attachments: Record<string, Record<string, SpineAttachmentData>>;
}

/**
 * Spine 2D Keyframe and Animation Tracks
 */
export interface SpineRotateKeyframe {
  time: number;
  angle: number;
  curve?: 'stepped' | number[];
}

export interface SpineTranslateKeyframe {
  time: number;
  x?: number;
  y?: number;
  curve?: 'stepped' | number[];
}

export interface SpineScaleKeyframe {
  time: number;
  x?: number;
  y?: number;
  curve?: 'stepped' | number[];
}

export interface SpineDrawOrderKeyframe {
  time: number;
  offsets?: { slot: string; offset: number }[];
}

export interface SpineAnimationTrack {
  bones?: Record<string, {
    rotate?: SpineRotateKeyframe[];
    translate?: SpineTranslateKeyframe[];
    scale?: SpineScaleKeyframe[];
  }>;
  slots?: Record<string, {
    attachment?: { time: number; name: string }[];
  }>;
  drawOrder?: SpineDrawOrderKeyframe[];
}

/**
 * Full Spine 2D JSON Document (v3.8 / v4.x compliant)
 */
export interface SpineDocument {
  skeleton: {
    spine: string;
    width?: number;
    height?: number;
    images?: string;
    fps?: number;
    questforge?: SpineQuestForgeMetadata;
  };
  bones: SpineBoneData[];
  slots: SpineSlotData[];
  skins: SpineSkinData[];
  animations: Record<string, SpineAnimationTrack>;
}

/**
 * Studio Mode Views / Directional Character Poses
 */
export type StudioView = 'front' | 'back' | 'left' | 'right' | string;

export type JointToolMode = 'select' | 'add_joint' | 'move' | 'preview';

export type AnatomicalJointId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'elbow_l'
  | 'elbow_r'
  | 'wrist_l'
  | 'wrist_r'
  | 'hand_l'
  | 'hand_r'
  | 'hip_l'
  | 'hip_r'
  | 'knee_l'
  | 'knee_r'
  | 'ankle_l'
  | 'ankle_r'
  | 'foot_l'
  | 'foot_r';

export interface AnatomicalJointDef {
  id: AnatomicalJointId;
  name: string;
  color: string;
  parentId?: AnatomicalJointId;
  symmetricWith?: AnatomicalJointId;
  isCenter?: boolean;
}

export interface BonePartAttachment {
  id?: string;
  boneId: AnatomicalJointId;
  originJointId?: AnatomicalJointId | 'hip_mid';
  targetJointId?: AnatomicalJointId;
  image: HTMLImageElement;
  imageUrl: string;
  fileName: string;
  fileSize?: string;
  scale?: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  pivotX?: number; // Normalized pivot anchor X [0..1]
  pivotY?: number; // Normalized pivot anchor Y [0..1]
  width?: number;
  height?: number;
  visible?: boolean;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export interface RigPartItem {
  id: string;
  name: string;
  imageUrl: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  assignedBoneId?: AnatomicalJointId | null;
  pivotX?: number;
  pivotY?: number;
}


export interface ViewArtworkData {
  viewId: StudioView;
  label: string;
  image: HTMLImageElement | null;
  imageUrl: string;
  fileName: string;
  fileSize: string;
  joints: Record<string, { x: number; y: number }>;
  envelopes: Record<string, number>;
  parts: Record<string, BonePartAttachment>;
  boneOrder?: AnatomicalJointId[];
  visible: boolean;
}

export interface RigProjectData {
  format?: string;
  version?: string;
  characterName: string;
  activeView?: StudioView;
  views: Record<string, {
    label: string;
    imageUrl?: string;
    fileName?: string;
    fileSize?: string;
    joints: Record<string, { x: number; y: number }>;
    envelopes: Record<string, number>;
    boneOrder?: AnatomicalJointId[];
    parts: Record<string, {
      id?: string;
      boneId: AnatomicalJointId;
      originJointId?: AnatomicalJointId | 'hip_mid';
      targetJointId?: AnatomicalJointId;
      fileName: string;
      imageUrl: string;
      scale?: number;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      pivotX?: number;
      pivotY?: number;
      width?: number;
      height?: number;
      flipX?: boolean;
      flipY?: boolean;
    }>;
  }>;
  partsLibrary?: {
    id: string;
    name: string;
    imageUrl: string;
    width: number;
    height: number;
    assignedBoneId: AnatomicalJointId | null;
    pivotX?: number;
    pivotY?: number;
  }[];
  slicer?: {
    imageUrl?: string;
    fileName?: string;
    fileSize?: string;
    elements?: VectorOutlineElement[];
    activeSheetId?: string;
    sheets?: Array<{
      id: string;
      name: string;
      imageUrl: string;
      fileName: string;
      fileSize?: string;
      elements: VectorOutlineElement[];
    }>;
  };
  animations?: Record<string, StudioAnimationDefinition>;
  activeAnimation?: string;
  facialRig?: FacialRigConfig;
}

export type BonePropertyKey = 'x' | 'y' | 'rotation' | 'scale';

export interface BonePropertyValues {
  x?: number;        // Position X (px)
  y?: number;        // Position Y (px)
  rotation?: number; // Forward Kinematics angle (degrees)
  scale?: number;    // Bone stretch / compression factor (1.0 = rest length)
  offsetX?: number;  // Fine-tuning graphic attachment offset X
  offsetY?: number;  // Fine-tuning graphic attachment offset Y
}

export type VisemePreset =
  | 'rest'
  | 'smile'
  | 'frown'
  | 'ah'
  | 'ee'
  | 'oh'
  | 'ooh'
  | 'fv'
  | 'l'
  | 'mbp'
  | 'wq';

export interface FacialPoseData {
  // Eyebrows
  browHeightL?: number;
  browHeightR?: number;
  browAngleL?: number;
  browAngleR?: number;
  browFurrow?: number;
  eyebrows_height_l?: number;
  eyebrows_height_r?: number;
  eyebrows_angle_l?: number;
  eyebrows_angle_r?: number;
  eyebrows_furrow?: number;

  // Eyelids
  blinkL?: number;
  blinkR?: number;
  squint?: number;
  eyelids_blink_l?: number;
  eyelids_blink_r?: number;
  eyelids_squint?: number;

  // Mouth & Visemes
  viseme?: VisemePreset;
  mouthOpen?: number;
  mouthWidth?: number;
  mouthSmile?: number;
  mouthPucker?: number;
  lips_open?: number;
  lips_wide?: number;
  lips_smile?: number;
  lips_pucker?: number;
  lips_jaw_drop?: number;
  teethUpper?: boolean;
  teethLower?: boolean;
  tongue?: boolean;
}

export type EyeRigMode = 'sprite_swap' | 'sclera_window' | 'procedural';
export type MouthRigMode = 'viseme_library' | 'cavity_sandwich' | 'mesh_warp' | 'procedural';

export interface EyeRigConfig {
  mode: EyeRigMode;
  // Sliced sprite assignments for frame-by-frame sprite swap
  eyeOpenSlot?: string;
  eyeHalfSlot?: string;
  eyeClosedSlot?: string;
  leftEyePartId?: string;
  rightEyePartId?: string;
  // Sliced sprite assignments for sclera window
  eyeballSlot?: string;
  scleraPartId?: string;
  eyelidUpperSlot?: string;
  eyelidUpperPartId?: string;
  eyelidLowerSlot?: string;
  eyelidLowerPartId?: string;
  pupilPartId?: string;
  // Sliced Eyebrows
  browLSlot?: string;
  browRSlot?: string;
  browLeftPartId?: string;
  browRightPartId?: string;
  sprites?: Record<string, string>;
}

export interface EyebrowRigConfig {
  leftBrowPartId?: string;
  rightBrowPartId?: string;
  color?: string;
  thickness?: number;
}

export interface MouthRigConfig {
  mode: MouthRigMode;
  // Sliced sprite assignments for viseme library
  visemeSlots?: Partial<Record<VisemePreset, string>>;
  visemePartIds?: Partial<Record<VisemePreset, string>>;
  // Sliced sprite assignments for cavity sandwich
  upperLipSlot?: string;
  lowerLipSlot?: string;
  cavitySlot?: string;
  cavityPartId?: string;
  teethUpperPartId?: string;
  tonguePartId?: string;
  lipUpperPartId?: string;
  lipLowerPartId?: string;
  // Sliced sprite assignment for single-sprite mesh warp
  mouthSpriteSlot?: string;
  mouthPartId?: string;
  baseMouthPartId?: string;
  // Procedural styling
  lipColor?: string;
  cavityColor?: string;
  teethColor?: string;
}

export interface EyeInstanceConfig {
  id: string;
  name: string;
  mode: EyeRigMode;
  offsetX: number; // local offset from face center (px)
  offsetY: number; // local offset from face center (px)
  scale?: number;
  rotation?: number; // degrees
  flipX?: boolean;
  enabledViews?: StudioView[]; // If specified, only shown in these views
  // Slot bindings for sprite swap:
  eyeOpenSlot?: string;
  eyeHalfSlot?: string;
  eyeClosedSlot?: string;
  partId?: string;
  sprites?: Record<string, string>;
  // Slot bindings for sclera window:
  scleraPartId?: string;
  pupilPartId?: string;
  eyelidUpperPartId?: string;
  eyelidLowerPartId?: string;
  // Blink channel binding
  blinkChannel?: 'blinkL' | 'blinkR' | 'squint';
}

export interface EyebrowInstanceConfig {
  id: string;
  name: string;
  partId?: string;
  color?: string;
  thickness?: number;
  offsetX: number;
  offsetY: number;
  scale?: number;
  angle?: number;
  flipX?: boolean;
  enabledViews?: StudioView[];
  channel?: 'eyebrows_height_l' | 'eyebrows_height_r';
}

export interface MouthInstanceConfig {
  id: string;
  name: string;
  mode: MouthRigMode;
  offsetX: number;
  offsetY: number;
  scale?: number;
  rotation?: number;
  flipX?: boolean;
  enabledViews?: StudioView[];
  // Visemes
  visemeSlots?: Partial<Record<VisemePreset, string>>;
  visemePartIds?: Partial<Record<VisemePreset, string>>;
  // Cavity sandwich
  upperLipSlot?: string;
  lowerLipSlot?: string;
  cavitySlot?: string;
  cavityPartId?: string;
  teethUpperPartId?: string;
  tonguePartId?: string;
  lipUpperPartId?: string;
  lipLowerPartId?: string;
  // Mesh warp
  mouthSpriteSlot?: string;
  mouthPartId?: string;
  baseMouthPartId?: string;
  // Procedural
  lipColor?: string;
  cavityColor?: string;
  teethColor?: string;
}

export interface FacialRigConfig {
  // Configurable views where facial features appear (user selectable, e.g. includes 'back' if desired)
  enabledViews?: StudioView[];

  // Placement & scale
  offsetX?: number; // Horizontal offset on head (px)
  offsetY?: number; // Vertical offset on head (px)
  scale?: number;   // Facial scale multiplier (1.0 = standard)

  // Multi-instance feature arrays (supports N eyes, N eyebrows, N mouths)
  eyeInstances?: EyeInstanceConfig[];
  eyebrowInstances?: EyebrowInstanceConfig[];
  mouthInstances?: MouthInstanceConfig[];

  // Legacy / fallback single configurations
  eyebrows?: EyebrowRigConfig;
  eyes?: EyeRigConfig;
  mouth?: MouthRigConfig;
}

/**
 * Keyframe pose for studio animation
 */
export interface StudioKeyframe {
  time: number; // in seconds (e.g. 0.0, 0.4)
  name?: string; // Optional pose name (e.g. "Contact", "Pass", "Apex", "Down")
  joints: Record<AnatomicalJointId, { x: number; y: number }>;
  boneProps?: Partial<Record<AnatomicalJointId, BonePropertyValues>>;
  face?: FacialPoseData;
}

/**
 * Unique timeline track per character side/view
 */
export interface StudioSideTrack {
  duration: number; // in seconds
  keyframes: StudioKeyframe[];
}

/**
 * User-defined animation clip with relevant sides configuration
 */
export interface StudioAnimationDefinition {
  name: string;
  relevantSides: StudioView[];
  tracks: Partial<Record<StudioView, StudioSideTrack>>;
}

/**
 * Studio Mode Tabs
 */
export type StudioTab = 'slicer' | 'rigging' | 'timeline' | 'sandbox';

/**
 * postMessage Protocol Types between Host Editor and Embedded Studio
 */
export type StudioHostMessage =
  | {
      type: 'STUDIO_INIT';
      payload: {
        characterName: string;
        characterId?: string;
        textureUrl?: string;
        spineData?: SpineDocument | null;
        availableTextures?: string[];
      };
    }
  | {
      type: 'STUDIO_REQUEST_SAVE';
    };

export type StudioIframeMessage =
  | {
      type: 'STUDIO_READY';
    }
  | {
      type: 'STUDIO_SAVE';
      payload: {
        spineData: SpineDocument;
        textureUrl?: string;
      };
    }
  | {
      type: 'STUDIO_DIRTY_STATE';
      payload: { isDirty: boolean };
    }
  | {
      type: 'STUDIO_CLOSE';
    };
