import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ButtonBase } from '@mui/material';

// project imports
import Logo from './LogoMain';
import LogoIcon from './LogoIcon';
import { APP_DEFAULT_PATH } from 'config';
import useIsAdmin from 'hooks/useIsAdmin';

export default function LogoSection({ reverse, isIcon, sx, to, width, disableTopPadding = false, lightHeaderLogo = false }) {
  const isAdmin = useIsAdmin();
  
  // Determine the default path based on user role
  const defaultPath = to || (isAdmin ? '/admin/dashboard' : APP_DEFAULT_PATH);
  
  // Extract width from sx prop if provided, or use default
  const iconWidth = sx?.width || 35;
  
  return (
    <ButtonBase disableRipple component={Link} to={defaultPath} sx={sx}>
      {isIcon ? (
        <LogoIcon width={typeof iconWidth === 'number' ? iconWidth : 35} />
      ) : (
        <Logo reverse={reverse} width={width} disableTopPadding={disableTopPadding} lightHeaderLogo={lightHeaderLogo} />
      )}
    </ButtonBase>
  );
}

LogoSection.propTypes = {
  reverse: PropTypes.bool,
  isIcon: PropTypes.bool,
  sx: PropTypes.any,
  to: PropTypes.any,
  width: PropTypes.number,
  disableTopPadding: PropTypes.bool,
  lightHeaderLogo: PropTypes.bool
};
