import { StudioHostMessage, StudioIframeMessage, SpineDocument } from './types';

export class RigStudioBridge {
  private isEmbedded: boolean;
  private onInitCallback: ((data: { characterName: string; textureUrl?: string; spineData?: SpineDocument | null; availableTextures?: string[] }) => void) | null = null;
  private onSaveRequestedCallback: (() => void) | null = null;

  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    this.isEmbedded = urlParams.get('mode') === 'embedded' || (window.parent !== window && window.parent !== null);

    window.addEventListener('message', this.handleMessage.bind(this));
  }

  public get isEmbeddedMode(): boolean {
    return this.isEmbedded;
  }

  public onInit(cb: (data: { characterName: string; textureUrl?: string; spineData?: SpineDocument | null; availableTextures?: string[] }) => void): void {
    this.onInitCallback = cb;
  }

  public onSaveRequested(cb: () => void): void {
    this.onSaveRequestedCallback = cb;
  }

  public notifyReady(): void {
    if (this.isEmbedded) {
      this.sendToHost({ type: 'STUDIO_READY' });
    }
  }

  public notifySave(spineData: SpineDocument, textureUrl?: string): void {
    if (this.isEmbedded) {
      this.sendToHost({
        type: 'STUDIO_SAVE',
        payload: { spineData, textureUrl }
      });
    }
  }

  public notifyDirty(isDirty: boolean): void {
    if (this.isEmbedded) {
      this.sendToHost({
        type: 'STUDIO_DIRTY_STATE',
        payload: { isDirty }
      });
    }
  }

  public notifyClose(): void {
    if (this.isEmbedded) {
      this.sendToHost({ type: 'STUDIO_CLOSE' });
    }
  }

  private sendToHost(msg: StudioIframeMessage): void {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data as StudioHostMessage;
    if (!data || !data.type) return;

    if (data.type === 'STUDIO_INIT') {
      if (this.onInitCallback) {
        this.onInitCallback(data.payload);
      }
    } else if (data.type === 'STUDIO_REQUEST_SAVE') {
      if (this.onSaveRequestedCallback) {
        this.onSaveRequestedCallback();
      }
    }
  }
}
