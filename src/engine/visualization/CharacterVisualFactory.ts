import { CharacterData, resolveCharacterVisualConfig, CharacterVisualConfig } from '../types';
import { ICharacterVisualizer } from './ICharacterVisualizer';
import { SpriteSheetCharacterVisualizer } from './SpriteSheetCharacterVisualizer';
import { ProceduralCharacterVisualizer } from './ProceduralCharacterVisualizer';
import { SkeletalCharacterVisualizer } from './SkeletalCharacterVisualizer';

export type CharacterVisualizerCreator = (config: any) => ICharacterVisualizer;

export class CharacterVisualFactory {
  private static registry: Map<string, CharacterVisualizerCreator> = new Map();

  /**
   * Registers a custom visualizer creator for an extensible visual type.
   */
  public static register(type: string, creator: CharacterVisualizerCreator): void {
    this.registry.set(type, creator);
  }

  /**
   * Instantiates an appropriate ICharacterVisualizer for the provided CharacterData.
   */
  public static create(characterData: Partial<CharacterData>): ICharacterVisualizer {
    const config = resolveCharacterVisualConfig(characterData);
    return this.createFromConfig(config);
  }

  /**
   * Instantiates an ICharacterVisualizer directly from a CharacterVisualConfig.
   */
  public static createFromConfig(config: CharacterVisualConfig): ICharacterVisualizer {
    if (this.registry.has(config.type)) {
      return this.registry.get(config.type)!(config);
    }

    switch (config.type) {
      case 'procedural':
        return new ProceduralCharacterVisualizer(config as any);
      case 'skeletal':
        return new SkeletalCharacterVisualizer(config as any);
      case 'spritesheet':
      default:
        return new SpriteSheetCharacterVisualizer(config as any);
    }
  }
}
