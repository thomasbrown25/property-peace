import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ================================|| JWT - BUSINESS INFO (REMOVED STEP) ||================================ //

export default function BusinessInfo() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/register/personal-info', { replace: true });
  }, [navigate]);

  return null;
}
