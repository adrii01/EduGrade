import React, { useState } from 'react';
import { KeyRound, ShieldCheck, CheckCircle2, Sparkles, ArrowRight, LogOut, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/src/context/AuthContext';
import { toast } from 'sonner';

export default function LicenseActivationGate() {
  const { user, activateLicense, logout } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);

  const formatKey = (value: string) => {
    // Keep only alphanumeric characters and uppercase
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Auto-insert dashes: EDUG-XXXX-XXXX-XXXX
    let formatted = '';
    for (let i = 0; i < cleaned.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) formatted += '-';
      formatted += cleaned[i];
    }
    return formatted;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseKey(formatKey(e.target.value));
  };

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!licenseKey.trim()) {
      toast.error('Por favor, introduce tu clave de licencia');
      return;
    }

    try {
      setLoading(true);
      await activateLicense(licenseKey.trim());
      toast.success('¡Licencia vitalicia activada con éxito! Bienvenido a EduGrade.');
    } catch (err: any) {
      toast.error(err.message || 'Error al activar la licencia. Comprueba el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemoKey = () => {
    setLicenseKey('EDUG-DEMO-TEST-KEY1');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-muted/20 relative">
      <div className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-3xl p-6 sm:p-10 space-y-8 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none -z-0"></div>

        <div className="relative z-10 text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Activación de Licencia Vitalicia
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Bienvenido, <strong>{user?.displayName || user?.email}</strong>. Introduce la clave de licencia que recibiste al comprar EduGrade para habilitar tu acceso permanente.
          </p>
        </div>

        <form onSubmit={handleActivate} className="relative z-10 space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Clave de Licencia Personal
            </label>
            <div className="relative">
              <Input
                type="text"
                value={licenseKey}
                onChange={handleInputChange}
                placeholder="EDUG-XXXX-XXXX-XXXX"
                className="h-13 text-center text-base sm:text-lg font-mono font-bold tracking-widest uppercase rounded-2xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
                maxLength={19}
                disabled={loading}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Formato: 16 caracteres alfanuméricos agrupados en bloques de cuatro.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading || !licenseKey.trim()}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-95 transition-all gap-2"
          >
            {loading ? (
              'Verificando y vinculando...'
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Activar Mi Licencia
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>

          {/* Quick Demo Key Helper */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleUseDemoKey}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
            >
              <Sparkles className="w-3.5 h-3.5" />
              ¿Estás probando la app? Cargar clave de prueba rápida
            </button>
          </div>
        </form>

        <div className="relative z-10 border-t border-border pt-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Pago único de por vida</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Hasta 2 dispositivos autorizados</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Sin cuotas mensuales</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Protección y privacidad RGPD</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex justify-between items-center text-xs text-muted-foreground pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="rounded-xl text-muted-foreground hover:text-foreground h-9 gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión / Cambiar cuenta
          </Button>

          <span className="text-[11px] opacity-70">
            Soporte: adriker01@gmail.com
          </span>
        </div>
      </div>
    </div>
  );
}
