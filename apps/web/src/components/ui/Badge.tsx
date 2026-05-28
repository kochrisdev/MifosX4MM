type Variant = 'ok' | 'warn' | 'error' | 'draft' | 'info';

const VARIANTS: Record<Variant, React.CSSProperties> = {
  ok:    { background: 'var(--green-50)',  color: 'var(--green)'  },
  warn:  { background: 'var(--amber-50)', color: 'var(--amber)'  },
  error: { background: 'var(--red-50)',   color: 'var(--red)'    },
  draft: { background: 'var(--border-2)', color: 'var(--ink-2)'  },
  info:  { background: 'var(--teal-50)',  color: 'var(--teal)'   },
};

interface BadgeProps {
  label: string;
  variant?: Variant;
}

export function Badge({ label, variant = 'draft' }: BadgeProps) {
  return (
    <span
      style={{
        ...VARIANTS[variant],
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export function loanStatusBadge(statusId: number) {
  const map: Record<number, { label: string; variant: Variant }> = {
    100: { label: 'Submitted',   variant: 'draft' },
    200: { label: 'Approved',    variant: 'info'  },
    300: { label: 'Active',      variant: 'ok'    },
    400: { label: 'Withdrawn',   variant: 'draft' },
    500: { label: 'Rejected',    variant: 'error' },
    600: { label: 'Closed',      variant: 'draft' },
    700: { label: 'Written Off', variant: 'error' },
    800: { label: 'Rescheduled', variant: 'warn'  },
    900: { label: 'Overpaid',    variant: 'warn'  },
  };
  const s = map[statusId] ?? { label: `Status ${statusId}`, variant: 'draft' as Variant };
  return <Badge label={s.label} variant={s.variant} />;
}
