import { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

export function useTutorial(tutorialKey: string) {
  const { user, profile } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    // Check if tutorial is seen in profile
    const tutorialsSeen = profile.preferences?.tutorialsSeen || {};
    if (!tutorialsSeen[tutorialKey]) {
      setShowTutorial(true);
    }
  }, [profile, tutorialKey]);

  const closeTutorial = async (arg?: any) => {
    setShowTutorial(false);
    if (!user) return;
    
    try {
      const teacherRef = doc(db, 'teachers', user.uid);
      const currentPreferences = profile?.preferences || {};
      const currentTutorialsSeen = currentPreferences.tutorialsSeen || {};
      
      await updateDoc(teacherRef, {
        preferences: {
          ...currentPreferences,
          tutorialsSeen: {
            ...currentTutorialsSeen,
            [tutorialKey]: true
          }
        }
      });
    } catch (e) {
      console.error('Error saving tutorial state:', e);
    }
  };

  const openTutorial = (arg?: any) => setShowTutorial(true);

  return { showTutorial, closeTutorial, openTutorial };
}
