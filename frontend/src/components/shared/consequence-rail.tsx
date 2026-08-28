import React from 'react';
import { cn } from '@/lib/utils';
import { SectionCard } from './page-shell';

interface ConsequenceCard {
  key: string;
  title?: React.ReactNode;
  children: React.ReactNode;
}

interface ConsequenceRailProps extends React.ComponentProps<'aside'> {
  cards: ConsequenceCard[];
  footerText?: React.ReactNode;
  footerActions?: React.ReactNode[];
  className?: string;
}

export function ConsequenceRail({
  cards,
  footerText,
  footerActions,
  className,
  ...props
}: ConsequenceRailProps) {
  return (
    <aside
      className={cn(
        'border-l border-rule bg-slab w-[330px] flex flex-col overflow-y-auto',
        className
      )}
      {...props}
    >
      <div className="px-[18px] py-5 gap-3 flex flex-col flex-1">
        {cards.map((card) => (
          <SectionCard key={card.key} title={card.title}>
            {card.children}
          </SectionCard>
        ))}
      </div>

      <div className="sticky bottom-0 border-t border-rule bg-slab px-[18px] py-3 flex flex-col gap-2">
        {footerText && (
          <p className="text-[11.5px] text-mute">
            {footerText}
          </p>
        )}
        {footerActions && footerActions.length > 0 && (
          <div className="flex gap-2">
            {footerActions.map((action, idx) => (
              <div key={idx} className="flex-1">
                {action}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
