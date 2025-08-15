import { Plugin, MarkdownRenderer } from "obsidian";

export default class HorizontalBlocksPlugin extends Plugin {
  private settings: Record<string, any> = {};
  private styleEl?: HTMLStyleElement;

  async onload() {
    // Load stored block widths
    this.settings = (await this.loadData()) || {};

    this.registerMarkdownCodeBlockProcessor("horizontal", async (source, el, ctx) => {
      const container = document.createElement("div");
      container.className = "horizontal-block-container";

      const blockId = await this.hashString(source);
      const savedLayout = this.settings[`horizontal-block-layout-${blockId}`] || {};

      const sections = source.split(/^---$/m).map(part => part.trim());
      const blocks: HTMLElement[] = [];

      sections.forEach((markdown, index) => {
        const block = this.createRenderedBlock(markdown, ctx.sourcePath, savedLayout[`title-${index}`]);
        const savedWidth = savedLayout[`width-${index}`];

        if (savedWidth) {
          block.classList.add("flex-fixed");
          this.applyBlockWidth(block, savedWidth);
        } else {
          block.classList.add("flex-grow");
        }

        blocks.push(block);
      });

      // Append blocks and resizers
      for (let i = 0; i < blocks.length; i++) {
        container.appendChild(blocks[i]);
        if (i < blocks.length - 1) {
          const resizer = document.createElement("div");
          resizer.className = "resizer";
          container.appendChild(resizer);
          this.makeResizable(blocks[i], blocks[i + 1], resizer, blockId, i);
        }
      }

      el.appendChild(container);
    });
  }

  onunload() {
  }

  createRenderedBlock(markdown: string, sourcePath: string, title?: string): HTMLElement {
    const block = document.createElement("div");
    block.className = "resizable-block";

    if (title) {
      const header = document.createElement("div");
      header.className = "block-title";
      header.innerText = title;
      block.appendChild(header);
    }

    const preview = document.createElement("div");
    preview.className = "md-preview";
    preview.classList.add("markdown-rendered");

    MarkdownRenderer.render(this.app, markdown, preview, sourcePath, this).then(() => {
      const images = preview.querySelectorAll("img");
      images.forEach((img: HTMLImageElement) => {
        img.classList.add("horizontal-block-image");
      });
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
      document.body.classList.add("resizing-cursor");

      // Prepare classes for resizing state
      left.classList.add("flex-fixed");
      left.classList.remove("flex-grow");
      right.classList.add("flex-grow");
      right.classList.remove("flex-fixed");

      // Create fresh event handlers for this resize session
      mouseMoveListener = (e: MouseEvent) => {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const newLeftWidth = startLeftWidth + dx;
        left.classList.add("flex-fixed");
        left.classList.remove("flex-grow");
        this.applyBlockWidth(left, newLeftWidth);

        right.classList.add("flex-grow");
        right.classList.remove("flex-fixed");
        this.removeBlockWidth(right);
      };

      mouseUpListener = async () => {
        isResizing = false;
        document.body.classList.remove("resizing-cursor");

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
        if (!this.settings[layoutKey]) this.settings[layoutKey] = {};
        this.settings[layoutKey][`width-${index}`] = finalWidth;
        await this.saveData(this.settings);
      };

      // Add event listeners
      document.addEventListener("mousemove", mouseMoveListener);
      document.addEventListener("mouseup", mouseUpListener);
    };

    this.registerDomEvent(resizer, "mousedown", mouseDownHandler);
  }

  async hashString(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16); // Shorten for key
  }

  private applyBlockWidth(block: HTMLElement, width: number) {
    block.classList.add('has-width');
    // Use inline style with CSS custom property
    block.setAttribute('style', `--block-width: ${Math.round(width)}px`);
  }

  private removeBlockWidth(block: HTMLElement) {
    block.classList.remove('has-width');
    block.removeAttribute('style');
  }

}
