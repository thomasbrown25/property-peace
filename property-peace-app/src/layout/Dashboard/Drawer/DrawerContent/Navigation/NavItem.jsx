import PropTypes from 'prop-types';
import { Link, useLocation, matchPath } from 'react-router-dom';
import { useState, useEffect } from 'react';

// material-ui
import { useMediaQuery, useTheme, Avatar, Chip, ListItemButton, ListItemIcon, ListItemText, Typography, Box, Tooltip, Popper, Paper, ClickAwayListener, List, alpha } from '@mui/material';
import { styled } from '@mui/material/styles';

// project imports
import Dot from 'components/@extended/Dot';
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';
import SimpleBar from 'components/third-party/SimpleBar';
import { getNavigationItemVerticalPadding } from './navigationItemSpacing';

// third-party
import { FormattedMessage } from 'react-intl';

import { MenuOrientation, NavActionType } from 'config';
import useConfig from 'hooks/useConfig';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

const PopperStyled = styled(Popper)(({ theme }) => ({
  overflow: 'visible',
  zIndex: 1202,
  minWidth: 180,
  '&:before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    top: '50%',
    left: -6,
    width: 12,
    height: 12,
    transform: 'translateY(-50%) rotate(45deg)',
    zIndex: 120,
    borderWidth: '6px',
    borderStyle: 'solid',
    borderColor:
      theme.palette.mode === 'dark'
        ? '#0b2a46 transparent transparent #0b2a46'
        : `${theme.palette.background.paper} transparent transparent ${theme.palette.background.paper}`
  }
}));

// ==============================|| NAVIGATION - LIST ITEM ||============================== //

