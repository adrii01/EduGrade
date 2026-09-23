import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Sparkles, 
  Shield, 
  Layers, 
  RefreshCw,
  Clock,
  UserCheck
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/src/context/AuthContext';
import { toast } from 'sonner';

interface AdminLicenseGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminLicenseGeneratorModal({
  open,
  onOpenChange
}: AdminLicenseGeneratorModalProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState('Venta Directa');
  const [loading, setLoading] = useState(false);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchLicenses = async () => {
    if (!user?.email) return;
    try {
      setLoadingList(true);
      const res = await fetch(`/api/license/list-keys?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data.success) {
        setLicenses(data.licenses || []);
      }
    } catch (err) {
      console.error('Error fetching licenses:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLicenses();
    }
  }, [open, user?.email]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    try {
      setLoading(true);
      const res = await fetch('/api/license/generate-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherEmail: user.email,
          count: Number(count),
          label: label.trim() || 'Venta Directa'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`¡${data.keys.length} clave(s) generada(s) con éxito!`);
        fetchLicenses();
      } else {
        toast.error(data.error || 'Error al generar claves');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error en la petición');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success('Clave copiada al portapapeles');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border p-6 rounded-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="space-y-1 pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Shield className="w-5 h-5" />
            Panel del Creador / Administrador
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Generador de Claves de Licencia
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Crea claves de activación de un solo uso para nuevos compradores y controla el estado de cada licencia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 py-4 pr-1">
          {/* Generation form */}
          <form onSubmit={handleGenerate} className="p-4 bg-muted/40 rounded-2xl border border-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              Generar Nuevas Claves
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Etiqueta / Referencia</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej: Alumno Pedro / Venta Gumroad"
                  className="rounded-xl h-10 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cantidad de claves</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="rounded-xl h-10 text-xs bg-background w-24"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl h-10 text-xs font-bold bg-primary text-primary-foreground gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {loading ? 'Generando...' : 'Crear Claves'}
                  </Button>
                </div>
              </div>
            </div>
          </form>

          {/* Licenses list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Layers className="w-4 h-4 text-muted-foreground" />
                Historial de Licencias ({licenses.length})
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLicenses}
                disabled={loadingList}
                className="h-8 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {licenses.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No hay claves registradas todavía.
                </div>
              ) : (
                licenses.map((lic) => (
                  <div
                    key={lic.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-card border border-border/70 gap-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold tracking-wider text-foreground">
                          {lic.key}
                        </span>
                        {lic.claimed ? (
                          <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
                            <UserCheck className="w-3 h-3 mr-1" />
                            Canjeada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/30 font-medium">
                            Disponible
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {lic.label || 'Venta'} {lic.claimed && lic.claimedByEmail ? `• Vinculada a: ${lic.claimedByEmail}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(lic.key)}
                        className="h-8 rounded-xl px-2.5 text-xs gap-1.5 border-border hover:bg-primary/5"
                      >
                        {copiedKey === lic.key ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Copiada
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
