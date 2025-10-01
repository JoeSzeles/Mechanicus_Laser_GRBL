#!/usr/bin/env node

const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const cors = require('cors');
const notifier = require('node-notifier');
const fs = require('fs').promises;
const path = require('path');
const open = require('open');
const { generateSessionToken, verifySessionToken } = require('./sessionManager');

class MechanicusCompanion {
  constructor() {
    this.port = null;
    this.connectedPorts = new Map();
    this.clients = new Set();
    this.machineProfiles = new Map();
    this.currentProfile = null;
    this.status = 'disconnected';
    this.jobQueue = [];
    this.isTransmitting = false;
    this.authToken = process.env.COMPANION_AUTH_TOKEN || 'mechanicus-' + Math.random().toString(36).substr(2, 9);
    
    // Initialize pairing system
    this.pairedOrigins = new Map();
    this.pendingRequests = new Map();
    this.wildcardEnabled = false;
    this.sseClients = [];
    
    // Session-based authentication
    this.sessionRequests = new Map();
    
    // Serial state management
    this.serialState = {
      connected: false,
      port: null,
      baud: null,
      error: null,
      openedAt: null,
      byRequestId: null
    };
    
    console.log(`🔐 Authentication token: ${this.authToken}`);
    
    // Default machine profiles
    this.loadDefaultProfiles();
    
    // Setup HTTP server for status and control (must be before WebSocket for SSE)
    this.setupHttpServer();
    
    // Setup WebSocket server for CAD app communication
    this.setupWebSocketServer();
    
    console.log('🔧 Mechanicus Companion App Started');
    console.log('📡 WebSocket Server: ws://localhost:8080');
    console.log('🌐 HTTP Server: http://localhost:8081');
    console.log('📊 Dashboard: http://localhost:8081');
    
    // Open dashboard in default browser
    open('http://localhost:8081').catch(err => {
      console.warn('Could not auto-open browser:', err.message);
    });
  }

  loadDefaultProfiles() {
    // Standard machine profiles
    this.machineProfiles.set('grbl', {
      name: 'GRBL (Generic)',
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: false,
      lineEnding: '\n',
      commands: {
        reset: '\x18', // Ctrl+X
        unlock: '$X',
        home: '$H',
        status: '?',
        feedHold: '!',
        resume: '~',
        softReset: '\x18'
      },
      gcodePrefixes: ['G', 'M', 'F', 'S', 'T'],
      bufferSize: 128,
      responseTimeout: 5000
    });

    this.machineProfiles.set('marlin', {
      name: 'Marlin (3D Printer)',
      baudRate: 250000,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: false,
      lineEnding: '\n',
      commands: {
        reset: 'M112',
        unlock: 'M999',
        home: 'G28',
        status: 'M114',
        feedHold: 'M0',
        resume: 'M108',
        emergency: 'M112'
      },
      gcodePrefixes: ['G', 'M', 'F', 'S', 'T'],
      bufferSize: 96,
      responseTimeout: 10000
    });

    this.machineProfiles.set('smoothie', {
      name: 'Smoothieware',
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: false,
      lineEnding: '\n',
      commands: {
        reset: 'reset',
        unlock: '$X',
        home: '$H',
        status: '?',
        feedHold: '!',
        resume: '~'
      },
      gcodePrefixes: ['G', 'M', 'F', 'S', 'T'],
      bufferSize: 64,
      responseTimeout: 5000
    });

    console.log(`📋 Loaded ${this.machineProfiles.size} machine profiles`);
  }

