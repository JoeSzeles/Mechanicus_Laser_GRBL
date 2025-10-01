import { createContext, useContext, useState, useEffect, useRef } from 'react'
import useCadStore from '../store/cadStore'

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
  const [authToken, setAuthToken] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sessionToken, setSessionToken] = useState(null)
  const [requestId, setRequestId] = useState(null)
  const [serialState, setSerialState] = useState({
    connected: false,
    port: null,
    baud: null,
    error: null
  })
  
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const maxReconnectAttempts = 5
  const reconnectAttemptRef = useRef(0)
  const profileRef = useRef(null) // Store profile for reconnection

  // Request session token from companion app
  const requestSessionToken = async (profile) => {
    if (!profile) {
      addMessage('error', '❌ No machine profile selected. Please select a profile first.')
      return null
    }

    try {
      addMessage('system', '🔑 Requesting session token from companion app...')
      
      const response = await fetch('http://localhost:8008/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          origin: window.location.origin,
          com: profile.serialConnection || profile.serial_connection,
          baud: profile.baud,
          profile: profile.name
        })
      })

      if (!response.ok) {
        throw new Error(`Session request failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.accepted === false) {
        addMessage('warning', '⏳ Session request pending approval in companion app. Please accept the connection in the companion UI.')
        setRequestId(data.requestId)
        return { pending: true, requestId: data.requestId }
      }

      if (data.sessionToken) {
        addMessage('success', '✅ Session token received from companion app')
        setSessionToken(data.sessionToken)
        setRequestId(data.requestId)
        return { sessionToken: data.sessionToken, requestId: data.requestId }
      }

      throw new Error('No session token received')
    } catch (error) {
      console.error('Failed to request session token:', error)
      addMessage('error', `❌ Failed to connect to companion app: ${error.message}. Make sure the Mechanicus Companion App is running.`)
      setCompanionStatus('error')
      return null
    }
  }

  // Connect to companion app
  const connectToCompanion = async (profile) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    // Store profile for reconnection
    if (profile) {
      profileRef.current = profile
    } else if (!profileRef.current) {
      addMessage('error', '❌ No machine profile available for connection')
      return
    }
    
    const profileToUse = profile || profileRef.current

    // First, request a session token
    const tokenResult = await requestSessionToken(profileToUse)
    
    if (!tokenResult) {
      return // Error already logged
    }

    if (tokenResult.pending) {
      // Wait for user to accept in companion UI
      return
    }

    if (!tokenResult.sessionToken) {
      addMessage('error', '❌ Failed to obtain session token')
      return
    }

    // Now connect to WebSocket with session token
    setCompanionStatus('connecting')
    addMessage('system', 'Connecting to Mechanicus Companion App WebSocket...')

    const ws = new WebSocket('ws://localhost:8080')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('🔗 Connected to companion app WebSocket')
      setCompanionStatus('connected')
      reconnectAttemptRef.current = 0
      addMessage('system', '✅ WebSocket connected, waiting for authentication challenge...')
      setIsAuthenticated(false) // Reset auth status
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
    
    // Clear session tokens
    setSessionToken(null)
    setRequestId(null)
    setIsAuthenticated(false)
    
    setCompanionStatus('disconnected')
    setIsConnected(false)
    setConnectedPorts([])
    setSerialState({
      connected: false,
      port: null,
      baud: null,
      error: null
    })
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

  // Set authentication token (called by user or from companion app logs)
  const setCompanionAuthToken = (token) => {
    setAuthToken(token)
    localStorage.setItem('companion_auth_token', token)
    addMessage('system', '🔐 Authentication token saved')
    if (companionStatus === 'connected' && !isAuthenticated) {
      sendMessage({ type: 'authenticate', payload: { token } })
    }
  }

  // Handle messages from companion app
  const handleCompanionMessage = (message) => {
    const { type, data } = message

    switch (type) {
      case 'auth_challenge':
        addMessage('system', '🔐 Received authentication challenge, sending session token...')
        // Use the session token we received earlier
        if (sessionToken) {
          sendMessage({ type: 'authenticate', payload: { token: sessionToken } })
        } else {
          addMessage('error', '❌ No session token available. Connection flow error.')
          wsRef.current?.close()
        }
        break

      case 'auth_success':
        setIsAuthenticated(true)
        setConnectedPorts(data.connectedPorts || [])
        setMachineProfiles(data.machineProfiles || [])
        setCurrentProfile(data.currentProfile)
        setIsConnected(data.connectedPorts?.length > 0)
        addMessage('success', '✅ Authenticated with companion app successfully')
        
        // If session data is provided, update serial state
        if (data.sessionData) {
          addMessage('info', `📡 Session active for ${data.sessionData.com} @ ${data.sessionData.baud} baud`)
        }
        
        // Request initial status
        sendMessage({ type: 'list_ports' })
        break

      case 'auth_failed':
        setIsAuthenticated(false)
        addMessage('error', '❌ Authentication failed. Session token may be expired or invalid.')
        
        // Clear session token and retry
        setSessionToken(null)
        setRequestId(null)
        
        // Close and retry connection
        if (wsRef.current) {
          wsRef.current.close()
        }
        
        addMessage('info', '🔄 Retrying session token request...')
        break

      case 'status':
        if (isAuthenticated) {
          setConnectedPorts(data.connectedPorts || [])
          setMachineProfiles(data.machineProfiles || [])
          setCurrentProfile(data.currentProfile)
          setIsConnected(data.connectedPorts?.length > 0)
        }
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
        setConnectedPorts(prev => {
          const updatedPorts = prev.filter(port => port !== data.portPath)
          setIsConnected(updatedPorts.length > 0) // Fix: use updated array, not stale state
          return updatedPorts
        })
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

      case 'serial_state':
        // Update serial connection state from companion app
        setSerialState(data)
        
        if (data.connected) {
          addMessage('success', `🔌 Companion app connected to serial port: ${data.port} @ ${data.baud} baud`)
          setIsConnected(true)
        } else if (data.error) {
          addMessage('error', `❌ Serial port error: ${data.error}`)
          setIsConnected(false)
        } else {
          addMessage('info', '⏳ Waiting for operator to connect via companion UI...')
          setIsConnected(false)
        }
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

  // Get current profile from CAD store
  const currentProfileFromStore = useCadStore((state) => state.machineConnection.currentProfile)
  
  // Auto-connect when profile is available
  useEffect(() => {
    console.log('📊 Profile effect triggered:', { 
      hasProfile: !!currentProfileFromStore, 
      profileName: currentProfileFromStore?.name,
      companionStatus 
    })
    
    if (currentProfileFromStore && companionStatus === 'disconnected') {
      console.log('🔄 Auto-connecting to companion app with profile:', currentProfileFromStore.name)
      connectToCompanion(currentProfileFromStore)
    }
  }, [currentProfileFromStore, companionStatus])
  
  // Cleanup on unmount
  useEffect(() => {
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
    authToken,
    isAuthenticated,
    sessionToken,
    requestId,
    serialState,

    // Connection management
    connectToCompanion,
    disconnectFromCompanion,
    setCompanionAuthToken,
    requestSessionToken,
    
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