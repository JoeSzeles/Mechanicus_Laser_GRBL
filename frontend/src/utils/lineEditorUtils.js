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
  const angle1 = calculateAngle(intersection.x, intersection.y, line1.x1, line1.y1)
  const angle2 = calculateAngle(intersection.x, intersection.y, line1.x2, line1.y2)
  
  let workingAngle = angle1
  const dx1 = line1.x1 - intersection.x
  const dy1 = line1.y1 - intersection.y
  const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
  
  if (dist1 < 0.1) {
    workingAngle = angle2
  }
  
  const angle3 = calculateAngle(intersection.x, intersection.y, line2.x1, line2.y1)
  const angle4 = calculateAngle(intersection.x, intersection.y, line2.x2, line2.y2)
  
  let workingAngle2 = angle3
  const dx2 = line2.x1 - intersection.x
  const dy2 = line2.y1 - intersection.y
  const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
  
  if (dist2 < 0.1) {
    workingAngle2 = angle4
  }
  
  let angleDiff = workingAngle2 - workingAngle
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
  
  const bisector = workingAngle + angleDiff / 2
  const halfAngle = Math.abs(angleDiff) / 2
  
  const distToTangent = radius / Math.tan(halfAngle)
  
  const tangent1X = intersection.x + distToTangent * Math.cos(workingAngle)
  const tangent1Y = intersection.y + distToTangent * Math.sin(workingAngle)
  
  const tangent2X = intersection.x + distToTangent * Math.cos(workingAngle2)
  const tangent2Y = intersection.y + distToTangent * Math.sin(workingAngle2)
  
  const centerDist = radius / Math.sin(halfAngle)
  const centerX = intersection.x + centerDist * Math.cos(bisector)
  const centerY = intersection.y + centerDist * Math.sin(bisector)
  
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
  const angle1 = calculateAngle(intersection.x, intersection.y, line1.x1, line1.y1)
  const angle2 = calculateAngle(intersection.x, intersection.y, line1.x2, line1.y2)
  
  let workingAngle = angle1
  const dx1 = line1.x1 - intersection.x
  const dy1 = line1.y1 - intersection.y
  const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
  
  if (dist1 < 0.1) {
    workingAngle = angle2
  }
  
  const angle3 = calculateAngle(intersection.x, intersection.y, line2.x1, line2.y1)
  const angle4 = calculateAngle(intersection.x, intersection.y, line2.x2, line2.y2)
  
  let workingAngle2 = angle3
  const dx2 = line2.x1 - intersection.x
  const dy2 = line2.y1 - intersection.y
  const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
  
  if (dist2 < 0.1) {
    workingAngle2 = angle4
  }
  
  const chamfer1X = intersection.x + size * Math.cos(workingAngle)
  const chamfer1Y = intersection.y + size * Math.sin(workingAngle)
  
  const chamfer2X = intersection.x + size * Math.cos(workingAngle2)
  const chamfer2Y = intersection.y + size * Math.sin(workingAngle2)
  
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
