import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, push } from 'firebase/database';

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

const STATIONS = [
  { id: 'crate', icon: '🍅', label: '🍅', x: 20, y: 25, color: '#ef4444' },
  { id: 'board', icon: '🔪', label: '🔪', x: 80, y: 25, color: '#3b82f6' },
  { id: 'stove', icon: '🍲', label: '🔥', x: 20, y: 75, color: '#f59e0b' },
  { id: 'serve', icon: '🛎️', label: '🛎️', x: 80, y: 75, color: '#10b981' },
];

export default function App() {
  const [screen, setScreen] = useState('profile');
  const [playerName, setPlayerName] = useState('');
  const [playerEmoji, setPlayerEmoji] = useState('🧑‍🍳');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting'); // waiting, countdown, playing, gameover
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState(['🔥 Kitchen Ready']);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myId] = useState(() => 'chef_' + Math.random().toString(36).substring(2, 7));

  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [heldItem, setHeldItem] = useState('');
  const [myContributions, setMyContributions] = useState(0);
  const posRef = useRef({ x: 50, y: 50 });
  const heldRef = useRef('');
  const contribRef = useRef(0);

  const emojis = [
    '🧑‍🍳', '👩‍🍳', '👨‍🍳', '🦊', '🐼', '🐱', '🦁', '🐸', 
    '🐯', '🥐', '🥖', '🧀', '🌶️', '🍅', '🍳', '🧄', '🥑', '🍋'
  ];

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
    const nextX = Math.max(8, Math.min(92, posRef.current.x + dx));
    const nextY = Math.max(12, Math.min(88, posRef.current.y + dy));
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

    let nextItem = heldRef.current;

    if (nearby.id === 'crate' && nextItem === '') {
      nextItem = '🍅';
      addLog(`${playerEmoji} ${playerName} ➔ 🍅`);
    } else if (nearby.id === 'board' && nextItem === '🍅') {
      nextItem = '🥗';
      addLog(`${playerEmoji} ${playerName} 🔪 ➔ 🥗`);
    } else if (nearby.id === 'stove' && nextItem === '🥗') {
      nextItem = '🍲';
      addLog(`${playerEmoji} ${playerName} 🔥 ➔ 🍲`);
    } else if (nearby.id === 'serve' && nextItem === '🍲') {
      nextItem = '';
      const newScore = score + 10;
      const newContrib = contribRef.current + 10;
      contribRef.current = newContrib;
      setMyContributions(newContrib);
      setScore(newScore);
      addLog(`${playerEmoji} ${playerName} 🛎️ +10 🪙`);
      if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore });
    }

    if (nextItem !== heldRef.current) {
      heldRef.current = nextItem;
      setHeldItem(nextItem);
      syncMyState(posRef.current, nextItem, contribRef.current);
    }
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
  }, [gameState, isHost, score]);

  // Firebase Room & Leaderboard Sync
  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        setScore(data.score || 0);
        setPlayers(data.players || {});
        if (data.countdown !== undefined) setCountdown(data.countdown);
        if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
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

  const addLog = (msg) => {
    const newLogs = [msg, ...logs.slice(0, 14)];
    setLogs(newLogs);
    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { logs: newLogs });
    }
  };

  const startShift = () => {
    if (Object.keys(players).length < 2) {
      alert('⚠️ Minimum 2 Chefs required!');
      return;
    }

    setMyContributions(0);
    contribRef.current = 0;

    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { status: 'countdown', countdown: 3, timeLeft: 60, score: 0 });
    }

    let count = 3;
    const cdInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { countdown: count });
      } else {
        clearInterval(cdInterval);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { status: 'playing', countdown: 0 });
        startGameTimer();
      }
    }, 1200); // Slower interval for dramatic effect
  };

  const startGameTimer = () => {
    let timer = 60;
    const gameInterval = setInterval(() => {
      timer -= 1;
      if (timer >= 0) {
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { timeLeft: timer });
      } else {
        clearInterval(gameInterval);
        if (db && roomCode) {
          update(ref(db, `rooms/${roomCode}`), { status: 'gameover' });
          // Push score to global leaderboard
          push(ref(db, 'leaderboard'), {
            room: roomCode,
            score: score,
            date: new Date().toLocaleDateString()
          });
        }
      }
    }, 1000);
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
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
        timeLeft: 60,
        logs: [`👑 ${playerName} created room ${code}`]
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
        @keyframes smoothFadeIn {
          0% { opacity: 0; transform: translateY(25px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popScale {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .screen-anim { animation: smoothFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .countdown-num { animation: popScale 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        button { transition: transform 0.2s, filter 0.2s; user-select: none; }
        button:active { transform: scale(0.92); }
      `}</style>

      {/* 1. PROFILE SETUP */}
      {screen === 'profile' && (
        <div key="profile" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.menuBox}>
            <div style={styles.heroBadge}>✨ Zellige & Saffron ✨</div>
            <h1 style={styles.title}>🧑‍🍳 Chef ID</h1>
            <form onSubmit={handleProfileSubmit} style={styles.form}>
              <input
                type="text"
                placeholder="Name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={styles.input}
                required
              />
              <div style={styles.emojiGrid}>
                {emojis.map((em) => (
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
              <button type="submit" style={styles.primaryButton}>➡️</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. MENU */}
      {screen === 'menu' && (
        <div key="menu" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.menuBox}>
            <div style={styles.heroBadge}>{playerEmoji} {playerName}</div>
            <h1 style={styles.title}>🍳 Zellige & Saffron</h1>
            <button onClick={createRoom} style={styles.primaryButton}>👑 Host</button>
            <div style={styles.divider}><span style={styles.dividerText}>OR</span></div>
            <form onSubmit={joinRoom} style={styles.form}>
              <input
                type="text"
                placeholder="CODE"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={styles.input}
                required
              />
              <button type="submit" style={styles.secondaryButton}>🧑‍🍳 Join</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. HOST DASHBOARD */}
      {isHost && (
        <div key="host" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.hostDashboard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={styles.codeBadge}>🔑 <strong>{roomCode}</strong></div>
              <div style={styles.scoreBoard}>🪙 {score}</div>
              <div style={styles.codeBadge}>⏱️ {timeLeft}s</div>
            </div>

            <div style={styles.dashboardGrid}>
              <div style={styles.dashPanel}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#cbd5e1' }}>🧑‍🍳 Staff</h3>
                <ul style={styles.playerList}>
                  {Object.keys(players).map((pid) => (
                    <li key={pid} style={styles.playerItem}>
                      <span>{players[pid].emoji} {players[pid].name}</span>
                      <span style={{ color: '#34d399' }}>{players[pid].contributions || 0} pts</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={styles.dashPanel}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#cbd5e1' }}>📜 Live Feed</h3>
                <div style={styles.logsBox}>
                  {logs.map((lg, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>{lg}</div>
                  ))}
                </div>
              </div>
            </div>

            {gameState === 'waiting' || gameState === 'gameover' ? (
              <button
                onClick={startShift}
                style={{
                  ...styles.primaryButton,
                  marginTop: '15px',
                  background: Object.keys(players).length < 2 ? '#374151' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                }}
              >
                {gameState === 'gameover' ? '🔄 Restart Shift' : `🚀 Start (${Object.keys(players).length}/2)`}
              </button>
            ) : (
              <div style={{ marginTop: '15px', color: '#34d399', fontWeight: 'bold' }}>🔥 Shift In Progress!</div>
            )}
          </div>
        </div>
      )}

      {/* 4. PLAYER WAITING LOBBY */}
      {!isHost && gameState === 'waiting' && screen === 'player_lobby' && (
        <div key="wait" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.lobbyCard}>
            <div style={styles.codeBadge}>🔑 <strong>{roomCode}</strong></div>
            <h2 style={{ margin: '10px 0' }}>{playerEmoji} {playerName}</h2>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '15px', color: '#cbd5e1' }}>⏳ Waiting for Host...</p>
          </div>
        </div>
      )}

      {/* 5. DRAMATIC 3-2-1 COUNTDOWN */}
      {gameState === 'countdown' && (
        <div style={styles.countdownOverlay}>
          <div key={countdown} className="countdown-num" style={styles.countdownText}>
            {countdown > 0 ? countdown : '🔥 GO!'}
          </div>
        </div>
      )}

      {/* 6. ACTIVE GAMEPLAY */}
      {!isHost && gameState === 'playing' && (
        <div key="play" className="screen-anim" style={styles.gameContainer}>
          <header style={styles.header}>
            <div style={styles.headerItem}>⏱️ <strong style={{ color: timeLeft <= 10 ? '#ef4444' : '#fff' }}>{timeLeft}s</strong></div>
            <div style={styles.scoreBoard}>🪙 {score}</div>
            <div style={styles.headerItem}>🤲 <span style={{ fontSize: '1.3rem' }}>{heldItem || '➖'}</span></div>
          </header>

          <div style={styles.recipeBar}>
            <span>🍅</span> ➔ <span>🔪 (🥗)</span> ➔ <span>🔥 (🍲)</span> ➔ <span>🛎️ (+10🪙)</span>
          </div>

          <div style={styles.kitchenFloor}>
            {STATIONS.map((st) => (
              <div
                key={st.id}
                style={{
                  ...styles.station,
                  left: `${st.x}%`,
                  top: `${st.y}%`,
                  background: st.color
                }}
              >
                <span style={{ fontSize: '2rem' }}>{st.icon}</span>
              </div>
            ))}

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
                  <div style={{ fontSize: '1.8rem' }}>{p.emoji}</div>
                  <div style={styles.playerTag}>{p.name}</div>
                </div>
              );
            })}
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

      {/* 7. GAME OVER & LEADERBOARD RESULTS SCREEN */}
      {gameState === 'gameover' && !isHost && (
        <div key="over" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.resultsCard}>
            <h2 style={{ margin: '0 0 10px 0', color: '#fbbf24' }}>🏁 Shift Complete!</h2>
            <p style={{ fontSize: '1.2rem', margin: '5px 0' }}>Total Team Score: <strong>🪙 {score}</strong></p>
            <p style={{ color: '#34d399', fontSize: '0.95rem' }}>Your Contribution: <strong>{myContributions} pts</strong></p>

            <div style={{ marginTop: '15px', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#94a3b8' }}>📊 1-Min Global Leaderboard:</h4>
              <div style={styles.lbBox}>
                {leaderboard.map((entry, idx) => (
                  <div key={idx} style={{ ...styles.lbItem, background: entry.room === roomCode ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}>
                    <span>#{idx + 1} Room {entry.room}</span>
                    <span style={{ color: '#38bdf8' }}>🪙 {entry.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => window.location.reload()} style={{ ...styles.primaryButton, marginTop: '15px' }}>
              🔄 Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { width: '100vw', height: '100vh', overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #311033 50%, #1e1b4b 100%)', fontFamily: 'system-ui, sans-serif', color: '#fff' },
  centeredWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '15px', boxSizing: 'border-box' },
  heroBadge: { background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '5px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px' },
  title: { fontSize: '2.2rem', margin: '5px 0 15px 0', fontWeight: '800', textAlign: 'center' },
  menuBox: { background: 'rgba(30, 27, 75, 0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '25px', borderRadius: '20px', textAlign: 'center', width: '100%', maxWidth: '400px', boxSizing: 'border-box' },
  lobbyCard: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '20px', textAlign: 'center', width: '100%', maxWidth: '380px', boxSizing: 'border-box' },
  resultsCard: { background: 'rgba(30, 27, 75, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '25px', borderRadius: '20px', textAlign: 'center', width: '100%', maxWidth: '420px', boxSizing: 'border-box' },
  hostDashboard: { background: 'rgba(30, 27, 75, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '25px', borderRadius: '20px', textAlign: 'center', width: '100%', maxWidth: '650px', boxSizing: 'border-box' },
  codeBadge: { background: '#4338ca', padding: '6px 14px', borderRadius: '10px', fontSize: '1.1rem', letterSpacing: '2px', border: '1px solid #6366f1' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '15px', textAlign: 'left' },
  dashPanel: { background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', height: '160px', display: 'flex', flexDirection: 'column' },
  logsBox: { flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px' },
  playerList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' },
  playerItem: { background: 'rgba(255, 255, 255, 0.05)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' },
  lbBox: { maxHeight: '130px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '8px', border: '1px solid rgba(255,255,255,0.1)' },
  lbItem: { display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '4px' },
  emojiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', margin: '10px 0' },
  emojiBtn: { fontSize: '1.3rem', padding: '6px', borderRadius: '10px', border: '1px solid', cursor: 'pointer' },
  primaryButton: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '12px', fontSize: '1.1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryButton: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '12px', fontSize: '1.1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' },
  divider: { margin: '15px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  dividerText: { position: 'absolute', top: '-9px', left: '50%', transform: 'translateX(-50%)', background: '#221a40', padding: '0 8px', fontSize: '0.75rem', color: '#94a3b8' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', boxSizing: 'border-box' },
  spinner: { width: '36px', height: '36px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1.2s linear infinite', margin: '0 auto' },
  countdownOverlay: { position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  countdownText: { fontSize: '6rem', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 40px rgba(251, 191, 36, 0.6)' },
  gameContainer: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#090d16', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#111827', borderBottom: '1px solid #1f2937' },
  headerItem: { background: '#1f2937', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem' },
  scoreBoard: { fontSize: '1.2rem', color: '#38bdf8', fontWeight: '800', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 16px', borderRadius: '10px' },
  recipeBar: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '8px', background: '#1e293b', fontSize: '1.1rem', borderBottom: '1px solid #334155' },
  kitchenFloor: { flex: 1, position: 'relative', background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)', margin: '10px', borderRadius: '16px', border: '2px dashed #334155', overflow: 'hidden' },
  station: { position: 'absolute', transform: 'translate(-50%, -50%)', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.2)' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '4px 10px', borderRadius: '14px', transition: 'left 0.1s linear, top 0.1s linear', zIndex: 10 },
  heldBubble: { position: 'absolute', top: '-26px', background: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.4)' },
  playerTag: { fontSize: '0.7rem', fontWeight: 'bold', color: '#e2e8f0', whiteSpace: 'nowrap' },
  mobileControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 25px', background: '#111827', borderTop: '1px solid #1f2937' },
  dpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gridTemplateRows: 'repeat(2, 44px)', gap: '4px' },
  dpadBtn: { background: '#334155', border: 'none', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBigBtn: { width: '68px', height: '68px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', fontSize: '1.8rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' }
};