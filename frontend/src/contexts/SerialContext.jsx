import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { parseM114Response, updatePosition, startPositionTracking, stopPositionTracking } from '../utils/machinePositionTracker'

const SerialContext = createContext()

export const useSerial = () => {
  const context = useContext(SerialContext)
  if (!context) {
    throw new Error('useSerial must be used within a SerialProvider')
  }
  return context
}

export function SerialProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [companionStatus, setCompanionStatus] = useState('disconnected')
  const [serialState, setSerialState] = useState({
    port: null,
    baud: null,
    error: null
  })
  const [messages, setMessages] = useState([])

  // Machine position tracking
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [isHomed, setIsHomed] = useState(false)
  // Removed positionUpdateInterval as it's now handled in machinePositionTracker.js

  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const maxReconnectAttempts = 10

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      stopPositionTracking() // Ensure interval is cleared on unmount
    }
  }, [])

  const connectToCompanion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setCompanionStatus('connecting')
    addMessage('system', '🔌 Connecting to local companion app...')

    // Always connect to localhost:8080 (local companion app)
    const wsUrl = 'ws://localhost:8080'

    console.log('🔗 Connecting to LOCAL companion:', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('✅ WebSocket onopen fired')
      // Don't set connected until we get a status message from companion
      // This prevents showing "connected" when companion isn't actually running
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleMessage(message)
      } catch (error) {
        console.error('❌ Error parsing message:', error)
      }
    }

    ws.onclose = () => {
      setCompanionStatus('disconnected')
      setIsConnected(false)
      setSerialState({ connected: false, port: null, baud: null, error: null })
      stopPositionTracking() // Stop tracking on disconnect

      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        reconnectAttemptRef.current++
        const delay = Math.min(3000 * reconnectAttemptRef.current, 30000)

        reconnectTimeoutRef.current = setTimeout(() => {
          addMessage('system', `🔄 Reconnecting... (${reconnectAttemptRef.current}/${maxReconnectAttempts})`)
          connectToCompanion()
        }, delay)
      } else {
        addMessage('error', '❌ Could not connect to companion app. Make sure it\'s running.')
        setCompanionStatus('error')
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      setCompanionStatus('error')
      stopPositionTracking() // Stop tracking on error
    }
  }

  const handleMessage = (message) => {
    const { type, data } = message

    switch (type) {
      case 'status':
      case 'auth_success':
        // Companion is ready - NOW we can show connected
        setCompanionStatus('connected')
        reconnectAttemptRef.current = 0
        addMessage('success', '✅ Connected to companion app')
        console.log('✅ Received status from companion, now truly connected')

        // Check serial state
        if (data?.serialState) {
          setSerialState(data.serialState)
          setIsConnected(data.serialState.connected)
          if (data.serialState.connected) {
            // Start position tracking if already connected
            startPositionTracking(sendGcode, 500)
          }
        }
        break

      case 'serial_state':
        // Serial connection state update from companion
        setSerialState(data)
        setIsConnected(data.connected)

        if (data.connected) {
          addMessage('success', `✅ Machine connected: ${data.port} @ ${data.baud} baud`)
          // Start position tracking on connection
          startPositionTracking(sendGcode, 500)
        } else if (data.error) {
          addMessage('error', `❌ Serial error: ${data.error}`)
          stopPositionTracking() // Stop position tracking on disconnection/error
        } else {
          stopPositionTracking() // Stop position tracking on disconnection
        }
        break

      case 'serial_data':
        addMessage('receive', `📨 ${data.message}`)
        // Parse position from M114 response
        parsePositionResponse(data.message)
        break

      case 'position_update':
        // Direct position update from companion
        setMachinePosition({
          x: data.x || 0,
          y: data.y || 0,
          z: data.z || 0
        })
        break

      case 'gcode_response':
        console.log('📥 G-code response:', data.response)

        // Parse M114 position response
        if (data.response && typeof data.response === 'string') {
          const position = parseM114Response(data.response)
          if (position) {
            updatePosition(position)
            setMachinePosition(position)
          }
        }
        break

      case 'error':
        console.error('❌ [WS] Error from companion:', data)
        addMessage('error', `❌ ${data.message}`)
        break

      case 'gcode_error':
        console.error('❌ [GCODE] G-code error:', data)
        addMessage('error', `❌ G-code error: ${data.message}`)
        break

      default:
        console.log('📨 [WS] Received:', type, data)
    }
  }

  const addMessage = (type, content) => {
    const message = {
      id: Date.now() + Math.random(),
      type,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev.slice(-99), message])
  }

  const sendGcode = (gcode) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isConnected && serialState.port) {
      const payload = {
        type: 'send_gcode',
        payload: {
          portPath: serialState.port,
          gcode
        }
      }

      console.log('📤 [GCODE SEND] Sending to companion app:', {
        destination: 'ws://localhost:8080',
        port: serialState.port,
        gcodePreview: gcode.substring(0, 100) + (gcode.length > 100 ? '...' : ''),
        gcodeLength: gcode.length
      })

      wsRef.current.send(JSON.stringify(payload))
      addMessage('info', `📤 Sending G-code to ${serialState.port}`)
    } else {
      console.error('❌ [GCODE SEND] Cannot send - not connected:', {
        wsState: wsRef.current?.readyState,
        wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
        isConnected,
        serialPort: serialState.port
      })
      addMessage('error', '❌ Not connected. Use companion app to connect to serial port.')
    }
  }

  const emergencyStop = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'emergency_stop' }))
      addMessage('warning', '🚨 EMERGENCY STOP')
    }
  }

  const clearMessages = () => {
    setMessages([])
  }

  // --- Position Tracking Functions ---

  const parsePositionResponse = (response) => {
    // Parse M114 response: "X:123.45 Y:67.89 Z:10.00 E:0.00"
    const match = response.match(/X:([-\d.]+)\s+Y:([-\d.]+)\s+Z:([-\d.]+)/)
    if (match) {
      setMachinePosition({
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: parseFloat(match[3])
      })
    }
  }

  // Removed startPositionTracking and stopPositionTracking as they are in machinePositionTracker.js

  // --- End Position Tracking Functions ---

  // Placeholder functions for now, will be implemented later
  const homeAxes = () => {
    console.log('Homing axes...')
    sendGcode('G28') // Assuming G28 is the homing command
  }

  const jogAxis = (axis, value) => {
    console.log(`Jogging ${axis} by ${value}...`)
    // Example: G1 X10 Y5 F1000
    sendGcode(`G1 ${axis.toUpperCase()}${value} F6000`) // Assuming F6000 for jog speed
  }

  const disconnectFromCompanion = () => {
    if (wsRef.current) {
      wsRef.current.close()
      addMessage('system', '👋 Disconnected from companion app.')
    }
    // Explicitly stop tracking on disconnect, though ws.onclose should handle it
    stopPositionTracking()
    setMachinePosition({ x: 0, y: 0, z: 0 })
    setIsConnected(false)
    setCompanionStatus('disconnected')
    setSerialState({ port: null, baud: null, error: null })
  }

  const value = {
    isConnected,
    companionStatus,
    serialState,
    messages,
    machinePosition, // Expose machine position
    isHomed, // Expose homed status
    connectToCompanion,
    sendGcode,
    emergencyStop,
    clearMessages,
    homeAxes, // Expose homeAxes function
    jogAxis, // Expose jogAxis function
    disconnectFromCompanion // Expose disconnect function
  }

  return (
    <SerialContext.Provider value={value}>
      {children}
    </SerialContext.Provider>
  )
}