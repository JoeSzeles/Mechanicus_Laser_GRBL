
import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import { useSerial } from '../contexts/SerialContext'
import { generateHomeCommand, generateLaserControl } from '../utils/firmwareGcodeGenerators'
import './EngravingToolsWindow.css'

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

  const handleHome = () => {
    if (!isConnected || !serialState.port) {
      alert('Machine not connected')
      return
    }

    const firmware = machineConnection.currentProfile?.firmwareType || 'grbl'
    const homeCmd = generateHomeCommand(firmware)
    
    sendGcode(homeCmd)
  }

  const handleStop = () => {
    if (!isConnected || !serialState.port) return
    
    setIsEngraving(false)
    
    // Send emergency stop based on firmware
    const firmware = machineConnection.currentProfile?.firmwareType || 'grbl'
    if (firmware === 'grbl') {
      sendGcode('\x18') // Ctrl+X for GRBL
    } else if (firmware === 'marlin') {
      sendGcode('M112') // Emergency stop for Marlin
    }
    
    // Turn off laser
    sendGcode(generateLaserControl(firmware, 0, false))
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

    // Get visible lines from canvas
    const visibleShapes = shapes.filter(shape => {
      if (shape.type !== 'line') return false
      const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
      return shapeLayer && shapeLayer.visible && !shapeLayer.locked
    })

    if (visibleShapes.length === 0) {
      alert('No visible lines to engrave')
      return
    }

    setIsEngraving(true)
    setProgress({ current: 0, total: visibleShapes.length * passes })

    const firmware = machineConnection.currentProfile?.firmwareType || 'grbl'
    const mmToPx = machineProfile.mmToPx
    const bedMaxX = machineConnection.currentProfile?.bedMaxX || 300
    const bedMaxY = machineConnection.currentProfile?.bedMaxY || 200
    const originPoint = machineConnection.currentProfile?.originPoint || 'bottom-left'

    try {
      // 1. Go home first
      const homeCmd = generateHomeCommand(firmware)
      sendGcode(homeCmd)
      await sleep(2000) // Wait for homing

      // 2. Initialize machine
      sendGcode('G21') // Set units to mm
      sendGcode('G90') // Absolute positioning
      sendGcode(`G1 F${feedRate}`) // Set feed rate

      // 3. Group consecutive lines
      const lineGroups = groupConsecutiveLines(visibleShapes, mmToPx, bedMaxX, bedMaxY, originPoint)

      // 4. Engrave each pass
      for (let pass = 0; pass < passes; pass++) {
        console.log(`Starting pass ${pass + 1}/${passes}`)

        for (let groupIndex = 0; groupIndex < lineGroups.length; groupIndex++) {
          const group = lineGroups[groupIndex]
          
          // Move to start of group with laser off
          sendGcode(generateLaserControl(firmware, 0, false))
          sendGcode(`G0 X${group[0].x1.toFixed(3)} Y${group[0].y1.toFixed(3)} F${feedRate}`)
          
          // Turn laser on
          sendGcode(generateLaserControl(firmware, laserPower, true))
          
          // Draw all lines in group
          for (let i = 0; i < group.length; i++) {
            const line = group[i]
            sendGcode(`G1 X${line.x2.toFixed(3)} Y${line.y2.toFixed(3)} F${feedRate}`)
            
            setProgress(prev => ({ ...prev, current: pass * visibleShapes.length + groupIndex + 1 }))
            await sleep(10) // Small delay between commands
          }
          
          // Turn laser off after group
          sendGcode(generateLaserControl(firmware, 0, false))
        }
      }

      // 5. Finish - turn off laser and go home
      sendGcode(generateLaserControl(firmware, 0, false))
      sendGcode(homeCmd)

      alert('Engraving completed successfully!')
    } catch (error) {
      console.error('Engraving error:', error)
      alert('Engraving failed: ' + error.message)
      sendGcode(generateLaserControl(firmware, 0, false))
    } finally {
      setIsEngraving(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const groupConsecutiveLines = (shapes, mmToPx, bedMaxX, bedMaxY, originPoint) => {
    const groups = []
    let currentGroup = []

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

    const convertedLines = shapes.map(shape => {
      const start = convertToMachineCoords(shape.x1, shape.y1)
      const end = convertToMachineCoords(shape.x2, shape.y2)
      return {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        id: shape.id
      }
    })

    for (let i = 0; i < convertedLines.length; i++) {
      const line = convertedLines[i]
      
      if (currentGroup.length === 0) {
        currentGroup.push(line)
      } else {
        const lastLine = currentGroup[currentGroup.length - 1]
        const tolerance = 0.01 // 0.01mm tolerance for connection
        
        // Check if this line connects to the last line
        const connected = (
          Math.abs(lastLine.x2 - line.x1) < tolerance &&
          Math.abs(lastLine.y2 - line.y1) < tolerance
        )
        
        if (connected) {
          currentGroup.push(line)
        } else {
          // Start new group
          groups.push(currentGroup)
          currentGroup = [line]
        }
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
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

      {isEngraving && (
        <div className="progress-info">
          Engraving: {progress.current} / {progress.total}
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
        Engraves all visible lines on canvas. Connected lines are engraved continuously with laser active.
      </p>
    </div>
  )
}

export default EngravingToolsWindow
