import * as PIXI from 'pixi.js';
import { SceneData, Vector2D, CharacterData, SceneCharacterPlacement } from '../types';
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
  public characterDefinitions: Map<string, CharacterData> = new Map();
  public playerCharacter: Character | null = null;
  public entityContainer: PIXI.Container;

  constructor(data: SceneData, characterDefinitions: CharacterData[] = []) {
    this.data = data;
    this.container = new PIXI.Container();
    this.entityContainer = new PIXI.Container();
    this.setCharacterDefinitions(characterDefinitions);
  }

  public setCharacterDefinitions(characterDefinitions: CharacterData[]): void {
    this.characterDefinitions.clear();
    for (const def of characterDefinitions || []) {
      if (def && def.id) {
        this.characterDefinitions.set(def.id, def);
      }
    }
  }

  public async init(camera?: Camera): Promise<void> {
    if (camera) {
      camera.setBounds(this.data.width, this.data.height);
    }

    // Initialize background layers sorted by zIndex
    const sortedLayers = [...(this.data.layers || [])].sort((a, b) => a.zIndex - b.zIndex);
    for (const layerData of sortedLayers) {
      const layer = new Layer(layerData);
      await layer.init();
      this.layers.push(layer);
      this.container.addChild(layer.container);
    }

    // Add entity container (contains player, NPCs, and hotspot prop graphics for Y-depth sorting)
    this.container.addChild(this.entityContainer);

    // Initialize walk paths
    for (const wpData of this.data.walkPaths || []) {
      this.walkPaths.push(new WalkPath(wpData));
    }

    // Initialize hotspots and prop graphics
    for (const hsData of this.data.hotspots || []) {
      const hs = new Hotspot(hsData);
      await hs.init();
      this.hotspots.push(hs);
      if (hsData.imageUrl) {
        this.entityContainer.addChild(hs.container);
      }
    }

    // Initialize characters
    // Playable character defaults to scene.playerCharacterId or the first defined character
    const activePlayableId =
      this.data.playerCharacterId ||
      (this.characterDefinitions.keys().next().value ?? 'player');

    let hasPlayer = false;
    for (const placement of this.data.characters || []) {
      const charId = (placement as any).characterId || (placement as any).id;
      if (!charId) continue;

      const def = this.characterDefinitions.get(charId);
      const charData: CharacterData = {
        id: charId,
        name: def?.name || (placement as any).name || (charId === 'player' ? 'Hero' : charId),
        spriteSheetUrl: def?.spriteSheetUrl || (placement as any).spriteSheetUrl || '',
        frameWidth: def?.frameWidth || (placement as any).frameWidth || 64,
        frameHeight: def?.frameHeight || (placement as any).frameHeight || 96,
        rows: def?.rows ?? (placement as any).rows,
        cols: def?.cols ?? (placement as any).cols,
        gridOffsetX: def?.gridOffsetX ?? (placement as any).gridOffsetX,
        gridOffsetY: def?.gridOffsetY ?? (placement as any).gridOffsetY,
        speed: placement.speed !== undefined ? placement.speed : (def?.speed ?? 200),
        scale: placement.scale !== undefined ? placement.scale : (def?.scale ?? 1),
        talkColor: def?.talkColor || (placement as any).talkColor || '#fbbf24',
        cursor: def?.cursor || (placement as any).cursor,
        customCursorUrl: def?.customCursorUrl || (placement as any).customCursorUrl,
        customCursorHotspotX: def?.customCursorHotspotX ?? (placement as any).customCursorHotspotX,
        customCursorHotspotY: def?.customCursorHotspotY ?? (placement as any).customCursorHotspotY,
        animations: def?.animations || (placement as any).animations || {},
        position: { ...(placement.position || { x: 300, y: 750 }) },
        actions: placement.actions || def?.actions || [],
        depthY: placement.depthY,
        locked: placement.locked,
        currentHoldingItemId: placement.currentHoldingItemId || def?.currentHoldingItemId
      };

      const char = new Character(charData);
      await char.init();
      this.characters.set(charId, char);
      this.entityContainer.addChild(char.container);

      if (charId === activePlayableId) {
        this.playerCharacter = char;
        hasPlayer = true;
        if (camera) camera.follow(char.container);
      }
    }

    // Automatically spawn playable character at playerSpawn if not explicitly placed in scene
    if (!hasPlayer) {
      const def = this.characterDefinitions.get(activePlayableId);
      const playerPos = { ...(this.data.playerSpawn || { x: 300, y: 750 }) };
      const defaultPlayerData: CharacterData = def
        ? {
            ...def,
            id: activePlayableId,
            position: playerPos
          }
        : {
            id: activePlayableId,
            name: activePlayableId === 'player' ? 'Hero' : activePlayableId,
            spriteSheetUrl: 'procedural_hero',
            frameWidth: 64,
            frameHeight: 96,
            position: playerPos,
            speed: 4,
            scale: 1,
            talkColor: '#fef08a',
            animations: {
              idleDown: [0],
              idleSide: [4],
              idleUp: [8],
              walkDown: [0, 1, 2, 3],
              walkSide: [4, 5, 6, 7],
              walkUp: [8, 9, 10, 11],
              talk: [12, 13, 14, 15]
            }
          };
      const playerChar = new Character(defaultPlayerData);
      await playerChar.init();
      this.characters.set(activePlayableId, playerChar);
      this.playerCharacter = playerChar;
      this.entityContainer.addChild(playerChar.container);
      if (camera) camera.follow(playerChar.container);
    }
  }

  public async syncLayers(): Promise<void> {
    if (!this.data.layers) this.data.layers = [];
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
        existing.data = lData;
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
      if (char === this.playerCharacter && !includePlayer) continue;
      const cx = char.container.x;
      const cy = char.container.y;
      const scale = char.data.scale || 1;
      const hw = (char.data.frameWidth * scale) / 2;
      const hh = char.data.frameHeight * scale;

      if (point.x >= cx - hw && point.x <= cx + hw && point.y >= cy - hh && point.y <= cy) {
        return char;
      }
    }
    return undefined;
  }

  public switchPlayerCharacter(characterId: string, camera?: Camera): Character | null {
    const targetChar = this.characters.get(characterId);
    if (!targetChar) return null;

    this.playerCharacter = targetChar;
    this.data.playerCharacterId = characterId;
    if (camera) {
      camera.follow(targetChar.container);
    }
    return targetChar;
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
