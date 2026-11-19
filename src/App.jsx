import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update } from 'firebase/database';

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
  const [roomCode, setRoomCode] = useState('');
  const [inLobby, setInLobby] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting');
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));
  
  const [score, setScore] = useState(0);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState('empty');

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomCode(code);
    setIsHost(true);
    setInLobby(true);
    if (db) {
      set(ref(db, `rooms/${code}`), {
        status: 'waiting',
        score: 0,
        host: myId
      });
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsHost(false);
    setInLobby(true);
  };

  useEffect(() => {
    if (!inLobby || !db || !roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        setScore(data.score || 0);
      }
    });

    const playerRef = ref(db, `rooms/${roomCode}/players/${myId}`);
    set(playerRef, { x: 100, y: 100, inventory: 'empty' });

    return () => unsubscribe();
  }, [inLobby, roomCode, myId]);

  const startShift = () => {
    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { status: 'playing' });
    } else {
      setGameState('playing');
    }
  };

  if (!inLobby) {
    return (
      <div style={styles.menuContainer}>
        <div style={styles.heroBadge}>✨ Moroccan Culinary Challenge ✨</div>
        <h1 style={styles.title}>🍳 Zellige & Saffron 🌶️</h1>
        <p style={styles.subtitle}>Step into the bustling kitchens of Marrakech. Chop, cook, and serve together!</p>
        
        <div style={styles.menuBox}>
          <button onClick={createRoom} style={styles.primaryButton}>✨ Create New Kitchen (Host)</button>
          <div style={styles.divider}>
            <span style={styles.dividerText}>OR JOIN AN EXISTING KITCHEN</span>
          </div>
          <form onSubmit={joinRoom} style={styles.form}>
            <input 
              type="text" 
              placeholder="ENTER 4-LETTER CODE" 
              value={roomCode} 
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={styles.input}
            />
            <button type="submit" style={styles.secondaryButton}>Join Kitchen 🚪</button>
          </form>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div style={styles.menuContainer}>
        <div style={styles.lobbyCard}>
          <h2 style={styles.lobbyTitle}>Kitchen Lobby</h2>
          <div style={styles.codeBadge}>Room Code: <strong>{roomCode}</strong></div>
          
          {isHost ? (
            <div style={{ marginTop: '20px' }}>
              <p style={{ color: '#34d399', marginBottom: '20px', fontWeight: '600' }}>👑 You are the Head Chef (Host)</p>
              <button onClick={startShift} style={styles.primaryButton}>🚀 Start Kitchen Shift!</button>
            </div>
          ) : (
            <div style={styles.waitingBox}>
              <div style={styles.spinner}></div>
              <p style={{ marginTop: '15px', color: '#cbd5e1' }}>Waiting for the Head Chef to start the shift...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.gameContainer}>
      <header style={styles.header}>
        <div style={styles.headerItem}>Room: <strong style={{ color: '#fbbf24' }}>{roomCode}</strong></div>
        <div style={styles.scoreBoard}>🪙 Score: {score}</div>
        <div style={styles.headerItem}>Holding: <span style={{ color: '#34d399', fontWeight: 'bold' }}>{inventory}</span></div>
      </header>

      <div style={styles.kitchenFloor}>
        <div style={styles.stationTop}>🍅 Tomato Crate (Chop Station)</div>
        <div style={styles.stationMiddle}>🔥 Traditional Tagine Pot</div>
        <div style={styles.stationBottom}>🛎️ Window Service Counter</div>

        <div style={styles.playerAvatar}>
          🧑‍🍳 Chef ({myId})
        </div>
      </div>

      <div style={styles.controlsBar}>
        <button onClick={() => setInventory('Raw Tomato')} style={styles.actionBtn}>🍅 Grab Tomato</button>
        <button onClick={() => setInventory('Chopped Tomato')} style={styles.actionBtn}>🔪 Chop Tomato</button>
        <button onClick={() => setInventory('Cooked Tagine')} style={styles.actionBtn}>🔥 Cook Tagine</button>
        <button onClick={() => { setScore(s => s + 10); setInventory('empty'); }} style={styles.serveBtn}>🛎️ Serve Dish (+10 pts)</button>
      </div>
    </div>
  );
}

const styles = {
  menuContainer: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: '100vw', 
    height: '100vh', 
    background: 'linear-gradient(135deg, #0f172a 0%, #311033 50%, #1e1b4b 100%)', 
    color: '#fff', 
    fontFamily: 'system-ui, -apple-system, sans-serif', 
    padding: '20px', 
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  heroBadge: { background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' },
  title: { fontSize: 'clamp(2rem, 4vw, 3.5rem)', marginBottom: '10px', fontWeight: '800', textAlign: 'center', textShadow: '0 4px 12px rgba(0,0,0,0.4)' },
  subtitle: { fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)', color: '#cbd5e1', marginBottom: '30px', textAlign: 'center', maxWidth: '500px', lineHeight: '1.5' },
  menuBox: { background: 'rgba(30, 27, 75, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', width: '100%', maxWidth: '440px', boxSizing: 'border-box' },
  lobbyCard: { background: 'rgba(30, 27, 75, 0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '40px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', width: '100%', maxWidth: '450px', boxSizing: 'border-box' },
  lobbyTitle: { fontSize: '2rem', marginBottom: '15px', fontWeight: '700' },
  codeBadge: { background: '#4338ca', color: '#fff', padding: '10px 20px', borderRadius: '12px', fontSize: '1.3rem', display: 'inline-block', letterSpacing: '2px', margin: '10px 0 20px 0', border: '1px solid #6366f1' },
  primaryButton: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '14px 20px', fontSize: '1.05rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' },
  secondaryButton: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '14px 20px', fontSize: '1.05rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' },
  divider: { margin: '20px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  dividerText: { position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#221a40', padding: '0 10px', fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '1px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1.1rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', letterSpacing: '2px', boxSizing: 'border-box' },
  waitingBox: { textAlign: 'center', marginTop: '20px' },
  spinner: { width: '45px', height: '45px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
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