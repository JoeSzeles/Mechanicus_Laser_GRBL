
# Engraving G-code Generation Documentation

## Overview
This document provides an in-depth explanation of how `EngravingToolsWindow.jsx` generates G-code commands from canvas shapes for laser engraving/CNC operations.

## Architecture Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENGRAVING PROCESS FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │ User Action  │
                              │ Click Engrave│
                              └──────┬───────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │   handleEngrave()    │
                          │  Entry Point         │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
            │ Validate     │  │ Get Shapes  │  │ Get Machine  │
            │ Connection   │  │ from Store  │  │ Profile      │
            └──────┬───────┘  └──────┬──────┘  └──────┬───────┘
                   │                 │                 │
                   └────────┬────────┴────────┬────────┘
                            │                 │
                            ▼                 ▼
                   ┌─────────────────────────────────┐
                   │  Filter Visible/Selected Shapes │
                   │  - Check layer visibility       │
                   │  - Check layer lock status      │
                   │  - Filter by selection IDs      │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   Initialize G-code Array       │
                   │   const allCommands = []        │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   STEP 1: Preamble Commands     │
                   │   - Home command (firmware)     │
                   │   - G21 (units to mm)           │
                   │   - G90 (absolute positioning)  │
                   │   - Set feed rate               │
                   │   - Laser OFF                   │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   STEP 2: Pass Loop             │
                   │   for (pass = 0; pass < N)      │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   STEP 3: Shape Loop            │
                   │   for each shape in visible     │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────────────────┐
                   │   generateShapeCommands(shape)              │
                   │   ┌───────────────────────────────────────┐ │
                   │   │ 1. Convert canvas coords to machine   │ │
                   │   │ 2. Generate shape-specific G-code     │ │
                   │   │ 3. Manage laser on/off states         │ │
                   │   └───────────────────────────────────────┘ │
                   └────────────┬────────────────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   Add Buffer Management         │
                   │   - Position query (? or M114)  │
                   │   - Dwell command (500ms)       │
                   │   Between each shape            │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   STEP 4: Postamble Commands    │
                   │   - Laser OFF (M5)              │
                   │   - Home command                │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   Send to Buffer Module         │
                   │   CustomEvent('gcode-buffer')   │
                   └────────────┬────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────────────┐
                   │   Auto-start Transmission       │
                   │   setTimeout(() => start)       │
                   └─────────────────────────────────┘
```

## Detailed Process Steps

### 1. Entry Point: `handleEngrave()`

**Location:** `frontend/src/components/EngravingToolsWindow.jsx` (Line ~120)

```javascript
const handleEngrave = async (specificShapeIds = null) => {
  // 1. Validate connection
  if (!isConnected || !serialState.port) {
    alert('Machine not connected')
    return
  }

  // 2. Check if already engraving
  if (isEngraving) {
    alert('Engraving already in progress')
    return
  }

  // 3. Get fresh shapes from store
  const currentShapes = useCadStore.getState().shapes
  const currentLayers = useCadStore.getState().layers
}
```

**Purpose:**
- Entry point for engraving process
- Validates machine connection
- Prevents concurrent engraving operations
- Retrieves current shapes and layers from Zustand store

---

### 2. Shape Filtering Logic

```javascript
// Get shapes to engrave
let visibleShapes

if (specificShapeIds && specificShapeIds.length > 0) {
  // Engrave only selected shapes (ignore layer visibility)
  visibleShapes = currentShapes.filter(shape => 
    specificShapeIds.includes(shape.id)
  )
} else {
  // Get visible shapes from canvas
  visibleShapes = currentShapes.filter(shape => {
    const shapeLayer = currentLayers.find(l => l.id === shape.layerId) || currentLayers[0]
    return shapeLayer && shapeLayer.visible && !shapeLayer.locked
  })
}
```

**Decision Flow:**
```
Has specificShapeIds?
    ├── YES → Filter by shape IDs only
    │         (Ignore layer visibility/lock)
    │
    └── NO  → Filter by layer rules
              - Layer must be visible
              - Layer must NOT be locked
