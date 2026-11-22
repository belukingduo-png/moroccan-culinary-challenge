import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update } from 'firebase/database';

const APP_VERSION = "v5.7";

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

const RANDOM_NAMES = [
  "Chef Zellige", "SaffronMaster", "BaguetteBoss", "TajineKing", "MintTeaPro",
  "CouscousChief", "HarissaHero", "OliveOven", "SpiceSamurai", "KitchenKnight"
];

const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍳', '🫖'];

const WORLD_WIDTH = 2400;
const GROUND_HEIGHT = 80;
const HITBOX_HALF_W = 18;

const PLATFORM_LAYOUT = [
  { x: 180, offsetFromGround: 130, w: 180, h: 24 },
  { x: 440, offsetFromGround: 230, w: 200, h: 24 },
  { x: 720, offsetFromGround: 140, w: 180, h: 24 },
  { x: 980, offsetFromGround: 260, w: 220, h: 24 },
  { x: 1300, offsetFromGround: 170, w: 200, h: 24 },
  { x: 1600, offsetFromGround: 270, w: 180, h: 24 },
  { x: 1880, offsetFromGround: 180, w: 240, h: 24 }
];

// Exact pixel coordinates mapped to Chef W2.png (Row 1, col 5 is parachute)
const SPRITE_STATES = {
  idle: [{ x: 35, y: 18, w: 34, h: 42 }],                    // 1 frame standing
  run: [{ x: 35, y: 112, w: 36, h: 42 }, { x: 74, y: 112, w: 36, h: 42 }], // 2 frames running
  jump: [{ x: 28, y: 160, w: 42, h: 38 }],                   // 1 frame jumping up
  fall: [{ x: 188, y: 14, w: 46, h: 46 }]                    // 1 frame parachute falling
};

