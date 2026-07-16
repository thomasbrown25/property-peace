import { useEffect, useRef, useState } from 'react';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { loadMaps } from 'googleMaps';

export default function PropertyMap({ address, propertyName }) {
  const theme = useTheme();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapAccentColor = theme.palette.primary.main;
  const mapFrameSx = {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 400,
    borderRadius: 3,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.mode === 'dark' ? alpha(mapAccentColor, 0.48) : alpha(mapAccentColor, 0.3)}`,
    boxShadow: theme.palette.mode === 'dark'
      ? `0 22px 56px ${alpha(theme.palette.common.black, 0.32)}, 0 0 0 1px ${alpha(mapAccentColor, 0.2)}, 0 0 38px ${alpha(mapAccentColor, 0.2)}`
      : `0 18px 42px ${alpha(mapAccentColor, 0.16)}, 0 0 0 1px ${alpha(mapAccentColor, 0.14)}, 0 0 34px ${alpha(mapAccentColor, 0.12)}`,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      zIndex: 2,
      boxShadow: `inset 0 0 0 1px ${alpha(mapAccentColor, theme.palette.mode === 'dark' ? 0.2 : 0.16)}`
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: `linear-gradient(90deg, ${alpha(mapAccentColor, 0.95)} 0%, ${alpha(mapAccentColor, 0.45)} 48%, transparent 100%)`,
      pointerEvents: 'none',
      zIndex: 3
    }
  };

  useEffect(() => {
    if (!address || !mapRef.current) return;

    let isMounted = true;

    const initializeMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load Google Maps
        const google = await loadMaps();

        // Initialize Geocoder
        const geocoder = new google.maps.Geocoder();

        // Geocode the address
        geocoder.geocode({ address }, (results, status) => {
          if (!isMounted) return;

          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            const lat = location.lat();
            const lng = location.lng();

            // Create map centered on the property
            const map = new google.maps.Map(mapRef.current, {
              center: { lat, lng },
              zoom: 16, // Zoom in close for property view
              mapTypeControl: false,
              streetViewControl: true,
              fullscreenControl: true,
              zoomControl: true,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                }
              ]
            });

            // Add marker
            const marker = new google.maps.Marker({
              position: { lat, lng },
              map: map,
              title: propertyName || address,
              animation: google.maps.Animation.DROP,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="20" fill="#722ed1" stroke="#ffffff" stroke-width="3"/>
                    <path d="M24 12 L24 24 L32 24 Z" fill="#ffffff" transform="rotate(45 24 24)"/>
                    <circle cx="24" cy="24" r="6" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(48, 48),
                anchor: new google.maps.Point(24, 48)
              }
            });

            // Add info window
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px;">
                  <strong style="font-size: 14px; color: #722ed1;">${propertyName || 'Property'}</strong>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${address}</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            mapInstanceRef.current = map;
            markerRef.current = marker;

            setLoading(false);
          } else {
            setError('Unable to find location for this address');
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('Error initializing map:', err);
        if (isMounted) {
          setError('Failed to load map');
          setLoading(false);
        }
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [address, propertyName]);

  if (error) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          borderRadius: 2
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={mapFrameSx}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.100',
            zIndex: 1
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <Box
        ref={mapRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          borderRadius: 2
        }}
      />
    </Box>
  );
}

