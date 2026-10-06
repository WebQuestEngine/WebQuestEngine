/**
 * MiddleDragScroller.ts
 * 
 * Enables middle-mouse button (button 1) drag scrolling for all scrollable elements,
 * supporting both vertical and horizontal dragging across timelines, sidebars, lists,
 * toolbars, and containers.
 */

export interface MiddleDragScrollerOptions {
  /**
   * Container element to attach event listeners to.
   * Defaults to document.body.
   */
  container?: HTMLElement;

  /**
   * Scroll multiplier (default: 1.0).
   */
  speed?: number;

  /**
   * CSS selector for elements that should NOT be scrolled by middle drag
   * (e.g. interactive canvas viewports that handle middle click pan themselves).
   */
  excludeSelector?: string;

  /**
   * Whether to prevent Linux/X11 middle click paste or browser auto-scroll.
   * Default: true.
   */
  preventDefaults?: boolean;
}

export class MiddleDragScroller {
  private container: HTMLElement;
  private speed: number;
  private excludeSelector: string;
  private preventDefaults: boolean;

  private isDragging = false;
  private dragMoved = false;
  private lastX = 0;
  private lastY = 0;

  private activeScrollTargetX: HTMLElement | null = null;
  private activeScrollTargetY: HTMLElement | null = null;

  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnAuxClick: (e: MouseEvent) => void;
  private boundOnContextMenu: (e: MouseEvent) => void;
  private boundOnBlur: () => void;

  constructor(container: HTMLElement = document.body, options: MiddleDragScrollerOptions = {}) {
    this.container = container;
    this.speed = options.speed ?? 1.0;
    this.excludeSelector = options.excludeSelector ?? '.canvas-viewport-container, canvas.canvas-layer';
    this.preventDefaults = options.preventDefaults ?? true;

    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnAuxClick = this.onAuxClick.bind(this);
    this.boundOnContextMenu = this.onContextMenu.bind(this);
    this.boundOnBlur = this.onBlur.bind(this);

    this.attach();
  }

  public static attach(container: HTMLElement = document.body, options?: MiddleDragScrollerOptions): MiddleDragScroller {
    return new MiddleDragScroller(container, options);
  }

  private attach(): void {
    this.container.addEventListener('mousedown', this.boundOnMouseDown, { capture: true });
    window.addEventListener('auxclick', this.boundOnAuxClick, { capture: true });
    window.addEventListener('blur', this.boundOnBlur);
  }

  private isExcluded(el: HTMLElement): boolean {
    if (!this.excludeSelector) return false;
    return !!el.closest(this.excludeSelector);
  }

  private canScrollHorizontally(el: HTMLElement): boolean {
    if (el.classList.contains('no-middle-drag')) return false;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    if (!hasOverflow) return false;

    const style = window.getComputedStyle(el);
    const ox = (style.overflow === 'auto' || style.overflow === 'scroll')
      ? style.overflow
      : (style.overflowX || el.style.overflowX || el.style.overflow);
    return ox === 'auto' || ox === 'scroll' || el.classList.contains('scrollable-x') || el.classList.contains('scrollable');
  }

  private canScrollVertically(el: HTMLElement): boolean {
    if (el.classList.contains('no-middle-drag')) return false;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    if (!hasOverflow) return false;

    const style = window.getComputedStyle(el);
    const oy = (style.overflow === 'auto' || style.overflow === 'scroll')
      ? style.overflow
      : (style.overflowY || el.style.overflowY || el.style.overflow);
    return oy === 'auto' || oy === 'scroll' || el.classList.contains('scrollable-y') || el.classList.contains('scrollable');
  }

  private findScrollTargets(startEl: HTMLElement): { targetX: HTMLElement | null; targetY: HTMLElement | null } {
    let curr: HTMLElement | null = startEl;
    let targetX: HTMLElement | null = null;
    let targetY: HTMLElement | null = null;

    while (curr && curr !== document.documentElement) {
      if (!targetX && this.canScrollHorizontally(curr)) {
        targetX = curr;
      }
      if (!targetY && this.canScrollVertically(curr)) {
        targetY = curr;
      }
      if (targetX && targetY) break;
      curr = curr.parentElement;
    }

    return { targetX, targetY };
  }

  private onMouseDown(e: MouseEvent): void {
    // Only middle mouse button (button 1)
    if (e.button !== 1) return;

    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget) return;

    // Check if target is inside an excluded region (e.g. 2D vector slicing canvas or bone rigging canvas)
    if (this.isExcluded(rawTarget)) {
      return;
    }

    const { targetX, targetY } = this.findScrollTargets(rawTarget);

    // If at least one scrollable axis is found:
    if (targetX || targetY) {
      if (this.preventDefaults) {
        e.preventDefault();
        e.stopPropagation();
      }

      this.isDragging = true;
      this.dragMoved = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.activeScrollTargetX = targetX;
      this.activeScrollTargetY = targetY;

      document.body.classList.add('middle-scrolling');

      window.addEventListener('mousemove', this.boundOnMouseMove, { capture: true, passive: false });
      window.addEventListener('mouseup', this.boundOnMouseUp, { capture: true });
      window.addEventListener('contextmenu', this.boundOnContextMenu, { capture: true });
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = (e.clientX - this.lastX) * this.speed;
    const dy = (e.clientY - this.lastY) * this.speed;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.dragMoved = true;
    }

    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.activeScrollTargetX && dx !== 0) {
      this.activeScrollTargetX.scrollLeft -= dx;
    }

    if (this.activeScrollTargetY && dy !== 0) {
      this.activeScrollTargetY.scrollTop -= dy;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.isDragging) return;

    if (e.button === 1 || e.buttons === 0) {
      if (this.preventDefaults && this.dragMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.stopDragging();
    }
  }

  private onAuxClick(e: MouseEvent): void {
    if (e.button === 1 && (this.isDragging || this.dragMoved || this.preventDefaults)) {
      // Prevent browser default paste or auto-scroll
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onContextMenu(e: MouseEvent): void {
    if (this.isDragging || this.dragMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onBlur(): void {
    if (this.isDragging) {
      this.stopDragging();
    }
  }

  private stopDragging(): void {
    this.isDragging = false;
    this.activeScrollTargetX = null;
    this.activeScrollTargetY = null;

    document.body.classList.remove('middle-scrolling');

    window.removeEventListener('mousemove', this.boundOnMouseMove, { capture: true });
    window.removeEventListener('mouseup', this.boundOnMouseUp, { capture: true });

    // Remove contextmenu suppression after a short delay
    setTimeout(() => {
      this.dragMoved = false;
      window.removeEventListener('contextmenu', this.boundOnContextMenu, { capture: true });
    }, 50);
  }

  public destroy(): void {
    this.stopDragging();
    this.container.removeEventListener('mousedown', this.boundOnMouseDown, { capture: true });
    window.removeEventListener('auxclick', this.boundOnAuxClick, { capture: true });
    window.removeEventListener('blur', this.boundOnBlur);
  }
}
