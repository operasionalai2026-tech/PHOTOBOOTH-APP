'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-glow hover:brightness-110',
  secondary: 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 backdrop-blur',
  ghost: 'text-white/80 hover:text-white hover:bg-white/5',
  danger: 'bg-red-500/15 text-red-200 ring-1 ring-red-400/30 hover:bg-red-500/25',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-12 px-5 text-base gap-2 rounded-2xl',
  lg: 'h-14 px-7 text-lg gap-2.5 rounded-2xl',
  xl: 'h-20 px-12 text-2xl gap-3 rounded-3xl',
};

export type ButtonProps = HTMLMotionProps<'button'> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      disabled={disabled}
      className={`inline-flex select-none items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
});
