import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, push } from 'firebase/database';

const APP_VERSION = "v3.3";

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
  { id: 'crate_tomato', icon: '🍅', type: 'crate', item: '🍅', label: 'Caisse Tomate', x: 12, y: 20, color: '#ef4444' },
  { id: 'crate_chili', icon: '🌶️', type: 'crate', item: '🌶️', label: 'Caisse Piment', x: 12, y: 40, color: '#f97316' },
  { id: 'crate_chicken', icon: '🍗', type: 'crate', item: '🍗', label: 'Caisse Poulet', x: 12, y: 60, color: '#eab308' },
  { id: 'crate_garlic', icon: '🧄', type: 'crate', item: '🧄', label: 'Caisse Ail', x: 12, y: 80, color: '#a855f7' },

  { id: 'board_1', icon: '🔪', type: 'board', label: 'Découpe Prep 1', x: 35, y: 25, color: '#3b82f6' },
  { id: 'board_2', icon: '🔪', type: 'board', label: 'Découpe Prep 2', x: 35, y: 50, color: '#3b82f6' },

  { id: 'stove_1', icon: '🍲', type: 'stove', label: 'Tagine Cuisson 1', x: 65, y: 25, color: '#f59e0b' },
  { id: 'stove_2', icon: '🫖', type: 'stove', label: 'Tagine Cuisson 2', x: 65, y: 50, color: '#f59e0b' },

  { id: 'pass_counter', icon: '🪟', type: 'pass', label: 'Passe-Plats Central', x: 50, y: 82, color: '#ec4899' },
  { id: 'extinguisher', icon: '🧯', type: 'extinguisher', label: 'Extincteur', x: 88, y: 20, color: '#64748b' },
  { id: 'serve', icon: '🛎️', type: 'serve', label: 'Comptoir Service', x: 88, y: 75, color: '#10b981' },
];

const EMOJIS = ['🧑‍🍳', '👩‍🍳', '👨‍🍳', '🦊', '🐼', '🐱', '🦁', '🐸', '🐯', '🥐', '🥖', '🧀', '🌶️', '🍅', '🍳', '🧄', '🥑', '🍋'];
const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍳', '🫖'];

