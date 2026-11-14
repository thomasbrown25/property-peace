import { getTableStyles } from '../tableStyles';

export default function TableContainer(theme) {
  return { MuiTableContainer: { styleOverrides: { root: {
    ...getTableStyles(theme).container,
    boxShadow: 'none'
  } } } };
}
