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

function EngravingToolsWindow() {
  const shapes = useCadStore((state) => state.shapes)
  const layers = useCadStore((state) => state.layers)
  const machineProfile = useCadStore((state) => state.machineProfile)
  const machineConnection = useCadStore((state) => state.machineConnection)
  const { sendGcode, isConnected, serialState } = useSerial()

  // Load saved values from localStorage or use machine profile defaults
  const [feedRate, setFeedRate] = useState(() => {
    const saved = localStorage.getItem('engraving_feedRate')
    return saved ? parseInt(saved) : machineConnection.currentProfile?.drawSpeed || 2000
  })

  const [laserPower, setLaserPower] = useState(() => {
    const saved = localStorage.getItem('engraving_laserPower')
    return saved ? parseInt(saved) : machineConnection.currentProfile?.laserPower || 1000
  })

  const [passes, setPasses] = useState(() => {
    const saved = localStorage.getItem('engraving_passes')
    return saved ? parseInt(saved) : 1
  })

  const [isEngraving, setIsEngraving] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [status, setStatus] = useState('')

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
      setMachinePosition(data.position)
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

    const firmware = machineConnection.currentProfile?.firmwareType || 'grbl'
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
    const firmware = machineConnection.currentProfile?.firmwareType || 'grbl'
    if (firmware === 'grbl') {
      sendGcode('\x18') // Ctrl+X for GRBL
    } else if (firmware === 'marlin') {
      sendGcode('M112') // Emergency stop for Marlin
    }

    // Turn off laser
    sendGcode(generateLaserControl(firmware, 0, false))
    machinePositionTracker.setLaserState(false)
  }

  const handleEngrave = async () => {
    if (!isConnected || !serialState.port) {
      alert('Machine not connected')
      return
    }

    if (isEngraving) {
      alert('Engraving already in progress')
      return
    }

    // Get visible shapes from canvas
    const visibleShapes = shapes.filter(shape => {
      const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
      return shapeLayer && shapeLayer.visible && !shapeLayer.locked
    })

    if (visibleShapes.length === 0) {
      alert('No visible shapes to engrave')
      return
    }

    setIsEngraving(true)
    const totalShapes = visibleShapes.length
    const passCount = passes
    setProgress({ current: 0, total: totalShapes * passCount })
    setStatus('Initializing engraving...')

    const firmware = machineConnection.currentProfile?.firmwareType || 'grbl'
    const mmToPx = machineProfile.mmToPx
    const bedMaxX = machineConnection.currentProfile?.bedMaxX || 300
    const bedMaxY = machineConnection.currentProfile?.bedMaxY || 200
    const originPoint = machineConnection.currentProfile?.originPoint || 'bottom-left'

    try {
      // Initialize position tracker
      machinePositionTracker.init({ send: (msg) => {
        const data = JSON.parse(msg)
        if (data.type === 'send_command') {
          sendGcode(data.payload.command)
        }
      }}, serialState.port)

      // 1. Go home first
      const homeCmd = generateHomeCommand(firmware)
      sendGcode(homeCmd)
      await sleep(2000) // Wait for homing

      // Query position after homing
      machinePositionTracker.queryPosition(serialState.port, firmware)
      await sleep(500)

      // 2. Initialize machine
      sendGcode('G21') // Set units to mm
      sendGcode('G90') // Absolute positioning
      sendGcode(`G1 F${feedRate}`) // Set feed rate
      sendGcode(generateLaserControl(firmware, 0, false)) // Ensure laser is off
      machinePositionTracker.setLaserState(false)


      // 3. Process each pass
      for (let pass = 0; pass < passCount; pass++) {
        setStatus(`Pass ${pass + 1}/${passCount}...`)

        // Process each shape
        for (let shapeIndex = 0; shapeIndex < visibleShapes.length; shapeIndex++) {
          const shape = visibleShapes[shapeIndex]

          // Generate commands for this shape
          const commands = generateShapeCommands(
            shape,
            mmToPx,
            bedMaxX,
            bedMaxY,
            originPoint,
            feedRate,
            laserPower,
            firmware
          )

          // Send commands
          let lastPoint = machinePosition // Keep track of the last point for position tracking
          for (const cmd of commands) {
            if (cmd.startsWith('G0') || cmd.startsWith('G1')) {
              // Extract coordinates from G-code
              const match = cmd.match(/X([+-]?\d*\.?\d+)Y([+-]?\d*\.?\d+)/)
              if (match) {
                const targetX = parseFloat(match[1])
                const targetY = parseFloat(match[2])
                const distance = Math.sqrt(Math.pow(targetX - lastPoint.x, 2) + Math.pow(targetY - lastPoint.y, 2))

                // Send the command and then start tracking movement
                sendGcode(cmd)
                machinePositionTracker.startMovementTracking(serialState.port, feedRate, distance, firmware)
                lastPoint = { x: targetX, y: targetY }
              } else {
                // If no coordinates, just send the command
                sendGcode(cmd)
              }
            } else {
              // For laser control commands, just send them
              sendGcode(cmd)
              if (cmd.includes('M3')) {
                machinePositionTracker.setLaserState(true)
              } else if (cmd.includes('M5')) {
                machinePositionTracker.setLaserState(false)
              }
            }
            await sleep(10) // Small delay between commands
          }

          setProgress({ current: pass * totalShapes + shapeIndex + 1, total: totalShapes * passCount })
        }
      }

      // 4. Finish - turn off laser and go home
      sendGcode(generateLaserControl(firmware, 0, false))
      machinePositionTracker.setLaserState(false)
      const homeCmd = generateHomeCommand(firmware)
      sendGcode(homeCmd)

      // Track homing movement
      machinePositionTracker.startMovementTracking(serialState.port, 1000, 50, firmware)


      // Final position query
      await sleep(1000)
      machinePositionTracker.queryPosition(serialState.port, firmware)

      setStatus('Engraving completed successfully!')
      alert('Engraving completed successfully!')
    } catch (error) {
      console.error('Engraving error:', error)
      setStatus(`Engraving failed: ${error.message}`)
      alert('Engraving failed: ' + error.message)
      sendGcode(generateLaserControl(firmware, 0, false))
      machinePositionTracker.setLaserState(false)
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
      commands.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)} F${feedRate}`)
      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))
      // Draw line
      commands.push(`G1 X${end.x.toFixed(3)} Y${end.y.toFixed(3)} F${feedRate}`)
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
      commands.push(`G0 X${topLeft.x.toFixed(3)} Y${topLeft.y.toFixed(3)} F${feedRate}`)
      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))
      // Draw rectangle
      commands.push(`G1 X${topRight.x.toFixed(3)} Y${topRight.y.toFixed(3)} F${feedRate}`)
      commands.push(`G1 X${bottomRight.x.toFixed(3)} Y${bottomRight.y.toFixed(3)} F${feedRate}`)
      commands.push(`G1 X${bottomLeft.x.toFixed(3)} Y${bottomLeft.y.toFixed(3)} F${feedRate}`)
      commands.push(`G1 X${topLeft.x.toFixed(3)} Y${topLeft.y.toFixed(3)} F${feedRate}`)
      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'circle') {
      // Circle - draw as many segments
      const center = convertToMachineCoords(shape.x, shape.y)
      const radiusX = shape.radius / mmToPx
      const radiusY = shape.radius / mmToPx

      const numSegments = 72
      const points = []
      for (let i = 0; i <= numSegments; i++) {
        const angle = (2 * Math.PI * i) / numSegments
        const x = center.x + radiusX * Math.cos(angle)
        const y = center.y + radiusY * Math.sin(angle)
        points.push({ x, y })
      }

      // Move to start
      commands.push(`G0 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)} F${feedRate}`)
      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))
      // Draw circle
      for (let i = 1; i < points.length; i++) {
        commands.push(`G1 X${points[i].x.toFixed(3)} Y${points[i].y.toFixed(3)} F${feedRate}`)
      }
      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'polygon') {
      // Polygon - draw all points and close
      if (shape.points && shape.points.length > 0) {
        const points = shape.points.map(p => convertToMachineCoords(p.x, p.y))

        // Move to start
        commands.push(`G0 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)} F${feedRate}`)
        // Turn on laser
        commands.push(generateLaserControl(firmware, laserPower, true))
        // Draw polygon
        for (let i = 1; i < points.length; i++) {
          commands.push(`G1 X${points[i].x.toFixed(3)} Y${points[i].y.toFixed(3)} F${feedRate}`)
        }
        // Close the polygon
        commands.push(`G1 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)} F${feedRate}`)
        // Turn off laser
        commands.push(generateLaserControl(firmware, 0, false))
      }
    }
    else if (shape.type === 'path' || shape.type === 'freehand') {
      // Freehand/path - draw all points
      if (shape.points && shape.points.length > 0) {
        const points = shape.points.map(p => convertToMachineCoords(p.x, p.y))

        // Move to start
        commands.push(`G0 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)} F${feedRate}`)
        // Turn on laser
        commands.push(generateLaserControl(firmware, laserPower, true))
        // Draw path
        for (let i = 1; i < points.length; i++) {
          commands.push(`G1 X${points[i].x.toFixed(3)} Y${points[i].y.toFixed(3)} F${feedRate}`)
        }
        // Turn off laser
        commands.push(generateLaserControl(firmware, 0, false))
      }
    }
    else if (shape.type === 'arc') {
      // Arc - draw as segments
      const centerX = shape.x + shape.radiusX
      const centerY = shape.y + shape.radiusY
      const center = convertToMachineCoords(centerX, centerY)
      const radiusX = shape.radiusX / mmToPx
      const radiusY = shape.radiusY / mmToPx
      const startAngle = (shape.startAngle || 0) * (Math.PI / 180)
      const endAngle = (shape.endAngle || 360) * (Math.PI / 180)

      const numSegments = Math.max(36, Math.abs(Math.ceil((endAngle - startAngle) * 180 / Math.PI / 5)))
      const points = []
      for (let i = 0; i <= numSegments; i++) {
        const angle = startAngle + ((endAngle - startAngle) * i) / numSegments
        const x = center.x + radiusX * Math.cos(angle)
        const y = center.y + radiusY * Math.sin(angle)
        points.push({ x, y })
      }

      // Move to start
      commands.push(`G0 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)} F${feedRate}`)
      // Turn on laser
      commands.push(generateLaserControl(firmware, laserPower, true))
      // Draw arc
      for (let i = 1; i < points.length; i++) {
        commands.push(`G1 X${points[i].x.toFixed(3)} Y${points[i].y.toFixed(3)} F${feedRate}`)
      }
      // Turn off laser
      commands.push(generateLaserControl(firmware, 0, false))
    }
    else if (shape.type === 'text') {
      // Text - convert to path and engrave
      // For now, draw bounding box (path conversion happens in TextFontToolsWindow)
      // If text has pathData property, use that instead
      if (shape.pathData) {
        // Parse SVG path data and convert to G-code
        const pathCommands = parseSVGPath(shape.pathData)

        pathCommands.forEach((segment, index) => {
          if (segment.type === 'M') {
            const point = convertToMachineCoords(segment.x, segment.y)
            commands.push(`G0 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} F${feedRate}`)
            commands.push(generateLaserControl(firmware, laserPower, true))
          } else if (segment.type === 'L') {
            const point = convertToMachineCoords(segment.x, segment.y)
            commands.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} F${feedRate}`)
          } else if (segment.type === 'Z') {
            commands.push(generateLaserControl(firmware, 0, false))
          }
        })
      } else {
        // Fallback: draw bounding box
        const fontSize = shape.fontSize || 50
        const textWidth = shape.width || (shape.text.length * fontSize * 0.6)
        const textHeight = fontSize

        const topLeft = convertToMachineCoords(shape.x, shape.y - textHeight)
        const topRight = convertToMachineCoords(shape.x + textWidth, shape.y - textHeight)
        const bottomRight = convertToMachineCoords(shape.x + textWidth, shape.y)
        const bottomLeft = convertToMachineCoords(shape.x, shape.y)

        commands.push(`G0 X${topLeft.x.toFixed(3)} Y${topLeft.y.toFixed(3)} F${feedRate}`)
        commands.push(generateLaserControl(firmware, laserPower, true))
        commands.push(`G1 X${topRight.x.toFixed(3)} Y${topRight.y.toFixed(3)} F${feedRate}`)
        commands.push(`G1 X${bottomRight.x.toFixed(3)} Y${bottomRight.y.toFixed(3)} F${feedRate}`)
        commands.push(`G1 X${bottomLeft.x.toFixed(3)} Y${bottomLeft.y.toFixed(3)} F${feedRate}`)
        commands.push(`G1 X${topLeft.x.toFixed(3)} Y${topLeft.y.toFixed(3)} F${feedRate}`)
        commands.push(generateLaserControl(firmware, 0, false))
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