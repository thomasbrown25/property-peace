import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';

// ==============================|| ANIMATE ITEM COMPONENT ||============================== //

/**
 * AnimateItem component that animates individual items (like list items) when they appear.
 * This is used within components to animate data items as they load.
 * 
 * @param {ReactNode} children - The content to animate
 * @param {number} delay - Delay in milliseconds before animation starts (for staggering)
 * @param {number} duration - Animation duration in milliseconds
 * @param {string} direction - Direction to animate from: 'top', 'bottom', 'left', 'right'
 */
export default function AnimateItem({ 
  children, 
  delay = 0, 
  duration = 400,
  direction = 'bottom'
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getInitialTransform = () => {
    const distance = 30; // Smaller distance for items within components
    switch (direction) {
      case 'top':
        return `translateY(-${distance}px)`;
      case 'bottom':
        return `translateY(${distance}px)`;
      case 'left':
        return `translateX(-${distance}px)`;
      case 'right':
        return `translateX(${distance}px)`;
      default:
        return `translateY(${distance}px)`;
    }
  };

  const getFinalTransform = () => {
    return 'translate(0, 0)';
  };

  return (
    <Box
      sx={{
        width: '100%',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? getFinalTransform() : getInitialTransform(),
        transition: `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {children}
    </Box>
  );
}

AnimateItem.propTypes = {
  children: PropTypes.node.isRequired,
  delay: PropTypes.number,
  duration: PropTypes.number,
  direction: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
};
