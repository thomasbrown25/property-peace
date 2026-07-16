import { useState, useRef, useEffect } from 'react';
import { Grid, IconButton, Box, Typography, InputLabel } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDrawer } from 'contexts/DrawerContext';
import { buildImageFromFile } from 'utils/formatters';

const MaintenanceImageUpload = ({ onImagesChange, serverImages }) => {
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
    <>
      <Grid size={{ xs: 12, sm: 3 }}>
        <InputLabel>Upload Images</InputLabel>
      </Grid>

      {/* Clickable area to trigger file input */}
      <Grid size={{ xs: 12, sm: 9 }}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          onClick={() => fileInputRef.current.click()}
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
            Click to upload (or drag & drop)
          </Typography>
          <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
        </Box>

        {/* Preview images */}
        {localImages.length > 0 && (
          <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
            {localImages.map((img, index) => (
              <Box
                key={index}
                position="relative"
                width="100px"
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
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Grid>
    </>
  );
};

export default MaintenanceImageUpload;
