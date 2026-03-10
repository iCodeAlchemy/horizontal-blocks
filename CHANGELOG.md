# Changelog

All notable changes to this project are documented in this file.

## [1.1.1] - 2026-03-11

**Contributors:** [xRyul](https://github.com/xRyul), [seka](https://github.com/seka)

### Added

- **Transparent background toggle** — New option in the Styling settings tab to make block backgrounds fully transparent, overriding both custom and theme-aware background colors. (PR [#18](https://github.com/iCodeAlchemy/horizontal-blocks/pull/18) by xRyul)

### Fixed

- **Font size normalised** — Block content font size corrected from `0.9rem` back to `1rem` to match the main body text of the note. (PR [#18](https://github.com/iCodeAlchemy/horizontal-blocks/pull/18) by xRyul)
- **`---` inside fenced code blocks no longer splits layout** — Introduced a `splitSections()` parser that is aware of fenced code block boundaries (` ``` ` and `~~~`). Previously, any `---` line — even inside a code block — was treated as a column separator, corrupting the layout. (PR [#13](https://github.com/iCodeAlchemy/horizontal-blocks/pull/13) by seka)

## [1.1.0] - 2025-10-23

### Added

- New trigger command `hblock` as an alias to `horizontal`, enabling the same Notion-style horizontal layout using a shorter code block fence.
- Live editing for page and section embeds inside blocks. Embedded markdown notes (e.g., `![[Note]]` or `![[Note#Heading]]`) can now be edited inline; changes are saved back to the source file, and section edits are merged precisely into the corresponding heading section.
- Styling settings tab to customize horizontal blocks globally without CSS:
  - Divider: color, thickness, opacity, and style (solid | dashed | dotted | transparent), plus hover accent and drag-active highlight.
  - Blocks: background color, optional alternating shading (zebra), toggle borders, border radius, and border thickness.
  - Blocks: text color option to customize foreground text inside blocks.
  - Blocks: title text color option for block headers.
  - Spacing: inner padding and gap between blocks.
  - Toolbar: global visibility toggle for an optional `.hblock-toolbar` region.
  - Theme-aware mode to auto-inherit theme colors.
- Per-block toolbar in each column with quick actions: width +/- controls, and per-block background/text color pickers (applies instantly and persists overrides per block).
- Right-click context menu on blocks to toggle visibility settings globally (toolbar, borders, alternating shading).

### Changed

- Removed extra top and bottom spacing from embedded views to produce a cleaner, more compact layout inside horizontal blocks.
- CSS refactor to use variables and global classes so themes/snippets can override styles; settings apply live without restart.

### Notes

- No breaking changes. The existing `horizontal` trigger remains fully supported.
