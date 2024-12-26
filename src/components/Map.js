import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline, OverlayView } from '@react-google-maps/api';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Fab, 
  useTheme, 
  FormControlLabel, 
  Switch, 
  ToggleButton, 
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Tooltip,
  useMediaQuery,
  Snackbar,
  Alert,
  CircularProgress,
  Rating,
  TextField,
  List,
  ListItem,
  ListItemText,
  Pagination,
  Chip
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import DirectionsIcon from '@mui/icons-material/Directions';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import EvStationIcon from '@mui/icons-material/EvStation';
import ElectricCarIcon from '@mui/icons-material/ElectricCar';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GoogleIcon from '@mui/icons-material/Google';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import TimerIcon from '@mui/icons-material/Timer';
import BoltIcon from '@mui/icons-material/Bolt';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import PercentIcon from '@mui/icons-material/Percent';
import SettingsIcon from '@mui/icons-material/Settings';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Slider from '@mui/material/Slider';
import InputAdornment from '@mui/material/InputAdornment';
import { getStationReviews, submitReview } from '../api/reviews';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const libraries = ["places", "geometry"];
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const MapComponent = () => {
  const theme = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const [stations, setStations] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [showTable, setShowTable] = useState(true);
  const [filteredStations, setFilteredStations] = useState([]);
  const [filters, setFilters] = useState({
    onlyAvailable: false,
    showDC: true,
    showAC: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(80);
  const [batteryCapacity, setBatteryCapacity] = useState(84);
  const [electricityPrice, setElectricityPrice] = useState(7.5);
  const [averageConsumption, setAverageConsumption] = useState(18);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [isLoading, setIsLoading] = useState({
    stations: false,
    route: false,
    distance: false
  });
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [map, setMap] = useState(null);
  const prevLocation = useRef(null);
  const prevRotation = useRef(0);

  const defaultCenter = useMemo(() => ({
    lat: 39.925533,
    lng: 32.866287
  }), []);

  const mapContainerStyle = {
    width: '100%',
    height: '100vh'
  };

  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      }
    ]
  }), []);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/stations`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        // İstasyonları ve istatistikleri set et
        setStations(data);
        setFilteredStations(data);
      } catch (error) {
        console.error('Error fetching stations:', error);
      }
    };

    fetchStations();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
        },
        (error) => {
          console.error('Konum alınamadı:', error);
          setSnackbar({
            open: true,
            message: 'Konum alınamadı. Lütfen konum izinlerini kontrol edin.',
            severity: 'error'
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, []);

  useEffect(() => {
    let filtered = [...stations];

    if (filters.onlyAvailable) {
      filtered = filtered.filter(station => 
        station.available_dc > 0 || station.available_ac > 0
      );
    }

    if (!filters.showDC) {
      filtered = filtered.filter(station => station.available_ac > 0);
    }

    if (!filters.showAC) {
      filtered = filtered.filter(station => station.available_dc > 0);
    }

    setFilteredStations(filtered);
  }, [filters, stations]);

  const showRoute = useCallback(async (station) => {
    if (!userLocation) return;

    try {
      const response = await fetch(`${API_BASE_URL}/stations/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_lat: userLocation.lat,
          origin_lng: userLocation.lng,
          destination_lat: station.latitude,
          destination_lng: station.longitude,
        }),
      });

      const data = await response.json();
      setRouteCoordinates(data);
      setSelectedStation(station);
    } catch (error) {
      console.error('Error getting route:', error);
    }
  }, [userLocation]);

  const getMarkerIcon = useCallback((station) => {
    const isSelected = selectedStation?.id === station.id;
    const scale = isSelected ? 1.2 : 1;
    const status = getStationStatus(station);

    // Material-UI'ın EvStationIcon'unun SVG path'i
    const stationPath = `
      M 12,0 C 5.38,0 0,5.38 0,12 C 0,18.62 5.38,24 12,24 C 18.62,24 24,18.62 24,12 C 24,5.38 18.62,0 12,0 Z
      M 7.5,5.5 h 9 v 13 h -9 z
      M 9,8 v 8 h 6 v -8 h -6 z
      M 10.5,10 h 3 v 4 h -3 z
      M 12,3 v 2 h -2 v 1 h 4 v -1 h -2 z
    `;

    return {
      path: stationPath,
      fillColor: getStatusColor(station),
      fillOpacity: status === 'ERROR' ? 0.5 : 1,
      strokeColor: '#ffffff',
      strokeWeight: 1.5,
      scale: scale * 1.5,
      anchor: new window.google.maps.Point(12, 12)
    };
  }, [selectedStation]);

  const getStationStatus = useCallback((station) => {
    if (station.error_count === station.connector_count) {
      return 'ERROR';
    } else if (station.available_dc === 0 && station.available_ac === 0) {
      return 'BUSY';
    }
    return 'AVAILABLE';
  }, []);

  const getStatusColor = useCallback((station) => {
    const status = getStationStatus(station);
    switch (status) {
      case 'ERROR':
        return '#ef5350'; // Kırmızı - Arızalı
      case 'BUSY':
        return '#ffa726'; // Turuncu - Tüm soketler kullanımda
      default:
        return '#66bb6a'; // Yeşil - Müsait soket var
    }
  }, []);

  const getStatusText = useCallback((station) => {
    const status = getStationStatus(station);
    switch (status) {
      case 'ERROR':
        return 'Arızalı';
      case 'BUSY':
        return 'Meşgul';
      default:
        return 'Müsait';
    }
  }, []);

  const calculateChargeCost = useCallback((requiredCharge) => {
    return (requiredCharge * electricityPrice).toFixed(2);
  }, [electricityPrice]);

  const calculateRange = useCallback(() => {
    const remainingCapacity = (batteryLevel / 100) * batteryCapacity;
    return ((remainingCapacity / averageConsumption) * 100).toFixed(1);
  }, [batteryLevel, batteryCapacity, averageConsumption]);

  const calculateChargeTime = useCallback((station) => {
    const requiredCharge = batteryCapacity * (1 - batteryLevel / 100);
    const chargePower = station.available_dc > 0 ? 50 : 22; // DC: 50kW, AC: 22kW
    return (requiredCharge / chargePower).toFixed(1);
  }, [batteryCapacity, batteryLevel]);

  const calculateHaversineDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Gerçek mesafe ve süre hesaplama
  const getRouteDetails = async (station) => {
    if (!userLocation) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/stations/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat1: userLocation.lat,
          lon1: userLocation.lng,
          lat2: station.latitude,
          lon2: station.longitude,
        }),
      });

      if (response.status === 429) {
        // Rate limit aşıldı
        setSnackbar({
          open: true,
          message: "Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
          severity: "warning"
        });
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate distance');
      }

        const data = await response.json();
      return {
        distance: (data.distance).toFixed(1),
        duration: Math.round(data.duration / 60),
        consumption: ((data.distance * averageConsumption) / 100).toFixed(1)
      };
      } catch (error) {
      console.error('Error calculating route details:', error);
      return null;
    }
  };

  // useEffect içinde en yakın 10 istasyonu hesapla ve sırala
  useEffect(() => {
    if (!userLocation || !stations.length) return;

    // 1. Tüm istasyonlar için kuş bakışı mesafeyi hesapla
    const stationsWithDistance = stations.map(station => {
      const distance = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        station.latitude,
        station.longitude
      );

      // Ortalama hız 60 km/s varsayarak süreyi hesapla
      const duration = Math.round((distance / 60) * 60); // dakika cinsinden
      const consumption = ((distance * averageConsumption) / 100).toFixed(1);
      const isReachable = distance <= calculateRange();

      return {
        ...station,
        routeDetails: {
          distance: distance.toFixed(1),
          duration: duration,
          consumption: consumption,
          isReachable
        }
      };
    });

    // 2. Mesafeye göre sırala ve ilk 10'u al
    const nearestStations = stationsWithDistance
      .sort((a, b) => parseFloat(a.routeDetails.distance) - parseFloat(b.routeDetails.distance))
      .slice(0, 10);

    setFilteredStations(nearestStations);
  }, [userLocation, stations, calculateHaversineDistance, averageConsumption, calculateRange]);

  const handleStationSelect = async (station) => {
    setSelectedStation(station);
    
    if (!userLocation) return;

    try {
      const response = await fetch(`${API_BASE_URL}/stations/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat1: userLocation.lat,
          lon1: userLocation.lng,
          lat2: station.latitude,
          lon2: station.longitude,
        }),
      });

      if (!response.ok) {
        throw new Error('Mesafe hesaplanamadı');
      }

      const data = await response.json();
      setSelectedStation(prev => ({
        ...prev,
        routeDetails: {
          ...prev.routeDetails,
          realDistance: data.distance.toFixed(1),
          realDuration: Math.round(data.duration / 60),
        }
      }));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateStationStats = useCallback(async (stationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stations/${stationId}/stats`);
      const stats = await response.json();
      
      setStations(prevStations => 
        prevStations.map(station => 
          station.id === stationId 
            ? { 
                ...station, 
                averageRating: stats.averageRating,
                reviewCount: stats.reviewCount 
              }
            : station
        )
      );

      setFilteredStations(prevStations => 
        prevStations.map(station => 
          station.id === stationId 
            ? { 
                ...station, 
                averageRating: stats.averageRating,
                reviewCount: stats.reviewCount 
              }
            : station
        )
      );
    } catch (error) {
      console.error('İstasyon istatistikleri güncellenemedi:', error);
    }
  }, []);

  const ReviewSection = ({ station, setSnackbar }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [reviews, setReviews] = useState([]);
    const [showReviews, setShowReviews] = useState(false);
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const reviewsPerPage = 5;

    const loadReviews = useCallback(async () => {
      setIsLoading(true);
      try {
        const data = await getStationReviews(station.id);
        // En yeni yorumlar başta olacak şekilde sırala
        const sortedReviews = data ? data.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        ) : [];
        setReviews(sortedReviews);
      } catch (error) {
        console.error('Yorumlar yüklenirken hata:', error);
        setSnackbar({
          open: true,
          message: 'Yorumlar yüklenirken bir hata oluştu',
          severity: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    }, [station.id, setSnackbar]);

    const handleSubmitReview = async () => {
      if (!rating) {
        setSnackbar({
          open: true,
          message: 'Lütfen bir puan verin',
          severity: 'warning'
        });
        return;
      }

      setIsLoading(true);
      try {
        const newReview = await submitReview(station.id, { rating, comment });
        
        // Yeni yorumu listeye ekle ve en başa yerleştir
        setReviews(prevReviews => [newReview, ...prevReviews]);
        
        // İstasyon istatistiklerini güncelle
        const newTotalRating = (station.averageRating * station.reviewCount + rating);
        const newCount = station.reviewCount + 1;
        const newAverage = newTotalRating / newCount;
        
        // Station objesini güncelle
        station.averageRating = newAverage;
        station.reviewCount = newCount;

        // Formu temizle
        setRating(0);
        setComment('');
        
        // Yorumları göster
        setShowReviews(true);
        // İlk sayfaya dön
        setPage(0);

        setSnackbar({
          open: true,
          message: 'Yorumunuz başarıyla gönderildi',
          severity: 'success'
        });
      } catch (error) {
        console.error('Yorum gönderilirken hata:', error);
        setSnackbar({
          open: true,
          message: 'Yorum gönderilirken bir hata oluştu',
          severity: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      if (showReviews) {
        loadReviews();
      }
    }, [loadReviews, showReviews]);

    return (
      <Box sx={{ 
        borderTop: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        borderRadius: '0 0 4px 4px',
        overflow: 'hidden'
      }}>
        {/* Özet Başlık */}
        <Box sx={{ 
          p: { xs: 1, sm: 1.5 },
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: { xs: 32, sm: 36 },
              height: { xs: 32, sm: 36 },
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: theme.palette.primary.main,
              color: 'white'
            }}>
              <Typography sx={{ 
                fontSize: { xs: '0.9rem', sm: '1.1rem' }
              }}>
                {station.averageRating ? station.averageRating.toFixed(1) : '0'}
              </Typography>
            </Box>
            <Box>
              <Rating 
                value={station.averageRating || 0} 
                precision={0.1} 
                readOnly 
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                {station.reviewCount || 0} değerlendirme
              </Typography>
            </Box>
          </Box>
          <Button 
            variant="outlined"
            size="small"
            onClick={() => setShowReviews(!showReviews)}
            endIcon={showReviews ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        sx={{
              fontSize: '0.75rem',
              py: 0.5,
              minWidth: 'auto'
            }}
          >
            {showReviews ? 'Gizle' : 'Yorumlar'}
          </Button>
        </Box>

        {showReviews && (
          <Box sx={{ p: { xs: 1, sm: 1.5 } }}>
            {/* Yorum Formu */}
            <Paper elevation={0} sx={{ 
              p: { xs: 1, sm: 1.5 },
              mb: 2, 
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1
            }}>
              <Typography sx={{ 
          mb: 1,
                fontSize: '0.875rem',
                fontWeight: 500
              }}>
                Değerlendirmenizi Yazın
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Rating
                    value={rating}
                    onChange={(e, newValue) => setRating(newValue)}
                    size="small"
                    sx={{ color: theme.palette.primary.main }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {rating ? `${rating} yıldız` : 'Puan verin'}
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Deneyiminizi paylaşın..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.875rem'
                    }
                  }}
                />
                <Button 
                  variant="contained" 
                  onClick={handleSubmitReview}
                  disabled={!rating || isLoading}
                  size="small"
                  sx={{ 
                    alignSelf: 'flex-end',
                    minWidth: 90,
                    fontSize: '0.75rem',
                    py: 0.5
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    'Gönder'
                  )}
                </Button>
        </Box>
            </Paper>

            {/* Yorum Listesi */}
            <Box>
              <Typography sx={{ 
                mb: 1,
                fontSize: '0.875rem',
                fontWeight: 500
              }}>
                Değerlendirmeler
              </Typography>
        <Box sx={{ 
                maxHeight: 250,
                overflow: 'auto',
                pr: 1,
                mr: -1
              }}>
                {reviews.slice(page * reviewsPerPage, (page + 1) * reviewsPerPage).map(review => (
                  <Paper
                    key={review.id}
                    elevation={0}
                    sx={{ 
                      p: 1,
                      mb: 1,
                      bgcolor: 'background.default',
                      border: 1,
                      borderColor: 'divider',
          borderRadius: 1,
                      '&:last-child': { mb: 0 }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Rating value={review.rating} size="small" readOnly />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(review.createdAt).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap' }}>
                      {review.comment}
                    </Typography>
                  </Paper>
                ))}
              </Box>

              {/* Sayfalama */}
              {Math.ceil(reviews.length / reviewsPerPage) > 1 && (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  mt: 1.5,
                  gap: 1 
                }}>
                  <Button 
                    variant="outlined"
                    size="small"
                    disabled={page === 0}
                    onClick={() => setPage(prev => prev - 1)}
                    sx={{ minWidth: 'auto', px: 1, py: 0.5 }}
                  >
                    <KeyboardArrowUpIcon fontSize="small" />
                  </Button>
                  <Typography variant="caption" sx={{ 
                    alignSelf: 'center',
                    px: 1,
                    py: 0.5,
                    borderRadius: 0.5,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider'
                  }}>
                    {page + 1} / {Math.ceil(reviews.length / reviewsPerPage)}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={page === Math.ceil(reviews.length / reviewsPerPage) - 1}
                    onClick={() => setPage(prev => prev + 1)}
                    sx={{ minWidth: 'auto', px: 1, py: 0.5 }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </Button>
            </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const StationInfo = ({ station, setSnackbar }) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    
    const openGoogleMaps = () => {
      if (!userLocation) return;
      
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${station.latitude},${station.longitude}&travelmode=driving`;
      window.open(url, '_blank');
    };

    return (
      <Box sx={{ 
        bgcolor: 'background.paper',
          borderRadius: 2,
        width: isMobile ? '280px' : '320px',
        overflow: 'hidden'
      }}>
        {/* Başlık */}
        <Box sx={{ 
          p: isMobile ? 1.5 : 2, 
          pb: isMobile ? 0.5 : 1
        }}>
          <Typography variant="h6" sx={{ 
            mb: 0.5,
            fontSize: isMobile ? '1rem' : '1.25rem',
            wordBreak: 'break-word'
          }}>
            {station.name}
          </Typography>
          
          {/* Soket durumları */}
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: 1, 
            mt: 1,
            '& > div': {
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: isMobile ? '0.75rem' : '0.875rem'
            }
          }}>
            {station.available_dc > 0 && (
              <Box sx={{ bgcolor: 'success.main' }}>
                <EvStationIcon sx={{ fontSize: isMobile ? 16 : 18 }} />
                <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                  {station.available_dc}/{station.connector_count} DC Müsait
            </Typography>
              </Box>
            )}
            {station.available_ac > 0 && (
              <Box sx={{ bgcolor: 'info.main' }}>
                <EvStationIcon sx={{ fontSize: isMobile ? 16 : 18 }} />
                <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                  {station.available_ac} AC Müsait
                </Typography>
              </Box>
            )}
          </Box>
          </Box>

        {/* Detay bilgileri */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: 1,
          borderColor: 'divider',
          p: 1.5,
          gap: 0,
          '& > div': {
            borderRight: 1,
            borderColor: 'divider',
            '&:last-child': {
              borderRight: 0
            }
          }
        }}>
          {/* Mesafe */}
          <Box sx={{ textAlign: 'center', px: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 0.5 
            }}>
              <DirectionsIcon 
                sx={{ 
                  color: 'primary.main',
                  fontSize: 20
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Mesafe
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {station.routeDetails?.realDistance || station.routeDetails?.distance} km
              </Typography>
            </Box>
          </Box>

          {/* Varış */}
          <Box sx={{ textAlign: 'center', px: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 0.5 
            }}>
              <TimerIcon 
                sx={{ 
                  color: 'warning.main',
                  fontSize: 20
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Varış
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {station.routeDetails?.realDuration || station.routeDetails?.duration} dk
            </Typography>
            </Box>
          </Box>

          {/* Tüketim */}
          <Box sx={{ textAlign: 'center', px: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 0.5 
            }}>
              <BoltIcon 
                sx={{ 
                  color: 'error.main',
                  fontSize: 20
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Tüketim
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {station.routeDetails?.consumption} kWh
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  ≈ {(station.routeDetails?.consumption * electricityPrice).toFixed(1)} TL
            </Typography>
              </Box>
            </Box>
          </Box>

          {/* Varış Şarjı */}
          <Box sx={{ textAlign: 'center', px: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 0.5 
            }}>
              <BatteryChargingFullIcon 
                sx={{ 
                  color: 'success.main',
                  fontSize: 20,
                  transform: 'rotate(90deg)'
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Varış Şarjı
              </Typography>
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 'medium' }}>
                {batteryLevel - ((station.routeDetails?.consumption / batteryCapacity) * 100).toFixed(1)}%
            </Typography>
            </Box>
          </Box>
        </Box>

        {/* Google Maps butonu */}
        <Box 
          onClick={openGoogleMaps}
            sx={{ 
            p: 1, 
            borderTop: 1, 
            borderColor: 'divider',
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.75rem',
              '&:hover': {
              bgcolor: 'primary.dark',
              '& .google-icon': {
                transform: 'translateX(2px)'
              }
            }
          }}
        >
          <DirectionsIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ 
            fontSize: 'inherit',
            fontWeight: 'medium',
            letterSpacing: '0.5px'
          }}>
            GOOGLE MAPS
          </Typography>
          <Box sx={{ 
            display: 'flex',
            transition: 'transform 0.2s',
          }} className="google-icon">
            <GoogleIcon sx={{ fontSize: 14 }} />
        </Box>
        </Box>

        {/* Yorum bölümü */}
        <ReviewSection 
          station={station} 
          setSnackbar={setSnackbar}
        />
      </Box>
    );
  };

  const VehicleSettingsDialog = useMemo(() => () => (
    <Dialog
      open={showSettings}
      onClose={() => setShowSettings(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxWidth: { xs: '90%', sm: 400 }
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1 
      }}>
        <ElectricCarIcon color="primary" />
        <Typography variant="h6">Araç Bilgileri</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ py: 1 }}>
          {/* Menzil Bilgisi */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Mevcut Menzil
            </Typography>
            <Typography variant="h4" sx={{ mb: 1 }}>
              {calculateRange()} km
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {batteryCapacity * (batteryLevel / 100)} kWh kullanılabilir
            </Typography>
          </Box>

          {/* Batarya Seviyesi */}
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BatteryChargingFullIcon fontSize="small" />
            Batarya Seviyesi: {batteryLevel}%
          </Typography>
          <Slider
            value={batteryLevel}
            onChange={(e, newValue) => setBatteryLevel(newValue)}
            min={0}
            max={100}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />

          {/* Diğer Ayarlar */}
          <TextField
            fullWidth
            label="Batarya Kapasitesi"
            type="number"
            value={batteryCapacity}
            onChange={(e) => setBatteryCapacity(Number(e.target.value))}
            InputProps={{
              startAdornment: <BoltIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: <InputAdornment position="end">kWh</InputAdornment>
            }}
            sx={{ mb: 2 }}
            size="small"
          />

          <TextField
            fullWidth
            label="Ortalama Tüketim"
            type="number"
            value={averageConsumption}
            onChange={(e) => setAverageConsumption(Number(e.target.value))}
            InputProps={{
              startAdornment: <LocalGasStationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: <InputAdornment position="end">kWh/100km</InputAdornment>
            }}
            sx={{ mb: 2 }}
            size="small"
          />

          <TextField
            fullWidth
            label="Elektrik Birim Fiyatı"
            type="number"
            value={electricityPrice}
            onChange={(e) => setElectricityPrice(Number(e.target.value))}
            InputProps={{
              startAdornment: <PercentIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: <InputAdornment position="end">TL/kWh</InputAdornment>
            }}
            size="small"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          onClick={() => setShowSettings(false)}
          variant="contained"
          fullWidth
        >
          Tamam
        </Button>
      </DialogActions>
    </Dialog>
  ), [showSettings, batteryLevel, batteryCapacity, averageConsumption, electricityPrice, calculateRange]);

  const StationTableRow = ({ station, index, onSelect }) => {
    const [realDetails, setRealDetails] = useState(null);
    const theme = useTheme();

    // İstasyon seçildiğinde veya tablo ilk yüklendiğinde gerçek mesafeyi hesapla
    useEffect(() => {
      const fetchRealDistance = async () => {
        if (!userLocation) return;

        try {
          const response = await fetch(`${API_BASE_URL}/stations/distance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat1: userLocation.lat,
              lon1: userLocation.lng,
              lat2: station.latitude,
              lon2: station.longitude,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setRealDetails({
              distance: data.distance.toFixed(1),
              duration: Math.round(data.duration / 60),
              consumption: ((data.distance * averageConsumption) / 100).toFixed(1)
            });
          }
        } catch (error) {
          console.error('Error:', error);
        }
      };

      fetchRealDistance();
    }, [station, userLocation]);

    return (
      <TableRow
        hover
        selected={selectedStation?.id === station.id}
        onClick={() => onSelect(station)}
        sx={{ 
          cursor: 'pointer',
          '&.Mui-selected': {
            bgcolor: `${theme.palette.primary.main}15 !important`
          },
          opacity: station.routeDetails?.isReachable ? 1 : 0.5
        }}
      >
        <TableCell>{index + 1}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${getStatusColor(station)}15`,
                color: getStatusColor(station),
              }}
            >
              <EvStationIcon />
            </Box>
            <Box>
              <Typography variant="body2">{station.name}</Typography>
              <Typography variant="caption" color="textSecondary">
                {getStatusText(station)}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2">
              DC: {station.available_dc}/{station.connector_count}
            </Typography>
            <Typography variant="body2">
              AC: {station.available_ac}
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2">
              {realDetails?.distance || station.routeDetails?.distance} km
            </Typography>
            {realDetails && realDetails.distance !== station.routeDetails?.distance && (
              <Typography variant="caption" color="textSecondary">
                Kuş uçuşu: {station.routeDetails?.distance} km
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2">
              {realDetails?.duration || station.routeDetails?.duration} dk
            </Typography>
            {realDetails && realDetails.duration !== station.routeDetails?.duration && (
              <Typography variant="caption" color="textSecondary">
                Tahmini: {station.routeDetails?.duration} dk
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            color: station.routeDetails?.isReachable ? 'inherit' : 'error.main'
          }}>
            <Typography variant="body2">
              {realDetails?.consumption || station.routeDetails?.consumption} kWh
            </Typography>
            {!station.routeDetails?.isReachable && (
              <Typography variant="caption" color="error">
                Menzil Dışında
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="right">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              showRoute(station);
            }}
            sx={{ color: theme.palette.primary.main }}
          >
            <DirectionsIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  const StationsTable = () => (
    <Collapse in={showTable}>
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: isMobile ? '60vh' : '50vh',
          bgcolor: 'background.paper',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
          boxShadow: 3,
          zIndex: 1000,
        }}
      >
        <Box sx={{ 
          p: 1.5,
          display: 'flex', 
          flexDirection: 'column',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          {/* Başlık - Ortada */}
          <Box sx={{ 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            mb: 1
          }}>
            <EvStationIcon 
              color="primary" 
              sx={{ fontSize: 24 }}
            />
            <Typography variant="h6" sx={{ 
              fontWeight: 600,
              color: 'primary.main',
              fontSize: '1.1rem'
            }}>
              En Yakın 10 İstasyon
            </Typography>
          </Box>

          {/* Alt bilgiler - Sol alt */}
          <Box sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {/* Araç bilgileri */}
            <Box sx={{ 
              display: 'flex', 
              gap: 2,
              alignItems: 'center',
              py: 0.25,
              px: 1,
              bgcolor: 'background.default',
              borderRadius: 1,
              boxShadow: 1,
              fontSize: '0.75rem'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BoltIcon color="warning" sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight="medium">
                  {averageConsumption} kWh/100km
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocalGasStationIcon color="error" sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight="medium">
                  {electricityPrice} ₺/kWh
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BatteryChargingFullIcon color="success" sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight="medium">
                  {batteryLevel}% ({calculateRange()} km)
                </Typography>
              </Box>
            </Box>

            {/* Kapatma butonu */}
            <IconButton 
              onClick={() => setShowTable(false)}
              size="small"
              sx={{ 
                bgcolor: 'background.default',
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <TableContainer sx={{ 
          height: isMobile ? 'calc(60vh - 70px)' : 'calc(50vh - 70px)',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'background.default',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'primary.main',
            borderRadius: '4px',
          },
        }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  bgcolor: 'background.paper',
                  borderBottom: 2,
                  borderColor: 'primary.main'
                }}>
                  İstasyon Bilgileri
                </TableCell>
                <TableCell align="center" sx={{ 
                  fontWeight: 600, 
                  bgcolor: 'background.paper',
                  borderBottom: 2,
                  borderColor: 'primary.main'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <DirectionsIcon fontSize="small" />
                    Mesafe/Süre
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ 
                  fontWeight: 600, 
                  bgcolor: 'background.paper',
                  borderBottom: 2,
                  borderColor: 'primary.main'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <BoltIcon fontSize="small" />
                    Tüketim/Maliyet
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ 
                  fontWeight: 600, 
                  bgcolor: 'background.paper',
                  borderBottom: 2,
                  borderColor: 'primary.main'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <BatteryChargingFullIcon fontSize="small" />
                    Şarj Bilgisi
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStations.map((station, index) => (
                <TableRow
                  key={station.id}
                  hover
                  onClick={() => handleStationSelect(station)}
                  selected={selectedStation?.id === station.id}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { 
                      bgcolor: 'action.hover',
                      '& .show-route-button': {
                        opacity: 1
                      }
                    },
                    '&.Mui-selected': { 
                      bgcolor: `${theme.palette.primary.main}15`,
                      '& .show-route-button': {
                        opacity: 1
                      }
                    }
                  }}
                >
                  <TableCell sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <Box sx={{ 
                        width: 40,
                        height: 40,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${getStatusColor(station)}15`,
                        color: getStatusColor(station),
                        border: 1,
                        borderColor: getStatusColor(station)
                      }}>
                        <EvStationIcon />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ 
                          fontWeight: 600,
                          color: 'text.primary',
                          mb: 0.5
                        }}>
                          {station.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          {station.available_dc > 0 && (
                            <Chip
                              size="small"
                              icon={<BoltIcon sx={{ fontSize: '1rem !important' }} />}
                              label={`${station.available_dc}/${station.connector_count} DC`}
                              color="success"
                              variant="outlined"
                              sx={{ height: 24 }}
                            />
                          )}
                          {/* DC Şarj olan cihaz sayısı */}
                          {station.connector_count - station.available_dc > 0 && (
                            <Chip
                              size="small"
                              icon={<ElectricCarIcon sx={{ fontSize: '1rem !important' }} />}
                              label={`${station.connector_count - station.available_dc} DC Şarjda`}
                              color="warning"
                              variant="outlined"
                              sx={{ 
                                height: 24,
                                animation: 'pulse 2s infinite'
                              }}
                            />
                          )}
                          {station.available_ac > 0 && (
                            <Chip
                              size="small"
                              icon={<ElectricCarIcon sx={{ fontSize: '1rem !important' }} />}
                              label={`${station.available_ac} AC`}
                              color="info"
                              variant="outlined"
                              sx={{ height: 24 }}
                            />
                          )}
                          {/* AC Şarj olan cihaz sayısı - eğer backend'den bu bilgi geliyorsa */}
                          {station.total_ac > station.available_ac && (
                            <Chip
                              size="small"
                              icon={<ElectricCarIcon sx={{ fontSize: '1rem !important' }} />}
                              label={`${station.total_ac - station.available_ac} AC Şarjda`}
                              color="warning"
                              variant="outlined"
                              sx={{ 
                                height: 24,
                                animation: 'pulse 2s infinite'
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 0.5 
                    }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}>
                        <DirectionsIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        {station.routeDetails?.distance} km
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: 'text.secondary',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}>
                        <TimerIcon sx={{ fontSize: 14 }} />
                        {station.routeDetails?.duration} dk
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 0.5 
                    }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}>
                        <BoltIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        {station.routeDetails?.consumption} kWh
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: 'text.secondary',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}>
                        <LocalGasStationIcon sx={{ fontSize: 14 }} />
                        {(station.routeDetails?.consumption * electricityPrice).toFixed(1)} ₺
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 0.5,
                      position: 'relative'
                    }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: calculateChargeTime(station) > 1.33 ? 'error.main' : 'success.main'
                      }}>
                        <BatteryChargingFullIcon sx={{ 
                          fontSize: 16, 
                          color: 'inherit',
                          transform: 'rotate(90deg)'
                        }} />
                        {calculateChargeTime(station)} saat
                        {calculateChargeTime(station) > 1.33 && (
                          <Tooltip title="Uzun şarj süresi">
                            <Box component="span" sx={{ 
                              display: 'inline-flex', 
                              alignItems: 'center',
                              color: 'error.main'
                            }}>
                              ⏰
                            </Box>
                          </Tooltip>
                        )}
                      </Typography>

                      {(() => {
                        const arrivalPercentage = batteryLevel - ((station.routeDetails?.consumption / batteryCapacity) * 100).toFixed(0);
                        return (
                          <Typography variant="caption" sx={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontWeight: 500,
                            color: arrivalPercentage < 30 ? 'error.main' : 'success.main'
                          }}>
                            <PercentIcon sx={{ 
                              fontSize: 14,
                              color: 'inherit'
                            }} />
                            Varış: {arrivalPercentage}%
                            {arrivalPercentage < 30 && (
                              <Tooltip title="Düşük şarj seviyesi">
                                <Box component="span" sx={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center',
                                  color: 'error.main'
                                }}>
                                  ⚠️
                                </Box>
                              </Tooltip>
                            )}
                          </Typography>
                        );
                      })()}
                      
                      <IconButton 
                        className="show-route-button"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          showRoute(station);
                        }}
                        sx={{ 
                          position: 'absolute',
                          right: -8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: 'primary.main',
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                          '&:hover': {
                            bgcolor: 'primary.main',
                            color: 'white'
                          }
                        }}
                      >
                        <DirectionsIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Collapse>
  );

  // Harita tıklama işleyicisi
  const handleMapClick = useCallback((e) => {
    // Marker'a tıklanmadıysa InfoWindow'u kapat
    if (e.placeId === undefined) {
      setSelectedStation(null);
      setRouteCoordinates(null);
    }
  }, []);

  // ESC tuşu ile InfoWindow'u kapatma
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedStation(null);
        setRouteCoordinates(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 't' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        setShowTable(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  useEffect(() => {
    const handleSKey = (event) => {
      if (event.key === 's' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        setShowSettings(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleSKey);
    return () => {
      document.removeEventListener('keydown', handleSKey);
    };
  }, []);

  useEffect(() => {
    const handleSpaceKey = (event) => {
      if (event.code === 'Space' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        if (userLocation && window.google) {
          const mapInstance = document.querySelector('div[class*="map"]')?.__gm?.map;
          if (mapInstance) {
            mapInstance.panTo(userLocation);
            mapInstance.setZoom(15);
          }
        }
      }
    };

    document.addEventListener('keydown', handleSpaceKey);
    return () => {
      document.removeEventListener('keydown', handleSpaceKey);
    };
  }, [userLocation]);

  useEffect(() => {
    const handleFKey = (event) => {
      if (event.key === 'f' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        setShowFilters(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleFKey);
    return () => {
      document.removeEventListener('keydown', handleFKey);
    };
  }, []);

  useEffect(() => {
    if (userLocation && window.google && window.google.maps.geometry) {
      // Eğer önceki konum varsa, yön hesaplayalım
      if (prevLocation.current) {
        try {
          const heading = window.google.maps.geometry.spherical.computeHeading(
            new window.google.maps.LatLng(prevLocation.current.lat, prevLocation.current.lng),
            new window.google.maps.LatLng(userLocation.lat, userLocation.lng)
          );
          
          // Sadece belirli bir mesafeden fazla hareket varsa rotasyonu güncelle
          const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(prevLocation.current.lat, prevLocation.current.lng),
            new window.google.maps.LatLng(userLocation.lat, userLocation.lng)
          );
          
          if (distance > 1) { // 1 metre üzeri hareketlerde
            prevRotation.current = heading;
          }
        } catch (error) {
          console.error('Yön hesaplama hatası:', error);
        }
      }

      // Mevcut konumu sakla
      prevLocation.current = userLocation;
    }
  }, [userLocation]);

  return (
    <Box sx={{ height: '100vh', width: '100%', position: 'relative' }}>
      <LoadScript 
        googleMapsApiKey={GOOGLE_MAPS_API_KEY} 
        libraries={libraries}
        loadingElement={<div>Harita yükleniyor...</div>}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={userLocation || defaultCenter}
          zoom={13}
          options={mapOptions}
          onLoad={(mapInstance) => {
            setMap(mapInstance);
            setIsMapReady(true);
          }}
          onClick={handleMapClick}
        >
          {isMapReady && (
            <>
              {userLocation && (
                <Marker
                  position={userLocation}
                  icon={{
                    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
                        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" transform="rotate(${prevRotation.current}, 12, 12)">🚗</text>
                      </svg>
                    `),
                    anchor: new window.google.maps.Point(20, 20),
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                />
              )}

              {filteredStations.map(station => (
                <Marker
                  key={station.id}
                  position={{
                    lat: station.latitude,
                    lng: station.longitude
                  }}
                  icon={getMarkerIcon(station)}
                  onClick={() => handleStationSelect(station)}
                />
              ))}

              {selectedStation && (
                <InfoWindow
                  position={{
                    lat: selectedStation.latitude,
                    lng: selectedStation.longitude
                  }}
                  onCloseClick={() => {
                    setSelectedStation(null);
                    setRouteCoordinates(null);
                  }}
                  options={{
                    pixelOffset: new window.google.maps.Size(0, -20),
                    maxWidth: 320,
                    disableAutoPan: false
                  }}
                >
                  <StationInfo 
                    station={selectedStation} 
                    setSnackbar={setSnackbar}
                    onClose={() => {
                      setSelectedStation(null);
                      setRouteCoordinates(null);
                    }}
                  />
                </InfoWindow>
              )}

              {routeCoordinates && (
                <Polyline
                  path={routeCoordinates}
                  options={{
                    strokeColor: theme.palette.primary.main,
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                  }}
                />
              )}
            </>
          )}
        </GoogleMap>
      </LoadScript>

      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 1000 }}>
        <Tooltip title="Araç Bilgileri">
          <Fab
            color="primary"
            size="small"
            onClick={() => setShowSettings(true)}
            sx={{
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            <ElectricCarIcon />
          </Fab>
        </Tooltip>
      </Box>

      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
        <Fab
          color="primary"
          size="small"
          onClick={() => setShowFilters(!showFilters)}
          sx={{ mb: 1 }}
        >
          <FilterAltIcon />
        </Fab>
        <Fab
          color="primary"
          size="small"
          onClick={() => {
            if (userLocation && window.google) {
              const mapInstance = document.querySelector('div[class*="map"]')?.__gm?.map;
              if (mapInstance) {
                mapInstance.panTo(userLocation);
                mapInstance.setZoom(15);
              }
            }
          }}
        >
          <MyLocationIcon />
        </Fab>
      </Box>

      <VehicleSettingsDialog />

      <StationsTable />

      {!showTable && (
      <Fab
        color="primary"
        size="small"
          onClick={() => setShowTable(true)}
          sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
        >
          <KeyboardArrowUpIcon />
      </Fab>
      )}

      {isLoading.stations && (
        <Box sx={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          zIndex: 1000 
        }}>
          <CircularProgress />
      </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Tooltip title="Klavye Kısayolları">
        <Fab
          color="secondary"
          size="small"
          sx={{
            position: 'fixed', 
            bottom: 16, 
            left: 16, 
            zIndex: 1000,
            bgcolor: 'background.paper',
            color: 'text.primary',
            '&:hover': {
              bgcolor: 'background.paper',
              opacity: 0.9
            }
          }}
          onClick={() => setSnackbar({
            open: true,
            message: 'ESC: İstasyon bilgilerini kapat | SPACE: Konumuma git | F: Filtreleri aç/kapat | S: Araç ayarları | T: Tabloyu aç/kapat',
            severity: 'info'
          })}
        >
          <Typography variant="button">?</Typography>
        </Fab>
      </Tooltip>
    </Box>
  );
};

const Map = () => (
  <ErrorBoundary>
    <MapComponent />
  </ErrorBoundary>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Map error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Harita yüklenirken bir hata oluştu.</div>;
    }
    return this.props.children;
  }
}

export default Map; 