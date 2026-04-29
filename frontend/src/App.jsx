import { useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function Icon({ name }) {
  const paths = {
    discover: 'M10 2a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V2zm8 0v6h-6V6h2.59L10 10.59 11.41 12 16 7.41V10h2V2z',
    manage: 'M3 5a2 2 0 0 1 2-2h3v2H5v3H3V5zm13-2h3a2 2 0 0 1 2 2v3h-2V5h-3V3zM3 16h2v3h3v2H5a2 2 0 0 1-2-2v-3zm16 0h2v3a2 2 0 0 1-2 2h-3v-2h3v-3zM8 8h8v8H8V8z',
    driver: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-2H7v2H5v-6zm2.2-4L6.4 11h11.2l-.8-4H7.2zM8.5 13.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 1 0 20 14.5z',
    sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m12.95 6.95 1.41 1.41M3.64 3.64 5.05 5.05m11.9 0 1.41-1.41M3.64 20.36l1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    rtl: 'M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z',
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [message, setMessage] = useState('Welcome to TREMPIST')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('discover')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [isRtl, setIsRtl] = useState(localStorage.getItem('rtl') === '1')
  const [auth, setAuth] = useState({ name: '', phone: '', email: '', password: '' })
  const [login, setLogin] = useState({ email: '', password: '' })
  const [ride, setRide] = useState({ origin: '', destination: '', departure_time: '', seats_total: 1 })
  const [search, setSearch] = useState({ origin: '', destination: '' })
  const [me, setMe] = useState(null)
  const [rides, setRides] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [driverPending, setDriverPending] = useState([])

  const headers = useMemo(() => {
    if (!token) return { 'Content-Type': 'application/json' }
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }, [token])

  const rootClassName = `container theme-${theme} ${isRtl ? 'rtl' : ''}`

  async function withLoading(action) {
    setLoading(true)
    try {
      await action()
    } finally {
      setLoading(false)
    }
  }

  async function callApi(path, method = 'GET', body = null, useAuth = false) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: useAuth ? headers : { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = data?.detail?.message || data?.detail || 'Request failed'
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    }
    return data
  }

  async function registerSubmit(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        const data = await callApi('/auth/register', 'POST', auth)
        localStorage.setItem('token', data.token)
        setToken(data.token)
        setMessage('Registered successfully')
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loginSubmit(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        const data = await callApi('/auth/login', 'POST', login)
        localStorage.setItem('token', data.token)
        setToken(data.token)
        setMessage('Logged in')
        await loadProfile()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadProfile() {
    try {
      const data = await callApi('/users/me', 'GET', null, true)
      setMe(data)
      setMessage('Profile loaded')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function publishRide(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        const payload = {
          ...ride,
          departure_time: new Date(ride.departure_time).toISOString(),
          seats_total: Number(ride.seats_total),
        }
        await callApi('/rides', 'POST', payload, true)
        setMessage('Ride published')
        setRide({ origin: '', destination: '', departure_time: '', seats_total: 1 })
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function searchRides(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        const data = await callApi('/rides/search', 'POST', search)
        setRides(data)
        setMessage(`Found ${data.length} rides`)
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function requestRide(rideId) {
    await withLoading(async () => {
      try {
        const data = await callApi('/matches/request', 'POST', { ride_id: rideId }, true)
        setMessage(`Match requested (id ${data.match_id})`)
        await loadMyRequests()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadMyRequests() {
    await withLoading(async () => {
      try {
        const data = await callApi('/matches/my-requests', 'GET', null, true)
        setMyRequests(data)
        setMessage('Loaded my match requests')
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadDriverPending() {
    await withLoading(async () => {
      try {
        const data = await callApi('/matches/driver-pending', 'GET', null, true)
        setDriverPending(data)
        setMessage('Loaded pending requests for my rides')
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function confirmMatch(matchId) {
    await withLoading(async () => {
      try {
        await callApi('/matches/confirm', 'POST', { match_id: matchId }, true)
        setMessage(`Match ${matchId} confirmed`)
        await loadDriverPending()
        await loadProfile()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  function logout() {
    localStorage.removeItem('token')
    setToken('')
    setMe(null)
    setMyRequests([])
    setDriverPending([])
    setMessage('Logged out')
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  function toggleRtl() {
    const next = !isRtl
    setIsRtl(next)
    localStorage.setItem('rtl', next ? '1' : '0')
  }

  const stats = {
    ridesFound: rides.length,
    myRequests: myRequests.length,
    pendingApprovals: driverPending.length,
  }

  return (
    <main className={rootClassName} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="hero">
        <div>
          <h1>TREMPIST</h1>
          <p className="sub">Community rides powered by credits</p>
          <p className="api">API: {API_BASE_URL}</p>
        </div>
        <div className="statusWrap controls">
          <button type="button" className="iconBtn ghost" onClick={toggleTheme}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="iconBtn ghost" onClick={toggleRtl}>
            <Icon name="rtl" />
            RTL
          </button>
          <span className={`status ${token ? 'ok' : 'off'}`}>{token ? 'Connected' : 'Guest'}</span>
          <span className={`status ${loading ? 'busy' : 'ok'}`}>{loading ? 'Loading' : 'Ready'}</span>
        </div>
      </header>
      {message ? <p className="message">{message}</p> : null}

      <section className="card statsBar">
        <div className="stat">
          <span>Rides Found</span>
          <strong>{stats.ridesFound}</strong>
        </div>
        <div className="stat">
          <span>My Requests</span>
          <strong>{stats.myRequests}</strong>
        </div>
        <div className="stat">
          <span>Pending Approvals</span>
          <strong>{stats.pendingApprovals}</strong>
        </div>
      </section>

      <section className="card tabs">
        <button className={activeTab === 'discover' ? 'tab active' : 'tab'} onClick={() => setActiveTab('discover')} type="button">
          <Icon name="discover" />
          Discover
        </button>
        <button className={activeTab === 'manage' ? 'tab active' : 'tab'} onClick={() => setActiveTab('manage')} type="button">
          <Icon name="manage" />
          Manage
        </button>
        <button className={activeTab === 'driver' ? 'tab active' : 'tab'} onClick={() => setActiveTab('driver')} type="button">
          <Icon name="driver" />
          Driver
        </button>
      </section>

      <section className="card">
        <h2>Auth</h2>
        <div className="grid">
          <form onSubmit={registerSubmit}>
            <h3>Register</h3>
            <input placeholder="Name" value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })} required />
            <input placeholder="Phone" value={auth.phone} onChange={(e) => setAuth({ ...auth, phone: e.target.value })} required />
            <input type="email" placeholder="Email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} required />
            <input type="password" placeholder="Password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} required />
            <button type="submit" disabled={loading}>Register</button>
          </form>

          <form onSubmit={loginSubmit}>
            <h3>Login</h3>
            <input type="email" placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required />
            <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
            <button type="submit" disabled={loading}>Login</button>
            <button type="button" onClick={logout} disabled={loading}>Logout</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Profile</h2>
        <button onClick={() => withLoading(loadProfile)} disabled={!token || loading}>Load My Profile</button>
        {me ? (
          <div className="profileGrid">
            <div className="pill"><span>Name</span><strong>{me.name}</strong></div>
            <div className="pill"><span>Email</span><strong>{me.email}</strong></div>
            <div className="pill"><span>Credits</span><strong>{me.credits}</strong></div>
            <div className="pill"><span>Rating</span><strong>{me.rating_avg}</strong></div>
          </div>
        ) : null}
      </section>

      {activeTab === 'discover' ? (
        <>
          <section className="card">
            <h2>Search Rides</h2>
            <form onSubmit={searchRides}>
              <input placeholder="Origin" value={search.origin} onChange={(e) => setSearch({ ...search, origin: e.target.value })} required />
              <input placeholder="Destination" value={search.destination} onChange={(e) => setSearch({ ...search, destination: e.target.value })} required />
              <button type="submit" disabled={loading}>Search</button>
            </form>
            <ul className="results">
              {rides.map((item) => (
                <li key={item.id}>
                  <div className="rideBlock">
                    <strong>#{item.id}</strong>
                    <div className="routeRow">
                      <span className="routeChip">{item.origin}</span>
                      <span className="routeArrow">to</span>
                      <span className="routeChip">{item.destination}</span>
                    </div>
                    <div className="meta">Seats available: {item.seats_available}</div>
                  </div>
                  <button type="button" onClick={() => requestRide(item.id)} disabled={!token || loading}>
                    Request Match
                  </button>
                </li>
              ))}
            </ul>
            {!rides.length ? <p className="empty">No rides yet. Search by origin and destination.</p> : null}
          </section>
        </>
      ) : null}

      {activeTab === 'manage' ? (
        <>
          <section className="card">
            <h2>Publish Ride</h2>
            <form onSubmit={publishRide}>
              <input placeholder="Origin" value={ride.origin} onChange={(e) => setRide({ ...ride, origin: e.target.value })} required />
              <input placeholder="Destination" value={ride.destination} onChange={(e) => setRide({ ...ride, destination: e.target.value })} required />
              <input type="datetime-local" value={ride.departure_time} onChange={(e) => setRide({ ...ride, departure_time: e.target.value })} required />
              <input type="number" min="1" max="8" value={ride.seats_total} onChange={(e) => setRide({ ...ride, seats_total: e.target.value })} required />
              <button type="submit" disabled={!token || loading}>Publish</button>
            </form>
          </section>

          <section className="card">
            <h2>My Match Requests</h2>
            <button onClick={loadMyRequests} disabled={!token || loading}>Load My Requests</button>
            <ul className="results">
              {myRequests.map((item) => (
                <li key={item.match_id}>
                  <div>
                    <strong>Match #{item.match_id}</strong> for ride #{item.ride_id}
                    <div className="meta">Driver confirmed: {item.confirmed_by_driver ? 'Yes' : 'No'}</div>
                  </div>
                </li>
              ))}
            </ul>
            {!myRequests.length ? <p className="empty">No match requests yet.</p> : null}
          </section>
        </>
      ) : null}

      {activeTab === 'driver' ? (
        <section className="card">
          <h2>Driver Pending Requests</h2>
          <button onClick={loadDriverPending} disabled={!token || loading}>Load Pending</button>
          <ul className="results">
            {driverPending.map((item) => (
              <li key={item.match_id}>
                <div>
                  <strong>Match #{item.match_id}</strong> for ride #{item.ride_id}
                  <div className="meta">Passenger #{item.passenger_id}</div>
                </div>
                <button type="button" onClick={() => confirmMatch(item.match_id)} disabled={loading}>
                  Confirm
                </button>
              </li>
            ))}
          </ul>
          {!driverPending.length ? <p className="empty">No pending approvals.</p> : null}
        </section>
      ) : null}
    </main>
  )
}

export default App
