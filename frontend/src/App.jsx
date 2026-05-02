import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function Icon({ name }) {
  const paths = {
    discover: 'M10 2a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V2zm8 0v6h-6V6h2.59L10 10.59 11.41 12 16 7.41V10h2V2z',
    manage: 'M3 5a2 2 0 0 1 2-2h3v2H5v3H3V5zm13-2h3a2 2 0 0 1 2 2v3h-2V5h-3V3zM3 16h2v3h3v2H5a2 2 0 0 1-2-2v-3zm16 0h2v3a2 2 0 0 1-2 2h-3v-2h3v-3zM8 8h8v8H8V8z',
    driver: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-2H7v2H5v-6zm2.2-4L6.4 11h11.2l-.8-4H7.2zM8.5 13.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 1 0 20 14.5z',
    sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m12.95 6.95 1.41 1.41M3.64 3.64 5.05 5.05m11.9 0 1.41-1.41M3.64 20.36l1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    rtl: 'M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z',
    user: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z',
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function useGoogleMaps(apiKey) {
  const [loaded, setLoaded] = useState(Boolean(window.google?.maps?.places))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!apiKey) return
    if (window.google?.maps?.places) {
      setLoaded(true)
      return
    }
    const scriptId = 'google-maps-script'
    const existing = document.getElementById(scriptId)
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true))
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => setLoaded(true)
    script.onerror = () => setError('Google Maps failed to load. Check API key and domain restrictions.')
    document.body.appendChild(script)
  }, [apiKey])
  return { loaded, error }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [message, setMessage] = useState('Welcome to TREMPIST')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('discover')
  const [authMode, setAuthMode] = useState('login')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [isRtl, setIsRtl] = useState(localStorage.getItem('rtl') === '1')
  const [menuOpen, setMenuOpen] = useState(false)
  const [auth, setAuth] = useState({ name: '', phone: '', email: '', password: '' })
  const [login, setLogin] = useState({ email: '', password: '' })
  const [ride, setRide] = useState({ origin: '', destination: '', departure_time: '', seats_total: 1 })
  const [search, setSearch] = useState({ origin: '', destination: '' })
  const [rideCoords, setRideCoords] = useState({ origin: null, destination: null })
  const [searchCoords, setSearchCoords] = useState({ origin: null, destination: null })
  const [me, setMe] = useState(null)
  const [rides, setRides] = useState([])
  const [driverRides, setDriverRides] = useState([])
  const [selectedDriverId, setSelectedDriverId] = useState(null)
  const [myRequests, setMyRequests] = useState([])
  const [driverPending, setDriverPending] = useState([])
  const [myPublishedRides, setMyPublishedRides] = useState([])

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMaps(mapsApiKey)
  const searchOriginRef = useRef(null)
  const searchDestinationRef = useRef(null)
  const rideOriginRef = useRef(null)
  const rideDestinationRef = useRef(null)
  const searchMapRef = useRef(null)
  const rideMapRef = useRef(null)
  const searchMapInstance = useRef(null)
  const rideMapInstance = useRef(null)
  const searchMarkers = useRef({ origin: null, destination: null })
  const rideMarkers = useRef({ origin: null, destination: null })
  const searchDirectionsRenderer = useRef(null)
  const rideDirectionsRenderer = useRef(null)
  const searchDirectionsService = useRef(null)
  const rideDirectionsService = useRef(null)

  const headers = useMemo(() => {
    if (!token) return { 'Content-Type': 'application/json' }
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }, [token])

  const rootClassName = `container theme-${theme} ${isRtl ? 'rtl' : ''}`
  const stats = {
    ridesFound: rides.length,
    myRequests: myRequests.length,
    pendingApprovals: driverPending.length,
  }

  function mapDefaults() {
    return { center: { lat: 32.0853, lng: 34.7818 }, zoom: 9, mapTypeControl: false, streetViewControl: false, fullscreenControl: false }
  }

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

  function bindAutocomplete(inputEl, onSelect, extraOptions = null) {
    if (!mapsLoaded || !inputEl || inputEl.dataset.autocompleteBound === '1') return
    const base = { fields: ['formatted_address', 'geometry'] }
    const opts = extraOptions ? { ...base, ...extraOptions } : { ...base, types: ['address'] }
    const autocomplete = new window.google.maps.places.Autocomplete(inputEl, opts)
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place?.geometry?.location) return
      onSelect(place.formatted_address || inputEl.value, {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
    inputEl.dataset.autocompleteBound = '1'
  }

  function applyMarkers(map, markerStore, coords) {
    if (!map || !window.google?.maps) return
    ;['origin', 'destination'].forEach((key) => {
      const point = coords[key]
      if (!point) {
        if (markerStore.current[key]) {
          markerStore.current[key].setMap(null)
          markerStore.current[key] = null
        }
        return
      }
      if (!markerStore.current[key]) {
        markerStore.current[key] = new window.google.maps.Marker({ map, position: point, label: key === 'origin' ? 'A' : 'B' })
      } else {
        markerStore.current[key].setPosition(point)
      }
    })
  }

  function drawRoute(map, directionsServiceRef, directionsRendererRef, coords) {
    if (!map || !coords.origin || !coords.destination || !window.google?.maps) {
      if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] })
      return
    }
    if (!directionsServiceRef.current) directionsServiceRef.current = new window.google.maps.DirectionsService()
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#1d4ed8', strokeWeight: 5, strokeOpacity: 0.8 },
      })
    }
    directionsServiceRef.current.route(
      {
        origin: coords.origin,
        destination: coords.destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRendererRef.current.setDirections(result)
        } else if (status && status !== 'OK') {
          setMessage(`Route draw failed (${status}). Verify Directions API is enabled.`)
        }
      },
    )
  }

  useEffect(() => {
    if (!mapsLoaded) return
    bindAutocomplete(
      searchOriginRef.current,
      (address, coords) => {
        setSearch((prev) => ({ ...prev, origin: address }))
        setSearchCoords((prev) => ({ ...prev, origin: coords }))
      },
      { types: ['geocode'] },
    )
    bindAutocomplete(
      searchDestinationRef.current,
      (address, coords) => {
        setSearch((prev) => ({ ...prev, destination: address }))
        setSearchCoords((prev) => ({ ...prev, destination: coords }))
      },
      { types: ['geocode'] },
    )
    bindAutocomplete(rideOriginRef.current, (address, coords) => {
      setRide((prev) => ({ ...prev, origin: address }))
      setRideCoords((prev) => ({ ...prev, origin: coords }))
    })
    bindAutocomplete(rideDestinationRef.current, (address, coords) => {
      setRide((prev) => ({ ...prev, destination: address }))
      setRideCoords((prev) => ({ ...prev, destination: coords }))
    })
  }, [mapsLoaded, activeTab])

  useEffect(() => {
    if (!mapsLoaded || !searchMapRef.current || activeTab !== 'discover') return
    if (!searchMapInstance.current) searchMapInstance.current = new window.google.maps.Map(searchMapRef.current, mapDefaults())
    window.google.maps.event.trigger(searchMapInstance.current, 'resize')
    applyMarkers(searchMapInstance.current, searchMarkers, searchCoords)
    drawRoute(searchMapInstance.current, searchDirectionsService, searchDirectionsRenderer, searchCoords)
  }, [mapsLoaded, activeTab, searchCoords])

  useEffect(() => {
    if (!mapsLoaded || !rideMapRef.current || activeTab !== 'manage') return
    if (!rideMapInstance.current) rideMapInstance.current = new window.google.maps.Map(rideMapRef.current, mapDefaults())
    window.google.maps.event.trigger(rideMapInstance.current, 'resize')
    applyMarkers(rideMapInstance.current, rideMarkers, rideCoords)
    drawRoute(rideMapInstance.current, rideDirectionsService, rideDirectionsRenderer, rideCoords)
  }, [mapsLoaded, activeTab, rideCoords])

  async function registerSubmit(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        await callApi('/auth/register', 'POST', auth)
        setAuth({ name: '', phone: '', email: '', password: '' })
        setAuthMode('login')
        setMessage('Registered successfully. Please login.')
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
        await loadMyPublishedRides()
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
        const payload = { ...ride, departure_time: new Date(ride.departure_time).toISOString(), seats_total: Number(ride.seats_total) }
        await callApi('/rides', 'POST', payload, true)
        setMessage('Ride published')
        setRide({ origin: '', destination: '', departure_time: '', seats_total: 1 })
        setRideCoords({ origin: null, destination: null })
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function searchRides(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        const payload = {
          origin: search.origin.trim(),
          destination: search.destination.trim(),
        }
        const data = await callApi('/rides/search', 'POST', payload)
        setRides(data)
        setSelectedDriverId(null)
        setDriverRides([])
        setMessage(`Found ${data.length} rides`)
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadUserRides(userId) {
    await withLoading(async () => {
      try {
        const data = await callApi(`/users/${userId}/rides`, 'GET')
        setSelectedDriverId(userId)
        setDriverRides(data)
        setMessage(`Loaded ${data.length} rides for user ${userId}`)
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadMyPublishedRides() {
    await withLoading(async () => {
      try {
        const data = await callApi('/rides/mine', 'GET', null, true)
        setMyPublishedRides(data)
        setMessage(`Loaded ${data.length} rides you published`)
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function deleteMyRide(rideId) {
    if (!window.confirm('Delete this published ride? Pending match requests for it will be removed.')) return
    await withLoading(async () => {
      try {
        await callApi(`/rides/${rideId}`, 'DELETE', null, true)
        setMyPublishedRides((prev) => prev.filter((r) => r.id !== rideId))
        setMessage('Ride deleted')
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
        await callApi('/matches/accept', 'POST', { match_id: matchId }, true)
        setMessage(`Match ${matchId} accepted`)
        await loadDriverPending()
        await loadProfile()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function rejectMatch(matchId) {
    await withLoading(async () => {
      try {
        await callApi('/matches/reject', 'POST', { match_id: matchId }, true)
        setMessage(`Match ${matchId} rejected`)
        await loadDriverPending()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function cancelMatch(matchId) {
    await withLoading(async () => {
      try {
        await callApi('/matches/cancel', 'POST', { match_id: matchId }, true)
        setMessage(`Match ${matchId} cancelled`)
        await loadMyRequests()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  function logout() {
    localStorage.removeItem('token')
    setToken('')
    setMenuOpen(false)
    setMe(null)
    setMyRequests([])
    setDriverPending([])
    setDriverRides([])
    setSelectedDriverId(null)
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

  if (!token) {
    return (
      <main className={rootClassName} dir={isRtl ? 'rtl' : 'ltr'}>
        <section className="authScreen">
          <div className="authCard">
            <h1>TREMPIST</h1>
            <p className="sub">Sign in to access rides, matches, and profile.</p>
            {message ? <p className="message">{message}</p> : null}
            <div className="authSwitch">
              <button type="button" className={authMode === 'login' ? 'tab active' : 'tab'} onClick={() => setAuthMode('login')}>Login</button>
              <button type="button" className={authMode === 'signup' ? 'tab active' : 'tab'} onClick={() => setAuthMode('signup')}>Sign Up</button>
            </div>
            {authMode === 'login' ? (
              <form onSubmit={loginSubmit}>
                <input type="email" placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required />
                <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
                <button type="submit" disabled={loading}>Login</button>
              </form>
            ) : (
              <form onSubmit={registerSubmit}>
                <input placeholder="Name" value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })} required />
                <input placeholder="Phone" value={auth.phone} onChange={(e) => setAuth({ ...auth, phone: e.target.value })} required />
                <input type="email" placeholder="Email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} required />
                <input type="password" placeholder="Password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} required />
                <button type="submit" disabled={loading}>Create Account</button>
              </form>
            )}
          </div>
        </section>
      </main>
    )
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
          <button type="button" className="iconBtn ghost" onClick={toggleTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} />{theme === 'light' ? 'Dark' : 'Light'}</button>
          <button type="button" className="iconBtn ghost" onClick={toggleRtl}><Icon name="rtl" />RTL</button>
          <div className="profileMenuWrap">
            <button type="button" className="iconBtn ghost iconOnly" onClick={() => setMenuOpen((prev) => !prev)}><Icon name="user" /></button>
            {menuOpen ? (
              <div className="profileMenu">
                <button type="button" className="menuItem" onClick={() => withLoading(loadProfile)}>My Profile</button>
                {me ? <div className="menuMeta">{me.name} | Credits: {me.credits}</div> : null}
                <button type="button" className="menuItem danger" onClick={logout}>Logout</button>
              </div>
            ) : null}
          </div>
          <span className={`status ${token ? 'ok' : 'off'}`}>{token ? 'Connected' : 'Guest'}</span>
          <span className={`status ${loading ? 'busy' : 'ok'}`}>{loading ? 'Loading' : 'Ready'}</span>
        </div>
      </header>

      {message ? <p className="message">{message}</p> : null}

      <section className="card statsBar">
        <div className="stat"><span>Rides Found</span><strong>{stats.ridesFound}</strong></div>
        <div className="stat"><span>My Requests</span><strong>{stats.myRequests}</strong></div>
        <div className="stat"><span>Pending Approvals</span><strong>{stats.pendingApprovals}</strong></div>
      </section>

      <section className="card tabs">
        <button className={activeTab === 'discover' ? 'tab active' : 'tab'} onClick={() => setActiveTab('discover')} type="button"><Icon name="discover" />Discover</button>
        <button className={activeTab === 'manage' ? 'tab active' : 'tab'} onClick={() => setActiveTab('manage')} type="button"><Icon name="manage" />Manage</button>
        <button className={activeTab === 'driver' ? 'tab active' : 'tab'} onClick={() => setActiveTab('driver')} type="button"><Icon name="driver" />Driver</button>
      </section>

      {me ? (
        <section className="card">
          <h2>Profile Snapshot</h2>
          <div className="profileGrid">
            <div className="pill"><span>Name</span><strong>{me.name}</strong></div>
            <div className="pill"><span>Email</span><strong>{me.email}</strong></div>
            <div className="pill"><span>Credits</span><strong>{me.credits}</strong></div>
            <div className="pill"><span>Rating</span><strong>{me.rating_avg}</strong></div>
          </div>
        </section>
      ) : null}

      {activeTab === 'discover' ? (
        <section className="card">
          <h2>Search Rides</h2>
          <form onSubmit={searchRides}>
            <input ref={searchOriginRef} placeholder={mapsLoaded ? 'Origin: city or full address' : 'Origin'} value={search.origin} onChange={(e) => { setSearch({ ...search, origin: e.target.value }); setSearchCoords((prev) => ({ ...prev, origin: null })) }} required />
            <input ref={searchDestinationRef} placeholder={mapsLoaded ? 'Destination, Any, or leave blank' : 'Destination or Any'} value={search.destination} onChange={(e) => { setSearch({ ...search, destination: e.target.value }); setSearchCoords((prev) => ({ ...prev, destination: null })) }} />
            <button type="submit" disabled={loading}>Search</button>
          </form>
          <p className="empty" style={{ marginTop: '0.5rem' }}>You can type only a city name. For destination, leave empty or type <strong>Any</strong> to see rides to all destinations.</p>
          <div className="mapWrap">
            {!mapsApiKey ? <p className="empty">Add `VITE_GOOGLE_MAPS_API_KEY` to enable map and autocomplete.</p> : null}
            {mapsError ? <p className="empty">{mapsError}</p> : null}
            <div ref={searchMapRef} className="mapCanvas" />
          </div>
          <ul className="results">
            {rides.map((item) => (
              <li key={item.id}>
                <div className="rideBlock">
                  <strong>#{item.id}</strong>
                  <div className="routeRow"><span className="routeChip">{item.origin}</span><span className="routeArrow">to</span><span className="routeChip">{item.destination}</span></div>
                  <div className="meta">Seats available: {item.seats_available} | Driver: #{item.driver_id}</div>
                </div>
                <div className="actionCol">
                  <button type="button" onClick={() => requestRide(item.id)} disabled={!token || loading}>Request Match</button>
                  <button type="button" className="ghost" onClick={() => loadUserRides(item.driver_id)} disabled={loading}>View Driver Rides</button>
                </div>
              </li>
            ))}
          </ul>
            {!rides.length ? <p className="empty">No rides yet. Search by origin; destination is optional.</p> : null}

          {selectedDriverId ? (
            <section className="subCard">
              <h3>Published rides by user #{selectedDriverId}</h3>
              <ul className="results compact">
                {driverRides.map((item) => (
                  <li key={`driver-${item.id}`}>
                    <div className="rideBlock">
                      <strong>#{item.id}</strong>
                      <div className="routeRow"><span className="routeChip">{item.origin}</span><span className="routeArrow">to</span><span className="routeChip">{item.destination}</span></div>
                      <div className="meta">Seats: {item.seats_available} / {item.seats_total}</div>
                    </div>
                  </li>
                ))}
              </ul>
              {!driverRides.length ? <p className="empty">No rides published by this user.</p> : null}
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'manage' ? (
        <>
          <section className="card">
            <h2>Publish Ride</h2>
            <form onSubmit={publishRide}>
              <input ref={rideOriginRef} placeholder={mapsLoaded ? 'Origin (autocomplete enabled)' : 'Origin'} value={ride.origin} onChange={(e) => { setRide({ ...ride, origin: e.target.value }); setRideCoords((prev) => ({ ...prev, origin: null })) }} required />
              <input ref={rideDestinationRef} placeholder={mapsLoaded ? 'Destination (autocomplete enabled)' : 'Destination'} value={ride.destination} onChange={(e) => { setRide({ ...ride, destination: e.target.value }); setRideCoords((prev) => ({ ...prev, destination: null })) }} required />
              <input type="datetime-local" value={ride.departure_time} onChange={(e) => setRide({ ...ride, departure_time: e.target.value })} required />
              <input type="number" min="1" max="8" value={ride.seats_total} onChange={(e) => setRide({ ...ride, seats_total: e.target.value })} required />
              <button type="submit" disabled={!token || loading}>Publish</button>
            </form>
            <div className="mapWrap">
              {!mapsApiKey ? <p className="empty">Add `VITE_GOOGLE_MAPS_API_KEY` to enable map and autocomplete.</p> : null}
              {mapsError ? <p className="empty">{mapsError}</p> : null}
              <div ref={rideMapRef} className="mapCanvas" />
            </div>
          </section>
          <section className="card">
            <h2>My Published Rides</h2>
            <button onClick={loadMyPublishedRides} disabled={!token || loading}>Load My Rides</button>
            <ul className="results compact">
              {myPublishedRides.map((item) => (
                <li key={`mine-${item.id}`}>
                  <div className="rideBlock">
                    <strong>#{item.id}</strong>
                    <div className="routeRow"><span className="routeChip">{item.origin}</span><span className="routeArrow">to</span><span className="routeChip">{item.destination}</span></div>
                    <div className="meta">Seats: {item.seats_available} / {item.seats_total}</div>
                  </div>
                  <div className="actionCol">
                    <button type="button" className="ghost" onClick={() => deleteMyRide(item.id)} disabled={!token || loading}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
            {!myPublishedRides.length ? <p className="empty">No rides published by you yet.</p> : null}
          </section>
          <section className="card">
            <h2>My Match Requests</h2>
            <button onClick={loadMyRequests} disabled={!token || loading}>Load My Requests</button>
            <ul className="results">
              {myRequests.map((item) => (
                <li key={item.match_id}>
                  <div><strong>Match #{item.match_id}</strong> for ride #{item.ride_id}<div className="meta">Status: {item.status}</div></div>
                  {(item.status === 'PENDING' || item.status === 'ACCEPTED') ? (
                    <button type="button" className="ghost" onClick={() => cancelMatch(item.match_id)} disabled={loading}>Cancel</button>
                  ) : null}
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
                <div><strong>Match #{item.match_id}</strong> for ride #{item.ride_id}<div className="meta">Passenger #{item.passenger_id}</div></div>
                <div className="actionCol">
                  <button type="button" onClick={() => confirmMatch(item.match_id)} disabled={loading}>Accept</button>
                  <button type="button" className="ghost" onClick={() => rejectMatch(item.match_id)} disabled={loading}>Reject</button>
                </div>
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
