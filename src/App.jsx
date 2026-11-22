import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update } from 'firebase/database';

const APP_VERSION = "v9.0";

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
const GROUND_HEIGHT = 28;
const HITBOX_HALF_W = 16;

const PLATFORM_LAYOUT = [
  { x: 180, offsetFromGround: 130, w: 180, h: 24 },
  { x: 440, offsetFromGround: 230, w: 200, h: 24 },
  { x: 720, offsetFromGround: 140, w: 180, h: 24 },
  { x: 980, offsetFromGround: 260, w: 220, h: 24 },
  { x: 1300, offsetFromGround: 170, w: 200, h: 24 },
  { x: 1600, offsetFromGround: 270, w: 180, h: 24 },
  { x: 1880, offsetFromGround: 180, w: 240, h: 24 }
];

const INITIAL_ITEMS = [
  { id: 'item_1', x: 220, y: 130, type: '🍅', origin: { x: 220, y: 130 } },
  { id: 'item_2', x: 780, y: 140, type: '🧄', origin: { x: 780, y: 140 } },
  { id: 'item_3', x: 1350, y: 170, type: '🥖', origin: { x: 1350, y: 170 } }
];

const STATIONS = {
  cuttingBoard: { x: 500, offsetFromGround: 230 },
  pot: { x: 1050, offsetFromGround: 260 },
  counter: { x: 1950, offsetFromGround: 180 }
};

const RECIPES = [
  {
    name: "Tajine à la Tomate",
    ingredient: '🍅',
    ingredientLabel: "la tomate 🍅",
    itemId: 'item_1'
  },
  {
    name: "Couscous à l'Ail",
    ingredient: '🧄',
    ingredientLabel: "l'ail 🧄",
    itemId: 'item_2'
  },
  {
    name: "Pain Grillé Royal",
    ingredient: '🥖',
    ingredientLabel: "la baguette 🥖",
    itemId: 'item_3'
  }
];

const SPRITE_STATES = {
  idle: [{ x: 35, y: 15, w: 34, h: 45 }],
  run: [{ x: 35, y: 110, w: 36, h: 45 }, { x: 74, y: 110, w: 36, h: 45 }],
  jump: [{ x: 28, y: 155, w: 42, h: 42 }],
  fall: [{ x: 35, y: 15, w: 34, h: 45 }]
};

