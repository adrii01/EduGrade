import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '@/src/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { getClientDevice, getStoredSessionToken, setStoredSessionToken, clearStoredSessionToken } from '@/src/lib/deviceFingerprint';
import { DeviceInfo } from '@/src/types';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isLicenseActive: boolean;
  isOwner: boolean;
  activeDevices: DeviceInfo[];
  deviceLimitExceeded: boolean;
  limitDevicesList: DeviceInfo[];
  concurrentSessionDetected: boolean;
  reconnecting: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  activateLicense: (key: string) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  reconnectSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLicenseActive, setIsLicenseActive] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [activeDevices, setActiveDevices] = useState<DeviceInfo[]>([]);
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false);
  const [limitDevicesList, setLimitDevicesList] = useState<DeviceInfo[]>([]);
  const [concurrentSessionDetected, setConcurrentSessionDetected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const currentSessionTokenRef = useRef<string | null>(getStoredSessionToken());

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let globalSyncUnsubs: (() => void)[] = [];
    let heartbeatInterval: any = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        const device = getClientDevice();

        // 1. Initial server-side session & device authorization check
        try {
          const res = await fetch('/api/session/check-or-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teacherId: currentUser.uid,
              email: currentUser.email,
              device
            })
          });
          const data = await res.json();
          if (data.valid) {
            setIsLicenseActive(data.licenseActive);
            setIsOwner(!!data.isOwner);
            setActiveDevices(data.devices || []);
            setDeviceLimitExceeded(false);
            if (data.licenseKey) {
              setProfile((prev: any) => ({
                ...(prev || {}),
                licenseKey: data.licenseKey,
                licenseActive: data.licenseActive,
              }));
            }
            if (data.sessionToken) {
              currentSessionTokenRef.current = data.sessionToken;
              setStoredSessionToken(data.sessionToken);
            }
          } else if (data.reason === 'DEVICE_LIMIT_EXCEEDED') {
            setIsLicenseActive(true);
            setDeviceLimitExceeded(true);
            setLimitDevicesList(data.activeDevices || []);
          } else {
            setIsLicenseActive(false);
            setIsOwner(false);
          }
        } catch (err) {
          console.error('Session check network error:', err);
        }

        try {
          // Real-time listener for profile updates and session tokens
          unsubscribeProfile = onSnapshot(teacherRef, async (snapshot: any) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              setProfile((prev: any) => ({
                ...data,
                licenseKey: data.licenseKey || prev?.licenseKey,
                licenseActive: data.licenseActive !== undefined ? data.licenseActive : prev?.licenseActive,
              }));
              if (data.licenseActive) {
                setIsLicenseActive(true);
              }
              if (data.activeDevices) {
                setActiveDevices(data.activeDevices);
              }

              // Anti-sharing detection: If server has a newer session token from another login, flag concurrent session
              if (
                currentSessionTokenRef.current && 
                data.activeSessionToken && 
                data.activeSessionToken !== currentSessionTokenRef.current
              ) {
                setConcurrentSessionDetected(true);
              }
            } else if (!snapshot.metadata.fromCache) {
              // Create initial profile for new teachers
              const initialData = {
                uid: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName || 'Profesor',
                createdAt: serverTimestamp(),
                preferences: {
                  theme: 'light',
                  photoURL: currentUser.photoURL || ''
                }
              };
              setDoc(teacherRef, initialData).catch(err => console.error("Error creating teacher doc", err));
            }
          });

          // Global Sync for Offline Mode
          const colsToSync = ['classes', 'students', 'attendance', 'assessments', 'grades', 'notifications'];
          globalSyncUnsubs = colsToSync.map(colName => {
            const q = query(collection(db, colName), where('teacherId', '==', currentUser.uid));
            return onSnapshot(q, () => {});
          });

          // Periodic Heartbeat check every 25 seconds
          heartbeatInterval = setInterval(async () => {
            if (currentSessionTokenRef.current && !concurrentSessionDetected) {
              try {
                const hbRes = await fetch('/api/session/heartbeat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    teacherId: currentUser.uid,
                    sessionToken: currentSessionTokenRef.current,
                    deviceId: device.id
                  })
                });
                const hbData = await hbRes.json();
                if (hbData.valid === false && hbData.reason === 'CONCURRENT_SESSION_DETECTED') {
                  setConcurrentSessionDetected(true);
                }
              } catch (e) {
                // Ignore transient network hiccups in heartbeat
              }
            }
          }, 25000);

        } catch (error) {
          console.error("Error setting up teacher sync:", error);
        }
      } else {
        setProfile(null);
        setIsLicenseActive(false);
        setIsOwner(false);
        setActiveDevices([]);
        setDeviceLimitExceeded(false);
        setConcurrentSessionDetected(false);
        currentSessionTokenRef.current = null;
        clearStoredSessionToken();

        if (unsubscribeProfile) unsubscribeProfile();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        globalSyncUnsubs.forEach(unsub => unsub());
        globalSyncUnsubs = [];
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      globalSyncUnsubs.forEach(unsub => unsub());
    };
  }, []);

  const activateLicense = async (key: string) => {
    if (!user) throw new Error('Debes iniciar sesión primero');
    const device = getClientDevice();
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: user.uid,
        email: user.email,
        licenseKey: key,
        device
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Error al activar la licencia');
    }
    currentSessionTokenRef.current = data.sessionToken;
    setStoredSessionToken(data.sessionToken);
    setIsLicenseActive(true);
    setConcurrentSessionDetected(false);
    setDeviceLimitExceeded(false);
    if (data.devices) {
      setActiveDevices(data.devices);
    }
    const cleanKey = data.licenseKey || key;
    setProfile((prev: any) => ({
      ...(prev || {}),
      licenseKey: cleanKey,
      licenseActive: true,
    }));
  };

  const revokeDevice = async (deviceId: string) => {
    if (!user) return;
    const res = await fetch('/api/devices/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: user.uid,
        deviceIdToRevoke: deviceId
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Error al desvincular dispositivo');
    }
    setActiveDevices(data.devices || []);
    // If we were blocked by device limit, re-assert registration on this device
    if (deviceLimitExceeded) {
      await reconnectSession();
    }
  };

  const reconnectSession = async () => {
    if (!user) return;
    setReconnecting(true);
    try {
      const device = getClientDevice();
      const res = await fetch('/api/session/check-or-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: user.uid,
          email: user.email,
          device
        })
      });
      const data = await res.json();
      if (data.valid && data.sessionToken) {
        currentSessionTokenRef.current = data.sessionToken;
        setStoredSessionToken(data.sessionToken);
        setConcurrentSessionDetected(false);
        setDeviceLimitExceeded(false);
        setIsLicenseActive(data.licenseActive);
        if (data.devices) setActiveDevices(data.devices);
        if (data.licenseKey) {
          setProfile((prev: any) => ({
            ...(prev || {}),
            licenseKey: data.licenseKey,
            licenseActive: data.licenseActive,
          }));
        }
      } else if (data.reason === 'DEVICE_LIMIT_EXCEEDED') {
        setDeviceLimitExceeded(true);
        setLimitDevicesList(data.activeDevices || []);
      }
    } catch (err) {
      console.error('Error reconnecting session:', err);
    } finally {
      setReconnecting(false);
    }
  };

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    const teacherRef = doc(db, 'teachers', userCredential.user.uid);
    await setDoc(teacherRef, {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      name: name || 'Profesor',
      createdAt: serverTimestamp(),
      preferences: {
        theme: 'light',
        photoURL: ''
      }
    }, { merge: true });
  };

  const logout = async () => {
    currentSessionTokenRef.current = null;
    clearStoredSessionToken();
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isLicenseActive,
      isOwner,
      activeDevices,
      deviceLimitExceeded,
      limitDevicesList,
      concurrentSessionDetected,
      reconnecting,
      signIn, 
      signInWithEmail, 
      signUpWithEmail, 
      activateLicense,
      revokeDevice,
      reconnectSession,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

