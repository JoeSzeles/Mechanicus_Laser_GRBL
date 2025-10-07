import { useState, useEffect } from 'react'
import { useSerial } from '../contexts/SerialContext'
import useCadStore from '../store/cadStore'
import { machinePositionTracker } from '../utils/machinePositionTracker'
import './EngravingToolsWindow.css'

// Assume parseSVGPath is defined elsewhere or imported
// For demonstration purposes, let's define a placeholder if it's not provided:
const parseSVGPath = (pathData) => {
  // This is a simplified placeholder. A real implementation would parse SVG path data string.
  // Example pathData: "M10 10 L90 10 L90 90 Z"
  const commands = [];
  const segments = pathData.match(/([MLZ])([^MLZ]*)/g);
  if (!segments) return [];

  segments.forEach(segment => {
    const type = segment[0];
    const coords = segment.substring(1).trim().split(/[\s,]+/).map(Number);
    if (type === 'M') {
      commands.push({ type: 'M', x: coords[0], y: coords[1] });
    } else if (type === 'L') {
      commands.push({ type: 'L', x: coords[0], y: coords[1] });
    } else if (type === 'Z') {
      commands.push({ type: 'Z' });
    }
  });
  return commands;
};

// Assume generateLaserControl is defined elsewhere or imported
const generateLaserControl = (firmware, power, on) => {
  if (!on) return 'M5'; // Turn off laser
  if (firmware === 'grbl') {
    // GRBL uses M3/M4 for laser control. S parameter is power.
    return `M3 S${power}`;
  } else if (firmware === 'marlin') {
    // Marlin also uses M3/M4. S parameter is power.
    return `M3 S${power}`;
  }
  return ''; // Default or unsupported
};

// Assume generateHomeCommand is defined elsewhere or imported
const generateHomeCommand = (firmware) => {
  if (firmware === 'grbl') {
    return '$H'; // GRBL home command
  } else if (firmware === 'marlin') {
    return 'G28'; // Marlin home command
  }
  return 'G28'; // Default to G28
};

// Assume generateMovement is defined elsewhere or imported (needed for the changes)
const generateMovement = (firmware, x, y, z, feedRate, rapid = false) => {
  const type = rapid ? 'G0' : 'G1';
  let command = `${type}`;
  if (x !== null && x !== undefined) command += ` X${x.toFixed(3)}`;
  if (y !== null && y !== undefined) command += ` Y${y.toFixed(3)}`;
  if (z !== null && z !== undefined) command += ` Z${z.toFixed(3)}`;
  if (feedRate !== null && feedRate !== undefined) command += ` F${feedRate}`;
  return command;
};


