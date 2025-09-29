
# Mechanicus Laser CAD

![Mechanicus Laser CAD Screenshot](Screenshot1.jpg)

Mechanicus Laser CAD is a comprehensive graphical application for designing, editing, and controlling laser engraving and cutting jobs. It is designed for hobbyists, makers, and professionals who want a powerful, flexible, and user-friendly tool for working with laser engravers.

## Purpose
Mechanicus Laser CAD provides a full-featured environment for:
- Creating and editing vector graphics for laser engraving/cutting
- Importing and exporting SVG files
- Generating G-code for laser machines
- Directly controlling and sending jobs to a connected laser engraver
- Managing layers, groups, and advanced drawing tools
- Integrating AI-powered features for text and image processing

## Main Features & Functions

### 1. Drawing & Editing Tools
- **Line, Circle, Rectangle, Polygon, Arc tools**: Draw and edit basic shapes
- **Freehand and Spiral tools**: Create complex paths and artistic designs
- **Selection and Grouping**: Select, group, and manipulate multiple shapes
- **Snap Tools**: Snap to grid, endpoints, midpoints, and centers for precision
- **Layer Management**: Organize objects into layers for complex designs
- **Transformation Tools**: Move, scale, rotate, and mirror objects
- **Markers and Guides**: Add reference points and guides for alignment

### 2. File Import/Export
- **SVG Import/Export**: Bring in external designs or export your work for other tools
- **Image Import**: Import raster images for tracing or engraving
- **G-code Export**: Generate G-code compatible with most GRBL-based laser engravers

### 3. Laser Control
- **Serial Connection**: Connect to your laser engraver via serial port
- **Live Preview**: Visualize toolpaths and simulate engraving
- **Send G-code**: Stream G-code directly to the machine
- **Manual Controls**: Move the laser head, set origin, and control laser power

### 4. AI & Advanced Features
- **AI Chat**: Integrated AI assistant for help, tips, and automation (requires Hugging Face API key)
- **Shape Detection**: Detect and vectorize shapes from imported images
- **Undo/Redo**: Full undo/redo support for all actions

## Required Python Modules
Install these modules before running the app:

```
pip install pillow opencv-python numpy matplotlib pyserial tkcolorpicker svg.path keyboard
```

- `pillow` (PIL): Image processing
- `opencv-python`: Image manipulation and shape detection
- `numpy`: Numerical operations
- `matplotlib`: Plotting and visualization
- `pyserial`: Serial communication with laser engraver
- `tkcolorpicker`: Color picker dialog
- `svg.path`: SVG path parsing
- `keyboard`: Keyboard event handling
- `dxfgrabber`: DXF file support

## How to Start the App
1. **Clone or download the repository**
2. **Install the required modules** (see above)
3. **Run the main application file:**
   ```
   python "Mechanicus Main app File.py"
   ```
4. The GUI will launch. You can now create, import, or edit designs.

## Connecting to a Laser Engraver
1. Connect your laser engraver to your computer via USB.
2. In the app, select the correct serial port (usually via a dropdown or settings menu).
3. Set the appropriate baud rate (commonly 115200 for GRBL machines).
4. Use the app's controls to move the laser, set origin, and send G-code.

**Note:** Always ensure your laser engraver is properly configured and never leave it unattended while operating.

## File Structure Overview
- `Mechanicus Main app File.py`: Main application entry point
- `Ai.py`: AI chat and automation features
- `gcodegenerator.py`: G-code generation logic
- `engrave.py`: Laser control and G-code streaming
- `svg_import.py` / `svg_export.py`: SVG file handling
- `freehand_tool.py`, `Spiral.py`, `line_editor.py`: Drawing tools
- `groups.py`, `layers_window.py`: Group and layer management
- `config.py`, `Mechanicus_Config.py`: Configuration files
- `utils.py`, `grid.py`, `snaptools.py`: Utility and snapping functions
- `image_handler.py`, `image_import.py`: Image processing

## Support
For issues, feature requests, or contributions, please open an issue or pull request on the [GitHub repository](https://github.com/JoeSzeles/Mechanicus_Laser_CAD).

---
**Enjoy creating with Mechanicus Laser CAD!**
