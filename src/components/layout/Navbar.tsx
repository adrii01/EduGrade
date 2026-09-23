import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Button, buttonVariants } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Bell, Settings, User as UserIcon, Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import UserSettings from './UserSettings';
import { useTheme } from '@/src/context/ThemeContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import Logo from './Logo';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const { classId } = useParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handleOpenSettings = () => {
      setSettingsOpen(true);
    };
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(
      collection(db, 'notifications'), 
      where('teacherId', '==', user.uid),
      where('read', '==', false)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const photoURL = profile?.preferences?.photoURL;

  return (
    <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50 border-border transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="transition-all duration-300 active:scale-95">
          <Logo />
        </Link>

        {user && (
          <div className="flex items-center gap-1 sm:gap-2">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-2.5 sm:px-3 h-11 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
            >
              <LayoutDashboard className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline font-bold">Clases</span>
            </Button>

            <Button 
              variant="ghost" 
              onClick={() => navigate('/reminders')}
              className="flex items-center gap-2 px-2.5 sm:px-3 h-11 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
            >
              <div className="relative flex items-center justify-center">
                <Bell className="w-5 h-5 sm:w-4 sm:h-4" />
                {unreadCount > 0 && (
                  <Badge 
                    className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center p-0 text-[10px] bg-red-600 text-white border border-background shadow-sm animate-in zoom-in duration-300"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <span className="hidden sm:inline font-bold">Recordatorios</span>
            </Button>
            
            <div className="h-4 w-[1px] bg-border mx-1 sm:mx-2" />
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-muted p-1.5 rounded-2xl transition-all border border-transparent hover:border-border cursor-pointer outline-none">
                <div className="text-right hidden md:block relative">
                  <p className="text-xs font-semibold text-foreground">{user.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">{user.email}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-muted border-2 border-border shadow-sm overflow-hidden flex items-center justify-center">
                  {photoURL ? (
                    <img src={photoURL} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-3xl p-2 bg-popover border-border shadow-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-display">Mi Cuenta</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                  className="rounded-xl gap-2 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Moon className="w-4 h-4 text-indigo-500" />
                    )}
                    <span>Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold py-0.5 px-2 bg-muted text-muted-foreground border-border">
                    {theme === 'dark' ? 'Oscuro' : 'Claro'}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSettingsOpen(true)} 
                  className="rounded-xl gap-2 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  Ajustes de Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="rounded-xl gap-2 text-red-600 focus:text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <UserSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </nav>
  );
}
