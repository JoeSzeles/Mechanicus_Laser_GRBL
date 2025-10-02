
# JOG Control Communication Flow - Complete Documentation

## Overview
This document provides a detailed explanation of how JOG commands flow from the user interface through the companion app to the physical CNC/laser engraver machine.

## Architecture Components

### 1. Frontend (React Application)
- **File**: `frontend/src/components/MachineJogControls.jsx`
- **Context**: `frontend/src/contexts/SerialContext.jsx`
- **Port**: Runs on port 5001 (Vite dev server)

### 2. Companion App (Node.js WebSocket/HTTP Server)
- **File**: `companion-app/src/index.js`
- **WebSocket Port**: 8080
- **HTTP Port**: 8008
- **Dashboard**: http://localhost:8008

### 3. Physical Machine
- **Connection**: USB Serial (e.g., COM7 on Windows, /dev/ttyUSB0 on Linux)
- **Protocol**: G-code over serial
- **Typical Baud Rate**: 115200 for GRBL

---

## Detailed Communication Flow

### Phase 1: Initial Connection Setup

#### Step 1.1: Frontend Connects to Companion App
```
Frontend (SerialContext.jsx)
  ↓
  connectToCompanion() is called on component mount
  ↓
  Opens WebSocket: ws://localhost:8080
  ↓
  wsRef.current = new WebSocket('ws://localhost:8080')
```

**Code Location**: `frontend/src/contexts/SerialContext.jsx:46`
```javascript
const wsUrl = 'ws://localhost:8080'
console.log('🔗 Connecting to LOCAL companion:', wsUrl)
const ws = new WebSocket(wsUrl)
wsRef.current = ws
```

#### Step 1.2: Companion App Accepts WebSocket Connection
```
Companion App (index.js)
  ↓
  WebSocket server listening on port 8080
  ↓
  Validates origin (localhost/LAN/replit.dev)
  ↓
  Adds client to this.clients Set
  ↓
  Sends initial 'status' message with serialState
```

**Code Location**: `companion-app/src/index.js:195-213`
```javascript
this.wss.on('connection', (ws, req) => {
  log('info', 'websocket', 'Client connected', { origin });
  this.clients.add(ws);
  
  // Send initial status to confirm connection
  this.sendToClient(ws, {
    type: 'status',
    data: { 
      connected: true,
      serialState: this.serialState 
    }
  });
});
```

#### Step 1.3: User Connects to Serial Port via Dashboard
```
Dashboard (http://localhost:8008)
  ↓
  User selects COM7 @ 115200 baud
  ↓
  HTTP POST /serial/connect
  ↓
  Body: { com: "COM7", baud: 115200 }
```

**Code Location**: `companion-app/src/index.js:415-470`
```javascript
this.app.post('/serial/connect', async (req, res) => {
  const { requestId, com, baud } = req.body;
  
  const serialPort = new SerialPort({
    path: com,
    baudRate: parseInt(baud),
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  });
  
  serialPort.on('open', () => {
    this.port = serialPort;
    this.serialState = {
      connected: true,
      port: com,
      baud: parseInt(baud),
      error: null,
      openedAt: Date.now(),
      byRequestId: requestId || null
    };
    
    // Broadcast to all WebSocket clients
    this.broadcastSSE({
      type: 'serial_state',
      data: this.serialState
    });
  });
});
```

#### Step 1.4: Frontend Receives Serial State Update
```
Frontend (SerialContext.jsx)
  ↓
  WebSocket onmessage receives { type: 'serial_state', data: {...} }
  ↓
  handleMessage() processes the message
  ↓
  setSerialState({ connected: true, port: "COM7", baud: 115200 })
  ↓
  setIsConnected(true)
  ↓
  JOG buttons become enabled
```

**Code Location**: `frontend/src/contexts/SerialContext.jsx:89-102`
```javascript
case 'serial_state':
  setSerialState(data)
  setIsConnected(data.connected)
  
  if (data.connected) {
    addMessage('success', `✅ Machine connected: ${data.port} @ ${data.baud} baud`)
  }
  break
```

---

### Phase 2: JOG Button Press (Sending G-code)

