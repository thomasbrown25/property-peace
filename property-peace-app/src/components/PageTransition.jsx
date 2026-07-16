import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

// ==============================|| PAGE TRANSITION ||============================== //

/**
 * PageTransition component that animates page changes with:
 * - Exit: Components transition outward from center (scale up + fade out)
 * - Enter: Components transition inward to center (scale down + fade in)
 * 
 * This component manages both exit and enter animations by keeping
 * the previous content visible during the exit animation.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [displayLocation, setDisplayLocation] = useState(location.pathname);
  const [isExiting, setIsExiting] = useState(false);
  const previousChildrenRef = useRef(children);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // If location changed, start exit animation
    if (location.pathname !== displayLocation) {
      // Keep previous children for exit animation (only if they exist)
      if (displayChildren) {
        previousChildrenRef.current = displayChildren;
        setIsExiting(true);
      }
      
      // Update to new children (could be undefined if lazy loading)
      setDisplayChildren(children);
      
      // After exit animation completes, clean up
      timeoutRef.current = setTimeout(() => {
        setDisplayLocation(location.pathname);
        setIsExiting(false);
        if (children) {
          previousChildrenRef.current = children;
        }
      }, 300); // Match exit animation duration
    } else {
      // Update children if they changed but location didn't (e.g., state changes)
      if (children) {
        setDisplayChildren(children);
        previousChildrenRef.current = children;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, children, displayLocation]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        flex: 1,
        overflow: 'visible', // Allow components to be visible when animating from outside
        minHeight: 'auto !important',
        height: 'auto !important',
        '& .page-content': {
          width: '100%',
          transformOrigin: 'center center',
        },
        '& .page-content.exiting': {
          position: 'absolute',
          top: 0,
          left: 0,
          minHeight: '100%',
          animation: '$exitAnimation 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          pointerEvents: 'none',
          zIndex: 1,
        },
        '& .page-content.entering': {
          position: 'relative !important',
          minHeight: 'auto !important',
          height: 'auto !important',
          animation: '$enterAnimation 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          zIndex: 2,
        },
        '@keyframes exitAnimation': {
          '0%': {
            transform: 'scale(1)',
            opacity: 1,
          },
          '100%': {
            transform: 'scale(1.2)',
            opacity: 0,
          },
        },
        '@keyframes enterAnimation': {
          '0%': {
            transform: 'scale(0.85)',
            opacity: 0,
          },
          '100%': {
            transform: 'scale(1)',
            opacity: 1,
          },
        },
      }}
    >
      {/* Previous content (exiting) - only render if we have valid children */}
      {isExiting && previousChildrenRef.current && (
        <Box key={`exit-${displayLocation}`} className="page-content exiting">
          {previousChildrenRef.current}
        </Box>
      )}
      
      {/* New content (entering) - only render if we have valid children */}
      {displayChildren && (
        <Box 
          key={`enter-${location.pathname}`} 
          className="page-content entering"
        >
          {displayChildren}
        </Box>
      )}
    </Box>
  );
}