  setupWebSocketServer() {
    this.wss = new WebSocket.Server({ 
      port: 8080,
      host: '127.0.0.1', // Bind to localhost only for security
      verifyClient: (info) => {
        // Check origin for additional security
        const origin = info.origin;
        
        // Always allow localhost origins
        const localhostOrigins = [
          'http://localhost:5000',
          'http://127.0.0.1:5000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
        ];
        
        if (origin && localhostOrigins.includes(origin)) {
          return true;
        }
        
        // Check if origin is paired
        if (this.pairedOrigins && this.pairedOrigins.has(origin)) {
          // Update last seen time
          const paired = this.pairedOrigins.get(origin);
          paired.lastSeen = Date.now();
          this.pairedOrigins.set(origin, paired);
          return true;
        }
        
        // Check wildcard for replit.dev
        if (this.wildcardEnabled && origin && origin.includes('.replit.dev')) {
          // Auto-accept and add to paired origins
          const now = Date.now();
          if (this.pairedOrigins) {
            this.pairedOrigins.set(origin, {
              origin,
              createdAt: now,
              lastSeen: now
            });
          }
          console.log(`✅ Auto-accepted wildcard connection from ${origin}`);
          return true;
        }
        
        // Create a pairing request for unknown origins
        if (origin && this.pendingRequests && !this.pendingRequests.has(origin)) {
          const timestamp = Date.now();
          this.pendingRequests.set(origin, { origin, timestamp });
          
          // Broadcast to dashboard
          if (this.broadcastSSE) {
            this.broadcastSSE({
              type: 'connection_request',
              data: { origin, timestamp }
            });
          }
          
          console.log(`📋 Connection request from ${origin} - awaiting approval`);
        }
        
        if (origin && !localhostOrigins.includes(origin)) {
          console.warn(`🚫 Rejected connection from unauthorized origin: ${origin} - awaiting pairing approval`);
          return false;
        }
        
        return true;
      }
    });
    
    this.wss.on('connection', (ws, req) => {
      let isAuthenticated = false;
      
      console.log('🔗 CAD app attempting connection');
      
      // Send authentication challenge only - no status before auth
      this.sendToClient(ws, {
        type: 'auth_challenge',
        data: { message: 'Please authenticate' }
      });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          // Handle authentication first
          if (!isAuthenticated) {
            if (data.type === 'authenticate') {
              const token = data.payload?.token;
              
              if (!token) {
                console.warn('🚫 Authentication failed: No token provided');
                this.sendToClient(ws, {
                  type: 'auth_failed',
                  data: { message: 'No authentication token provided' }
                });
                ws.close();
                return;
              }
              
              if (token === this.authToken) {
                isAuthenticated = true;
                this.clients.add(ws);
                console.log('✅ Client authenticated successfully (legacy token)');
                
                this.sendToClient(ws, {
                  type: 'auth_success',
                  data: {
                    status: this.status,
                    connectedPorts: Array.from(this.connectedPorts.keys()),
                    machineProfiles: Array.from(this.machineProfiles.entries()),
                    currentProfile: this.currentProfile
                  }
                });
                
                return;
              }
              
              const sessionValidation = verifySessionToken(token);
              
              if (sessionValidation.valid) {
                isAuthenticated = true;
                this.clients.add(ws);
                console.log(`✅ Client authenticated with session token (${sessionValidation.payload.origin})`);
                
                this.sendToClient(ws, {
                  type: 'auth_success',
                  data: {
                    status: this.status,
                    connectedPorts: Array.from(this.connectedPorts.keys()),
                    machineProfiles: Array.from(this.machineProfiles.entries()),
                    currentProfile: this.currentProfile,
                    sessionData: {
                      com: sessionValidation.payload.com,
                      baud: sessionValidation.payload.baud
                    }
                  }
                });
                
                return;
              } else {
                console.warn('🚫 Authentication failed: Invalid or expired session token');
                this.sendToClient(ws, {
                  type: 'auth_failed',
                  data: { message: 'Invalid or expired session token' }
                });
                ws.close();
                return;
              }
            } else {
              console.warn('🚫 Authentication required');
              this.sendToClient(ws, {
                type: 'auth_failed',
                data: { message: 'Authentication required' }
              });
              ws.close();
              return;
            }
          }
          
          await this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('❌ Error handling client message:', error);
          this.sendToClient(ws, {
            type: 'error',
            data: { message: error.message }
          });
        }
      });