#### Step 2.1: User Clicks JOG Button
```
User Action: Clicks "Move Up" button (↑)
  ↓
MachineJogControls.jsx
  ↓
handleJog(0, 1) is called
  - xDir = 0 (no X movement)
  - yDir = 1 (positive Y direction)
  - stepSize = 5mm (from state)
  - feedRate = 1000 (from state)
```

**Code Location**: `frontend/src/components/MachineJogControls.jsx:14-38`
```javascript
const handleJog = (xDir, yDir) => {
  if (!isReady) return
  if (!isValidNumber(feedRate) || !isValidNumber(stepSize)) return

  const xMove = xDir * stepSize  // 0 * 5 = 0
  const yMove = yDir * stepSize  // 1 * 5 = 5

  console.log('🕹️ [JOG] Jogging machine:', {
    direction: { x: xDir, y: yDir },
    distance: { x: xMove, y: yMove },
    feedRate,
    port: serialState.port
  })

  const gcodeCommands = [
    'G91',  // Relative positioning
    `G0 X${xMove.toFixed(3)} Y${yMove.toFixed(3)} F${feedRate}`,  // Move command
    'G90'   // Back to absolute positioning
  ]

  console.log('🕹️ [JOG] Sending G-code sequence:', gcodeCommands)

  // Send each G-code command individually
  sendGcode(`G91`)
  sendGcode(`G0 X${xMove.toFixed(3)} Y${yMove.toFixed(3)} F${feedRate}`)
  sendGcode(`G90`)
}
```

**Generated G-code for "Move Up by 5mm at 1000 feed rate"**:
```gcode
G91              # Switch to relative positioning mode
G0 X0.000 Y5.000 F1000   # Move Y+5mm at feed rate 1000
G90              # Switch back to absolute positioning mode
```

#### Step 2.2: sendGcode() Sends via WebSocket
```
SerialContext.jsx
  ↓
sendGcode(gcode) is called 3 times (once per G-code line)
  ↓
Checks: WebSocket is OPEN && isConnected && serialState.port exists
  ↓
Creates payload object
  ↓
JSON.stringify() and send via WebSocket
```

**Code Location**: `frontend/src/contexts/SerialContext.jsx:131-156`
```javascript
const sendGcode = (gcode) => {
  if (wsRef.current?.readyState === WebSocket.OPEN && isConnected && serialState.port) {
    const payload = {
      type: 'send_gcode',
      payload: { 
        portPath: serialState.port,  // "COM7"
        gcode                         // "G91" or "G0 X0.000 Y5.000 F1000" or "G90"
      }
    }
    
    console.log('📤 [GCODE SEND] Sending to companion app:', {
      destination: 'ws://localhost:8080',
      port: serialState.port,
      gcodePreview: gcode.substring(0, 100),
      gcodeLength: gcode.length
    })
    
    wsRef.current.send(JSON.stringify(payload))
    addMessage('info', `📤 Sending G-code to ${serialState.port}`)
  } else {
    console.error('❌ [GCODE SEND] Cannot send - not connected')
  }
}
```

**WebSocket Message Format**:
```json
{
  "type": "send_gcode",
  "payload": {
    "portPath": "COM7",
    "gcode": "G91"
  }
}
```

---

### Phase 3: Companion App Receives G-code

#### Step 3.1: WebSocket Message Handler
```
Companion App (index.js)
  ↓
ws.on('message', ...) receives raw message
  ↓
JSON.parse(message) → { type, payload }
  ↓
handleClientMessage(ws, data) is called
  ↓
switch(type) routes to sendGcode()
```

**Code Location**: `companion-app/src/index.js:215-229`
```javascript
ws.on('message', async (message) => {
  try {
    const data = JSON.parse(message);
    await this.handleClientMessage(ws, data);
  } catch (error) {
    console.error('❌ Error handling client message:', error);
    this.sendToClient(ws, {
      type: 'error',
      data: { message: error.message }
    });
  }
});

async handleClientMessage(ws, data) {
  const { type, payload } = data;
  
  switch (type) {
    case 'send_gcode':
      await this.sendGcode(ws, payload);
      break;
    // ... other cases
  }
}
```

