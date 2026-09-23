import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { Toaster } from '@/components/ui/sonner';
import { AnimatePresence, motion } from 'motion/react';
import Landing from '@/src/pages/Landing';
import Dashboard from '@/src/pages/Dashboard';
import ClassDetail from '@/src/pages/ClassDetail';
import Reminders from '@/src/pages/Reminders';
import NotificationManager from '@/src/components/layout/NotificationManager';
import LicenseActivationGate from '@/src/components/license/LicenseActivationGate';
import ConcurrentSessionModal from '@/src/components/license/ConcurrentSessionModal';
import DeviceLimitModal from '@/src/components/license/DeviceLimitModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isLicenseActive } = useAuth();

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!user) return <Navigate to="/" />;

  if (!isLicenseActive) {
    return <LicenseActivationGate />;
  }

  return <>{children}</>;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();
  const { 
    concurrentSessionDetected, 
    reconnectSession, 
    logout, 
    reconnecting,
    deviceLimitExceeded,
    limitDevicesList,
    revokeDevice 
  } = useAuth();

  return (
    <>
      <NotificationManager />
      <ConcurrentSessionModal
        open={concurrentSessionDetected}
        onReconnect={reconnectSession}
        onLogout={logout}
        reconnecting={reconnecting}
      />
      <DeviceLimitModal
        open={deviceLimitExceeded}
        devices={limitDevicesList}
        onRevokeAndContinue={revokeDevice}
        onLogout={logout}
      />
      <AnimatePresence mode="wait">
        <div key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <PageTransition><Dashboard /></PageTransition>
              </ProtectedRoute>
            } />
            <Route path="/class/:classId" element={
              <ProtectedRoute>
                <PageTransition><ClassDetail /></PageTransition>
              </ProtectedRoute>
            } />
            <Route path="/reminders" element={
              <ProtectedRoute>
                <PageTransition><Reminders /></PageTransition>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
          <Toaster position="top-right" />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
