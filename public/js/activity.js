// Presence only contains paths, never query strings, fragments or signed URLs.
const client = window.__KD_SB__;
let sessionId = crypto.randomUUID();
try {
  sessionId = sessionStorage.getItem('kd_presence') || sessionId;
  sessionStorage.setItem('kd_presence', sessionId);
} catch { /* Presence still works when storage is unavailable. */ }

let pending = false;
let lastSent = 0;
let currentError = null;
let errorPath = null;
let lastError = null;

export function reportPlaybackError(code) {
  if (/^(http_[45]\d{2}|player_error|network_error)$/.test(code)) {
    currentError = code;
    errorPath = location.pathname.replace(/\/+$/, '') || '/';
    sendActivity();
  }
}

document.addEventListener('kd:playback-error', (event) => {
  if (typeof event.detail === 'string') reportPlaybackError(event.detail);
});

export async function sendActivity() {
  if (!client || pending || Date.now() - lastSent < 4000) return;
  pending = true;
  try {
    const { data } = await client.auth.getSession();
    if (!data?.session?.user) return;
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path.length > 200 || !/^\/([a-zA-Z0-9_-]+\/?)*$/.test(path)) return;
    const video = document.querySelector('.player-frame video');
    const player = /^\/assistir\/[^/]+\/\d+$/.test(path);
    if (errorPath !== path) currentError = null;
    let state = player ? 'player_open' : 'page';
    if (video) state = video.error ? 'error' : video.ended ? 'ended' : video.paused ? 'paused' : 'playing';
    if (currentError) state = 'error';
    const error = currentError;
    const { error: failure } = await client.rpc('record_viewer_presence', {
      p_session: sessionId,
      p_path: path,
      p_state: state,
      p_position: video && Number.isFinite(video.currentTime) ? Math.min(86400, Math.floor(video.currentTime)) : null,
      p_visible: !document.hidden,
      p_error: error,
    });
    if (!failure) {
      lastSent = Date.now();
      if (currentError === error) currentError = null;
      lastError = null;
    } else if (failure.code !== lastError) {
      lastError = failure.code;
      console.warn('KingDrama: acompanhamento de atividade temporariamente indisponível.');
    }
  } catch { /* A telemetry outage must not interrupt navigation or playback. */ }
  finally { pending = false; }
}

export async function clearActivity() {
  if (!client) return;
  const previousSession = sessionId;
  sessionId = crypto.randomUUID();
  try { sessionStorage.setItem('kd_presence', sessionId); } catch { /* Optional storage. */ }
  try {
    await client.rpc('record_viewer_presence', { p_session: previousSession, p_path: null })
      .abortSignal(AbortSignal.timeout(1500));
  }
  catch { /* Presence expires after 90 seconds. */ }
}

setInterval(sendActivity, 25000);
document.addEventListener('visibilitychange', sendActivity);
for (const event of ['play', 'pause', 'ended', 'error']) {
  document.addEventListener(event, (e) => {
    if (e.target instanceof HTMLVideoElement) sendActivity();
  }, true);
}
