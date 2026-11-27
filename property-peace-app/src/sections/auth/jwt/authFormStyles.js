import { alpha } from '@mui/system/colorManipulator';

const authControlSize = {
  minHeight: 50,
  borderRadius: '12px'
};

export const authLabelSx = { display: 'block', mb: 0.75, fontSize: 14, fontWeight: 600, color: 'text.primary' };

export const authFieldSx = (theme) => ({
  ...authControlSize,
  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFEFA',
  '& .MuiOutlinedInput-input': {
    fontSize: 16,
    paddingBlock: 0
  },
  '&.MuiInputBase-adornedStart .MuiOutlinedInput-input': { paddingInlineStart: 0 },
  '&.MuiInputBase-adornedEnd .MuiOutlinedInput-input': { paddingInlineEnd: 0 },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'dark' ? alpha(theme.palette.brand.mint, 0.46) : '#7D9086'
  },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
  '&.Mui-focused': {
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}`,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 }
  },
  '&.Mui-error': {
    '& .MuiOutlinedInput-notchedOutline, &:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main' },
    '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.16)}` }
  }
});

const authButtonSx = {
  ...authControlSize,
  fontSize: 15,
  fontWeight: 600,
  textTransform: 'none',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }
};

export const authPrimaryButtonSx = {
  ...authButtonSx,
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  boxShadow: (theme) => `0 2px 6px ${alpha(theme.palette.primary.main, 0.16)}`,
  '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none', transform: 'none' },
  '&.Mui-disabled': { boxShadow: 'none' }
};

export const authSecondaryButtonSx = {
  ...authButtonSx,
  borderWidth: 1,
  borderColor: 'divider',
  color: 'text.primary',
  '&:hover': {
    bgcolor: 'action.hover',
    color: 'text.primary',
    borderColor: 'text.secondary',
    borderWidth: 1,
    boxShadow: 'none',
    transform: 'none'
  },
  '&::after, &:active::after': { boxShadow: 'none' }
};

export const authPasswordAdornmentSx = { mr: -1.25 };

export const authPasswordToggleSx = {
  width: 44,
  height: 44,
  fontSize: 18,
  color: 'text.secondary',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
};
