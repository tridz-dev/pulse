import * as React from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & { children: React.ReactNode }) {
  return (
    <div
      className={cn('animate-in fade-in duration-500 flex flex-col gap-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        action ? 'sm:items-center' : '',
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-sans font-bold text-[26px] md:text-[34px] tracking-tight leading-none text-text">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12.5px] text-mute">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-slab border border-rule rounded-[var(--radius)] overflow-hidden',
        className
      )}
      {...props}
    >
      {title && (
        <>
          <div className="px-4 py-4">
            <span className="font-mono font-semibold text-[14.5px] uppercase tracking-[0.09em] text-faint">
              {title}
            </span>
          </div>
          <div className="border-t border-rule" />
        </>
      )}
      <div className="px-4 py-4">
        {children}
      </div>
    </div>
  );
}
