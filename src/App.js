import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Map from './components/Map';
import { mockStations } from './data/mockStations';

const theme = createTheme();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Map stations={mockStations} />
    </ThemeProvider>
  );
}

export default App;
