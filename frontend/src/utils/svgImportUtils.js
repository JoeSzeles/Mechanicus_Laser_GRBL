
import { canvasToMachineCoords, machineToCanvasCoords } from './coordinateTransform'

/**
 * Parse SVG and extract shapes with proper coordinate transformation
 */
export const parseSVGFile = async (file, machineProfile) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(e.target.result, 'image/svg+xml')
        const svgElement = svgDoc.querySelector('svg')
        
        if (!svgElement) {
          reject(new Error('Invalid SVG file'))
          return
        }
        
        // Get SVG dimensions
        const viewBox = svgElement.getAttribute('viewBox')
        let svgWidth, svgHeight
        
        if (viewBox) {
          const [, , width, height] = viewBox.split(/\s+/).map(parseFloat)
          svgWidth = width
          svgHeight = height
        } else {
          svgWidth = parseFloat(svgElement.getAttribute('width')) || 100
          svgHeight = parseFloat(svgElement.getAttribute('height')) || 100
        }
        
        // Extract all paths and shapes
        const shapes = []
        const elements = svgElement.querySelectorAll('path, line, circle, rect, ellipse, polygon, polyline')
        
        elements.forEach(el => {
          const shape = parseElement(el, svgWidth, svgHeight, machineProfile)
          if (shape) shapes.push(shape)
        })
        
        resolve({
          shapes,
          originalWidth: svgWidth,
          originalHeight: svgHeight
        })
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Parse individual SVG element to shape
 */
const parseElement = (el, svgWidth, svgHeight, machineProfile) => {
  const tagName = el.tagName.toLowerCase()
  const stroke = el.getAttribute('stroke') || '#000000'
  const strokeWidth = parseFloat(el.getAttribute('stroke-width')) || 1
  const fill = el.getAttribute('fill') === 'none' ? undefined : el.getAttribute('fill')
  
  // Note: Coordinates are stored in SVG space (top-left origin)
  // They will be transformed when importing based on user settings
  
  if (tagName === 'line') {
    return {
      type: 'line',
      x1: parseFloat(el.getAttribute('x1')),
      y1: parseFloat(el.getAttribute('y1')),
      x2: parseFloat(el.getAttribute('x2')),
      y2: parseFloat(el.getAttribute('y2')),
      stroke,
      strokeWidth
    }
  } else if (tagName === 'circle') {
    return {
      type: 'circle',
      x: parseFloat(el.getAttribute('cx')),
      y: parseFloat(el.getAttribute('cy')),
      radius: parseFloat(el.getAttribute('r')),
      stroke,
      strokeWidth,
      fill
    }
  } else if (tagName === 'rect') {
    return {
      type: 'rectangle',
      x: parseFloat(el.getAttribute('x')),
      y: parseFloat(el.getAttribute('y')),
      width: parseFloat(el.getAttribute('width')),
      height: parseFloat(el.getAttribute('height')),
      stroke,
      strokeWidth,
      fill
    }
  } else if (tagName === 'ellipse') {
    return {
      type: 'circle',
      x: parseFloat(el.getAttribute('cx')),
      y: parseFloat(el.getAttribute('cy')),
      radius: (parseFloat(el.getAttribute('rx')) + parseFloat(el.getAttribute('ry'))) / 2,
      stroke,
      strokeWidth,
      fill
    }
  } else if (tagName === 'polygon' || tagName === 'polyline') {
    const pointsStr = el.getAttribute('points')
    const points = []
    pointsStr.split(/\s+/).forEach(pair => {
      const [x, y] = pair.split(',').map(parseFloat)
      if (!isNaN(x) && !isNaN(y)) {
        points.push(x, y)
      }
    })
    return {
      type: 'polygon',
      points,
      stroke,
      strokeWidth,
      fill
    }
  } else if (tagName === 'path') {
    const d = el.getAttribute('d')
    
    // Check if this path represents an arc
    const arcMatch = d.match(/M\s*([0-9.-]+)[,\s]+([0-9.-]+)\s*A\s*([0-9.-]+)[,\s]+([0-9.-]+)\s+[0-9]+\s+([0-9]+)[,\s]+([0-9]+)\s+([0-9.-]+)[,\s]+([0-9.-]+)/)
    if (arcMatch) {
      const x1 = parseFloat(arcMatch[1])
      const y1 = parseFloat(arcMatch[2])
      const rx = parseFloat(arcMatch[3])
      const ry = parseFloat(arcMatch[4])
      const largeArcFlag = parseInt(arcMatch[5])
      const sweepFlag = parseInt(arcMatch[6])
      const x2 = parseFloat(arcMatch[7])
      const y2 = parseFloat(arcMatch[8])
      
      // Calculate center point
      const radius = (rx + ry) / 2 // Use average for elliptical arcs
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      
      // Calculate angles
      const angle1 = Math.atan2(y1 - cy, x1 - cx) * 180 / Math.PI
      const angle2 = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI
      
      let angle = angle2 - angle1
      if (angle < 0) angle += 360
      if (largeArcFlag) {
        angle = 360 - angle
      }
      
      return {
        type: 'arc',
        x: cx,
        y: cy,
        outerRadius: radius,
        angle: angle,
        rotation: angle1,
        stroke,
        strokeWidth
      }
    }
    
    // Otherwise treat as a path
    const points = pathToPoints(d)
    return {
      type: 'freehand',
      points,
      stroke,
      strokeWidth
    }
  }
  
  return null
}

