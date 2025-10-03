
# Machine Position Tracker Documentation

## Overview
The Machine Position Tracker is a JavaScript module that tracks the real-time position of the CNC/laser engraver machine during movement. It queries the machine periodically using the `?` status command (GRBL) or `M114` command (Marlin) and parses position responses.

## Component Location
**File**: `frontend/src/utils/machinePositionTracker.js`

## Architecture

### Class: MachinePositionTracker
Singleton instance managing position tracking and visualization.

```javascript
export const machinePositionTracker = new MachinePositionTracker()
```

### State Properties
```javascript
{
  position: { x: 0, y: 0, z: 0 },    // Current machine coordinates
  laserActive: false,                 // Laser on/off state
  updateInterval: null,               // Position polling interval ID
  wsConnection: null,                 // WebSocket connection reference
  listeners: new Set(),               // Position update callbacks
  movementTimeout: null               // Movement duration timeout ID
}
```

## Core Features

### 1. Position Tracking During Movement
The tracker automatically polls machine position during JOG and HOME operations.

#### Movement Tracking Lifecycle
```
Start movement
  ↓
Calculate duration: (distance / feedRate) * 60 * 1000 ms
  ↓
Poll position every 500ms
  ↓
Stop polling after duration + 1000ms buffer
  ↓
Send final position query
  ↓
Update visualization
```

### 2. Multi-Firmware Support
Parses position responses from different firmware types:

#### GRBL Format
```
<Idle|MPos:123.45,67.89,10.00|FS:1000,0>
```
- **Status**: `Idle`, `Run`, `Hold`, `Alarm`
- **Position**: `MPos:x,y,z` (machine coordinates)

#### Marlin Format
```
X:123.45 Y:67.89 Z:10.00 E:0.00 Count X:123 Y:67 Z:10
```
- **Coordinates**: `X:value Y:value Z:value`
- **Case-insensitive**: Also accepts lowercase `x:`, `y:`, `z:`

### 3. Real-Time Updates
Notifies all registered listeners when position changes.

### 4. Laser State Tracking
Tracks laser on/off state (M3/M5 commands) for visualization.

## API Reference

### Initialization

#### init(wsConnection, portPath)
Initialize tracker with WebSocket connection.

```javascript
machinePositionTracker.init(wsConnection, 'COM7')
```

**Parameters**:
- `wsConnection`: WebSocket instance
- `portPath`: Serial port path (e.g., 'COM7')

**Usage**: Called from SerialContext on WebSocket connection.

---

### Movement Tracking

#### startMovementTracking(portPath, feedRate, distance)
Start continuous position polling during movement.

```javascript
machinePositionTracker.startMovementTracking('COM7', 1000, 5)
```

**Parameters**:
- `portPath`: Serial port path
- `feedRate`: Movement speed (mm/min)
- `distance`: Movement distance (mm)

**Behavior**:
1. Calculates movement duration: `(distance / feedRate) * 60 * 1000` ms
2. Starts polling every 500ms
3. Stops after duration + 1000ms buffer
4. Sends final position query

**Called by**:
- JOG controls on button press
- HOME command execution

---

#### stopMovementTracking()
Stop all position polling and clear timeouts.

```javascript
machinePositionTracker.stopMovementTracking()
```

**Behavior**:
- Clears position polling interval
- Clears movement timeout
- Logs stop action

**Called by**:
- Movement completion
- Manual stop
- Cleanup on disconnect

---

### Position Queries

#### queryPosition(portPath)
Send position query command to machine.

```javascript
machinePositionTracker.queryPosition('COM7')
```

**Parameters**:
- `portPath`: Serial port path

**Command sent**:
```json
{
  "type": "send_command",
  "payload": {
    "portPath": "COM7",
    "command": "?"
  }
}
```

**GRBL Response**: `<Idle|MPos:x,y,z|...>`  
**Marlin Response**: `X:x Y:y Z:z`

---

#### parsePositionResponse(response)
Parse machine position from response string.

```javascript
const success = machinePositionTracker.parsePositionResponse('<Idle|MPos:10.5,20.3,0.0|...>')
// success = true
// position = { x: 10.5, y: 20.3, z: 0.0 }
```

**Parameters**:
- `response`: Raw response string from machine

**Returns**: `true` if parsed successfully, `false` otherwise

**Supported Formats**:
1. GRBL: `<Status|MPos:x,y,z|...>`
2. Marlin: `X:x Y:y Z:z`
3. Lowercase: `x:x y:y z:z`

**Behavior**:
- Updates `this.position` object
- Notifies all listeners
- Logs parsed position

---

### Position Access

#### getPosition()
Get current position snapshot.

```javascript
const pos = machinePositionTracker.getPosition()
// pos = { x: 10.5, y: 20.3, z: 0.0 }
```

**Returns**: Copy of position object `{ x, y, z }`

---

### Laser State

#### setLaserState(active)
Update laser on/off state.

```javascript
machinePositionTracker.setLaserState(true)  // Laser ON
```

**Parameters**:
- `active`: Boolean (true = laser on, false = laser off)

