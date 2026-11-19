import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://your-firebase-default-rtdb.firebaseio.com"
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (e) {
  console.warn("Firebase not configured yet. Running in offline/local mode.");
}

export default function App() {
  const [screen, setScreen] = useState('profile'); // 'profile', 'menu', 'host_lobby', 'player_lobby', 'game'
  const [playerName, setPlayerName] = useState('');
  const [playerEmoji, setPlayerEmoji] = useState('🧑‍🍳');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState(['Kitchen initialized... waiting for staff.']);
  const [inventory, setInventory] = useState('empty');
  const [myId] = useState(() => 'id_' + Math.random().toString(36).substring(2, 7));

  const emojis = ['🧑‍🍳', '👩‍🍳', '🦊', '🐼', '🐱', '🦁', '🐸', '🐯'];

  // Handle Profile Setup Completion
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setScreen('menu');
  };

  // Create Room as Host (Head Chef / Admin Dashboard)
  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomCode(code);
    setIsHost(true);
    setScreen('host_lobby');
    
    if (db) {
      set(ref(db, `rooms/${code}`), {
        status: 'waiting',
        score: 0,
        hostName: playerName,
        logs: ['Host created the kitchen. Waiting for players...']
      });
    }
  };

  // Join Room as Active Player Chef
  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsHost(false);
    setScreen('player_lobby');

    if (db) {
      const playerRef = ref(db, `rooms/${roomCode}/players/${myId}`);
      set(playerRef, { name: playerName, emoji: playerEmoji, inventory: 'empty' });
    }
  };

  // Firebase listeners for live synchronization
  useEffect(() => {
    if (!db || !roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        setScore(data.score || 0);
        setPlayers(data.players || {});
        if (data.logs) setLogs(data.logs);
      }
    });

    return () => unsubscribe();
  }, [roomCode]);

  const addLog = (msg) => {
    const newLogs = [msg, ...logs.slice(0, 15)];
    setLogs(newLogs);
    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { logs: newLogs });
    }
  };

  const startShift = () => {
    const playerCount = Object.keys(players).length;
    if (playerCount < 2) {
      alert('You need at least 2 active player chefs to start the shift!');
      return;
    }

    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { status: 'playing' });
    } else {
      setGameState('playing');
    }
    addLog(`🚀 Shift started by Host ${playerName}!`);
  };

  // 1. Profile Setup Screen
  if (screen === 'profile') {
    return (
      <div style={styles.menuContainer}>
        <div className="fade-in-card" style={styles.menuBox}>
          <div style={styles.heroBadge}>✨ Zellige & Saffron ✨</div>
          <h1 style={styles.title}>Customize Chef</h1>
          <p style={styles.subtitle}>Choose your name and signature emoji badge</p>
          
          <form onSubmit={handleProfileSubmit} style={styles.form}>
            <input 
              type="text" 
              placeholder="Enter Your Chef Name" 
              value={playerName} 
              onChange={(e) => setPlayerName(e.target.value)}
              style={styles.input}
              required
            />
            <div style={{ margin: '10px 0' }}>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '8px' }}>Pick Your Avatar Emoji:</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {emojis.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setPlayerEmoji(em)}
                    style={{
                      ...styles.emojiBtn,
                      borderColor: playerEmoji === em ? '#10b981' : 'rgba(255,255,255,0.1)',
                      background: playerEmoji === em ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)'
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" style={styles.primaryButton}>Continue to Kitchen 🚪</button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Main Menu Screen
  if (screen === 'menu') {
    return (
      <div style={styles.menuContainer}>
        <div className="fade-in-card" style={styles.menuBox}>
          <div style={styles.heroBadge}>Welcome, {playerEmoji} {playerName}</div>
          <h1 style={styles.title}>🍳 Zellige & Saffron 🌶️</h1>
          <p style={styles.subtitle}>Choose your role in the Marrakech kitchen</p>
          
          <button onClick={createRoom} style={styles.primaryButton}>👑 Host Kitchen (Admin Dashboard)</button>
          
          <div style={styles.divider}>
            <span style={styles.dividerText}>OR JOIN AS ACTIVE CHEF</span>
          </div>

          <form onSubmit={joinRoom} style={styles.form}>
            <input 
              type="text" 
              placeholder="ENTER 4-LETTER ROOM CODE" 
              value={roomCode} 
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.secondaryButton}>Join Kitchen as Player 🧑‍🍳</button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Host / Admin Dashboard Lobby
  if (screen === 'host_lobby' || (isHost && gameState === 'waiting')) {
    const playerCount = Object.keys(players).length;
    return (
      <div style={styles.menuContainer}>
        <div className="fade-in-card" style={styles.hostDashboard}>
          <h2 style={styles.lobbyTitle}>👑 Head Chef Admin Dashboard</h2>
          <div style={styles.codeBadge}>Room Code: <strong>{roomCode}</strong></div>

          <div style={styles.dashboardGrid}>
            <div style={styles.dashPanel}>
              <h3>Active Chefs in Kitchen ({playerCount} / Min 2):</h3>
              <ul style={styles.playerList}>
                {Object.keys(players).map((pid) => (
                  <li key={pid} style={styles.playerItem}>
                    <span>{players[pid].emoji} {players[pid].name}</span>
                    <span style={{ color: '#34d399', fontSize: '0.85rem' }}>Ready</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={styles.dashPanel}>
              <h3>Live Kitchen Logs:</h3>
              <div style={styles.logsBox}>
                {logs.map((lg, idx) => (
                  <div key={idx} style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>{lg}</div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={startShift} 
            style={{ ...styles.primaryButton, marginTop: '20px', opacity: playerCount < 2 ? 0.6 : 1 }}
          >
            🚀 Start Kitchen Shift (Min 2 Players)
          </button>
        </div>
      </div>
    );
  }

  // 4. Player Waiting Lobby
  if (screen === 'player_lobby' && gameState === 'waiting') {
    return (
      <div style={styles.menuContainer}>
        <div className="fade-in-card" style={styles.lobbyCard}>
          <h2 style={styles.lobbyTitle}>Kitchen Lobby</h2>
          <div style={styles.codeBadge}>Room Code: <strong>{roomCode}</strong></div>
          <p style={{ color: '#34d399', marginBottom: '15px' }}>{playerEmoji} {playerName} (Connected)</p>
          
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '15px', color: '#cbd5e1' }}>Waiting for Head Chef to start the shift...</p>
        </div>
      </div>
    );
  }

  // 5. Active Gameplay Screen (For Players)
  return (
    <div className="fade-in-card" style={styles.gameContainer}>
      <header style={styles.header}>
        <div style={styles.headerItem}>Chef: <strong style={{ color: '#fbbf24' }}>{playerEmoji} {playerName}</strong></div>
        <div style={styles.scoreBoard}>🪙 Score: {score}</div>
        <div style={styles.headerItem}>Holding: <span style={{ color: '#34d399', fontWeight: 'bold' }}>{inventory}</span></div>
      </header>

      <div style={styles.kitchenFloor}>
        <div style={styles.stationTop}>🍅 Tomato Crate (Chop Station)</div>
        <div style={styles.stationMiddle}>🔥 Traditional Tagine Pot</div>
        <div style={styles.stationBottom}>🛎️ Window Service Counter</div>

        <div style={styles.playerAvatar}>
          {playerEmoji} {playerName} (Active Chef)
        </div>
      </div>

      <div style={styles.controlsBar}>
        <button onClick={() => { setInventory('Raw Tomato'); addLog(`${playerName} grabbed a raw tomato.`); }} style={styles.actionBtn}>🍅 Grab Tomato</button>
        <button onClick={() => { setInventory('Chopped Tomato'); addLog(`${playerName} chopped the tomato.`); }} style={styles.actionBtn}>🔪 Chop Tomato</button>
        <button onClick={() => { setInventory('Cooked Tagine'); addLog(`${playerName} cooked a tagine dish.`); }} style={styles.actionBtn}>🔥 Cook Tagine</button>
        <button onClick={() => { 
          setScore(s => s + 10); 
          setInventory('empty'); 
          addLog(`${playerName} served a dish successfully! (+10 pts)`);
          if(db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: score + 10 });
        }} style={styles.serveBtn}>🛎️ Serve Dish (+10 pts)</button>
      </div>
    </div>
  );
}

const styles = {
  menuContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #311033 50%, #1e1b4b 100%)', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '20px', boxSizing: 'border-box', overflow: 'hidden' },
  heroBadge: { background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' },
  title: { fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', marginBottom: '10px', fontWeight: '800', textAlign: 'center', textShadow: '0 4px 12px rgba(0,0,0,0.4)' },
  subtitle: { fontSize: 'clamp(0.9rem, 1.5vw, 1rem)', color: '#cbd5e1', marginBottom: '25px', textAlign: 'center', maxWidth: '450px', lineHeight: '1.4' },
  menuBox: { background: 'rgba(30, 27, 75, 0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', width: '100%', maxWidth: '440px', boxSizing: 'border-box' },
  lobbyCard: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', width: '100%', maxWidth: '420px', boxSizing: 'border-box' },
  hostDashboard: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', width: '100%', maxWidth: '700px', boxSizing: 'border-box' },
  lobbyTitle: { fontSize: '1.8rem', marginBottom: '10px', fontWeight: '700' },
  codeBadge: { background: '#4338ca', color: '#fff', padding: '8px 16px', borderRadius: '12px', fontSize: '1.2rem', display: 'inline-block', letterSpacing: '2px', margin: '5px 0 15px 0', border: '1px solid #6366f1' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', textAlign: 'left' },
  dashPanel: { background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '15px', height: '180px', display: 'flex', flexDirection: 'column' },
  logsBox: { flex: 1, overflowY: 'auto', marginTop: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px' },
  playerList: { listStyle: 'none', padding: 0, margin: '8px 0 0 0', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 },
  playerItem: { background: 'rgba(255, 255, 255, 0.05)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  emojiBtn: { fontSize: '1.4rem', padding: '8px 12px', borderRadius: '10px', border: '1px solid', cursor: 'pointer' },
  primaryButton: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '14px 20px', fontSize: '1.05rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' },
  secondaryButton: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '14px 20px', fontSize: '1.05rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' },
  divider: { margin: '20px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  dividerText: { position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#221a40', padding: '0 10px', fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '1px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', boxSizing: 'border-box' },
  spinner: { width: '36px', height: '36px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
  gameContainer: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#090d16', color: '#fff', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: '#111827', borderBottom: '1px solid #1f2937', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', boxSizing: 'border-box' },
  headerItem: { background: '#1f2937', padding: '8px 16px', borderRadius: '10px', border: '1px solid #374151' },
  scoreBoard: { fontSize: '1.3rem', color: '#38bdf8', fontWeight: '800', background: 'rgba(56, 189, 248, 0.1)', padding: '8px 20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)' },
  kitchenFloor: { flex: 1, position: 'relative', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', margin: '15px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', padding: '20px', border: '3px dashed #334155', boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' },
  stationTop: { background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', padding: '14px 28px', borderRadius: '14px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)', fontSize: '1rem' },
  stationMiddle: { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', padding: '14px 28px', borderRadius: '14px', fontWeight: 'bold', color: '#fff', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)', fontSize: '1rem' },
  stationBottom: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '14px 28px', borderRadius: '14px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)', fontSize: '1rem' },
  playerAvatar: { background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)', border: '2px solid rgba(255,255,255,0.2)' },
  controlsBar: { display: 'flex', justifyContent: 'center', gap: '12px', padding: '15px 20px', background: '#111827', borderTop: '1px solid #1f2937', boxSizing: 'border-box', flexWrap: 'wrap' },
  actionBtn: { background: '#374151', color: '#fff', border: '1px solid #4b5563', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' },
  serveBtn: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }
};