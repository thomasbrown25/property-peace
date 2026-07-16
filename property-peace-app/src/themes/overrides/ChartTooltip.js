// ==============================|| OVERRIDES - CHART TOOLTIP ||============================== //

export default function ChartTooltip(theme) {
  return {
    MuiChartsTooltip: {
      styleOverrides: {
        container: {
          overflow: 'hidden'
        },
        root: { '& div.MuiChartsTooltip-markContainer': { width: 24 } },
        table: {
          borderSpacing: '0 8px',
          '& caption': {
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.default
          }
        },
        cell: { lineHeight: 1 }
      }
    }
  };
}
