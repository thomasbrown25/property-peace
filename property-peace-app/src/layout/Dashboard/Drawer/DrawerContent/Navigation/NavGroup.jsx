import PropTypes from 'prop-types';
import { Fragment, useEffect, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

// material-ui
import { styled } from '@mui/material/styles';
import {
  useMediaQuery,
  useTheme,
  ClickAwayListener,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popper,
  Typography,
  Box
} from '@mui/material';

// third-party
import { FormattedMessage } from 'react-intl';

// project imports
import NavItem from './NavItem';
import NavCollapse from './NavCollapse';
import SimpleBar from 'components/third-party/SimpleBar';
import Transitions from 'components/@extended/Transitions';

import { MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import { useGetMenuMaster } from 'api/menu';

// assets
import DownOutlined from '@ant-design/icons/DownOutlined';
import GroupOutlined from '@ant-design/icons/GroupOutlined';
import RightOutlined from '@ant-design/icons/RightOutlined';

const PopperStyled = styled(Popper)(({ theme }) => ({
  overflow: 'visible',
  zIndex: 1202,
  minWidth: 180,
  '&:before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    top: 5,
    left: 32,
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

export default function NavGroup({
  item,
  lastItem,
  remItems,
  lastItemId,
  selectedID,
  setSelectedID,
  setSelectedItems,
  selectedItems,
  setSelectedLevel,
  selectedLevel
}) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const { menuOrientation } = useConfig();

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const [anchorEl, setAnchorEl] = useState(null);
  const [currentItem, setCurrentItem] = useState(item);

  const openMini = Boolean(anchorEl);

  useEffect(() => {
    if (lastItem) {
      if (item.id === lastItemId) {
        const localItem = { ...item };
        const elements = remItems.map((ele) => ele.elements);
        localItem.children = elements.flat(1);
        console.log('elements', elements);
        setCurrentItem(localItem);
      } else {
        setCurrentItem(item);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, lastItem, downLG]);

  const checkOpenForParent = (child, id) => {
    child.forEach((ele) => {
      if (ele.children?.length) {
        checkOpenForParent(ele.children, currentItem.id);
      }

      if (ele.url && !!matchPath({ path: ele?.link ? ele.link : ele.url, end: true }, pathname)) {
        setSelectedID(id);
      }
    });
  };

  const checkSelectedOnload = (data) => {
    const childrens = data.children ? data.children : [];
    childrens.forEach((itemCheck) => {
      if (itemCheck?.children?.length) {
        checkOpenForParent(itemCheck.children, currentItem.id);
      }

      if (itemCheck && itemCheck?.url && !!matchPath({ path: itemCheck?.link ? itemCheck.link : itemCheck.url, end: true }, pathname)) {
        setSelectedID(currentItem.id);
      }
    });
  };

  useEffect(() => {
    checkSelectedOnload(currentItem);
    if (openMini) setAnchorEl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentItem]);

  const handleClick = (event) => {
    if (!openMini) {
      setAnchorEl(event?.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const isSelected = selectedID === currentItem.id;

  const Icon = currentItem?.icon ? currentItem.icon : null;
  const itemIcon = Icon ? <Icon style={{ fontSize: 20, stroke: '1.5' }} /> : null;

  const navCollapse = item.children?.map((menuItem, index) => {
    switch (menuItem.type) {
      case 'collapse':
        return (
          <NavCollapse
            key={menuItem.id}
            menu={menuItem}
            setSelectedItems={setSelectedItems}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            selectedItems={selectedItems}
            level={1}
            parentId={currentItem.id}
          />
        );
      case 'item':
        return <NavItem key={menuItem.id} item={menuItem} level={1} setSelectedItems={setSelectedItems} selectedItems={selectedItems} />;
      case 'divider':
        return (
          <Divider
            key={menuItem.id || `divider-${index}`}
            sx={{ my: 0.5, borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'divider' }}
          />
        );
      default:
        return (
          <Typography key={index} variant="h6" color="error" align="center">
            Fix - Group Collapse or Items
          </Typography>
        );
    }
  });

  const moreItems = remItems.map((itemRem, i) => (
    <Fragment key={i}>
      {itemRem.url ? (
        <NavItem item={itemRem} level={1} setSelectedItems={setSelectedItems} selectedItems={selectedItems} />
      ) : (
        itemRem.title && (
          <Typography variant="caption" sx={{ pl: 2 }}>
            {itemRem.title} {itemRem.url}
          </Typography>
        )
      )}

      {itemRem?.elements?.map((menu) => {
        switch (menu.type) {
          case 'collapse':
            return (
              <NavCollapse
                key={menu.id}
                menu={menu}
                level={1}
                parentId={currentItem.id}
                setSelectedItems={setSelectedItems}
                setSelectedLevel={setSelectedLevel}
                selectedLevel={selectedLevel}
                selectedItems={selectedItems}
              />
            );
          case 'item':
            return <NavItem key={menu.id} item={menu} level={1} setSelectedItems={setSelectedItems} selectedItems={selectedItems} />;
          case 'divider':
            return (
              <Divider
                key={menu.id}
                sx={{ my: 0.5, borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(6,30,53,0.14)' }}
              />
            );
          default:
            return (
              <Typography key={menu.id} variant="h6" color="error" align="center">
                Menu Items Error
              </Typography>
            );
        }
      })}
    </Fragment>
  ));

  // menu list collapse & items
  const items = currentItem.children?.map((menu, index) => {
    switch (menu?.type) {
      case 'collapse':
        return (
          <NavCollapse
            key={menu.id}
            menu={menu}
            level={1}
            parentId={currentItem.id}
            setSelectedItems={setSelectedItems}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            selectedItems={selectedItems}
          />
        );
      case 'item':
        return <NavItem key={menu.id} item={menu} level={1} setSelectedItems={setSelectedItems} selectedItems={selectedItems} />;
      case 'divider':
        return (
          <Divider
            key={menu.id || `divider-${index}`}
            sx={{ my: 0.5, borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(6,30,53,0.14)' }}
          />
        );
      default:
        return (
          <Typography key={menu?.id} variant="h6" color="error" align="center">
            Menu Items Error
          </Typography>
        );
    }
  });

  const popperId = openMini ? `group-pop-${item.id}` : undefined;

  return (
    <>
      {menuOrientation === MenuOrientation.VERTICAL || downLG ? (
        <List
          subheader={
            <>
              {item.title ? (
                drawerOpen && (
                  <Box sx={{ pl: 3, mb: 1.5 }}>
                    {item.title && (
                      <Typography
                        variant="subtitle1"
                        sx={{
                          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.64)' : 'rgba(6,30,53,0.64)',
                          fontFamily: "'Inter', sans-serif",
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          lineHeight: 1.4,
                          textTransform: 'uppercase'
                        }}
                      >
                        <FormattedMessage id={item.title} defaultMessage={item.title} />
                      </Typography>
                    )}
                    {item.caption && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.64)' : 'rgba(6,30,53,0.64)',
                          fontFamily: "'Inter', sans-serif"
                        }}
                      >
                        <FormattedMessage id={item.caption} />
                      </Typography>
                    )}
                  </Box>
                )
              ) : null}
            </>
          }
          sx={{ mt: drawerOpen && item.title ? 1.5 : 0, py: 0, zIndex: 0 }}
        >
          {navCollapse}
        </List>
      ) : (
        <List>
          <ListItemButton
            selected={isSelected}
            sx={{
              p: 1,
              my: 0.5,
              mr: 1,
              display: 'flex',
              alignItems: 'center',
              color: theme.palette.mode === 'dark' ? 'common.white' : '#061e35',
              '&.Mui-selected': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'transparent' }
            }}
            onMouseEnter={handleClick}
            onClick={handleClick}
            onMouseLeave={handleClose}
            aria-describedby={popperId}
            className={anchorEl ? 'Mui-selected' : ''}
          >
            {(itemIcon || currentItem.id === lastItemId) && (
              <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
                {currentItem.id === lastItemId ? <GroupOutlined style={{ fontSize: 20, stroke: '1.5' }} /> : itemIcon}
              </ListItemIcon>
            )}
            <ListItemText
              sx={{ mr: 1 }}
              primary={
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.mode === 'dark' ? 'common.white' : '#061e35',
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  {(currentItem.id === lastItemId || currentItem.title) && (
                    <FormattedMessage id={currentItem.id === lastItemId ? 'more-items' : currentItem.title} />
                  )}
                </Typography>
              }
            />
            {console.log('currentItem', currentItem)}
            {console.log('lastItemId', lastItemId)}
            {openMini ? (
              <DownOutlined style={{ fontSize: 16, stroke: '1.5' }} />
            ) : (
              <RightOutlined style={{ fontSize: 16, stroke: '1.5' }} />
            )}
            {anchorEl && (
              <PopperStyled id={popperId} open={openMini} anchorEl={anchorEl} placement="bottom-start" style={{ zIndex: 2001 }}>
                {({ TransitionProps }) => (
                  <Transitions in={openMini} {...TransitionProps}>
                    <Paper
                      sx={(theme) => ({
                        mt: 0.5,
                        py: 1.25,
                        boxShadow: theme.shadows[8],
                        backgroundImage: 'none',
                        bgcolor: theme.palette.mode === 'dark' ? '#0b2a46' : 'background.paper',
                        color: theme.palette.mode === 'dark' ? 'common.white' : 'text.primary'
                      })}
                    >
                      <ClickAwayListener onClickAway={handleClose}>
                        <>
                          <SimpleBar sx={{ minWidth: 200, overflowX: 'hidden', overflowY: 'auto', maxHeight: 'calc(100vh - 170px)' }}>
                            {currentItem.id !== lastItemId ? items : moreItems}
                          </SimpleBar>
                        </>
                      </ClickAwayListener>
                    </Paper>
                  </Transitions>
                )}
              </PopperStyled>
            )}
          </ListItemButton>
        </List>
      )}
    </>
  );
}

NavGroup.propTypes = {
  item: PropTypes.any,
  lastItem: PropTypes.number,
  remItems: PropTypes.array,
  lastItemId: PropTypes.string,
  selectedID: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
  setSelectedID: PropTypes.oneOfType([PropTypes.func, PropTypes.any]),
  setSelectedItems: PropTypes.oneOfType([PropTypes.func, PropTypes.any]),
  selectedItems: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
  setSelectedLevel: PropTypes.func,
  selectedLevel: PropTypes.number
};
