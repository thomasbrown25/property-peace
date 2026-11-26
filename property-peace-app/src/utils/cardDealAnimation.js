export const cardDealAnimationSx = {
  '@keyframes dealRentCard': {
    from: { opacity: 0, transform: 'translateX(-28px) rotate(-4deg) scale(0.96)' },
    to: { opacity: 1, transform: 'translateX(0) rotate(0deg) scale(1)' }
  },
  '& > *': {
    animation: 'dealRentCard 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
    animationDelay: 'var(--deal-delay)',
    transformOrigin: 'bottom left'
  },
  '@media (prefers-reduced-motion: reduce)': { '& > *': { animation: 'none' } }
};
