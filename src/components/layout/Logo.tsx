import React from 'react';
import { GraduationCap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  variant?: 'default' | 'inverted';
}

export default function Logo({ className, iconOnly = false, variant = 'default' }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5 group", className)}>
      <div className="relative">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 overflow-hidden", variant === 'inverted' ? "bg-white text-primary shadow-black/20" : "bg-primary shadow-primary/20")}>
          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
          <GraduationCap className={cn("w-6 h-6 relative z-10", variant === 'inverted' ? "text-primary" : "text-primary-foreground")} />
        </div>
      </div>
      
      {!iconOnly && (
        <span className={cn("font-display font-black text-2xl tracking-tighter", variant === 'inverted' ? "text-white" : "text-foreground")}>
          Edu<span className={variant === 'inverted' ? "text-white/70" : "text-primary"}>Grade</span>
        </span>
      )}
    </div>
  );
}
