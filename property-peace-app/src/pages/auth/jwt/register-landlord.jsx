import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Box } from '@mui/material';
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import EmailEntryForm from 'sections/auth/jwt/EmailEntryForm';
import EmailVerifierForm from 'sections/auth/jwt/EmailVerifierForm';
import LandlordPersonalInfoStep from 'sections/auth/jwt/LandlordPersonalInfoStep';
import CreatingAccountStep from 'sections/auth/jwt/CreatingAccountStep';
import SettingUpProfile from 'pages/auth/jwt/setting-up-profile';
import { rememberChecklistIntent } from 'utils/leaseTransitionChecklists.mjs';

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
  const { isLoggedIn } = useAuth();
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
  const [mustReverify, setMustReverify] = useState(false);
  const [registrationMethod, setRegistrationMethod] = useState(() =>
    sessionStorage.getItem('googleAccessToken') ? 'google' : 'email'
  );
  const googleProfile = registrationMethod === 'google';
  const registrationCompleting = location.state?.registrationCompleting === true;
  const signedInCompletion = isLoggedIn && registrationCompleting && ['creating', 'complete'].includes(requestedStep);
  const needsPasswordAfterRefresh = requestedStep !== 'account' && !googleProfile && !password && !signedInCompletion;
  const step = !validSteps.includes(requestedStep) || needsPasswordAfterRefresh ? 'account' : requestedStep;

  useEffect(() => {
    rememberChecklistIntent(location.search);
  }, [location.search]);

  useEffect(() => {
    if (location.pathname !== '/register' || step !== requestedStep) {
      navigate(`/register?step=${step}`, { replace: true, state: { resumeRegistration: needsPasswordAfterRefresh } });
    }
  }, [location.pathname, navigate, needsPasswordAfterRefresh, requestedStep, step]);

  const go = (next, replace = false, state) => navigate(`/register?step=${next}`, { replace, state });
  const updateDraft = (updates) => setDraft((current) => ({ ...current, ...updates }));

  const content = (() => {
    if (step === 'verify')
      return (
        <EmailVerifierForm
          email={draft.email}
          mustReverify={mustReverify}
          onBack={() => {
            setMustReverify(false);
            go('account');
          }}
          onVerified={() => {
            setMustReverify(false);
            go('details');
          }}
        />
      );
    if (step === 'details')
      return (
        <LandlordPersonalInfoStep
          {...{
            initialFirstName: draft.firstName,
            initialLastName: draft.lastName,
            initialEmail: draft.email,
            initialPhoneNumber: draft.phoneNumber,
            initialOrganizationName: draft.organizationName,
            googleProfile
          }}
          onNext={(values) => {
            Object.entries(values).forEach(([key, value]) =>
              sessionStorage.setItem(`register${key.charAt(0).toUpperCase()}${key.slice(1)}`, value)
            );
            updateDraft(values);
            go('creating', false, { registrationCompleting: true });
          }}
        />
      );
    if (step === 'creating')
      return (
        <CreatingAccountStep
          password={password}
          onVerificationRequired={() => {
            setMustReverify(true);
            go('verify', true);
          }}
          onComplete={() => go('complete', true, { registrationCompleting: true })}
          onBack={() => go('details')}
        />
      );
    if (step === 'complete') return <SettingUpProfile hideWrapper redirectOnly={signedInCompletion} />;
    return (
      <EmailEntryForm
        userType="landlord"
        initialEmail={draft.email}
        resumeMessage={
          needsPasswordAfterRefresh || location.state?.resumeRegistration
            ? 'Re-enter your password to request a new verification code. Your other details have been saved.'
            : ''
        }
        onNext={(email, nextPassword) => {
          setRegistrationMethod('email');
          setPassword(nextPassword);
          updateDraft({ email });
          go('verify');
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
