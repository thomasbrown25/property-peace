import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ClickAwayListener, IconButton, Paper, Popper, Tooltip } from '@mui/material';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import Search from './Search';

// Search stays out of the toolbar until requested. The panel is anchored below
// the icon rather than taking over the page or pushing header content sideways.
export default function MobileSearch() {
  const [anchor, setAnchor] = useState(null);
  const { pathname } = useLocation();
  const open = Boolean(anchor);

  useEffect(() => setAnchor(null), [pathname]);

  return (
    <>
      <Tooltip title="Search">
        <IconButton
          aria-label="Open global search"
          aria-controls={open ? 'header-search-panel' : undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={(event) => setAnchor((current) => current ? null : event.currentTarget)}
          sx={(theme) => ({
            color: theme.palette.mode === 'dark' ? 'common.white' : 'text.primary',
            flexShrink: 0,
            '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'action.hover' }
          })}
        >
          <SearchOutlined />
        </IconButton>
      </Tooltip>
      <Popper open={open} anchorEl={anchor} placement="bottom-end" sx={{ zIndex: (theme) => theme.zIndex.modal }}>
        <ClickAwayListener onClickAway={() => setAnchor(null)}>
          <Paper
            id="header-search-panel"
            role="dialog"
            aria-label="Search properties, tenants, and leases"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setAnchor(null);
                anchor?.focus();
              }
            }}
            sx={{
              width: 'min(420px, calc(100vw - 24px))', p: 1.5, mt: 1,
              boxShadow: (theme) => theme.customShadows.z1, overflow: 'visible',
              transformOrigin: 'top right',
              animation: 'searchDrop 160ms ease-out both',
              '@keyframes searchDrop': { from: { opacity: 0, transform: 'translateY(-8px) scale(0.98)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
            }}
          >
            {open && <Search autoFocus onResultSelect={() => setAnchor(null)} />}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
