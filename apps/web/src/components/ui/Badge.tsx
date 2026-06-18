import clsx from 'clsx';

export type Variant = 'green' | 'red' | 'amber' | 'blue' | 'gray';

const DOT_COLORS: Record<Variant, string> = {
  green: 'bg-[var(--success)]',
  red:   'bg-[var(--danger)]',
  amber: 'bg-[var(--warning)]',
  blue:  'bg-blue-500',
  gray:  'bg-[var(--text-2)]',
};

const LABEL_COLOR = 'text-[var(--text-1)]';

interface BadgeProps {
  label: string;
  variant?: Variant;
  className?: string;
}

export function Badge({ label, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5',
        className
      )}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          DOT_COLORS[variant]
        )}
      />
      <span className={clsx('text-xs font-medium font-sans', LABEL_COLOR)}>
        {label}
      </span>
    </span>
  );
}

export function loanStatusBadge(statusId: number) {
  const map: Record<number, { label: string; variant: Variant }> = {
    100: { label: 'Submitted',   variant: 'gray'  },
    200: { label: 'Approved',    variant: 'blue'  },
    300: { label: 'Active',      variant: 'green' },
    400: { label: 'Withdrawn',   variant: 'gray'  },
    500: { label: 'Rejected',    variant: 'red'   },
    600: { label: 'Closed',      variant: 'gray'  },
    700: { label: 'Written Off', variant: 'red'   },
    800: { label: 'Rescheduled', variant: 'amber' },
    900: { label: 'Overpaid',    variant: 'amber' },
  };
  const s = map[statusId] ?? { label: `Status ${statusId}`, variant: 'gray' as Variant };
  return <Badge label={s.label} variant={s.variant} />;
}
