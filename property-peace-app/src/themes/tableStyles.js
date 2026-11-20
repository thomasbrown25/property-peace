import { alpha } from '@mui/material/styles';

// Shared by MUI tables and responsive grid tables, including the home reference.
// Values are CSS pixels (safe for both React style and MUI styleOverrides).
export function getTableStyles(theme) {
  return {
    container: {
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 8
    },
    header: {
      backgroundColor: alpha(theme.palette.primary.main, 0.025)
    },
    headerCell: {
      color: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamily,
      fontSize: '0.66rem',
      fontWeight: 750,
      letterSpacing: 0.65,
      textTransform: 'uppercase',
      padding: '9.2px 16px',
      borderBottom: `1px solid ${theme.palette.text.primary}`
    },
    row: { borderBottom: `1px solid ${theme.palette.divider}` },
    cell: { padding: '12px 16px' }
  };
}

export function getPortalListTableSx(theme) {
  const dark = theme.palette.mode === 'dark';
  const ink = theme.palette.text.primary;

  return {
    '& .MuiTableCell-head': { borderBottomColor: alpha(ink, dark ? 0.16 : 0.08) },
    '& .MuiTableCell-body': { borderBottomColor: alpha(ink, dark ? 0.12 : 0.055) }
  };
}