const RECIPES = [
  { id: 'mechouia', title: "Salade Mechouia 🌶️", requiredPrep: "🥗", requiredCook: "🍲", points: 15 },
  { id: 'poulet_citron', title: "Tagine Poulet Citron 🍗", requiredPrep: "🍖", requiredCook: "🍲", points: 20 },
  { id: 'the_menthe', title: "Thé à la Menthe Royale 🫖", requiredPrep: "🌿", requiredCook: "🫖", points: 15 }
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
  const [timeLeft, setTimeLeft] = useState(120);
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState(['🔥 Cuisine Prête (v3.3)']);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myId] = useState(() => 'chef_' + Math.random().toString(36).substring(2, 7));

  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [heldItem, setHeldItem] = useState('');
  const [myContributions, setMyContributions] = useState(0);

  const [activeTicket, setActiveTicket] = useState(RECIPES[0]);
  const [stationStates, setStationStates] = useState({});
  const [minigameData, setMinigameData] = useState(null);
  const [tempMinigame, setTempMinigame] = useState(null);

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

  const syncStationUpdate = (stationId, newStationData) => {
    setStationStates(prev => ({ ...prev, [stationId]: newStationData }));
    if (db && roomCode) {
      set(ref(db, `rooms/${roomCode}/stations/${stationId}`), newStationData);
    }
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
    if (gameState !== 'playing' || isHost || minigameData || tempMinigame) return;
    const nextX = Math.max(6, Math.min(95, posRef.current.x + dx));
    const nextY = Math.max(12, Math.min(92, posRef.current.y + dy));
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

    // Handle Fire extinguishing
    if (stState.fire) {
      if (currentItem === '🧯' || nearby.type === 'extinguisher') {
        syncStationUpdate(nearby.id, { ...stState, fire: false, progress: 0 });
        addLog(`🧯 ${playerName} a éteint le feu sur ${nearby.label} !`);
      } else if (nearby.type === 'extinguisher' && currentItem === '') {
        heldRef.current = '🧯';
        setHeldItem('🧯');
        addLog(`🧯 ${playerName} a pris l'extincteur !`);
        syncMyState(posRef.current, '🧯', contribRef.current);
      }
      return;
    }

    if (nearby.type === 'extinguisher') {
      if (currentItem === '') {
        heldRef.current = '🧯';
        setHeldItem('🧯');
        addLog(`🧯 ${playerName} a pris l'extincteur.`);
        syncMyState(posRef.current, '🧯', contribRef.current);
      } else if (currentItem === '🧯') {
        heldRef.current = '';
        setHeldItem('');
        addLog(`🧯 ${playerName} a rangé l'extincteur.`);
        syncMyState(posRef.current, '', contribRef.current);
      }
      return;
    }

    // 1. Crate: Take ingredient
    if (nearby.type === 'crate' && currentItem === '') {
      const item = nearby.item;
      heldRef.current = item;
      setHeldItem(item);
      addLog(`${playerEmoji} ${playerName} a pris ${item}`);
      syncMyState(posRef.current, item, contribRef.current);
    } 
    // 2. Prep Cutting Board (Enforce alternate board if busy)
    else if (nearby.type === 'board') {
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        syncStationUpdate(nearby.id, { ...stState, readyItem: null });
        addLog(`${playerEmoji} ${playerName} a récupéré ${picked} préparé`);
        syncMyState(posRef.current, picked, contribRef.current);
      } else if (currentItem !== '' && !stState.progress && !stState.readyItem && currentItem !== '🧯') {
        if (stState.currentItem) {
          addLog(`⚠️ Ce poste de découpe est occupé ! Utilisez l'autre.`);
          return;
        }
        const itemToPrep = currentItem;
        heldRef.current = '';
        setHeldItem('');
        syncMyState(posRef.current, '', contribRef.current);
        syncStationUpdate(nearby.id, { ...stState, currentItem: itemToPrep });

        setMinigameData({
          stationId: nearby.id,
          targetTaps: 5,
          currentTaps: 0,
          item: itemToPrep,
          label: '🔪 Appuyez ESPACE / Tap en Cadence !'
        });
      }
    } 
    // 3. Stoves / Tagines (Enforce alternate stove if busy)
    else if (nearby.type === 'stove') {
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        syncStationUpdate(nearby.id, { ...stState, readyItem: null });
        addLog(`${playerEmoji} ${playerName} a récupéré ${picked} cuit du tagine 🔥`);
        syncMyState(posRef.current, picked, contribRef.current);
      } else if (currentItem !== '' && !stState.progress && !stState.readyItem && currentItem !== '🧯') {
        if (stState.currentItem) {
          addLog(`⚠️ Ce tagine est déjà en cuisson ! Utilisez l'autre.`);
          return;
        }
        const itemToCook = currentItem;
        heldRef.current = '';
        setHeldItem('');
        syncMyState(posRef.current, '', contribRef.current);
        syncStationUpdate(nearby.id, { ...stState, currentItem: itemToCook });

        setTempMinigame({
          stationId: nearby.id,
          item: itemToCook,
          sliderPos: 0,
          direction: 2
        });
      }
    }
    // 4. Central Pass-Through Counter
    else if (nearby.type === 'pass') {
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        syncStationUpdate(nearby.id, { ...stState, readyItem: null });
        addLog(`🪟 ${playerName} a pris ${picked} du passe-plats.`);
        syncMyState(posRef.current, picked, contribRef.current);
      } else if (currentItem !== '' && !stState.readyItem) {
        const dropped = currentItem;
        heldRef.current = '';
        setHeldItem('');
        syncStationUpdate(nearby.id, { ...stState, readyItem: dropped });
        addLog(`🪟 ${playerName} a déposé ${dropped} sur le passe-plats.`);
        syncMyState(posRef.current, '', contribRef.current);
      }
    }
    // 5. Serving Counter
    else if (nearby.type === 'serve') {
      if (currentItem === activeTicket.requiredCook || currentItem === '🍲' || currentItem === '🫖') {
        heldRef.current = '';
        setHeldItem('');
        const pts = activeTicket.points;
        const newScore = scoreRef.current + pts;
        const newContrib = contribRef.current + pts;
        contribRef.current = newContrib;
        setMyContributions(newContrib);
        setScore(newScore);
        addLog(`${playerEmoji} ${playerName} a servi ${activeTicket.title} ! (+${pts} pts) 🛎️`);
        
        const nextRecipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
        setActiveTicket(nextRecipe);

        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore, activeTicket: nextRecipe });
        syncMyState(posRef.current, '', contribRef.current);
      } else {
        const penaltyScore = Math.max(0, scoreRef.current - 5);
        setScore(penaltyScore);
        scoreRef.current = penaltyScore;
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: penaltyScore });
        addLog(`❌ ERREUR DE SERVICE ! Plat non conforme (-5 pts)`);
      }
    }
  };

  // Temperature Slider Minigame Loop
  useEffect(() => {
    if (!tempMinigame) return;
    const interval = setInterval(() => {
      setTempMinigame(prev => {
        if (!prev) return null;
        let nextPos = prev.sliderPos + prev.direction;
        let nextDir = prev.direction;
        if (nextPos >= 100 || nextPos <= 0) {
          nextDir = -nextDir;
        }
        return { ...prev, sliderPos: nextPos, direction: nextDir };
      });
    }, 25);
    return () => clearInterval(interval);
  }, [tempMinigame]);

  const handleTempSubmit = () => {
    if (!tempMinigame) return;
    const pos = tempMinigame.sliderPos;
    const stationId = tempMinigame.stationId;
    const item = tempMinigame.item;

    const isSuccess = pos >= 40 && pos <= 65;

    if (isSuccess) {
      const result = item === '🌿' ? '🫖' : '🍲';
      syncStationUpdate(stationId, { progress: 0, label: 'Prêt !', currentItem: null, readyItem: result, fire: false });
      addLog(`🔥 Cuisson parfaite au tagine ! Résultat ➔ ${result}`);
    } else {
      syncStationUpdate(stationId, { progress: 0, label: '', currentItem: null, readyItem: null, fire: false });
      const penaltyScore = Math.max(0, scoreRef.current - 5);
      setScore(penaltyScore);
      scoreRef.current = penaltyScore;
      if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: penaltyScore });
      addLog(`❌ CUISSON RATÉE ! Température incorrecte (-5 pts)`);
    }
    setTempMinigame(null);
  };

  const handleMinigameTap = () => {
    if (!minigameData) return;
    const updatedTaps = minigameData.currentTaps + 1;
    if (updatedTaps >= minigameData.targetTaps) {
      const choppedMap = { '🍅': '🥗', '🌶️': '🥗', '🍗': '🍖', '🧄': '🥗', '🌿': '🌿' };
      const result = choppedMap[minigameData.item] || '🥗';
      
      syncStationUpdate(minigameData.stationId, { progress: 0, label: 'Prêt !', currentItem: null, readyItem: result, fire: false });
      addLog(`🔪 Découpe réussie ! Ingrédient préparé ➔ ${result}`);
      setMinigameData(null);
    } else {
      setMinigameData(prev => ({ ...prev, currentTaps: updatedTaps }));
    }
  };

  // Independent Grease Fire Generator for any stove station
  useEffect(() => {
    if (gameState !== 'playing' || !isHost) return;
    const fireInterval = setInterval(() => {
      const stoveStations = STATIONS.filter(s => s.type === 'stove');
      const randomStove = stoveStations[Math.floor(Math.random() * stoveStations.length)];
      
      // Fetch latest station state from database or local state
      const currentSt = stationStates[randomStove.id] || {};
      if (!currentSt.fire && Math.random() < 0.3) {
        syncStationUpdate(randomStove.id, { ...currentSt, fire: true, label: '🔥 FEU !' });
        addLog(`🚨 ALERTE FEU sur ${randomStove.label} ! Éteignez-le vite (🧯) !`);
      }
    }, 12000);
    return () => clearInterval(fireInterval);
  }, [gameState, isHost, stationStates]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing' || isHost) return;
      const step = 4;
      if (minigameData && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleMinigameTap();
        return;
      }
      if (tempMinigame && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleTempSubmit();
        return;
      }
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
  }, [gameState, isHost, minigameData, tempMinigame, stationStates]);

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
        setStationStates(data.stations || {});
        if (data.activeTicket) setActiveTicket(data.activeTicket);
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
      alert('⚠️ Minimum 2 Chefs requis pour la co-op !');
      return;
    }

    setMyContributions(0);
    contribRef.current = 0;

    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), {
        status: 'countdown',
        countdown: 3,
        score: 0,
        stations: {},
        activeTicket: RECIPES[0]
      });
    }

    let count = 3;
    const cdInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { countdown: count });
      } else {
        clearInterval(cdInterval);
        const targetEnd = Date.now() + 120000;
        if (db && roomCode) {
          update(ref(db, `rooms/${roomCode}`), { status: 'playing', countdown: 0, endTime: targetEnd });
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
        stations: {},
        logs: [`👑 ${playerName} a ouvert la cuisine ${code}`]
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
          50% { transform: rotate(-30deg) translateY(-8px); }
          100% { transform: rotate(0deg) translateY(0); }
        }
        @keyframes fireAlarm {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.12); filter: brightness(1.6) drop-shadow(0 0 12px #ef4444); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .screen-anim { animation: smoothFadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .countdown-num { animation: popScale 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .knife-anim { animation: knifeChopping 0.25s ease-in-out infinite; }
        .fire-anim { animation: fireAlarm 0.5s ease-in-out infinite; }
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
            <h1 style={styles.mainGameTitle}>🍳 Zellige & Saffron v3.3 🌶️</h1>
            <p style={styles.subSubtitle}>🧑‍🍳 Identité du Chef Co-op</p>
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
            <button onClick={createRoom} style={styles.primaryButton}>👑 Héberger la Cuisine Co-op</button>
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
            <div style={styles.codeBadge}>⏱️ {gameState === 'playing' ? `${timeLeft}s` : '120s'}</div>
          </div>

          <div style={styles.hostMainGrid}>
            <div style={styles.dashPanel}>
              <h3 style={styles.panelTitle}>🧑‍🍳 Chefs en Co-op ({Object.keys(players).length} / Min 2)</h3>
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
              <h3 style={styles.panelTitle}>📜 Journal & Incidents de Cuisine</h3>
              <div style={styles.logsBox}>
                {logs.map((lg, idx) => (
                  <div key={idx} style={{ ...styles.logLine, color: lg.includes('ERREUR') || lg.includes('FEU') ? '#ef4444' : '#cbd5e1' }}>{lg}</div>
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
                {gameState === 'gameover' ? '🔄 Relancer le Service (120s)' : `🚀 Démarrer le Service (${Object.keys(players).length}/2)`}
              </button>
            ) : (
              <div style={{ color: '#34d399', fontWeight: '800', fontSize: '1.2rem' }}>🔥 Service Co-op en Cours !</div>
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
            
            {/* Step by Step Guide for Players */}
            <div style={styles.instructionsBox}>
              <h4 style={{ color: '#fbbf24', margin: '0 0 8px 0', fontSize: '0.95rem' }}>📖 Comment Jouer (Instructions) :</h4>
              <ol style={{ textAlign: 'left', fontSize: '0.8rem', color: '#cbd5e1', paddingLeft: '18px', margin: 0, lineHeight: '1.5' }}>
                <li><strong>Prendre l'ingrédient :</strong> Allez aux caisses à gauche (🍅, 🍗, etc.) et appuyez sur ⚡.</li>
                <li><strong>Préparer :</strong> Apportez l'ingrédient à un poste de découpe (🔪) libre et jouez au mini-jeu de rythme.</li>
                <li><strong>Cuire :</strong> Apportez l'ingrédient préparé à un tagine (🍲 / 🫖) libre et validez la température dans la zone verte.</li>
                <li><strong>Servir :</strong> Apportez le plat cuit au Comptoir de Service (🛎️) pour marquer des points !</li>
                <li><strong>Urgence :</strong> Si un feu éclate (🔥), prenez l'extincteur (🧯) pour l'éteindre immédiatement.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {gameState === 'countdown' && (
        <div style={styles.countdownOverlay}>
          <div key={countdown} className="countdown-num" style={styles.countdownText}>
            {countdown > 0 ? countdown : '🔥 EN CUISINE !'}
          </div>
        </div>
      )}

      {/* ACTIVE GAMEPLAY SCREEN */}
      {!isHost && gameState === 'playing' && (
        <div key="play" className="screen-anim" style={styles.gameContainer}>
          <header style={styles.header}>
            <div style={styles.headerItem}>⏱️ <strong style={{ color: timeLeft <= 15 ? '#ef4444' : '#fff' }}>{timeLeft}s</strong></div>
            <div style={styles.scoreBoard}>🪙 {score}</div>
            <div style={styles.headerItem}>🤲 <span style={{ fontSize: '1.4rem' }}>{heldItem || '➖'}</span></div>
          </header>

          <div style={styles.activeLayout}>
            {/* Ticket & Instructions Sidebar */}
            <div style={styles.recipeSidebar}>
              <h4 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '0.95rem' }}>🎫 Ticket Actif :</h4>
              <div style={styles.recipeCardItem}>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '700', marginBottom: '6px' }}>{activeTicket.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                  1. Prep : 🔪 <strong>{activeTicket.requiredPrep}</strong><br/>
                  2. Cuisson : 🍲 <strong>{activeTicket.requiredCook}</strong><br/>
                  Récompense : <span style={{ color: '#34d399', fontWeight: 'bold' }}>+{activeTicket.points} pts</span>
                </div>
              </div>

              <h4 style={{ margin: '15px 0 8px 0', color: '#fbbf24', fontSize: '0.9rem' }}>📖 Aide Rapide :</h4>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                • 🍅 Tomate / 🍗 Poulet aux caisses.<br/>
                • 🔪 Découpe 1 ou 2 (mini-jeu de rythme).<br/>
                • 🍲 Tagine 1 ou 2 (contrôle température).<br/>
                • 🧯 Éteignez les feux immédiatement !
              </div>
            </div>

            {/* Kitchen Floor */}
            <div style={styles.kitchenFloor}>
              {STATIONS.map((st) => {
                const stState = stationStates[st.id] || {};
                const isWorking = stState.progress > 0;
                const isReady = !!stState.readyItem;
                const hasFire = !!stState.fire;

                return (
                  <div
                    key={st.id}
                    style={{
                      ...styles.station,
                      left: `${st.x}%`,
                      top: `${st.y}%`,
                      background: hasFire ? '#991b1b' : st.color,
                      borderColor: hasFire ? '#ef4444' : (isReady ? '#34d399' : (isWorking ? '#fbbf24' : 'rgba(255,255,255,0.25)'))
                    }}
                  >
                    <div className={hasFire ? 'fire-anim' : (st.type === 'board' && isWorking ? 'knife-anim' : '')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '2rem' }}>
                        {hasFire ? '🔥' : st.icon}
                      </span>
                    </div>

                    <span style={styles.stationLabel}>{hasFire ? 'FEU ! (🧯)' : st.label}</span>

                    {stState.currentItem && !hasFire && (
                      <div style={styles.stationItemBadge}>{stState.currentItem}</div>
                    )}

                    {isReady && !hasFire && (
                      <div style={styles.readyItemBadge}>{stState.readyItem} ✨</div>
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

          {/* Rhythm Chopping Minigame Modal */}
          {minigameData && (
            <div style={styles.minigameOverlay}>
              <div style={styles.minigameCard}>
                <h3 style={{ margin: '0 0 10px 0', color: '#fbbf24' }}>🔪 Découpe en Cadence !</h3>
                <p style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>{minigameData.label}</p>
                <div style={{ fontSize: '2.5rem', margin: '15px 0' }}>{minigameData.item} ➔ 🥗</div>
                <div style={styles.miniTrackLarge}>
                  <div style={{ ...styles.miniFillLarge, width: `${(minigameData.currentTaps / minigameData.targetTaps) * 100}%` }}></div>
                </div>
                <button onClick={handleMinigameTap} style={styles.tapActionBtn}>
                  TAP / ESPACE ({minigameData.currentTaps}/{minigameData.targetTaps}) 🔪
                </button>
              </div>
            </div>
          )}

          {/* Temperature Slider Cooking Minigame Modal */}
          {tempMinigame && (
            <div style={styles.minigameOverlay}>
              <div style={styles.minigameCard}>
                <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>🔥 Contrôle de Température Tagine !</h3>
                <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '10px' }}>Appuyez quand l'indicateur est dans la zone verte !</p>
                
                <div style={styles.tempBarContainer}>
                  <div style={styles.tempGreenZone}></div>
                  <div style={{ ...styles.tempIndicator, left: `${tempMinigame.sliderPos}%` }}></div>
                </div>

                <button onClick={handleTempSubmit} style={{ ...styles.tapActionBtn, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', marginTop: '20px' }}>
                  🎯 VALIDER LA CUISSON (ESPACE)
                </button>
              </div>
            </div>
          )}

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
            <h2 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '1.6rem' }}>🏁 Service Co-op Terminé !</h2>
            <p style={{ fontSize: '1.2rem', margin: '5px 0' }}>Score d’Équipe : <strong>🪙 {score}</strong></p>
            <p style={{ color: '#34d399', fontSize: '1rem', fontWeight: '600' }}>Votre Contribution : {myContributions} pts</p>

            <div style={{ marginTop: '15px', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#94a3b8' }}>📊 Classement Global (120s) :</h4>
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
              🔄 Rejouer le Service
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
  menuBox: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '35px 30px', borderRadius: '30px', textAlign: 'center', width: '100%', maxWidth: '620px', boxSizing: 'border-box', zIndex: 2, boxShadow: '0 30px 60px rgba(0,0,0,0.6)' },
  lobbyCard: { background: 'rgba(30, 27, 75, 0.85)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '30px', borderRadius: '26px', textAlign: 'center', width: '100%', maxWidth: '500px', boxSizing: 'border-box', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' },
  instructionsBox: { marginTop: '15px', background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' },
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
  emojiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', margin: '15px 0' },
  emojiBtn: { fontSize: '1.6rem', padding: '10px', borderRadius: '14px', border: '1px solid', cursor: 'pointer' },
  primaryButton: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.15rem', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryButton: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.15rem', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold' },
  divider: { margin: '15px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  dividerText: { position: 'absolute', top: '-9px', left: '50%', transform: 'translateX(-50%)', background: '#221a40', padding: '0 8px', fontSize: '0.75rem', color: '#94a3b8' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  input: { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1.1rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', boxSizing: 'border-box' },
  spinner: { width: '32px', height: '32px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1.2s linear infinite', margin: '0 auto' },
  countdownOverlay: { position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  countdownText: { fontSize: '5rem', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 40px rgba(251, 191, 36, 0.6)', textAlign: 'center' },
  gameContainer: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#090d16', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#111827', borderBottom: '1px solid #1f2937' },
  headerItem: { background: '#1f2937', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', fontWeight: '600' },
  scoreBoard: { fontSize: '1.3rem', color: '#38bdf8', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' },
  activeLayout: { flex: 1, display: 'flex', overflow: 'hidden', padding: '10px', gap: '10px' },
  recipeSidebar: { width: '240px', background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '15px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' },
  recipeCardItem: { background: 'rgba(30, 41, 59, 0.7)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' },
  kitchenFloor: { flex: 1, position: 'relative', background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', border: '2px dashed #334155', overflow: 'hidden' },
  station: { position: 'absolute', transform: 'translate(-50%, -50%)', width: '82px', height: '82px', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.25)' },
  stationLabel: { fontSize: '0.6rem', fontWeight: '700', color: '#fff', marginTop: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.8)', textAlign: 'center' },
  stationItemBadge: { position: 'absolute', top: '-14px', right: '-8px', background: '#334155', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', border: '2px solid #fbbf24', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' },
  readyItemBadge: { position: 'absolute', top: '-16px', right: '-10px', background: '#10b981', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', border: '2px solid #fff', boxShadow: '0 0 12px rgba(16, 185, 129, 0.8)', animation: 'popScale 0.4s ease-out' },
  minigameOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  minigameCard: { background: '#1e1b4b', border: '2px solid #fbbf24', padding: '30px', borderRadius: '24px', textAlign: 'center', width: '380px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' },
  miniTrackLarge: { width: '100%', height: '14px', background: '#0f172a', borderRadius: '7px', overflow: 'hidden', margin: '15px 0', border: '1px solid rgba(255,255,255,0.2)' },
  miniFillLarge: { height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)' },
  tapActionBtn: { width: '100%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', padding: '14px', fontSize: '1.1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' },
  tempBarContainer: { position: 'relative', width: '100%', height: '24px', background: '#0f172a', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', margin: '15px 0' },
  tempGreenZone: { position: 'absolute', left: '40%', width: '25%', height: '100%', background: 'rgba(16, 185, 129, 0.4)', borderLeft: '2px solid #10b981', borderRight: '2px solid #10b981' },
  tempIndicator: { position: 'absolute', top: 0, width: '6px', height: '100%', background: '#fff', transform: 'translateX(-50%)', boxShadow: '0 0 8px #fff' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: '16px', transition: 'left 0.1s linear, top 0.1s linear', zIndex: 10 },
  heldBubble: { position: 'absolute', top: '-30px', background: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '2px solid #f59e0b' },
  playerTag: { fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', whiteSpace: 'nowrap' },
  mobileControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 25px', background: '#111827', borderTop: '1px solid #1f2937' },
  dpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gridTemplateRows: 'repeat(2, 44px)', gap: '4px' },
  dpadBtn: { background: '#334155', border: 'none', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBigBtn: { width: '68px', height: '68px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', fontSize: '1.8rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' }
};