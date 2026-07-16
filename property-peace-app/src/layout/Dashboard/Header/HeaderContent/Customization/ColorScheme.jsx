// material-ui
import { alpha } from '@mui/system';
import { CardMedia } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { Grid } from '@mui/material';
import { Radio } from '@mui/material';
import { RadioGroup } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import useConfig from 'hooks/useConfig';
import { ThemeMode } from 'config';

// assets
import colorLayout from 'assets/images/customization/theme-color.svg';

// ==============================|| CUSTOMIZATION - COLOR SCHEME ||============================== //

export default function ColorScheme() {
  const { mode, presetColor, onChangePresetColor } = useConfig();

  const colorOptions = [
    {
      id: 'default',
      primary: '#061e35',
      lighter: mode === ThemeMode.DARK ? '#0d1e2e' : '#E8EEF3',
      label: 'Default',
      shadow: `0 0 0 2px ${alpha('#061e35', 0.2)}`
    },
    {
      id: 'theme2',
      primary: mode === ThemeMode.DARK ? '#655ac8' : '#7265E6',
      lighter: mode === ThemeMode.DARK ? '#222130' : '#EEEDFC',
      label: 'Violet',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#655ac8' : '#7265E6', 0.2)}`
    },
    {
      id: 'theme3',
      primary: mode === ThemeMode.DARK ? '#0a7d3e' : '#068e44',
      lighter: mode === ThemeMode.DARK ? '#1a231f' : '#E6F3EC',
      label: 'Forest',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#0a7d3e' : '#068e44', 0.2)}`
    },
    {
      id: 'theme4',
      primary: mode === ThemeMode.DARK ? '#5d7dcb' : '#3c64d0',
      lighter: mode === ThemeMode.DARK ? '#1d212d' : '#f0f6ff',
      label: 'Slate',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#5d7dcb' : '#3c64d0', 0.2)}`
    },
    {
      id: 'theme5',
      primary: mode === ThemeMode.DARK ? '#d26415' : '#f27013',
      lighter: mode === ThemeMode.DARK ? '#32221a' : '#fff4e6',
      label: 'Amber',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#d26415' : '#f27013', 0.2)}`
    },
    {
      id: 'theme6',
      primary: mode === ThemeMode.DARK ? '#288d99' : '#2aa1af',
      lighter: mode === ThemeMode.DARK ? '#1c2628' : '#e1f0ef',
      label: 'Teal',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#288d99' : '#2aa1af', 0.2)}`
    },
    {
      id: 'theme7',
      primary: mode === ThemeMode.DARK ? '#05934c' : '#00a854',
      lighter: mode === ThemeMode.DARK ? '#1a2721' : '#d1e8d99c',
      label: 'Emerald',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#05934c' : '#00a854', 0.2)}`
    },
    {
      id: 'theme8',
      primary: mode === ThemeMode.DARK ? '#058478' : '#009688',
      lighter: mode === ThemeMode.DARK ? '#1a2524' : '#c1d6d066',
      label: 'Jade',
      shadow: `0 0 0 2px ${alpha(mode === ThemeMode.DARK ? '#058478' : '#009688', 0.2)}`
    }
  ];

  const handlePresetColorChange = (event) => {
    onChangePresetColor(event.target.value);
  };

  return (
    <RadioGroup row aria-label="color-scheme" name="color-scheme" value={presetColor} onChange={handlePresetColorChange} sx={{ px: 1.5 }}>
      <Grid container spacing={2}>
        {colorOptions.map((color, index) => (
          <Grid key={index}>
            <FormControlLabel
              control={<Radio value={color.id} sx={{ display: 'none' }} />}
              label={
                <MainCard
                  content={false}
                  border={false}
                  boxShadow
                  sx={{
                    bgcolor: 'secondary.lighter',
                    p: 1,
                    ...(presetColor === color.id && {
                      bgcolor: color.lighter,
                      boxShadow: color.shadow,
                      '&:hover': { boxShadow: color.shadow }
                    })
                  }}
                >
                  <Stack sx={{ gap: 1.5, alignItems: 'center' }}>
                    <CardMedia
                      component="img"
                      src={colorLayout}
                      alt="Vertical"
                      sx={{
                        border: '1px solid',
                        borderColor: color.primary,
                        borderRadius: 1,
                        bgcolor: color.primary,
                        width: 40,
                        height: 40
                      }}
                    />
                    <Typography variant="caption">{color.label}</Typography>
                  </Stack>
                </MainCard>
              }
            />
          </Grid>
        ))}
      </Grid>
    </RadioGroup>
  );
}
