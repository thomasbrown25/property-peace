import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { adminUpcomingFeaturesAPI } from 'api/admin/upcoming-features';
import { openSnackbar } from 'api/snackbar';

export default function AdminUpcomingFeatures() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    icon: '',
    displayOrder: 0,
    isActive: true,
    expectedDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await adminUpcomingFeaturesAPI.getAll();

      if (response.success) {
        setFeatures(response.data || []);
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to load upcoming features',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load upcoming features',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingFeature(null);
    setFormData({
      title: '',
      description: '',
      icon: '',
      displayOrder: features.length > 0 ? Math.max(...features.map(f => f.displayOrder || 0)) + 1 : 0,
      isActive: true,
      expectedDate: ''
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (feature) => {
    setEditingFeature(feature);
    setFormData({
      title: feature.title || '',
      description: feature.description || '',
      icon: feature.icon || '',
      displayOrder: feature.displayOrder || 0,
      isActive: feature.isActive !== undefined ? feature.isActive : true,
      expectedDate: feature.expectedDate ? new Date(feature.expectedDate).toISOString().split('T')[0] : ''
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.title.trim()) {
        openSnackbar({
          open: true,
          message: 'Title is required',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }

      setLoading(true);
      const featureData = {
        ...formData,
        expectedDate: formData.expectedDate ? new Date(formData.expectedDate).toISOString() : null
      };

      let response;
      if (editingFeature) {
        response = await adminUpcomingFeaturesAPI.update(editingFeature.id, {
          id: editingFeature.id,
          ...featureData
        });
      } else {
        response = await adminUpcomingFeaturesAPI.create(featureData);
      }

      if (response.success) {
        openSnackbar({
          open: true,
          message: editingFeature ? 'Feature updated successfully' : 'Feature created successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditDialogOpen(false);
        setEditingFeature(null);
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to save feature',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error saving feature:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save feature',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (feature) => {
    setFeatureToDelete(feature);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      const response = await adminUpcomingFeaturesAPI.delete(featureToDelete.id);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Feature deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setDeleteDialogOpen(false);
        setFeatureToDelete(null);
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to delete feature',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error deleting feature:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete feature',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setEditingFeature(null);
    setFormData({
      title: '',
      description: '',
      icon: '',
      displayOrder: 0,
      isActive: true,
      expectedDate: ''
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Upcoming Features Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage upcoming features that will be displayed to landlords
        </Typography>
      </Box>

      <MainCard>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlusOutlined />}
            onClick={handleAddNew}
            disabled={loading}
          >
            Add New Feature
          </Button>
        </Box>

        {loading && features.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Order</strong></TableCell>
                  <TableCell><strong>Title</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Icon</strong></TableCell>
                  <TableCell><strong>Expected Date</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {features.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No upcoming features found. Click "Add New Feature" to create one.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  features.map((feature) => (
                    <TableRow key={feature.id} hover>
                      <TableCell>{feature.displayOrder}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {feature.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {feature.description || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>{feature.icon || 'N/A'}</TableCell>
                      <TableCell>{formatDate(feature.expectedDate)}</TableCell>
                      <TableCell>
                        <Chip
                          label={feature.isActive ? 'Active' : 'Inactive'}
                          color={feature.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEdit(feature)}>
                              <EditOutlined />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(feature)}>
                              <DeleteOutlined />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingFeature ? 'Edit Upcoming Feature' : 'Add New Upcoming Feature'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Advanced Reporting"
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the feature"
            />
            <TextField
              label="Icon"
              fullWidth
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="Icon name or URL (optional)"
              helperText="You can use Ant Design icon names or provide an icon URL"
            />
            <TextField
              label="Display Order"
              type="number"
              fullWidth
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              helperText="Lower numbers appear first"
            />
            <TextField
              label="Expected Date"
              type="date"
              fullWidth
              value={formData.expectedDate}
              onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Optional: When this feature is expected to be released"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active (visible to landlords)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CloseOutlined />}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveOutlined />}
            disabled={loading}
          >
            {loading ? <CircularProgress size={16} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setFeatureToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Upcoming Feature"
        message={`Are you sure you want to delete "${featureToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Container>
  );
}

