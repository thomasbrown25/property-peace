import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  alpha,
  useTheme
} from '@mui/material';
import { ImportOutlined, ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { CSVLink } from 'react-csv';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import { addVendor, getVendors } from 'store/vendor/vendor.action';
import { parseCSV, aiMapCsvRowsWithAgent, IMPORT_FIELD_DEFINITIONS } from 'utils/aiCsvImportAgent';

const VENDOR_COLUMNS = [
  'name',
  'business_name',
  'email',
  'phone',
  'category',
  'address',
  'city',
  'state',
  'zip_code',
  'tax_id',
  'license_number',
  'requires_1099',
  'notes'
];

const SAMPLE_CSV = [
  {
    name: 'Alex Morgan',
    business_name: 'Morgan Plumbing LLC',
    email: 'alex@morganplumbing.com',
    phone: '(555) 111-2233',
    category: 'Plumbing',
    address: '100 Service Rd',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    tax_id: '',
    license_number: 'PL-12345',
    requires_1099: 'true',
    notes: 'Preferred emergency plumber'
  },
  {
    name: 'BrightLine Electric',
    business_name: 'BrightLine Electric',
    email: 'dispatch@brightline.example',
    phone: '(555) 444-9911',
    category: 'Electrical',
    address: '',
    city: 'Houston',
    state: 'TX',
    zip_code: '77002',
    tax_id: '',
    license_number: '',
    requires_1099: 'yes',
    notes: ''
  }
];

function parseBool(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', ''].includes(normalized)) return false;
  return false;
}

export default function VendorImportPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();

  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      openSnackbar({ open: true, message: 'Please select a CSV file', variant: 'alert', alert: { color: 'error' } });
      return;
    }

    setCsvFile(file);
    setResults(null);
  };

  const parseVendorRow = (row, rowIndex) => {
    const name = String(row.name || '').trim();
    return {
      rowIndex,
      payload: {
        LandlordId: user?.id ?? user?.Id,
        Name: name,
        BusinessName: String(row.business_name || '').trim() || null,
        Email: String(row.email || '').trim() || null,
        Phone: String(row.phone || '').trim() || null,
        Category: String(row.category || '').trim() || null,
        Address: String(row.address || '').trim() || null,
        City: String(row.city || '').trim() || null,
        State: String(row.state || '').trim() || null,
        ZipCode: String(row.zip_code || '').trim() || null,
        TaxId: String(row.tax_id || '').trim() || null,
        LicenseNumber: String(row.license_number || '').trim() || null,
        Requires1099: parseBool(row.requires_1099),
        Notes: String(row.notes || '').trim() || null
      },
      errors: name ? [] : ['Vendor name is required']
    };
  };

  const handleImport = async () => {
    if (!csvFile) {
      openSnackbar({ open: true, message: 'Please select a CSV file', variant: 'alert', alert: { color: 'error' } });
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const text = await csvFile.text();
      const parsedRows = parseCSV(text);
      const aiMappingResult = await aiMapCsvRowsWithAgent('vendors', parsedRows, IMPORT_FIELD_DEFINITIONS.vendors);
      const rows = aiMappingResult.rows;

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV file. Ensure the first row contains headers and data starts on row 2.');
      }

      if (aiMappingResult.unmappedFields.length > 0) {
        const available = aiMappingResult.sourceHeaders.join(', ');
        throw new Error(`AI could not map required columns: ${aiMappingResult.unmappedFields.join(', ')}. Found: ${available || 'none'}`);
      }

      let successCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const rowIndex = i + 2;
        const parsed = parseVendorRow(rows[i], rowIndex);

        if (parsed.errors.length > 0) {
          skippedCount++;
          errors.push(`Row ${rowIndex}: Skipped - ${parsed.errors.join('; ')}`);
          continue;
        }

        const result = await dispatch(addVendor(parsed.payload));
        if (result?.success) {
          successCount++;
        } else {
          errors.push(`Row ${rowIndex}: ${result?.message || 'Failed to create vendor'}`);
        }
      }

      setResults({ successCount, skippedCount, errors, total: rows.length });

      if (successCount > 0) {
        await dispatch(getVendors(user?.id ?? user?.Id, false));
        openSnackbar({
          open: true,
          message: `Successfully imported ${successCount} vendor${successCount === 1 ? '' : 's'}${errors.length > 0 ? `. ${errors.length} row(s) had issues.` : ''}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({ open: true, message: 'Failed to import vendors. Check the error list below.', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.message || 'Failed to import CSV file', variant: 'alert', alert: { color: 'error' } });
      setResults({ successCount: 0, skippedCount: 0, errors: [err?.message || 'Failed to import CSV file'], total: 0 });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Vendors', path: '/landlord/vendors' },
          { label: 'Import' }
        ]}
      />

      <MainCard sx={{ mt: 3 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h4" fontWeight={600}>
              Import Vendors
            </Typography>
            <Button size="small" startIcon={<ArrowLeftOutlined />} onClick={() => navigate('/landlord/vendors')} sx={{ textTransform: 'none' }}>
              Back to Vendors
            </Button>
          </Box>

          <Paper variant="outlined" sx={{ p: 3, bgcolor: alpha(theme.palette.background.paper, 0.6), borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              CSV Template Format
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Keep using this template for the cleanest import. If your CSV has different column names, the AI import agent will auto-map matching fields before importing. <strong>Vendor name is required.</strong>
            </Typography>

            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Required</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  ['name', 'Yes', 'Vendor or contractor name'],
                  ['business_name', 'No', 'Company or business name'],
                  ['email', 'No', 'Vendor email address'],
                  ['phone', 'No', 'Vendor phone number'],
                  ['category', 'No', 'Trade or service type, such as Plumbing or Electrical'],
                  ['address', 'No', 'Street address'],
                  ['city', 'No', 'City'],
                  ['state', 'No', 'State'],
                  ['zip_code', 'No', 'Zip code'],
                  ['tax_id', 'No', 'TIN/EIN if available'],
                  ['license_number', 'No', 'Contractor license number'],
                  ['requires_1099', 'No', 'true/false or yes/no'],
                  ['notes', 'No', 'Internal notes']
                ].map(([column, required, description]) => (
                  <TableRow key={column}>
                    <TableCell>{column}</TableCell>
                    <TableCell>{required}</TableCell>
                    <TableCell>{description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Example CSV:
            </Typography>
            <Box component="pre" sx={{ p: 2, bgcolor: alpha(theme.palette.grey[500], 0.1), borderRadius: 1, fontSize: '0.8rem', overflow: 'auto' }}>
              {`name,business_name,email,phone,category,address,city,state,zip_code,tax_id,license_number,requires_1099,notes
Alex Morgan,Morgan Plumbing LLC,alex@morganplumbing.com,(555) 111-2233,Plumbing,100 Service Rd,Austin,TX,78701,,PL-12345,true,Preferred emergency plumber
BrightLine Electric,BrightLine Electric,dispatch@brightline.example,(555) 444-9911,Electrical,,Houston,TX,77002,,,yes,`}
            </Box>
          </Paper>

          <Box sx={{ mb: 1 }}>
            <CSVLink data={SAMPLE_CSV} filename="vendor-import-template.csv" headers={VENDOR_COLUMNS} style={{ textDecoration: 'none' }}>
              <Button variant="outlined" color="primary" startIcon={<DownloadOutlined />} sx={{ textTransform: 'none' }}>
                Download Template
              </Button>
            </CSVLink>
          </Box>

          <Paper variant="outlined" sx={{ p: 3, bgcolor: alpha(theme.palette.background.paper, 0.6), borderRadius: 2, borderStyle: 'dashed', borderWidth: 2 }}>
            <input type="file" accept=".csv" onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} id="vendor-csv-input" />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <label htmlFor="vendor-csv-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImportOutlined />}
                  sx={{ textTransform: 'none', borderStyle: 'dashed', '&:hover': { borderStyle: 'dashed', bgcolor: alpha(theme.palette.primary.main, 0.04) } }}
                >
                  {csvFile ? csvFile.name : 'Select CSV File'}
                </Button>
              </label>
              <Button
                variant="contained"
                color="primary"
                startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <ImportOutlined />}
                onClick={handleImport}
                disabled={!csvFile || importing}
                sx={{ textTransform: 'none' }}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
              {results && (
                <Button variant="text" onClick={handleReset} sx={{ textTransform: 'none' }}>
                  Reset
                </Button>
              )}
            </Stack>
          </Paper>

          {results && (
            <Paper variant="outlined" sx={{ p: 3, bgcolor: alpha(theme.palette.background.paper, 0.6), borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Import Results
              </Typography>
              <Alert severity={results.successCount > 0 ? (results.errors.length > 0 ? 'warning' : 'success') : 'error'} sx={{ mb: 2 }}>
                {results.successCount} of {results.total} vendor{results.total === 1 ? '' : 's'} imported successfully.
                {results.skippedCount > 0 && ` ${results.skippedCount} row(s) skipped.`}
                {results.errors.length > 0 && ` ${results.errors.length} issue(s).`}
              </Alert>
              {results.errors.length > 0 && (
                <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflow: 'auto' }}>
                  {results.errors.map((err, idx) => (
                    <li key={idx}>
                      <Typography variant="body2" color={err.includes('Skipped') ? 'text.secondary' : 'error.main'} sx={{ fontStyle: err.includes('Skipped') ? 'italic' : 'normal' }}>
                        {err}
                      </Typography>
                    </li>
                  ))}
                </Box>
              )}
            </Paper>
          )}
        </Stack>
      </MainCard>
    </Box>
  );
}
