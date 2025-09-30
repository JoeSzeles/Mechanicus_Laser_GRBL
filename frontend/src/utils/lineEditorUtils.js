export function findLineIntersection(line1, line2) {
  const x1 = line1.x1, y1 = line1.y1, x2 = line1.x2, y2 = line1.y2
  const x3 = line2.x1, y3 = line2.y1, x4 = line2.x2, y4 = line2.y2

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  
  if (Math.abs(denom) < 0.0001) {
    return null
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t,
      u
    }
  }

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
    t,
    u,
    extended: true
  }
}

export function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

export function calculateAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1)
}

export function calculateAngleBetweenLines(line1, line2) {
  const angle1 = calculateAngle(line1.x1, line1.y1, line1.x2, line1.y2)
  const angle2 = calculateAngle(line2.x1, line2.y1, line2.x2, line2.y2)
  let diff = Math.abs(angle2 - angle1)
  if (diff > Math.PI) {
    diff = 2 * Math.PI - diff
  }
  return diff
}

export function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq

  let xx, yy

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

export function findClosestEndpoint(px, py, line, threshold) {
  const dist1 = calculateDistance(px, py, line.x1, line.y1)
  const dist2 = calculateDistance(px, py, line.x2, line.y2)
  
  if (dist1 < threshold) {
    return { endpoint: 1, distance: dist1 }
  } else if (dist2 < threshold) {
    return { endpoint: 2, distance: dist2 }
  }
  
  return null
}

export function createFilletArc(line1, line2, radius, intersection) {
  const xInt = intersection.x
  const yInt = intersection.y
  
  let v1x = line1.x2 - line1.x1
  let v1y = line1.y2 - line1.y1
  let v2x = line2.x2 - line2.x1
  let v2y = line2.y2 - line2.y1
  
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y)
  v1x /= len1
  v1y /= len1
  v2x /= len2
  v2y /= len2
  
  if ((xInt - line1.x1) * v1x + (yInt - line1.y1) * v1y > 0) {
    v1x = -v1x
    v1y = -v1y
  }
  
  if ((xInt - line2.x1) * v2x + (yInt - line2.y1) * v2y > 0) {
    v2x = -v2x
    v2y = -v2y
  }
  
  const cross = v1x * v2y - v1y * v2x
  const dot = v1x * v2x + v1y * v2y
  const angle = Math.atan2(Math.abs(cross), dot)
  const halfAngle = angle / 2
  
  if (halfAngle < 0.01) {
    throw new Error('Lines are too close to parallel for filleting')
  }
  
  const distToTangent = radius / Math.tan(halfAngle)
  
  const tangent1X = xInt + distToTangent * v1x
  const tangent1Y = yInt + distToTangent * v1y
  
  const tangent2X = xInt + distToTangent * v2x
  const tangent2Y = yInt + distToTangent * v2y
  
  const bisectorX = v1x + v2x
  const bisectorY = v1y + v2y
  const bisectorLen = Math.sqrt(bisectorX * bisectorX + bisectorY * bisectorY)
  const unitBisX = bisectorX / bisectorLen
  const unitBisY = bisectorY / bisectorLen
  
  const centerDist = radius / Math.sin(halfAngle)
  const centerX = xInt + centerDist * unitBisX
  const centerY = yInt + centerDist * unitBisY
  
  const startAngle = Math.atan2(tangent1Y - centerY, tangent1X - centerX) * 180 / Math.PI
  const endAngle = Math.atan2(tangent2Y - centerY, tangent2X - centerX) * 180 / Math.PI
  
  let arcAngle = endAngle - startAngle
  if (arcAngle < 0) arcAngle += 360
  if (arcAngle > 180) arcAngle = arcAngle - 360
  
  return {
    centerX,
    centerY,
    radius,
    startAngle,
    arcAngle,
    tangent1: { x: tangent1X, y: tangent1Y },
    tangent2: { x: tangent2X, y: tangent2Y }
  }
}

export function createChamfer(line1, line2, size, intersection) {
  const xInt = intersection.x
  const yInt = intersection.y
  
  let v1x = line1.x2 - line1.x1
  let v1y = line1.y2 - line1.y1
  let v2x = line2.x2 - line2.x1
  let v2y = line2.y2 - line2.y1
  
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y)
  v1x /= len1
  v1y /= len1
  v2x /= len2
  v2y /= len2
  
  if ((xInt - line1.x1) * v1x + (yInt - line1.y1) * v1y > 0) {
    v1x = -v1x
    v1y = -v1y
  }
  
  if ((xInt - line2.x1) * v2x + (yInt - line2.y1) * v2y > 0) {
    v2x = -v2x
    v2y = -v2y
  }
  
  const chamfer1X = xInt + size * v1x
  const chamfer1Y = yInt + size * v1y
  
  const chamfer2X = xInt + size * v2x
  const chamfer2Y = yInt + size * v2y
  
  return {
    point1: { x: chamfer1X, y: chamfer1Y },
    point2: { x: chamfer2X, y: chamfer2Y }
  }
}

export function getShapeCenter(shape) {
  if (shape.type === 'line') {
    return {
      x: (shape.x1 + shape.x2) / 2,
      y: (shape.y1 + shape.y2) / 2
    }
  } else if (shape.type === 'circle') {
    return { x: shape.x, y: shape.y }
  } else if (shape.type === 'rectangle') {
    return {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2
    }
  } else if (shape.type === 'polygon' || shape.type === 'freehand') {
    const points = shape.points
    let sumX = 0, sumY = 0
    for (let i = 0; i < points.length; i += 2) {
      sumX += points[i]
      sumY += points[i + 1]
    }
    return {
      x: sumX / (points.length / 2),
      y: sumY / (points.length / 2)
    }
  } else if (shape.type === 'arc') {
    return { x: shape.x, y: shape.y }
  }
  return { x: 0, y: 0 }
}

export function rotatePoint(px, py, centerX, centerY, angleDegrees) {
  const angleRad = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  
  const dx = px - centerX
  const dy = py - centerY
  
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos
  }
}

export function rotateShape(shape, centerX, centerY, angleDegrees) {
  const rotated = { ...shape }
  
  if (shape.type === 'line') {
    const p1 = rotatePoint(shape.x1, shape.y1, centerX, centerY, angleDegrees)
    const p2 = rotatePoint(shape.x2, shape.y2, centerX, centerY, angleDegrees)
    rotated.x1 = p1.x
    rotated.y1 = p1.y
    rotated.x2 = p2.x
    rotated.y2 = p2.y
  } else if (shape.type === 'circle' || shape.type === 'arc') {
    const center = rotatePoint(shape.x, shape.y, centerX, centerY, angleDegrees)
    rotated.x = center.x
    rotated.y = center.y
    rotated.rotation = (shape.rotation || 0) + angleDegrees
  } else if (shape.type === 'rectangle') {
    const center = rotatePoint(
      shape.x + shape.width / 2,
      shape.y + shape.height / 2,
      centerX,
      centerY,
      angleDegrees
    )
    rotated.x = center.x - shape.width / 2
    rotated.y = center.y - shape.height / 2
    rotated.rotation = (shape.rotation || 0) + angleDegrees
  } else if (shape.type === 'polygon' || shape.type === 'freehand') {
    const points = [...shape.points]
    for (let i = 0; i < points.length; i += 2) {
      const rotatedPt = rotatePoint(points[i], points[i + 1], centerX, centerY, angleDegrees)
      points[i] = rotatedPt.x
      points[i + 1] = rotatedPt.y
    }
    rotated.points = points
  }
  
  return rotated
}
