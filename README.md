README.md

# 🧱 Horizontal Blocks Plugin

Bring Notion-style layouts with blocks side-by-side, resizable markdown blocks that support full Obsidian syntax including images, embeds, and internal links.

---

## ✨ Features

- 🔲 **Side-by-side markdown blocks** using `horizontal` / `hblock` code block
- 📏 **Resizable columns** with a draggable divider
- 🧠 **Dynamic layout** — support for 2 or more columns using `---` separator
- 🖼️ **Auto-scaling images** inside blocks
- 💾 **Block width persistence** — remembers layout when you return
- Live editing for page/section embeds within blocks, with reduced extra spacing for a cleaner look.
- Styling settings tab: tweak divider (color, thickness, opacity, style), block backgrounds/borders, padding and gaps, toolbar visibility, and theme-aware colors — all applied live via CSS variables.
  - Also includes text color option for block content.
  - Title text color for block headers.
- Per-block toolbar inside each column: width +/- controls, and per-block background/text color pickers with instant updates and persistence.
  - Right-click any block for quick visibility toggles (toolbar, borders, alternating shading).

```
⚠️ WARNING
Please refrain from entering tasks directly within the Horizontal code block.

The Horizontal function operates based on the code block. In Obsidian, text within a code block is treated as plain text. Consequently, if you input tasks inside a code block, neither the tasks plugin nor the dataview plugin will be able to recognize them.
```

---

## 🚀 Examples

### Code 1:

<pre>
```horizontal  
### Block 1  
This is the left block.  
---
### Block 2  
This is the right block.  
```
</pre>

### Preview 1:

## ![img.png](images/preview1.png)

### Code 2:

<pre>
```horizontal  
### Left Block  
This is the left block.  
---
### Middle Block  
This is the middle block.
---
### Right Block  
This is the right block.  
```
</pre>

### Preview 2:

## ![img.png](images/preview2.png)

### Code 3:

 <pre>
```hblock
### Left Block
This is free text
- Item 1
- [ ] Item 2
- **Item 3**

This is a ***formatted*** **text**
---
### Right Image Block
![[test_image.png]]
```
</pre>

### Preview 3:

## ![img_1.png](images/preview3.png)

## 🎨 Styling Settings

You can customize the layout appearance globally without editing CSS:

- Divider: color, thickness (1–5px), opacity, and style (solid | dashed | dotted | transparent); hover accent and drag highlight.
- Blocks: background color, optional alternating shading (zebra), show/hide borders, border radius, border thickness.
  - Text color for content inside blocks.
  - Title text color for block headers.
- Spacing: inner padding (0–32px) and gap between blocks (0–24px).
- Toolbar: global visibility toggle for optional `.hblocks-toolbar` areas.
- Theme-aware: auto-inherit theme colors instead of custom picks.

Find it under Obsidian → Settings → Community Plugins → Horizontal Blocks – Styling.

All options apply via CSS variables/classes, so themes/snippets can override them; changes apply live without restart.

<!-- ### Screenshots

- Styling panel overview:

  <img alt="Horizontal Blocks – Styling settings" src="images/styling-settings.png" width="800" />

- Live resizing and hover accents:

  <img alt="Divider hover and drag highlight" src="images/styling-live-demo.gif" width="800" /> -->

### Toolbar Controls

- Width +/-: Nudge the current block’s width by small steps; changes are saved.
- Background: Per-block background color picker (overrides global background).
- Text color: Per-block foreground color picker (overrides global text color).

---

## 🧾 Changelog

See the full release history in [CHANGELOG.md](CHANGELOG.md).

---

## 🤝 Contributing

Contributions are welcome! Whether it's a bug fix, a new feature, or a UI improvement — here's how to get involved.

### Getting Started

1. **Fork** the repository and clone your fork locally.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the dev build** (watches for changes):
   ```bash
   npm run dev
   ```
4. **Link to your Obsidian vault for testing** — copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder:
   ```
   <vault>/.obsidian/plugins/horizontal-blocks/
   ```
   Reload Obsidian or use the **Reload App Without Saving** command to pick up changes.

### Submitting a Pull Request

1. Create a focused branch for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Keep commits atomic and write clear commit messages (e.g. `fix: correct font size in block content`).
3. Make sure `npm run build` passes without TypeScript errors before opening a PR.
4. Open your PR against the `main` branch. Include a clear description of _what_ changed and _why_.
5. Reference any related issues in the PR description (e.g. `Closes #12`).

### Code Style Guidelines

- This project is written in **TypeScript**. Keep type annotations explicit.
- Follow the existing patterns for `StyleSettings` when adding new styling options — add the field to the interface, set a default in `DEFAULT_STYLE_SETTINGS`, wire it up in `applyStylingVariables()`, and add a toggle/picker in `HBlockStylingSettingTab`.
- Avoid hardcoding paths, user-specific directories, or environment-dependent commands in `package.json` scripts.

### Reporting Bugs & Requesting Features

Please use our [GitHub Project board](https://github.com/users/iCodeAlchemy/projects/6/views/4) to submit bug reports and feature requests. It helps us triage and prioritize efficiently.

---

## 👏🏼 Support

Have you found the **Horizontal Blocks** plugin helpful, and want to support it? I welcome donations to support future development efforts. However, I typically do not accept payments for bug bounties or feature requests, as financial incentives can create stress and expectations that I prefer to avoid in my hobby project!

Support @iCodeAlchemy:

<a href="https://www.buymeacoffee.com/iCodeAlchemy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 40px !important;width: 175px !important;" ></a>
