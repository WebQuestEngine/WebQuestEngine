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

export interface CharacterAnimFrame {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

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

export interface BaseStageDirective {
  id: string;
  type: DirectiveActionType;
  actorId?: string;
  delaySeconds?: number;
  animationName?: string;
  choreographyGroupId?: string;
  itemId?: string;
  itemCount?: number;
  emoteText?: string;
  targetActorId?: string;
  targetPosition?: Vector2D;
  sfxUrl?: string;
  loopAnimation?: boolean;
  cameraAction?: 'pan' | 'zoom' | 'shake' | 'reset';
  cameraZoom?: number;
  eventName?: string;
  eventPayload?: string;
  ignoreWalkPath?: boolean;
}

export interface AnimationDirective extends BaseStageDirective {
  type: 'animation';
  animationName: string;
}

export interface ChoreographyDirective extends BaseStageDirective {
  type: 'choreography_group';
  choreographyGroupId: string;
}

export interface ItemDirective extends BaseStageDirective {
  type: 'give_item' | 'take_item';
  itemId: string;
}

export interface EmoteDirective extends BaseStageDirective {
  type: 'emote';
  emoteText: string;
}

export interface LookAtDirective extends BaseStageDirective {
  type: 'look_at';
}

export interface WalkToDirective extends BaseStageDirective {
  type: 'walk_to';
  targetPosition: Vector2D;
}

export interface SfxDirective extends BaseStageDirective {
  type: 'sfx';
  sfxUrl: string;
}

export interface CameraDirective extends BaseStageDirective {
  type: 'camera';
  cameraAction: 'pan' | 'zoom' | 'shake' | 'reset';
}

export interface CustomEventDirective extends BaseStageDirective {
  type: 'custom_event';
  eventName: string;
}

export type StageDirective =
  | AnimationDirective
  | ChoreographyDirective
  | ItemDirective
  | EmoteDirective
  | LookAtDirective
  | WalkToDirective
  | SfxDirective
  | CameraDirective
  | CustomEventDirective
  | BaseStageDirective;

export interface BaseHotspotAction {
  id?: string;
  verb: VerbType | string;
  actionType?: ActionEventType;
  description?: string;
  cursor?: string;
  sfxUrl?: string;
  requiredFlag?: string;
  notFlag?: string;
  requireItemId?: string;
  setFlags?: string[];
  clearFlags?: string[];
  giveItems?: string[];
  takeItems?: string[];
  // Legacy aliases for backward compatibility
  setFlag?: string;
  clearFlag?: string;
  giveItem?: string;
  giveItemId?: string;
  text?: string;
  targetSceneId?: string;
  targetSpawnPoint?: Vector2D;
  dialogId?: string;
  customScript?: string;
  playAnimation?: string;
  animationTarget?: 'player' | 'self' | string;
  faceDirection?: Direction8Way;
  eventName?: string;
  eventPayload?: string;
}

export interface SpeechHotspotAction extends BaseHotspotAction {
  actionType?: 'speech';
  text: string;
}

export interface DialogHotspotAction extends BaseHotspotAction {
  actionType?: 'dialog';
  dialogId: string;
}

export interface SceneChangeHotspotAction extends BaseHotspotAction {
  actionType?: 'scene_change';
  targetSceneId: string;
  targetSpawnPoint?: Vector2D;
}

export interface ItemHotspotAction extends BaseHotspotAction {
  actionType?: 'give_item';
}

export interface FlagHotspotAction extends BaseHotspotAction {
  actionType?: 'set_flag';
}

export interface AnimationHotspotAction extends BaseHotspotAction {
  actionType?: 'animation';
  playAnimation: string;
}

export interface CustomEventHotspotAction extends BaseHotspotAction {
  actionType?: 'custom_event';
  eventName: string;
}

export interface MixedHotspotAction extends BaseHotspotAction {
  actionType?: 'mixed';
}

export type HotspotAction =
  | SpeechHotspotAction
  | DialogHotspotAction
  | SceneChangeHotspotAction
  | ItemHotspotAction
  | FlagHotspotAction
  | AnimationHotspotAction
  | CustomEventHotspotAction
  | MixedHotspotAction
  | BaseHotspotAction;

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

export type CharacterVisualType = 'spritesheet' | 'procedural' | 'skeletal' | string;

export interface SpriteSheetVisualConfig {
  type: 'spritesheet';
  spriteSheetUrl: string;
  frameWidth: number;
  frameHeight: number;
  rows?: number;
  cols?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  animations: Record<string, AnimFrameRef[] | AnimationClipConfig>;
}

export interface ProceduralVisualConfig {
  type: 'procedural';
  archetype: 'humanoid' | 'robot' | 'chibi' | 'creature';
  palette: {
    skin: string;
    hair: string;
    torso: string;
    legs: string;
    feet: string;
    accent: string;
    eyes?: string;
  };
  proportions: {
    headScale: number;
    bodyWidth: number;
    bodyHeight: number;
    limbLength: number;
    limbThickness: number;
  };
  features?: {
    hat?: boolean;
    glasses?: boolean;
    beard?: boolean;
    backpack?: boolean;
  };
}

export interface SkeletalBoneData {
  name: string;
  parent?: string;
  length?: number;
  x: number;
  y: number;
  rotation?: number; // degrees
  scaleX?: number;
  scaleY?: number;
}

export interface SkeletalSlotData {
  name: string;
  bone: string;
  attachment?: string;
  color?: string;
}

export interface SkeletalAttachmentData {
  name: string;
  type?: 'region' | 'mesh' | 'shape';
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  width?: number;
  height?: number;
  color?: string;
  textureUrl?: string;
}

export interface SkeletalKeyframe {
  time: number; // in seconds
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface SkeletalAnimationTrack {
  duration: number; // in seconds
  bones: Record<string, {
    rotate?: SkeletalKeyframe[];
    translate?: SkeletalKeyframe[];
    scale?: SkeletalKeyframe[];
  }>;
}

export interface SkeletalRigData {
  bones: SkeletalBoneData[];
  slots: SkeletalSlotData[];
  attachments: Record<string, Record<string, SkeletalAttachmentData>>;
}

export interface SkeletalVisualConfig {
  type: 'skeletal';
  format: 'spine' | 'dragonbones' | 'native';
  textureUrl?: string;
  spineDoc?: any;
  skeleton: SkeletalRigData;
  animations: Record<string, SkeletalAnimationTrack>;
  defaultAnimation?: string;
  skin?: string;
}

export type CharacterVisualConfig =
  | SpriteSheetVisualConfig
  | ProceduralVisualConfig
  | SkeletalVisualConfig;

export function resolveCharacterVisualConfig(data: Partial<CharacterData>): CharacterVisualConfig {
  if (data.visual && typeof data.visual === 'object' && 'type' in data.visual) {
    return data.visual as CharacterVisualConfig;
  }

  const rawUrl = data.spriteSheetUrl || '';
  if (rawUrl.startsWith('procedural:')) {
    const archetype = (rawUrl.replace('procedural:', '') || 'humanoid') as any;
    return {
      type: 'procedural',
      archetype: ['humanoid', 'robot', 'chibi', 'creature'].includes(archetype) ? archetype : 'humanoid',
      palette: {
        skin: '#fde047',
        hair: '#92400e',
        torso: '#3b82f6',
        legs: '#1e293b',
        feet: '#0f172a',
        accent: '#e11d48',
        eyes: '#0f172a'
      },
      proportions: {
        headScale: 1,
        bodyWidth: 32,
        bodyHeight: 48,
        limbLength: 30,
        limbThickness: 10
      },
      features: {}
    };
  }

  return {
    type: 'spritesheet',
    spriteSheetUrl: data.spriteSheetUrl || '',
    frameWidth: data.frameWidth || 64,
    frameHeight: data.frameHeight || 96,
    rows: data.rows,
    cols: data.cols,
    gridOffsetX: data.gridOffsetX,
    gridOffsetY: data.gridOffsetY,
    animations: data.animations || {}
  };
}

export interface CharacterData {
  id: string;
  name: string;
  visual?: CharacterVisualConfig;
  spriteSheetUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
  rows?: number;
  cols?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  position?: Vector2D;
  speed: number;
  scale: number;
  talkColor: string;
  cursor?: string;
  customCursorUrl?: string;
  customCursorHotspotX?: number;
  customCursorHotspotY?: number;
  actions?: HotspotAction[];
  currentHoldingItemId?: string;
  animations?: Record<string, AnimFrameRef[] | AnimationClipConfig>;
  locked?: boolean;
  depthY?: number;
  portraitUrl?: string;
}

export interface SceneCharacterPlacement {
  id?: string;
  characterId: string;
  position: Vector2D;
  scale?: number;
  speed?: number;
  actions?: HotspotAction[];
  locked?: boolean;
  depthY?: number;
  currentHoldingItemId?: string;
  name?: string;
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
  characters: SceneCharacterPlacement[];
  playerCharacterId?: string;
  playerSpawn: Vector2D;
  backgroundMusicUrl?: string;
  assetBasePath?: string;
  locked?: boolean;
  choreographyGroups?: ChoreographyGroup[];
  storyPosition?: Vector2D;
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

export type ActionCategoryType = 'video' | 'screen_effect' | 'camera' | 'audio' | 'delay' | 'scene_change' | 'mutation' | 'character';

export interface BaseDialogNode {
  id: string;
  nodeType?: DialogNodeType;
  position?: Vector2D;
  speaker?: string;
  text?: string;
  requiredFlag?: string;
  notFlag?: string;
  setFlags?: string[];
  clearFlags?: string[];
  giveItems?: string[];
  takeItems?: string[];
  choices?: DialogChoice[];
  nextNodeId?: string;
  // Legacy aliases for backward compatibility
  setFlag?: string;
  clearFlag?: string;
  giveItem?: string;
  isRouterNode?: boolean;

