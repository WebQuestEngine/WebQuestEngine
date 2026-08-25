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

    // Add entity container (contains player, NPCs, and hotspot prop graphics for Y-depth sorting)
    this.container.addChild(this.entityContainer);

    // Initialize walk paths
    for (const wpData of this.data.walkPaths) {
      this.walkPaths.push(new WalkPath(wpData));
    }

    // Initialize hotspots and prop graphics
    for (const hsData of this.data.hotspots) {
      const hs = new Hotspot(hsData);
      await hs.init();
      this.hotspots.push(hs);
      if (hsData.imageUrl) {
        this.entityContainer.addChild(hs.container);
      }
    }

    // Initialize characters
    let hasPlayer = false;
    for (const charData of this.data.characters) {
      const char = new Character(charData);
      await char.init();
      this.characters.set(charData.id, char);
      this.entityContainer.addChild(char.container);

      if (charData.id === 'player') {
        this.playerCharacter = char;
        hasPlayer = true;
        camera.follow(char.container);
      }
    }

    // Automatically spawn player at playerSpawn if not explicitly listed in scene characters
    if (!hasPlayer) {
      const defaultPlayerData = {
        id: 'player',
        name: 'Sir Ronald',
        spriteSheetUrl: 'procedural_hero',
        frameWidth: 64,
        frameHeight: 96,
        position: { ...(this.data.playerSpawn || { x: 300, y: 750 }) },
        speed: 4,
        scale: 1,
        talkColor: '#fef08a',
        animations: {
          idleDown: [0], idleSide: [4], idleUp: [8],
          walkDown: [0, 1, 2, 3], walkSide: [4, 5, 6, 7], walkUp: [8, 9, 10, 11],
          talk: [12, 13, 14, 15]
        }
      };
      const playerChar = new Character(defaultPlayerData);
      await playerChar.init();
      this.characters.set('player', playerChar);
      this.playerCharacter = playerChar;
      this.entityContainer.addChild(playerChar.container);
      camera.follow(playerChar.container);
    }
  }

  public getWalkPath(): WalkPath | undefined {
    return this.walkPaths.find(wp => wp.data.enabled);
  }

  public findHotspotAt(point: Vector2D): Hotspot | undefined {
    return this.hotspots.find(hs => hs.containsPoint(point));
  }

  public findCharacterAt(point: Vector2D): Character | undefined {
    for (const char of this.characters.values()) {
      if (char.data.id === 'player') continue;
      const cx = char.container.x;
      const cy = char.container.y;
      const hw = (char.data.frameWidth * char.data.scale) / 2;
      const hh = char.data.frameHeight * char.data.scale;

      if (point.x >= cx - hw && point.x <= cx + hw && point.y >= cy - hh && point.y <= cy) {
        return char;
      }
    }
    return undefined;
  }

  public update(delta: number, camera: Camera): void {
    const activeWalkPath = this.getWalkPath();

    for (const char of this.characters.values()) {
      char.update(delta, activeWalkPath);
    }

    for (const hs of this.hotspots) {
      hs.update();
    }

    this.entityContainer.children.sort((a, b) => a.y - b.y);

    for (const layer of this.layers) {
      layer.updateParallax(camera.position.x, camera.position.y, this.data.width, this.data.height);
    }
  }
}
