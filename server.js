const express = require('express');
const axios = require('axios');
const { getSubtitles } = require('youtube-captions-scraper'); // npm install youtube-captions-scraper

const app = express();
const port = process.env.PORT || 3000;

// API key de YouTube (usa tu propia clave, solo para pruebas)
const API_KEY = "AIzaSyAXLg3-Gpoda7YE7f9SEFCsFcjRHpx7-Fs";

app.use(express.json());

async function getVideoDetails(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${API_KEY}`;
  try {
    const response = await axios.get(url);
    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0];
    }
  } catch (error) {
    console.error('Error al obtener detalles del video:', error.message);
  }
  return null;
}

async function fetchTranscript(videoId) {
  try {
    let captions = await getSubtitles({ videoID: videoId, lang: 'es' });
    if (!captions || captions.length === 0) {
      captions = await getSubtitles({ videoID: videoId, lang: 'en' });
    }
    if (captions && captions.length > 0) {
      return captions.map(item => item.text).join(' ');
    }
  } catch (error) {
    console.error(`Error obteniendo transcripción para video ${videoId}:`, error.message);
  }
  return 'Transcripción no disponible';
}

app.post('/scrape', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: "No se proporcionó el videoId. Ejemplo: { \"videoId\": \"ABC123\" }" });
  }
  try {
    const details = await getVideoDetails(videoId);
    const transcript = await fetchTranscript(videoId);
    if (!details) throw new Error("No se obtuvieron detalles para el video.");
    const output = {
      titulo: details.snippet.title,
      descripcion: details.snippet.description,
      vistas: details.statistics.viewCount,
      duracion: details.contentDetails.duration,
      transcript,
      urlVideo: `https://www.youtube.com/watch?v=${videoId}`
    };
    return res.json(output);
  } catch (error) {
    console.error("Error en /scrape:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

