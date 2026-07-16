import { useState, useEffect } from 'react';
import OnboardingDialog from './OnboardingDialog';
import useAuth from 'hooks/useAuth';

/**
 * OnboardingWrapper Component
 * 
 * Wraps your app/page to show onboarding dialog for new users.
 * Add this to your main dashboard or layout component.
 * 
 * Usage:
 *   <OnboardingWrapper>
 *     <YourComponent />
 *   </OnboardingWrapper>
 */
export default function OnboardingWrapper({ children }) {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has seen tutorial
    const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
    
    // Show onboarding if user hasn't seen it and user is loaded
    if (user && !hasSeenTutorial) {
      // Small delay to ensure page is loaded
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  return (
    <>
      {children}
      <OnboardingDialog 
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />
    </>
  );
}
