import { useState, useEffect, useRef } from 'react'
import { useSerial } from '../contexts/SerialContext'
import PopupWindow from './PopupWindow'
import './GcodeBufferWindow.css'

function GcodeBufferWindow({ isOpen, onClose, position, onDragStart }) {
  const { sendCommand, serialState, isConnected } = useSerial()
  const [gcodeLines, setGcodeLines] = useState([])
  const [currentLine, setCurrentLine] = useState(0)
  const [status, setStatus] = useState('idle') // idle, running, paused, stopped, error
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [displayLines, setDisplayLines] = useState([]) // Lines with responses inserted for display

  const isPausedRef = useRef(false)
  const isStoppedRef = useRef(false)
  const transmissionLoopRef = useRef(null)
  const waitingForResponseRef = useRef(false)
  const responseReceivedRef = useRef(false)

  // Load G-code from buffer module
  useEffect(() => {
    const handleBufferUpdate = (event) => {
      const { lines, start } = event.detail
      const gLines = lines.map((line, idx) => {
        const cmd = line.trim().toUpperCase()
        const isPositionQuery = cmd === '?' || cmd === 'M114'
        return {
          lineNumber: idx + 1,
          command: line,
          status: idx < start ? 'completed' : 'pending',
          isPositionQuery
        }
      })
      setGcodeLines(gLines)
      setDisplayLines(gLines) // Initialize display lines
      setCurrentLine(start)
      setProgress(start)
    }

    const handleStartTransmission = () => {
      if (status === 'idle' && gcodeLines.length > 0) {
        startTransmission()
      }
    }

    // Listen for machine responses from SerialContext
    const handleSerialResponse = (event) => {
      const { message } = event.detail
      console.log('📥 [BUFFER] Received serial response:', message)

      // Add ALL machine responses to display (in red)
      setDisplayLines(prev => [...prev, {
        lineNumber: null,
        command: message,
        status: 'response',
        isResponse: true
      }])

      // Forward position updates to main app (they handle it in SerialContext)
      const lowerMsg = message.toLowerCase()
      if (lowerMsg.includes('mpos:') || (lowerMsg.includes('x:') && lowerMsg.includes('y:'))) {
        console.log('📍 [BUFFER FORWARD] Position response detected, forwarding to tracker:', message)
        // Import and forward to position tracker
        import('../utils/machinePositionTracker').then(({ machinePositionTracker }) => {
          if (machinePositionTracker.parsePositionResponse(message)) {
            const pos = machinePositionTracker.getPosition()
            console.log('📍 [BUFFER] Position successfully parsed and updated:', pos)
          }
        })
      }

      // Check if we're waiting for a response
      if (waitingForResponseRef.current) {
        // Accept "ok" or GRBL status responses as acknowledgment
        if (lowerMsg.includes('ok') || lowerMsg.startsWith('<')) {
          console.log('✅ [BUFFER] Command acknowledged:', message)
          responseReceivedRef.current = true
          waitingForResponseRef.current = false
        } else {
          console.log('⏳ [BUFFER] Waiting for ok, got:', message)
        }
      }
    }

    // Create a custom handler for SerialContext messages
    const handleSerialData = (data) => {
      console.log('🔵 [BUFFER] Direct handler received:', data, 'Waiting:', waitingForResponseRef.current)
      if (waitingForResponseRef.current && data && typeof data === 'string') {
        const lowerMsg = data.toLowerCase()
        if (lowerMsg.includes('ok') || lowerMsg.startsWith('<')) {
          console.log('✅ [BUFFER] Command acknowledged via direct handler:', data)
          responseReceivedRef.current = true
          waitingForResponseRef.current = false
        } else {
          console.log('⏳ [BUFFER] Got response but not "ok":', data)
        }
      }
    }

    // Store handler globally so SerialContext can call it
    window.bufferSerialHandler = handleSerialData

    window.addEventListener('gcode-buffer-update', handleBufferUpdate)
    window.addEventListener('start-buffer-transmission', handleStartTransmission)
    window.addEventListener('buffer-serial-response', handleSerialResponse)

    return () => {
      window.removeEventListener('gcode-buffer-update', handleBufferUpdate)
      window.removeEventListener('start-buffer-transmission', handleStartTransmission)
      window.removeEventListener('buffer-serial-response', handleSerialResponse)
      delete window.bufferSerialHandler
    }
  }, [status, gcodeLines.length, currentLine])

  const sendNextCommand = async (lineIndex) => {
    if (!isConnected || !serialState.port) {
      setStatus('error')
      setErrorMessage('Machine not connected')
      return false
    }

    if (lineIndex >= gcodeLines.length) {
      setStatus('idle')
      return false
    }

    const line = gcodeLines[lineIndex]

    // Update line status to sending
    setGcodeLines(prev => prev.map((l, idx) => 
      idx === lineIndex ? { ...l, status: 'sending' } : l
    ))

    try {
      console.log(`📤 [BUFFER] Sending line ${lineIndex + 1}/${gcodeLines.length}: ${line.command}`)

      // Set up response waiting
      waitingForResponseRef.current = true
      responseReceivedRef.current = false

      // Send command
      sendCommand(serialState.port, line.command)

      // Wait for machine response (with timeout)
      const cmd = line.command.trim().toUpperCase()

      // Position queries (? or M114) don't need acknowledgment, just send and continue
      const isPositionQuery = cmd === '?' || cmd === 'M114'

      if (isPositionQuery) {
        // Position queries don't wait for "ok", just mark as completed and continue
        console.log(`📍 [BUFFER] Position query sent, continuing without waiting`)
        waitingForResponseRef.current = false
        setGcodeLines(prev => prev.map((l, idx) => 
          idx === lineIndex ? { ...l, status: 'completed' } : l
        ))
      } else {
        // Normal commands wait for acknowledgment
        const timeout = cmd.includes('G28') ? 30000 : 5000
        const startTime = Date.now()

        console.log(`⏳ [BUFFER] Waiting for response (timeout: ${timeout}ms)...`)

        while (!responseReceivedRef.current && (Date.now() - startTime < timeout)) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        waitingForResponseRef.current = false

        if (!responseReceivedRef.current) {
          console.error(`❌ [BUFFER] TIMEOUT (${timeout}ms) waiting for response to: ${line.command}`)
          setGcodeLines(prev => prev.map((l, idx) => 
            idx === lineIndex ? { ...l, status: 'error', error: 'Timeout' } : l
          ))
          setStatus('error')
          setErrorMessage(`Timeout waiting for response to: ${line.command}`)
          return false
        } else {
          console.log(`✅ [BUFFER] Response received after ${Date.now() - startTime}ms`)
        }
      }

      // Mark current line as completed
      setGcodeLines(prev => prev.map((l, idx) => 
        idx === lineIndex ? { ...l, status: 'completed' } : l
      ))

      // Update state for UI
      setCurrentLine(lineIndex + 1)
      setProgress(lineIndex + 1)

      return true
    } catch (error) {
      console.error(`❌ [BUFFER] Error sending line ${lineIndex + 1}:`, error)
      setGcodeLines(prev => prev.map((l, idx) => 
        idx === lineIndex ? { ...l, status: 'error', error: error.message } : l
      ))
      setStatus('error')
      setErrorMessage(error.message)
      waitingForResponseRef.current = false
      return false
    }
  }

  const startTransmission = async () => {
    if (status === 'running') return

    setStatus('running')
    isPausedRef.current = false
    isStoppedRef.current = false
    setErrorMessage('')

    const runLoop = async () => {
      let lineIndex = currentLine

      while (lineIndex < gcodeLines.length && !isStoppedRef.current) {
        // Check if paused
        while (isPausedRef.current && !isStoppedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (isStoppedRef.current) break

        const success = await sendNextCommand(lineIndex)
        if (!success) break

        // Increment local counter
        lineIndex++

        // Check if next command is part of continuous movement (G1/G2/G3 without laser toggle)
        const currentCmd = gcodeLines[lineIndex - 1]?.command.trim().toUpperCase()
        const nextCmd = gcodeLines[lineIndex]?.command.trim().toUpperCase()

        const isContinuousMove = 
          nextCmd && 
          (nextCmd.startsWith('G1') || nextCmd.startsWith('G2') || nextCmd.startsWith('G3')) &&
          !nextCmd.includes('M3') && 
          !nextCmd.includes('M5') &&
          !currentCmd.includes('M3') &&
          !currentCmd.includes('M5')

        // Reduced delay for continuous shapes (20ms), normal delay otherwise (100ms)
        const delay = isContinuousMove ? 20 : 100
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      if (lineIndex >= gcodeLines.length) {
        setStatus('idle')
      }
    }

    transmissionLoopRef.current = runLoop()
  }

  const handlePause = () => {
    if (status === 'running') {
      isPausedRef.current = true
      setStatus('paused')
    }
  }

  const handleContinue = () => {
    if (status === 'paused') {
      isPausedRef.current = false
      setStatus('running')
    } else if (status === 'idle' || status === 'error') {
      startTransmission()
    }
  }

  const handleStop = () => {
    isStoppedRef.current = true
    isPausedRef.current = false
    setStatus('stopped')
  }

  const handleEmergencyAbort = () => {
    isStoppedRef.current = true
    isPausedRef.current = false
    setStatus('stopped')
    waitingForResponseRef.current = false

    // Send emergency stop to machine
    if (isConnected && serialState.port) {
      // Get firmware from machine profile or default to GRBL
      const machineConnection = window.cadStore?.getState?.()?.machineConnection
      const firmware = machineConnection?.currentProfile?.firmwareType || 'grbl'

      console.log('🚨 [BUFFER] Emergency abort, firmware:', firmware)

      const stopCmd = firmware === 'grbl' ? '\x18' : 'M112'
      sendCommand(serialState.port, stopCmd)
    }
  }

  const handleReset = () => {
    setCurrentLine(0)
    setProgress(0)
    setStatus('idle')
    setErrorMessage('')
    setGcodeLines(prev => prev.map(l => ({ ...l, status: 'pending' })))
  }

  const getStatusColor = (lineStatus, isResponse, isPositionQuery) => {
    if (isResponse) return '#FF4444' // Red for machine responses
    if (isPositionQuery) return '#FF4444' // Red for position queries (user requirement)
    switch (lineStatus) {
      case 'completed': return '#4CAF50'
      case 'sending': return '#2196F3'
      case 'error': return '#F44336'
      default: return '#757575'
    }
  }

  const getStatusIcon = (lineStatus) => {
    switch (lineStatus) {
      case 'completed': return '✓'
      case 'sending': return '→'
      case 'error': return '✗'
      default: return '○'
    }
  }

  return (
    <PopupWindow
      title="G-code Buffer & Transmission"
      isOpen={isOpen}
      onClose={onClose}
      position={position}
      onDragStart={onDragStart}
      width={600}
      height={500}
    >
      <div className="gcode-buffer-content">
        {/* Status Bar */}
        <div className="buffer-status-bar">
          <div className="status-indicator">
            Status: <span className={`status-${status}`}>{status.toUpperCase()}</span>
          </div>
          <div className="progress-indicator">
            Progress: {progress} / {gcodeLines.length} ({gcodeLines.length > 0 ? Math.round((progress / gcodeLines.length) * 100) : 0}%)
          </div>
        </div>

        {errorMessage && (
          <div className="error-message">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Control Buttons */}
        <div className="buffer-controls">
          <button
            onClick={handleContinue}
            disabled={status === 'running' || gcodeLines.length === 0}
            className="control-btn continue-btn"
          >
            ▶ Continue
          </button>
          <button
            onClick={handlePause}
            disabled={status !== 'running'}
            className="control-btn pause-btn"
          >
            ⏸ Pause
          </button>
          <button
            onClick={handleStop}
            disabled={status === 'idle' || status === 'stopped'}
            className="control-btn stop-btn"
          >
            ⏹ Stop
          </button>
          <button
            onClick={handleEmergencyAbort}
            className="control-btn emergency-btn"
          >
            🚨 EMERGENCY ABORT
          </button>
          <button
            onClick={handleReset}
            disabled={status === 'running'}
            className="control-btn reset-btn"
          >
            🔄 Reset
          </button>
        </div>

        {/* G-code Table */}
        <div className="gcode-table-container">
          <table className="gcode-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Line</th>
                <th style={{ width: '40px' }}>Status</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((line, idx) => (
                <tr
                  key={`${line.lineNumber || 'resp'}-${idx}`}
                  className={`gcode-line ${line.status} ${line.isResponse ? 'response-line' : ''} ${line.isPositionQuery ? 'position-query' : ''} ${idx === currentLine ? 'current' : ''}`}
                  style={{ color: getStatusColor(line.status, line.isResponse, line.isPositionQuery) }}
                >
                  <td className="line-number">{line.isResponse ? '→' : line.lineNumber}</td>
                  <td className="line-status">{line.isResponse ? '◀' : getStatusIcon(line.status)}</td>
                  <td className="line-command">
                    {line.command}
                    {line.error && <span className="line-error"> ({line.error})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="buffer-hint">
          💡 This buffer manages G-code transmission with proper timing. Use Continue to resume from the last completed line after a crash.
        </div>
      </div>
    </PopupWindow>
  )
}

export default GcodeBufferWindow