function ChefSprite({ anim = 'idle', facingRight = true, frameTick = 0, isGhost = false }) {
  const frames = SPRITE_STATES[anim] || SPRITE_STATES.idle;
  const f = frames[frameTick % frames.length];
  const scale = 1.0;

  return (
    <div
      style={{
        width: `${f.w * scale}px`,
        height: `${f.h * scale}px`,
        overflow: 'hidden',
        position: 'relative',
        transform: facingRight ? 'scaleX(1)' : 'scaleX(-1)',
        opacity: isGhost ? 0.45 : 1,
        filter: isGhost ? 'drop-shadow(0 3px 5px rgba(0,0,0,0.2)) grayscale(30%)' : 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))'
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
  const [worldItems, setWorldItems] = useState(INITIAL_ITEMS);
  const [stationState, setStationState] = useState({
    cuttingBoardItem: null,
    cuttingBoardActive: false,
    potItem: null,
    potCooking: false,
    servedDishes: 0
  });

  const [gameState, setGameState] = useState('waiting');
  const [countdown, setCountdown] = useState(null);
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState(['🔥 Zellige & Saffron 2.5D v9.0 Prêt']);
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));

  const [recipeIndex, setRecipeIndex] = useState(0);
  const [questStep, setQuestStep] = useState(0);
  const [bannerStatus, setBannerStatus] = useState('neutral');
  const [bannerFading, setBannerFading] = useState(false);

  const [activeMinigame, setActiveMinigame] = useState(null);
  const [sliderPos, setSliderPos] = useState(0);
  const sliderDirRef = useRef(1);
  const sliderPosRef = useRef(0);

  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const initialFloorY = window.innerHeight - GROUND_HEIGHT;

  const [pos, setPos] = useState({ x: 140, y: initialFloorY });
  const [isGrounded, setIsGrounded] = useState(true);
  const [jumpsLeft, setJumpsLeft] = useState(2);
  const [animState, setAnimState] = useState('idle');
  const [facingRight, setFacingRight] = useState(true);
  const [frameTick, setFrameTick] = useState(0);
  const [holdingItem, setHoldingItem] = useState(null);
  const [holdingState, setHoldingState] = useState('raw');

  const posRef = useRef({ x: 140, y: initialFloorY });
  const velRef = useRef({ x: 0, y: 0 });
  const groundedRef = useRef(true);
  const jumpsRef = useRef(2);
  const facingRef = useRef(true);
  const keysPressed = useRef({});
  const viewportRef = useRef(viewport);
  const itemsRef = useRef(INITIAL_ITEMS);
  const stationRef = useRef(stationState);

  // Bulletproof Ref trackers for game state
  const questStepRef = useRef(0);
  const holdingItemRef = useRef(null);
  const holdingStateRef = useRef('raw');

  const updateQuestStep = (step) => {
    questStepRef.current = step;
    setQuestStep(step);
  };

  const updateHolding = (item, state) => {
    holdingItemRef.current = item;
    holdingStateRef.current = state;
    setHoldingItem(item);
    setHoldingState(state);
  };

  const currentRecipe = RECIPES[recipeIndex % RECIPES.length];

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

  useEffect(() => {
    if (gameState === 'playing' && !isHost) {
      setCountdown(3);
      const t1 = setTimeout(() => setCountdown(2), 1000);
      const t2 = setTimeout(() => setCountdown(1), 2000);
      const t3 = setTimeout(() => setCountdown('GO!'), 3000);
      const t4 = setTimeout(() => setCountdown(null), 3700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [gameState, isHost]);

  useEffect(() => {
    if (!activeMinigame) return;
    sliderPosRef.current = 0;
    sliderDirRef.current = 1;
    setSliderPos(0);

    const speed = activeMinigame.type === 'cut' ? 2.6 : 2.2;
    const interval = setInterval(() => {
      let next = sliderPosRef.current + speed * sliderDirRef.current;
      if (next >= 100) {
        next = 100;
        sliderDirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        sliderDirRef.current = 1;
      }
      sliderPosRef.current = next;
      setSliderPos(next);
    }, 16);

    return () => clearInterval(interval);
  }, [activeMinigame]);

  const triggerQuestFeedback = (status, nextStepVal = null) => {
    setBannerStatus(status);
    setTimeout(() => {
      setBannerFading(true);
      setTimeout(() => {
        if (nextStepVal !== null) {
          updateQuestStep(nextStepVal);
        }
        setBannerStatus('neutral');
        setBannerFading(false);
      }, 250);
    }, 600);
  };

  const resolveMinigame = () => {
    if (!activeMinigame) return;
    const posVal = sliderPosRef.current;
    const isGood = posVal >= 35 && posVal <= 65;

    if (activeMinigame.type === 'cut') {
      if (isGood) {
        setScore(prev => prev + 50);
        updateHolding(activeMinigame.itemType, 'chopped');
        const updatedStations = { ...stationRef.current, cuttingBoardItem: null, cuttingBoardActive: false };
        stationRef.current = updatedStations;
        setStationState(updatedStations);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
        setActiveMinigame(null);
        triggerQuestFeedback('success', 2); // Step 2: Cooking
      } else {
        setScore(prev => Math.max(0, prev - 20));
        setBannerStatus('error');
        setTimeout(() => setBannerStatus('neutral'), 700);
      }
    } else if (activeMinigame.type === 'cook') {
      if (isGood) {
        setScore(prev => prev + 50);
        updateHolding('🍲', 'cooked');
        const updatedStations = { ...stationRef.current, potItem: null, potCooking: false };
        stationRef.current = updatedStations;
        setStationState(updatedStations);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
        setActiveMinigame(null);
        triggerQuestFeedback('success', 3); // Step 3: Serving
      } else {
        setScore(prev => Math.max(0, prev - 20));
        setBannerStatus('error');
        setTimeout(() => setBannerStatus('neutral'), 700);
      }
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRandomName = () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];

  const syncMyState = (newPos, floorY, currentAnim, isRight, carriedItem) => {
    if (db && roomCode && !isHost) {
      update(ref(db, `rooms/${roomCode}/players/${myId}`), {
        x: newPos.x,
        heightAboveGround: Math.max(0, floorY - newPos.y),
        name: playerName,
        anim: currentAnim,
        facingRight: isRight,
        holding: carriedItem
      });
    }
  };

  const handleSpaceAction = () => {
    if (isHost || countdown !== null) return;

    if (activeMinigame) {
      resolveMinigame();
      return;
    }

    const floorY = viewportRef.current.h - GROUND_HEIGHT;
    const px = posRef.current.x;
    const py = posRef.current.y;

    const cbPlatform = PLATFORM_LAYOUT.find(p => p.offsetFromGround === STATIONS.cuttingBoard.offsetFromGround);
    const cbWorldY = floorY - cbPlatform.offsetFromGround;

    const potPlatform = PLATFORM_LAYOUT.find(p => p.offsetFromGround === STATIONS.pot.offsetFromGround);
    const potWorldY = floorY - potPlatform.offsetFromGround;

    const counterPlatform = PLATFORM_LAYOUT.find(p => p.offsetFromGround === STATIONS.counter.offsetFromGround);
    const counterWorldY = floorY - counterPlatform.offsetFromGround;

    const curStep = questStepRef.current;
    const curHolding = holdingItemRef.current;
    const curState = holdingStateRef.current;

    // 1. Serving Counter (Step 3)
    if (Math.abs(px - STATIONS.counter.x) < 80 && Math.abs(py - counterWorldY) < 80) {
      if (curHolding && curState === 'cooked' && curStep === 3) {
        const updatedStations = { ...stationRef.current, servedDishes: stationRef.current.servedDishes + 1 };
        stationRef.current = updatedStations;
        setStationState(updatedStations);
        updateHolding(null, 'raw');
        setScore(prev => prev + 100);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
        setRecipeIndex(prev => prev + 1);
        setWorldItems(INITIAL_ITEMS);
        itemsRef.current = INITIAL_ITEMS;
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/items`), INITIAL_ITEMS);
        triggerQuestFeedback('success', 0);
      } else {
        triggerQuestFeedback('error');
      }
      return;
    }

    // 2. Cutting Board Station (Step 1)
    if (Math.abs(px - STATIONS.cuttingBoard.x) < 80 && Math.abs(py - cbWorldY) < 80) {
      if (curHolding === currentRecipe.ingredient && curState === 'raw' && curStep === 1) {
        const itemType = curHolding;
        updateHolding(null, 'raw');
        const updatedStations = { ...stationRef.current, cuttingBoardItem: { type: itemType }, cuttingBoardActive: true };
        stationRef.current = updatedStations;
        setStationState(updatedStations);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
        setActiveMinigame({ type: 'cut', itemType });
      } else {
        triggerQuestFeedback('error');
      }
      return;
    }

    // 3. Pot Station (Step 2)
    if (Math.abs(px - STATIONS.pot.x) < 80 && Math.abs(py - potWorldY) < 80) {
      if (curHolding === currentRecipe.ingredient && curState === 'chopped' && curStep === 2) {
        const itemType = curHolding;
        updateHolding(null, 'raw');
        const updatedStations = { ...stationRef.current, potCooking: true };
        stationRef.current = updatedStations;
        setStationState(updatedStations);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
        setActiveMinigame({ type: 'cook', itemType });
      } else {
        triggerQuestFeedback('error');
      }
      return;
    }

    // 4. Pickup from World Items (Step 0) - Robust X-range check
    if (!curHolding && curStep === 0) {
      let pickedType = null;
      const remainingItems = itemsRef.current.filter(item => {
        const xDist = Math.abs(px - item.x);
        if (xDist < 80 && !pickedType) {
          if (item.type === currentRecipe.ingredient) {
            pickedType = item.type;
            return false;
          } else {
            triggerQuestFeedback('error');
          }
        }
        return true;
      });

      if (pickedType) {
        updateHolding(pickedType, 'raw');
        itemsRef.current = remainingItems;
        setWorldItems(remainingItems);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/items`), remainingItems);
        
        // Instantly forces step advancement and green success banner
        triggerQuestFeedback('success', 1);
      }
    }
  };

  const handleJumpAction = () => {
    if (gameState !== 'playing' || isHost || countdown !== null || activeMinigame !== null) return;
    if (jumpsRef.current > 0) {
      velRef.current.y = -13;
      jumpsRef.current -= 1;
      setJumpsLeft(jumpsRef.current);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing' || isHost) return;
      keysPressed.current[e.key] = true;

      if (e.key === ' ') {
        e.preventDefault();
        handleSpaceAction();
      } else if (!activeMinigame && countdown === null && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && jumpsRef.current > 0) {
        e.preventDefault();
        handleJumpAction();
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
  }, [gameState, isHost, activeMinigame, countdown, currentRecipe]);

  useEffect(() => {
    if (gameState !== 'playing' || isHost) return;

    const gravity = 0.65;
    const friction = 0.82;
    const moveSpeed = 1.45;

    const interval = setInterval(() => {
      if (countdown !== null || activeMinigame !== null) return;

      const floorY = viewportRef.current.h - GROUND_HEIGHT;
      let vx = velRef.current.x;
      let vy = velRef.current.y;
      let px = posRef.current.x;
      let prevY = posRef.current.y;
      let py = prevY;
      let currentAnim = 'idle';
      let isRight = facingRef.current;

      const movingLeft = keysPressed.current['ArrowLeft'] || keysPressed.current['a'] || keysPressed.current['A'] || keysPressed.current['touchLeft'];
      const movingRight = keysPressed.current['ArrowRight'] || keysPressed.current['d'] || keysPressed.current['D'] || keysPressed.current['touchRight'];

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

      syncMyState({ x: px, y: py }, floorY, currentAnim, isRight, holdingItemRef.current);
    }, 20);

    return () => clearInterval(interval);
  }, [gameState, isHost, countdown, activeMinigame]);

  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        setPlayers(data.players || {});
        if (data.items) {
          setWorldItems(data.items);
          itemsRef.current = data.items;
        }
        if (data.stations) {
          setStationState(data.stations);
          stationRef.current = data.stations;
        }
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
    setRoomCode(code);
    setIsHost(true);
    setPlayerName("Host Spectator");
    setScreen('host_lobby');

    if (db) {
      set(ref(db, `rooms/${code}`), {
        status: 'waiting',
        items: INITIAL_ITEMS,
        stations: { cuttingBoardItem: null, cuttingBoardActive: false, potItem: null, potCooking: false, servedDishes: 0 },
        logs: [`👑 Salon ${code} ouvert`]
      });
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsHost(false);
    const uniqueName = getRandomName();
    setPlayerName(uniqueName);
    const spawnFloor = window.innerHeight - GROUND_HEIGHT;
    posRef.current = { x: 140, y: spawnFloor };
    setPos({ x: 140, y: spawnFloor });
    setScreen('player_lobby');

    if (db) {
      set(ref(db, `rooms/${roomCode}/players/${myId}`), {
        name: uniqueName,
        x: 140,
        heightAboveGround: 0,
        anim: 'idle',
        facingRight: true,
        holding: null
      });
    }
  };

  const floorY = viewport.h - GROUND_HEIGHT;
  const zoom = 1.35;
  const cameraX = Math.max(0, Math.min(WORLD_WIDTH - viewport.w / zoom, pos.x - (viewport.w / zoom) / 2));
  const cameraY = Math.max(0, Math.min(viewport.h, pos.y - (viewport.h / zoom) / 2 - 60));

  const cbPlatform = PLATFORM_LAYOUT.find(p => p.offsetFromGround === STATIONS.cuttingBoard.offsetFromGround);
  const cbTop = floorY - cbPlatform.offsetFromGround - 36;

  const potPlatform = PLATFORM_LAYOUT.find(p => p.offsetFromGround === STATIONS.pot.offsetFromGround);
  const potTop = floorY - potPlatform.offsetFromGround - 36;

  const counterPlatform = PLATFORM_LAYOUT.find(p => p.offsetFromGround === STATIONS.counter.offsetFromGround);
  const counterTop = floorY - counterPlatform.offsetFromGround - 52;

  const getQuestInfo = () => {
    if (questStep === 0) {
      const targetItem = worldItems.find(i => i.type === currentRecipe.ingredient) || INITIAL_ITEMS.find(i => i.type === currentRecipe.ingredient);
      const targetY = targetItem ? (targetItem.y === 0 ? floorY - 65 : floorY - targetItem.y - 68) : floorY - 180;
      return {
        text: `1. Prends ${currentRecipe.ingredientLabel} (ESPACE)`,
        arrowX: targetItem ? targetItem.x : 220,
        arrowY: targetY
      };
    }
    if (questStep === 1) {
      return {
        text: `2. Coupe ${currentRecipe.ingredientLabel} sur la planche 🔪 (ESPACE)`,
        arrowX: STATIONS.cuttingBoard.x,
        arrowY: cbTop - 42
      };
    }
    if (questStep === 2) {
      return {
        text: `3. Fais cuire dans la marmite 🍲 (ESPACE)`,
        arrowX: STATIONS.pot.x,
        arrowY: potTop - 52
      };
    }
    return {
      text: `4. Sers le plat (${currentRecipe.name}) au comptoir 🛎️ (ESPACE)`,
      arrowX: STATIONS.counter.x,
      arrowY: counterTop - 42
    };
  };

  const questInfo = getQuestInfo();

  const getQuestBannerStyle = () => {
    let bg = 'rgba(15, 23, 42, 0.92)';
    let border = '#fbbf24';
    if (bannerStatus === 'success') {
      bg = 'rgba(16, 185, 129, 0.95)';
      border = '#34d399';
    } else if (bannerStatus === 'error') {
      bg = 'rgba(239, 68, 68, 0.95)';
      border = '#f87171';
    }
    return {
      ...styles.questHeader,
      background: bg,
      borderColor: border,
      opacity: bannerFading ? 0 : 1,
      transform: bannerFading ? 'translate(-50%, -14px)' : 'translate(-50%, 0px)'
    };
  };

  return (
    <div style={styles.appContainer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; user-select: none; }
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
        @keyframes floatArrow {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        .holding-arrow {
          animation: floatArrow 1s ease-in-out infinite;
        }
        @keyframes goldenBounce {
          0% { transform: translate(-50%, 0px) scale(1); }
          50% { transform: translate(-50%, -12px) scale(1.15); }
          100% { transform: translate(-50%, 0px) scale(1); }
        }
        .golden-arrow {
          animation: goldenBounce 0.8s ease-in-out infinite;
          filter: drop-shadow(0 0 12px #fbbf24) drop-shadow(0 0 24px #f59e0b);
        }
        @keyframes chopKnife {
          0% { transform: translateY(0px) rotate(-20deg); }
          50% { transform: translateY(-12px) rotate(15deg); }
          100% { transform: translateY(0px) rotate(-20deg); }
        }
        .chopping-knife {
          animation: chopKnife 0.25s ease-in-out infinite;
        }
        @keyframes boilPot {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .boiling-pot {
          animation: boilPot 0.5s ease-in-out infinite;
        }
        @keyframes fireFlicker {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        .fire-stand {
          animation: fireFlicker 0.4s ease-in-out infinite;
        }
        @keyframes popCountdown {
          0% { transform: scale(0.4); opacity: 0; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .countdown-num {
          animation: popCountdown 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
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
              <h3>👥 Chefs Compétiteurs ({Object.keys(players).length})</h3>
              {Object.keys(players).length === 0 ? <p style={{ color: '#94a3b8' }}>En attente de joueurs...</p> : (
                Object.keys(players).map(id => (
                  <div key={id} style={styles.playerItem}>
                    <span>👨‍🍳 {players[id].name} {players[id].holding ? `(Porte: ${players[id].holding})` : ''}</span>
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
          {/* Top HUD Stats */}
          <div style={styles.hudBar}>
            <span>⭐ Score: {score}</span>
            <span>🦘 Sauts: {jumpsLeft}/2</span>
            <span>🎒 En main: {holdingItem || 'Aucun'}</span>
            <span>🍲 Plats: {stationState.servedDishes}</span>
          </div>

          {/* Dynamic French Instruction / Achievement Banner */}
          <div style={getQuestBannerStyle()}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', marginBottom: '2px' }}>
              Recette : {currentRecipe.name}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>
              {bannerStatus === 'success' ? '✅ Bien joué !' : bannerStatus === 'error' ? '❌ Mauvaise action ! (-20 pts)' : questInfo.text}
            </div>
          </div>

          {/* On-Screen Mobile Touch Controls */}
          <div style={styles.touchControlsContainer}>
            <div style={styles.touchDpad}>
              <button
                style={styles.touchBtn}
                onTouchStart={() => { keysPressed.current['touchLeft'] = true; }}
                onTouchEnd={() => { keysPressed.current['touchLeft'] = false; }}
                onMouseDown={() => { keysPressed.current['touchLeft'] = true; }}
                onMouseUp={() => { keysPressed.current['touchLeft'] = false; }}
                onMouseLeave={() => { keysPressed.current['touchLeft'] = false; }}
              >
                ◀️
              </button>
              <button
                style={styles.touchBtn}
                onTouchStart={() => { keysPressed.current['touchRight'] = true; }}
                onTouchEnd={() => { keysPressed.current['touchRight'] = false; }}
                onMouseDown={() => { keysPressed.current['touchRight'] = true; }}
                onMouseUp={() => { keysPressed.current['touchRight'] = false; }}
                onMouseLeave={() => { keysPressed.current['touchRight'] = false; }}
              >
                ▶️
              </button>
            </div>
            <div style={styles.touchActionPad}>
              <button
                style={{ ...styles.touchBtn, background: 'rgba(59, 130, 246, 0.85)' }}
                onTouchStart={handleJumpAction}
                onClick={handleJumpAction}
              >
                🦘
              </button>
              <button
                style={{ ...styles.touchBtn, background: 'rgba(16, 185, 129, 0.95)', width: '90px', fontSize: '1.1rem' }}
                onTouchStart={handleSpaceAction}
                onClick={handleSpaceAction}
              >
                ESPACE 🖐️
              </button>
            </div>
          </div>

          {/* Fully Opaque 3 - 2 - 1 Countdown Overlay */}
          {countdown !== null && (
            <div style={styles.countdownOverlay}>
              <div key={countdown} className="countdown-num" style={styles.countdownText}>
                {countdown}
              </div>
            </div>
          )}

          {/* Cutting & Cooking Minigame Timing Overlay */}
          {activeMinigame && (
            <div style={styles.minigameOverlay}>
              <div style={styles.minigameBox}>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fbbf24', marginBottom: '8px' }}>
                  {activeMinigame.type === 'cut' ? '🔪 ANGLE DE COUPE PARFAIT !' : '🔥 CONTRÔLE DE TEMPÉRATURE !'}
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '18px' }}>
                  Appuie sur <strong>ESPACE</strong> ou le bouton vert dans la zone verte !
                </p>

                <div style={styles.sliderTrack}>
                  <div style={styles.sweetSpot} />
                  <div style={{ ...styles.sliderCursor, left: `${sliderPos}%` }}>
                    {activeMinigame.type === 'cut' ? '🔪' : '🔥'}
                  </div>
                </div>
                <button onClick={resolveMinigame} style={styles.minigameActionBtn}>
                  Valider ! 🎯
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              ...styles.worldLayer,
              width: `${WORLD_WIDTH}px`,
              transform: `scale(${zoom}) translate(-${cameraX}px, -${cameraY}px)`,
              transformOrigin: 'top left'
            }}
          >
            <div style={{ ...styles.cloud, left: '150px', top: '60px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '620px', top: '90px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '1150px', top: '50px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '1750px', top: '85px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '2150px', top: '55px' }}>☁️</div>

            {PLATFORM_LAYOUT.map((p, idx) => {
              const platTop = floorY - p.offsetFromGround;
              return (
                <div
                  key={idx}
                  style={{
                    ...styles.platform,
                    left: `${p.x}px`,
                    top: `${platTop}px`,
                    width: `${p.w}px`,
                    height: `${p.h}px`
                  }}
                />
              );
            })}

            {/* Glowing Golden Arrow pointing to current task target */}
            <div
              className="golden-arrow"
              style={{
                position: 'absolute',
                left: `${questInfo.arrowX}px`,
                top: `${questInfo.arrowY}px`,
                fontSize: '2.2rem',
                zIndex: 35,
                pointerEvents: 'none'
              }}
            >
              ⬇️
            </div>

            {/* Cutting Board Station on Platform */}
            <div style={{ position: 'absolute', left: `${STATIONS.cuttingBoard.x - 35}px`, top: `${cbTop}px`, textAlign: 'center' }}>
              <div style={styles.stationStand}>
                <div style={styles.cuttingBoardTop}>
                  {stationState.cuttingBoardItem && (
                    <div style={{ position: 'absolute', top: '-28px', left: '15px', fontSize: '1.6rem' }}>
                      {stationState.cuttingBoardItem.type}
                    </div>
                  )}
                  {stationState.cuttingBoardActive && (
                    <span className="chopping-knife" style={{ position: 'absolute', left: '22px', top: '-18px', fontSize: '1.4rem' }}>🔪</span>
                  )}
                  {!stationState.cuttingBoardItem && !stationState.cuttingBoardActive && (
                    <span style={{ position: 'absolute', left: '22px', top: '-6px', fontSize: '1.1rem' }}>🔪</span>
                  )}
                </div>
              </div>
            </div>

            {/* Single Cooking Pot Station on Platform */}
            <div style={{ position: 'absolute', left: `${STATIONS.pot.x - 35}px`, top: `${potTop}px`, textAlign: 'center' }}>
              <div style={styles.stationStand}>
                <div className={stationState.potCooking ? "boiling-pot" : ""} style={{ fontSize: '3.6rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))', marginTop: '-26px' }}>
                  🍲
                </div>
                {stationState.potCooking && (
                  <div className="fire-stand" style={{ position: 'absolute', bottom: '-14px', left: '16px', fontSize: '1.4rem' }}>
                    🔥 🔥
                  </div>
                )}
              </div>
            </div>

            {/* Serving Counter Station on Platform */}
            <div style={{ position: 'absolute', left: `${STATIONS.counter.x - 26}px`, top: `${counterTop}px`, textAlign: 'center' }}>
              <div style={{ fontSize: '3.2rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>🛎️</div>
            </div>

            {/* World Ingredients */}
            {worldItems.map((item, idx) => {
              const itemTop = item.y === 0 ? floorY - 34 : floorY - item.y - 34;
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${item.x}px`,
                    top: `${itemTop}px`,
                    fontSize: '1.8rem',
                    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.3))',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {item.type}
                </div>
              );
            })}

            <div style={styles.ground} />

            {/* Local Player Render */}
            <div style={{ ...styles.playerNode, left: `${pos.x}px`, top: `${pos.y}px` }}>
              {holdingItem && (
                <div className="holding-arrow" style={styles.holdingIndicator}>
                  ▼ {holdingItem}
                </div>
              )}
              <div style={{ ...styles.tag, border: '1.5px solid #fbbf24' }}>{playerName}</div>
              <ChefSprite anim={animState} facingRight={facingRight} frameTick={frameTick} isGhost={false} />
            </div>

            {/* Remote Competitor Ghost Render */}
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
                    {p.holding && (
                      <div className="holding-arrow" style={{ ...styles.holdingIndicator, opacity: 0.5 }}>
                        ▼ {p.holding}
                      </div>
                    )}
                    <div style={{ ...styles.tag, opacity: 0.6 }}>👻 {p.name}</div>
                    <ChefSprite anim={pAnim} facingRight={pFacing} frameTick={frameTick} isGhost={true} />
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
  hudBar: { position: 'fixed', top: '16px', left: '20px', zIndex: 50, display: 'flex', gap: '16px', background: 'rgba(15, 23, 42, 0.85)', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.15)' },
  questHeader: { position: 'fixed', top: '68px', left: '50%', zIndex: 55, padding: '12px 28px', borderRadius: '16px', border: '3px solid #fbbf24', boxShadow: '0 10px 30px rgba(0,0,0,0.45)', textAlign: 'center', transition: 'all 0.3s ease', minWidth: '340px' },
  touchControlsContainer: { position: 'fixed', bottom: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 60, pointerEvents: 'none' },
  touchDpad: { display: 'flex', gap: '12px', pointerEvents: 'auto' },
  touchActionPad: { display: 'flex', gap: '12px', pointerEvents: 'auto' },
  touchBtn: { width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(15, 23, 42, 0.85)', border: '2px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', outline: 'none', WebkitTapHighlightColor: 'transparent' },
  countdownOverlay: { position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  countdownText: { fontSize: '7rem', fontWeight: '900', color: '#fbbf24', textShadow: '0 8px 30px rgba(0,0,0,0.6)' },
  minigameOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 },
  minigameBox: { background: '#1e1b4b', border: '3px solid #fbbf24', borderRadius: '24px', padding: '32px 40px', width: '90%', maxWidth: '460px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' },
  sliderTrack: { width: '100%', height: '32px', background: '#0f172a', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden', marginBottom: '20px' },
  sweetSpot: { position: 'absolute', left: '35%', width: '30%', height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 15px #10b981' },
  sliderCursor: { position: 'absolute', top: '-2px', transform: 'translateX(-50%)', fontSize: '1.6rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' },
  minigameActionBtn: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '12px 24px', fontSize: '1.1rem', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
  worldLayer: { position: 'absolute', top: 0, left: 0, height: '100vh' },
  cloud: { position: 'absolute', fontSize: '4.5rem', opacity: 0.9, pointerEvents: 'none' },
  platform: { position: 'absolute', background: '#22c55e', border: '3px solid #15803d', borderRadius: '10px', boxShadow: '0 8px 16px rgba(0,0,0,0.25)' },
  ground: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '28px', background: 'repeating-linear-gradient(45deg, #451a03, #451a03 12px, #78350f 12px, #78350f 24px)', borderTop: '4px solid #22c55e' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 },
  tag: { background: 'rgba(15, 23, 42, 0.85)', padding: '3px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800', whiteSpace: 'nowrap', marginBottom: '4px' },
  holdingIndicator: { background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '900', marginBottom: '2px', boxShadow: '0 3px 6px rgba(0,0,0,0.3)' },
  stationStand: { width: '70px', height: '36px', background: '#78350f', border: '3px solid #451a03', borderRadius: '8px', position: 'relative', boxShadow: '0 6px 12px rgba(0,0,0,0.3)' },
  cuttingBoardTop: { position: 'absolute', top: '-10px', left: '6px', width: '54px', height: '14px', background: '#d97706', border: '2px solid #b45309', borderRadius: '4px' }
};