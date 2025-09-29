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
  const [connectedPorts, setConnectedPorts] = useState([])
  const [availablePorts, setAvailablePorts] = useState([])
  const [machineProfiles, setMachineProfiles] = useState([])
  const [currentProfile, setCurrentProfile] = useState(null)
  const [companionStatus, setCompanionStatus] = useState('disconnected') // disconnected, connecting, connected, error
  const [transmissionStatus, setTransmissionStatus] = useState(null)
  const [messages, setMessages] = useState([])
  
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const maxReconnectAttempts = 5
  const reconnectAttemptRef = useRef(0)

  // Connect to companion app
  const connectToCompanion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    setCompanionStatus('connecting')
    addMessage('system', 'Connecting to Mechanicus Companion App...')

    const ws = new WebSocket('ws://localhost:8080')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('🔗 Connected to companion app')
      setCompanionStatus('connected')
      reconnectAttemptRef.current = 0
      addMessage('system', '✅ Connected to Mechanicus Companion App')
      
      // Request initial status
      sendMessage({ type: 'list_ports' })
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleCompanionMessage(message)
      } catch (error) {
        console.error('❌ Error parsing companion message:', error)
      }
    }

    ws.onclose = () => {
      console.log('🔌 Disconnected from companion app')
      setCompanionStatus('disconnected')
      setIsConnected(false)
      setConnectedPorts([])
      
      // Attempt to reconnect
      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        reconnectAttemptRef.current++
        addMessage('system', `Connection lost. Retrying (${reconnectAttemptRef.current}/${maxReconnectAttempts})...`)
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectToCompanion()
        }, 3000 * reconnectAttemptRef.current) // Exponential backoff
      } else {
        addMessage('error', '❌ Failed to connect to Mechanicus Companion App after multiple attempts')
        setCompanionStatus('error')
      }
    }

    ws.onerror = (error) => {
      console.error('❌ Companion WebSocket error:', error)
      setCompanionStatus('error')
      addMessage('error', '❌ Connection error with Mechanicus Companion App')
    }
  }

  // Disconnect from companion app
  const disconnectFromCompanion = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setCompanionStatus('disconnected')
    setIsConnected(false)
    setConnectedPorts([])
    addMessage('system', 'Disconnected from Mechanicus Companion App')
  }

  // Send message to companion app
  const sendMessage = (message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      addMessage('error', '❌ Not connected to companion app')
    }
  }

  // Handle messages from companion app
  const handleCompanionMessage = (message) => {
    const { type, data } = message

    switch (type) {
      case 'status':
        setConnectedPorts(data.connectedPorts || [])
        setMachineProfiles(data.machineProfiles || [])
        setCurrentProfile(data.currentProfile)
        setIsConnected(data.connectedPorts?.length > 0)
        break

      case 'ports_list':
        setAvailablePorts(data)
        break

      case 'port_connected':
        setConnectedPorts(prev => [...prev, data.portPath])
        setIsConnected(true)
        addMessage('success', `✅ Connected to ${data.portPath} (${data.profile})`)
        break

      case 'port_disconnected':
        setConnectedPorts(prev => prev.filter(port => port !== data.portPath))
        setIsConnected(prev => prev && connectedPorts.length > 1)
        addMessage('info', `🔌 Disconnected from ${data.portPath}`)
        break

      case 'port_error':
        addMessage('error', `❌ Port error: ${data.error}`)
        break

      case 'serial_data':
        addMessage('receive', `📨 ${data.portPath}: ${data.message}`)
        break

      case 'command_sent':
        addMessage('send', `📤 ${data.portPath}: ${data.command}`)
        break

      case 'gcode_start':
        setTransmissionStatus({
          status: 'transmitting',
          filename: data.filename,
          totalLines: data.totalLines,
          currentLine: 0,
          percentage: 0
        })
        addMessage('info', `📤 Starting G-code transmission: ${data.filename || 'manual'} (${data.totalLines} lines)`)
        break

      case 'gcode_progress':
        setTransmissionStatus(prev => ({
          ...prev,
          currentLine: data.lineNumber,
          percentage: data.percentage,
          currentCommand: data.currentLine
        }))
        break

      case 'gcode_complete':
        setTransmissionStatus(null)
        addMessage('success', `✅ G-code transmission complete: ${data.linesTransmitted} lines`)
        break

      case 'gcode_error':
        setTransmissionStatus(null)
        addMessage('error', `❌ G-code transmission failed: ${data.message}`)
        break

      case 'emergency_stop':
        setTransmissionStatus(null)
        addMessage('warning', '🚨 EMERGENCY STOP ACTIVATED')
        break

      case 'error':
        addMessage('error', `❌ ${data.message}`)
        break

      case 'connection_error':
        addMessage('error', `❌ Connection failed to ${data.portPath}: ${data.error}`)
        break

      default:
        console.log('Unknown message type:', type, data)
    }
  }

  // Add message to log
  const addMessage = (type, content) => {
    const message = {
      id: Date.now() + Math.random(),
      type, // system, info, success, warning, error, send, receive
      content,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev.slice(-99), message]) // Keep last 100 messages
  }

  // Clear message log
  const clearMessages = () => {
    setMessages([])
  }

  // API functions for serial operations
  const listPorts = () => {
    sendMessage({ type: 'list_ports' })
  }

  const connectToPort = (portPath, profileName = 'grbl') => {
    sendMessage({ 
      type: 'connect', 
      payload: { portPath, profileName }
    })
  }

  const disconnectFromPort = (portPath) => {
    sendMessage({ 
      type: 'disconnect', 
      payload: { portPath }
    })
  }

  const sendCommand = (portPath, command) => {
    sendMessage({ 
      type: 'send_command', 
      payload: { portPath, command }
    })
  }

  const sendGcode = (portPath, gcode, filename = null) => {
    sendMessage({ 
      type: 'send_gcode', 
      payload: { portPath, gcode, filename }
    })
  }

  const setMachineProfile = (profileName) => {
    sendMessage({ 
      type: 'set_machine_profile', 
      payload: { profileName }
    })
  }

  const emergencyStop = () => {
    sendMessage({ type: 'emergency_stop' })
  }

  // Auto-connect on mount
  useEffect(() => {
    connectToCompanion()
    
    return () => {
      disconnectFromCompanion()
    }
  }, [])

  const value = {
    // Status
    isConnected,
    connectedPorts,
    availablePorts,
    machineProfiles,
    currentProfile,
    companionStatus,
    transmissionStatus,
    messages,

    // Connection management
    connectToCompanion,
    disconnectFromCompanion,
    
    // Serial operations
    listPorts,
    connectToPort,
    disconnectFromPort,
    sendCommand,
    sendGcode,
    setMachineProfile,
    emergencyStop,
    
    // Utilities
    clearMessages,
    addMessage
  }

  return (
    <SerialContext.Provider value={value}>
      {children}
    </SerialContext.Provider>
  )
}

export default SerialContext