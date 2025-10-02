# Mechanicus CAD - Complete Rebuild Implementation Plan

## Overview
Complete rebuild of the React CAD interface to match the sophisticated Python Mechanicus application architecture. This plan translates all functionality from the Python tkinter application to a modern React/Konva web application.

## Tech Stack
- **Frontend Canvas**: react-konva (Konva.js React wrapper)
- **State Management**: Zustand (global CAD state store)
- **Spatial Indexing**: rbush (for snap calculations)
- **UI Framework**: React with custom dark theme
- **Coordinate System**: World coords in mm, converted via mmToPx * zoom

## Architecture

### State Store (Zustand)
```
- shapes: Array of all drawn shapes with metadata
- layers: Layer definitions and visibility
- selection: Currently selected shapes
- tools: Active tool and tool settings
- snap: Snap settings (grid, endpoint, midpoint, center)
- machineProfile: Bed size, mmToPx conversion
- viewport: Pan, zoom, scroll position
- undo: Command stack for undo/redo
```

### Konva Layers (Bottom to Top)
1. Grid/Rulers Layer (fixed, non-interactive)
2. Guides/Markers Layer (draggable guides and markers)
3. Shapes Layer (all drawn shapes)
4. Overlay/Indicators Layer (snap indicators, previews)

### Popup Window System
Replace single toolbar with floating, draggable popup windows:
- **Drawing Tools Window**: Line, Circle, Rectangle, Polygon, Arc, Freehand
- **Snap Tools Window**: Grid, Endpoint, Midpoint, Center toggles
- **Markers Window**: Center points, Line markers, H/V Guides
- **Transform Tools Window**: Tabbed (Scale, Mirror, Clone, Rotate)
- **Line Editor Tools Window**: Fillet, Chamfer, Trim, Extend, Adjust, Rotate
- **Shape Properties Window**: Line color, fill color, line width
- **Text & Font Tools Window**: Text creation, font selection, path conversion
- **Layers Window**: Layer management panel

### Color Scheme (From Python)
- Shell background: `#263d42`
- Panel background: `#2b2b2b`
- Grid color: `#808080` (grey, NOT white)
- Accent green: `#00FF00` or `#4CAF50`
- Snap indicators: Red (endpoint), Blue (midpoint/center), Green (grid)

## Phase 1: Foundation & Infrastructure
**Goal**: Stable viewport with correct colors, machine profiles, popup framework

