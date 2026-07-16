import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';

// ==============================|| ANIMATE IN COMPONENT ||============================== //

/**
 * AnimateIn component that animates children from outside the viewport into their position.
 * Only animates transform (not opacity) to avoid conflicts with Material-UI transition components.
 * 
 * @param {ReactNode} children - The content to animate
 * @param {string} direction - Direction to animate from: 'top', 'bottom', 'left', 'right', 'center'
 * @param {number} delay - Delay in milliseconds before animation starts (for staggering)
 * @param {number} duration - Animation duration in milliseconds
 * @param {number} distance - Distance to animate from (in pixels)
 */
export default function AnimateIn({ 
  children, 
  direction = 'bottom', 
  delay = 0, 
  duration = 600,
  distance = 50 
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getInitialTransform = () => {
    // Start from outside with scale for more dramatic effect
    const scale = 0.85; // Start slightly smaller
    switch (direction) {
      case 'top':
        return `translateY(-${distance}px) scale(${scale})`;
      case 'bottom':
        return `translateY(${distance}px) scale(${scale})`;
      case 'left':
        return `translateX(-${distance}px) scale(${scale})`;
      case 'right':
        return `translateX(${distance}px) scale(${scale})`;
      case 'center':
        return 'scale(0.7)';
      default:
        return `translateY(${distance}px) scale(${scale})`;
    }
  };

  const getFinalTransform = () => {
    // End at center position with normal scale
    return 'translate(0, 0) scale(1)';
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        // Only animate transform, not opacity - let child components handle their own opacity
        // This prevents conflicts with Material-UI transition components like Fade
        transform: isVisible ? getFinalTransform() : getInitialTransform(),
        transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        // Ensure component is always visible (not hidden by overflow)
        overflow: 'visible',
      }}
    >
      {children}
    </Box>
  );
}

AnimateIn.propTypes = {
  children: PropTypes.node.isRequired,
  direction: PropTypes.oneOf(['top', 'bottom', 'left', 'right', 'center']),
  delay: PropTypes.number,
  duration: PropTypes.number,
  distance: PropTypes.number,
};
