const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();
const port = process.env.PORT || 3000;

const API_KEY = process.env.YT_API_KEY || 'AIzaSyAXLg3-Gpoda7YE7f9SEFCsFcjRHpx7-Fs';

app.use(cors());
app.use(express.json());

async function getUploadsPlaylistId(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  try {
    const response = await axios.get(url);
    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].contentDetails.relatedPlaylists.uploads;
    }
  } catch (error) {
    console.error('Error al obtener la playlist de uploads:', error.message);
  }
  return null;
}

async function getVideosFromPlaylist(playlistId, pageToken = '') {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&pageToken=${pageToken}&key=${API_KEY}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error al obtener videos de la playlist:', error.message);
  }
  return null;
}

async function getVideoDetails(videoIds) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${API_KEY}`;
  try {
    const response = await axios.get(url);
    return response.data.items;
  } catch (error) {
    console.error('Error al obtener detalles de los videos:', error.message);
  }
  return [];
}

function parseISODuration(duration) {
  let hours = 0, minutes = 0, seconds = 0;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = duration.match(regex);
  if (matches) {
    if (matches[1]) hours = parseInt(matches[1]);
    if (matches[2]) minutes = parseInt(matches[2]);
    if (matches[3]) seconds = parseInt(matches[3]);
  }
  return hours * 3600 + minutes * 60 + seconds;
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

async function scrapeChannel(channelId) {
  const playlistId = await getUploadsPlaylistId(channelId);
  if (!playlistId) throw new Error("No se encontró la playlist de uploads.");

  let videos = [];
  let nextPageToken = '';
  do {
    const data = await getVideosFromPlaylist(playlistId, nextPageToken);
    if (data && data.items) {
      videos = videos.concat(data.items);
      nextPageToken = data.nextPageToken;
    } else {
      break;
    }
  } while (nextPageToken);

  const videoIds = videos.map(item => item.snippet.resourceId.videoId);
  let details = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batchIds = videoIds.slice(i, i + 50);
    const batchDetails = await getVideoDetails(batchIds);
    details = details.concat(batchDetails);
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const filteredVideos = details.filter(video => {
    const viewCount = parseInt(video.statistics.viewCount || "0");
    const publishedAt = new Date(video.snippet.publishedAt);
    const durationSec = parseISODuration(video.contentDetails.duration);
    return viewCount >= 50000 && publishedAt >= twoYearsAgo && durationSec >= 60;
  });

  const output = [];
  for (const video of filteredVideos) {
    const transcript = await fetchTranscript(video.id);
    output.push({
      transcript,
      portada: video.snippet.thumbnails.high.url,
      titulo: video.snippet.title,
      duracion: video.contentDetails.duration,
      vistas: video.statistics.viewCount,
      likes: video.statistics.likeCount,
      comentarios: video.statistics.commentCount,
      descripcion: video.snippet.description,
      urlVideo: `https://www.youtube.com/watch?v=${video.id}`
    });
  }
  return output;
}

app.get('/', (req, res) => {
  res.send('Servidor activo y esperando peticiones POST en /scrape');
});

app.post('/scrape', async (req, res) => {
  const { channel_id } = req.body;
  if (!channel_id) {
    return res.status(400).json({ error: "Falta el parámetro 'channel_id' en el body." });
  }

  try {
    const result = await scrapeChannel(channel_id);
    return res.json(result);
  } catch (error) {
    console.error("Error en scrapeChannel:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
