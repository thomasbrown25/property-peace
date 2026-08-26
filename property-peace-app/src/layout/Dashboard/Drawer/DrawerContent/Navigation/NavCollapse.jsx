import PropTypes from 'prop-types';
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// material-ui
import { styled } from '@mui/material/styles';
import {
  useMediaQuery,
  Collapse,
  ClickAwayListener,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  Paper,
  Popper,
  Typography,
  Box,
  Tooltip
} from '@mui/material';

// project imports
import NavItem from './NavItem';
import Dot from 'components/@extended/Dot';
import IconButton from 'components/@extended/IconButton';
import SimpleBar from 'components/third-party/SimpleBar';
import Transitions from 'components/@extended/Transitions';
import { MenuOrientation, ThemeMode } from 'config';

import useConfig from 'hooks/useConfig';
import useMenuCollapse from 'hooks/useMenuCollapse';
import { useGetMenuMaster } from 'api/menu';

// third-party
import { FormattedMessage } from 'react-intl';

// assets
import BorderOutlined from '@ant-design/icons/BorderOutlined';
import DownOutlined from '@ant-design/icons/DownOutlined';
import UpOutlined from '@ant-design/icons/UpOutlined';
import RightOutlined from '@ant-design/icons/RightOutlined';

// mini-menu - wrapper
const PopperStyled = styled(Popper)(({ theme }) => ({
  overflow: 'visible',
  zIndex: 1202,
  minWidth: 180,
  '& > .MuiBox-root': {
    position: 'relative',
    '&:before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      top: 25,
      ...(theme.direction !== 'rtl' && { left: -5 }),
      ...(theme.direction === 'rtl' && { right: -5 }),
      width: 10,
      height: 10,
      background: theme.palette.background.paper,
      transform: 'translateY(-50%) rotate(45deg)',
      zIndex: 120,
      borderLeft: '2px solid',
      borderLeftColor: theme.palette.divider,
      borderBottom: '2px solid',
      borderBottomColor: theme.palette.divider
    }
  },
  '&[data-popper-placement="right-end"]': {
    '.MuiPaper-root': {
      marginBottom: -8
    },
    '&:before': {
      top: 'auto',
      bottom: 5
    }
  }
}));

