import { Vector2D } from '../types';

export class Camera {
  public position: Vector2D = { x: 960, y: 540 };
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

  public setZoom(newZoom: number, focusWorldPoint?: Vector2D): void {
    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    if (focusWorldPoint && this.zoom !== clampedZoom) {
      // Shift camera center so the focus world point under cursor remains steady on screen
      const zoomRatio = 1 / clampedZoom - 1 / this.zoom;
      const viewCenterX = this.viewport.width / 2;
      const viewCenterY = this.viewport.height / 2;
      
      // Calculate cursor offset from center of screen
      this.position.x += (focusWorldPoint.x - this.position.x) * (1 - this.zoom / clampedZoom);
      this.position.y += (focusWorldPoint.y - this.position.y) * (1 - this.zoom / clampedZoom);
    }
    this.zoom = clampedZoom;
  }

  public zoomBy(factor: number, focusWorldPoint?: Vector2D): void {
    this.setZoom(this.zoom * factor, focusWorldPoint);
  }

  public pan(dx: number, dy: number): void {
    this.target = null;
    this.position.x -= dx / this.zoom;
    this.position.y -= dy / this.zoom;
  }

  public resetZoom(): void {
    this.zoom = 1.0;
    if (this.target) {
      this.position.x = this.target.x;
      this.position.y = this.target.y;
    } else {
      this.position.x = (this.bounds.width || 1920) / 2;
      this.position.y = (this.bounds.height || 1080) / 2;
    }
  }

  public fitToViewport(): void {
    const scaleX = this.viewport.width / (this.bounds.width || 1920);
    const scaleY = this.viewport.height / (this.bounds.height || 1080);
    this.zoom = Math.min(scaleX, scaleY, 1.0);
    this.position.x = (this.bounds.width || 1920) / 2;
    this.position.y = (this.bounds.height || 1080) / 2;
  }

  public update(): void {
    if (!this.target) return;

    // Smooth lerp camera center to target
    this.position.x += (this.target.x - this.position.x) * this.lerpSpeed;
    this.position.y += (this.target.y - this.position.y) * this.lerpSpeed;
  }

  public getParallaxOffset(parallaxX: number, parallaxY: number): Vector2D {
    const sceneCenterX = (this.bounds.width || 1920) / 2;
    const sceneCenterY = (this.bounds.height || 1080) / 2;
    return {
      x: (1 - parallaxX) * (this.position.x - sceneCenterX),
      y: (1 - parallaxY) * (this.position.y - sceneCenterY)
    };
  }
}
