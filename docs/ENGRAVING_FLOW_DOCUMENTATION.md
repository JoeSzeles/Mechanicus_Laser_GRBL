
# Engraving Flow Documentation

## Overview
This document explains how the engraving tool converts canvas shapes into G-code commands and sends them to the buffer for transmission to the CNC/laser machine.

## Architecture Flow

```
Canvas Shapes → Shape Processing → G-code Generation → Buffer Module → Serial Transmission
```

## 1. Entry Point: EngravingToolsWindow.jsx

### Location
`frontend/src/components/EngravingToolsWindow.jsx`

### Key Function: `handleEngrave()`

The engraving process starts when the user clicks the "🔥 Engrave" button:

```javascript
const handleEngrave = async () => {
  // 1. Validation checks
  if (!isConnected || !serialState.port) {
    alert('Machine not connected')
    return
  }

  // 2. Get visible shapes from canvas
  const visibleShapes = shapes.filter(shape => {
    const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
    return shapeLayer && shapeLayer.visible && !shapeLayer.locked
  })

  // 3. Generate all G-code commands
  const allCommands = []
  
  // 4. Send to buffer
  const bufferEvent = new CustomEvent('gcode-buffer-update', {
    detail: { lines: allCommands, start: 0 }
  })
  window.dispatchEvent(bufferEvent)
}
```

## 2. Shape Data Structure

Shapes are stored in Zustand store (`frontend/src/store/cadStore.js`) with the following structure:

```javascript
{
  id: 'unique-id',
  type: 'line' | 'rectangle' | 'circle' | 'polygon' | 'path' | 'arc' | 'text',
  layerId: 'layer1',
  // Shape-specific properties:
  // Line: x1, y1, x2, y2
  // Rectangle: x, y, width, height
  // Circle: x, y, radius
  // Polygon/Path: points [{x, y}, ...]
  // Arc: x, y, radius, rotation, angle
  // Text: x, y, text, fontSize, pathData
}
```

## 3. G-code Generation Process

### Step 1: Initialize Machine
```javascript
// Preamble commands
allCommands.push(generateHomeCommand(firmware))  // Home machine
allCommands.push('G21')  // Set units to mm
allCommands.push('G90')  // Absolute positioning
allCommands.push(`G1 F${feedRate}`)  // Set feed rate
allCommands.push(generateLaserControl(firmware, 0, false))  // Laser off
```

### Step 2: Process Each Pass
```javascript
for (let pass = 0; pass < passCount; pass++) {
  for (let shapeIndex = 0; shapeIndex < visibleShapes.length; shapeIndex++) {
    const shape = visibleShapes[shapeIndex]
    const shapeCommands = generateShapeCommands(shape, ...)
    allCommands.push(...shapeCommands)
  }
}
```

### Step 3: Generate Shape-Specific Commands

The `generateShapeCommands()` function handles each shape type:

#### Coordinate Transformation
```javascript
const convertToMachineCoords = (canvasX, canvasY) => {
  let machineX = (canvasX / mmToPx)
  let machineY = (canvasY / mmToPx)
  
  // Adjust based on origin point (bottom-left, top-left, etc.)
  switch (originPoint) {
    case 'bottom-left':
      machineY = bedMaxY - machineY
      break
    // ... other cases
  }
  
  return { x: machineX, y: machineY }
}
```

#### Line Shape
```javascript
if (shape.type === 'line') {
  const start = convertToMachineCoords(shape.x1, shape.y1)
  const end = convertToMachineCoords(shape.x2, shape.y2)
  
  commands.push(generateLaserControl(firmware, 0, false))  // Laser off
  commands.push(generateMovement(firmware, start.x, start.y, null, feedRate, true))  // Move to start
  commands.push(generateLaserControl(firmware, laserPower, true))  // Laser on
  commands.push(generateMovement(firmware, end.x, end.y, null, feedRate, false))  // Draw line
  commands.push(generateLaserControl(firmware, 0, false))  // Laser off
}
```

#### Rectangle Shape
```javascript
if (shape.type === 'rectangle') {
  const topLeft = convertToMachineCoords(shape.x, shape.y)
  const topRight = convertToMachineCoords(shape.x + shape.width, shape.y)
  const bottomRight = convertToMachineCoords(shape.x + shape.width, shape.y + shape.height)
  const bottomLeft = convertToMachineCoords(shape.x, shape.y + shape.height)
  
  commands.push(generateLaserControl(firmware, 0, false))
  commands.push(generateMovement(firmware, topLeft.x, topLeft.y, null, feedRate, true))
  commands.push(generateLaserControl(firmware, laserPower, true))
  commands.push(generateMovement(firmware, topRight.x, topRight.y, null, feedRate, false))
  commands.push(generateMovement(firmware, bottomRight.x, bottomRight.y, null, feedRate, false))
  commands.push(generateMovement(firmware, bottomLeft.x, bottomLeft.y, null, feedRate, false))
  commands.push(generateMovement(firmware, topLeft.x, topLeft.y, null, feedRate, false))  // Close
  commands.push(generateLaserControl(firmware, 0, false))
}
```

