import { EventBus } from '../core/EventBus';
import { Camera } from '../core/Camera';
import { Scene } from '../scene/Scene';
import { Character } from '../scene/Character';
import { RuntimeContext } from './RuntimeContext';
import { DOMOverlayRenderer } from './DOMOverlayRenderer';
import { LetterboxManager } from './LetterboxManager';

export interface DialogHost {
  readonly isDestroyed: boolean;
  readonly currentScene: Scene | null;
  readonly camera: Camera;
  readonly context: RuntimeContext;
  getCharacterByNameOrId(nameOrId?: string): Character | null;
  onDialogEnded(): void;
}

export class DialogController {
  private host: DialogHost;
  private domRenderer: DOMOverlayRenderer;
  private letterboxManager: LetterboxManager;
  private unsubscribers: (() => void)[] = [];

  constructor(
    host: DialogHost,
    domRenderer: DOMOverlayRenderer,
    letterboxManager: LetterboxManager
  ) {
    this.host = host;
    this.domRenderer = domRenderer;
    this.letterboxManager = letterboxManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const bus = EventBus.getInstance();

    // Speaker animation trigger
    this.unsubscribers.push(
      bus.on('dialog:speaker_anim', (data: { speaker: string; animation?: string; gesture?: string }) => {
        if (this.host.isDestroyed || !this.host.currentScene) return;
        const speakerChar = this.host.getCharacterByNameOrId(data.speaker);
        if (speakerChar) {
          if (data.animation) {
            speakerChar.playCustomAnimation(data.animation);
          } else {
            speakerChar.talk();
          }
          if (data.gesture) {
            speakerChar.playCustomAnimation(data.gesture, 1200);
          }
        }
      })
    );

    // Dialog presentation overlay
    this.unsubscribers.push(
      bus.on('dialog:node', (data: any) => {
        if (this.host.isDestroyed) return;
        this.renderNode(data);
      })
    );

    // Dialog ended
    this.unsubscribers.push(
      bus.on('dialog:end', () => {
        if (this.host.isDestroyed) return;
        this.domRenderer.clearDialogOverlay();
        this.domRenderer.clearEmoteBubbles();
        this.host.onDialogEnded();
      })
    );
  }

  public renderNode(data: any): void {
    const screenPos = this.letterboxManager.getCharacterScreenPos(
      this.host.currentScene,
      this.host.camera.viewport,
      this.host.context.project.viewportSettings,
      data.speaker
    );

    this.domRenderer.renderDialogOverlay(
      data,
      screenPos,
      this.host.camera.viewport,
      {
        onChoice: (choiceId: string) => {
          this.host.context.dialog.selectChoice(choiceId, (flag) => this.host.context.story.getFlag(flag));
        },
        onNext: () => {
          this.host.context.dialog.advanceNextNode((flag) => this.host.context.story.getFlag(flag));
        },
        onEnd: () => {
          this.host.context.dialog.endDialog();
        }
      }
    );
  }

  public startDialog(dialogId: string, startNodeId?: string): void {
    if (this.host.currentScene?.playerCharacter?.data?.name) {
      this.host.context.dialog.setPlayerName(this.host.currentScene.playerCharacter.data.name);
    }
    this.host.context.dialog.startDialog(
      dialogId,
      (flag) => this.host.context.story.getFlag(flag),
      startNodeId
    );
  }

  public destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.domRenderer.clearDialogOverlay();
  }
}
