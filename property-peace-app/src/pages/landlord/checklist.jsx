import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Divider,
  Chip,
  Button,
  IconButton,
  Grid,
  Paper,
  CircularProgress,
  alpha,
  Checkbox,
  Alert,
  ImageList,
  ImageListItem,
  Card,
  CardContent,
  useMediaQuery
} from '@mui/material';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from 'utils/formatters';
import MainCard from 'components/MainCard';
import { checklistAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import axiosServices from 'utils/axios';

export default function ChecklistPage() {
  const navigate = useNavigate();
  const { checklistId } = useParams();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const beforeImageInputRef = useRef(null);
  const afterImageInputRef = useRef(null);
  const isXs = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // Handle both numeric and string enum values
  const isMoveInChecklist = (type) => {
    if (type == null) return false;
    return type === 40 || 
           String(type).toLowerCase() === 'moveinchecklist' || 
           String(type).toLowerCase() === 'move-inchecklist';
  };

  const isMoveOutChecklist = (type) => {
    if (type == null) return false;
    return type === 41 || 
           String(type).toLowerCase() === 'moveoutchecklist' || 
           String(type).toLowerCase() === 'move-outchecklist';
  };

  useEffect(() => {
    if (checklistId) {
      loadChecklist();
    } else {
      console.error('ChecklistPage: No checklistId provided in URL params');
      openSnackbar({
        open: true,
        message: 'Invalid checklist ID',
        variant: 'alert',
        alert: { color: 'error' }
      });
      navigate(-1);
    }
  }, [checklistId]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const response = await getChecklist(checklistId);
      console.log('Checklist response:', response);
      if (response?.success) {
        setChecklist(response.data);
      } else {
        const errorMessage = response?.message || 'Failed to load checklist';
        console.error('Failed to load checklist:', errorMessage, response);
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
        navigate(-1);
      }
    } catch (error) {
      console.error('Error loading checklist:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load checklist';
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error' }
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (itemId, currentChecked) => {
    if (!checklist) return;

    try {
      // Optimistically update UI
      const updatedItems = checklist.items.map(item =>
        item.id === itemId
          ? { ...item, isChecked: !currentChecked, checkedAt: !currentChecked ? new Date().toISOString() : null }
          : item
      );

      setChecklist({ ...checklist, items: updatedItems });

      // Update via API
      const updatePayload = {
        id: checklist.id,
        items: updatedItems.map(item => ({
          id: item.id,
          isChecked: item.isChecked,
          checkedAt: item.checkedAt
        }))
      };

      await updateChecklist(checklist.id, updatePayload);

      // Check if all items are completed
      const allChecked = updatedItems.every(item => item.isChecked);
      if (allChecked && !checklist.isCompleted) {
        setChecklist({ ...checklist, items: updatedItems, isCompleted: true });
        await updateChecklist(checklist.id, { id: checklist.id, isCompleted: true, completedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Error toggling item:', error);
      openSnackbar({
        open: true,
        message: 'Failed to update checklist item',
        variant: 'alert',
        alert: { color: 'error' }
      });
      // Reload to get correct state
      loadChecklist();
    }
  };

  const handleCheckAll = async () => {
    if (!checklist || !checklist.items || checklist.items.length === 0) return;

    try {
      const allItemsChecked = checklist.items.every(item => item.isChecked);
      const now = new Date().toISOString();

      // Optimistically update UI
      const updatedItems = checklist.items.map(item => ({
        ...item,
        isChecked: !allItemsChecked,
        checkedAt: !allItemsChecked ? now : null
      }));

      setChecklist({ ...checklist, items: updatedItems });

      // Update via API
      const updatePayload = {
        id: checklist.id,
        items: updatedItems.map(item => ({
          id: item.id,
          isChecked: item.isChecked,
          checkedAt: item.checkedAt
        }))
      };

      await updateChecklist(checklist.id, updatePayload);

      // Update completion status if all items are now checked
      if (!allItemsChecked) {
        setChecklist({ ...checklist, items: updatedItems, isCompleted: true });
        await updateChecklist(checklist.id, { id: checklist.id, isCompleted: true, completedAt: now });
      } else if (checklist.isCompleted) {
        setChecklist({ ...checklist, items: updatedItems, isCompleted: false });
        await updateChecklist(checklist.id, { id: checklist.id, isCompleted: false, completedAt: null });
      }
    } catch (error) {
      console.error('Error checking all items:', error);
      openSnackbar({
        open: true,
        message: 'Failed to update checklist items',
        variant: 'alert',
        alert: { color: 'error' }
      });
      // Reload to get correct state
      loadChecklist();
    }
  };

  const handleImageUpload = async (files, isBeforeMoveIn) => {
    if (!checklist || !files || files.length === 0) return;

    try {
      setUploadingImages(true);
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('isBeforeMoveIn', isBeforeMoveIn);

      const response = await axiosServices.post(
        `/api/Checklist/${checklist.id}/upload-images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data?.success) {
        // Update the checklist immediately with the response data
        const updatedChecklist = response.data.data;
        if (updatedChecklist) {
          setChecklist(updatedChecklist);
        }
        
        // Clear the file input
        if (isBeforeMoveIn && beforeImageInputRef.current) {
          beforeImageInputRef.current.value = '';
        } else if (!isBeforeMoveIn && afterImageInputRef.current) {
          afterImageInputRef.current.value = '';
        }
        
        openSnackbar({
          open: true,
          message: 'Images uploaded successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error(response.data?.message || 'Failed to upload images');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      openSnackbar({
        open: true,
        message: 'Failed to upload images',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (blobName, isBeforeMoveIn) => {
    if (!checklist || !blobName) return;

    try {
      setDeletingImage(true);
      const response = await deleteChecklistImage(checklist.id, blobName, isBeforeMoveIn);

      if (response?.success) {
        // Update the checklist immediately with the response data
        const updatedChecklist = response.data;
        if (updatedChecklist) {
          setChecklist(updatedChecklist);
        }
        
        openSnackbar({
          open: true,
          message: 'Image deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error(response?.message || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete image',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeletingImage(false);
    }
  };


  if (loading) {
    return (
      <Box textAlign="center" py={5}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading checklist...
        </Typography>
      </Box>
    );
  }

  if (!checklist) {
    return (
      <Box textAlign="center" py={5}>
        <Typography variant="h6" color="text.secondary">
          Checklist not found.
        </Typography>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  const completedCount = checklist.items?.filter(item => item.isChecked).length || 0;
  const totalCount = checklist.items?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Properties', to: '/landlord/properties' },
          { label: checklist.propertyName || 'Property', to: `/landlord/property/${checklist.propertyId}` },
          { label: checklist.title }
        ]}
      />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(-1)}>
          <ArrowLeftOutlined />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={600}>
            {checklist.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {checklist.unitName ? `${checklist.unitName} - ` : ''}
            {checklist.propertyName}
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* Checklist Info Card */}
        <Grid size={12}>
          <MainCard>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">Inspection Date</Typography>
                <Typography variant="body1">{formatDate(checklist.inspectionDate)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Status</Typography>
                {(() => {
                  // Check if move-out checklist should show "Not Needed"
                  const isMoveOut = isMoveOutChecklist(checklist.checklistType);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const leaseEndDate = checklist.leaseEndDate ? new Date(checklist.leaseEndDate) : null;
                  if (leaseEndDate) {
                    leaseEndDate.setHours(0, 0, 0, 0);
                  }
                  const shouldShowNotNeeded = isMoveOut && leaseEndDate && today < leaseEndDate;
                  
                  if (shouldShowNotNeeded) {
                    return (
                      <Chip
                        label="Not Needed"
                        color="default"
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    );
                  }
                  
                  return (
                    <Chip
                      label={checklist.isCompleted ? 'Completed' : 'In Progress'}
                      color={checklist.isCompleted ? 'success' : 'warning'}
                      size="small"
                      icon={checklist.isCompleted ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      sx={{ mt: 0.5 }}
                    />
                  );
                })()}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Progress</Typography>
                <Typography variant="body1">
                  {completedCount} of {totalCount} items completed ({Math.round(progress)}%)
                </Typography>
              </Box>
            </Stack>
          </MainCard>
        </Grid>

        {/* Images Section */}
        {(isMoveInChecklist(checklist.checklistType) || isMoveOutChecklist(checklist.checklistType)) && (
          <Grid size={12}>
            <MainCard title={isMoveInChecklist(checklist.checklistType) ? 'Before Move-In Photos' : 'After Move-Out Photos'}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <input
                    ref={isMoveInChecklist(checklist.checklistType) ? beforeImageInputRef : afterImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload(e.target.files, isMoveInChecklist(checklist.checklistType))}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UploadOutlined />}
                    onClick={() => {
                      if (isMoveInChecklist(checklist.checklistType)) {
                        beforeImageInputRef.current?.click();
                      } else {
                        afterImageInputRef.current?.click();
                      }
                    }}
                    disabled={uploadingImages}
                  >
                    {uploadingImages ? 'Uploading...' : 'Upload Photos'}
                  </Button>
                </Box>
                {(isMoveInChecklist(checklist.checklistType) 
                  ? checklist.beforeMoveInImagesUrls 
                  : checklist.afterMoveOutImagesUrls)?.length > 0 ? (
                  <ImageList cols={3} rowHeight={200}>
                    {(isMoveInChecklist(checklist.checklistType)
                      ? checklist.beforeMoveInImagesUrls
                      : checklist.afterMoveOutImagesUrls).map((url, index) => {
                      const blobNames = isMoveInChecklist(checklist.checklistType)
                        ? checklist.beforeMoveInImagesBlobNames
                        : checklist.afterMoveOutImagesBlobNames;
                      const blobName = blobNames?.[index];
                      const isBeforeMoveIn = isMoveInChecklist(checklist.checklistType);
                      
                      return (
                        <ImageListItem 
                          key={index}
                          sx={{
                            position: 'relative',
                            '&:hover .delete-icon': {
                              opacity: 1
                            }
                          }}
                        >
                          <img
                            src={url}
                            alt={`${isBeforeMoveIn ? 'Before move-in' : 'After move-out'} ${index + 1}`}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
                          />
                          {blobName && (
                            <IconButton
                              className="delete-icon"
                              onClick={() => handleDeleteImage(blobName, isBeforeMoveIn)}
                              disabled={deletingImage}
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: 'rgba(0, 0, 0, 0.6)',
                                color: 'white',
                                opacity: isXs ? 1 : 0,
                                transition: 'opacity 0.2s',
                                '&:hover': {
                                  bgcolor: 'rgba(0, 0, 0, 0.8)'
                                }
                              }}
                              size="small"
                            >
                              <DeleteOutlined />
                            </IconButton>
                          )}
                        </ImageListItem>
                      );
                    })}
                  </ImageList>
                ) : (
                  <Alert severity="info">No photos uploaded yet</Alert>
                )}
              </Stack>
            </MainCard>
          </Grid>
        )}

        {/* Checklist Items */}
        <Grid size={12}>
          <MainCard 
            title="Checklist Items"
            secondary={
              <Button
                size="small"
                variant="outlined"
                onClick={handleCheckAll}
                disabled={!checklist?.items || checklist.items.length === 0}
              >
                Check All
              </Button>
            }
          >
            <Stack spacing={2}>
              {checklist.items && checklist.items.length > 0 ? (
                checklist.items
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                  .map((item) => (
                    <Card
                      key={item.id}
                      variant="outlined"
                      onClick={() => handleToggleItem(item.id, item.isChecked)}
                      sx={{
                        bgcolor: item.isChecked ? alpha('#41a541', 0.08) : 'transparent',
                        borderColor: item.isChecked ? 'success.main' : 'divider',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: item.isChecked ? alpha('#41a541', 0.12) : alpha('#000', 0.02)
                        }
                      }}
                    >
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Checkbox
                            checked={item.isChecked || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleItem(item.id, item.isChecked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            color="success"
                            sx={{ mt: -1 }}
                          />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography
                              variant="body1"
                              fontWeight={500}
                              sx={{
                                textDecoration: item.isChecked ? 'line-through' : 'none',
                                color: item.isChecked ? 'text.secondary' : 'text.primary'
                              }}
                            >
                              {item.name}
                            </Typography>
                            {item.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {item.description}
                              </Typography>
                            )}
                            {item.category && (
                              <Chip
                                label={item.category}
                                size="small"
                                sx={{ mt: 1, height: 20 }}
                              />
                            )}
                            {item.condition && (
                              <Chip
                                label={`Condition: ${item.condition}`}
                                size="small"
                                variant="outlined"
                                sx={{ mt: 1, ml: 1, height: 20 }}
                              />
                            )}
                            {item.notes && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Notes: {item.notes}
                              </Typography>
                            )}
                            {item.hasDamage && item.damageDescription && (
                              <Alert severity="warning" sx={{ mt: 1 }}>
                                <Typography variant="caption" fontWeight={600}>Damage Reported:</Typography>
                                <Typography variant="body2">{item.damageDescription}</Typography>
                              </Alert>
                            )}
                            {item.isChecked && item.checkedAt && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Checked on {formatDate(item.checkedAt)}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))
              ) : (
                <Alert severity="info">No checklist items found</Alert>
              )}
            </Stack>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
