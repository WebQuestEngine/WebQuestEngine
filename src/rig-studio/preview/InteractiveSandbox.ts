import * as PIXI from 'pixi.js';
import { SpineDocument } from '../types';

export class InteractiveSandbox {
  private container: HTMLElement;
  private app: PIXI.Application | null = null;
  private doc: SpineDocument;

  private charContainer: PIXI.Container | null = null;
  private boneGraphicsContainer: PIXI.Container | null = null;
  private speechContainer: PIXI.Container | null = null;

  // Character State
  private charX = 400;
  private charY = 350;
  private targetX = 400;
  private targetY = 350;
  private isMoving = false;
  private isFacingLeft = false;
  private currentPose = 'front';
  private currentAnim = 'idle';
  private animTimer = 0;
  private isTalking = false;
  private talkTimer = 0;

  // Keyboard navigation
  private keysPressed: Set<string> = new Set();
  private tickerRef: any = null;

  constructor(container: HTMLElement, doc: SpineDocument) {
    this.container = container;
    this.doc = doc;
    this.initPixi().catch(console.error);
    this.bindKeyboard();
  }

  public setDocument(doc: SpineDocument): void {
    this.doc = doc;
    this.rebuildCharacter();
  }

  public triggerTalk(): void {
    this.isTalking = true;
    this.talkTimer = 3.0; // 3 seconds
    if (this.speechContainer) this.speechContainer.visible = true;
  }

  private async initPixi(): Promise<void> {
    this.app = new PIXI.Application();
    await this.app.init({
      resizeTo: this.container,
      background: '#040814',
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    this.container.appendChild(this.app.canvas);

    // Draw grid on ground
    const grid = new PIXI.Graphics();
    grid.strokeStyle = { color: 0x1e293b, width: 1, alpha: 0.5 };
    for (let x = 0; x < 2000; x += 40) {
      grid.moveTo(x, 0);
      grid.lineTo(x, 2000);
    }
    for (let y = 0; y < 2000; y += 40) {
      grid.moveTo(0, y);
      grid.lineTo(2000, y);
    }
    grid.stroke();
    this.app.stage.addChild(grid);

    // Character container
    this.charContainer = new PIXI.Container();
    this.charContainer.x = this.charX;
    this.charContainer.y = this.charY;
    this.app.stage.addChild(this.charContainer);

    // Ground Shadow
    const shadow = new PIXI.Graphics();
    shadow.ellipse(0, 0, 24, 8);
    shadow.fill({ color: 0x000000, alpha: 0.4 });
    this.charContainer.addChild(shadow);

    // Bone container
    this.boneGraphicsContainer = new PIXI.Container();
    this.charContainer.addChild(this.boneGraphicsContainer);

    // Speech Bubble container
    this.speechContainer = new PIXI.Container();
    this.speechContainer.y = -85;
    this.speechContainer.visible = false;

    const bubbleBg = new PIXI.Graphics();
    bubbleBg.roundRect(-70, -26, 140, 28, 6);
    bubbleBg.fill({ color: 0x0f172a, alpha: 0.95 });
    bubbleBg.stroke({ color: 0x38bdf8, width: 1.5 });
    this.speechContainer.addChild(bubbleBg);

    const txt = new PIXI.Text({
      text: '💬 Testing speech talk!',
      style: {
        fontSize: 10,
        fill: 0xf8fafc,
        fontFamily: 'Inter, sans-serif'
      }
    });
    txt.anchor.set(0.5, 0.5);
    txt.y = -12;
    this.speechContainer.addChild(txt);
    this.charContainer.addChild(this.speechContainer);

    this.rebuildCharacter();

    // Click to walk
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', (e) => {
      this.targetX = e.global.x;
      this.targetY = e.global.y;
      this.isMoving = true;
    });

    this.tickerRef = (ticker: any) => {
      const delta = ticker.deltaTime / 60;
      this.update(delta);
    };
    this.app.ticker.add(this.tickerRef);
  }

