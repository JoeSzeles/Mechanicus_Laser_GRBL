
/**
 * Parse image file and extract metadata
 */
export const parseImageFile = async (file) => {
  console.log('📁 parseImageFile: Starting parse', { fileName: file.name, fileSize: file.size, fileType: file.type })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      console.log('📁 parseImageFile: FileReader loaded successfully')
      const img = new Image()
      
      img.onload = () => {
        console.log('📁 parseImageFile: Image loaded', { width: img.width, height: img.height })
        // Calculate size in mm assuming 96 DPI (standard web DPI)
        const mmPerInch = 25.4
        const dpi = 96
        const widthMM = (img.width / dpi) * mmPerInch
        const heightMM = (img.height / dpi) * mmPerInch
        
        const result = {
          dataUrl: e.target.result,
          originalWidth: widthMM,
          originalHeight: heightMM,
          pixelWidth: img.width,
          pixelHeight: img.height,
          aspectRatio: img.width / img.height,
          dpi: dpi
        }
        console.log('📁 parseImageFile: Parse complete', result)
        resolve(result)
      }
      
      img.onerror = (error) => {
        console.error('📁 parseImageFile: Image load error', error)
        reject(new Error('Failed to load image'))
      }
      
      // Set src after handlers are attached
      console.log('📁 parseImageFile: Setting image src')
      img.src = e.target.result
    }
    
    reader.onerror = (error) => {
      console.error('📁 parseImageFile: FileReader error', error)
      reject(new Error('Failed to read file'))
    }
    
    console.log('📁 parseImageFile: Starting FileReader')
    reader.readAsDataURL(file)
  })
}

/**
 * Calculate image position based on alignment setting
 */
export const calculateImagePosition = (imageData, alignment, machineProfile) => {
  console.log('📐 calculateImagePosition: Starting', { imageData, alignment, machineProfile })
  const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
  const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx
  
  const imageWidth = imageData.width * machineProfile.mmToPx
  const imageHeight = imageData.height * machineProfile.mmToPx
  
  console.log('📐 calculateImagePosition: Canvas and image dimensions', { 
    canvasWidth, 
    canvasHeight, 
    imageWidth, 
    imageHeight 
  })
  
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
  
  console.log('📐 calculateImagePosition: Final position', { x, y, alignment })
  return { x, y }
}

/**
 * Create image shape object
 */
export const createImageShape = (imageData, options, machineProfile) => {
  console.log('🔧 createImageShape: Starting', { imageData, options, machineProfile })
  const { alignment, layerId, targetWidth, targetHeight, useOriginalSize } = options
  
  const finalWidth = useOriginalSize ? imageData.originalWidth : targetWidth
  const finalHeight = useOriginalSize ? imageData.originalHeight : targetHeight
  
  console.log('🔧 createImageShape: Calculated dimensions', { finalWidth, finalHeight })
  
  const position = calculateImagePosition(
    { width: finalWidth, height: finalHeight },
    alignment,
    machineProfile
  )
  
  console.log('🔧 createImageShape: Calculated position', position)
  
  const shape = {
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
  
  console.log('🔧 createImageShape: Shape created', shape)
  return shape
}
