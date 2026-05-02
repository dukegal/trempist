import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const BRAND = 'TREMPIST'

/** ממשק בעברית */
const he = {
  requestFailed: 'הבקשה נכשלה',
  mapsLoadError: 'טעינת מפות Google נכשלה. בדקו את מפתח ה-API והגבלות הדומיין.',
  welcome: 'ברוכים הבאים',
  authSubtitle: 'התחברו או הירשמו — ותתחילו לשתף טרמפים תוך שניות.',
  authBullet1: 'חיפוש נסיעות לפי מוצא ויעד על המפה',
  authBullet2: 'פרסום מקום פנוי ברכב בקלות',
  authBullet3: 'התאמה מהירה בין נוסעים לנהגים',
  signupLead: 'יצירת חשבון חדש',
  loginLead: 'כניסה לחשבון קיים',
  loginTab: 'התחברות',
  signupTab: 'הרשמה',
  loginBtn: 'התחבר',
  createAccount: 'יצירת חשבון',
  tagline: 'שיתוף טרמפים, ללא תשלום.',
  apiLabel: 'שרת',
  themeDark: 'מצב כהה',
  themeLight: 'מצב בהיר',
  profileMenu: 'הפרופיל שלי',
  creditsShort: 'קרדיט',
  logout: 'התנתקות',
  connected: 'מחובר',
  guest: 'אורח',
  loading: 'טוען',
  ready: 'מוכן',
  ridesFound: 'נסיעות בתוצאות',
  myRequestsStat: 'הבקשות שלי',
  pendingApprovals: 'ממתינים לאישור',
  tabDiscover: 'חפש טרמפ',
  tabManage: 'פרסם טרמפ',
  tabDriver: 'בקשות',
  labelName: 'שם',
  labelEmail: 'אימייל',
  password: 'סיסמה',
  phone: 'טלפון',
  searchRidesTitle: 'חיפוש נסיעות',
  originPh: 'מוצא: עיר או כתובת מלאה',
  originPhShort: 'מוצא',
  destPh: 'יעד, «כל היעדים», או ריק לכל היעדים',
  destPhShort: 'יעד או כל היעדים',
  searchBtn: 'חיפוש',
  searchHint:
    'אפשר להזין רק שם עיר. ביעד השאירו ריק או הזינו «כל» / Any כדי לראות נסיעות לכל היעדים.',
  mapsKeyHint: 'הוסיפו VITE_GOOGLE_MAPS_API_KEY כדי להפעיל מפה והשלמה אוטומטית.',
  routeSep: 'ל',
  seatsAvail: 'מקומות פנויים',
  driver: 'נהג',
  requestMatch: 'בקשת התאמה',
  viewDriverRides: 'נסיעות של הנהג',
  emptyDiscover: 'אין נסיעות עדיין. חפשו לפי מוצא; היעד אופציונלי.',
  driverRidesTitle: 'נסיעות שפורסמו על ידי משתמש מס׳',
  seatsRatio: 'מקומות',
  emptyDriverList: 'אין נסיעות שפורסמו על ידי משתמש זה.',
  publishTitle: 'פרסום נסיעה',
  originPubPh: 'מוצא (השלמה אוטומטית)',
  originPubShort: 'מוצא',
  destPubPh: 'יעד (השלמה אוטומטית)',
  destPubShort: 'יעד',
  publishBtn: 'פרסום',
  myRidesTitle: 'הנסיעות שפרסמתי',
  loadMyRides: 'טען את הנסיעות שלי',
  deleteRide: 'מחק',
  emptyMyRides: 'טרם פרסמת נסיעות.',
  myMatchesTitle: 'בקשות ההתאמה שלי',
  loadMyRequests: 'טען בקשות',
  status: 'סטטוס',
  cancelBtn: 'ביטול',
  emptyRequests: 'אין בקשות התאמה.',
  driverPendingTitle: 'בקשות ממתינות (נהג)',
  loadPending: 'טען ממתינים',
  acceptBtn: 'אשר',
  rejectBtn: 'דחה',
  emptyPending: 'אין בקשות ממתינות לאישור.',
  incomingRequestsTitle: 'בקשות נכנסות לטרמפים שלי',
  noIncomingRequests: 'כרגע אין בקשות נכנסות.',
  deleteConfirm: 'למחוק את הנסיעה? בקשות ההתאמה הממתינות אליה יימחקו.',
  regOk: 'נרשמת בהצלחה. אפשר להתחבר.',
  welcomeAfterRegister: (name) => `שלום ${name}! נרשמת והתחברת בהצלחה.`,
  loggedIn: 'התחברת בהצלחה',
  profileLoaded: 'הפרופיל נטען',
  ridePublished: 'הנסיעה פורסמה',
  foundRides: (n) => `נמצאו ${n} נסיעות`,
  loadedForUser: (n, uid) => `נטענו ${n} נסיעות עבור משתמש מס׳ ${uid}`,
  loadedMyPub: (n) => `נטענו ${n} נסיעות שפרסמת`,
  rideDeleted: 'הנסיעה נמחקה',
  matchReq: (id) => `נשלחה בקשת התאמה (מס׳ ${id})`,
  loadedRequests: 'בקשות ההתאמה נטענו',
  loadedDriverReq: 'בקשות ממתינות לנסיעות שלך נטענו',
  matchAccepted: (id) => `התאמה מס׳ ${id} אושרה`,
  matchRejected: (id) => `התאמה מס׳ ${id} נדחתה`,
  matchCancelled: (id) => `התאמה מס׳ ${id} בוטלה`,
  loggedOut: 'התנתקת',
  routeDrawErr: (s) => `שרטוט המסלול נכשל (${s}). ודאו ש-Directions API מופעל.`,
  matchLine: (mid, rid) => `התאמה מס׳ ${mid} · נסיעה מס׳ ${rid}`,
  matchLineDriver: (mid, rid, pid) => `התאמה מס׳ ${mid} · נסיעה מס׳ ${rid} · נוסע מס׳ ${pid}`,
  routeLabel: 'מסלול',
  driverNameLabel: 'נהג',
  passengerNameLabel: 'נוסע',
}

