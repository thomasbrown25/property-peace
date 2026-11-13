export default function TableRow() {
  return {
    MuiTableRow: {
      styleOverrides: {
        root: {
          // Only body rows lose their last divider; a one-row header still needs its baseline.
          '&:last-of-type > .MuiTableCell-body': { borderBottom: 'none' }
        }
      }
    }
  };
}
