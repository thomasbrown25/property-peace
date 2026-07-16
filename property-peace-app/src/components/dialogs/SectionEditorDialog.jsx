import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import { CloseOutlined } from '@ant-design/icons';

export default function SectionEditorDialog({ 
  open, 
  onClose, 
  sectionTitle, 
  sectionDescription,
  children 
}) {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {sectionTitle}
            </Typography>
            {sectionDescription && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {sectionDescription}
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.08),
                color: 'error.main'
              }
            }}
          >
            <CloseOutlined />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        {children || (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Section editor coming soon...
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{ textTransform: 'none' }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

SectionEditorDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  sectionTitle: PropTypes.string.isRequired,
  sectionDescription: PropTypes.string,
  children: PropTypes.node
};
