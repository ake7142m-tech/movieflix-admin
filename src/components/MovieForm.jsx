import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMovieData } from '../data/MovieDataContext'
import { readPosterFile } from '../utils/image'

const emptyValues = {
  title: '',
  description: '',
  releaseDate: '',
  rating: '',
  categoryId: '',
  poster: null,
}

const MovieForm = ({ initialValues, submitLabel, onSubmit, cancelTo = '/movie-catalog' }) => {
  const { categories } = useMovieData()
  const navigate = useNavigate()
  const [values, setValues] = useState(() => ({
    ...emptyValues,
    ...initialValues,
    rating: initialValues?.rating === undefined || initialValues?.rating === null
      ? ''
      : String(initialValues.rating),
    poster: initialValues?.poster || null,
  }))
  const [errors, setErrors] = useState({})
  const [posterBusy, setPosterBusy] = useState(false)

  const setField = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handlePoster = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setPosterBusy(true)
    try {
      setField('poster', await readPosterFile(file))
    } catch (error) {
      setErrors((prev) => ({ ...prev, poster: error.message }))
    } finally {
      setPosterBusy(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    const rating = Number(values.rating)

    if (!values.title.trim()) nextErrors.title = 'A title is required.'
    if (!values.releaseDate) nextErrors.releaseDate = 'Pick a release date.'
    if (!values.categoryId) nextErrors.categoryId = 'Choose a category.'
    if (values.rating === '' || Number.isNaN(rating) || rating < 0 || rating > 10) {
      nextErrors.rating = 'Enter a rating from 0 to 10.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      releaseDate: values.releaseDate,
      rating: Math.round(rating * 10) / 10,
      categoryId: values.categoryId,
      poster: values.poster || null,
    })
  }

  return (
    <form className="panel movie-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="field">
          <span>Title *</span>
          <input
            type="text"
            value={values.title}
            placeholder="e.g. Neon Horizon"
            onChange={(event) => setField('title', event.target.value)}
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title && <small className="field-error">{errors.title}</small>}
        </label>

        <label className="field">
          <span>Release date *</span>
          <input
            type="date"
            value={values.releaseDate}
            onChange={(event) => setField('releaseDate', event.target.value)}
            aria-invalid={Boolean(errors.releaseDate)}
          />
          {errors.releaseDate && <small className="field-error">{errors.releaseDate}</small>}
        </label>

        <label className="field">
          <span>Category *</span>
          <select
            value={values.categoryId}
            onChange={(event) => setField('categoryId', event.target.value)}
            aria-invalid={Boolean(errors.categoryId)}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <small className="field-error">{errors.categoryId}</small>}
        </label>

        <label className="field">
          <span>Rating (0–10) *</span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={values.rating}
            placeholder="7.5"
            onChange={(event) => setField('rating', event.target.value)}
            aria-invalid={Boolean(errors.rating)}
          />
          {errors.rating && <small className="field-error">{errors.rating}</small>}
        </label>

        <label className="field field-wide">
          <span>Description</span>
          <textarea
            rows="4"
            value={values.description}
            placeholder="What is this movie about?"
            onChange={(event) => setField('description', event.target.value)}
          />
        </label>

        <div className="field field-wide">
          <span>Poster image</span>
          <div className="poster-field">
            <div className="poster-preview">
              {values.poster ? (
                <img src={values.poster} alt="Poster preview" />
              ) : (
                <span aria-hidden="true">🎬</span>
              )}
            </div>
            <div className="poster-controls">
              <label className="btn btn-ghost btn-sm file-button">
                {posterBusy ? 'Processing…' : values.poster ? 'Replace image' : 'Upload image'}
                <input type="file" accept="image/*" onChange={handlePoster} disabled={posterBusy} />
              </label>
              {values.poster && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setField('poster', null)}
                >
                  Remove
                </button>
              )}
              <small className="muted">
                JPG or PNG. Images are resized and saved with this browser&apos;s catalog data.
              </small>
              {errors.poster && <small className="field-error">{errors.poster}</small>}
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(cancelTo)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={posterBusy}>
          {submitLabel}
        </button>
      </div>

      {categories.length === 0 && (
        <p className="muted">
          You need a category before saving. <Link to="/categories">Add one first.</Link>
        </p>
      )}
    </form>
  )
}

export default MovieForm
