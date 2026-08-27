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
import axiosServices from 'utils/axios';
import { getAllTenants } from 'store/tenant/tenant.action';
import { parseCSV as aiParseCSV, aiMapCsvRowsWithAgent, IMPORT_FIELD_DEFINITIONS } from 'utils/aiCsvImportAgent';

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' && !inQuotes) || c === '\n') {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < 1) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function getRowValue(row, ...keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    for (const header of Object.keys(row)) {
      if (normalizeHeader(header) === normalized) {
        return row[header];
      }
    }
  }
  return '';
}

const SAMPLE_CSV = [
  { first_name: 'John', last_name: 'Smith', email: 'john.smith@example.com', phone_number: '(555) 123-4567' },
  { first_name: 'Jane', last_name: 'Doe', email: 'jane.doe@example.com', phone_number: '(555) 987-6543' },
  { first_name: 'Michael', last_name: 'Johnson', email: '', phone_number: '(555) 555-5555' },
  { first_name: 'Sarah', last_name: 'Williams', email: 'sarah.w@example.com', phone_number: '' },
  { first_name: 'Robert', last_name: 'Brown', email: '', phone_number: '' }
];

export default function TenantImportPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();

  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        openSnackbar({
          open: true,
          message: 'Please select a CSV file',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }
      setCsvFile(file);
      setResults(null);
    }
  };

  const parseRow = (row, rowIndex) => {
    const firstName = getRowValue(row, 'first_name', 'firstname', 'first name');
    const lastName = getRowValue(row, 'last_name', 'lastname', 'last name');
    const email = getRowValue(row, 'email', 'e_mail');
    const phoneNumber = getRowValue(row, 'phone_number', 'phonenumber', 'phone number', 'phone');

    const hasRequired = firstName.trim() && lastName.trim();

    return {
      rowIndex,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      hasRequired,
      errors: hasRequired ? [] : ['First name and last name are required']
    };
  };

  const handleImport = async () => {
    if (!csvFile) {
      openSnackbar({
        open: true,
        message: 'Please select a CSV file',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const text = await csvFile.text();
      const parsedRows = aiParseCSV(text);
      const aiMappingResult = await aiMapCsvRowsWithAgent('tenants', parsedRows, IMPORT_FIELD_DEFINITIONS.tenants);
      const rows = aiMappingResult.rows;

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV file. Ensure the first row contains headers and data starts on row 2.');
      }

      if (aiMappingResult.unmappedFields.length > 0) {
        const available = aiMappingResult.sourceHeaders.join(', ');
        throw new Error(`AI could not map required columns: ${aiMappingResult.unmappedFields.join(', ')}. Found: ${available || 'none'}`);
      }

      let successCount = 0;
      const errors = [];
      let skippedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowIndex = i + 2; // 1-based, +1 for header
        const parsed = parseRow(rows[i], rowIndex);

        // Skip rows without both first and last name
        if (!parsed.hasRequired) {
          skippedCount++;
          errors.push(`Row ${rowIndex}: Skipped - first name and last name are required`);
          continue;
        }

        try {
          const payload = {
            Firstname: parsed.firstName,
            Lastname: parsed.lastName,
            Email: parsed.email || null,
            PhoneNumber: parsed.phoneNumber || null,
            PropertyId: null,
            UnitId: null,
            LeaseId: null
          };

          const response = await axiosServices.post('/api/tenant', payload);

          if (response?.data?.data?.Id || response?.data?.data?.id) {
            successCount++;
          } else {
            errors.push(`Row ${rowIndex}: Failed to create tenant (${parsed.firstName} ${parsed.lastName})`);
          }
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || 'Unknown error';
          errors.push(`Row ${rowIndex}: ${msg}`);
        }
      }

      setResults({
        successCount,
        errors,
        skippedCount,
        total: rows.length
      });

      if (successCount > 0) {
        await dispatch(getAllTenants());
        openSnackbar({
          open: true,
          message: `Successfully imported ${successCount} tenant${successCount === 1 ? '' : 's'}${errors.length > 0 ? `. ${errors.length} row(s) had issues.` : ''}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      }

      if (errors.length > 0 && successCount === 0 && skippedCount === rows.length) {
        openSnackbar({
          open: true,
          message: 'No tenants were created. All rows were skipped (first name and last name are required).',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } else if (errors.length > 0 && successCount === 0) {
        openSnackbar({
          open: true,
          message: 'Failed to import tenants. Check the error list below.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.message || 'Failed to import CSV file',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setResults({
        successCount: 0,
        errors: [err?.message],
        skippedCount: 0,
        total: 0
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Tenants', path: '/landlord/leases?tab=tenants' },
          { label: 'Import' }
        ]}
      />

      <MainCard sx={{ mt: 3 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h4" fontWeight={600}>
              Import Tenants
            </Typography>
            <Button
              size="small"
              startIcon={<ArrowLeftOutlined />}
              onClick={() => navigate('/landlord/leases?tab=tenants')}
              sx={{ textTransform: 'none' }}
            >
              Back to Tenants
            </Button>
          </Box>

          {/* Template Documentation */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              borderRadius: 2
            }}
          >
            <Typography variant="h6" fontWeight={600} gutterBottom>
              CSV Template Format
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Keep using this template for the cleanest import. If your CSV has different column names, the AI import agent will auto-map matching fields before importing. <strong>First name and last name are required.</strong> Rows
              without both values will be skipped.
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
                <TableRow>
                  <TableCell>first_name</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Tenant&apos;s first name</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>last_name</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Tenant&apos;s last name</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>email</TableCell>
                  <TableCell>No</TableCell>
                  <TableCell>Tenant&apos;s email address</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>phone_number</TableCell>
                  <TableCell>No</TableCell>
                  <TableCell>Tenant&apos;s phone number</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Example CSV:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: alpha(theme.palette.grey[500], 0.1),
                borderRadius: 1,
                fontSize: '0.8rem',
                overflow: 'auto'
              }}
            >
              {`first_name,last_name,email,phone_number
John,Smith,john.smith@example.com,(555) 123-4567
Jane,Doe,jane.doe@example.com,(555) 987-6543
Michael,Johnson,,(555) 555-5555
Sarah,Williams,sarah.w@example.com,
Robert,Brown,,`}
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Rows missing first name or last name will be skipped. Imported tenants will be created in your organization without a property or lease
              assignment; you can link them to units later.
            </Typography>
          </Paper>

          {/* Download Template */}
          <Box sx={{ mb: 1 }}>
            <CSVLink
              data={SAMPLE_CSV}
              filename="tenant-import-template.csv"
              headers={['first_name', 'last_name', 'email', 'phone_number']}
              style={{ textDecoration: 'none' }}
            >
              <Button
                variant="outlined"
                color="primary"
                startIcon={<DownloadOutlined />}
                sx={{ textTransform: 'none' }}
              >
                Download Template
              </Button>
            </CSVLink>
          </Box>

          {/* File Upload */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              borderRadius: 2,
              borderStyle: 'dashed',
              borderWidth: 2
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="tenant-csv-input"
            />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <label htmlFor="tenant-csv-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImportOutlined />}
                  sx={{
                    textTransform: 'none',
                    borderStyle: 'dashed',
                    '&:hover': {
                      borderStyle: 'dashed',
                      bgcolor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
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

          {/* Results */}
          {results && (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                borderRadius: 2
              }}
            >
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Import Results
              </Typography>
              <Alert
                severity={results.successCount > 0 ? (results.errors.length > 0 ? 'warning' : 'success') : 'error'}
                sx={{ mb: 2 }}
              >
                {results.successCount} of {results.total} tenant{results.total === 1 ? '' : 's'} imported successfully.
                {results.skippedCount > 0 && ` ${results.skippedCount} row(s) skipped.`}
                {results.errors.filter((e) => !e.includes('Skipped')).length > 0 &&
                  ` ${results.errors.filter((e) => !e.includes('Skipped')).length} error(s).`}
              </Alert>
              {results.errors.length > 0 && (
                <Box>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    Details:
                  </Typography>
                  <Box
                    component="ul"
                    sx={{
                      m: 0,
                      pl: 2.5,
                      maxHeight: 200,
                      overflow: 'auto'
                    }}
                  >
                    {results.errors.map((err, idx) => (
                      <li key={idx}>
                        <Typography
                          variant="body2"
                          color={err.includes('Skipped') ? 'text.secondary' : 'error.main'}
                          sx={{ fontStyle: err.includes('Skipped') ? 'italic' : 'normal' }}
                        >
                          {err}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          )}
        </Stack>
      </MainCard>
    </Box>
  );
}
