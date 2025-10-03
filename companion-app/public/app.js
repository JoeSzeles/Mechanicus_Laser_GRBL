class CompanionDashboard {
    constructor() {
        this.eventSource = null;
        this.connectedUsers = [];
        this.wildcardEnabled = false;
        this.serialState = null;
        this.latestRequest = null;
        this.scanResults = [];
        this.isScanning = false;
        this.logs = [];
        this.maxLogs = 100;
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.connectToSSE();
        this.fetchStatus();
    }

    loadSettings() {
        const savedWildcard = localStorage.getItem('wildcardEnabled');
        if (savedWildcard !== null) {
            this.wildcardEnabled = savedWildcard === 'true';
            document.getElementById('wildcardToggle').checked = this.wildcardEnabled;
        }
    }

    setupEventListeners() {
        document.getElementById('wildcardToggle').addEventListener('change', (e) => {
            this.toggleWildcard(e.target.checked);
        });

        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectSerial();
        });

        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnectSerial();
        });

        document.getElementById('scanBtn').addEventListener('click', () => {
            this.scanPorts();
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeScanModal();
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('scanModal');
            if (e.target === modal) {
                this.closeScanModal();
            }
        });
    }

    connectToSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource('/events');
        
        this.eventSource.onopen = () => {
            this.updateStatus('running', 'Connected');
        };

        this.eventSource.onerror = () => {
            this.updateStatus('error', 'Connection Error');
            setTimeout(() => this.connectToSSE(), 5000);
        };

        this.eventSource.addEventListener('connection_request', (e) => {
            const data = JSON.parse(e.data);
            this.handleConnectionRequest(data);
        });

        this.eventSource.addEventListener('status_update', (e) => {
            const data = JSON.parse(e.data);
            this.handleStatusUpdate(data);
        });

        this.eventSource.addEventListener('origin_removed', (e) => {
            const data = JSON.parse(e.data);
            this.showNotification(`Origin removed: ${data.origin}`, 'success');
            this.fetchStatus();
        });

        this.eventSource.addEventListener('serial_state', (e) => {
            const data = JSON.parse(e.data);
            this.handleSerialStateUpdate(data);
        });

        this.eventSource.addEventListener('session_request', (e) => {
            const data = JSON.parse(e.data);
            this.handleSessionRequest(data);
        });

        this.eventSource.addEventListener('scan_progress', (e) => {
            const data = JSON.parse(e.data);
            this.handleScanProgress(data);
        });

        this.eventSource.addEventListener('scan_started', (e) => {
            const data = JSON.parse(e.data);
            this.handleScanStarted(data);
        });

        this.eventSource.addEventListener('scan_complete', (e) => {
            const data = JSON.parse(e.data);
            this.handleScanComplete(data);
        });

        this.eventSource.addEventListener('log', (e) => {
            const data = JSON.parse(e.data);
            this.handleLogEntry(data);
        });
    }

    async fetchStatus() {
        try {
            const response = await fetch('/status');
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            this.serialState = data.serialState || null;
            
            this.updateStatus('running', 'Running');
            this.updateConnectionCount(data.activeConnections || 0);
            this.updateConnectedUsers(data.activeConnections || 0);
            this.updateSerialUI();
        } catch (error) {
            console.error('Error fetching status:', error);
            this.updateStatus('error', 'Failed to load');
        }
    }

    handleLogEntry(logEntry) {
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        this.renderLogs();
    }

    handleStatusUpdate(data) {
        if (data.activeConnections !== undefined) {
            this.updateConnectionCount(data.activeConnections);
            this.updateConnectedUsers(data.activeConnections);
        }
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
    }

    renderLogs() {
        const container = document.getElementById('communicationLogs');
        
        if (this.logs.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No communication logs yet</p></div>';
            return;
        }

        container.innerHTML = this.logs.slice(-50).map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            const categoryClass = `log-${log.category.replace(/_/g, '-')}`;
            return `
                <div class="log-entry ${categoryClass}">
                    <span class="log-timestamp">${time}</span>
                    <strong>${log.message}</strong>
                    ${log.metadata && Object.keys(log.metadata).length > 0 ? 
                        `<span class="log-metadata">${JSON.stringify(log.metadata)}</span>` : ''}
                </div>
            `;
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    updateConnectedUsers(count) {
        const container = document.getElementById('connectedUsers');
        const badge = document.getElementById('usersBadge');
        
        badge.textContent = count;

        if (count === 0) {
            container.innerHTML = '<div class="empty-state"><p>No users connected</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="user-card">
                <div class="user-info">
                    <span class="user-icon">👤</span>
                    <span class="username">${count} Active Connection${count !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `;
    }

    async toggleWildcard(enabled) {
        this.wildcardEnabled = enabled;
        localStorage.setItem('wildcardEnabled', enabled);

        try {
            const response = await fetch('/settings/wildcard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });

            if (!response.ok) throw new Error('Failed to update wildcard setting');

            this.showNotification(
                enabled ? 'Wildcard enabled for *.replit.dev' : 'Wildcard disabled',
                'success'
            );
        } catch (error) {
            console.error('Error toggling wildcard:', error);
            this.showNotification(`Failed to update setting: ${error.message}`, 'error');
            document.getElementById('wildcardToggle').checked = !enabled;
            this.wildcardEnabled = !enabled;
        }
    }

    

    updateStatus(status, text) {
        const dot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        dot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }

    updateConnectionCount(count) {
        const element = document.getElementById('connectionCount');
        element.textContent = `${count} ${count === 1 ? 'connection' : 'connections'}`;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        } else {
            return date.toLocaleTimeString();
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 86400000) {
            return date.toLocaleTimeString();
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    handleSerialStateUpdate(state) {
        this.serialState = state;
        this.updateSerialUI();
    }

    handleSessionRequest(data) {
        this.latestRequest = data;
        this.updateSerialUI();
        this.showNotification(`New session request: ${data.com} @ ${data.baud}`, 'info');
    }

    updateSerialUI() {
        const serialDot = document.getElementById('serialDot');
        const serialStatusText = document.getElementById('serialStatusText');
        const serialPort = document.getElementById('serialPort');
        const serialBaud = document.getElementById('serialBaud');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const serialRequestInfo = document.getElementById('serialRequestInfo');
        const requestedCOM = document.getElementById('requestedCOM');
        const requestedBaud = document.getElementById('requestedBaud');

        if (this.serialState && this.serialState.connected) {
            serialDot.className = 'serial-dot connected';
            serialStatusText.textContent = 'Connected';
            serialPort.textContent = this.serialState.port || '-';
            serialBaud.textContent = this.serialState.baud || '-';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
        } else {
            serialDot.className = 'serial-dot disconnected';
            serialStatusText.textContent = 'Disconnected';
            serialPort.textContent = '-';
            serialBaud.textContent = '-';
            disconnectBtn.disabled = true;

            if (this.latestRequest && this.latestRequest.com && this.latestRequest.baud) {
                connectBtn.disabled = false;
            } else {
                connectBtn.disabled = true;
            }
        }

        if (this.latestRequest && this.latestRequest.com && this.latestRequest.baud) {
            serialRequestInfo.style.display = 'block';
            requestedCOM.textContent = this.latestRequest.com;
            requestedBaud.textContent = this.latestRequest.baud;
        } else {
            serialRequestInfo.style.display = 'none';
        }
    }

    async connectSerial() {
        if (!this.latestRequest || !this.latestRequest.com || !this.latestRequest.baud) {
            this.showNotification('No connection request available', 'error');
            return;
        }

        const connectBtn = document.getElementById('connectBtn');
        connectBtn.classList.add('loading');
        connectBtn.disabled = true;

        try {
            const response = await fetch('/serial/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: this.latestRequest.requestId,
                    com: this.latestRequest.com,
                    baud: this.latestRequest.baud
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to connect');
            }

            this.showNotification(`Connected to ${result.state.port} @ ${result.state.baud}`, 'success');
            this.serialState = result.state;
            this.updateSerialUI();
        } catch (error) {
            console.error('Error connecting:', error);
            this.showNotification(`Failed to connect: ${error.message}`, 'error');
        } finally {
            connectBtn.classList.remove('loading');
        }
    }

    async disconnectSerial() {
        const disconnectBtn = document.getElementById('disconnectBtn');
        disconnectBtn.classList.add('loading');
        disconnectBtn.disabled = true;

        try {
            const response = await fetch('/serial/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'User requested disconnect' })
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to disconnect');
            }

            this.showNotification('Disconnected from serial port', 'success');
            this.serialState = { connected: false };
            this.updateSerialUI();
        } catch (error) {
            console.error('Error disconnecting:', error);
            this.showNotification(`Failed to disconnect: ${error.message}`, 'error');
        } finally {
            disconnectBtn.classList.remove('loading');
        }
    }

    async scanPorts() {
        const scanBtn = document.getElementById('scanBtn');
        scanBtn.classList.add('loading');
        scanBtn.disabled = true;
        this.isScanning = true;
        this.scanResults = [];

        this.openScanModal();

        try {
            const response = await fetch('/serial/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to start scan');
            }

            const result = await response.json();
            this.scanResults = result.results || [];
        } catch (error) {
            console.error('Error scanning ports:', error);
            this.showNotification(`Scan failed: ${error.message}`, 'error');
            this.closeScanModal();
        } finally {
            scanBtn.classList.remove('loading');
            scanBtn.disabled = false;
            this.isScanning = false;
        }
    }

    handleScanStarted(data) {
        const scanResults = document.getElementById('scanResults');
        scanResults.innerHTML = `
            <div class="scan-progress">
                <p>Scanning ${data.ports.length} port(s) at ${data.baudRates.length} baud rate(s)...</p>
                <div class="progress-bar">
                    <div class="progress-fill" id="scanProgress"></div>
                </div>
                <p id="scanStatus">Starting scan...</p>
            </div>
        `;
    }

    handleScanProgress(data) {
        const scanStatus = document.getElementById('scanStatus');
        if (scanStatus) {
            scanStatus.textContent = `${data.status}: ${data.port}`;
        }

        if (data.detected) {
            this.scanResults.push(data);
        }
    }

    handleScanComplete(data) {
        const scanResults = document.getElementById('scanResults');
        
        if (data.results && data.results.length > 0) {
            this.scanResults = data.results;
            scanResults.innerHTML = `
                <div class="scan-complete">
                    <p class="scan-success">✅ Scan complete! Found ${data.results.length} machine(s)</p>
                    <div class="scan-results-list">
                        ${data.results.map((result, index) => `
                            <div class="scan-result-card" data-index="${index}">
                                <div class="result-info">
                                    <h3>${result.firmware || 'Unknown'}</h3>
                                    <p><strong>Port:</strong> ${result.port}</p>
                                    <p><strong>Baud:</strong> ${result.baud}</p>
                                    ${result.response ? `<p class="result-response">${this.escapeHtml(result.response)}</p>` : ''}
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="dashboard.selectScanResult(${index})">
                                    <span class="icon">✓</span> Select
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            scanResults.innerHTML = `
                <div class="scan-complete">
                    <p class="scan-failure">❌ No machines detected</p>
                    <p>Make sure your machine is powered on and connected.</p>
                </div>
            `;
        }
    }

    selectScanResult(index) {
        const result = this.scanResults[index];
        if (!result) return;

        this.latestRequest = {
            requestId: `scan_${Date.now()}`,
            com: result.port,
            baud: result.baud,
            profile: result.firmware
        };

        this.updateSerialUI();
        this.closeScanModal();
        this.showNotification(`Selected ${result.port} @ ${result.baud}`, 'success');
    }

    openScanModal() {
        const modal = document.getElementById('scanModal');
        modal.style.display = 'flex';
    }

    closeScanModal() {
        const modal = document.getElementById('scanModal');
        modal.style.display = 'none';
    }
}

const dashboard = new CompanionDashboard();
