import { Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { isImpersonating } from 'utils/impersonationSession';
import { ONLINE_PAYMENT_SETUP_PATH } from 'utils/onlinePaymentTabs';

export default function OnlinePaymentSetupButton(props) {
  return (
    <Button
      {...props}
      component={RouterLink}
      to={ONLINE_PAYMENT_SETUP_PATH}
      target={isImpersonating() ? undefined : '_blank'}
      rel="noopener noreferrer"
    />
  );
}
