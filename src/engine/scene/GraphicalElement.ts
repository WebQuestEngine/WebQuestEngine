import * as PIXI from 'pixi.js';
import { Vector2D } from '../types';
import { AssetManager } from '../core/AssetManager';

export class GraphicalElement {
  public id: string;
  public name: string;
  public container: PIXI.Container;
  public sprite: PIXI.Sprite;
  public position: Vector2D;
  public scaleX: number;
  public scaleY: number;
  public opacity: number;
  public visible: boolean;
  public imageUrl?: string;

  constructor(id: string, name: string, position: Vector2D = { x: 0, y: 0 }) {
    this.id = id;
    this.name = name;
    this.position = { ...position };
    this.scaleX = 1;
    this.scaleY = 1;
    this.opacity = 1;
    this.visible = true;

    this.container = new PIXI.Container();
    this.sprite = new PIXI.Sprite();
    this.container.addChild(this.sprite);
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }

  public async init(): Promise<void> {
    if (!this.imageUrl) return;
    const assetManager = AssetManager.getInstance();
    if (this.imageUrl.startsWith('procedural:')) {
      const type = this.imageUrl.replace('procedural:', '');
      this.sprite.texture = this.createProceduralTexture(type);
    } else {
      this.sprite.texture = await assetManager.loadTexture(this.imageUrl);
    }
  }

  public update(_delta?: number): void {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
    this.container.scale.set(this.scaleX, this.scaleY);
    this.container.alpha = this.opacity;
    this.container.visible = this.visible;
  }

  protected createProceduralTexture(type: string): PIXI.Texture {
    return AssetManager.getInstance().createPlaceholderTexture(type);
  }
}
