const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const CONFIG_DIR_NAME = '.mechanicus-companion';
const CONFIG_FILE_NAME = 'config.json';

function getConfigDir() {
  const platform = os.platform();
  let baseDir;

  if (platform === 'win32') {
    baseDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    baseDir = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    baseDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }

  return path.join(baseDir, CONFIG_DIR_NAME);
}

function getConfigPath() {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

function getDefaultConfig() {
  return {
    allowedOrigins: [],
    origins: {},
    settings: {
      allowReplitWildcard: false
    }
  };
}

async function ensureConfigDir() {
  const configDir = getConfigDir();
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function loadConfig() {
  const configPath = getConfigPath();
  
  try {
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    if (!config.allowedOrigins || !config.origins || !config.settings) {
      console.warn('⚠️  Config file is missing required fields, using defaults');
      return getDefaultConfig();
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📝 Config file not found, creating default config');
      const defaultConfig = getDefaultConfig();
      await saveConfig(defaultConfig);
      return defaultConfig;
    } else if (error instanceof SyntaxError) {
      console.error('❌ Config file is corrupted, using default config');
      const defaultConfig = getDefaultConfig();
      await saveConfig(defaultConfig);
      return defaultConfig;
    } else {
      console.error('❌ Error loading config:', error);
      return getDefaultConfig();
    }
  }
}

async function saveConfig(config) {
  await ensureConfigDir();
  const configPath = getConfigPath();
  const tempPath = configPath + '.tmp';
  
  try {
    await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf8');
    await fs.rename(tempPath, configPath);
    console.log('✅ Config saved successfully');
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch (unlinkError) {
    }
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

function isOriginAllowed(config, origin) {
  if (!origin) return false;
  
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }
  
  if (config.settings.allowReplitWildcard) {
    const replitDevPattern = /^https:\/\/[a-zA-Z0-9-]+\.replit\.dev$/;
    if (replitDevPattern.test(origin)) {
      return true;
    }
  }
  
  return false;
}

async function addOrigin(config, origin, token, note = '') {
  if (!origin || !token) {
    throw new Error('Origin and token are required');
  }
  
  const urlPattern = /^https?:\/\/.+/;
  if (!urlPattern.test(origin)) {
    throw new Error('Invalid origin format. Must be a valid URL (http:// or https://)');
  }
  
  const saltRounds = 10;
  const tokenHash = await bcrypt.hash(token, saltRounds);
  
  config.origins[origin] = {
    tokenHash,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    note: note || ''
  };
  
  if (!config.allowedOrigins.includes(origin)) {
    config.allowedOrigins.push(origin);
  }
  
  await saveConfig(config);
  console.log(`✅ Added origin: ${origin}`);
  
  return config;
}

async function removeOrigin(config, origin) {
  if (!origin) {
    throw new Error('Origin is required');
  }
  
  delete config.origins[origin];
  
  const index = config.allowedOrigins.indexOf(origin);
  if (index > -1) {
    config.allowedOrigins.splice(index, 1);
  }
  
  await saveConfig(config);
  console.log(`✅ Removed origin: ${origin}`);
  
  return config;
}

async function verifyOriginToken(config, origin, token) {
  if (!origin || !token) {
    return false;
  }
  
  const originData = config.origins[origin];
  if (!originData || !originData.tokenHash) {
    return false;
  }
  
  try {
    const isValid = await bcrypt.compare(token, originData.tokenHash);
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying token:', error);
    return false;
  }
}

async function updateLastSeen(config, origin) {
  if (!origin) {
    throw new Error('Origin is required');
  }
  
  if (config.origins[origin]) {
    config.origins[origin].lastSeen = new Date().toISOString();
    await saveConfig(config);
    console.log(`✅ Updated last seen for origin: ${origin}`);
  } else {
    console.warn(`⚠️  Origin not found in config: ${origin}`);
  }
  
  return config;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  loadConfig,
  saveConfig,
  isOriginAllowed,
  addOrigin,
  removeOrigin,
  verifyOriginToken,
  updateLastSeen,
  generateToken,
  getConfigPath,
  getConfigDir
};
