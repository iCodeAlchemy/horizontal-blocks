import { Plugin, MarkdownRenderer } from "obsidian";

export default class HorizontalBlocksPlugin extends Plugin {
  private settings: Record<string, any> = {};

  async onload() {
    console.log("Horizontal Blocks Plugin loaded");

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
          block.style.flex = `0 0 ${savedWidth}px`;
        } else {
          block.style.flex = `1`;
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
    preview.addClass("markdown-rendered");

    MarkdownRenderer.render(this.app, markdown, preview, sourcePath, this).then(() => {
      // Auto-fit any embedded images inside this block
      const images = preview.querySelectorAll("img");
      images.forEach((img: HTMLImageElement) => {
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        img.style.margin = "0 auto";
      });
    });
    
    block.appendChild(preview);

    return block;
  }

  makeResizable(left: HTMLElement, right: HTMLElement, resizer: HTMLElement, blockId: string, index: number) {
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;

    const mouseDownHandler = (e: MouseEvent) => {
      isResizing = true;
      startX = e.clientX;
      startLeftWidth = left.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';

      document.addEventListener("mousemove", mouseMoveHandler);
      document.addEventListener("mouseup", mouseUpHandler);
    };

    const mouseMoveHandler = (e: MouseEvent) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const newLeftWidth = startLeftWidth + dx;
      left.style.flex = `0 0 ${newLeftWidth}px`;
      right.style.flex = `1`;
    };

    const mouseUpHandler = async () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);

      const finalWidth = left.getBoundingClientRect().width;
      const layoutKey = `horizontal-block-layout-${blockId}`;
      if (!this.settings[layoutKey]) this.settings[layoutKey] = {};
      this.settings[layoutKey][`width-${index}`] = finalWidth;
      await this.saveData(this.settings);
    };

    resizer.addEventListener("mousedown", mouseDownHandler);
  }

  async hashString(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16); // Shorten for key
  }
}
