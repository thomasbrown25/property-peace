import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Lease Termination',
  message = 'Are you sure you want to end this lease?',
  confirmText = 'End Lease',
  cancelText = 'Cancel',
  confirmColor = 'error' // 'error' for destructive actions, 'success' for positive actions
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} sx={{ '& .MuiDialog-paper': { p: 1, border: '1px solid rgba(255, 255, 255, 0.05)' } }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ margin: '0 auto' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          {cancelText}
        </Button>
        <Button onClick={handleConfirm} color={confirmColor} variant="contained">
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