function ChefSprite({ anim = 'idle', facingRight = true, frameTick = 0 }) {
  const frames = SPRITE_STATES[anim] || SPRITE_STATES.idle;
  const f = frames[frameTick % frames.length];
  const scale = 1.4;

  return (
    <div
      style={{
        width: `${f.w * scale}px`,
        height: `${f.h * scale}px`,
        overflow: 'hidden',
        position: 'relative',
        transform: facingRight ? 'scaleX(1)' : 'scaleX(-1)',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))'
      }}
    >
      <img
        src="/chef_sprite.png"
        alt="Chef"
        style={{
          position: 'absolute',
          left: `${-f.x * scale}px`,
          top: `${-f.y * scale}px`,
          width: `${296 * scale}px`,
          height: `${256 * scale}px`,
          imageRendering: 'pixelated',
          maxWidth: 'none',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting');
  const [logs, setLogs] = useState(['🔥 Zellige & Saffron 2.5D v5.7 Prêt']);
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));

  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const initialFloorY = window.innerHeight - GROUND_HEIGHT;

  const [pos, setPos] = useState({ x: 140, y: initialFloorY });
  const [isGrounded, setIsGrounded] = useState(true);
  const [jumpsLeft, setJumpsLeft] = useState(2);
  const [animState, setAnimState] = useState('idle');
  const [facingRight, setFacingRight] = useState(true);
  const [frameTick, setFrameTick] = useState(0);

  const posRef = useRef({ x: 140, y: initialFloorY });
  const velRef = useRef({ x: 0, y: 0 });
  const groundedRef = useRef(true);
  const jumpsRef = useRef(2);
  const facingRef = useRef(true);
  const keysPressed = useRef({});
  const viewportRef = useRef(viewport);

  const backgroundParticles = useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      emoji: FALLING_EMOJIS_LIST[i % FALLING_EMOJIS_LIST.length],
      left: Math.random() * 100,
      duration: 5 + Math.random() * 5,
      delay: Math.random() * 4
    }));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const nextVp = { w: window.innerWidth, h: window.innerHeight };
      setViewport(nextVp);
      viewportRef.current = nextVp;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const animTimer = setInterval(() => {
      setFrameTick(prev => prev + 1);
    }, 140);
    return () => clearInterval(animTimer);
  }, []);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRandomName = () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];

  const syncMyState = (newPos, floorY, currentAnim, isRight) => {
    if (db && roomCode && !isHost) {
      update(ref(db, `rooms/${roomCode}/players/${myId}`), {
        x: newPos.x,
        heightAboveGround: Math.max(0, floorY - newPos.y),
        name: playerName,
        anim: currentAnim,
        facingRight: isRight
      });
    }
  };

  useEffect(() => {
    if (gameState !== 'playing' || isHost) return;

    const gravity = 0.65;
    const friction = 0.82;
    const moveSpeed = 1.45;

    const interval = setInterval(() => {
      const floorY = viewportRef.current.h - GROUND_HEIGHT;
      let vx = velRef.current.x;
      let vy = velRef.current.y;
      let px = posRef.current.x;
      let prevY = posRef.current.y;
      let py = prevY;
      let currentAnim = 'idle';
      let isRight = facingRef.current;

      const movingLeft = keysPressed.current['ArrowLeft'] || keysPressed.current['a'] || keysPressed.current['A'];
      const movingRight = keysPressed.current['ArrowRight'] || keysPressed.current['d'] || keysPressed.current['D'];

      if (movingLeft) {
        vx -= moveSpeed;
        isRight = false;
      }
      if (movingRight) {
        vx += moveSpeed;
        isRight = true;
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
        jumpsRef.current = 2;
      }

      if (vy >= 0) {
        for (let i = 0; i < PLATFORM_LAYOUT.length; i++) {
          const plat = PLATFORM_LAYOUT[i];
          const platTop = floorY - plat.offsetFromGround;
          const withinX = px + HITBOX_HALF_W > plat.x && px - HITBOX_HALF_W < plat.x + plat.w;
          const crossedTop = prevY <= platTop + 4 && py >= platTop;

          if (withinX && crossedTop) {
            py = platTop;
            vy = 0;
            grounded = true;
            jumpsRef.current = 2;
            break;
          }
        }
      }

      if (!grounded) {
        currentAnim = vy < 0 ? 'jump' : 'fall';
      } else if (Math.abs(vx) > 0.25 && (movingLeft || movingRight)) {
        currentAnim = 'run';
      } else {
        currentAnim = 'idle';
      }

      if (px < HITBOX_HALF_W) px = HITBOX_HALF_W;
      if (px > WORLD_WIDTH - HITBOX_HALF_W) px = WORLD_WIDTH - HITBOX_HALF_W;

      posRef.current = { x: px, y: py };
      velRef.current = { x: vx, y: vy };
      groundedRef.current = grounded;
      facingRef.current = isRight;

      setPos({ x: px, y: py });
      setIsGrounded(grounded);
      setJumpsLeft(jumpsRef.current);
      setAnimState(currentAnim);
      setFacingRight(isRight);

      syncMyState({ x: px, y: py }, floorY, currentAnim, isRight);
    }, 20);

    return () => clearInterval(interval);
  }, [gameState, isHost]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing' || isHost) return;
      keysPressed.current[e.key] = true;

      if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && jumpsRef.current > 0) {
        e.preventDefault();
        velRef.current.y = -13;
        jumpsRef.current -= 1;
        setJumpsLeft(jumpsRef.current);
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
  }, [gameState, isHost]);

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
    const name = getRandomName();
    setRoomCode(code);
    setIsHost(true);
    setPlayerName(name);
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
    const name = getRandomName();
    setPlayerName(name);
    const spawnFloor = window.innerHeight - GROUND_HEIGHT;
    posRef.current = { x: 140, y: spawnFloor };
    setPos({ x: 140, y: spawnFloor });
    setScreen('player_lobby');

    if (db) {
      set(ref(db, `rooms/${roomCode}/players/${myId}`), {
        name: name,
        x: 140,
        heightAboveGround: 0,
        anim: 'idle',
        facingRight: true
      });
    }
  };

  const floorY = viewport.h - GROUND_HEIGHT;
  const cameraX = Math.max(0, Math.min(WORLD_WIDTH - viewport.w, pos.x - viewport.w / 2));

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
                    <span>👨‍🍳 {players[id].name}</span>
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

      {!isHost && gameState === 'waiting' && screen === 'player_lobby' && (
        <div style={styles.centeredWrapper}>
          <div style={styles.menuBox}>
            <h3>Salon : {roomCode}</h3>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
              <ChefSprite anim="idle" facingRight={true} frameTick={frameTick} />
            </div>
            <p style={{ color: '#38bdf8', fontSize: '1.3rem', margin: '10px 0 20px 0', fontWeight: '800' }}>{playerName}</p>
            <p style={{ color: '#94a3b8' }}>⏳ En attente du démarrage par l'hôte...</p>
          </div>
        </div>
      )}

      {!isHost && gameState === 'playing' && (
        <div style={styles.gameContainer}>
          <div style={styles.hudBar}>
            <span>📍 Position: {Math.round(pos.x)}m</span>
            <span>🦘 Sauts: {jumpsLeft}/2</span>
          </div>

          <div
            style={{
              ...styles.worldLayer,
              width: `${WORLD_WIDTH}px`,
              transform: `translateX(-${cameraX}px)`
            }}
          >
            <div style={{ ...styles.cloud, left: '150px', top: '60px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '620px', top: '90px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '1150px', top: '50px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '1750px', top: '85px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '2150px', top: '55px' }}>☁️</div>

            <div style={{ ...styles.bush, left: '80px', width: '110px' }} />
            <div style={{ ...styles.bush, left: '650px', width: '140px' }} />
            <div style={{ ...styles.bush, left: '1220px', width: '120px' }} />
            <div style={{ ...styles.bush, left: '1850px', width: '160px' }} />

            {PLATFORM_LAYOUT.map((p, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.platform,
                  left: `${p.x}px`,
                  top: `${floorY - p.offsetFromGround}px`,
                  width: `${p.w}px`,
                  height: `${p.h}px`
                }}
              />
            ))}

            <div style={styles.ground} />

            {/* Local Player Render */}
            <div style={{ ...styles.playerNode, left: `${pos.x}px`, top: `${pos.y}px` }}>
              <div style={{ ...styles.tag, border: '1.5px solid #fbbf24' }}>{playerName}</div>
              <ChefSprite anim={animState} facingRight={facingRight} frameTick={frameTick} />
            </div>

            {/* Remote Players Render */}
            {Object.keys(players)
              .filter(pid => pid !== myId)
              .map(pid => {
                const p = players[pid];
                const px = p.x || 140;
                const py = floorY - (p.heightAboveGround || 0);
                const pAnim = p.anim || 'idle';
                const pFacing = p.facingRight !== undefined ? p.facingRight : true;

                return (
                  <div key={pid} style={{ ...styles.playerNode, left: `${px}px`, top: `${py}px` }}>
                    <div style={styles.tag}>{p.name}</div>
                    <ChefSprite anim={pAnim} facingRight={pFacing} frameTick={frameTick} />
                  </div>
                );
              })}
          </div>
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
  gameContainer: { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 65%, #bae6fd 100%)' },
  hudBar: { position: 'fixed', top: '16px', left: '20px', zIndex: 50, display: 'flex', gap: '16px', background: 'rgba(15, 23, 42, 0.8)', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.15)' },
  worldLayer: { position: 'absolute', top: 0, left: 0, height: '100vh' },
  cloud: { position: 'absolute', fontSize: '4.5rem', opacity: 0.9, pointerEvents: 'none' },
  bush: { position: 'absolute', bottom: '80px', height: '36px', background: '#4ade80', border: '3px solid #16a34a', borderRadius: '12px 12px 0 0' },
  platform: { position: 'absolute', background: '#22c55e', border: '3px solid #15803d', borderRadius: '10px', boxShadow: '0 8px 16px rgba(0,0,0,0.25)' },
  ground: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '80px', background: 'repeating-linear-gradient(45deg, #451a03, #451a03 16px, #78350f 16px, #78350f 32px)', borderTop: '8px solid #22c55e' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 },
  tag: { background: 'rgba(15, 23, 42, 0.85)', padding: '3px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800', whiteSpace: 'nowrap', marginBottom: '4px' }
};