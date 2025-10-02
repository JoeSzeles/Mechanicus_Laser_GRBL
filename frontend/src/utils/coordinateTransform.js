
/**
 * Transforms canvas coordinates to machine coordinates based on origin point
 * Matches the Python implementation from Mechanicus Main app File.py
 * 
 * @param {number} canvasX - X coordinate on canvas
 * @param {number} canvasY - Y coordinate on canvas
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {number} bedMaxX - Machine bed max X in mm
 * @param {number} bedMaxY - Machine bed max Y in mm
 * @param {string} originPoint - Origin point position: 'bottom-left', 'bottom-right', 'top-left', 'top-right'
 * @returns {{x: number, y: number}} Machine coordinates in mm
 */
export function canvasToMachineCoords(canvasX, canvasY, canvasWidth, canvasHeight, bedMaxX, bedMaxY, originPoint = 'bottom-left') {
  let machineX, machineY

  switch (originPoint) {
    case 'bottom-left':
      // Default: matches Python implementation
      // X: left to right (0 to bedMaxX)
      // Y: bottom to top (0 to bedMaxY)
      machineX = (canvasX * bedMaxX) / canvasWidth
      machineY = bedMaxY - ((canvasY * bedMaxY) / canvasHeight)
      break

    case 'bottom-right':
      // X: right to left (bedMaxX to 0)
      // Y: bottom to top (0 to bedMaxY)
      machineX = bedMaxX - ((canvasX * bedMaxX) / canvasWidth)
      machineY = bedMaxY - ((canvasY * bedMaxY) / canvasHeight)
      break

    case 'top-left':
      // X: left to right (0 to bedMaxX)
      // Y: top to bottom (bedMaxY to 0)
      machineX = (canvasX * bedMaxX) / canvasWidth
      machineY = (canvasY * bedMaxY) / canvasHeight
      break

    case 'top-right':
      // X: right to left (bedMaxX to 0)
      // Y: top to bottom (bedMaxY to 0)
      machineX = bedMaxX - ((canvasX * bedMaxX) / canvasWidth)
      machineY = (canvasY * bedMaxY) / canvasHeight
      break

    default:
      // Fallback to bottom-left
      machineX = (canvasX * bedMaxX) / canvasWidth
      machineY = bedMaxY - ((canvasY * bedMaxY) / canvasHeight)
  }

  return { x: machineX, y: machineY }
}

/**
 * Transforms machine coordinates to canvas coordinates based on origin point
 * Inverse of canvasToMachineCoords
 */
export function machineToCanvasCoords(machineX, machineY, canvasWidth, canvasHeight, bedMaxX, bedMaxY, originPoint = 'bottom-left') {
  let canvasX, canvasY

  switch (originPoint) {
    case 'bottom-left':
      canvasX = (machineX * canvasWidth) / bedMaxX
      canvasY = canvasHeight - ((machineY * canvasHeight) / bedMaxY)
      break

    case 'bottom-right':
      canvasX = canvasWidth - ((machineX * canvasWidth) / bedMaxX)
      canvasY = canvasHeight - ((machineY * canvasHeight) / bedMaxY)
      break

    case 'top-left':
      canvasX = (machineX * canvasWidth) / bedMaxX
      canvasY = (machineY * canvasHeight) / bedMaxY
      break

    case 'top-right':
      canvasX = canvasWidth - ((machineX * canvasWidth) / bedMaxX)
      canvasY = (machineY * canvasHeight) / bedMaxY
      break

    default:
      canvasX = (machineX * canvasWidth) / bedMaxX
      canvasY = canvasHeight - ((machineY * canvasHeight) / bedMaxY)
  }

  return { x: canvasX, y: canvasY }
}
