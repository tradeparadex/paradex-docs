import React from 'react';
import clsx from 'clsx';

export default function MethodBadge({method, className}: {method: string; className?: string}) {
  const label = method === 'DELETE' ? 'DEL' : method;
  return <span className={clsx('api-method-badge', `api-method-badge--${method.toLowerCase()}`, className)}>{label}</span>;
}