export default function NavCollapse({ menu, level, parentId, setSelectedItems, selectedItems, setSelectedLevel, selectedLevel }) {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { mode, menuOrientation } = useConfig();
  const navigation = useNavigate();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const [anchorElCollapse, setAnchorElCollapse] = React.useState(null);

  const openCollapse = Boolean(anchorElCollapse);
  const handleClickCollapse = (event) => {
    event.stopPropagation();
    // Close other dropdowns by setting selectedItems to this menu's id
    setSelectedItems(menu.id);
    setAnchorElCollapse(event.currentTarget);
  };
  const handleCloseCollapse = () => {
    setAnchorElCollapse(null);
  };

  const handleClick = (event, isRedirect) => {
    setAnchorEl(null);
    setSelectedLevel(level);
    if (drawerOpen) {
      // Close dropdown if clicking on a non-dropdown item
      if (!menu.isDropdown && openCollapse) {
        handleCloseCollapse();
      }
      setOpen(!open);
      setSelected(!selected ? menu.id : null);
      setSelectedItems(!selected ? menu.id : '');
      if (menu.url && isRedirect) navigation(`${menu.url}`);
    } else {
      setAnchorEl(event?.currentTarget);
    }
  };

  const handlerIconLink = () => {
    if (!drawerOpen) {
      if (menu.url) navigation(`${menu.url}`);
      setSelected(menu.id);
    }
  };

  const handleHover = (event) => {
    setAnchorEl(event?.currentTarget);
  };

  const miniMenuOpened = Boolean(anchorEl);

  const handleMiniClose = () => {
    setAnchorEl(null);
  };

  const handleClose = () => {
    setOpen(false);
    if (!miniMenuOpened) {
      if (!menu.url) {
        setSelected(null);
      }
    }
    setAnchorEl(null);
  };

  useMemo(() => {
    if (selected === selectedItems) {
      if (level === 1) {
        setOpen(true);
      }
    } else {
      if (level === selectedLevel) {
        setOpen(false);
        if (!miniMenuOpened && !drawerOpen && !selected) {
          setSelected(null);
        }
        if (drawerOpen) {
          setSelected(null);
        }
      }
    }
  }, [selectedItems, level, selected, miniMenuOpened, drawerOpen, selectedLevel]);

  // Close dropdown when another menu item is selected
  useEffect(() => {
    if (menu.isDropdown && selectedItems !== menu.id && anchorElCollapse) {
      handleCloseCollapse();
    }
  }, [selectedItems, menu.id, menu.isDropdown, anchorElCollapse]);

  const { pathname } = useLocation();

  // menu collapse for sub-levels
  useMenuCollapse(menu, pathname, miniMenuOpened, setSelected, setOpen, setAnchorEl);

  useEffect(() => {
    if (menu.url === pathname) {
      setSelected(menu.id);
      setAnchorEl(null);
      setOpen(true);
    }
  }, [pathname, menu]);

  const navCollapse = menu.children?.map((item) => {
    switch (item.type) {
      case 'collapse':
        return (
          <NavCollapse
            key={item.id}
            setSelectedItems={setSelectedItems}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            selectedItems={selectedItems}
            menu={item}
            level={level + 1}
            parentId={parentId}
          />
        );
      case 'item':
        return <NavItem key={item.id} item={item} level={level + 1} setSelectedItems={setSelectedItems} selectedItems={selectedItems} />;
      default:
        return (
          <Typography key={item.id} variant="h6" color="error" align="center">
            Fix - Collapse or Item
          </Typography>
        );
    }
  });

  const isSelected = selected === menu.id;
  const borderIcon = level === 1 ? <BorderOutlined style={{ fontSize: '1rem' }} /> : false;
  const Icon = menu.icon;
  const menuIcon = menu.icon ? <Icon style={{ fontSize: drawerOpen ? '1rem' : '1.25rem' }} /> : borderIcon;
  const textColor = 'rgba(255, 255, 255, 0.87)'; // Light color for text on primary background
  const iconSelectedColor = 'rgba(255, 255, 255, 0.95)'; // Light color for selected icons
  const popperId = miniMenuOpened ? `collapse-pop-${menu.id}` : undefined;
  const FlexBox = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' };

  const collapsedIconStyle = { fontSize: '0.625rem' };
  const collapsedIcon = miniMenuOpened || open ? <UpOutlined style={collapsedIconStyle} /> : <DownOutlined style={collapsedIconStyle} />;

  return (
    <>
      {menuOrientation === MenuOrientation.VERTICAL || downLG ? (
        <>
          <Tooltip
            title={!drawerOpen && level === 1 ? <FormattedMessage id={menu.title} /> : ''}
            placement="right"
            arrow
            disableHoverListener={drawerOpen || level !== 1}
          >
            <ListItemButton
              id={`${menu.id}-button`}
              selected={selected === menu.id}
              {...(!drawerOpen && { onMouseEnter: (e) => handleClick(e, true), onMouseLeave: handleMiniClose })}
              className={anchorEl ? 'Mui-selected' : ''}
              onClick={(e) => handleClick(e, true)}
              sx={(theme) => ({
                pl: drawerOpen ? `${level * 28}px` : 1.5,
                py: 0.5,
                ...(drawerOpen && {
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255, 255, 255, 0.12)',
                    color: iconSelectedColor,
                    '& .MuiListItemIcon-root': { color: '#fff !important' },
                    '&:hover': { color: iconSelectedColor, bgcolor: 'rgba(255, 255, 255, 0.12)' }
                  }
                }),
                ...(!drawerOpen && {
                  '&:hover': { bgcolor: 'transparent' },
                  '&.Mui-selected': { '&:hover': { bgcolor: 'transparent' }, bgcolor: 'transparent' }
                })
              })}
              {...(drawerOpen &&
                menu.isDropdown && {
                  'aria-controls': openCollapse ? `${menu.id}-menu` : undefined,
                  'aria-haspopup': true,
                  'aria-expanded': openCollapse ? 'true' : undefined,
                  onClick: handleClickCollapse
                })}
            >
            {menuIcon && (
              <ListItemIcon
                onClick={handlerIconLink}
                sx={(theme) => ({
                  minWidth: 28,
                  color: `${selected === menu.id ? '#fff' : 'rgba(255, 255, 255, 0.7)'} !important`,
                  ...(!drawerOpen && {
                    borderRadius: 1.5,
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' }
                  }),
                  ...(!drawerOpen &&
                    selected === menu.id && {
                      bgcolor: 'rgba(255, 255, 255, 0.12)',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)' }
                    })
                })}
              >
                {menuIcon}
              </ListItemIcon>
            )}
            {(drawerOpen || (!drawerOpen && level !== 1)) && (
              <ListItemText
                primary={
                  <Typography variant="h6" sx={{ color: selected === menu.id || anchorEl ? iconSelectedColor : textColor, fontFamily: "'Inter', sans-serif", fontSize: '0.8125rem' }}>
                    {menu.title && <FormattedMessage id={menu.title} />}
                  </Typography>
                }
                secondary={
                  menu.caption && (
                    <Typography variant="caption" sx={{ color: 'secondary', fontFamily: "'Inter', sans-serif" }}>
                      <FormattedMessage id={menu.caption ? menu.caption : '484'} />
                    </Typography>
                  )
                }
              />
            )}

            {(drawerOpen || (!drawerOpen && level !== 1)) &&
              (menu?.url ? (
                <IconButton
                  onClick={(event) => {
                    event?.stopPropagation();
                    handleClick(event, false);
                  }}
                  color="secondary"
                  variant="outlined"
                  sx={{
                    width: 20,
                    height: 20,
                    mr: '-5px',
                    color: 'secondary.dark',
                    borderColor: open ? 'primary.light' : 'secondary.light',
                    '&:hover': { borderColor: open ? 'primary.main' : 'secondary.main' },
                    ...((miniMenuOpened || open) && { color: 'primary.main', ...(miniMenuOpened && { transform: 'rotate(90deg)' }) })
                  }}
                >
                  {collapsedIcon}
                </IconButton>
              ) : (
                <Box
                  component="span"
                  sx={{ ...((miniMenuOpened || open) && { color: 'primary.main', ...(miniMenuOpened && { transform: 'rotate(90deg)' }) }) }}
                >
                  {collapsedIcon}
                </Box>
              ))}

            {!drawerOpen && (
              <PopperStyled open={miniMenuOpened} anchorEl={anchorEl} placement="right-start" style={{ zIndex: 2001 }}>
                {({ TransitionProps }) => (
                  <Transitions in={miniMenuOpened} {...TransitionProps}>
                    <Paper
                      sx={(theme) => ({
                        overflow: 'hidden',
                        boxShadow: theme.customShadows.z1,
                        backgroundImage: 'none',
                        border: '1px solid',
                        borderColor: 'divider'
                      })}
                    >
                      <ClickAwayListener onClickAway={handleClose}>
                        <>
                          <SimpleBar sx={{ overflowX: 'hidden', overflowY: 'auto', maxHeight: '50vh' }}>{navCollapse}</SimpleBar>
                        </>
                      </ClickAwayListener>
                    </Paper>
                  </Transitions>
                )}
              </PopperStyled>
            )}
          </ListItemButton>
          </Tooltip>
          {drawerOpen && !menu?.isDropdown && (
            <Collapse in={open} timeout="auto" unmountOnExit>
              <List sx={{ p: 0 }}>{navCollapse}</List>
            </Collapse>
          )}

          {drawerOpen && menu?.isDropdown && (
            <Menu
              id={`${menu.id}-menu`}
              aria-labelledby={`${menu.id}-button`}
              anchorEl={anchorElCollapse}
              open={openCollapse}
              onClose={handleCloseCollapse}
              onClick={handleCloseCollapse}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              sx={(theme) => ({ '& .MuiPaper-root': { boxShadow: theme.shadows[2] }, '& .MuiListItemButton-root': { pl: 2 } })}
            >
              {navCollapse}
            </Menu>
          )}
        </>
      ) : (
        <ListItemButton
          {...(menu?.url && { component: Link, to: menu.url })}
          id={`boundary-${popperId}`}
          disableRipple
          selected={isSelected}
          onMouseEnter={handleHover}
          onMouseLeave={handleClose}
          onClick={handleHover}
          aria-describedby={popperId}
          className={anchorEl ? 'Mui-selected' : ''}
          sx={{ '&.Mui-selected': { bgcolor: 'transparent' } }}
        >
          <Box onClick={handlerIconLink} sx={FlexBox}>
            {menuIcon && (
              <ListItemIcon sx={{ my: 'auto', minWidth: !menu.icon ? 18 : 28, color: 'secondary.dark' }}>{menuIcon}</ListItemIcon>
            )}
            {!menuIcon && level !== 1 && (
              <ListItemIcon
                sx={{ my: 'auto', minWidth: !menu.icon ? 18 : 28, bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' } }}
              >
                <Dot size={4} color={isSelected || anchorEl ? 'primary' : 'secondary'} />
              </ListItemIcon>
            )}
            <ListItemText
              primary={
                <Typography variant="body1" sx={{ color: 'inherit', my: 'auto', fontFamily: "'Inter', sans-serif", fontSize: '0.8125rem' }}>
                  {menu.title && <FormattedMessage id={menu.title} />}
                </Typography>
              }
            />
            {miniMenuOpened ? <RightOutlined /> : <DownOutlined />}
          </Box>

          {anchorEl && (
            <PopperStyled id={popperId} open={miniMenuOpened} anchorEl={anchorEl} placement="right-start" style={{ zIndex: 2001 }}>
              {({ TransitionProps }) => (
                <Transitions in={miniMenuOpened} {...TransitionProps}>
                  <Paper sx={(theme) => ({ overflow: 'hidden', py: 0.5, boxShadow: theme.shadows[8], backgroundImage: 'none' })}>
                    <ClickAwayListener onClickAway={handleClose}>
                      <>
                        <SimpleBar sx={{ overflowX: 'hidden', overflowY: 'auto', maxHeight: '50vh' }}>{navCollapse}</SimpleBar>
                      </>
                    </ClickAwayListener>
                  </Paper>
                </Transitions>
              )}
            </PopperStyled>
          )}
        </ListItemButton>
      )}
    </>
  );
}

NavCollapse.propTypes = {
  menu: PropTypes.any,
  level: PropTypes.number,
  parentId: PropTypes.string,
  setSelectedItems: PropTypes.oneOfType([PropTypes.func, PropTypes.any]),
  selectedItems: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
  setSelectedLevel: PropTypes.func,
  selectedLevel: PropTypes.number
};
