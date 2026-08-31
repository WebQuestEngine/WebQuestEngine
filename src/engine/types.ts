export type UIPresetType = 'lucasarts' | 'sierra' | 'context_coin' | 'direct_cursor';

export type VerbType = 'walk' | 'look' | 'interact' | 'talk' | 'use' | 'pick_up' | 'open' | 'close' | 'push' | 'pull' | 'pointer';

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
  customCursors?: Partial<Record<VerbType | 'arrow', VerbCursorConfig>>;
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

export type ActionEventType = 'dialog' | 'animation' | 'speech' | 'scene_change' | 'give_item' | 'set_flag' | 'custom_event' | 'mixed';

export interface ChoreographyEntry {
  actorId: string;           // Character or Hotspot ID
  animationName: string;     // Animation clip from that actor's set
  loop?: boolean;
  delaySeconds?: number;     // Micro-delay offset
  faceTargetId?: string;     // Optional direction to turn
}

export interface ChoreographyGroup {
  id: string;
  name: string;
  entries: ChoreographyEntry[];
}

export type DirectiveActionType =
  | 'animation'          // Single actor animation (selected from actor's animation set)
  | 'choreography_group' // Synchronized multi-object animation cue
  | 'give_item'          // Item transfer (synced with gesture/line)
  | 'take_item'          // Consume item from inventory
  | 'emote'              // Overhead comic emote bubble above character head
  | 'look_at'            // Turn character to face target
  | 'walk_to'            // Walk character to target coordinate
  | 'sfx'                // Sound FX
  | 'camera'             // Camera pan/zoom/shake
  | 'custom_event';      // Custom game event signal

export interface StageDirective {
  id: string;
  type: DirectiveActionType;
  actorId?: string;             // Target Character or Object
  animationName?: string;       // Chosen from the target actor's animation set
  choreographyGroupId?: string; // If type === 'choreography_group'
  itemId?: string;              // If type === 'give_item' | 'take_item'
  itemCount?: number;
  emoteText?: string;           // If type === 'emote'
  targetActorId?: string;
  targetPosition?: Vector2D;
  sfxUrl?: string;
  delaySeconds?: number;
  loopAnimation?: boolean;
  cameraAction?: 'pan' | 'zoom' | 'shake' | 'reset';
  cameraZoom?: number;
  eventName?: string;
  eventPayload?: string;
}

export interface HotspotAction {
  verb: VerbType;
  actionType?: ActionEventType;
  eventName?: string;
  eventPayload?: string;
  text?: string;
  targetSceneId?: string;
  targetSpawnPoint?: Vector2D;
  dialogId?: string;
  giveItemId?: string;
  giveItems?: string[];
  takeItems?: string[];
  requireItemId?: string;
  setFlag?: string;
  clearFlag?: string;
  setFlags?: string[];
  clearFlags?: string[];
  requiredFlag?: string;
  notFlag?: string;
  customScript?: string;
  playAnimation?: string;
  animationTarget?: 'player' | 'self' | string;
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
  customCursorHotspotX?: number;
  customCursorHotspotY?: number;
  examined?: boolean;
}

export interface CharacterAnimFrame {
  x: number;
  y: number;
  // w: number;
  // h: number;
}

export interface CharacterData {
  id: string;
  name: string;
  spriteSheetUrl: string;
  frameWidth: number;
  frameHeight: number;
  rows?: number;
  cols?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  position: Vector2D;
  speed: number;
  scale: number;
  talkColor: string;
  cursor?: string;
  customCursorUrl?: string;
  customCursorHotspotX?: number;
  customCursorHotspotY?: number;
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
  assetBasePath?: string;
  locked?: boolean;
  choreographyGroups?: ChoreographyGroup[];
}

export interface DialogChoice {
  id: string;
  text: string;
  nextNodeId: string;
  voiceAudioUrl?: string;
  requiredFlag?: string;
  notFlag?: string;
  setFlag?: string;
  clearFlag?: string;
  setFlags?: string[];
  clearFlags?: string[];
  giveItem?: string;
  giveItems?: string[];
  takeItems?: string[];
}

export type DialogNodeType = 'beat' | 'router' | 'event_listener' | 'action';

export type EventScopeType = 'game' | 'scene' | 'hotspot' | 'character' | 'item';

export type ActionCategoryType = 'video' | 'screen_effect' | 'camera' | 'audio' | 'delay' | 'scene_change' | 'mutation';

export interface DialogNode {
  id: string;
  speaker: string;
  text: string;
  nodeType?: DialogNodeType;
  portraitUrl?: string;
  voiceAudioUrl?: string;
  speakerAnimation?: string;     // Active talk animation for speaker
  speakerGesture?: string;       // One-off gesture at start of line
  directives?: StageDirective[]; // Stage directives during this beat
  setFlags?: string[];           // List of flags to set
  clearFlags?: string[];         // List of flags to clear
  giveItems?: string[];          // List of items to award
  takeItems?: string[];          // List of items to consume
  choices?: DialogChoice[];
  nextNodeId?: string;
  requiredFlag?: string;
  notFlag?: string;
  setFlag?: string;
  clearFlag?: string;
  giveItem?: string;
  position?: Vector2D;
  isChoiceInteractive?: boolean;
  isRouterNode?: boolean;
  waitDurationSeconds?: number;  // Optional timed wait duration

  // Event Listener Node Properties
  eventScope?: EventScopeType;
  eventTargetId?: string;
  eventName?: string;

  // Action / Cinematic Node Properties
  actionCategory?: ActionCategoryType;
  videoUrl?: string;
  videoSkippable?: boolean;
  screenEffectType?: 'fade_in' | 'fade_out' | 'flash' | 'shake' | 'tint';
  screenEffectDuration?: number;
  screenEffectColor?: string;
  cameraAction?: 'pan' | 'zoom' | 'shake' | 'follow' | 'reset';
  cameraZoom?: number;
  cameraDuration?: number;
  targetPosition?: Vector2D;
  targetActorId?: string;
  audioAction?: 'play_bgm' | 'stop_bgm' | 'play_sfx';
  audioUrl?: string;
  audioVolume?: number;
  targetSceneId?: string;
  targetSpawnPoint?: Vector2D;
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
  choreographyGroups?: ChoreographyGroup[];
  initialFlags: Record<string, boolean>;
  startChapterId: string;
}

export interface SaveGameData {
  version: string;
  slotId: number | string;
  saveName: string;
  timestamp: number;
  dateFormatted: string;
  projectTitle: string;
  chapterId: string;
  chapterTitle: string;
  sceneId: string;
  sceneName: string;
  playerPos: Vector2D;
  inventoryItemIds: string[];
  flags: Record<string, boolean>;
  visitedScenes: string[];
  audioConfig?: AudioConfig;
  uiPreset?: UIPresetType;
  thumbnailUrl?: string;
}

