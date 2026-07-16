import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { Delete } from '@mui/icons-material';
import { useDrawer } from 'contexts/DrawerContext';
import { buildImageFromFile } from 'utils/formatters';

const ImageUpload = ({ label = 'Upload Images', onImagesChange, serverImages, singleImage }) => {
  const drawer = useDrawer();
  const [localImages, setLocalImages] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (drawer.isOpenMaintenanceEdit && serverImages) {
      setLocalImages(serverImages);
    }
  }, [drawer.isOpenMaintenanceEdit, serverImages]);

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);

    // Convert files to previewable URLs
    const newImages = files.map(buildImageFromFile);
    console.log('New Images:', newImages);

    const updatedImages = [...localImages, ...newImages];

    setLocalImages(updatedImages);

    if (onImagesChange) {
      onImagesChange(updatedImages);
    }
  };

  const handleRemoveImage = (index) => {
    const updatedImages = localImages.filter((_, i) => i !== index);
    setLocalImages(updatedImages);

    if (onImagesChange) {
      onImagesChange(updatedImages);
    }
  };

  return (
    <Box display="flex" alignItems="start" mb={1} sx={{ width: '100%' }}>
      <Box mr={2} sx={{ minWidth: '150px', height: '100%' }}>
        <Typography variant="body3">{label}</Typography>
      </Box>

      {/* Clickable area to trigger file input */}
      <Box width="100%" pr={2}>
        {!localImages.length > 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            onClick={() => fileInputRef.current.click()}
            width={'100%'}
            sx={{
              border: '2px dashed #ccc',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer'
            }}
          >
            <AddPhotoAlternateIcon fontSize="large" color="action" />
            <Typography variant="body3" mt={1} fontWeight="medium" color="secondary" cursor="pointer" sx={{ width: '100%' }}>
              Click to upload
            </Typography>
            <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
          </Box>
        ) : (
          <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
            {localImages.map((img, index) => (
              <Box
                key={index}
                position="relative"
                width={singleImage ? '100px' : '100%'}
                height="100px"
                borderRadius="8px"
                overflow="hidden"
                sx={{
                  border: '1px solid #ddd'
                }}
              >
                <img
                  src={img?.preview}
                  alt={`Uploaded ${index}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
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
                  onClick={() => handleRemoveImage(index)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ImageUpload;
