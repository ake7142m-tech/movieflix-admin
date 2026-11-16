import React from 'react'
import PageHeader from '../components/PageHeader'
import M3UPlayer from '../components/M3UPlayer'

const PlayerPage = () => (
  <div className="page">
    <PageHeader
      title="M3U Player"
      subtitle="Load an M3U playlist by URL or file and preview the streams."
    />
    <M3UPlayer />
  </div>
)

export default PlayerPage
