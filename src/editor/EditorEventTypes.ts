import {
  ProjectData,
  UIPresetType,
  ViewportSettings
} from '../engine/types';
import { EngineEventMap } from '../engine/core/EventTypes';

export interface CameraZoomPayload {
  zoom: number;
}

export interface HistoryChangedPayload {
  canUndo: boolean;
  canRedo: boolean;
}

export interface ElementSelectedPayload {
  type: string;
  id: string;
  sceneId?: string;
}

export interface TargetSelectedPayload {
  type: 'project' | 'chapter' | 'scene' | 'walkpath' | 'layer' | 'hotspot' | 'character' | 'item';
  id?: string;
  sceneId?: string;
}

export interface ToggleLockPayload {
  type: string;
  id?: string;
  sceneId?: string;
}

export interface OpenDialogEditorPayload {
  dialogId?: string;
  viewMode?: 'storyboard' | 'sequences';
  sceneId?: string;
}

/**
 * Strongly typed map for Studio / Editor events.
 * Kept exclusively in editor code so published games do not bundle editor types.
 */
export interface EditorEventMap {
  'camera:zoom_changed': CameraZoomPayload;
  'camera:zoom_fit': void;
  'camera:zoom_in': void;
  'camera:zoom_out': void;
  'camera:zoom_reset': void;

  'editor:cancel_draw_polygon': void;
  'editor:cancel_pick_spawn': void;
  'editor:change_preset': UIPresetType;
  'editor:change_viewport_preset': string;
  'editor:element_selected': ElementSelectedPayload;
  'editor:load_project': ProjectData;
  'editor:mode_changed': { isPlayMode: boolean };
  'editor:open_dialog': string;
  'editor:open_dialog_editor': OpenDialogEditorPayload | string;
  'editor:open_file': void;
  'editor:pick_spawn_point': any;
  'editor:project_updated': void;
  'editor:redo': void;
  'editor:save_file': void;
  'editor:save_file_as': void;
  'editor:select_character': string;
  'editor:select_element': any;
  'editor:select_hotspot': string;
  'editor:select_item': string;
  'editor:select_layer': string;
  'editor:select_scene': string;
  'editor:select_target': TargetSelectedPayload;
  'editor:select_walkpath': string;
  'editor:show_project_hub': void;
  'editor:start_draw_polygon': any;
  'editor:toggle_dialog_editor': void;
  'editor:toggle_lock': ToggleLockPayload;
  'editor:toggle_story_graph': void;
  'editor:undo': void;
  'editor:viewport_updated': ViewportSettings;

  'history:changed': HistoryChangedPayload;
}

/**
 * Combined map containing both Engine and Editor events for editor context.
 */
export type EditorAllEventsMap = EngineEventMap & EditorEventMap;
