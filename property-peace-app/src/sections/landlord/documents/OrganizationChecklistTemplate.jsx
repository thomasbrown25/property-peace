import { useState, useEffect, Fragment } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  alpha
} from '@mui/material';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

export default function OrganizationChecklistTemplate() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await axiosServices.get('/api/Checklist/organization-items');
      if (response.data?.success) {
        // Sort by SortOrder, then by ID
        const sortedItems = (response.data.data || []).sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) {
            return (a.sortOrder || 0) - (b.sortOrder || 0);
          }
          return (a.id || 0) - (b.id || 0);
        });
        setItems(sortedItems);
      }
    } catch (error) {
      console.error('Error loading organization checklist items:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load checklist template items',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ name: '', description: '', category: '' });
    setSelectedItem(null);
    setAddDialogOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      category: item.category || ''
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (item) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter an item name',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    try {
      if (selectedItem) {
        // Update existing item
        await axiosServices.put(`/api/Checklist/organization-items/${selectedItem.id}`, {
          id: selectedItem.id,
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null
        });
        openSnackbar({
          open: true,
          message: 'Checklist item updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditDialogOpen(false);
      } else {
        // Add new item
        await axiosServices.post('/api/Checklist/organization-items', {
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          isDefault: true
        });
        openSnackbar({
          open: true,
          message: 'Checklist item added successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setAddDialogOpen(false);
      }
      loadItems();
      setFormData({ name: '', description: '', category: '' });
      setSelectedItem(null);
    } catch (error) {
      console.error('Error saving checklist item:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to save checklist item',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;

    try {
      await axiosServices.delete(`/api/Checklist/organization-items/${selectedItem.id}`);
      openSnackbar({
        open: true,
        message: 'Checklist item deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      loadItems();
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to delete checklist item',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: { sm: '70%' } }}>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Default Checklist Template
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage the default checklist items that will be used when units are created. You can add, edit, or remove items from this template.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PlusOutlined />}
          onClick={handleAdd}
          sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
        >
          Add Item
        </Button>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        This template is used as the default checklist for all new units. When you create a unit, it will automatically get a Move-In and Move-Out checklist with these items.
      </Alert>

      {/* Items Table */}
      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        {items.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)', marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              No checklist items found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Start by adding items to your default checklist template using the 'Add Item' button.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Item Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
                  <Fragment key={category}>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.05), fontWeight: 600, py: 1 }}>
                        {category}
                      </TableCell>
                    </TableRow>
                    {categoryItems.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {item.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {item.category && (
                            <Chip label={item.category} size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEdit(item)}
                              >
                                <EditOutlined />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(item)}
                              >
                                <DeleteOutlined />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Checklist Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Item Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="Description (Optional)"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              label="Category (Optional)"
              fullWidth
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Kitchen, Bathroom, Interior"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Add Item</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Checklist Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Item Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="Description (Optional)"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              label="Category (Optional)"
              fullWidth
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Kitchen, Bathroom, Interior"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Checklist Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedItem?.name}"? This will remove it from the default template.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

