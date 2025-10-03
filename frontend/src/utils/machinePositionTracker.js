// Machine Position Tracker Module
// Handles M114 position queries and visualization

export class MachinePositionTracker {
  constructor() {
    this.position = { x: 0, y: 0, z: 0 }
    this.laserActive = false
    this.updateInterval = null
    this.wsConnection = null
    this.listeners = new Set()
    this.movementTimeout = null
  }

  // Initialize with WebSocket connection
  init(wsConnection, portPath) {
    this.wsConnection = wsConnection
    this.portPath = portPath
    // Don't start periodic updates - only query when needed
  }

  // Start tracking position during movement
  startMovementTracking(portPath, feedRate, distance) {
    // Clear any existing tracking
    this.stopMovementTracking()

    // Calculate approximate movement duration (distance/feedRate in mm/min)
    const durationMs = (Math.abs(distance) / feedRate) * 60 * 1000
    const pollInterval = 500 // Poll every 500ms

    console.log('📍 [TRACKING] Starting position tracking:', {
      duration: durationMs,
      pollInterval
    })

    // Start polling position every 500ms
    this.updateInterval = setInterval(() => {
      this.queryPosition(portPath)
    }, pollInterval)

    // Stop tracking after estimated movement time + buffer
    this.movementTimeout = setTimeout(() => {
      this.stopMovementTracking()
      // Final position query
      setTimeout(() => {
        this.queryPosition(portPath)
        console.log('📍 [TRACKING] Final position query')
      }, 200)
    }, durationMs + 1000)
  }

  // Stop movement tracking
  stopMovementTracking() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
      console.log('📍 [TRACKING] Stopped position polling')
    }
    if (this.movementTimeout) {
      clearTimeout(this.movementTimeout)
      this.movementTimeout = null
    }
  }

  // Query machine position
  queryPosition(portPath, firmwareType = 'grbl') {
    if (this.wsConnection && portPath) {
      // Use firmware-specific position query
      const positionCommands = {
        grbl: '?',
        marlin: 'M114',
        smoothie: '?'
      }

      const command = positionCommands[firmwareType] || '?'

      console.log('📍 [TRACKER] Querying position for port:', portPath, 'firmware:', firmwareType, 'command:', command)

      this.wsConnection.send(JSON.stringify({
        type: 'send_command',
        payload: {
          portPath,
          command
        }
      }))
    }
  }

  // Parse GRBL status response: <Idle|MPos:123.45,67.89,10.00|...>
  // Also supports Marlin M114 format: X:123.45 Y:67.89 Z:10.00
  parsePositionResponse(response) {
    console.log('📍 [POSITION] Parsing response:', response)

    // Try GRBL format first: <Idle|MPos:x,y,z|...>
    const grblMatch = response.match(/<[^|]*\|MPos:([-\d.]+),([-\d.]+)(?:,([-\d.]+))?/i)
    if (grblMatch) {
      this.position = {
        x: parseFloat(grblMatch[1]),
        y: parseFloat(grblMatch[2]),
        z: grblMatch[3] ? parseFloat(grblMatch[3]) : 0
      }
      console.log('✅ [POSITION] GRBL position parsed:', this.position)
      this.notifyListeners()
      return true
    }

    // Try Marlin M114 format: X:123.45 Y:67.89 Z:10.00
    let match = response.match(/X:([-\d.]+)\s+Y:([-\d.]+)(?:\s+Z:([-\d.]+))?/i)

    // Try lowercase format (some firmwares): x:123.45 y:67.89
    if (!match) {
      match = response.match(/x:([-\d.]+)\s+y:([-\d.]+)(?:\s+z:([-\d.]+))?/i)
    }

    if (match) {
      this.position = {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: match[3] ? parseFloat(match[3]) : 0
      }
      console.log('✅ [POSITION] Updated position:', this.position)
      this.notifyListeners()
      return true
    }

    console.warn('⚠️ [POSITION] Could not parse response:', response)
    return false
  }

  // Set laser state (M3/M5 commands)
  setLaserState(active) {
    this.laserActive = active
    this.notifyListeners()
  }

  // Get current position
  getPosition() {
    return { ...this.position }
  }

  // Check if laser is active
  isLaserActive() {
    return this.laserActive
  }

  // Add listener for position updates
  addListener(callback) {
    this.listeners.add(callback)
  }

  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback)
  }

  // Notify all listeners of position change
  notifyListeners() {
    const data = {
      position: this.getPosition(),
      laserActive: this.laserActive
    }
    this.listeners.forEach(callback => callback(data))
  }

  // Cleanup
  destroy() {
    this.stopMovementTracking()
    this.listeners.clear()
    this.wsConnection = null
  }
}

// Export singleton instance
export const machinePositionTracker = new MachinePositionTracker()