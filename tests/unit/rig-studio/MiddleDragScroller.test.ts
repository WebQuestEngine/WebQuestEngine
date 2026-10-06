import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiddleDragScroller } from '../../../src/rig-studio/utils/MiddleDragScroller';

describe('MiddleDragScroller', () => {
  let container: HTMLElement;
  let scrollContainer: HTMLElement;
  let childContent: HTMLElement;
  let scroller: MiddleDragScroller;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    scrollContainer = document.createElement('div');
    scrollContainer.style.width = '200px';
    scrollContainer.style.height = '200px';
    scrollContainer.style.overflow = 'auto';

    // Mock scrollWidth/scrollHeight/clientWidth/clientHeight in JSDOM
    Object.defineProperty(scrollContainer, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollWidth', { value: 600, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 600, configurable: true });
    scrollContainer.scrollLeft = 50;
    scrollContainer.scrollTop = 50;

    childContent = document.createElement('div');
    childContent.style.width = '600px';
    childContent.style.height = '600px';
    scrollContainer.appendChild(childContent);

    container.appendChild(scrollContainer);

    scroller = new MiddleDragScroller(container);
  });

  afterEach(() => {
    scroller.destroy();
    container.remove();
    document.body.className = '';
  });

  it('scrolls horizontally and vertically when dragging with middle mouse button (button 1)', () => {
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 1,
      clientX: 100,
      clientY: 100
    });
    childContent.dispatchEvent(mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
    expect(document.body.classList.contains('middle-scrolling')).toBe(true);

    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 70, // Moved left by 30px -> should scrollLeft by +30
      clientY: 80  // Moved up by 20px -> should scrollTop by +20
    });
    window.dispatchEvent(mouseMoveEvent);

    expect(scrollContainer.scrollLeft).toBe(80);
    expect(scrollContainer.scrollTop).toBe(70);

    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      button: 1
    });
    window.dispatchEvent(mouseUpEvent);

    expect(document.body.classList.contains('middle-scrolling')).toBe(false);
  });

  it('ignores non-middle clicks like left click (button 0)', () => {
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 100,
      clientY: 100
    });
    childContent.dispatchEvent(mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(false);
    expect(document.body.classList.contains('middle-scrolling')).toBe(false);

    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50
    });
    window.dispatchEvent(mouseMoveEvent);

    expect(scrollContainer.scrollLeft).toBe(50);
    expect(scrollContainer.scrollTop).toBe(50);
  });

  it('does not scroll excluded elements (e.g. canvas viewport container)', () => {
    const canvasViewport = document.createElement('div');
    canvasViewport.className = 'canvas-viewport-container';
    container.appendChild(canvasViewport);

    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 1,
      clientX: 100,
      clientY: 100
    });
    canvasViewport.dispatchEvent(mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(false);
    expect(document.body.classList.contains('middle-scrolling')).toBe(false);
  });

  it('prevents auxclick default when button is 1 to suppress browser paste/autoscroll', () => {
    const auxClickEvent = new MouseEvent('auxclick', {
      bubbles: true,
      cancelable: true,
      button: 1
    });
    window.dispatchEvent(auxClickEvent);

    expect(auxClickEvent.defaultPrevented).toBe(true);
  });

  it('cleans up event listeners upon destroy()', () => {
    scroller.destroy();

    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 1,
      clientX: 100,
      clientY: 100
    });
    childContent.dispatchEvent(mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(false);
    expect(document.body.classList.contains('middle-scrolling')).toBe(false);
  });
});
