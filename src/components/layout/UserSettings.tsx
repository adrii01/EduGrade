import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User as UserIcon, 
  Image as ImageIcon,
  Moon,
  Sun
} from 'lucide-react';
import { toast } from 'sonner';

interface UserSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AVATARS = [
  // Chicas (15)
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Aria',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Bella',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Chloe',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Daisy',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Elena',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Flora',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Gaia',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Hazel',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Iris',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Jasmine',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Kira',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Luna',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Mia',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Nora',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Olive',
  
  // Chicos (15)
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Alex',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Ben',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Casper',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=David',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Evan',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=George',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Hugo',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Ivan',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Jack',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Kevin',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Leo',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Max',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Noah',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Oscar',

  // Animales y otros (10)
  'https://robohash.org/cat1?set=set4',
  'https://robohash.org/cat2?set=set4',
  'https://robohash.org/cat3?set=set4',
  'https://robohash.org/cat4?set=set4',
  'https://robohash.org/cat5?set=set4',
  'https://api.dicebear.com/9.x/big-smile/svg?seed=Bear',
  'https://api.dicebear.com/9.x/big-smile/svg?seed=Lion',
  'https://api.dicebear.com/9.x/big-smile/svg?seed=Panda',
  'https://api.dicebear.com/9.x/big-smile/svg?seed=Tiger',
  'https://api.dicebear.com/9.x/big-smile/svg?seed=Koala',
];

export default function UserSettings({ open, onOpenChange }: UserSettingsProps) {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [photoURL, setPhotoURL] = useState(profile?.preferences?.photoURL || user?.photoURL || '');
  const [saving, setSaving] = useState(false);

  // Update internal state when profile changes (e.g. initial load)
  React.useEffect(() => {
    if (profile?.preferences?.photoURL) {
      setPhotoURL(profile.preferences.photoURL);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'teachers', user.uid), {
        'preferences.photoURL': photoURL
      });
      toast.success('Perfil actualizado correctamente');
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl bg-popover border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display text-foreground">
            <UserIcon className="w-5 h-5 text-primary" />
            Privacidad y Ajustes
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Personaliza tu apariencia en la plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-6">
          {/* Theme Section */}
          <section className="space-y-4">
            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Apariencia</Label>
            
            <div className="flex gap-4">
               <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 ${
                    theme === 'light' 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  }`}
               >
                 <Sun className="w-6 h-6" />
                 <span className="text-xs font-bold font-sans">Claro</span>
               </button>
               <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 ${
                    theme === 'dark' 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  }`}
               >
                 <Moon className="w-6 h-6" />
                 <span className="text-xs font-bold font-sans">Oscuro</span>
               </button>
            </div>
          </section>

          {/* Profile Photo Section */}
          <section className="space-y-4">
            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Foto de Perfil</Label>
            
            <div className="flex flex-wrap gap-4 items-center">
              <div className="w-16 h-16 rounded-2xl bg-muted border-2 border-border overflow-hidden shrink-0">
                <img 
                    src={photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.displayName}`} 
                    className="w-full h-full object-cover" 
                    alt="Preview" 
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 py-1">
                        {PRESET_AVATARS.map((url, i) => (
                            <button
                                key={i}
                                onClick={() => setPhotoURL(url)}
                                className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${photoURL === url ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-border hover:border-primary/40'}`}
                            >
                                <img src={url} className="w-full h-full" alt={`Avatar ${i}`} />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="O pega URL de imagen..." 
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        className="pl-9 h-9 rounded-xl text-xs border-border bg-background text-foreground"
                    />
                </div>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border hover:bg-muted text-foreground">Cancelar</Button>
          <Button 
            disabled={saving}
            onClick={handleSaveProfile}
            className="rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all gap-2 px-8 min-w-[120px]"
          >
            {saving ? 'Guardando...' : 'Guardar Perfil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
