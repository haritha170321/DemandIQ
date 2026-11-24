import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatusTag({
  level,
  label,
}: {
  level: 'HIGH' | 'MEDIUM' | 'LOW' | 'NEUTRAL' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' | 'INSUFFICIENT_DATA';
  label?: string;
}) {
  const styles: Record<string, string> = {
    HIGH: 'bg-red-50 text-red-700 border-red-200',
    OUT_OF_STOCK: 'bg-red-50 text-red-700 border-red-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
    LOW_STOCK: 'bg-amber-50 text-amber-800 border-amber-200',
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IN_STOCK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    INSUFFICIENT_DATA: 'bg-slate-100 text-slate-700 border-slate-200',
    NEUTRAL: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const display = label ?? level.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${
        styles[level] ?? styles.NEUTRAL
      }`}
    >
      {display}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  subtext,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  const toneText = {
    default: 'text-slate-900',
    primary: 'text-[#2563EB]',
    success: 'text-[#16A34A]',
    warning: 'text-[#D97706]',
    danger: 'text-[#DC2626]',
  }[tone];

  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-2 tabular-nums tracking-tight ${toneText}`}>{value}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1.5">{subtext}</p>}
    </Card>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-1/4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      <Info className="w-8 h-8 text-slate-400 mx-auto mb-3" />
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function Banner({
  type,
  message,
  onClose,
}: {
  type: 'error' | 'success' | 'info';
  message: string;
  onClose?: () => void;
}) {
  const cfg = {
    error: {
      box: 'bg-red-50 border-red-200 text-red-800',
      Icon: AlertCircle,
    },
    success: {
      box: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      Icon: CheckCircle2,
    },
    info: {
      box: 'bg-blue-50 border-blue-200 text-blue-800',
      Icon: Info,
    },
  }[type];

  const Icon = cfg.Icon;
  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg border text-sm mb-4 ${cfg.box}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-0.5 hover:opacity-75 shrink-0" aria-label="Dismiss notification">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className={`bg-white border border-slate-200 rounded-xl shadow-lg w-full ${maxWidth} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
