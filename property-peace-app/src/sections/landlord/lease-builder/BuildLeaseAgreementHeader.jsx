import PropTypes from 'prop-types';
import { Box, Stack, Typography, Button, Link, alpha, useTheme } from '@mui/material';
import { LeftOutlined } from '@ant-design/icons';

export default function BuildLeaseAgreementHeader({ onBack, onSaveDraft }) {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 4 }}>
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center"
        spacing={3}
        sx={{ 
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          gap: { xs: 2, sm: 3 }
        }}
      >
        {/* Left side - Back button and Title */}
        <Stack 
          direction="column" 
          spacing={1}
          sx={{ flex: 1, minWidth: 0 }}
        >
          <Link
            component="button"
            onClick={onBack}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'text.primary',
              textDecoration: 'none',
              flexShrink: 0,
              alignSelf: 'flex-start',
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
        </Stack>

        {/* Right side - Save button */}
        <Button
          variant="outlined"
          onClick={onSaveDraft}
          sx={{
            textTransform: 'none',
            px: 3,
            py: 1,
            borderColor: 'primary.main',
            color: 'primary.main',
            flexShrink: 0,
            '&:hover': {
              borderColor: 'primary.dark',
              bgcolor: alpha(theme.palette.primary.main, 0.08)
            }
          }}
        >
          SAVE & FINISH LATER
        </Button>
      </Stack>
    </Box>
  );
}

BuildLeaseAgreementHeader.propTypes = {
  onBack: PropTypes.func.isRequired,
  onSaveDraft: PropTypes.func.isRequired,
  showTitle: PropTypes.bool
};
