import { App, MarkdownRenderer, Modal } from "obsidian";
import { isVersionNewerThanOther } from "../utils";
import { FIRST_RUN, RELEASE_NOTES } from "./Messages";

/**
 * Minimal interface for the plugin instance needed by the modal.
 * Avoids a circular import back to main.ts while keeping type safety.
 */
export interface IHorizontalBlocksPlugin {
  app: App;
  settings: Record<string, any>;
  saveData(data: Record<string, any>): Promise<void>;
}

/**
 * ReleaseNotes modal — displayed once per version upgrade.
 *
 * Mirrors the Excalidraw plugin pattern:
 *  - `version` is always the current version string (never null).
 *  - `isFirstRun` controls whether to show the welcome message or the
 *    version-filtered changelog. Keeping version and content-selection
 *    separate ensures onClose() always saves previousRelease, preventing
 *    the popup from re-appearing on every Obsidian launch after a fresh install.
 *  - Filters RELEASE_NOTES to only show entries newer than previousRelease,
 *    catching up across multi-version upgrades.
 *  - Uses Obsidian's native MarkdownRenderer so content renders with full
 *    Obsidian markdown — headers, code blocks, links, inline HTML.
 *  - Saves previousRelease in onClose(), not on open, so a force-quit before
 *    dismissal causes the modal to re-appear on next launch.
 */
export class ReleaseNotes extends Modal {
  private plugin: IHorizontalBlocksPlugin;
  private version: string;
  private isFirstRun: boolean;

  constructor(app: App, plugin: IHorizontalBlocksPlugin, version: string, isFirstRun = false) {
    super(app);
    this.plugin = plugin;
    this.version = version;
    this.isFirstRun = isFirstRun;
  }

  onOpen(): void {
    const { containerEl, contentEl } = this as any;
    containerEl.classList.add("hblocks-release");
    (this as any).titleEl?.setText(
      `🧱 Horizontal Blocks ${this.isFirstRun ? "— Welcome!" : `v${this.version}`}`
    );
    this.createForm(contentEl);
  }

  async createForm(contentEl: HTMLElement): Promise<void> {
    let prevRelease = (this.plugin.settings.previousRelease as string) ?? "0.0.0";

    // If opening the same version that was last recorded, reset prevRelease so
    // all notes show (guards against accidental double-opens).
    if (this.version === prevRelease) prevRelease = "0.0.0";

    const message = this.isFirstRun
      ? FIRST_RUN
      : Object.keys(RELEASE_NOTES)
          .filter(
            (key) => key === "Intro" || isVersionNewerThanOther(key, prevRelease)
          )
          .map(
            (key) =>
              `${key === "Intro" ? "" : `# ${key}\n`}${RELEASE_NOTES[key]}`
          )
          .slice(0, 10)
          .join("\n\n---\n");

    await MarkdownRenderer.render(this.app, message, contentEl, "", this.plugin as any);

    // Close button — right-aligned, matching Excalidraw's pattern.
    contentEl.createEl("p", { text: "" }, (el: HTMLElement) => {
      el.style.textAlign = "right";
      const btn = el.createEl("button", { text: "Got it, let's go! 🚀" });
      btn.onclick = () => this.close();
    });
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
    // Always persist previousRelease on close — version is never null now,
    // so first-run installs are correctly stamped and won't loop.
    if (this.plugin.settings.previousRelease !== this.version) {
      this.plugin.settings.previousRelease = this.version;
      await this.plugin.saveData(this.plugin.settings);
    }
  }
}
