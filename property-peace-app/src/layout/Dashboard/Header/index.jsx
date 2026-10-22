import { useMemo } from 'react';

// material-ui
import { useMediaQuery, AppBar, Toolbar } from '@mui/material';

// project imports
import AppBarStyled from './AppBarStyled';
import HeaderContent from './HeaderContent';
import IconButton from 'components/@extended/IconButton';

import useConfig from 'hooks/useConfig';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { MenuOrientation, DRAWER_WIDTH, MINI_DRAWER_WIDTH } from 'config';

// assets
import MenuFoldOutlined from '@ant-design/icons/MenuFoldOutlined';
import MenuUnfoldOutlined from '@ant-design/icons/MenuUnfoldOutlined';
import { useLocation } from 'react-router-dom';

// ==============================|| MAIN LAYOUT - HEADER ||============================== //

export default function Header() {
  const { pathname, search } = useLocation();
  const phone = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const mobileHome = phone && pathname === '/landlord/dashboard' && !['calendar', 'tasks'].includes(new URLSearchParams(search).get('tab'));
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const { menuOrientation } = useConfig();

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;
  const showDrawerMenu = !isHorizontal;

  // header content
  const headerContent = useMemo(() => <HeaderContent />, []);

  // common header
  const mainHeader = (
    <Toolbar
      sx={{
        position: 'relative',
        minHeight: { xs: mobileHome ? 72 : 60, sm: 64, md: 64 },
        height: { xs: mobileHome ? 72 : 60, sm: 64, md: 64 },
        py: 0,
        px: { xs: mobileHome ? 1.5 : 2, sm: 2.5 },
        ...(mobileHome && { '@media (max-width: 767px)': { '& button[aria-label="open drawer"], & button[aria-label="open global search"], & button[aria-label="open messages"]': { border: '1px solid rgba(6,30,53,.12)', borderRadius: '50%', width: 42, height: 42 } } })
      }}
    >
      {showDrawerMenu ? (
        <IconButton
          aria-label="open drawer"
          onClick={() => handlerDrawerOpen(!drawerOpen)}
          edge="start"
          color="secondary"
          variant="light"
          sx={(theme) => ({
            color: theme.palette.mode === 'dark' ? 'common.white' : 'text.primary',
            bgcolor: 'transparent',
            transition: theme.transitions.create(['background-color', 'box-shadow'], {
              duration: theme.transitions.duration.shorter
            }),
            '&:hover': {
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'action.hover',
              boxShadow: 'none'
            },
            ml: { xs: 0, lg: -2 }
          })}
        >
          {!drawerOpen ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </IconButton>
      ) : null}
      {headerContent}
    </Toolbar>
  );

  // app-bar params
  const appBar = {
    position: 'fixed',
    color: 'inherit',
    elevation: 0,
    sx: (theme) => ({
      bgcolor: theme.palette.mode === 'dark' ? '#061e35' : 'common.white',
      color: theme.palette.mode === 'dark' ? 'common.white' : '#061e35',
      borderBottom: '1px solid',
      borderBottomColor: mobileHome ? 'transparent' : theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'divider',
      boxShadow: mobileHome ? 'none' : theme.palette.mode === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.22)' : '0 4px 14px rgba(6, 30, 53, 0.08)',
      zIndex: 1200,
      width: isHorizontal
        ? '100%'
        : { xs: '100%', lg: drawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : `calc(100% - ${MINI_DRAWER_WIDTH}px)` }
    })
  };

  return (
    <>
      {!downLG ? (
        <AppBarStyled open={drawerOpen} {...appBar}>
          {mainHeader}
        </AppBarStyled>
      ) : (
        <AppBar {...appBar}>{mainHeader}</AppBar>
      )}
    </>
  );
}
