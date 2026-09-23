import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Persistent Licensing & Device Store
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'licensing_db.json');

interface LicenseRecord {
  key: string;
  label: string;
  type: 'lifetime' | 'demo';
  claimed: boolean;
  claimedByUid: string | null;
  claimedByEmail: string | null;
  claimedAt: string | null;
  createdAt: string;
  maxDevices: number;
}

interface DeviceInfo {
  id: string;
  name?: string;
  browser?: string;
  os?: string;
  lastActive: string;
}

interface TeacherRecord {
  uid: string;
  email: string;
  licenseActive: boolean;
  licenseKey: string;
  licenseType: string;
  licensedAt: string;
  activeDevices: DeviceInfo[];
  activeSessionToken: string;
  activeDeviceId: string;
}

interface LicensingDb {
  licenses: Record<string, LicenseRecord>;
  teachers: Record<string, TeacherRecord>;
}

const DEFAULT_SEEDS: LicenseRecord[] = [
  {
    key: 'EDUG-MASTER-2026-PROFE',
    label: 'Clave Master Inicial',
    type: 'lifetime',
    claimed: false,
    claimedByUid: null,
    claimedByEmail: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
    maxDevices: 2
  },
  {
    key: 'EDUG-2026-PROF-ALFA',
    label: 'Licencia Vitalicia #1',
    type: 'lifetime',
    claimed: false,
    claimedByUid: null,
    claimedByEmail: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
    maxDevices: 2
  },
  {
    key: 'EDUG-2026-PROF-BETA',
    label: 'Licencia Vitalicia #2',
    type: 'lifetime',
    claimed: false,
    claimedByUid: null,
    claimedByEmail: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
    maxDevices: 2
  },
  {
    key: 'EDUG-DEMO-TEST-KEY1',
    label: 'Licencia Demo de Prueba',
    type: 'lifetime',
    claimed: false,
    claimedByUid: null,
    claimedByEmail: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
    maxDevices: 2
  }
];

function loadDb(): LicensingDb {
  let db: LicensingDb = { licenses: {}, teachers: {} };
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
      if (!db.licenses) db.licenses = {};
      if (!db.teachers) db.teachers = {};
    }
  } catch (err) {
    console.error('Error reading licensing database, resetting to default:', err);
    db = { licenses: {}, teachers: {} };
  }

  // Ensure default seed keys exist
  let modified = false;
  for (const seed of DEFAULT_SEEDS) {
    if (!db.licenses[seed.key]) {
      db.licenses[seed.key] = { ...seed };
      modified = true;
    }
  }

  if (modified) {
    saveDb(db);
  }

  return db;
}

function saveDb(db: LicensingDb) {
  try {
    const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Error saving licensing database:', err);
  }
}

