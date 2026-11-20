import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, push } from 'firebase/database';

const APP_VERSION = "v2.0";

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

// Stations Setup with larger layout sizing and slots for current item
const STATIONS = [
  { id: 'crate_tomato', icon: '🍅', type: 'crate', item: '🍅', label: 'Caisse Tomate', x: 15, y: 20, color: '#ef4444' },
  { id: 'crate_chili', icon: '🌶️', type: 'crate', item: '🌶️', label: 'Caisse Piment', x: 15, y: 40, color: '#f97316' },
  { id: 'crate_chicken', icon: '🍗', type: 'crate', item: '🍗', label: 'Caisse Poulet', x: 15, y: 60, color: '#eab308' },
  { id: 'crate_garlic', icon: '🧄', type: 'crate', item: '🧄', label: 'Caisse Ail', x: 15, y: 80, color: '#a855f7' },

  { id: 'board_1', icon: '🔪', type: 'board', label: 'Découpe 1', x: 75, y: 25, color: '#3b82f6' },
  { id: 'board_2', icon: '🔪', type: 'board', label: 'Découpe 2', x: 75, y: 45, color: '#3b82f6' },

  { id: 'stove_1', icon: '🍲', type: 'stove', label: 'Tagine 1', x: 50, y: 75, color: '#f59e0b' },
  { id: 'stove_2', icon: '🍲', type: 'stove', label: 'Tagine 2', x: 75, y: 75, color: '#f59e0b' },

  { id: 'serve', icon: '🛎️', type: 'serve', label: 'Comptoir', x: 90, y: 50, color: '#10b981' },
];

const EMOJIS = [
  '🧑‍🍳', '👩‍🍳', '👨‍🍳', '🦊', '🐼', '🐱', '🦁', '🐸', 
  '🐯', '🥐', '🥖', '🧀', '🌶️', '🍅', '🍳', '🧄', '🥑', '🍋'
];

const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍳', '🧀'];

const RECIPES = [
  { title: "Salade Mechouia 🌶️", items: ["🌶️", "🍅"], cooked: "🍲" },
  { title: "Tagine de Poulet 🍗", items: ["🍗", "🧄", "🍅"], cooked: "🍲" }
];

