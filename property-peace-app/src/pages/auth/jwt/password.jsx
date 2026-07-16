import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import PasswordForm from 'sections/auth/jwt/PasswordForm';

// ================================|| JWT - PASSWORD ||================================ //

export default function Password() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
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
      <PasswordForm email={email} />
    </AuthWrapper>
  );
}

