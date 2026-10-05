import * as PIXI from 'pixi.js';
import { Vector2D, Direction8Way } from '../types';
import { CharacterState } from '../scene/Character';

export interface CharacterRenderState {
  state: CharacterState;
  direction8Way: Direction8Way;
  isFacingLeft: boolean;
  currentCustomAnimKey: string | null;
  holdingItemId?: string | null;
  scale: number;
  depthY: number;
  walkPathScale?: number;
}

export interface ICharacterVisualizer {
  readonly container: PIXI.Container;
  init(): Promise<void>;
  update(delta: number, state: CharacterRenderState): void;
  freezeFrame(state: CharacterRenderState): void;
  getBounds(): { width: number; height: number; anchorX: number; anchorY: number };
  containsPoint(localPoint: Vector2D): boolean;
  destroy(): void;
}
