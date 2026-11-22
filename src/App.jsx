import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, push } from 'firebase/database';

const APP_VERSION = "v3.8";

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

// Stations strictly separated into Left (Prep) and Right (Cook/Serve) zones
const STATIONS = [
  // Left Side: Prep Zone
  { id: 'crate_tomato', icon: '🍅', type: 'crate', item: '🍅', label: 'Caisse Tomate', x: 12, y: 25, color: '#ef4444', zone: 'prep' },
  { id: 'crate_chili', icon: '🌶️', type: 'crate', item: '🌶️', label: 'Caisse Piment', x: 12, y: 48, color: '#f97316', zone: 'prep' },
  { id: 'crate_chicken', icon: '🍗', type: 'crate', item: '🍗', label: 'Caisse Poulet', x: 12, y: 71, color: '#eab308', zone: 'prep' },
  { id: 'crate_mint', icon: '🌿', type: 'crate', item: '🌿', label: 'Caisse Menthe', x: 12, y: 92, color: '#22c55e', zone: 'prep' },
  { id: 'board_1', icon: '🔪', type: 'board', label: 'Poste Découpe', x: 34, y: 50, color: '#3b82f6', zone: 'prep' },

  // Center Barrier Bridge
  { id: 'pass_counter', icon: '🪟', type: 'pass', label: 'Passe-Plats Central', x: 50, y: 50, color: '#ec4899', zone: 'barrier' },

  // Right Side: Cook & Serve Zone
  { id: 'stove_tagine', icon: '🍲', type: 'stove', itemType: 'tagine', label: 'Tagine Cuisson', x: 68, y: 35, color: '#f59e0b', zone: 'cook' },
  { id: 'stove_tea', icon: '🫖', type: 'stove', itemType: 'tea', label: 'Theière', x: 68, y: 65, color: '#a855f7', zone: 'cook' },
  { id: 'extinguisher', icon: '🧯', type: 'extinguisher', label: 'Extincteur', x: 88, y: 25, color: '#64748b', zone: 'cook' },
  { id: 'serve', icon: '🛎️', type: 'serve', label: 'Comptoir Service', x: 88, y: 75, color: '#10b981', zone: 'cook' },
];

const EMOJIS = ['🧑‍🍳', '👩‍🍳', '👨‍🍳', '🦊', '🐼', '🐱', '🦁', '🐸', '🐯', '🥐', '🥖', '🧀', '🌶️', '🍅', '🍳', '🧄', '🥑', '🍋'];
const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍳', '🫖'];

