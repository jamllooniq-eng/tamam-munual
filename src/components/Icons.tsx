import React from 'react';

type P = { size?: number; className?: string };
const sv = (size: number, children: React.ReactNode, className?: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
    {children}
  </svg>
);
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;

export const Truck = ({ size = 22, className }: P) =>
  sv(size, <>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" {...S} strokeLinejoin="round" />
    <circle cx="7" cy="17.5" r="1.8" {...S} />
    <circle cx="17" cy="17.5" r="1.8" {...S} />
  </>, className);

export const Cash = ({ size = 22, className }: P) =>
  sv(size, <>
    <rect x="3" y="6" width="18" height="12" rx="2" {...S} />
    <circle cx="12" cy="12" r="2.5" {...S} />
  </>, className);

export const Eye = ({ size = 22, className }: P) =>
  sv(size, <>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" {...S} />
    <circle cx="12" cy="12" r="2.6" {...S} />
  </>, className);

export const Exchange = ({ size = 22, className }: P) =>
  sv(size, <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" {...S} strokeLinecap="round" strokeLinejoin="round" />, className);

export const Doc = ({ size = 20, className }: P) =>
  sv(size, <path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h4" {...S} strokeLinejoin="round" />, className);

export const Question = ({ size = 20, className }: P) =>
  sv(size, <>
    <circle cx="12" cy="12" r="9" {...S} />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.2v.1" {...S} strokeLinecap="round" />
  </>, className);

export const Lock = ({ size = 14, className }: P) =>
  sv(size, <>
    <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </>, className);

export const ChevronNext = ({ size = 16 }: P) => sv(size, <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" />);
export const ChevronPrev = ({ size = 16 }: P) => sv(size, <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />);

export const Plus = ({ size = 18 }: P) => sv(size, <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />);
export const Minus = ({ size = 18 }: P) => sv(size, <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />);

export const Search = ({ size = 20 }: P) =>
  sv(size, <>
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </>);

export const Chat = ({ size = 20 }: P) => sv(size, <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />);

export const Check = ({ size = 34 }: P) =>
  sv(size, <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />);

export const Close = ({ size = 20 }: P) => sv(size, <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />);
