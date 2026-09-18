import React, { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import '../styles/M3UPlayer.css'
import { recordEvent } from '../utils/eventRecorder'

const URL_PROTOCOLS = new Set(['http:', 'https:'])

const parseM3U = (content) => {
  const tracks = []
  let metadata = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      const [durationText, ...titleParts] = line.slice(8).split(',')
      const duration = Number.parseInt(durationText.split(' ')[0], 10)
      metadata = {
        title: titleParts.join(',').trim() || 'Unknown',
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      }
      continue
    }

    if (!line.startsWith('#')) {
      tracks.push({
        title: metadata?.title || line,
        duration: metadata?.duration || 0,
        url: line,
      })
      metadata = null
    }
  }

  return tracks
}

const isSupportedUrl = (value) => {
  try {
    return URL_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`
}

const M3UPlayer = () => {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const abortRef = useRef(null)
  const mountedRef = useRef(true)
  const [playlist, setPlaylist] = useState([])
  const [currentTrack, setCurrentTrack] = useState(-1)
  const [m3uUrl, setM3uUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    mountedRef.current = true
    if (!videoRef.current || playerRef.current) return undefined

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      responsive: true,
    })
    playerRef.current = player

    const playerEvents = ['loadstart', 'play', 'pause', 'ended', 'error']
    const listeners = playerEvents.map((eventName) => {
      const handler = () => {
        const error = eventName === 'error' ? player.error() : null
        recordEvent(`player.${eventName}`, {
          trackIndex: currentTrack,
          error: error?.message || null,
        })
      }
      player.on(eventName, handler)
      return [eventName, handler]
    })

    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      listeners.forEach(([eventName, handler]) => player.off(eventName, handler))
      if (!player.isDisposed()) player.dispose()
      playerRef.current = null
    }
  }, [currentTrack])

  const playTrack = async (track, index) => {
    if (!track || !playerRef.current || !isSupportedUrl(track.url)) {
      setMessage('ลิงก์สตรีมไม่ถูกต้อง')
      recordEvent('track.play.rejected', { index, reason: 'invalid-url' })
      return
    }

    setCurrentTrack(index)
    setMessage('')
    recordEvent('track.selected', { index, title: track.title, url: track.url })
    playerRef.current.src({ type: 'application/x-mpegURL', src: track.url })

    try {
      await playerRef.current.play()
    } catch (error) {
      if (mountedRef.current) setMessage('ไม่สามารถเริ่มเล่นสตรีมได้')
      recordEvent('track.play.failed', { index, message: error.message })
    }
  }

  const loadTracks = async (content, source) => {
    const tracks = parseM3U(content)
    recordEvent('playlist.parsed', { source, trackCount: tracks.length })

    if (!mountedRef.current) return
    setPlaylist(tracks)
    setCurrentTrack(-1)

    if (tracks.length === 0) {
      setMessage('ไม่พบรายการในไฟล์ M3U')
      return
    }

    setMessage(`โหลดรายการแล้ว ${tracks.length} รายการ`)
    await playTrack(tracks[0], 0)
  }

  const fetchM3U = async (url) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setMessage('')
    recordEvent('playlist.load.started', { source: 'url', url })

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await loadTracks(await response.text(), 'url')
      recordEvent('playlist.load.completed', { source: 'url', url })
    } catch (error) {
      if (error.name !== 'AbortError' && mountedRef.current) {
        setMessage('ไม่สามารถโหลด M3U ได้')
        recordEvent('playlist.load.failed', { source: 'url', url, message: error.message })
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const handleLoadM3U = (event) => {
    event.preventDefault()
    const url = m3uUrl.trim()
    if (!isSupportedUrl(url)) {
      setMessage('กรุณาระบุ URL แบบ HTTP หรือ HTTPS')
      recordEvent('playlist.load.rejected', { source: 'url', reason: 'invalid-url' })
      return
    }
    fetchM3U(url)
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    recordEvent('playlist.file.selected', { name: file.name, size: file.size, type: file.type })
    const reader = new FileReader()
    reader.onload = ({ target }) => {
      if (typeof target?.result === 'string') loadTracks(target.result, 'file')
    }
    reader.onerror = () => {
      setMessage('ไม่สามารถอ่านไฟล์ M3U ได้')
      recordEvent('playlist.file.failed', { name: file.name })
    }
    reader.readAsText(file)
  }

  return (
    <div className="m3u-player-container">
      <div className="player-section">
        <video ref={videoRef} className="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" />
      </div>

      <div className="controls-section">
        <form className="input-group" onSubmit={handleLoadM3U}>
          <input
            type="url"
            placeholder="URL ของไฟล์ M3U (เช่น: http://example.com/playlist.m3u)"
            value={m3uUrl}
            onChange={(event) => setM3uUrl(event.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'กำลังโหลด...' : 'โหลด M3U'}
          </button>
        </form>

        <div className="file-upload">
          <label htmlFor="m3u-file">หรือเลือกไฟล์ M3U:</label>
          <input id="m3u-file" type="file" accept=".m3u,.m3u8" onChange={handleFileUpload} />
        </div>
        {message && <p role="status">{message}</p>}
      </div>

      <div className="playlist-section">
        <h3>PlayList ({playlist.length})</h3>
        <div className="playlist">
          {playlist.length === 0 ? <p className="empty-playlist">ยังไม่มี Playlist</p> : (
            <ul>
              {playlist.map((track, index) => (
                <li key={`${track.url}-${index}`} className={currentTrack === index ? 'active' : ''}>
                  <button type="button" onClick={() => playTrack(track, index)}>
                    <span className="track-number">{index + 1}</span>
                    <span className="track-title">{track.title}</span>
                    <span className="track-duration">{track.duration > 0 ? formatDuration(track.duration) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default M3UPlayer
