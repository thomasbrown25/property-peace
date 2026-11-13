import { getTableStyles } from '../tableStyles';

export default function TableCell(theme) {
  const styles = getTableStyles(theme);
  return {
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          ...styles.cell,
          ...styles.row,
          '&.cell-right': {
            justifyContent: 'flex-end', textAlign: 'right',
            '& > *': { justifyContent: 'flex-end', margin: '0 0 0 auto' },
            '& .MuiOutlinedInput-input': { textAlign: 'right' }
          },
          '&.cell-center': {
            justifyContent: 'center', textAlign: 'center',
            '& > *': { justifyContent: 'center', margin: '0 auto' }
          }
        },
        sizeSmall: { padding: '8px 16px' },
        head: styles.headerCell,
        stickyHeader: { backgroundColor: theme.palette.background.paper, backgroundImage: `linear-gradient(${styles.header.backgroundColor}, ${styles.header.backgroundColor})` },
        footer: { fontSize: '0.75rem' }
      }
    }
  };
}
