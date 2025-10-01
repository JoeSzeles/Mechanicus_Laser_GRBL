import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { InsertUser, InsertProject, InsertMachineConfig, InsertUserPreferences } from '@shared/schema';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'mechanicus-secret-key-change-in-production';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser: InsertUser = {
      email,
      username,
      password: hashedPassword,
    };

    const user = await storage.createUser(newUser);

    // Create default preferences
    const defaultPrefs: InsertUserPreferences = {
      userId: user.id,
      theme: 'dark',
      gridSize: 5,
      snapEnabled: true,
      showRulers: true,
      showGrid: true,
    };
    await storage.createUserPreferences(defaultPrefs);

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected routes
app.get('/api/user/profile', authenticateToken, async (req: any, res) => {
  try {
    const user = await storage.getUser(req.user.userId);
    const preferences = await storage.getUserPreferences(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: { id: user.id, email: user.email, username: user.username },
      preferences,
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Projects routes
app.get('/api/projects', authenticateToken, async (req: any, res) => {
  try {
    const projects = await storage.getUserProjects(req.user.userId);
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/projects', authenticateToken, async (req: any, res) => {
  try {
    const { name, svgData, fabricData } = req.body;
    
    const newProject: InsertProject = {
      userId: req.user.userId,
      name,
      svgData: svgData || null,
      fabricData: fabricData || null,
    };

    const project = await storage.createProject(newProject);
    res.json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/projects/:id', authenticateToken, async (req: any, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, svgData, fabricData } = req.body;
    
    const project = await storage.updateProject(projectId, req.user.userId, {
      name,
      svgData,
      fabricData,
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Machine profile routes - Complete with all 42 config variables
app.get('/api/machine-profiles', authenticateToken, async (req: any, res) => {
  try {
    const profiles = await storage.getUserMachineConfigs(req.user.userId);
    res.json(profiles);
  } catch (error) {
    console.error('Get machine profiles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/machine-profiles/default', authenticateToken, async (req: any, res) => {
  try {
    const defaultProfile = await storage.getDefaultMachineConfig(req.user.userId);
    res.json(defaultProfile || null);
  } catch (error) {
    console.error('Get default machine profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/machine-profiles/:id', authenticateToken, async (req: any, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const profile = await storage.getMachineConfig(profileId, req.user.userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Get machine profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/machine-profiles', authenticateToken, async (req: any, res) => {
  try {
    const profileData = req.body;
    
    const newProfile: InsertMachineConfig = {
      userId: req.user.userId,
      ...profileData,
    };

    const profile = await storage.createMachineConfig(newProfile);
    res.json(profile);
  } catch (error) {
    console.error('Create machine profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/machine-profiles/:id', authenticateToken, async (req: any, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const updates = req.body;
    
    const profile = await storage.updateMachineConfig(profileId, req.user.userId, updates);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Update machine profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/machine-profiles/:id', authenticateToken, async (req: any, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const deleted = await storage.deleteMachineConfig(profileId, req.user.userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete machine profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/machine-profiles/:id/set-default', authenticateToken, async (req: any, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const profile = await storage.setDefaultMachineConfig(profileId, req.user.userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Set default profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Machine connection status routes
app.get('/api/machine-connection', authenticateToken, async (req: any, res) => {
  try {
    const connection = await storage.getMachineConnection(req.user.userId);
    res.json(connection || { userId: req.user.userId, isConnected: false });
  } catch (error) {
    console.error('Get machine connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/machine-connection', authenticateToken, async (req: any, res) => {
  try {
    const connectionData = req.body;
    const connection = await storage.upsertMachineConnection(req.user.userId, connectionData);
    res.json(connection);
  } catch (error) {
    console.error('Update machine connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User preferences routes
app.put('/api/user/preferences', authenticateToken, async (req: any, res) => {
  try {
    const preferences = await storage.updateUserPreferences(req.user.userId, req.body);
    res.json(preferences);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Mechanicus server running on port ${PORT}`);
});