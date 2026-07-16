import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import EmailVerifierForm from 'sections/auth/jwt/EmailVerifierForm';

// ================================|| JWT - EMAIL VERIFIER ||================================ //

export default function EmailVerifier() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Get email from sessionStorage
    const storedEmail = sessionStorage.getItem('registerEmail');
    if (!storedEmail) {
      // If no email in session, redirect back to register
      navigate('/register');
      return;
    }
    setEmail(storedEmail);
  }, [navigate]);

  if (!email) {
    return null; // Will redirect
  }

  return (
    <AuthWrapper splitScreen>
      <EmailVerifierForm email={email} />
    </AuthWrapper>
  );
}

