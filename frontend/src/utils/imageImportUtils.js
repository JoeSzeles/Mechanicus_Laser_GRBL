
/**
 * Parse image file and extract metadata
 */
export const parseImageFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Calculate size in mm assuming 96 DPI (standard web DPI)
        const mmPerInch = 25.4
        const dpi = 96
        const widthMM = (img.width / dpi) * mmPerInch
        const heightMM = (img.height / dpi) * mmPerInch
        
        resolve({
          dataUrl: e.target.result,
          originalWidth: widthMM,
          originalHeight: heightMM,
          pixelWidth: img.width,
          pixelHeight: img.height,
          aspectRatio: img.width / img.height
        })
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Calculate image position based on alignment setting
 */
export const calculateImagePosition = (imageData, alignment, machineProfile) => {
  const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
  const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx
  
  const imageWidth = imageData.width * machineProfile.mmToPx
  const imageHeight = imageData.height * machineProfile.mmToPx
  
  let x = 0
  let y = 0
  
  switch (alignment) {
    case 'bottom-left':
      x = 0
      y = canvasHeight - imageHeight
      break
    case 'bottom-right':
      x = canvasWidth - imageWidth
      y = canvasHeight - imageHeight
      break
    case 'top-left':
      x = 0
      y = 0
      break
    case 'top-right':
      x = canvasWidth - imageWidth
      y = 0
      break
    case 'center':
      x = (canvasWidth - imageWidth) / 2
      y = (canvasHeight - imageHeight) / 2
      break
  }
  
  return { x, y }
}

/**
 * Create image shape object
 */
export const createImageShape = (imageData, options, machineProfile) => {
  const { alignment, layerId, targetWidth, targetHeight, useOriginalSize } = options
  
  const finalWidth = useOriginalSize ? imageData.originalWidth : targetWidth
  const finalHeight = useOriginalSize ? imageData.originalHeight : targetHeight
  
  const position = calculateImagePosition(
    { width: finalWidth, height: finalHeight },
    alignment,
    machineProfile
  )
  
  return {
    id: `image-${Date.now()}`,
    type: 'image',
    x: position.x,
    y: position.y,
    width: finalWidth * machineProfile.mmToPx,
    height: finalHeight * machineProfile.mmToPx,
    dataUrl: imageData.dataUrl,
    pixelWidth: imageData.pixelWidth,
    pixelHeight: imageData.pixelHeight,
    layerId,
    opacity: 1,
    draggable: true
  }
}
