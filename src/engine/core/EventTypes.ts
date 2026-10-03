import {
  SceneData,
  Vector2D,
  InventoryItemData,
  DialogTree,
  DialogNode,
  StageDirective,
  DialogChoice,
  SaveGameData,
  VerbType,
  UIPresetType,
  HotspotAction
} from '../types';

export interface DialogNodeDisplayPayload {
  speaker?: string;
  text?: string;
  portraitUrl?: string;
  speakerAnimation?: string;
  directives?: StageDirective[];
  choices: DialogChoice[];
  hasNext?: boolean;
  isResponseSpeech?: boolean;
}

export interface DialogSpeakerAnimPayload {
  speaker: string;
  animation?: string;
  gesture?: string;
}

export interface DialogStartPayload {
  tree: DialogTree;
  node?: DialogNode;
}

export interface DialogActionPayload {
  node: DialogNode;
  onComplete: () => void;
}

export type SceneChangePayload =
  | SceneData
  | {
      scene: SceneData;
      spawnPoint?: Vector2D;
    };

export interface FlagChangedPayload {
  flag: string;
  value: any;
}

export interface ItemCombinePayload {
  item1: string;
  item2: string;
}

export interface ActionExecutedPayload {
  action: HotspotAction;
  targetPos?: Vector2D;
  targetElement?: any;
}

export interface AnimationStartedPayload {
  animation?: string;
  target?: string;
  actorId?: string;
}

export interface AudioSFXPayload {
  url?: string;
  type?: 'click' | 'item' | 'door' | 'pickup';
}

/**
 * Strongly typed map for all Engine / Published Game runtime events.
 * Variable identifiers (items, characters, flags) are typed as string.
 */
export interface EngineEventMap {
  // Scene lifecycle
  'scene:change': SceneChangePayload;

  // Inventory & Items (item IDs remain dynamic strings)
  'inventory:give': string;
  'inventory:take': string;
  'inventory:item_added': string;
  'inventory:selected': InventoryItemData | null | undefined;
  'inventory:updated': InventoryItemData[];
  'item:use': string;
  'item:examine': string;
  'item:combine': ItemCombinePayload;

  // Flags (flag names remain dynamic strings)
  'flag:set': string;
  'flag:clear': string;
  'flag:changed': FlagChangedPayload;
  'flags:reloaded': Record<string, any>;

  // Dialog & Cinematics
  'dialog:start': DialogStartPayload;
  'dialog:node': DialogNodeDisplayPayload;
  'dialog:speaker_anim': DialogSpeakerAnimPayload;
  'dialog:directive': StageDirective;
  'dialog:action': DialogActionPayload;
  'dialog:end': void;

  // Actions & Animations (actor IDs remain dynamic strings)
  'action:executed': ActionExecutedPayload;
  'animation:started': AnimationStartedPayload;

  // Audio & UI
  'audio:play_sfx': AudioSFXPayload;
  'ui:notify': string;
  'ui:coin_verb': VerbType;
  'ui:verb_changed': VerbType;
  'ui:preset_changed': UIPresetType | string;

  // In-Game Menu & Game Lifecycle
  'menu:open': void;
  'menu:close': void;
  'menu:toggle': void;
  'game:pause': void;
  'game:resume': void;
  'game:request_save': { slotId: number | string };
  'game:request_load': SaveGameData;
  'game:restart_chapter': void;
  'game:restart_all': void;
  'game:saved': SaveGameData;
}
