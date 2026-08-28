import { Application, Graphics, Container, FederatedPointerEvent } from 'pixi.js';
import { ProjectData, SceneData, Vector2D, VerbType, HotspotAction, DialogNode } from '../types';
import { Camera } from '../core/Camera';
import { Scene } from '../scene/Scene';
import { Character } from '../scene/Character';
import { Hotspot } from '../scene/Hotspot';
import { RuntimeContext } from './RuntimeContext';
import { EventBus } from '../core/EventBus';

export class GameRuntime {
  public app: Application;
  public camera: Camera;
  public context: RuntimeContext;
  public currentScene: Scene | null = null;
  public containerElement: HTMLElement;
  private isDestroyed = false;

  private viewportMask: Graphics;
  private dialogOverlayEl: HTMLElement | null = null;

  constructor(containerElement: HTMLElement, project: ProjectData) {
    this.containerElement = containerElement;
    this.context = new RuntimeContext(project, containerElement);
    this.camera = new Camera(containerElement.clientWidth || 1280, containerElement.clientHeight || 720);

    this.app = new Application();
    this.viewportMask = new Graphics();
  }

  public async init(): Promise<void> {
    await this.app.init({
      width: this.containerElement.clientWidth || 1280,
      height: this.containerElement.clientHeight || 720,
      backgroundColor: 0x000000,
      resizeTo: this.containerElement,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    this.app.canvas.style.display = 'block';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.containerElement.appendChild(this.app.canvas);

    this.setupEventHandlers();
    this.setupInputListeners();

    // Start game loop
    this.app.ticker.add((ticker) => {
      if (!this.isDestroyed) {
        this.update(ticker.deltaTime / 60);
      }
    });

    // Load initial scene
    const initialSceneData = this.context.story.getCurrentScene();
    if (initialSceneData) {
      await this.loadScene(initialSceneData);
    }
  }

  private isLoadingScene = false;
  private currentHoverTarget: Hotspot | Character | null = null;
  private targetActionIndex = 0;
  private lastMouseWorldPos: Vector2D | null = null;
  private unsubscribers: (() => void)[] = [];

  private setupEventHandlers(): void {
    // Scene change
    this.unsubscribers.push(
      EventBus.getInstance().on('scene:change', async (payload: any) => {
        if (this.isDestroyed) return;
        const sceneData = payload.scene || payload;
        await this.loadScene(sceneData, payload.spawnPoint);
      })
    );

    // Inventory give & flag set
    this.unsubscribers.push(
      EventBus.getInstance().on('inventory:give', (itemId: string) => {
        if (this.isDestroyed) return;
        this.context.inventory.addItem(itemId);
      })
    );

    this.unsubscribers.push(
      EventBus.getInstance().on('inventory:take', (itemId: string) => {
        if (this.isDestroyed) return;
        this.context.inventory.removeItem(itemId);
      })
    );

    this.unsubscribers.push(
      EventBus.getInstance().on('flag:set', (flag: string) => {
        if (this.isDestroyed) return;
        this.context.story.setFlag(flag, true);
      })
    );

    this.unsubscribers.push(
      EventBus.getInstance().on('flag:clear', (flag: string) => {
        if (this.isDestroyed) return;
        this.context.story.setFlag(flag, false);
      })
    );

    this.unsubscribers.push(
      EventBus.getInstance().on('dialog:speaker_anim', (data: { speaker: string; animation?: string; gesture?: string }) => {
        if (this.isDestroyed || !this.currentScene) return;
        const speakerChar = this.getCharacterByNameOrId(data.speaker);
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

    this.unsubscribers.push(
      EventBus.getInstance().on('dialog:directive', (directive: any) => {
        if (this.isDestroyed || !this.currentScene) return;
        this.executeStageDirective(directive);
      })
    );

    // Cinematic action execution (Video, Screen FX, Camera, Delay, Audio)
    this.unsubscribers.push(
      EventBus.getInstance().on('dialog:action', (payload: { node: any; onComplete: () => void }) => {
        if (this.isDestroyed) {
          payload?.onComplete?.();
          return;
        }
        this.executeCinematicAction(payload.node, payload.onComplete);
      })
    );

    // Dialogue presentation
    this.unsubscribers.push(
      EventBus.getInstance().on('dialog:node', (data: any) => {
        if (this.isDestroyed) return;
        this.renderDialogOverlay(data);
      })
    );

    this.unsubscribers.push(
      EventBus.getInstance().on('dialog:end', () => {
        if (this.isDestroyed) return;
        if (this.dialogOverlayEl) {
          this.dialogOverlayEl.remove();
          this.dialogOverlayEl = null;
        }
        if (this.containerElement) {
          this.containerElement.querySelectorAll('.dialog-box-overlay').forEach(el => el.remove());
          this.containerElement.querySelectorAll('.character-emote-bubble').forEach(el => el.remove());
        }
      })
    );
  }

  private setupInputListeners(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener('click', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasClick(e);
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.isDestroyed) return;
      this.handleCanvasRightClick(e);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasMouseMove(e);
    });

    canvas.addEventListener('wheel', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasWheel(e);
    }, { passive: false });

    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    canvas.addEventListener('drop', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasDrop(e);
    });
  }

  public async loadScene(sceneData: SceneData, spawnPoint?: Vector2D): Promise<void> {
    if (this.isLoadingScene) return;
    this.isLoadingScene = true;

    try {
      if (this.currentScene) {
        if (this.viewportMask && this.viewportMask.parent) {
          this.viewportMask.parent.removeChild(this.viewportMask);
        }
        this.app.stage.removeChild(this.currentScene.container);
        this.currentScene.destroy();
        this.currentScene = null;
      }

      // Deselect held item when switching scenes
      this.context.inventory.selectItem(null);
      this.context.ui.setActiveVerb('walk');

      this.currentScene = new Scene(sceneData);
      await this.currentScene.init(this.camera);

      // Position player
      if (spawnPoint && this.currentScene.playerCharacter) {
        this.currentScene.playerCharacter.container.x = spawnPoint.x;
        this.currentScene.playerCharacter.container.y = spawnPoint.y;
      }

      if (this.currentScene.playerCharacter) {
        this.camera.follow(this.currentScene.playerCharacter.container);
      }

      if (!this.viewportMask || (this.viewportMask as any).destroyed || (this.viewportMask as any).context === null) {
        this.viewportMask = new Graphics();
      }

      this.app.stage.addChild(this.currentScene.container);
      this.currentScene.container.addChild(this.viewportMask);

      // Play scene BGM
      if (sceneData.backgroundMusicUrl) {
        this.context.audio.playMusic(sceneData.backgroundMusicUrl);
      } else {
        this.context.audio.stopMusic(500);
      }

      // Refresh inventory UI on scene load
      this.context.ui.renderInventoryItems(this.context.inventory.getItems());

      // Trigger Scene Events (First Enter and Enter)
      const visitedFlag = `scene_visited_${sceneData.id}`;
      const isFirstEnter = !this.context.story.getFlag(visitedFlag);
      if (isFirstEnter) {
        this.context.story.setFlag(visitedFlag, true);
        this.checkAndTriggerEvent('scene', sceneData.id, 'first_enter');
      }
      this.checkAndTriggerEvent('scene', sceneData.id, 'enter');
    } finally {
      this.isLoadingScene = false;
    }
  }

  private registerSceneDialogs(_sceneData: SceneData): void {
    this.context.dialog.clear();
    if (!this.context.project || !this.context.project.dialogs) return;

    for (const tree of this.context.project.dialogs) {
      this.context.dialog.registerDialog(tree);
    }
  }

  public update(delta: number): void {
    if (this.isDestroyed || !this.currentScene || this.isLoadingScene) return;

    this.camera.viewport = {
      width: this.containerElement.clientWidth || window.innerWidth,
      height: this.containerElement.clientHeight || window.innerHeight
    };
    this.camera.update();
    this.currentScene.update(delta, this.camera);

    const vp = this.context.project.viewportSettings || { width: 1920, height: 1080, x: 0, y: 0 };
    const vpW = vp.width || 1920;
    const vpH = vp.height || 1080;
    const vpX = vp.x ?? 0;
    const vpY = vp.y ?? 0;

    // Hard-clip to Viewport Rectangle & Stretch/Fit Screen Window
    if (!this.viewportMask || (this.viewportMask as any).destroyed || (this.viewportMask as any).context === null) {
      this.viewportMask = new Graphics();
      this.currentScene.container.addChild(this.viewportMask);
    }
    this.viewportMask.visible = true;
    this.viewportMask.clear();
    this.viewportMask.rect(vpX, vpY, vpW, vpH);
    this.viewportMask.fill({ color: 0xffffff });
    this.currentScene.container.mask = this.viewportMask;

    const viewW = this.camera.viewport.width;
    const viewH = this.camera.viewport.height;

    const scaleX = viewW / vpW;
    const scaleY = viewH / vpH;
    const playScale = Math.min(scaleX, scaleY);

    const offsetX = (viewW - vpW * playScale) / 2;
    const offsetY = (viewH - vpH * playScale) / 2;

    this.currentScene.container.scale.set(playScale, playScale);
    this.currentScene.container.pivot.set(vpX, vpY);
    this.currentScene.container.x = offsetX;
    this.currentScene.container.y = offsetY;
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (this.isDestroyed || !this.currentScene || this.context.dialog.isActive()) return;
    const worldPoint = this.getWorldPoint(e);

    const activeVerb = this.context.ui.activeVerb;
    const selectedItem = this.context.inventory.getSelectedItem();
    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.currentScene.findCharacterAt(worldPoint);
    const player = this.currentScene.playerCharacter;
    const walkPath = this.currentScene.getWalkPath();
    const preset = this.context.project.uiConfig.preset;

    // 1. If an item is held -> Use item on Hotspot or NPC
    if (selectedItem && (hotspot || charNPC)) {
      const targetHotspot = hotspot || (charNPC ? this.currentScene.findHotspotAt({ x: charNPC.container.x, y: charNPC.container.y - 40 }) : null);
      if (targetHotspot) {
        const action = targetHotspot.getActionForItemId(selectedItem.id) || targetHotspot.getBestAction('use', selectedItem.id);
        const targetCenter = targetHotspot.getCenter();
        if (action) {
          if (player) {
            player.walkTo(targetCenter, walkPath, () => this.executeAction(action, targetCenter));
          } else {
            this.executeAction(action, targetCenter);
          }
        } else {
          if (player) {
            player.walkTo(targetCenter, walkPath, () => {
              EventBus.getInstance().emit('ui:notify', `Using ${selectedItem.name} on ${targetHotspot.data.name} has no effect.`);
            });
          }
        }
      } else if (charNPC) {
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            EventBus.getInstance().emit('ui:notify', `Giving ${selectedItem.name} to ${charNPC.data.name} has no effect.`);
          });
        }
      }
      this.context.inventory.selectItem(null);
      this.context.ui.setActiveVerb('walk');
      return;
    }

    // 2. Context Coin Menu Trigger
    if (!selectedItem && (hotspot || charNPC) && preset === 'context_coin') {
      const rect = this.app.canvas.getBoundingClientRect();
      this.context.ui.showContextCoin(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }

    this.context.ui.hideContextCoin();

    // 3. NPC Interaction with Walk-to-Actor
    if (charNPC && charNPC !== player) {
      const available = this.getAvailableActionsForTarget(charNPC);
      const chosen = available[this.targetActionIndex % available.length] || available[0];

      let action: HotspotAction | undefined;
      if (chosen.itemId) {
        action = charNPC.getActionForItemId(chosen.itemId);
      } else {
        action = charNPC.getBestAction(chosen.verb);
      }

      if (!action) {
        action = charNPC.getBestAction();
      }

      if (action) {
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            const triggered = this.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
                              this.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
            if (triggered) return;
            this.executeAction(action, charNPC.position);
          });
        } else {
          const triggered = this.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
                            this.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
          if (triggered) return;
          this.executeAction(action, charNPC.position);
        }
        return;
      }
      if (charNPC.data.actions && charNPC.data.actions[0]?.dialogId) {
        const dialogId = charNPC.data.actions[0].dialogId;
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            const triggered = this.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
                              this.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
            if (triggered) return;
            if (this.currentScene?.playerCharacter?.data.name) {
              this.context.dialog.setPlayerName(this.currentScene.playerCharacter.data.name);
            }
            this.context.dialog.startDialog(dialogId, (flag) => this.context.story.getFlag(flag));
          });
        } else {
          const triggered = this.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
                            this.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
          if (triggered) return;
          if (this.currentScene?.playerCharacter?.data.name) {
            this.context.dialog.setPlayerName(this.currentScene.playerCharacter.data.name);
          }
          this.context.dialog.startDialog(dialogId, (flag) => this.context.story.getFlag(flag));
        }
        return;
      }
      if (player) {
        player.walkTo(charNPC.position, walkPath, () => {
          const triggered = this.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
                            this.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
          if (triggered) return;
          if (chosen.verb === 'talk') this.context.ui.showSubtitle("They don't have much to say.");
          else if (chosen.verb === 'look') this.context.ui.showSubtitle(`It's ${charNPC.data.name}.`);
          else this.context.ui.showSubtitle("That doesn't seem to work.");
        });
      }
      return;
    }

    // 4. Hotspot Interaction with Walk-to-Object
    if (hotspot) {
      const available = this.getAvailableActionsForTarget(hotspot);
      const chosen = available[this.targetActionIndex % available.length] || available[0];

      let action: HotspotAction | undefined;
      if (chosen.itemId) {
        action = hotspot.getActionForItemId(chosen.itemId);
      } else {
        action = hotspot.getBestAction(chosen.verb);
      }

      if (!action) {
        action = hotspot.getBestAction();
      }

      if (action?.verb === 'look' || chosen.verb === 'look') {
        hotspot.isExamined = true;
        hotspot.data.examined = true;
      }

      const targetCenter = hotspot.getCenter();
      if (action) {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            const triggered = this.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
                              this.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
            if (triggered) return;
            this.executeAction(action, targetCenter);
          });
        } else {
          const triggered = this.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
                            this.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
          if (triggered) return;
          this.executeAction(action, targetCenter);
        }
      } else {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            const triggered = this.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
                              this.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
            if (triggered) return;
            if (chosen.verb === 'talk') this.context.ui.showSubtitle("It doesn't talk.");
            else if (chosen.verb === 'look') this.context.ui.showSubtitle(`It's ${hotspot.data.name}.`);
            else this.context.ui.showSubtitle("That doesn't seem to work.");
          });
        } else {
          const triggered = this.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
                            this.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
          if (triggered) return;
          if (chosen.verb === 'talk') this.context.ui.showSubtitle("It doesn't talk.");
          else if (chosen.verb === 'look') this.context.ui.showSubtitle(`It's ${hotspot.data.name}.`);
          else this.context.ui.showSubtitle("That doesn't seem to work.");
        }
      }
      return;
    }

    // 5. Empty ground click -> Walk
    if (player) {
      player.walkTo(worldPoint, walkPath);
    }
  }

  private getAvailableActionsForTarget(target: Hotspot | Character): { verb: VerbType; itemId?: string; label: string; action?: HotspotAction }[] {
    const list: { verb: VerbType; itemId?: string; label: string; action?: HotspotAction }[] = [];
    const storySystem = this.context.story;
    const inventory = this.context.inventory;
    const heldItems = inventory.getItems();
    const seenKeys = new Set<string>();

    if (target.data.actions && target.data.actions.length > 0) {
      for (const act of target.data.actions) {
        // Check flag requirements
        if (act.requiredFlag && !storySystem.getFlag(act.requiredFlag)) continue;
        if (act.notFlag && storySystem.getFlag(act.notFlag)) continue;

        if (act.requireItemId) {
          // Only available if player currently possesses this item
          const hasItem = heldItems.some(i => i.id === act.requireItemId);
          if (hasItem) {
            const item = heldItems.find(i => i.id === act.requireItemId)!;
            const key = `item:${item.id}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              list.push({
                verb: 'use',
                itemId: item.id,
                label: `Use ${item.name} on`,
                action: act
              });
            }
          }
        } else {
          const actVerb = (act.verb === 'use' ? 'interact' : act.verb) as VerbType;
          if (!seenKeys.has(actVerb)) {
            seenKeys.add(actVerb);
            const verbLabels: Record<string, string> = {
              walk: 'Walk to',
              look: 'Look at',
              interact: 'Use',
              talk: 'Talk to',
              pick_up: 'Pick up'
            };
            list.push({
              verb: actVerb,
              label: verbLabels[actVerb] || actVerb,
              action: act
            });
          }
        }
      }
    }

    // Fallback if no specific actions matched
    if (list.length === 0) {
      const fallbackVerb = (target.data.cursor as VerbType) || (target instanceof Character ? 'talk' : 'interact');
      list.push({
        verb: fallbackVerb,
        label: fallbackVerb === 'talk' ? 'Talk to' : (fallbackVerb === 'look' ? 'Look at' : 'Use')
      });
    }

    return list;
  }

  private handleCanvasRightClick(e: MouseEvent): void {
    if (this.isDestroyed || !this.currentScene) return;

    const selectedItem = this.context.inventory.getSelectedItem();

    // 1. Right-click with held item or manual tool selection -> reset to walk / default
    if (selectedItem || this.targetActionIndex !== 0) {
      this.context.inventory.selectItem(null);
      this.targetActionIndex = 0;
      this.context.ui.setActiveVerb('walk');
      this.updateCursorAndHover(this.lastMouseWorldPos);
      return;
    }

    const worldPoint = this.getWorldPoint(e);
    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.currentScene.findCharacterAt(worldPoint);

    // 2. Right-click in Context Coin mode -> Open coin
    if ((hotspot || charNPC) && this.context.project.uiConfig.preset === 'context_coin') {
      const rect = this.app.canvas.getBoundingClientRect();
      this.context.ui.showContextCoin(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }

    // 3. Right-click on Hotspot / NPC -> Trigger Look At
    if (hotspot || charNPC) {
      const available = this.getAvailableActionsForTarget(hotspot || charNPC!);
      const lookIdx = available.findIndex(a => a.verb === 'look');
      if (lookIdx !== -1) {
        this.targetActionIndex = lookIdx;
      }
      this.handleCanvasClick(e);
    }
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (this.isDestroyed || !this.currentScene) return;
    const worldPt = this.getWorldPoint(e);
    this.lastMouseWorldPos = worldPt;

    const hotspot = this.currentScene.findHotspotAt(worldPt);
    const charNPC = this.currentScene.findCharacterAt(worldPt);
    const targetElem = hotspot || charNPC || null;

    if (targetElem !== this.currentHoverTarget) {
      this.currentHoverTarget = targetElem;
      this.targetActionIndex = 0;
    }

    this.updateCursorAndHover(worldPt);
  }

  private updateCursorAndHover(worldPt: Vector2D | null): void {
    if (this.isDestroyed || !this.currentScene) return;
    const pt = worldPt || { x: 0, y: 0 };

    const hotspot = this.currentScene.findHotspotAt(pt);
    const charNPC = this.currentScene.findCharacterAt(pt);
    const targetElem = hotspot || charNPC;
    const selectedItem = this.context.inventory.getSelectedItem();
    const uiConfig = this.context.project.uiConfig;

    if (selectedItem) {
      this.app.canvas.style.cursor = 'none';
      this.context.ui.updateCustomCursor(selectedItem.iconUrl, 16, 16);
      if (targetElem) {
        this.context.ui.updateHoverTitle(`Use ${selectedItem.name} on ${targetElem.data.name}`);
      } else {
        this.context.ui.clearHoverTitle();
      }
      return;
    }

    if (!targetElem) {
      // Outside any object: default to Walk
      this.context.ui.setActiveVerb('walk');
      const walkCursor = uiConfig?.customCursors?.['walk'];
      if (walkCursor?.url) {
        this.app.canvas.style.cursor = 'none';
        this.context.ui.updateCustomCursor(walkCursor.url, walkCursor.hotspotX ?? 0, walkCursor.hotspotY ?? 0);
      } else {
        this.context.ui.updateCustomCursor(null);
        this.app.canvas.style.cursor = 'default';
      }
      this.context.ui.clearHoverTitle();
      return;
    }

    // Over an object: resolve currently selected available action
    const available = this.getAvailableActionsForTarget(targetElem);
    const chosen = available[this.targetActionIndex % available.length] || available[0];

    this.context.ui.setActiveVerb(chosen.verb);

    // Custom cursor follower
    if (chosen.itemId) {
      const item = this.context.inventory.getItems().find(i => i.id === chosen.itemId);
      this.app.canvas.style.cursor = 'none';
      this.context.ui.updateCustomCursor(item?.iconUrl || null, 16, 16);
    } else if ((targetElem.data as any).customCursorUrl) {
      this.app.canvas.style.cursor = 'none';
      this.context.ui.updateCustomCursor(
        (targetElem.data as any).customCursorUrl,
        (targetElem.data as any).customCursorHotspotX ?? 0,
        (targetElem.data as any).customCursorHotspotY ?? 0
      );
    } else if (uiConfig?.customCursors?.[chosen.verb]?.url) {
      const cConfig = uiConfig.customCursors[chosen.verb]!;
      this.app.canvas.style.cursor = 'none';
      this.context.ui.updateCustomCursor(cConfig.url, cConfig.hotspotX ?? 0, cConfig.hotspotY ?? 0);
    } else {
      this.context.ui.updateCustomCursor(null);
      this.app.canvas.style.cursor = 'pointer';
    }

    // Contextual hover label
    const label = `${chosen.label} ${targetElem.data.name}`;
    this.context.ui.updateHoverTitle(label);
  }

  private handleCanvasDrop(e: DragEvent): void {
    e.preventDefault();
    if (this.isDestroyed || !this.currentScene) return;
    const itemId = e.dataTransfer?.getData('text/plain') || this.context.inventory.getSelectedItem()?.id;
    if (!itemId) return;

    const worldPoint = this.getWorldPoint(e as any);
    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.currentScene.findCharacterAt(worldPoint);
    const player = this.currentScene.playerCharacter;
    const walkPath = this.currentScene.getWalkPath();
    const itemData = this.context.inventory.getItems().find(i => i.id === itemId);

    if (hotspot) {
      const action = hotspot.getActionForItemId(itemId) || hotspot.getBestAction('use', itemId);
      const targetCenter = hotspot.getCenter();
      if (action) {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => this.executeAction(action, targetCenter));
        } else {
          this.executeAction(action, targetCenter);
        }
      } else {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            EventBus.getInstance().emit('ui:notify', `Using ${itemData?.name || itemId} on ${hotspot.data.name} has no effect.`);
          });
        }
      }
    } else if (charNPC) {
      if (player) {
        player.walkTo(charNPC.position, walkPath, () => {
          EventBus.getInstance().emit('ui:notify', `Giving ${itemData?.name || itemId} to ${charNPC.data.name} has no effect.`);
        });
      }
    }

    this.context.inventory.selectItem(null);
    this.targetActionIndex = 0;
    this.context.ui.setActiveVerb('walk');
  }

  private handleCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.isDestroyed || !this.currentScene) return;

    const worldPt = this.lastMouseWorldPos || { x: 0, y: 0 };
    const hotspot = this.currentScene.findHotspotAt(worldPt);
    const charNPC = this.currentScene.findCharacterAt(worldPt);
    const targetElem = hotspot || charNPC;

    if (targetElem) {
      // Over an object: cycle ONLY through available actions defined on this target
      const available = this.getAvailableActionsForTarget(targetElem);
      if (available.length > 1) {
        const step = e.deltaY > 0 ? 1 : -1;
        this.targetActionIndex = (this.targetActionIndex + step + available.length) % available.length;
      }
    } else {
      // Outside any object: cycle through held inventory items or return to Walk
      const items = this.context.inventory.getItems();
      if (items.length > 0) {
        const itemIds: (string | null)[] = [null, ...items.map(i => i.id)];
        const currentSelected = this.context.inventory.getSelectedItem()?.id || null;
        const currentIdx = itemIds.indexOf(currentSelected);
        const step = e.deltaY > 0 ? 1 : -1;
        const nextIdx = (currentIdx + step + itemIds.length) % itemIds.length;
        const nextId = itemIds[nextIdx];
        this.context.inventory.selectItem(nextId);
        this.context.ui.setActiveVerb(nextId ? 'use' : 'walk');
      }
    }

    this.updateCursorAndHover(this.lastMouseWorldPos);
  }

  public executeAction(action: any, targetPos?: Vector2D, targetElement?: any): void {
    if (action.requiredFlag && !this.context.story.getFlag(action.requiredFlag)) {
      EventBus.getInstance().emit('ui:notify', 'You cannot do that right now.');
      return;
    }
    if (action.notFlag && this.context.story.getFlag(action.notFlag)) {
      EventBus.getInstance().emit('ui:notify', 'You cannot do that right now.');
      return;
    }

    // 1. Emit universal action event
    EventBus.getInstance().emit('action:executed', { action, targetPos, targetElement });

    // 2. Custom event trigger if specified
    if (action.eventName) {
      console.log(`%c[GameRuntime] ⚡ Firing custom event: "${action.eventName}"`, 'color: #f59e0b; font-weight: bold;');
      EventBus.getInstance().emit(action.eventName, {
        action,
        payload: action.eventPayload,
        targetPos,
        sceneId: this.currentScene?.data.id
      });
    }

    // 3. Audio SFX trigger
    if (action.sfxUrl) {
      this.context.audio.playSFX(action.sfxUrl);
    } else if (action.giveItemId) {
      this.context.audio.playSFX(null, 'pickup');
    } else if (action.targetSceneId) {
      this.context.audio.playSFX(null, 'door');
    }

    // 4. Character orientation & animation triggers
    const player = this.currentScene?.playerCharacter;
    if (player) {
      if (targetPos) {
        player.faceTarget(targetPos);
      }
      if (action.faceDirection) {
        player.direction8Way = action.faceDirection;
        player.isFacingLeft = ['left', 'up_left', 'down_left'].includes(action.faceDirection);
      }
    }

    // Animation Event Trigger
    if (action.playAnimation) {
      if (action.animationTarget === 'self' && targetElement && typeof targetElement.playCustomAnimation === 'function') {
        targetElement.playCustomAnimation(action.playAnimation);
      } else if (action.animationTarget && action.animationTarget !== 'player' && this.currentScene?.characters.has(action.animationTarget)) {
        this.currentScene.characters.get(action.animationTarget)?.playCustomAnimation(action.playAnimation);
      } else if (player) {
        player.playCustomAnimation(action.playAnimation);
      }
      EventBus.getInstance().emit('animation:started', {
        animation: action.playAnimation,
        target: action.animationTarget || 'player'
      });
    } else if (player) {
      if (action.verb === 'pick_up') {
        player.playCustomAnimation('pick_up', 1200);
      } else if (action.verb === 'talk') {
        player.talk();
      } else if (action.verb === 'use' && action.requireItemId) {
        player.holdItem(action.requireItemId);
      }
    }

    // 5. Speech Event
    if (action.text) {
      EventBus.getInstance().emit('ui:notify', action.text);
      this.context.ui.showSubtitle(action.text);
    }

    // 6. Story Flag Events
    if (action.setFlag) {
      this.context.story.setFlag(action.setFlag, true);
    }
    if (action.setFlags && Array.isArray(action.setFlags)) {
      action.setFlags.forEach((f: string) => this.context.story.setFlag(f, true));
    }
    if (action.clearFlag) {
      this.context.story.setFlag(action.clearFlag, false);
    }
    if (action.clearFlags && Array.isArray(action.clearFlags)) {
      action.clearFlags.forEach((f: string) => this.context.story.setFlag(f, false));
    }

    // 7. Inventory Event
    if (action.giveItemId) {
      this.context.inventory.addItem(action.giveItemId);
    }
    if (action.giveItems && Array.isArray(action.giveItems)) {
      action.giveItems.forEach((it: string) => this.context.inventory.addItem(it));
    }
    if (action.takeItems && Array.isArray(action.takeItems)) {
      action.takeItems.forEach((it: string) => this.context.inventory.removeItem(it));
    }

    // 8. Dialog Event
    if (action.dialogId) {
      console.log(`%c[GameRuntime] 💬 Action triggering dialog: "${action.dialogId}"`, 'color: #8b5cf6; font-weight: bold;');
      if (this.currentScene?.playerCharacter?.data.name) {
        this.context.dialog.setPlayerName(this.currentScene.playerCharacter.data.name);
      }
      this.context.dialog.startDialog(action.dialogId, (flag) => this.context.story.getFlag(flag));
    }

    // 9. Scene Transition Event
    if (action.targetSceneId) {
      this.context.story.changeScene(action.targetSceneId, action.targetSpawnPoint);
    }
  }

  public getCharacterByNameOrId(nameOrId?: string): Character | null {
    if (!this.currentScene) return null;
    const playerChar = this.currentScene.playerCharacter;
    const playerName = playerChar?.data.name.toLowerCase();
    if (!nameOrId || nameOrId === 'player' || nameOrId === 'hero' || (playerName && nameOrId.toLowerCase() === playerName)) {
      return playerChar;
    }
    const chars = Array.from(this.currentScene.characters.values());
    return chars.find(c =>
      c.data.id === nameOrId ||
      c.data.name.toLowerCase() === nameOrId.toLowerCase()
    ) || null;
  }

  private executeStageDirective(directive: any): void {
    if (!this.currentScene) return;

    if (directive.type === 'animation') {
      const actor = this.getCharacterByNameOrId(directive.actorId);
      if (actor && directive.animationName) {
        actor.playCustomAnimation(directive.animationName, directive.loopAnimation ? undefined : 1500);
      }
    } else if (directive.type === 'emote') {
      const actor = this.getCharacterByNameOrId(directive.actorId);
      if (actor && directive.emoteText) {
        this.showEmoteBubble(actor, directive.emoteText);
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
        actor.walkTo(directive.targetPosition, this.currentScene.walkPaths[0]);
      }
    } else if (directive.type === 'choreography_group') {
      const allGroups = [
        ...(this.currentScene.data.choreographyGroups || []),
        ...(this.context.project.choreographyGroups || [])
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
        this.camera.zoom = directive.cameraZoom;
      } else if (directive.cameraAction === 'shake') {
        this.camera.shake(0.5, 8);
      } else if (directive.cameraAction === 'reset') {
        this.camera.zoom = 1;
      }
    }
  }

  private showEmoteBubble(actor: Character, text: string): void {
    if (!this.containerElement) return;
    const screenPos = this.camera.worldToScreen(actor.position.x, actor.position.y - 120);
    const bubble = document.createElement('div');
    bubble.className = 'character-emote-bubble';
    bubble.style.cssText = `
      position: absolute;
      left: ${screenPos.x}px;
      top: ${screenPos.y}px;
      transform: translate(-50%, -100%);
      background: rgba(15, 23, 42, 0.92);
      border: 2px solid var(--accent-gold, #f59e0b);
      color: #fff;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 14px;
      font-size: 0.8rem;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      animation: emotePop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    bubble.innerHTML = text;
    this.containerElement.appendChild(bubble);
    setTimeout(() => {
      bubble.style.transition = 'opacity 0.3s, transform 0.3s';
      bubble.style.opacity = '0';
      bubble.style.transform = 'translate(-50%, -120%)';
      setTimeout(() => bubble.remove(), 350);
    }, 2400);
  }

  public getCharacterScreenPos(speakerName?: string): Vector2D | null {
    if (!this.currentScene) return null;

    const chars = Array.from(this.currentScene.characters.values());
    let targetChar = null;
    if (speakerName) {
      targetChar = chars.find(c =>
        c.data.name.toLowerCase() === speakerName.toLowerCase() ||
        c.data.id.toLowerCase() === speakerName.toLowerCase()
      );
    }

    if (!targetChar && this.currentScene.playerCharacter) {
      targetChar = this.currentScene.playerCharacter;
    }

    if (!targetChar) return null;

    const worldX = targetChar.container.x || targetChar.position.x;
    const worldY = (targetChar.container.y || targetChar.position.y) - 145;

    const vp = this.context.project.viewportSettings || { width: 1920, height: 1080, x: 0, y: 0 };
    const vpW = vp.width || 1920;
    const vpH = vp.height || 1080;
    const vpX = vp.x ?? 0;
    const vpY = vp.y ?? 0;

    const viewW = this.camera.viewport.width;
    const viewH = this.camera.viewport.height;

    const scaleX = viewW / vpW;
    const scaleY = viewH / vpH;
    const playScale = Math.min(scaleX, scaleY);

    const offsetX = (viewW - vpW * playScale) / 2;
    const offsetY = (viewH - vpH * playScale) / 2;

    return {
      x: Math.round(offsetX + (worldX - vpX) * playScale),
      y: Math.round(offsetY + (worldY - vpY) * playScale)
    };
  }

  private renderDialogOverlay(data: any): void {
    if (this.isDestroyed || !this.containerElement) return;

    if (this.dialogOverlayEl) {
      this.dialogOverlayEl.remove();
      this.dialogOverlayEl = null;
    }
    // Remove any orphaned dialog overlays in container
    this.containerElement.querySelectorAll('.dialog-box-overlay').forEach(el => el.remove());

    const screenPos = this.getCharacterScreenPos(data.speaker);
    const overlay = document.createElement('div');
    overlay.className = `dialog-box-overlay ${screenPos ? 'in-world-bubble' : ''}`;

    if (screenPos) {
      const viewW = this.camera.viewport.width || window.innerWidth;
      const viewH = this.camera.viewport.height || window.innerHeight;
      const clampedX = Math.max(180, Math.min(viewW - 180, screenPos.x));
      const clampedY = Math.max(140, Math.min(viewH - 40, screenPos.y));
      overlay.style.left = `${clampedX}px`;
      overlay.style.top = `${clampedY}px`;
      overlay.style.transform = 'translate(-50%, -100%)';
      overlay.style.bottom = 'auto';
    }

    overlay.innerHTML = `
      ${data.portraitUrl ? `<img src="${data.portraitUrl}" class="dialog-portrait" onError="this.style.display='none'" />` : ''}
      <div class="dialog-content">
        <div class="dialog-speaker">${data.speaker}</div>
        <div class="dialog-text">${data.text}</div>
        ${data.choices && data.choices.length > 0 ? `
          <div class="dialog-choices">
            ${data.choices.map((c: any) => `
              <button class="dialog-choice-btn" data-choiceid="${c.id}">${c.text}</button>
            `).join('')}
          </div>
        ` : (data.hasNext ? `<button class="btn btn-gold" id="btn-dlg-next" style="margin-top:8px;">Continue ➔</button>` : `<button class="btn btn-primary" id="btn-dlg-end" style="margin-top:8px;">Close</button>`)}
      </div>
    `;

    overlay.querySelectorAll('.dialog-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.choiceid!;
        this.context.dialog.selectChoice(id, (flag) => this.context.story.getFlag(flag));
      });
    });

    overlay.querySelector('#btn-dlg-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.context.dialog.advanceNextNode((flag) => this.context.story.getFlag(flag));
    });

    overlay.querySelector('#btn-dlg-end')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.context.dialog.endDialog();
    });

    this.dialogOverlayEl = overlay;
    this.containerElement.appendChild(overlay);
  }

  public getWorldPoint(e: MouseEvent): Vector2D {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const vp = this.context.project.viewportSettings || { width: 1920, height: 1080, x: 0, y: 0 };
    const vpW = vp.width || 1920;
    const vpH = vp.height || 1080;
    const vpX = vp.x ?? 0;
    const vpY = vp.y ?? 0;

    const viewW = this.camera.viewport.width;
    const viewH = this.camera.viewport.height;

    const scaleX = viewW / vpW;
    const scaleY = viewH / vpH;
    const playScale = Math.min(scaleX, scaleY);

    const offsetX = (viewW - vpW * playScale) / 2;
    const offsetY = (viewH - vpH * playScale) / 2;

    return {
      x: Math.round(vpX + (screenX - offsetX) / playScale),
      y: Math.round(vpY + (screenY - offsetY) / playScale)
    };
  }

  public checkAndTriggerEvent(scope: 'game' | 'scene' | 'hotspot' | 'character' | 'item', targetId: string, eventName: string): boolean {
    if (!this.context.project?.dialogs || this.context.dialog.isActive()) return false;

    for (const tree of this.context.project.dialogs) {
      for (const node of Object.values(tree.nodes)) {
        if (node.nodeType === 'event_listener') {
          const matchScope = node.eventScope === scope;
          const matchTarget = !node.eventTargetId || node.eventTargetId === targetId || (scope === 'game' && targetId === 'game');
          const matchEvent = node.eventName === eventName || node.eventName === 'interact';

          if (matchScope && matchTarget && matchEvent) {
            console.log(`%c[GameRuntime] ⚡ Event Trigger Matched: [${scope}:${targetId}:${eventName}] -> Sequence "${tree.id}", Node "${node.id}"`, 'color: #f59e0b; font-weight: bold;');
            if (this.currentScene?.playerCharacter?.data.name) {
              this.context.dialog.setPlayerName(this.currentScene.playerCharacter.data.name);
            }
            this.context.dialog.startDialog(tree.id, (flag) => this.context.story.getFlag(flag), node.nextNodeId || node.id);
            return true;
          }
        }
      }
    }
    return false;
  }

  private executeCinematicAction(node: DialogNode, onComplete: () => void): void {
    const category = node.actionCategory || 'screen_effect';

    if (category === 'video' && node.videoUrl) {
      if (!this.containerElement) {
        onComplete();
        return;
      }

      const videoOverlay = document.createElement('div');
      videoOverlay.className = 'cinematic-video-overlay';
      videoOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: #000000;
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;

      const videoEl = document.createElement('video');
      videoEl.src = node.videoUrl;
      videoEl.autoplay = true;
      videoEl.controls = false;
      videoEl.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; width: 100%; height: 100%;';

      let isFinished = false;
      const finish = () => {
        if (isFinished) return;
        isFinished = true;
        videoOverlay.remove();
        onComplete();
      };

      if (node.videoSkippable !== false) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn btn-gold';
        skipBtn.innerText = 'Skip ⏭️';
        skipBtn.style.cssText = `
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 9001;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid var(--accent-gold);
          color: var(--accent-gold);
          font-weight: 700;
          font-size: 0.85rem;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
        `;
        skipBtn.onclick = finish;
        videoOverlay.appendChild(skipBtn);
      }

      videoEl.onended = finish;
      videoEl.onerror = () => {
        console.warn(`[GameRuntime] ⚠️ Video cutscene failed to load: ${node.videoUrl}`);
        finish();
      };

      videoOverlay.appendChild(videoEl);
      this.containerElement.appendChild(videoOverlay);
      videoEl.play().catch(() => {
        finish();
      });
      return;
    }

    if (category === 'screen_effect') {
      const effect = node.screenEffectType || 'fade_in';
      const duration = node.screenEffectDuration ?? 1.0;
      const color = node.screenEffectColor || '#000000';

      if (effect === 'shake') {
        this.camera.shake(duration, 12);
        setTimeout(onComplete, duration * 1000);
        return;
      }

      if (!this.containerElement) {
        onComplete();
        return;
      }

      const fxOverlay = document.createElement('div');
      fxOverlay.className = 'screen-fx-overlay';
      fxOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: ${color};
        z-index: 8999;
        pointer-events: none;
        transition: opacity ${duration}s ease;
      `;

      if (effect === 'fade_out') {
        fxOverlay.style.opacity = '0';
        this.containerElement.appendChild(fxOverlay);
        requestAnimationFrame(() => {
          fxOverlay.style.opacity = '1';
        });
        setTimeout(onComplete, duration * 1000);
      } else if (effect === 'fade_in') {
        fxOverlay.style.opacity = '1';
        this.containerElement.appendChild(fxOverlay);
        requestAnimationFrame(() => {
          fxOverlay.style.opacity = '0';
        });
        setTimeout(() => {
          fxOverlay.remove();
          onComplete();
        }, duration * 1000);
      } else if (effect === 'flash') {
        fxOverlay.style.background = '#ffffff';
        fxOverlay.style.opacity = '1';
        this.containerElement.appendChild(fxOverlay);
        setTimeout(() => {
          fxOverlay.style.opacity = '0';
          setTimeout(() => {
            fxOverlay.remove();
            onComplete();
          }, 300);
        }, 150);
      } else if (effect === 'tint') {
        fxOverlay.style.opacity = '0.4';
        this.containerElement.appendChild(fxOverlay);
        setTimeout(onComplete, duration * 1000);
      } else {
        onComplete();
      }
      return;
    }

    if (category === 'camera') {
      const action = node.cameraAction || 'reset';
      const duration = node.cameraDuration ?? 0.5;

      if (action === 'zoom') {
        this.camera.zoom = node.cameraZoom ?? 1.5;
      } else if (action === 'shake') {
        this.camera.shake(duration, 10);
      } else if (action === 'pan' && node.targetPosition) {
        this.camera.panOffset = { x: node.targetPosition.x, y: node.targetPosition.y };
      } else if (action === 'follow' && node.targetActorId) {
        const actor = this.getCharacterByNameOrId(node.targetActorId);
        if (actor) this.camera.follow(actor.container);
      } else if (action === 'reset') {
        this.camera.resetZoom();
      }

      setTimeout(onComplete, duration * 1000);
      return;
    }

    if (category === 'audio') {
      const audioAction = node.audioAction || 'play_sfx';
      if (audioAction === 'play_bgm' && node.audioUrl) {
        this.context.audio.playMusic(node.audioUrl);
      } else if (audioAction === 'stop_bgm') {
        this.context.audio.stopMusic(500);
      } else if (audioAction === 'play_sfx' && node.audioUrl) {
        this.context.audio.playSFX(node.audioUrl);
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
      this.context.story.changeScene(node.targetSceneId, node.targetSpawnPoint);
      onComplete();
      return;
    }

    // Default fallback
    onComplete();
  }

  public destroy(): void {
    this.isDestroyed = true;

    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    if (this.dialogOverlayEl) {
      this.dialogOverlayEl.remove();
      this.dialogOverlayEl = null;
    }

    if (this.containerElement) {
      this.containerElement.querySelectorAll('.dialog-box-overlay').forEach(el => el.remove());
    }

    this.context.destroy();

    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }

    this.app.destroy(true, { children: true, texture: false });
  }
}
