import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { FormControl, Box, MenuItem, Select, Typography } from '@mui/material';

const InputSelectGroup = ({ label, name, value, onChange, required, items }) => (
  <Box display="flex" alignItems="center" mb={1} sx={{ width: '100%' }}>
    <Box mr={2} sx={{ minWidth: '150px' }}>
      <Typography variant="body3">{label}</Typography>
    </Box>
    <Box>
      <FormControl
        variant="outlined"
        fullWidth
        sx={{
          minWidth: 170,
          minHeight: '24px',
          borderRadius: '2px',
          marginTop: '.175rem',
          '& .MuiInputLabel-root': {
            fontSize: '0.8rem'
          }
        }}
      >
        <Select
          name={name}
          value={value}
          onChange={onChange}
          fullWidth
          required={required}
          IconComponent={KeyboardArrowDown}
          sx={{
            height: '24px',
            fontSize: '0.8rem',
            borderRadius: '2px',
            marginTop: '.175rem',
            '& .MuiSelect-select': {
              paddingX: '7px!important',
              minHeight: 'unset'
            }
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                padding: 0,
                marginTop: '5px',
                borderRadius: '2px'
              }
            },
            MenuListProps: {
              sx: {
                padding: 0
              }
            }
          }}
        >
          {items?.map((item) => (
            <MenuItem
              key={item.id}
              value={item.value}
              disabled={item.disabled || false}
              sx={{ fontSize: '0.8rem', marginLeft: '0', paddingLeft: '12px', borderRadius: 0 }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  </Box>
);

export default InputSelectGroup;
