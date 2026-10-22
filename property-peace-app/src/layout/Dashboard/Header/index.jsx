import { AppBar, Toolbar } from '@mui/material';
import HeaderContent from './HeaderContent';

// Full-width app bar: the logo and navigation now live here instead of in a side drawer.
export default function Header() {
  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={(theme) => ({
        bgcolor: theme.palette.mode === 'dark' ? '#061e35' : 'common.white',
        color: theme.palette.mode === 'dark' ? 'common.white' : '#061e35',
        borderBottom: '1px solid',
        borderBottomColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'divider',
        boxShadow: theme.palette.mode === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.22)' : '0 4px 14px rgba(6, 30, 53, 0.08)',
        zIndex: theme.zIndex.appBar,
        width: '100%'
      })}
    >
      <Toolbar sx={{ minHeight: { xs: 68, sm: 84 }, height: { xs: 68, sm: 84 }, py: 0, px: { xs: 2, sm: 2.5 }, gap: { xs: 1, sm: 2 } }}>
        <HeaderContent />
      </Toolbar>
    </AppBar>
  );
}
