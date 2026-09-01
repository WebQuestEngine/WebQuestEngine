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

  public async init(camera: Camera, isEditor = false): Promise<void> {
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

    // Automatically spawn player at playerSpawn ONLY in GameRuntime (not in Editor)
    if (!hasPlayer && !isEditor) {
      const defaultPlayerData = {
        id: 'player',
        name: 'Hero',
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

  public async syncCharacters(): Promise<void> {
    const validIds = new Set(this.data.characters.map(c => c.id));

    // Remove characters that no longer exist in data
    for (const [id, char] of Array.from(this.characters.entries())) {
      if (!validIds.has(id)) {
        if (this.entityContainer && this.entityContainer.children.includes(char.container)) {
          this.entityContainer.removeChild(char.container);
        }
        char.destroy();
        this.characters.delete(id);
        if (this.playerCharacter === char) {
          this.playerCharacter = null;
        }
      }
    }

    // Add new or update existing characters
    for (const charData of this.data.characters) {
      const existing = this.characters.get(charData.id);
      if (!existing) {
        const newChar = new Character(charData);
        await newChar.init();
        this.characters.set(charData.id, newChar);
        this.entityContainer.addChild(newChar.container);
        if (charData.id === 'player') {
          this.playerCharacter = newChar;
        }
      } else {
        const needsReInit = existing.data.spriteSheetUrl !== charData.spriteSheetUrl;
        existing.data = charData;
        existing.imageUrl = charData.spriteSheetUrl;
        if (needsReInit) {
          await existing.init();
        } else {
          existing.freezeFrame(this.getWalkPath());
        }
        if (charData.id === 'player') {
          this.playerCharacter = existing;
        }
      }
    }
  }

  public async syncHotspots(): Promise<void> {
    const validIds = new Set(this.data.hotspots.map(h => h.id));
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const hs = this.hotspots[i];
      if (!validIds.has(hs.data.id)) {
        if (this.entityContainer && this.entityContainer.children.includes(hs.container)) {
          this.entityContainer.removeChild(hs.container);
        }
        hs.destroy();
        this.hotspots.splice(i, 1);
      }
    }

    for (const hsData of this.data.hotspots) {
      let existing = this.hotspots.find(h => h.data.id === hsData.id);
      if (!existing) {
        existing = new Hotspot(hsData);
        await existing.init();
        this.hotspots.push(existing);
        if (hsData.imageUrl) {
          this.entityContainer.addChild(existing.container);
        }
      } else {
        const needsReInit = existing.data.imageUrl !== hsData.imageUrl;
        existing.data = hsData;
        if (needsReInit) {
          await existing.init();
        }
      }
    }
  }

  public async syncLayers(): Promise<void> {
    this.data.layers.forEach((lData, idx) => {
      if (lData.zIndex === undefined) lData.zIndex = idx + 1;
    });

    const validIds = new Set(this.data.layers.map(l => l.id));
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (!validIds.has(layer.data.id)) {
        this.container.removeChild(layer.container);
        this.layers.splice(i, 1);
      }
    }

    for (const lData of this.data.layers) {
      let existing = this.layers.find(l => l.data.id === lData.id);
      if (!existing) {
        existing = new Layer(lData);
        await existing.init();
        this.layers.push(existing);
        this.container.addChild(existing.container);
      } else {
        const needsReInit = existing.data.imageUrl !== lData.imageUrl;
        existing.data = lData;
        if (needsReInit) {
          await existing.init();
        }
      }
    }

    this.layers.sort((a, b) => (a.data.zIndex ?? 0) - (b.data.zIndex ?? 0));
    this.layers.forEach((layer, idx) => {
      layer.updateParallax(0, 0);
      const childIdx = Math.min(idx, Math.max(0, this.container.children.length - 2));
      this.container.setChildIndex(layer.container, childIdx);
    });

    if (this.container.children.includes(this.entityContainer)) {
      this.container.setChildIndex(this.entityContainer, this.container.children.length - 1);
    }
  }

  public getWalkPath(): WalkPath | undefined {
    return this.walkPaths.find(wp => wp.data.enabled);
  }

  public findHotspotAt(point: Vector2D): Hotspot | undefined {
    return this.hotspots.find(hs => hs.containsPoint(point));
  }

  public findCharacterAt(point: Vector2D, includePlayer = false): Character | undefined {
    for (const char of this.characters.values()) {
      if (char.data.id === 'player' && !includePlayer) continue;
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
    if (!this.container || (this.container as any).destroyed) return;
    const activeWalkPath = this.getWalkPath();

    for (const char of Array.from(this.characters.values())) {
      char.update(delta, activeWalkPath);
      if (!this.container || (this.container as any).destroyed) return;
    }

    for (const hs of this.hotspots) {
      hs.update();
      if (!this.container || (this.container as any).destroyed) return;
    }

    if (!this.entityContainer || (this.entityContainer as any).destroyed) return;

    this.entityContainer.children.sort((a, b) => {
      const depthA = (a as any).depthY !== undefined ? (a as any).depthY : ((a as any).position ? a.y : 0);
      const depthB = (b as any).depthY !== undefined ? (b as any).depthY : ((b as any).position ? b.y : 0);
      return depthA - depthB;
    });

    for (const layer of this.layers) {
      layer.updateParallax(camera.position.x, camera.position.y);
    }
  }

  public getElementAtPoint(point: Vector2D): Character | Hotspot | undefined {
    const char = this.findCharacterAt(point);
    if (char) return char;
    const hs = this.findHotspotAt(point);
    if (hs) return hs;
    return undefined;
  }

  public destroy(): void {
    for (const char of this.characters.values()) {
      char.destroy();
    }
    this.characters.clear();
    for (const hs of this.hotspots) {
      hs.destroy();
    }
    this.hotspots = [];
    for (const layer of this.layers) {
      layer.destroy();
    }
    this.layers = [];
    this.container.destroy({ children: true, texture: false });
  }
}
