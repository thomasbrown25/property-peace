import { alpha } from '@mui/material/styles';

export default function TableBody(theme) {
  return {
    MuiTableBody: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.background.paper,
          '& .MuiTableRow-root:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.035)
          }
        }
      }
    }
  };
}