      ws.on('close', () => {
        if (isAuthenticated) {
          console.log('🔌 CAD app disconnected');
          this.clients.delete(ws);
        } else {
          console.log('🔌 Unauthenticated connection closed');
        }
      });
    });
  }

  setupHttpServer() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        version: '1.0.0',
        connectedPorts: Array.from(this.connectedPorts.keys()),
        clientsConnected: this.clients.size
      });
    });

    // List available serial ports
    this.app.get('/ports', async (req, res) => {
      try {
        const ports = await SerialPort.list();
        res.json(ports);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Server-Sent Events endpoint for real-time updates
    this.app.get('/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      this.sseClients.push(res);
      
      res.write('data: {"type":"connected"}\n\n');
      
      req.on('close', () => {
        this.sseClients = this.sseClients.filter(client => client !== res);
      });
    });
    
    // Get current status
    this.app.get('/status', (req, res) => {
      const recentRequests = Array.from(this.sessionRequests.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
      
      res.json({
        status: 'running',
        activeConnections: this.clients.size,
        pairedOrigins: Array.from(this.pairedOrigins.values()),
        pendingRequests: Array.from(this.pendingRequests.values()),
        wildcardEnabled: this.wildcardEnabled,
        serialState: this.serialState,
        sessionRequests: recentRequests
      });
    });
    
    // Accept pairing request
    this.app.post('/pair/accept', (req, res) => {
      const { origin } = req.body;
      
      if (!origin) {
        return res.status(400).json({ error: 'Origin is required' });
      }
      
      const now = Date.now();
      this.pairedOrigins.set(origin, {
        origin,
        createdAt: now,
        lastSeen: now
      });
      
      this.pendingRequests.delete(origin);
      
      this.broadcastSSE({
        type: 'status_update',
        data: {
          pairedOrigins: Array.from(this.pairedOrigins.values()),
          activeConnections: this.clients.size
        }
      });
      
      console.log(`✅ Accepted pairing request from ${origin}`);
      res.json({ success: true, origin });
    });
    
    // Decline pairing request
    this.app.post('/pair/decline', (req, res) => {
      const { origin } = req.body;
      
      if (!origin) {
        return res.status(400).json({ error: 'Origin is required' });
      }
      
      this.pendingRequests.delete(origin);
      
      console.log(`❌ Declined pairing request from ${origin}`);
      res.json({ success: true, origin });
    });
    
    // Remove paired origin
    this.app.delete('/origin/:origin', (req, res) => {
      const origin = decodeURIComponent(req.params.origin);
      
      if (this.pairedOrigins.has(origin)) {
        this.pairedOrigins.delete(origin);
        
        this.broadcastSSE({
          type: 'origin_removed',
          data: { origin }
        });
        
        console.log(`🗑️ Removed paired origin: ${origin}`);
        res.json({ success: true, origin });
      } else {
        res.status(404).json({ error: 'Origin not found' });
      }
    });
    
    // Update wildcard setting
    this.app.post('/settings/wildcard', (req, res) => {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
      }
      
      this.wildcardEnabled = enabled;
      console.log(`⚙️ Wildcard setting updated: ${enabled}`);
      res.json({ success: true, enabled });
    });
    
    // Session-based authentication endpoint
    this.app.post('/session/start', (req, res) => {
      const { origin, com, baud, profile } = req.body;
      
      if (!origin || !com || !baud) {
        return res.status(400).json({ error: 'origin, com, and baud are required' });
      }
      
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const localhostOrigins = [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
      ];
      
      const isPaired = this.pairedOrigins.has(origin) || localhostOrigins.includes(origin);
      const isWildcardAllowed = this.wildcardEnabled && origin.includes('.replit.dev');
      
      if (isPaired || isWildcardAllowed) {
        const { token, expiresAt } = generateSessionToken(origin, com, baud);
        
        this.sessionRequests.set(requestId, {
          requestId,
          origin,
          com,
          baud,
          profile,
          sessionToken: token,
          expiresAt,
          accepted: true,
          createdAt: new Date()
        });
        
        console.log(`✅ Session token issued for ${origin} (${com} @ ${baud})`);
        
        return res.json({
          requestId,
          sessionToken: token,
          expiresAt,
          accepted: true
        });
      } else {
        this.sessionRequests.set(requestId, {
          requestId,
          origin,
          com,
          baud,
          profile,
          sessionToken: null,
          expiresAt: null,
          accepted: false,
          createdAt: new Date()
        });
        
        this.pendingRequests.set(origin, { origin, timestamp: Date.now() });
        
        this.broadcastSSE({
          type: 'session_request',
          data: { requestId, origin, com, baud, profile }
        });
        
        console.log(`📋 Session request pending approval: ${origin} (${com} @ ${baud})`);
        
        return res.json({
          requestId,
          sessionToken: null,
          expiresAt: null,
          accepted: false
        });
      }
    });
    
    // POST /serial/connect - Open serial port
    this.app.post('/serial/connect', async (req, res) => {
      try {
        const { requestId, com, baud } = req.body;
        
        if (!com || !baud) {
          return res.status(400).json({ 
            success: false, 
            error: 'com and baud are required' 
          });
        }
        
        if (this.serialState.connected) {
          return res.status(400).json({ 
            success: false, 
            error: `Already connected to ${this.serialState.port}`,
            state: this.serialState
          });
        }
        
        console.log(`🔌 Attempting to connect to ${com} @ ${baud} baud`);
        
        const serialPort = new SerialPort({
          path: com,
          baudRate: parseInt(baud),
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });
        
        await new Promise((resolve, reject) => {
          serialPort.on('open', () => {
            this.port = serialPort;
            this.serialState = {
              connected: true,
              port: com,
              baud: parseInt(baud),
              error: null,
              openedAt: Date.now(),
              byRequestId: requestId || null
            };
            
            console.log(`✅ Serial port ${com} opened successfully`);
            
            this.broadcastSSE({
              type: 'serial_state',
              data: this.serialState
            });
            
            resolve();
          });
          
          serialPort.on('error', (error) => {
            this.serialState = {
              connected: false,
              port: null,
              baud: null,
              error: error.message,
              openedAt: null,
              byRequestId: requestId || null
            };
            
            console.error(`❌ Serial port error: ${error.message}`);
            
            this.broadcastSSE({
              type: 'serial_state',
              data: this.serialState
            });
            
            reject(error);
          });
        });
        
        res.json({
          success: true,
          state: this.serialState
        });
        
      } catch (error) {
        console.error('❌ Serial connect failed:', error);
        
        this.serialState = {
          connected: false,
          port: null,
          baud: null,
          error: error.message,
          openedAt: null,
          byRequestId: req.body.requestId || null
        };
        
        this.broadcastSSE({
          type: 'serial_state',
          data: this.serialState
        });
        
        res.status(500).json({
          success: false,
          error: error.message,
          state: this.serialState
        });
      }
    });
    
    // POST /serial/disconnect - Close serial port
    this.app.post('/serial/disconnect', async (req, res) => {
      try {
        const { reason } = req.body;
        
        if (!this.serialState.connected || !this.port) {
          return res.status(400).json({ 
            success: false, 
            error: 'No active serial connection' 
          });
        }
        
        const portPath = this.serialState.port;
        console.log(`🔌 Disconnecting from ${portPath}${reason ? ` (${reason})` : ''}`);
        
        await new Promise((resolve, reject) => {
          this.port.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        
        this.port = null;
        this.serialState = {
          connected: false,
          port: null,
          baud: null,
          error: null,
          openedAt: null,
          byRequestId: null
        };
        
        console.log(`✅ Disconnected from ${portPath}`);
        
        this.broadcastSSE({
          type: 'serial_state',
          data: this.serialState
        });
        
        res.json({ success: true });
        
      } catch (error) {
        console.error('❌ Serial disconnect failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // POST /serial/scan - Auto-detect machine baud rate and firmware
    this.app.post('/serial/scan', async (req, res) => {
      try {
        const { ports } = req.body;
        
        const availablePorts = await SerialPort.list();
        const portsToScan = ports && ports.length > 0 
          ? ports 
          : availablePorts.map(p => p.path);
        
        console.log(`🔍 Starting auto-scan on ${portsToScan.length} port(s)`);
        
        const baudRates = [115200, 250000, 9600, 19200, 38400, 57600];
        const results = [];
        
        this.broadcastSSE({
          type: 'scan_started',
          data: { ports: portsToScan, baudRates }
        });
        
        for (const portPath of portsToScan) {
          console.log(`📡 Scanning port: ${portPath}`);
          
          this.broadcastSSE({
            type: 'scan_progress',
            data: { port: portPath, status: 'scanning' }
          });
          
          let detected = false;
          
          for (const baud of baudRates) {
            if (detected) break;
            
            console.log(`  Testing ${portPath} @ ${baud} baud...`);
            
            this.broadcastSSE({
              type: 'scan_progress',
              data: { port: portPath, baud, status: 'testing' }
            });
            
            try {
              const result = await this.testSerialPort(portPath, baud);
              
              if (result.success) {
                console.log(`  ✅ Detected: ${result.firmware} on ${portPath} @ ${baud}`);
                
                results.push({
                  port: portPath,
                  baud,
                  firmware: result.firmware,
                  success: true,
                  message: `Detected ${result.firmware}`
                });
                
                this.broadcastSSE({
                  type: 'scan_progress',
                  data: { 
                    port: portPath, 
                    baud, 
                    firmware: result.firmware,
                    status: 'detected' 
                  }
                });
                
                detected = true;
              }
            } catch (error) {
              console.log(`  ❌ ${portPath} @ ${baud}: ${error.message}`);
            }
          }
          
          if (!detected) {
            results.push({
              port: portPath,
              baud: null,
              firmware: null,
              success: false,
              message: 'No compatible firmware detected'
            });
            
            this.broadcastSSE({
              type: 'scan_progress',
              data: { port: portPath, status: 'failed' }
            });
          }
        }
        
        console.log(`🔍 Scan complete: ${results.filter(r => r.success).length}/${results.length} detected`);
        
        this.broadcastSSE({
          type: 'scan_complete',
          data: { results }
        });
        
        res.json({ results });
        
      } catch (error) {
        console.error('❌ Serial scan failed:', error);
        
        this.broadcastSSE({
          type: 'scan_error',
          data: { error: error.message }
        });
        
        res.status(500).json({
          error: error.message,
          results: []
        });
      }
    });

    this.httpServer = this.app.listen(8081, () => {
      console.log('🌐 HTTP API ready on port 8081');
      console.log('📊 Dashboard available at http://localhost:8081');
    });
  }
  
  broadcastSSE(message) {
    const data = `event: ${message.type}\ndata: ${JSON.stringify(message.data)}\n\n`;
    this.sseClients.forEach(client => {
      try {
        client.write(data);
      } catch (error) {
        console.error('Error sending SSE:', error);
      }
    });
  }
  
  // Method to simulate a connection request (for testing)
  simulateConnectionRequest(origin) {
    const timestamp = Date.now();
    this.pendingRequests.set(origin, { origin, timestamp });
    
    this.broadcastSSE({
      type: 'connection_request',
      data: { origin, timestamp }
    });
  }

  async handleClientMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case 'list_ports':
        await this.listSerialPorts(ws);
        break;
        
      case 'connect':
        await this.connectToPort(ws, payload);
        break;
        
      case 'disconnect':
        await this.disconnectFromPort(ws, payload);
        break;
        
      case 'send_command':
        await this.sendCommand(ws, payload);
        break;
        
      case 'send_gcode':
        await this.sendGcode(ws, payload);
        break;
        
      case 'set_machine_profile':
        await this.setMachineProfile(ws, payload);
        break;
        
      case 'emergency_stop':
        await this.emergencyStop(ws);
        break;
        
      default:
        this.sendToClient(ws, {
          type: 'error',
          data: { message: `Unknown command type: ${type}` }
        });
    }
  }

  async listSerialPorts(ws) {
    try {
      const ports = await SerialPort.list();
      console.log(`📡 Found ${ports.length} serial ports`);
      
      this.sendToClient(ws, {
        type: 'ports_list',
        data: ports.map(port => ({
          path: port.path,
          manufacturer: port.manufacturer,
          serialNumber: port.serialNumber,
          vendorId: port.vendorId,
          productId: port.productId,
          friendly: port.friendlyName || port.path
        }))
      });
    } catch (error) {
      console.error('❌ Error listing ports:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: 'Failed to list serial ports' }
      });
    }
  }

  async connectToPort(ws, { portPath, profileName }) {
    try {
      if (this.connectedPorts.has(portPath)) {
        throw new Error(`Port ${portPath} is already connected`);
      }

      const profile = this.machineProfiles.get(profileName || 'grbl');
      if (!profile) {
        throw new Error(`Machine profile '${profileName}' not found`);
      }

      console.log(`🔌 Connecting to ${portPath} with ${profile.name} profile`);

      const serialPort = new SerialPort({
        path: portPath,
        baudRate: profile.baudRate,
        dataBits: profile.dataBits,
        stopBits: profile.stopBits,
        parity: profile.parity
      });

      const parser = serialPort.pipe(new ReadlineParser({ delimiter: profile.lineEnding }));

      // Setup port event handlers
      serialPort.on('open', () => {
        console.log(`✅ Connected to ${portPath}`);
        this.connectedPorts.set(portPath, { port: serialPort, parser, profile });
        this.currentProfile = profile;
        this.status = 'connected';
        
        this.broadcastToClients({
          type: 'port_connected',
          data: { portPath, profile: profile.name }
        });

        // Show system notification
        notifier.notify({
          title: 'Mechanicus Companion',
          message: `Connected to ${portPath}`,
          timeout: 3000
        });
      });

      parser.on('data', (data) => {
        console.log(`📨 Received: ${data}`);
        this.broadcastToClients({
          type: 'serial_data',
          data: { portPath, message: data.toString().trim() }
        });
      });

      serialPort.on('error', (error) => {
        console.error(`❌ Serial error on ${portPath}:`, error);
        this.connectedPorts.delete(portPath);
        this.broadcastToClients({
          type: 'port_error',
          data: { portPath, error: error.message }
        });
      });

      serialPort.on('close', () => {
        console.log(`🔌 Disconnected from ${portPath}`);
        this.connectedPorts.delete(portPath);
        if (this.connectedPorts.size === 0) {
          this.status = 'disconnected';
        }
        this.broadcastToClients({
          type: 'port_disconnected',
          data: { portPath }
        });
      });

    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.sendToClient(ws, {
        type: 'connection_error',
        data: { portPath, error: error.message }
      });
    }
  }

  async disconnectFromPort(ws, { portPath }) {
    try {
      const connection = this.connectedPorts.get(portPath);
      if (!connection) {
        throw new Error(`Port ${portPath} is not connected`);
      }

      console.log(`🔌 Disconnecting from ${portPath}`);
      connection.port.close();
      
    } catch (error) {
      console.error('❌ Disconnection failed:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: error.message }
      });
    }
  }

  async sendCommand(ws, { portPath, command }) {
    try {
      const connection = this.connectedPorts.get(portPath);
      if (!connection) {
        throw new Error(`Port ${portPath} is not connected`);
      }

      console.log(`📤 Sending command: ${command}`);
      const fullCommand = command + connection.profile.lineEnding;
      connection.port.write(fullCommand);
      
      this.sendToClient(ws, {
        type: 'command_sent',
        data: { portPath, command }
      });
      
    } catch (error) {
      console.error('❌ Command send failed:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: error.message }
      });
    }
  }

  async sendGcode(ws, { portPath, gcode, filename }) {
    try {
      const connection = this.connectedPorts.get(portPath);
      if (!connection) {
        throw new Error(`Port ${portPath} is not connected`);
      }

      console.log(`📤 Starting G-code transmission: ${filename || 'manual'}`);
      this.isTransmitting = true;
      
      const lines = gcode.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith(';'); // Filter empty lines and comments
      });

      this.broadcastToClients({
        type: 'gcode_start',
        data: { portPath, filename, totalLines: lines.length }
      });

      let lineNumber = 0;
      for (const line of lines) {
        if (!this.isTransmitting) break; // Allow stopping transmission
        
        const command = line.trim() + connection.profile.lineEnding;
        connection.port.write(command);
        lineNumber++;
        
        // Send progress update
        this.broadcastToClients({
          type: 'gcode_progress',
          data: { 
            portPath, 
            lineNumber, 
            totalLines: lines.length,
            percentage: Math.round((lineNumber / lines.length) * 100),
            currentLine: line.trim()
          }
        });
        
        // Small delay between commands to prevent buffer overflow
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.isTransmitting = false;
      this.broadcastToClients({
        type: 'gcode_complete',
        data: { portPath, linesTransmitted: lineNumber }
      });
      
      console.log(`✅ G-code transmission complete: ${lineNumber} lines`);
      
    } catch (error) {
      this.isTransmitting = false;
      console.error('❌ G-code transmission failed:', error);
      this.sendToClient(ws, {
        type: 'gcode_error',
        data: { message: error.message }
      });
    }
  }

  async setMachineProfile(ws, { profileName }) {
    try {
      const profile = this.machineProfiles.get(profileName);
      if (!profile) {
        throw new Error(`Machine profile '${profileName}' not found`);
      }

      this.currentProfile = profile;
      console.log(`⚙️ Set machine profile: ${profile.name}`);
      
      this.sendToClient(ws, {
        type: 'profile_set',
        data: { profile: profile.name }
      });
      
    } catch (error) {
      console.error('❌ Profile set failed:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: error.message }
      });
    }
  }

  async emergencyStop(ws) {
    try {
      console.log('🚨 EMERGENCY STOP TRIGGERED');
      this.isTransmitting = false;
      
      for (const [portPath, connection] of this.connectedPorts) {
        const stopCommand = connection.profile.commands.feedHold || '!';
        connection.port.write(stopCommand + connection.profile.lineEnding);
        console.log(`🛑 Emergency stop sent to ${portPath}`);
      }
      
      this.broadcastToClients({
        type: 'emergency_stop',
        data: { message: 'Emergency stop activated' }
      });

      // Show system notification
      notifier.notify({
        title: 'Mechanicus Companion - EMERGENCY STOP',
        message: 'All machines have been stopped',
        timeout: 5000
      });
      
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: error.message }
      });
    }
  }

  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToClients(message) {
    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  async testSerialPort(portPath, baud) {
    return new Promise((resolve, reject) => {
      let testPort = null;
      let responseData = '';
      let timeout = null;
      let resolved = false;
      
      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (testPort && testPort.isOpen) {
          testPort.close();
        }
      };
      
      const finishTest = (result) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.message || 'Test failed'));
        }
      };
      
      try {
        testPort = new SerialPort({
          path: portPath,
          baudRate: baud,
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });
        
        const parser = testPort.pipe(new ReadlineParser({ delimiter: '\n' }));
        
        timeout = setTimeout(() => {
          finishTest({ success: false, message: 'Timeout' });
        }, 500);
        
        parser.on('data', (data) => {
          responseData += data.toString() + '\n';
          
          const dataStr = responseData.toLowerCase();
          
          if (dataStr.includes('grbl') || 
              dataStr.includes('<') && dataStr.includes('>') ||
              dataStr.includes('ok') ||
              dataStr.includes('$0=') ||
              dataStr.includes('$1=')) {
            finishTest({ 
              success: true, 
              firmware: 'GRBL',
              response: responseData 
            });
          }
          
          if (dataStr.includes('firmware_name:marlin') || 
              dataStr.includes('marlin') ||
              dataStr.includes('echo:') && dataStr.includes('marlin')) {
            finishTest({ 
              success: true, 
              firmware: 'Marlin',
              response: responseData 
            });
          }
        });
        
        testPort.on('open', () => {
          setTimeout(() => {
            if (testPort && testPort.isOpen) {
              testPort.write('?\n');
              
              setTimeout(() => {
                if (testPort && testPort.isOpen) {
                  testPort.write('$$\n');
                }
              }, 100);
              
              setTimeout(() => {
                if (testPort && testPort.isOpen) {
                  testPort.write('M115\n');
                }
              }, 200);
            }
          }, 100);
        });
        
        testPort.on('error', (error) => {
          finishTest({ success: false, message: error.message });
        });
        
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  // Graceful shutdown
  shutdown() {
    console.log('🔄 Shutting down Mechanicus Companion...');
    
    // Close all serial connections
    this.connectedPorts.forEach((connection, portPath) => {
      console.log(`🔌 Closing ${portPath}`);
      connection.port.close();
    });
    
    // Close WebSocket server
    this.wss.close();
    
    // Close HTTP server
    this.httpServer.close();
    
    console.log('👋 Mechanicus Companion stopped');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  if (global.companion) {
    global.companion.shutdown();
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  if (global.companion) {
    global.companion.shutdown();
  } else {
    process.exit(0);
  }
});

// Start the companion app
global.companion = new MechanicusCompanion();