export default function App() {
  const [screen, setScreen] = useState('profile');
  const [playerName, setPlayerName] = useState('');
  const [playerEmoji, setPlayerEmoji] = useState('🧑‍🍳');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting');
  const [countdown, setCountdown] = useState(3);
  const [endTime, setEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState(['🔥 Cuisine Prête']);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myId] = useState(() => 'chef_' + Math.random().toString(36).substring(2, 7));

  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [heldItem, setHeldItem] = useState('');
  const [myRecipe, setMyRecipe] = useState(RECIPES[0]);
  const [myContributions, setMyContributions] = useState(0);

  // Station specific state: { [stationId]: { progress, label, currentItem, readyItem } }
  const [stationStates, setStationStates] = useState({});

  const posRef = useRef({ x: 50, y: 50 });
  const heldRef = useRef('');
  const contribRef = useRef(0);
  const scoreRef = useRef(0);

  const backgroundParticles = useMemo(() => {
    return [...Array(18)].map((_, i) => ({
      id: i,
      emoji: FALLING_EMOJIS_LIST[i % FALLING_EMOJIS_LIST.length],
      left: Math.random() * 100,
      duration: 4 + Math.random() * 4,
      delay: Math.random() * 4
    }));
  }, []);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const syncMyState = (newPos, newItem, newContrib) => {
    if (db && roomCode && !isHost) {
      update(ref(db, `rooms/${roomCode}/players/${myId}`), {
        x: newPos.x,
        y: newPos.y,
        item: newItem,
        contributions: newContrib
      });
    }
  };

  const movePlayer = (dx, dy) => {
    if (gameState !== 'playing' || isHost) return;
    const nextX = Math.max(8, Math.min(95, posRef.current.x + dx));
    const nextY = Math.max(12, Math.min(90, posRef.current.y + dy));
    const updated = { x: nextX, y: nextY };
    posRef.current = updated;
    setPos(updated);
    syncMyState(updated, heldRef.current, contribRef.current);
  };

  const interactStation = () => {
    if (gameState !== 'playing' || isHost) return;
    const { x, y } = posRef.current;
    const nearby = STATIONS.find(s => Math.hypot(s.x - x, s.y - y) < 18);
    if (!nearby) return;

    let currentItem = heldRef.current;
    const stState = stationStates[nearby.id] || {};

    // 1. Crate: Take ingredient if hands are empty
    if (nearby.type === 'crate' && currentItem === '') {
      const item = nearby.item;
      heldRef.current = item;
      setHeldItem(item);
      addLog(`${playerEmoji} ${playerName} a pris ${item}`);
      syncMyState(posRef.current, item, contribRef.current);
    } 
    // 2. Cutting Board interaction
    else if (nearby.type === 'board') {
      // If finished item is waiting on the board, pick it up!
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        setStationStates(prev => ({ ...prev, [nearby.id]: { ...prev[nearby.id], readyItem: null } }));
        addLog(`${playerEmoji} ${playerName} a récupéré ${picked} découpé`);
        syncMyState(posRef.current, picked, contribRef.current);
      } 
      // If holding an item and board is free, place it down to start cutting (2s timer)
      else if (currentItem !== '' && !stState.progress && !stState.readyItem) {
        const itemToCut = currentItem;
        heldRef.current = '';
        setHeldItem('');
        syncMyState(posRef.current, '', contribRef.current);

        startStationAction(nearby.id, 2000, '🔪 Découpe...', itemToCut, (rawItem) => {
          const choppedMap = { '🍅': '🥗', '🌶️': '⚡', '🍗': '🍖', '🧄': '🧄' };
          return choppedMap[rawItem] || '🥗';
        });
      }
    } 
    // 3. Stove / Tagine Pot interaction
    else if (nearby.type === 'stove') {
      // If finished cooked dish is waiting, pick it up!
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        setStationStates(prev => ({ ...prev, [nearby.id]: { ...prev[nearby.id], readyItem: null } }));
        addLog(`${playerEmoji} ${playerName} a récupéré un plat chaud 🔥`);
        syncMyState(posRef.current, picked, contribRef.current);
      } 
      // If holding an item and stove is free, place it down to cook (4s timer)
      else if (currentItem !== '' && !stState.progress && !stState.readyItem) {
        const itemToCook = currentItem;
        heldRef.current = '';
        setHeldItem('');
        syncMyState(posRef.current, '', contribRef.current);

        startStationAction(nearby.id, 4000, '🍲 Cuisson...', itemToCook, () => '🍲');
      }
    } 
    // 4. Serving Counter
    else if (nearby.type === 'serve' && currentItem === '🍲') {
      heldRef.current = '';
      setHeldItem('');
      const newScore = scoreRef.current + 10;
      const newContrib = contribRef.current + 10;
      contribRef.current = newContrib;
      setMyContributions(newContrib);
      setScore(newScore);
      addLog(`${playerEmoji} ${playerName} a servi un plat avec succès ! (+10 pts) 🛎️`);
      if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore });
      syncMyState(posRef.current, '', contribRef.current);
    } 
    // Wrong step penalty
    else {
      const penaltyScore = Math.max(0, scoreRef.current - 5);
      setScore(penaltyScore);
      scoreRef.current = penaltyScore;
      if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: penaltyScore });
      addLog(`❌ ERREUR DE RECETTE ! ${playerName} a commis une erreur (-5 pts)`);
    }
  };

  const startStationAction = (stationId, duration, label, placedItem, getResultItem) => {
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;

    setStationStates(prev => ({
      ...prev,
      [stationId]: { progress: 0, label, currentItem: placedItem, readyItem: null }
    }));

    const timer = setInterval(() => {
      currentStep += 1;
      const progress = (currentStep / steps) * 100;

      setStationStates(prev => ({
        ...prev,
        [stationId]: { ...prev[stationId], progress }
      }));

      if (currentStep >= steps) {
        clearInterval(timer);
        const result = getResultItem(placedItem);
        setStationStates(prev => ({
          ...prev,
          [stationId]: { progress: 0, label: 'Prêt !', currentItem: null, readyItem: result }
        }));
      }
    }, intervalTime);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing' || isHost) return;
      const step = 4;
      if (['w', 'W', 'ArrowUp'].includes(e.key)) movePlayer(0, -step);
      if (['s', 'S', 'ArrowDown'].includes(e.key)) movePlayer(0, step);
      if (['a', 'A', 'ArrowLeft'].includes(e.key)) movePlayer(-step, 0);
      if (['d', 'D', 'ArrowRight'].includes(e.key)) movePlayer(step, 0);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        interactStation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isHost, stationStates]);

  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        const currentScore = data.score || 0;
        setScore(currentScore);
        scoreRef.current = currentScore;
        setPlayers(data.players || {});
        if (data.countdown !== undefined) setCountdown(data.countdown);
        if (data.endTime !== undefined) setEndTime(data.endTime);
        if (data.logs) setLogs(data.logs);
      }
    });

    const lbRef = ref(db, 'leaderboard');
    const unsubLb = onValue(lbRef, (snapshot) => {
      const lbData = snapshot.val();
      if (lbData) {
        const sorted = Object.values(lbData).sort((a, b) => b.score - a.score);
        setLeaderboard(sorted);
      }
    });

    return () => {
      unsubscribe();
      unsubLb();
    };
  }, [roomCode]);

  useEffect(() => {
    if (gameState !== 'playing' || !endTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (isHost && db && roomCode) {
          update(ref(db, `rooms/${roomCode}`), { status: 'gameover' });
          push(ref(db, 'leaderboard'), {
            room: roomCode,
            score: scoreRef.current,
            date: new Date().toLocaleDateString()
          });
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [gameState, endTime, isHost, roomCode]);

  const addLog = (msg) => {
    const newLogs = [msg, ...logs.slice(0, 20)];
    setLogs(newLogs);
    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { logs: newLogs });
    }
  };

  const startShift = () => {
    if (Object.keys(players).length < 2) {
      alert('⚠️ Minimum 2 Chefs requis !');
      return;
    }

    setMyContributions(0);
    contribRef.current = 0;

    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { status: 'countdown', countdown: 3, score: 0 });
    }

    let count = 3;
    const cdInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { countdown: count });
      } else {
        clearInterval(cdInterval);
        const targetEnd = Date.now() + 60000;
        if (db && roomCode) {
          update(ref(db, `rooms/${roomCode}`), { status: 'playing', countdown: 0, endTime: targetEnd });
        }
      }
    }, 1000);
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    const recipeIndex = Math.abs(playerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % RECIPES.length;
    setMyRecipe(RECIPES[recipeIndex]);
    setScreen('menu');
  };

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomCode(code);
    setIsHost(true);
    setScreen('host_lobby');
    if (db) {
      set(ref(db, `rooms/${code}`), {
        status: 'waiting',
        score: 0,
        logs: [`👑 ${playerName} a créé la cuisine ${code}`]
      });
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsHost(false);
    setScreen('player_lobby');
    if (db) {
      set(ref(db, `rooms/${roomCode}/players/${myId}`), {
        name: playerName,
        emoji: playerEmoji,
        x: 50,
        y: 50,
        item: '',
        contributions: 0
      });
    }
  };

  return (
    <div style={styles.appContainer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        @keyframes smoothFadeIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popScale {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fallAndSpinSmooth {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.1; }
        }
        @keyframes knifeChopping {
          0% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(-25deg) translateY(-6px); }
          100% { transform: rotate(0deg) translateY(0); }
        }
        @keyframes bubblingPot {
          0% { transform: scale(1); }
          50% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .screen-anim { animation: smoothFadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .countdown-num { animation: popScale 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .knife-anim { animation: knifeChopping 0.3s ease-in-out infinite; }
        .stove-anim { animation: bubblingPot 0.6s ease-in-out infinite; }
        .falling-emoji {
          position: fixed;
          top: -60px;
          font-size: 2.2rem;
          animation: fallAndSpinSmooth linear infinite;
          z-index: 1;
          pointer-events: none;
        }
        button { transition: transform 0.2s, filter 0.2s; user-select: none; }
        button:active { transform: scale(0.93); }
      `}</style>

      {(screen === 'profile' || screen === 'menu') && (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {backgroundParticles.map((p) => (
            <div
              key={p.id}
              className="falling-emoji"
              style={{
                left: `${p.left}%`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      {screen === 'profile' && (
        <div key="profile" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.versionBadge}>{APP_VERSION}</div>
          <div style={styles.menuBox}>
            <h1 style={styles.mainGameTitle}>🍳 Zellige & Saffron 🌶️</h1>
            <p style={styles.subSubtitle}>🧑‍🍳 Identité du Chef</p>
            <form onSubmit={handleProfileSubmit} style={styles.form}>
              <input
                type="text"
                placeholder="Votre nom..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={styles.input}
                required
              />
              <div style={styles.emojiGrid}>
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setPlayerEmoji(em)}
                    style={{
                      ...styles.emojiBtn,
                      borderColor: playerEmoji === em ? '#10b981' : 'rgba(255,255,255,0.1)',
                      background: playerEmoji === em ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.6)'
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <button type="submit" style={styles.primaryButton}>Continuer ➡️</button>
            </form>
          </div>
        </div>
      )}

      {screen === 'menu' && (
        <div key="menu" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.menuBox}>
            <div style={styles.heroBadge}>Bienvenue, {playerEmoji} {playerName}</div>
            <h1 style={styles.mainGameTitle}>🍳 Zellige & Saffron</h1>
            <button onClick={createRoom} style={styles.primaryButton}>👑 Héberger la Cuisine</button>
            <div style={styles.divider}><span style={styles.dividerText}>OU</span></div>
            <form onSubmit={joinRoom} style={styles.form}>
              <input
                type="text"
                placeholder="CODE DE SALON"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={styles.input}
                required
              />
              <button type="submit" style={styles.secondaryButton}>🧑‍🍳 Rejoindre</button>
            </form>
          </div>
        </div>
      )}

      {isHost && (
        <div key="host" className="screen-anim" style={styles.hostFullScreen}>
          <div style={styles.hostHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={styles.codeBadge}>🔑 <strong>{roomCode}</strong></div>
              <button onClick={copyRoomCode} style={styles.copyBtn} title="Copier le code">
                {copied ? '✅' : '📋'}
              </button>
            </div>
            <div style={styles.scoreBoard}>🪙 {score}</div>
            <div style={styles.codeBadge}>⏱️ {gameState === 'playing' ? `${timeLeft}s` : '60s'}</div>
          </div>

          <div style={styles.hostMainGrid}>
            <div style={styles.dashPanel}>
              <h3 style={styles.panelTitle}>🧑‍🍳 Chefs Actifs ({Object.keys(players).length} / Min 2)</h3>
              <ul style={styles.playerList}>
                {Object.keys(players).length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', marginTop: '30px' }}>En attente de chefs...</p>
                ) : (
                  Object.keys(players).map((pid) => (
                    <li key={pid} style={styles.playerItem}>
                      <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>{players[pid].emoji} {players[pid].name}</span>
                      <span style={{ color: '#34d399', fontWeight: '700', fontSize: '1.05rem' }}>{players[pid].contributions || 0} pts</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div style={styles.dashPanel}>
              <h3 style={styles.panelTitle}>📜 Journal & Erreurs de Cuisine</h3>
              <div style={styles.logsBox}>
                {logs.map((lg, idx) => (
                  <div key={idx} style={{ ...styles.logLine, color: lg.includes('ERREUR') ? '#ef4444' : '#cbd5e1' }}>{lg}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.hostFooter}>
            {gameState === 'waiting' || gameState === 'gameover' ? (
              <button
                onClick={startShift}
                style={{
                  ...styles.primaryButton,
                  maxWidth: '400px',
                  fontSize: '1.2rem',
                  background: Object.keys(players).length < 2 ? '#374151' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  cursor: Object.keys(players).length < 2 ? 'not-allowed' : 'pointer'
                }}
              >
                {gameState === 'gameover' ? '🔄 Relancer le Service' : `🚀 Démarrer (${Object.keys(players).length}/2)`}
              </button>
            ) : (
              <div style={{ color: '#34d399', fontWeight: '800', fontSize: '1.2rem' }}>🔥 Service en Cours !</div>
            )}
          </div>
        </div>
      )}

      {!isHost && gameState === 'waiting' && screen === 'player_lobby' && (
        <div key="wait" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.lobbyCard}>
            <div style={styles.codeBadge}>🔑 <strong>{roomCode}</strong></div>
            <h2 style={{ margin: '12px 0', fontSize: '1.6rem' }}>{playerEmoji} {playerName}</h2>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '15px', color: '#cbd5e1', fontWeight: '600' }}>⏳ En attente du Chef Principal...</p>
          </div>
        </div>
      )}

      {gameState === 'countdown' && (
        <div style={styles.countdownOverlay}>
          <div key={countdown} className="countdown-num" style={styles.countdownText}>
            {countdown > 0 ? countdown : '🔥 C’EST PARTI !'}
          </div>
        </div>
      )}

      {/* ACTIVE GAMEPLAY SCREEN */}
      {!isHost && gameState === 'playing' && (
        <div key="play" className="screen-anim" style={styles.gameContainer}>
          <header style={styles.header}>
            <div style={styles.headerItem}>⏱️ <strong style={{ color: timeLeft <= 10 ? '#ef4444' : '#fff' }}>{timeLeft}s</strong></div>
            <div style={styles.scoreBoard}>🪙 {score}</div>
            <div style={styles.headerItem}>🤲 <span style={{ fontSize: '1.4rem' }}>{heldItem || '➖'}</span></div>
          </header>

          <div style={styles.activeLayout}>
            {/* Left Caisse Array */}
            <div style={styles.recipeSidebar}>
              <h4 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '0.95rem' }}>📦 Caisse & Ingrédients :</h4>
              <div style={styles.recipeCardItem}>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.8' }}>
                  🍅 <strong>Tomate</strong><br/>
                  🌶️ <strong>Piment</strong><br/>
                  🍗 <strong>Poulet</strong><br/>
                  🧄 <strong>Ail</strong>
                </div>
              </div>
            </div>

            {/* Kitchen Floor (Larger Sized Stations) */}
            <div style={styles.kitchenFloor}>
              {STATIONS.map((st) => {
                const stState = stationStates[st.id] || {};
                const isWorking = stState.progress > 0;
                const isReady = !!stState.readyItem;

                return (
                  <div
                    key={st.id}
                    style={{
                      ...styles.station,
                      left: `${st.x}%`,
                      top: `${st.y}%`,
                      background: st.color,
                      borderColor: isReady ? '#34d399' : (isWorking ? '#fbbf24' : 'rgba(255,255,255,0.2)')
                    }}
                  >
                    {/* Animated Knife for Boards when working */}
                    <div className={st.type === 'board' && isWorking ? 'knife-anim' : ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className={st.type === 'stove' && isWorking ? 'stove-anim' : ''} style={{ fontSize: '2.2rem' }}>
                        {st.icon}
                      </span>
                    </div>

                    <span style={styles.stationLabel}>{st.label}</span>

                    {/* Display item currently cooking/cutting inside or on the station */}
                    {stState.currentItem && (
                      <div style={styles.stationItemBadge}>
                        {stState.currentItem}
                      </div>
                    )}

                    {/* Display ready finished item waiting for pickup */}
                    {isReady && (
                      <div style={styles.readyItemBadge}>
                        {stState.readyItem} ✨
                      </div>
                    )}

                    {/* Progress Bar for Station Actions */}
                    {isWorking && (
                      <div style={styles.stationTimerBadge}>
                        <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: '700' }}>{stState.label}</div>
                        <div style={styles.miniTrack}>
                          <div style={{ ...styles.miniFill, width: `${stState.progress}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {Object.keys(players).map((pid) => {
                const p = players[pid];
                const isMe = pid === myId;
                const px = isMe ? pos.x : (p.x || 50);
                const py = isMe ? pos.y : (p.y || 50);
                const pItem = isMe ? heldItem : p.item;

                return (
                  <div
                    key={pid}
                    style={{
                      ...styles.playerNode,
                      left: `${px}%`,
                      top: `${py}%`,
                      border: isMe ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    {pItem && <div style={styles.heldBubble}>{pItem}</div>}
                    <div style={{ fontSize: '2rem' }}>{p.emoji}</div>
                    <div style={styles.playerTag}>{p.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.mobileControls}>
            <div style={styles.dpad}>
              <div></div>
              <button onClick={() => movePlayer(0, -6)} style={styles.dpadBtn}>⬆️</button>
              <div></div>
              <button onClick={() => movePlayer(-6, 0)} style={styles.dpadBtn}>⬅️</button>
              <button onClick={() => movePlayer(0, 6)} style={styles.dpadBtn}>⬇️</button>
              <button onClick={() => movePlayer(6, 0)} style={styles.dpadBtn}>➡️</button>
            </div>
            <button onClick={interactStation} style={styles.actionBigBtn}>⚡</button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && !isHost && (
        <div key="over" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.resultsCard}>
            <h2 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '1.6rem' }}>🏁 Service Terminé !</h2>
            <p style={{ fontSize: '1.2rem', margin: '5px 0' }}>Score d’Équipe : <strong>🪙 {score}</strong></p>
            <p style={{ color: '#34d399', fontSize: '1rem', fontWeight: '600' }}>Votre Contribution : {myContributions} pts</p>

            <div style={{ marginTop: '15px', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#94a3b8' }}>📊 Classement Global (1 min) :</h4>
              <div style={styles.lbBox}>
                {leaderboard.map((entry, idx) => (
                  <div key={idx} style={{ ...styles.lbItem, background: entry.room === roomCode ? 'rgba(16, 185, 129, 0.25)' : 'transparent' }}>
                    <span style={{ fontWeight: '600' }}>#{idx + 1} Salon {entry.room}</span>
                    <span style={{ color: '#38bdf8', fontWeight: '700' }}>🪙 {entry.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => window.location.reload()} style={{ ...styles.primaryButton, marginTop: '15px' }}>
              🔄 Rejouer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { width: '100vw', height: '100vh', overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #311033 50%, #1e1b4b 100%)', color: '#fff', position: 'relative' },
  versionBadge: { position: 'fixed', bottom: '10px', left: '14px', fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.45)', background: 'rgba(0, 0, 0, 0.35)', padding: '3px 8px', borderRadius: '6px', zIndex: 100, pointerEvents: 'none', letterSpacing: '0.5px' },
  centeredWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box' },
  heroBadge: { background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '5px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px' },
  mainGameTitle: { fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', margin: '0 0 5px 0', fontWeight: '900', textAlign: 'center', color: '#fbbf24', textShadow: '0 2px 12px rgba(251, 191, 36, 0.3)' },
  subSubtitle: { fontSize: '1.35rem', color: '#cbd5e1', marginBottom: '25px', fontWeight: '700', textAlign: 'center' },
  menuBox: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '45px 40px', borderRadius: '30px', textAlign: 'center', width: '100%', maxWidth: '620px', boxSizing: 'border-box', zIndex: 2, boxShadow: '0 30px 60px rgba(0,0,0,0.6)' },
  lobbyCard: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '40px 35px', borderRadius: '26px', textAlign: 'center', width: '100%', maxWidth: '480px', boxSizing: 'border-box', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' },
  resultsCard: { background: 'rgba(30, 27, 75, 0.9)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '35px', borderRadius: '26px', textAlign: 'center', width: '100%', maxWidth: '500px', boxSizing: 'border-box', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' },
  
  hostFullScreen: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', padding: '20px 30px', boxSizing: 'border-box', background: 'rgba(15, 23, 42, 0.6)' },
  hostHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', background: 'rgba(30, 27, 75, 0.85)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' },
  hostMainGrid: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0', minHeight: 0 },
  hostFooter: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 0' },
  dashPanel: { background: 'rgba(30, 27, 75, 0.75)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  panelTitle: { margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '700', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' },
  logsBox: { flex: 1, overflowY: 'auto', background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '10px' },
  logLine: { fontSize: '0.95rem', marginBottom: '6px', lineHeight: '1.4' },
  copyBtn: { background: 'rgba(99, 102, 241, 0.25)', border: '1px solid #6366f1', color: '#fff', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.1rem' },

  codeBadge: { background: '#4338ca', padding: '8px 16px', borderRadius: '10px', fontSize: '1.2rem', letterSpacing: '2px', border: '1px solid #6366f1', fontWeight: '700' },
  playerList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 },
  playerItem: { background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' },
  lbBox: { maxHeight: '140px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '8px', border: '1px solid rgba(255,255,255,0.1)' },
  lbItem: { display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '4px' },
  emojiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', margin: '20px 0' },
  emojiBtn: { fontSize: '1.6rem', padding: '12px', borderRadius: '14px', border: '1px solid', cursor: 'pointer' },
  primaryButton: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.15rem', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryButton: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.15rem', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold' },
  divider: { margin: '20px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  dividerText: { position: 'absolute', top: '-9px', left: '50%', transform: 'translateX(-50%)', background: '#221a40', padding: '0 8px', fontSize: '0.75rem', color: '#94a3b8' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  input: { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1.1rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', boxSizing: 'border-box' },
  spinner: { width: '36px', height: '36px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1.2s linear infinite', margin: '0 auto' },
  countdownOverlay: { position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  countdownText: { fontSize: '5rem', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 40px rgba(251, 191, 36, 0.6)', textAlign: 'center' },
  
  gameContainer: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#090d16', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#111827', borderBottom: '1px solid #1f2937' },
  headerItem: { background: '#1f2937', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', fontWeight: '600' },
  scoreBoard: { fontSize: '1.3rem', color: '#38bdf8', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' },
  
  activeLayout: { flex: 1, display: 'flex', overflow: 'hidden', padding: '10px', gap: '10px' },
  recipeSidebar: { width: '220px', background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '15px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  recipeCardItem: { background: 'rgba(30, 41, 59, 0.7)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' },

  kitchenFloor: { flex: 1, position: 'relative', background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', border: '2px dashed #334155', overflow: 'hidden' },
  
  // Upgraded larger station dimensions
  station: { position: 'absolute', transform: 'translate(-50%, -50%)', width: '84px', height: '84px', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.25)' },
  stationLabel: { fontSize: '0.65rem', fontWeight: '700', color: '#fff', marginTop: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' },
  
  stationItemBadge: { position: 'absolute', top: '-14px', right: '-8px', background: '#334155', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', border: '2px solid #fbbf24', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' },
  readyItemBadge: { position: 'absolute', top: '-16px', right: '-10px', background: '#10b981', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', border: '2px solid #fff', boxShadow: '0 0 12px rgba(16, 185, 129, 0.8)', animation: 'popScale 0.4s ease-out' },

  stationTimerBadge: { position: 'absolute', bottom: '-26px', background: '#1e293b', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', width: '92px', textAlign: 'center', zIndex: 20 },
  miniTrack: { width: '100%', height: '5px', background: '#0f172a', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' },
  miniFill: { height: '100%', background: 'linear-gradient(90deg, #f59e0b, #10b981)' },

  playerNode: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: '16px', transition: 'left 0.1s linear, top 0.1s linear', zIndex: 10 },
  heldBubble: { position: 'absolute', top: '-30px', background: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '2px solid #f59e0b' },
  playerTag: { fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', whiteSpace: 'nowrap' },

  mobileControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 25px', background: '#111827', borderTop: '1px solid #1f2937' },
  dpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gridTemplateRows: 'repeat(2, 44px)', gap: '4px' },
  dpadBtn: { background: '#334155', border: 'none', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBigBtn: { width: '68px', height: '68px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', fontSize: '1.8rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' }
};