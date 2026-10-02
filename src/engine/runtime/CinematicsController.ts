import { EventBus } from '../core/EventBus';
import { Camera } from '../core/Camera';
import { Scene } from '../scene/Scene';
import { Character } from '../scene/Character';
import { DialogNode, StageDirective } from '../types';
import { RuntimeContext } from './RuntimeContext';
import { DOMOverlayRenderer } from './DOMOverlayRenderer';

export interface CinematicsHost {
  readonly isDestroyed: boolean;
  readonly currentScene: Scene | null;
  readonly camera: Camera;
  readonly context: RuntimeContext;
  clearPendingSceneStart?(): void;
}

export class CinematicsController {
  private host: CinematicsHost;
  private domRenderer: DOMOverlayRenderer;
  private unsubscribers: (() => void)[] = [];

  constructor(host: CinematicsHost, domRenderer: DOMOverlayRenderer) {
    this.host = host;
    this.domRenderer = domRenderer;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const bus = EventBus.getInstance();

    this.unsubscribers.push(
      bus.on('dialog:directive', (directive: any) => {
        if (this.host.isDestroyed || !this.host.currentScene) return;
        this.executeStageDirective(directive);
      })
    );

    this.unsubscribers.push(
      bus.on('dialog:action', (payload: { node: any; onComplete: () => void }) => {
        if (this.host.isDestroyed) {
          payload?.onComplete?.();
          return;
        }
        this.executeCinematicAction(payload.node, payload.onComplete);
      })
    );
  }

  public getCharacterByNameOrId(nameOrId?: string): Character | null {
    if (!this.host.currentScene) return null;
    const playerChar = this.host.currentScene.playerCharacter;
    const playerName = playerChar?.data.name.toLowerCase();
    if (!nameOrId || nameOrId === 'player' || nameOrId === 'hero' || (playerName && nameOrId.toLowerCase() === playerName)) {
      return playerChar;
    }
    const chars = Array.from(this.host.currentScene.characters.values());
    return chars.find(c =>
      c.data.id === nameOrId ||
      c.data.name.toLowerCase() === nameOrId.toLowerCase()
    ) || null;
  }

  public executeStageDirective(directive: StageDirective | any): void {
    if (!this.host.currentScene) return;

    if (directive.type === 'animation') {
      const actor = this.getCharacterByNameOrId(directive.actorId);
      if (actor && directive.animationName) {
        actor.playCustomAnimation(directive.animationName, directive.loopAnimation ? undefined : 1500);
      }
    } else if (directive.type === 'emote') {
      const actor = this.getCharacterByNameOrId(directive.actorId);
      if (actor && directive.emoteText) {
        const screenPos = this.host.camera.worldToScreen(actor.position.x, actor.position.y - 120);
        this.domRenderer.showEmoteBubble(screenPos, directive.emoteText);
      }
    } else if (directive.type === 'look_at') {
      const actor = this.getCharacterByNameOrId(directive.actorId);
      if (actor) {
        if (directive.targetActorId) {
          const target = this.getCharacterByNameOrId(directive.targetActorId);
          if (target) actor.faceTarget(target.position);
        } else if (directive.targetPosition) {
          actor.faceTarget(directive.targetPosition);
        }
      }
    } else if (directive.type === 'walk_to') {
      const actor = this.getCharacterByNameOrId(directive.actorId);
      if (actor && directive.targetPosition) {
        const ignoreWalkPath = directive.ignoreWalkPath === true;
        const walkPathToUse = ignoreWalkPath ? undefined : this.host.currentScene.getWalkPath();
        actor.walkTo(directive.targetPosition, walkPathToUse);
      }
    } else if (directive.type === 'choreography_group') {
      const allGroups = [
        ...(this.host.currentScene.data.choreographyGroups || []),
        ...(this.host.context.project.choreographyGroups || [])
      ];
      const group = allGroups.find(g => g.id === directive.choreographyGroupId);
      if (group) {
        group.entries.forEach((entry: any) => {
          const runEntry = () => {
            const actor = this.getCharacterByNameOrId(entry.actorId);
            if (actor) {
              if (entry.animationName) actor.playCustomAnimation(entry.animationName, entry.loop ? undefined : 1500);
              if (entry.faceTargetId) {
                const target = this.getCharacterByNameOrId(entry.faceTargetId);
                if (target) actor.faceTarget(target.position);
              }
            }
          };
          if (entry.delaySeconds && entry.delaySeconds > 0) {
            setTimeout(runEntry, entry.delaySeconds * 1000);
          } else {
            runEntry();
          }
        });
      }
    } else if (directive.type === 'camera') {
      if (directive.cameraAction === 'zoom' && directive.cameraZoom) {
        this.host.camera.zoom = directive.cameraZoom;
      } else if (directive.cameraAction === 'shake') {
        this.host.camera.shake(0.5, 8);
      } else if (directive.cameraAction === 'reset') {
        this.host.camera.zoom = 1;
      }
    }
  }