```

---

### 3. G-code Array Initialization

```javascript
const allCommands = []
const firmware = machineConnection?.currentProfile?.firmwareType || 'grbl'
const mmToPx = machineProfile.mmToPx
const bedMaxX = machineConnection?.currentProfile?.bedMaxX || 300
const bedMaxY = machineConnection?.currentProfile?.bedMaxY || 200
const originPoint = machineConnection?.currentProfile?.originPoint || 'bottom-left'
```

**Key Variables:**
- `allCommands`: Array to store all G-code lines
- `firmware`: GRBL, Marlin, or Smoothieware
- `mmToPx`: Conversion factor (3.7795275591 px/mm)
- `bedMaxX/Y`: Machine bed dimensions
- `originPoint`: Coordinate system origin

---

### 4. Preamble Commands

```javascript
// 1. Home command
allCommands.push(generateHomeCommand(firmware))

// 2. Initialize machine
allCommands.push('G21')  // Set units to mm
allCommands.push('G90')  // Absolute positioning
allCommands.push(`G1 F${feedRate}`)  // Set feed rate
allCommands.push(generateLaserControl(firmware, 0, false))  // Laser OFF
```

**Firmware-Specific Home Commands:**
- **GRBL:** `$H`
- **Marlin:** `G28`
- **Smoothieware:** `$H`

---

### 5. Pass Loop Structure

```javascript
const positionQueryCmd = firmware === 'grbl' ? '?' : 'M114'

for (let pass = 0; pass < passCount; pass++) {
  // Process each shape
  for (let shapeIndex = 0; shapeIndex < visibleShapes.length; shapeIndex++) {
    const shape = visibleShapes[shapeIndex]
    
    // Generate commands for this shape
    const shapeCommands = generateShapeCommands(
      shape, mmToPx, bedMaxX, bedMaxY, originPoint, feedRate, laserPower, firmware
    )
    
    allCommands.push(...shapeCommands)
    
    // Buffer management between shapes
    if (shapeIndex < visibleShapes.length - 1) {
      allCommands.push(positionQueryCmd)
      
      // Firmware-specific dwell (500ms)
      if (firmware === 'marlin') {
        allCommands.push('G4 P500')  // Milliseconds
      } else {
        allCommands.push('G4 P0.5')  // Seconds
      }
    }
  }
}
```

**Buffer Management Strategy:**
- Insert position query between shapes
- Add 500ms dwell to prevent segment skipping
- GRBL/Smoothie: `G4 P0.5` (seconds)
- Marlin: `G4 P500` (milliseconds)

---

### 6. Shape Command Generation

#### Coordinate Transformation

```javascript
const convertToMachineCoords = (canvasX, canvasY) => {
  let machineX = (canvasX / mmToPx)
  let machineY = (canvasY / mmToPx)
  
  // Adjust based on origin point
  switch (originPoint) {
    case 'bottom-left':
      machineY = bedMaxY - machineY
      break
    case 'bottom-right':
      machineX = bedMaxX - machineX
      machineY = bedMaxY - machineY
      break
    case 'top-left':
      // No adjustment needed
      break
    case 'top-right':
      machineX = bedMaxX - machineX
      break
  }
  
  return { x: machineX, y: machineY }
}
```

**Coordinate System Diagram:**
```
Canvas Space                Machine Space (bottom-left origin)
┌─────────────── X         ┌─────────────── X
│                           │
│  Shape                    │           Shape
│                           │
Y                           Y (inverted)

