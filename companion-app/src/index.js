#!/usr/bin/env node

const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const notifier = require('node-notifier');
const fs = require('fs').promises;
const path = require('path');
const open = require('open');
const { generateSessionToken, verifySessionToken } = require('./sessionManager');
const { log, getLogs, setBroadcastCallback } = require('./logger');

class MechanicusCompanion {
  constructor() {
    this.port = null;
    this.clients = new Set();
    this.machineProfiles = new Map();
    this.currentProfile = null;
    this.isTransmitting = false;
    this.authToken = process.env.COMPANION_AUTH_TOKEN || 'mechanicus-' + Math.random().toString(36).substr(2, 9);
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
    
    // Setup logger broadcast callback for SSE
    setBroadcastCallback((logEntry) => {
      this.broadcastLog(logEntry);
    });
    
    console.log('🔧 Mechanicus Companion App Started');
    console.log('📡 WebSocket Server: ws://localhost:8080');
    console.log('🌐 HTTP Server: http://localhost:8008');
    console.log('📊 Dashboard: http://localhost:8008');
    
    // Open dashboard in default browser
    open('http://localhost:8008').catch(err => {
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
      host: '0.0.0.0', // Bind to all interfaces for network access
      verifyClient: (info) => {
        const origin = info.origin;
        
        // Auto-accept all localhost, local network, and Replit domains
        const allowedPatterns = [
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,  // localhost
          /^https?:\/\/(172\.|192\.168\.|10\.)[\d.]+(:\d+)?$/,  // local network
          /^https?:\/\/[^\/]*\.replit\.dev(:\d+)?$/  // all replit.dev domains
        ];
        
        if (origin && allowedPatterns.some(pattern => pattern.test(origin))) {
          console.log(`✅ Accepted connection from ${origin}`);
          return true;
        }
        
        console.warn(`🚫 Rejected connection from unauthorized origin: ${origin}`);
        return false;
      }
    });
    
    this.wss.on('connection', (ws, req) => {
      const origin = req.headers.origin;
      
      log('info', 'websocket', 'Client connected', { origin });
      
      // Add client immediately - no auth required for read-only serial state updates
      this.clients.add(ws);
      
      // Send initial status to confirm connection
      this.sendToClient(ws, {
        type: 'status',
        data: { 
          connected: true,
          serialState: this.serialState 
        }
      });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
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
        log('info', 'websocket', 'Client disconnected', { origin });
        this.clients.delete(ws);
      });
    });
  }

  validateOrigin(origin) {
    if (!origin) {
      return false;
    }

    // Auto-accept all localhost, local network, and Replit domains
    const allowedPatterns = [
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,  // localhost
      /^https?:\/\/(172\.|192\.168\.|10\.)[\d.]+(:\d+)?$/,  // local network
      /^https?:\/\/[^\/]*\.replit\.dev(:\d+)?$/  // all replit.dev domains
    ];

    return allowedPatterns.some(pattern => pattern.test(origin));
  }

  setupHttpServer() {
    this.app = express();
    
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      
      if (!origin) {
        log('debug', 'http', 'Request without origin (same-origin or direct)', { method: req.method, path: req.path });
        next();
        return;
      }
      
      if (this.validateOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        if (req.method === 'OPTIONS') {
          log('debug', 'http', 'CORS preflight request', { origin, path: req.path });
          return res.status(200).end();
        }
        
        log('debug', 'http', 'CORS request allowed', { method: req.method, path: req.path, origin });
        next();
      } else {
        log('warn', 'http', 'CORS blocked - invalid origin', { origin, path: req.path });
        res.status(403).json({ error: 'Forbidden: Invalid origin' });
      }
    });
    
    this.app.use(express.json());
    
    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        version: '1.0.0',
        serialPort: this.serialState.connected ? this.serialState.port : null,
        clientsConnected: this.clients.size
      });
    });

    // Logs endpoint
    this.app.get('/logs', (req, res) => {
      const { level, category, limit } = req.query;
      const filters = {};
      
      if (level) filters.level = level;
      if (category) filters.category = category;
      if (limit) filters.limit = limit;
      
      const logs = getLogs(filters);
      log('info', 'http', 'Logs retrieved', { filters, count: logs.length });
      res.json(logs);
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
      res.json({
        status: 'running',
        activeConnections: this.clients.size,
        serialState: this.serialState
      });
    });
    
    // Serial connection and control endpoints
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
        
        log('info', 'serial', 'Attempting to connect', { com, baud, requestId });
        
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
            
            log('info', 'serial', 'Port opened successfully', { com, baud });
            
            // Setup data listener for machine responses
            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            parser.on('data', (data) => {
              const response = data.toString().trim();
              
              // Log machine response with full details
              console.log('🔍 [RAW SERIAL]:', JSON.stringify(response));
              log('info', 'serial', '📨 Machine response', { response });
              
              // Broadcast to all clients
              this.broadcastToClients({
                type: 'serial_data',
                data: { message: response }
              });
              
              // Parse M114 position responses - Python uses lowercase x: y: z:
              // Format: "x:123.45 y:67.89 z:10.00" or "X:123.45 Y:67.89 Z:10.00"
              const lowerResponse = response.toLowerCase();
              if (lowerResponse.includes('x:') && lowerResponse.includes('y:')) {
                console.log('🔍 [M114 DETECTED] Attempting to parse:', response);
                
                // Try case-insensitive match
                const xMatch = response.match(/[xX]:([-\d.]+)/);
                const yMatch = response.match(/[yY]:([-\d.]+)/);
                const zMatch = response.match(/[zZ]:([-\d.]+)/);
                
                console.log('🔍 [REGEX MATCHES]:', {
                  xMatch: xMatch?.[0],
                  yMatch: yMatch?.[0],
                  zMatch: zMatch?.[0],
                  xValue: xMatch?.[1],
                  yValue: yMatch?.[1],
                  zValue: zMatch?.[1]
                });
                
                if (xMatch && yMatch) {
                  const position = {
                    x: parseFloat(xMatch[1]),
                    y: parseFloat(yMatch[1]),
                    z: zMatch ? parseFloat(zMatch[1]) : 0
                  };
                  
                  console.log('✅ [POSITION PARSED]:', position);
                  log('info', 'position', '📍 Position update', position);
                  
                  // Broadcast position update
                  this.broadcastToClients({
                    type: 'position_update',
                    data: position
                  });
                } else {
                  console.warn('⚠️ [PARSE FAILED] Could not extract X/Y from:', response);
                }
              }
            });
            
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
            
            log('error', 'serial', 'Port error', { com, baud, error: error.message });
            
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
        log('info', 'serial', 'Disconnecting from port', { port: portPath, reason });
        
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
        
        log('info', 'serial', 'Disconnected successfully', { port: portPath });
        
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
        
        log('info', 'scan', 'Starting auto-scan', { portCount: portsToScan.length, ports: portsToScan });
        
        const baudRates = [115200, 250000, 9600, 19200, 38400, 57600];
        const results = [];
        
        this.broadcastSSE({
          type: 'scan_started',
          data: { ports: portsToScan, baudRates }
        });
        
        for (const portPath of portsToScan) {
          log('debug', 'scan', 'Scanning port', { port: portPath });
          
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
                log('info', 'scan', 'Firmware detected', { port: portPath, baud, firmware: result.firmware });
                
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
              log('debug', 'scan', 'Test failed', { port: portPath, baud, error: error.message });
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
            
            log('warn', 'scan', 'No firmware detected on port', { port: portPath });
            
            this.broadcastSSE({
              type: 'scan_progress',
              data: { port: portPath, status: 'failed' }
            });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        log('info', 'scan', 'Scan complete', { total: results.length, successful: successCount });
        
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

    this.httpServer = this.app.listen(8008, () => {
      console.log('🌐 HTTP API ready on port 8008');
      console.log('📊 Dashboard available at http://localhost:8008');
    });
  }
  
  broadcastSSE(message) {
    const data = `event: ${message.type}\ndata: ${JSON.stringify(message.data)}\n\n`;
    this.sseClients.forEach(client => {
      try {
        client.write(data);
      } catch (error) {
        log('error', 'http', 'SSE broadcast error', { error: error.message });
      }
    });
  }

  broadcastLog(logEntry) {
    this.broadcastSSE({
      type: 'log',
      data: logEntry
    });
  }

  async handleClientMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case 'list_ports':
        await this.listSerialPorts(ws);
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

  

  async sendCommand(ws, { portPath, command }) {
    try {
      if (!this.port || !this.serialState.connected || this.serialState.port !== portPath) {
        throw new Error(`Port ${portPath} is not connected`);
      }

      log('info', 'command', `📤 Sending command: ${command}`, { portPath });
      const fullCommand = command + '\n';
      this.port.write(fullCommand);
      
      this.sendToClient(ws, {
        type: 'command_sent',
        data: { portPath, command }
      });
      
    } catch (error) {
      log('error', 'command', '❌ Command send failed', { error: error.message });
      this.sendToClient(ws, {
        type: 'error',
        data: { message: error.message }
      });
    }
  }

  async sendGcode(ws, { portPath, gcode, filename }) {
    try {
      log('info', 'gcode', '📥 Received send_gcode command', { 
        portPath, 
        filename: filename || 'manual', 
        gcodeLength: gcode?.length || 0 
      });
      
      // Use HTTP connection only
      if (!this.port || !this.serialState.connected || this.serialState.port !== portPath) {
        const errorMsg = `Port ${portPath} is not connected. Current state: ${JSON.stringify(this.serialState)}`;
        log('error', 'gcode', errorMsg, { 
          portPath, 
          httpPort: this.serialState.port,
          httpConnected: this.serialState.connected
        });
        throw new Error(errorMsg);
      }

      log('info', 'gcode', '✅ Using HTTP connection for G-code', { portPath, baud: this.serialState.baud });
      const serialPort = this.port;
      const lineEnding = '\n';

      log('info', 'gcode', `📤 Starting G-code transmission to ${portPath}`, { filename: filename || 'manual' });
      this.isTransmitting = true;
      
      const lines = gcode.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith(';'); // Filter empty lines and comments
      });

      log('info', 'gcode', `Sending ${lines.length} lines of G-code`, { portPath });

      this.broadcastToClients({
        type: 'gcode_start',
        data: { portPath, filename, totalLines: lines.length }
      });

      let lineNumber = 0;
      for (const line of lines) {
        if (!this.isTransmitting) break; // Allow stopping transmission
        
        const command = line.trim() + lineEnding;
        log('debug', 'gcode', `✅ Writing to ${portPath}`, { line: line.trim(), lineNumber: lineNumber + 1 });
        serialPort.write(command);
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
      
      log('info', 'gcode', `✅ G-code transmission complete: ${lineNumber} lines`, { portPath });
      
    } catch (error) {
      this.isTransmitting = false;
      log('error', 'gcode', '❌ G-code transmission failed', { error: error.message, portPath });
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
      log('warn', 'emergency', '🚨 EMERGENCY STOP TRIGGERED');
      this.isTransmitting = false;
      
      if (this.port && this.serialState.connected) {
        const stopCommand = '!\n'; // Feed hold command
        this.port.write(stopCommand);
        log('warn', 'emergency', `🛑 Emergency stop sent to ${this.serialState.port}`);
      }
      
      this.broadcastToClients({
        type: 'emergency_stop',
        data: { message: 'Emergency stop activated' }
      });

      // Show system notification
      notifier.notify({
        title: 'Mechanicus Companion - EMERGENCY STOP',
        message: 'Machine has been stopped',
        timeout: 5000
      });
      
    } catch (error) {
      log('error', 'emergency', '❌ Emergency stop failed', { error: error.message });
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
    
    // Close serial connection if active
    if (this.port && this.serialState.connected) {
      console.log(`🔌 Closing ${this.serialState.port}`);
      this.port.close();
    }
    
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