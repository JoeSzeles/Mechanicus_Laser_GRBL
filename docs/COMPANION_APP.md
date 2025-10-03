
# Companion App Documentation

## Overview
The Mechanicus Companion App is a local Node.js application that bridges serial communication between the web-based CAD interface and physical CNC/laser engraver machines. It runs on the user's local machine to provide WebSocket and HTTP APIs for machine control.

## Architecture

### Technology Stack
- **Runtime**: Node.js
- **WebSocket Server**: `ws` library on port 8080
- **HTTP Server**: Express on port 8008
- **Serial Communication**: `serialport` library
- **Authentication**: Session-based JWT tokens (2-minute expiry)

### Network Ports
- **WebSocket**: `ws://localhost:8080` (machine communication)
- **HTTP API**: `http://localhost:8008` (dashboard and control)
- **Dashboard**: `http://localhost:8008` (web UI)

## Features

### 1. Serial Port Management
- **Connection**: Open/close serial ports with configurable baud rates
- **Auto-scan**: Detect available COM ports and test baud rates
- **Firmware detection**: Identify GRBL, Marlin, or Smoothieware
- **Hot-plug support**: Handle device connect/disconnect events

### 2. WebSocket Communication
- **Real-time messaging**: Bidirectional communication with CAD app
- **Multi-client support**: Multiple browser tabs can connect
- **Message routing**: Type-based message handling
- **Broadcast updates**: Send status to all connected clients

### 3. Machine Profiles
Pre-configured profiles for common firmware:
- **GRBL**: Baud 115200, standard laser engraver
- **Marlin**: Baud 250000, 3D printer/CNC
- **Smoothieware**: Baud 115200, advanced CNC

### 4. G-code Transmission
- **Line-by-line sending**: Sequential G-code transmission
- **Progress tracking**: Real-time percentage updates
- **Buffer management**: 10ms delay between lines
- **Comment filtering**: Strips semicolon comments
- **Error handling**: Reports transmission failures

### 5. Security
- **Origin validation**: Strict CORS with localhost + LAN IPs
- **Session tokens**: JWT-based authentication with 2-min expiry
- **Pairing system**: Explicit approval for remote origins
- **Wildcard mode**: Optional auto-accept for `*.replit.dev`

### 6. Logging System
- **Structured logging**: Type, category, message format
- **In-memory buffer**: Last 500 log entries
- **SSE streaming**: Real-time log delivery to dashboard
- **Log levels**: info, debug, error, warning

## Installation

```bash
cd companion-app
npm install
npm start
```

### Dependencies
```json
{
  "express": "^4.18.2",
  "ws": "^8.14.2",
  "serialport": "^12.0.0",
  "cors": "^2.8.5",
  "jsonwebtoken": "^9.0.2"
}
```

## HTTP API Endpoints

### GET /
**Description**: Serves the dashboard UI  
**Response**: HTML page

### GET /status
**Description**: Returns current connection status  
**Response**:
```json
{
  "connected": true,
  "serialState": {
    "port": "COM7",
    "baud": 115200,
    "connected": true
  },
  "pairedOrigins": ["http://localhost:5001"],
  "wildcard": false
}
```

### POST /serial/connect
**Description**: Open a serial port connection  
**Request Body**:
```json
{
  "com": "COM7",
  "baud": 115200,
  "requestId": "abc123"
}
```
**Response**:
```json
{
  "success": true,
  "port": "COM7",
  "baud": 115200
}
```

### POST /serial/disconnect
**Description**: Close the current serial port  
**Response**:
```json
{
  "success": true,
  "message": "Disconnected from COM7"
}
```

### GET /serial/scan
**Description**: Scan for available COM ports  
**Response**:
```json
{
  "ports": [
    { "path": "COM7", "manufacturer": "FTDI" },
    { "path": "COM3", "manufacturer": "Arduino" }
  ]
}
```

### GET /events
**Description**: Server-Sent Events stream for real-time updates  
**Event Types**:
- `status`: Connection status changes
- `request`: New connection requests
- `paired`: Origin pairing updates

### GET /logs
**Description**: SSE stream of log entries  
**Response**: Stream of log objects

