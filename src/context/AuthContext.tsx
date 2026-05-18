import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '@/src/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where, getCountFromServer } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let globalSyncUnsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure teacher record exists
        const teacherRef = doc(db, 'teachers', user.uid);
        try {
          // Real-time listener for profile updates
          unsubscribeProfile = onSnapshot(teacherRef, async (snapshot: any) => {
            if (snapshot.exists()) {
              setProfile(snapshot.data());
            } else if (!snapshot.metadata.fromCache) {
                // Check limit before creating
                try {
                  const countSnap = await getCountFromServer(collection(db, 'teachers'));
                  if (countSnap.data().count >= 10) {
                    alert("¡Gracias por tu interés! Hemos alcanzado el cupo máximo de 10 testers para esta versión beta.");
                    await signOut(auth);
                    setLoading(false);
                    return;
                  }
                } catch (e) {
                  console.error("Error checking beta limit", e);
                }

                // If it doesn't exist on server, create it
                const initialData = {
                  uid: user.uid,
                  email: user.email,
                  name: user.displayName || 'Teacher',
                  plan: 'premium',
                  subscriptionStatus: 'active', // For free plan, status is active
                  createdAt: serverTimestamp(),
                  preferences: {
                    theme: 'light',
                    photoURL: user.photoURL || ''
                  }
                };
                setDoc(teacherRef, initialData).catch(err => console.error("Error creating teacher doc", err));
            }
          });

          // Global Sync for Offline Mode: Priming the cache for all of the user's data
          const colsToSync = ['classes', 'students', 'attendance', 'assessments', 'grades', 'notifications'];
          globalSyncUnsubs = colsToSync.map(colName => {
            const q = query(collection(db, colName), where('teacherId', '==', user.uid));
            return onSnapshot(q, () => {}); // We only need it to sync the local cache
          });
        } catch (error) {
          console.error("Error setting up teacher sync:", error);
        }
      } else {
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
        globalSyncUnsubs.forEach(unsub => unsub());
        globalSyncUnsubs = [];
      }
      setUser(user);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      globalSyncUnsubs.forEach(unsub => unsub());
    };
  }, []);

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
    await sendEmailVerification(userCredential.user);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithEmail, signUpWithEmail, logout }}>
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
}
