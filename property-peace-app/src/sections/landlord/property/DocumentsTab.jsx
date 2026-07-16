import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Tooltip,
  alpha,
  CircularProgress,
  Alert,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  Checkbox
} from '@mui/material';
import {
  DownloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CalendarOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  PlusOutlined,
  UploadOutlined,
  CloseOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import { tenantDocumentAPI } from 'api';
import { fileAPI } from 'api';
import { formatDate } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import useFetchTenants from 'hooks/useFetchTenants';
import useFetchProperties from 'hooks/useFetchProperties';

// Document category labels for property documents
const DOCUMENT_CATEGORY_LABELS = {
  1: 'Landlord Insurance Policy',
  2: 'Utility & Maintenance',
  3: 'Loan & Financial Documents',
  4: 'Other Documents'
};

// Document category options for filter
const DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 1, label: 'Landlord Insurance Policy' },
  { value: 2, label: 'Utility & Maintenance' },
  { value: 3, label: 'Loan & Financial Documents' },
  { value: 4, label: 'Other Documents' }
];

export default function DocumentsTab({ property, onRefresh }) {
  const { user } = useAuth();
  const { tenants } = useFetchTenants();
  const { properties } = useFetchProperties();
  const theme = useTheme();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [propertyFiles, setPropertyFiles] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    files: [],
    title: '',
    categoryId: 4 // Default to 'Other Documents'
  });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadErrors, setUploadErrors] = useState({
    files: false,
    title: false
  });

  // Get all units for this property
  const propertyUnits = useMemo(() => {
    if (!property?.units) return [];
    return property.units;
  }, [property]);

  // Helper functions to get document unit and tenant
  const getDocumentUnit = (document) => {
    const tenant = tenants?.find((t) => t.id === document.tenantId);
    if (!tenant) return null;

    // Check tenant's unitId (direct relationship)
    if (tenant.unitId) {
      const unit = propertyUnits.find((u) => u.id === tenant.unitId);
      if (unit) return unit;
    }

    // Check document's lease's unit
    if (document.leaseId) {
      const unit = propertyUnits.find((u) => u.lease?.id === document.leaseId);
      if (unit) return unit;
    }

    // Check tenant's leaseId
    if (tenant.leaseId) {
      const unit = propertyUnits.find((u) => u.lease?.id === tenant.leaseId);
      if (unit) return unit;
    }

    return null;
  };

  const getDocumentTenant = (document) => {
    return tenants?.find((t) => t.id === document.tenantId);
  };

  // Fetch documents function - can be called independently
  const refreshDocuments = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Fetch tenant documents
      const tenantDocsResponse = await tenantDocumentAPI.getTenantDocumentsByLandlord(user.id);
      if (tenantDocsResponse.success && tenantDocsResponse.data) {
        setDocuments(tenantDocsResponse.data);
      }

      // Fetch property-level files
      if (property?.id) {
        const filesResponse = await fileAPI.getFiles({ propertyId: property.id });
        if (filesResponse.success && filesResponse.data) {
          setPropertyFiles(filesResponse.data);
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  }, [user?.id, property?.id]);

  // Fetch documents for the landlord
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        await refreshDocuments();
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [user?.id, property?.id, onRefresh, refreshDocuments]);

  // Filter documents by property and combine with property files
  const propertyDocuments = useMemo(() => {
    const tenantDocs = [];
    const allDocs = [];

    // Filter tenant documents by property
    if (property?.id && documents.length) {
      const filteredTenantDocs = documents.filter((doc) => {
        // Find the tenant for this document
        const tenant = tenants?.find((t) => t.id === doc.tenantId);
        if (!tenant) return false;

        // Check if tenant's propertyId matches (direct relationship)
        if (tenant.propertyId === property.id) {
          return true;
        }

        // Check if tenant's unitId belongs to this property
        if (tenant.unitId) {
          const unit = propertyUnits.find((u) => u.id === tenant.unitId);
          if (unit) {
            return true;
          }
        }

        // Check if document has a leaseId that links to this property
        if (doc.leaseId) {
          // Find lease in property's units
          const unitWithLease = propertyUnits.find((u) => u.lease?.id === doc.leaseId);
          if (unitWithLease) {
            return true;
          }
        }

        // Check if tenant's leaseId links to a unit in this property
        if (tenant.leaseId) {
          const unitWithLease = propertyUnits.find((u) => u.lease?.id === tenant.leaseId);
          if (unitWithLease) {
            return true;
          }
        }

        return false;
      });
      tenantDocs.push(...filteredTenantDocs);
      allDocs.push(...filteredTenantDocs);
    }

    // Convert property files to document format and add to all documents
    if (propertyFiles.length) {
      const convertedFiles = propertyFiles.map((file) => ({
        id: file.id,
        fileName: file.fileName || file.name || file.title || 'Untitled Document',
        description: file.title || file.description || null,
        documentType: file.categoryId || 4, // Use categoryId as documentType or default to 'Other Documents'
        categoryId: file.categoryId || 4, // Store categoryId separately
        blobUrl: file.blobUrl || file.url,
        createdAt: file.createdAt || file.uploadDate,
        expirationDate: file.expirationDate || null,
        isRequired: false,
        tenantId: null, // Property files don't have a tenant
        leaseId: file.leaseId || null,
        unitId: file.unitId || null,
        isPropertyFile: true // Flag to identify property files
      }));
      allDocs.push(...convertedFiles);
    }

    return allDocs;
  }, [documents, property?.id, propertyUnits, tenants, propertyFiles]);

  // Group documents by identity (same document sent to multiple tenants)
  const groupedDocuments = useMemo(() => {
    const groups = new Map();
    
    propertyDocuments.forEach((doc) => {
      // For property files, get unit directly from unitId; for tenant documents, use getDocumentUnit
      let unit = null;
      if (doc.isPropertyFile && doc.unitId) {
        unit = propertyUnits.find((u) => u.id === doc.unitId);
      } else if (!doc.isPropertyFile) {
        unit = getDocumentUnit(doc);
      }
      
      const unitId = unit?.id || doc.unitId || null;
      
      // Key: fileName + documentType + leaseId + unitId + isPropertyFile
      // This groups documents that are the same but sent to different tenants
      // Property files are grouped separately from tenant documents
      const groupKey = `${doc.fileName || ''}_${doc.documentType}_${doc.leaseId || 'null'}_${unitId || 'null'}_${doc.isPropertyFile ? 'prop' : 'tenant'}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          document: doc, // Use first document as the representative
          documents: [doc], // All documents in this group
          tenants: [],
          unit: unit
        });
      } else {
        const group = groups.get(groupKey);
        group.documents.push(doc);
      }
    });
    
    // Extract tenant info for each group (only for tenant documents, not property files)
    Array.from(groups.values()).forEach(group => {
      group.tenants = group.documents
        .filter(doc => !doc.isPropertyFile && doc.tenantId) // Only tenant documents
        .map(doc => getDocumentTenant(doc))
        .filter(tenant => tenant !== undefined)
        .filter((tenant, index, self) => 
          index === self.findIndex(t => t.id === tenant.id) // Remove duplicates
        );
    });
    
    return Array.from(groups.values());
  }, [propertyDocuments, tenants, propertyUnits]);

  // Apply filters
  const filteredDocuments = useMemo(() => {
    let filtered = [...groupedDocuments];

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((group) => {
        // For property files, use categoryId; for tenant documents, use documentType
        const category = group.document.isPropertyFile 
          ? group.document.categoryId || group.document.documentType
          : group.document.documentType;
        return category === Number(categoryFilter);
      });
    }

    // Filter by unit
    if (unitFilter !== 'all') {
      filtered = filtered.filter((group) => {
        const unit = group.unit;
        // Also check if the document itself has a unitId (for property files)
        const documentUnitId = group.document.unitId;
        return (unit && unit.id === Number(unitFilter)) || 
               (documentUnitId && documentUnitId === Number(unitFilter));
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((group) => {
        const doc = group.document;
        // Use category label for property files, document type for tenant documents
        const categoryLabel = doc.isPropertyFile
          ? (DOCUMENT_CATEGORY_LABELS[doc.categoryId || doc.documentType] || 'Unknown')
          : (DOCUMENT_CATEGORY_LABELS[doc.documentType] || 'Unknown');
        const tenantNames = group.tenants.map(t => `${t.firstname || ''} ${t.lastname || ''}`.trim()).join(' ');
        
        return (
          doc.fileName?.toLowerCase().includes(query) ||
          doc.description?.toLowerCase().includes(query) ||
          categoryLabel.toLowerCase().includes(query) ||
          tenantNames.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [groupedDocuments, categoryFilter, unitFilter, searchQuery]);

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    setDeleteConfirmOpen(false); // Close dialog immediately to prevent flicker
    
    try {
      // Check if it's a property file or tenant document
      if (documentToDelete.isPropertyFile) {
        await fileAPI.deleteFile(documentToDelete.id);
      } else {
        await tenantDocumentAPI.deleteTenantDocument(documentToDelete.id);
      }

      // Refresh data after successful deletion
      await refreshDocuments();

      openSnackbar({
        open: true,
        message: 'Document deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setDocumentToDelete(null);
      setSelectedDocuments([]);
    } catch (error) {
      console.error('Error deleting document:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete document',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.length === 0) return;

    setDeleting(true);
    setBulkDeleteConfirmOpen(false);
    
    try {
      // Delete all selected documents - handle both property files and tenant documents
      const deletePromises = selectedDocuments.map((doc) => {
        if (doc.isPropertyFile) {
          return fileAPI.deleteFile(doc.id);
        } else {
          return tenantDocumentAPI.deleteTenantDocument(doc.id);
        }
      });

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
      const failCount = results.length - successCount;

      // Refresh data after deletion
      await refreshDocuments();

      if (successCount > 0) {
        openSnackbar({
          open: true,
          message: `Successfully deleted ${successCount} document(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
          variant: 'alert',
          alert: { color: successCount === selectedDocuments.length ? 'success' : 'warning' }
        });
        setSelectedDocuments([]);
      } else {
        openSnackbar({
          open: true,
          message: 'Failed to delete documents',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error deleting documents:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (document) => {
    if (document.blobUrl) {
      // For property files, use direct download; for tenant documents, use the API function
      if (document.isPropertyFile) {
        const link = window.document.createElement('a');
        link.href = document.blobUrl;
        link.download = document.fileName || 'document';
        link.target = '_blank';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      } else {
        tenantDocumentAPI.downloadTenantDocument(document.blobUrl, document.fileName);
      }
    }
  };

  const handleView = (document) => {
    if (document.blobUrl) {
      window.open(document.blobUrl, '_blank');
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setUploadForm({ ...uploadForm, files });
    if (uploadErrors.files && files.length > 0) {
      setUploadErrors({ ...uploadErrors, files: false });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    setUploadForm({ ...uploadForm, files });
    if (uploadErrors.files && files.length > 0) {
      setUploadErrors({ ...uploadErrors, files: false });
    }
  };

  const handleUpload = async () => {
    // Validate and set errors
    const errors = {
      files: !uploadForm.files || uploadForm.files.length === 0,
      title: !uploadForm.title || uploadForm.title.trim() === ''
    };
    
    setUploadErrors(errors);

    // If there are validation errors, show them and return
    if (errors.files || errors.title) {
      if (errors.files) {
        openSnackbar({
          open: true,
          message: 'Please select at least one file',
          variant: 'alert',
          alert: { color: 'warning' }
        });
      }
      if (errors.title) {
        openSnackbar({
          open: true,
          message: 'Please enter a title',
          variant: 'alert',
          alert: { color: 'warning' }
        });
      }
      return;
    }

    if (!property?.id) {
      openSnackbar({
        open: true,
        message: 'Property ID is missing',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setUploading(true);
    try {
      const response = await fileAPI.uploadFiles(uploadForm.files, {
        title: uploadForm.title,
        propertyId: property.id,
        categoryId: uploadForm.categoryId || null
      });

      if (response.success) {
        // Reset form immediately
        setUploadForm({
          files: [],
          title: '',
          categoryId: 4
        });
        setUploadErrors({
          files: false,
          title: false
        });
        setUploadDialogOpen(false);
        
        // Refresh documents after successful upload
        await refreshDocuments();

        openSnackbar({
          open: true,
          message: 'Documents uploaded successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to upload documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploading(false);
    }
  };

  const isOperationInProgress = uploading || deleting;

  if (loading && !isOperationInProgress) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Loading overlay during operations */}
      {isOperationInProgress && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            borderRadius: 2
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              {uploading ? 'Uploading documents...' : 'Deleting document...'}
            </Typography>
          </Stack>
        </Box>
      )}
      {/* Filters and Add Button */}
      <MainCard sx={{ mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ flex: 1 }}>
            <TextField
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                )
              }}
              sx={{ flex: 1, minWidth: 200 }}
            />

            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label="Category"
              >
                {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {propertyUnits.length > 0 && (
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  label="Unit"
                >
                  <MenuItem value="all">All Units</MenuItem>
                  {propertyUnits.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.name || `Unit ${unit.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {selectedDocuments.length > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {selectedDocuments.length} selected
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlined />}
                    onClick={() => setBulkDeleteConfirmOpen(true)}
                    disabled={isOperationInProgress}
                    size="small"
                  >
                    Delete Selected
                  </Button>
                </>
              )}
              <Button
                variant="contained"
                startIcon={<UploadOutlined />}
                onClick={() => setUploadDialogOpen(true)}
                disabled={isOperationInProgress}
              >
                Upload Document
              </Button>
            </Stack>
          </Stack>

          {filteredDocuments.length !== groupedDocuments.length && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Showing {filteredDocuments.length} of {groupedDocuments.length} documents
            </Alert>
          )}
        </Stack>
      </MainCard>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FileTextOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)' }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              {groupedDocuments.length === 0 ? 'No documents found for this property' : 'No documents match your filters'}
            </Typography>
          </Box>
        </MainCard>
      ) : (
        <MainCard>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <Table size="medium">
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
                    '& .MuiTableCell-head': {
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: `2px solid ${alpha(theme.palette.divider, 0.1)}`
                    }
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedDocuments.length > 0 && selectedDocuments.length < filteredDocuments.length}
                      checked={filteredDocuments.length > 0 && selectedDocuments.length === filteredDocuments.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Select all documents from all groups
                          const allDocs = filteredDocuments.flatMap(group => group.documents);
                          setSelectedDocuments(allDocs);
                        } else {
                          setSelectedDocuments([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>Document Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDocuments.map((group) => {
                  const document = group.document; // Representative document
                  const unit = group.unit;
                  // Use category label for property files, document type for tenant documents
                  const docTypeLabel = document.isPropertyFile
                    ? (DOCUMENT_CATEGORY_LABELS[document.categoryId || document.documentType] || 'Unknown')
                    : (DOCUMENT_CATEGORY_LABELS[document.documentType] || 'Unknown');

                  // Check if any document in this group is selected
                  const isGroupSelected = group.documents.some(doc => 
                    selectedDocuments.some(selected => selected.id === doc.id && 
                      (selected.isPropertyFile === doc.isPropertyFile))
                  );
                  const allGroupDocsSelected = group.documents.every(doc => 
                    selectedDocuments.some(selected => selected.id === doc.id && 
                      (selected.isPropertyFile === doc.isPropertyFile))
                  );

                  return (
                    <TableRow
                      key={group.key}
                      sx={{
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.02)
                        }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={isGroupSelected && !allGroupDocsSelected}
                          checked={allGroupDocsSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Add all documents in this group
                              setSelectedDocuments([...selectedDocuments, ...group.documents]);
                            } else {
                              // Remove all documents in this group
                              setSelectedDocuments(selectedDocuments.filter(selected => 
                                !group.documents.some(doc => doc.id === selected.id && 
                                  (doc.isPropertyFile === selected.isPropertyFile))
                              ));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" fontWeight={500}>
                            {document.fileName || 'Untitled Document'}
                          </Typography>
                          {document.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              {document.description}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {document.isPropertyFile && (
                              <Chip
                                label="Property Document"
                                size="small"
                                color="info"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                            {document.isRequired && (
                              <Chip
                                label="Required"
                                size="small"
                                color="warning"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={docTypeLabel}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {group.tenants.length > 0 ? (
                          <Stack spacing={0.25}>
                            {group.tenants.map((tenant) => (
                              <Typography key={tenant.id} variant="body2">
                                {tenant.firstname} {tenant.lastname}
                              </Typography>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {unit ? (
                          <Typography variant="body2">
                            {unit.name || `Unit ${unit.id}`}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(document.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {document.expirationDate ? (
                          <Typography
                            variant="body2"
                            color={new Date(document.expirationDate) < new Date() ? 'error.main' : 'text.secondary'}
                            fontWeight={new Date(document.expirationDate) < new Date() ? 600 : 400}
                          >
                            {formatDate(document.expirationDate)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="View">
                            <IconButton
                              size="small"
                              onClick={() => handleView(document)}
                              color="primary"
                              disabled={isOperationInProgress}
                            >
                              <EyeOutlined />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(document)}
                              color="primary"
                              disabled={isOperationInProgress}
                            >
                              <DownloadOutlined />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setDocumentToDelete(group.documents[0]);
                                setDeleteConfirmOpen(true);
                              }}
                              color="error"
                              disabled={isOperationInProgress}
                            >
                              <DeleteOutlined />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      )}

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => !uploading && setUploadDialogOpen(false)} 
        maxWidth="xs"
        PaperProps={{
          sx: {
            maxWidth: 480
          }
        }}
      >
        <DialogTitle sx={{ position: 'relative', pr: 5 }}>
          Upload Document
          <IconButton
            aria-label="close"
            onClick={() => !uploading && setUploadDialogOpen(false)}
            disabled={uploading}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500]
            }}
          >
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Drag and Drop Upload Area */}
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: uploadErrors.files 
                  ? 'error.main' 
                  : isDragging 
                    ? 'primary.main' 
                    : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                bgcolor: uploadErrors.files
                  ? alpha(theme.palette.error.main, 0.05)
                  : isDragging 
                    ? alpha(theme.palette.primary.main, 0.05) 
                    : 'transparent',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: uploading 
                    ? 'divider' 
                    : uploadErrors.files
                      ? 'error.main'
                      : 'primary.main',
                  bgcolor: uploading 
                    ? 'transparent' 
                    : uploadErrors.files
                      ? alpha(theme.palette.error.main, 0.08)
                      : alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <input
                accept="*/*"
                style={{ display: 'none' }}
                id="file-upload-input"
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={uploading}
              />
              {uploadForm.files.length === 0 ? (
                <Stack spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <UploadOutlined style={{ fontSize: 32, color: theme.palette.primary.main }} />
                  </Box>
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    There's nothing here yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Click or drag to upload
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={1} alignItems="center">
                  <UploadOutlined style={{ fontSize: 32, color: theme.palette.primary.main }} />
                  <Typography variant="body1" fontWeight={500}>
                    {uploadForm.files.length} file(s) selected
                  </Typography>
                  {uploadForm.files.map((file, index) => (
                    <Typography key={index} variant="body2" color="text.secondary">
                      • {file.name}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
            {uploadErrors.files && (
              <Typography variant="caption" color="error" sx={{ mt: -2, mb: -1 }}>
                Please select at least one file
              </Typography>
            )}

            <TextField
              fullWidth
              label="Title"
              required
              value={uploadForm.title}
              onChange={(e) => {
                setUploadForm({ ...uploadForm, title: e.target.value });
                if (uploadErrors.title && e.target.value.trim()) {
                  setUploadErrors({ ...uploadErrors, title: false });
                }
              }}
              placeholder="Enter a title for these documents..."
              disabled={uploading}
              error={uploadErrors.title}
              helperText={uploadErrors.title ? 'Title is required' : ''}
            />

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={uploadForm.categoryId}
                label="Category"
                onChange={(e) => setUploadForm({ ...uploadForm, categoryId: e.target.value })}
                disabled={uploading}
              >
                {DOCUMENT_CATEGORY_OPTIONS.filter(opt => opt.value !== 'all').map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button 
            variant="contained" 
            onClick={handleUpload} 
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : <UploadOutlined />}
            sx={{ minWidth: 150 }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDocumentToDelete(null);
        }}
        onConfirm={handleDeleteDocument}
        title="Delete Document"
        message={`Are you sure you want to delete "${documentToDelete?.fileName || 'this document'}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Documents"
        message={`Are you sure you want to delete ${selectedDocuments.length} selected document(s)? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />
    </Box>
  );
}