#### Step 3.2: sendGcode() Validates and Processes
```
sendGcode(ws, { portPath, gcode })
  ↓
Logs: '📥 Received send_gcode command'
  ↓
Validates: this.port exists && this.serialState.connected && portPath matches
  ↓
Splits gcode by newlines, filters comments
  ↓
Iterates through each line
  ↓
Writes to serial port with line ending
```

**Code Location**: `companion-app/src/index.js:821-911`
```javascript
async sendGcode(ws, { portPath, gcode, filename }) {
  try {
    log('info', 'gcode', '📥 Received send_gcode command', { 
      portPath, 
      filename: filename || 'manual', 
      gcodeLength: gcode?.length || 0 
    });
    
    // VALIDATION: Check if port is connected via HTTP
    if (!this.port || !this.serialState.connected || this.serialState.port !== portPath) {
      const errorMsg = `Port ${portPath} is not connected. Current state: ${JSON.stringify(this.serialState)}`;
      log('error', 'gcode', errorMsg, { 
        portPath, 
        httpPort: this.serialState.port,
        httpConnected: this.serialState.connected
      });
      throw new Error(errorMsg);
    }

    log('info', 'gcode', '✅ Using HTTP connection for G-code', { 
      portPath, 
      baud: this.serialState.baud 
    });
    
    const serialPort = this.port;
    const lineEnding = '\n';

    // PROCESSING: Split and filter G-code
    const lines = gcode.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith(';'); // Remove empty lines and comments
    });

    log('info', 'gcode', `Sending ${lines.length} lines of G-code`, { portPath });

    this.broadcastToClients({
      type: 'gcode_start',
      data: { portPath, filename, totalLines: lines.length }
    });

    // TRANSMISSION: Write each line to serial port
    let lineNumber = 0;
    for (const line of lines) {
      if (!this.isTransmitting) break;
      
      const command = line.trim() + lineEnding;
      log('debug', 'gcode', `✅ Writing to ${portPath}`, { 
        line: line.trim(), 
        lineNumber: lineNumber + 1 
      });
      
      serialPort.write(command);  // ← ACTUAL SERIAL PORT WRITE
      lineNumber++;
      
      // Progress update
      this.broadcastToClients({
        type: 'gcode_progress',
        data: { 
          portPath, 
          lineNumber, 
          totalLines: lines.length,
          percentage: Math.round((lineNumber / lines.length) * 100),
          currentLine: line.trim()
        }
      });
      
      // 10ms delay to prevent buffer overflow
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isTransmitting = false;
    this.broadcastToClients({
      type: 'gcode_complete',
      data: { portPath, linesTransmitted: lineNumber }
    });
    
    log('info', 'gcode', `✅ G-code transmission complete: ${lineNumber} lines`, { portPath });
    
  } catch (error) {
    this.isTransmitting = false;
    log('error', 'gcode', '❌ G-code transmission failed', { 
      error: error.message, 
      portPath 
    });
    this.sendToClient(ws, {
      type: 'gcode_error',
      data: { message: error.message }
    });
  }
}
```

---

### Phase 4: Physical Serial Port Transmission

#### Step 4.1: SerialPort.write() System Call
```
Node.js SerialPort Library
  ↓
serialPort.write(command)
  - command = "G91\n" (first call)
  ↓
Native bindings (C++ addon)
  ↓
Operating System Serial Driver
  ↓
USB-to-Serial Chip (FTDI, CH340, etc.)
  ↓
Physical USB cable
  ↓
Machine's serial receiver (UART)
```

**Technical Details**:
- **Baud Rate**: 115200 bits per second
- **Data Bits**: 8
- **Stop Bits**: 1
- **Parity**: None
- **Flow Control**: None
- **Line Ending**: `\n` (newline character, ASCII 10)

#### Step 4.2: Machine Processes G-code
```
Machine Firmware (GRBL/Marlin)
  ↓
Receives bytes via UART
  ↓
Buffers until newline character (\n)
  ↓
Parses G-code command
  ↓
Validates command syntax
  ↓
Adds to motion planner buffer
  ↓
Executes stepper motor movements
  ↓
Sends response: "ok\n" or "error:X\n"
```

