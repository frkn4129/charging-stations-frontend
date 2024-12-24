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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GoogleIcon from '@mui/icons-material/Google';
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

// Varış zamanı hesaplama fonksiyonu (dosyanın üst kısmına ekleyin)
const calculateArrivalTime = (distance) => {
  // Mesafeye göre ortalama hız belirleme (km/s)
  let averageSpeed;
  if (distance < 5) {
    averageSpeed = 30; // Şehir içi
  } else if (distance < 20) {
    averageSpeed = 45; // Şehir çevresi
  } else {
    averageSpeed = 80; // Şehiriçi otoyol
  }

  // Saat faktörüne göre trafik düzeltmesi
  const hour = new Date().getHours();
  let trafficMultiplier = 1;
  
  // Yoğun trafik saatleri
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
    trafficMultiplier = 1.5; // Trafik yoğun
  } else if ((hour >= 7 && hour < 8) || (hour > 10 && hour <= 16) || (hour > 19 && hour <= 21)) {
    trafficMultiplier = 1.2; // Normal trafik
  }

  // Tahmini süre hesaplama (saat cinsinden)
  const estimatedHours = (distance / averageSpeed) * trafficMultiplier;
  
  // Varış zamanı hesaplama
  const arrivalTime = new Date(Date.now() + estimatedHours * 60 * 60 * 1000);
  
  return {
    time: arrivalTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    duration: Math.round(estimatedHours * 60) // Dakika cinsinden süre
  };
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

  // Panel yükseklik durumları
  const PANEL_STATES = {
    CLOSED: '-100vh',  // Tamamen kapalı
    HALF: '40vh',
    FULL: '80vh'
  };

  // Panel başlangıç durumu
  const [panelHeight, setPanelHeight] = useState(PANEL_STATES.HALF);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const panelRef = useRef(null);

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

  // İstasyon marker ikonunu oluştur
  const getStationIcon = useCallback((station) => {
    // İstasyon durumuna göre stil belirleme
    let mainColor, secondaryColor, statusIcon;
    
    if (station.error_count === station.connector_count) {
      mainColor = '#f44336';  // Kırmızı - arızalı
      secondaryColor = '#ffcdd2';
      statusIcon = '⚠️';
    } else if (station.available_dc === 0 && station.available_ac === 0) {
      mainColor = '#ff9800';  // Turuncu - meşgul
      secondaryColor = '#ffe0b2';
      statusIcon = '⌛';
    } else {
      mainColor = '#0D47A1';  // Daha koyu mavi - müsait (#1976d2 yerine #0D47A1)
      secondaryColor = '#64B5F6';
      statusIcon = '⚡';
    }

    const dcCount = station.available_dc;
    const acCount = station.available_ac;
    const totalAvailable = dcCount + acCount;

    // DC/AC rozet metni
    const chargerTypeText = dcCount > 0 && acCount > 0 ? 'DC/AC' : dcCount > 0 ? 'DC' : 'AC';

    return L.divIcon({
      className: 'custom-station-marker',
      html: `
        <div style="position: relative; width: 44px; height: 56px;">
          <!-- Ana İkon -->
          <div style="
            position: absolute;
            width: 40px;
            height: 40px;
            background: linear-gradient(145deg, ${mainColor}, ${mainColor}dd);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #fff;
          ">
            <!-- İç İçerik -->
            <div style="
              transform: rotate(45deg);
              display: flex;
              flex-direction: column;
              align-items: center;
              color: white;
              font-weight: bold;
              text-shadow: 0 1px 2px rgba(0,0,0,0.2);
            ">
              <span style="font-size: 16px;">${totalAvailable}</span>
              <span style="font-size: 12px;">${statusIcon}</span>
            </div>
          </div>

          <!-- DC/AC Rozeti -->
          ${(dcCount > 0 || acCount > 0) ? `
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              background: linear-gradient(135deg, #FFD700, #FFA500);
              border: 2px solid white;
              border-radius: 12px;
              padding: 2px 6px;
              font-size: 10px;
              color: #000;
              font-weight: bold;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              ${chargerTypeText}
            </div>
          ` : ''}

          <!-- Gölge -->
          <div style="
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 6px;
            background: rgba(0,0,0,0.2);
            border-radius: 50%;
            filter: blur(2px);
          "></div>

          <!-- Pulse Efekti -->
          ${totalAvailable > 0 ? `
            <div style="
              position: absolute;
              top: -2px;
              left: -2px;
              width: 44px;
              height: 44px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              background-color: ${secondaryColor};
              opacity: 0.6;
              animation: pulse 2s infinite;
            "></div>
          ` : ''}
        </div>

        <style>
          @keyframes pulse {
            0% { transform: rotate(-45deg) scale(1); opacity: 0.6; }
            50% { transform: rotate(-45deg) scale(1.2); opacity: 0.3; }
            100% { transform: rotate(-45deg) scale(1); opacity: 0.6; }
          }
        </style>
      `,
      iconSize: [44, 56],
      iconAnchor: [22, 56],
      popupAnchor: [0, -48]
    });
  }, []);

  // İstasyon kartı bileşeni
  const StationCard = ({ station, userLocation, onRoute, onNavigate, vehicleSettings }) => {
    const theme = useTheme();
    
    // Mesafe hesaplama
    const distance = userLocation ? calculateDistance(
      userLocation.lat,
      userLocation.lng,
      station.latitude,
      station.longitude
    ) : 0;

    // Enerji hesaplamaları
    const consumption = calculateEnergyConsumption(distance);
    const cost = calculateEnergyCost(consumption);
    const remainingCharge = calculateRemainingCharge(consumption);
    const isLowBattery = remainingCharge < 20;

    // Varış zamanı hesaplama
    const arrival = calculateArrivalTime(distance);

    return (
      <Box
        sx={{
          p: 1.5,
          mb: 1,
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(24,28,33,0.8)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
          }
        }}
        onClick={(e) => handleOpenDetails(station, e)}
      >
        {/* Üst Kısım */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {station.name}
          </Typography>
          <StationStatusChip station={station} />
        </Box>

        {/* İstatistikler */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 1,
          p: 1,
          my: 1,
          borderRadius: 1,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        }}>
          {/* Mesafe */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
              <DirectionsIcon sx={{ fontSize: '1rem', color: theme.palette.primary.main, mr: 0.5 }} />
              <Typography variant="caption" color="text.secondary">Mesafe</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
              {distance.toFixed(1)} km
            </Typography>
          </Box>

          {/* Varış Zamanı (Yeni) */}
          <Box sx={{ textAlign: 'center', borderLeft: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: '1rem', color: theme.palette.grey[500], mr: 0.5 }} />
              <Typography variant="caption" color="text.secondary">Varış</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.grey[600] }}>
              {arrival.time}
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}>
                {arrival.duration} dk
              </Typography>
            </Typography>
          </Box>

          {/* Tüketim */}
          <Box sx={{ textAlign: 'center', borderLeft: 1, borderRight: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
              <ElectricBoltIcon sx={{ fontSize: '1rem', color: theme.palette.info.main, mr: 0.5 }} />
              <Typography variant="caption" color="text.secondary">Tüketim</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.info.main }}>
              {consumption.toFixed(1)} kWh
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}>
                ≈ {cost.toFixed(0)} TL
              </Typography>
            </Typography>
          </Box>

          {/* Varış Şarjı */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
              <BatteryChargingFullIcon sx={{ 
                fontSize: '1rem', 
                color: isLowBattery ? theme.palette.error.main : theme.palette.success.main,
                mr: 0.5 
              }} />
              <Typography variant="caption" color="text.secondary">Varış Şarjı</Typography>
            </Box>
            <Typography variant="body2" sx={{ 
              fontWeight: 600,
              color: isLowBattery ? theme.palette.error.main : theme.palette.success.main
            }}>
              {Math.max(remainingCharge, 0).toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        {/* Alt Kısım - Butonlar */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              showRoute(station);
            }}
            startIcon={<DirectionsIcon sx={{ fontSize: '1rem' }} />}
            sx={{ py: 0.5, fontSize: '0.8rem' }}
          >
            Rota
          </Button>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openInGoogleMaps(station);
            }}
            sx={{ 
              color: '#4285F4',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(66,133,244,0.1)' : 'rgba(66,133,244,0.05)',
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(66,133,244,0.2)' : 'rgba(66,133,244,0.1)',
              }
            }}
          >
            <GoogleIcon sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Box>
      </Box>
    );
  };

  // Mouse/Touch olayları için yeni fonksiyonlar
  const handleStart = (e) => {
    setIsDragging(true);
    const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    setStartY(clientY);
    setCurrentY(clientY);
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    setCurrentY(clientY);
    
    const deltaY = clientY - startY;
    const screenHeight = window.innerHeight;
    const currentHeight = screenHeight * (parseInt(panelHeight) / 100);
    
    let newHeight;
    if (deltaY > 0) {
      // Aşağı çekme
      newHeight = Math.max(0, screenHeight - currentHeight - deltaY);
    } else {
      // Yukarı çekme
      newHeight = Math.min(screenHeight * 0.8, screenHeight - currentHeight - deltaY);
    }
    
    const newHeightVh = (newHeight / screenHeight) * 100;
    setPanelHeight(`${newHeightVh}vh`);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const deltaY = currentY - startY;
    const threshold = window.innerHeight * 0.2; // 20% eşik değeri
    
    if (deltaY > threshold) {
      setPanelHeight(PANEL_STATES.CLOSED);
    } else if (deltaY < -threshold) {
      setPanelHeight(PANEL_STATES.FULL);
    } else {
      setPanelHeight(PANEL_STATES.HALF);
    }
  };

  // Panel stillerini güncelle
  const panelStyles = {
    position: 'fixed',
    bottom: panelHeight === PANEL_STATES.CLOSED ? '-100vh' : 0,
    left: 0,
    right: 0,
    height: panelHeight === PANEL_STATES.CLOSED ? '40vh' : panelHeight,
    borderRadius: '16px 16px 0 0',
    zIndex: 1000,
    bgcolor: 'background.paper',
    overflow: 'hidden',
    transition: isDragging ? 'none' : 'all 0.3s ease-in-out',
    pb: 'env(safe-area-inset-bottom)',
    display: 'flex',
    flexDirection: 'column',
    touchAction: 'none',
    boxShadow: '0px -2px 10px rgba(0,0,0,0.1)',
    userSelect: 'none', // Metin seçimini engelle
  };

  // Panel kapalıyken görünecek handle
  const handleStyles = {
    position: 'fixed',
    bottom: panelHeight === PANEL_STATES.CLOSED ? 0 : 'auto',
    left: 0,
    right: 0,
    height: '24px',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(24,28,33,0.8)' : 'rgba(255,255,255,0.9)',
    borderRadius: '16px 16px 0 0',
    zIndex: 999,
    display: panelHeight === PANEL_STATES.CLOSED ? 'flex' : 'none',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'grab',
    boxShadow: '0px -2px 10px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
  };

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

        {filteredStations.map(station => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={getStationIcon(station)}
          >
            <Popup>
              <StationCard
                station={station}
                userLocation={userLocation}
                onRoute={() => showRoute(station)}
                onNavigate={() => openInGoogleMaps(station)}
                vehicleSettings={vehicleSettings}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Sağ üst butonlar */}
      <Box sx={{ 
        position: 'fixed', 
        top: 16, 
        right: 16, 
        zIndex: 1001,
        display: 'flex',
        gap: 1
      }}>
        {/* Konumuma Git butonu */}
        <Fab
          color="primary"
          size="small"
          sx={{
            position: 'fixed',
            top: 144,
            right: 16,
            zIndex: 1001,
          }}
          onClick={goToMyLocation}
        >
          <MyLocationIcon />
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

        {/* Ayarlar Butonu */}
        <Fab
          color="primary"
          size="small"
          onClick={() => setShowSettings(true)}
        >
          <SettingsIcon />
        </Fab>
      </Box>

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
            <StationCard
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
              vehicleSettings={vehicleSettings}
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

      {/* Panel açma handle'ı */}
      <Box
        sx={handleStyles}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        <Box
          sx={{
            width: '40px',
            height: '4px',
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.2)' 
              : 'rgba(0,0,0,0.2)',
            borderRadius: '2px',
          }}
        />
      </Box>

      {/* Panel */}
      <Paper
        ref={panelRef}
        elevation={3}
        sx={panelStyles}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        {/* Sürükleme göstergesi */}
        <Box
          sx={{
            width: '40px',
            height: '4px',
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.2)' 
              : 'rgba(0,0,0,0.2)',
            borderRadius: '2px',
            margin: '8px auto',
            cursor: 'grab',
            '&:active': {
              cursor: 'grabbing'
            }
          }}
        />

        {/* Sabit başlık */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(24,28,33,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            px: 2,
            pt: 0.5,
            pb: 0.5,
            zIndex: 1,
            boxShadow: theme.palette.mode === 'dark' 
              ? '0 4px 12px rgba(0,0,0,0.3)'
              : '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          {/* Başlık */}
          <Typography 
            variant="h6" 
            sx={{ 
              textAlign: 'center',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              mb: 0.25,
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
                : 'linear-gradient(45deg, #1976d2, #2196f3)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            En Yakın {filteredNearbyStations.length} İstasyon
          </Typography>

          {/* Bilgi Satırları */}
          <Box 
            sx={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 3,
              mt: 0.25,
            }}
          >
            {/* Tüketim Bilgisi */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ElectricBoltIcon sx={{ fontSize: '0.8rem', color: theme.palette.info.main }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                {vehicleSettings.consumption} kWh/100km
              </Typography>
            </Box>

            {/* Fiyat Bilgisi */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BoltIcon sx={{ fontSize: '0.8rem', color: theme.palette.warning.main }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                {vehicleSettings.pricePerKWh} TL/kWh
              </Typography>
            </Box>

            {/* Batarya Bilgisi */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BatteryChargingFullIcon 
                sx={{ 
                  fontSize: '0.8rem',
                  color: vehicleSettings.currentCharge > 20 
                    ? theme.palette.success.main 
                    : theme.palette.error.main 
                }} 
              />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.6rem',
                  color: vehicleSettings.currentCharge > 20 
                    ? theme.palette.success.main 
                    : theme.palette.error.main,
                  fontWeight: 500
                }}
              >
                {vehicleSettings.currentCharge}%
                <Typography 
                  component="span" 
                  variant="caption" 
                  sx={{ 
                    fontSize: '0.55rem', 
                    color: 'text.secondary',
                    ml: 0.5 
                  }}
                >
                  ({((vehicleSettings.batteryCapacity * vehicleSettings.currentCharge) / 100).toFixed(1)} kWh)
                </Typography>
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Kaydırılabilir içerik */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1,
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark' 
                ? 'rgba(255,255,255,0.2)' 
                : 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            }
          }}
        >
          {/* İstasyon kartları */}
          {filteredNearbyStations.map(station => (
            <Box
              key={station.id}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(24,28,33,0.8)' : 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
                }
              }}
              onClick={(e) => handleOpenDetails(station, e)}
            >
              {/* İstasyon Başlığı */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {station.name}
                </Typography>
                <StationStatusChip station={station} />
              </Box>

              {/* İstatistikler */}
              <Box sx={{ 
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: 1,
                p: 1,
                my: 1,
                borderRadius: 1,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
              }}>
                {/* Mesafe */}
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                    <DirectionsIcon sx={{ fontSize: '1rem', color: theme.palette.primary.main, mr: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">Mesafe</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                    {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      station.latitude,
                      station.longitude
                    ).toFixed(1)} km
                  </Typography>
                </Box>

                {/* Varış Zamanı (Yeni) */}
                <Box sx={{ textAlign: 'center', borderLeft: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                    <AccessTimeIcon sx={{ fontSize: '1rem', color: theme.palette.grey[500], mr: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">Varış</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.grey[600] }}>
                    {calculateArrivalTime(
                      calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        station.latitude,
                        station.longitude
                      )
                    ).time}
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}>
                      {calculateArrivalTime(
                        calculateDistance(
                          userLocation.lat,
                          userLocation.lng,
                          station.latitude,
                          station.longitude
                        )
                      ).duration} dk
                    </Typography>
                  </Typography>
                </Box>

                {/* Tüketim */}
                <Box sx={{ textAlign: 'center', borderLeft: 1, borderRight: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                    <ElectricBoltIcon sx={{ fontSize: '1rem', color: theme.palette.info.main, mr: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">Tüketim</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.info.main }}>
                    {calculateEnergyConsumption(
                      calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        station.latitude,
                        station.longitude
                      )
                    ).toFixed(1)} kWh
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}>
                      ≈ {calculateEnergyCost(
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
                  </Typography>
                </Box>

                {/* Varış Şarjı */}
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                    <BatteryChargingFullIcon sx={{ 
                      fontSize: '1rem', 
                      color: calculateRemainingCharge(
                        calculateEnergyConsumption(
                          calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            station.latitude,
                            station.longitude
                          )
                        )
                      ) < 20 ? theme.palette.error.main : theme.palette.success.main,
                      mr: 0.5 
                    }} />
                    <Typography variant="caption" color="text.secondary">Varış Şarjı</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 600,
                    color: calculateRemainingCharge(
                      calculateEnergyConsumption(
                        calculateDistance(
                          userLocation.lat,
                          userLocation.lng,
                          station.latitude,
                          station.longitude
                        )
                      )
                    ) < 20 ? theme.palette.error.main : theme.palette.success.main
                  }}>
                    {Math.max(calculateRemainingCharge(
                      calculateEnergyConsumption(
                        calculateDistance(
                          userLocation.lat,
                          userLocation.lng,
                          station.latitude,
                          station.longitude
                        )
                      )
                    ), 0).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>

              {/* Alt Kısım - Butonlar */}
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    showRoute(station);
                  }}
                  startIcon={<DirectionsIcon sx={{ fontSize: '1rem' }} />}
                  sx={{ py: 0.5, fontSize: '0.8rem' }}
                >
                  Rota
                </Button>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openInGoogleMaps(station);
                  }}
                  sx={{ 
                    color: '#4285F4',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(66,133,244,0.1)' : 'rgba(66,133,244,0.05)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(66,133,244,0.2)' : 'rgba(66,133,244,0.1)',
                    }
                  }}
                >
                  <GoogleIcon sx={{ fontSize: '1.2rem' }} />
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