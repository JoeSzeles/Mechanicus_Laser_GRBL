# Mechanicus Main App Summary

## Purpose
Mechanicus is a graphical application for designing, editing, and controlling CNC/laser machines. It provides a rich GUI for drawing shapes, importing SVGs, generating and previewing G-code, and sending commands to a connected machine. The app supports advanced drawing tools, snapping, layers, undo/redo, and machine profile management.

## Main Modules & Interactions
- **Tkinter GUI**: Main window, drawing canvas, tool windows, menus, dialogs.
- **Drawing Tools**: Line, circle, rectangle, polygon, arc, freehand, text, live carving, paint brush.
- **Snap Tools**: Grid, endpoint, midpoint, center snapping for precision drawing.
- **Layers & Groups**: Layer management, group selection, bounding boxes.
- **SVG Import/Export**: Import SVG files, export drawings as SVG.
- **G-code Generation**: Convert drawings/images/SVGs to G-code for CNC/laser machines.
- **Machine Control**: Serial connection, send G-code, live position updates, profile management.
- **Undo/Redo**: Canvas history for undo/redo actions.
- **External Modules**: Many features are delegated to modules like `engrave`, `svg_export`, `gcodegenerator`, `config3`, `freehand_tool`, `groups`, `snaptools`, `layers_window`, `webcam_feed`, `line_editor`, etc.

## External Libraries Used
- **tkinter**: GUI framework.
- **PIL (Pillow)**: Image manipulation, font rendering.
- **serial (pyserial)**: Serial communication with machine.
- **matplotlib**: G-code path plotting.
- **numpy**: Image processing.
- **cv2 (OpenCV)**: Image processing (for webcam feed, etc).
- **tkcolorpicker**: Color selection dialogs.
- **svg.path**: SVG path parsing.
- **cairo**: SVG/text rendering.
- **keyboard**: Keyboard event handling.
- **json**: Config/profile management.
- **threading, queue**: For concurrency (e.g., live feed).

## Notable Design Patterns & Dependencies
- **MVC-like separation**: GUI, drawing logic, machine control, and file I/O are separated into modules.
- **Event-driven**: Extensive use of tkinter event bindings for user actions.
- **Global State**: Many global variables for tool state, selection, serial connection, etc.
- **Profile Management**: Machine profiles are saved/loaded as JSON files.
- **Undo/Redo**: Canvas history managed via `undoredo` module.
- **Modular Tools**: Drawing, snapping, transformation, grouping, and editing are modular and extensible.
- **Side Effects**: Drawing on canvas, sending G-code, updating machine position, file I/O, sound notifications.

