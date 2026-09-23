import React from 'react';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConcurrentSessionModalProps {
  open: boolean;
  onReconnect: () => void;
  onLogout: () => void;
  reconnecting?: boolean;
}

export default function ConcurrentSessionModal({
  open,
  onReconnect,
  onLogout,
  reconnecting = false,
}: ConcurrentSessionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-destructive/30 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Sesión iniciada en otro equipo
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Se ha detectado un nuevo inicio de sesión con tu cuenta desde otro navegador o dispositivo.
          </p>
        </div>

        <div className="bg-muted/50 rounded-2xl p-4 text-xs text-muted-foreground text-left space-y-2 border border-border/50">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            Política de Licencia Personal y Privacidad
          </div>
          <p>
            Por cumplimiento de la normativa de protección de datos (RGPD) y seguridad del alumnado, las licencias son <strong>personales e intransferibles</strong> y no permiten el uso simultáneo entre varios usuarios.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onLogout}
            className="flex-1 rounded-xl h-11 border-border font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
          <Button
            onClick={onReconnect}
            disabled={reconnecting}
            className="flex-1 rounded-xl h-11 bg-primary text-primary-foreground font-semibold shadow-md hover:opacity-95"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${reconnecting ? 'animate-spin' : ''}`} />
            {reconnecting ? 'Reconectando...' : 'Reconectar Aquí'}
          </Button>
        </div>
      </div>
    </div>
  );
}