### POST /pair/accept
**Description**: Accept a connection request  
**Request Body**:
```json
{
  "origin": "https://abc123.replit.dev"
}
```

### POST /pair/decline
**Description**: Decline a connection request  
**Request Body**:
```json
{
  "origin": "https://abc123.replit.dev"
}
```

### DELETE /origin/:origin
**Description**: Remove a paired origin  
**Parameters**: `origin` (URL-encoded)

### POST /settings/wildcard
**Description**: Update wildcard setting  
**Request Body**:
```json
{
  "enabled": true
}
```

## WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080')
```

### Message Format
All messages use JSON:
```json
{
  "type": "message_type",
  "payload": { /* data */ }
}
```

### Client → Server Messages

#### send_gcode
Send G-code to machine:
```json
{
  "type": "send_gcode",
  "payload": {
    "portPath": "COM7",
    "gcode": "G91\nG0 X5 Y5 F1000\nG90"
  }
}
```

#### send_command
Send single command (like `?` for position):
```json
{
  "type": "send_command",
  "payload": {
    "portPath": "COM7",
    "command": "?"
  }
}
```

#### emergency_stop
Immediate feed hold:
```json
{
  "type": "emergency_stop",
  "payload": {
    "portPath": "COM7"
  }
}
```

### Server → Client Messages

#### serial_state
Connection status update:
```json
{
  "type": "serial_state",
  "data": {
    "connected": true,
    "port": "COM7",
    "baud": 115200,
    "error": null
  }
}
```

#### serial_data
Machine response data:
```json
{
  "type": "serial_data",
  "message": "ok"
}
```

#### gcode_start
G-code transmission started:
```json
{
  "type": "gcode_start",
  "data": {
    "portPath": "COM7",
    "filename": "project.gcode",
    "totalLines": 150
  }
}
```

#### gcode_progress
G-code transmission progress:
```json
{
  "type": "gcode_progress",
  "data": {
    "lineNumber": 75,
    "totalLines": 150,
    "percentage": 50,
    "currentLine": "G0 X10 Y20"
  }
}
```

#### gcode_complete
G-code transmission finished:
```json
{
  "type": "gcode_complete",
  "data": {
    "portPath": "COM7",
    "linesTransmitted": 150
  }
}
```

#### gcode_error
G-code transmission error:
```json
{
  "type": "gcode_error",
  "data": {
    "message": "Serial port not connected"
  }
}
```

## Serial Port Communication

### Opening a Port
```javascript
const serialPort = new SerialPort({
  path: 'COM7',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
})
```

### Writing G-code
```javascript
serialPort.write('G91\n')  // Newline terminator required
```

### Reading Responses
```javascript
serialPort.on('data', (data) => {
  const response = data.toString('utf-8')
  console.log('Machine response:', response)
})
```

### Error Handling
```javascript
serialPort.on('error', (err) => {
  console.error('Serial port error:', err)
})
```

## Logging System

### Log Entry Structure
```javascript
{
  type: 'info',           // info|debug|error|warning
  category: 'gcode',      // gcode|serial|websocket|http
  message: 'Description',
  data: { /* context */ },
  timestamp: '2025-01-13T10:30:00.000Z'
}
```

### Log Function
```javascript
log('info', 'gcode', '📥 Received send_gcode command', { 
  portPath: 'COM7',
  gcodeLength: 150 
})
```

### Console Output Format
```
[2025-01-13T10:30:00.000Z] [info] [gcode] 📥 Received send_gcode command {"portPath":"COM7","gcodeLength":150}
```

### Viewing Logs
1. **Terminal**: Logs appear in npm start terminal
2. **Dashboard**: View real-time logs at http://localhost:8008
3. **SSE Stream**: GET http://localhost:8008/logs

## Dashboard UI

### Sections

#### 1. Connected Users
- Shows username of connected users
- Disconnect button for each user
- Real-time connection status

#### 2. Log Viewer
- **Green text**: Incoming commands from main app
- **Red text**: Outgoing commands to main app  
- **Purple text**: Incoming responses from machine
- **Blue text**: Outgoing responses to machine
- Auto-scroll to latest entry
- Filterable by type/category

#### 3. Serial Port Control
- **Connect button**: Open port with selected COM/baud
- **Disconnect button**: Close active port
- **Scan button**: Auto-detect ports and firmware
- Status indicator (green = connected)

#### 4. Settings
- **Wildcard toggle**: Auto-accept `*.replit.dev` origins
- **Origin management**: View/remove paired origins

## Session Management

### Token Generation
```javascript
const token = jwt.sign(
  { userId: user.id, username: user.username },
  JWT_SECRET,
  { expiresIn: '2m' }
)
```

### Token Validation
```javascript
jwt.verify(token, JWT_SECRET, (err, decoded) => {
  if (err) return res.status(401).json({ error: 'Invalid token' })
  // Token valid, proceed
})
```

### Auto-Renewal
Tokens auto-renew on each request, maintaining active sessions.

## Auto-Scan Feature

### Scan Process
1. List all available serial ports
2. For each port, test common baud rates: [115200, 250000, 9600]
3. Send firmware detection commands:
   - GRBL: `$$` (returns settings)
   - Marlin: `M115` (returns firmware info)
   - Smoothie: `version` (returns version)
4. Parse responses to identify firmware
5. Return detected ports with firmware info

### Usage
```javascript
// HTTP endpoint
GET /serial/scan

