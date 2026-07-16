import { Grid, Stack, Typography, FormControlLabel, Switch } from '@mui/material';

const AddSwitch = ({ title, caption, control }) => {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Stack sx={{ gap: 0.5 }}>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
      </Stack>
      <FormControlLabel control={control} label="" labelPlacement="start" />
    </Stack>
  );
};

export default AddSwitch;
