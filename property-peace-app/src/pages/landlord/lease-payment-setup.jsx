import { Navigate } from 'react-router-dom';
import { ONLINE_PAYMENT_SETUP_PATH } from 'utils/onlinePaymentTabs';

export default function LeasePaymentSetup() {
  return <Navigate to={ONLINE_PAYMENT_SETUP_PATH} replace />;
}