Canvas Y → Machine Y = bedMaxY - (canvasY / mmToPx)
Canvas X → Machine X = canvasX / mmToPx
```

---

#### Shape Type Processing Flow

```
Shape Type?
    │
    ├── LINE ──────────────────────────────────────┐
    │   ├── Move to start (laser OFF)              │
    │   ├── Turn laser ON                           │
    │   ├── Move to end                             │
    │   └── Turn laser OFF                          │
    │                                               │
    ├── RECTANGLE ─────────────────────────────────┤
    │   ├── Move to top-left (laser OFF)           │
    │   ├── Turn laser ON                           │
    │   ├── Draw 4 sides (closed path)             │
    │   └── Turn laser OFF                          │
    │                                               │
    ├── CIRCLE ────────────────────────────────────┤
    │   ├── Calculate 72 segments                  │
    │   ├── Move to start (laser OFF)              │
    │   ├── Turn laser ON                           │
    │   ├── Draw circle segments                   │
    │   │   └── Insert position query every 10     │
    │   └── Turn laser OFF                          │
    │                                               │
    ├── POLYGON/PATH/FREEHAND ─────────────────────┤
    │   ├── Parse points array                     │
    │   ├── Move to first point (laser OFF)        │
    │   ├── Turn laser ON                           │
    │   ├── Draw all points                         │
    │   ├── Close path (polygon only)              │
    │   └── Turn laser OFF                          │
    │                                               │
    ├── ARC ───────────────────────────────────────┤
    │   ├── Calculate segments from angle          │
    │   ├── Move to start angle (laser OFF)        │
    │   ├── Turn laser ON                           │
    │   ├── Draw arc segments                      │
    │   │   └── Insert position query every 6      │
    │   └── Turn laser OFF                          │
    │                                               │
    └── TEXT ──────────────────────────────────────┘
        ├── Parse SVG path data                    
        ├── Process M/L/Z commands                 
        │   ├── M (move): laser OFF → move → ON    
        │   ├── L (line): ensure laser ON → draw   
        │   └── Z (close): laser OFF               
        └── Ensure laser OFF at end                
```

---

#### Line Shape Example

```javascript
if (shape.type === 'line') {
  const start = convertToMachineCoords(shape.x1, shape.y1)
  const end = convertToMachineCoords(shape.x2, shape.y2)
  
  // Laser OFF + Move to start
  commands.push(generateLaserControl(firmware, 0, false))
  commands.push(generateMovement(firmware, start.x, start.y, null, feedRate, true))
  
  // Laser ON
  commands.push(generateLaserControl(firmware, laserPower, true))
  
  // Draw line
  commands.push(generateMovement(firmware, end.x, end.y, null, feedRate, false))
  
  // Laser OFF
  commands.push(generateLaserControl(firmware, 0, false))
}
```

**Generated G-code:**
```gcode
M5                    ; Laser OFF
G0 X10.000 Y20.000   ; Rapid move to start
M3 S1000             ; Laser ON at power 1000
G1 X50.000 Y60.000 F2000  ; Draw line
M5                    ; Laser OFF
```

---

#### Circle Shape Example

```javascript
if (shape.type === 'circle') {
  const center = convertToMachineCoords(shape.x, shape.y)
  const machineRadius = shape.radius / mmToPx
  const numSegments = 72
  
  // Calculate start position
  const startX = center.x + machineRadius
  const startY = center.y
  
  // Move to start
  commands.push(generateMovement(firmware, startX, startY, null, feedRate, true))
  
  // Laser ON
  commands.push(generateLaserControl(firmware, laserPower, true))
  
  // Draw circle segments
  const positionQueryCmd = firmware === 'grbl' ? '?' : 'M114'
  for (let i = 0; i <= numSegments; i++) {
    const angle = (2 * Math.PI * i) / numSegments
    const x = center.x + machineRadius * Math.cos(angle)
    const y = center.y + machineRadius * Math.sin(angle)
    commands.push(generateMovement(firmware, x, y, null, feedRate, false))
    
    // Buffer management every 10 segments
    if (i > 0 && i % 10 === 0 && i < numSegments) {
      commands.push(positionQueryCmd)
    }
  }
  
  // Laser OFF
  commands.push(generateLaserControl(firmware, 0, false))
}
```

**Circle Segmentation:**
```
72 segments = 5° per segment
Full circle = 360° / 5° = 72 points

