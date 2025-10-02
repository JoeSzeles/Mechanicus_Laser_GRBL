
/**
 * Machine Position Tracker Module
 * Handles real-time position updates from the machine via M114 G-code
 */

let currentPosition = { x: 0, y: 0, z: 0 }
let isLaserActive = false
let positionUpdateInterval = null

/**
 * Parse M114 response from GRBL
 * Example: "X:10.000 Y:20.000 Z:0.000"
 */
export function parseM114Response(response) {
  const xMatch = response.match(/X:([-\d.]+)/)
  const yMatch = response.match(/Y:([-\d.]+)/)
  const zMatch = response.match(/Z:([-\d.]+)/)
  
  if (xMatch && yMatch) {
    return {
      x: parseFloat(xMatch[1]),
      y: parseFloat(yMatch[1]),
      z: zMatch ? parseFloat(zMatch[1]) : 0
    }
  }
  
  return null
}

/**
 * Update current position
 */
export function updatePosition(position) {
  currentPosition = { ...currentPosition, ...position }
  
  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('machinePositionUpdate', {
    detail: currentPosition
  }))
}

/**
 * Get current position
 */
export function getCurrentPosition() {
  return { ...currentPosition }
}

/**
 * Set laser active state
 */
export function setLaserActive(active) {
  isLaserActive = active
  
  window.dispatchEvent(new CustomEvent('laserStateUpdate', {
    detail: { active: isLaserActive }
  }))
}

/**
 * Get laser active state
 */
export function isLaserOn() {
  return isLaserActive
}

/**
 * Request position update via M114
 */
export function requestPositionUpdate(sendGcodeFn) {
  if (sendGcodeFn && typeof sendGcodeFn === 'function') {
    sendGcodeFn('M114')
  }
}

/**
 * Start periodic position updates
 */
export function startPositionTracking(sendGcodeFn, intervalMs = 1000) {
  if (positionUpdateInterval) {
    clearInterval(positionUpdateInterval)
  }
  
  positionUpdateInterval = setInterval(() => {
    requestPositionUpdate(sendGcodeFn)
  }, intervalMs)
  
  // Request immediate update
  requestPositionUpdate(sendGcodeFn)
}

/**
 * Stop periodic position updates
 */
export function stopPositionTracking() {
  if (positionUpdateInterval) {
    clearInterval(positionUpdateInterval)
    positionUpdateInterval = null
  }
}

/**
 * Reset position to zero
 */
export function resetPosition() {
  currentPosition = { x: 0, y: 0, z: 0 }
  isLaserActive = false
}
