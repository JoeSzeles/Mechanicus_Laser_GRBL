
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
  
  const isPausedRef = useRef(false)
  const isStoppedRef = useRef(false)
  const transmissionLoopRef = useRef(null)
  const waitingForResponseRef = useRef(false)
  const responseReceivedRef = useRef(false)

  // Load G-code from buffer module
  useEffect(() => {
    const handleBufferUpdate = (event) => {
      const { lines, start } = event.detail
      setGcodeLines(lines.map((line, idx) => ({
        lineNumber: idx + 1,
        command: line,
        status: idx < start ? 'completed' : 'pending'
      })))
      setCurrentLine(start)
      setProgress(start)
    }

    const handleStartTransmission = () => {
      if (status === 'idle' && gcodeLines.length > 0) {
        startTransmission()
      }
    }

    // Listen for machine responses
    const handleSerialResponse = (event) => {
      const { message } = event.detail
      console.log('📥 [BUFFER] Received serial response:', message)
      
      // Check if we're waiting for a response
      if (waitingForResponseRef.current) {
        const lowerMsg = message.toLowerCase()
        
        // Accept "ok" or GRBL status responses as acknowledgment
        if (lowerMsg.includes('ok') || lowerMsg.startsWith('<')) {
          console.log('✅ [BUFFER] Command acknowledged')
          responseReceivedRef.current = true
          waitingForResponseRef.current = false
        }
      }
    }

    window.addEventListener('gcode-buffer-update', handleBufferUpdate)
    window.addEventListener('start-buffer-transmission', handleStartTransmission)
    window.addEventListener('buffer-serial-response', handleSerialResponse)
    
    return () => {
      window.removeEventListener('gcode-buffer-update', handleBufferUpdate)
      window.removeEventListener('start-buffer-transmission', handleStartTransmission)
      window.removeEventListener('buffer-serial-response', handleSerialResponse)
    }
  }, [status, gcodeLines.length, currentLine])

  const sendNextCommand = async () => {
    if (!isConnected || !serialState.port) {
      setStatus('error')
      setErrorMessage('Machine not connected')
      return false
    }

    if (currentLine >= gcodeLines.length) {
      setStatus('idle')
      return false
    }

    const line = gcodeLines[currentLine]
    
    // Update line status to sending
    setGcodeLines(prev => prev.map((l, idx) => 
      idx === currentLine ? { ...l, status: 'sending' } : l
    ))

    try {
      console.log(`📤 [BUFFER] Sending line ${currentLine + 1}/${gcodeLines.length}: ${line.command}`)
      
      // Set up response waiting
      waitingForResponseRef.current = true
      responseReceivedRef.current = false
      
      // Send command
      sendCommand(serialState.port, line.command)
      
      // Wait for machine response (with timeout)
      const timeout = line.command.trim().toUpperCase().includes('G28') ? 10000 : 2000
      const startTime = Date.now()
      
      while (!responseReceivedRef.current && (Date.now() - startTime < timeout)) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      waitingForResponseRef.current = false
      
      if (!responseReceivedRef.current) {
        console.warn(`⚠️ [BUFFER] Timeout waiting for response to: ${line.command}`)
      }
      
      // Mark current line as completed
      setGcodeLines(prev => prev.map((l, idx) => 
        idx === currentLine ? { ...l, status: 'completed' } : l
      ))
      
      setCurrentLine(prev => prev + 1)
      setProgress(currentLine + 1)
      
      return true
    } catch (error) {
      console.error(`❌ [BUFFER] Error sending line ${currentLine + 1}:`, error)
      setGcodeLines(prev => prev.map((l, idx) => 
        idx === currentLine ? { ...l, status: 'error', error: error.message } : l
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
      while (currentLine < gcodeLines.length && !isStoppedRef.current) {
        // Check if paused
        while (isPausedRef.current && !isStoppedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (isStoppedRef.current) break

        const success = await sendNextCommand()
        if (!success) break

        // Match Python implementation: 10ms delay between commands
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      if (currentLine >= gcodeLines.length) {
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

  const getStatusColor = (lineStatus) => {
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
              {gcodeLines.map((line, idx) => (
                <tr
                  key={idx}
                  className={`gcode-line ${line.status} ${idx === currentLine ? 'current' : ''}`}
                  style={{ color: getStatusColor(line.status) }}
                >
                  <td className="line-number">{line.lineNumber}</td>
                  <td className="line-status">{getStatusIcon(line.status)}</td>
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
