import React from 'react';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanLockedProps {
  title: string;
  description: string;
  feature?: string;
  onUpgrade?: () => void;
}

export default function PlanLocked({ title, description, feature, onUpgrade }: PlanLockedProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-card/40 backdrop-blur-md border border-dashed border-border rounded-3xl">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 animate-pulse">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-display font-bold text-foreground mb-2 flex items-center gap-2 justify-center">
        {title} 
        {feature && <Crown className="w-5 h-5 text-amber-500" />}
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8 font-medium">
        {description}
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm">
        <Button variant="outline" className="rounded-xl border-border hover:bg-muted" onClick={() => window.location.reload()}>
           Cargar de Nuevo
        </Button>
        <Button className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => {
             const event = new CustomEvent('open-settings', { detail: { section: 'subscription' } });
             window.dispatchEvent(event);
        }}>
           Vincular Patreon
        </Button>
      </div>
    </div>
  );
}
