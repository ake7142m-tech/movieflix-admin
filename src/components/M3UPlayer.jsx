import React, { useRef, useEffect, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import '../styles/M3UPlayer.css'

const M3UPlayer = () => {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [playlist, setPlaylist] = useState([])
  const [currentTrack, setCurrentTrack] = useState(0)
  const [m3uUrl, setM3uUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (videoRef.current && !playerRef.current) {
      playerRef.current = videojs(videoRef.current, {
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: true,
        responsive: true,
        plugins: {},
      })
    }

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [])

  const parsM3U = (content) => {
    const lines = content.split('\n')
    const tracks = []
    let currentTrack = {}

    for (let line of lines) {
      line = line.trim()

      if (line.startsWith('#EXTINF:')) {
        const titleMatch = line.match(/,(.+)$/)
        currentTrack = {
          title: titleMatch ? titleMatch[1] : 'Unknown',
          duration: parseInt(line.split(',')[0].replace('#EXTINF:', '').split(' ')[0]) || 0,
        }
      } else if (line && !line.startsWith('#') && line !== '') {
        currentTrack.url = line
        tracks.push(currentTrack)
        currentTrack = {}
      }
    }

    return tracks
  }

  const fetchM3U = async (url) => {
    try {
      setLoading(true)
      const response = await fetch(url)
      const content = await response.text()
      const tracks = parsM3U(content)
      setPlaylist(tracks)
      setCurrentTrack(0)

      if (tracks.length > 0) {
        playTrack(tracks[0])
      }
    } catch (error) {
      console.error('Error fetching M3U:', error)
      alert('ไม่สามารถโหลด M3U ได้: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadM3U = (e) => {
    e.preventDefault()
    if (m3uUrl.trim()) {
      fetchM3U(m3uUrl)
    }
  }

  const playTrack = (track) => {
    if (playerRef.current) {
      playerRef.current.src({ type: 'application/x-mpegURL', src: track.url })
      playerRef.current.play()
    }
  }

  const handlePlayTrack = (index) => {
    setCurrentTrack(index)
    playTrack(playlist[index])
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result
        if (typeof content === 'string') {
          const tracks = parsM3U(content)
          setPlaylist(tracks)
          setCurrentTrack(0)
          if (tracks.length > 0) {
            playTrack(tracks[0])
          }
        }
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="m3u-player-container">
      <div className="player-section">
        <video
          ref={videoRef}
          className="video-js vjs-default-skin vjs-big-play-centered"
          controls
          preload="auto"
        />
      </div>

      <div className="controls-section">
        <div className="input-group">
          <input
            type="text"
            placeholder="URL ของไฟล์ M3U (เช่น: http://example.com/playlist.m3u)"
            value={m3uUrl}
            onChange={(e) => setM3uUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLoadM3U(e)}
          />
          <button onClick={handleLoadM3U} disabled={loading}>
            {loading ? 'กำลังโหลด...' : 'โหลด M3U'}
          </button>
        </div>

        <div className="file-upload">
          <label>หรือเลือกไฟล์ M3U:</label>
          <input
            type="file"
            accept=".m3u,.m3u8"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div className="playlist-section">
        <h3>PlayList ({playlist.length})</h3>
        <div className="playlist">
          {playlist.length === 0 ? (
            <p className="empty-playlist">ยังไม่มี Playlist</p>
          ) : (
            <ul>
              {playlist.map((track, index) => (
                <li
                  key={index}
                  className={currentTrack === index ? 'active' : ''}
                  onClick={() => handlePlayTrack(index)}
                >
                  <span className="track-number">{index + 1}</span>
                  <span className="track-title">{track.title}</span>
                  <span className="track-duration">
                    {track.duration > 0 ? formatDuration(track.duration) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export default M3UPlayer
