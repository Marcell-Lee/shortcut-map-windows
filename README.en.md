# Shortcut Map · 快捷键地图

**Find unassigned shortcuts. Give every key combination a purpose.**

[简体中文](README.md) · English

Want to set a shortcut but unsure which combinations are still available? Shortcut Map puts Windows and app shortcuts on a visual keyboard. Check existing actions, find unassigned combinations, and keep track of your own choices.

[Download for Windows](https://github.com/Marcell-Lee/shortcut-map-windows/releases/latest) · [Report an issue](https://github.com/Marcell-Lee/shortcut-map-windows/issues)

## Find unassigned key combinations

For example, to find a combination starting with `Alt+Win`, turn on **未分配 (Unassigned)** and select `Alt` and `Win`. The other keys change color to show which combinations have a recorded assignment.

![Unassigned shortcuts: green means unassigned, light red means assigned, and blue outlines mark selected keys](docs/unassigned-shortcuts.png)

- **Green:** no assignment in the current records; a candidate for a new shortcut.
- **Light red:** already assigned. Click to see the app and action.
- **Blue outline:** a selected key.

Look across all shortcuts, global shortcuts, or one app. If you want a new shortcut for an app, select that app; recorded global shortcuts are also taken into account.

“Unassigned” is based on the shortcuts in the map. **It is not a live scan of every shortcut on your computer.** Missing records may hide conflicts. Add your usual apps, then check the combination in the actual app before using it.

## See what a shortcut does

Hover over a key to see its combinations and actions. Click to add or edit a record. You can also compare what the same combination does in different apps.

![Shortcut details: Ctrl+C has different actions in text editing, Firefox, and OBS Studio](docs/shortcut-details.png)

The screenshots and current app interface are in Chinese. This English guide explains the controls.

## Get started

1. Download a release: **Setup** is the installer; **Portable** runs without installation.
2. Open the app and choose a 68-key or 104-key layout.
3. Select all shortcuts, global shortcuts, or an app, then turn on **未分配 (Unassigned)**.
4. Click `Ctrl`, `Alt`, `Shift`, or `Win` on the visual keyboard to combine them, or hold those modifiers on your physical keyboard. Inspect a target key to check the resulting combination.

Shortcut Map helps you view and record assignments. To make a new shortcut work, set it in the target app or a shortcut tool.

## Add your apps with an AI agent

Expand **用 AI 补充软件快捷键 (Add app shortcuts with AI)** and copy the prompt into a coding agent with local file access, such as Codex, Claude Code, Cursor, GitHub Copilot, or Gemini CLI.

The agent first asks which apps you want. It then looks for their active custom shortcuts, or official defaults when the current settings cannot be confirmed. It follows the rules in the app’s workspace and updates the data file directly. Keep Shortcut Map open to load the results automatically—**no manual JSON copying required**.

A regular chat webpage cannot edit local files. Use an agent with access to this computer.

## Keep your records on your computer

- Changes save locally. Export and import backups at the bottom of the page.
- AI updates preserve manual records, other apps, and Windows default records.
- Startup does not scan installed apps or read their shortcut settings.
- Choose a 68-key or standard 104-key layout. If keyboard detection is inconclusive, select one manually.

Moving from the older HTML version? Export a backup there, then import it into the desktop app.

## For contributors

Build commands, project structure, and the AI data format are in the [developer guide (Chinese)](docs/DEVELOPMENT.md). You do not need development tools to use the Windows release.
