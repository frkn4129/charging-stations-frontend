import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { Box, Paper, Typography, Button, IconButton, Fab } from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import NearMeIcon from '@mui/icons-material/NearMe';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet default icon sorunu için fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Mesafe hesaplama fonksiyonu
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function LocationMarker({ onLocationFound }) {
  const map = useMap();
  const [locationError, setLocationError] = useState(false);

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
        if (result.state === 'granted' || result.state === 'prompt') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const latlng = { lat: latitude, lng: longitude };
              
              // Kullanıcı konumu için özel marker
              const userIcon = L.divIcon({
                className: 'custom-user-marker',
                html: `
                  <div style="
                    background-color: #2196f3;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <div style="
                      width: 8px;
                      height: 8px;
                      background: white;
                      border-radius: 50%;
                    "></div>
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });

              // Önceki marker'ı temizle
              map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-user-marker') {
                  map.removeLayer(layer);
                }
              });

              // Yeni marker ekle
              L.marker(latlng, { icon: userIcon }).addTo(map);
              
              onLocationFound(latlng);
              map.setView(latlng, 13);
              setLocationError(false);
            },
            (error) => {
              console.error('Konum alınamadı:', error);
              setLocationError(true);
              // Varsayılan konum: Ankara
              const defaultLocation = { lat: 39.925533, lng: 32.866287 };
              onLocationFound(defaultLocation);
              map.setView([defaultLocation.lat, defaultLocation.lng], 13);
            },
            options
          );
        } else {
          setLocationError(true);
        }
      });
    }
  };

  useEffect(() => {
    getCurrentLocation();

    // Konum izleme
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const latlng = { lat: latitude, lng: longitude };
        onLocationFound(latlng);
      },
      (error) => {
        console.error('Konum izleme hatası:', error);
      },
      { enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map, onLocationFound]);

  return (
    locationError && (
      <Paper
        sx={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          p: 2,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 2,
          maxWidth: '90%',
          textAlign: 'center',
          boxShadow: 3
        }}
      >
        <Typography variant="body2" color="error">
          Konumunuza erişilemiyor. Lütfen konum iznini kontrol edin.
        </Typography>
        <Button
          size="small"
          variant="contained"
          sx={{ mt: 1 }}
          onClick={getCurrentLocation}
        >
          Konumu Etkinleştir
        </Button>
      </Paper>
    )
  );
}

const Map = ({ stations }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Kullanıcı konumu değiştiğinde en yakın istasyonları hesapla
  useEffect(() => {
    if (userLocation && stations) {
      const stationsWithDistance = stations.map(station => ({
        ...station,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          station.latitude,
          station.longitude
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10); // En yakın 10 istasyon

      setNearbyStations(stationsWithDistance);
    }
  }, [userLocation, stations]);

  // Google Maps'te rotayı aç
  const openInGoogleMaps = (station) => {
    if (userLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${station.latitude},${station.longitude}&travelmode=driving`;
      window.open(url, '_blank');
    }
  };

  // Rota çizme
  const showRoute = async (station) => {
    if (userLocation) {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${station.longitude},${station.latitude}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          setRouteCoordinates(data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]));
          setSelectedStation(station);
        }
      } catch (error) {
        console.error('Rota alınamadı:', error);
      }
    }
  };

  return (
    <Box sx={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[39.925533, 32.866287]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <LocationMarker onLocationFound={setUserLocation} />
        
        {routeCoordinates && (
          <Polyline
            positions={routeCoordinates}
            color="#2196f3"
            weight={4}
            opacity={0.7}
          />
        )}

        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
          >
            <Popup>
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {station.name}
                </Typography>
                <Typography variant="body2">{station.address}</Typography>
                <Typography variant="body2" sx={{ 
                  color: station.status === 'available' ? 'success.main' : 
                         station.status === 'busy' ? 'error.main' : 'text.secondary',
                  fontWeight: 'bold'
                }}>
                  Durum: {station.status}
                </Typography>
                {userLocation && (
                  <Typography variant="body2">
                    Mesafe: {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      station.latitude,
                      station.longitude
                    ).toFixed(1)} km
                  </Typography>
                )}
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<DirectionsIcon />}
                    onClick={() => showRoute(station)}
                  >
                    Rota Çiz
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => openInGoogleMaps(station)}
                    sx={{ bgcolor: 'primary.main', color: 'white' }}
                  >
                    <NearMeIcon />
                  </IconButton>
                </Box>
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Açma/Kapama butonu */}
      <Fab
        color="primary"
        size="small"
        sx={{
          position: 'fixed',
          bottom: isPanelOpen ? '40vh' : 16,
          right: 16,
          zIndex: 1001,
          transition: 'bottom 0.3s ease-in-out'
        }}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        {isPanelOpen ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
      </Fab>

      {/* İstasyon listesi paneli */}
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: isPanelOpen ? 0 : '-40vh',
          left: 0,
          right: 0,
          height: '40vh',
          borderRadius: '16px 16px 0 0',
          zIndex: 1000,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          transition: 'bottom 0.3s ease-in-out',
          pb: 'env(safe-area-inset-bottom)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Kaydırma göstergesi */}
        <Box
          sx={{
            width: '40px',
            height: '4px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '2px',
            margin: '8px auto',
          }}
        />

        <Box sx={{ 
          p: 2, 
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' // iOS için düzgün kaydırma
        }}>
          <Typography variant="h6" gutterBottom>
            En Yakın 10 İstasyon
          </Typography>
          {nearbyStations.map(station => (
            <Box
              key={station.id}
              sx={{
                p: 1.5,
                mb: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:active': { // Mobil için dokunma efekti
                  bgcolor: 'action.selected'
                }
              }}
              onClick={() => {
                showRoute(station);
                // Mobilde paneli otomatik kapat
                if (window.innerWidth < 600) {
                  setIsPanelOpen(false);
                }
              }}
            >
              <Box>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                >
                  {station.name}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{ 
                    color: station.status === 'available' ? 'success.main' : 
                           station.status === 'busy' ? 'error.main' : 'text.secondary',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  {station.status} • {station.distance.toFixed(1)} km
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    showRoute(station);
                  }}
                  sx={{ 
                    padding: { xs: 0.5, sm: 1 },
                    '& svg': { fontSize: { xs: '1.25rem', sm: '1.5rem' } }
                  }}
                >
                  <DirectionsIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openInGoogleMaps(station);
                  }}
                  sx={{ 
                    padding: { xs: 0.5, sm: 1 },
                    '& svg': { fontSize: { xs: '1.25rem', sm: '1.5rem' } }
                  }}
                >
                  <NearMeIcon />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default Map; 