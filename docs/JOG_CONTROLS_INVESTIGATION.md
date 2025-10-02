
# JOG Controls Investigation

## Overview
The JOG controls allow manual movement of the CNC/laser engraver machine through a UI interface that sends G-code commands via the companion app.

## Architecture Flow

### 1. User Interface (MachineJogControls.jsx)
- **Location**: `frontend/src/components/MachineJogControls.jsx`
- **Purpose**: Provides directional jog buttons and feed rate/step size inputs
- **State Management**: Uses `useSerial()` hook from SerialContext

### 2. Communication Flow

```
[User clicks JOG button] 
    ↓
[MachineJogControls.jsx - handleJog()]
    ↓
[SerialContext.jsx - sendGcode()]
    ↓
[WebSocket message to companion app]
    ↓
[companion-app/src/index.js - handleClientMessage()]
    ↓
[sendGcode() method in companion]
    ↓
[SerialPort.write() to COM port]
    ↓
[Physical Machine]
```

## G-code Commands Sent

When user clicks a JOG button (e.g., move up by 5mm at 1000 feed rate):

```gcode
G91              # Switch to relative positioning mode
G0 X0.000 Y5.000 F1000   # Move Y+5mm at feed rate 1000
G90              # Switch back to absolute positioning mode
```

## Current Issue: "Port COM7 is not connected"

### Root Cause
The issue is in how the companion app tracks serial connections:

1. **Frontend sends**: `{ type: 'send_gcode', payload: { portPath: 'COM7', gcode: '...' } }`
2. **Companion checks**: `this.connectedPorts.has(portPath)` 
3. **Problem**: The `connectedPorts` Map is NEVER populated!

### Code Analysis

**In companion-app/src/index.js:**

- The `/serial/connect` HTTP endpoint sets `this.port` and `this.serialState`
- BUT it does NOT add to `this.connectedPorts` Map
- The `sendGcode()` WebSocket handler checks `this.connectedPorts.get(portPath)`
- This check always fails because the Map is empty

### Why This Happens

There are TWO separate connection systems in the companion app:

1. **HTTP REST API** (`/serial/connect`) - Used by dashboard
2. **WebSocket API** (`connect` message) - Used by legacy clients

The JOG controls use the WebSocket `send_gcode` command, which expects connections made via WebSocket `connect` message. But the actual connection is made via HTTP `/serial/connect`, which uses a different storage mechanism.

## Solution

The companion app needs to check BOTH:
- `this.connectedPorts` (WebSocket connections)
- `this.port` and `this.serialState` (HTTP connections)

The `sendGcode()` WebSocket handler should fall back to `this.port` when `connectedPorts` is empty.

## Expected Behavior

After fix, the flow should be:

1. User clicks JOG up button (5mm step, 1000 feed)
2. Frontend logs: `📤 Sending G-code: G91\nG0 X0.000 Y5.000 F1000\nG90` to companion at `ws://localhost:8080`
3. Companion logs: `📥 Received send_gcode for port COM7`
4. Companion logs: `✅ Writing to serial port COM7: G91`
5. Companion logs: `✅ Writing to serial port COM7: G0 X0.000 Y5.000 F1000`
6. Companion logs: `✅ Writing to serial port COM7: G90`
7. Machine moves

## Console Logging Requirements

### Frontend (SerialContext.jsx)
- Log outgoing G-code with destination
- Log WebSocket connection state
- Log companion app responses

### Companion App (index.js)
- Log incoming WebSocket messages with type
- Log serial port write operations with port path
- Log any errors with context

## Files to Modify

1. `frontend/src/contexts/SerialContext.jsx` - Add detailed logging
2. `companion-app/src/index.js` - Fix port checking logic, add logging
3. `frontend/src/components/MachineJogControls.jsx` - Add G-code logging
