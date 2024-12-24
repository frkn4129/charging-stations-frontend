import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { Box, Paper, Typography, Button, IconButton, Fab, Chip, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, IconButton as MuiIconButton, ToggleButton, ToggleButtonGroup, FormControlLabel, Switch, Tooltip, TextField, InputAdornment } from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import NearMeIcon from '@mui/icons-material/NearMe';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import EvStationIcon from '@mui/icons-material/EvStation';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import BoltIcon from '@mui/icons-material/Bolt';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import Battery5BarIcon from '@mui/icons-material/Battery5Bar';
import SettingsIcon from '@mui/icons-material/Settings';
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

// Dark tema için harita stil URL'leri
const mapStyles = {
  light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
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

const StationStatusChip = ({ station }) => {
  const theme = useTheme();
  
  const getStatusInfo = () => {
    const dcAvailable = station.available_dc > 0;
    const acAvailable = station.available_ac > 0;

    if (station.error_count === station.connector_count) {
      return {
        icon: <PowerOffIcon />,
        label: 'Tümü Arızalı',
        color: theme.palette.error.main,
      };
    }

    if (!dcAvailable && !acAvailable && station.unavailable_count > 0) {
      return {
        icon: <BatteryAlertIcon />,
        label: 'Tümü Meşgul',
        color: theme.palette.warning.main,
      };
    }

    return {
      icon: <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {station.connector_count > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BatteryChargingFullIcon sx={{ 
              fontSize: '1.4rem',
              color: '#00ff00'
            }} />
            <Typography variant="caption" sx={{ color: '#fff' }}>
              {`${station.available_dc}/${station.connector_count} DC Müsait`}
            </Typography>
          </Box>
        )}
        {station.available_ac > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 0.5 }}>
            <Battery5BarIcon sx={{ 
              fontSize: '1.2rem',
              color: '#87CEEB'
            }} />
            <Typography variant="caption" sx={{ color: '#fff' }}>
              {`${station.available_ac} AC Müsait`}
            </Typography>
          </Box>
        )}
      </Box>,
      label: '',
      color: theme.palette.success.main,
    };
  };

  const statusInfo = getStatusInfo();
  return (
    <Chip
      icon={statusInfo.icon}
      label={statusInfo.label}
      sx={{
        bgcolor: statusInfo.color,
        color: '#fff',
        fontWeight: 'bold',
        height: 'auto',
        '& .MuiChip-icon': {
          color: '#fff',
          marginLeft: statusInfo.label ? '12px' : '0px',
          marginRight: statusInfo.label ? '-6px' : '0px',
        },
        '& .MuiChip-label': {
          padding: '4px 8px',
        }
      }}
    />
  );
};

