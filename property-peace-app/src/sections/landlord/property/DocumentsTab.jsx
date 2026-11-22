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
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
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
  UploadOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import { tenantDocumentAPI } from 'api';
import { fileAPI } from 'api';
import { formatDate } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import useFetchTenants from 'hooks/useFetchTenants';
import axiosServices from 'utils/axios';
import { documentCategory, documentTypeLabel, propertyDocumentContext } from './propertyDocuments.mjs';

export default function DocumentsTab({ property, onUploadDocument, documentsVersion }) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id;
  const scope = `${organizationId}:${user?.id}:${property?.id}`;
  const [loadedScope, setLoadedScope] = useState(null);
  const { tenants } = useFetchTenants();

  const [documents, setDocuments] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [propertyFiles, setPropertyFiles] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  // Get all units for this property
  const propertyUnits = useMemo(() => {
    if (!property?.units) return [];
    return property.units;
  }, [property]);

  const getDocumentUnit = document => propertyDocumentContext(document, property, leases, tenants).unit;
  const getDocumentTenant = document => propertyDocumentContext(document, property, leases, tenants).tenant;

  const refreshDocuments = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setDocuments([]);
    setPropertyFiles([]);
    setLeases([]);
    setSelectedDocuments([]);
    setLoadError('');
    setLoadedScope(null);
    setLoading(false);
    if (!user?.id || !property?.id) return;
    setLoading(true);
    try {
      const [tenantResponse, filesResponse, leaseResponse] = await Promise.all([
        tenantDocumentAPI.getTenantDocumentsByLandlord(user.id),
        fileAPI.getFiles({ propertyId: property.id }),
        axiosServices.get(`/api/lease/property/${property.id}/all`)
      ]);
      if (currentRequest !== requestId.current) return;
      const savedLeases = leaseResponse.data;
      if (![tenantResponse, filesResponse, savedLeases].every(response => response?.success && Array.isArray(response.data))) {
        throw new Error('Documents could not be loaded.');
      }
      setLoadedScope(scope);
      setDocuments(tenantResponse.data);
      setPropertyFiles(filesResponse.data);
      setLeases(savedLeases.data.filter(lease => !lease.isDeleted && !lease.IsDeleted));
    } catch (error) {
      if (currentRequest === requestId.current) setLoadError('Documents could not be loaded. Please retry.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [user?.id, property?.id, scope]);

  useEffect(() => {
    refreshDocuments();
    return () => { requestId.current += 1; };
  }, [documentsVersion, refreshDocuments]);

  const propertyDocuments = useMemo(() => {
    if (loadedScope !== scope) return [];
    const allDocs = documents.filter(doc => propertyDocumentContext(doc, property, leases, tenants).belongs);

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
  }, [documents, property, leases, tenants, propertyFiles, loadedScope, scope]);

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
      
      // Key: stored blob identity + type + lease + unit + source
      // This groups documents that are the same but sent to different tenants
      // Property files are grouped separately from tenant documents
      const groupKey = `${doc.blobName || doc.blobUrl?.split('?')[0] || doc.id}_${doc.documentType}_${doc.leaseId || 'null'}_${unitId || 'null'}_${doc.isPropertyFile ? 'prop' : 'tenant'}`;
      
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
  }, [propertyDocuments, tenants, propertyUnits, leases]);

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...Array.from(new Map(propertyDocuments.map(doc => [documentCategory(doc), {
      value: documentCategory(doc), label: `${doc.isPropertyFile ? 'Property' : 'Tenant'} · ${documentTypeLabel(doc)}`
    }])).values())
  ], [propertyDocuments]);

  // Apply filters
  const filteredDocuments = useMemo(() => {
    let filtered = [...groupedDocuments];

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((group) => {
        return documentCategory(group.document) === categoryFilter;
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
        const categoryLabel = documentTypeLabel(doc);
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

  useEffect(() => setPage(0), [searchQuery, categoryFilter, unitFilter, rowsPerPage, property?.id]);
  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= filteredDocuments.length) {
      setPage(Math.max(0, Math.ceil(filteredDocuments.length / rowsPerPage) - 1));
    }
  }, [filteredDocuments.length, page, rowsPerPage]);

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

  const isOperationInProgress = deleting;

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
              Deleting document...
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
                {categoryOptions.map((option) => (
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
                onClick={onUploadDocument}
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

      {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={refreshDocuments}>Retry</Button>}>{loadError}</Alert>}
      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <MainCard sx={property ? { minHeight: { xs: 260, sm: 360 } } : undefined}>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FileTextOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)' }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              {groupedDocuments.length === 0 ? (loadError ? 'Documents are temporarily unavailable' : 'No documents found for this property') : 'No documents match your filters'}
            </Typography>
          </Box>
        </MainCard>
      ) : (
        <MainCard>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              overflow: 'hidden',
              ...(property ? { minHeight: { xs: 260, sm: 360 } } : {})
            }}
          >
            <Table size="medium">
              <TableHead>
                <TableRow>
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
                {filteredDocuments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((group) => {
                  const document = group.document; // Representative document
                  const unit = group.unit;
                  // Use category label for property files, document type for tenant documents
                  const docTypeLabel = documentTypeLabel(document);

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
          <TablePagination component="div" count={filteredDocuments.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />
          </MainCard>
      )}

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

