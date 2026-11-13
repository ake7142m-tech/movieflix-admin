import { useEffect, useState } from 'react'
import M3UPlayer from './components/M3UPlayer'
import './App.css'

const AUTH_ENDPOINT = import.meta.env.VITE_AUTH_ENDPOINT

function clearAppData() {
  const prefixes = ['movieflix:', 'movieflix_']

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      keys.filter((key) => key && prefixes.some((prefix) => key.startsWith(prefix)))
        .forEach((key) => storage.removeItem(key))
    } catch {
      // Storage may be disabled by the browser.
    }
  }
}

function App() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    clearAppData()
  }, [])

  const showAlert = (text, type = 'error') => {
    setMessage(text)
    setMessageType(type)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    const cleanUsername = username.trim()

    if (!cleanUsername || !password) {
      showAlert('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน', 'warning')
      return
    }

    if (!AUTH_ENDPOINT) {
      showAlert('ระบบเข้าสู่ระบบยังไม่ได้เชื่อมต่อบริการยืนยันตัวตน กรุณาตั้งค่า VITE_AUTH_ENDPOINT', 'warning')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      })

      if (!response.ok) {
        showAlert(response.status === 401
          ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
          : 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่ภายหลัง')
        setPassword('')
        return
      }

      const result = await response.json()
      setUser(result.user || result)
      setPassword('')
      showAlert('เข้าสู่ระบบสำเร็จ', 'success')
    } catch {
      showAlert('เชื่อมต่อบริการเข้าสู่ระบบไม่ได้ กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    clearAppData()
    setUser(null)
    setUsername('')
    setPassword('')
    setMessage('')
  }

  if (user) {
    return (
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <h1>MOVIEFLIX <span>ADMIN</span></h1>
            <p>ระบบจัดการภาพยนตร์</p>
          </div>
          <div className="user-actions">
            <span className="user-greeting">{user.name || user.username || username}</span>
            <button type="button" className="logout-button" onClick={handleLogout}>ออกจากระบบ</button>
          </div>
        </header>
        <main className="dashboard-content"><M3UPlayer /></main>
      </div>
    )
  }

  return (
    <main className="login-page">
      <div className="login-wrap">
        <header className="brand fade-in">
          <div className="brand-mark" aria-hidden="true">M</div>
          <h1>MOVIEFLIX <span>ADMIN</span></h1>
          <p>ระบบจัดการภาพยนตร์ — เข้าสู่ระบบ</p>
        </header>

        <section className="login-card fade-in" aria-labelledby="login-title">
          <h2 id="login-title" className="visually-hidden">เข้าสู่ระบบ</h2>
          {message && (
            <div className={`alert alert-${messageType}`} role="status" aria-live="polite">
              {message}
            </div>
          )}

          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <div className="input-wrap">
              <span className="field-icon" aria-hidden="true">◉</span>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="กรอกชื่อผู้ใช้"
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="password">รหัสผ่าน</label>
            <div className="input-wrap">
              <span className="field-icon" aria-hidden="true">●</span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>

            <div className="form-options">
              <span>ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบ</span>
            </div>

            <button className="login-button" type="submit" disabled={isLoading}>
              {isLoading ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
              {!isLoading && <span aria-hidden="true"> →</span>}
            </button>
          </form>
        </section>

        <p className="login-footer">การเข้าสู่ระบบใช้บริการยืนยันตัวตนของเซิร์ฟเวอร์ และไม่มีบัญชีทดสอบหรือรหัสผ่านฝังอยู่ในหน้าเว็บ</p>
      </div>
    </main>
  )
}

export default App