**Behavior**:
- Updates `this.laserActive`
- Notifies all listeners
- Used for visualization

---

#### isLaserActive()
Check if laser is currently active.

```javascript
const laserOn = machinePositionTracker.isLaserActive()
// laserOn = true/false
```

**Returns**: Boolean

---

### Listener Management

#### addListener(callback)
Register a callback for position updates.

```javascript
machinePositionTracker.addListener((data) => {
  console.log('Position:', data.position)
  console.log('Laser:', data.laserActive)
})
```

**Parameters**:
- `callback`: Function receiving `{ position, laserActive }`

**Callback Data**:
```javascript
{
  position: { x: 10.5, y: 20.3, z: 0.0 },
  laserActive: false
}
```

---

#### removeListener(callback)
Unregister a position update callback.

```javascript
const handler = (data) => console.log(data)
machinePositionTracker.addListener(handler)
// Later...
machinePositionTracker.removeListener(handler)
```

**Parameters**:
- `callback`: Previously registered function

---

#### notifyListeners()
Notify all listeners of position/state change.

```javascript
machinePositionTracker.notifyListeners()
```

**Behavior**:
- Calls each registered callback
- Passes `{ position, laserActive }` object

---

### Cleanup

#### destroy()
Clean up resources and stop all tracking.

```javascript
machinePositionTracker.destroy()
```

**Behavior**:
- Stops movement tracking
- Clears all listeners
- Nulls WebSocket reference

**Called on**:
- WebSocket disconnect
- Component unmount
- Page navigation

## Usage Examples

### Example 1: JOG Button Integration
```javascript
import { machinePositionTracker } from '../utils/machinePositionTracker'

const handleJog = (xDir, yDir) => {
  const xMove = xDir * stepSize
  const yMove = yDir * stepSize
  
  sendGcode(`G91`)
  sendGcode(`G0 X${xMove} Y${yMove} F${feedRate}`)
  sendGcode(`G90`)
  
  // Start position tracking
  machinePositionTracker.startMovementTracking(
    serialState.port,  // 'COM7'
    feedRate,          // 1000 mm/min
    stepSize          // 5 mm
  )
}
```

### Example 2: Position Visualization
```javascript
import { machinePositionTracker } from '../utils/machinePositionTracker'

useEffect(() => {
  const handlePositionUpdate = (data) => {
    // Update crosshair position on canvas
    const { x, y, z } = data.position
    updateCrosshair(x, y)
    
    // Update laser indicator
    if (data.laserActive) {
      showLaserDot(x, y)
    }
  }
  
  machinePositionTracker.addListener(handlePositionUpdate)
  
  return () => {
    machinePositionTracker.removeListener(handlePositionUpdate)
  }
}, [])
```

### Example 3: SerialContext Integration
```javascript
// In SerialContext.jsx
useEffect(() => {
  if (wsRef.current?.readyState === WebSocket.OPEN && serialState.port) {
    machinePositionTracker.init(wsRef.current, serialState.port)
  }
}, [serialState.port])

// Handle serial data messages
case 'serial_data':
  machinePositionTracker.parsePositionResponse(data.message)
  break
```

## Position Response Parsing

### GRBL Response Format
```
<Idle|MPos:123.450,67.890,10.000|FS:1000,0>
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      MPos: Machine Position (absolute coordinates)
```

**Regex Pattern**:
```javascript
/<[^|]*\|MPos:([-\d.]+),([-\d.]+)(?:,([-\d.]+))?/i
```

**Capture Groups**:
1. X coordinate: `123.450`
2. Y coordinate: `67.890`
3. Z coordinate: `10.000` (optional)

### Marlin Response Format
```
X:123.45 Y:67.89 Z:10.00 E:0.00 Count X:123 Y:67 Z:10
^^^^^^^^^^^^^^^^^^^^^^^^^^
X:, Y:, Z: position values
```

**Regex Patterns**:
1. Uppercase: `/X:([-\d.]+)\s+Y:([-\d.]+)(?:\s+Z:([-\d.]+))?/i`
2. Lowercase: `/x:([-\d.]+)\s+y:([-\d.]+)(?:\s+z:([-\d.]+))?/i`

**Capture Groups**:
1. X coordinate: `123.45`
2. Y coordinate: `67.89`
3. Z coordinate: `10.00` (optional)

### Parsing Algorithm
```javascript
parsePositionResponse(response) {
  // Try GRBL format first
  const grblMatch = response.match(/<[^|]*\|MPos:([-\d.]+),([-\d.]+)(?:,([-\d.]+))?/i)
  if (grblMatch) {
    this.position = {
      x: parseFloat(grblMatch[1]),
      y: parseFloat(grblMatch[2]),
      z: grblMatch[3] ? parseFloat(grblMatch[3]) : 0
    }
    this.notifyListeners()
    return true
  }
  
  // Try Marlin format
  let match = response.match(/X:([-\d.]+)\s+Y:([-\d.]+)(?:\s+Z:([-\d.]+))?/i)
  if (!match) {
    match = response.match(/x:([-\d.]+)\s+y:([-\d.]+)(?:\s+z:([-\d.]+))?/i)
  }
  
  if (match) {
    this.position = {
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: match[3] ? parseFloat(match[3]) : 0
    }
    this.notifyListeners()
    return true
  }
  
  console.warn('⚠️ [POSITION] Could not parse response:', response)
  return false
}
```

