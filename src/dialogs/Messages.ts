/**
 * Messages.ts
 *
 * All user-facing content for the release notes / first-run modal.
 *
 * FIRST_RUN   — shown to brand-new installs (no previous version recorded).
 * RELEASE_NOTES — shown on upgrade; keyed by semver string, values are raw Markdown.
 *
 * To add notes for a new release, append a new key that matches the version
 * string in manifest.json. Nothing else needs to change.
 */

export const FIRST_RUN = `
Welcome to **🧱 Horizontal Blocks**!

Bring Notion-style side-by-side layouts into Obsidian. Use a \`horizontal\` or \`hblock\` code fence and separate columns with \`---\`.

## ✨ Key Features
- **Side-by-side markdown blocks** with a draggable resizer
- **Dynamic layout** — 2 or more columns in a single block
- **Full Obsidian syntax** — images, embeds, internal links, tasks
- **Styling settings tab** — tweak colors, borders, padding and more, all live
- **Per-block toolbar** — width nudge and color overrides per column
- **Live editing** for page/section embeds within blocks, with reduced extra spacing for a cleaner look.
- **Styling settings tab**: tweak divider (color, thickness, opacity, style), block backgrounds/borders, padding and gaps, toolbar visibility, and theme-aware colors — all applied live via CSS variables.
  - Also includes text color option for block content.
  - Title text color for block headers.
- **Per-block toolbar** inside each column: width +/- controls, and per-block background/text color pickers with instant updates and persistence.
  - Right-click any block for quick visibility toggles (toolbar, borders, alternating shading).

---

If you find the plugin useful, consider supporting its development:

<div style="text-align:center;margin-top:8px">
<a href="https://www.buymeacoffee.com/iCodeAlchemy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>
</div>
`;

export const RELEASE_NOTES: { [k: string]: string } = {
  Intro: `After each update I'll show you what's changed (you can turn this off in plugin settings).

If Horizontal Blocks adds value to your workflow, consider supporting its development:

<div style="text-align:center;margin-top:8px">
<a href="https://www.buymeacoffee.com/iCodeAlchemy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>
</div>

---

`,
  "1.1.1": `
**Contributors:** [xRyul](https://github.com/xRyul), [seka](https://github.com/seka)

## ✨ Added
- **Transparent background toggle** — New option in the Styling settings tab to make block backgrounds fully transparent, overriding both custom and theme-aware background colors. (PR [#18](https://github.com/iCodeAlchemy/horizontal-blocks/pull/18) by xRyul)

## 🐛 Fixed
- **Font size normalised** — Block content font size corrected from \`0.9rem\` back to \`1rem\` to match the main body text of the note. (PR [#18](https://github.com/iCodeAlchemy/horizontal-blocks/pull/18) by xRyul)
- **\`---\` inside fenced code blocks no longer splits layout** — Introduced a \`splitSections()\` parser that is aware of fenced code block boundaries (\` \`\`\` \` and \`~~~\`). Previously, any \`---\` line — even inside a code block — was treated as a column separator, corrupting the layout. (PR [#13](https://github.com/iCodeAlchemy/horizontal-blocks/pull/13) by seka)
`,
};
