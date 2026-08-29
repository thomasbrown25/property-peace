import { useCallback, useEffect, useRef, useState } from 'react';
import { alpha, Box } from '@mui/material';

// project imports
import Navigation from './Navigation';
import SidebarBottomSection from './SidebarBottomSection';
import { hasMoreSidebarContent } from './sidebarScrollState';

// ==============================|| DRAWER CONTENT ||============================== //

export default function DrawerContent() {
  const scrollRef = useRef(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  const updateScrollState = useCallback(() => {
    setHasMoreBelow(hasMoreSidebarContent(scrollRef.current));
  }, []);

  useEffect(() => {
    const scrollNode = scrollRef.current;
    if (!scrollNode) return undefined;

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollNode);
    if (scrollNode.firstElementChild) resizeObserver.observe(scrollNode.firstElementChild);

    const frame = requestAnimationFrame(updateScrollState);
    window.addEventListener('resize', updateScrollState);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box
          ref={scrollRef}
          onScroll={updateScrollState}
          sx={(theme) => ({
            height: '100%',
            overflowY: 'scroll',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            scrollbarColor: `${alpha('#061e35', 0.38)} ${alpha('#061e35', 0.06)}`,
            '&::-webkit-scrollbar': { width: 8 },
            '&::-webkit-scrollbar-track': {
              backgroundColor: alpha('#061e35', 0.06),
              borderRadius: 999
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha('#061e35', 0.38),
              border: `2px solid ${theme.palette.background.paper}`,
              borderRadius: 999
            },
            '&::-webkit-scrollbar-thumb:hover': { backgroundColor: alpha('#061e35', 0.56) }
          })}
        >
          <Box>
            <Navigation />
          </Box>
        </Box>
        <Box
          aria-hidden
          sx={(theme) => ({
            position: 'absolute',
            right: '8px',
            bottom: 0,
            left: 0,
            zIndex: 1,
            height: 48,
            pointerEvents: 'none',
            background: `linear-gradient(to bottom, ${alpha(theme.palette.background.paper, 0)}, ${alpha(theme.palette.background.paper, 0.96)} 84%, ${theme.palette.background.paper})`,
            opacity: hasMoreBelow ? 1 : 0,
            transition: 'opacity 160ms ease'
          })}
        />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <SidebarBottomSection />
      </Box>
    </Box>
  );
}
