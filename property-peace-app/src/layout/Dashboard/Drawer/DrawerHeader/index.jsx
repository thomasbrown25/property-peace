import PropTypes from 'prop-types';
// material-ui
import { useMediaQuery, Box } from '@mui/material';

// project imports
import DrawerHeaderStyled from './DrawerHeaderStyled';
import Logo from 'components/logo';

import useConfig from 'hooks/useConfig';
import { MenuOrientation } from 'config';

// ==============================|| DRAWER HEADER ||============================== //

export default function DrawerHeader({ open, lightDrawerBackground }) {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { menuOrientation } = useConfig();
  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;

  return (
    <DrawerHeaderStyled
      open={open}
      lightDrawerBackground={lightDrawerBackground}
      sx={{
        minHeight: isHorizontal ? { xs: 40, md: 48 } : { xs: 57, sm: 61 },
        height: isHorizontal ? { xs: 40, md: 48 } : { xs: 57, sm: 61 },
        width: isHorizontal ? { xs: '100%', lg: '424px' } : 'initial',
        paddingTop: isHorizontal ? { xs: '8px', lg: '0' } : 0,
        paddingBottom: isHorizontal ? { xs: '8px', lg: '2px' } : 0,
        paddingLeft: isHorizontal ? { xs: '24px', lg: '0' } : open ? '24px' : 0,
        alignItems: isHorizontal ? 'flex-end' : 'center'
      }}
    >
      <Box sx={{ paddingTop: isHorizontal ? { xs: '8px', lg: '6px' } : 0 }}>
        <Logo
          isIcon={!open}
          reverse={false}
          disableTopPadding
          width={open ? 142 : undefined}
          sx={{ width: open ? 'auto' : 35, height: open ? 'auto' : isHorizontal ? { xs: 28, lg: 30 } : 32, lineHeight: 0 }}
        />
      </Box>
    </DrawerHeaderStyled>
  );
}

DrawerHeader.propTypes = { open: PropTypes.bool, lightDrawerBackground: PropTypes.string };
