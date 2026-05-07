import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Bell, GraduationCap, Settings, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import UserSettings from './UserSettings';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const { classId } = useParams();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'notifications'), 
      where('teacherId', '==', user.uid),
      where('read', '==', false)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const photoURL = profile?.preferences?.photoURL;

  return (
    <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50 border-border transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 transition-transform duration-300 active:scale-95 hover:scale-105">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-foreground underline underline-offset-4 decoration-primary/30 hidden sm:inline">EduGrade</span>
        </Link>

        {user && (
          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              nativeButton={false}
              render={
                <Link to="/dashboard" className="flex items-center gap-2" />
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Clases</span>
            </Button>

            <Button 
              variant="ghost" 
              nativeButton={false}
              className="relative"
              render={
                <Link to="/reminders" className="flex items-center gap-2" />
              }
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-[10px] bg-red-500 hover:bg-red-600 border-2 border-white"
                >
                  {unreadCount}
                </Badge>
              )}
              <span className="hidden sm:inline">Recordatorios</span>
            </Button>
            <div className="h-4 w-[1px] bg-border mx-1 sm:mx-2" />
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-muted p-1.5 rounded-2xl transition-all border border-transparent hover:border-border cursor-pointer outline-none">
                <div className="text-right hidden md:block text-left">
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
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="rounded-xl gap-2 cursor-pointer">
                  <Settings className="w-4 h-4" />
                  Privacidad y Ajustes
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
