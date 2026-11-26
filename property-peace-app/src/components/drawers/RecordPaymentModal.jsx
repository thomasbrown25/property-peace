import PropTypes from 'prop-types';
import { RecordPaymentOverlay } from './RecordPaymentDrawer';

export default function RecordPaymentModal({ open, onClose, onSuccess }) {
  return <RecordPaymentOverlay open={open} onClose={onClose} onSuccess={onSuccess} presentation="modal" />;
}

RecordPaymentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
};
