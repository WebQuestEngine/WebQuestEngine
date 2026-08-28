import { Vector2D } from '../types';

export class Camera {
  public position: Vector2D = { x: 0, y: 0 };
  public panOffset: Vector2D = { x: 0, y: 0 };
  public target: Vector2D | null = null;
  public bounds: { width: number; height: number } = { width: 1920, height: 1080 };
  public viewport: { width: number; height: number } = { width: 1280, height: 720 };
  public lerpSpeed = 0.1;
  
  public zoom: number = 1.0;
  public minZoom: number = 0.15;
  public maxZoom: number = 5.0;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewport = { width: viewportWidth, height: viewportHeight };
  }

  public setBounds(width: number, height: number): void {
    this.bounds = { width, height };
  }

  public follow(target: Vector2D | null): void {
    this.target = target;
  }

  public setZoom(newZoom: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
  }

  public zoomBy(factor: number): void {
    this.setZoom(this.zoom * factor);
  }

  public pan(dx: number, dy: number): void {
    this.panOffset.x += dx;
    this.panOffset.y += dy;
  }

  public resetZoom(): void {
    this.zoom = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.position = { x: 0, y: 0 };
  }

  public fitToViewport(): void {
    const scaleX = this.viewport.width / (this.bounds.width || 1920);
    const scaleY = this.viewport.height / (this.bounds.height || 1080);
    this.zoom = Math.min(scaleX, scaleY, 1.0);
    this.panOffset = { x: 0, y: 0 };
  }

  public update(): void {
    if (!this.target) return;

    // Viewport bounds in standard world coordinates (1920x1080)
    const baseW = 1920;
    const baseH = 1080;
    const maxScrollX = Math.max(0, (this.bounds.width || baseW) - baseW);
    const maxScrollY = Math.max(0, (this.bounds.height || baseH) - baseH);

    if (maxScrollX > 0) {
      const desiredX = this.target.x - baseW / 2;
      const clampedX = Math.max(0, Math.min(maxScrollX, desiredX));
      this.position.x += (clampedX - this.position.x) * this.lerpSpeed;
    } else {
      this.position.x = 0;
    }

    if (maxScrollY > 0) {
      const desiredY = this.target.y - baseH / 2;
      const clampedY = Math.max(0, Math.min(maxScrollY, desiredY));
      this.position.y += (clampedY - this.position.y) * this.lerpSpeed;
    } else {
      this.position.y = 0;
    }
  }

  public getParallaxOffset(parallaxX: number, parallaxY: number): Vector2D {
    return {
      x: -this.position.x * parallaxX,
      y: -this.position.y * parallaxY
    };
  }

  public shake(durationSec: number = 0.5, intensity: number = 8): void {
    const startTime = performance.now();
    const origPan = { ...this.panOffset };
    const shakeInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= durationSec) {
        clearInterval(shakeInterval);
        this.panOffset = origPan;
      } else {
        const decay = 1 - (elapsed / durationSec);
        this.panOffset.x = origPan.x + (Math.random() * 2 - 1) * intensity * decay;
        this.panOffset.y = origPan.y + (Math.random() * 2 - 1) * intensity * decay;
      }
    }, 16);
  }

  public worldToScreen(x: number, y: number): Vector2D {
    return this.toScreenPoint({ x, y });
  }

  public toScreenPoint(worldPt: Vector2D): Vector2D {
    return {
      x: (worldPt.x - this.position.x) * this.zoom + this.panOffset.x,
      y: (worldPt.y - this.position.y) * this.zoom + this.panOffset.y
    };
  }
}
