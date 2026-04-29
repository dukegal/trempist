import { useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [message, setMessage] = useState('')
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
    try {
      const data = await callApi('/auth/register', 'POST', auth)
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setMessage('Registered successfully')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function loginSubmit(event) {
    event.preventDefault()
    try {
      const data = await callApi('/auth/login', 'POST', login)
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setMessage('Logged in')
    } catch (error) {
      setMessage(error.message)
    }
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
    try {
      const payload = {
        ...ride,
        departure_time: new Date(ride.departure_time).toISOString(),
        seats_total: Number(ride.seats_total),
      }
      await callApi('/rides', 'POST', payload, true)
      setMessage('Ride published')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function searchRides(event) {
    event.preventDefault()
    try {
      const data = await callApi('/rides/search', 'POST', search)
      setRides(data)
      setMessage(`Found ${data.length} rides`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function requestRide(rideId) {
    try {
      const data = await callApi('/matches/request', 'POST', { ride_id: rideId }, true)
      setMessage(`Match requested (id ${data.match_id})`)
      await loadMyRequests()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function loadMyRequests() {
    try {
      const data = await callApi('/matches/my-requests', 'GET', null, true)
      setMyRequests(data)
      setMessage('Loaded my match requests')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function loadDriverPending() {
    try {
      const data = await callApi('/matches/driver-pending', 'GET', null, true)
      setDriverPending(data)
      setMessage('Loaded pending requests for my rides')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function confirmMatch(matchId) {
    try {
      await callApi('/matches/confirm', 'POST', { match_id: matchId }, true)
      setMessage(`Match ${matchId} confirmed`)
      await loadDriverPending()
      await loadProfile()
    } catch (error) {
      setMessage(error.message)
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setToken('')
    setMe(null)
    setMessage('Logged out')
  }

  return (
    <main className="container">
      <h1>TREMPIST Frontend MVP</h1>
      <p className="sub">API: {API_BASE_URL}</p>
      {message ? <p className="message">{message}</p> : null}

      <section className="card">
        <h2>Auth</h2>
        <div className="grid">
          <form onSubmit={registerSubmit}>
            <h3>Register</h3>
            <input placeholder="Name" value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })} required />
            <input placeholder="Phone" value={auth.phone} onChange={(e) => setAuth({ ...auth, phone: e.target.value })} required />
            <input type="email" placeholder="Email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} required />
            <input type="password" placeholder="Password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} required />
            <button type="submit">Register</button>
          </form>

          <form onSubmit={loginSubmit}>
            <h3>Login</h3>
            <input type="email" placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required />
            <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
            <button type="submit">Login</button>
            <button type="button" onClick={logout}>Logout</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Profile</h2>
        <button onClick={loadProfile} disabled={!token}>Load My Profile</button>
        {me ? (
          <div className="profile">
            <p>Name: {me.name}</p>
            <p>Email: {me.email}</p>
            <p>Credits: {me.credits}</p>
            <p>Rating: {me.rating_avg}</p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Publish Ride</h2>
        <form onSubmit={publishRide}>
          <input placeholder="Origin" value={ride.origin} onChange={(e) => setRide({ ...ride, origin: e.target.value })} required />
          <input placeholder="Destination" value={ride.destination} onChange={(e) => setRide({ ...ride, destination: e.target.value })} required />
          <input type="datetime-local" value={ride.departure_time} onChange={(e) => setRide({ ...ride, departure_time: e.target.value })} required />
          <input type="number" min="1" max="8" value={ride.seats_total} onChange={(e) => setRide({ ...ride, seats_total: e.target.value })} required />
          <button type="submit" disabled={!token}>Publish</button>
        </form>
      </section>

      <section className="card">
        <h2>Search Rides</h2>
        <form onSubmit={searchRides}>
          <input placeholder="Origin" value={search.origin} onChange={(e) => setSearch({ ...search, origin: e.target.value })} required />
          <input placeholder="Destination" value={search.destination} onChange={(e) => setSearch({ ...search, destination: e.target.value })} required />
          <button type="submit">Search</button>
        </form>
        <ul className="results">
          {rides.map((item) => (
            <li key={item.id}>
              #{item.id} | {item.origin} to {item.destination} | seats: {item.seats_available}
              <button type="button" onClick={() => requestRide(item.id)} disabled={!token}>
                Request Match
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>My Match Requests</h2>
        <button onClick={loadMyRequests} disabled={!token}>Load My Requests</button>
        <ul className="results">
          {myRequests.map((item) => (
            <li key={item.match_id}>
              match #{item.match_id} | ride #{item.ride_id} | driver confirmed: {item.confirmed_by_driver ? 'yes' : 'no'}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Driver Pending Requests</h2>
        <button onClick={loadDriverPending} disabled={!token}>Load Pending</button>
        <ul className="results">
          {driverPending.map((item) => (
            <li key={item.match_id}>
              match #{item.match_id} | ride #{item.ride_id} | passenger #{item.passenger_id}
              <button type="button" onClick={() => confirmMatch(item.match_id)}>
                Confirm
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
