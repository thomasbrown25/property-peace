export const darkHeaderOutlinedActionSx = {
  color: '#fff',
  borderColor: 'rgba(255, 255, 255, 0.35)',
  bgcolor: 'rgba(255, 255, 255, 0.06)',
  textTransform: 'none',
  '&:hover': {
    color: '#fff',
    borderColor: 'rgba(255, 255, 255, 0.65)',
    bgcolor: 'rgba(255, 255, 255, 0.12)'
  },
  '&.Mui-disabled': {
    color: '#fff',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    bgcolor: 'rgba(255, 255, 255, 0.08)',
    opacity: 0.55
  }
};

export const darkHeaderSuccessActionSx = {
  color: '#fff',
  textTransform: 'none',
  fontWeight: 700,
  boxShadow: 'none',
  '&:hover': {
    color: '#fff',
    boxShadow: 'none'
  },
  '&.Mui-disabled': {
    color: '#fff',
    bgcolor: 'rgba(22, 163, 74, 0.55)',
    opacity: 0.55
  }
};
