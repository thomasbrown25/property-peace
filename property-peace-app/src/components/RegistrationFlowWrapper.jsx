import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

// ==============================|| REGISTRATION FLOW WRAPPER ||============================== //

/**
 * RegistrationFlowWrapper component that provides smooth slide transitions
 * between registration steps. Slides from right to left when moving forward.
 */
export default function RegistrationFlowWrapper({ children }) {
  const location = useLocation();

  // Slide animation variants - smooth right to left transition
  const slideVariants = {
    initial: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      filter: 'blur(4px)'
    }),
    animate: {
      x: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        type: 'tween',
        ease: [0.4, 0, 0.2, 1], // Custom easing for smooth animation
        duration: 0.35
      }
    },
    exit: (direction) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
      filter: 'blur(4px)',
      transition: {
        type: 'tween',
        ease: [0.4, 0, 0.2, 1],
        duration: 0.3
      }
    })
  };

  // Determine direction based on route order
  const getRouteOrder = (path) => {
    const routeOrder = {
      '/register': 0,
      '/register/email': 1,
      '/register/email-verifier': 2,
      '/register/password': 3,
      '/register/personal-info': 4,
      '/register/business-info': 5,
      '/register/setting-up-profile': 6
    };
    return routeOrder[path] ?? 0;
  };

  const currentOrder = getRouteOrder(location.pathname);
  const previousOrder = getRouteOrder(sessionStorage.getItem('previousRegistrationRoute') || '');
  const direction = currentOrder > previousOrder ? 1 : -1;

  // Store current route for next transition
  if (location.pathname.startsWith('/register')) {
    sessionStorage.setItem('previousRegistrationRoute', location.pathname);
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        willChange: 'contents' // Optimize for animations
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            width: '100%',
            minHeight: '100%',
            position: 'relative',
            backfaceVisibility: 'hidden', // Prevent flickering
            WebkitBackfaceVisibility: 'hidden'
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}
