import * as PIXI from 'pixi.js';
import { SceneData, Vector2D } from '../types';
import { Layer } from './Layer';
import { WalkPath } from './WalkPath';
import { Hotspot } from './Hotspot';
import { Character } from './Character';
import { Camera } from '../core/Camera';

export class Scene {
  public data: SceneData;
  public container: PIXI.Container;
  public layers: Layer[] = [];
  public walkPaths: WalkPath[] = [];
  public hotspots: Hotspot[] = [];
  public characters: Map<string, Character> = new Map();
  public playerCharacter: Character | null = null;
  public entityContainer: PIXI.Container;

  constructor(data: SceneData) {
    this.data = data;
    this.container = new PIXI.Container();
    this.entityContainer = new PIXI.Container();
  }

  public async init(camera: Camera): Promise<void> {
    camera.setBounds(this.data.width, this.data.height);

    // Initialize background layers sorted by zIndex
    const sortedLayers = [...this.data.layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const layerData of sortedLayers) {
      const layer = new Layer(layerData);
      await layer.init();
      this.layers.push(layer);
      this.container.addChild(layer.container);
    }

    // Add entity container (contains player and NPCs for Y-depth sorting)
    this.container.addChild(this.entityContainer);

    // Initialize walk paths
    for (const wpData of this.data.walkPaths) {
      this.walkPaths.push(new WalkPath(wpData));
    }

    // Initialize hotspots
    for (const hsData of this.data.hotspots) {
      this.hotspots.push(new Hotspot(hsData));
    }

    // Initialize characters
    for (const charData of this.data.characters) {
      const char = new Character(charData);
      await char.init();
      this.characters.set(charData.id, char);
      this.entityContainer.addChild(char.container);

      // Set player character if first character or hero
      if (!this.playerCharacter || charData.id === 'player') {
        this.playerCharacter = char;
        camera.follow(char.container);
      }
    }
  }

  public getWalkPath(): WalkPath | undefined {
    return this.walkPaths.find(wp => wp.data.enabled);
  }

  public findHotspotAt(point: Vector2D): Hotspot | undefined {
    return this.hotspots.find(hs => hs.containsPoint(point));
  }

  public update(delta: number, camera: Camera): void {
    const activeWalkPath = this.getWalkPath();

    // Update characters
    for (const char of this.characters.values()) {
      char.update(delta, activeWalkPath);
    }

    // Sort entity container by Y-position for natural depth sorting
    this.entityContainer.children.sort((a, b) => a.y - b.y);

    // Update parallax on layers
    for (const layer of this.layers) {
      layer.updateParallax(camera.position.x, camera.position.y);
    }
  }
}