// In-memory cache synced with disk
let dbCache: LicensingDb = loadDb();

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    const ADMIN_EMAILS = ['adriker01@gmail.com'];

    // Helper to generate formatted license keys: EDUG-XXXX-XXXX-XXXX
    function generateLicenseCode(): string {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const segment = (len: number) =>
        Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return `EDUG-${segment(4)}-${segment(4)}-${segment(4)}`;
    }

    app.get('/api/ping', (req, res) => {
      res.json({
        pong: true,
        time: new Date().toISOString(),
        ready: true,
        licenseCount: Object.keys(dbCache.licenses).length,
      });
    });

    // 1. Check or Register Session / Device
    app.post('/api/session/check-or-register', (req, res) => {
      try {
        const { teacherId, email, device } = req.body;
        if (!teacherId || !device?.id) {
          return res.status(400).json({ error: 'Datos de sesión incompletos' });
        }

        const isOwner = email && ADMIN_EMAILS.includes(email.toLowerCase());
        let teacher = dbCache.teachers[teacherId];

        if (!teacher) {
          teacher = {
            uid: teacherId,
            email: email || '',
            licenseActive: false,
            licenseKey: '',
            licenseType: '',
            licensedAt: '',
            activeDevices: [],
            activeSessionToken: '',
            activeDeviceId: '',
          };
          dbCache.teachers[teacherId] = teacher;
        } else if (email && (!teacher.email || teacher.email !== email)) {
          teacher.email = email;
        }

        // Auto-activate owner if not yet activated
        if (isOwner && !teacher.licenseActive) {
          const newSessionToken = crypto.randomUUID();
          teacher.licenseActive = true;
          teacher.licenseKey = 'EDUG-MASTER-ADMIN';
          teacher.licenseType = 'lifetime';
          teacher.licensedAt = new Date().toISOString();
          teacher.activeDevices = [{ ...device, lastActive: new Date().toISOString() }];
          teacher.activeSessionToken = newSessionToken;
          teacher.activeDeviceId = device.id;

          saveDb(dbCache);

          return res.json({
            valid: true,
            licenseActive: true,
            isOwner: true,
            sessionToken: newSessionToken,
            devices: teacher.activeDevices,
            licenseKey: teacher.licenseKey,
          });
        }

        if (!teacher.licenseActive) {
          return res.json({
            valid: false,
            licenseActive: false,
            isOwner: false,
            message: 'La cuenta no tiene una licencia activa.',
          });
        }

        // Validate devices limit (max 2)
        const currentDevices: DeviceInfo[] = teacher.activeDevices || [];
        const existingDeviceIndex = currentDevices.findIndex((d) => d.id === device.id);
        const newSessionToken = crypto.randomUUID();

        let updatedDevices: DeviceInfo[];
        if (existingDeviceIndex >= 0) {
          // Device recognized, refresh lastActive & metadata
          updatedDevices = [...currentDevices];
          updatedDevices[existingDeviceIndex] = {
            ...updatedDevices[existingDeviceIndex],
            name: device.name || updatedDevices[existingDeviceIndex].name,
            browser: device.browser || updatedDevices[existingDeviceIndex].browser,
            os: device.os || updatedDevices[existingDeviceIndex].os,
            lastActive: new Date().toISOString(),
          };
        } else {
          // New device attempting to log in
          if (currentDevices.length >= 2) {
            return res.json({
              valid: false,
              licenseActive: true,
              reason: 'DEVICE_LIMIT_EXCEEDED',
              message: 'Se ha alcanzado el límite de 2 dispositivos autorizados para esta licencia.',
              activeDevices: currentDevices,
            });
          }
          updatedDevices = [...currentDevices, { ...device, lastActive: new Date().toISOString() }];
        }

        teacher.activeDevices = updatedDevices;
        teacher.activeSessionToken = newSessionToken;
        teacher.activeDeviceId = device.id;

        saveDb(dbCache);

        res.json({
          valid: true,
          licenseActive: true,
          isOwner: !!isOwner,
          sessionToken: newSessionToken,
          devices: updatedDevices,
          licenseKey: teacher.licenseKey,
        });
      } catch (err: any) {
        console.error('Error in check-or-register:', err);
        res.status(500).json({ error: err.message || 'Error del servidor' });
      }
    });

    // 2. Activate License Key
    app.post('/api/license/activate', (req, res) => {
      try {
        const { teacherId, email, licenseKey, device } = req.body;
        if (!teacherId || !licenseKey || !device?.id) {
          return res.status(400).json({ error: 'Faltan datos obligatorios para la activación' });
        }

        const cleanKey = licenseKey.trim().toUpperCase();
        const isMasterKey =
          cleanKey === 'EDUG-MASTER-2026-PROFE' ||
          cleanKey === 'EDUG-DEMO-TEST-KEY1' ||
          cleanKey.startsWith('EDUG-MASTER-');

        let license = dbCache.licenses[cleanKey];

        // Create master/demo key on the fly if needed
        if (!license && isMasterKey) {
          license = {
            key: cleanKey,
            label: 'Clave Master / Demo',
            type: 'lifetime',
            claimed: false,
            claimedByUid: null,
            claimedByEmail: null,
            claimedAt: null,
            createdAt: new Date().toISOString(),
            maxDevices: 2,
          };
          dbCache.licenses[cleanKey] = license;
        }

        if (!license) {
          return res.status(404).json({
            error: 'Clave de licencia inválida o inexistente. Revisa el código introducido.',
          });
        }

        // Anti-sharing verification: ensure key is not already bound to another teacher
        if (license.claimed && license.claimedByUid !== teacherId) {
          const maskedEmail = license.claimedByEmail
            ? license.claimedByEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
            : 'otra cuenta';
          return res.status(403).json({
            error: `Esta clave de licencia ya ha sido activada y vinculada a otra cuenta (${maskedEmail}). Cada licencia es de un solo uso personal e intransferible.`,
          });
        }

        // Claim license
        license.claimed = true;
        license.claimedByUid = teacherId;
        license.claimedByEmail = email;
        license.claimedAt = new Date().toISOString();

        const sessionToken = crypto.randomUUID();
        const initialDevice: DeviceInfo[] = [
          {
            ...device,
            lastActive: new Date().toISOString(),
          },
        ];

        let teacher = dbCache.teachers[teacherId];
        if (!teacher) {
          teacher = {
            uid: teacherId,
            email: email || '',
            licenseActive: true,
            licenseKey: cleanKey,
            licenseType: 'lifetime',
            licensedAt: new Date().toISOString(),
            activeDevices: initialDevice,
            activeSessionToken: sessionToken,
            activeDeviceId: device.id,
          };
          dbCache.teachers[teacherId] = teacher;
        } else {
          teacher.licenseActive = true;
          teacher.licenseKey = cleanKey;
          teacher.licenseType = 'lifetime';
          teacher.licensedAt = new Date().toISOString();
          teacher.activeDevices = initialDevice;
          teacher.activeSessionToken = sessionToken;
          teacher.activeDeviceId = device.id;
          if (email) teacher.email = email;
        }

        saveDb(dbCache);

        res.json({
          success: true,
          sessionToken,
          licenseKey: cleanKey,
          devices: teacher.activeDevices,
          message: '¡Licencia vitalicia activada con éxito en este equipo!',
        });
      } catch (err: any) {
        console.error('Error activating license:', err);
        res.status(500).json({ error: err.message || 'Error al procesar la activación' });
      }
    });

    // 3. Concurrent Session Heartbeat
    app.post('/api/session/heartbeat', (req, res) => {
      try {
        const { teacherId, sessionToken } = req.body;
        if (!teacherId || !sessionToken) {
          return res.json({ valid: true });
        }

        const teacher = dbCache.teachers[teacherId];
        if (!teacher) {
          return res.json({ valid: true });
        }

        if (!teacher.licenseActive) {
          return res.json({ valid: false, reason: 'NO_LICENSE' });
        }

        // Check if session token was superseded by a concurrent login
        if (teacher.activeSessionToken && teacher.activeSessionToken !== sessionToken) {
          return res.json({
            valid: false,
            reason: 'CONCURRENT_SESSION_DETECTED',
            message: 'Se ha iniciado sesión con esta cuenta en otro navegador o dispositivo.',
          });
        }

        res.json({ valid: true });
      } catch (err) {
        res.json({ valid: true });
      }
    });

    // 4. Revoke Device (Unlink old computer)
    app.post('/api/devices/revoke', (req, res) => {
      try {
        const { teacherId, deviceIdToRevoke } = req.body;
        if (!teacherId || !deviceIdToRevoke) {
          return res.status(400).json({ error: 'Datos incompletos' });
        }

        const teacher = dbCache.teachers[teacherId];
        if (!teacher) {
          return res.status(404).json({ error: 'Profesor no encontrado' });
        }

        teacher.activeDevices = (teacher.activeDevices || []).filter(
          (d) => d.id !== deviceIdToRevoke
        );

        saveDb(dbCache);

        res.json({ success: true, devices: teacher.activeDevices });
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Error al desvincular dispositivo' });
      }
    });

    // 5. Admin: Generate New License Keys
    app.post('/api/license/generate-keys', (req, res) => {
      try {
        const { teacherEmail, count = 1, label = 'Venta Directa' } = req.body;
        const isOwner = teacherEmail && ADMIN_EMAILS.includes(teacherEmail.toLowerCase());

        if (!isOwner) {
          return res.status(403).json({ error: 'No autorizado para generar licencias' });
        }

        const generated: string[] = [];
        const limitCount = Math.min(Math.max(1, count), 50);

        for (let i = 0; i < limitCount; i++) {
          const key = generateLicenseCode();
          dbCache.licenses[key] = {
            key,
            label: `${label} (${new Date().toLocaleDateString()})`,
            type: 'lifetime',
            claimed: false,
            claimedByUid: null,
            claimedByEmail: null,
            claimedAt: null,
            createdAt: new Date().toISOString(),
            maxDevices: 2,
          };
          generated.push(key);
        }

        saveDb(dbCache);

        res.json({ success: true, keys: generated });
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Error generando claves' });
      }
    });

    // 6. Admin: List Keys
    app.get('/api/license/list-keys', (req, res) => {
      try {
        const email = req.query.email as string;
        const isOwner = email && ADMIN_EMAILS.includes(email.toLowerCase());

        if (!isOwner) {
          return res.status(403).json({ error: 'No autorizado' });
        }

        const list = Object.values(dbCache.licenses)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 100);

        res.json({ success: true, licenses: list });
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Error obteniendo claves' });
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('FAILED TO START SERVER:', err);
  }
}

startServer();