function EngravingToolsWindow() {
  const shapes = useCadStore((state) => state.shapes)
  const layers = useCadStore((state) => state.layers)
  const machineProfile = useCadStore((state) => state.machineProfile)
  const machineConnection = useCadStore((state) => state.machineConnection)
  const { sendGcode, isConnected, serialState } = useSerial()

  // Load saved values from localStorage or use machine profile defaults
  const [feedRate, setFeedRate] = useState(() => {
    const saved = localStorage.getItem('engraving_feedRate')
    return saved ? parseInt(saved) : machineConnection?.currentProfile?.drawSpeed || 2000
  })

  const [laserPower, setLaserPower] = useState(() => {
    const saved = localStorage.getItem('engraving_laserPower')
    return saved ? parseInt(saved) : machineConnection?.currentProfile?.laserPower || 1000
  })

  const [passes, setPasses] = useState(() => {
    const saved = localStorage.getItem('engraving_passes')
    return saved ? parseInt(saved) : 1
  })

  const [isEngraving, setIsEngraving] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [status, setStatus] = useState('')
  const [selectedShapeIds, setSelectedShapeIds] = useState([])

  // Listen for engrave-selected event
  useEffect(() => {
    const handleEngraveSelected = (event) => {
      console.log('🔥 Engrave-selected event received:', {
        shapeIds: event.detail.shapeIds,
        isConnected,
        serialState,
        port: serialState?.port
      })
      setSelectedShapeIds(event.detail.shapeIds)
      // Auto-trigger engraving after a short delay
      setTimeout(() => {
        handleEngrave(event.detail.shapeIds)
      }, 100)
    }
    
    window.addEventListener('engrave-selected', handleEngraveSelected)
    return () => window.removeEventListener('engrave-selected', handleEngraveSelected)
  }, [isConnected, serialState])

  // Save values to localStorage when they change
  useEffect(() => {
    localStorage.setItem('engraving_feedRate', feedRate.toString())
  }, [feedRate])

  useEffect(() => {
    localStorage.setItem('engraving_laserPower', laserPower.toString())
  }, [laserPower])

  useEffect(() => {
    localStorage.setItem('engraving_passes', passes.toString())
  }, [passes])

  // Subscribe to position updates
  useEffect(() => {
    const handlePositionUpdate = (data) => {
      // Ensure data and data.position exist before setting state
      if (data && data.position) {
        setMachinePosition(data.position);
      }
    }

    machinePositionTracker.addListener(handlePositionUpdate)
    return () => {
      machinePositionTracker.removeListener(handlePositionUpdate)
    }
  }, [])

  const handleHome = () => {
    if (!isConnected || !serialState.port) {
      alert('Machine not connected')
      return
    }

    const firmware = machineConnection?.currentProfile?.firmwareType || 'grbl'
    const homeCmd = generateHomeCommand(firmware)

    sendGcode(homeCmd)

    // Start position tracking after homing
    setTimeout(() => {
      machinePositionTracker.queryPosition(serialState.port, firmware)
    }, 2000)
  }

  const handleStop = () => {
    if (!isConnected || !serialState.port) return

    setIsEngraving(false)
    setStatus('Engraving stopped.')

    // Send emergency stop based on firmware
    const firmware = machineConnection?.currentProfile?.firmwareType || 'grbl'
    if (firmware === 'grbl') {
      sendGcode('\x18') // Ctrl+X for GRBL
    } else if (firmware === 'marlin') {
      sendGcode('M112') // Emergency stop for Marlin
    }

    // Turn off laser
    sendGcode(generateLaserControl(firmware, 0, false))
    machinePositionTracker.setLaserState(false)
  }

  const handleEngrave = async (specificShapeIds = null) => {
    // Check connection status
    const currentSerialState = serialState || {}
    const currentIsConnected = isConnected || currentSerialState.connected
    
    if (!currentIsConnected || !currentSerialState.port) {
      console.error('Connection check failed:', { isConnected, serialState: currentSerialState })
      alert('Machine not connected. Please connect to the machine first.')
      return
    }

    if (isEngraving) {
      alert('Engraving already in progress')
      return
    }

    // Get shapes to engrave
    let visibleShapes
    if (specificShapeIds && specificShapeIds.length > 0) {
      // Engrave only selected shapes
      visibleShapes = shapes.filter(shape => specificShapeIds.includes(shape.id))
      setStatus(`Engraving ${visibleShapes.length} selected shape(s)...`)
    } else {
      // Get visible shapes from canvas
      visibleShapes = shapes.filter(shape => {
        const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
        return shapeLayer && shapeLayer.visible && !shapeLayer.locked
      })
    }

    if (visibleShapes.length === 0) {
      alert(specificShapeIds ? 'No shapes selected to engrave' : 'No visible shapes to engrave')
      return
    }

    setIsEngraving(true)
    const totalShapes = visibleShapes.length
    const passCount = passes
    setProgress({ current: 0, total: totalShapes * passCount })
    setStatus('Generating G-code...')

    const firmware = machineConnection?.currentProfile?.firmwareType || 'grbl'
    const mmToPx = machineProfile.mmToPx
    const bedMaxX = machineConnection?.currentProfile?.bedMaxX || 300
    const bedMaxY = machineConnection?.currentProfile?.bedMaxY || 200
    const originPoint = machineConnection?.currentProfile?.originPoint || 'bottom-left'

    try {
      // Generate all G-code commands first (matching Python approach)
      const allCommands = []

      // 1. Home command
      allCommands.push(generateHomeCommand(firmware))

      // 2. Initialize machine
      allCommands.push('G21') // Set units to mm
      allCommands.push('G90') // Absolute positioning
      allCommands.push(`G1 F${feedRate}`) // Set feed rate
      allCommands.push(generateLaserControl(firmware, 0, false)) // Ensure laser is off

      // 3. Generate commands for each pass
      for (let pass = 0; pass < passCount; pass++) {
        // Process each shape
        for (let shapeIndex = 0; shapeIndex < visibleShapes.length; shapeIndex++) {
          const shape = visibleShapes[shapeIndex]

          // Generate commands for this shape
          const shapeCommands = generateShapeCommands(
            shape,
            mmToPx,
            bedMaxX,
            bedMaxY,
            originPoint,
            feedRate,
            laserPower,
            firmware
          )

          allCommands.push(...shapeCommands)
        }
      }

      // 4. Finish commands - turn off laser and go home
      allCommands.push(generateLaserControl(firmware, 0, false))
      allCommands.push(generateHomeCommand(firmware))

      // Send to buffer module for transmission
      const bufferEvent = new CustomEvent('gcode-buffer-update', {
        detail: {
          lines: allCommands,
          start: 0
        }
      })
      window.dispatchEvent(bufferEvent)

      // Auto-open buffer window if not already open
      const openBufferEvent = new CustomEvent('open-buffer-window')
      window.dispatchEvent(openBufferEvent)

      // Auto-start transmission after a short delay
      setTimeout(() => {
        const startTransmissionEvent = new CustomEvent('start-buffer-transmission')
        window.dispatchEvent(startTransmissionEvent)
      }, 500)

      setStatus('G-code sent to buffer and transmission started.')

    } catch (error) {
      console.error('G-code generation error:', error)
      setStatus(`G-code generation failed: ${error.message}`)
      alert('G-code generation failed: ' + error.message)
    } finally {
      setIsEngraving(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const generateShapeCommands = (shape, mmToPx, bedMaxX, bedMaxY, originPoint, feedRate, laserPower, firmware) => {
    const commands = []

    // Helper to convert canvas coordinates to machine coordinates
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

    // Turn laser off and move to start position
    commands.push(generateLaserControl(firmware, 0, false))

    if (shape.type === 'line') {
      // Single line
      const start = convertToMachineCoords(shape.x1, shape.y1)
      const end = convertToMachineCoords(shape.x2, shape.y2)

      // Move to start
      commands.push(generateMovement(firmware, start.x, start.y, null, feedRate, true))
      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))
      // Draw line
      commands.push(generateMovement(firmware, end.x, end.y, null, feedRate, false))
      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'rectangle') {
      // Rectangle - draw as closed polygon
      const topLeft = convertToMachineCoords(shape.x, shape.y)
      const topRight = convertToMachineCoords(shape.x + shape.width, shape.y)
      const bottomRight = convertToMachineCoords(shape.x + shape.width, shape.y + shape.height)
      const bottomLeft = convertToMachineCoords(shape.x, shape.y + shape.height)

      // Move to start
      commands.push(generateMovement(firmware, topLeft.x, topLeft.y, null, feedRate, true))
      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))
      // Draw rectangle
      commands.push(generateMovement(firmware, topRight.x, topRight.y, null, feedRate, false))
      commands.push(generateMovement(firmware, bottomRight.x, bottomRight.y, null, feedRate, false))
      commands.push(generateMovement(firmware, bottomLeft.x, bottomLeft.y, null, feedRate, false))
      commands.push(generateMovement(firmware, topLeft.x, topLeft.y, null, feedRate, false))
      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'circle') {
      // Circle - draw as many segments (matching Python implementation)
      const centerX = shape.x
      const centerY = shape.y
      const center = convertToMachineCoords(centerX, centerY)
      const machineRadius = shape.radius / mmToPx

      const numSegments = 72

      // Calculate start position
      const startX = center.x + machineRadius
      const startY = center.y

      // Move to start position
      commands.push(generateMovement(firmware, startX, startY, null, feedRate, true))

      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))

      // Draw circle using small segments
      for (let i = 0; i <= numSegments; i++) {
        const angle = (2 * Math.PI * i) / numSegments
        const x = center.x + machineRadius * Math.cos(angle)
        const y = center.y + machineRadius * Math.sin(angle)
        commands.push(generateMovement(firmware, x, y, null, feedRate, false))
      }

      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'polygon') {
      // Polygon - draw all points and close
      if (shape.points && shape.points.length > 0) {
        // Handle both flat array [x1, y1, x2, y2] and object array [{x, y}, {x, y}]
        let points
        if (typeof shape.points[0] === 'number') {
          // Flat array format
          points = []
          for (let i = 0; i < shape.points.length; i += 2) {
            points.push(convertToMachineCoords(shape.points[i], shape.points[i + 1]))
          }
        } else {
          // Object array format
          points = shape.points.map(p => convertToMachineCoords(p.x, p.y))
        }

        if (points.length === 0) return commands

        // Move to start
        commands.push(generateMovement(firmware, points[0].x, points[0].y, null, feedRate, true))
        // Turn on laser
        commands.push(generateLaserControl(firmware, laserPower, true))
        // Draw polygon
        for (let i = 1; i < points.length; i++) {
          commands.push(generateMovement(firmware, points[i].x, points[i].y, null, feedRate, false))
        }
        // Close the polygon
        commands.push(generateMovement(firmware, points[0].x, points[0].y, null, feedRate, false))
        // Turn off laser
        commands.push(generateLaserControl(firmware, 0, false))
      }
    }
    else if (shape.type === 'path' || shape.type === 'freehand') {
      // Freehand/path - draw all points
      if (shape.points && shape.points.length > 0) {
        // Handle both flat array [x1, y1, x2, y2] and object array [{x, y}, {x, y}]
        let points
        if (typeof shape.points[0] === 'number') {
          // Flat array format
          points = []
          for (let i = 0; i < shape.points.length; i += 2) {
            points.push(convertToMachineCoords(shape.points[i], shape.points[i + 1]))
          }
        } else {
          // Object array format
          points = shape.points.map(p => convertToMachineCoords(p.x, p.y))
        }

        if (points.length === 0) return commands

        // Move to start
        commands.push(generateMovement(firmware, points[0].x, points[0].y, null, feedRate, true))
        // Turn on laser
        commands.push(generateLaserControl(firmware, laserPower, true))
        // Draw path
        for (let i = 1; i < points.length; i++) {
          commands.push(generateMovement(firmware, points[i].x, points[i].y, null, feedRate, false))
        }
        // Turn off laser
        commands.push(generateLaserControl(firmware, 0, false))
      }
    }
    else if (shape.type === 'arc') {
      // Arc - draw as segments (matching Python implementation)
      const centerX = shape.x
      const centerY = shape.y
      const radius = shape.outerRadius || shape.radius || 50
      const rotation = shape.rotation || 0
      const arcAngle = shape.angle || 90

      // Calculate start and extent angles
      const startAngle = rotation
      const extent = arcAngle

      const center = convertToMachineCoords(centerX, centerY)
      const machineRadius = radius / mmToPx

      // Calculate start position in radians
      const startAngleRad = (startAngle * Math.PI) / 180
      const startX = center.x + machineRadius * Math.cos(startAngleRad)
      const startY = center.y + machineRadius * Math.sin(startAngleRad)

      // Move to start position
      commands.push(generateMovement(firmware, startX, startY, null, feedRate, true))

      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))

      // Draw arc using small segments (increased for smoother arcs)
      const numSegments = Math.max(72, Math.floor(Math.abs(extent) / 5))
      for (let i = 0; i <= numSegments; i++) {
        const angleRad = ((startAngle + (extent * i / numSegments)) * Math.PI) / 180
        const x = center.x + machineRadius * Math.cos(angleRad)
        const y = center.y + machineRadius * Math.sin(angleRad)
        commands.push(generateMovement(firmware, x, y, null, feedRate, false))
      }

      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'text') {
      // Text - convert to path and engrave
      if (shape.pathData) {
        // Parse SVG path data and convert to G-code
        const pathCommands = parseSVGPath(shape.pathData)

        let laserOn = false
        pathCommands.forEach((segment) => {
          if (segment.type === 'M') {
            // Move command - turn off laser and move
            if (laserOn) {
              commands.push(generateLaserControl(firmware, 0, false))
              laserOn = false
            }
            const point = convertToMachineCoords(segment.x, segment.y)
            commands.push(generateMovement(firmware, point.x, point.y, null, feedRate, true))
            // Turn on laser for drawing
            commands.push(generateLaserControl(firmware, laserPower, true))
            laserOn = true
          } else if (segment.type === 'L') {
            // Line command - ensure laser is on
            if (!laserOn) {
              commands.push(generateLaserControl(firmware, laserPower, true))
              laserOn = true
            }
            const point = convertToMachineCoords(segment.x, segment.y)
            commands.push(generateMovement(firmware, point.x, point.y, null, feedRate, false))
          } else if (segment.type === 'Z') {
            // Close path - turn off laser
            if (laserOn) {
              commands.push(generateLaserControl(firmware, 0, false))
              laserOn = false
            }
          }
        })

        // Ensure laser is off at the end
        if (laserOn) {
          commands.push(generateLaserControl(firmware, 0, false))
        }
      } else {
        // No path data - skip text (it should have been converted)
        console.warn('Text shape without pathData, skipping:', shape)
      }
    }

    return commands
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const isReady = isConnected && serialState.port && !isEngraving

  return (
    <div className="engraving-tools-window">
      <div className="input-row">
        <label>
          Feed Rate (mm/min):
          <input
            type="number"
            value={feedRate}
            onChange={(e) => setFeedRate(parseInt(e.target.value) || 0)}
            min="1"
            max="10000"
          />
        </label>
      </div>

      <div className="input-row">
        <label>
          Laser Power (0-1000):
          <input
            type="number"
            value={laserPower}
            onChange={(e) => setLaserPower(parseInt(e.target.value) || 0)}
            min="0"
            max="1000"
          />
        </label>
      </div>

      <div className="input-row">
        <label>
          Passes:
          <input
            type="number"
            value={passes}
            onChange={(e) => setPasses(parseInt(e.target.value) || 1)}
            min="1"
            max="100"
          />
        </label>
      </div>

      <div className="position-display">
        Position: X:{machinePosition.x.toFixed(2)} Y:{machinePosition.y.toFixed(2)} Z:{machinePosition.z.toFixed(2)}
      </div>

      {isEngraving && (
        <div className="progress-info">
          {status} Engraving: {progress.current} / {progress.total}
        </div>
      )}

      <div className="button-row">
        <button
          className="engrave-btn"
          onClick={handleEngrave}
          disabled={!isReady}
        >
          🔥 Engrave
        </button>
      </div>

      <div className="button-row">
        <button
          className="stop-btn"
          onClick={handleStop}
          disabled={!isEngraving}
        >
          ⏹ Stop
        </button>
        <button
          onClick={handleHome}
          disabled={!isReady}
        >
          🏠 Home
        </button>
      </div>

      <p className="hint">
        Engraves all visible shapes on canvas. Supports lines, rectangles, circles, polygons, arcs, and freehand paths.
      </p>
    </div>
  )
}

export default EngravingToolsWindow