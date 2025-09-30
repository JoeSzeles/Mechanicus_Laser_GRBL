import RBush from 'rbush'

// Snap tolerance in pixels (adjusts with zoom)
const BASE_TOLERANCE = 10

// Snap type colors
export const SNAP_COLORS = {
  endpoint: '#FF0000',  // Red
  midpoint: '#0088FF',  // Blue
  center: '#0088FF',    // Blue
  grid: '#00FF00'       // Green
}

// Create spatial index for shapes
let spatialIndex = new RBush()

export const updateSpatialIndex = (shapes) => {
  spatialIndex.clear()
  
  const items = []
  shapes.forEach(shape => {
    if (shape.type === 'line') {
      // Add endpoints
      items.push({
        minX: shape.x1, minY: shape.y1,
        maxX: shape.x1, maxY: shape.y1,
        point: { x: shape.x1, y: shape.y1 },
        type: 'endpoint',
        shapeId: shape.id
      })
      items.push({
        minX: shape.x2, minY: shape.y2,
        maxX: shape.x2, maxY: shape.y2,
        point: { x: shape.x2, y: shape.y2 },
        type: 'endpoint',
        shapeId: shape.id
      })
      
      // Add midpoint
      const midX = (shape.x1 + shape.x2) / 2
      const midY = (shape.y1 + shape.y2) / 2
      items.push({
        minX: midX, minY: midY,
        maxX: midX, maxY: midY,
        point: { x: midX, y: midY },
        type: 'midpoint',
        shapeId: shape.id
      })
    } else if (shape.type === 'circle') {
      // Add center
      items.push({
        minX: shape.x, minY: shape.y,
        maxX: shape.x, maxY: shape.y,
        point: { x: shape.x, y: shape.y },
        type: 'center',
        shapeId: shape.id
      })
    } else if (shape.type === 'rectangle') {
      // Add center
      const centerX = shape.x + shape.width / 2
      const centerY = shape.y + shape.height / 2
      items.push({
        minX: centerX, minY: centerY,
        maxX: centerX, maxY: centerY,
        point: { x: centerX, y: centerY },
        type: 'center',
        shapeId: shape.id
      })
    }
  })
  
  if (items.length > 0) {
    spatialIndex.load(items)
  }
}

export const findSnapPoint = (x, y, zoom, snapSettings, gridSize = 10, gridVisible = false) => {
  const tolerance = BASE_TOLERANCE / zoom
  
  // Priority order: endpoint > midpoint > center > grid
  
  // 1. Endpoint snapping
  if (snapSettings.endpoint) {
    const result = spatialIndex.search({
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance
    })
    
    const endpoints = result.filter(item => item.type === 'endpoint')
    if (endpoints.length > 0) {
      let closest = endpoints[0]
      let minDist = distance(x, y, closest.point.x, closest.point.y)
      
      endpoints.forEach(ep => {
        const dist = distance(x, y, ep.point.x, ep.point.y)
        if (dist < minDist) {
          minDist = dist
          closest = ep
        }
      })
      
      if (minDist < tolerance) {
        return {
          x: closest.point.x,
          y: closest.point.y,
          type: 'endpoint',
          label: 'Endpoint'
        }
      }
    }
  }
  
  // 2. Midpoint snapping
  if (snapSettings.midpoint) {
    const result = spatialIndex.search({
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance
    })
    
    const midpoints = result.filter(item => item.type === 'midpoint')
    if (midpoints.length > 0) {
      let closest = midpoints[0]
      let minDist = distance(x, y, closest.point.x, closest.point.y)
      
      midpoints.forEach(mp => {
        const dist = distance(x, y, mp.point.x, mp.point.y)
        if (dist < minDist) {
          minDist = dist
          closest = mp
        }
      })
      
      if (minDist < tolerance) {
        return {
          x: closest.point.x,
          y: closest.point.y,
          type: 'midpoint',
          label: 'Midpoint'
        }
      }
    }
  }
  
  // 3. Center snapping
  if (snapSettings.center) {
    const result = spatialIndex.search({
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance
    })
    
    const centers = result.filter(item => item.type === 'center')
    if (centers.length > 0) {
      let closest = centers[0]
      let minDist = distance(x, y, closest.point.x, closest.point.y)
      
      centers.forEach(c => {
        const dist = distance(x, y, c.point.x, c.point.y)
        if (dist < minDist) {
          minDist = dist
          closest = c
        }
      })
      
      if (minDist < tolerance) {
        return {
          x: closest.point.x,
          y: closest.point.y,
          type: 'center',
          label: 'Center'
        }
      }
    }
  }
  
  // 4. Grid snapping (only if grid is visible and enabled)
  if (snapSettings.grid && gridVisible) {
    const snapX = Math.round(x / gridSize) * gridSize
    const snapY = Math.round(y / gridSize) * gridSize
    
    // Only snap if we're close enough to a grid point
    if (distance(x, y, snapX, snapY) < tolerance) {
      return {
        x: snapX,
        y: snapY,
        type: 'grid',
        label: 'Grid'
      }
    }
  }
  
  return null
}

const distance = (x1, y1, x2, y2) => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}
