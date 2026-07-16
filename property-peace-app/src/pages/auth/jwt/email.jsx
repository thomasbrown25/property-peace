import { useNavigate } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import EmailEntryForm from 'sections/auth/jwt/EmailEntryForm';

// ================================|| JWT - EMAIL ENTRY ||================================ //

export default function EmailEntry() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Check if user type is set
  const userType = sessionStorage.getItem('registerUserType');
  if (!userType || userType !== 'landlord') {
    // Redirect to account type selection if not landlord
    navigate('/register');
    return null;
  }

  return (
    <AuthWrapper splitScreen>
      <EmailEntryForm isDemo={isLoggedIn} userType="landlord" />
    </AuthWrapper>
  );
}