const RECIPES = [
  { id: 'mechouia', title: "Salade Mechouia 🌶️", requiredItem: '🍅', requiredPrep: '🥗', requiredPot: 'tagine', finalCook: '🍲', points: 15 },
  { id: 'poulet_citron', title: "Tagine Poulet Citron 🍗", requiredItem: '🍗', requiredPrep: '🍖', requiredPot: 'tagine', finalCook: '🍲', points: 20 },
  { id: 'the_menthe', title: "Thé à la Menthe Royale 🫖", requiredItem: '🌿', requiredPrep: '🌿', requiredPot: 'tea', finalCook: '🫖', points: 15 }
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
  const [logs, setLogs] = useState(['🔥 Cuisine Co-op v3.8 Prête']);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myId] = useState(() => 'chef_' + Math.random().toString(36).substring(2, 7));

  const [myRole, setMyRole] = useState('prep'); 
  const [pos, setPos] = useState({ x: 25, y: 50 });
  const [heldItem, setHeldItem] = useState('');
  const [myContributions, setMyContributions] = useState(0);

  const [activeTicket, setActiveTicket] = useState(RECIPES[0]);
  const [recipeStep, setRecipeStep] = useState(1); // 1: Take, 2: Cut, 3: Pass, 4: Cook, 5: Serve
  const [stationStates, setStationStates] = useState({});
  const [minigameData, setMinigameData] = useState(null);
  const [tempMinigame, setTempMinigame] = useState(null);
  const [achievementPopup, setAchievementPopup] = useState({ text: 'Prendre la Tomate 🍅', state: 'active' });
  const [congratsModal, setCongratsModal] = useState(null);
  const [pausedTimer, setPausedTimer] = useState(false);

  const posRef = useRef({ x: 25, y: 50 });
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

  const updateAchievement = (text, isSuccess = false) => {
    setAchievementPopup({ text, state: isSuccess ? 'success' : 'active' });
    if (isSuccess) {
      setTimeout(() => {
        setAchievementPopup(null);
      }, 1500);
    }
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
        contributions: newContrib,
        role: myRole
      });
    }
  };

  const movePlayer = (dx, dy) => {
    if (gameState !== 'playing' || isHost || minigameData || tempMinigame || congratsModal || pausedTimer) return;
    
    let nextX = posRef.current.x + dx;
    let nextY = Math.max(12, Math.min(92, posRef.current.y + dy));

    // Strict barrier: Prep side (left) cannot exceed x=48, Cook side (right) cannot go below x=52
    if (myRole === 'prep') {
      nextX = Math.max(6, Math.min(48, nextX));
    } else {
      nextX = Math.max(52, Math.min(95, nextX));
    }

    const updated = { x: nextX, y: nextY };
    posRef.current = updated;
    setPos(updated);
    syncMyState(updated, heldRef.current, contribRef.current);
  };

  const interactStation = () => {
    if (gameState !== 'playing' || isHost || pausedTimer) return;
    const { x, y } = posRef.current;
    const nearby = STATIONS.find(s => Math.hypot(s.x - x, s.y - y) < 18);
    if (!nearby) return;

    let currentItem = heldRef.current;
    const stState = stationStates[nearby.id] || {};

    if (stState.fire) {
      if (currentItem === '🧯' || nearby.type === 'extinguisher') {
        syncStationUpdate(nearby.id, { ...stState, fire: false, progress: 0 });
        addLog(`🧯 ${playerName} a éteint le feu !`);
      } else if (nearby.type === 'extinguisher' && currentItem === '') {
        heldRef.current = '🧯';
        setHeldItem('🧯');
        addLog(`🧯 ${playerName} a pris l'extincteur.`);
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

    // 1. Crate: Take Ingredient (Prep side)
    if (nearby.type === 'crate' && currentItem === '') {
      if (myRole !== 'prep') {
        addLog(`⚠️ C'est le côté préparation (Chef Gauche) !`);
        return;
      }
      if (nearby.item === activeTicket.requiredItem) {
        const item = nearby.item;
        heldRef.current = item;
        setHeldItem(item);
        const newScore = scoreRef.current + 5;
        const newContrib = contribRef.current + 5;
        scoreRef.current = newScore;
        contribRef.current = newContrib;
        setScore(newScore);
        setMyContributions(newContrib);
        
        updateAchievement(`✅ Prendre ${item} (+5 pts)`, true);
        setTimeout(() => updateAchievement(`Aller découper sur la planche 🔪`), 1600);
        setRecipeStep(2);

        addLog(`${playerEmoji} ${playerName} a pris ${item} (+5 pts)`);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore });
        syncMyState(posRef.current, item, contribRef.current);
      } else {
        addLog(`❌ Mauvais ingrédient ! Il faut ${activeTicket.requiredItem}`);
      }
    } 
    // 2. Cutting Board (Prep side)
    else if (nearby.type === 'board') {
      if (myRole !== 'prep') {
        addLog(`⚠️ Le poste de découpe est réservé au Chef Gauche !`);
        return;
      }
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        syncStationUpdate(nearby.id, { ...stState, readyItem: null });
        addLog(`${playerEmoji} ${playerName} a récupéré ${picked}`);
        syncMyState(posRef.current, picked, contribRef.current);
      } else if (currentItem === activeTicket.requiredItem && !stState.progress && !stState.readyItem) {
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
    // 3. Stoves / Pots (Cook side)
    else if (nearby.type === 'stove') {
      if (myRole !== 'cook') {
        addLog(`⚠️ La cuisson est réservée au Chef Droit !`);
        return;
      }
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        syncStationUpdate(nearby.id, { ...stState, readyItem: null });
        addLog(`${playerEmoji} ${playerName} a récupéré le plat cuit 🔥`);
        syncMyState(posRef.current, picked, contribRef.current);
      } else if (currentItem === activeTicket.requiredPrep && !stState.progress && !stState.readyItem) {
        if (nearby.itemType !== activeTicket.requiredPot) {
          addLog(`❌ Ce n'est pas le bon ustensile ! Il faut utiliser ${activeTicket.requiredPot === 'tagine' ? 'le Tagine 🍲' : 'la Théière 🫖'}`);
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
    // 4. Central Pass Counter (Barrier bridge)
    else if (nearby.type === 'pass') {
      if (stState.readyItem && currentItem === '') {
        const picked = stState.readyItem;
        heldRef.current = picked;
        setHeldItem(picked);
        syncStationUpdate(nearby.id, { ...stState, readyItem: null });
        
        updateAchievement(`✅ Récupérer du Passe-Plats (+5 pts)`, true);
        setTimeout(() => updateAchievement(`Cuire au pot 🍲 / 🫖`), 1600);
        setRecipeStep(4);

        addLog(`🪟 ${playerName} a pris ${picked} du passe-plats.`);
        syncMyState(posRef.current, picked, contribRef.current);
      } else if (currentItem !== '' && !stState.readyItem) {
        const dropped = currentItem;
        heldRef.current = '';
        setHeldItem('');
        syncStationUpdate(nearby.id, { ...stState, readyItem: dropped });
        addLog(`🪟 ${playerName} a passé ${dropped} de l'autre côté !`);
        syncMyState(posRef.current, '', contribRef.current);
      }
    }
    // 5. Serving Counter (Cook side)
    else if (nearby.type === 'serve') {
      if (myRole !== 'cook') {
        addLog(`⚠️ Le service est réservé au Chef Droit !`);
        return;
      }
      if (currentItem === activeTicket.finalCook || currentItem === '🍲' || currentItem === '🫖') {
        heldRef.current = '';
        setHeldItem('');
        const pts = activeTicket.points;
        const newScore = scoreRef.current + pts + 5;
        const newContrib = contribRef.current + pts + 5;
        scoreRef.current = newScore;
        contribRef.current = newContrib;
        setScore(newScore);
        setMyContributions(newContrib);

        updateAchievement(`✅ Servir le plat (+5 pts)`, true);
        addLog(`${playerEmoji} ${playerName} a servi ${activeTicket.title} ! (+${pts + 5} pts) 🛎️`);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore });
        syncMyState(posRef.current, '', contribRef.current);

        setPausedTimer(true);
        setCongratsModal({
          title: activeTicket.title,
          earnedPts: pts + 5
        });
      } else {
        const penaltyScore = Math.max(0, scoreRef.current - 5);
        setScore(penaltyScore);
        scoreRef.current = penaltyScore;
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: penaltyScore });
        addLog(`❌ ERREUR DE SERVICE ! Plat non conforme (-5 pts)`);
      }
    }
  };

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
      
      const newScore = scoreRef.current + 5;
      const newContrib = contribRef.current + 5;
      scoreRef.current = newScore;
      contribRef.current = newContrib;
      setScore(newScore);
      setMyContributions(newContrib);

      updateAchievement(`✅ Cuisson réussie (+5 pts)`, true);
      setTimeout(() => updateAchievement(`Apporter au Comptoir 🛎️`), 1600);
      setRecipeStep(5);

      addLog(`🔥 Cuisson réussie (+5 pts) ➔ ${result}`);
      if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore });
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
      const choppedMap = { '🍅': '🥗', '🌶️': '🥗', '🍗': '🍖', '🌿': '🌿' };
      const result = choppedMap[minigameData.item] || '🥗';
      
      syncStationUpdate(minigameData.stationId, { progress: 0, label: 'Prêt !', currentItem: null, readyItem: result, fire: false });
      
      const newScore = scoreRef.current + 5;
      const newContrib = contribRef.current + 5;
      scoreRef.current = newScore;
      contribRef.current = newContrib;
      setScore(newScore);
      setMyContributions(newContrib);

      updateAchievement(`✅ Découpe réussie (+5 pts)`, true);
      setTimeout(() => updateAchievement(`Mettre sur le Passe-Plats 🪟`), 1600);
      setRecipeStep(3);

      addLog(`🔪 Découpe réussie (+5 pts) ➔ ${result}`);
      if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { score: newScore });
      setMinigameData(null);
    } else {
      setMinigameData(prev => ({ ...prev, currentTaps: updatedTaps }));
    }
  };

  useEffect(() => {
    if (gameState !== 'playing' || !isHost) return;
    const fireInterval = setInterval(() => {
      const stoveStations = STATIONS.filter(s => s.type === 'stove');
      const randomStove = stoveStations[Math.floor(Math.random() * stoveStations.length)];
      
      const currentSt = stationStates[randomStove.id] || {};
      if (!currentSt.fire && Math.random() < 0.2) {
        syncStationUpdate(randomStove.id, { ...currentSt, fire: true, label: '🔥 FEU !' });
        addLog(`🚨 ALERTE FEU sur ${randomStove.label} ! Éteignez-le (🧯) !`);
      }
    }, 15000);
    return () => clearInterval(fireInterval);
  }, [gameState, isHost, stationStates]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing' || isHost || pausedTimer) return;
      const step = 4;
      if (congratsModal && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        const nextRecipe = RECIPES[(RECIPES.findIndex(r => r.id === activeTicket.id) + 1) % RECIPES.length];
        setActiveTicket(nextRecipe);
        setRecipeStep(1);
        updateAchievement(`Prendre ${nextRecipe.requiredItem} ${nextRecipe.requiredItem === '🍅' ? '🍅' : nextRecipe.requiredItem === '🍗' ? '🍗' : '🌿'}`);
        setCongratsModal(null);
        setPausedTimer(false);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { activeTicket: nextRecipe });
        return;
      }
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
  }, [gameState, isHost, minigameData, tempMinigame, congratsModal, pausedTimer, stationStates, activeTicket]);

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
    if (gameState !== 'playing' || !endTime || pausedTimer) return;

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
  }, [gameState, endTime, pausedTimer, isHost, roomCode]);

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
    setRecipeStep(1);
    setAchievementPopup({ text: 'Prendre la Tomate 🍅', state: 'active' });

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
    setMyRole('prep');
    setPos({ x: 25, y: 50 });
    posRef.current = { x: 25, y: 50 };
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
    
    // Auto assign role based on existing players in room
    const currentPlayersCount = Object.keys(players).length;
    const assignedRole = currentPlayersCount === 0 ? 'prep' : 'cook';
    setMyRole(assignedRole);
    const startX = assignedRole === 'prep' ? 25 : 75;
    setPos({ x: startX, y: 50 });
    posRef.current = { x: startX, y: 50 };

    setScreen('player_lobby');
    if (db) {
      set(ref(db, `rooms/${roomCode}/players/${myId}`), {
        name: playerName,
        emoji: playerEmoji,
        x: startX,
        y: 50,
        item: '',
        contributions: 0,
        role: assignedRole
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
          50% { transform: rotate(-35deg) translateY(-10px); }
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
        @keyframes achievementSlide {
          0% { transform: translate(-50%, -30px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .screen-anim { animation: smoothFadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .countdown-num { animation: popScale 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .knife-anim { animation: knifeChopping 0.22s ease-in-out infinite; }
        .fire-anim { animation: fireAlarm 0.5s ease-in-out infinite; }
        .achievement-card { animation: achievementSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .falling-emoji {
          position: fixed;
          top: -60px;
          font-size: 2.5rem;
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
            <h1 style={styles.mainGameTitle}>🍳 Zellige & Saffron v3.8 🌶️</h1>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '30px', fontSize: '1.1rem' }}>En attente de chefs...</p>
                ) : (
                  Object.keys(players).map((pid) => (
                    <li key={pid} style={styles.playerItem}>
                      <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{players[pid].emoji} {players[pid].name} ({players[pid].role === 'prep' ? '🔪 Chef Gauche' : '🍲 Chef Droit'})</span>
                      <span style={{ color: '#34d399', fontWeight: '800', fontSize: '1.2rem' }}>{players[pid].contributions || 0} pts</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div style={styles.dashPanel}>
              <h3 style={styles.panelTitle}>📜 Journal de Cuisine</h3>
              <div style={styles.logsBox}>
                {logs.map((lg, idx) => (
                  <div key={idx} style={{ ...styles.logLine, color: lg.includes('ERREUR') || lg.includes('FEU') ? '#ef4444' : '#e2e8f0' }}>{lg}</div>
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
                  maxWidth: '440px',
                  fontSize: '1.3rem',
                  background: Object.keys(players).length < 2 ? '#374151' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  cursor: Object.keys(players).length < 2 ? 'not-allowed' : 'pointer'
                }}
              >
                {gameState === 'gameover' ? '🔄 Relancer le Service (120s)' : `🚀 Démarrer le Service (${Object.keys(players).length}/2)`}
              </button>
            ) : (
              <div style={{ color: '#34d399', fontWeight: '900', fontSize: '1.4rem' }}>🔥 Service Co-op en Cours !</div>
            )}
          </div>
        </div>
      )}

      {!isHost && gameState === 'waiting' && screen === 'player_lobby' && (
        <div key="wait" className="screen-anim" style={styles.centeredWrapper}>
          <div style={styles.lobbyCard}>
            <div style={styles.codeBadge}>🔑 <strong>{roomCode}</strong></div>
            <h2 style={{ margin: '15px 0', fontSize: '1.8rem', fontWeight: '800' }}>{playerEmoji} {playerName}</h2>
            <div style={styles.roleBadgeContainer}>
              Rôle Attribué : <strong style={{ color: '#38bdf8' }}>{myRole === 'prep' ? '🔪 Chef Côté Gauche (Préparation)' : '🍲 Chef Côté Droit (Cuisson & Service)'}</strong>
            </div>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '18px', color: '#e2e8f0', fontSize: '1.15rem', fontWeight: '700' }}>⏳ En attente du Chef Principal...</p>
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
            <div style={styles.headerItem}>⏱️ <strong style={{ color: timeLeft <= 15 ? '#ef4444' : '#fff', fontSize: '1.1rem' }}>{timeLeft}s</strong></div>
            <div style={styles.dishHeaderTitle}>🍲 Plat en cours : <span style={{ color: '#fbbf24' }}>{activeTicket.title}</span></div>
            <div style={styles.headerRightGroup}>
              <div style={styles.scoreBoard}>🪙 {score}</div>
              <div style={styles.headerItem}>🤲 <span style={{ fontSize: '1.6rem' }}>{heldItem || '➖'}</span></div>
            </div>
          </header>

          <div style={styles.activeLayout}>
            <div style={styles.kitchenFloor}>
              <div style={styles.barrierLine}></div>

              {/* Achievement Notification Overlay on top (Centered) */}
              {achievementPopup && (
                <div className="achievement-card" style={{
                  ...styles.achievementBanner,
                  background: achievementPopup.state === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(30, 27, 75, 0.95)',
                  borderColor: achievementPopup.state === 'success' ? '#34d399' : '#fbbf24'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{achievementPopup.state === 'success' ? '✅' : '🔔'}</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#fff' }}>{achievementPopup.text}</span>
                </div>
              )}

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
                      borderColor: hasFire ? '#ef4444' : (isReady ? '#34d399' : (isWorking ? '#fbbf24' : 'rgba(255,255,255,0.3)'))
                    }}
                  >
                    <div className={hasFire ? 'fire-anim' : (st.type === 'board' && isWorking ? 'knife-anim' : '')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '2.4rem' }}>
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
                      border: isMe ? '3px solid #fbbf24' : '3px solid rgba(255,255,255,0.4)'
                    }}
                  >
                    {pItem && <div style={styles.heldBubble}>{pItem}</div>}
                    <div style={{ fontSize: '2.4rem' }}>{p.emoji}</div>
                    <div style={styles.playerTag}>{p.name} ({p.role === 'prep' ? 'Gauche' : 'Droit'})</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Congrats / Recipe Level-Up Overlay Modal */}
          {congratsModal && (
            <div style={styles.minigameOverlay}>
              <div style={styles.congratsCard}>
                <h2 style={{ color: '#10b981', fontSize: '2.4rem', margin: '0 0 12px 0', fontWeight: '900' }}>🎉 FÉLICITATIONS !</h2>
                <p style={{ fontSize: '1.25rem', color: '#fff', margin: '8px 0', lineHeight: '1.5' }}>
                  Vous avez servi <strong>{congratsModal.title}</strong> avec succès ! (+{congratsModal.earnedPts} pts)
                </p>
                <div style={styles.divider}></div>
                <h4 style={{ color: '#fbbf24', margin: '12px 0 8px 0', fontSize: '1.2rem', fontWeight: '800' }}>📜 CONTINUER AVEC VOTRE PROCHAIN REPAS :</h4>
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '18px', borderRadius: '16px', margin: '12px 0', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>Préparez le prochain ticket ensemble !</div>
                  <div style={{ fontSize: '1.05rem', color: '#e2e8f0', lineHeight: '1.6' }}>
                    Le minuteur est en pause. Appuyez sur Espace ou Continuer pour lancer la suite.
                  </div>
                </div>
                <button onClick={() => {
                  const nextRecipe = RECIPES[(RECIPES.findIndex(r => r.id === activeTicket.id) + 1) % RECIPES.length];
                  setActiveTicket(nextRecipe);
                  setRecipeStep(1);
                  updateAchievement(`Prendre ${nextRecipe.requiredItem} ${nextRecipe.requiredItem === '🍅' ? '🍅' : nextRecipe.requiredItem === '🍗' ? '🍗' : '🌿'}`);
                  setCongratsModal(null);
                  setPausedTimer(false);
                  if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { activeTicket: nextRecipe });
                }} style={{ ...styles.primaryButton, marginTop: '15px', fontSize: '1.2rem' }}>
                  CONTINUER AVEC VOTRE PROCHAIN REPAS 🚀 (ESPACE)
                </button>
              </div>
            </div>
          )}

          {/* Rhythm Chopping Minigame Modal */}
          {minigameData && (
            <div style={styles.minigameOverlay}>
              <div style={styles.minigameCard}>
                <h3 style={{ margin: '0 0 12px 0', color: '#fbbf24', fontSize: '1.5rem', fontWeight: '800' }}>🔪 Découpe en Cadence !</h3>
                <p style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>{minigameData.label}</p>
                <div style={{ fontSize: '3rem', margin: '18px 0' }}>{minigameData.item} ➔ 🥗</div>
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
                <h3 style={{ margin: '0 0 12px 0', color: '#f59e0b', fontSize: '1.5rem', fontWeight: '800' }}>🔥 Contrôle de Température Pot !</h3>
                <p style={{ fontSize: '1.05rem', color: '#cbd5e1', marginBottom: '12px' }}>Appuyez quand l'indicateur est dans la zone verte !</p>
                
                <div style={styles.tempBarContainer}>
                  <div style={styles.tempGreenZone}></div>
                  <div style={{ ...styles.tempIndicator, left: `${tempMinigame.sliderPos}%` }}></div>
                </div>

                <button onClick={handleTempSubmit} style={{ ...styles.tapActionBtn, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', marginTop: '22px' }}>
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
            <h2 style={{ margin: '0 0 15px 0', color: '#fbbf24', fontSize: '2rem', fontWeight: '900' }}>🏁 Service Co-op Terminé !</h2>
            <p style={{ fontSize: '1.35rem', margin: '8px 0' }}>Score d’Équipe : <strong>🪙 {score}</strong></p>
            <p style={{ color: '#34d399', fontSize: '1.15rem', fontWeight: '700' }}>Votre Contribution : {myContributions} pts</p>

            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#94a3b8', fontWeight: '800' }}>📊 Classement Global (120s) :</h4>
              <div style={styles.lbBox}>
                {leaderboard.map((entry, idx) => (
                  <div key={idx} style={{ ...styles.lbItem, background: entry.room === roomCode ? 'rgba(16, 185, 129, 0.25)' : 'transparent' }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem' }}>#{idx + 1} Salon {entry.room}</span>
                    <span style={{ color: '#38bdf8', fontWeight: '800', fontSize: '1rem' }}>🪙 {entry.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => window.location.reload()} style={{ ...styles.primaryButton, marginTop: '20px', fontSize: '1.2rem' }}>
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
  versionBadge: { position: 'fixed', bottom: '12px', left: '16px', fontSize: '0.85rem', fontWeight: '800', color: 'rgba(255, 255, 255, 0.55)', background: 'rgba(0, 0, 0, 0.45)', padding: '4px 10px', borderRadius: '8px', zIndex: 100, pointerEvents: 'none', letterSpacing: '0.5px' },
  centeredWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box' },
  heroBadge: { background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '6px 16px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px' },
  mainGameTitle: { fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', margin: '0 0 8px 0', fontWeight: '900', textAlign: 'center', color: '#fbbf24', textShadow: '0 2px 14px rgba(251, 191, 36, 0.35)' },
  subSubtitle: { fontSize: '1.5rem', color: '#e2e8f0', marginBottom: '25px', fontWeight: '800', textAlign: 'center' },
  menuBox: { background: 'rgba(30, 27, 75, 0.88)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '40px 35px', borderRadius: '32px', textAlign: 'center', width: '100%', maxWidth: '660px', boxSizing: 'border-box', zIndex: 2, boxShadow: '0 30px 60px rgba(0,0,0,0.7)' },
  lobbyCard: { background: 'rgba(30, 27, 75, 0.88)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '35px', borderRadius: '30px', textAlign: 'center', width: '100%', maxWidth: '580px', boxSizing: 'border-box', boxShadow: '0 30px 60px rgba(0,0,0,0.7)' },
  roleBadgeContainer: { background: 'rgba(15, 23, 42, 0.8)', padding: '12px 18px', borderRadius: '14px', margin: '15px 0', border: '1px solid rgba(255,255,255,0.15)', fontSize: '1.1rem' },
  resultsCard: { background: 'rgba(30, 27, 75, 0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '40px', borderRadius: '30px', textAlign: 'center', width: '100%', maxWidth: '540px', boxSizing: 'border-box', boxShadow: '0 30px 60px rgba(0,0,0,0.7)' },
  hostFullScreen: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', padding: '20px 30px', boxSizing: 'border-box', background: 'rgba(15, 23, 42, 0.7)' },
  hostHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 28px', background: 'rgba(30, 27, 75, 0.88)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.12)' },
  hostMainGrid: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px', margin: '22px 0', minHeight: 0 },
  hostFooter: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0' },
  dashPanel: { background: 'rgba(30, 27, 75, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  panelTitle: { margin: '0 0 14px 0', fontSize: '1.25rem', fontWeight: '800', color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '10px' },
  logsBox: { flex: 1, overflowY: 'auto', background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '12px' },
  logLine: { fontSize: '1.05rem', marginBottom: '8px', lineHeight: '1.5' },
  copyBtn: { background: 'rgba(99, 102, 241, 0.3)', border: '1px solid #6366f1', color: '#fff', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.2rem' },
  codeBadge: { background: '#4338ca', padding: '10px 18px', borderRadius: '12px', fontSize: '1.35rem', letterSpacing: '2px', border: '1px solid #6366f1', fontWeight: '800' },
  playerList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 },
  playerItem: { background: 'rgba(15, 23, 42, 0.7)', padding: '14px 18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)' },
  lbBox: { maxHeight: '160px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '10px', border: '1px solid rgba(255,255,255,0.12)' },
  lbItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', fontSize: '1rem', marginBottom: '6px' },
  emojiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', margin: '18px 0' },
  emojiBtn: { fontSize: '1.8rem', padding: '12px', borderRadius: '16px', border: '1px solid', cursor: 'pointer' },
  primaryButton: { width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '18px', fontSize: '1.25rem', borderRadius: '16px', cursor: 'pointer', fontWeight: '800', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)' },
  secondaryButton: { width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '18px', fontSize: '1.25rem', borderRadius: '16px', cursor: 'pointer', fontWeight: '800', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)' },
  divider: { margin: '18px 0', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.15)' },
  dividerText: { position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#221a40', padding: '0 10px', fontSize: '0.85rem', color: '#94a3b8', fontWeight: '800' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  input: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.25)', fontSize: '1.2rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.7)', color: '#fff', boxSizing: 'border-box' },
  spinner: { width: '38px', height: '38px', border: '4px solid rgba(255,255,255,0.12)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1.2s linear infinite', margin: '0 auto' },
  countdownOverlay: { position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  countdownText: { fontSize: '6rem', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 50px rgba(251, 191, 36, 0.7)', textAlign: 'center' },
  gameContainer: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#090d16', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: '#111827', borderBottom: '1px solid #1f2937' },
  headerItem: { background: '#1f2937', padding: '8px 16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '700' },
  headerRightGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  dishHeaderTitle: { fontSize: '1.2rem', fontWeight: '800', background: 'rgba(245, 158, 11, 0.15)', padding: '8px 20px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.35)' },
  scoreBoard: { fontSize: '1.45rem', color: '#38bdf8', fontWeight: '900', background: 'rgba(56, 189, 248, 0.18)', padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.35)' },
  activeLayout: { flex: 1, display: 'flex', overflow: 'hidden', padding: '12px', gap: '12px' },
  kitchenFloor: { flex: 1, position: 'relative', background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)', borderRadius: '18px', border: '2px dashed #334155', overflow: 'hidden' },
  barrierLine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: '4px', background: 'rgba(236, 72, 153, 0.4)', transform: 'translateX(-50%)', borderStyle: 'dashed', borderColor: '#ec4899' },
  achievementBanner: { position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 24px', borderRadius: '14px', border: '2px solid', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.6)' },
  station: { position: 'absolute', transform: 'translate(-50%, -50%)', width: '90px', height: '90px', borderRadius: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', border: '2.5px solid rgba(255,255,255,0.3)' },
  stationLabel: { fontSize: '0.7rem', fontWeight: '800', color: '#fff', marginTop: '3px', textShadow: '0 1px 4px rgba(0,0,0,0.9)', textAlign: 'center' },
  stationItemBadge: { position: 'absolute', top: '-16px', right: '-10px', background: '#334155', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', border: '2.5px solid #fbbf24', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' },
  readyItemBadge: { position: 'absolute', top: '-18px', right: '-12px', background: '#10b981', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', border: '2.5px solid #fff', boxShadow: '0 0 16px rgba(16, 185, 129, 0.9)', animation: 'popScale 0.4s ease-out' },
  minigameOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  minigameCard: { background: '#1e1b4b', border: '2.5px solid #fbbf24', padding: '35px', borderRadius: '28px', textAlign: 'center', width: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.9)' },
  congratsCard: { background: '#1e1b4b', border: '2.5px solid #10b981', padding: '40px', borderRadius: '30px', textAlign: 'center', width: '480px', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' },
  miniTrackLarge: { width: '100%', height: '16px', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', margin: '18px 0', border: '1.5px solid rgba(255,255,255,0.25)' },
  miniFillLarge: { height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)' },
  tapActionBtn: { width: '100%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', padding: '16px', fontSize: '1.2rem', borderRadius: '14px', cursor: 'pointer', fontWeight: '800' },
  tempBarContainer: { position: 'relative', width: '100%', height: '28px', background: '#0f172a', borderRadius: '14px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.25)', margin: '18px 0' },
  tempGreenZone: { position: 'absolute', left: '40%', width: '25%', height: '100%', background: 'rgba(16, 185, 129, 0.45)', borderLeft: '2.5px solid #10b981', borderRight: '2.5px solid #10b981' },
  tempIndicator: { position: 'absolute', top: 0, width: '8px', height: '100%', background: '#fff', transform: 'translateX(-50%)', boxShadow: '0 0 10px #fff' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(15, 23, 42, 0.9)', padding: '8px 14px', borderRadius: '18px', transition: 'left 0.1s linear, top 0.1s linear', zIndex: 10 },
  heldBubble: { position: 'absolute', top: '-34px', background: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 4px 12px rgba(0,0,0,0.6)', border: '2.5px solid #f59e0b' },
  playerTag: { fontSize: '0.9rem', fontWeight: '800', color: '#f1f5f9', whiteSpace: 'nowrap' },
  mobileControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 28px', background: '#111827', borderTop: '1px solid #1f2937' },
  dpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gridTemplateRows: 'repeat(2, 48px)', gap: '6px' },
  dpadBtn: { background: '#334155', border: 'none', borderRadius: '12px', fontSize: '1.35rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBigBtn: { width: '74px', height: '74px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', fontSize: '2rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(245, 158, 11, 0.5)' }
};