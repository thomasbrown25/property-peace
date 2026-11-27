// Match the lease payment-history deal, directed downward for dashboard lists.
export const dashboardSlideDownSx = {
  '@keyframes dashboardSlideDown': {
    from: { opacity: 0, transform: 'translateY(-28px) scale(0.98)' },
    to: { opacity: 1, transform: 'translateY(0) scale(1)' }
  },
  animation: 'dashboardSlideDown 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
  animationDelay: 'var(--dashboard-deal-delay, 0ms)',
  transformOrigin: 'top center',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
};

export const dashboardEntranceDelay = (index) => `${Math.min(index * 75, 450)}ms`;

export const dashboardRowHoverColor = 'action.hover';

export const dashboardRowHoverSx = {
  '@media (hover: hover)': {
    '&:hover': { bgcolor: dashboardRowHoverColor }
  },
  '@media (hover: hover) and (prefers-reduced-motion: no-preference)': {
    transition: 'background-color 180ms ease-out',
    '& > *': { transition: 'translate 180ms ease-out' },
    '&:hover > *': { translate: '0 -2px' }
  }
};

export const dashboardRowLinkSx = {
  color: 'inherit',
  textDecoration: 'none',
  '&:focus-visible': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: -2
  }
};
