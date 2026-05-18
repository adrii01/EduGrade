import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  },
};

export const fadeUpItem = {
  hidden: { opacity: 0, y: 30 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20
    }
  },
};

export const scaleInItem = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  },
};

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export function StaggerContainer({ children, className, ...props }: StaggerContainerProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  variant?: 'stagger' | 'fadeUp' | 'scaleIn';
}

export function StaggerItem({ children, className, variant = 'stagger', ...props }: StaggerItemProps) {
  const getVariant = () => {
    switch(variant) {
      case 'fadeUp': return fadeUpItem;
      case 'scaleIn': return scaleInItem;
      default: return staggerItem;
    }
  }

  return (
    <motion.div
      variants={getVariant()}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
