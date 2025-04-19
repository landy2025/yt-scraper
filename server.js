const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();
const port = process.env.PORT || 3000;

// Asegúrate de configurar YT_API_KEY en las variables de entorno de Render
// Puedes añadir una clave por defecto aquí, pero la variable de entorno es más segura en producción.
const API_KEY = process.env.YT_API_KEY || 'TU_CLAVE_DE_API_DE_YOUTUBE_AQUI_SI_NO_ESTA_EN_ENV'; // <--- Reemplaza con tu clave si no usas variables de entorno

app.use(cors());
app.use(express.json()); // Para poder leer cuerpos de petición JSON

async function getUploadsPlaylistId(channelId) {
  console.log("Buscando playlist para channelId:", channelId); // Registro añadido
  // URL correcta de la API de YouTube - sintaxis de template literal corregida
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  console.log("Llamando a YouTube API URL (getUploadsPlaylistId):", url); // Registro añadido
  console.log("Usando API_KEY (getUploadsPlaylistId):", API_KEY ? 'Configurada' : 'NO CONFIGURADA'); // Verifica si la clave está definida

  try {
    const response = await axios.get(url);
    console.log("Respuesta de YouTube API (contentDetails) status:", response.status); // Registro status
    console.log("Respuesta de YouTube API (contentDetails) data:", JSON.stringify(response.data, null, 2)); // Registro data completa formateada

    if (response.data.items && response.data.items.length > 0) {
      const uploadsPlaylistId = response.data.items[0].contentDetails.relatedPlaylists.uploads;
      console.log("Playlist ID encontrada:", uploadsPlaylistId); // Registro añadido
      return uploadsPlaylistId;
    } else {
      console.log("La API de YouTube no devolvió ítems para el channelId:", channelId); // Registro añadido
    }
  } catch (error) {
    console.error('### Error al obtener la playlist de uploads ###'); // Registro de error
    console.error('Mensaje de error:', error.message); // Registro mensaje de error
    if (error.response) {
      // La solicitud fue hecha y el servidor respondió con un código de estado
      // que cae fuera del rango de 2xx
      console.error('Error de respuesta de YouTube API (getUploadsPlaylistId) status:', error.response.status);
      console.error('Error de respuesta de YouTube API (getUploadsPlaylistId) data:', JSON.stringify(error.response.data, null, 2));
      console.error('Error de respuesta de YouTube API (getUploadsPlaylistId) headers:', error.response.headers);
    } else if (error.request) {
      // La solicitud fue hecha pero no se recibió respuesta
      console.error('Error de solicitud de YouTube API (getUploadsPlaylistId): No se recibió respuesta');
      console.error('Error de solicitud de YouTube API (getUploadsPlaylistId) request:', error.request);
    } else {
      // Algo pasó al configurar la solicitud que lanzó un Error
      console.error('Error de configuración de solicitud de YouTube API (getUploadsPlaylistId):', error.config);
    }
  }
  console.log("No se encontró playlist ID para:", channelId); // Registro añadido si falla o no hay ítems
  return null;
}