Position Query inserted at:
i = 10, 20, 30, 40, 50, 60, 70
(7 queries total for buffer management)
```

---

#### Text Shape Example

```javascript
if (shape.type === 'text') {
  if (shape.pathData) {
    const pathCommands = parseSVGPath(shape.pathData)
    
    let laserOn = false
    pathCommands.forEach((segment) => {
      if (segment.type === 'M') {
        // Move command - turn off laser
        if (laserOn) {
          commands.push(generateLaserControl(firmware, 0, false))
          laserOn = false
        }
        const point = convertToMachineCoords(segment.x, segment.y)
        commands.push(generateMovement(firmware, point.x, point.y, null, feedRate, true))
        
        // Turn on laser for drawing
        commands.push(generateLaserControl(firmware, laserPower, true))
        laserOn = true
      } 
      else if (segment.type === 'L') {
        // Line command
        if (!laserOn) {
          commands.push(generateLaserControl(firmware, laserPower, true))
          laserOn = true
        }
        const point = convertToMachineCoords(segment.x, segment.y)
        commands.push(generateMovement(firmware, point.x, point.y, null, feedRate, false))
      } 
      else if (segment.type === 'Z') {
        // Close path
        if (laserOn) {
          commands.push(generateLaserControl(firmware, 0, false))
          laserOn = false
        }
      }
    })
    
    // Ensure laser is off
    if (laserOn) {
      commands.push(generateLaserControl(firmware, 0, false))
    }
  }
}
```

**SVG Path Parsing:**
```
SVG: "M10 10 L20 10 L20 20 Z"

Parsed:
├── { type: 'M', x: 10, y: 10 }  → Laser OFF, Move, Laser ON
├── { type: 'L', x: 20, y: 10 }  → Draw line
├── { type: 'L', x: 20, y: 20 }  → Draw line
└── { type: 'Z' }                → Laser OFF
```

---

### 7. Firmware-Specific Commands

#### Movement Generation

```javascript
export function generateMovement(firmware, x, y, z, feedRate, rapid = false) {
  const type = rapid ? 'G0' : 'G1'
  let command = `${type}`
  
  if (x !== null && x !== undefined) command += ` X${x.toFixed(3)}`
  if (y !== null && y !== undefined) command += ` Y${y.toFixed(3)}`
  if (z !== null && z !== undefined) command += ` Z${z.toFixed(3)}`
  if (feedRate !== null && feedRate !== undefined) command += ` F${feedRate}`
  
  return command
}
```

**Example Outputs:**
```gcode
G0 X100.000 Y50.000           ; Rapid move (travel)
G1 X100.000 Y50.000 F2000     ; Linear move (cutting)
G1 X100.000 Y50.000 Z0.000 F2000  ; 3-axis move
```

---

#### Laser Control Generation

```javascript
export function generateLaserControl(firmware, power, on) {
  if (!on) return 'M5'  // Turn off laser
  
  if (firmware === 'grbl') {
    return `M3 S${power}`
  } else if (firmware === 'marlin') {
    return `M3 S${power}`
  }
  return ''
}
```

**Laser Commands:**
- **ON:** `M3 S1000` (spindle/laser on at power 1000)
- **OFF:** `M5` (spindle/laser off)

---

### 8. Postamble Commands

```javascript
// Turn off laser and return home
allCommands.push(generateLaserControl(firmware, 0, false))
allCommands.push(generateHomeCommand(firmware))
```

**Final Commands:**
```gcode
M5        ; Laser OFF
$H        ; Home (GRBL)
; or
M5        ; Laser OFF
G28       ; Home (Marlin)
```

---

### 9. Buffer Integration

```javascript
// Send to buffer module
const bufferEvent = new CustomEvent('gcode-buffer-update', {
  detail: {
    lines: allCommands,
    start: 0
  }
})
window.dispatchEvent(bufferEvent)

// Auto-open buffer window
const openBufferEvent = new CustomEvent('open-buffer-window')
window.dispatchEvent(openBufferEvent)

// Auto-start transmission
setTimeout(() => {
  const startTransmissionEvent = new CustomEvent('start-buffer-transmission')
  window.dispatchEvent(startTransmissionEvent)
}, 500)
```

**Event Flow:**
```
EngravingToolsWindow
        │
        ├── Dispatch 'gcode-buffer-update'
        │   └── payload: { lines: [...], start: 0 }
        │
        ├── Dispatch 'open-buffer-window'
        │   └── Opens GcodeBufferWindow
        │
        └── Dispatch 'start-buffer-transmission'
            └── Begins sending to serial port
