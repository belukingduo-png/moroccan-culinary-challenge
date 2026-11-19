import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update } from 'firebase/database';

// --- FIREBASE CONFIG (Replace with your project config or public test config) ---
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
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, gameover
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));
  
  // Game state
  const [score, setScore] = useState(0);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState('empty');

  // Create or Join Room
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

  // Sync with Firebase if available
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

    // Register player
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

  // If not in lobby yet, show menu
  if (!inLobby) {
    return (
      <div style={styles.menuContainer}>
        <h1 style={styles.title}>🍳 Zellige & Saffron 🌶️</h1>
        <p style={styles.subtitle}>Co-op Kitchen Chaos</p>
        <div style={styles.menuBox}>
          <button onClick={createRoom} style={styles.primaryButton}>Create Kitchen (Host)</button>
          <div style={{ margin: '20px 0', color: '#888' }}>- OR -</div>
          <form onSubmit={joinRoom} style={styles.form}>
            <input 
              type="text" 
              placeholder="Enter Room Code" 
              value={roomCode} 
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={styles.input}
            />
            <button type="submit" style={styles.secondaryButton}>Join Kitchen</button>
          </form>
        </div>
      </div>
    );
  }

  // Lobby / Waiting screen for guests
  if (gameState === 'waiting') {
    return (
      <div style={styles.menuContainer}>
        <h2 style={styles.title}>Kitchen Lobby: {roomCode}</h2>
        {isHost ? (
          <div>
            <p style={{ color: '#4ade80', marginBottom: '20px' }}>You are the Head Chef (Host).</p>
            <button onClick={startShift} style={styles.primaryButton}>Start Shift!</button>
          </div>
        ) : (
          <div style={styles.waitingBox}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '15px', fontSize: '18px', color: '#fff' }}>Waiting for Head Chef to start the shift...</p>
          </div>
        )}
      </div>
    );
  }

  // Active Game Screen
  return (
    <div style={styles.gameContainer}>
      <header style={styles.header}>
        <div>Room: <strong>{roomCode}</strong></div>
        <div style={styles.scoreBoard}>Score: {score} 🪙</div>
        <div>Holding: <span style={{ color: '#fbbf24' }}>{inventory}</span></div>
      </header>

      {/* Kitchen Floor */}
      <div style={styles.kitchenFloor}>
        <div style={styles.stationTop}>🍅 Tomato Crate (Chop)</div>
        <div style={styles.stationMiddle}>🔥 Cooking Pot</div>
        <div style={styles.stationBottom}>🛎️ Serving Window</div>

        <div style={styles.playerAvatar}>
          chef
        </div>
      </div>

      <div style={styles.controlsBar}>
        <button onClick={() => setInventory('Raw Tomato')} style={styles.actionBtn}>Grab Tomato</button>
        <button onClick={() => setInventory('Chopped Tomato')} style={styles.actionBtn}>Chop</button>
        <button onClick={() => setInventory('Cooked Tagine')} style={styles.actionBtn}>Cook</button>
        <button onClick={() => { setScore(s => s + 10); setInventory('empty'); }} style={styles.serveBtn}>Serve Dish 🛎️</button>
      </div>
    </div>
  );
}

const styles = {
  menuContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1b4b', color: '#fff', fontFamily: 'sans-serif' },
  title: { fontSize: '2.5rem', marginBottom: '10px' },
  subtitle: { fontSize: '1.2rem', color: '#c7d2fe', marginBottom: '30px' },
  menuBox: { background: '#312e81', padding: '30px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' },
  primaryButton: { background: '#10b981', color: '#fff', border: 'none', padding: '12px 24px', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryButton: { background: '#6366f1', color: '#fff', border: 'none', padding: '12px 24px', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #4f46e5', fontSize: '1rem', textAlign: 'center', background: '#1e1b4b', color: '#fff' },
  waitingBox: { textAlign: 'center', marginTop: '20px' },
  spinner: { width: '40px', height: '40px', border: '4px solid #c7d2fe', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
  gameContainer: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '15px 30px', background: '#1e293b', borderBottom: '1px solid #334155', fontSize: '1.1rem' },
  scoreBoard: { fontSize: '1.3rem', color: '#38bdf8', fontWeight: 'bold' },
  kitchenFloor: { flex: 1, position: 'relative', background: '#334155', margin: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', padding: '20px', border: '4px dashed #475569' },
  stationTop: { background: '#ef4444', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold' },
  stationMiddle: { background: '#f59e0b', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', color: '#000' },
  stationBottom: { background: '#10b981', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold' },
  playerAvatar: { background: '#6366f1', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
  controlsBar: { display: 'flex', justifyContent: 'center', gap: '15px', padding: '20px', background: '#1e293b' },
  actionBtn: { background: '#475569', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  serveBtn: { background: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
};