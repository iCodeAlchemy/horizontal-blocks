import {
  Plugin,
  MarkdownRenderer,
  MarkdownRenderChild,
  MarkdownView,
  WorkspaceLeaf,
  Editor,
  TFile,
  debounce,
} from "obsidian";

class EditableEmbedChild extends MarkdownRenderChild {
  private plugin: HorizontalBlocksPlugin;
  private manager: EditableEmbedManager;
  private sourcePath: string;
  private rawLink: string;
  private leaf: WorkspaceLeaf | null = null;
  private view: MarkdownView | null = null;
  private file: TFile | null = null;
  private section: string | null = null;
  private isProgrammaticUpdate = false;
  private isSaving = false;
  private originalHeader = "";
  private headerLevel = 0;
  private lastCorrectedLineNumber = -1;
  private debouncedSectionSave: (() => void) | null = null;

  constructor(
    containerEl: HTMLElement,
    plugin: HorizontalBlocksPlugin,
    manager: EditableEmbedManager,
    sourcePath: string,
    rawLink: string
  ) {
    super(containerEl);
    this.plugin = plugin;
    this.manager = manager;
    this.sourcePath = sourcePath;
    this.rawLink = rawLink;
  }

  async onload() {
    this.containerEl.empty();
    this.containerEl.classList.add("horizontal-blocks-embed");

    const targetInfo = this.resolveLink(this.rawLink);
    if (!targetInfo) {
      this.renderError("Unable to resolve embed target.");
      return;
    }

    if (targetInfo.section && targetInfo.section.startsWith("^")) {
      this.renderError("Block reference embeds are not supported yet.");
      return;
    }

    const { file, section } = targetInfo;
    if (!file) {
      this.renderError("Embedded note not found.");
      return;
    }

    if (file.path === this.sourcePath && !section) {
      this.renderError("Cannot embed the current note within itself.");
      return;
    }

    this.file = file;
    this.section = section;

    try {
      const LeafConstructor =
        WorkspaceLeaf as unknown as { new (...args: any[]): WorkspaceLeaf };
      this.leaf =
        LeafConstructor.length === 0
          ? new LeafConstructor()
          : new LeafConstructor(this.plugin.app);
      await this.leaf.openFile(file, { state: { mode: "source" } });

      const view = this.leaf.view;
      if (!(view instanceof MarkdownView)) {
        this.renderError("Failed to render embed as markdown.");
        await this.teardownLeaf();
        return;
      }

      this.view = view;
      const editor = view.editor;

      if (section) {
        const success = await this.setupSectionSync(view, file, section);
        if (!success) {
          await this.teardownLeaf();
          return;
        }
      }

      view.containerEl.classList.add("horizontal-blocks-embed-view-container");
      this.containerEl.appendChild(view.containerEl);
      this.manager.registerEmbed(this);

      // Focus manager relies on containerEl reference
      view.containerEl.setAttribute(
        "data-hblock-embed-target",
        section ?? file.path
      );
    } catch (error) {
      console.error("Horizontal Blocks: failed to load embed", error);
      this.renderError("Error loading embedded note.");
      await this.teardownLeaf();
    }
  }

  async onunload() {
    this.manager.unregisterEmbed(this);
    if (
      this.debouncedSectionSave &&
      (this.debouncedSectionSave as any).cancel
    ) {
      (this.debouncedSectionSave as any).cancel();
    }
    await this.teardownLeaf();
  }

  getEditor(): Editor | null {
    return this.view?.editor ?? null;
  }

  getView(): MarkdownView | null {
    return this.view;
  }

  getFile(): TFile | null {
    return this.file;
  }

  getSection(): string | null {
    return this.section;
  }

  private resolveLink(
    rawLink: string
  ): { file: TFile | null; section: string | null } | null {
    const [linkPath] = rawLink.split("|");
    if (!linkPath) return null;

    const sectionIndex = linkPath.indexOf("#");
    const hasSection = sectionIndex >= 0;
    const notePath = hasSection ? linkPath.slice(0, sectionIndex) : linkPath;
    const section =
      hasSection && linkPath.slice(sectionIndex + 1).length > 0
        ? linkPath.slice(sectionIndex + 1)
        : null;

    const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
      notePath || this.sourcePath,
      this.sourcePath
    );

    if (targetFile && targetFile.extension !== "md") {
      return { file: null, section: null };
    }