## Functions & Classes
### Main Functions (with parameters and summary)
- `create_grid()`: Draws grid lines on the canvas if enabled.
- `get_snap_point(x, y, is_final=False)`: Returns nearest grid point for snapping.
- `on_grid_toggle()`, `on_grid_size_change()`: Grid UI event handlers.
- `open_layers_window()`: Opens the layers management window.
- `toggle_select()`: Activates/deactivates selection tool.
- `on_canvas_click(event)`, `on_canvas_drag(event)`, `on_canvas_release(event)`: Selection rectangle and group selection logic.
- `highlight_selected_shapes()`: Highlights selected shapes in green.
- `connect_machine()`: Connects to serial device, initializes crosshair, engrave module.
- `save_as_svg(filename)`, `save_svg()`: Exports current drawing as SVG.
- `activate_Paint_Gcode(event)`: Activates paint G-code drawing.
- `activate_text(e)`: Activates text tool.
- `Paint_Gcodeline(e)`: Draws a G-code line.
- `clear()`: Clears canvas and resets state.
- `exitt()`: Exits application.
- `Paint_Gcodecolor()`: Opens color picker for line color.
- `Oil_Paint_Gcode(e, gcode)`: Paints G-code with oil brush logic.
- `activate_gcode()`: Sends initialization G-code to machine.
- `Paint_Gcode(e, gcode)`: Main paint G-code drawing logic, sends commands to machine.
- `send_gcode(gcode_line)`: Sends a single G-code line to serial device.
- `Gbrush_refill(event)`: Refills brush by moving print head.
- `convert_and_print()`, `smooth_print()`, `zigzag_print()`: Convert images to G-code with different strategies.
- `plot_gcode(gcode_file)`: Plots G-code paths using matplotlib.
- `select_svg_file()`, `load_svg(...)`: SVG import and G-code generation.
- `print_gcode_paths()`, `open_gcode_file()`: G-code file handling and preview.
- `delete_selected()`, `delete_text(event)`: Deletes selected shapes/text.
- `select_line(event)`, `do_move(event)`, `start_move(event)`: Line selection and movement.
- `toggle_tool(tool_name)`: Switches active drawing tool.
- `handle_freehand_start/update/finish(event)`: Freehand drawing logic (delegated to module).
- `start_circle/update_circle/finish_circle(event)`: Circle drawing logic.
- `start_rectangle/update_rectangle/finish_rectangle(event)`: Rectangle drawing logic.
- `start_polygon/update_polygon/finish_polygon(event)`: Polygon drawing logic.
- `start_line/update_line/end_line(event)`: Line drawing logic.
- `open_drawing_tools()`: Opens drawing tools window.
- `update_rulers(scale_factor)`, `on_scale_change()`, `on_scroll()`, `apply_scale(new_scale)`: Canvas scaling and ruler logic.
- `Replicate()`: Replays recorded moves to machine.
- `create_crosshair()`, `update_machine_position()`, `update_machine_dot_position()`: Crosshair and live machine position updates.
- `preview_gcode_path()`: Previews G-code path before engraving.
- `send_gcode_buffered(gcode_lines)`: Buffered G-code sending.
- `open_settings_window()`: Opens settings/profile management window.
- `start_arc/update_arc/finish_arc(event)`: Arc drawing logic.
- `open_snap_tool_window()`: Opens snap tool settings window.
- `open_markers_window()`: Opens markers window.
- `clear_selection()`, `select_tool(tool_name)`: Selection and tool switching logic.
- `get_group_members(shape_id)`, `get_group_bounds(shape_ids)`, `highlight_group(shape_ids, highlight)`, `create_group_bounding_box(shape_ids)`: Group selection and bounding box logic.
- `draw_dotted_box(highlight_draw, box_coords)`: Draws dotted selection box.
- `get_font(font_name, size)`, `get_compatible_fonts()`: Font loading helpers.
- `load_last_used_settings()`, `save_last_used_settings(config_vars)`, `save_new_profile(config_vars)`, `update_profile(profile_name, config_vars)`, `load_profile_values(profile_name, config_vars)`, `load_profiles()`: Machine profile management.

### Main Classes
- **LayersWindow**: Layer management (from `layers_window` module).
- **TransformationTools**: Transformation tools (from `transformation_tools` module).
- **GroupTools**: Grouping tools (from `groups` module).
- **LineEditor**: Line editing tools (from `line_editor` module).
- **WebcamFeed**: Live webcam feed (from `webcam_feed` module).
- **MarkersWindow**: Marker management (from `markers` module).
- **Ai.ChatApp**: AI assistant window (from `Ai` module).

## Side Effects & Dependencies
- **File I/O**: Reads/writes SVG, G-code, JSON config/profile files.
- **Serial Communication**: Sends/receives commands to CNC/laser machine.
- **Image Processing**: Manipulates images for vectorization, G-code generation.
- **Sound**: Plays beep on connection.
- **Threading**: Used for live feed and possibly other async tasks.
- **Global State**: Many global variables for tool state, selection, machine connection, etc.

## Summary
Mechanicus is a feature-rich CNC/laser drawing and control application, integrating advanced drawing tools, SVG/G-code workflows, live machine control, and profile management. Its modular design allows for extensibility and separation of concerns, while its event-driven GUI provides a responsive user experience for both design and machine operation.