  // Domain properties accessible on base, narrowed on specific node types
  directives?: StageDirective[];
  portraitUrl?: string;
  voiceAudioUrl?: string;
  speakerAnimation?: string;
  speakerGesture?: string;
  isChoiceInteractive?: boolean;
  waitDurationSeconds?: number;

  eventScope?: EventScopeType;
  eventTargetId?: string;
  eventName?: string;

  actionCategory?: ActionCategoryType;
  actorId?: string;
  characterAction?: 'walk_to' | 'teleport' | 'look_at' | 'animation';
  ignoreWalkPath?: boolean;
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

export interface SpeechBeatNode extends BaseDialogNode {
  nodeType?: 'beat';
  speaker: string;
  text: string;
}

export interface RouterBranchNode extends BaseDialogNode {
  nodeType: 'router';
  choices: DialogChoice[];
}

export interface EventListenerNode extends BaseDialogNode {
  nodeType: 'event_listener';
  eventScope: EventScopeType;
  eventName: string;
}

export interface ActionCinematicNode extends BaseDialogNode {
  nodeType: 'action';
}

export type DialogNode =
  | SpeechBeatNode
  | RouterBranchNode
  | EventListenerNode
  | ActionCinematicNode;

/** Type guard for router nodes (supporting legacy isRouterNode flag) */
export function isRouterNode(node: DialogNode): node is RouterBranchNode {
  return node.nodeType === 'router' || Boolean((node as any).isRouterNode);
}

/** Type guard for event listener nodes */
export function isEventListenerNode(node: DialogNode): node is EventListenerNode {
  return node.nodeType === 'event_listener';
}

/** Type guard for action / cinematic nodes */
export function isActionNode(node: DialogNode): node is ActionCinematicNode {
  return node.nodeType === 'action';
}

/** Type guard for speech / beat nodes */
export function isSpeechBeatNode(node: DialogNode): node is SpeechBeatNode {
  return !node.nodeType || node.nodeType === 'beat';
}

export interface DialogTree {
  id: string;
  title: string;
  startNodeId: string;
  nodes: Record<string, DialogNode>;
  sceneId?: string;
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

export interface StoryboardSettings {
  switchNodePositions?: Record<string, Vector2D>;
  bezierOffsets?: Record<string, Vector2D>;
}

export interface ProjectData {
  id?: string;
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
  characters: CharacterData[];
  items: InventoryItemData[];
  dialogs: DialogTree[];
  choreographyGroups?: ChoreographyGroup[];
  initialFlags: Record<string, boolean>;
  startChapterId: string;
  storyboardSettings?: StoryboardSettings;
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

