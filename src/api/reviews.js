const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

export const getStationReviews = async (stationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/stations/${stationId}/reviews`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Yorumlar alınamadı');
    }

    return response.json();
  } catch (error) {
    console.error('Yorumları alma hatası:', error);
    throw error;
  }
};

export const submitReview = async (stationId, review) => {
  try {
    const response = await fetch(`${API_BASE_URL}/stations/${stationId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Yorum gönderilemedi');
    }

    return response.json();
  } catch (error) {
    console.error('Yorum gönderme hatası:', error);
    throw error;
  }
}; 