  public executeCinematicAction(node: DialogNode, onComplete: () => void): void {
    const category = node.actionCategory || 'screen_effect';

    if (category === 'video' && node.videoUrl) {
      // Stop any background music so the video cutscene has exclusive audio focus
      this.host.context.audio.stopMusic(0);
      this.domRenderer.showVideoOverlay(
        node.videoUrl,
        node.videoSkippable !== false,
        onComplete
      );
      return;
    }

    if (category === 'character') {
      const actorId = node.actorId || node.targetActorId;
      const actor = this.getCharacterByNameOrId(actorId) || this.host.currentScene?.playerCharacter;
      if (!actor) {
        console.warn(`[CinematicsController] ⚠️ Character Action: Actor "${actorId}" not found in scene.`);
        onComplete();
        return;
      }

      const actionType = node.characterAction || 'walk_to';

      if (actionType === 'teleport' && node.targetPosition) {
        actor.container.x = node.targetPosition.x;
        actor.container.y = node.targetPosition.y;
        if (actor.data) {
          actor.data.position = { x: node.targetPosition.x, y: node.targetPosition.y };
        }
        actor.freezeFrame(this.host.currentScene?.getWalkPath());
        onComplete();
        return;
      }

      if (actionType === 'look_at') {
        if (node.targetPosition) {
          actor.faceTarget(node.targetPosition);
        } else if (node.targetActorId) {
          const other = this.getCharacterByNameOrId(node.targetActorId);
          if (other) actor.faceTarget(other.position);
        }
        onComplete();
        return;
      }

      if (actionType === 'animation' && node.speakerAnimation) {
        actor.playCustomAnimation(node.speakerAnimation, 1500, onComplete);
        return;
      }

      if (actionType === 'walk_to' && node.targetPosition) {
        const ignoreWalkPath = node.ignoreWalkPath !== false;
        const walkPathToUse = ignoreWalkPath ? undefined : this.host.currentScene?.getWalkPath();

        actor.walkTo(node.targetPosition, walkPathToUse, () => {
          onComplete();
        });
        return;
      }

      onComplete();
      return;
    }

    if (category === 'screen_effect') {
      const effect = node.screenEffectType || 'fade_in';
      const duration = node.screenEffectDuration ?? 1.0;
      const color = node.screenEffectColor || '#000000';

      if (effect === 'shake') {
        this.host.camera.shake(duration, 12);
        setTimeout(onComplete, duration * 1000);
        return;
      }

      this.domRenderer.showScreenEffect(effect, duration, color, onComplete);
      return;
    }

    if (category === 'camera') {
      const action = node.cameraAction || 'reset';
      const duration = node.cameraDuration ?? 0.5;

      if (action === 'zoom') {
        this.host.camera.zoom = node.cameraZoom ?? 1.5;
      } else if (action === 'shake') {
        this.host.camera.shake(duration, 10);
      } else if (action === 'pan' && node.targetPosition) {
        this.host.camera.panOffset = { x: node.targetPosition.x, y: node.targetPosition.y };
      } else if (action === 'follow' && node.targetActorId) {
        const actor = this.getCharacterByNameOrId(node.targetActorId);
        if (actor) this.host.camera.follow(actor.container);
      } else if (action === 'reset') {
        this.host.camera.resetZoom();
      }

      setTimeout(onComplete, duration * 1000);
      return;
    }

    if (category === 'audio') {
      const audioAction = node.audioAction || 'play_sfx';
      if (audioAction === 'play_bgm' && node.audioUrl) {
        this.host.context.audio.playMusic(node.audioUrl);
      } else if (audioAction === 'stop_bgm') {
        this.host.context.audio.stopMusic(500);
      } else if (audioAction === 'play_sfx' && node.audioUrl) {
        this.host.context.audio.playSFX(node.audioUrl);
      }
      onComplete();
      return;
    }

    if (category === 'delay') {
      const delaySec = node.waitDurationSeconds ?? 1.0;
      setTimeout(onComplete, delaySec * 1000);
      return;
    }

    if (category === 'scene_change' && node.targetSceneId) {
      if (this.host.clearPendingSceneStart) {
        this.host.clearPendingSceneStart();
      }
      this.host.context.story.changeScene(node.targetSceneId, node.targetSpawnPoint);
      onComplete();
      return;
    }

    // Default fallback
    onComplete();
  }

  public destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