const StationDetails = ({ 
  station, 
  userLocation, 
  onRoute, 
  onNavigate,
  calculateEnergyConsumption,
  calculateEnergyCost
}) => {
  return (
    <Box sx={{ p: 2, minWidth: 250 }}>
      <Typography variant="h6" gutterBottom>
        {station.name}
      </Typography>
      <Typography variant="body2" gutterBottom color="text.secondary">
        {station.brand}
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <StationStatusChip station={station} />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          DC Hızlı Şarj Durumu:
        </Typography>
        
        {/* DC Şarj Noktaları */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Toplam DC Port:
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {station.connector_count}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Müsait DC Port:
          </Typography>
          <Typography variant="body2" fontWeight="bold" color="success.main">
            {station.available_dc}
          </Typography>
        </Box>

        {/* Kullanımda */}
        {station.unavailable_count > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Kullanımda:
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="warning.main">
              {station.unavailable_count}
            </Typography>
          </Box>
        )}

        {/* Arızalı */}
        {station.error_count > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Arızalı:
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="error.main">
              {station.error_count}
            </Typography>
          </Box>
        )}

        {/* AC Şarj Noktaları */}
        {station.available_ac > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              AC Normal Şarj:
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Müsait AC Port:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {station.available_ac}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {userLocation && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Mesafe:
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {calculateDistance(
                userLocation.lat,
                userLocation.lng,
                station.latitude,
                station.longitude
              ).toFixed(1)} km
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Tahmini Tüketim:
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="info.main">
              {calculateEnergyConsumption(
                calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  station.latitude,
                  station.longitude
                )
              ).toFixed(1)} kWh
              {' ≈ '}
              {calculateEnergyCost(
                calculateEnergyConsumption(
                  calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    station.latitude,
                    station.longitude
                  )
                )
              ).toFixed(0)} TL
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<DirectionsIcon />}
          onClick={onRoute}
          size="small"
        >
          Rota Çiz
        </Button>
        <IconButton
          size="small"
          onClick={onNavigate}
          sx={{ 
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          <NearMeIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

const Map = ({ stations }) => {
  const theme = useTheme();
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const mapRef = useRef(null);
  const [selectedStationDetails, setSelectedStationDetails] = useState(null);
  const [filters, setFilters] = useState({
    onlyAvailable: false,
    showDC: true,
    showAC: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [vehicleSettings, setVehicleSettings] = useState({
    consumption: 16.5,
    pricePerKWh: 8,
    batteryCapacity: 60,
    currentCharge: 80,
  });

  // Harita stil URL'sini tema moduna göre seç
  const mapStyle = theme.palette.mode === 'dark' ? mapStyles.dark : mapStyles.light;

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
      .slice(0, 10);

      setNearbyStations(stationsWithDistance);
    }
  }, [userLocation, stations]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return theme.palette.status.available;
      case 'PARTIALLY_AVAILABLE':
        return theme.palette.status.busy;
      case 'UNAVAILABLE':
        return theme.palette.status.offline;
      default:
        return theme.palette.grey[500];
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Müsait';
      case 'PARTIALLY_AVAILABLE':
        return 'Kısmen Müsait';
      case 'UNAVAILABLE':
        return 'Meşgul';
      default:
        return 'Bilinmiyor';
    }
  };

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

  // Konuma git fonksiyonu
  const goToMyLocation = () => {
    if (userLocation) {
      mapRef.current?.setView(
        [userLocation.lat, userLocation.lng],
        13,
        { animate: true }
      );
    }
  };

  // Modal' açma/kapama fonksiyonları
  const handleOpenDetails = (station, e) => {
    e.stopPropagation();
    setSelectedStationDetails(station);
    
    // Haritayı istasyon konumuna taşı
    mapRef.current?.setView(
      [station.latitude, station.longitude],
      15, // Daha yakın zoom seviyesi
      {
        animate: true,
        duration: 1 // Animasyon süresi (saniye)
      }
    );

    // İstasyonu işaretle (opsiyonel)
    const marker = L.marker([station.latitude, station.longitude]);
    marker.bindPopup(station.name).openPopup();
  };

  const handleCloseDetails = () => {
    setSelectedStationDetails(null);
  };

  // Filtreleme fonksiyonu
  const getFilteredStations = (stationList) => {
    return stationList.filter(station => {
      // Sadece müsait olanları göster
      if (filters.onlyAvailable) {
        if (filters.showDC && station.available_dc === 0 && filters.showAC && station.available_ac === 0) {
          return false;
        }
      }

      // DC/AC filtresi
      if (!filters.showDC && !filters.showAC) return false;
      if (!filters.showDC && station.connector_count > 0) return false;
      if (!filters.showAC && station.available_ac > 0) return false;

      return true;
    });
  };

  // Filtrelenmiş istasyonları hesapla
  const filteredStations = getFilteredStations(stations);
  const filteredNearbyStations = getFilteredStations(nearbyStations);

  // Enerji hesaplama fonksiyonları
  const calculateEnergyConsumption = useCallback((distance) => {
    return (distance * vehicleSettings.consumption) / 100;
  }, [vehicleSettings.consumption]);

  const calculateEnergyCost = useCallback((kWh) => {
    return kWh * vehicleSettings.pricePerKWh;
  }, [vehicleSettings.pricePerKWh]);

  const calculateRemainingCharge = useCallback((consumedEnergy) => {
    const currentEnergyKWh = (vehicleSettings.batteryCapacity * vehicleSettings.currentCharge) / 100;
    const remainingKWh = currentEnergyKWh - consumedEnergy;
    return (remainingKWh / vehicleSettings.batteryCapacity) * 100;
  }, [vehicleSettings.batteryCapacity, vehicleSettings.currentCharge]);

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100%', 
      position: 'relative',
      bgcolor: theme.palette.background.default
    }}>
      <MapContainer
        ref={mapRef}
        center={[39.925533, 32.866287]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url={mapStyle}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <LocationMarker onLocationFound={setUserLocation} />
        
        {routeCoordinates && (
          <Polyline
            positions={routeCoordinates}
            color={theme.palette.primary.main}
            weight={4}
            opacity={0.7}
          />
        )}

        {filteredStations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
          >
            <Popup className={theme.palette.mode === 'dark' ? 'dark-popup' : ''}>
              <StationDetails
                station={station}
                userLocation={userLocation}
                onRoute={() => showRoute(station)}
                onNavigate={() => openInGoogleMaps(station)}
                calculateEnergyConsumption={calculateEnergyConsumption}
                calculateEnergyCost={calculateEnergyCost}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Konumuma Git butonu */}
      <Fab
        color="primary"
        size="small"
        sx={{
          position: 'fixed',
          bottom: isPanelOpen ? '48vh' : '80px',
          right: 16,
          zIndex: 1001,
          transition: 'bottom 0.3s ease-in-out'
        }}
        onClick={goToMyLocation}
      >
        <MyLocationIcon />
      </Fab>

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

      {/* Filtre Butonu */}
      <Fab
        color="primary"
        size="small"
        sx={{
          position: 'fixed',
          top: 80,
          right: 16,
          zIndex: 1001,
        }}
        onClick={() => setShowFilters(!showFilters)}
      >
        <FilterAltIcon />
      </Fab>

      {/* Filtre Paneli */}
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          top: showFilters ? 140 : -200,
          right: 16,
          zIndex: 1001,
          p: 2,
          borderRadius: 2,
          transition: 'top 0.3s ease-in-out',
          width: 280,
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Filtreler
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={filters.onlyAvailable}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                onlyAvailable: e.target.checked
              }))}
            />
          }
          label="Sadece Müsait Olanlar"
          sx={{ mb: 1, display: 'block' }}
        />

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Şarj Tipi:
        </Typography>
        <ToggleButtonGroup
          value={[
            ...(filters.showDC ? ['dc'] : []),
            ...(filters.showAC ? ['ac'] : [])
          ]}
          onChange={(e, newValues) => {
            setFilters(prev => ({
              ...prev,
              showDC: newValues.includes('dc'),
              showAC: newValues.includes('ac')
            }));
          }}
          aria-label="şarj tipi"
          size="small"
          sx={{ mb: 1 }}
        >
          <ToggleButton value="dc">
            <Tooltip title="DC Hızlı Şarj">
              <Box sx={{ px: 1 }}>DC</Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="ac">
            <Tooltip title="AC Normal Şarj">
              <Box sx={{ px: 1 }}>AC</Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {filteredStations.length} istasyon gösteriliyor
        </Typography>
      </Paper>

      {/* İstasyon Detayları Modal'ı */}
      <Dialog
        open={Boolean(selectedStationDetails)}
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 2,
            m: { xs: 1, sm: 2 }
          }
        }}
      >
        <DialogTitle sx={{ 
          m: 0, 
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6">
            İstasyon Detayları
          </Typography>
          <MuiIconButton
            aria-label="close"
            onClick={handleCloseDetails}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' }
            }}
          >
            <CloseIcon />
          </MuiIconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedStationDetails && (
            <StationDetails
              station={selectedStationDetails}
              userLocation={userLocation}
              onRoute={(e) => {
                handleCloseDetails();
                showRoute(selectedStationDetails);
                if (window.innerWidth < 600) {
                  setIsPanelOpen(false);
                }
              }}
              onNavigate={() => {
                handleCloseDetails();
                openInGoogleMaps(selectedStationDetails);
              }}
              calculateEnergyConsumption={calculateEnergyConsumption}
              calculateEnergyCost={calculateEnergyCost}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            onClick={handleCloseDetails}
            size="large"
            fullWidth
          >
            Kapat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Araç Ayarları Butonu */}
      <Fab
        color="primary"
        size="small"
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1001,
        }}
        onClick={() => setShowSettings(true)}
      >
        <SettingsIcon />
      </Fab>

      {/* Araç Ayarları Modal'ı */}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Araç Ayarları
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
            <TextField
              label="Ortalama Tüketim"
              type="number"
              value={vehicleSettings.consumption}
              onChange={(e) => setVehicleSettings(prev => ({
                ...prev,
                consumption: parseFloat(e.target.value) || 0
              }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">kWh/100km</InputAdornment>,
              }}
            />
            <TextField
              label="Elektrik Birim Fiyatı"
              type="number"
              value={vehicleSettings.pricePerKWh}
              onChange={(e) => setVehicleSettings(prev => ({
                ...prev,
                pricePerKWh: parseFloat(e.target.value) || 0
              }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">TL/kWh</InputAdornment>,
              }}
            />
            <TextField
              label="Batarya Kapasitesi"
              type="number"
              value={vehicleSettings.batteryCapacity}
              onChange={(e) => setVehicleSettings(prev => ({
                ...prev,
                batteryCapacity: parseFloat(e.target.value) || 0
              }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">kWh</InputAdornment>,
              }}
            />
            <TextField
              label="Mevcut Şarj Durumu"
              type="number"
              value={vehicleSettings.currentCharge}
              onChange={(e) => setVehicleSettings(prev => ({
                ...prev,
                currentCharge: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100)
              }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {/* En yakın istasyonlar paneli eklendi */}
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
          WebkitOverflowScrolling: 'touch'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              En Yakın {filteredNearbyStations.length} İstasyon
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                Ort. tüketim: {vehicleSettings.consumption} kWh/100km
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                1 kWh = {vehicleSettings.pricePerKWh} TL
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Batarya: {vehicleSettings.currentCharge}% ({((vehicleSettings.batteryCapacity * vehicleSettings.currentCharge) / 100).toFixed(1)} kWh)
              </Typography>
            </Box>
          </Box>

          {filteredNearbyStations.map(station => (
            <Box
              key={station.id}
              sx={{
                p: 2,
                mb: 1,
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={(e) => handleOpenDetails(station, e)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {station.name}
                </Typography>
                <StationStatusChip station={station} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {station.connector_count > 0 && (
                    <Chip
                      icon={<BatteryChargingFullIcon sx={{ color: '#00ff00' }} />}
                      label={`${station.available_dc}/${station.connector_count} DC Müsait`}
                      size="small"
                      color="success"
                      sx={{ 
                        '& .MuiChip-icon': { 
                          fontSize: '1.4rem'
                        }
                      }}
                    />
                  )}
                  {station.available_ac > 0 && (
                    <Chip
                      icon={<Battery5BarIcon sx={{ color: '#87CEEB' }} />}
                      label={`${station.available_ac} AC Müsait`}
                      size="small"
                      color="info"
                      sx={{ '& .MuiChip-icon': { fontSize: '1.2rem' } }}
                    />
                  )}
                  {station.error_count > 0 && (
                    <Chip
                      icon={<PowerOffIcon />}
                      label={`${station.error_count} Arızalı`}
                      size="small"
                      color="error"
                      sx={{ '& .MuiChip-icon': { fontSize: '1.2rem' } }}
                    />
                  )}
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Mesafe: {station.distance.toFixed(1)} km
                    </Typography>
                    <Typography variant="body2" color="info.main" sx={{ fontWeight: 'bold' }}>
                      Tüketim: {calculateEnergyConsumption(station.distance).toFixed(1)} kWh
                      {' ≈ '}
                      {calculateEnergyCost(calculateEnergyConsumption(station.distance)).toFixed(0)} TL
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={calculateRemainingCharge(calculateEnergyConsumption(station.distance)) < 20 ? 'error.main' : 'success.main'}
                      sx={{ fontWeight: 'bold' }}
                    >
                      Varış Şarjı: {Math.max(calculateRemainingCharge(calculateEnergyConsumption(station.distance)), 0).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        showRoute(station);
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
                    >
                      <NearMeIcon />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default Map; 