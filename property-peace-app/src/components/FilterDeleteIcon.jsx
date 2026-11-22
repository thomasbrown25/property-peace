import { Box, useTheme } from '@mui/material';
import AppIcon from 'components/AppIcon';

/**
 * FilterDeleteIcon - A circular blue icon with a white X for filter chips
 * Matches the design shown in the leases page filter component
 */
export default function FilterDeleteIcon({ fontSize = 14, ...props }) {
  const theme = useTheme();
  
  return (
    <Box
      {...props}
      sx={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        bgcolor: theme.palette.primary.main,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...props.sx
      }}
    >
      <AppIcon
        name="close"
        size={fontSize}
        style={{ 
          color: '#ffffff',
          lineHeight: 1
        }} 
      />
    </Box>
  );
}