## Timing and Performance

### Polling Interval
**Default**: 500ms (2 queries per second)

**Rationale**:
- Fast enough for visual feedback
- Doesn't overwhelm serial buffer
- Balances accuracy vs. performance

### Movement Duration Calculation
```javascript
const durationMs = (Math.abs(distance) / feedRate) * 60 * 1000
```

**Example** (5mm at 1000 mm/min):
```
duration = (5 / 1000) * 60 * 1000 = 300ms
```

**Buffer**: Add 1000ms safety margin
```
totalDuration = 300ms + 1000ms = 1300ms
```

### Query Timing
```
Movement starts
  ↓
0ms     - Start polling
500ms   - First query
1000ms  - Second query
1300ms  - Stop polling (duration + buffer)
1500ms  - Final query (200ms after stop)
```

## Logging

### Console Output Format
All tracking operations log to browser console:

```javascript
// Movement start
console.log('📍 [TRACKING] Starting position tracking:', {
  duration: 300,
  pollInterval: 500
})

// Position query
console.log('📤 [? QUERY] ========================================')
console.log('📤 [? QUERY] Sending GRBL status query to port:', 'COM7')
console.log('📤 [? QUERY] WebSocket state:', 1)
console.log('📤 [? QUERY] ========================================')

// Position update
console.log('📍 [POSITION] Parsing response:', '<Idle|MPos:10.5,20.3,0.0|...>')
console.log('✅ [POSITION] GRBL position parsed:', { x: 10.5, y: 20.3, z: 0 })

// Movement stop
console.log('📍 [TRACKING] Stopped position polling')
console.log('📍 [TRACKING] Final position query')
```

### Log Prefixes
- `📍 [TRACKING]`: Movement tracking events
- `📤 [? QUERY]`: Position query commands
- `📍 [POSITION]`: Position parsing results
- `✅`: Success
- `⚠️`: Warning
- `❌`: Error

## Error Handling

### WebSocket Not Connected
```javascript
if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
  console.warn('⚠️ [POSITION] Cannot query - WebSocket not connected')
  return
}
```

### Invalid Response Format
```javascript
if (!match) {
  console.warn('⚠️ [POSITION] Could not parse response:', response)
  return false
}
```

### Movement Tracking Cleanup
Always clean up intervals and timeouts:
```javascript
stopMovementTracking() {
  if (this.updateInterval) {
    clearInterval(this.updateInterval)
    this.updateInterval = null
  }
  if (this.movementTimeout) {
    clearTimeout(this.movementTimeout)
    this.movementTimeout = null
  }
}
```

## Integration Points

### 1. SerialContext
- **Initialize**: `init(wsConnection, portPath)`
- **Parse responses**: `parsePositionResponse(message)`
- **Cleanup**: `destroy()` on disconnect

### 2. JOG Controls
- **Start tracking**: `startMovementTracking()` on button press
- **Query position**: Automatic during movement

### 3. Canvas Visualization
- **Listen**: `addListener(callback)` for position updates
- **Draw**: Update crosshair/laser dot on canvas

### 4. Status Display
- **Show position**: Display X/Y/Z coordinates
- **Show laser state**: Indicator when laser is active

## Future Enhancements

### Planned Features
1. **Work Coordinate Offset**: Track WPos vs. MPos
2. **Feed Rate Override**: Display current override percentage
3. **Spindle Speed**: Track RPM for CNC operations
4. **Probe Status**: Monitor Z-probe state
5. **Buffer Status**: Track planner buffer fill level

### Configuration Options
```javascript
{
  pollInterval: 500,        // Customizable polling rate
  queryCommand: '?',        // GRBL or M114 for Marlin
  parseFormat: 'auto',      // Auto-detect or manual
  enableLogging: true,      // Console logging on/off
  visualizeTrail: true     // Show movement trail
}
```

## Troubleshooting

### Issue: Position Not Updating
**Check**:
1. WebSocket connected? (`wsRef.current.readyState === 1`)
2. Serial port open? (`serialState.connected === true`)
3. Correct firmware? (GRBL sends `<...>`, Marlin sends `X:...`)

### Issue: Inaccurate Position
**Verify**:
1. Machine steps/mm calibration
2. Coordinate mode (absolute G90 vs. relative G91)
3. Work coordinate offset (G54-G59)

### Issue: Position Lag
**Solutions**:
1. Decrease poll interval (faster updates)
2. Check serial baud rate (higher = faster)
3. Reduce G-code buffer delay

## Related Documentation
- [JOG Controls](./JOG_CONTROLS.md)
- [Companion App](./COMPANION_APP.md)
- [JOG Communication Flow](./JOG_COMMUNICATION_FLOW.md)
