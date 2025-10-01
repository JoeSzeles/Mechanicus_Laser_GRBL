import { createContext, useContext, useState, useEffect, useRef } from 'react'

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
  
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const maxReconnectAttempts = 10

  // Auto-connect to companion app on mount
  useEffect(() => {
    connectToCompanion()
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const connectToCompanion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setCompanionStatus('connecting')
    addMessage('system', '🔌 Connecting to companion app...')

    // Construct WebSocket URL - use current host but with port 8080
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.hostname
    const wsUrl = `${wsProtocol}//${wsHost}:8080`
    
    console.log('🔗 Connecting to:', wsUrl)
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
        }
        break

      case 'serial_state':
        // Serial connection state update from companion
        setSerialState(data)
        setIsConnected(data.connected)
        
        if (data.connected) {
          addMessage('success', `✅ Machine connected: ${data.port} @ ${data.baud} baud`)
        } else if (data.error) {
          addMessage('error', `❌ Serial error: ${data.error}`)
        }
        break

      case 'serial_data':
        addMessage('receive', `📨 ${data.message}`)
        break

      case 'error':
        addMessage('error', `❌ ${data.message}`)
        break

      default:
        console.log('Received:', type, data)
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
    if (wsRef.current?.readyState === WebSocket.OPEN && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'send_gcode',
        payload: { gcode }
      }))
      addMessage('info', '📤 Sending G-code...')
    } else {
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

  const value = {
    isConnected,
    companionStatus,
    serialState,
    messages,
    sendGcode,
    emergencyStop,
    clearMessages
  }

  return (
    <SerialContext.Provider value={value}>
      {children}
    </SerialContext.Provider>
  )
}

export default SerialContext
