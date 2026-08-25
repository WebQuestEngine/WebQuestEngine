import { InteractableElement } from './InteractableElement';
import { Vector2D } from '../types';

export class MovableElement extends InteractableElement {
  public speed: number = 200;
  public isMoving: boolean = false;
  public targetPosition: Vector2D | null = null;
  public movePath: Vector2D[] = [];

  public override update(delta: number = 0.016): void {
    if (this.isMoving && this.targetPosition) {
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 5) {
        this.position.x = this.targetPosition.x;
        this.position.y = this.targetPosition.y;
        this.isMoving = false;
        this.targetPosition = null;
      } else {
        const moveDist = this.speed * delta;
        this.position.x += (dx / dist) * moveDist;
        this.position.y += (dy / dist) * moveDist;
      }
    }
    super.update(delta);
  }

  public moveTo(target: Vector2D): void {
    this.targetPosition = { ...target };
    this.isMoving = true;
  }

  public stop(): void {
    this.isMoving = false;
    this.targetPosition = null;
  }
}
