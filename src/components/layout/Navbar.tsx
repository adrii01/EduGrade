import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Bell, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { classId } = useParams();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    // Count notifications that are for the teacher and not read
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

  return (
    <nav className="border-b bg-white/40 backdrop-blur-md sticky top-0 z-50 border-white/20">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-slate-900 underline underline-offset-4 decoration-indigo-500 hidden sm:inline">EduGrade</span>
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
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-medium">{user.displayName}</p>
                <p className="text-[10px] text-muted-foreground">{user.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
