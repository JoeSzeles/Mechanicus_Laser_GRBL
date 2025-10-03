
# Firmware Support Documentation

## Overview
Mechanicus CAD supports multiple CNC/3D printer firmware types with firmware-specific G-code generation. Each firmware has different command syntax, position reporting formats, and communication protocols.

## Supported Firmware

### 1. GRBL (Default)
**Recommended for:** Laser engravers, CNC routers, small CNCs  
**Default Baud Rate:** 115200

**Commands:**
- Position Query: `?`
- Home: `$H`
- Unlock: `$X`
- Reset: `Ctrl+X` (0x18)
- Feed Hold: `!`
- Resume: `~`

**Position Format:**
```
<Idle|MPos:123.45,67.89,10.00|WPos:123.45,67.89,10.00>
```

### 2. Marlin
**Recommended for:** 3D printers, larger CNCs  
**Default Baud Rate:** 250000

**Commands:**
- Position Query: `M114`
- Home: `G28`
- Unlock: `M999`
- Reset: `M112`
- Feed Hold: `M0`
- Resume: `M108`

**Position Format:**
```
X:123.45 Y:67.89 Z:10.00 E:0.00
```

### 3. Smoothieware
**Recommended for:** Advanced CNCs, laser cutters  
**Default Baud Rate:** 115200

**Commands:**
- Position Query: `?`
- Home: `$H`
- Unlock: `$X`
- Reset: `reset`
- Feed Hold: `!`
- Resume: `~`

**Position Format:**
```
<Idle|MPos:123.45,67.89,10.00>
```

## Selecting Firmware Type

### In Machine Settings Popup:
1. Open **Machine Settings** (gear icon)
2. Go to **Connection** tab
3. Under **Firmware Type**, select:
   - GRBL (Laser/CNC - baud 115200)
   - Marlin (3D Printer - baud 250000)
   - Smoothieware (CNC - baud 115200)

## G-code Generation Differences

### Preamble
**GRBL/Smoothie:**
```gcode
G21 ; Set units to millimeters
G90 ; Absolute positioning
```

**Marlin:**
```gcode
G21 ; Set units to millimeters
G90 ; Absolute positioning
M82 ; Absolute extrusion mode (3D printers)
```

### Postamble
**GRBL/Smoothie:**
```gcode
G0 Z10 ; Raise Z
G0 X0 Y0 ; Return to home
```

**Marlin:**
```gcode
M104 S0 ; Turn off extruder (if 3D printer)
M140 S0 ; Turn off bed
G91 ; Relative positioning
G1 Z10 F300 ; Raise Z
G90 ; Absolute positioning
G28 X0 Y0 ; Home X and Y
M84 ; Disable steppers
```

### Laser/Spindle Control
**GRBL/Smoothie:**
```gcode
M3 S1000 ; Spindle/Laser on at power 1000
M5 ; Spindle/Laser off
```

**Marlin:**
```gcode
M3 S1000 ; Spindle on (or M106 for laser via fan)
M5 ; Spindle off (or M107)
```

## Position Tracking

The Machine Position Tracker automatically uses the correct position query command based on selected firmware:

- **GRBL/Smoothie**: Sends `?` command
- **Marlin**: Sends `M114` command

Position responses are parsed differently:
- **GRBL**: `<Idle|MPos:x,y,z>`
- **Marlin**: `X:x Y:y Z:z`

## Jog Controls

Home and jog commands adapt to firmware:

### Home Command:
- **GRBL**: `$H`
- **Marlin**: `G28`
- **Smoothie**: `$H`

### Position Queries During Movement:
- Automatically sends correct query every 500ms
- Parses response based on firmware type
- Updates UI with current position

## API Integration

### Using Firmware Commands Programmatically:

```javascript
import { firmwareCommands, generateHomeCommand } from '@/utils/firmwareGcodeGenerators'

// Get firmware-specific home command
const homeCmd = generateHomeCommand('marlin') // Returns 'G28'

// Access all commands for a firmware
const grblCommands = firmwareCommands.grbl
console.log(grblCommands.position) // '?'
```

### Generating G-code:

```javascript
import { exportGcode } from '@/utils/firmwareGcodeGenerators'

const gcode = exportGcode(shapes, {
  firmwareType: 'marlin',
  machineType: 'cnc_printer',
  zTravel: 3,
  zDraw: 0,
  drawSpeed: 2000,
  travelSpeed: 3000
})
```

## Troubleshooting

### Issue: Position not updating
**Check:**
1. Correct firmware selected?
2. Machine responding to position queries?
3. Check companion app logs for responses

### Issue: Home command fails
**Check:**
1. Firmware type matches actual machine
2. Machine has endstops/limit switches configured
3. Homing enabled in firmware settings

### Issue: G-code not working
**Check:**
1. Firmware type correctly selected
2. Baud rate matches firmware (115200 vs 250000)
3. Machine supports specific commands

## Related Documentation
- [Machine Position Tracker](./MACHINE_POSITION_TRACKER.md)
- [Companion App](./COMPANION_APP.md)
- [Jog Controls](./JOG_CONTROLS.md)
