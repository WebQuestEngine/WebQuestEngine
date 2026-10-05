import * as PIXI from 'pixi.js';
import { Vector2D, ProceduralVisualConfig } from '../types';
import { ICharacterVisualizer, CharacterRenderState } from './ICharacterVisualizer';

export class ProceduralCharacterVisualizer implements ICharacterVisualizer {
  public readonly container: PIXI.Container;
  public config: ProceduralVisualConfig;

  private shadowGraphics: PIXI.Graphics;
  private legsGraphics: PIXI.Graphics;
  private bodyGraphics: PIXI.Graphics;
  private armsGraphics: PIXI.Graphics;
  private headGraphics: PIXI.Graphics;
  private accessoriesGraphics: PIXI.Graphics;

  private animTimer = 0;
  private walkTimer = 0;
  private talkTimer = 0;
  private blinkTimer = 0;
  private isBlinking = false;

  constructor(config: ProceduralVisualConfig) {
    this.config = config;
    this.container = new PIXI.Container();

    this.shadowGraphics = new PIXI.Graphics();
    this.legsGraphics = new PIXI.Graphics();
    this.bodyGraphics = new PIXI.Graphics();
    this.armsGraphics = new PIXI.Graphics();
    this.headGraphics = new PIXI.Graphics();
    this.accessoriesGraphics = new PIXI.Graphics();

    this.container.addChild(this.shadowGraphics);
    this.container.addChild(this.legsGraphics);
    this.container.addChild(this.bodyGraphics);
    this.container.addChild(this.accessoriesGraphics);
    this.container.addChild(this.headGraphics);
    this.container.addChild(this.armsGraphics);
  }

  public async init(): Promise<void> {
    this.renderProceduralCharacter({
      state: 'idle',
      direction8Way: 'down',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });
  }

  public update(delta: number, state: CharacterRenderState): void {
    if (!this.container || (this.container as any).destroyed) return;

    this.animTimer += delta;

    if (state.state === 'walking') {
      this.walkTimer += delta;
    } else {
      this.walkTimer = 0;
    }

    if (state.state === 'talking') {
      this.talkTimer += delta;
    } else {
      this.talkTimer = 0;
    }

    // Blinking logic (blink every 3.5s for 0.15s)
    this.blinkTimer += delta;
    if (this.blinkTimer > 3.5) {
      this.isBlinking = true;
      if (this.blinkTimer > 3.65) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    }

    this.renderProceduralCharacter(state);
  }

  public freezeFrame(state: CharacterRenderState): void {
    this.walkTimer = 0;
    this.talkTimer = 0;
    this.isBlinking = false;
    this.renderProceduralCharacter(state);
  }

  public getBounds(): { width: number; height: number; anchorX: number; anchorY: number } {
    const p = this.config.proportions || { headScale: 1, bodyWidth: 32, bodyHeight: 48, limbLength: 30, limbThickness: 10 };
    const totalHeight = (p.headScale * 32) + p.bodyHeight + p.limbLength;
    const totalWidth = Math.max(p.bodyWidth + 24, p.headScale * 36);
    return {
      width: totalWidth,
      height: totalHeight,
      anchorX: 0.5,
      anchorY: 1.0
    };
  }

  public containsPoint(localPoint: Vector2D): boolean {
    const bounds = this.getBounds();
    const minX = -bounds.width / 2;
    const maxX = bounds.width / 2;
    const minY = -bounds.height;
    const maxY = 10; // foot buffer
    return localPoint.x >= minX && localPoint.x <= maxX && localPoint.y >= minY && localPoint.y <= maxY;
  }

  private parseColor(col: string | undefined, defaultCol: number): number {
    if (!col) return defaultCol;
    if (col.startsWith('#')) {
      const parsed = parseInt(col.slice(1), 16);
      return isNaN(parsed) ? defaultCol : parsed;
    }
    return defaultCol;
  }

