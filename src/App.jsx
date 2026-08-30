import React, { useState } from 'react'
import M3UPlayer from './components/M3UPlayer'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🎬 Movieflix Admin</h1>
        <p>M3U Playlist Player</p>
      </header>
      <main className="app-main">
        <M3UPlayer />
      </main>
    </div>
  )
}

export default App