function matchStatusHe(s) {
  const m = {
    PENDING: 'ממתין',
    ACCEPTED: 'אושר',
    REJECTED: 'נדחה',
    COMPLETED: 'הושלם',
    CANCELLED: 'בוטל',
    EXPIRED: 'פג תוקף',
  }
  return m[s] || s
}

function Icon({ name }) {
  const paths = {
    discover: 'M10 2a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V2zm8 0v6h-6V6h2.59L10 10.59 11.41 12 16 7.41V10h2V2z',
    manage: 'M3 5a2 2 0 0 1 2-2h3v2H5v3H3V5zm13-2h3a2 2 0 0 1 2 2v3h-2V5h-3V3zM3 16h2v3h3v2H5a2 2 0 0 1-2-2v-3zm16 0h2v3a2 2 0 0 1-2 2h-3v-2h3v-3zM8 8h8v8H8V8z',
    driver: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-2H7v2H5v-6zm2.2-4L6.4 11h11.2l-.8-4H7.2zM8.5 13.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 1 0 20 14.5z',
    sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m12.95 6.95 1.41 1.41M3.64 3.64 5.05 5.05m11.9 0 1.41-1.41M3.64 20.36l1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
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
    script.onerror = () => setError(he.mapsLoadError)
    document.body.appendChild(script)
  }, [apiKey])
  return { loaded, error }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [message, setMessage] = useState(he.welcome)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('discover')
  const [authMode, setAuthMode] = useState('login')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
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
    const t = token || localStorage.getItem('token')
    if (!t) return { 'Content-Type': 'application/json' }
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
  }, [token])

  const rootClassName = `container theme-${theme} rtl`
  const stats = useMemo(
    () => ({
      ridesFound: rides.length,
      myRequests: myRequests.length,
      pendingApprovals: driverPending.length,
      credits: me?.credits ?? null,
    }),
    [rides.length, myRequests.length, driverPending.length, me?.credits],
  )

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
    const authToken = localStorage.getItem('token') || token
    const requestHeaders = useAuth
      ? {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        }
      : { 'Content-Type': 'application/json' }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : null,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = data?.detail?.message || data?.detail || he.requestFailed
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
        polylineOptions: { strokeColor: '#00b4e6', strokeWeight: 6, strokeOpacity: 0.92 },
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
          setMessage(he.routeDrawErr(status))
        }
      },
    )
  }

  useEffect(() => {
    if (!token || me) return
    loadProfile({ quiet: true }).catch(() => {})
  }, [token, me])

  useEffect(() => {
    if (!token) return
    loadMyRequests({ quiet: true }).catch(() => {})
    loadDriverPending({ quiet: true }).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    if (activeTab === 'driver') loadDriverPending({ quiet: true }).catch(() => {})
    if (activeTab === 'manage') loadMyRequests({ quiet: true }).catch(() => {})
  }, [activeTab, token])

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
    const displayName = auth.name.trim()
    await withLoading(async () => {
      try {
        const data = await callApi('/auth/register', 'POST', auth)
        localStorage.setItem('token', data.token)
        setAuth({ name: '', phone: '', email: '', password: '' })
        setMe(null)
        setToken(data.token)
        setMessage(he.welcomeAfterRegister(displayName))
        await loadMyPublishedRides()
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
        setMe(null)
        setMessage(he.loggedIn)
        await loadMyPublishedRides()
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadProfile(options = {}) {
    try {
      const data = await callApi('/users/me', 'GET', null, true)
      setMe(data)
      if (!options.quiet) setMessage(he.profileLoaded)
      return data
    } catch (error) {
      if (!options.quiet) setMessage(error.message)
      return null
    }
  }

  async function publishRide(event) {
    event.preventDefault()
    await withLoading(async () => {
      try {
        const payload = { ...ride, departure_time: new Date(ride.departure_time).toISOString(), seats_total: Number(ride.seats_total) }
        await callApi('/rides', 'POST', payload, true)
        setMessage(he.ridePublished)
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
        setMessage(he.foundRides(data.length))
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
        setMessage(he.loadedForUser(data.length, userId))
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
        setMessage(he.loadedMyPub(data.length))
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function deleteMyRide(rideId) {
    if (!window.confirm(he.deleteConfirm)) return
    await withLoading(async () => {
      try {
        await callApi(`/rides/${rideId}`, 'DELETE', null, true)
        setMyPublishedRides((prev) => prev.filter((r) => r.id !== rideId))
        setMessage(he.rideDeleted)
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function requestRide(rideId) {
    await withLoading(async () => {
      try {
        const data = await callApi('/matches/request', 'POST', { ride_id: rideId }, true)
        setMessage(he.matchReq(data.match_id))
        await loadMyRequests({ quiet: true })
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function loadMyRequests(options = {}) {
    const { quiet = false } = options
    const runner = quiet ? async (action) => action() : withLoading
    await runner(async () => {
      try {
        const data = await callApi('/matches/my-requests', 'GET', null, true)
        setMyRequests(data)
        if (!quiet) setMessage(he.loadedRequests)
      } catch (error) {
        if (!quiet) setMessage(error.message)
      }
    })
  }

  async function loadDriverPending(options = {}) {
    const { quiet = false } = options
    const runner = quiet ? async (action) => action() : withLoading
    await runner(async () => {
      try {
        const data = await callApi('/matches/driver-pending', 'GET', null, true)
        setDriverPending(data)
        if (!quiet) setMessage(he.loadedDriverReq)
      } catch (error) {
        if (!quiet) setMessage(error.message)
      }
    })
  }

  async function confirmMatch(matchId) {
    await withLoading(async () => {
      try {
        await callApi('/matches/accept', 'POST', { match_id: matchId }, true)
        setMessage(he.matchAccepted(matchId))
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
        setMessage(he.matchRejected(matchId))
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
        setMessage(he.matchCancelled(matchId))
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
    setMessage(he.loggedOut)
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  if (!token) {
    return (
      <main className={rootClassName} dir="rtl">
        <section className="authScreen">
          <div className="authDecor" aria-hidden="true" />
          <div className="authShell">
            <aside className="authHero">
              <div className="authHeroGlow" aria-hidden="true" />
              <img src="/logo.svg" alt="" className="authHeroLogo" width={72} height={72} />
              <p className="authHeroEyebrow">{BRAND}</p>
              <h2 className="authHeroTitle">{he.tagline}</h2>
              <ul className="authHeroList">
                <li><span className="authHeroCheck" aria-hidden="true" />{he.authBullet1}</li>
                <li><span className="authHeroCheck" aria-hidden="true" />{he.authBullet2}</li>
                <li><span className="authHeroCheck" aria-hidden="true" />{he.authBullet3}</li>
              </ul>
            </aside>
            <div className="authPanel">
              <div className="authPanelCard">
                <p className="authPanelLead">{authMode === 'login' ? he.loginLead : he.signupLead}</p>
                <p className="authPanelSub">{he.authSubtitle}</p>
                {message ? <p className="message authMessage">{message}</p> : null}
                <div className="authSwitch">
                  <button type="button" className={authMode === 'login' ? 'tab active' : 'tab'} onClick={() => setAuthMode('login')}>{he.loginTab}</button>
                  <button type="button" className={authMode === 'signup' ? 'tab active' : 'tab'} onClick={() => setAuthMode('signup')}>{he.signupTab}</button>
                </div>
                {authMode === 'login' ? (
                  <form className="authForm" onSubmit={loginSubmit}>
                    <label className="authField">
                      <span className="authLabel">{he.labelEmail}</span>
                      <input type="email" autoComplete="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required />
                    </label>
                    <label className="authField">
                      <span className="authLabel">{he.password}</span>
                      <input type="password" autoComplete="current-password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
                    </label>
                    <button type="submit" className="authSubmit" disabled={loading}>{he.loginBtn}</button>
                  </form>
                ) : (
                  <form className="authForm" onSubmit={registerSubmit}>
                    <label className="authField">
                      <span className="authLabel">{he.labelName}</span>
                      <input autoComplete="name" value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })} required minLength={2} />
                    </label>
                    <label className="authField">
                      <span className="authLabel">{he.phone}</span>
                      <input type="tel" autoComplete="tel" value={auth.phone} onChange={(e) => setAuth({ ...auth, phone: e.target.value })} required />
                    </label>
                    <label className="authField">
                      <span className="authLabel">{he.labelEmail}</span>
                      <input type="email" autoComplete="email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} required />
                    </label>
                    <label className="authField">
                      <span className="authLabel">{he.password}</span>
                      <input type="password" autoComplete="new-password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} required minLength={6} />
                    </label>
                    <button type="submit" className="authSubmit" disabled={loading}>{he.createAccount}</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={rootClassName} dir="rtl">
      <section className="card appSurface">
        <header className="hero heroInSurface">
          <div className="heroBrandCol">
            <div className="brandBlock">
              <img src="/logo.svg" alt="" className="brandLogo" width={56} height={56} />
              <div className="brandText">
                <h1 className="brandWordmark">{BRAND}</h1>
                <p className="sub">{he.tagline}</p>
              </div>
            </div>
          </div>
          <div className="statusWrap controls heroActions">
            <button type="button" className="iconBtn ghost" onClick={toggleTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} />{theme === 'light' ? he.themeDark : he.themeLight}</button>
            <div className="profileMenuWrap">
              <button type="button" className="iconBtn ghost iconOnly" onClick={() => setMenuOpen((prev) => !prev)}><Icon name="user" /></button>
              {menuOpen ? (
                <div className="profileMenu">
                  <button type="button" className="menuItem" onClick={() => withLoading(loadProfile)}>{he.profileMenu}</button>
                  {me ? <div className="menuMeta">{he.creditsShort}: <strong>{me.credits}</strong></div> : null}
                  <button type="button" className="menuItem danger" onClick={logout}>{he.logout}</button>
                </div>
              ) : null}
            </div>
            <span className={`status ${token ? 'ok' : 'off'} statusUser`}>
              {token ? (me?.name ? `${he.connected} · ${me.name}` : he.connected) : he.guest}
            </span>
            <span className={`status ${loading ? 'busy' : 'ok'}`}>{loading ? he.loading : he.ready}</span>
          </div>
        </header>

        <div className="statsBar statsInSurface">
          <div className="stat"><span>{he.ridesFound}</span><strong>{stats.ridesFound}</strong></div>
          <div className="stat"><span>{he.myRequestsStat}</span><strong>{stats.myRequests}</strong></div>
          <div className="stat"><span>{he.pendingApprovals}</span><strong>{stats.pendingApprovals}</strong></div>
          <div className="stat statAccent"><span>{he.creditsShort}</span><strong>{stats.credits !== null ? stats.credits : '—'}</strong></div>
        </div>

        <nav className="tabs tabsInSurface" aria-label="ניווט ראשי">
          <button className={activeTab === 'discover' ? 'tab active' : 'tab'} onClick={() => setActiveTab('discover')} type="button"><Icon name="discover" />{he.tabDiscover}</button>
          <button className={activeTab === 'manage' ? 'tab active' : 'tab'} onClick={() => setActiveTab('manage')} type="button"><Icon name="manage" />{he.tabManage}</button>
          <button className={activeTab === 'driver' ? 'tab active' : 'tab'} onClick={() => setActiveTab('driver')} type="button"><Icon name="driver" />{he.tabDriver}</button>
        </nav>
      </section>

      {message ? <p className="message messageBand">{message}</p> : null}

      <p className="pageMeta" title={API_BASE_URL}>{he.apiLabel}: <span className="pageMetaUrl">{API_BASE_URL}</span></p>

      {activeTab === 'discover' ? (
        <section className="card cardPanel">
          <h2>{he.searchRidesTitle}</h2>
          <form onSubmit={searchRides}>
            <input ref={searchOriginRef} placeholder={mapsLoaded ? he.originPh : he.originPhShort} value={search.origin} onChange={(e) => { setSearch({ ...search, origin: e.target.value }); setSearchCoords((prev) => ({ ...prev, origin: null })) }} required />
            <input ref={searchDestinationRef} placeholder={mapsLoaded ? he.destPh : he.destPhShort} value={search.destination} onChange={(e) => { setSearch({ ...search, destination: e.target.value }); setSearchCoords((prev) => ({ ...prev, destination: null })) }} />
            <button type="submit" disabled={loading}>{he.searchBtn}</button>
          </form>
          <p className="empty" style={{ marginTop: '0.5rem' }}>{he.searchHint}</p>
          <div className="mapWrap">
            {!mapsApiKey ? <p className="empty">{he.mapsKeyHint}</p> : null}
            {mapsError ? <p className="empty">{mapsError}</p> : null}
            <div ref={searchMapRef} className="mapCanvas" />
          </div>
          <ul className="results">
            {rides.map((item) => (
              <li key={item.id}>
                <div className="rideBlock">
                  <strong>#{item.id}</strong>
                  <div className="routeRow"><span className="routeChip">{item.origin}</span><span className="routeArrow">{he.routeSep}</span><span className="routeChip">{item.destination}</span></div>
                  <div className="meta">{he.seatsAvail}: {item.seats_available} · {he.driver} מס׳ {item.driver_id}</div>
                </div>
                <div className="actionCol">
                  <button type="button" onClick={() => requestRide(item.id)} disabled={!token || loading}>{he.requestMatch}</button>
                  <button type="button" className="ghost" onClick={() => loadUserRides(item.driver_id)} disabled={loading}>{he.viewDriverRides}</button>
                </div>
              </li>
            ))}
          </ul>
            {!rides.length ? <p className="empty">{he.emptyDiscover}</p> : null}

          {selectedDriverId ? (
            <section className="subCard">
              <h3>{he.driverRidesTitle} {selectedDriverId}</h3>
              <ul className="results compact">
                {driverRides.map((item) => (
                  <li key={`driver-${item.id}`}>
                    <div className="rideBlock">
                      <strong>#{item.id}</strong>
                      <div className="routeRow"><span className="routeChip">{item.origin}</span><span className="routeArrow">{he.routeSep}</span><span className="routeChip">{item.destination}</span></div>
                      <div className="meta">{he.seatsRatio}: {item.seats_available} / {item.seats_total}</div>
                    </div>
                  </li>
                ))}
              </ul>
              {!driverRides.length ? <p className="empty">{he.emptyDriverList}</p> : null}
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'manage' ? (
        <>
          <section className="card cardPanel">
            <h2>{he.publishTitle}</h2>
            <form onSubmit={publishRide}>
              <input ref={rideOriginRef} placeholder={mapsLoaded ? he.originPubPh : he.originPubShort} value={ride.origin} onChange={(e) => { setRide({ ...ride, origin: e.target.value }); setRideCoords((prev) => ({ ...prev, origin: null })) }} required />
              <input ref={rideDestinationRef} placeholder={mapsLoaded ? he.destPubPh : he.destPubShort} value={ride.destination} onChange={(e) => { setRide({ ...ride, destination: e.target.value }); setRideCoords((prev) => ({ ...prev, destination: null })) }} required />
              <input type="datetime-local" value={ride.departure_time} onChange={(e) => setRide({ ...ride, departure_time: e.target.value })} required />
              <input type="number" min="1" max="8" value={ride.seats_total} onChange={(e) => setRide({ ...ride, seats_total: e.target.value })} required />
              <button type="submit" disabled={!token || loading}>{he.publishBtn}</button>
            </form>
            <div className="mapWrap">
              {!mapsApiKey ? <p className="empty">{he.mapsKeyHint}</p> : null}
              {mapsError ? <p className="empty">{mapsError}</p> : null}
              <div ref={rideMapRef} className="mapCanvas" />
            </div>
          </section>
          <section className="card cardPanel">
            <h2>{he.myRidesTitle}</h2>
            <button onClick={loadMyPublishedRides} disabled={!token || loading}>{he.loadMyRides}</button>
            <ul className="results compact">
              {myPublishedRides.map((item) => (
                <li key={`mine-${item.id}`}>
                  <div className="rideBlock">
                    <strong>#{item.id}</strong>
                    <div className="routeRow"><span className="routeChip">{item.origin}</span><span className="routeArrow">{he.routeSep}</span><span className="routeChip">{item.destination}</span></div>
                    <div className="meta">{he.seatsRatio}: {item.seats_available} / {item.seats_total}</div>
                  </div>
                  <div className="actionCol">
                    <button type="button" className="ghost" onClick={() => deleteMyRide(item.id)} disabled={!token || loading}>{he.deleteRide}</button>
                  </div>
                </li>
              ))}
            </ul>
            {!myPublishedRides.length ? <p className="empty">{he.emptyMyRides}</p> : null}
          </section>
        </>
      ) : null}

      {activeTab === 'driver' ? (
        <>
          <section className="card cardPanel">
            <h2>{he.myMatchesTitle}</h2>
            <button onClick={loadMyRequests} disabled={!token || loading}>{he.loadMyRequests}</button>
            <ul className="results">
              {myRequests.map((item) => (
                <li key={item.match_id}>
                  <div>
                    <strong>{he.matchLine(item.match_id, item.ride_id)}</strong>
                    <div className="meta">{he.status}: {matchStatusHe(item.status)}</div>
                    {(item.origin && item.destination) ? (
                      <div className="meta">{he.routeLabel}: {item.origin} {he.routeSep} {item.destination}</div>
                    ) : null}
                    <div className="meta">{he.driverNameLabel}: {item.driver_name || item.driver_id || '-'}</div>
                    <div className="meta">{he.passengerNameLabel}: {item.passenger_name || item.passenger_id || '-'}</div>
                  </div>
                  {(item.status === 'PENDING' || item.status === 'ACCEPTED') ? (
                    <button type="button" className="ghost" onClick={() => cancelMatch(item.match_id)} disabled={loading}>{he.cancelBtn}</button>
                  ) : null}
                </li>
              ))}
            </ul>
            {!myRequests.length ? <p className="empty">{he.emptyRequests}</p> : null}
          </section>
          <section className="card cardPanel">
            <h2>{he.incomingRequestsTitle}</h2>
            <button onClick={loadDriverPending} disabled={!token || loading}>{he.loadPending}</button>
            <ul className="results">
              {driverPending.map((item) => (
                <li key={`incoming-${item.match_id}`}>
                  <div>
                    <strong>{he.matchLineDriver(item.match_id, item.ride_id, item.passenger_id)}</strong>
                    {(item.origin && item.destination) ? (
                      <div className="meta">{he.routeLabel}: {item.origin} {he.routeSep} {item.destination}</div>
                    ) : null}
                    <div className="meta">{he.driverNameLabel}: {item.driver_name || item.driver_id || '-'}</div>
                    <div className="meta">{he.passengerNameLabel}: {item.passenger_name || item.passenger_id || '-'}</div>
                  </div>
                  <div className="actionCol">
                    <button type="button" onClick={() => confirmMatch(item.match_id)} disabled={loading}>{he.acceptBtn}</button>
                    <button type="button" className="ghost" onClick={() => rejectMatch(item.match_id)} disabled={loading}>{he.rejectBtn}</button>
                  </div>
                </li>
              ))}
            </ul>
            {!driverPending.length ? <p className="empty">{he.noIncomingRequests}</p> : null}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default App
