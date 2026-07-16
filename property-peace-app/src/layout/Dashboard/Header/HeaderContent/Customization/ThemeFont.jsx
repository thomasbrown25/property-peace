import { Box, FormControlLabel, Grid, Radio, RadioGroup, Stack, Typography } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import useConfig from 'hooks/useConfig';

// ==============================|| CUSTOMIZATION - FONT FAMILY ||============================== //

export default function ThemeFont() {
  const { fontFamily, onChangeFontFamily } = useConfig();

  const handleFontChange = (event) => {
    onChangeFontFamily(event.target.value);
  };

  const fonts = [
    {
      id: 'inter',
      value: `'Inter', sans-serif`,
      label: 'Inter'
    },
    {
      id: 'roboto',
      value: `'Roboto', sans-serif`,
      label: 'Roboto'
    },
    {
      id: 'poppins',
      value: `'Poppins', sans-serif`,
      label: 'Poppins'
    },
    {
      id: 'public-sans',
      value: `'Public Sans', sans-serif`,
      label: 'Public Sans'
    }
  ];

  return (
    <RadioGroup row aria-label="theme-font" name="theme-font" value={fontFamily} onChange={handleFontChange} sx={{ px: 1.5 }}>
      <Grid container spacing={2}>
        {fonts.map((item, index) => (
          <Grid key={index}>
            <FormControlLabel
              control={<Radio value={item.value} sx={{ display: 'none' }} />}
              label={
                <MainCard
                  content={false}
                  border={false}
                  boxShadow
                  sx={(theme) => ({
                    bgcolor: 'secondary.lighter',
                    p: 1,
                    ...(fontFamily === item.value && {
                      bgcolor: 'primary.lighter',
                      boxShadow: theme.customShadows.primary,
                      '&:hover': { boxShadow: theme.customShadows.primary }
                    })
                  })}
                >
                  <Box sx={{ minWidth: 60, bgcolor: 'background.paper', p: 1, '&:hover': { bgcolor: 'background.paper' } }}>
                    <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
                      <Typography variant="h5" color="text.primary" sx={{ fontFamily: item.value }}>
                        Aa
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                    </Stack>
                  </Box>
                </MainCard>
              }
            />
          </Grid>
        ))}
      </Grid>
    </RadioGroup>
  );
}
