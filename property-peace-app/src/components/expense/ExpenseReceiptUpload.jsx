import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, Stack } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { Delete, PictureAsPdf, Image as ImageIcon } from '@mui/icons-material';
import { buildImageFromFile } from 'utils/formatters';

const ExpenseReceiptUpload = ({ receipts = [], onReceiptsChange, disabled = false }) => {
  const [localReceipts, setLocalReceipts] = useState([]);
  const fileInputRef = useRef(null);

  // Initialize with existing receipts from server (only sync server receipts, not local uploads)
  useEffect(() => {
    // Only sync if receipts have server IDs (from database) and no file property
    const serverReceipts = receipts?.filter(r => r.id && !r.file && !r.preview?.includes('blob:'));
    
    if (serverReceipts && serverReceipts.length > 0) {
      const formattedReceipts = serverReceipts.map((receipt) => ({
        id: receipt.id,
        blobUrl: receipt.blobUrl,
        isExisting: true,
        preview: receipt.blobUrl || receipt.preview
      }));
      
      // Merge with existing local uploads (those with file or blob: preview)
      setLocalReceipts(prev => {
        const localUploads = prev.filter(r => r.file || (r.preview && r.preview.includes('blob:')));
        const serverIds = formattedReceipts.map(r => r.id);
        // Remove old server receipts that are no longer in props
        const remainingLocal = localUploads.filter(r => !r.id || serverIds.includes(r.id));
        return [...formattedReceipts, ...remainingLocal];
      });
    } else if (!receipts || receipts.length === 0) {
      // Only clear if we don't have local uploads
      setLocalReceipts(prev => {
        const hasLocalUploads = prev.some(r => r.file || (r.preview && r.preview.includes('blob:')));
        return hasLocalUploads ? prev : [];
      });
    }
  }, [receipts?.filter(r => r.id && !r.file).map(r => r.id).join(',')]);

  const handleReceiptUpload = (event) => {
    const files = Array.from(event.target.files);
    
    // Convert files to previewable URLs (same as MaintenanceImageUpload)
    const newReceipts = files.map(buildImageFromFile);
    console.log('New Receipts:', newReceipts);
    console.log('Receipt preview URLs:', newReceipts.map(r => r.preview));
    
    const updatedReceipts = [...localReceipts, ...newReceipts];
    setLocalReceipts(updatedReceipts);
    console.log('Updated receipts:', updatedReceipts);
    console.log('Updated receipts previews:', updatedReceipts.map(r => r.preview));
    
    if (onReceiptsChange) {
      onReceiptsChange(updatedReceipts);
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleRemoveReceipt = (index) => {
    const receiptToRemove = localReceipts[index];
    const updatedReceipts = localReceipts.filter((_, i) => i !== index);
    setLocalReceipts(updatedReceipts);
    
    // If it's an existing receipt, mark it for deletion
    if (receiptToRemove?.isExisting && receiptToRemove?.id) {
      if (onReceiptsChange) {
        onReceiptsChange(updatedReceipts, { deletedReceiptId: receiptToRemove.id });
      }
    } else if (onReceiptsChange) {
      onReceiptsChange(updatedReceipts);
    }
  };

  const getFileIcon = (receipt) => {
    if (receipt?.blobUrl || receipt?.preview) {
      const url = receipt.blobUrl || receipt.preview || '';
      if (url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')) {
        return <PictureAsPdf fontSize="large" color="error" />;
      }
      return <ImageIcon fontSize="large" color="primary" />;
    }
    return <AddPhotoAlternateIcon fontSize="large" color="action" />;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
        Receipts (Optional)
      </Typography>
      
      {/* Upload area */}
      <Box
        onClick={() => !disabled && fileInputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          padding: 2,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          '&:hover': {
            borderColor: disabled ? 'divider' : 'primary.main',
            backgroundColor: disabled ? 'transparent' : 'action.hover'
          },
          transition: 'all 0.2s ease-in-out',
          mb: localReceipts.length > 0 ? 2 : 0
        }}
      >
        <Stack spacing={1} alignItems="center">
          <AddPhotoAlternateIcon fontSize="large" color={disabled ? 'disabled' : 'action'} />
          <Typography variant="body2" color="text.secondary">
            {disabled ? 'Upload disabled' : 'Click to upload receipts'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supports images and PDFs
          </Typography>
        </Stack>
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleReceiptUpload}
          disabled={disabled}
        />
      </Box>

      {/* Preview receipts - same pattern as MaintenanceImageUpload */}
      {localReceipts.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
          {localReceipts.map((receipt, index) => {
            // Check if it's a PDF (same pattern as MaintenanceImageUpload but with PDF support)
            const isPdf = receipt?.file?.name?.toLowerCase().endsWith('.pdf');
            console.log(`Receipt ${index}:`, receipt);
            console.log(`Receipt ${index} preview:`, receipt?.preview);
            
            return (
              <Box
                key={receipt?.id || index}
                position="relative"
                width="100px"
                height="100px"
                borderRadius="8px"
                overflow="hidden"
                sx={{
                  border: '1px solid #ddd'
                }}
              >
                {isPdf ? (
                  <Box 
                    display="flex" 
                    flexDirection="column" 
                    alignItems="center" 
                    justifyContent="center"
                    sx={{ width: '100%', height: '100%', p: 1 }}
                  >
                    <PictureAsPdf sx={{ fontSize: 48, color: 'error.main' }} />
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      PDF
                    </Typography>
                  </Box>
                ) : (
                  <img
                    src={receipt?.preview}
                    alt={`Uploaded ${index}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onLoad={() => console.log(`Image ${index} loaded successfully`)}
                    onError={(e) => {
                      console.error(`Image ${index} failed to load:`, receipt?.preview);
                      console.error('Receipt object:', receipt);
                    }}
                  />
                )}
                
                {!disabled && (
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      color: '#fff',
                      background: 'rgba(0,0,0,0.5)',
                      '&:hover': { background: 'rgba(0,0,0,0.7)' }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveReceipt(index);
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default ExpenseReceiptUpload;

