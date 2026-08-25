import * as PIXI from 'pixi.js';
import { GraphicalElement } from './GraphicalElement';
import { LayerData } from '../types';
import { AssetManager } from '../core/AssetManager';

export class Layer extends GraphicalElement {
  public data: LayerData;

  constructor(data: LayerData) {
    super(data.id, data.name, { x: data.x || 0, y: data.y || 0 });
    this.data = data;
    this.imageUrl = data.imageUrl;
    this.opacity = data.opacity;
    this.visible = data.visible;
    this.scaleX = data.scaleX ?? 1;
    this.scaleY = data.scaleY ?? 1;
  }

  public async init(): Promise<void> {
    const assetManager = AssetManager.getInstance();
    if (this.data.imageUrl.startsWith('procedural:')) {
      const type = this.data.imageUrl.replace('procedural:', '');
      this.sprite.texture = this.createProceduralLayerTexture(type);
    } else {
      this.sprite.texture = await assetManager.loadTexture(this.data.imageUrl);
    }
  }

  public updateParallax(cameraX: number, cameraY: number): void {
    const offsetX = this.data.x || 0;
    const offsetY = this.data.y || 0;
    const scaleX = this.data.scaleX ?? 1;
    const scaleY = this.data.scaleY ?? 1;

    this.container.x = offsetX - cameraX * (this.data.parallaxX ?? 1);
    this.container.y = offsetY - cameraY * (this.data.parallaxY ?? 1);
    this.container.scale.set(scaleX, scaleY);
    this.container.alpha = this.data.opacity;
    this.container.visible = this.data.visible;
  }

  private createProceduralLayerTexture(type: string): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    if (type === 'castle_sky') {
      const grad = ctx.createLinearGradient(0, 0, 0, 1080);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#31103f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1920, 1080);

      // Moon
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(1400, 250, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (type === 'castle_mountains') {
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(0, 700);
      ctx.lineTo(300, 400);
      ctx.lineTo(700, 750);
      ctx.lineTo(1100, 380);
      ctx.lineTo(1600, 700);
      ctx.lineTo(1920, 450);
      ctx.lineTo(1920, 1080);
      ctx.lineTo(0, 1080);
      ctx.fill();
    } else if (type === 'castle_background') {
      // Ground
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 500, 1920, 580);

      // Castle silhouette
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(500, 250, 400, 350);
      ctx.fillRect(450, 180, 100, 420); // Left Tower
      ctx.fillRect(850, 180, 100, 420); // Right Tower

      // Spire tops
      ctx.beginPath();
      ctx.moveTo(450, 180); ctx.lineTo(500, 80); ctx.lineTo(550, 180); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(850, 180); ctx.lineTo(900, 80); ctx.lineTo(950, 180); ctx.fill();

      // Arch door
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(700, 600, 60, Math.PI, 0);
      ctx.rect(640, 600, 120, 100);
      ctx.fill();
    } else if (type === 'lab_background') {
      // Alchemist Lab interior
      const grad = ctx.createLinearGradient(0, 0, 0, 1080);
      grad.addColorStop(0, '#1c1917');
      grad.addColorStop(1, '#292524');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1920, 1080);

      // Stone floor
      ctx.fillStyle = '#44403c';
      ctx.fillRect(0, 600, 1920, 480);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 4;
      for (let x = 0; x < 1920; x += 120) {
        ctx.beginPath(); ctx.moveTo(x, 600); ctx.lineTo(x, 1080); ctx.stroke();
      }

      // Shelves with glowing potions
      ctx.fillStyle = '#78350f';
      ctx.fillRect(200, 250, 500, 20);
      ctx.fillRect(200, 400, 500, 20);

      // Potions
      const potionColors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = potionColors[i % potionColors.length];
        ctx.beginPath();
        ctx.arc(250 + i * 90, 230, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 1920, 1080);
    }

    return PIXI.Texture.from(canvas);
  }
}
