#!/usr/bin/env node

const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const cors = require('cors');
const notifier = require('node-notifier');
const fs = require('fs').promises;
const path = require('path');

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
    
    console.log(`🔐 Authentication token: ${this.authToken}`);
    
    // Default machine profiles
    this.loadDefaultProfiles();
    
    // Setup WebSocket server for CAD app communication
    this.setupWebSocketServer();
    
    // Setup HTTP server for status and control
    this.setupHttpServer();
    
    console.log('🔧 Mechanicus Companion App Started');
    console.log('📡 WebSocket Server: ws://localhost:8080');
    console.log('🌐 HTTP Server: http://localhost:8081');
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
        const allowedOrigins = [
          'http://localhost:5000',
          'http://127.0.0.1:5000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
        ];
        
        if (origin && !allowedOrigins.includes(origin)) {
          console.warn(`🚫 Rejected connection from unauthorized origin: ${origin}`);
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
            if (data.type === 'authenticate' && data.payload?.token === this.authToken) {
              isAuthenticated = true;
              this.clients.add(ws);
              console.log('✅ Client authenticated successfully');
              
              // Send current status after authentication
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
            } else {
              console.warn('🚫 Authentication failed');
              this.sendToClient(ws, {
                type: 'auth_failed',
                data: { message: 'Invalid authentication token' }
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

    this.httpServer = this.app.listen(8081, () => {
      console.log('🌐 HTTP API ready on port 8081');
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