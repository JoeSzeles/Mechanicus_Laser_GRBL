
/**
 * Machine Position Tracker Module
 * Handles querying and rendering the machine's current position on the canvas
 */

export class MachinePositionTracker {
  constructor(canvas, sendGcode, machineProfile) {
    this.canvas = canvas
    this.sendGcode = sendGcode
    this.machineProfile = machineProfile
    this.position = { x: 0, y: 0, z: 0 }
    this.isLaserActive = false
    this.headElement = null
    this.updateInterval = null
    this.isTracking = false
  }

  /**
   * Start tracking machine position
   */
  startTracking() {
    if (this.isTracking) return
    
    this.isTracking = true
    console.log('🎯 Started machine position tracking')
    
    // Query position immediately
    this.queryPosition()
    
    // Set up periodic position updates (every 500ms)
    this.updateInterval = setInterval(() => {
      this.queryPosition()
    }, 500)
  }

  /**
   * Stop tracking machine position
   */
  stopTracking() {
    if (!this.isTracking) return
    
    this.isTracking = false
    console.log('🛑 Stopped machine position tracking')
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    
    // Remove visual indicator
    if (this.headElement) {
      this.canvas.delete(this.headElement)
      this.headElement = null
    }
  }

  /**
   * Query current machine position via M114
   */
  queryPosition() {
    if (!this.sendGcode) return
    
    // Send M114 command to get current position
    this.sendGcode('M114')
  }

  /**
   * Update position from M114 response
   * Expected format: "X:123.45 Y:67.89 Z:10.00 E:0.00"
   */
  updatePosition(response) {
    // Parse M114 response
    const xMatch = response.match(/X:([-\d.]+)/)
    const yMatch = response.match(/Y:([-\d.]+)/)
    const zMatch = response.match(/Z:([-\d.]+)/)
    
    if (xMatch && yMatch && zMatch) {
      this.position = {
        x: parseFloat(xMatch[1]),
        y: parseFloat(yMatch[1]),
        z: parseFloat(zMatch[1])
      }
      
      console.log('📍 Position updated:', this.position)
      this.renderHead()
    }
  }

  /**
   * Update laser state
   */
  setLaserActive(isActive) {
    if (this.isLaserActive !== isActive) {
      this.isLaserActive = isActive
      this.renderHead()
    }
  }

  /**
   * Convert machine coordinates to canvas coordinates
   */
  machineToCanvas(machineX, machineY) {
    const { bedSizeX, bedSizeY, mmToPx, originPoint } = this.machineProfile
    
    // Convert mm to pixels
    let canvasX = machineX * mmToPx
    let canvasY = machineY * mmToPx
    
    // Adjust for origin point
    switch (originPoint) {
      case 'bottom-left':
        canvasY = (bedSizeY * mmToPx) - canvasY
        break
      case 'bottom-right':
        canvasX = (bedSizeX * mmToPx) - canvasX
        canvasY = (bedSizeY * mmToPx) - canvasY
        break
      case 'top-left':
        // Default, no adjustment needed
        break
      case 'top-right':
        canvasX = (bedSizeX * mmToPx) - canvasX
        break
    }
    
    return { x: canvasX, y: canvasY }
  }

  /**
   * Render the machine head on canvas
   */
  renderHead() {
    if (!this.canvas) return
    
    // Remove old head element
    if (this.headElement) {
      this.canvas.delete(this.headElement)
    }
    
    // Convert machine coordinates to canvas coordinates
    const { x, y } = this.machineToCanvas(this.position.x, this.position.y)
    
    const headSize = 20
    const dotSize = 6
    
    // Create a group for the machine head
    const layer = this.canvas.getLayer()
    
    // Draw rounded rectangle for machine head (blue)
    const rect = new window.Konva.Rect({
      x: x - headSize / 2,
      y: y - headSize / 2,
      width: headSize,
      height: headSize,
      fill: '#0088FF',
      stroke: '#FFFFFF',
      strokeWidth: 2,
      cornerRadius: 4,
      listening: false
    })
    
    // Draw center dot (green if laser inactive, red if active)
    const dot = new window.Konva.Circle({
      x: x,
      y: y,
      radius: dotSize / 2,
      fill: this.isLaserActive ? '#FF0000' : '#00FF00',
      listening: false
    })
    
    // Add position label
    const label = new window.Konva.Text({
      x: x + headSize / 2 + 5,
      y: y - headSize / 2,
      text: `X:${this.position.x.toFixed(2)} Y:${this.position.y.toFixed(2)}`,
      fontSize: 12,
      fill: '#0088FF',
      fontStyle: 'bold',
      listening: false
    })
    
    // Group elements
    const group = new window.Konva.Group({
      listening: false
    })
    
    group.add(rect)
    group.add(dot)
    group.add(label)
    
    layer.add(group)
    this.headElement = group
    
    layer.batchDraw()
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopTracking()
  }
}

export default MachinePositionTracker
