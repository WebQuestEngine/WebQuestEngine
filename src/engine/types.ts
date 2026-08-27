export type UIPresetType = 'lucasarts' | 'sierra' | 'context_coin' | 'direct_cursor';

export type VerbType = 'walk' | 'look' | 'interact' | 'talk' | 'use' | 'pick_up' | 'open' | 'close' | 'push' | 'pull';

export interface Vector2D {
  x: number;
  y: number;
}

export interface VerbCursorConfig {
  url: string;
  hotspotX?: number;
  hotspotY?: number;
}

export interface UIConfig {
  preset: UIPresetType;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  inventoryPosition: 'bottom' | 'top' | 'drawer' | 'radial';
  autoHideBars: boolean;
  showVerbText: boolean;
  customCursors?: Partial<Record<VerbType, VerbCursorConfig>>;
}

export interface InventoryItemData {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  combineWith?: Record<string, { resultItemId?: string; message?: string; triggerFlag?: string }>;
}

export type Direction8Way = 'down' | 'down_right' | 'right' | 'up_right' | 'up' | 'up_left' | 'left' | 'down_left';

export type AnimFrameRef = number | CharacterAnimFrame;

export interface AnimationClipConfig {
  frames: AnimFrameRef[];
  fps?: number;
  loop?: boolean;
}

export interface HotspotAction {
  verb: VerbType;
  text?: string;
  targetSceneId?: string;
  targetSpawnPoint?: Vector2D;
  dialogId?: string;
  giveItemId?: string;
  requireItemId?: string;
  setFlag?: string;
  clearFlag?: string;
  requiredFlag?: string;
  notFlag?: string;
  customScript?: string;
  playAnimation?: string;
  faceDirection?: Direction8Way;
  sfxUrl?: string;
}

export interface HotspotData {
  id: string;
  name: string;
  points: Vector2D[];
  cursor: string;
  actions: HotspotAction[];
  enabled: boolean;
  requiredFlag?: string;
  notFlag?: string;
  imageUrl?: string;
  position?: Vector2D;
  scaleX?: number;
  scaleY?: number;
  visible?: boolean;
  locked?: boolean;
  depthY?: number;
  customCursorUrl?: string;
  examined?: boolean;
}

export interface CharacterAnimFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharacterData {
  id: string;
  name: string;
  spriteSheetUrl: string;
  frameWidth: number;
  frameHeight: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  position: Vector2D;
  speed: number;
  scale: number;
  talkColor: string;
  cursor?: string;
  actions?: HotspotAction[];
  currentHoldingItemId?: string;
  animations: Record<string, AnimFrameRef[] | AnimationClipConfig>;
  locked?: boolean;
  depthY?: number;
}

export interface WalkPathData {
  id: string;
  name: string;
  points: Vector2D[];
  scaling: {
    minY: number;
    maxY: number;
    minScale: number;
    maxScale: number;
    vanishX?: number;
  };
  enabled: boolean;
  locked?: boolean;
}

export interface LayerData {
  id: string;
  name: string;
  imageUrl: string;
  parallaxX: number;
  parallaxY: number;
  zIndex: number;
  opacity: number;
  visible: boolean;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  locked?: boolean;
}

export interface SceneData {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: LayerData[];
  walkPaths: WalkPathData[];
  hotspots: HotspotData[];
  characters: CharacterData[];
  playerSpawn: Vector2D;
  backgroundMusicUrl?: string;
  locked?: boolean;
}

export interface DialogChoice {
  id: string;
  text: string;
  nextNodeId: string;
  voiceAudioUrl?: string;
  requiredFlag?: string;
  notFlag?: string;
  setFlag?: string;
  giveItem?: string;
}

export interface DialogNode {
  id: string;
  speaker: string;
  text: string;
  portraitUrl?: string;
  voiceAudioUrl?: string;
  choices?: DialogChoice[];
  nextNodeId?: string;
  requiredFlag?: string;
  notFlag?: string;
  setFlag?: string;
  giveItem?: string;
  position?: Vector2D;
  isChoiceInteractive?: boolean;
}

export interface DialogTree {
  id: string;
  title: string;
  startNodeId: string;
  nodes: Record<string, DialogNode>;
}

export interface StoryNodeData {
  id: string;
  chapterId: string;
  sceneId: string;
  name: string;
  description: string;
  position: Vector2D;
  connections: string[];
  conditionFlag?: string;
}

export interface ChapterData {
  id: string;
  title: string;
  description: string;
  startStoryNodeId: string;
  locked?: boolean;
}

export type AspectRatioType = '16:9' | '4:3' | '16:10' | '21:9' | '1:1' | 'custom';

export interface ViewportSettings {
  aspectRatio: AspectRatioType;
  width: number;
  height: number;
  x?: number;
  y?: number;
  showBoundsInEditor?: boolean;
}

export interface AudioConfig {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
}

export interface ProjectData {
  version: string;
  title: string;
  author: string;
  assetBasePath?: string;
  uiConfig: UIConfig;
  audioConfig?: AudioConfig;
  viewportSettings?: ViewportSettings;
  chapters: ChapterData[];
  storyNodes: StoryNodeData[];
  scenes: SceneData[];
  items: InventoryItemData[];
  dialogs: DialogTree[];
  initialFlags: Record<string, boolean>;
  startChapterId: string;
}
