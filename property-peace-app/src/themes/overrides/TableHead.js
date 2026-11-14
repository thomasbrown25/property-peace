import { getTableStyles } from '../tableStyles';

export default function TableHead(theme) {
  return { MuiTableHead: { styleOverrides: { root: getTableStyles(theme).header } } };
}
