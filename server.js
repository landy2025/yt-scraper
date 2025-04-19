const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();
const port = process.env.PORT || 3000;

// Asegúrate de configurar YT_API_KEY en las variables de entorno de Render
const API_KEY = process.env.YT_API_KEY || 'AIzaSyAXLg3-Gpoda7YE7f9SEFCsFcjRHpx7-Fs';

app.use(cors());
app.use(express.json()); // Para poder leer cuerpos de petición JSON

async function getUploadsPlaylistId(channelId) {
  console.log("Buscando playlist para channelId:", channelId); // Registro añadido
  // URL correcta de la API de YouTube - error de sintaxis corregido
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=<span class="math-inline">\{channelId\}&key\=</span>{API_KEY}`;
  console.log("Llamando a YouTube API URL (getUploadsPlaylistId):", url); // Registro añadido
  console.log("Usando API_KEY (getUploadsPlaylistId):", API_KEY); // Registro añadido

  try {
    const response = await axios.get(url);
    console.log("Respuesta de YouTube API (contentDetails):", response.data); // Registro añadido
    if (response.data.items && response.data.items.length > 0) {
      console.log("Playlist ID encontrada:", response.data.items[0].contentDetails.relatedPlaylists.uploads); // Registro añadido
      return response.data.items[0].contentDetails.relatedPlaylists.uploads;
    } else {
        console.log("La API de YouTube no devolvió ítems para el channelId:", channelId); // Registro añadido
    }
  } catch (error) {
    console.error('Error al obtener la playlist de uploads:', error.message); // Registro ya existente
    console.error('Detalles del error de YouTube API:', error.response ? error.response.data : 'No hay detalles adicionales de error'); // Registro añadido para detalles
  }
  console.log("No se encontró playlist ID para:", channelId); // Registro añadido si falla o no hay ítems
  return null;
}

async function getVideosFromPlaylist(playlistId, pageToken = '') {
  console.log("Buscando videos para playlistId:", playlistId); // Registro añadido
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=<span class="math-inline">\{playlistId\}&pageToken\=</span>{pageToken}&key=${API_KEY}`;
  console.log("Llamando a YouTube API URL (getVideosFromPlaylist):", url); // Registro añadido
  try {
    const response = await axios.get(url);
    console.log("Videos obtenidos en la página actual:", response.data.items ? response.data.items.length : 0); // Registro añadido
    return response.data;
  } catch (error) {
    console.error('Error al obtener videos de la playlist:', error.message);
    console.error('Detalles del error de YouTube API (playlistItems):', error.response ? error.response.data : 'No hay detalles adicionales de error'); // Registro añadido
  }
  return null;
}

async function getVideoDetails(videoIds) {
  console.log("Buscando detalles para videoIds:", videoIds); // Registro añadido
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=<span class="math-inline">\{videoIds\.join\(','\)\}&key\=</span>{API_KEY}`;
  console.log("Llamando a YouTube API URL (getVideoDetails):", url); // Registro añadido
  try {
    const response = await axios.get(url);
    console.log("Detalles de videos obtenidos:", response.data.items ? response.data.items.length : 0); // Registro añadido
    return response.data.items
