import { EventBus } from '../../engine/core/EventBus';
import { ZoomWidgetTemplate } from './templates/ZoomWidget.template';

export interface ZoomWidgetOptions {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onFit?: () => void;
  initialZoom?: number;
}

export class ZoomWidget {
  public element: HTMLElement;
  private options?: ZoomWidgetOptions;

  constructor(options?: ZoomWidgetOptions) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.className = 'zoom-widget-overlay';
    this.render();

    if (this.options?.initialZoom !== undefined) {
      this.setZoom(this.options.initialZoom);
    }

    if (!this.options?.onZoomIn && !this.options?.onZoomOut) {
      EventBus.getInstance().on('camera:zoom_changed', (data: { zoom: number }) => {
        this.setZoom(data.zoom);
      });
    }
  }

  public setZoom(zoom: number): void {
    const label = this.element.querySelector('#zoom-val-label');
    if (label) {
      label.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  private render(): void {
    this.element.innerHTML = ZoomWidgetTemplate.render();

    this.element.querySelector('#btn-zoom-out')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options?.onZoomOut) {
        this.options.onZoomOut();
      } else {
        EventBus.getInstance().emit('camera:zoom_out');
      }
    });

    this.element.querySelector('#btn-zoom-in')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options?.onZoomIn) {
        this.options.onZoomIn();
      } else {
        EventBus.getInstance().emit('camera:zoom_in');
      }
    });

    this.element.querySelector('#btn-zoom-reset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options?.onReset) {
        this.options.onReset();
      } else {
        EventBus.getInstance().emit('camera:zoom_reset');
      }
    });

    this.element.querySelector('#btn-zoom-fit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options?.onFit) {
        this.options.onFit();
      } else if (this.options?.onReset) {
        this.options.onReset();
      } else {
        EventBus.getInstance().emit('camera:zoom_fit');
      }
    });
  }
}
