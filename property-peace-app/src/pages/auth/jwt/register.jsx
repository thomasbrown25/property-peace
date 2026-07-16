// project imports
import RegisterLandlord from './register-landlord';

// ================================|| JWT - REGISTER ||================================ //

export default function Register() {
  // Public signup is landlord-only. Tenant account creation must start from a landlord-provided invite link.
  return <RegisterLandlord />;
}
