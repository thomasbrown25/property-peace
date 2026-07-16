import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { CloseOutlined, WarningOutlined } from '@ant-design/icons';
import { useTheme } from '@mui/material/styles';

/**
 * UrgentChipWithDismiss - A combined component that shows an URGENT chip with a dismiss button
 * @param {Object} props
 * @param {string} props.conversationId - The ID of the conversation to clear urgency for
 * @param {Function} props.onDismiss - Callback function to handle dismissal
 * @param {Object} props.sx - Additional styles to apply to the container
 * @param {boolean} props.compact - If true, renders in a more compact form (for message bubbles)
 */
export default function UrgentChipWithDismiss({ conversationId, onDismiss, sx = {}, compact = false }) {
  const theme = useTheme();

  const handleClick = async (e) => {
    e.stopPropagation();
    if (onDismiss) {
      await onDismiss(conversationId);
    }
  };

  if (compact) {
    // Compact version for message bubbles - inline style
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0,
          borderRadius: 1,
          overflow: 'hidden',
          ...sx
        }}
      >
        <Chip
          label="URGENT"
          size="small"
          color="error"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            borderRadius: 0,
            borderTopLeftRadius: '4px',
            borderBottomLeftRadius: '4px',
            '& .MuiChip-label': {
              px: 1
            }
          }}
        />
        <Tooltip title="Clear urgent items">
          <IconButton
            size="small"
            onClick={handleClick}
            sx={{
              width: 20,
              height: 20,
              borderRadius: 0,
              borderTopRightRadius: '4px',
              borderBottomRightRadius: '4px',
              bgcolor: theme.palette.error.main,
              color: 'white',
              '&:hover': {
                bgcolor: theme.palette.error.dark
              },
              '& .MuiSvgIcon-root': {
                fontSize: 12
              }
            }}
          >
            <CloseOutlined />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // Standard version for headers - with icon
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        borderRadius: 1,
        overflow: 'hidden',
        ...sx
      }}
    >
      <Chip
        label="URGENT"
        size="small"
        color="error"
        icon={<WarningOutlined />}
        sx={{
          height: 20,
          fontSize: '0.65rem',
          borderRadius: 0,
          borderTopLeftRadius: '4px',
          borderBottomLeftRadius: '4px',
          '& .MuiChip-label': {
            px: 1
          }
        }}
      />
      <Tooltip title="Clear urgent items">
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            width: 20,
            height: 20,
            borderRadius: 0,
            borderTopRightRadius: '4px',
            borderBottomRightRadius: '4px',
            bgcolor: theme.palette.error.main,
            color: 'white',
            '&:hover': {
              bgcolor: theme.palette.error.dark
            },
            '& .MuiSvgIcon-root': {
              fontSize: 12
            }
          }}
        >
          <CloseOutlined />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
