
// Machine Position Tracker Module
// Handles M114 position queries and visualization

export class MachinePositionTracker {
  constructor() {
    this.position = { x: 0, y: 0, z: 0 }
    this.laserActive = false
    this.updateInterval = null
    this.wsConnection = null
    this.listeners = new Set()
  }

  // Initialize with WebSocket connection
  init(wsConnection, portPath) {
    this.wsConnection = wsConnection
    this.portPath = portPath
    // Don't start periodic updates - only query when needed
  }

  // Start periodic position updates every 500ms
  startPeriodicUpdate() {
    // Disabled - query only on demand
  }

  // Stop periodic updates
  stopPeriodicUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  // Send M114 command to get current position
  queryPosition(portPath) {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      return
    }

    this.wsConnection.send(JSON.stringify({
      type: 'send_gcode',
      payload: {
        portPath: portPath,
        gcode: 'M114'
      }
    }))
  }

  // Parse M114 response: "X:123.45 Y:67.89 Z:10.00 E:0.00"
  parsePositionResponse(response) {
    const match = response.match(/X:([-\d.]+)\s+Y:([-\d.]+)\s+Z:([-\d.]+)/)
    if (match) {
      this.position = {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: parseFloat(match[3])
      }
      this.notifyListeners()
      return true
    }
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
    this.stopPeriodicUpdate()
    this.listeners.clear()
    this.wsConnection = null
  }
}

// Export singleton instance
export const machinePositionTracker = new MachinePositionTracker()
