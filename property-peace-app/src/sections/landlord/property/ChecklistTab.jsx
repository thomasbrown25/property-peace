import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  Divider,
  Chip,
  Grid,
  Checkbox,
  FormControlLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  ImageList,
  ImageListItem,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  alpha
} from '@mui/material';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  PictureOutlined,
  CloseOutlined,
  EyeOutlined
} from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { formatDate } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';

export default function ChecklistTab({ propertyId, property }) {
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState([]);
  const [organizationItems, setOrganizationItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [viewChecklistDialogOpen, setViewChecklistDialogOpen] = useState(false);
  const [createChecklistDialogOpen, setCreateChecklistDialogOpen] = useState(false);
  const [checklistType, setChecklistType] = useState(40); // 40 = MoveInChecklist, 41 = MoveOutChecklist
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedTemplateItems, setSelectedTemplateItems] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageType, setImageType] = useState('before'); // 'before' or 'after'
  const [editingItems, setEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const beforeImageInputRef = useRef(null);
  const afterImageInputRef = useRef(null);

  useEffect(() => {
    if (propertyId) {
      loadChecklists();
      loadOrganizationItems();
    }
  }, [propertyId]);

  const loadChecklists = async () => {
    try {
      setLoading(true);
      console.log('Loading checklists for propertyId:', propertyId, 'type:', typeof propertyId);
      const response = await axiosServices.get(`/api/Checklist/property/${propertyId}`);
      console.log('API Response:', response.data);
      if (response.data?.success) {
        const loadedChecklists = response.data.data || [];
        console.log('Loaded checklists:', loadedChecklists);
        console.log('Checklist count:', loadedChecklists.length);
        console.log('Checklist types:', loadedChecklists.map(c => ({ 
          id: c.id, 
          type: c.checklistType, 
          typeName: typeof c.checklistType,
          unitId: c.unitId,
          propertyId: c.propertyId,
          landlordId: c.landlordId,
          title: c.title,
          itemsCount: c.items?.length || 0
        })));
        setChecklists(loadedChecklists);
      } else {
        console.error('API response not successful:', response.data);
        console.error('Response status:', response.status);
        console.error('Response message:', response.data?.message);
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
      console.error('Error response:', error.response?.data);
      openSnackbar({
        open: true,
        message: 'Failed to load checklists',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationItems = async () => {
    try {
      const response = await axiosServices.get('/api/Checklist/organization-items');
      console.log('Organization items response:', response.data);
      if (response.data?.success) {
        const items = response.data.data || [];
        console.log('Loaded organization items:', items.length, items);
        setOrganizationItems(items);
      } else {
        console.error('API response not successful:', response.data);
        openSnackbar({
          open: true,
          message: response.data?.message || 'Failed to load checklist items',
          variant: 'alert',
          alert: { color: 'warning' }
        });
      }
    } catch (error) {
      console.error('Error loading organization checklist items:', error);
      console.error('Error details:', error.response?.data);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to load checklist items',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleViewUnitChecklists = (unitId) => {
    if (!unitId) {
      console.error('handleViewUnitChecklists: No unitId provided');
      openSnackbar({
        open: true,
        message: 'Unit ID is missing',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }
    
    // Navigate to unit checklists page with tabs
    navigate(`/landlord/unit/${unitId}/checklists`);
  };

  const handleCreateChecklist = () => {
    setSelectedUnitId(null);
    setSelectedTemplateItems([]);
    setCreateChecklistDialogOpen(true);
  };

  const handleCreateChecklistSubmit = async () => {
    try {
      if (!selectedUnitId) {
        openSnackbar({
          open: true,
          message: 'Please select a unit',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }

      const selectedUnit = property?.units?.find(u => u.id === selectedUnitId);
      const selectedItems = organizationItems.filter(item => 
        selectedTemplateItems.includes(item.id)
      );

      const checklistData = {
        checklistType: checklistType,
        propertyId: propertyId,
        unitId: selectedUnitId,
        title: `${selectedUnit?.name || 'Unit'} - ${checklistType === 40 ? 'Move-In' : 'Move-Out'}`,
        inspectionDate: new Date().toISOString(),
        items: selectedItems.map((item, index) => ({
          name: item.name,
          description: item.description,
          category: item.category,
          sortOrder: index
        }))
      };

      const response = await axiosServices.post('/api/Checklist', checklistData);
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: 'Checklist created successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setCreateChecklistDialogOpen(false);
        loadChecklists();
      }
    } catch (error) {
      console.error('Error creating checklist:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to create checklist',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleToggleItem = async (checklistId, itemId, isChecked) => {
    try {
      // Update local state immediately
      const updatedChecklists = checklists.map(checklist => {
        if (checklist.id === checklistId) {
          const updatedItems = checklist.items.map(item => {
            if (item.id === itemId) {
              return { ...item, isChecked: !isChecked };
            }
            return item;
          });
          const allChecked = updatedItems.every(item => item.isChecked);
          return {
            ...checklist,
            items: updatedItems,
            isCompleted: allChecked && updatedItems.length > 0
          };
        }
        return checklist;
      });
      setChecklists(updatedChecklists);
      
      if (selectedChecklist?.id === checklistId) {
        setSelectedChecklist(updatedChecklists.find(c => c.id === checklistId));
      }

      // TODO: Call API to update item status
    } catch (error) {
      console.error('Error updating checklist item:', error);
    }
  };

  const handleImageUpload = async (checklistId, files, isBeforeMoveIn) => {
    if (!files || files.length === 0) return;

    try {
      setUploadingImages(true);
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('isBeforeMoveIn', isBeforeMoveIn.toString());

      const response = await axiosServices.post(
        `/api/Checklist/${checklistId}/upload-images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: 'Images uploaded successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        loadChecklists();
        if (selectedChecklist?.id === checklistId) {
          setSelectedChecklist(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to upload images',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleImageInputChange = (event, checklistId, isBeforeMoveIn) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleImageUpload(checklistId, files, isBeforeMoveIn);
    }
    // Reset input
    event.target.value = '';
  };

  const handleSaveChecklistItems = async () => {
    if (!selectedChecklist) return;

    try {
      const updateData = {
        id: selectedChecklist.id,
        items: editedItems.map((item, index) => ({
          id: item.id || null,
          name: item.name,
          description: item.description || null,
          category: item.category || null,
          isChecked: item.isChecked || false,
          sortOrder: index
        }))
      };

      const response = await axiosServices.put(`/api/Checklist/${selectedChecklist.id}`, updateData);
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: 'Checklist items updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditingItems(false);
        loadChecklists();
        if (response.data.data) {
          setSelectedChecklist(response.data.data);
          setEditedItems(response.data.data.items || []);
        }
      }
    } catch (error) {
      console.error('Error updating checklist items:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update checklist items',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter an item name',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    const newItem = {
      id: null, // New item
      name: newItemName,
      description: newItemDescription || null,
      category: newItemCategory || null,
      isChecked: false,
      sortOrder: editedItems.length
    };

    setEditedItems([...editedItems, newItem]);
    setNewItemName('');
    setNewItemDescription('');
    setNewItemCategory('');
    setAddItemDialogOpen(false);
  };

  const handleDeleteItem = (itemId) => {
    if (itemId) {
      // Delete existing item
      setEditedItems(editedItems.filter(item => item.id !== itemId));
    } else {
      // Remove new item (by index or name)
      setEditedItems(editedItems.filter((item, index) => item.id !== null || index !== editedItems.length - 1));
    }
  };

  // Handle both numeric and string enum values (API serializes enums as camelCase strings)
  const isMoveInChecklist = (type) => {
    if (type == null) return false;
    // Check numeric value (40) or string values (camelCase from API)
    return type === 40 || 
           String(type).toLowerCase() === 'moveinchecklist' || 
           String(type).toLowerCase() === 'move-inchecklist';
  };
  const isMoveOutChecklist = (type) => {
    if (type == null) return false;
    // Check numeric value (41) or string values (camelCase from API)
    return type === 41 || 
           String(type).toLowerCase() === 'moveoutchecklist' || 
           String(type).toLowerCase() === 'move-outchecklist';
  };
  
  // Group checklists by unit (only show unit-specific checklists, not property-level)
  const unitChecklists = checklists.filter(c => {
    const hasUnitId = c.unitId != null;
    if (!hasUnitId) {
      console.log('Filtered out checklist (no unitId):', { id: c.id, title: c.title, unitId: c.unitId });
    }
    return hasUnitId;
  });
  
  console.log('Total checklists:', checklists.length);
  console.log('Unit checklists:', unitChecklists.length);
  console.log('Unit checklists details:', unitChecklists.map(c => ({ 
    id: c.id, 
    type: c.checklistType, 
    unitId: c.unitId, 
    title: c.title 
  })));
  
  const moveInChecklists = unitChecklists.filter(c => {
    const isMoveIn = isMoveInChecklist(c.checklistType);
    if (!isMoveIn && (c.checklistType === 40 || c.checklistType === 'moveInChecklist')) {
      console.log('Move-In checklist not matched:', { id: c.id, type: c.checklistType, typeName: typeof c.checklistType });
    }
    return isMoveIn;
  });
  const moveOutChecklists = unitChecklists.filter(c => {
    const isMoveOut = isMoveOutChecklist(c.checklistType);
    if (!isMoveOut && (c.checklistType === 41 || c.checklistType === 'moveOutChecklist')) {
      console.log('Move-Out checklist not matched:', { id: c.id, type: c.checklistType, typeName: typeof c.checklistType });
    }
    return isMoveOut;
  });
  
  console.log('Move-In checklists:', moveInChecklists.length);
  console.log('Move-Out checklists:', moveOutChecklists.length);
  
  // Group by unit for better organization
  const moveInByUnit = moveInChecklists.reduce((acc, checklist) => {
    const unitId = checklist.unitId || 'unknown';
    if (!acc[unitId]) acc[unitId] = [];
    acc[unitId].push(checklist);
    return acc;
  }, {});
  
  const moveOutByUnit = moveOutChecklists.reduce((acc, checklist) => {
    const unitId = checklist.unitId || 'unknown';
    if (!acc[unitId]) acc[unitId] = [];
    acc[unitId].push(checklist);
    return acc;
  }, {});
  
  const units = property?.units || [];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Create a map of unitId to both checklists
  const unitChecklistMap = new Map();
  
  // Add all units from property
  units.forEach(unit => {
    unitChecklistMap.set(unit.id, {
      unitId: unit.id,
      unitName: unit.name,
      moveInChecklist: null,
      moveOutChecklist: null
    });
  });
  
  // Add move-in checklists
  moveInChecklists.forEach(checklist => {
    const unitId = checklist.unitId;
    if (unitId && unitChecklistMap.has(unitId)) {
      unitChecklistMap.get(unitId).moveInChecklist = checklist;
    } else if (unitId) {
      // Unit not in property units list, add it
      unitChecklistMap.set(unitId, {
        unitId: unitId,
        unitName: checklist.unitName || `Unit ${unitId}`,
        moveInChecklist: checklist,
        moveOutChecklist: null
      });
    }
  });
  
  // Add move-out checklists
  moveOutChecklists.forEach(checklist => {
    const unitId = checklist.unitId;
    if (unitId && unitChecklistMap.has(unitId)) {
      unitChecklistMap.get(unitId).moveOutChecklist = checklist;
    } else if (unitId) {
      // Unit not in property units list, add it
      const existing = unitChecklistMap.get(unitId);
      if (existing) {
        existing.moveOutChecklist = checklist;
      } else {
        unitChecklistMap.set(unitId, {
          unitId: unitId,
          unitName: checklist.unitName || `Unit ${unitId}`,
          moveInChecklist: null,
          moveOutChecklist: checklist
        });
      }
    }
  });
  
  const unitChecklistList = Array.from(unitChecklistMap.values());

  return (
    <Box>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={600}>
              Unit Checklists
            </Typography>
            
            {unitChecklistList.length === 0 ? (
              <Alert severity="info">
                No checklists found for this property. Default checklists are automatically created when units are added. If you have existing units, checklists may need to be created manually.
              </Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Unit Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">Move-In Checklist</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">Move-Out Checklist</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unitChecklistList.map((unitData) => {
                      const moveIn = unitData.moveInChecklist;
                      const moveOut = unitData.moveOutChecklist;
                      
                      // Check if unit has a lease
                      const unit = units.find(u => u.id === unitData.unitId);
                      const hasLease = unit && (unit.lease || unit.leaseId);
                      
                      return (
                        <TableRow key={unitData.unitId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {unitData.unitName || `Unit ${unitData.unitId}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {moveIn ? (() => {
                              // If unit doesn't have a lease, show "Not Needed"
                              if (!hasLease) {
                                return (
                                  <Chip
                                    label="Not Needed"
                                    color="default"
                                    size="small"
                                    variant="outlined"
                                  />
                                );
                              }
                              
                              // Unit has lease, show completion status
                              return (
                                <Chip
                                  label={moveIn.isCompleted ? 'Complete' : 'Incomplete'}
                                  color={moveIn.isCompleted ? 'success' : 'warning'}
                                  size="small"
                                  icon={moveIn.isCompleted ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                />
                              );
                            })() : (
                              <Chip
                                label="Not Created"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {moveOut ? (() => {
                              // If unit doesn't have a lease, show "Not Needed"
                              if (!hasLease) {
                                return (
                                  <Chip
                                    label="Not Needed"
                                    color="default"
                                    size="small"
                                    variant="outlined"
                                  />
                                );
                              }
                              
                              // Check if move-out checklist should show "Not Needed" based on lease end date
                              const isMoveOutChecklist = moveOut.checklistType === 41 || 
                                String(moveOut.checklistType).toLowerCase() === 'moveoutchecklist' ||
                                String(moveOut.checklistType).toLowerCase() === 'move-outchecklist';
                              
                              if (!isMoveOutChecklist) {
                                // Not a move-out checklist, show normal status
                                return (
                                  <Chip
                                    label={moveOut.isCompleted ? 'Complete' : 'Incomplete'}
                                    color={moveOut.isCompleted ? 'success' : 'warning'}
                                    size="small"
                                    icon={moveOut.isCompleted ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                  />
                                );
                              }
                              
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              
                              // Get lease end date from multiple sources
                              let leaseEndDate = null;
                              
                              // First, try to get from checklist (check both camelCase and PascalCase)
                              if (moveOut.leaseEndDate) {
                                try {
                                  leaseEndDate = new Date(moveOut.leaseEndDate);
                                } catch (e) {
                                  console.warn('Invalid leaseEndDate in checklist:', moveOut.leaseEndDate);
                                }
                              } else if (moveOut.LeaseEndDate) {
                                try {
                                  leaseEndDate = new Date(moveOut.LeaseEndDate);
                                } catch (e) {
                                  console.warn('Invalid LeaseEndDate in checklist:', moveOut.LeaseEndDate);
                                }
                              }
                              
                              // If checklist doesn't have lease end date, try to get it from unit's lease
                              if (!leaseEndDate && unitData.unitId) {
                                if (unit) {
                                  // Try multiple paths to get lease end date (camelCase and PascalCase)
                                  if (unit.lease) {
                                    try {
                                      if (unit.lease.endDate) {
                                        leaseEndDate = new Date(unit.lease.endDate);
                                      } else if (unit.lease.EndDate) {
                                        leaseEndDate = new Date(unit.lease.EndDate);
                                      }
                                    } catch (e) {
                                      console.warn('Invalid lease endDate in unit:', unit.lease);
                                    }
                                  }
                                }
                              }
                              
                              // Additional fallback: check if checklist has a leaseId and try to find it in all units' leases
                              if (!leaseEndDate && moveOut.leaseId) {
                                for (const u of units) {
                                  if (u.lease && (u.lease.id === moveOut.leaseId || u.lease.Id === moveOut.leaseId)) {
                                    try {
                                      if (u.lease.endDate) {
                                        leaseEndDate = new Date(u.lease.endDate);
                                        break;
                                      } else if (u.lease.EndDate) {
                                        leaseEndDate = new Date(u.lease.EndDate);
                                        break;
                                      }
                                    } catch (e) {
                                      console.warn('Invalid lease endDate found by leaseId:', u.lease);
                                    }
                                  }
                                }
                              }
                              
                              // Normalize the date (set to midnight for accurate comparison)
                              if (leaseEndDate) {
                                leaseEndDate.setHours(0, 0, 0, 0);
                              }
                              
                              // Debug: Log for Unit 4 specifically to help diagnose the issue
                              if (unitData.unitName === 'Unit 4' || unitData.unitId === 4) {
                                console.log('Unit 4 Move-Out Checklist Debug:', {
                                  unitName: unitData.unitName,
                                  unitId: unitData.unitId,
                                  checklistLeaseEndDate: moveOut.leaseEndDate || moveOut.LeaseEndDate,
                                  checklistLeaseId: moveOut.leaseId || moveOut.LeaseId,
                                  foundLeaseEndDate: leaseEndDate,
                                  today: today,
                                  shouldShowNotNeeded: leaseEndDate && today <= leaseEndDate,
                                  unit: units.find(u => u.id === unitData.unitId),
                                  isCompleted: moveOut.isCompleted
                                });
                              }
                              
                              // Show "Not Needed" if current date is before or equal to lease end date
                              // If no lease end date is found, we can't determine if it's needed, so show incomplete
                              const shouldShowNotNeeded = leaseEndDate && today <= leaseEndDate;
                              
                              if (shouldShowNotNeeded) {
                                return (
                                  <Chip
                                    label="Not Needed"
                                    color="default"
                                    size="small"
                                    variant="outlined"
                                  />
                                );
                              }
                              
                              // No lease end date found or lease has ended - show completion status
                              return (
                                <Chip
                                  label={moveOut.isCompleted ? 'Complete' : 'Incomplete'}
                                  color={moveOut.isCompleted ? 'success' : 'warning'}
                                  size="small"
                                  icon={moveOut.isCompleted ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                />
                              );
                            })() : (
                              <Chip
                                label="Not Created"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Checklists">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleViewUnitChecklists(unitData.unitId)}
                              >
                                <EyeOutlined />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* View Checklist Dialog */}
      <Dialog
        open={viewChecklistDialogOpen}
        onClose={() => setViewChecklistDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedChecklist?.title || 'Checklist Details'}
            </Typography>
            <IconButton onClick={() => setViewChecklistDialogOpen(false)} size="small">
              <CloseOutlined />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedChecklist && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Unit</Typography>
                <Typography variant="body1">{selectedChecklist.unitName || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Inspection Date</Typography>
                <Typography variant="body1">{formatDate(selectedChecklist.inspectionDate)}</Typography>
              </Box>
              
              <Divider />

              {/* Before Move-In Images Section */}
              {isMoveInChecklist(selectedChecklist.checklistType) && (
                <Box 
                  sx={{ 
                    maxHeight: '490px !important', 
                    height: '490px !important',
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden !important'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Before Move-In Photos
                    </Typography>
                    <input
                      ref={beforeImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageInputChange(e, selectedChecklist.id, true)}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UploadOutlined />}
                      onClick={() => beforeImageInputRef.current?.click()}
                      disabled={uploadingImages}
                    >
                      Upload Photos
                    </Button>
                  </Box>
                  {selectedChecklist.beforeMoveInImagesUrls && selectedChecklist.beforeMoveInImagesUrls.length > 0 ? (
                    <Box
                      sx={{
                        flex: '1 1 0',
                        overflowY: 'auto !important',
                        overflowX: 'hidden !important',
                        minHeight: 0,
                        maxHeight: '100% !important',
                        '&::-webkit-scrollbar': {
                          width: 8
                        },
                        '&::-webkit-scrollbar-track': {
                          backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.1),
                          borderRadius: 4
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.3),
                          borderRadius: 4,
                          '&:hover': {
                            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.5)
                          }
                        }
                      }}
                    >
                      <ImageList 
                        cols={3} 
                        rowHeight={200} 
                        sx={{ 
                          mb: 2, 
                          margin: 0,
                          width: '100% !important',
                          '& .MuiImageList-root': {
                            height: 'auto !important'
                          }
                        }}
                      >
                        {selectedChecklist.beforeMoveInImagesUrls.map((url, index) => (
                          <ImageListItem key={index}>
                            <img
                              src={url}
                              alt={`Before move-in ${index + 1}`}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </ImageListItem>
                        ))}
                      </ImageList>
                    </Box>
                  ) : (
                    <Alert severity="info">No photos uploaded yet</Alert>
                  )}
                </Box>
              )}

              {/* After Move-Out Images Section */}
              {isMoveOutChecklist(selectedChecklist.checklistType) && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      After Move-Out Photos
                    </Typography>
                    <input
                      ref={afterImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageInputChange(e, selectedChecklist.id, false)}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UploadOutlined />}
                      onClick={() => afterImageInputRef.current?.click()}
                      disabled={uploadingImages}
                    >
                      Upload Photos
                    </Button>
                  </Box>
                  {selectedChecklist.afterMoveOutImagesUrls && selectedChecklist.afterMoveOutImagesUrls.length > 0 ? (
                    <ImageList cols={3} rowHeight={200} sx={{ mb: 2 }}>
                      {selectedChecklist.afterMoveOutImagesUrls.map((url, index) => (
                        <ImageListItem key={index}>
                          <img
                            src={url}
                            alt={`After move-out ${index + 1}`}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  ) : (
                    <Alert severity="info">No photos uploaded yet</Alert>
                  )}
                </Box>
              )}

              <Divider />
              
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Checklist Items
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {!editingItems ? (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditOutlined />}
                          onClick={() => setEditingItems(true)}
                        >
                          Edit Items
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<PlusOutlined />}
                          onClick={() => setAddItemDialogOpen(true)}
                        >
                          Add Item
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleSaveChecklistItems}
                        >
                          Save Changes
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setEditingItems(false);
                            setEditedItems(selectedChecklist.items ? [...selectedChecklist.items] : []);
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </Stack>
                </Box>
                <Stack spacing={1}>
                  {(editingItems ? editedItems : (selectedChecklist.items || [])).length > 0 ? (
                    (editingItems ? editedItems : selectedChecklist.items).map((item, index) => (
                      <Box
                        key={item.id || `new-${index}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          p: 1,
                          borderRadius: 1,
                          '&:hover': editingItems ? { bgcolor: 'action.hover' } : {}
                        }}
                      >
                        <Checkbox
                          checked={item.isChecked || false}
                          onChange={() => {
                            if (editingItems) {
                              const updated = editedItems.map(i => 
                                (i.id === item.id || (!i.id && !item.id && i.name === item.name))
                                  ? { ...i, isChecked: !i.isChecked }
                                  : i
                              );
                              setEditedItems(updated);
                            } else {
                              handleToggleItem(selectedChecklist.id, item.id, item.isChecked);
                            }
                          }}
                          disabled={editingItems && !item.id} // Disable for new items being added
                        />
                        <Box sx={{ flexGrow: 1, ml: 1 }}>
                          <Typography variant="body2">{item.name}</Typography>
                          {item.description && (
                            <Typography variant="caption" color="text.secondary">
                              {item.description}
                            </Typography>
                          )}
                          {item.category && (
                            <Chip
                              label={item.category}
                              size="small"
                              sx={{ mt: 0.5, height: 20 }}
                            />
                          )}
                        </Box>
                        {editingItems && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteItem(item.id)}
                            sx={{ ml: 1 }}
                          >
                            <DeleteOutlined />
                          </IconButton>
                        )}
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No items in this checklist
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Completion Status */}
              {selectedChecklist.items?.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Progress: {selectedChecklist.items.filter(i => i.isChecked).length} of {selectedChecklist.items.length} items completed
                  </Typography>
                  {selectedChecklist.isCompleted && (
                    <Chip
                      label="Checklist Completed"
                      color="success"
                      icon={<CheckCircleOutlined />}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setViewChecklistDialogOpen(false);
            setEditingItems(false);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog
        open={addItemDialogOpen}
        onClose={() => {
          setAddItemDialogOpen(false);
          setNewItemName('');
          setNewItemDescription('');
          setNewItemCategory('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Checklist Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Item Name"
              fullWidth
              required
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <TextField
              label="Description (Optional)"
              fullWidth
              multiline
              rows={2}
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
            />
            <TextField
              label="Category (Optional)"
              fullWidth
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              placeholder="e.g., Kitchen, Bathroom, Interior"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddItemDialogOpen(false);
            setNewItemName('');
            setNewItemDescription('');
            setNewItemCategory('');
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddItem}>Add Item</Button>
        </DialogActions>
      </Dialog>

      {/* Create Checklist Dialog */}
      <Dialog
        open={createChecklistDialogOpen}
        onClose={() => setCreateChecklistDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create {checklistType === 40 ? 'Move-In' : 'Move-Out'} Checklist
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Select Unit</InputLabel>
              <Select
                value={selectedUnitId || ''}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                label="Select Unit"
              >
                {units.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    {unit.name || `Unit ${unit.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Select Checklist Items
              </Typography>
              <Stack spacing={1}>
                {organizationItems.map((item) => (
                  <FormControlLabel
                    key={item.id}
                    control={
                      <Checkbox
                        checked={selectedTemplateItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTemplateItems([...selectedTemplateItems, item.id]);
                          } else {
                            setSelectedTemplateItems(selectedTemplateItems.filter(id => id !== item.id));
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{item.name}</Typography>
                        {item.description && (
                          <Typography variant="caption" color="text.secondary">
                            {item.description}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                ))}
              </Stack>
              {organizationItems.length === 0 ? (
                <Alert 
                  severity="info"
                  action={
                    <Button
                      size="small"
                      onClick={async () => {
                        try {
                          const response = await axiosServices.post('/api/Checklist/organization-items/seed-defaults');
                          if (response.data?.success) {
                            openSnackbar({
                              open: true,
                              message: 'Default checklist items seeded successfully',
                              variant: 'alert',
                              alert: { color: 'success' }
                            });
                            loadOrganizationItems();
                          }
                        } catch (error) {
                          console.error('Error seeding default items:', error);
                          openSnackbar({
                            open: true,
                            message: error.response?.data?.message || 'Failed to seed default items',
                            variant: 'alert',
                            alert: { color: 'error' }
                          });
                        }
                      }}
                    >
                      Seed Default Items
                    </Button>
                  }
                >
                  No checklist items available. Click "Seed Default Items" to create default checklist items for your organization.
                </Alert>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateChecklistDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateChecklistSubmit}
            disabled={!selectedUnitId || selectedTemplateItems.length === 0}
          >
            Create Checklist
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