#### Circle Shape
```javascript
if (shape.type === 'circle') {
  const center = convertToMachineCoords(shape.x, shape.y)
  const machineRadius = shape.radius / mmToPx
  const numSegments = 72
  
  const startX = center.x + machineRadius
  const startY = center.y
  
  commands.push(generateMovement(firmware, startX, startY, null, feedRate, true))
  commands.push(generateLaserControl(firmware, laserPower, true))
  
  for (let i = 0; i <= numSegments; i++) {
    const angle = (2 * Math.PI * i) / numSegments
    const x = center.x + machineRadius * Math.cos(angle)
    const y = center.y + machineRadius * Math.sin(angle)
    commands.push(generateMovement(firmware, x, y, null, feedRate, false))
  }
  
  commands.push(generateLaserControl(firmware, 0, false))
}
```

#### Polygon/Path/Freehand Shape
```javascript
if (shape.type === 'polygon' || shape.type === 'path' || shape.type === 'freehand') {
  let points
  if (typeof shape.points[0] === 'number') {
    // Flat array format [x1, y1, x2, y2, ...]
    points = []
    for (let i = 0; i < shape.points.length; i += 2) {
      points.push(convertToMachineCoords(shape.points[i], shape.points[i + 1]))
    }
  } else {
    // Object array format [{x, y}, {x, y}, ...]
    points = shape.points.map(p => convertToMachineCoords(p.x, p.y))
  }
  
  commands.push(generateMovement(firmware, points[0].x, points[0].y, null, feedRate, true))
  commands.push(generateLaserControl(firmware, laserPower, true))
  
  for (let i = 1; i < points.length; i++) {
    commands.push(generateMovement(firmware, points[i].x, points[i].y, null, feedRate, false))
  }
  
  if (shape.type === 'polygon') {
    commands.push(generateMovement(firmware, points[0].x, points[0].y, null, feedRate, false))  // Close
  }
  
  commands.push(generateLaserControl(firmware, 0, false))
}
```

#### Arc Shape
```javascript
if (shape.type === 'arc') {
  const center = convertToMachineCoords(shape.x, shape.y)
  const machineRadius = (shape.outerRadius || shape.radius || 50) / mmToPx
  const startAngle = shape.rotation || 0
  const extent = shape.angle || 90
  
  const startAngleRad = (startAngle * Math.PI) / 180
  const startX = center.x + machineRadius * Math.cos(startAngleRad)
  const startY = center.y + machineRadius * Math.sin(startAngleRad)
  
  commands.push(generateMovement(firmware, startX, startY, null, feedRate, true))
  commands.push(generateLaserControl(firmware, laserPower, true))
  
  const numSegments = Math.max(72, Math.floor(Math.abs(extent) / 5))
  for (let i = 0; i <= numSegments; i++) {
    const angleRad = ((startAngle + (extent * i / numSegments)) * Math.PI) / 180
    const x = center.x + machineRadius * Math.cos(angleRad)
    const y = center.y + machineRadius * Math.sin(angleRad)
    commands.push(generateMovement(firmware, x, y, null, feedRate, false))
  }
  
  commands.push(generateLaserControl(firmware, 0, false))
}
```

#### Text Shape
```javascript
if (shape.type === 'text') {
  if (shape.pathData) {
    const pathCommands = parseSVGPath(shape.pathData)
    
    let laserOn = false
    pathCommands.forEach((segment) => {
      if (segment.type === 'M') {
        if (laserOn) {
          commands.push(generateLaserControl(firmware, 0, false))
          laserOn = false
        }
        const point = convertToMachineCoords(segment.x, segment.y)
        commands.push(generateMovement(firmware, point.x, point.y, null, feedRate, true))
        commands.push(generateLaserControl(firmware, laserPower, true))
        laserOn = true
      } else if (segment.type === 'L') {
        if (!laserOn) {
          commands.push(generateLaserControl(firmware, laserPower, true))
          laserOn = true
        }
        const point = convertToMachineCoords(segment.x, segment.y)
        commands.push(generateMovement(firmware, point.x, point.y, null, feedRate, false))
      } else if (segment.type === 'Z') {
        if (laserOn) {
          commands.push(generateLaserControl(firmware, 0, false))
          laserOn = false
        }
      }
    })
  }
}
```

### Step 4: Finalize Commands
```javascript
// Turn off laser and return home
allCommands.push(generateLaserControl(firmware, 0, false))
allCommands.push(generateHomeCommand(firmware))
```

## 4. Firmware-Specific Command Generation

