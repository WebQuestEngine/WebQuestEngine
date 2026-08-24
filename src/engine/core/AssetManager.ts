import * as PIXI from 'pixi.js';

export class AssetManager {
  private static instance: AssetManager;
  private textures: Map<string, PIXI.Texture> = new Map();

  private constructor() {}

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  public async loadTexture(url: string): Promise<PIXI.Texture> {
    if (this.textures.has(url)) {
      return this.textures.get(url)!;
    }

    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      try {
        const texture = await PIXI.Assets.load(url);
        this.textures.set(url, texture);
        return texture;
      } catch (err) {
        console.warn(`Failed to load texture at ${url}, generating fallback.`, err);
        return this.createPlaceholderTexture(url);
      }
    }

    return this.createPlaceholderTexture(url);
  }

  public createPlaceholderTexture(name: string, width = 64, height = 64, color = 0x3b82f6): PIXI.Texture {
    if (this.textures.has(name)) {
      return this.textures.get(name)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.substring(0, 8), width / 2, height / 2);

    const texture = PIXI.Texture.from(canvas);
    this.textures.set(name, texture);
    return texture;
  }

  public createProceduralCharacterSheet(name: string): PIXI.Texture {
    const key = `char_sheet_${name}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const frameW = 64;
    const frameH = 96;
    const cols = 4;
    const rows = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * cols;
    canvas.height = frameH * rows;
    const ctx = canvas.getContext('2d')!;

    // 4 rows: Idle, Walk1, Walk2, Talk
    const colors = ['#e11d48', '#2563eb', '#059669', '#d97706'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * frameW;
        const y = r * frameH;

        // Body fill
        ctx.fillStyle = colors[r % colors.length];
        ctx.beginPath();
        ctx.roundRect(x + 12, y + 24, 40, 50, 10);
        ctx.fill();

        // Head
        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.arc(x + 32, y + 22, 16, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 26, y + 18, 4, 4);
        ctx.fillRect(x + 34, y + 18, 4, 4);

        // Legs (animation offset)
        const legOffset = (c % 2 === 0) ? 0 : (c === 1 ? 6 : -6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 18 + legOffset, y + 74, 10, 18);
        ctx.fillRect(x + 36 - legOffset, y + 74, 10, 18);

        // Frame number overlay
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`R${r}C${c}`, x + 4, y + 12);
      }
    }

    const texture = PIXI.Texture.from(canvas);
    this.textures.set(key, texture);
    return texture;
  }
}