  private rebuildCharacter(): void {
    if (!this.boneGraphicsContainer) return;
    this.boneGraphicsContainer.removeChildren();

    const poseBones = this.doc.skeleton?.questforge?.poseBones?.[this.currentPose];
    const bones = (poseBones && poseBones.length > 0) ? poseBones : (this.doc.bones || []);
    for (const b of bones) {
      const gfx = new PIXI.Graphics();
      const length = b.length || 20;

      gfx.circle(0, 0, 4);
      gfx.fill({ color: 0x0284c7 });
      gfx.roundRect(0, -3, length, 6, 2);
      gfx.fill({ color: 0x38bdf8 });
      gfx.circle(length, 0, 3);
      gfx.fill({ color: 0x0284c7 });

      gfx.label = b.name;
      gfx.x = b.x;
      gfx.y = b.y;
      gfx.rotation = ((b.rotation || 0) * Math.PI) / 180;
      this.boneGraphicsContainer.addChild(gfx);
    }
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
        this.keysPressed.add(k);
        this.isMoving = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keysPressed.delete(k);
      if (this.keysPressed.size === 0 && Math.hypot(this.targetX - this.charX, this.targetY - this.charY) < 5) {
        this.isMoving = false;
      }
    });
  }

  private update(delta: number): void {
    if (!this.charContainer) return;

    // 1. Process movement
    let moveDx = 0;
    let moveDy = 0;
    const speed = 160 * delta; // 160px / sec

    if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) moveDy -= 1;
    if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) moveDy += 1;
    if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) moveDx -= 1;
    if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) moveDx += 1;

    if (moveDx !== 0 || moveDy !== 0) {
      const len = Math.hypot(moveDx, moveDy);
      this.charX += (moveDx / len) * speed;
      this.charY += (moveDy / len) * speed;
      this.targetX = this.charX;
      this.targetY = this.charY;
      this.isMoving = true;

      const prevPose = this.currentPose;
      // Update pose and direction
      if (Math.abs(moveDx) > Math.abs(moveDy)) {
        this.currentPose = 'side';
        this.isFacingLeft = moveDx < 0;
      } else if (moveDy > 0) {
        this.currentPose = 'front';
        this.isFacingLeft = false;
      } else {
        this.currentPose = 'back';
        this.isFacingLeft = false;
      }
      if (this.currentPose !== prevPose) {
        this.rebuildCharacter();
      }
    } else if (this.isMoving) {
      const dist = Math.hypot(this.targetX - this.charX, this.targetY - this.charY);
      if (dist > 4) {
        const dx = (this.targetX - this.charX) / dist;
        const dy = (this.targetY - this.charY) / dist;
        this.charX += dx * Math.min(dist, speed);
        this.charY += dy * Math.min(dist, speed);

        const prevPose = this.currentPose;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.currentPose = 'side';
          this.isFacingLeft = dx < 0;
        } else if (dy > 0) {
          this.currentPose = 'front';
          this.isFacingLeft = false;
        } else {
          this.currentPose = 'back';
          this.isFacingLeft = false;
        }
        if (this.currentPose !== prevPose) {
          this.rebuildCharacter();
        }
      } else {
        this.isMoving = false;
      }
    }

    this.charContainer.x = this.charX;
    this.charContainer.y = this.charY;
    this.charContainer.scale.x = this.isFacingLeft ? -1.5 : 1.5;
    this.charContainer.scale.y = 1.5;

    // 2. Resolve animation
    const targetAnim = this.isMoving ? 'walk' : (this.isTalking ? 'talk' : 'idle');
    if (targetAnim !== this.currentAnim && this.doc.animations[targetAnim]) {
      this.currentAnim = targetAnim;
      this.animTimer = 0;
    }

    if (this.isTalking) {
      this.talkTimer -= delta;
      if (this.talkTimer <= 0) {
        this.isTalking = false;
        if (this.speechContainer) this.speechContainer.visible = false;
      }
    }

    // 3. Evaluate animation keyframes
    this.animTimer += delta;
    this.evaluateAnimation();
  }

  private evaluateAnimation(): void {
    if (!this.boneGraphicsContainer) return;
    const track = this.doc.animations[this.currentAnim] || this.doc.animations.idle;
    if (!track || !track.bones) return;

    let maxTime = 0.8;
    for (const b of Object.values(track.bones)) {
      for (const r of b.rotate || []) {
        if (r.time > maxTime) maxTime = r.time;
      }
    }

    const t = this.animTimer % maxTime;

    for (const [boneName, bTrack] of Object.entries(track.bones)) {
      const child = this.boneGraphicsContainer.children.find(c => c.label === boneName);
      if (!child) continue;

      const baseBone = this.doc.bones.find(b => b.name === boneName);
      const baseRot = baseBone?.rotation || 0;

      if (bTrack.rotate && bTrack.rotate.length > 0) {
        const rot = this.interpolateRotation(bTrack.rotate, t);
        child.rotation = ((baseRot + rot) * Math.PI) / 180;
      }
    }
  }

  private interpolateRotation(keyframes: { time: number; angle: number }[], t: number): number {
    if (keyframes.length === 1) return keyframes[0].angle;
    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
        k0 = keyframes[i];
        k1 = keyframes[i + 1];
        break;
      }
    }

    const span = k1.time - k0.time;
    const factor = span > 0 ? (t - k0.time) / span : 0;
    return k0.angle + (k1.angle - k0.angle) * factor;
  }

  public destroy(): void {
    if (this.app) {
      if (this.tickerRef) this.app.ticker.remove(this.tickerRef);
      this.app.destroy(true, { children: true });
    }
  }
}
