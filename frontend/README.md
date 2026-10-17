# Browser workbench

React/TypeScript with a custom SVG schematic and concept-layout editor. The shell
uses a familiar dark workbench arrangement; it is not a VS Code fork. A custom
shell avoids bringing desktop extension infrastructure into a focused browser EDA
workflow. Standard DOM controls remain accessible alongside the canvas.

- `src/App.tsx`: workbench, inspector, memory, simulation plot, project/data dialogs.
- `src/SettingsPanel.tsx`: separate Editor/Data controls and Legal & privacy panels.
- `src/Canvas.tsx`: terminals, wires, device symbols, geometry, drag, pan, zoom,
  and proposed geometry previews.
- `src/useWorkbench.ts`: API coordination, optimistic revisions, undo/redo,
  local draft recovery, durable action outbox, suggestions and memory.
- `src/style.css`: responsive dark workbench presentation.

Every design mutation uses the common commit path. Events store object upserts
and deletions or chunked equivalents; pointer movement is summarized at drag end.
API acknowledgement removes events from local storage. Non-mutating context such
as selection, tools, panels, and views is recorded separately.
