import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, LayoutGrid, BarChart3, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: 'free' | 'pro' | 'premium';
  name: string;
  price: string;
  icon: React.ReactNode;
  features: string[];
  limitations?: string[];
  accent: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: '0€',
    icon: <LayoutGrid className="w-5 h-5" />,
    accent: 'slate',
    features: [
      'Hasta 2 clases',
      'Gestión de alumnos',
      'Calificaciones básicas',
      'Gestión de asistencia del alumnado'
    ],
    limitations: [
      'Sin recordatorios',
      'Sin sección de Análisis',
      'Sin exportación Excel/PDF'
    ]
  },
  {
    id: 'pro',
    name: 'Profesional',
    price: '4.99€', // Suggested Patreon tier price
    icon: <BarChart3 className="w-5 h-5" />,
    accent: 'blue',
    features: [
      'Hasta 4 clases',
      'Análisis global por curso',
      'Exportación en Excel',
      'Soporte estándar'
    ],
    limitations: [
      'Sin recordatorios',
      'Sin análisis individual por alumno'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '9.99€', // Suggested Patreon tier price
    icon: <Crown className="w-5 h-5" />,
    accent: 'amber',
    features: [
      'Clases ilimitadas',
      'Recordatorios ilimitados',
      'Análisis detallado de cada alumno',
      'Exportación Excel y PDF',
      'Soporte prioritario'
    ]
  }
];

export default function SubscriptionPlans() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);

  const currentPlan = profile?.plan || 'free';

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        toast.success(`¡Plan actualizado a ${event.data.plan.toUpperCase()}!`);
        setTimeout(() => window.location.reload(), 1500);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectPatreon = async (planId?: string) => {
    setLoading(true);
    try {
      const planParam = planId && typeof planId === 'string' ? `&plan=${planId}` : '';
      const response = await fetch(`/api/auth/patreon/url?teacherId=${user?.uid}${planParam}`);
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        url,
        'patreon_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (!popup) {
        toast.error('Por favor, permite las ventanas emergentes para conectar con Patreon');
      }
    } catch (err) {
      toast.error('Error al iniciar conexión con Patreon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-primary/5 rounded-[1.5rem] border border-primary/10 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-foreground">Sincronización con Patreon</h3>
          <p className="text-xs text-muted-foreground">Desbloquea funciones avanzadas apoyando el proyecto.</p>
        </div>
        <Button 
          className="rounded-xl bg-[#FF424D] hover:bg-[#FF424D]/90 text-white font-bold gap-2 h-10 px-6 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
          onClick={handleConnectPatreon}
          disabled={loading}
        >
           {loading ? 'Conectando...' : 'Conectar Patreon'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <Card 
              key={plan.id} 
              className={`relative flex flex-col border-2 transition-all duration-500 rounded-[1.5rem] overflow-hidden ${
                  currentPlan === plan.id 
                  ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10 scale-[1.02]' 
                  : 'border-border bg-card'
              }`}
          >
            {currentPlan === plan.id && (
               <div className="absolute top-0 right-0">
                 <div className="bg-primary text-primary-foreground text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-tighter">
                   Activo
                 </div>
               </div>
            )}
            
            <CardHeader className="p-5">
              <div className={`w-9 h-9 rounded-xl bg-${plan.accent}-500/10 flex items-center justify-center text-${plan.accent}-600 mb-3`}>
                {plan.icon}
              </div>
              <CardTitle className="text-lg font-display">{plan.name}</CardTitle>
              <div>
                <span className="text-2xl font-bold tracking-tighter text-foreground">{plan.price}</span>
                <span className="text-[10px] text-muted-foreground ml-1">/mes</span>
              </div>
            </CardHeader>
            
            <CardContent className="p-5 pt-0 flex-1 space-y-4">
              <div className="space-y-2.5">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex gap-2 text-xs font-medium">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 transition-transform group-hover:scale-110" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              {plan.limitations && plan.limitations.length > 0 && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                   {plan.limitations.map((limit, i) => (
                     <div key={i} className="flex gap-2 text-xs text-muted-foreground/60 line-through decoration-muted-foreground/30">
                       <X className="w-3.5 h-3.5 shrink-0" />
                       <span>{limit}</span>
                     </div>
                   ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="p-5 pt-0">
               <Button 
                variant={currentPlan === plan.id ? "secondary" : "outline"}
                disabled={currentPlan === plan.id || loading}
                onClick={() => handleConnectPatreon(plan.id)}
                className="w-full rounded-xl h-9 text-xs font-bold"
               >
                 {currentPlan === plan.id ? 'Tu plan actual' : 'Mejorar ahora'}
               </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      <p className="text-[10px] text-center text-muted-foreground pt-2">
        Los pagos son gestionados de forma segura a través de <span className="font-bold">Patreon</span>.
      </p>
    </div>
  );
}
