import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Typography,
  IconButton,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import { CloseOutlined, DownloadOutlined } from '@ant-design/icons';
import { generateLeasePdf, getLeasePreviewPdf } from 'api/leaseGeneration';

export default function LeasePreviewModal({ open, onClose, leaseInstanceId, leaseId, confirmMode, onConfirm, confirmLabel = 'Confirm & Complete', submitting = false }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
  const pdfUrlRef = useRef(null);

  const loadPdf = useCallback(async () => {
    if (leaseInstanceId) {
      setLoading(true);
      setError(null);
      try {
        const pdfBlob = await generateLeasePdf(leaseInstanceId);
        if (pdfBlob) {
          const url = URL.createObjectURL(pdfBlob);
          if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
          pdfUrlRef.current = url;
          setPdfUrl(url);
        } else {
          setError('Failed to generate PDF preview');
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err?.response?.data?.message || err?.message || 'Failed to load lease preview');
      } finally {
        setLoading(false);
      }
    } else if (leaseId) {
      setLoading(true);
      setError(null);
      try {
        const pdfBlob = await getLeasePreviewPdf(leaseId);
        if (pdfBlob) {
          const url = URL.createObjectURL(pdfBlob);
          if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
          pdfUrlRef.current = url;
          setPdfUrl(url);
        } else {
          setError('Failed to generate PDF preview');
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err?.response?.data?.message || err?.message || 'Failed to load lease preview');
      } finally {
        setLoading(false);
      }
    } else {
      setError('No lease available for preview');
    }
  }, [leaseInstanceId, leaseId]);

  useEffect(() => {
    if (open && (leaseInstanceId || leaseId)) {
      loadPdf();
    } else {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
      setPdfUrl(null);
      setError(null);
    }

    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, [open, leaseInstanceId, leaseId, loadPdf]);

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `lease-${leaseId || leaseInstanceId || 'preview'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClose = () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfUrl(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={600}>
            Lease Agreement Preview
          </Typography>
          <IconButton
            onClick={handleClose}
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

      <DialogContent
        sx={{
          p: 0,
          position: 'relative',
          minHeight: 400,
          bgcolor: alpha(theme.palette.grey[500], 0.1)
        }}
      >
        {loading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400,
              gap: 2
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Generating preview...
            </Typography>
          </Box>
        )}

        {error && !loading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400,
              gap: 2,
              p: 3
            }}
          >
            <Typography variant="h6" color="error">
              Unable to Load Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {error}
            </Typography>
            <Button
              variant="outlined"
              onClick={loadPdf}
              sx={{ mt: 1 }}
            >
              Try Again
            </Button>
          </Box>
        )}

        {pdfUrl && !loading && !error && (
          <Box
            sx={{
              width: '100%',
              height: '70vh',
              minHeight: 400
            }}
          >
            <iframe
              src={pdfUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              title="Lease Agreement Preview"
            />
          </Box>
        )}

        {!leaseInstanceId && !leaseId && !loading && !error && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400,
              gap: 2,
              p: 3
            }}
          >
            <Typography variant="h6" color="text.secondary">
              No Lease Available
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Please complete at least one section before previewing your lease agreement.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Button
          onClick={handleClose}
          disabled={submitting}
          sx={{ textTransform: 'none' }}
        >
          {confirmMode ? 'Cancel' : 'Close'}
        </Button>
        {confirmMode ? (
          pdfUrl && (
            <Button
              variant="contained"
              onClick={() => onConfirm?.()}
              disabled={submitting}
              sx={{ textTransform: 'none' }}
            >
              {submitting ? 'Completing...' : confirmLabel}
            </Button>
          )
        ) : (
          pdfUrl && (
            <Button
              variant="contained"
              startIcon={<DownloadOutlined />}
              onClick={handleDownload}
              sx={{ textTransform: 'none' }}
            >
              Download PDF
            </Button>
          )
        )}
      </DialogActions>
    </Dialog>
  );
}

LeasePreviewModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  leaseInstanceId: PropTypes.number,
  leaseId: PropTypes.number,
  confirmMode: PropTypes.bool,
  onConfirm: PropTypes.func,
  confirmLabel: PropTypes.string,
  submitting: PropTypes.bool
};