// Response
{
  "ports": [
    { 
      "path": "COM7", 
      "baud": 115200, 
      "firmware": "GRBL v1.1",
      "manufacturer": "FTDI"
    }
  ]
}
```

## Configuration

### Config File Location
`.config/.mechanicus-companion/config.json`

### Config Structure
```json
{
  "pairedOrigins": {
    "http://localhost:5001": {
      "createdAt": "2025-01-13T10:00:00.000Z",
      "lastSeen": "2025-01-13T10:30:00.000Z"
    }
  },
  "settings": {
    "wildcard": false
  }
}
```

### Loading Config
```javascript
const config = JSON.parse(
  fs.readFileSync(CONFIG_PATH, 'utf-8')
)
```

## Error Handling

### Common Errors

#### Port Access Denied
```
Error: Error: Access denied
Cause: Another application is using the port
Solution: Close other serial monitors
```

#### Invalid Baud Rate
```
Error: Error: Invalid baud rate
Cause: Unsupported baud rate
Solution: Use standard rates (9600, 115200, 250000)
```

#### Connection Timeout
```
Error: Error: Opening COM7: Timeout
Cause: Machine not responding
Solution: Check physical connection, try different baud
```

### Error Logging
All errors logged with full context:
```javascript
log('error', 'serial', '❌ Failed to open port', {
  port: 'COM7',
  error: err.message
})
```

## Best Practices

### 1. Connection Management
- Always close ports before opening new ones
- Handle disconnect events gracefully
- Provide clear error messages to users

### 2. G-code Transmission
- Add 10ms delay between lines to prevent buffer overflow
- Filter comments and empty lines
- Track transmission progress for user feedback

### 3. Security
- Never auto-accept unknown origins in production
- Rotate session tokens regularly
- Validate all incoming WebSocket messages

### 4. Performance
- Keep log buffer limited (500 entries)
- Use efficient JSON parsing
- Minimize broadcast frequency

## Troubleshooting

### Issue: WebSocket Won't Connect
**Check**:
1. Companion app running? (`npm start`)
2. Port 8080 available? (no firewall block)
3. Correct URL? (`ws://localhost:8080`)

### Issue: Serial Port Not Found
**Check**:
1. Device drivers installed?
2. Port path correct? (Windows: COM7, Linux: /dev/ttyUSB0)
3. USB cable connected?

### Issue: Machine Not Responding
**Check**:
1. Correct baud rate?
2. Machine powered on?
3. Firmware compatible? (send test commands)

## Related Documentation
- [JOG Controls](./JOG_CONTROLS.md)
- [Machine Position Tracker](./MACHINE_POSITION_TRACKER.md)
- [JOG Communication Flow](./JOG_COMMUNICATION_FLOW.md)
