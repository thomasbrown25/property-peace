import { useEffect, useRef, useState, useCallback } from 'react';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { loadMaps } from 'googleMaps';

export default function PropertiesMultiMap({ properties = [], onPropertyClick, selectedPropertyId }) {
  const theme = useTheme();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const primaryColor = theme.palette.primary.main;
  const errorColor = theme.palette.error.main;
  const mapFrameSx = {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 3,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.mode === 'dark' ? alpha(primaryColor, 0.48) : alpha(primaryColor, 0.3)}`,
    boxShadow: theme.palette.mode === 'dark'
      ? `0 22px 56px ${alpha(theme.palette.common.black, 0.32)}, 0 0 0 1px ${alpha(primaryColor, 0.2)}, 0 0 38px ${alpha(primaryColor, 0.2)}`
      : `0 18px 42px ${alpha(primaryColor, 0.16)}, 0 0 0 1px ${alpha(primaryColor, 0.14)}, 0 0 34px ${alpha(primaryColor, 0.12)}`,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      zIndex: 2,
      boxShadow: `inset 0 0 0 1px ${alpha(primaryColor, theme.palette.mode === 'dark' ? 0.2 : 0.16)}`
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: `linear-gradient(90deg, ${alpha(primaryColor, 0.95)} 0%, ${alpha(primaryColor, 0.45)} 48%, transparent 100%)`,
      pointerEvents: 'none',
      zIndex: 3
    }
  };

  const getPropertyNeedsAttention = (p) => {
    const units = p.units || p.Units || [];
    return units.some((u) => {
      const status = (u.status || u.Status || '').toLowerCase();
      return status === 'overdue';
    }) || (p.maintenanceRequests || []).some((r) => (r.priority || '').toLowerCase() === 'high');
  };

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  };

  useEffect(() => {
    if (!mapRef.current || !properties.length) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        const google = await loadMaps();
        const geocoder = new google.maps.Geocoder();

        if (!isMounted) return;

        // Initialize map centered on US if no properties geocoded yet
        const map = new google.maps.Map(mapRef.current, {
          zoom: 11,
          center: { lat: 35.2271, lng: -80.8431 }, // Default: Charlotte NC
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] }
          ]
        });

        mapInstanceRef.current = map;
        setLoading(false);

        const bounds = new google.maps.LatLngBounds();
        let geocodedCount = 0;

        clearMarkers();

        properties.forEach((property) => {
          const address = [
            property.streetAddress,
            property.city,
            property.state,
            property.zipCode
          ].filter(Boolean).join(', ');

          if (!address) return;

          const needsAttention = getPropertyNeedsAttention(property);
          const markerColor = needsAttention ? errorColor : primaryColor;

          geocoder.geocode({ address }, (results, status) => {
            if (!isMounted || status !== 'OK' || !results?.[0]) return;

            const location = results[0].geometry.location;
            bounds.extend(location);

            const marker = new google.maps.Marker({
              position: location,
              map,
              title: property.name || property.streetAddress,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: markerColor,
                fillOpacity: 0.9,
                strokeColor: '#fff',
                strokeWeight: 2
              }
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="font-family:Inter,sans-serif;padding:4px 2px;min-width:140px">
                <div style="font-weight:700;font-size:13px;color:#111">${property.name || 'Property'}</div>
                <div style="font-size:11px;color:#666;margin-top:2px">${property.streetAddress || ''}</div>
              </div>`
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
              if (onPropertyClick) onPropertyClick(property.id || property.Id);
            });

            markersRef.current.push(marker);
            geocodedCount++;

            if (geocodedCount === 1) {
              map.setCenter(location);
            }
            if (geocodedCount > 1) {
              map.fitBounds(bounds);
            }
          });
        });
      } catch (err) {
        if (isMounted) {
          setError('Map failed to load');
          setLoading(false);
        }
      }
    };

    initMap();
    return () => { isMounted = false; };
  }, [properties]);

  return (
    <Box sx={mapFrameSx}>
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.8), zIndex: 1 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="body2" color="text.secondary">{error}</Typography>
        </Box>
      )}
      <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />
    </Box>
  );
}
