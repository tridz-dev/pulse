import React from 'react';
import { cn } from '@/lib/utils';

interface ImpactStripProps extends React.ComponentProps<'div'> {
  impactCount: number;
  impactLabel: React.ReactNode;
  deltaDisplay: React.ReactNode;
  deltaLabel?: React.ReactNode;
  message: React.ReactNode;
  className?: string;
}

export function ImpactStrip({
  impactCount,
  impactLabel,
  deltaDisplay,
  deltaLabel,
  message,
  className,
  ...props
}: ImpactStripProps) {
  return (
    <div
      className={cn(
        'border-l-[2px] border-l-waive bg-slab border border-rule rounded-[var(--radius)] p-[14px] gap-[22px] flex items-center flex-wrap',
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <div className="font-mono text-[30px] font-bold tabular-nums text-text">
          {impactCount}
        </div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint">
          {impactLabel}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="font-mono text-[30px] font-bold tabular-nums text-text">
          {deltaDisplay}
        </div>
        {deltaLabel && (
          <div className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint">
            {deltaLabel}
          </div>
        )}
      </div>

      <p className="text-[12.5px] text-mute flex-1 min-w-[250px]">
        {message}
      </p>
    </div>
  );
}
