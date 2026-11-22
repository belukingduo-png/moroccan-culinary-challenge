import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update } from 'firebase/database';

const APP_VERSION = "v5.1";

const firebaseConfig = {
  databaseURL: "https://zelligekitchen-default-rtdb.europe-west1.firebasedatabase.app"
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (e) {
  console.warn("Firebase error:", e);
}

const EMOJIS = ['🧑‍🍳', '👩‍🍳', '👨‍🍳', '🦊', '🐼', '🐱', '🦁', '🐸', '🐯', '🥐', '🥖', '🧀'];

const RANDOM_NAMES = [
  "Chef Zellige", "SaffronMaster", "BaguetteBoss", "TajineKing", "MintTeaPro",
  "CouscousChief", "HarissaHero", "OliveOven", "SpiceSamurai", "KitchenKnight"
];

const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍳', '🫖'];

const PLATFORMS = [
  { x: 80, y: 340, w: 160, h: 22 },
  { x: 300, y: 260, w: 200, h: 22 },
  { x: 560, y: 340, w: 180, h: 22 },
  { x: 780, y: 220, w: 160, h: 22 }
];

export default function App() {
  const [screen, setScreen] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [playerEmoji, setPlayerEmoji] = useState('🧑‍🍳');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting');
  const [logs, setLogs] = useState(['🔥 Zellige & Saffron 2.5D v5.1 Prêt']);
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));

  const [pos, setPos] = useState({ x: 100, y: 400 });
  const [vel, setVel] = useState({ x: 0, y: 0 });
  const [isGrounded, setIsGrounded] = useState(false);
  const [jumpsLeft, setJumpsLeft] = useState(2);
  const [animState, setAnimState] = useState('idle'); // idle, run, jump

  const posRef = useRef({ x: 100, y: 400 });
  const velRef = useRef({ x: 0, y: 0 });
  const keysPressed = useRef({});

  const backgroundParticles = useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      emoji: FALLING_EMOJIS_LIST[i % FALLING_EMOJIS_LIST.length],
      left: Math.random() * 100,
      duration: 5 + Math.random() * 5,
      delay: Math.random() * 4
    }));
  }, []);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRandomProfile = () => {
    const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    return { name, emoji };
  };

  const syncMyState = (newPos, currentAnim) => {
    if (db && roomCode && !isHost) {
      update(ref(db, `rooms/${roomCode}/players/${myId}`), {
        x: newPos.x,
        y: newPos.y,
        name: playerName,
        emoji: playerEmoji,
        anim: currentAnim
      });
    }
  };

  // Platformer physics loop
  useEffect(() => {
    if (gameState !== 'playing' || isHost) return;

    const gravity = 0.55;
    const friction = 0.82;
    const moveSpeed = 1.3;
    const floorY = 460;
    const maxWorldWidth = 1050; // Expanded world width so right side is not blocked

    const interval = setInterval(() => {
      let vx = velRef.current.x;
      let vy = velRef.current.y;
      let px = posRef.current.x;
      let py = posRef.current.y;
      let currentAnim = 'idle';

      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a'] || keysPressed.current['A']) {
        vx -= moveSpeed;
        currentAnim = 'run';
      }
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d'] || keysPressed.current['D']) {
        vx += moveSpeed;
        currentAnim = 'run';
      }

      vx *= friction;
      vy += gravity;

      px += vx;
      py += vy;

      let grounded = false;
      if (py >= floorY) {
        py = floorY;
        vy = 0;
        grounded = true;
      }

      PLATFORMS.forEach(plat => {
        if (
          px + 36 > plat.x &&
          px < plat.x + plat.w &&
          py + 44 >= plat.y &&
          py + 44 <= plat.y + 18 &&
          vy > 0
        ) {
          py = plat.y - 44;
          vy = 0;
          grounded = true;
        }
      });

      if (!grounded) {
        currentAnim = 'jump';
      }

      // Map boundaries
      if (px < 0) px = 0;
      if (px > maxWorldWidth - 44) px = maxWorldWidth - 44;

      posRef.current = { x: px, y: py };
      velRef.current = { x: vx, y: vy };
      setIsGrounded(grounded);
      setAnimState(currentAnim);

      setPos({ x: px, y: py });
      syncMyState({ x: px, y: py }, currentAnim);
    }, 20);

    return () => clearInterval(interval);
  }, [gameState, isHost]);

  // Keyboard controls & Double Jump
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing' || isHost) return;
      keysPressed.current[e.key] = true;

      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (isGrounded) {
          velRef.current.y = -11;
          setIsGrounded(false);
          setJumpsLeft(1);
        } else if (jumpsLeft > 0) {
          velRef.current.y = -10; // Double jump
          setJumpsLeft(0);
        }
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, isHost, isGrounded, jumpsLeft]);

  // Firebase sync
  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        setPlayers(data.players || {});
        if (data.logs) setLogs(data.logs);
      }
    });
    return () => unsubscribe();
  }, [roomCode]);

  const startShift = () => {
    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { status: 'playing' });
    }
  };

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const profile = getRandomProfile();
    setRoomCode(code);
    setIsHost(true);
    setPlayerName(profile.name);
    setPlayerEmoji(profile.emoji);
    setScreen('host_lobby');

    if (db) {
      set(ref(db, `rooms/${code}`), {
        status: 'waiting',
        logs: [`👑 Salon ${code} ouvert par l'Hôte`]
      });
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsHost(false);
    const profile = getRandomProfile();
    setPlayerName(profile.name);
    setPlayerEmoji(profile.emoji);
    setScreen('player_lobby');

    if (db) {
      set(ref(db, `rooms/${roomCode}/players/${myId}`), {
        name: profile.name,
        emoji: profile.emoji,
        x: 100,
        y: 400,
        anim: 'idle'
      });
    }
  };

  return (
    <div style={styles.appContainer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes fallAndSpin {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.1; }
        }
        .falling-emoji {
          position: fixed;
          top: -60px;
          font-size: 2.2rem;
          animation: fallAndSpin linear infinite;
          z-index: 1;
          pointer-events: none;
        }
      `}</style>

      {(screen === 'home' || screen === 'mode_select') && (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {backgroundParticles.map((p) => (
            <div key={p.id} className="falling-emoji" style={{ left: `${p.left}%`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}>
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      {/* HOME SCREEN */}
      {screen === 'home' && (
        <div style={styles.centeredWrapper}>
          <div style={styles.versionBadge}>{APP_VERSION}</div>
          <div style={styles.menuBox}>
            <h1 style={styles.mainTitle}>🍳 Zellige & Saffron</h1>
            <p style={styles.subTitle}>Platformer Co-op 2.5D</p>
            <button onClick={() => setScreen('mode_select')} style={styles.primaryBtn}>▶️ JOUER</button>
          </div>
        </div>
      )}

      {/* MODE SELECT */}
      {screen === 'mode_select' && (
        <div style={styles.centeredWrapper}>
          <div style={styles.versionBadge}>{APP_VERSION}</div>
          <div style={styles.menuBox}>
            <h1 style={styles.mainTitle}>🍳 Mode de Jeu</h1>
            <button onClick={createRoom} style={styles.primaryBtn}>👑 Héberger une Partie (Hôte)</button>
            <div style={styles.divider}><span>OU</span></div>
            <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                placeholder="CODE DE SALON"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={styles.input}
                required
              />
              <button type="submit" style={styles.secondaryBtn}>🎮 Rejoindre</button>
            </form>
            <button onClick={() => setScreen('home')} style={styles.backBtn}>⬅️ Retour</button>
          </div>
        </div>
      )}

      {/* HOST LOBBY */}
      {isHost && (
        <div style={styles.hostFullScreen}>
          <div style={styles.hostHeader}>
            <div style={styles.codeBadge}>🔑 Salon : <strong>{roomCode}</strong> <button onClick={copyRoomCode} style={styles.copyBtn}>{copied ? '✅' : '📋'}</button></div>
          </div>
          <div style={styles.hostGrid}>
            <div style={styles.panel}>
              <h3>👥 Chefs en Ligne ({Object.keys(players).length})</h3>
              {Object.keys(players).length === 0 ? <p style={{ color: '#94a3b8' }}>En attente de joueurs...</p> : (
                Object.keys(players).map(id => (
                  <div key={id} style={styles.playerItem}>
                    <span>{players[id].emoji} {players[id].name}</span>
                  </div>
                ))
              )}
            </div>
            <div style={styles.panel}>
              <h3>📜 Journal</h3>
              <div style={styles.logsBox}>{logs.map((l, i) => <div key={i}>{l}</div>)}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={startShift} style={styles.primaryBtn}>🚀 Démarrer la Partie</button>
          </div>
        </div>
      )}

      {/* PLAYER LOBBY */}
      {!isHost && gameState === 'waiting' && screen === 'player_lobby' && (
        <div style={styles.centeredWrapper}>
          <div style={styles.menuBox}>
            <h3>Salon : {roomCode}</h3>
            <p style={{ color: '#38bdf8', fontSize: '1.3rem', margin: '20px 0', fontWeight: '800' }}>{playerEmoji} {playerName}</p>
            <p style={{ color: '#94a3b8' }}>⏳ En attente du démarrage par l'hôte...</p>
          </div>
        </div>
      )}

      {/* ACTIVE GAME SCREEN */}
      {!isHost && gameState === 'playing' && (
        <div style={styles.gameContainer}>
          {/* Platforms */}
          {PLATFORMS.map((p, idx) => (
            <div key={idx} style={{ ...styles.platform, left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px` }} />
          ))}

          {/* Ground */}
          <div style={styles.ground} />

          {/* Render Players */}
          {Object.keys(players).map(pid => {
            const p = players[pid];
            const isMe = pid === myId;
            const px = isMe ? pos.x : (p.x || 100);
            const py = isMe ? pos.y : (p.y || 400);

            return (
              <div key={pid} style={{ ...styles.playerNode, left: `${px}px`, top: `${py}px` }}>
                <div style={{ fontSize: '2.4rem' }}>{p.emoji || playerEmoji}</div>
                <div style={styles.tag}>{p.name || playerName}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { width: '100vw', height: '100vh', overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #311033 50%, #1e1b4b 100%)', position: 'relative', color: '#fff' },
  versionBadge: { position: 'fixed', bottom: '12px', left: '16px', fontSize: '0.85rem', fontWeight: '800', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.4)', padding: '4px 10px', borderRadius: '8px', zIndex: 10 },
  centeredWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
  menuBox: { background: 'rgba(30, 27, 75, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', padding: '40px', borderRadius: '28px', textAlign: 'center', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' },
  mainTitle: { fontSize: '2.4rem', fontWeight: '900', color: '#fbbf24', margin: '0 0 10px 0' },
  subTitle: { fontSize: '1.1rem', color: '#cbd5e1', marginBottom: '30px' },
  primaryBtn: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.2rem', borderRadius: '14px', cursor: 'pointer', fontWeight: '800' },
  secondaryBtn: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.2rem', borderRadius: '14px', cursor: 'pointer', fontWeight: '800' },
  backBtn: { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', marginTop: '16px' },
  divider: { margin: '20px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.15)' },
  input: { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1.2rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.7)', color: '#fff' },
  hostFullScreen: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', padding: '24px', background: '#0f172a' },
  hostHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1e1b4b', borderRadius: '16px' },
  codeBadge: { fontSize: '1.3rem', fontWeight: '800', color: '#fbbf24' },
  copyBtn: { background: '#4338ca', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', marginLeft: '10px' },
  hostGrid: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0' },
  panel: { background: '#1e1b4b', borderRadius: '16px', padding: '20px', overflowY: 'auto' },
  playerItem: { background: '#0f172a', padding: '12px', borderRadius: '10px', marginBottom: '8px', fontWeight: '700' },
  logsBox: { background: '#0f172a', padding: '12px', borderRadius: '10px', fontSize: '0.95rem', color: '#cbd5e1', height: '200px', overflowY: 'auto' },
  gameContainer: { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #38bdf8 0%, #bae6fd 60%, #86efac 60%)' },
  platform: { position: 'absolute', background: '#15803d', border: '3px solid #166534', borderRadius: '8px', boxShadow: '0 6px 12px rgba(0,0,0,0.3)' },
  ground: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '80px', background: '#166534', borderTop: '6px solid #22c55e' },
  playerNode: { position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'top 0.05s linear, left 0.05s linear' },
  tag: { background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800', whiteSpace: 'nowrap' }
};