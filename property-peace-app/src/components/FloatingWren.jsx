import PropTypes from 'prop-types';
import { alpha, Box, keyframes } from '@mui/material';
import sidebarWren from 'assets/images/logos/wren-floating-sidebar.webp';
import chatWren from 'assets/images/logos/wren-floating-chat.webp';
import { brand } from 'themes/brand';

const hover = keyframes({
  '0%, 100%': { transform: 'translateY(0)' },
  '50%': { transform: 'translateY(calc(0px - var(--wren-rise)))' }
});

const pulse = keyframes({
  '0%, 100%': { transform: 'scale(1.06)', opacity: 1 },
  '50%': { transform: 'scale(0.88)', opacity: 0.64 }
});

const cycle = '4s ease-in-out infinite';
const sizes = {
  sidebar: { width: 44, height: 44, ringWidth: 20 },
  welcome: { width: { xs: 72, sm: 96 }, height: { xs: 106, sm: 144 }, ringWidth: '60%' },
  reply: { width: 32, height: 32, ringWidth: 16 }
};

export default function FloatingWren({ placement }) {
  const sidebar = placement === 'sidebar';
  const compact = placement !== 'welcome';
  const { ringWidth, ...stageSize } = sizes[placement];

  return (
    <Box
      aria-hidden="true"
      sx={{
        '--wren-rise': compact ? '2px' : '7px',
        display: 'grid',
        gridTemplateRows: `minmax(0, 1fr) ${compact ? '4px' : '9px'}`,
        justifyItems: 'center',
        rowGap: compact ? '2px' : '4px',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...stageSize,
        mt: compact ? 0 : 2,
        pt: 'var(--wren-rise)',
        '@media (prefers-reduced-motion: reduce)': {
          '&& > *': { animation: 'none' }
        }
      }}
    >
      <Box
        component="img"
        src={sidebar ? sidebarWren : chatWren}
        alt=""
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: 0,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          animation: `${hover} ${cycle}`
        }}
      />
      <Box
        sx={(theme) => {
          const darkSurface = sidebar || theme.palette.mode === 'dark';
          return {
            width: ringWidth,
            height: '100%',
            boxSizing: 'border-box',
            ml: compact ? 0.5 : 1.5,
            border: '1px solid',
            borderColor: darkSurface ? brand.mint : alpha(brand.teal, 0.52),
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${alpha(brand.teal, 0.13)} 25%, ${alpha(brand.mint, 0.72)} 100%)`,
            boxShadow: `0 0 ${compact ? '4px' : '10px'} ${alpha(brand.mint, darkSurface ? 0.78 : 0.7)}`,
            opacity: 0.84,
            animation: `${pulse} ${cycle}`
          };
        }}
      />
    </Box>
  );
}

FloatingWren.propTypes = {
  placement: PropTypes.oneOf(['sidebar', 'welcome', 'reply']).isRequired
};
