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
  CircularProgress,
  alpha,
  Checkbox,
  Alert,
  ImageList,
  ImageListItem,
  Card,
  CardContent,
  Tabs,
  Tab,
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
import { Fade } from '@mui/material';

function TabPanel({ value, index, children }) {
  return (
    <Fade in={value === index} timeout={400} unmountOnExit>
      <Box role="tabpanel" hidden={value !== index} sx={{ flex: 1, minWidth: 0 }}>
        {children}
      </Box>
    </Fade>
  );
}

export default function UnitChecklistsPage() {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const [moveInChecklist, setMoveInChecklist] = useState(null);
  const [moveOutChecklist, setMoveOutChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = Move-In, 1 = Move-Out
  const beforeImageInputRef = useRef(null);
  const afterImageInputRef = useRef(null);
  const isXs = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // Get the currently active checklist based on tab
  const currentChecklist = activeTab === 0 ? moveInChecklist : moveOutChecklist;

  useEffect(() => {
    if (unitId) {
      loadChecklists();
    } else {
      console.error('UnitChecklistsPage: No unitId provided in URL params');
      openSnackbar({
        open: true,
        message: 'Invalid unit ID',
        variant: 'alert',
        alert: { color: 'error' }
      });
      navigate(-1);
    }
  }, [unitId]);

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const response = await getChecklistsByUnit(unitId);
      console.log('Unit checklists response:', response);
      if (response?.success) {
        const checklists = response.data || [];
        
        // Find move-in and move-out checklists
        const moveIn = checklists.find(c => 
          c.checklistType === 40 || 
          String(c.checklistType).toLowerCase() === 'moveinchecklist' ||
          String(c.checklistType).toLowerCase() === 'move-inchecklist'
        );
        const moveOut = checklists.find(c => 
          c.checklistType === 41 || 
          String(c.checklistType).toLowerCase() === 'moveoutchecklist' ||
          String(c.checklistType).toLowerCase() === 'move-outchecklist'
        );
        
        setMoveInChecklist(moveIn || null);
        setMoveOutChecklist(moveOut || null);
        
        // If no checklists found, show message
        if (!moveIn && !moveOut) {
          openSnackbar({
            open: true,
            message: 'No checklists found for this unit',
            variant: 'alert',
            alert: { color: 'info' }
          });
        }
      } else {
        const errorMessage = response?.message || 'Failed to load checklists';
        console.error('Failed to load checklists:', errorMessage, response);
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load checklists';
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (checklist, itemId, currentChecked) => {
    if (!checklist) return;

    try {
      // Optimistically update UI
      const updatedItems = checklist.items.map(item =>
        item.id === itemId
          ? { ...item, isChecked: !currentChecked, checkedAt: !currentChecked ? new Date().toISOString() : null }
          : item
      );

      const updatedChecklist = { ...checklist, items: updatedItems };
      
      // Update the appropriate checklist state
      if (activeTab === 0) {
        setMoveInChecklist(updatedChecklist);
      } else {
        setMoveOutChecklist(updatedChecklist);
      }

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
        const finalChecklist = { ...updatedChecklist, isCompleted: true };
        if (activeTab === 0) {
          setMoveInChecklist(finalChecklist);
        } else {
          setMoveOutChecklist(finalChecklist);
        }
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
      loadChecklists();
    }
  };

  const handleCheckAll = async () => {
    if (!currentChecklist || !currentChecklist.items || currentChecklist.items.length === 0) return;

    try {
      const allItemsChecked = currentChecklist.items.every(item => item.isChecked);
      const now = new Date().toISOString();

      // Optimistically update UI
      const updatedItems = currentChecklist.items.map(item => ({
        ...item,
        isChecked: !allItemsChecked,
        checkedAt: !allItemsChecked ? now : null
      }));

      const updatedChecklist = { ...currentChecklist, items: updatedItems };

      // Update the appropriate checklist state
      if (activeTab === 0) {
        setMoveInChecklist(updatedChecklist);
      } else {
        setMoveOutChecklist(updatedChecklist);
      }

      // Update via API
      const updatePayload = {
        id: currentChecklist.id,
        items: updatedItems.map(item => ({
          id: item.id,
          isChecked: item.isChecked,
          checkedAt: item.checkedAt
        }))
      };

      await updateChecklist(currentChecklist.id, updatePayload);

      // Update completion status if all items are now checked
      if (!allItemsChecked) {
        const finalChecklist = { ...updatedChecklist, isCompleted: true };
        if (activeTab === 0) {
          setMoveInChecklist(finalChecklist);
        } else {
          setMoveOutChecklist(finalChecklist);
        }
        await updateChecklist(currentChecklist.id, { id: currentChecklist.id, isCompleted: true, completedAt: now });
      } else if (currentChecklist.isCompleted) {
        const finalChecklist = { ...updatedChecklist, isCompleted: false };
        if (activeTab === 0) {
          setMoveInChecklist(finalChecklist);
        } else {
          setMoveOutChecklist(finalChecklist);
        }
        await updateChecklist(currentChecklist.id, { id: currentChecklist.id, isCompleted: false, completedAt: null });
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
      loadChecklists();
    }
  };

  const handleImageUpload = async (files, isBeforeMoveIn) => {
    if (!currentChecklist || !files || files.length === 0) return;

    try {
      setUploadingImages(true);
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('isBeforeMoveIn', isBeforeMoveIn);

      const response = await axiosServices.post(
        `/api/Checklist/${currentChecklist.id}/upload-images`,
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
          if (activeTab === 0) {
            setMoveInChecklist(updatedChecklist);
          } else {
            setMoveOutChecklist(updatedChecklist);
          }
        }
        
        // Clear the file input
        if (activeTab === 0 && beforeImageInputRef.current) {
          beforeImageInputRef.current.value = '';
        } else if (activeTab === 1 && afterImageInputRef.current) {
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
    if (!currentChecklist || !blobName) return;

    try {
      setDeletingImage(true);
      const response = await deleteChecklistImage(currentChecklist.id, blobName, isBeforeMoveIn);

      if (response?.success) {
        // Update the checklist immediately with the response data
        const updatedChecklist = response.data;
        if (updatedChecklist) {
          if (activeTab === 0) {
            setMoveInChecklist(updatedChecklist);
          } else {
            setMoveOutChecklist(updatedChecklist);
          }
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


  const renderChecklistContent = (checklist) => {
    if (!checklist) {
      return (
        <Alert severity="info">
          {activeTab === 0 ? 'Move-In checklist not created yet' : 'Move-Out checklist not created yet'}
        </Alert>
      );
    }

    const completedCount = checklist.items?.filter(item => item.isChecked).length || 0;
    const totalCount = checklist.items?.length || 0;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
      <Grid container spacing={3}>
        {/* Checklist Info Card */}
        <Grid size={12}>
          <MainCard>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">Inspection Date</Typography>
                <Typography variant="body1">{formatDate(checklist.inspectionDate)}</Typography>
              </Box>
              {/* Move-In Date for Move-In Checklist */}
              {activeTab === 0 && (() => {
                const moveInDate = checklist.leaseStartDate || checklist.LeaseStartDate;
                if (moveInDate) {
                  return (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Move-In Date</Typography>
                      <Typography variant="body1">{formatDate(moveInDate)}</Typography>
                    </Box>
                  );
                }
                return null;
              })()}
              {/* Move-Out Date for Move-Out Checklist */}
              {activeTab === 1 && (() => {
                const moveOutDate = checklist.leaseEndDate || checklist.LeaseEndDate;
                if (moveOutDate) {
                  return (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Move-Out Date</Typography>
                      <Typography variant="body1">{formatDate(moveOutDate)}</Typography>
                    </Box>
                  );
                }
                return null;
              })()}
              <Box>
                <Typography variant="body2" color="text.secondary">Status</Typography>
                {(() => {
                  // Check if move-out checklist should show "Not Needed"
                  const isMoveOutChecklist = activeTab === 1;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const leaseEndDate = checklist.leaseEndDate ? new Date(checklist.leaseEndDate) : null;
                  if (leaseEndDate) {
                    leaseEndDate.setHours(0, 0, 0, 0);
                  }
                  const shouldShowNotNeeded = isMoveOutChecklist && leaseEndDate && today <= leaseEndDate;
                  
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
        <Grid size={12}>
          <MainCard title={activeTab === 0 ? 'Before Move-In Photos' : 'After Move-Out Photos'}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <input
                  ref={activeTab === 0 ? beforeImageInputRef : afterImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e.target.files, activeTab === 0)}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadOutlined />}
                  onClick={() => {
                    if (activeTab === 0) {
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
              {(activeTab === 0 
                ? checklist.beforeMoveInImagesUrls 
                : checklist.afterMoveOutImagesUrls)?.length > 0 ? (
                <ImageList cols={3} rowHeight={200}>
                  {(activeTab === 0
                    ? checklist.beforeMoveInImagesUrls
                    : checklist.afterMoveOutImagesUrls).map((url, index) => {
                    const blobNames = activeTab === 0
                      ? checklist.beforeMoveInImagesBlobNames
                      : checklist.afterMoveOutImagesBlobNames;
                    const blobName = blobNames?.[index];
                    const isBeforeMoveIn = activeTab === 0;
                    
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
                      onClick={() => handleToggleItem(checklist, item.id, item.isChecked)}
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
                              handleToggleItem(checklist, item.id, item.isChecked);
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
    );
  };

  if (loading) {
    return (
      <Box textAlign="center" py={5}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading checklists...
        </Typography>
      </Box>
    );
  }

  const unitName = moveInChecklist?.unitName || moveOutChecklist?.unitName || `Unit ${unitId}`;
  const propertyName = moveInChecklist?.propertyName || moveOutChecklist?.propertyName || 'Property';
  const propertyId = moveInChecklist?.propertyId || moveOutChecklist?.propertyId;

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Properties', to: '/landlord/properties' },
          { label: propertyName, to: propertyId ? `/landlord/property/${propertyId}` : '/landlord/properties' },
          { label: `${unitName} Checklists` }
        ]}
      />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(-1)}>
          <ArrowLeftOutlined />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={600}>
            {unitName} Checklists
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {propertyName}
          </Typography>
        </Box>
      </Stack>

      {/* Tabs */}
      <MainCard>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        >
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Move-In Checklist</span>
                {moveInChecklist && (
                  <Chip
                    label={moveInChecklist.isCompleted ? 'Complete' : 'Incomplete'}
                    color={moveInChecklist.isCompleted ? 'success' : 'warning'}
                    size="small"
                    sx={{ height: 20 }}
                  />
                )}
              </Stack>
            }
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Move-Out Checklist</span>
                {moveOutChecklist && (() => {
                  // Check if move-out checklist should show "Not Needed"
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const leaseEndDate = moveOutChecklist.leaseEndDate ? new Date(moveOutChecklist.leaseEndDate) : null;
                  if (leaseEndDate) {
                    leaseEndDate.setHours(0, 0, 0, 0);
                  }
                  const shouldShowNotNeeded = leaseEndDate && today <= leaseEndDate;
                  
                  if (shouldShowNotNeeded) {
                    return (
                      <Chip
                        label="Not Needed"
                        color="default"
                        size="small"
                        variant="outlined"
                        sx={{ height: 20 }}
                      />
                    );
                  }
                  
                  return (
                    <Chip
                      label={moveOutChecklist.isCompleted ? 'Complete' : 'Incomplete'}
                      color={moveOutChecklist.isCompleted ? 'success' : 'warning'}
                      size="small"
                      sx={{ height: 20 }}
                    />
                  );
                })()}
              </Stack>
            }
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {renderChecklistContent(moveInChecklist)}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {renderChecklistContent(moveOutChecklist)}
        </TabPanel>
      </MainCard>
    </Box>
  );
}
