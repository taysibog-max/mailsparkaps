import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ className = '', header, footer, children, ...props }: CardProps) {
  return (
    <div className={`rounded-xl border border-white/10 bg-neutral-900/30 backdrop-blur-xl ${className}`} {...props}>
      {header && <div className="px-4 py-3 border-b border-white/10 text-sm text-neutral-300">{header}</div>}
      <div className="p-4">{children}</div>
      {footer && <div className="px-4 py-3 border-t border-white/10 text-sm text-neutral-400">{footer}</div>}
    </div>
  );
}

export default Card;


