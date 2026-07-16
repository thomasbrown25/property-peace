import { FormControlLabel, Switch } from '@mui/material';
import { useState } from 'react';

export default function SwitchLabels({ label1, label2 }) {
  const [checked, setChecked] = useState(false);

  const handleChange = (event) => {
    setChecked(event.target.checked);
  };

  return (
    <FormControlLabel sx={{ mt: 1.5 }} control={<Switch checked={checked} onChange={handleChange} />} label={checked ? label2 : label1} />
  );
}
