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
}

/**
 * Keyframe pose for studio animation
 */
export interface StudioKeyframe {
  time: number; // in seconds (e.g. 0.0, 0.4)
  name?: string; // Optional pose name (e.g. "Contact", "Pass", "Apex", "Down")
  joints: Record<AnatomicalJointId, { x: number; y: number }>;
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
