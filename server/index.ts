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

// Machine configs routes
app.get('/api/machines', authenticateToken, async (req: any, res) => {
  try {
    const configs = await storage.getUserMachineConfigs(req.user.userId);
    res.json(configs);
  } catch (error) {
    console.error('Get machine configs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/machines', authenticateToken, async (req: any, res) => {
  try {
    const { name, comPort, baudRate, bedSizeX, bedSizeY, travelSpeed, drawSpeed, laserPower, isDefault } = req.body;
    
    const newConfig: InsertMachineConfig = {
      userId: req.user.userId,
      name,
      comPort: comPort || null,
      baudRate: baudRate || 115200,
      bedSizeX: bedSizeX || 300,
      bedSizeY: bedSizeY || 300,
      travelSpeed: travelSpeed || 3000,
      drawSpeed: drawSpeed || 2000,
      laserPower: laserPower || 1000,
      isDefault: isDefault || false,
    };

    const config = await storage.createMachineConfig(newConfig);
    res.json(config);
  } catch (error) {
    console.error('Create machine config error:', error);
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