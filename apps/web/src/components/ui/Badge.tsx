import clsx from 'clsx';

type Variant = 'green' | 'red' | 'amber' | 'blue' | 'gray';

const VARIANTS: Record<Variant, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red:   'bg-red-50   text-red-700   ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue:  'bg-blue-50  text-blue-700  ring-blue-200',
  gray:  'bg-gray-100 text-gray-600  ring-gray-200',
};

interface BadgeProps {
  label: string;
  variant?: Variant;
  className?: string;
}

export function Badge({ label, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        VARIANTS[variant],
        className
      )}
    >
      {label}
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
