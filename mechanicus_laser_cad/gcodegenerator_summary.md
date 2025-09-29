# gcodegenerator.py Summary

## Purpose
`gcodegenerator.py` is responsible for converting SVG vector graphics into G-code instructions for CNC/laser machines. It parses SVG files, extracts geometric shapes, applies scaling and transformations, optimizes the drawing path, and generates machine-ready G-code.

## Main Functions & Their Roles

### 1. `get_shapes(svg_path, auto_scale=False, scale_factor=scaleF, offset_x=x_offset, offset_y=y_offset)`
- **Purpose**: Parses an SVG file and extracts all supported shapes (rect, circle, ellipse, line, polyline, polygon, path).
- **Logic**:
  - Uses `xml.etree.ElementTree` to parse SVG XML.
  - Determines SVG width/height, applies scaling and offset.
  - For each shape, uses the corresponding class from `shapes.py` to extract path data and transformation matrix.
  - Generates a list of coordinate tuples for each shape, applying unit conversions and offsets.
  - Returns a list of shapes, each as a list of (x, y) points.
- **Dependencies**: `shapes.py`, `config3.py`, `config.py`, `utils.py`, `re`, `sys`, `importlib`.

### 2. `g_string(x, y, z=False, prefix="G1", p=3)`
- **Purpose**: Formats a G-code command string for a given (x, y, z) coordinate.
- **Logic**: Returns a string like `G1 X... Y... Z...` or `G1 X... Y...` with specified precision.

### 3. `shapes_2_gcode(shapes)`
- **Purpose**: Converts a list of shapes (coordinate lists) into a sequence of G-code commands.
- **Logic**:
  - Reads a header from `header.txt` and adds initial feed rate and preamble.
  - For each shape, generates G-code for moving to start, drawing the shape, and lifting the tool at the end.
  - Handles connected shapes for efficient pathing.
  - Adds homing commands at the end.
  - Uses `timer()` from `utils.py` for performance logging.
- **Dependencies**: `header.txt`, `config3.py`, `utils.py`.

### 4. `generate_gcode(svg_path, gcode_path)`
- **Purpose**: Main entry point for generating G-code from an SVG file and saving it to disk.
- **Logic**:
  - Calls `get_shapes()` to extract shapes from SVG.
  - Optionally optimizes the path using `optimise_path()` from `optimise.py`.
  - Converts shapes to G-code using `shapes_2_gcode()`.
  - Writes the G-code to the specified output file.
  - Prints summary statistics (distances, optimization factor).
- **Dependencies**: `optimise.py`, `config3.py`, `utils.py`.

### 5. `write_file(output, commands)`
- **Purpose**: Writes a list of G-code command strings to a file.
- **Logic**: Iterates over commands and writes each to the output file. Uses `timer()` for performance logging.

## External Modules & Files Used
- **`shapes.py`**: Shape classes for SVG parsing and path extraction.
- **`config.py`, `config3.py`**: Configuration values (scaling, offsets, machine settings).
- **`optimise.py`**: Path optimization algorithms.
- **`utils.py`**: Utility functions (e.g., `timer`).
- **`header.txt`**: G-code header template.

## Design Patterns & Notable Features
- **Modular Parsing**: Each SVG shape type is handled by a class in `shapes.py`.
- **Path Optimization**: Optionally reorders shapes for minimal travel distance.
- **Configurable Scaling/Offsets**: Uses config files for machine-specific parameters.
- **Performance Logging**: Uses timers to log execution time for key steps.
- **Recursion Limit**: Increases recursion limit for complex SVGs.
- **Reloads Configs**: Uses `importlib.reload()` to ensure latest config values.

## Side Effects & Dependencies
- **File I/O**: Reads SVG and header files, writes G-code output.
- **Prints to Console**: Logs progress and statistics.
- **Global Configs**: Relies on global config values for scaling, offsets, feed rates, etc.

## Summary
`gcodegenerator.py` is a core utility for converting SVG vector graphics into optimized G-code for CNC/laser machines. It is highly modular, configurable, and integrates with other Mechanicus modules for shape parsing, path optimization, and machine-specific settings.
