import { getTableStyles } from '../tableStyles';

export default function TableFooter(theme) {
  return { MuiTableFooter: { styleOverrides: { root: {
    ...getTableStyles(theme).header,
    borderTop: `1px solid ${theme.palette.divider}`
  } } } };
}