```

---

## Complete G-code Example

**Input:** Circle at (100, 100) with radius 50px

**Machine Settings:**
- Feed Rate: 2000 mm/min
- Laser Power: 1000
- Firmware: GRBL
- Origin: bottom-left
- Bed: 300x200mm
- mmToPx: 3.7795

**Generated G-code:**
```gcode
; Preamble
$H                         ; Home
G21                        ; Set units to mm
G90                        ; Absolute positioning
G1 F2000                   ; Set feed rate
M5                         ; Laser OFF

; Circle Shape
G0 X39.457 Y66.457         ; Move to start (rapid)
M3 S1000                   ; Laser ON
G1 X40.218 Y67.915 F2000   ; Segment 1
G1 X40.898 Y69.431 F2000   ; Segment 2
; ... (72 segments total)
?                          ; Position query (every 10 segments)
; ... continue segments
G1 X39.457 Y66.457 F2000   ; Close circle
M5                         ; Laser OFF

; Buffer management (if more shapes)
?                          ; Position query
G4 P0.5                    ; Dwell 500ms

; Postamble
M5                         ; Laser OFF
$H                         ; Home
```

---

## Key Parameters Reference

### Canvas to Machine Conversion
```javascript
mmToPx = 3.7795275591  // Pixels per millimeter

canvasX (px) → machineX (mm)
machineX = canvasX / mmToPx

canvasY (px) → machineY (mm)  
machineY = bedMaxY - (canvasY / mmToPx)  // For bottom-left origin
```

### Firmware Commands Table

| Command Type | GRBL | Marlin | Smoothieware |
|--------------|------|---------|--------------|
| Home | `$H` | `G28` | `$H` |
| Position Query | `?` | `M114` | `?` |
| Laser ON | `M3 S{power}` | `M3 S{power}` | `M3 S{power}` |
| Laser OFF | `M5` | `M5` | `M5` |
| Dwell 500ms | `G4 P0.5` | `G4 P500` | `G4 P0.5` |

### Shape Processing Summary

| Shape Type | Segments | Position Queries | Close Path |
|------------|----------|------------------|------------|
| Line | 1 | 0 | No |
| Rectangle | 4 | 0 | Yes |
| Circle | 72 | 7 | Yes |
| Polygon | Variable | 0 | Yes |
| Arc | Variable | Variable | No |
| Path/Freehand | Variable | 0 | No |
| Text | Variable | 0 | Variable |

---

## Buffer Management Strategy

**Problem:** Large shapes (circles, arcs) can overflow machine buffer causing segment skipping.

**Solution:**
1. **Position Queries:** Insert `?` or `M114` every N segments
   - Circles: Every 10 segments
   - Arcs: Every 6 segments
   
2. **Dwell Between Shapes:** 500ms pause allows buffer to clear
   - GRBL/Smoothie: `G4 P0.5`
   - Marlin: `G4 P500`

3. **Progressive Transmission:** Buffer window sends line-by-line with acknowledgment

**Flow:**
```
Machine Buffer (limited size)
    ↑
    │ Send line
    ├── Wait for 'ok'
    │ Send line
    ├── Wait for 'ok'
    │ Insert position query
    ├── Wait for position response
    │ Send line
    └── Continue...
```

---

## Related Files

- **Main Component:** `frontend/src/components/EngravingToolsWindow.jsx`
- **Firmware Utils:** `frontend/src/utils/firmwareGcodeGenerators.js`
- **Buffer Window:** `frontend/src/components/GcodeBufferWindow.jsx`
- **Position Tracker:** `frontend/src/utils/machinePositionTracker.js`
- **Store:** `frontend/src/store/cadStore.js`

## See Also

- [Engraving Flow Documentation](./ENGRAVING_FLOW_DOCUMENTATION.md)
- [Firmware Support](./FIRMWARE_SUPPORT.md)
- [Machine Position Tracker](./MACHINE_POSITION_TRACKER.md)
