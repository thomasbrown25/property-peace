import { alpha } from '@mui/material/styles';

// Shared by MUI tables and responsive grid tables, including the home reference.
// Values are CSS pixels (safe for both React style and MUI styleOverrides).
export function getTableStyles(theme) {
  const dividerBorder = `1px solid ${theme.palette.divider}`;

  return {
    container: {
      backgroundColor: theme.palette.background.paper,
      border: dividerBorder,
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
      borderBottom: dividerBorder
    },
    row: { borderBottom: dividerBorder },
    cell: { padding: '12px 16px' }
  };
}

export function getManagementGridTableStyles(theme) {
  const { header, headerCell } = getTableStyles(theme);

  return {
    container: {
      bgcolor: 'background.paper',
      border: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
      borderRadius: 3,
      boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`,
      overflow: 'hidden'
    },
    header: { ...header, display: { xs: 'none', md: 'grid' }, gap: 2, px: 2, py: 1.15 },
    heading: { ...headerCell, padding: 0, borderBottom: 'none' },
    row: {
      px: { xs: 1.5, md: 2 },
      py: { xs: 1.5, md: 1.35 },
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
      transition: 'background-color 140ms ease',
      '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
    }
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
