import React, { useState, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, IconButton, Box, CircularProgress } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Map from './components/Map';

function App() {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode || 'light';
  });
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/stations');
      const result = await response.json();
      
      if (result.status === 'success') {
        setStations(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch stations');
      }
    } catch (error) {
      setError(error.message);
      console.error('Error fetching stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? '#2196f3' : '#90caf9',
          },
          secondary: {
            main: mode === 'light' ? '#4caf50' : '#81c784',
          },
          background: {
            default: mode === 'light' ? '#ffffff' : '#303030',
            paper: mode === 'light' ? '#ffffff' : '#424242',
          },
          status: {
            available: mode === 'light' ? '#4caf50' : '#81c784',
            busy: mode === 'light' ? '#f44336' : '#e57373',
            offline: mode === 'light' ? '#9e9e9e' : '#757575',
          },
        },
      }),
    [mode],
  );

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <IconButton
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1001,
          bgcolor: 'background.paper',
          boxShadow: 3,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        onClick={() => setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))}
        color="inherit"
      >
        {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
      </IconButton>
      <Map stations={stations} />
    </ThemeProvider>
  );
}

export default App;
