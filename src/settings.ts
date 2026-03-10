import { App, Notice, PluginSettingTab, Setting } from "obsidian";

// ---------------------------------------------------------------------------
// Types & defaults
// ---------------------------------------------------------------------------

export type DividerStyle = "solid" | "dashed" | "dotted" | "transparent";

export interface StyleSettings {
  themeAware: boolean;
  dividerColor: string;
  dividerThickness: number; // px
  dividerOpacity: number; // 0..1
  dividerStyle: DividerStyle;

  blockBgColor: string;
  blockTextColor: string;
  titleTextColor: string;
  alternatingShading: boolean;
  showBorders: boolean;
  borderRadius: number; // px
  borderThickness: number; // px
  transparentBackground: boolean;

  blockPadding: number; // px
  blockGap: number; // px
  showToolbar: boolean;

  dividerHoverColor: string;
  dragActiveShadow: string; // color for inner shadow during drag
}

export const DEFAULT_STYLE_SETTINGS: StyleSettings = {
  themeAware: true,
  dividerColor: "#6aa9ff",
  dividerThickness: 2,
  dividerOpacity: 1,
  dividerStyle: "solid",

  blockBgColor: "#2b2b2b",
  blockTextColor: "#e0e0e0",
  titleTextColor: "#7aa2ff",
  alternatingShading: false,
  showBorders: false,
  borderRadius: 4,
  borderThickness: 2,
  transparentBackground: false,

  blockPadding: 12,
  blockGap: 0,
  showToolbar: false,

  dividerHoverColor: "#8bbdff",
  dragActiveShadow: "rgba(0,0,0,0.08)",
};

// ---------------------------------------------------------------------------
// Minimal plugin interface — avoids a circular import back to main.ts
// ---------------------------------------------------------------------------

export interface IHorizontalBlocksPlugin {
  app: App;
  settings: Record<string, any>;
  style: StyleSettings;
  saveData(data: Record<string, any>): Promise<void>;
  saveStyle(): Promise<void>;
  applyStylingVariables(): void;
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

export class HBlockStylingSettingTab extends PluginSettingTab {
  plugin: IHorizontalBlocksPlugin;