export default function NavItem({ item, level, isParents = false, setSelectedID, setSelectedItems, selectedItems }) {
  const theme = useTheme();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { menuOrientation } = useConfig();
  const [dropdownAnchor, setDropdownAnchor] = useState(null);
  const dropdownOpen = Boolean(dropdownAnchor);

  let itemTarget = '_self';
  if (item.target) {
    itemTarget = '_blank';
  }

  const itemHandler = (event) => {
    // If item has dropdown, toggle dropdown instead of navigating
    if (item.hasDropdown && item.dropdownItems && drawerOpen) {
      event.preventDefault();
      event.stopPropagation();
      if (dropdownOpen) {
        setDropdownAnchor(null);
      } else {
        // Close other dropdowns by setting selectedItems to this item's id
        if (setSelectedItems) {
          setSelectedItems(item.id);
        }
        setDropdownAnchor(event.currentTarget);
      }
      return;
    }

    // A nested item belongs to its open collapse, so keep that collapse selected.
    // Only top-level items are outside a collapse and should close the open section.
    if (setSelectedItems) {
      if (level === 1) setSelectedItems('');
    }

    if (downLG) handlerDrawerOpen(false);

    if (isParents && setSelectedID) {
      setSelectedID(item.id);
    }
  };

  const handleDropdownClose = () => {
    setDropdownAnchor(null);
  };

  const Icon = item.icon;
  const { pathname } = useLocation();
  const isSelected = !!matchPath({ path: item?.link ? item.link : item.url, end: false }, pathname);

  // Close dropdown when pathname changes (user navigated to a different page)
  useEffect(() => {
    if (dropdownOpen) {
      setDropdownAnchor(null);
    }
  }, [pathname]);

  // Close dropdown when another nav item is selected
  useEffect(() => {
    if (item.hasDropdown && selectedItems !== item.id && dropdownOpen) {
      setDropdownAnchor(null);
    }
  }, [selectedItems, item.id, item.hasDropdown, dropdownOpen]);

  const darkChrome = theme.palette.mode === 'dark';
  const chromeForeground = darkChrome ? '#ffffff' : '#061e35';
  const textColor = chromeForeground;
  const iconColor = chromeForeground;
  const iconSelectedColor = chromeForeground;
  
  // Get primary color as hex for TwoTone icons
  const primaryColorHex = chromeForeground;

  // Check if icon name contains "TwoTone" to apply twoToneColor prop
  const iconName = item.icon?.name || item.icon?.displayName || '';
  const isTwoToneIcon = iconName.includes('TwoTone');
  
  const itemIcon = item.icon ? (
    <Icon
      style={{
        fontSize: drawerOpen ? '1rem' : '1.25rem',
        ...(menuOrientation === MenuOrientation.HORIZONTAL && isParents && { fontSize: 20, stroke: '1.5' })
      }}
      {...(isTwoToneIcon && { twoToneColor: primaryColorHex })}
    />
  ) : (
    false
  );

  const popperId = dropdownOpen ? `nav-item-dropdown-${item.id}` : undefined;

  return (
    <>
      {menuOrientation === MenuOrientation.VERTICAL || downLG ? (
        <Box sx={{ position: 'relative' }}>
          <Tooltip
            title={!drawerOpen && level === 1 ? <FormattedMessage id={item.title} /> : ''}
            placement="right"
            arrow
            disableHoverListener={drawerOpen || level !== 1 || dropdownOpen}
          >
            <ListItemButton
              component={item.hasDropdown && item.dropdownItems ? 'div' : (item.disabled ? 'div' : Link)}
              to={item.hasDropdown && item.dropdownItems ? undefined : (item.disabled ? undefined : item.url)}
              target={itemTarget}
              disabled={item.disabled}
              selected={isSelected || dropdownOpen}
              sx={(theme) => {
                const foreground = theme.palette.mode === 'dark' ? '#ffffff' : '#061e35';
                const hoverBg = alpha(foreground, 0.06);
                const selectedBg = alpha(foreground, 0.1);
                const selectedColor = foreground;
                return {
                  zIndex: 1201,
                  pl: drawerOpen ? `${level * 28}px` : 1.5,
                  py: getNavigationItemVerticalPadding({ drawerOpen, level }),
                  ...(drawerOpen && {
                    '&:hover': { bgcolor: hoverBg },
                    '&.Mui-selected': {
                      bgcolor: selectedBg,
                      borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#56b983' : '#061e35'}`,
                      color: selectedColor,
                      '&:hover': { color: selectedColor, bgcolor: selectedBg },
                      '& .MuiListItemIcon-root': { color: `${selectedColor} !important` }
                    }
                  }),
                  ...(!drawerOpen && {
                    '&:hover': { bgcolor: hoverBg },
                    '&.Mui-selected': {
                      bgcolor: selectedBg,
                      '&:hover': { bgcolor: selectedBg }
                    }
                  })
                };
              }}
              onClick={itemHandler}
            >
              {itemIcon && (
                <ListItemIcon
                  sx={(theme) => ({
                    minWidth: 28,
                    color: `${iconColor} !important`, // Always use same color, never change on selection
                    ...(!drawerOpen && {
                      borderRadius: 1.5,
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': { bgcolor: alpha(chromeForeground, 0.06) }
                    }),
                    ...(!drawerOpen &&
                      isSelected && {
                        bgcolor: alpha(chromeForeground, 0.1),
                        '&:hover': { bgcolor: alpha(chromeForeground, 0.1) }
                      })
                  })}
                >
                  {itemIcon}
                </ListItemIcon>
              )}
            {(drawerOpen || (!drawerOpen && level !== 1)) && (
              <ListItemText
                primary={
                  <Typography variant="h6" sx={{ color: isSelected ? iconSelectedColor : textColor, fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', fontWeight: 700 }}>
                    {item.title && <FormattedMessage id={item.title} defaultMessage={item.title} />}
                  </Typography>
                }
              />
            )}
            {(drawerOpen || (!drawerOpen && level !== 1)) && item.chip && (
              <Chip
                color={item.chip.color}
                variant={item.chip.variant}
                size={item.chip.size}
                label={item.chip.label}
                avatar={item.chip.avatar && <Avatar>{item.chip.avatar}</Avatar>}
              />
            )}
          </ListItemButton>
          {drawerOpen && item.hasDropdown && item.dropdownItems && (
            <PopperStyled
              id={popperId}
              open={dropdownOpen}
              anchorEl={dropdownAnchor}
              placement="right-start"
              style={{ zIndex: 2001 }}
            >
              {({ TransitionProps }) => (
                <Transitions in={dropdownOpen} {...TransitionProps}>
                  <Paper
                    sx={(theme) => ({
                      mt: 0,
                      ml: 0.5,
                      py: 1,
                      boxShadow: theme.shadows[8],
                      backgroundImage: 'none',
                      bgcolor: theme.palette.mode === 'dark' ? '#0b2a46' : 'background.paper',
                      color: theme.palette.mode === 'dark' ? 'common.white' : 'text.primary',
                      minWidth: 200
                    })}
                  >
                    <ClickAwayListener onClickAway={handleDropdownClose}>
                      <SimpleBar sx={{ maxHeight: 'calc(100vh - 170px)', overflowX: 'hidden', overflowY: 'auto' }}>
                        <List sx={{ py: 0 }}>
                          {item.dropdownItems.map((dropdownItem) => {
                            const DropdownIcon = dropdownItem.icon;
                            const dropdownItemSelected = !!matchPath(
                              { path: dropdownItem?.link ? dropdownItem.link : dropdownItem.url, end: false },
                              pathname
                            );
                            
                            // Check if dropdown icon is TwoTone to apply twoToneColor prop
                            const dropdownIconName = dropdownItem.icon?.name || dropdownItem.icon?.displayName || '';
                            const isDropdownTwoToneIcon = dropdownIconName.includes('TwoTone');
                            
                            return (
                              <ListItemButton
                                key={dropdownItem.id}
                                component={Link}
                                to={dropdownItem.url}
                                selected={dropdownItemSelected}
                                onClick={() => {
                                  handleDropdownClose();
                                  if (downLG) handlerDrawerOpen(false);
                                }}
                                sx={(theme) => ({
                                  pl: 2,
                                  py: 1,
                                  '&:hover': {
                                    bgcolor: 'primary.lighter',
                                    ...theme.applyStyles('dark', { bgcolor: 'divider' })
                                  },
                                  '&.Mui-selected': {
                                    bgcolor: 'primary.lighter',
                                    ...theme.applyStyles('dark', { bgcolor: 'divider' }),
                                    borderLeft: '2px solid',
                                    borderColor: 'primary.main',
                                    '&:hover': {
                                      bgcolor: 'primary.lighter',
                                      ...theme.applyStyles('dark', { bgcolor: 'divider' })
                                    }
                                  }
                                })}
                              >
                                {DropdownIcon && (
                                  <ListItemIcon sx={{ minWidth: 36, color: chromeForeground }}>
                                    <DropdownIcon 
                                      style={{ fontSize: '1rem' }}
                                      {...(isDropdownTwoToneIcon && { twoToneColor: primaryColorHex })}
                                    />
                                  </ListItemIcon>
                                )}
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" sx={{ color: dropdownItemSelected ? iconSelectedColor : textColor, fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', fontWeight: 700 }}>
                                      {dropdownItem.title && <FormattedMessage id={dropdownItem.title} />}
                                    </Typography>
                                  }
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      </SimpleBar>
                    </ClickAwayListener>
                  </Paper>
                </Transitions>
              )}
            </PopperStyled>
          )}
          {(drawerOpen || (!drawerOpen && level !== 1)) &&
            item?.actions &&
            item?.actions.map((action, index) => {
              const ActionIcon = action.icon;
              const callAction = action?.function;
              return (
                <IconButton
                  key={index}
                  {...(action.type === NavActionType.FUNCTION && {
                    onClick: (event) => {
                      event.stopPropagation();
                      callAction();
                    }
                  })}
                  {...(action.type === NavActionType.LINK && {
                    component: Link,
                    to: action.url,
                    target: action.target ? '_blank' : '_self'
                  })}
                  color="secondary"
                  variant="outlined"
                  sx={(theme) => ({
                    position: 'absolute',
                    top: 12,
                    right: 20,
                    zIndex: 1202,
                    width: 20,
                    height: 20,
                    mr: -1,
                    ml: 1,
                    color: theme.palette.mode === 'dark' ? '#ffffff' : '#061e35',
                    borderColor: alpha(theme.palette.mode === 'dark' ? '#ffffff' : '#061e35', 0.24),
                    '&:hover': { borderColor: theme.palette.mode === 'dark' ? '#ffffff' : '#061e35' }
                  })}
                >
                  <ActionIcon style={{ fontSize: '0.625rem' }} />
                </IconButton>
              );
            })}
          </Tooltip>
        </Box>
      ) : (
        <ListItemButton
          component={Link}
          to={item.url}
          target={itemTarget}
          disabled={item.disabled}
          selected={isSelected}
          onClick={() => itemHandler()}
          sx={{
            zIndex: 1201,
            color: chromeForeground,
            '&.Mui-selected': { color: chromeForeground },
            ...(isParents && { p: 1, mr: 1 })
          }}
        >
          {itemIcon && (
            <ListItemIcon
              sx={{
                minWidth: 28,
                color: 'inherit', // Keep icon color unchanged
                '& svg': {
                  color: 'inherit' // Ensure SVG icons inherit but don't change
                },
                ...(!drawerOpen && {
                  borderRadius: 1.5,
                  width: 28,
                  height: 28,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  '&:hover': { bgcolor: 'transparent' }
                }),
                ...(!drawerOpen && isSelected && { bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' } }),
                '&.Mui-selected': {
                  color: 'inherit !important', // Prevent color change on selection
                  '& svg': {
                    color: 'inherit !important'
                  }
                }
              }}
            >
              {itemIcon}
            </ListItemIcon>
          )}

          {!itemIcon && (
            <ListItemIcon
              sx={{
                color: chromeForeground,
                ...(!drawerOpen && {
                  borderRadius: 1.5,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  '&:hover': { bgcolor: 'transparent' }
                }),
                ...(!drawerOpen && isSelected && { bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent' } })
              }}
            >
              <Dot size={4} sx={{ bgcolor: chromeForeground }} />
            </ListItemIcon>
          )}
          <ListItemText
            primary={
              <Typography variant="h6" sx={{ color: chromeForeground, fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', fontWeight: 700 }}>
                {item.title && <FormattedMessage id={item.title} />}
              </Typography>
            }
          />
          {(drawerOpen || (!drawerOpen && level !== 1)) && item.chip && (
            <Chip
              color={item.chip.color}
              variant={item.chip.variant}
              size={item.chip.size}
              label={item.chip.label}
              avatar={item.chip.avatar && <Avatar>{item.chip.avatar}</Avatar>}
            />
          )}
        </ListItemButton>
      )}
    </>
  );
}

NavItem.propTypes = {
  item: PropTypes.any,
  level: PropTypes.number,
  isParents: PropTypes.bool,
  setSelectedID: PropTypes.oneOfType([PropTypes.func, PropTypes.any]),
  setSelectedItems: PropTypes.oneOfType([PropTypes.func, PropTypes.any]),
  selectedItems: PropTypes.oneOfType([PropTypes.string, PropTypes.any])
};