async function getVideosFromPlaylist(playlistId, pageToken = '') {
  console.log("Buscando videos para playlistId:", playlistId); // Registro añadido
  // URL correcta de la API de YouTube - sintaxis de template literal corregida
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&pageToken=${pageToken}&key=${API_KEY}`;
  console.log("Llamando a YouTube API URL (getVideosFromPlaylist):", url); // Registro añadido
  try {
    const response = await axios.get(url);
    console.log("Videos obtenidos en la página actual:", response.data.items ? response.data.items.length : 0); // Registro añadido
    console.log("Siguiente pageToken:", response.data.nextPageToken); // Registro siguiente pageToken
    return response.data;
  } catch (error) {
    console.error('### Error al obtener videos de la playlist ###'); // Registro de error
    console.error('Mensaje de error:', error.message);
    if (error.response) {
       console.error('Error de respuesta de YouTube API (playlistItems) status:', error.response.status);
       console.error('Error de respuesta de YouTube API (playlistItems) data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  return null;
}

async function getVideoDetails(videoIds) {
  console.log("Buscando detalles para videoIds:", videoIds); // Registro añadido
  if (!videoIds || videoIds.length === 0) {
      console.log("No hay videoIds para buscar detalles.");
      return [];
  }
  // URL correcta de la API de YouTube - sintaxis de template literal corregida
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${API_KEY}`;
  console.log("Llamando a YouTube API URL (getVideoDetails):", url); // Registro añadido
  try {
    const response = await axios.get(url);
    console.log("Detalles de videos obtenidos:", response.data.items ? response.data.items.length : 0); // Registro añadido
    //console.log("Detalles de videos data:", JSON.stringify(response.data, null, 2)); // Descomentar para ver data completa si es necesario
    return response.data.items;
  } catch (error) {
    console.error('### Error al obtener detalles de los videos ###'); // Registro de error
    console.error('Mensaje de error:', error.message);
     if (error.response) {
       console.error('Error de respuesta de YouTube API (videos) status:', error.response.status);
       console.error('Error de respuesta de YouTube API (videos) data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  return [];
}

function parseISODuration(duration) {
  //console.log("Parseando duración ISO:", duration); // Registro si se necesita depurar
  if (!duration) return 0;
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
  console.log("Intentando obtener transcripción para video:", videoId); // Registro añadido
  if (!videoId) {
      console.log("No hay videoId para obtener transcripción.");
      return 'Transcripción no disponible: videoId faltante';
  }
  try {
    let captions = await getSubtitles({ videoID: videoId, lang: 'es' });
    console.log("Intentando transcripción en español para", videoId, ". Encontradas:", captions ? captions.length : 0); // Registro añadido
    if (!captions || captions.length === 0) {
      captions = await getSubtitles({ videoID: videoId, lang: 'en' });
      console.log("Intentando transcripción en inglés para", videoId, ". Encontradas:", captions ? captions.length : 0); // Registro añadido
    }
    if (captions && captions.length > 0) {
      console.log("Transcripción obtenida para video:", videoId); // Registro añadido
      return captions.map(item => item.text).join(' ');
    } else {
      console.log("No se encontraron transcripciones (es/en) para video:", videoId); // Registro añadido
    }
  } catch (error) {
    console.error(`### Error obteniendo transcripción para video ${videoId} ###`); // Registro de error
    console.error('Mensaje de error (getSubtitles):', error.message);
    // Esta biblioteca podría no devolver error.response, solo error.message
  }
  return 'Transcripción no disponible';
}


async function scrapeChannel(channelId) {
  console.log("Iniciando scraping para channelId:", channelId); // Registro añadido
  if (!channelId) {
      console.error("Error: scrapeChannel llamado con channelId nulo o indefinido.");
      throw new Error("scrapeChannel requiere un ID de canal válido.");
  }

  const playlistId = await getUploadsPlaylistId(channelId);
  if (!playlistId) {
    console.error("Fallo al encontrar playlist ID, lanzando error 'No se encontró la playlist de uploads'."); // Registro añadido antes de lanzar error
    throw new Error("No se encontró la playlist de uploads.");
  }
  console.log("Playlist ID encontrada:", playlistId); // Registro añadido

  let videos = [];
  let nextPageToken = '';
  do {
    console.log(`Obteniendo página de videos para playlist ${playlistId}, pageToken: ${nextPageToken ? nextPageToken : 'inicio'}`); // Registro añadido
    const data = await getVideosFromPlaylist(playlistId, nextPageToken);
    if (data && data.items) {
      videos = videos.concat(data.items);
      nextPageToken = data.nextPageToken;
      console.log(`Videos concatenados. Total hasta ahora: ${videos.length}. Siguiente pageToken: ${nextPageToken ? nextPageToken : 'fin'}`); // Registro añadido
    } else {
      console.log("No hay más datos de videos o error en getVideosFromPlaylist. Rompiendo loop."); // Registro añadido
      break;
    }
  } while (nextPageToken);

  console.log("Total de videos obtenidos de la playlist ANTES de filtrar:", videos.length); // Registro añadido

  // Extraer IDs de videos de la lista completa para obtener detalles en lotes
  const videoIds = videos.map(item => item.snippet.resourceId.videoId).filter(id => id); // Asegurarse de que el ID no sea nulo/indefinido
  console.log("IDs de videos extraídos y filtrados por valor:", videoIds.length > 10 ? videoIds.slice(0, 10).join(',') + ', ...' : videoIds.join(',')); // Log de IDs (primeros 10)
  console.log("Total de IDs de videos extraídos:", videoIds.length); // Registro añadido


  let details = [];
  // Obtener detalles en lotes de 50, que es el máximo permitido por la API de videos
  if (videoIds.length > 0) {
     console.log("Obteniendo detalles de videos en lotes..."); // Registro añadido
     for (let i = 0; i < videoIds.length; i += 50) {
       const batchIds = videoIds.slice(i, i + 50);
       console.log(`Procesando lote ${Math.floor(i/50) + 1}/${Math.ceil(videoIds.length/50)} de video IDs para detalles (${batchIds.length} IDs).`); // Registro detallado de lote
       const batchDetails = await getVideoDetails(batchIds);
       if (batchDetails) {
          details = details.concat(batchDetails);
          console.log("Detalles de lote concatenados. Total de detalles:", details.length); // Registro añadido
       } else {
          console.error(`Error al obtener detalles para el lote ${Math.floor(i/50) + 1}. Saltando este lote.`); // Registro de error de lote
       }
     }
  } else {
      console.log("No hay video IDs para obtener detalles."); // Registro si no hay videos
  }
  console.log("Total de detalles de video obtenidos ANTES de filtrar:", details.length); // Registro añadido


  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  console.log("Filtrando videos. Fecha límite (2 años atrás):", twoYearsAgo.toISOString()); // Registro añadido

  const filteredVideos = details.filter(video => {
    // Asegurarse de que los campos necesarios existen antes de acceder a ellos
    if (!video || !video.statistics || !video.snippet || !video.contentDetails) {
        console.log("Saltando video inválido durante filtrado:", video);
        return false;
    }
    const viewCount = parseInt(video.statistics.viewCount || "0");
    const publishedAt = new Date(video.snippet.publishedAt);
    const durationSec = parseISODuration(video.contentDetails.duration);
    // Registro detallado para filtrar, mostrando valores clave
    console.log(`Video "${video.snippet.title}" (ID: ${video.id}) - Vistas: ${viewCount}, Publicado: ${publishedAt.toISOString()}, Duración ISO: ${video.contentDetails.duration}, Duración Segundos: ${durationSec}s)`);
    return viewCount >= 50000 && publishedAt >= twoYearsAgo && durationSec >= 60;
  });
  console.log("Total de videos filtrados:", filteredVideos.length); // Registro añadido


  const output = [];
  console.log("Obteniendo transcripciones para videos filtrados y preparando salida..."); // Registro añadido
  // Procesar solo los videos filtrados
  if (filteredVideos.length > 0) {
      for (const video of filteredVideos) {
        console.log("Procesando video para transcripción y salida:", video.id); // Registro añadido
        const transcript = await fetchTranscript(video.id);
        output.push({
          transcript,
          portada: video.snippet.thumbnails.high.url,
          titulo: video.snippet.title,
          duracionISO: video.contentDetails.duration, // Mantener formato ISO si es útil
          duracionSegundos: parseISODuration(video.contentDetails.duration), // Añadir duración en segundos si es útil
          vistas: parseInt(video.statistics.viewCount || "0"), // Asegurar que sea número
          likes: parseInt(video.statistics.likeCount || "0"), // Asegurar que sea número
          comentarios: parseInt(video.statistics.commentCount || "0"), // Asegurar que sea número
          descripcion: video.snippet.description,
          urlVideo: `https://www.youtube.com/watch?v=${video.id}` // URL correcta para ver el video de YouTube
        });
        console.log(`Transcripción y detalles procesados para video ${video.id}.`); // Registro añadido
      }
  } else {
      console.log("No hay videos filtrados para procesar."); // Registro si no hay videos filtrados
  }

  console.log("Scraping completado. Generando salida final con", output.length, "ítems."); // Registro añadido
  return output;
}

// Endpoint GET de prueba
app.get('/', (req, res) => {
  console.log("Petición GET recibida en /"); // Registro añadido
  res.send('Servidor activo y esperando peticiones POST en /scrape. Consulta logs para detalles.');
});

// Endpoint POST principal para scraping
app.post('/scrape', async (req, res) => {
  console.log("### Petición POST a /scrape recibida ###"); // Registro de inicio de petición
  console.log("Body completo recibido:", JSON.stringify(req.body, null, 2)); // Registro body formateado
  const { channel_id } = req.body;
  console.log("Valor de channel_id extraído:", channel_id); // Registro añadido

  // Validación del parámetro channel_id
  if (!channel_id) {
    console.error("Error 400: Falta el parámetro 'channel_id'."); // Registro añadido
    return res.status(400).json({ error: "Falta el parámetro 'channel_id' en el body." });
  }
  console.log("channel_id validado:", channel_id); // Registro añadido

  try {
    console.log("Llamando a scrapeChannel con channel_id:", channel_id); // Registro añadido
    const result = await scrapeChannel(channel_id);
    console.log("scrapeChannel completado con éxito."); // Registro añadido
    //console.log("Resultado final a enviar:", JSON.stringify(result, null, 2)); // Descomentar para ver el resultado completo
    return res.json(result);
  } catch (error) {
    console.error("### Error en la ruta /scrape ###"); // Registro de error
    console.error("Mensaje de error:", error.message); // Registro añadido
    // Dependiendo del error, podrías querer enviar un código de estado diferente a 500.
    // Por ejemplo, si el error es 'No se encontró la playlist de uploads.', podrías enviar un 404.
    // Por ahora mantenemos 500 para errores internos generales.
    return res.status(500).json({ error: error.message });
  } finally {
    console.log("### Fin de petición POST a /scrape ###"); // Registro de fin de petición
  }
});

// Inicio del servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
  // console.log(`Clave de API de YouTube en entorno: ${process.env.YT_API_KEY ? 'Configurada' : 'NO CONFIGURADA'}`); // Puedes descomentar esto para verificar en el inicio
  // Nota: Evita loggear la clave de API directamente por seguridad.
});
