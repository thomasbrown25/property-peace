import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Box } from '@mui/material';
import AuthWrapper from 'sections/auth/AuthWrapper';
import EmailEntryForm from 'sections/auth/jwt/EmailEntryForm';
import EmailVerifierForm from 'sections/auth/jwt/EmailVerifierForm';
import LandlordPersonalInfoStep from 'sections/auth/jwt/LandlordPersonalInfoStep';
import CreatingAccountStep from 'sections/auth/jwt/CreatingAccountStep';
import SettingUpProfile from 'pages/auth/jwt/setting-up-profile';

const validSteps = ['account', 'verify', 'details', 'creating', 'complete'];
const readDraft = () => ({
  email: sessionStorage.getItem('registerEmail') || '',
  firstName: sessionStorage.getItem('registerFirstName') || '',
  lastName: sessionStorage.getItem('registerLastName') || '',
  phoneNumber: sessionStorage.getItem('registerPhoneNumber') || '',
  organizationName: sessionStorage.getItem('registerOrganizationName') || ''
});

export default function RegisterLandlord() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const queryStep = new URLSearchParams(location.search).get('step');
  const legacyStep = location.pathname.endsWith('/email-verifier')
    ? 'verify'
    : location.pathname.endsWith('/personal-info') || location.pathname.endsWith('/business-info')
      ? 'details'
      : location.pathname.endsWith('/setting-up-profile')
        ? 'creating'
        : 'account';
  const requestedStep = queryStep || legacyStep;
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState(readDraft);
  const [completed, setCompleted] = useState(false);
  const [registrationMethod, setRegistrationMethod] = useState(() =>
    sessionStorage.getItem('googleAccessToken') ? 'google' : 'email'
  );
  const googleProfile = registrationMethod === 'google';
  const emailAlreadyVerified = sessionStorage.getItem('emailVerified') === 'true';
  const needsPasswordAfterRefresh = requestedStep !== 'account' && !googleProfile && !password;
  const step = !validSteps.includes(requestedStep) || needsPasswordAfterRefresh ? 'account' : requestedStep;

  useEffect(() => {
    if (location.pathname !== '/register' || step !== requestedStep) {
      navigate(`/register?step=${step}`, { replace: true });
    }
  }, [location.pathname, navigate, requestedStep, step]);

  const go = (next, replace = false) => navigate(`/register?step=${next}`, { replace });
  const updateDraft = (updates) => setDraft((current) => ({ ...current, ...updates }));

  const content = (() => {
    if (step === 'verify')
      return (
        <EmailVerifierForm
          email={draft.email}
          onBack={() => {
            sessionStorage.removeItem('emailVerified');
            go('account');
          }}
          onVerified={() => go('details')}
        />
      );
    if (step === 'details')
      return (
        <LandlordPersonalInfoStep
          {...{
            initialFirstName: draft.firstName,
            initialLastName: draft.lastName,
            initialPhoneNumber: draft.phoneNumber,
            initialOrganizationName: draft.organizationName,
            googleProfile
          }}
          onBack={() => go(googleProfile ? 'account' : 'verify')}
          onNext={(values) => {
            Object.entries(values).forEach(([key, value]) =>
              sessionStorage.setItem(`register${key.charAt(0).toUpperCase()}${key.slice(1)}`, value)
            );
            updateDraft(values);
            go('creating');
          }}
        />
      );
    if (step === 'creating')
      return (
        <CreatingAccountStep
          password={password}
          onComplete={() => {
            setCompleted(true);
            go('complete', true);
          }}
          onBack={() => go('details')}
        />
      );
    if (step === 'complete') return <SettingUpProfile hideWrapper redirectOnly={completed} />;
    return (
      <EmailEntryForm
        userType="landlord"
        initialEmail={draft.email}
        emailAlreadyVerified={emailAlreadyVerified}
        resumeMessage={
          needsPasswordAfterRefresh ? 'For your security, please re-enter your password. Your other details have been saved.' : ''
        }
        onNext={(email, nextPassword, alreadyVerified = false) => {
          setRegistrationMethod('email');
          setPassword(nextPassword);
          updateDraft({ email });
          go(alreadyVerified ? 'details' : 'verify');
        }}
        onGoogleSuccess={(profile) => {
          setRegistrationMethod('google');
          const next = {
            email: profile.email.trim().toLowerCase(),
            firstName: profile.firstName?.trim() || '',
            lastName: profile.lastName?.trim() || ''
          };
          updateDraft(next);
          go('details');
        }}
        onBack={() => window.location.assign('/')}
      />
    );
  })();

  return (
    <AuthWrapper splitScreen>
      <Box sx={{ width: '100%', maxWidth: 480, mx: 'auto', px: { xs: 0, sm: 2 }, py: 2 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </Box>
    </AuthWrapper>
  );
}
