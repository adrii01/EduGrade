import React, { useState } from 'react';
import { Laptop, Smartphone, AlertTriangle, Trash2, LogOut, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeviceInfo } from '@/src/types';
import { toast } from 'sonner';

interface DeviceLimitModalProps {
  open: boolean;
  devices: DeviceInfo[];
  onRevokeAndContinue: (deviceId: string) => Promise<void>;
  onLogout: () => void;
}

export default function DeviceLimitModal({
  open,
  devices,
  onRevokeAndContinue,
  onLogout,
}: DeviceLimitModalProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (!open) return null;

  const handleRevoke = async (deviceId: string) => {
    try {
      setRevokingId(deviceId);
      await onRevokeAndContinue(deviceId);
      toast.success('Dispositivo desvinculado con éxito. Autorizando este equipo...');
    } catch (err: any) {
      toast.error(err.message || 'Error al desvincular dispositivo');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-amber-500/30 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Límite de Dispositivos Alcanzado
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Tu licencia de pago único permite un máximo de <strong>2 dispositivos autorizados</strong> (por ejemplo: el PC del aula y tu portátil personal).
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dispositivos actualmente vinculados:
          </p>
          <div className="space-y-2">
            {devices.map((device) => {
              const isPhone = device.os === 'Android' || device.os === 'iOS';
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-muted-foreground border border-border/70">
                      {isPhone ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-foreground">{device.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Última actividad: {new Date(device.lastActive).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revokingId !== null}
                    onClick={() => handleRevoke(device.id)}
                    className="rounded-xl text-destructive hover:bg-destructive/10 text-xs font-medium h-9 px-3 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {revokingId === device.id ? 'Liberando...' : 'Reemplazar'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-primary/5 rounded-2xl border border-primary/10 text-xs text-muted-foreground text-center">
          Haz clic en <strong>Reemplazar</strong> en el dispositivo que ya no vayas a utilizar para transferir la autorización a este equipo.
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onLogout}
            className="rounded-xl h-10 font-medium text-xs text-muted-foreground w-full sm:w-auto"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
