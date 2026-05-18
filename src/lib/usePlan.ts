import { useAuth } from '@/src/context/AuthContext';
import { Teacher } from '@/src/types';

export type PlanType = 'free' | 'pro' | 'premium';

export interface PlanLimits {
  classLimit: number;
  hasReminders: boolean;
  hasGlobalAnalysis: boolean;
  hasIndividualAnalysis: boolean;
  hasExport: boolean;
}

const PLAN_CONFIG: Record<PlanType, PlanLimits> = {
  free: {
    classLimit: 2,
    hasReminders: false,
    hasGlobalAnalysis: false,
    hasIndividualAnalysis: false,
    hasExport: false,
  },
  pro: {
    classLimit: 10,
    hasReminders: true,
    hasGlobalAnalysis: true,
    hasIndividualAnalysis: false,
    hasExport: true,
  },
  premium: {
    classLimit: Infinity,
    hasReminders: true,
    hasGlobalAnalysis: true,
    hasIndividualAnalysis: true,
    hasExport: true,
  },
};

export const usePlan = () => {
  const { profile } = useAuth();
  const teacher = profile as Teacher | null;
  const currentPlan: PlanType = (teacher?.plan as PlanType) || 'free';

  const limits = PLAN_CONFIG[currentPlan];

  return {
    plan: currentPlan,
    limits,
    isFree: currentPlan === 'free',
    isPro: currentPlan === 'pro',
    isPremium: currentPlan === 'premium',
  };
};
