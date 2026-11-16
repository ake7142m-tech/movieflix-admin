import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import MovieForm from '../components/MovieForm'
import { useMovieData } from '../data/MovieDataContext'

const AddMovie = () => {
  const { addMovie } = useMovieData()
  const navigate = useNavigate()

  const handleSubmit = (values) => {
    const movie = addMovie(values)
    navigate(`/movie-details/${movie.id}`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Add New Movie"
        subtitle="Add a title, release details, and a poster to the collection."
      />
      <MovieForm submitLabel="Add movie" onSubmit={handleSubmit} />
    </div>
  )
}

export default AddMovie
