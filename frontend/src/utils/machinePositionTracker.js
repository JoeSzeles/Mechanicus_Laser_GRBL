
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
    console.log('🔧 [POSITION TRACKER] ========================================')
    console.log('🔧 [POSITION TRACKER] init() called')
    console.log('🔧 [POSITION TRACKER] WebSocket provided:', !!wsConnection)
    console.log('🔧 [POSITION TRACKER] WebSocket state:', wsConnection?.readyState)
    console.log('🔧 [POSITION TRACKER] Port path:', portPath)
    
    this.wsConnection = wsConnection
    this.portPath = portPath
    
    console.log('✅ [POSITION TRACKER] Initialized successfully')
    console.log('🔧 [POSITION TRACKER] ========================================')
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
      console.warn('⚠️ [POSITION TRACKER] Cannot query - WebSocket not connected')
      console.warn('⚠️ [POSITION TRACKER] WebSocket state:', this.wsConnection ? this.wsConnection.readyState : 'null')
      return
    }

    console.log('📤 [POSITION TRACKER] ========================================')
    console.log('📤 [POSITION TRACKER] queryPosition() called')
    console.log('📤 [POSITION TRACKER] Sending M114 to port:', portPath)
    console.log('📤 [POSITION TRACKER] WebSocket state:', this.wsConnection.readyState)
    console.log('📤 [POSITION TRACKER] Timestamp:', new Date().toISOString())
    
    const message = {
      type: 'send_gcode',
      payload: {
        portPath: portPath,
        gcode: 'M114'
      }
    }
    
    console.log('📤 [POSITION TRACKER] Message to send:', JSON.stringify(message))
    this.wsConnection.send(JSON.stringify(message))
    console.log('✅ [POSITION TRACKER] M114 query sent successfully')
    console.log('📤 [POSITION TRACKER] ========================================')
  }

  // Parse M114 response: "X:123.45 Y:67.89 Z:10.00" or "x:123.45 y:67.89"
  parsePositionResponse(response) {
    console.log('📍 [POSITION TRACKER] ========================================')
    console.log('📍 [POSITION TRACKER] parsePositionResponse() called')
    console.log('📍 [POSITION TRACKER] Response type:', typeof response)
    console.log('📍 [POSITION TRACKER] Response length:', response?.length)
    console.log('📍 [POSITION TRACKER] Raw response:', response)
    console.log('📍 [POSITION TRACKER] Response (trimmed):', response?.trim())
    
    // Try uppercase format first (GRBL/Marlin): X:123.45 Y:67.89 Z:10.00
    let match = response.match(/X:([-\d.]+)\s+Y:([-\d.]+)(?:\s+Z:([-\d.]+))?/i)
    console.log('📍 [POSITION TRACKER] Uppercase regex match:', match)
    
    // Try lowercase format (some firmwares): x:123.45 y:67.89
    if (!match) {
      match = response.match(/x:([-\d.]+)\s+y:([-\d.]+)(?:\s+z:([-\d.]+))?/i)
      console.log('📍 [POSITION TRACKER] Lowercase regex match:', match)
    }
    
    if (match) {
      this.position = {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: match[3] ? parseFloat(match[3]) : 0
      }
      console.log('✅ [POSITION TRACKER] Successfully parsed position:', this.position)
      console.log('✅ [POSITION TRACKER] Notifying', this.listeners.size, 'listeners')
      this.notifyListeners()
      console.log('📍 [POSITION TRACKER] ========================================')
      return true
    }
    
    console.warn('⚠️ [POSITION TRACKER] FAILED to parse response:', response)
    console.warn('⚠️ [POSITION TRACKER] No regex match found')
    console.log('📍 [POSITION TRACKER] ========================================')
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
    console.log('📢 [POSITION TRACKER] Notifying listeners')
    console.log('📢 [POSITION TRACKER] Data to send:', data)
    console.log('📢 [POSITION TRACKER] Number of listeners:', this.listeners.size)
    
    this.listeners.forEach((callback, index) => {
      console.log(`📢 [POSITION TRACKER] Calling listener ${index + 1}`)
      callback(data)
    })
    
    console.log('✅ [POSITION TRACKER] All listeners notified')
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
