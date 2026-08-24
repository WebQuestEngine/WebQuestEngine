import { Vector2D } from '../types';

export class Camera {
  public position: Vector2D = { x: 0, y: 0 };
  public target: Vector2D | null = null;
  public bounds: { width: number; height: number } = { width: 1920, height: 1080 };
  public viewport: { width: number; height: number } = { width: 1280, height: 720 };
  public lerpSpeed = 0.1;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewport = { width: viewportWidth, height: viewportHeight };
  }

  public setBounds(width: number, height: number): void {
    this.bounds = { width, height };
  }

  public follow(target: Vector2D): void {
    this.target = target;
  }

  public update(): void {
    if (!this.target) return;

    // Center camera on target
    const desiredX = this.target.x - this.viewport.width / 2;
    const desiredY = this.target.y - this.viewport.height / 2;

    // Smooth lerp
    this.position.x += (desiredX - this.position.x) * this.lerpSpeed;
    this.position.y += (desiredY - this.position.y) * this.lerpSpeed;

    // Clamp to bounds
    const maxX = Math.max(0, this.bounds.width - this.viewport.width);
    const maxY = Math.max(0, this.bounds.height - this.viewport.height);

    this.position.x = Math.max(0, Math.min(maxX, this.position.x));
    this.position.y = Math.max(0, Math.min(maxY, this.position.y));
  }

  public getParallaxOffset(parallaxX: number, parallaxY: number): Vector2D {
    return {
      x: -this.position.x * parallaxX,
      y: -this.position.y * parallaxY
    };
  }
}