**GRBL Response for Successful Command**:
```
ok
```

**GRBL Response for Error**:
```
error:1
```

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: USER CLICKS JOG BUTTON (↑ Move Up 5mm @ F1000)           │
└─────────────────────────────────────────────────────────────────────┘

[User Browser]
    │
    │ Click event
    │
    ▼
[MachineJogControls.jsx:handleJog(0, 1)]
    │
    │ Calculates: xMove=0, yMove=5
    │ Generates: ["G91", "G0 X0.000 Y5.000 F1000", "G90"]
    │
    ▼
[SerialContext.jsx:sendGcode("G91")]  ← First call
    │
    │ Creates WebSocket message:
    │ { type: "send_gcode", payload: { portPath: "COM7", gcode: "G91" } }
    │
    ▼
[WebSocket] ws://localhost:8080
    │
    │ Binary TCP transmission over loopback (127.0.0.1:8080)
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: COMPANION APP RECEIVES MESSAGE                            │
└─────────────────────────────────────────────────────────────────────┘

[Companion App:8080] ws.on('message')
    │
    │ JSON.parse() → { type: "send_gcode", ... }
    │
    ▼
[handleClientMessage(ws, data)]
    │
    │ Routes to: sendGcode(ws, payload)
    │
    ▼
[sendGcode(ws, { portPath: "COM7", gcode: "G91" })]
    │
    │ Validates: this.port.path === "COM7" ✓
    │ Validates: this.serialState.connected === true ✓
    │
    ▼
[Split and Filter]
    │
    │ Input: "G91"
    │ Output: ["G91"]
    │
    ▼
[serialPort.write("G91\n")]
    │
    │ Native Node.js SerialPort library
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: OPERATING SYSTEM SERIAL TRANSMISSION                      │
└─────────────────────────────────────────────────────────────────────┘

[OS Serial Driver]
    │
    │ Windows: COM7 device driver
    │ Linux: /dev/ttyUSB0 device driver
    │
    ▼
[USB-to-Serial Chip]
    │
    │ Converts parallel bytes to serial bits
    │ UART protocol at 115200 baud
    │
    ▼
[Physical USB Cable]
    │
    │ Electrical signals: TX/RX lines
    │ Voltage levels: TTL (0V = logic 0, 5V = logic 1)
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 4: MACHINE RECEIVES AND EXECUTES                             │
└─────────────────────────────────────────────────────────────────────┘

[Machine UART Receiver]
    │
    │ ATmega328P microcontroller (on GRBL)
    │ Receives serial bits at 115200 baud
    │
    ▼
[GRBL Firmware Buffer]
    │
    │ Accumulates: 'G', '9', '1', '\n'
    │
    ▼
[G-code Parser]
    │
    │ Interprets: G91 = "Set to Relative Positioning Mode"
    │
    ▼
[Motion Planner]
    │
    │ Updates internal state: positioning_mode = RELATIVE
    │
    ▼
[Response Generator]
    │
    │ Sends back via serial: "ok\n"
    │
    ▼
[USB-to-Serial TX] → [USB Cable] → [Computer COM7]
    │
    ▼
[Companion App] serialPort.on('data')
    │
    │ Receives: "ok\n"
    │ Logs: "Machine response: ok"
    │
    └─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 5: REPEAT FOR REMAINING G-CODE LINES                         │
└─────────────────────────────────────────────────────────────────────┘

[SerialContext.jsx:sendGcode("G0 X0.000 Y5.000 F1000")]  ← Second call
    │
    └──► [Same flow as above]
         │
         └──► Machine moves Y-axis +5mm at feedrate 1000

[SerialContext.jsx:sendGcode("G90")]  ← Third call
    │
    └──► [Same flow as above]
         │
         └──► Machine switches back to absolute positioning
