const configManager = require('./configManager');

async function exampleUsage() {
  const config = await configManager.loadConfig();
  
  const token = configManager.generateToken();
  console.log('Generated pairing token:', token);
  
  await configManager.addOrigin(
    config,
    'https://myapp.replit.dev',
    token,
    'My Mechanicus CAD Application'
  );
  
  const isAllowed = configManager.isOriginAllowed(config, 'https://myapp.replit.dev');
  console.log('Origin allowed:', isAllowed);
  
  const isValidToken = await configManager.verifyOriginToken(
    config,
    'https://myapp.replit.dev',
    token
  );
  console.log('Token valid:', isValidToken);
  
  await configManager.updateLastSeen(config, 'https://myapp.replit.dev');
}

exampleUsage();
