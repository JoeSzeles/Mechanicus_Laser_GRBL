export const exportToSVG = (shapes, machineProfile, layers) => {
  const width = machineProfile.bedSizeX * machineProfile.mmToPx
  const height = machineProfile.bedSizeY * machineProfile.mmToPx
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
`

  const defaultLayerId = layers[0]?.id || 'layer1'
  
  layers.forEach(layer => {
    if (!layer.visible) return
    
    const layerShapes = shapes.filter(s => s.layerId === layer.id || (!s.layerId && layer.id === defaultLayerId))
    if (layerShapes.length === 0) return
    
    svg += `  <g id="${layer.id}" data-layer-name="${layer.name}">\n`
    
    layerShapes.forEach(shape => {
      const stroke = shape.stroke || '#000000'
      const strokeWidth = shape.strokeWidth || 1
      const fill = shape.fill || 'none'
      
      if (shape.type === 'line') {
        svg += `    <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />\n`
      } else if (shape.type === 'circle') {
        svg += `    <circle cx="${shape.x}" cy="${shape.y}" r="${shape.radius}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />\n`
      } else if (shape.type === 'rectangle') {
        svg += `    <rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />\n`
      } else if (shape.type === 'polygon') {
        const points = []
        for (let i = 0; i < shape.points.length; i += 2) {
          points.push(`${shape.points[i]},${shape.points[i + 1]}`)
        }
        svg += `    <polygon points="${points.join(' ')}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />\n`
      } else if (shape.type === 'freehand') {
        const points = []
        for (let i = 0; i < shape.points.length; i += 2) {
          points.push(`${shape.points[i]},${shape.points[i + 1]}`)
        }
        let pathData = `M ${points[0]}`
        for (let i = 1; i < points.length; i++) {
          pathData += ` L ${points[i]}`
        }
        svg += `    <path d="${pathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />\n`
      } else if (shape.type === 'text') {
        const fontSize = shape.fontSize || 50
        const font = shape.font || 'Impact'
        svg += `    <text x="${shape.x}" y="${shape.y}" font-family="${font}" font-size="${fontSize}" fill="${shape.fill || '#000000'}" stroke="${stroke}" stroke-width="${strokeWidth}">${shape.text}</text>\n`
      } else if (shape.type === 'arc') {
        const radius = shape.outerRadius || shape.radius || 50
        const angle = shape.angle || 90
        const rotation = shape.rotation || 0
        const startAngle = rotation
        const endAngle = rotation + angle
        
        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180
        
        const x1 = shape.x + radius * Math.cos(startRad)
        const y1 = shape.y + radius * Math.sin(startRad)
        const x2 = shape.x + radius * Math.cos(endRad)
        const y2 = shape.y + radius * Math.sin(endRad)
        
        const largeArcFlag = angle > 180 ? 1 : 0
        
        svg += `    <path d="M ${x1},${y1} A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />\n`
      }
    })
    
    svg += `  </g>\n`
  })
  
  svg += `</svg>`
  
  return svg
}

