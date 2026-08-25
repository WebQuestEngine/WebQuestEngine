export type UIPresetType = 'lucasarts' | 'sierra' | 'context_coin' | 'direct_cursor';

export type VerbType = 'walk' | 'look' | 'interact' | 'talk' | 'use' | 'pick_up' | 'open' | 'close' | 'push' | 'pull';

export interface Vector2D {
  x: number;
  y: number;
}

export interface UIConfig {
  preset: UIPresetType;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  inventoryPosition: 'bottom' | 'top' | 'drawer' | 'radial';
  autoHideBars: boolean;
  showVerbText: boolean;
}

export interface InventoryItemData {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  combineWith?: Record<string, { resultItemId?: string; message?: string; triggerFlag?: string }>;
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
  position: Vector2D;
  speed: number;
  scale: number;
  talkColor: string;
  animations: {
    idleDown: number[];
    idleSide: number[];
    idleUp: number[];
    walkDown: number[];
    walkSide: number[];
    walkUp: number[];
    talk: number[];
  };
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
  };
  enabled: boolean;
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
}

export interface DialogChoice {
  id: string;
  text: string;
  nextNodeId: string;
  requiredFlag?: string;
  setFlag?: string;
  giveItem?: string;
}

export interface DialogNode {
  id: string;
  speaker: string;
  text: string;
  portraitUrl?: string;
  choices?: DialogChoice[];
  nextNodeId?: string;
  setFlag?: string;
  giveItem?: string;
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
}

export interface ProjectData {
  version: string;
  title: string;
  author: string;
  assetBasePath?: string;
  uiConfig: UIConfig;
  chapters: ChapterData[];
  storyNodes: StoryNodeData[];
  scenes: SceneData[];
  items: InventoryItemData[];
  dialogs: DialogTree[];
  initialFlags: Record<string, boolean>;
  startChapterId: string;
}
