import test from 'node:test';
import assert from 'node:assert/strict';
import { darkHeaderOutlinedActionSx, darkHeaderSuccessActionSx } from './darkHeaderActions.mjs';

test('outlined dark-header import and export labels stay white on hover', () => {
  assert.equal(darkHeaderOutlinedActionSx.color, '#fff');
  assert.equal(darkHeaderOutlinedActionSx['&:hover'].color, '#fff');
});

test('disabled outlined dark-header actions remain visibly white instead of theme blue', () => {
  assert.deepEqual(
    {
      color: darkHeaderOutlinedActionSx['&.Mui-disabled'].color,
      opacity: darkHeaderOutlinedActionSx['&.Mui-disabled'].opacity
    },
    { color: '#fff', opacity: 0.55 }
  );
});

test('primary dark-header exports retain white hover and disabled labels', () => {
  assert.equal(darkHeaderSuccessActionSx['&:hover'].color, '#fff');
  assert.deepEqual(
    {
      color: darkHeaderSuccessActionSx['&.Mui-disabled'].color,
      opacity: darkHeaderSuccessActionSx['&.Mui-disabled'].opacity
    },
    { color: '#fff', opacity: 0.55 }
  );
});