```

---

## Timing Analysis

### Typical Latencies for "Move Up 5mm" Command

| Stage | Time | Description |
|-------|------|-------------|
| User click to sendGcode() | ~10ms | React event handling + state reads |
| WebSocket send | ~1ms | Local loopback, no network delay |
| Companion receives | ~1ms | JSON parse + routing |
| SerialPort.write() | ~5ms | OS serial driver buffering |
| USB transmission (13 bytes @ 115200) | ~1.1ms | (13 bytes × 10 bits/byte) ÷ 115200 bps |
| GRBL parse + execute | ~10-50ms | Depends on motion buffer |
| Machine response "ok\n" | ~1ms | Serial transmission back |
| **TOTAL** | **~30-70ms** | From click to motion start |

### Calculation for Serial Transmission Time
```
G-code: "G91\n" = 4 bytes
Serial format: 8 data bits + 1 start bit + 1 stop bit = 10 bits per byte
Total bits: 4 bytes × 10 bits/byte = 40 bits
Baud rate: 115200 bits/second
Time: 40 bits ÷ 115200 bps = 0.347ms ≈ 0.35ms
```

---

## Error Handling

### Common Error Scenarios

#### Error 1: "Port COM7 is not connected"
**Cause**: Frontend sends G-code before serial port is opened
**Solution**: Check `isConnected && serialState.port` before sending

#### Error 2: "WebSocket closed without opened"
**Cause**: Companion app is not running
**Solution**: Start companion app: `cd companion-app && npm start`

#### Error 3: "Access denied to COM7"
**Cause**: Another application has exclusive access to serial port
**Solution**: Close other serial monitor applications

#### Error 4: "Machine not responding"
**Cause**: Wrong baud rate or disconnected cable
**Solution**: Verify baud rate matches machine firmware (usually 115200 for GRBL)

---

## Logging Points for Debugging

### Frontend Console Logs
```javascript
// In MachineJogControls.jsx
console.log('🕹️ [JOG] Jogging machine:', { direction, distance, feedRate, port })
console.log('🕹️ [JOG] Sending G-code sequence:', gcodeCommands)

// In SerialContext.jsx
console.log('📤 [GCODE SEND] Sending to companion app:', { destination, port, gcodePreview })
console.log('✅ Received status from companion, now truly connected')
```

### Companion App Logs
```javascript
// In index.js
log('info', 'gcode', '📥 Received send_gcode command', { portPath, gcodeLength })
log('info', 'gcode', '✅ Using HTTP connection for G-code', { portPath, baud })
log('debug', 'gcode', `✅ Writing to ${portPath}`, { line, lineNumber })
log('info', 'gcode', `✅ G-code transmission complete: ${lineNumber} lines`, { portPath })
```

### How to View Logs
1. **Frontend**: Open browser DevTools (F12) → Console tab
2. **Companion**: Terminal running `cd companion-app && npm start`
3. **Dashboard**: http://localhost:8008 → Logs section

---

## Connection State Management

### Serial State Object
```javascript
this.serialState = {
  connected: true,           // Boolean: Is port open?
  port: "COM7",              // String: Port path
  baud: 115200,              // Number: Baud rate
  error: null,               // String: Last error message
  openedAt: 1736789423000,   // Number: Timestamp of connection
  byRequestId: "abc123"      // String: Request tracking ID
}
```

This state is:
1. **Set** by HTTP POST `/serial/connect`
2. **Stored** in `companion-app/src/index.js:this.serialState`
3. **Broadcast** via WebSocket to all connected clients
4. **Read** by `sendGcode()` to validate connection
5. **Displayed** in frontend UI to enable/disable JOG buttons

---

## Summary

The JOG control system uses a **three-layer architecture**:

1. **Frontend Layer** (React + WebSocket client)
   - UI buttons generate G-code
   - WebSocket sends G-code to companion

2. **Companion Layer** (Node.js + SerialPort)
   - HTTP API manages serial connections
   - WebSocket receives G-code commands
   - SerialPort library writes to physical port

3. **Hardware Layer** (USB Serial + Machine Firmware)
   - USB-to-Serial chip converts data
   - Machine firmware executes G-code
   - Stepper motors move axes

**Key Design Decision**: The companion app uses **HTTP for connection management** and **WebSocket for G-code streaming**, allowing the dashboard and CAD interface to share a single serial connection while maintaining real-time communication.

