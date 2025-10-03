import { Plugin, MarkdownRenderer, MarkdownRenderChild } from "obsidian";

class HorizontalBlockRenderer extends MarkdownRenderChild {
  private plugin: HorizontalBlocksPlugin;
  private source: string;
  private sourcePath: string;

  constructor(containerEl: HTMLElement, plugin: HorizontalBlocksPlugin, source: string, sourcePath: string) {
    super(containerEl);
    this.plugin = plugin;
    this.source = source;
    this.sourcePath = sourcePath;
  }

  async onload() {
    const container = this.containerEl;
    container.className = "horizontal-block-container";

    const blockId = await this.plugin.hashString(this.source);
    const savedLayout = this.plugin.settings[`horizontal-block-layout-${blockId}`] || {};

    const sections = this.source.split(/^---$/m).map(part => part.trim());
    const blocks: HTMLElement[] = [];

    for (let index = 0; index < sections.length; index++) {
      const markdown = sections[index];
      const block = await this.createRenderedBlock(markdown, savedLayout[`title-${index}`]);
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

  async createRenderedBlock(markdown: string, title?: string): Promise<HTMLElement> {
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

    await MarkdownRenderer.render(this.plugin.app, markdown, preview, this.sourcePath, this);

    const images = preview.querySelectorAll("img");
    images.forEach((img: HTMLImageElement) => {
      img.classList.add("horizontal-block-image");
    });

    block.appendChild(preview);

    return block;
  }

  makeResizable(left: HTMLElement, right: HTMLElement, resizer: HTMLElement, blockId: string, index: number) {
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
        if (!this.plugin.settings[layoutKey]) this.plugin.settings[layoutKey] = {};
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

  async onload() {
    // Load stored block widths
    this.settings = (await this.loadData()) || {};

    this.registerMarkdownCodeBlockProcessor("horizontal", async (source, el, ctx) => {
      const renderer = new HorizontalBlockRenderer(el, this, source, ctx.sourcePath);
      ctx.addChild(renderer);
    });
  }

  onunload() {
  }

  async hashString(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16); // Shorten for key
  }

  applyBlockWidth(block: HTMLElement, width: number) {
    block.classList.add('has-width');
    // Use inline style with CSS custom property
    block.setAttribute('style', `--block-width: ${Math.round(width)}px`);
  }

  removeBlockWidth(block: HTMLElement) {
    block.classList.remove('has-width');
    block.removeAttribute('style');
  }

}