### Tasks:
1. Install dependencies: `react-konva konva zustand rbush`
2. Create Zustand CAD store with all state slices
3. Load machine profile system (read from machine_profiles/last_used.json)
4. Implement Konva Stage with Grid layer (grey #808080)
5. Add rulers with mm units (horizontal/vertical)
6. Implement pan (Space + drag) and zoom (wheel)
7. Create popup window framework (draggable, toggleable)
8. Apply dark theme colors throughout

### Acceptance Criteria:
- Grid displays in grey (#808080), not white
- Rulers show mm units based on machine profile
- Pan and zoom work smoothly
- Popup windows can open, close, and drag
- No console errors

### Test Checklist Phase 1:
- [ ] Login with test user successful
- [ ] Grid is grey (#808080)
- [ ] Rulers display mm units correctly
- [ ] Pan with Space+drag works
- [ ] Zoom with mouse wheel works
- [ ] Popup windows toggle on/off
- [ ] Dark theme applied (#263d42, #2b2b2b)
- [ ] Check browser console for errors
- [ ] Check workflow logs for backend errors

---

## Phase 2: Snap System Core
**Goal**: Complete snapping engine with visual feedback

### Tasks:
1. Implement rbush spatial index for shapes
2. Create snap calculation engine with tolerance
3. Implement grid snapping (when grid visible)
4. Implement endpoint snapping (detect line endpoints)
5. Implement midpoint snapping (detect line midpoints)
6. Implement center snapping (circles, rectangles, polygons)
7. Create visual snap indicators (colored dots)
8. Add snap type labels near cursor
9. Create Snap Tools popup window with toggles

### Snap Indicator Colors:
- Endpoint: Red dot + "Endpoint" label
- Midpoint: Blue dot + "Midpoint" label
- Center: Blue dot + "Center" label
- Grid: Green dot + "Grid" label

### Acceptance Criteria:
- Each snap type works independently
- Visual indicators show correct colors
- Tolerance scales with zoom level
- Snap Tools window controls work
- Snap indicators excluded from snapping themselves

### Test Checklist Phase 2:
- [ ] Grid snap works when grid visible
- [ ] Endpoint snap shows red indicator
- [ ] Midpoint snap shows blue indicator
- [ ] Center snap shows blue indicator
- [ ] Labels display near cursor
- [ ] Tolerance adjusts with zoom
- [ ] Snap toggles in window work
- [ ] Check logs for errors

---

## Phase 3: Drawing Tools
**Goal**: All drawing tools from tools.py working with snap integration

### Drawing Tools Window Layout:
```
[Select] [Line] [Circle]
[Rectangle] [Polygon] [Arc] [Freehand]
```

### Each Tool Implementation:

#### Line Tool (First Priority)
- Click to start (green triangle marker)
- Drag to preview (dashed line)
- Release to create (solid line)
- Snap integration at both points

#### Circle Tool
- Click center (green center marker)
- Drag radius (red radius marker)
- Preview circle updates
- Snap to endpoints/grid for center

#### Rectangle Tool
- Click corner (green start marker)
- Drag opposite corner
- Preview rectangle
- Snap integration

#### Polygon Tool (Hexagon)
- Click center
- Drag for radius
- Creates 6-sided polygon
- Snap integration

#### Arc Tool
- Click center
- Drag for radius and angle
- Creates arc (90° extent)
- Snap integration

#### Freehand Tool
- Click and drag to draw
- Creates continuous line path
- Optional snap at start/end

### Acceptance Criteria:
- Each tool creates proper shapes
- Green start markers appear
- Preview lines/shapes visible during drag
- Snap integration works for all tools
- Shapes tagged for layer system
- Shapes indexed for snapping

### Test Checklist Phase 3:
- [ ] Line tool: start marker, preview, snap at both ends
- [ ] Circle tool: center marker, radius marker, snap
- [ ] Rectangle tool: start marker, preview, snap
- [ ] Polygon tool: creates hexagon, snap
- [ ] Arc tool: creates arc, snap
- [ ] Freehand tool: draws smooth path
- [ ] All shapes appear in correct layer
- [ ] Check logs after each tool test

---

## Phase 4: Line Editor Tools
**Goal**: Professional line editing tools for CAD precision work

### Line Editor Tools Window Layout:
```
Size (mm): [___]

[Fillet] [Chamfer]
[Trim] [TrimMid]
[Extend] [Adjust Line] [✓] Snap
[Rotate] [✓] 5° Snap
Angle (°): [___]
[CCW] [Set Point] [CW]
[Clear Selection]
```

### Tool Implementations:

#### Fillet Tool
- **Purpose**: Creates smooth rounded corners between two intersecting lines
- **Workflow**: 
  1. Click first line (turns red)
  2. Click second line (turns red)
  3. Auto-calculates intersection
  4. Creates arc with specified radius
  5. Trims original lines to arc tangent points
- **Input**: Radius in mm (from Size field)
- **Visual**: Red highlight on selected lines, arc preview

#### Chamfer Tool
- **Purpose**: Creates beveled/angled corners between two intersecting lines
- **Workflow**:
  1. Click first line (turns red)
  2. Click second line (turns red)
  3. Auto-calculates intersection
  4. Creates straight bevel line
  5. Trims original lines to bevel endpoints
- **Input**: Chamfer distance in mm (from Size field)
- **Visual**: Red highlight on selected lines, chamfer preview

#### Trim Tool
- **Purpose**: Trims line segment at intersection point (keeps one side)
- **Workflow**:
  1. Click first line (boundary, turns red)
  2. Click second line (boundary, turns red)
  3. Finds intersection point
  4. Click on segment to REMOVE (that segment is trimmed away)
  5. Keeps the opposite segment from click point
- **Visual**: Red highlight on selected lines, green flash on segment to keep

#### TrimMid Tool
- **Purpose**: Trims middle portion of lines between two boundary lines
- **Workflow**:
  1. Click first boundary line (turns red)
  2. Click second boundary line (turns red)
  3. Click crossing line(s) to trim middle section
  4. Keeps segments outside boundaries
  5. Can trim multiple crossing lines in succession
- **Visual**: Red boundary lines, segments between boundaries removed

#### Extend Tool
- **Purpose**: Extends line endpoints to meet boundary lines/intersections
- **Workflow**:
  1. Click boundary line (turns red)
  2. Click line to extend (turns green)
  3. Extends clicked line's nearest endpoint to boundary
  4. Creates new line segment to intersection point
- **Visual**: Red boundary line, green line being extended, dashed preview

#### Adjust Line Tool
- **Purpose**: Interactively drag line endpoints with snap support
- **Workflow**:
  1. Click near line endpoint (tolerance: 20px)
  2. Endpoint shows blue circle marker
  3. Drag endpoint to new position
  4. If Snap enabled: shows green diamond markers at snap points
  5. Release to finalize
- **Snap**: Snaps to other line endpoints within 10px (scaled by zoom)
- **Visual**: Blue endpoint marker (white fill), green snap diamonds

#### Rotate Tool
- **Purpose**: Rotate shapes around a center point
- **Workflow**:
  1. Click shape to select (turns green)
  2. Auto-calculates rotation center (shape center)
  3. Shows purple rotation center marker
  4. Drag mouse to rotate, or
  5. Enter angle and click CCW/CW buttons
  6. Angle display shows current rotation
- **Angle Snap**: Optional 5° increments when enabled
- **Manual Rotation**: Enter angle, click CCW (counter-clockwise) or CW (clockwise)
- **Visual**: Green selected shape, purple rotation center, angle label

#### Clear Selection
- **Purpose**: Deselects all currently selected lines/shapes
- **Action**: One-click to clear all selections and reset tool state
- **Visual**: All highlighted shapes return to original colors

### State Management:
- Selected lines tracked with green/red highlights
- Original colors/widths stored for restoration
- Undo/redo integration for all operations
- Snap system integration for Adjust and Rotate tools

### Acceptance Criteria:
- All tools work with line intersection detection
- Radius/distance input scales with canvas zoom
- Trimmed/extended lines maintain original properties (color, width)
- Adjust tool snaps to endpoints when enabled
- Rotate tool supports both drag and manual angle input
- Clear Selection resets all visual states

### Test Checklist Phase 4:
- [ ] Fillet: creates arc between two lines with specified radius
- [ ] Chamfer: creates bevel between two lines
- [ ] Trim: removes correct segment based on click position
- [ ] TrimMid: trims middle sections between boundaries
- [ ] Extend: extends line to meet boundary intersection
- [ ] Adjust Line: drag endpoint with blue marker visible
- [ ] Adjust Line: snap to endpoints shows green diamonds
- [ ] Rotate: select shape, shows rotation center
- [ ] Rotate: drag to rotate with 5° snap
- [ ] Rotate: manual angle input with CCW/CW buttons
- [ ] Clear Selection: deselects all lines
- [ ] All operations appear in undo/redo stack
- [ ] Check logs for errors

---

## Phase 4.5: Shape Properties Window
**Goal**: Control visual properties of shapes (colors and stroke width)

### Shape Properties Window Layout:
```
=== Shape Properties ===

[Select Shape]

Line Color:  [████] [Pick Color]
Fill Color:  [████] [Pick Color]
Line Width:  [___] px

[Apply] [Reset]
```

### Property Controls:

#### Line Color (Stroke Color)
- **Purpose**: Set the outline/stroke color for shapes
- **Applies To**: All shapes (lines, circles, rectangles, polygons, arcs)
- **UI**: Color preview swatch + color picker button
- **Picker**: HTML5 color picker or custom RGB picker
- **Default**: Black (#000000)

#### Fill Color
- **Purpose**: Set the interior fill color for closed shapes
- **Applies To**: Circles, rectangles, polygons (not lines or arcs)
- **UI**: Color preview swatch + color picker button
- **Special**: Option for "No Fill" (transparent)
- **Default**: No fill (transparent)

#### Line Width
- **Purpose**: Set stroke width/thickness
- **Units**: Pixels (scaled by zoom for consistency)
- **Range**: 1-20 px
- **UI**: Number input field
- **Default**: 1 px

### Workflow:
1. Click "Select Shape" button
2. Click any shape on canvas
3. Shape highlights in green
4. Current properties populate fields
5. Modify color/width values
6. Click "Apply" to update shape
7. Changes reflected immediately
8. Click "Reset" to restore original values

### Color Picker Integration:
- Use browser native `<input type="color">` or
- Custom RGB color picker with:
  - RGB sliders (0-255)
  - Hex color input
  - Color preview
  - Recent colors palette

### Property Persistence:
- Properties stored in shape metadata
- New shapes inherit last-used properties
- Properties preserved during transform operations
- Undo/redo tracks property changes

### Acceptance Criteria:
- Can select any shape and view its properties
- Line color changes update stroke immediately
- Fill color changes update interior (closed shapes only)
- Line width changes visible at all zoom levels
- "No Fill" option works for transparent interiors
- Changes are undoable/redoable

### Test Checklist Phase 4.5:
- [ ] Select line, change line color, verify update
- [ ] Select circle, change line color and fill color
- [ ] Select rectangle, set fill to "No Fill"
- [ ] Change line width from 1 to 5, verify thickness
- [ ] Select polygon, change all properties
- [ ] Apply changes, verify immediate update
- [ ] Reset button restores original values
- [ ] Undo property change with Ctrl+Z
- [ ] Properties persist after zoom/pan
- [ ] Check logs for errors

---

## Phase 4.75: Text & Font Tools
**Goal**: Professional text creation and SVG path conversion for laser engraving

### Text & Font Tools Window Layout:
```
=== Text & Font Tools ===

Text: [_________________]
      [_________________]

Font:     [Impact ▼]
Size:     [___] pt
Color:    [████] [Pick]

[Place Text]
[Edit Selected]
[Convert to Paths]
[Delete Text]
```

### Tool Features:

#### Text Input
- **Purpose**: Multi-line text entry for canvas placement
- **UI**: Multi-line text area (2-3 lines visible)
- **Features**:
  - Line breaks supported
  - UTF-8 character support
  - Real-time preview (optional)
  - Clear after placement

#### Font Selector
- **Purpose**: Choose system font for text rendering
- **UI**: Dropdown menu with font previews
- **Fonts**: 
  - System fonts (Impact, Arial, Times New Roman, Courier, etc.)
  - Web-safe fonts
  - Custom fonts (optional)
- **Preview**: Each option shows font name in that font style
- **Default**: Impact

#### Font Size
- **Purpose**: Set text size in points
- **Units**: Points (pt) - standard typography unit
- **Range**: 8-200 pt
- **UI**: Number input field
- **Default**: 50 pt
- **Scaling**: Respects canvas zoom level

#### Text Color
- **Purpose**: Set text fill color
- **UI**: Color preview swatch + picker button
- **Picker**: Same color picker as Shape Properties
- **Default**: Black (#000000)
- **Note**: Shares fill color picker from main app

### Workflow:

#### Place Text
1. Type text in text input area
2. Select font from dropdown
3. Set size (pt) and color
4. Click "Place Text" button
5. Click on canvas to position text
6. Text appears at click point (top-left anchor)
7. Text input clears automatically

#### Edit Selected Text
1. Click existing text on canvas to select
2. Text highlights in red
3. Original text appears in input area
4. Original font, size, color populate fields
5. Modify text/properties
6. Click "Edit Selected" to apply changes
7. Text updates immediately

#### Move Text
- **Method**: Click and drag selected text (red highlight)
- **Behavior**: Text follows mouse while dragging
- **Snap**: Optional snap to grid/guides
- **Release**: Finalizes new position

#### Convert to Paths
- **Purpose**: Convert text to SVG paths for laser cutting
- **Workflow**:
  1. Select text on canvas (red highlight)
  2. Click "Convert to Paths" button
  3. Text converted to vector paths
  4. Original text element removed
  5. Path group created with same appearance
  6. Paths editable like normal shapes
- **Use Case**: Laser engraving requires vector paths, not font-based text
- **Irreversible**: Cannot convert paths back to editable text

#### Delete Text
- **Purpose**: Remove selected text element
- **Workflow**:
  1. Select text on canvas
  2. Click "Delete Text" button (or press Delete key)
  3. Text removed from canvas
- **Undo**: Deletion is undoable

### Text Element Storage:
```javascript
{
  id: 'text_123',
  type: 'text',
  text: 'Hello World',
  x: 100,
  y: 200,
  font: 'Impact',
  size: 50,
  color: '#000000',
  base_x: 20,  // mm in world coords
  base_y: 40,  // mm in world coords
}
```

### Text Scaling Behavior:
- Text size scales with canvas zoom
- Position scales with pan/zoom
- Font metrics calculated at current zoom
- SVG export preserves original size

### Path Conversion Details:
- Uses browser's font rendering engine
- Converts each character to SVG path
- Preserves font, size, position
- Creates path group with same ID structure
- Paths become regular shapes (editable, transformable)

### Acceptance Criteria:
- Text can be placed anywhere on canvas
- All system fonts render correctly
- Font size scales with zoom appropriately
- Text color picker works
- Selected text can be edited and updated
- Text can be dragged to new position
- Convert to Paths creates accurate vector outlines
- Converted paths are editable as shapes
- Delete removes text cleanly
- All operations are undoable

### Test Checklist Phase 4.75:
- [ ] Type text, select font, place on canvas
- [ ] Place multi-line text (with line breaks)
- [ ] Change font size from 20 to 100 pt
- [ ] Change text color using color picker
- [ ] Select existing text, edit content
- [ ] Select text, change font and size, apply
- [ ] Drag text to new position
- [ ] Convert text to paths, verify vector conversion
- [ ] Edit converted paths like normal shapes
- [ ] Delete text with button and Delete key
- [ ] Undo text placement
- [ ] Undo text-to-path conversion
- [ ] Text scales correctly with zoom
- [ ] Check logs for errors

---

## Phase 5: Markers & Guides
**Goal**: Markers window with center points, line markers, guides

### Markers Window Layout:
```
=== Markers ===
[Center Point] [Line Marker]
[✓] Enable Snapping
[Hide Markers] [Clear Markers]

=== Guides ===
[Add Horizontal] [Add Vertical]
[Lock Guides] [Hide Guides]
[Clear Guides]
```

### Center Point Markers:
- Double circle design (outer + inner dot)
- Snap to shape centers/endpoints/grid
- Draggable when unlocked
- Visual: Outer circle + filled inner dot

### Line Markers:
- Two-click to create (start → end)
- Shows distance/angle
- Start and end point markers
- Snap integration

### Guides:
- Horizontal guides (drag Y position)
- Vertical guides (drag X position)
- Lock/unlock to prevent movement
- Show/hide toggle
- Clear all function

### Acceptance Criteria:
- Center point markers show double circle
- Line markers measure correctly
- Guides can be added, moved, locked
- All marker types snap correctly
- Show/hide works independently

### Test Checklist Phase 5:
- [ ] Center point marker: double circle visible
- [ ] Center point snaps to shapes
- [ ] Line marker: two-click creation works
- [ ] Line marker shows start/end points
- [ ] Horizontal guide adds and drags
- [ ] Vertical guide adds and drags
- [ ] Lock guides prevents movement
- [ ] Hide/show toggles work
- [ ] Clear functions work
- [ ] Check logs for errors

---

## Phase 6: Transform Tools
**Goal**: Transform Tools window with Scale, Mirror, Clone, Rotate

### Transform Tools Window (Tabbed):
```
[Scale] [Mirror] [Clone] [Rotate]

Scale Tab:
[Select] [Deselect] [Reset] [Apply]
[✓] Keep Aspect Ratio
Size X (mm): [___] Size Y (mm): [___]

Mirror Tab:
[Select] [Axis] [Deselect] [Reset]
[Flip Horizontal] [Flip Vertical]
[✓] Create Copy

Clone Tab:
[Select] [Clone] [Deselect] [Delete]
Quick Clone: Alt + Click & Drag

Rotate Tab:
[Select] [Center] [Deselect] [Reset]
Angle (°): [___] [Apply]
[✓] Snap to 5°
[Rotate -90°] [Rotate +90°]
```

### Scale Tool:
- Select shape → bounding box with 8 handles
- Drag handles to scale
- Optional aspect ratio lock
- Manual size input (mm)

### Mirror Tool:
- Select shape
- Choose axis (H/V or custom line)
- Preview mirrored position
- Option to create copy or replace

### Clone Tool:
- Select and drag to clone
- Alt+click+drag for quick clone
- Creates exact duplicate
- Maintains all properties

### Rotate Tool:
- Select shape
- Set rotation center (default: shape center)
- Drag to rotate or enter angle
- Optional 5° snap
- Quick -90°/+90° buttons

### Acceptance Criteria:
- Scale handles appear on selection
- Mirror preview shows before apply
- Clone creates exact duplicate
- Rotate center can be set manually
- All transforms are undoable

### Test Checklist Phase 6:
- [ ] Select shape shows bbox with handles
- [ ] Scale handles resize correctly
- [ ] Aspect ratio lock works
- [ ] Mirror horizontal/vertical works
- [ ] Mirror copy option works
- [ ] Clone button duplicates shape
- [ ] Alt+drag quick clone works
- [ ] Rotate with manual angle works
- [ ] Rotate with drag works
- [ ] Quick rotate buttons work
- [ ] All transforms can be undone
- [ ] Check logs for errors

---

## Phase 7: Layers & Import/Export
**Goal**: Layer management and file operations

### Layers Window:
```
[+] New Layer [🗑] Delete
[Layer 1] [👁] [🔒]
[Layer 2] [👁] [🔒]
(drag to reorder)

Assign selected to: [Layer ▼]
```

### Layer Features:
- Create/rename/delete layers
- Visibility toggle per layer
- Lock toggle per layer
- Drag to reorder layers
- Assign shapes to layers

### SVG Import/Export:
- Export: Convert shapes to SVG paths
- Import: Parse SVG and create shapes
- Preserve layer structure

### G-code Generation:
- Port from gcodegenerator.py
- Convert shapes to toolpaths
- Support laser on/off commands
- Export .gcode file

### Image Import:
- Import PNG/JPEG to background layer
- Maintain aspect ratio
- Position and scale image

### Acceptance Criteria:
- Layers can be created/renamed/deleted
- Visibility toggle hides/shows layer shapes
- Lock prevents editing layer shapes
- SVG export and re-import works
- G-code generates for basic shapes

### Test Checklist Phase 7:
- [ ] Create new layer
- [ ] Rename layer
- [ ] Delete layer
- [ ] Toggle layer visibility
- [ ] Lock/unlock layer
- [ ] Reorder layers by drag
- [ ] Assign shape to layer
- [ ] Export SVG
- [ ] Import SVG (round-trip test)
- [ ] Generate G-code for simple shape
- [ ] Import image to background
- [ ] Check logs for errors

---

## Phase 8: Undo/Redo System
**Goal**: Complete undo/redo across all tools

### Implementation:
- Command pattern for all actions
- Group multi-step gestures (mousedown → move → up)
- Stack-based history (max 50 commands)
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)

### Commands to Support:
- Draw shape (any tool)
- Transform (scale/rotate/mirror/clone)
- Line editor operations (fillet/chamfer/trim/extend)
- Shape property changes (color/width)
- Text operations (place/edit/convert/delete)
- Add marker/guide
- Delete shape
- Layer operations

### Acceptance Criteria:
- Undo reverses last action
- Redo reapplies undone action
- Keyboard shortcuts work
- All tools are undoable
- Undo preserves canvas state correctly

### Test Checklist Phase 8:
- [ ] Undo line draw with Ctrl+Z
- [ ] Redo line draw with Ctrl+Y
- [ ] Undo circle, rectangle, polygon, arc, freehand
- [ ] Undo fillet operation
- [ ] Undo chamfer operation
- [ ] Undo trim operation
- [ ] Undo extend operation
- [ ] Undo shape property change
- [ ] Undo text placement
- [ ] Undo text-to-path conversion
- [ ] Undo scale operation
- [ ] Undo rotate operation
- [ ] Undo mirror operation
- [ ] Undo clone operation
- [ ] Undo marker/guide addition
- [ ] Undo delete operation
- [ ] Undo layer creation
- [ ] Multi-step undo (10+ operations)
- [ ] Redo after undo works correctly
- [ ] Check logs for errors

---

## Final Integration Testing

### Comprehensive Test Scenarios:
1. **Full Drawing Workflow**:
   - Login → Create project → Draw shapes with all tools → Add markers → Add guides → Transform shapes → Export SVG → Import SVG → Generate G-code

2. **Snap System Test**:
   - Draw line → Draw circle snapping to line endpoint → Draw rectangle snapping to circle center → Verify all snaps work

3. **Layer System Test**:
   - Create 3 layers → Draw shapes on each → Toggle visibility → Lock layers → Reorder layers → Verify behavior

4. **Line Editing Test**:
   - Draw two intersecting lines → Fillet corner → Undo → Chamfer corner → Undo → Trim line → Undo → Extend line → Verify all operations

5. **Text Workflow Test**:
   - Place text → Edit text → Change font/size/color → Move text → Convert to paths → Edit paths → Export SVG

6. **Transform Test**:
   - Draw shape → Scale → Undo → Rotate → Undo → Mirror → Undo → Clone → Undo → Verify all undo/redo

7. **Properties Test**:
   - Draw shapes → Change line colors → Change fill colors → Change line widths → Verify persistence → Undo changes

8. **Performance Test**:
   - Draw 100+ shapes → Pan/zoom → Select/transform → Verify no lag → Check memory usage

### Error Monitoring:
- Check browser console after each test
- Check backend workflow logs
- Check frontend workflow logs
- Monitor for memory leaks
- Verify no broken features after each phase

---

## Test User Credentials
- **Username**: testuser
- **Email**: test@mechanicus.dev
- **Password**: Test123!

Use this account for all testing throughout implementation phases.

---

## Success Criteria
✅ All 8 phases completed and tested
✅ All tools from Python app working in React
✅ Grid is grey (#808080), not white
✅ Snap system works with visual indicators
✅ All drawing tools functional
✅ Line editor tools complete (fillet, chamfer, trim, extend)
✅ Shape properties editable (color, fill, width)
✅ Text & font tools working with path conversion
✅ Markers and guides working
✅ Transform tools complete
✅ Layers system working
✅ Import/export functional
✅ Undo/redo across all operations
✅ No console errors
✅ No backend errors in logs
✅ Dark theme applied correctly
✅ Performance acceptable with 100+ shapes

---

## References
- Python Main App: `mechanicus_laser_cad/Mechanicus Main app File copy 13.py`
- Tools Implementation: `mechanicus_laser_cad/tools.py`
- Line Editor: `mechanicus_laser_cad/line_editor.py`
- Snap System: `mechanicus_laser_cad/snaptools.py`
- Markers System: `mechanicus_laser_cad/markers.py`
- Transform Tools: `mechanicus_laser_cad/transformation_tools.py`
