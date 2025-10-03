
# JOG Controls Documentation

## Overview
The JOG controls provide manual movement control for CNC/laser engraver machines through an intuitive directional interface. Users can move the machine in 8 directions (N, NE, E, SE, S, SW, W, NW) plus a home command.

## Component Location
**File**: `frontend/src/components/MachineJogControls.jsx`

## Features

### 1. Directional Movement
- **8-direction grid**: Move in any cardinal or diagonal direction
- **Home button (🏠)**: Execute G28 homing command
- **Visual feedback**: Buttons show enabled/disabled state based on connection

### 2. Configurable Parameters

#### Feed Rate (F)
- **Range**: 1 - 10,000 mm/min
- **Default**: 1000 mm/min
- **Purpose**: Controls the speed of movement
- **Input validation**: Only accepts valid numbers within range

#### Step Size
- **Range**: 0.1 - 100 mm
- **Default**: 5 mm
- **Purpose**: Distance moved per button press
- **Input validation**: Accepts decimal values with 0.1mm precision

### 3. Connection Requirements
- Machine must be connected via companion app
- Serial port must be established (e.g., COM7)
- Connection status shown via button states

## G-code Commands Generated

### Movement Command Sequence
Each JOG button press generates 3 G-code commands:

```gcode
G91                          # Switch to relative positioning
G0 X[delta_x] Y[delta_y] F[feedrate]  # Move command
G90                          # Switch back to absolute positioning
```

**Example: Move Up 5mm at 1000 feed rate**
```gcode
G91
G0 X0.000 Y5.000 F1000
G90
```

**Example: Move Diagonal Up-Right 5mm at 2000 feed rate**
```gcode
G91
G0 X5.000 Y5.000 F2000
G90
```

### Home Command
```gcode
G28    # Home all axes
```

## Position Tracking During Movement

### JOG Movement Tracking
When a JOG button is pressed, the system:

1. **Calculates movement duration**: `duration = (distance / feedRate) * 60 * 1000` ms
2. **Starts position polling**: Queries position every 500ms during movement
3. **Sends position queries**: `?` command to machine
4. **Stops after completion**: Adds 1-second buffer, then sends final position query

```javascript
// Movement tracking flow
machinePositionTracker.startMovementTracking(portPath, feedRate, stepSize)
  ↓
Poll position every 500ms
  ↓
Stop after estimated duration + 1000ms buffer
  ↓
Send final position query
```

### Home Command Tracking
Homing uses similar tracking with conservative estimates:
- **Assumed feed rate**: 1000 mm/min
- **Assumed distance**: 50mm (typical homing distance)
- **Polling interval**: 500ms
- **Final query**: After movement completes

## UI Components

### Control Grid Layout
```
[↖] [↑] [↗]
[←] [🏠] [→]
[↙] [↓] [↘]
```

### Button States
- **Enabled** (isReady = true):
  - Background: `#374151` (dark gray)
  - Cursor: `pointer`
  - Text: white
  
- **Disabled** (not connected):
  - Background: `#1f2937` (darker gray)
  - Cursor: `not-allowed`
  - Text: `#6b7280` (gray)

### Home Button Special Styling
- **Background**: `#3b82f6` (blue) when enabled
- **Background**: `#1e3a8a` (dark blue) when disabled
- **Icon**: 🏠 emoji

## Communication Flow

### 1. User Input
```
User clicks button → handleJog(xDir, yDir) called
```

### 2. Validation
```javascript
if (!isReady) return                           // Check connection
if (!isValidNumber(feedRate)) return          // Validate feed rate
if (!isValidNumber(stepSize)) return          // Validate step size
```

### 3. G-code Generation
```javascript
const xMove = xDir * stepSize   // Calculate X movement
const yMove = yDir * stepSize   // Calculate Y movement
```

### 4. Command Transmission
```javascript
sendGcode(`G91`)                               // Relative mode
sendGcode(`G0 X${xMove} Y${yMove} F${feedRate}`)  // Move
sendGcode(`G90`)                               // Absolute mode
```

### 5. Position Tracking
```javascript
machinePositionTracker.startMovementTracking(
  serialState.port,  // COM7
  feedRate,          // 1000
  stepSize          // 5
)
```

## Integration with SerialContext

### Required Context Values
```javascript
const { 
  sendGcode,      // Function to send G-code commands
  isConnected,    // Boolean: WebSocket connected
  serialState     // Object: { port, baud, connected }
} = useSerial()
```

### Connection Check
```javascript
const isReady = isConnected && serialState.port
// Only enable controls when both WebSocket AND serial port are connected
```

## Error Handling

### Connection Errors
- **No WebSocket**: Buttons disabled, message shown
- **No serial port**: Buttons disabled, message shown
- **Invalid parameters**: Commands not sent, visual feedback maintained

### User Feedback
```javascript
if (!isReady) {
  return (
    <div style={{ color: '#6b7280' }}>
      Connect machine to enable
    </div>
  )
}
```

## Logging

### Console Output
All JOG operations log to browser console:

```javascript
console.log('🕹️ [JOG] Jogging machine:', {
  direction: { x: xDir, y: yDir },
  distance: { x: xMove, y: yMove },
  feedRate,
  port: serialState.port
})

console.log('🕹️ [JOG] Sending G-code sequence:', gcodeCommands)
```

### Home Command Logging
```javascript
console.log('🏠 [HOME] Homing machine to:', serialState.port)
```

## Best Practices

### 1. Feed Rate Selection
- **Engraving**: 1000-2000 mm/min
- **Cutting**: 500-1000 mm/min
- **Rapid positioning**: 3000-5000 mm/min

### 2. Step Size Selection
- **Fine positioning**: 0.1-1 mm
- **Normal movement**: 5-10 mm
- **Rapid movement**: 20-50 mm

### 3. Safety Considerations
- Always verify machine workspace limits
- Start with low feed rates for unfamiliar machines
- Use small step sizes near workpiece edges
- Monitor machine during first movements

## Troubleshooting

### Issue: Buttons Not Responding
**Check**:
1. Is WebSocket connected? (green indicator in SerialControl)
2. Is serial port open? (shows COM7 @ 115200 baud)
3. Are feed rate and step size valid numbers?

### Issue: Machine Not Moving
**Check**:
1. Companion app logs for G-code transmission
2. Machine response (should be "ok")
3. Machine not in alarm state (send `$X` to unlock)

### Issue: Inaccurate Movement
**Verify**:
1. Machine steps/mm configuration
2. Feed rate not exceeding machine limits
3. No mechanical binding or resistance

## Related Documentation
- [Machine Position Tracker](./MACHINE_POSITION_TRACKER.md)
- [Companion App](./COMPANION_APP.md)
- [JOG Communication Flow](./JOG_COMMUNICATION_FLOW.md)
