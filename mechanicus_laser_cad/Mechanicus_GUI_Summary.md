# Mechanicus Main App GUI Summary

## GUI Overview
Mechanicus uses the Tkinter library to build a multi-window graphical user interface for CNC/laser design and control. The GUI consists of a main root window, a drawing canvas, tool windows, menus, dialogs, and various controls for drawing, machine settings, and file operations.

## Main GUI Elements & Layout
- **Root Window (`root`)**
  - Title: "MECHANICUS V.0.1 Beta. (c)Reservoir Frogs 2025"
  - Background: `#263d42` (dark teal/blue)
  - Icon: `icon/icon.png`
  - Geometry: `324x1000+0+0` (narrow sidebar)
  - Contains quick settings, buttons, and machine controls.

- **Main Drawing Window (`win`)**
  - Toplevel window, geometry: `1370x980+324+0`
  - Background: `#263d42`
  - Contains:
    - Background image: `icon/bg3.png`
    - Rulers (horizontal and vertical): `#263d42` background, white markings
    - Main drawing canvas (`cv`): white background, size from machine profile JSON
    - Scrollbars: custom styled, dark colors
    - Toolbars and controls (top and left)

- **Drawing Canvas (`cv`)**
  - Background: white
  - Size: from `machine_profiles/last_used.json` (`bed_max_x`, `bed_max_y`)
  - Supports drawing shapes, text, freehand, live carving, etc.
  - All drawing tools and snapping indicators are rendered here.

- **Tool Windows**
  - **Drawing Tools Window**: Toplevel, `240x220+1700+0`, always on top, dark background
    - Buttons for Line, Circle, Rectangle, Polygon, Arc, Freehand, Live Carving
    - Laser/Z-axis checkboxes
  - **Snap Tools Window**: Toplevel, `200x150+1700+100`, always on top, dark background
    - Checkboxes for Grid, Endpoint, Midpoint, Center snapping
  - **Layers Window**: Toplevel, managed by `LayersWindow` class (from `layers_window.py`)
  - **Settings Window**: Toplevel, `500x900`, dark background, scrollable, profile management
  - **Markers Window**: Toplevel, managed by `MarkersWindow` (from `markers.py`)
  - **Line Editor Window**: Toplevel, managed by `LineEditor` (from `line_editor.py`)
  - **AI Assistant Window**: Toplevel, managed by `Ai.ChatApp` (from `Ai.py`)

- **Menus**
  - File, Edit, Select, Windows menus (top menubar)
  - File operations, undo/redo, selection, window management

- **Buttons & Controls**
  - Color: mostly `#263d42` (dark teal/blue), some red for critical actions (e.g., Connect, G-code buttons)
  - Text color: white or `#B2C3C7` (light blue/gray)
  - Sizes: typically width 8-14, height 1-2
  - Placement: `.place()` and `.pack()` used for layout
  - Examples:
    - "Snap Tools" button: opens snap tool window
    - "Import SVG", "Save SVG", "Drawing Tools", "Layers", "Engrave", "Replicate", "Clear Lines", etc.
    - Quick settings: Draw Speed, Laser Power, Layers (Text widgets)
    - Dropdowns: Scale (zoom), Grid Size, Baud Rate, Font selection
    - Checkboxes: Grid, Snap, Laser Active, Z-Axis Active

## Function Sources (Module Mapping)
- **Drawing Tools**: Most drawing logic (line, circle, rectangle, polygon, arc, freehand) is in the main app file, but some are delegated:
  - Freehand: `freehand_tool.py`
  - Transformation: `transformation_tools.py`
  - Grouping: `groups.py`
  - Line Editor: `line_editor.py`
  - Markers: `markers.py`
- **SVG Import/Export**: `svg_import.py`, `svg_export.py`
- **G-code Generation**: `gcodegenerator.py`, `engrave.py`
- **Layers**: `layers_window.py`
- **Webcam Feed**: `webcam_feed.py`
- **AI Assistant**: `Ai.py`
- **Undo/Redo**: `undoredo.py`
- **Snapping**: `snaptools.py`
- **Machine Config/Profile**: `config3.py`, `Mechanicus_Config.py`

## Colors & Style
- **Main Color**: `#263d42` (used for backgrounds, buttons, tool windows)
- **Accent Color**: Red (`bg="red"`) for critical actions (Connect, G-code, Home)
- **Text Color**: White, `#B2C3C7` (labels)
- **Canvas**: White background
- **Selection/Highlight**: Green for selected shapes, blue for bounding boxes, red for active elements
- **Custom Scrollbars**: Styled with dark colors
- **Font Dropdown**: OptionMenu, default font is Impact, others available

## Layout Details
- **Sidebar (root)**: Narrow, vertical, contains quick settings and machine controls
- **Main Window (win)**: Large, horizontal, contains drawing canvas, rulers, toolbars
- **Tool Windows**: Floating, always on top, grouped by function
- **Placement**: `.place()` for precise positioning, `.pack()` for toolbars/rulers
- **Responsive**: Uses `.update_idletasks()` and dynamic resizing for canvas and scroll region

## Replication Notes
- Use Tkinter for all windows and controls
- Set background colors and button styles as described
- Use `.place()` for fixed positions, `.pack()` for toolbars/rulers
- Use Toplevel windows for tools/settings/AI
- Use OptionMenu/Combobox for dropdowns
- Use Text widgets for quick settings
- Use custom colors for selection/highlight
- Delegate advanced logic to modules as mapped above

---
This summary provides a blueprint for replicating the Mechanicus GUI, including layout, colors, control types, and the source modules for each functional area.
