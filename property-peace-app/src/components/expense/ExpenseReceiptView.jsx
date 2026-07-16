import { useState } from 'react';
import { Box, IconButton, Typography, Dialog, DialogContent, Stack, Chip } from '@mui/material';
import { PictureAsPdf, Image as ImageIcon, Download, Close, Visibility } from '@mui/icons-material';

const ExpenseReceiptView = ({ receipts = [] }) => {
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  if (!receipts || receipts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No receipts uploaded
      </Typography>
    );
  }

  const handleViewReceipt = (receipt) => {
    setSelectedReceipt(receipt);
    setOpenDialog(true);
  };

  const handleDownloadReceipt = async (receipt) => {
    try {
      const url = receipt.blobUrl || receipt.url;
      if (!url) return;

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receipt.id}.${url.includes('.pdf') ? 'pdf' : 'jpg'}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading receipt:', error);
    }
  };

  const getReceiptIcon = (receipt) => {
    const url = receipt?.blobUrl || receipt?.url || '';
    const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
    return isPdf ? (
      <PictureAsPdf sx={{ fontSize: 32, color: 'error.main' }} />
    ) : (
      <ImageIcon sx={{ fontSize: 32, color: 'primary.main' }} />
    );
  };

  const isPdf = (receipt) => {
    const url = receipt?.blobUrl || receipt?.url || '';
    return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  };

  return (
    <>
      <Box display="flex" flexWrap="wrap" gap={1.5}>
        {receipts.map((receipt, index) => {
          const receiptUrl = receipt?.blobUrl || receipt?.url;
          const isReceiptPdf = isPdf(receipt);
          
          return (
            <Box
              key={receipt?.id || `receipt-${index}`}
              position="relative"
              width={80}
              height={80}
              borderRadius={1}
              overflow="hidden"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.main',
                  '& .receipt-actions': {
                    opacity: 1
                  }
                },
                transition: 'all 0.2s ease-in-out'
              }}
              onClick={() => handleViewReceipt(receipt)}
            >
              {isReceiptPdf ? (
                <Stack spacing={0.5} alignItems="center">
                  {getReceiptIcon(receipt)}
                  <Chip
                    label="PDF"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                </Stack>
              ) : receiptUrl ? (
                <img
                  src={receiptUrl}
                  alt={`Receipt ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                getReceiptIcon(receipt)
              )}
              
              {/* Hover actions */}
              <Box
                className="receipt-actions"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  opacity: 0,
                  transition: 'opacity 0.2s ease-in-out'
                }}
              >
                <IconButton
                  size="small"
                  sx={{
                    color: 'common.white',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)'
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewReceipt(receipt);
                  }}
                >
                  <Visibility fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{
                    color: 'common.white',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)'
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadReceipt(receipt);
                  }}
                >
                  <Download fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Receipt View Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'background.default'
          }
        }}
      >
        <Box sx={{ position: 'relative', width: '100%', minHeight: '400px' }}>
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'common.white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
            onClick={() => setOpenDialog(false)}
          >
            <Close />
          </IconButton>
          
          {selectedReceipt && (
            <DialogContent sx={{ p: 0, position: 'relative' }}>
              {isPdf(selectedReceipt) ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    p: 4
                  }}
                >
                  <PictureAsPdf sx={{ fontSize: 80, color: 'error.main' }} />
                  <Typography variant="h6" color="text.primary">
                    PDF Receipt
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <IconButton
                      color="primary"
                      onClick={() => handleDownloadReceipt(selectedReceipt)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'primary.main'
                      }}
                    >
                      <Download />
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={() => window.open(selectedReceipt?.blobUrl || selectedReceipt?.url, '_blank')}
                      sx={{
                        border: '1px solid',
                        borderColor: 'primary.main'
                      }}
                    >
                      <Visibility />
                    </IconButton>
                  </Stack>
                </Box>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2
                  }}
                >
                  <img
                    src={selectedReceipt?.blobUrl || selectedReceipt?.url}
                    alt="Receipt"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      objectFit: 'contain'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div style="padding: 40px; text-align: center;">Unable to load receipt image</div>';
                    }}
                  />
                </Box>
              )}
            </DialogContent>
          )}
        </Box>
      </Dialog>
    </>
  );
};

export default ExpenseReceiptView;

