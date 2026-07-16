// material-ui
import { alpha } from '@mui/system';

// ==============================|| OVERRIDES - DIALOG ||============================== //

export default function Dialog() {
  return {
    MuiDialog: {
      styleOverrides: {
        root: {
          '& .MuiBackdrop-root': {
            backgroundColor: alpha('#000', 0.7)
          }
        },
        paper: {
          backgroundImage: 'none'
        }
      }
    }
  };
}
