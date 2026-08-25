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

    // In play mode: track target position
    const desiredX = this.target.x - this.viewport.width / 2;
    const desiredY = this.target.y - this.viewport.height / 2;

    const maxX = Math.max(0, this.bounds.width - this.viewport.width);
    const maxY = Math.max(0, this.bounds.height - this.viewport.height);

    const clampedX = Math.max(0, Math.min(maxX, desiredX));
    const clampedY = Math.max(0, Math.min(maxY, desiredY));

    this.position.x += (clampedX - this.position.x) * this.lerpSpeed;
    this.position.y += (clampedY - this.position.y) * this.lerpSpeed;
  }

  public getParallaxOffset(parallaxX: number, parallaxY: number): Vector2D {
    return {
      x: -this.position.x * parallaxX,
      y: -this.position.y * parallaxY
    };
  }
}
