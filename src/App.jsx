import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update } from 'firebase/database';

const APP_VERSION = "v12.10-zellige";

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

const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍄', '🍲'];

const WORLD_WIDTH = 2400;
const GROUND_HEIGHT = 28;
const HITBOX_HALF_W = 16;

const PLATFORMS_W1 = [
  { x: 180, offsetFromGround: 130, w: 180, h: 24 },
  { x: 440, offsetFromGround: 230, w: 200, h: 24 },
  { x: 720, offsetFromGround: 140, w: 180, h: 24 },
  { x: 980, offsetFromGround: 260, w: 220, h: 24 },
  { x: 1300, offsetFromGround: 170, w: 200, h: 24 },
  { x: 1600, offsetFromGround: 270, w: 180, h: 24 },
  { x: 1880, offsetFromGround: 180, w: 240, h: 24 }
];

const PLATFORMS_W2 = [
  { x: 220, offsetFromGround: 150, w: 180, h: 24 },
  { x: 500, offsetFromGround: 320, w: 160, h: 24 },
  { x: 780, offsetFromGround: 180, w: 200, h: 24 },
  { x: 1060, offsetFromGround: 280, w: 190, h: 24 },
  { x: 1380, offsetFromGround: 140, w: 210, h: 24 },
  { x: 1700, offsetFromGround: 250, w: 220, h: 24 }
];

const PLATFORMS_W3 = [
  { x: 200, offsetFromGround: 200, w: 200, h: 24 },
  { x: 520, offsetFromGround: 140, w: 220, h: 24 },
  { x: 840, offsetFromGround: 350, w: 150, h: 24 },
  { x: 1160, offsetFromGround: 220, w: 210, h: 24 },
  { x: 1500, offsetFromGround: 160, w: 230, h: 24 }
];

const PLATFORMS_W4 = [
  { x: 240, offsetFromGround: 180, w: 180, h: 24 },
  { x: 580, offsetFromGround: 290, w: 190, h: 24 },
  { x: 920, offsetFromGround: 150, w: 200, h: 24 },
  { x: 1260, offsetFromGround: 360, w: 160, h: 24 },
  { x: 1600, offsetFromGround: 220, w: 200, h: 24 }
];

const PLATFORMS_W5 = [
  { x: 220, offsetFromGround: 160, w: 220, h: 24 },
  { x: 600, offsetFromGround: 300, w: 180, h: 24 },
  { x: 980, offsetFromGround: 190, w: 230, h: 24 },
  { x: 1380, offsetFromGround: 270, w: 200, h: 24 },
  { x: 1750, offsetFromGround: 150, w: 220, h: 24 }
];