  private renderProceduralCharacter(state: CharacterRenderState): void {
    const c = this.config;
    const pal = c.palette || {
      skin: '#fde047',
      hair: '#92400e',
      torso: '#3b82f6',
      legs: '#1e293b',
      feet: '#0f172a',
      accent: '#e11d48',
      eyes: '#0f172a'
    };
    const prop = c.proportions || {
      headScale: 1,
      bodyWidth: 32,
      bodyHeight: 48,
      limbLength: 30,
      limbThickness: 10
    };
    const feat = c.features || {};

    const skinCol = this.parseColor(pal.skin, 0xfde047);
    const hairCol = this.parseColor(pal.hair, 0x92400e);
    const torsoCol = this.parseColor(pal.torso, 0x3b82f6);
    const legsCol = this.parseColor(pal.legs, 0x1e293b);
    const feetCol = this.parseColor(pal.feet, 0x0f172a);
    const accentCol = this.parseColor(pal.accent, 0xe11d48);
    const eyesCol = this.parseColor(pal.eyes, 0x0f172a);

    // Animation variables
    const isWalking = state.state === 'walking';
    const isTalking = state.state === 'talking';

    // Idle breathing
    const idleBreath = Math.sin(this.animTimer * 2.5) * 1.5;
    // Walk bob & swing
    const walkSwing = isWalking ? Math.sin(this.walkTimer * 10) : 0;
    const walkBob = isWalking ? Math.abs(Math.sin(this.walkTimer * 10)) * 3 : 0;
    // Talk mouth offset
    const talkMouth = isTalking ? Math.max(0, Math.sin(this.talkTimer * 14)) * 5 : 0;

    const bodyY = -prop.limbLength - prop.bodyHeight + walkBob + (isWalking ? 0 : idleBreath);
    const headY = bodyY - (prop.headScale * 24);

    // 1. Shadow
    this.shadowGraphics.clear();
    this.shadowGraphics.ellipse(0, 0, prop.bodyWidth * 0.7, 6);
    this.shadowGraphics.fill({ color: 0x000000, alpha: 0.25 });

    // 2. Legs
    this.legsGraphics.clear();
    const legWidth = Math.max(6, prop.limbThickness);
    const legSpacing = prop.bodyWidth * 0.25;

    // Left leg
    const leftLegSwing = walkSwing * 12;
    this.legsGraphics.rect(-legSpacing - legWidth / 2, bodyY + prop.bodyHeight - 4, legWidth, prop.limbLength - leftLegSwing);
    this.legsGraphics.fill({ color: legsCol });
    // Left foot
    this.legsGraphics.roundRect(-legSpacing - legWidth / 2 - 2, bodyY + prop.bodyHeight + prop.limbLength - 6 - leftLegSwing, legWidth + 4, 6, 2);
    this.legsGraphics.fill({ color: feetCol });

    // Right leg
    const rightLegSwing = -walkSwing * 12;
    this.legsGraphics.rect(legSpacing - legWidth / 2, bodyY + prop.bodyHeight - 4, legWidth, prop.limbLength - rightLegSwing);
    this.legsGraphics.fill({ color: legsCol });
    // Right foot
    this.legsGraphics.roundRect(legSpacing - legWidth / 2 - 2, bodyY + prop.bodyHeight + prop.limbLength - 6 - rightLegSwing, legWidth + 4, 6, 2);
    this.legsGraphics.fill({ color: feetCol });

    // 3. Torso
    this.bodyGraphics.clear();
    if (c.archetype === 'robot') {
      // Robot boxy torso with bolts and screen
      this.bodyGraphics.roundRect(-prop.bodyWidth / 2, bodyY, prop.bodyWidth, prop.bodyHeight, 4);
      this.bodyGraphics.fill({ color: torsoCol });
      this.bodyGraphics.stroke({ color: accentCol, width: 2 });
      // Chest light / core
      this.bodyGraphics.circle(0, bodyY + prop.bodyHeight * 0.4, 6);
      this.bodyGraphics.fill({ color: accentCol });
    } else {
      // Humanoid/chibi rounded torso
      this.bodyGraphics.roundRect(-prop.bodyWidth / 2, bodyY, prop.bodyWidth, prop.bodyHeight, 6);
      this.bodyGraphics.fill({ color: torsoCol });
      // Collar / belt accent
      this.bodyGraphics.rect(-prop.bodyWidth / 2, bodyY + prop.bodyHeight - 8, prop.bodyWidth, 6);
      this.bodyGraphics.fill({ color: accentCol });
    }

    // 4. Arms
    this.armsGraphics.clear();
    const armWidth = Math.max(5, prop.limbThickness * 0.8);
    const armHeight = prop.limbLength * 0.85;

    // Left arm (swings counter to left leg)
    const leftArmAngle = -walkSwing * 0.5;
    this.armsGraphics.roundRect(-prop.bodyWidth / 2 - armWidth, bodyY + 4, armWidth, armHeight + (leftArmAngle * 10), 3);
    this.armsGraphics.fill({ color: torsoCol });
    // Left hand
    this.armsGraphics.circle(-prop.bodyWidth / 2 - armWidth / 2, bodyY + 4 + armHeight + (leftArmAngle * 10), armWidth * 0.6);
    this.armsGraphics.fill({ color: skinCol });

    // Right arm
    const rightArmAngle = walkSwing * 0.5;
    this.armsGraphics.roundRect(prop.bodyWidth / 2, bodyY + 4, armWidth, armHeight + (rightArmAngle * 10), 3);
    this.armsGraphics.fill({ color: torsoCol });
    // Right hand
    this.armsGraphics.circle(prop.bodyWidth / 2 + armWidth / 2, bodyY + 4 + armHeight + (rightArmAngle * 10), armWidth * 0.6);
    this.armsGraphics.fill({ color: skinCol });

    // 5. Head
    this.headGraphics.clear();
    const headRadius = (c.archetype === 'chibi' ? 20 : 16) * prop.headScale;

    if (c.archetype === 'robot') {
      // Robot head
      this.headGraphics.roundRect(-headRadius, headY - headRadius, headRadius * 2, headRadius * 2, 4);
      this.headGraphics.fill({ color: skinCol });
      this.headGraphics.stroke({ color: 0x475569, width: 2 });
      // Antenna
      this.headGraphics.rect(-2, headY - headRadius - 8, 4, 8);
      this.headGraphics.fill({ color: 0x475569 });
      this.headGraphics.circle(0, headY - headRadius - 10, 4);
      this.headGraphics.fill({ color: accentCol });
      // Visor eye
      this.headGraphics.roundRect(-headRadius * 0.7, headY - 4, headRadius * 1.4, 8, 3);
      this.headGraphics.fill({ color: accentCol });
    } else {
      // Humanoid/creature head
      this.headGraphics.circle(0, headY, headRadius);
      this.headGraphics.fill({ color: skinCol });

      // Hair
      this.headGraphics.arc(0, headY, headRadius + 1, Math.PI * 0.85, Math.PI * 2.15);
      this.headGraphics.fill({ color: hairCol });

      // Eyes
      if (this.isBlinking) {
        // Closed eyes slit
        this.headGraphics.rect(-headRadius * 0.45, headY - 2, 6, 2);
        this.headGraphics.rect(headRadius * 0.2, headY - 2, 6, 2);
        this.headGraphics.fill({ color: eyesCol });
      } else {
        const eyeSize = c.archetype === 'chibi' ? 5 : 3.5;
        this.headGraphics.circle(-headRadius * 0.35, headY - 2, eyeSize);
        this.headGraphics.circle(headRadius * 0.35, headY - 2, eyeSize);
        this.headGraphics.fill({ color: eyesCol });
        // Eye highlights
        this.headGraphics.circle(-headRadius * 0.35 + 1, headY - 3, eyeSize * 0.4);
        this.headGraphics.circle(headRadius * 0.35 + 1, headY - 3, eyeSize * 0.4);
        this.headGraphics.fill({ color: 0xffffff });
      }

      // Mouth
      if (isTalking) {
        this.headGraphics.roundRect(-4, headY + headRadius * 0.35, 8, 4 + talkMouth, 2);
        this.headGraphics.fill({ color: 0x991b1b });
      } else {
        this.headGraphics.rect(-3, headY + headRadius * 0.4, 6, 2);
        this.headGraphics.fill({ color: 0x991b1b });
      }
    }

    // 6. Accessories
    this.accessoriesGraphics.clear();
    if (feat.hat) {
      this.accessoriesGraphics.roundRect(-headRadius * 1.3, headY - headRadius - 6, headRadius * 2.6, 6, 2);
      this.accessoriesGraphics.fill({ color: hairCol });
      this.accessoriesGraphics.roundRect(-headRadius * 0.8, headY - headRadius - 16, headRadius * 1.6, 12, 3);
      this.accessoriesGraphics.fill({ color: hairCol });
    }
    if (feat.glasses && c.archetype !== 'robot') {
      this.accessoriesGraphics.circle(-headRadius * 0.35, headY - 2, 6);
      this.accessoriesGraphics.circle(headRadius * 0.35, headY - 2, 6);
      this.accessoriesGraphics.stroke({ color: 0x0f172a, width: 1.5 });
      this.accessoriesGraphics.rect(-headRadius * 0.1, headY - 3, headRadius * 0.2, 1.5);
      this.accessoriesGraphics.fill({ color: 0x0f172a });
    }
    if (feat.beard && c.archetype !== 'robot') {
      this.accessoriesGraphics.roundRect(-headRadius * 0.5, headY + headRadius * 0.3, headRadius, headRadius * 0.7, 4);
      this.accessoriesGraphics.fill({ color: hairCol });
    }
    if (feat.backpack) {
      this.accessoriesGraphics.roundRect(-prop.bodyWidth * 0.7, bodyY + 6, prop.bodyWidth * 0.25, prop.bodyHeight * 0.7, 4);
      this.accessoriesGraphics.fill({ color: 0x78350f });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
