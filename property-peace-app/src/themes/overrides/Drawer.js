// ==============================|| OVERRIDES - DRAWER ||============================== //

export default function Drawer(theme) {
  const bg = theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.primary.main;
  return {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: bg
        }
      }
    }
  };
}
