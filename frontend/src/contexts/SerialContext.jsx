import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { machinePositionTracker } from '../utils/machinePositionTracker'

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
    connected: false,
    port: null,
    baud: null,
    error: null
  })
  const [messages, setMessages] = useState([])

  // Machine position tracking
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [laserActive, setLaserActive] = useState(false)
  const [isHomed, setIsHomed] = useState(false)

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
      machinePositionTracker.destroy()
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
    console.log('🔔 [WS MESSAGE RECEIVED]:', { type, data })

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
            // Initialize position tracker with WebSocket and port
            machinePositionTracker.init(wsRef.current, data.serialState.port)
          }
        }
        break

      case 'serial_state':
        // Serial connection state update from companion
        setSerialState(data)
        setIsConnected(data.connected)

        if (data.connected) {
          addMessage('success', `✅ Machine connected: ${data.port} @ ${data.baud} baud`)
          machinePositionTracker.init(wsRef.current, data.port)
          // Query position once on connect
          machinePositionTracker.queryPosition(data.port)
        } else if (data.error) {
          addMessage('error', `❌ Serial error: ${data.error}`)
        }
        break

      case 'serial_data':
        console.log('═══════════════════════════════════════════════════════')
        console.log('📥 [MAIN APP] Received serial_data from companion')
        console.log('📥 [MAIN APP] Message:', data.message)
        addMessage('receive', `📨 ${data.message}`)

        // Parse position from M114 response (case-insensitive)
        const lowerMsg = data.message.toLowerCase()
        if (lowerMsg.includes('x:') && lowerMsg.includes('y:')) {
          console.log('🔍 [MAIN APP] Detected x: y: in response, attempting parse...')
          if (machinePositionTracker.parsePositionResponse(data.message)) {
            const pos = machinePositionTracker.getPosition()
            console.log('✅ [MAIN APP] Position parsed successfully:', pos)
            setMachinePosition(pos)
          } else {
            console.warn('⚠️ [MAIN APP] Position parse failed for:', data.message)
          }
        }

        // Detect laser state changes
        if (data.message.includes('M3 ')) {
          console.log('🔴 [MAIN APP] Laser ON detected')
          machinePositionTracker.setLaserState(true)
          setLaserActive(true)
        } else if (data.message.includes('M5')) {
          console.log('⚫ [MAIN APP] Laser OFF detected')
          machinePositionTracker.setLaserState(false)
          setLaserActive(false)
        }
        console.log('═══════════════════════════════════════════════════════\n')
        break

      case 'position_update':
        console.log('📥 [SERIAL CONTEXT] ========================================')
        console.log('📥 [SERIAL CONTEXT] Received position_update from companion app')
        console.log('📥 [SERIAL CONTEXT] Message data:', data)
        console.log('📥 [SERIAL CONTEXT] Timestamp:', new Date().toISOString())

        const newPosition = {
          x: data.x || 0,
          y: data.y || 0,
          z: data.z || 0
        }
        console.log('📥 [SERIAL CONTEXT] Parsed position:', newPosition)

        setMachinePosition(newPosition)
        console.log('📥 [SERIAL CONTEXT] Updated React state with position')

        machinePositionTracker.position = newPosition
        console.log('📥 [SERIAL CONTEXT] Updated tracker position')

        machinePositionTracker.notifyListeners()
        console.log('📥 [SERIAL CONTEXT] Notified tracker listeners')
        console.log('📥 [SERIAL CONTEXT] ========================================')

        addMessage('info', `📍 Position: X:${newPosition.x.toFixed(2)} Y:${newPosition.y.toFixed(2)} Z:${newPosition.z.toFixed(2)}`)
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

      console.log('═══════════════════════════════════════════════════════')
      console.log('📤 [MAIN APP → COMPANION] Sending G-code')
      console.log('📤 [MAIN APP → COMPANION] Port:', serialState.port)
      console.log('📤 [MAIN APP → COMPANION] G-code length:', gcode.length)
      console.log('📤 [MAIN APP → COMPANION] Preview:', gcode.substring(0, 100) + (gcode.length > 100 ? '...' : ''))

      wsRef.current.send(JSON.stringify(payload))
      console.log('✅ [MAIN APP → COMPANION] Sent successfully')
      console.log('═══════════════════════════════════════════════════════\n')

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

  // Position tracking is now handled by machinePositionTracker module

  // Placeholder functions for now, will be implemented later
  const homeAxes = () => {
    console.log('Homing axes...')
    sendGcode('G28') // Assuming G28 is the homing command
  }

  const jogAxis = (axis, value) => {
    console.log(`Jogging ${axis} by ${value}...`)
    // Example: G1 X10 Y5 F1000
    const portPath = serialState.port; // Get portPath here
    sendGcode(`G1 ${axis.toUpperCase()}${value} F6000`) // Assuming F6000 for jog speed

    // Query position after jog
    console.log('⏰ [JOG] Setting timeout to query position in 300ms')
    setTimeout(() => {
      console.log('⏰ [JOG] Timeout fired - calling queryPosition()')
      console.log('⏰ [JOG] Port path:', portPath)
      console.log('⏰ [JOG] Tracker instance:', machinePositionTracker)
      machinePositionTracker.queryPosition(portPath)
    }, 300)
  }

  const value = {
    isConnected,
    companionStatus,
    serialState,
    messages,
    machinePosition, // Expose machine position
    laserActive, // Expose laser active state
    isHomed, // Expose homed status
    connectToCompanion,
    sendGcode,
    emergencyStop,
    clearMessages,
    homeAxes, // Expose homeAxes function
    jogAxis // Expose jogAxis function
  }

  return (
    <SerialContext.Provider value={value}>
      {children}
    </SerialContext.Provider>
  )
}