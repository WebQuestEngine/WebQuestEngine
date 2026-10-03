import { ProjectData, AudioConfig, UIConfig } from '../types';
import { EventBus, EngineEventMap } from '../core/EventBus';
import { AudioSystem } from '../systems/AudioSystem';
import { DialogSystem } from '../systems/DialogSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';
import { UISystem } from '../systems/UISystem';
import { SaveSystem } from '../systems/SaveSystem';

export class RuntimeContext {
  private static activeContext: RuntimeContext | null = null;

  public static getActive(): RuntimeContext | null {
    return RuntimeContext.activeContext;
  }

  public static setActive(ctx: RuntimeContext | null): void {
    RuntimeContext.activeContext = ctx;
  }

  public eventBus: EventBus<EngineEventMap>;
  public audio: AudioSystem;
  public dialog: DialogSystem;
  public inventory: InventorySystem;
  public story: StoryGraphSystem;
  public ui: UISystem;
  public save: SaveSystem;
  public project: ProjectData;

  constructor(project: ProjectData, uiContainerElement: HTMLElement) {
    RuntimeContext.setActive(this);
    this.project = project;
    this.eventBus = new EventBus<EngineEventMap>();
    EventBus.setActiveBusGetter(() => this.eventBus);

    this.audio = new AudioSystem(this.eventBus);
    if (project.audioConfig) {
      this.audio.setConfig(project.audioConfig);
    }
    this.audio.setPlayMode(true);

    this.dialog = new DialogSystem(this.eventBus);
    this.inventory = new InventorySystem(this.eventBus);
    this.story = new StoryGraphSystem(this.eventBus);
    this.ui = new UISystem(this.eventBus);
    this.save = new SaveSystem(project, this.eventBus);

    // Initialize systems with project data
    this.story.loadProject(project);

    this.inventory.clear();
    if (project.items) {
      for (const item of project.items) {
        this.inventory.registerItem(item);
      }
    }

    if (project.dialogs) {
      for (const tree of project.dialogs) {
        this.dialog.registerDialog(tree);
      }
    }

    // Set active singleton proxies for play mode
    StoryGraphSystem.setInstance(this.story);
    InventorySystem.setInstance(this.inventory);
    DialogSystem.setInstance(this.dialog);
    UISystem.setInstance(this.ui);
    AudioSystem.setInstance(this.audio);
    SaveSystem.setInstance(this.save);

    // Initialize UI system in DOM container & setup menu
    this.ui.init(uiContainerElement, project.uiConfig);
    this.ui.setMenuProject(project);
  }

  public destroy(): void {
    if (RuntimeContext.getActive() === this) {
      RuntimeContext.setActive(null);
      EventBus.setActiveBusGetter(null);
    }
    this.audio.destroy();
    this.dialog.endDialog();
    this.inventory.clear();
    this.ui.destroy();
    this.eventBus.clear();

    StoryGraphSystem.setInstance(null);
    InventorySystem.setInstance(null);
    DialogSystem.setInstance(null);
    UISystem.setInstance(null);
    AudioSystem.setInstance(null);
    SaveSystem.setInstance(null);
  }
}
