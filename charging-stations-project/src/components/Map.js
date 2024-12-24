import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet marker icon sorunu için fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Kullanıcı konumunu merkeze alan bileşen
function LocationMarker({ onLocationFound }) {
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 13 });

    map.on('locationfound', (e) => {
      onLocationFound(e.latlng);
    });

    map.on('locationerror', () => {
      console.log('Konum alınamadı');
      map.setView([39.925533, 32.866287], 13);
    });
  }, [map, onLocationFound]);

  return null;
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const Map = ({ stations }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);

  useEffect(() => {
    if (userLocation && stations) {
      const nearby = stations
        .map(station => ({
          ...station,
          distance: calculateDistance(
            userLocation.lat,
            userLocation.lng,
            station.latitude,
            station.longitude
          )
        }))
        .filter(station => station.distance <= 20)
        .sort((a, b) => a.distance - b.distance);

      setNearbyStations(nearby);
    }
  }, [userLocation, stations]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'green';
      case 'busy': return 'red';
      case 'offline': return 'gray';
      default: return 'blue';
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[39.925533, 32.866287]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <LocationMarker onLocationFound={setUserLocation} />
        
        {nearbyStations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
          >
            <Popup>
              <div>
                <h3>{station.name}</h3>
                <p>{station.address}</p>
                <p style={{ color: getStatusColor(station.status) }}>
                  Durum: {station.status}
                </p>
                <p>Güç: {station.power} kW</p>
                <p>Mesafe: {station.distance.toFixed(1)} km</p>
                <p>Şarj Tipleri: {station.type.join(', ')}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          maxHeight: '400px',
          overflowY: 'auto',
          boxShadow: '0 0 10px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}
      >
        <h3>En Yakın İstasyonlar</h3>
        {nearbyStations.map(station => (
          <div
            key={station.id}
            style={{
              padding: '8px',
              borderBottom: '1px solid #eee',
              cursor: 'pointer'
            }}
          >
            <strong>{station.name}</strong>
            <p style={{ margin: '4px 0', color: getStatusColor(station.status) }}>
              {station.status} • {station.distance.toFixed(1)} km
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Map; 