const WORLDS_CONFIG = [
  {
    id: 0,
    name: "Monde 1 : Cuisine ensoleillée ☀️",
    bgStyle: { background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 65%, #bae6fd 100%)' },
    platforms: PLATFORMS_W1,
    items: [{ id: 'item_1', x: 220, type: '🍅', state: 'raw' }],
    stations: { cuttingBoard: { x: 600, offsetFromGround: 230 }, pot: { x: 1100, offsetFromGround: 260 }, counter: { x: 1880, offsetFromGround: 180 } },
    recipe: {
      name: "Tajine à la Tomate",
      imgUrl: "/tajine-de-poulet-aux-tomates-scaled.jpg",
      funFact: "Le tajine tire son nom du plat en terre cuite conique traditionnel qui permet une cuisson lente à l'étouffée.",
      steps: [
        { id: 'pickup', label: '1. Prendre une Tomate 🍅', targetItem: '🍅' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: '3. Attraper la Tomate coupée 🍅' },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Attraper le Plat cuit 🍲' },
        { id: 'serve', label: '6. Servir au Comptoir 🛎️' }
      ]
    }
  },
  {
    id: 1,
    name: "Monde 2 : Royaume Céleste 🌌",
    bgStyle: { background: 'linear-gradient(135deg, #090d16 0%, #1a103c 50%, #2e1065 100%)' },
    platforms: PLATFORMS_W2,
    items: [{ id: 'item_w2_1', x: 780, type: '🍄', state: 'raw' }],
    stations: { cuttingBoard: { x: 500, offsetFromGround: 320 }, pot: { x: 1380, offsetFromGround: 140 }, counter: { x: 1700, offsetFromGround: 250 } },
    recipe: {
      name: "Couscous aux Champignons",
      imgUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80",
      funFact: "Le couscous est inscrit au patrimoine immatériel de l'UNESCO et symbolise le partage et la convivialité au Maghreb.",
      steps: [
        { id: 'pickup', label: '1. Prendre un Champignon 🍄', targetItem: '🍄' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: '3. Attraper le Champignon coupé 🍄' },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Attraper le Plat cuit 🍲' },
        { id: 'serve', label: '6. Servir au Comptoir 🛎️' }
      ]
    }
  },
  {
    id: 2,
    name: "Monde 3 : Volcan Infernal 🔥",
    bgStyle: { background: 'linear-gradient(180deg, #450a0a 0%, #7f1d1d 50%, #b91c1c 100%)' },
    platforms: PLATFORMS_W3,
    items: [{ id: 'item_w3_1', x: 840, type: '🌶️', state: 'raw' }],
    stations: { pot: { x: 520, offsetFromGround: 140 }, cuttingBoard: { x: 1160, offsetFromGround: 220 }, counter: { x: 1500, offsetFromGround: 160 } },
    recipe: {
      name: "Merguez Piquantes",
      imgUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=300&q=80",
      funFact: "Les merguez authentiques sont composées de viande de bœuf ou d'agneau embossée dans du boyau naturel et relevée au cumin et harissa.",
      steps: [
        { id: 'pickup', label: '1. Prendre un Piment 🌶️', targetItem: '🌶️' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: '3. Attraper le Piment coupé 🌶️' },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Attraper le Plat cuit 🍲' },
        { id: 'serve', label: '6. Servir au Comptoir 🛎️' }
      ]
    }
  },
  {
    id: 3,
    name: "Monde 4 : Vide Cosmique 🔮",
    bgStyle: { background: 'linear-gradient(135deg, #2e1065 0%, #581c87 50%, #1e1b4b 100%)' },
    platforms: PLATFORMS_W4,
    items: [{ id: 'item_w4_1', x: 1260, type: '🧄', state: 'raw' }],
    stations: { counter: { x: 580, offsetFromGround: 290 }, pot: { x: 920, offsetFromGround: 150 }, cuttingBoard: { x: 1600, offsetFromGround: 220 } },
    recipe: {
      name: "Pastilla au Poulet & Ail",
      imgUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80",
      funFact: "La pastilla marie subtilement le salé et le sucré en combinant de la volaille épicée, des amandes et de la cannelle dans une pâte croustillante.",
      steps: [
        { id: 'pickup', label: "1. Prendre de l'Ail 🧄", targetItem: '🧄' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: "3. Attraper l'Ail coupé 🧄" },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Attraper le Plat cuit 🍲' },
        { id: 'serve', label: '6. Servir au Comptoir 🛎️' }
      ]
    }
  },
  {
    id: 4,
    name: "Monde 5 : Paradis Céleste ✨",
    bgStyle: { background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 65%, #cbd5e1 100%)' },
    platforms: PLATFORMS_W5,
    items: [{ id: 'item_w5_1', x: 980, type: '🍋', state: 'raw' }],
    stations: { pot: { x: 220, offsetFromGround: 160 }, counter: { x: 1380, offsetFromGround: 270 }, cuttingBoard: { x: 600, offsetFromGround: 300 } },
    recipe: {
      name: "Poulet Citron Confit",
      imgUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=300&q=80",
      funFact: "Les citrons confits au sel sont un ingrédient signature de la gastronomie marocaine, apportant une acidité unique et parfumée.",
      steps: [
        { id: 'pickup', label: '1. Prendre un Citron 🍋', targetItem: '🍋' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: '3. Attraper le Citron coupé 🍋' },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Attraper le Plat cuit 🍲' },
        { id: 'serve', label: '6. Servir au Comptoir 🛎️' }
      ]
    }
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
    <div style={{ width: `${f.w * scale}px`, height: `${f.h * scale}px`, overflow: 'hidden', position: 'relative', transform: facingRight ? 'scaleX(1)' : 'scaleX(-1)', opacity: isGhost ? 0.45 : 1, filter: isGhost ? 'drop-shadow(0 3px 5px rgba(0,0,0,0.2)) grayscale(30%)' : 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))' }}>
      <img src="/chef_sprite.png" alt="Chef" style={{ position: 'absolute', left: `${-f.x * scale}px`, top: `${-f.y * scale}px`, width: `${296 * scale}px`, height: `${256 * scale}px`, imageRendering: 'pixelated', maxWidth: 'none', pointerEvents: 'none' }} />
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
  const [currentWorldIndex, setCurrentWorldIndex] = useState(0);
  const currentWorldIndexRef = useRef(0);
  const worldConfig = WORLDS_CONFIG[currentWorldIndex];

  const updateCurrentWorldIndex = (idx) => {
    currentWorldIndexRef.current = idx;
    setCurrentWorldIndex(idx);
  };

  const [worldItems, setWorldItems] = useState(worldConfig.items);
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
  const [logs, setLogs] = useState(['🔥 Zellige & Saffron v12.10 Ready']);
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));

  const [gameStartTime, setGameStartTime] = useState(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState([
    { name: 'Chef Saffron', time: '1m 12s', score: 1500 },
    { name: 'ZelligeMaster', time: '1m 45s', score: 1500 },
    { name: 'BaguetteBoss', time: '2m 10s', score: 1500 }
  ]);

  const [showPortal, setShowPortal] = useState(false);
  const [portalActive, setPortalActive] = useState(false);

  const [currentRecipe, setCurrentRecipe] = useState(worldConfig.recipe);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  
  const activeStepIndexRef = useRef(0);
  const recipeRef = useRef(worldConfig.recipe);

  const updateActiveStep = (newIndex) => {
    activeStepIndexRef.current = newIndex;
    setActiveStepIndex(newIndex);
  };

  const updateCurrentRecipe = (newRecipe) => {
    recipeRef.current = newRecipe;
    setCurrentRecipe(newRecipe);
  };

  const [achievementBanner, setAchievementBanner] = useState({ visible: false, text: '', status: 'info' });

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
  const itemsRef = useRef(worldConfig.items);
  const stationRef = useRef(stationState);

  const holdingItemRef = useRef(null);
  const holdingStateRef = useRef('raw');

  const updateHolding = (item, state) => {
    holdingItemRef.current = item;
    holdingStateRef.current = state;
    setHoldingItem(item);
    setHoldingState(state);
  };

  const triggerAchievement = (text, status = 'success', duration = 3500) => {
    setAchievementBanner({ visible: true, text, status });
    setTimeout(() => {
      setAchievementBanner(prev => ({ ...prev, visible: false }));
    }, duration);
  };

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
      setGameStartTime(Date.now());
      setCountdown(3);
      const t1 = setTimeout(() => setCountdown(2), 1000);
      const t2 = setTimeout(() => setCountdown(1), 2000);
      const t3 = setTimeout(() => setCountdown('GO!'), 3000);
      const t4 = setTimeout(() => {
        setCountdown(null);
        triggerAchievement(`Objectif : ${recipeRef.current.steps[0].label}`, 'info', 4000);
      }, 3700);
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

  const resolveMinigame = () => {
    if (!activeMinigame) return;
    const posVal = sliderPosRef.current;
    const isGood = posVal >= 30 && posVal <= 70;
    const step = recipeRef.current.steps[activeStepIndexRef.current];
    const activeWorldCfg = WORLDS_CONFIG[currentWorldIndexRef.current];
    const stations = activeWorldCfg.stations;
    const floorY = viewportRef.current.h - GROUND_HEIGHT;

    if (activeMinigame.type === 'cut') {
      if (isGood && step && step.id === 'cut') {
        setScore(prev => prev + 50);
        setActiveMinigame(null);
        triggerAchievement("✅ Super coupe ! Regardez l'ingrédient s'envoler !", 'success', 2500);

        setTimeout(() => {
          const updatedStations = { ...stationRef.current, cuttingBoardItem: null, cuttingBoardActive: false };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);

          const cbPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.cuttingBoard.offsetFromGround);
          const cbPlatformTop = cbPlatform ? floorY - cbPlatform.offsetFromGround : floorY;

          const thrownItem = {
            id: 'thrown_' + Date.now(),
            x: stations.cuttingBoard.x,
            landingY: cbPlatformTop, // lands right on platform level for easy catch
            type: activeMinigame.itemType,
            state: 'chopped'
          };
          const nextItems = [...itemsRef.current, thrownItem];
          setWorldItems(nextItems);
          itemsRef.current = nextItems;

          updateActiveStep(2); // Step 2: pickup_chopped
          triggerAchievement("🌟 Ingrédient coupé lancé ! Attrapez-le !", 'info', 3000);
        }, 1000);

      } else {
        setActiveMinigame(null);
        setScore(prev => Math.max(0, prev - 20));
        triggerAchievement("❌ Coupe ratée ! -20 pts. Recommencez depuis le début", 'error', 4000);
        const resetStations = { ...stationRef.current, cuttingBoardItem: null, cuttingBoardActive: false };
        stationRef.current = resetStations;
        setStationState(resetStations);
        updateHolding(null, 'raw');
        updateActiveStep(0);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), resetStations);
      }
    } else if (activeMinigame.type === 'cook') {
      if (isGood && step && step.id === 'cook') {
        setScore(prev => prev + 50);
        setActiveMinigame(null);
        triggerAchievement("✅ Cuisson parfaite ! Regardez le plat s'envoler !", 'success', 2500);

        setTimeout(() => {
          const updatedStations = { ...stationRef.current, potItem: null, potCooking: false };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);

          const potPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.pot.offsetFromGround);
          const potPlatformTop = potPlatform ? floorY - potPlatform.offsetFromGround : floorY;

          const thrownDish = {
            id: 'thrown_' + Date.now(),
            x: stations.pot.x,
            landingY: potPlatformTop, // lands right on platform level for easy catch
            type: '🍲',
            state: 'cooked'
          };
          const nextItems = [...itemsRef.current, thrownDish];
          setWorldItems(nextItems);
          itemsRef.current = nextItems;

          updateActiveStep(4); // Step 4: pickup_cooked
          triggerAchievement("🌟 Plat cuit lancé ! Attrapez-le pour le servir !", 'info', 3000);
        }, 1000);

      } else {
        setActiveMinigame(null);
        setScore(prev => Math.max(0, prev - 20));
        triggerAchievement("❌ Cuisson ratée ! -20 pts. Recommencez depuis le début", 'error', 4000);
        const resetStations = { ...stationRef.current, potItem: null, potCooking: false };
        stationRef.current = resetStations;
        setStationState(resetStations);
        updateHolding(null, 'raw');
        updateActiveStep(0);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), resetStations);
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
    if (isHost || countdown !== null || isGameFinished) return;

    if (activeMinigame) {
      resolveMinigame();
      return;
    }

    const activeWorldCfg = WORLDS_CONFIG[currentWorldIndexRef.current];
    const floorY = viewportRef.current.h - GROUND_HEIGHT;
    const px = posRef.current.x;
    const py = posRef.current.y;
    const stations = activeWorldCfg.stations;

    const cbPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.cuttingBoard.offsetFromGround);
    const cbWorldY = cbPlatform ? floorY - cbPlatform.offsetFromGround : floorY;

    const potPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.pot.offsetFromGround);
    const potWorldY = potPlatform ? floorY - potPlatform.offsetFromGround : floorY;

    const counterPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.counter.offsetFromGround);
    const counterWorldY = counterPlatform ? floorY - counterPlatform.offsetFromGround : floorY;

    const curHolding = holdingItemRef.current;
    const curState = holdingStateRef.current;
    const step = recipeRef.current.steps[activeStepIndexRef.current];

    // 1. Serving at Counter
    if (Math.abs(px - stations.counter.x) < 80 && Math.abs(py - counterWorldY) < 80) {
      if (curHolding && curState === 'cooked' && step && step.id === 'serve') {
        const updatedStations = { ...stationRef.current, servedDishes: stationRef.current.servedDishes + 1 };
        stationRef.current = updatedStations;
        setStationState(updatedStations);
        updateHolding(null, 'raw');
        setScore(prev => prev + 300);

        if (currentWorldIndexRef.current >= WORLDS_CONFIG.length - 1) {
          const endTime = Date.now();
          const elapsedSec = Math.floor((endTime - gameStartTime) / 1000);
          const mins = Math.floor(elapsedSec / 60);
          const secs = elapsedSec % 60;
          const timeStr = `${mins}m ${secs}s`;
          setTotalElapsedTime(timeStr);
          setIsGameFinished(true);

          setLeaderboard(prev => [...prev, { name: playerName || 'Chef Anonyme', time: timeStr, score: score + 300 }].sort((a, b) => b.score - a.score));
          triggerAchievement("🏆 FÉLICITATIONS ! Vous avez terminé le jeu !", 'success', 6000);
          return;
        }

        triggerAchievement("🎉 Plat servi avec succès ! Portail dimensionnel ouvert ! 🌀", 'success', 4000);

        setPortalActive(true);
        setTimeout(() => { setShowPortal(true); }, 800);

        setTimeout(() => {
          const nextWorldIdx = currentWorldIndexRef.current + 1;
          const nextCfg = WORLDS_CONFIG[nextWorldIdx];
          
          updateCurrentWorldIndex(nextWorldIdx);
          setWorldItems(nextCfg.items);
          itemsRef.current = nextCfg.items;
          
          updateCurrentRecipe(nextCfg.recipe);
          updateActiveStep(0);

          const spawnFloor = viewportRef.current.h - GROUND_HEIGHT;
          posRef.current = { x: 140, y: spawnFloor };
          setPos({ x: 140, y: spawnFloor });
          velRef.current = { x: 0, y: 0 };

          const resetStations = { cuttingBoardItem: null, cuttingBoardActive: false, potItem: null, potCooking: false, servedDishes: stationRef.current.servedDishes };
          setStationState(resetStations);
          stationRef.current = resetStations;

          setShowPortal(false);
          setPortalActive(false);
          triggerAchievement(`Bienvenue dans le ${nextCfg.name} ! Position de départ réinitialisée.`, 'info', 4000);
        }, 2400);

        if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
      } else if (step && step.id === 'serve') {
        triggerAchievement("⚠️ Le plat n'est pas encore cuit ou prêt !", 'error', 2500);
      }
      return;
    }

    // 2. Cutting at Cutting Board
    if (Math.abs(px - stations.cuttingBoard.x) < 80 && Math.abs(py - cbWorldY) < 80) {
      if (curHolding && curState === 'raw') {
        if (step && step.id === 'cut') {
          const itemType = curHolding;
          updateHolding(null, 'raw');
          const updatedStations = { ...stationRef.current, cuttingBoardItem: { type: itemType }, cuttingBoardActive: true };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
          setActiveMinigame({ type: 'cut', itemType });
        } else {
          setScore(prev => Math.max(0, prev - 15));
          triggerAchievement("❌ Ce n'est pas la bonne étape pour couper ! -15 pts", 'error', 3000);
        }
      }
      return;
    }

    // 3. Cooking in Pot
    if (Math.abs(px - stations.pot.x) < 80 && Math.abs(py - potWorldY) < 80) {
      if (curHolding && curState === 'chopped') {
        if (step && step.id === 'cook') {
          const itemType = curHolding;
          updateHolding(null, 'raw');
          const updatedStations = { ...stationRef.current, potCooking: true };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          if (db && roomCode) update(ref(db, `rooms/${roomCode}/stations`), updatedStations);
          setActiveMinigame({ type: 'cook', itemType });
        } else {
          setScore(prev => Math.max(0, prev - 15));
          triggerAchievement("❌ Ce n'est pas la bonne étape pour cuisiner ! -15 pts", 'error', 3000);
        }
      }
      return;
    }

    // 4. Picking up items from the world (Raw, Chopped, or Cooked)
    if (!curHolding) {
      let pickedItemIndex = -1;
      let pickedItem = null;

      itemsRef.current.forEach((item, idx) => {
        const xDist = Math.abs(px - item.x);
        const itemPlatform = activeWorldCfg.platforms.find(p => Math.abs(p.x + p.w/2 - item.x) < p.w/2);
        const itemWorldY = item.landingY !== undefined ? item.landingY : (itemPlatform ? floorY - itemPlatform.offsetFromGround : floorY);
        const yDist = Math.abs(py - itemWorldY);

        if (xDist < 70 && yDist < 70 && !pickedItem) {
          pickedItem = item;
          pickedItemIndex = idx;
        }
      });

      if (pickedItem) {
        const isRawPickup = step && step.id === 'pickup' && pickedItem.state === 'raw';
        const isChoppedPickup = step && step.id === 'pickup_chopped' && pickedItem.state === 'chopped';
        const isCookedPickup = step && step.id === 'pickup_cooked' && pickedItem.state === 'cooked';

        if (isRawPickup || isChoppedPickup || isCookedPickup) {
          const nextItems = itemsRef.current.filter((_, i) => i !== pickedItemIndex);
          setWorldItems(nextItems);
          itemsRef.current = nextItems;

          const itemStateVal = pickedItem.state || 'raw';
          updateHolding(pickedItem.type, itemStateVal);
          triggerAchievement(`✅ Attrapé avec succès ! Prochaine étape.`, 'success', 3500);

          if (isRawPickup) updateActiveStep(1); // Next: cut
          else if (isChoppedPickup) updateActiveStep(3); // Next: cook
          else if (isCookedPickup) updateActiveStep(5); // Next: serve
        } else {
          setScore(prev => Math.max(0, prev - 20));
          triggerAchievement(`❌ Ce n'est pas le bon ingrédient ou la bonne étape ! -20 pts`, 'error', 3500);
        }
      }
    }
  };

  const handleJumpAction = () => {
    if (gameState !== 'playing' || isHost || countdown !== null || activeMinigame !== null || isGameFinished) return;
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
  }, [gameState, isHost, activeMinigame, countdown, isGameFinished]);

  useEffect(() => {
    if (gameState !== 'playing' || isHost || isGameFinished) return;

    const gravity = 0.65;
    const friction = 0.82;
    const moveSpeed = 1.45;

    const interval = setInterval(() => {
      if (countdown !== null || activeMinigame !== null) return;

      const activeWorldCfg = WORLDS_CONFIG[currentWorldIndexRef.current];
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
        for (let i = 0; i < activeWorldCfg.platforms.length; i++) {
          const plat = activeWorldCfg.platforms[i];
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
  }, [gameState, isHost, countdown, activeMinigame, isGameFinished]);

  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data.status || 'waiting');
        setPlayers(data.players || {});
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

  const stations = worldConfig.stations;
  const cbPlatform = worldConfig.platforms.find(p => p.offsetFromGround === stations.cuttingBoard.offsetFromGround);
  const cbTop = cbPlatform ? floorY - cbPlatform.offsetFromGround - 42 : floorY - 60;

  const potPlatform = worldConfig.platforms.find(p => p.offsetFromGround === stations.pot.offsetFromGround);
  const potTop = potPlatform ? floorY - potPlatform.offsetFromGround - 48 : floorY - 60;

  const counterPlatform = worldConfig.platforms.find(p => p.offsetFromGround === stations.counter.offsetFromGround);
  const counterTop = counterPlatform ? floorY - counterPlatform.offsetFromGround - 52 : floorY - 60;

  const currentStepObj = currentRecipe.steps[activeStepIndex] || currentRecipe.steps[0];
  let targetWorldX = 220;
  if (currentStepObj.id === 'pickup') {
    const foundItem = worldItems.find(i => i.state === 'raw');
    targetWorldX = foundItem ? foundItem.x : 220;
  } else if (currentStepObj.id === 'cut' || currentStepObj.id === 'pickup_chopped') {
    targetWorldX = stations.cuttingBoard.x;
  } else if (currentStepObj.id === 'cook' || currentStepObj.id === 'pickup_cooked') {
    targetWorldX = stations.pot.x;
  } else if (currentStepObj.id === 'serve') {
    targetWorldX = stations.counter.x;
  }

  const viewWidthWorld = viewport.w / zoom;
  const isTargetVisible = targetWorldX >= cameraX && targetWorldX <= cameraX + viewWidthWorld;
  const isTargetToLeft = !isTargetVisible && targetWorldX < cameraX;
  const isTargetToRight = !isTargetVisible && targetWorldX > cameraX + viewWidthWorld;

  return (
    <div style={{ ...styles.appContainer, ...worldConfig.bgStyle }}>
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
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.15); }
          100% { transform: translateY(0px) scale(1); }
        }
        .holding-arrow {
          animation: floatArrow 0.8s ease-in-out infinite;
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
        @keyframes goldenPulse {
          0% { transform: scale(1) translateX(-50%); filter: drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 25px #f59e0b); }
          50% { transform: scale(1.25) translateX(-40%); filter: drop-shadow(0 0 20px #fbbf24) drop-shadow(0 0 40px #f59e0b); }
          100% { transform: scale(1) translateX(-50%); filter: drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 25px #f59e0b); }
        }
        .golden-glow-item {
          animation: goldenPulse 0.9s ease-in-out infinite;
        }
        @keyframes compassPulse {
          0% { transform: translateY(-50%) scale(1); box-shadow: 0 4px 15px rgba(251,191,36,0.3); }
          50% { transform: translateY(-50%) scale(1.06); box-shadow: 0 6px 25px rgba(251,191,36,0.7); }
          100% { transform: translateY(-50%) scale(1); box-shadow: 0 4px 15px rgba(251,191,36,0.3); }
        }
        .pulsing-compass-left {
          animation: compassPulse 1s ease-in-out infinite;
        }
        .pulsing-compass-right {
          animation: compassPulse 1s ease-in-out infinite;
        }
        @keyframes portalSwirl {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(360deg); opacity: 0.95; }
          100% { transform: scale(1) rotate(720deg); opacity: 1; }
        }
        .animated-portal {
          animation: portalSwirl 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
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
            <p style={styles.subTitle}>Platformer Co-op 2.5D (v12.10)</p>
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
              <input type="text" placeholder="CODE DE SALON" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} style={styles.input} required />
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
            <span>🌍 {worldConfig.name}</span>
            <span>🦘 Sauts: {jumpsLeft}/2</span>
            <span>🎒 En main: {holdingItem ? `${holdingItem} (${holdingState})` : 'Aucun'}</span>
            <span>🍲 Plats: {stationState.servedDishes}</span>
          </div>

          {/* Game Finished Victory Screen Modal & Leaderboard */}
          {isGameFinished && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#1e1b4b', border: '3px solid #fbbf24', borderRadius: '28px', padding: '40px', width: '100%', maxWidth: '600px', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}>
                <h1 style={{ color: '#fbbf24', fontSize: '2.5rem', fontWeight: '900', margin: '0 0 10px 0' }}>🏆 VICTOIRE TOTALE ! 🏆</h1>
                <p style={{ color: '#cbd5e1', fontSize: '1.2rem', marginBottom: '20px' }}>Vous avez terminé tous les 5 mondes avec succès !</p>
                
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: '1.1rem', color: '#38bdf8', fontWeight: '800', margin: '5px 0' }}>⏱️ Temps total : {totalElapsedTime}</p>
                  <p style={{ fontSize: '1.1rem', color: '#34d399', fontWeight: '800', margin: '5px 0' }}>⭐ Score Final : {score} pts</p>
                </div>

                <h3 style={{ color: '#fbbf24', marginBottom: '12px' }}>📊 Classement des Chefs (Leaderboard)</h3>
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#0f172a', borderRadius: '12px', padding: '12px', marginBottom: '24px' }}>
                  {leaderboard.map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: '700', fontSize: '0.95rem' }}>
                      <span>#{idx + 1} 👨‍🍳 {entry.name}</span>
                      <span style={{ color: '#fbbf24' }}>{entry.time} ({entry.score} pts)</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => window.location.reload()} style={styles.primaryBtn}>🔄 Rejouer une Partie</button>
              </div>
            </div>
          )}

          {/* Off-Screen Pulsing Compass */}
          {isTargetToLeft && (
            <div style={styles.compassLeft} className="pulsing-compass-left">
              <span style={{ fontSize: '1.8rem' }}>⬅️ 🌟</span> Hors écran (À gauche)
            </div>
          )}
          {isTargetToRight && (
            <div style={styles.compassRight} className="pulsing-compass-right">
              Hors écran (À droite) <span style={{ fontSize: '1.8rem' }}>🌟 ➡️</span>
            </div>
          )}

          {/* Achievement Popup Banner */}
          {achievementBanner.visible && (
            <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: achievementBanner.status === 'success' ? 'rgba(16, 185, 129, 0.95)' : achievementBanner.status === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)', color: '#fff', padding: '12px 24px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: '900', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', animation: 'popCountdown 0.3s ease-out' }}>
              {achievementBanner.text}
            </div>
          )}

          {/* Persistent Quest Tracker Widget */}
          <div style={{ position: 'fixed', top: '70px', right: '20px', background: 'rgba(15, 23, 42, 0.9)', border: '2px solid rgba(251, 191, 36, 0.4)', padding: '14px 18px', borderRadius: '14px', zIndex: 50, width: '270px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#fbbf24', marginBottom: '8px' }}>
              📜 {currentRecipe.name}
            </div>
            {currentRecipe.steps.map((step, idx) => {
              const isCurrent = idx === activeStepIndex;
              const isDone = idx < activeStepIndex;
              return (
                <div key={idx} style={{ fontSize: '0.82rem', fontWeight: '700', color: isDone ? '#34d399' : isCurrent ? '#38bdf8' : '#64748b', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{isDone ? '✅' : isCurrent ? '➡️' : '⏳'}</span>
                  <span style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Animated Portal Overlay Transition */}
          {showPortal && (
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle, rgba(147, 51, 234, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="animated-portal" style={{ width: '260px', height: '260px', borderRadius: '50%', background: 'conic-gradient(from 0deg, #fbbf24, #38bdf8, #ec4899, #10b981, #fbbf24)', boxShadow: '0 0 60px #fbbf24, inset 0 0 60px #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>
                🌀
              </div>
              <h2 style={{ color: '#fbbf24', marginTop: '30px', fontSize: '2rem', fontWeight: '900', textShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>
                ✨ Téléportation & Retour au Départ... ✨
              </h2>
            </div>
          )}

          {/* On-Screen Mobile Touch Controls */}
          <div style={styles.touchControlsContainer}>
            <div style={styles.touchDpad}>
              <button style={styles.touchBtn} onTouchStart={() => { keysPressed.current['touchLeft'] = true; }} onTouchEnd={() => { keysPressed.current['touchLeft'] = false; }} onMouseDown={() => { keysPressed.current['touchLeft'] = true; }} onMouseUp={() => { keysPressed.current['touchLeft'] = false; }} onMouseLeave={() => { keysPressed.current['touchLeft'] = false; }}>◀️</button>
              <button style={styles.touchBtn} onTouchStart={() => { keysPressed.current['touchRight'] = true; }} onTouchEnd={() => { keysPressed.current['touchRight'] = false; }} onMouseDown={() => { keysPressed.current['touchRight'] = true; }} onMouseUp={() => { keysPressed.current['touchRight'] = false; }} onMouseLeave={() => { keysPressed.current['touchRight'] = false; }}>▶️</button>
            </div>
            <div style={styles.touchActionPad}>
              <button style={{ ...styles.touchBtn, background: 'rgba(59, 130, 246, 0.85)' }} onTouchStart={handleJumpAction} onClick={handleJumpAction}>🦘</button>
              <button style={{ ...styles.touchBtn, background: 'rgba(16, 185, 129, 0.95)', width: '90px', fontSize: '1.1rem' }} onTouchStart={handleSpaceAction} onClick={handleSpaceAction}>ESPACE 🖐️</button>
            </div>
          </div>

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div style={styles.countdownOverlay}>
              <div key={countdown} className="countdown-num" style={styles.countdownText}>{countdown}</div>
            </div>
          )}

          {/* Cutting & Cooking Minigame Overlay */}
          {activeMinigame && (
            <div style={styles.minigameOverlay}>
              <div style={styles.minigameBox}>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fbbf24', marginBottom: '8px' }}>
                  {activeMinigame.type === 'cut' ? '🔪 COUPE !' : '🔥 CUISSON !'}
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '18px' }}>Appuie sur <strong>ESPACE</strong> dans la zone verte !</p>
                <div style={styles.sliderTrack}>
                  <div style={styles.sweetSpot} />
                  <div style={{ ...styles.sliderCursor, left: `${sliderPos}%` }}>{activeMinigame.type === 'cut' ? '🔪' : '🔥'}</div>
                </div>
                <button onClick={resolveMinigame} style={styles.minigameActionBtn}>Valider ! 🎯</button>
              </div>
            </div>
          )}

          <div style={{ ...styles.worldLayer, width: `${WORLD_WIDTH}px`, transform: `scale(${zoom}) translate(-${cameraX}px, -${cameraY}px)`, transformOrigin: 'top left' }}>
            <div style={{ ...styles.cloud, left: '150px', top: '40px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '620px', top: '70px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '1150px', top: '30px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '1750px', top: '65px' }}>☁️</div>
            <div style={{ ...styles.cloud, left: '2150px', top: '45px' }}>☁️</div>

            {/* --- UPPER BACKGROUND BANNERS (zIndex: 2, high up in background sky) --- */}
            
            {/* Background Banner 1: Food Picture ONLY (No Name on Top) */}
            <div style={{ position: 'absolute', left: '280px', top: '80px', ...styles.inWorldBackgroundBanner }}>
              <div style={{ width: '100%', height: '140px', borderRadius: '10px', overflow: 'hidden' }}>
                <img src={currentRecipe.imgUrl} alt={currentRecipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>

            {/* Background Banner 2: Controls & Energy Guide */}
            <div style={{ position: 'absolute', left: '720px', top: '80px', ...styles.inWorldBackgroundBanner }}>
              <div style={styles.bannerHeader}>🎮 Contrôles & Énergie</div>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', lineHeight: '1.4', marginTop: '6px' }}>
                <strong>WASD / Flèches</strong> : Bouger & Sauter<br />
                <strong>ESPACE</strong> : Actions / Énergie
              </div>
            </div>

            {/* Background Banner 3: Fun Fact about current food */}
            <div style={{ position: 'absolute', left: '1160px', top: '80px', ...styles.inWorldBackgroundBanner }}>
              <div style={styles.bannerHeader}>💡 Le Saviez-Vous ?</div>
              <div style={{ fontSize: '0.80rem', fontWeight: '600', color: '#38bdf8', lineHeight: '1.3', marginTop: '6px' }}>
                {currentRecipe.funFact}
              </div>
            </div>

            {/* ------------------------------------------------------------------ */}

            {worldConfig.platforms.map((p, idx) => {
              const platTop = floorY - p.offsetFromGround;
              return <div key={idx} style={{ ...styles.platform, left: `${p.x}px`, top: `${platTop}px`, width: `${p.w}px`, height: `${p.h}px` }} />;
            })}

            {/* Cutting Board Station on Platform */}
            <div style={{ position: 'absolute', left: `${stations.cuttingBoard.x - 35}px`, top: `${cbTop}px`, textAlign: 'center' }}>
              {currentStepObj.id === 'cut' && isTargetVisible && (
                <div className="holding-arrow" style={{ position: 'absolute', top: '-48px', left: '12px', fontSize: '2.5rem', color: '#fbbf24', fontWeight: '900', zIndex: 10, textShadow: '0 0 10px #f59e0b' }}>▼</div>
              )}
              <div style={styles.stationStand}>
                <div style={styles.cuttingBoardTop}>
                  {stationState.cuttingBoardItem && (
                    <div style={{ position: 'absolute', top: '-28px', left: '15px', fontSize: '1.6rem' }}>{stationState.cuttingBoardItem.type}</div>
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

            {/* Cooking Pot Station on Platform */}
            <div style={{ position: 'absolute', left: `${stations.pot.x - 35}px`, top: `${potTop}px`, textAlign: 'center' }}>
              {currentStepObj.id === 'cook' && isTargetVisible && (
                <div className="holding-arrow" style={{ position: 'absolute', top: '-48px', left: '12px', fontSize: '2.5rem', color: '#fbbf24', fontWeight: '900', zIndex: 10, textShadow: '0 0 10px #f59e0b' }}>▼</div>
              )}
              <div style={styles.stationStand}>
                <div className={stationState.potCooking ? "boiling-pot" : ""} style={{ fontSize: '3.2rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))', marginTop: '-36px' }}>🍲</div>
                {stationState.potCooking && (
                  <div className="fire-stand" style={{ position: 'absolute', bottom: '-8px', left: '16px', fontSize: '1.4rem' }}>🔥 🔥</div>
                )}
              </div>
            </div>

            {/* Serving Counter Station on Platform */}
            <div style={{ position: 'absolute', left: `${stations.counter.x - 26}px`, top: `${counterTop}px`, textAlign: 'center' }}>
              {currentStepObj.id === 'serve' && isTargetVisible && (
                <div className="holding-arrow" style={{ position: 'absolute', top: '-48px', left: '6px', fontSize: '2.5rem', color: '#fbbf24', fontWeight: '900', zIndex: 10, textShadow: '0 0 10px #f59e0b' }}>▼</div>
              )}
              {portalActive && (
                <div className="animated-portal" style={{ position: 'absolute', top: '-60px', left: '-30px', fontSize: '3rem', zIndex: 25 }}>🌀</div>
              )}
              <div style={{ fontSize: '3.2rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>🛎️</div>
            </div>

            {/* Persistent World Ingredients & Thrown Items */}
            {worldItems.map((item, idx) => {
              const itemPlatform = worldConfig.platforms.find(p => Math.abs(p.x + p.w/2 - item.x) < p.w/2);
              const defaultPlatformTop = itemPlatform ? floorY - itemPlatform.offsetFromGround - 34 : floorY - 34;
              const itemTop = item.landingY !== undefined ? item.landingY - 34 : defaultPlatformTop;

              const isRawTarget = currentStepObj.id === 'pickup' && item.state === 'raw';
              const isChoppedTarget = currentStepObj.id === 'pickup_chopped' && item.state === 'chopped';
              const isCookedTarget = currentStepObj.id === 'pickup_cooked' && item.state === 'cooked';
              const isTargetItem = isRawTarget || isChoppedTarget || isCookedTarget;
              const isItemVisibleOnScreen = isTargetItem && isTargetVisible;

              return (
                <div key={item.id || idx} style={{ position: 'absolute', left: `${item.x}px`, top: `${itemTop}px`, transform: 'translateX(-50%)' }}>
                  {isItemVisibleOnScreen && (
                    <div className="holding-arrow" style={{ position: 'absolute', top: '-46px', left: '50%', transform: 'translateX(-50%)', fontSize: '2.5rem', color: '#fbbf24', fontWeight: '900', zIndex: 10, textShadow: '0 0 12px #f59e0b' }}>▼</div>
                  )}
                  <div className={isTargetItem ? "golden-glow-item" : ""} style={{ fontSize: '1.8rem', filter: isTargetItem ? 'drop-shadow(0 0 16px #fbbf24) drop-shadow(0 0 30px #f59e0b)' : 'drop-shadow(0 3px 5px rgba(0,0,0,0.3))' }}>
                    {item.type}
                  </div>
                </div>
              );
            })}

            <div style={styles.ground} />

            {/* Local Player Render */}
            <div style={{ ...styles.playerNode, left: `${pos.x}px`, top: `${pos.y}px` }}>
              {holdingItem && (
                <div className="holding-arrow" style={styles.holdingIndicator}>▼ {holdingItem} ({holdingState})</div>
              )}
              <div style={{ ...styles.tag, border: '1.5px solid #fbbf24' }}>{playerName}</div>
              <ChefSprite anim={animState} facingRight={facingRight} frameTick={frameTick} isGhost={false} />
            </div>

            {/* Remote Competitor Ghost Render */}
            {Object.keys(players).filter(pid => pid !== myId).map(pid => {
              const p = players[pid];
              const px = p.x || 140;
              const py = floorY - (p.heightAboveGround || 0);
              const pAnim = p.anim || 'idle';
              const pFacing = p.facingRight !== undefined ? p.facingRight : true;

              return (
                <div key={pid} style={{ ...styles.playerNode, left: `${px}px`, top: `${py}px` }}>
                  {p.holding && (
                    <div className="holding-arrow" style={{ ...styles.holdingIndicator, opacity: 0.5 }}>▼ {p.holding}</div>
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
  appContainer: { width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', color: '#fff' },
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
  gameContainer: { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' },
  hudBar: { position: 'fixed', top: '16px', left: '20px', zIndex: 50, display: 'flex', gap: '16px', background: 'rgba(15, 23, 42, 0.85)', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.15)' },
  inWorldBackgroundBanner: { background: 'rgba(15, 23, 42, 0.7)', border: '2px solid rgba(251, 191, 36, 0.4)', borderRadius: '14px', padding: '8px', width: '220px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', zIndex: 2 },
  bannerHeader: { fontSize: '0.85rem', fontWeight: '900', color: '#fbbf24', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px' },
  compassLeft: { position: 'fixed', left: '20px', top: '50%', background: 'rgba(15, 23, 42, 0.92)', border: '3px solid #fbbf24', color: '#fbbf24', padding: '14px 20px', borderRadius: '16px', fontWeight: '900', fontSize: '1.1rem', zIndex: 50, display: 'flex', alignItems: 'center', gap: '10px' },
  compassRight: { position: 'fixed', right: '20px', top: '50%', background: 'rgba(15, 23, 42, 0.92)', border: '3px solid #fbbf24', color: '#fbbf24', padding: '14px 20px', borderRadius: '16px', fontWeight: '900', fontSize: '1.1rem', zIndex: 50, display: 'flex', alignItems: 'center', gap: '10px' },
  touchControlsContainer: { position: 'fixed', bottom: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 60, pointerEvents: 'none' },
  touchDpad: { display: 'flex', gap: '12px', pointerEvents: 'auto' },
  touchActionPad: { display: 'flex', gap: '12px', pointerEvents: 'auto' },
  touchBtn: { width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(15, 23, 42, 0.85)', border: '2px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', outline: 'none', WebkitTapHighlightColor: 'transparent' },
  countdownOverlay: { position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  countdownText: { fontSize: '7rem', fontWeight: '900', color: '#fbbf24', textShadow: '0 8px 30px rgba(0,0,0,0.6)' },
  minigameOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 },
  minigameBox: { background: '#1e1b4b', border: '3px solid #fbbf24', borderRadius: '24px', padding: '32px 40px', width: '90%', maxWidth: '460px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' },
  sliderTrack: { width: '100%', height: '32px', background: '#0f172a', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden', marginBottom: '20px' },
  sweetSpot: { position: 'absolute', left: '30%', width: '40%', height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 15px #10b981' },
  sliderCursor: { position: 'absolute', top: '-2px', transform: 'translateX(-50%)', fontSize: '1.6rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' },
  minigameActionBtn: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '12px 24px', fontSize: '1.1rem', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
  worldLayer: { position: 'absolute', top: 0, left: 0, height: '100vh' },
  cloud: { position: 'absolute', fontSize: '4.5rem', opacity: 0.9, pointerEvents: 'none' },
  platform: { position: 'absolute', background: '#22c55e', border: '3px solid #15803d', borderRadius: '10px', boxShadow: '0 8px 16px rgba(0,0,0,0.25)' },
  ground: { position: 'absolute', bottom: '0', left: '0', width: '100%', height: '28px', background: 'repeating-linear-gradient(45deg, #451a03, #451a03 12px, #78350f 12px, #78350f 24px)', borderTop: '4px solid #22c55e' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 },
  tag: { background: 'rgba(15, 23, 42, 0.85)', padding: '3px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800', whiteSpace: 'nowrap', marginBottom: '4px' },
  holdingIndicator: { background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.80rem', fontWeight: '900', marginBottom: '2px', boxShadow: '0 3px 6px rgba(0,0,0,0.3)' },
  stationStand: { width: '70px', height: '36px', background: '#78350f', border: '3px solid #451a03', borderRadius: '8px', position: 'relative', boxShadow: '0 6px 12px rgba(0,0,0,0.3)' },
  cuttingBoardTop: { position: 'absolute', top: '-10px', left: '6px', width: '54px', height: '14px', background: '#d97706', border: '2px solid #b45309', borderRadius: '4px' }
};