    return {
      file: targetFile,
      section,
    };
  }

  private async setupSectionSync(
    view: MarkdownView,
    file: TFile,
    section: string
  ): Promise<boolean> {
    const editor = view.editor;

    const loadSection = async () => {
      this.isProgrammaticUpdate = true;
      const fileContent = await this.plugin.app.vault.read(file);
      const sectionContent = this.extractSection(fileContent, section);
      this.updateHeaderState(sectionContent);
      const cursor = editor.getCursor();
      editor.setValue(sectionContent);
      if (
        editor.lineCount() > cursor.line &&
        editor.getLine(cursor.line)?.length >= cursor.ch
      ) {
        editor.setCursor(cursor);
      }
      window.setTimeout(() => (this.isProgrammaticUpdate = false), 50);
    };

    await loadSection();
    (view as any).file = null;

    const debouncedSave = debounce(
      async () => {
        if (this.isSaving) return;
        this.isSaving = true;
        const newSectionContent = editor.getValue();
        const currentFileContent = await this.plugin.app.vault.read(file);
        const updatedFileContent = this.replaceSection(
          currentFileContent,
          section,
          newSectionContent
        );
        if (updatedFileContent !== currentFileContent) {
          await this.plugin.app.vault.modify(file, updatedFileContent);
        }
        this.isSaving = false;
      },
      750,
      true
    );

    this.debouncedSectionSave = debouncedSave;

    this.registerEvent(
      this.plugin.app.vault.on("modify", async (modifiedFile: TFile) => {
        if (modifiedFile.path === file.path && !this.isSaving) {
          await loadSection();
        }
      })
    );

    this.registerEvent(
      this.plugin.app.workspace.on("editor-change", (changedEditor: Editor) => {
        if (changedEditor !== editor || this.isProgrammaticUpdate) return;

        const cursor = changedEditor.getCursor();
        const lineContent = changedEditor.getLine(cursor.line);

        if (cursor.line === 0 && lineContent !== this.originalHeader) {
          this.isProgrammaticUpdate = true;
          changedEditor.replaceRange(
            this.originalHeader,
            { line: 0, ch: 0 },
            { line: 0, ch: lineContent.length }
          );
          this.isProgrammaticUpdate = false;
          return;
        }

        if (cursor.line > 0 && lineContent.trim().startsWith("#")) {
          const hashes = (lineContent.match(/^#+/) || [""])[0];
          const level = hashes.length;
          const requiredLevel = this.headerLevel + 1;
          const requiredHashes = "#".repeat(requiredLevel);

          if (
            cursor.line === this.lastCorrectedLineNumber &&
            level < requiredLevel
          ) {
            this.isProgrammaticUpdate = true;
            changedEditor.replaceRange(
              "",
              { line: cursor.line, ch: 0 },
              { line: cursor.line, ch: level }
            );
            this.isProgrammaticUpdate = false;
            this.lastCorrectedLineNumber = -1;
            debouncedSave();
            return;
          }

          if (level <= this.headerLevel) {
            this.isProgrammaticUpdate = true;
            changedEditor.replaceRange(
              requiredHashes,
              { line: cursor.line, ch: 0 },
              { line: cursor.line, ch: level }
            );
            this.lastCorrectedLineNumber = cursor.line;
            this.isProgrammaticUpdate = false;
          } else {
            this.lastCorrectedLineNumber = -1;
          }
        } else {
          this.lastCorrectedLineNumber = -1;
        }

        debouncedSave();
      })
    );

    return true;
  }

  private updateHeaderState(content: string) {
    this.originalHeader = content.split("\n")[0] || "";
    this.headerLevel = (this.originalHeader.match(/^#+/)?.[0] || "#").length;
  }

  private extractSection(content: string, sectionName: string): string {
    const lines = content.split("\n");
    const headerRegex = new RegExp(
      `^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`
    );

    let startIdx = -1;
    let sectionLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      if (headerRegex.test(lines[i])) {
        startIdx = i;
        sectionLevel = (lines[i].match(/^#+/)?.[0] || "").length;
        break;
      }
    }

    if (startIdx === -1) return `# ${sectionName}\n\n*Section not found.*`;

    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const match = lines[i].match(/^#+/);
      if (match && match[0].length <= sectionLevel) {
        endIdx = i;
        break;
      }
    }

    return lines.slice(startIdx, endIdx).join("\n");
  }

  private replaceSection(
    fullContent: string,
    sectionName: string,
    newSectionText: string
  ): string {
    const lines = fullContent.split("\n");
    const headerRegex = new RegExp(
      `^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`
    );

    let startIdx = -1;
    let sectionLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      if (headerRegex.test(lines[i])) {
        startIdx = i;
        sectionLevel = (lines[i].match(/^#+/)?.[0] || "").length;
        break;
      }
    }

    if (startIdx === -1)
      return `${fullContent.trim()}\n\n${newSectionText}`.trim();

    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const match = lines[i].match(/^#+/);
      if (match && match[0].length <= sectionLevel) {
        endIdx = i;
        break;
      }
    }

    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);
    return [...before, ...newSectionText.split("\n"), ...after].join("\n");
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async teardownLeaf() {
    if (this.leaf) {
      this.leaf.detach();
      this.leaf = null;
    }
    this.view = null;
  }

  private renderError(message: string) {
    this.containerEl.empty();
    const errorEl = this.containerEl.createDiv("horizontal-blocks-embed-error");
    errorEl.setText(message);
  }
}

class EditableEmbedManager {
  private plugin: HorizontalBlocksPlugin;
  private embedRegistry = new Map<HTMLElement, EditableEmbedChild>();
  private currentFocusedEmbed: EditableEmbedChild | null = null;
  private originalExecuteCommand:
    | ((command: any, ...args: any[]) => any)
    | null = null;
  private originalGetActiveViewOfType: ((type: any) => any) | null = null;
  private focusInListener: ((event: FocusEvent) => void) | null = null;
  private focusOutListener: ((event: FocusEvent) => void) | null = null;

  constructor(plugin: HorizontalBlocksPlugin) {
    this.plugin = plugin;
  }

  registerEmbed(embed: EditableEmbedChild) {
    this.embedRegistry.set(embed.containerEl, embed);
    this.ensureHooks();
  }

  unregisterEmbed(embed: EditableEmbedChild) {
    this.embedRegistry.delete(embed.containerEl);
    if (this.currentFocusedEmbed === embed) {
      this.currentFocusedEmbed = null;
    }
    if (this.embedRegistry.size === 0) {
      this.removeHooks();
    }
  }

  dispose() {
    this.embedRegistry.clear();
    this.currentFocusedEmbed = null;
    this.removeHooks();
  }

  private ensureHooks() {
    if (!this.originalExecuteCommand) {
      this.overrideCommands();
      this.overrideGetActiveView();
      this.attachFocusListeners();
    }
  }

  private overrideCommands() {
    const commandsApi = (this.plugin.app as any)?.commands;
    if (!commandsApi) return;
    this.originalExecuteCommand = commandsApi.executeCommand;

    const handlerMap: Record<string, (embed: EditableEmbedChild) => boolean> = {
      "editor:toggle-checklist-status": (embed) => this.toggleChecklist(embed),
      "editor:toggle-bold": (embed) =>
        this.toggleMarkdownFormatting(embed, "**"),
      "editor:toggle-italics": (embed) =>
        this.toggleMarkdownFormatting(embed, "*"),
      "editor:toggle-strikethrough": (embed) =>
        this.toggleMarkdownFormatting(embed, "~~"),
      "editor:toggle-code": (embed) =>
        this.toggleMarkdownFormatting(embed, "`"),
      "editor:insert-link": (embed) => this.insertLink(embed),
      "editor:toggle-bullet-list": (embed) => this.toggleBulletList(embed),
      "editor:toggle-numbered-list": (embed) => this.toggleNumberedList(embed),
      "editor:indent-list": (embed) => this.indentList(embed),
      "editor:unindent-list": (embed) => this.unindentList(embed),
      "editor:insert-tag": (embed) => this.insertTag(embed),
      "editor:swap-line-up": (embed) => this.swapLineUp(embed),
      "editor:swap-line-down": (embed) => this.swapLineDown(embed),
      "editor:duplicate-line": (embed) => this.duplicateLine(embed),
      "editor:delete-line": (embed) => this.deleteLine(embed),
    };

    commandsApi.executeCommand = (command: any, ...args: any[]) => {
      const focusedEmbed = this.currentFocusedEmbed;

      if (focusedEmbed && command?.id) {
        const handler = handlerMap[command.id];
        if (handler) {
          const handled = handler(focusedEmbed);
          if (handled) {
            return handled;
          }
        }
      }

      return this.originalExecuteCommand?.call(commandsApi, command, ...args);
    };
  }

  private overrideGetActiveView() {
    const workspaceApi = this.plugin.app.workspace as any;
    this.originalGetActiveViewOfType = workspaceApi.getActiveViewOfType;

    workspaceApi.getActiveViewOfType = (type: any) => {
      const focusedEmbed = this.currentFocusedEmbed;
      const view = focusedEmbed?.getView();
      if (view && view instanceof type) {
        return view;
      }
      return this.originalGetActiveViewOfType?.call(workspaceApi, type);
    };
  }

  private attachFocusListeners() {
    this.focusInListener = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const embed = this.findEmbedForElement(target);
      if (embed) {
        this.currentFocusedEmbed = embed;
      }
    };

    this.focusOutListener = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget as HTMLElement | null;
      const embed = this.findEmbedForElement(nextTarget);
      if (!embed) {
        this.currentFocusedEmbed = null;
      }
    };

    document.addEventListener("focusin", this.focusInListener, true);
    document.addEventListener("focusout", this.focusOutListener, true);
  }

  private removeHooks() {
    const commandsApi = (this.plugin.app as any)?.commands;
    if (this.originalExecuteCommand && commandsApi) {
      commandsApi.executeCommand = this.originalExecuteCommand;
      this.originalExecuteCommand = null;
    }
    const workspaceApi = this.plugin.app.workspace as any;
    if (this.originalGetActiveViewOfType && workspaceApi) {
      workspaceApi.getActiveViewOfType = this.originalGetActiveViewOfType;
      this.originalGetActiveViewOfType = null;
    }
    if (this.focusInListener) {
      document.removeEventListener("focusin", this.focusInListener, true);
      this.focusInListener = null;
    }
    if (this.focusOutListener) {
      document.removeEventListener("focusout", this.focusOutListener, true);
      this.focusOutListener = null;
    }
  }

  private findEmbedForElement(
    element: HTMLElement | null
  ): EditableEmbedChild | null {
    let current: HTMLElement | null = element;
    while (current) {
      const embed = this.embedRegistry.get(current);
      if (embed) return embed;
      current = current.parentElement;
    }
    return null;
  }

  private toggleChecklist(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    if (/^\s*- \[ \]/.test(line)) {
      editor.replaceRange(
        line.replace(/- \[ \]/, "- [x]"),
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    } else if (/^\s*- \[x\]/i.test(line)) {
      editor.replaceRange(
        line.replace(/- \[x\]/i, "- [ ]"),
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    } else {
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const content = line.substring(indent.length);
      editor.replaceRange(
        `${indent}- [ ] ${content}`,
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    }
    return true;
  }

  private toggleMarkdownFormatting(
    embed: EditableEmbedChild,
    markdownChar: string
  ): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const selection = editor.getSelection();
    const len = markdownChar.length;

    if (
      selection &&
      selection.startsWith(markdownChar) &&
      selection.endsWith(markdownChar)
    ) {
      editor.replaceSelection(selection.slice(len, -len));
    } else if (selection) {
      editor.replaceSelection(`${markdownChar}${selection}${markdownChar}`);
    } else {
      const cursor = editor.getCursor();
      editor.replaceRange(markdownChar + markdownChar, cursor);
      editor.setCursor({ line: cursor.line, ch: cursor.ch + len });
    }
    return true;
  }

  private insertLink(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const selection = editor.getSelection();
    if (selection) {
      editor.replaceSelection(`[[${selection}]]`);
    } else {
      const cursor = editor.getCursor();
      editor.replaceRange("[[]]", cursor);
      editor.setCursor({ line: cursor.line, ch: cursor.ch + 2 });
    }
    return true;
  }

  private toggleBulletList(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    if (/^\s*- /.test(line)) {
      editor.replaceRange(
        line.replace(/^\s*- /, ""),
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    } else {
      editor.replaceRange(
        `- ${line}`,
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    }
    return true;
  }

  private toggleNumberedList(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    if (/^\s*\d+\. /.test(line)) {
      editor.replaceRange(
        line.replace(/^\s*\d+\. /, ""),
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    } else {
      editor.replaceRange(
        `1. ${line}`,
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    }
    return true;
  }

  private indentList(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    editor.replaceRange("\t", { line: cursor.line, ch: 0 });
    return true;
  }

  private unindentList(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    if (line.startsWith("\t")) {
      editor.replaceRange(
        "",
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: 1 }
      );
    }
    return true;
  }

  private insertTag(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    editor.replaceSelection("#");
    return true;
  }

  private swapLineUp(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    if (cursor.line > 0) {
      const currentLine = editor.getLine(cursor.line);
      const prevLine = editor.getLine(cursor.line - 1);
      editor.transaction({
        changes: [
          {
            from: { line: cursor.line - 1, ch: 0 },
            to: { line: cursor.line - 1, ch: prevLine.length },
            text: currentLine,
          },
          {
            from: { line: cursor.line, ch: 0 },
            to: { line: cursor.line, ch: currentLine.length },
            text: prevLine,
          },
        ],
        selection: { from: { line: cursor.line - 1, ch: cursor.ch } },
      });
    }
    return true;
  }

  private swapLineDown(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    if (cursor.line < editor.lastLine()) {
      const currentLine = editor.getLine(cursor.line);
      const nextLine = editor.getLine(cursor.line + 1);
      editor.transaction({
        changes: [
          {
            from: { line: cursor.line, ch: 0 },
            to: { line: cursor.line, ch: currentLine.length },
            text: nextLine,
          },
          {
            from: { line: cursor.line + 1, ch: 0 },
            to: { line: cursor.line + 1, ch: nextLine.length },
            text: currentLine,
          },
        ],
        selection: { from: { line: cursor.line + 1, ch: cursor.ch } },
      });
    }
    return true;
  }

  private duplicateLine(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    editor.replaceRange(`\n${line}`, { line: cursor.line, ch: line.length });
    return true;
  }

  private deleteLine(embed: EditableEmbedChild): boolean {
    const editor = embed.getEditor();
    if (!editor) return false;
    const { line } = editor.getCursor();
    editor.replaceRange("", { line, ch: 0 }, { line: line + 1, ch: 0 });
    return true;
  }
}

class HorizontalBlockRenderer extends MarkdownRenderChild {
  private plugin: HorizontalBlocksPlugin;
  private source: string;
  private sourcePath: string;

  constructor(
    containerEl: HTMLElement,
    plugin: HorizontalBlocksPlugin,
    source: string,
    sourcePath: string
  ) {
    super(containerEl);
    this.plugin = plugin;
    this.source = source;
    this.sourcePath = sourcePath;
  }

  async onload() {
    const container = this.containerEl;
    container.className = "horizontal-block-container";

    const blockId = await this.plugin.hashString(this.source);
    const savedLayout =
      this.plugin.settings[`horizontal-block-layout-${blockId}`] || {};

    const sections = this.source.split(/^---$/m).map((part) => part.trim());
    const blocks: HTMLElement[] = [];

    for (let index = 0; index < sections.length; index++) {
      const markdown = sections[index];
      const block = await this.createRenderedBlock(
        markdown,
        savedLayout[`title-${index}`]
      );
      const savedWidth = savedLayout[`width-${index}`];

      if (savedWidth) {
        block.classList.add("horizontal-block-flex-fixed");
        this.plugin.applyBlockWidth(block, savedWidth);
      } else {
        block.classList.add("horizontal-block-flex-grow");
      }

      blocks.push(block);
    }

    // Append blocks and resizers
    for (let i = 0; i < blocks.length; i++) {
      container.appendChild(blocks[i]);
      if (i < blocks.length - 1) {
        const resizer = document.createElement("div");
        resizer.className = "horizontal-block-resizer";
        container.appendChild(resizer);
        this.makeResizable(blocks[i], blocks[i + 1], resizer, blockId, i);
      }
    }
  }

  async createRenderedBlock(
    markdown: string,
    title?: string
  ): Promise<HTMLElement> {
    const block = document.createElement("div");
    block.className = "resizable-block";

    if (title) {
      const header = document.createElement("div");
      header.className = "block-title";
      header.innerText = title;
      block.appendChild(header);
    }

    const preview = document.createElement("div");
    preview.className = "horizontal-block-md-preview";
    preview.classList.add("markdown-rendered");

    await MarkdownRenderer.render(
      this.plugin.app,
      markdown,
      preview,
      this.sourcePath,
      this
    );

    const images = preview.querySelectorAll("img");
    images.forEach((img: HTMLImageElement) => {
      img.classList.add("horizontal-block-image");
    });

    this.initializeEditableEmbeds(preview);

    block.appendChild(preview);

    return block;
  }

  private initializeEditableEmbeds(preview: HTMLElement) {
    const embedElements = Array.from(
      preview.querySelectorAll<HTMLElement>(".internal-embed")
    );

    for (const embedEl of embedElements) {
      if (
        embedEl.classList.contains("image-embed") ||
        embedEl.classList.contains("media-embed")
      ) {
        continue;
      }

      const rawLink = embedEl.getAttribute("src");
      if (!rawLink) continue;

      const [linkPath] = rawLink.split("|");
      if (!linkPath) continue;

      const sectionIndex = linkPath.indexOf("#");
      const hasSection = sectionIndex >= 0;
      const section =
        hasSection && linkPath.slice(sectionIndex + 1).length > 0
          ? linkPath.slice(sectionIndex + 1)
          : null;
      if (section && section.startsWith("^")) continue;

      const notePath = hasSection ? linkPath.slice(0, sectionIndex) : linkPath;
      const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
        notePath || this.sourcePath,
        this.sourcePath
      );
      if (!targetFile || targetFile.extension !== "md") continue;

      const container = document.createElement("div");
      container.classList.add("horizontal-blocks-embed-container");
      embedEl.replaceWith(container);

      const editableChild = new EditableEmbedChild(
        container,
        this.plugin,
        this.plugin.embedManager,
        this.sourcePath,
        rawLink
      );
      this.addChild(editableChild);
    }
  }

  makeResizable(
    left: HTMLElement,
    right: HTMLElement,
    resizer: HTMLElement,
    blockId: string,
    index: number
  ) {
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;
    let mouseMoveListener: ((e: MouseEvent) => void) | null = null;
    let mouseUpListener: ((e: MouseEvent) => void) | null = null;

    const mouseDownHandler = (e: MouseEvent) => {
      isResizing = true;
      startX = e.clientX;
      startLeftWidth = left.getBoundingClientRect().width;
      document.body.classList.add("horizontal-block-resizing-cursor");

      // Prepare classes for resizing state
      left.classList.add("horizontal-block-flex-fixed");
      left.classList.remove("horizontal-block-flex-grow");
      right.classList.add("horizontal-block-flex-grow");
      right.classList.remove("horizontal-block-flex-fixed");

      // Create fresh event handlers for this resize session
      mouseMoveListener = (e: MouseEvent) => {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const newLeftWidth = startLeftWidth + dx;
        left.classList.add("horizontal-block-flex-fixed");
        left.classList.remove("horizontal-block-flex-grow");
        this.plugin.applyBlockWidth(left, newLeftWidth);

        right.classList.add("horizontal-block-flex-grow");
        right.classList.remove("horizontal-block-flex-fixed");
        this.plugin.removeBlockWidth(right);
      };

      mouseUpListener = async () => {
        isResizing = false;
        document.body.classList.remove("horizontal-block-resizing-cursor");

        // Clean up event listeners
        if (mouseMoveListener) {
          document.removeEventListener("mousemove", mouseMoveListener);
          mouseMoveListener = null;
        }
        if (mouseUpListener) {
          document.removeEventListener("mouseup", mouseUpListener);
          mouseUpListener = null;
        }

        const finalWidth = left.getBoundingClientRect().width;
        const layoutKey = `horizontal-block-layout-${blockId}`;
        if (!this.plugin.settings[layoutKey])
          this.plugin.settings[layoutKey] = {};
        this.plugin.settings[layoutKey][`width-${index}`] = finalWidth;
        await this.plugin.saveData(this.plugin.settings);
      };

      // Add event listeners
      document.addEventListener("mousemove", mouseMoveListener);
      document.addEventListener("mouseup", mouseUpListener);
    };

    this.registerDomEvent(resizer, "mousedown", mouseDownHandler);
  }
}

export default class HorizontalBlocksPlugin extends Plugin {
  settings: Record<string, any> = {};
  private styleEl?: HTMLStyleElement;
  embedManager!: EditableEmbedManager;

  async onload() {
    // Load stored block widths
    this.settings = (await this.loadData()) || {};

    this.embedManager = new EditableEmbedManager(this);

    // Register the processor function
    const processor = async (source: string, el: HTMLElement, ctx: any) => {
      const renderer = new HorizontalBlockRenderer(
        el,
        this,
        source,
        ctx.sourcePath
      );
      ctx.addChild(renderer);
    };

    // Register for both "horizontal" and "hblock" triggers
    this.registerMarkdownCodeBlockProcessor("horizontal", processor);
    this.registerMarkdownCodeBlockProcessor("hblock", processor);
  }

  onunload() {
    this.embedManager?.dispose();
  }

  async hashString(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16); // Shorten for key
  }

  applyBlockWidth(block: HTMLElement, width: number) {
    block.classList.add("has-width");
    // Use inline style with CSS custom property
    block.setAttribute("style", `--block-width: ${Math.round(width)}px`);
  }

  removeBlockWidth(block: HTMLElement) {
    block.classList.remove("has-width");
    block.removeAttribute("style");
  }
}
