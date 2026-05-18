import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let firestore: any = null;

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  console.log(`Checking for Firebase config at: ${configPath}`);
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`Config found for project: ${firebaseConfig.projectId}`);
    
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('Firebase App initialized');
    }
    
    // Explicitly handle databaseId if provided
    const dbId = firebaseConfig.firestoreDatabaseId;
    console.log(`Initializing Firestore with databaseId: ${dbId || '(default)'}`);
    firestore = dbId ? getFirestore(dbId) : getFirestore();
      
    if (firestore) {
      console.log('Firebase Admin initialized successfully');
    } else {
      console.error('getFirestore returned null or undefined');
    }
  } else {
    console.warn('firebase-applet-config.json not found at ' + configPath);
  }
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err);
}

function getBaseUrl(req: express.Request) {
  if (process.env.APP_URL) return process.env.APP_URL;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    app.get('/api/ping', (req, res) => {
      res.json({ 
        pong: true, 
        time: new Date().toISOString(),
        firebaseReady: !!firestore
      });
    });

    // Patreon Auth URL
    app.get('/api/auth/patreon/url', (req, res) => {
      try {
        const teacherId = req.query.teacherId as string;
        const requestedPlan = (req.query.plan as string) || '';
        const baseUrl = getBaseUrl(req);
        const redirectUri = `${baseUrl}/auth/patreon/callback`;
        
        if (!process.env.PATREON_CLIENT_ID) {
          return res.status(500).json({ error: 'PATREON_CLIENT_ID is not configured' });
        }

        const params = new URLSearchParams({
          response_type: 'code',
          client_id: process.env.PATREON_CLIENT_ID,
          redirect_uri: redirectUri,
          scope: 'identity identity.memberships',
          state: `${teacherId}__${requestedPlan}`,
        });
        res.json({ url: `https://www.patreon.com/oauth2/authorize?${params.toString()}` });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Patreon Callback
    app.get(['/auth/patreon/callback', '/auth/patreon/callback/'], async (req, res) => {
      const { code, state: stateParam } = req.query;

      if (!code || !stateParam) {
        return res.status(400).send('<h1>Error</h1><p>Missing code or state parameters</p>');
      }

      const [teacherId, requestedPlan] = (stateParam as string).split('__');

      if (!teacherId) {
        return res.status(400).send('<h1>Error</h1><p>Invalid teacher ID in state payload</p>');
      }

      if (!firestore) {
        // Retry initialization once if it failed at startup
        try {
          const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
          console.log(`Retrying Firebase configuration at: ${configPath}`);
          if (fs.existsSync(configPath)) {
            const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (admin.apps.length === 0) {
              admin.initializeApp({ projectId: firebaseConfig.projectId });
            }
            const dbId = firebaseConfig.firestoreDatabaseId;
            console.log(`Retry init with databaseId: ${dbId || '(default)'}`);
            firestore = dbId ? getFirestore(dbId) : getFirestore();
          } else {
            console.warn('Retry failed: firebase-applet-config.json not found');
          }
        } catch (e) {
             console.error('Retry init failed with error:', e);
        }
        
        if (!firestore) {
          return res.status(500).send('<h1>Error</h1><p>Base de datos no inicializada. Por favor, contacta con soporte.</p>');
        }
      }

      try {
        const baseUrl = getBaseUrl(req);
        const redirectUri = `${baseUrl}/auth/patreon/callback`;
        
        // 1. Exchange code for tokens
        const tokenResponse = await axios.post('https://www.patreon.com/api/oauth2/token', new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          client_id: process.env.PATREON_CLIENT_ID!,
          client_secret: process.env.PATREON_CLIENT_SECRET!,
          redirect_uri: redirectUri,
        }).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token } = tokenResponse.data;

        // 2. Get user info and memberships
        const userResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields[tier]=title', {
          headers: { Authorization: `Bearer ${access_token}` }
        });

        const patreonData = userResponse.data;
        
        let plan: 'free' | 'pro' | 'premium' = 'free';
        
        const tiers = patreonData.included?.filter((inc: any) => inc.type === 'tier') || [];
        const tierTitles = tiers.map((t: any) => (t.attributes.title || '').toLowerCase());

        const proTitle = (process.env.PATREON_PRO_TIER_TITLE || 'Profesional').toLowerCase();
        const premiumTitle = (process.env.PATREON_PREMIUM_TIER_TITLE || 'Premium').toLowerCase();

        if (tierTitles.includes(premiumTitle)) {
          plan = 'premium';
        } else if (tierTitles.includes(proTitle)) {
          plan = 'pro';
        }

        // --- DEVELOPMENT / UI EXPERITMENT OVERRIDE ---
        // If the user clicked a specific plan to upgrade in the UI, we grant that plan.
        if (requestedPlan === 'premium' || requestedPlan === 'pro' || requestedPlan === 'free') {
          plan = requestedPlan as 'premium' | 'pro' | 'free';
        }
        // --------------------------------------------

        // 3. Update Firestore
        const teacherRef = firestore.collection('teachers').doc(teacherId as string);
        await teacherRef.update({
          plan,
          subscriptionStatus: 'active',
          patreonId: patreonData.data.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.send(`
          <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
              <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <h1 style="color: #0f172a; font-size: 1.5rem; margin-bottom: 1rem;">¡Conexión Exitosa!</h1>
                <p style="color: #64748b;">Tu plan ha sido actualizado a: <strong>${plan.toUpperCase()}</strong></p>
                <p style="color: #94a3b8; font-size: 0.875rem;">Esta ventana se cerrará en breve...</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', plan: '${plan}' }, '*');
                    setTimeout(() => window.close(), 2000);
                  } else {
                    window.location.href = '/settings';
                  }
                </script>
              </div>
            </body>
          </html>
        `);

      } catch (error: any) {
        console.error('Patreon Auth Error:', error.response?.data || error.message);
        res.status(500).send('Error vinculando Patreon. Por favor, inténtalo de nuevo.');
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
