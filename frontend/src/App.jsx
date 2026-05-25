// ===============================================================
// App.jsx — קומפוננטה ראשית של TREMPIST Frontend
// כולל: state management, API calls, Google Maps, UI rendering
// ===============================================================

import { useEffect, useMemo, useRef, useState } from 'react'

// כתובת ה-API — מגיעה מ-.env.local בפיתוח, ומ-Vercel env בייצור
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const BRAND = 'TREMPIST'

/** Windows: use `py` launcher — `python` often opens Microsoft Store stub */
function authCliCmd(action) {
  const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
  const base = isWindows ? 'py -m app.auth_socket_client' : 'python3 -m app.auth_socket_client'
  return `${base} ${action}`
}

// ---------------------------------------------------------------
// אובייקט עברית — כל מחרוזות הממשק במקום אחד
// הפרדה בין לוגיקה לתוכן — קל לשינוי/תרגום
// ---------------------------------------------------------------
const he = {
  requestFailed: 'הבקשה נכשלה',
  mapsLoadError: 'טעינת מפות Google נכשלה. בדקו את מפתח ה-API והגבלות הדומיין.',
  welcome: 'ברוכים הבאים',
  authSubtitle: 'הרשמה והתחברות מתבצעות בקליינט TCP — לאחר מכן הדביקו את ה-JWT כאן.',
  authTcpTitle: 'שרת אימות TCP (פורט 9000)',
  authTcpExplain: 'הדפדפן לא יכול להתחבר ישירות ל-TCP. הריצו בטרמינל מתיקיית הפרויקט (Windows: py, לא python):',
  authTokenLabel: 'JWT מהקליינט',
  authTokenPh: 'הדביקו את ה-token מה-JSON שהתקבל',
  authTokenBtn: 'כניסה עם טוקן',
  authTokenInvalid: 'הטוקן לא תקין או פג תוקף',
  authBullet1: 'חיפוש נסיעות לפי מוצא ויעד על המפה',
  authBullet2: 'פרסום מקום פנוי ברכב בקלות',
  authBullet3: 'התאמה מהירה בין נוסעים לנהגים',
  signupLead: 'יצירת חשבון חדש',
  loginLead: 'כניסה לחשבון קיים',
  loginTab: 'התחברות',
  signupTab: 'הרשמה',
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
  ridesFound: 'נסיעות שנמצאו',
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
  departureFrom: 'החל מתאריך ושעה',
  departureTo: 'עד תאריך ושעה',
  leavingSoonHours: 'יוצא בקרוב (שעות)',
  sortBy: 'מיון',
  sortDepartureAsc: 'שעת יציאה (מוקדם למאוחר)',
  sortDepartureDesc: 'שעת יציאה (מאוחר למוקדם)',
  sortSeatsDesc: 'מקומות פנויים (הרבה לפחות)',
  sortSeatsAsc: 'מקומות פנויים (מעט לפחות)',
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
  activeDriverRidesTitle: 'נסיעות פעילות שלי (מאושר)',
  noActiveDriverRides: 'אין נסיעות פעילות כרגע.',
  completeRideBtn: 'סמן כהושלם',
  walletTitle: 'ארנק קרדיט',
  loadWallet: 'רענן ארנק',
  emptyWallet: 'אין תנועות קרדיט עדיין.',
  notificationsTitle: 'התראות',
  noNotifications: 'אין התראות חדשות.',
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
  driverPhoneLabel: 'טלפון נהג',
  passengerPhoneLabel: 'טלפון נוסע',
  meetingTimeLabel: 'שעת המפגש',
  publishMeetingTimeLabel: 'תאריך ושעת המפגש',
  travelConfirmationTitle: 'אישור נסיעה',
  travelConfirmedAt: 'אושר ב',
  ratingLabel: 'דירוג',
  ratingShort: 'דירוג',
  ratingStars: 'כוכבים',
  ratingCommentPh: 'תגובה (אופציונלי)',
  rateSubmitBtn: 'שליחת דירוג',
  rateSkip: 'דילוג',
  rateUserTitle: (name) => `דרגו את ${name}`,
  rateDriverPrompt: 'דרגו את הנהג לאחר הנסיעה',
  ratePassengerPrompt: 'דרגו את הנוסע לאחר הנסיעה',
  ratingSubmitted: 'הדירוג נשלח — תודה!',
  ratingAlready: 'כבר דירגת משתמש זה',
  creditIn: 'זיכוי',
  creditOut: 'חיוב',
  atTime: (iso) => `בתאריך ${new Date(iso).toLocaleString('he-IL')}`,
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

function formatMeetingTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatRatingAvg(avg) {
  if (avg == null || avg <= 0) return '—'
  return `${Number(avg).toFixed(1)} ★`
}

function StarPicker({ value, onChange, disabled }) {
  return (
    <div className="starPicker" role="group" aria-label={he.ratingStars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'star starOn' : 'star'}
          onClick={() => onChange(n)}
          disabled={disabled}
          aria-label={`${n} ${he.ratingStars}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function RatingForm({ ratedUserId, ratedUserName, prompt, onSubmit, onSkip, disabled }) {
  const [stars, setStars] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!ratedUserId || busy || disabled) return
    setBusy(true)
    try {
      await onSubmit({ rated_user_id: ratedUserId, stars, comment: comment.trim() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ratingForm" onSubmit={handleSubmit}>
      <p className="ratingPrompt">{prompt || he.rateUserTitle(ratedUserName || `#${ratedUserId}`)}</p>
      <StarPicker value={stars} onChange={setStars} disabled={disabled || busy} />
      <textarea
        className="ratingComment"
        rows={2}
        maxLength={1000}
        placeholder={he.ratingCommentPh}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={disabled || busy}
      />
      <div className="ratingActions">
        <button type="submit" disabled={disabled || busy}>{he.rateSubmitBtn}</button>
        {onSkip ? (
          <button type="button" className="ghost" onClick={onSkip} disabled={busy}>{he.rateSkip}</button>
        ) : null}
      </div>
    </form>
  )
}

function TravelConfirmation({ item }) {
  if (item.status !== 'ACCEPTED' && item.status !== 'COMPLETED') return null
  return (
    <div className="travelConfirmation">
      <h4>{he.travelConfirmationTitle}</h4>
      {(item.origin && item.destination) ? (
        <div className="travelConfirmationRoute">
          {item.origin} {he.routeSep} {item.destination}
        </div>
      ) : null}
      <dl className="travelConfirmationGrid">
        <div>
          <dt>{he.meetingTimeLabel}</dt>
          <dd>{formatMeetingTime(item.departure_time)}</dd>
        </div>
        <div>
          <dt>{he.driverNameLabel}</dt>
          <dd>{item.driver_name || '-'}</dd>
        </div>
        <div>
          <dt>{he.driverPhoneLabel}</dt>
          <dd>
            {item.driver_phone ? (
              <a href={`tel:${item.driver_phone}`}>{item.driver_phone}</a>
            ) : (
              '-'
            )}
          </dd>
        </div>
        <div>
          <dt>{he.passengerNameLabel}</dt>
          <dd>{item.passenger_name || '-'}</dd>
        </div>
        <div>
          <dt>{he.passengerPhoneLabel}</dt>
          <dd>
            {item.passenger_phone ? (
              <a href={`tel:${item.passenger_phone}`}>{item.passenger_phone}</a>
            ) : (
              '-'
            )}
          </dd>
        </div>
        {item.confirmed_at ? (
          <div>
            <dt>{he.travelConfirmedAt}</dt>
            <dd>{formatMeetingTime(item.confirmed_at)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function MatchDetails({ item, showPassengerPhone = false }) {
  return (
    <>
      {(item.origin && item.destination) ? (
        <div className="meta">{he.routeLabel}: {item.origin} {he.routeSep} {item.destination}</div>
      ) : null}
      {item.departure_time ? (
        <div className="meta">{he.meetingTimeLabel}: {formatMeetingTime(item.departure_time)}</div>
      ) : null}
      <div className="meta">{he.driverNameLabel}: {item.driver_name || item.driver_id || '-'}</div>
      <div className="meta">{he.passengerNameLabel}: {item.passenger_name || item.passenger_id || '-'}</div>
      {showPassengerPhone && item.passenger_phone ? (
        <div className="meta">{he.passengerPhoneLabel}: <a href={`tel:${item.passenger_phone}`}>{item.passenger_phone}</a></div>
      ) : null}
    </>
  )
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

// ---------------------------------------------------------------
// useGoogleMaps — Hook לטעינת Google Maps API
// טוען את הסקריפט פעם אחת ומדווח על מוכנות
// ---------------------------------------------------------------
function useGoogleMaps(apiKey) {
  const [loaded, setLoaded] = useState(Boolean(window.google?.maps?.places))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!apiKey) return  // אם אין מפתח — לא טוענים
    if (window.google?.maps?.places) {
      const timer = window.setTimeout(() => setLoaded(true), 0)
      return () => window.clearTimeout(timer)
    }
    const scriptId = 'google-maps-script'
    const existing = document.getElementById(scriptId)
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true))
      return
    }
    // יצירת תג script דינמי לטעינת Google Maps
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=he&region=IL`
    script.async = true
    script.defer = true
    script.onload = () => setLoaded(true)   // הצלחה
    script.onerror = () => setError(he.mapsLoadError)  // כישלון
    document.body.appendChild(script)
  }, [apiKey])
  return { loaded, error }
}

// ---------------------------------------------------------------
// App — קומפוננטה ראשית
// ---------------------------------------------------------------
function App() {
  // --- State Management ---
  const [token, setToken] = useState(localStorage.getItem('token') || '')  // JWT שמור
  const [message, setMessage] = useState(he.welcome)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('discover')  // טאב פעיל
  const [authMode, setAuthMode] = useState('login')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pasteToken, setPasteToken] = useState('')
  const [ride, setRide] = useState({ origin: '', destination: '', departure_time: '', seats_total: 1 })
  const [search, setSearch] = useState({
    origin: '',
    destination: '',
    departure_from: '',
    departure_to: '',
    leaving_soon_hours: '',
    sort_by: 'departure_asc',
  })
  const [rideCoords, setRideCoords] = useState({ origin: null, destination: null })
  const [searchCoords, setSearchCoords] = useState({ origin: null, destination: null })
  const [me, setMe] = useState(null)           // פרטי המשתמש המחובר
  const [rides, setRides] = useState([])        // תוצאות חיפוש
  const [driverRides, setDriverRides] = useState([])
  const [selectedDriverId, setSelectedDriverId] = useState(null)
  const [myRequests, setMyRequests] = useState([])   // הבקשות שלי כנוסע
  const [driverPending, setDriverPending] = useState([])  // בקשות ממתינות כנהג
  const [myPublishedRides, setMyPublishedRides] = useState([])
  const [driverActive, setDriverActive] = useState([])    // נסיעות פעילות כנהג
  const [creditsLog, setCreditsLog] = useState([])        // היסטוריית קרדיטים
  const [notifications, setNotifications] = useState([])
  const [ratedUserIds, setRatedUserIds] = useState(() => new Set())
  const [ratingPrompt, setRatingPrompt] = useState(null)  // { ratedUserId, ratedUserName, prompt }

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

  const rootClassName = `container theme-${theme} rtl`
  const stats = useMemo(
    () => ({
      ridesFound: rides.length,
      myRequests: myRequests.length,
      pendingApprovals: driverPending.length,
      credits: me?.credits ?? null,
      rating: me?.rating_avg ?? null,
    }),
    [rides.length, myRequests.length, driverPending.length, me?.credits, me?.rating_avg],
  )

  function hasRated(userId) {
    return ratedUserIds.has(userId)
  }

  function markRated(userId) {
    setRatedUserIds((prev) => new Set(prev).add(userId))
  }

  function mapDefaults() {
    return { center: { lat: 32.0853, lng: 34.7818 }, zoom: 9, mapTypeControl: false, streetViewControl: false, fullscreenControl: false }
  }

  function pushNotification(text) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setNotifications((prev) => [{ id, text, createdAt: new Date().toISOString() }, ...prev].slice(0, 20))
  }

  async function withLoading(action) {
    setLoading(true)
    try {
      await action()
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------
  // callApi — פונקציית תקשורת מרכזית
  // ---------------------------------------------------------------
  async function callApi(path, method = 'GET', body = null, useAuth = false) {
    const authToken = localStorage.getItem('token') || token
    // בניית headers — הוספת JWT רק לבקשות מאומתות
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
    const data = await response.json().catch(() => ({}))  // catch למקרה תגובה לא-JSON
    if (!response.ok) {
      // חילוץ הודעת שגיאה בעברית מהשרת
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
    if (!token) {
      setMe(null)
      return
    }
    loadProfile({ quiet: true })
      .then((profile) => {
        if (!profile) {
          localStorage.removeItem('token')
          setToken('')
          setMe(null)
        }
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    loadMyRequests({ quiet: true }).catch(() => {})
    loadDriverPending({ quiet: true }).catch(() => {})
    loadDriverActive({ quiet: true }).catch(() => {})
    loadCreditsLog({ quiet: true }).catch(() => {})
    loadMyRatingsGiven({ quiet: true }).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    if (activeTab === 'driver') loadDriverPending({ quiet: true }).catch(() => {})
    if (activeTab === 'manage') loadMyRequests({ quiet: true }).catch(() => {})
  }, [activeTab, token])

  useEffect(() => {
    if (!token) return
    const timer = window.setInterval(() => {
      loadMyRequests({ quiet: true }).catch(() => {})
      loadDriverPending({ quiet: true }).catch(() => {})
      loadDriverActive({ quiet: true }).catch(() => {})
    }, 20000)
    return () => window.clearInterval(timer)
  }, [token])

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

  async function tokenSubmit(event) {
    event.preventDefault()
    let jwt = pasteToken.trim()
    if (!jwt) return
    if (jwt.startsWith('{')) {
      try {
        const parsed = JSON.parse(jwt)
        jwt = parsed.token || parsed.access_token || jwt
      } catch {
        // use raw string
      }
    }
    await withLoading(async () => {
      localStorage.setItem('token', jwt)
      setToken(jwt)
      setMe(null)
      const profile = await loadProfile({ quiet: true })
      if (!profile) {
        localStorage.removeItem('token')
        setToken('')
        setMessage(he.authTokenInvalid)
        return
      }
      setPasteToken('')
      setMessage(he.loggedIn)
      await loadMyPublishedRides()
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
          departure_from: search.departure_from ? new Date(search.departure_from).toISOString() : null,
          departure_to: search.departure_to ? new Date(search.departure_to).toISOString() : null,
          leaving_soon_hours: search.leaving_soon_hours ? Number(search.leaving_soon_hours) : null,
          sort_by: search.sort_by || 'departure_asc',
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
        pushNotification(he.matchReq(data.match_id))
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

  async function loadDriverActive(options = {}) {
    const { quiet = false } = options
    const runner = quiet ? async (action) => action() : withLoading
    await runner(async () => {
      try {
        const data = await callApi('/matches/driver-active', 'GET', null, true)
        setDriverActive(data)
      } catch (error) {
        if (!quiet) setMessage(error.message)
      }
    })
  }

  async function loadMyRatingsGiven(options = {}) {
    const { quiet = false } = options
    try {
      const data = await callApi('/ratings/my-given', 'GET', null, true)
      setRatedUserIds(new Set(data.map((item) => item.rated_user_id)))
    } catch (error) {
      if (!quiet) setMessage(error.message)
    }
  }

  async function submitRating(payload, options = {}) {
    const { quiet = false } = options
    try {
      await callApi('/ratings', 'POST', payload, true)
      markRated(payload.rated_user_id)
      if (!quiet) {
        setMessage(he.ratingSubmitted)
        pushNotification(he.ratingSubmitted)
      }
      await loadProfile({ quiet: true })
      return true
    } catch (error) {
      if (!quiet) setMessage(error.message)
      return false
    }
  }

  async function loadCreditsLog(options = {}) {
    const { quiet = false } = options
    const runner = quiet ? async (action) => action() : withLoading
    await runner(async () => {
      try {
        const data = await callApi('/credits/me-logs', 'GET', null, true)
        setCreditsLog(data)
      } catch (error) {
        if (!quiet) setMessage(error.message)
      }
    })
  }

  async function completeRide(matchId) {
    const match = driverActive.find((item) => item.match_id === matchId)
    await withLoading(async () => {
      try {
        await callApi('/matches/complete', 'POST', { match_id: matchId }, true)
        pushNotification(`ההתאמה ${matchId} הושלמה`)
        if (match?.passenger_id && !hasRated(match.passenger_id)) {
          setRatingPrompt({
            ratedUserId: match.passenger_id,
            ratedUserName: match.passenger_name || `#${match.passenger_id}`,
            prompt: he.ratePassengerPrompt,
          })
        }
        await loadDriverActive({ quiet: true })
        await loadDriverPending({ quiet: true })
        await loadMyRequests({ quiet: true })
        await loadCreditsLog({ quiet: true })
        await loadProfile({ quiet: true })
      } catch (error) {
        setMessage(error.message)
      }
    })
  }

  async function confirmMatch(matchId) {
    await withLoading(async () => {
      try {
        const confirmation = await callApi('/matches/accept', 'POST', { match_id: matchId }, true)
        const detail = confirmation?.departure_time
          ? `${he.meetingTimeLabel}: ${formatMeetingTime(confirmation.departure_time)}`
          : ''
        setMessage(`${he.matchAccepted(matchId)}${detail ? ` · ${detail}` : ''}`)
        pushNotification(he.matchAccepted(matchId))
        await loadDriverPending()
        await loadDriverActive({ quiet: true })
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
        pushNotification(he.matchRejected(matchId))
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
        pushNotification(he.matchCancelled(matchId))
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
    setDriverActive([])
    setCreditsLog([])
    setNotifications([])
    setRatedUserIds(new Set())
    setRatingPrompt(null)
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
                <div className="authForm authCliBox">
                  <h3 className="authCliTitle">{he.authTcpTitle}</h3>
                  <p className="authCliText">{he.authTcpExplain}</p>
                  <pre className="authCliCmd"><code>{authCliCmd(authMode === 'signup' ? 'register' : 'login')}</code></pre>
                </div>
                <form className="authForm" onSubmit={tokenSubmit}>
                  <label className="authField">
                    <span className="authLabel">{he.authTokenLabel}</span>
                    <textarea
                      className="authTokenInput"
                      rows={3}
                      value={pasteToken}
                      onChange={(e) => setPasteToken(e.target.value)}
                      placeholder={he.authTokenPh}
                      required
                    />
                  </label>
                  <button type="submit" className="authSubmit" disabled={loading}>{he.authTokenBtn}</button>
                </form>
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
                  {me ? (
                    <>
                      <div className="menuMeta">{he.creditsShort}: <strong>{me.credits}</strong></div>
                      <div className="menuMeta">{he.ratingLabel}: <strong>{formatRatingAvg(me.rating_avg)}</strong></div>
                    </>
                  ) : null}
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
          <div className="stat"><span>{he.ratingShort}</span><strong>{formatRatingAvg(stats.rating)}</strong></div>
        </div>

        <nav className="tabs tabsInSurface" aria-label="ניווט ראשי">
          <button className={activeTab === 'discover' ? 'tab active' : 'tab'} onClick={() => setActiveTab('discover')} type="button"><Icon name="discover" />{he.tabDiscover}</button>
          <button className={activeTab === 'manage' ? 'tab active' : 'tab'} onClick={() => setActiveTab('manage')} type="button"><Icon name="manage" />{he.tabManage}</button>
          <button className={activeTab === 'driver' ? 'tab active' : 'tab'} onClick={() => setActiveTab('driver')} type="button"><Icon name="driver" />{he.tabDriver}</button>
        </nav>
      </section>

      {message ? <p className="message messageBand">{message}</p> : null}

      {ratingPrompt ? (
        <div className="ratingModalBackdrop" role="presentation" onClick={() => setRatingPrompt(null)}>
          <div className="ratingModal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <RatingForm
              ratedUserId={ratingPrompt.ratedUserId}
              ratedUserName={ratingPrompt.ratedUserName}
              prompt={ratingPrompt.prompt}
              onSubmit={async (payload) => {
                const ok = await submitRating(payload)
                if (ok) setRatingPrompt(null)
              }}
              onSkip={() => setRatingPrompt(null)}
              disabled={loading}
            />
          </div>
        </div>
      ) : null}

      <p className="pageMeta" title={API_BASE_URL}>{he.apiLabel}: <span className="pageMetaUrl">{API_BASE_URL}</span></p>

      {activeTab === 'discover' ? (
        <section className="card cardPanel">
          <h2>{he.searchRidesTitle}</h2>
          <form onSubmit={searchRides}>
            <input ref={searchOriginRef} placeholder={mapsLoaded ? he.originPh : he.originPhShort} value={search.origin} onChange={(e) => { setSearch({ ...search, origin: e.target.value }); setSearchCoords((prev) => ({ ...prev, origin: null })) }} required />
            <input ref={searchDestinationRef} placeholder={mapsLoaded ? he.destPh : he.destPhShort} value={search.destination} onChange={(e) => { setSearch({ ...search, destination: e.target.value }); setSearchCoords((prev) => ({ ...prev, destination: null })) }} />
            <input type="datetime-local" value={search.departure_from} onChange={(e) => setSearch({ ...search, departure_from: e.target.value })} placeholder={he.departureFrom} />
            <input type="datetime-local" value={search.departure_to} onChange={(e) => setSearch({ ...search, departure_to: e.target.value })} placeholder={he.departureTo} />
            <input type="number" min="1" max="72" value={search.leaving_soon_hours} onChange={(e) => setSearch({ ...search, leaving_soon_hours: e.target.value })} placeholder={he.leavingSoonHours} />
            <select value={search.sort_by} onChange={(e) => setSearch({ ...search, sort_by: e.target.value })}>
              <option value="departure_asc">{he.sortDepartureAsc}</option>
              <option value="departure_desc">{he.sortDepartureDesc}</option>
              <option value="seats_desc">{he.sortSeatsDesc}</option>
              <option value="seats_asc">{he.sortSeatsAsc}</option>
            </select>
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
                  <div className="meta">{he.meetingTimeLabel}: {formatMeetingTime(item.departure_time)}</div>
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
                      <div className="meta">{he.meetingTimeLabel}: {formatMeetingTime(item.departure_time)}</div>
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
              <label className="fieldLabel">{he.publishMeetingTimeLabel}</label>
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
                    <div className="meta">{he.meetingTimeLabel}: {formatMeetingTime(item.departure_time)}</div>
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
                    <MatchDetails item={item} />
                    <TravelConfirmation item={item} />
                    {item.status === 'COMPLETED' && item.driver_id && !hasRated(item.driver_id) ? (
                      <div className="ratingCard">
                        <RatingForm
                          ratedUserId={item.driver_id}
                          ratedUserName={item.driver_name}
                          prompt={he.rateDriverPrompt}
                          onSubmit={async (payload) => {
                            const ok = await submitRating(payload)
                            if (ok) await loadMyRequests({ quiet: true })
                          }}
                          disabled={loading}
                        />
                      </div>
                    ) : null}
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
                    <MatchDetails item={item} showPassengerPhone />
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
          <section className="card cardPanel">
            <h2>{he.activeDriverRidesTitle}</h2>
            <button onClick={() => loadDriverActive()} disabled={!token || loading}>{he.loadPending}</button>
            <ul className="results">
              {driverActive.map((item) => (
                <li key={`active-${item.match_id}`}>
                  <div>
                    <strong>{he.matchLineDriver(item.match_id, item.ride_id, item.passenger_id)}</strong>
                    <MatchDetails item={item} showPassengerPhone />
                    <TravelConfirmation item={item} />
                  </div>
                  <div className="actionCol">
                    <button type="button" onClick={() => completeRide(item.match_id)} disabled={loading}>{he.completeRideBtn}</button>
                  </div>
                </li>
              ))}
            </ul>
            {!driverActive.length ? <p className="empty">{he.noActiveDriverRides}</p> : null}
          </section>
          <section className="card cardPanel">
            <h2>{he.walletTitle}</h2>
            <button onClick={() => loadCreditsLog()} disabled={!token || loading}>{he.loadWallet}</button>
            <ul className="results compact">
              {creditsLog.map((item) => (
                <li key={`credit-${item.id}`}>
                  <div className="rideBlock">
                    <strong>{item.delta >= 0 ? he.creditIn : he.creditOut}: {item.delta > 0 ? `+${item.delta}` : item.delta}</strong>
                    <div className="meta">{item.reason}</div>
                    <div className="meta">{he.atTime(item.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
            {!creditsLog.length ? <p className="empty">{he.emptyWallet}</p> : null}
          </section>
          <section className="card cardPanel">
            <h2>{he.notificationsTitle}</h2>
            <ul className="results compact">
              {notifications.map((item) => (
                <li key={item.id}>
                  <div className="rideBlock">
                    <strong>{item.text}</strong>
                    <div className="meta">{he.atTime(item.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
            {!notifications.length ? <p className="empty">{he.noNotifications}</p> : null}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default App