  constructor(app: App, plugin: IHorizontalBlocksPlugin) {
    super(app, plugin as any);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Horizontal Blocks – Styling" });

    // ── Support ───────────────────────────────────────────────────────────────
    const supportSetting = new Setting(containerEl).setName("Support");
    const bmcLink = supportSetting.controlEl.createEl("a", {
      href: "https://www.buymeacoffee.com/iCodeAlchemy",
    });
    bmcLink.setAttr("target", "_blank");
    bmcLink.setAttr("rel", "noopener noreferrer");
    const bmcImg = bmcLink.createEl("img");
    bmcImg.setAttr(
      "src",
      "https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png",
    );
    bmcImg.setAttr("alt", "Buy Me A Coffee");
    bmcImg.setAttr("height", "40");

    // ── General ──────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "General" });
    new Setting(containerEl)
      .setName("Show release notes on update")
      .setDesc("Display a What's New popup each time the plugin is updated.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showReleaseNotes !== false)
          .onChange(async (v) => {
            this.plugin.settings.showReleaseNotes = v;
            await this.plugin.saveData(this.plugin.settings);
          }),
      );

    // ── Theme ─────────────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Theme-aware colors")
      .setDesc(
        "Use theme colors instead of custom picks. Disabling this option will enable color selection in below sections.",
      )
      .addToggle((t) =>
        t.setValue(this.plugin.style.themeAware).onChange(async (v) => {
          this.plugin.style.themeAware = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
          this.display();
        }),
      );

    // ── Divider ───────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Divider" });
    new Setting(containerEl)
      .setName("Color")
      .setDesc("Resizer divider color")
      .addColorPicker((p) =>
        p
          .setValue(this.plugin.style.dividerColor)
          .onChange(async (v) => {
            this.plugin.style.dividerColor = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          })
          .setDisabled(this.plugin.style.themeAware),
      );
    new Setting(containerEl)
      .setName("Thickness")
      .setDesc("Divider thickness (px)")
      .addSlider((s) =>
        s
          .setLimits(1, 5, 1)
          .setValue(this.plugin.style.dividerThickness)
          .onChange(async (v) => {
            this.plugin.style.dividerThickness = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          }),
      );
    new Setting(containerEl)
      .setName("Opacity")
      .setDesc("Divider opacity")
      .addSlider((s) =>
        s
          .setLimits(0, 100, 5)
          .setValue(Math.round(this.plugin.style.dividerOpacity * 100))
          .onChange(async (v) => {
            this.plugin.style.dividerOpacity = v / 100;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          }),
      );
    new Setting(containerEl)
      .setName("Style")
      .setDesc("Divider line style")
      .addDropdown((d) =>
        d
          .addOptions({
            solid: "Solid",
            dashed: "Dashed",
            dotted: "Dotted",
            transparent: "Transparent",
          })
          .setValue(this.plugin.style.dividerStyle)
          .onChange(async (v) => {
            this.plugin.style.dividerStyle = v as DividerStyle;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          }),
      );

    // ── Blocks ────────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Blocks" });
    new Setting(containerEl)
      .setName("Background color")
      .setDesc("Default background for blocks")
      .addColorPicker((p) =>
        p
          .setValue(this.plugin.style.blockBgColor)
          .onChange(async (v) => {
            this.plugin.style.blockBgColor = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          })
          .setDisabled(this.plugin.style.themeAware),
      );
    new Setting(containerEl)
      .setName("Text color")
      .setDesc("Default text color for blocks")
      .addColorPicker((p) =>
        p
          .setValue(this.plugin.style.blockTextColor)
          .onChange(async (v) => {
            this.plugin.style.blockTextColor = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          })
          .setDisabled(this.plugin.style.themeAware),
      );
    new Setting(containerEl)
      .setName("Title text color")
      .setDesc("Default color for block titles")
      .addColorPicker((p) =>
        p
          .setValue(this.plugin.style.titleTextColor)
          .onChange(async (v) => {
            this.plugin.style.titleTextColor = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          })
          .setDisabled(this.plugin.style.themeAware),
      );
    new Setting(containerEl)
      .setName("Alternating shading")
      .setDesc("Zebra-style subtle alternating backgrounds")
      .addToggle((t) =>
        t.setValue(this.plugin.style.alternatingShading).onChange(async (v) => {
          this.plugin.style.alternatingShading = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
        }),
      );
    new Setting(containerEl).setName("Show borders").addToggle((t) =>
      t.setValue(this.plugin.style.showBorders).onChange(async (v) => {
        this.plugin.style.showBorders = v;
        await this.plugin.saveStyle();
        this.plugin.applyStylingVariables();
      }),
    );
    new Setting(containerEl).setName("Border radius").addSlider((s) =>
      s
        .setLimits(0, 24, 1)
        .setValue(this.plugin.style.borderRadius)
        .onChange(async (v) => {
          this.plugin.style.borderRadius = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
        }),
    );
    new Setting(containerEl).setName("Border thickness").addSlider((s) =>
      s
        .setLimits(0, 8, 1)
        .setValue(this.plugin.style.borderThickness)
        .onChange(async (v) => {
          this.plugin.style.borderThickness = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
        }),
    );
    new Setting(containerEl)
      .setName("Transparent background")
      .setDesc("Make block backgrounds transparent")
      .addToggle((t) =>
        t
          .setValue(this.plugin.style.transparentBackground)
          .onChange(async (v) => {
            this.plugin.style.transparentBackground = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          }),
      );

    // ── Spacing & Density ─────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Spacing & Density" });
    new Setting(containerEl)
      .setName("Inner padding")
      .setDesc("Padding inside each block (px)")
      .addSlider((s) =>
        s
          .setLimits(0, 32, 1)
          .setValue(this.plugin.style.blockPadding)
          .onChange(async (v) => {
            this.plugin.style.blockPadding = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          }),
      );
    new Setting(containerEl).setName("Gap between blocks").addSlider((s) =>
      s
        .setLimits(0, 24, 1)
        .setValue(this.plugin.style.blockGap)
        .onChange(async (v) => {
          this.plugin.style.blockGap = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
        }),
    );
    new Setting(containerEl)
      .setName("Toolbar visibility")
      .setDesc("Hide/show toolbar region (if present)")
      .addToggle((t) =>
        t.setValue(this.plugin.style.showToolbar).onChange(async (v) => {
          this.plugin.style.showToolbar = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
        }),
      );

    // ── Preview Style Accents ─────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Preview Style Accents" });
    new Setting(containerEl)
      .setName("Divider hover accent")
      .addColorPicker((p) =>
        p
          .setValue(this.plugin.style.dividerHoverColor)
          .onChange(async (v) => {
            this.plugin.style.dividerHoverColor = v;
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
          })
          .setDisabled(this.plugin.style.themeAware),
      );
    new Setting(containerEl)
      .setName("Drag active highlight")
      .setDesc("Inner shadow color during resizing")
      .addColorPicker((p) =>
        p.setValue(this.plugin.style.dragActiveShadow).onChange(async (v) => {
          this.plugin.style.dragActiveShadow = v;
          await this.plugin.saveStyle();
          this.plugin.applyStylingVariables();
        }),
      );

    // ── Reset ─────────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Reset" });
    new Setting(containerEl)
      .setName("Reset styling to defaults")
      .setDesc("Restores all styling options to their default values.")
      .addButton((btn) =>
        btn
          .setButtonText("Reset to defaults")
          .setWarning()
          .onClick(async () => {
            const confirmed = confirm(
              "Reset divider and block styling to defaults (keeps widths)?",
            );
            if (!confirmed) return;

            // 1) Reset global style settings
            this.plugin.style = { ...DEFAULT_STYLE_SETTINGS };

            // 2) Remove per-block style overrides (bg/fg) but keep widths
            for (const key of Object.keys(this.plugin.settings)) {
              if (!key.startsWith("horizontal-block-layout-")) continue;
              const layout = this.plugin.settings[key];
              if (layout && typeof layout === "object") {
                for (const prop of Object.keys(layout)) {
                  if (prop.startsWith("bg-") || prop.startsWith("fg-")) {
                    delete layout[prop];
                  }
                }
              }
            }

            // Persist and reapply
            await this.plugin.saveStyle();
            this.plugin.applyStylingVariables();
            new Notice("Horizontal Blocks styling reset (widths preserved).");
            this.display();
          }),
      );
  }
}
