import React, { useState, useCallback } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/firebase';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/src/lib/imageUtils';
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
import { Slider } from '@/components/ui/slider';
import { 
  User as UserIcon, 
  Image as ImageIcon,
  Moon,
  Sun,
  Upload,
  X,
  RotateCcw,
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';

interface UserSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/9.x/shapes/svg?seed=User1&backgroundColor=f8f9fa',
  'https://api.dicebear.com/9.x/shapes/svg?seed=User2&backgroundColor=f1f3f5',
  'https://api.dicebear.com/9.x/shapes/svg?seed=User3&backgroundColor=e9ecef',
  'https://api.dicebear.com/9.x/shapes/svg?seed=User4&backgroundColor=dee2e6',
  'https://api.dicebear.com/9.x/shapes/svg?seed=User5&backgroundColor=ced4da',
  'https://api.dicebear.com/9.x/shapes/svg?seed=User6&backgroundColor=adb5bd',
];

export default function UserSettings({ open, onOpenChange }: UserSettingsProps) {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [photoURL, setPhotoURL] = useState(profile?.preferences?.photoURL || user?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for cropping
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  // Update internal state when profile changes (e.g. initial load)
  React.useEffect(() => {
    if (profile?.preferences?.photoURL) {
      setPhotoURL(profile.preferences.photoURL);
    }
  }, [profile]);

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageToCrop(base64);
      setShowCropper(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    // Reset file input value so user can upload same file if they cancel
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApplyCrop = async () => {
    try {
      if (imageToCrop && croppedAreaPixels) {
        const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
        setPhotoURL(croppedImage);
        setShowCropper(false);
        setImageToCrop(null);
        toast.success('Imagen ajustada correctamente.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al procesar la imagen.');
    }
  };

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl bg-popover border-border shadow-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display text-foreground">
              <UserIcon className="w-5 h-5 text-primary" />
              Privacidad y Ajustes
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Personaliza tu apariencia en la plataforma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
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
              
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-3xl bg-muted border-2 border-border overflow-hidden shrink-0 shadow-lg">
                      <img 
                          src={photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.displayName}`} 
                          className="w-full h-full object-cover" 
                          alt="Preview" 
                      />
                    </div>
                    {photoURL && (
                      <button 
                        onClick={() => setPhotoURL('')}
                        className="absolute -top-2 -right-2 p-1.5 bg-destructive text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                    <Button 
                      variant="outline" 
                      className="w-full h-11 rounded-2xl border-dashed border-2 hover:border-primary hover:bg-primary/5 gap-2 font-bold text-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      Subir nueva foto
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Formatos: JPG, PNG o WebP. Máximo 5MB mejorado.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-tight">O elige un preset</Label>
                  <div className="flex flex-wrap gap-2">
                      {PRESET_AVATARS.map((url, i) => (
                          <button
                              key={i}
                              onClick={() => setPhotoURL(url)}
                              className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all duration-200 ${photoURL === url ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-border hover:border-primary/40'}`}
                          >
                              <img src={url} className="w-full h-full" alt={`Avatar ${i}`} />
                          </button>
                      ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
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

      {/* Image Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl bg-popover border-border shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Ajustar Imagen</DialogTitle>
            <DialogDescription>
              Arrastra y haz zoom para encuadrar tu foto de perfil.
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full aspect-square bg-muted mt-4">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ZoomIn className="w-4 h-4" />
                  Zoom
                </div>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(val) => setZoom(val[0])}
                className="w-full"
              />
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCropper(false);
                  setImageToCrop(null);
                }} 
                className="rounded-xl flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleApplyCrop}
                className="rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all flex-1 sm:flex-none px-8"
              >
                Aplicar Ajuste
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
