import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
  useTheme,
  Link,
  Paper
} from '@mui/material';
import {
  LeftOutlined,
  FileTextOutlined,
  DollarOutlined,
  TeamOutlined,
  SafetyOutlined,
  HomeOutlined,
  SettingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { openSnackbar } from 'api/snackbar';

// Workflow sections
const workflowSections = [
  {
    id: 'lease-specifics',
    icon: <FileTextOutlined style={{ fontSize: 24 }} />,
    title: 'Lease Specifics',
    description: 'Verify the address and lease terms.'
  },
  {
    id: 'rent-deposit-fees',
    icon: <DollarOutlined style={{ fontSize: 24 }} />,
    title: 'Rent, Deposit, & Fees',
    description: 'Set the rent amount, security deposit, and fees.'
  },
  {
    id: 'people-on-lease',
    icon: <TeamOutlined style={{ fontSize: 24 }} />,
    title: 'People on the Lease',
    description: 'Confirm the landlord and tenant info.'
  },
  {
    id: 'pets-smoking-other',
    icon: <SafetyOutlined style={{ fontSize: 24 }} />,
    title: 'Pets, Smoking, & Other',
    description: 'Specify pets, smoking policy, and if renters insurance is required.'
  },
  {
    id: 'utilities-maintenance-keys',
    icon: <HomeOutlined style={{ fontSize: 24 }} />,
    title: 'Utilities, Maintenance, & Keys',
    description: 'Choose what is included with the lease.'
  },
  {
    id: 'provisions-attachments',
    icon: <FileTextOutlined style={{ fontSize: 24 }} />,
    title: 'Provisions & Attachments',
    description: 'Add custom clauses, rules, or provisions.'
  }
];

export default function CreateLeaseAgreementPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [editorMode, setEditorMode] = useState('builder');
  const [completedSections, setCompletedSections] = useState(new Set());
  const [draftData, setDraftData] = useState(null);

  // Load draft data if available
  useEffect(() => {
    const savedDraft = localStorage.getItem('leaseAgreementDraft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setDraftData(parsed);
        setCompletedSections(new Set(parsed.completedSections || []));
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);

  const handleSaveDraft = () => {
    const draft = {
      completedSections: Array.from(completedSections),
      editorMode,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('leaseAgreementDraft', JSON.stringify(draft));
    setDraftData(draft);
    
    dispatch(
      openSnackbar({
        open: true,
        message: 'Draft saved successfully',
        variant: 'alert',
        alert: { color: 'success' }
      })
    );
  };

  const handleStartSection = (sectionId) => {
    // Navigate to section editor (to be implemented)
    navigate(`/landlord/create-lease-agreement/${sectionId}`);
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Link
            component="button"
            onClick={handleBack}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            <LeftOutlined style={{ fontSize: 16 }} />
            <Typography variant="body1" fontWeight={500}>
              BACK
            </Typography>
          </Link>
          <Button
            variant="outlined"
            onClick={handleSaveDraft}
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            SAVE & FINISH LATER
          </Button>
        </Stack>

        {/* Page Title */}
        <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
          Create Your North Carolina Lease Agreement
        </Typography>

        {/* Main Content */}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={4}>
          {/* Left Panel */}
          <Box sx={{ flex: 1, maxWidth: { lg: '600px' } }}>
            <Stack spacing={3}>
              {/* Complete Each Section Header */}
              <Box>
                <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
                  Complete Each Section
                </Typography>
                
                {/* Builder/Advanced Editor Toggle */}
                <ToggleButtonGroup
                  value={editorMode}
                  exclusive
                  onChange={(e, newMode) => {
                    if (newMode !== null) {
                      setEditorMode(newMode);
                    }
                  }}
                  sx={{
                    mb: 3,
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      px: 3,
                      py: 1,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        }
                      }
                    }
                  }}
                >
                  <ToggleButton value="builder">Builder</ToggleButton>
                  <ToggleButton value="advanced">Advanced Editor</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Information Box */}
              <Card
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  borderRadius: 2
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InfoCircleOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                      <Typography variant="h6" fontWeight={600} color="primary.main">
                        Here's what you need to know:
                      </Typography>
                    </Stack>
                    <Stack spacing={1.5} sx={{ pl: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        • Our North Carolina lease agreement was drafted by legal professionals to keep you compliant and covered.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Purchase a single-use lease agreement for $59 (e-sign included), or you can get Premium for unlimited lease agreements.{' '}
                        <Link href="#" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
                          Learn about Premium
                        </Link>
                        .
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Once completed, send the lease agreement to your tenants to e-sign or choose to print it instead.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Edit the lease agreement, even after you've paid, until it's been signed.
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Workflow Sections */}
              <Stack spacing={2}>
                {workflowSections.map((section, index) => {
                  const isCompleted = completedSections.has(section.id);
                  return (
                    <Card
                      key={section.id}
                      sx={{
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
                        }
                      }}
                    >
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 1.5,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'primary.main',
                              flexShrink: 0
                            }}
                          >
                            {section.icon}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
                              <Typography variant="h6" fontWeight={600}>
                                {section.title}
                              </Typography>
                              {isCompleted && (
                                <Box
                                  sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    bgcolor: 'success.main',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  <Typography variant="caption" color="white" fontWeight={700}>
                                    ✓
                                  </Typography>
                                </Box>
                              )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {section.description}
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleStartSection(section.id)}
                              sx={{
                                textTransform: 'none',
                                borderColor: 'primary.main',
                                color: 'primary.main',
                                '&:hover': {
                                  borderColor: 'primary.dark',
                                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                                }
                              }}
                            >
                              START
                            </Button>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Stack>
          </Box>

          {/* Right Panel - Document Preview */}
          <Box sx={{ flex: 1, maxWidth: { lg: '500px' }, position: 'sticky', top: 20, alignSelf: 'flex-start' }}>
            <MainCard
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={600}>
                  DRAFT AGREEMENT
                </Typography>
                
                {/* Document Preview */}
                <Paper
                  sx={{
                    p: 4,
                    bgcolor: 'background.paper',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    borderRadius: 1,
                    position: 'relative',
                    minHeight: 400,
                    overflow: 'hidden'
                  }}
                >
                  {/* Watermark */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-45deg)',
                      opacity: 0.1,
                      zIndex: 0
                    }}
                  >
                    <Typography
                      variant="h4"
                      fontWeight={700}
                      sx={{
                        fontSize: '3rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Property Peace DRAFT AGREEMENT
                    </Typography>
                  </Box>

                  {/* Document Content */}
                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                      Company Name
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      (Tenant Names)
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                      Summary of Key Information
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Property Address:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lease Term:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Monthly Rent:
                      </Typography>
                    </Stack>
                  </Box>
                </Paper>

                {/* Preview Button */}
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<FileTextOutlined />}
                  sx={{
                    textTransform: 'none',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    py: 1.5,
                    '&:hover': {
                      borderColor: 'primary.dark',
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  }}
                >
                  PREVIEW MY LEASE
                </Button>
              </Stack>
            </MainCard>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
