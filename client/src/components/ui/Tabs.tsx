import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

/** Accessible, horizontally scrollable tab bar. */
export const Tabs = ({ tabs, active, onChange, className, ariaLabel = 'Sections' }: TabsProps) => (
  <div className={cn('no-scrollbar -mx-1 overflow-x-auto', className)} role="tablist" aria-label={ariaLabel}>
    <div className="flex min-w-max items-center gap-1 px-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              isActive ? 'bg-primary text-primary-fg shadow-card' : 'text-muted hover:bg-primary-soft/70 hover:text-ink',
            )}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-2xs font-semibold', isActive ? 'bg-white/20 text-primary-fg' : 'bg-elevated text-muted')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default Tabs;
