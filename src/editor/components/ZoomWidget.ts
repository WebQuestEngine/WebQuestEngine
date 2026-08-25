import { EventBus } from '../../engine/core/EventBus';

export class ZoomWidget {
  public element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'zoom-widget-overlay';
    this.render();

    EventBus.getInstance().on('camera:zoom_changed', (data: { zoom: number }) => {
      const label = this.element.querySelector('#zoom-val-label');
      if (label) {
        label.textContent = `${Math.round(data.zoom * 100)}%`;
      }
    });
  }

  private render(): void {
    this.element.innerHTML = `
      <button class="btn btn-zoom" id="btn-zoom-out" title="Zoom Out (−)">−</button>
      <span class="zoom-level-text" id="zoom-val-label">100%</span>
      <button class="btn btn-zoom" id="btn-zoom-in" title="Zoom In (+)">+</button>
      <div style="width:1px; height:16px; background:rgba(255,255,255,0.15); margin:0 2px;"></div>
      <button class="btn btn-zoom" id="btn-zoom-reset" title="Reset Zoom (100%)">1:1</button>
      <button class="btn btn-zoom" id="btn-zoom-fit" title="Fit Scene to Viewport">🔍 Fit</button>
    `;

    this.element.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      EventBus.getInstance().emit('camera:zoom_out');
    });

    this.element.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      EventBus.getInstance().emit('camera:zoom_in');
    });

    this.element.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
      EventBus.getInstance().emit('camera:zoom_reset');
    });

    this.element.querySelector('#btn-zoom-fit')?.addEventListener('click', () => {
      EventBus.getInstance().emit('camera:zoom_fit');
    });
  }
}
