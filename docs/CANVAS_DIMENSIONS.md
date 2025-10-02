
# Canvas Dimensions Documentation

## Overview
The Mechanicus CAD system uses a flexible canvas sizing system that converts millimeter measurements to pixel coordinates for rendering on screen.

## Where Canvas Dimensions Are Set

### 1. Frontend Store (Primary Source)
**File:** `frontend/src/store/cadStore.js`

```javascript
machineProfile: {
  bedSizeX: 300,      // Width in millimeters
  bedSizeY: 200,      // Height in millimeters
  mmToPx: 3.7795275591 // Conversion ratio: mm to pixels
}
```

### 2. Canvas Rendering
**File:** `frontend/src/components/CADInterface.jsx`

The actual canvas size is calculated in the component:

```javascript
const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx
```

**Example Calculation:**
- Width: 300mm × 3.7795275591 = ~1,134 pixels
- Height: 200mm × 3.7795275591 = ~756 pixels

### 3. Backend/Python Configuration
**File:** `mechanicus_laser_cad/machine_profiles/last_used.json`

```json
{
  "bed_max_x": "370",
  "bed_max_y": "700"
}
```

Note: The Python backend uses different default values (370×700mm) which can be overridden per machine profile.

## How to Change Canvas Dimensions

### Method 1: Via Machine Settings Popup (Recommended)
1. Click the **Machine Settings** button (gear icon in top toolbar)
2. Go to **Configuration** tab
3. Scroll to **Workspace Settings** section
4. Modify:
   - **Bed Max X (mm)** - Canvas width
   - **Bed Max Y (mm)** - Canvas height
5. Click **Save Configuration**

### Method 2: Programmatically via Store
```javascript
useCadStore.getState().setMachineProfile({
  bedSizeX: 400,  // New width in mm
  bedSizeY: 300,  // New height in mm
  mmToPx: 3.7795275591
})
```

### Method 3: Direct JSON Edit (Advanced)
Edit `mechanicus_laser_cad/machine_profiles/last_used.json`:
```json
{
  "bed_max_x": "400",
  "bed_max_y": "300"
}
```

## Coordinate System

### Origin Point
- **Canvas Origin:** Top-left corner (0, 0)
- **Machine Origin:** Bottom-left corner (0, 0)

### Y-Axis Inversion
When sending G-code commands, the Y-axis is inverted:
```javascript
// Canvas to Machine coordinate conversion
const bed_x = (x * bed_max_x) / canvas_width
const bed_y = bed_max_y - ((y * bed_max_y) / canvas_height)
```

## MM to Pixel Conversion

### Standard Ratio
The default `mmToPx` value of **3.7795275591** is based on:
- **72 DPI** (dots per inch) standard
- **25.4 mm** per inch
- Formula: `72 / 25.4 × pixels_per_point`

### Why This Matters
This conversion ensures:
1. Accurate visual representation on screen
2. Proper scaling when exporting to G-code
3. WYSIWYG (What You See Is What You Get) rendering

## Related Files

### Frontend
- `frontend/src/store/cadStore.js` - Store definition
- `frontend/src/components/CADInterface.jsx` - Canvas rendering
- `frontend/src/components/MachineSettingsPopup.jsx` - Settings UI

### Backend
- `mechanicus_laser_cad/config3.py` - Python config
- `mechanicus_laser_cad/machine_profiles/last_used.json` - Active profile
- `server/index.ts` - API endpoints for profiles

## Grid System

The grid overlays on the canvas and adapts to the bed size:

**File:** `CADInterface.jsx` - `drawGrid()` function
```javascript
const gridSpacing = gridSize * machineProfile.mmToPx
```

Grid lines are drawn at intervals based on:
- `gridSize` (default: 10mm)
- Scaled by `mmToPx` conversion
- Extends to full `canvasWidth` and `canvasHeight`

## Viewport & Zoom

The canvas supports panning and zooming:

```javascript
viewport: {
  zoom: 1,           // Zoom level (1 = 100%)
  pan: { x: 0, y: 0 } // Pan offset in pixels
}
```

Zoom affects visual scale but not actual measurements.

## Rulers

Horizontal and vertical rulers display measurements:
- Update dynamically with zoom and pan
- Show tick marks every 1mm, 5mm, and 10mm
- Display measurements in millimeters
- Account for viewport scaling

**Implementation:** `updateRulers()` function in `CADInterface.jsx`
