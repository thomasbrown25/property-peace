// ==============================|| OVERRIDES - TABLE CELL ||============================== //

export default function TableHead(theme) {
  return {
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.surface.nested,
          borderTop: '1px solid',
          borderTopColor: theme.palette.divider,
          borderBottom: '2px solid',
          borderBottomColor: theme.palette.divider
        }
      }
    }
  };
}