export const downloadSVG = (svgContent, filename = 'design.svg') => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const importFromSVG = async (file, machineProfile) => {
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
        
        const shapes = []
        const layers = []
        
        const groups = svgElement.querySelectorAll('g[id]')
        groups.forEach((group, index) => {
          const layerId = group.getAttribute('id') || `layer-${Date.now()}-${index}`
          const layerName = group.getAttribute('data-layer-name') || `Layer ${index + 1}`
          
          layers.push({
            id: layerId,
            name: layerName,
            visible: true,
            locked: false
          })
          
          const elements = group.children
          for (let el of elements) {
            const shape = parseElement(el, layerId)
            if (shape) shapes.push(shape)
          }
        })
        
        const rootElements = svgElement.children
        for (let el of rootElements) {
          if (el.tagName.toLowerCase() !== 'g') {
            const shape = parseElement(el, layers[0]?.id || 'layer1')
            if (shape) shapes.push(shape)
          }
        }
        
        resolve({ shapes, layers })
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

const parseElement = (el, layerId) => {
  const tagName = el.tagName.toLowerCase()
  const id = `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const stroke = el.getAttribute('stroke') || '#000000'
  const strokeWidth = parseFloat(el.getAttribute('stroke-width')) || 1
  const fill = el.getAttribute('fill') === 'none' ? undefined : el.getAttribute('fill')
  
  if (tagName === 'line') {
    return {
      id,
      type: 'line',
      x1: parseFloat(el.getAttribute('x1')),
      y1: parseFloat(el.getAttribute('y1')),
      x2: parseFloat(el.getAttribute('x2')),
      y2: parseFloat(el.getAttribute('y2')),
      stroke,
      strokeWidth,
      layerId
    }
  } else if (tagName === 'circle') {
    return {
      id,
      type: 'circle',
      x: parseFloat(el.getAttribute('cx')),
      y: parseFloat(el.getAttribute('cy')),
      radius: parseFloat(el.getAttribute('r')),
      stroke,
      strokeWidth,
      fill,
      layerId
    }
  } else if (tagName === 'rect') {
    return {
      id,
      type: 'rectangle',
      x: parseFloat(el.getAttribute('x')),
      y: parseFloat(el.getAttribute('y')),
      width: parseFloat(el.getAttribute('width')),
      height: parseFloat(el.getAttribute('height')),
      stroke,
      strokeWidth,
      fill,
      layerId
    }
  } else if (tagName === 'polygon') {
    const pointsStr = el.getAttribute('points')
    const points = []
    pointsStr.split(' ').forEach(pair => {
      const [x, y] = pair.split(',')
      points.push(parseFloat(x), parseFloat(y))
    })
    return {
      id,
      type: 'polygon',
      points,
      stroke,
      strokeWidth,
      fill,
      layerId
    }
  } else if (tagName === 'path') {
    const d = el.getAttribute('d')
    
    if (d.includes('A ')) {
      const arcMatch = d.match(/M\s*([0-9.-]+),([0-9.-]+)\s*A\s*([0-9.-]+),([0-9.-]+)\s+[0-9]+\s+[0-9]+,[0-9]+\s+([0-9.-]+),([0-9.-]+)/)
      if (arcMatch) {
        const x1 = parseFloat(arcMatch[1])
        const y1 = parseFloat(arcMatch[2])
        const radius = parseFloat(arcMatch[3])
        const x2 = parseFloat(arcMatch[5])
        const y2 = parseFloat(arcMatch[6])
        
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2
        
        const angle1 = Math.atan2(y1 - cy, x1 - cx) * 180 / Math.PI
        const angle2 = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI
        let angle = angle2 - angle1
        if (angle < 0) angle += 360
        
        return {
          id,
          type: 'arc',
          x: cx,
          y: cy,
          outerRadius: radius,
          angle: angle,
          rotation: angle1,
          stroke,
          strokeWidth,
          layerId
        }
      }
    }
    
    if (d.includes('M') && d.includes('L')) {
      const points = []
      const matches = d.matchAll(/M\s*([0-9.-]+),([0-9.-]+)|L\s*([0-9.-]+),([0-9.-]+)/g)
      for (const match of matches) {
        if (match[1]) {
          points.push(parseFloat(match[1]), parseFloat(match[2]))
        } else if (match[3]) {
          points.push(parseFloat(match[3]), parseFloat(match[4]))
        }
      }
      return {
        id,
        type: 'freehand',
        points,
        stroke,
        strokeWidth,
        layerId
      }
    }
  } else if (tagName === 'text') {
    return {
      id,
      type: 'text',
      x: parseFloat(el.getAttribute('x')),
      y: parseFloat(el.getAttribute('y')),
      text: el.textContent,
      font: el.getAttribute('font-family') || 'Impact',
      fontSize: parseFloat(el.getAttribute('font-size')) || 50,
      fill: el.getAttribute('fill') || '#000000',
      stroke,
      strokeWidth,
      layerId
    }
  }
  
  return null
}
