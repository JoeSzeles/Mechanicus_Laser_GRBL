
/**
 * Convert text to SVG path using browser's native text rendering
 * @param {string} text - The text to convert
 * @param {string} font - Font family name
 * @param {number} fontSize - Font size in pixels
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {string} SVG path data (d attribute)
 */
export const textToPath = (text, font, fontSize, x = 0, y = 0) => {
  // Create a temporary canvas for text measurement and path extraction
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  // Set font properties
  ctx.font = `${fontSize}px ${font}`
  ctx.textBaseline = 'alphabetic'
  
  // Measure text to size canvas appropriately
  const metrics = ctx.measureText(text)
  const width = Math.ceil(metrics.width) + 20
  const height = Math.ceil(fontSize * 2) + 20
  
  canvas.width = width
  canvas.height = height
  
  // Redraw with proper size
  ctx.font = `${fontSize}px ${font}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'black'
  ctx.fillText(text, 10, height / 2 + fontSize / 3)
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height)
  
  // Trace the outline to create path
  const path = tracePath(imageData, x, y)
  
  return path
}

/**
 * Alternative method using SVG text element and converting to path
 * This provides better accuracy for vector conversion
 */
export const textToPathSVG = (text, font, fontSize, x = 0, y = 0) => {
  // Create temporary SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '1000')
  svg.setAttribute('height', '1000')
  svg.style.position = 'absolute'
  svg.style.left = '-9999px'
  document.body.appendChild(svg)
  
  // Create text element
  const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  textElement.setAttribute('x', '0')
  textElement.setAttribute('y', fontSize.toString())
  textElement.setAttribute('font-family', font)
  textElement.setAttribute('font-size', fontSize.toString())
  textElement.textContent = text
  svg.appendChild(textElement)
  
  // Get the text path using the browser's getComputedTextLength
  const bbox = textElement.getBBox()
  
  // Since we can't directly get paths from text in browsers,
  // we'll use a canvas-based approach with better tracing
  document.body.removeChild(svg)
  
  // Use canvas to render and trace
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  const padding = 10
  canvas.width = bbox.width + padding * 2
  canvas.height = bbox.height + padding * 2
  
  ctx.font = `${fontSize}px ${font}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.fillText(text, padding, padding)
  
  // Get the path from canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pathData = imageDataToPath(imageData, x - padding, y - padding)
  
  return pathData
}

/**
 * Convert ImageData to SVG path using edge detection
 */
function imageDataToPath(imageData, offsetX = 0, offsetY = 0) {
  const { width, height, data } = imageData
  const threshold = 128
  const paths = []
  const visited = new Set()
  
  // Find all edge pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const alpha = data[idx + 3]
      
      if (alpha > threshold && !visited.has(`${x},${y}`)) {
        // Check if this is an edge pixel
        if (isEdgePixel(data, width, height, x, y, threshold)) {
          const contour = traceContour(data, width, height, x, y, threshold, visited)
          if (contour.length > 2) {
            paths.push(contourToPath(contour, offsetX, offsetY))
          }
        }
      }
    }
  }
  
  return paths.join(' ')
}

/**
 * Check if pixel is on edge
 */
function isEdgePixel(data, width, height, x, y, threshold) {
  const idx = (y * width + x) * 4
  if (data[idx + 3] <= threshold) return false
  
  // Check neighbors
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = (ny * width + nx) * 4
        if (data[nidx + 3] <= threshold) return true
      } else {
        return true // Edge of canvas
      }
    }
  }
  return false
}

/**
 * Trace contour from edge pixel
 */
function traceContour(data, width, height, startX, startY, threshold, visited) {
  const contour = []
  const stack = [[startX, startY]]
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const key = `${x},${y}`
    
    if (visited.has(key)) continue
    visited.add(key)
    
    const idx = (y * width + x) * 4
    if (data[idx + 3] <= threshold) continue
    
    contour.push({ x, y })
    
    // Add neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nkey = `${nx},${ny}`
          if (!visited.has(nkey) && isEdgePixel(data, width, height, nx, ny, threshold)) {
            stack.push([nx, ny])
          }
        }
      }
    }
  }
  
  return contour
}

/**
 * Convert contour points to SVG path
 */
function contourToPath(contour, offsetX, offsetY) {
  if (contour.length === 0) return ''
  
  // Simplify contour using Douglas-Peucker algorithm
  const simplified = douglasPeucker(contour, 0.5)
  
  let path = `M ${simplified[0].x + offsetX} ${simplified[0].y + offsetY}`
  
  for (let i = 1; i < simplified.length; i++) {
    path += ` L ${simplified[i].x + offsetX} ${simplified[i].y + offsetY}`
  }
  
  path += ' Z'
  return path
}

/**
 * Douglas-Peucker path simplification algorithm
 */
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points
  
  // Find the point with maximum distance
  let maxDist = 0
  let index = 0
  const end = points.length - 1
  
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end])
    if (dist > maxDist) {
      maxDist = dist
      index = i
    }
  }
  
  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, index + 1), tolerance)
    const right = douglasPeucker(points.slice(index), tolerance)
    return left.slice(0, -1).concat(right)
  } else {
    return [points[0], points[end]]
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  
  const norm = Math.sqrt(dx * dx + dy * dy)
  if (norm === 0) return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2))
  
  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (norm * norm)
  
  const closestX = lineStart.x + u * dx
  const closestY = lineStart.y + u * dy
  
  return Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2))
}

/**
 * Fallback trace function for simpler implementation
 */
function tracePath(imageData, offsetX, offsetY) {
  // This is a simplified version - for production, you'd want a more robust algorithm
  const { width, height, data } = imageData
  const paths = []
  
  // Simple bounding box approach
  let minX = width, maxX = 0, minY = height, maxY = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (data[idx + 3] > 128) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  
  // Create a simple rectangular path (fallback)
  return `M ${minX + offsetX} ${minY + offsetY} L ${maxX + offsetX} ${minY + offsetY} L ${maxX + offsetX} ${maxY + offsetY} L ${minX + offsetX} ${maxY + offsetY} Z`
}
