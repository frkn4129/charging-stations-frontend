import React from 'react';
import Map from './components/Map';
import { mockStations } from './data/mockStations';
import './App.css';

function App() {
  return (
    <div className="App">
      <Map stations={mockStations} />
    </div>
  );
}

export default App; 