### Location
`frontend/src/utils/firmwareGcodeGenerators.js`

### Generate Movement
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

### Generate Laser Control
```javascript
export function generateLaserControl(firmware, power, on) {
  if (!on) return 'M5'  // Turn off laser
  if (firmware === 'grbl') {
    return `M3 S${power}`  // GRBL laser on
  } else if (firmware === 'marlin') {
    return `M3 S${power}`  // Marlin laser on
  }
  return ''
}
```

### Generate Home Command
```javascript
export function generateHomeCommand(firmware) {
  if (firmware === 'grbl') {
    return '$H'  // GRBL home
  } else if (firmware === 'marlin') {
    return 'G28'  // Marlin home
  }
  return 'G28'  // Default
}
```

## 5. Buffer Integration

### Send to Buffer
```javascript
// Create custom event with G-code lines
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

### Buffer Window Processing
`frontend/src/components/GcodeBufferWindow.jsx`

```javascript
useEffect(() => {
  const handleBufferUpdate = (event) => {
    const { lines, start } = event.detail
    const gLines = lines.map((line, idx) => {
      const cmd = line.trim().toUpperCase()
      const isPositionQuery = cmd === '?' || cmd === 'M114'
      return {
        lineNumber: idx + 1,
        command: line,
        status: idx < start ? 'completed' : 'pending',
        isPositionQuery
      }
    })
    setGcodeLines(gLines)
    setDisplayLines(gLines)
    setCurrentLine(start)
    setProgress(start)
  }
  
  window.addEventListener('gcode-buffer-update', handleBufferUpdate)
  return () => window.removeEventListener('gcode-buffer-update', handleBufferUpdate)
}, [])
```

## 6. Serial Transmission

The buffer sends commands to the serial port via `SerialContext`:

```javascript
const transmitNextLine = async () => {
  if (currentLine >= gcodeLines.length) {
    setStatus('completed')
    return
  }
  
  const line = gcodeLines[currentLine]
  await sendGcode(line.command)
  
  setCurrentLine(prev => prev + 1)
  setProgress(currentLine + 1)
}
```

## 7. Python Backend Comparison

### Location
`mechanicus_laser_cad/engrave.py`

The Python version follows a similar flow:

1. **Initialize machine**: Send preamble commands (G21, G90, M5)
2. **Group shapes by ID**: Process related shapes together
3. **Generate commands**: Convert canvas coordinates to machine coordinates
4. **Send commands**: Use `send_command()` or `send_buffered_commands()`

Key differences:
- Python uses Tkinter canvas directly
- Python sends commands immediately to serial port
- React version uses buffer for better control

## 8. Key Configuration Parameters

### Machine Profile Settings
```javascript
{
  firmwareType: 'grbl' | 'marlin',
  bedMaxX: 300,  // mm
  bedMaxY: 200,  // mm
  originPoint: 'bottom-left' | 'top-left' | 'bottom-right' | 'top-right',
  drawSpeed: 2000,  // mm/min
  travelSpeed: 3000,  // mm/min
  laserPower: 1000,  // 0-1000
  zDraw: 0,  // Drawing Z height
  zLift: 5,  // Lift Z height
  zTravel: 10  // Travel Z height
}
```

### Coordinate Conversion
```javascript
mmToPx = 3.7795275591  // Canvas pixels per mm
machineX = canvasX / mmToPx
machineY = canvasY / mmToPx
// Adjust for origin point
```

## 9. Creating Similar Functions

To create similar G-code generation functions:

1. **Get shapes from canvas**: Filter by visibility and layer
2. **Initialize commands array**: Start with preamble
3. **Process each shape**:
   - Convert coordinates to machine space
   - Generate movement commands
   - Handle laser/tool control
4. **Add postamble**: Return home, turn off laser
5. **Send to buffer**: Use custom events
6. **Handle transmission**: Process line by line with status tracking

### Example Template
```javascript
const generateCustomGcode = (shapes, profile) => {
  const commands = []
  const { firmware, feedRate, laserPower } = profile
  
  // 1. Preamble
  commands.push(generateHomeCommand(firmware))
  commands.push('G21')
  commands.push('G90')
  
  // 2. Process shapes
  shapes.forEach(shape => {
    const shapeCommands = convertShapeToGcode(shape, profile)
    commands.push(...shapeCommands)
  })
  
  // 3. Postamble
  commands.push('M5')
  commands.push(generateHomeCommand(firmware))
  
  return commands
}
```

## Summary

The engraving flow is a multi-stage process:
1. Collect visible shapes from canvas
2. Convert canvas coordinates to machine coordinates
3. Generate shape-specific G-code commands
4. Add firmware-specific preamble/postamble
5. Send to buffer module
6. Transmit line-by-line to serial port
7. Track progress and machine responses

This architecture provides flexibility for different machine types, firmware variants, and shape processing requirements.
