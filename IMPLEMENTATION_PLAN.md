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

## Phase 4: Markers & Guides
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

### Test Checklist Phase 4:
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

## Phase 5: Transform Tools
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

### Test Checklist Phase 5:
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

## Phase 6: Layers & Import/Export
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

### Test Checklist Phase 6:
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

## Phase 7: Undo/Redo System
**Goal**: Complete undo/redo across all tools

### Implementation:
- Command pattern for all actions
- Group multi-step gestures (mousedown → move → up)
- Stack-based history (max 50 commands)
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)

### Commands to Support:
- Draw shape (any tool)
- Transform (scale/rotate/mirror/clone)
- Add marker/guide
- Delete shape
- Layer operations

### Acceptance Criteria:
- Undo reverses last action
- Redo reapplies undone action
- Keyboard shortcuts work
- All tools are undoable
- Undo preserves canvas state correctly

### Test Checklist Phase 7:
- [ ] Undo line draw with Ctrl+Z
- [ ] Redo line draw with Ctrl+Y
- [ ] Undo circle, rectangle, polygon, arc, freehand
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

4. **Transform Test**:
   - Draw shape → Scale → Undo → Rotate → Undo → Mirror → Undo → Clone → Undo → Verify all undo/redo

5. **Performance Test**:
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
✅ All 7 phases completed and tested
✅ All tools from Python app working in React
✅ Grid is grey (#808080), not white
✅ Snap system works with visual indicators
✅ All drawing tools functional
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
- Snap System: `mechanicus_laser_cad/snaptools.py`
- Markers System: `mechanicus_laser_cad/markers.py`
- Transform Tools: `mechanicus_laser_cad/transformation_tools.py`
