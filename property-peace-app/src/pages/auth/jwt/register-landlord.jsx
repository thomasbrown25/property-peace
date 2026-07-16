import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Box } from '@mui/material';

// project imports
import AuthWrapper from 'sections/auth/AuthWrapper';
import EmailEntryForm from 'sections/auth/jwt/EmailEntryForm';
import EmailVerifierForm from 'sections/auth/jwt/EmailVerifierForm';
import LandlordPersonalInfoStep from 'sections/auth/jwt/LandlordPersonalInfoStep';
import OrganizationForm from 'sections/auth/jwt/OrganizationForm';
import CreatingAccountStep from 'sections/auth/jwt/CreatingAccountStep';
import SettingUpProfile from 'pages/auth/jwt/setting-up-profile';

// ================================|| JWT - REGISTER LANDLORD (SINGLE PAGE) ||================================ //

const STEPS = {
  EMAIL_ENTRY: 0,
  EMAIL_VERIFICATION: 1,
  PERSONAL_INFO: 2,
  BUSINESS_INFO: 3,
  CREATING_ACCOUNT: 4,
  COMPLETE: 5
};

export default function RegisterLandlord() {
  const location = useLocation();

  // Initialize step based on sessionStorage data and current route
  const [currentStep, setCurrentStep] = useState(() => {
    const path = location.pathname;

    // If we're on a specific route (not just /register), we might be continuing a flow
    const isContinuingFlow = path.includes('/register/email') ||
                             path.includes('/register/email-verifier') ||
                             path.includes('/register/business-info') ||
                             path.includes('/register/personal-info');

    // Only skip steps if we're explicitly continuing a flow from a specific route
    if (isContinuingFlow) {
      const email = sessionStorage.getItem('registerEmail');
      const firstName = sessionStorage.getItem('registerFirstName');
      const googleToken = sessionStorage.getItem('googleAccessToken');
      const emailVerified = sessionStorage.getItem('emailVerified');
      const orgName = sessionStorage.getItem('registerOrganizationName');
      const lastName = sessionStorage.getItem('registerLastName');

      console.log('[Google signup] RegisterLandlord initial step session snapshot', {
        path,
        email,
        firstName,
        lastName,
        hasGoogleToken: Boolean(googleToken),
        emailVerified: Boolean(emailVerified),
        orgName
      });

      // Explicit personal-info route only needs to show name fields when Google did not return a complete name.
      if (path.includes('/register/personal-info')) {
        if (googleToken && email) {
          return firstName && lastName ? STEPS.BUSINESS_INFO : STEPS.PERSONAL_INFO;
        }
        if (email && emailVerified) {
          return STEPS.PERSONAL_INFO; // Email flow – show personal info
        }
        if (email) {
          return STEPS.EMAIL_VERIFICATION;
        }
        return STEPS.EMAIL_ENTRY;
      }

      if (googleToken && email) {
        return firstName && lastName ? STEPS.BUSINESS_INFO : STEPS.PERSONAL_INFO;
      }
      if (email && firstName && lastName && emailVerified) {
        return orgName ? STEPS.CREATING_ACCOUNT : STEPS.BUSINESS_INFO;
      }
      if (email && firstName) {
        return STEPS.EMAIL_VERIFICATION;
      }
    }

    // Default: always start from email entry when coming from account type selection
    return STEPS.EMAIL_ENTRY;
  });
  const [formData, setFormData] = useState({
    userType: 'landlord',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    organizationName: '',
    googleData: null
  });
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [completedFromOrgForm, setCompletedFromOrgForm] = useState(false);
  const googlePrefillRef = useRef({ firstName: '', lastName: '', email: '' });

  // Load data from sessionStorage on mount
  useEffect(() => {
    const email = sessionStorage.getItem('registerEmail');
    const firstName = sessionStorage.getItem('registerFirstName');
    const lastName = sessionStorage.getItem('registerLastName');
    const phoneNumber = sessionStorage.getItem('registerPhoneNumber');
    const orgName = sessionStorage.getItem('registerOrganizationName');
    const googleToken = sessionStorage.getItem('googleAccessToken');

    if (email || firstName || orgName) {
      setFormData(prev => ({
        ...prev,
        email: email || prev.email,
        firstName: firstName || prev.firstName,
        lastName: lastName || prev.lastName,
        phoneNumber: phoneNumber || prev.phoneNumber,
        organizationName: orgName || prev.organizationName,
        googleData: googleToken ? {
          email: email,
          firstName: firstName,
          lastName: lastName
        } : null
      }));
    }
  }, []);

  const handleStepChange = (newStep, stepDirection = 1) => {
    setDirection(stepDirection);
    setCurrentStep(newStep);
  };

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const clearRegistrationState = () => {
    // Clear all registration-related sessionStorage
    sessionStorage.removeItem('registerEmail');
    sessionStorage.removeItem('registerPassword');
    sessionStorage.removeItem('registerFirstName');
    sessionStorage.removeItem('registerLastName');
    sessionStorage.removeItem('registerProfileImageUrl');
    sessionStorage.removeItem('registerPhoneNumber');
    sessionStorage.removeItem('googleAccessToken');
    sessionStorage.removeItem('emailVerified');
    sessionStorage.removeItem('registerUserType');
    sessionStorage.removeItem('registerOrganizationName');
    sessionStorage.removeItem('registerOrganizationDescription');

    // Reset form data
    setFormData({
      userType: 'landlord',
      email: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      organizationName: '',
      organizationDescription: '',
      googleData: null
    });
  };

  const handleBack = (fromStep) => {
    if (fromStep === STEPS.EMAIL_ENTRY) {
      clearRegistrationState();
      window.location.href = '/register';
    } else if (fromStep === STEPS.EMAIL_VERIFICATION) {
      handleStepChange(STEPS.EMAIL_ENTRY, -1);
    } else {
      const previousStep = fromStep - 1;
      handleStepChange(previousStep, -1);
    }
  };

  // Slide animation variants
  const slideVariants = {
    initial: (dir) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
      filter: 'blur(4px)'
    }),
    animate: {
      x: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        type: 'tween',
        ease: [0.4, 0, 0.2, 1],
        duration: 0.35
      }
    },
    exit: (dir) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      filter: 'blur(4px)',
      transition: {
        type: 'tween',
        ease: [0.4, 0, 0.2, 1],
        duration: 0.3
      }
    })
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.EMAIL_ENTRY:
        return (
          <EmailEntryForm
            userType="landlord"
            hideStepper={true}
            onNext={(email) => {
              updateFormData({ email });
              handleStepChange(STEPS.EMAIL_VERIFICATION, 1);
            }}
            onGoogleSuccess={(googleUserInfo) => {
              const firstName = googleUserInfo?.firstName || googleUserInfo?.FirstName || sessionStorage.getItem('registerFirstName') || '';
              const lastName  = googleUserInfo?.lastName  || googleUserInfo?.LastName  || sessionStorage.getItem('registerLastName')  || '';
              const email     = googleUserInfo?.email     || googleUserInfo?.Email     || sessionStorage.getItem('registerEmail')     || '';
              const picture   = googleUserInfo?.picture   || googleUserInfo?.Picture   || sessionStorage.getItem('registerProfileImageUrl') || '';
              // Write to ref synchronously — available immediately on next render
              googlePrefillRef.current = { firstName, lastName, email };
              updateFormData({ email, firstName, lastName, googleData: { ...googleUserInfo, picture } });
              if (picture) sessionStorage.setItem('registerProfileImageUrl', picture);
              console.log('[Google signup] RegisterLandlord routing decision', {
                email,
                firstName,
                lastName,
                hasPicture: Boolean(picture),
                nextStep: firstName && lastName ? 'BUSINESS_INFO' : 'PERSONAL_INFO',
                sessionFirstName: sessionStorage.getItem('registerFirstName'),
                sessionLastName: sessionStorage.getItem('registerLastName')
              });
              handleStepChange(firstName && lastName ? STEPS.BUSINESS_INFO : STEPS.PERSONAL_INFO, 1);
            }}
            onBack={() => {
              handleBack(STEPS.EMAIL_ENTRY);
            }}
          />
        );

      case STEPS.EMAIL_VERIFICATION:
        return (
          <EmailVerifierForm
            email={formData.email}
            hideStepper={true}
            onVerified={() => {
              sessionStorage.setItem('emailVerified', 'true');
              handleStepChange(sessionStorage.getItem('registerOrganizationName') ? STEPS.CREATING_ACCOUNT : STEPS.PERSONAL_INFO, 1);
            }}
            onBack={() => {
              handleBack(STEPS.EMAIL_VERIFICATION);
            }}
          />
        );

      case STEPS.PERSONAL_INFO:
        return (
          <LandlordPersonalInfoStep
            initialFirstName={googlePrefillRef.current.firstName || formData.firstName || sessionStorage.getItem('registerFirstName') || ''}
            initialLastName={googlePrefillRef.current.lastName || formData.lastName || sessionStorage.getItem('registerLastName') || ''}
            initialPhoneNumber={formData.phoneNumber || sessionStorage.getItem('registerPhoneNumber') || ''}
            initialOrganizationName={formData.organizationName || sessionStorage.getItem('registerOrganizationName') || ''}
            onNext={({ firstName, lastName, phoneNumber, organizationName }) => {
              updateFormData({ firstName, lastName, phoneNumber, organizationName });
              sessionStorage.setItem('registerFirstName', firstName);
              sessionStorage.setItem('registerLastName', lastName);
              if (phoneNumber) sessionStorage.setItem('registerPhoneNumber', phoneNumber);
              if (organizationName) sessionStorage.setItem('registerOrganizationName', organizationName);
              handleStepChange(sessionStorage.getItem('googleAccessToken') && (!phoneNumber || !organizationName) ? STEPS.BUSINESS_INFO : STEPS.CREATING_ACCOUNT, 1);
            }}
            onBack={() => handleStepChange(STEPS.EMAIL_ENTRY, -1)}
          />
        );

      case STEPS.BUSINESS_INFO:
        return (
          <OrganizationForm
            hideStepper={true}
            showBackButton={false}
            collectPhoneNumber={true}
            onSuccess={() => handleStepChange(STEPS.CREATING_ACCOUNT, 1)}
            onBack={() => handleStepChange(STEPS.EMAIL_ENTRY, -1)}
          />
        );

      case STEPS.CREATING_ACCOUNT:
        return (
          <CreatingAccountStep
            onComplete={() => {
              setCompletedFromOrgForm(true);
              handleStepChange(STEPS.COMPLETE, 1);
            }}
            onBack={() => handleStepChange(STEPS.PERSONAL_INFO, -1)}
          />
        );


      case STEPS.COMPLETE:
      default:
        // Complete step - show redirect screen once account creation finishes
        return <SettingUpProfile hideWrapper={true} redirectOnly={completedFromOrgForm} />;
    }
  };

  return (
    <AuthWrapper splitScreen>
      <Box
        sx={{
          width: '100%',
          minWidth: { xs: '100%', sm: 400 },
          maxWidth: { xs: '100%', sm: 400 },
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}
      >

        {/* Animated Step Content - padding so hover-scaled Google button isn't clipped */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight: '400px',
            overflow: 'visible',
            px: { xs: 1.5, sm: 2 },
            py: 0.5
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                width: '100%',
                position: 'relative',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
              }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </AuthWrapper>
  );
}
