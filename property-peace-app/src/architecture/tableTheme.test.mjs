import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const appRoot = fileURLToPath(new URL('../..', import.meta.url));

test('tables share the home reference styling in both themes', async (t) => {
  const vite = await createServer({ root: appRoot, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } });
  t.after(() => vite.close());
  const { getTableStyles } = await vite.ssrLoadModule('/src/themes/tableStyles.js');
  const load = async (name) => (await vite.ssrLoadModule(`/src/themes/overrides/${name}.js`)).default;
  const [cell, head, row, container, body, footer] = await Promise.all(['TableCell', 'TableHead', 'TableRow', 'TableContainer', 'TableBody', 'TableFooter'].map(load));
  for (const mode of ['light', 'dark']) {
    const theme = { palette: { mode, primary: { main: '#247568' }, divider: mode === 'light' ? '#d9dfdb' : '#3a514b', text: { primary: mode === 'light' ? '#24343a' : '#ffffff', secondary: '#728079' }, background: { paper: mode === 'light' ? '#ffffff' : '#1a302d' } }, typography: { fontFamily: 'Public Sans, sans-serif' } };
    const styles = getTableStyles(theme);
    const cells = cell(theme).MuiTableCell.styleOverrides;
    assert.deepEqual(container(theme).MuiTableContainer.styleOverrides.root, { ...styles.container, boxShadow: 'none' });
    assert.deepEqual(head(theme).MuiTableHead.styleOverrides.root, styles.header);
    assert.deepEqual(cells.head, styles.headerCell);
    assert.equal(cells.head.borderBottom, `1px solid ${theme.palette.text.primary}`);
    assert.equal(cells.root.borderBottom, `1px solid ${theme.palette.divider}`);
    assert.equal(cells.head.textTransform, 'uppercase');
    assert.equal(cells.head.fontWeight, 750);
    assert.equal(cells.head.fontSize, '0.66rem');
    assert.equal(cells.head['&:not(:last-of-type)'], undefined, 'No vertical header separators');
    assert.deepEqual(row(theme).MuiTableRow.styleOverrides.root, { '&:last-of-type > .MuiTableCell-body': { borderBottom: 'none' } });
    assert.equal(cells.stickyHeader.backgroundColor, theme.palette.background.paper, 'Sticky cells stay opaque');
    assert.equal(body(theme).MuiTableBody.styleOverrides.root.backgroundColor, theme.palette.background.paper);
    assert.equal(footer(theme).MuiTableFooter.styleOverrides.root.borderTop, `1px solid ${theme.palette.divider}`);
  }
});
