import { useSearchParams } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import AuthLogin from 'sections/auth/jwt/AuthLogin';

// ================================|| JWT - LOGIN ||================================ //

export default function Login() {
  const { isLoggedIn } = useAuth();

  const [searchParams] = useSearchParams();
  const auth = searchParams.get('auth');

  return (
    <AuthWrapper splitScreen>
      <AuthLogin isDemo={isLoggedIn} />
    </AuthWrapper>
  );
}