/**
 * Convert SVG path data to points (for non-arc paths)
 */
const pathToPoints = (d) => {
  const points = []
  const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g) || []
  
  let currentX = 0, currentY = 0
  
  commands.forEach(cmd => {
    const type = cmd[0]
    const args = cmd.substring(1).trim().split(/[\s,]+/).map(parseFloat)
    
    switch (type) {
      case 'M':
        currentX = args[0]
        currentY = args[1]
        points.push(currentX, currentY)
        break
      case 'm':
        currentX += args[0]
        currentY += args[1]
        points.push(currentX, currentY)
        break
      case 'L':
        currentX = args[0]
        currentY = args[1]
        points.push(currentX, currentY)
        break
      case 'l':
        currentX += args[0]
        currentY += args[1]
        points.push(currentX, currentY)
        break
      case 'H':
        currentX = args[0]
        points.push(currentX, currentY)
        break
      case 'h':
        currentX += args[0]
        points.push(currentX, currentY)
        break
      case 'V':
        currentY = args[0]
        points.push(currentX, currentY)
        break
      case 'v':
        currentY += args[0]
        points.push(currentX, currentY)
        break
      case 'A':
      case 'a':
        // For arcs in a polyline path, approximate with line to end point
        if (type === 'A') {
          currentX = args[5]
          currentY = args[6]
        } else {
          currentX += args[5]
          currentY += args[6]
        }
        points.push(currentX, currentY)
        break
      case 'C':
        // Cubic bezier - use end point
        currentX = args[4]
        currentY = args[5]
        points.push(currentX, currentY)
        break
      case 'c':
        currentX += args[4]
        currentY += args[5]
        points.push(currentX, currentY)
        break
      case 'Q':
        // Quadratic bezier - use end point
        currentX = args[2]
        currentY = args[3]
        points.push(currentX, currentY)
        break
      case 'q':
        currentX += args[2]
        currentY += args[3]
        points.push(currentX, currentY)
        break
    }
  })
  
  return points
}

/**
 * Transform imported shapes to canvas coordinates
 */
export const transformImportedShapes = (shapes, options, machineProfile) => {
  const {
    targetWidth,
    targetHeight,
    originalWidth,
    originalHeight,
    alignment,
    layerId,
    useOriginalSize
  } = options
  
  const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
  const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx
  
  // Calculate scale
  const scaleX = useOriginalSize ? 1 : (targetWidth / originalWidth)
  const scaleY = useOriginalSize ? 1 : (targetHeight / originalHeight)
  
  // Calculate offset based on alignment
  let offsetX = 0
  let offsetY = 0
  
  const scaledWidth = originalWidth * scaleX
  const scaledHeight = originalHeight * scaleY
  
  switch (alignment) {
    case 'bottom-left':
      offsetX = 0
      offsetY = canvasHeight - scaledHeight
      break
    case 'top-left':
      offsetX = 0
      offsetY = 0
      break
    case 'top-right':
      offsetX = canvasWidth - scaledWidth
      offsetY = 0
      break
    case 'bottom-right':
      offsetX = canvasWidth - scaledWidth
      offsetY = canvasHeight - scaledHeight
      break
    case 'center':
      offsetX = (canvasWidth - scaledWidth) / 2
      offsetY = (canvasHeight - scaledHeight) / 2
      break
  }
  
  // Transform shapes
  return shapes.map(shape => {
    const transformed = {
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...shape,
      layerId
    }
    
    if (shape.type === 'line') {
      transformed.x1 = shape.x1 * scaleX + offsetX
      transformed.y1 = shape.y1 * scaleY + offsetY
      transformed.x2 = shape.x2 * scaleX + offsetX
      transformed.y2 = shape.y2 * scaleY + offsetY
    } else if (shape.type === 'circle') {
      transformed.x = shape.x * scaleX + offsetX
      transformed.y = shape.y * scaleY + offsetY
      transformed.radius = shape.radius * Math.min(scaleX, scaleY)
    } else if (shape.type === 'rectangle') {
      transformed.x = shape.x * scaleX + offsetX
      transformed.y = shape.y * scaleY + offsetY
      transformed.width = shape.width * scaleX
      transformed.height = shape.height * scaleY
    } else if (shape.type === 'polygon' || shape.type === 'freehand') {
      transformed.points = shape.points.map((val, i) => 
        i % 2 === 0 ? val * scaleX + offsetX : val * scaleY + offsetY
      )
    }
    
    return transformed
  })
}
