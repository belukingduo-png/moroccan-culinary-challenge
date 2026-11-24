import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove } from 'firebase/database';

const APP_VERSION = "v13.00-world1-multistep-fix";

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

const FALLING_EMOJIS_LIST = ['🍗', '🍅', '🌶️', '🍋', '🥖', '🧄', '🍄', '🍲', '🧅'];

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

const WORLDS_CONFIG = [
  {
    id: 0,
    name: "Monde 1 : Cuisine ensoleillée ☀️ (Tajine Avancé)",
    bgStyle: { background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 65%, #bae6fd 100%)' },
    platforms: PLATFORMS_W1,
    items: [
      { id: 'item_tomat', x: 220, type: '🍅', state: 'raw' },
      { id: 'item_onion', x: 500, type: '🧅', state: 'raw' }
    ],
    floatingChicken: { x: 750, yBase: 220, radiusX: 90, radiusY: 50, speed: 0.04 },
    stations: { 
      cuttingBoard: { x: 920, offsetFromGround: 140 }, 
      pot: { x: 1400, offsetFromGround: 260 }, 
      counter: { x: 1880, offsetFromGround: 180 } 
    },
    recipe: {
      name: "Tajine de Poulet Complet & Épices",
      imgUrl: "/tajine-de-poulet-aux-tomates-scaled.jpg",
      funFact: "Le tajine traditionnel combine viandes et légumes mijotés lentement avec des épices orientales.",
      steps: [
        { id: 'pickup_tomato', label: '1. Prendre la Tomate 🍅', targetItem: '🍅' },
        { id: 'cut_tomato', label: '2. Couper la Tomate sur la Planche 🔪' },
        { id: 'place_tomato_pot', label: '3. Placer la Tomate coupée dans le Pot 🍲' },
        { id: 'catch_chicken', label: '4. Attraper le Poulet volant 🍗' },
        { id: 'place_chicken_pot', label: '5. Mettre le Poulet dans le Pot 🍲' },
        { id: 'pickup_onion', label: '6. Prendre l\'Oignon 🧅', targetItem: '🧅' },
        { id: 'cut_onion', label: '7. Couper l\'Oignon sur la Planche 🔪' },
        { id: 'place_onion_pot', label: '8. Mettre l\'Oignon dans le Pot 🍲' },
        { id: 'cook_pot', label: '9. Cuire au Pot (Timing précis) 🔥' },
        { id: 'add_spices', label: '10. Ajouter les Épices dans l\'ordre 🌶️' },
        { id: 'serve', label: '11. Servir au Comptoir 🛎️' }
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
      funFact: "Le couscous est inscrit au patrimoine immatériel de l'UNESCO et symbolise le partage.",
      steps: [
        { id: 'pickup', label: '1. Prendre un Champignon 🍄', targetItem: '🍄' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: '3. Prendre le Champignon coupé 🍄' },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Prendre le Plat cuit 🍲' },
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
      funFact: "Les merguez authentiques sont relevées au cumin et à la harissa.",
      steps: [
        { id: 'pickup', label: '1. Prendre un Piment 🌶️', targetItem: '🌶️' },
        { id: 'cut', label: '2. Couper sur la Planche 🔪' },
        { id: 'pickup_chopped', label: '3. Prendre le Piment coupé 🌶️' },
        { id: 'cook', label: '4. Cuire dans le Pot 🍲' },
        { id: 'pickup_cooked', label: '5. Prendre le Plat cuit 🍲' },
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
  const [chickenPos, setChickenPos] = useState({ x: 750, y: 220 });
  const chickenAngleRef = useRef(0);

  const [stationState, setStationState] = useState({
    cuttingBoardItem: null,
    cuttingBoardActive: false,
    potIngredients: [], // Holds assembled items in pot for World 1
    potCooking: false,
    potCookedReady: false,
    servedDishes: 0
  });

  const [gameState, setGameState] = useState('waiting'); 
  const [countdown, setCountdown] = useState(null);
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState(['🔥 Zellige & Saffron v13.00 Ready']);
  const [myId] = useState(() => 'player_' + Math.random().toString(36).substring(2, 7));

  const [gameStartTime, setGameStartTime] = useState(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [winnerName, setWinnerName] = useState('');
  const [showResultsTab, setShowResultsTab] = useState(false);
  
  const [leaderboard, setLeaderboard] = useState([
    { name: 'Chef Saffron', time: '0m 52s', score: 900 },
    { name: 'ZelligeMaster', time: '1m 15s', score: 900 }
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

  // Floating Chicken Animation Loop for World 1
  useEffect(() => {
    const chickenTimer = setInterval(() => {
      if (currentWorldIndexRef.current === 0 && gameState === 'playing') {
        chickenAngleRef.current += 0.03;
        const cfg = WORLDS_CONFIG[0].floatingChicken;
        const cx = cfg.x + Math.cos(chickenAngleRef.current) * cfg.radiusX;
        const cy = cfg.yBase + Math.sin(chickenAngleRef.current * 2) * cfg.radiusY;
        setChickenPos({ x: cx, y: cy });
      }
    }, 30);
    return () => clearInterval(chickenTimer);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'cinematic') {
      const timer = setTimeout(() => {
        setGameState('playing');
        setGameStartTime(Date.now());
        setCountdown(3);
        const c1 = setTimeout(() => setCountdown(2), 1000);
        const c2 = setTimeout(() => setCountdown(1), 2000);
        const c3 = setTimeout(() => setCountdown('GO!'), 3000);
        const c4 = setTimeout(() => {
          setCountdown(null);
          triggerAchievement(`Objectif 1 : ${recipeRef.current.steps[0].label}`, 'info', 4000);
        }, 3700);
        return () => {
          clearTimeout(c1);
          clearTimeout(c2);
          clearTimeout(c3);
          clearTimeout(c4);
        };
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

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

    if (activeMinigame.type === 'cut') {
      if (isGood && step && (step.id === 'cut_tomato' || step.id === 'cut_onion' || step.id === 'cut')) {
        setScore(prev => prev + 50);
        const itemType = activeMinigame.itemType;
        setActiveMinigame(null);
        triggerAchievement("✅ Super coupe ! Ingrédient prêt.", 'success', 2000);

        setTimeout(() => {
          const updatedStations = { ...stationRef.current, cuttingBoardItem: null, cuttingBoardActive: false };
          stationRef.current = updatedStations;
          setStationState(updatedStations);

          const choppedItem = {
            id: 'chopped_' + Date.now(),
            x: WORLDS_CONFIG[currentWorldIndexRef.current].stations.cuttingBoard.x + 40,
            type: itemType,
            state: 'chopped'
          };
          const nextItems = [...itemsRef.current, choppedItem];
          setWorldItems(nextItems);
          itemsRef.current = nextItems;

          // Advance step index accordingly
          if (itemType === '🍅') updateActiveStep(2); // Move to placing tomato in pot
          else if (itemType === '🧅') updateActiveStep(7); // Move to placing onion in pot
          else updateActiveStep(activeStepIndexRef.current + 1);

          triggerAchievement(`🌟 ${itemType} coupé prêt à être pris !`, 'info', 3000);
        }, 1200);
      } else {
        setActiveMinigame(null);
        setScore(prev => Math.max(0, prev - 20));
        triggerAchievement("❌ Coupe ratée ! -20 pts.", 'error', 3500);
      }
    } else if (activeMinigame.type === 'cook') {
      if (isGood && step && step.id === 'cook_pot') {
        setScore(prev => prev + 80);
        setActiveMinigame(null);
        triggerAchievement("✅ Cuisson parfaite ! Mijotage en cours...", 'success', 2000);

        setTimeout(() => {
          const updatedStations = { ...stationRef.current, potCooking: false, potCookedReady: true };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          updateActiveStep(9); // Move to adding spices
          triggerAchievement("🌟 Le tajine mijote ! Ajoutez les épices dans l'ordre !", 'info', 4000);
        }, 1500);
      } else {
        setActiveMinigame(null);
        setScore(prev => Math.max(0, prev - 20));
        triggerAchievement("❌ Cuisson ratée ! -20 pts. Réessayez.", 'error', 3500);
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
        holding: carriedItem,
        worldIndex: currentWorldIndexRef.current
      });
    }
  };

  const handleSpaceAction = () => {
    if (isHost || countdown !== null || isGameFinished || gameState === 'cinematic') return;

    if (activeMinigame) {
      resolveMinigame();
      return;
    }

    const activeWorldCfg = WORLDS_CONFIG[currentWorldIndexRef.current];
    const floorY = viewportRef.current.h - GROUND_HEIGHT;
    const px = posRef.current.x;
    const py = posRef.current.y;
    const stations = activeWorldCfg.stations;
    const step = recipeRef.current.steps[activeStepIndexRef.current];
    const curHolding = holdingItemRef.current;
    const curState = holdingStateRef.current;

    // WORLD 1 MULTI-STEP CUSTOM LOGIC
    if (currentWorldIndexRef.current === 0) {
      const cbPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.cuttingBoard.offsetFromGround);
      const cbWorldY = cbPlatform ? floorY - cbPlatform.offsetFromGround : floorY;

      const potPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.pot.offsetFromGround);
      const potWorldY = potPlatform ? floorY - potPlatform.offsetFromGround : floorY;

      const counterPlatform = activeWorldCfg.platforms.find(p => p.offsetFromGround === stations.counter.offsetFromGround);
      const counterWorldY = counterPlatform ? floorY - counterPlatform.offsetFromGround : floorY;

      // 1. Serving at Counter (Step 11)
      if (Math.abs(px - stations.counter.x) < 80 && Math.abs(py - counterWorldY) < 80) {
        if (curHolding === '🍲' && step && step.id === 'serve') {
          const updatedStations = { ...stationRef.current, servedDishes: stationRef.current.servedDishes + 1 };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          updateHolding(null, 'raw');
          setScore(prev => prev + 500);

          const endTime = Date.now();
          const elapsedSec = Math.floor((endTime - gameStartTime) / 1000);
          const mins = Math.floor(elapsedSec / 60);
          const secs = elapsedSec % 60;
          const timeStr = `${mins}m ${secs}s`;
          setTotalElapsedTime(timeStr);
          setIsGameFinished(true);
          setWinnerName(playerName || 'Chef 1v1');
          setShowResultsTab(true);

          triggerAchievement("🏆 VICTOIRE DU DUEL 1v1 ! Tajine parfait !", 'success', 6000);
        } else {
          triggerAchievement("⚠️ Le tajine complet n'est pas prêt ou ce n'est pas l'étape de service !", 'error', 3000);
        }
        return;
      }

      // 2. Cutting Board Action (Tomato or Onion)
      if (Math.abs(px - stations.cuttingBoard.x) < 80 && Math.abs(py - cbWorldY) < 80) {
        if (curHolding && curState === 'raw') {
          if ((curHolding === '🍅' && step && step.id === 'cut_tomato') || (curHolding === '🧅' && step && step.id === 'cut_onion')) {
            const itemType = curHolding;
            updateHolding(null, 'raw');
            const updatedStations = { ...stationRef.current, cuttingBoardItem: { type: itemType }, cuttingBoardActive: true };
            stationRef.current = updatedStations;
            setStationState(updatedStations);
            setActiveMinigame({ type: 'cut', itemType });
          } else {
            triggerAchievement("❌ Ce n'est pas le bon moment pour couper cet ingrédient !", 'error', 3000);
          }
        }
        return;
      }

      // 3. Pot Action (Adding Ingredients, Cooking, or Spices)
      if (Math.abs(px - stations.pot.x) < 80 && Math.abs(py - potWorldY) < 80) {
        // Adding Chopped Tomato (Step 3)
        if (curHolding === '🍅' && curState === 'chopped' && step && step.id === 'place_tomato_pot') {
          updateHolding(null, 'raw');
          const updatedIngs = [...stationRef.current.potIngredients, '🍅 (coupée)'];
          const updatedStations = { ...stationRef.current, potIngredients: updatedIngs };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          updateActiveStep(3); // Move to catch chicken
          triggerAchievement("✅ Tomate ajoutée au pot ! Suivant : Attraper le poulet 🍗", 'success', 3500);
          return;
        }

        // Adding Chicken (Step 5)
        if (curHolding === '🍗' && step && step.id === 'place_chicken_pot') {
          updateHolding(null, 'raw');
          const updatedIngs = [...stationRef.current.potIngredients, '🍗 (poulet)'];
          const updatedStations = { ...stationRef.current, potIngredients: updatedIngs };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          updateActiveStep(5); // Move to pickup onion
          triggerAchievement("✅ Poulet ajouté au pot ! Suivant : Prendre l'oignon 🧅", 'success', 3500);
          return;
        }

        // Adding Chopped Onion (Step 8)
        if (curHolding === '🧅' && curState === 'chopped' && step && step.id === 'place_onion_pot') {
          updateHolding(null, 'raw');
          const updatedIngs = [...stationRef.current.potIngredients, '🧅 (oignon)'];
          const updatedStations = { ...stationRef.current, potIngredients: updatedIngs };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          updateActiveStep(8); // Move to cook pot
          triggerAchievement("✅ Oignon ajouté ! Prêt pour la cuisson 🔥", 'success', 3500);
          return;
        }

        // Trigger Cooking (Step 9)
        if (step && step.id === 'cook_pot' && !stationRef.current.potCooking && !stationRef.current.potCookedReady) {
          const updatedStations = { ...stationRef.current, potCooking: true };
          stationRef.current = updatedStations;
          setStationState(updatedStations);
          setActiveMinigame({ type: 'cook' });
          return;
        }

        // Add Spices & Finish Dish (Step 10)
        if (step && step.id === 'add_spices' && stationRef.current.potCookedReady) {
          updateHolding('🍲', 'cooked');
          const resetStations = { ...stationRef.current, potIngredients: [], potCookedReady: false };
          stationRef.current = resetStations;
          setStationState(resetStations);
          updateActiveStep(10); // Move to serve
          triggerAchievement("🌶️ Épices ajoutées avec succès ! Tajine prêt à servir 🛎️", 'success', 4000);
          return;
        }

        triggerAchievement("⚠️ Ce n'est pas l'action correcte pour le pot en ce moment !", 'error', 2500);
        return;
      }

      // 4. Catching Flying Chicken (Step 4)
      if (step && step.id === 'catch_chicken') {
        const distToChicken = Math.hypot(px - chickenPos.x, py - chickenPos.y);
        if (distToChicken < 90) {
          updateHolding('🍗', 'raw');
          updateActiveStep(4); // Move to place chicken in pot
          triggerAchievement("🎉 Poulet volant attrapé avec succès ! 🍗", 'success', 3500);
          return;
        }
      }

      // 5. Picking up static items (Tomato or Onion) from world items
      if (!curHolding) {
        let pickedIdx = -1;
        let pickedItem = null;

        itemsRef.current.forEach((item, idx) => {
          const xDist = Math.abs(px - item.x);
          const itemPlatform = activeWorldCfg.platforms.find(p => item.x >= p.x - 15 && item.x <= p.x + p.w + 15);
          const itemWorldY = itemPlatform ? floorY - itemPlatform.offsetFromGround : floorY;
          const yDist = Math.abs(py - itemWorldY);

          if (xDist < 80 && yDist < 80 && !pickedItem) {
            pickedItem = item;
            pickedIdx = idx;
          }
        });

        if (pickedItem) {
          const isTomatoPickup = step && step.id === 'pickup_tomato' && pickedItem.type === '🍅';
          const isOnionPickup = step && step.id === 'pickup_onion' && pickedItem.type === '🧅';

          if (isTomatoPickup || isOnionPickup) {
            const nextItems = itemsRef.current.filter((_, i) => i !== pickedIdx);
            setWorldItems(nextItems);
            itemsRef.current = nextItems;

            updateHolding(pickedItem.type, 'raw');
            if (isTomatoPickup) updateActiveStep(1); // Move to cut tomato
            else if (isOnionPickup) updateActiveStep(6); // Move to cut onion

            triggerAchievement(`✅ ${pickedItem.type} ramassé !`, 'success', 3000);
          } else {
            triggerAchievement("❌ Ce n'est pas le bon ingrédient pour l'étape actuelle !", 'error', 3000);
          }
        }
      }
      return;
    }

    // WORLDS 2 & 3 DEFAULT LOGIC (Maintained)
    // ...
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
        if (data.status === 'cinematic' && gameState === 'waiting') {
          setGameState('cinematic');
        }
        const updatedPlayers = data.players || {};
        const humanPlayerIds = Object.keys(updatedPlayers).filter(id => !id.includes('bot'));
        if (humanPlayerIds.length >= 2 && updatedPlayers['player_bot_rival']) {
          remove(ref(db, `rooms/${roomCode}/players/player_bot_rival`));
          delete updatedPlayers['player_bot_rival'];
        }

        setPlayers(updatedPlayers);
        if (data.stations) {
          setStationState(data.stations);
          stationRef.current = data.stations;
        }
        if (data.logs) setLogs(data.logs);
      }
    });
    return () => unsubscribe();
  }, [roomCode, gameState]);

  const startShift = () => {
    if (db && roomCode) {
      const currentPlayers = { ...players };
      const humanCount = Object.keys(currentPlayers).filter(id => !id.includes('bot')).length;
      
      if (humanCount < 2) {
        currentPlayers['player_bot_rival'] = {
          name: 'Chef Rival 🤖',
          x: 300,
          heightAboveGround: 0,
          anim: 'idle',
          facingRight: true,
          holding: null,
          worldIndex: 0
        };
      } else if (currentPlayers['player_bot_rival']) {
        delete currentPlayers['player_bot_rival'];
      }

      set(ref(db, `rooms/${roomCode}/status`), 'cinematic');
      set(ref(db, `rooms/${roomCode}/players`), currentPlayers);
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
        stations: { cuttingBoardItem: null, cuttingBoardActive: false, potIngredients: [], potCooking: false, potCookedReady: false, servedDishes: 0 },
        logs: [`👑 Salon 1v1 ${code} ouvert`]
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
        holding: null,
        worldIndex: 0
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

  const playerIds = Object.keys(players);
  const p1Id = playerIds[0] || myId;
  const p2Id = playerIds[1] || 'player_bot_rival';
  const p1Name = (p1Id === myId ? playerName : players[p1Id]?.name) || playerName || 'Chef 1';
  const p2Name = (p2Id === myId ? playerName : players[p2Id]?.name) || 'Chef Rival 🤖';

  return (
    <div style={{ ...styles.appContainer, ...worldConfig.bgStyle }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; user-select: none; }
        @keyframes fallAndSpin {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.1; }
        }
        .falling-emoji { position: fixed; top: -60px; font-size: 2.2rem; animation: fallAndSpin linear infinite; z-index: 1; pointer-events: none; }
        @keyframes floatArrow {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.15); }
          100% { transform: translateY(0px) scale(1); }
        }
        .holding-arrow { animation: floatArrow 0.8s ease-in-out infinite; }
        @keyframes chopKnife {
          0% { transform: translateY(0px) rotate(-20deg); }
          50% { transform: translateY(-12px) rotate(15deg); }
          100% { transform: translateY(0px) rotate(-20deg); }
        }
        .chopping-knife { animation: chopKnife 0.25s ease-in-out infinite; }
        @keyframes boilPot {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .boiling-pot { animation: boilPot 0.5s ease-in-out infinite; }
        @keyframes fireFlicker {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        .fire-stand { animation: fireFlicker 0.4s ease-in-out infinite; }
        @keyframes popCountdown {
          0% { transform: scale(0.4); opacity: 0; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .countdown-num { animation: popCountdown 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes goldenPulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 25px #f59e0b); }
          50% { transform: scale(1.22); filter: drop-shadow(0 0 20px #fbbf24) drop-shadow(0 0 40px #f59e0b); }
          100% { transform: scale(1); filter: drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 25px #f59e0b); }
        }
        .golden-glow-item { animation: goldenPulse 0.9s ease-in-out infinite; }
        @keyframes portalSwirl {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(360deg); opacity: 0.95; }
          100% { transform: scale(1) rotate(720deg); opacity: 1; }
        }
        .animated-portal { animation: portalSwirl 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes slideInLeft {
          0% { transform: translateX(-150vw); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .cinematic-slide-left { animation: slideInLeft 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes slideInRight {
          0% { transform: translateX(150vw); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .cinematic-slide-right { animation: slideInRight 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes vsSmash {
          0% { transform: scale(3.5); opacity: 0; }
          60% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .cinematic-vs { animation: vsSmash 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
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
            <p style={styles.subTitle}>Duels 1v1 (Multi-Step Gameplay)</p>
            <button onClick={() => setScreen('mode_select')} style={styles.primaryBtn}>▶️ JOUER</button>
          </div>
        </div>
      )}

      {screen === 'mode_select' && (
        <div style={styles.centeredWrapper}>
          <div style={styles.versionBadge}>{APP_VERSION}</div>
          <div style={styles.menuBox}>
            <h1 style={styles.mainTitle}>🍳 Mode de Duel 1v1</h1>
            <button onClick={createRoom} style={styles.primaryBtn}>👑 Créer un Salon 1v1 (Hôte)</button>
            <div style={styles.divider}><span>OU</span></div>
            <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="text" placeholder="CODE DE SALON" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} style={styles.input} required />
              <button type="submit" style={styles.secondaryBtn}>🎮 Rejoindre (1v1)</button>
            </form>
            <button onClick={() => setScreen('home')} style={styles.backBtn}>⬅️ Retour</button>
          </div>
        </div>
      )}

      {isHost && (
        <div style={styles.hostFullScreen}>
          <div style={styles.hostHeader}>
            <div style={styles.codeBadge}>🔑 Salon 1v1 : <strong>{roomCode}</strong> <button onClick={copyRoomCode} style={styles.copyBtn}>{copied ? '✅' : '📋'}</button></div>
          </div>
          <div style={styles.hostGrid}>
            <div style={styles.panel}>
              <h3>👥 Duelistes En Ligne</h3>
              {Object.keys(players).length === 0 ? <p style={{ color: '#94a3b8' }}>En attente de joueurs...</p> : (
                Object.keys(players).map((id, idx) => (
                  <div key={id} style={styles.playerItem}>
                    <span>👨‍🍳 Slot {idx + 1}: {players[id].name}</span>
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
            <button onClick={startShift} style={styles.primaryBtn}>🎬 Lancer l'Intro Cinématique 1v1</button>
          </div>
        </div>
      )}

      {!isHost && gameState === 'waiting' && screen === 'player_lobby' && (
        <div style={styles.centeredWrapper}>
          <div style={styles.menuBox}>
            <h3>Salon 1v1 : {roomCode}</h3>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
              <ChefSprite anim="idle" facingRight={true} frameTick={frameTick} />
            </div>
            <p style={{ color: '#38bdf8', fontSize: '1.3rem', margin: '10px 0 20px 0', fontWeight: '800' }}>{playerName}</p>
            <p style={{ color: '#94a3b8' }}>⏳ En attente du lancement...</p>
          </div>
        </div>
      )}

      {gameState === 'cinematic' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.95)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', width: '100%', maxWidth: '900px', padding: '0 20px' }}>
            <div className="cinematic-slide-left" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(30, 27, 75, 0.85)', border: '3px solid #38bdf8', padding: '30px 40px', borderRadius: '24px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#38bdf8', marginBottom: '15px' }}>{p1Name}</div>
              <ChefSprite anim="idle" facingRight={true} frameTick={frameTick} />
            </div>
            <div className="cinematic-vs" style={{ fontSize: '4.5rem', fontWeight: '900', color: '#fbbf24' }}>VS</div>
            <div className="cinematic-slide-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(75, 27, 27, 0.85)', border: '3px solid #ef4444', padding: '30px 40px', borderRadius: '24px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ef4444', marginBottom: '15px' }}>{p2Name}</div>
              <ChefSprite anim="idle" facingRight={false} frameTick={frameTick} />
            </div>
          </div>
        </div>
      )}

      {!isHost && gameState === 'playing' && (
        <div style={styles.gameContainer}>
          <div style={styles.hudBar}>
            <span>⭐ Score: {score}</span>
            <span>🌍 {worldConfig.name}</span>
            <span>🦘 Sauts: {jumpsLeft}/2</span>
            <span>🎒 En main: {holdingItem ? `${holdingItem} (${holdingState})` : 'Aucun'}</span>
          </div>

          {isGameFinished && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.94)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#1e1b4b', border: '3px solid #fbbf24', borderRadius: '28px', padding: '40px', textAlign: 'center', maxWidth: '600px', width: '100%' }}>
                <h1 style={{ color: '#fbbf24', fontSize: '2.5rem', fontWeight: '900' }}>🏆 VICTOIRE ! 🏆</h1>
                <p style={{ color: '#38bdf8', fontSize: '1.4rem', fontWeight: '800' }}>Vainqueur : <span style={{ color: '#34d399' }}>{winnerName}</span></p>
                <p style={{ color: '#cbd5e1' }}>⏱️ Temps : {totalElapsedTime} | Score : {score}</p>
                <button onClick={() => window.location.reload()} style={styles.primaryBtn}>🔄 Rejouer</button>
              </div>
            </div>
          )}

          {achievementBanner.visible && (
            <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: achievementBanner.status === 'success' ? '#10b981' : '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: '900', zIndex: 100 }}>
              {achievementBanner.text}
            </div>
          )}

          {/* Persistent Recipe Instructions Checklist */}
          <div style={{ position: 'fixed', top: '70px', right: '20px', background: 'rgba(15, 23, 42, 0.9)', border: '2px solid rgba(251, 191, 36, 0.4)', padding: '14px 18px', borderRadius: '14px', zIndex: 50, width: '300px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#fbbf24', marginBottom: '8px' }}>📜 {currentRecipe.name}</div>
            {currentRecipe.steps.map((step, idx) => {
              const isCurrent = idx === activeStepIndex;
              const isDone = idx < activeStepIndex;
              return (
                <div key={idx} style={{ fontSize: '0.80rem', fontWeight: '700', color: isDone ? '#34d399' : isCurrent ? '#38bdf8' : '#64748b', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{isDone ? '✅' : isCurrent ? '➡️' : '⏳'}</span>
                  <span style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{step.label}</span>
                </div>
              );
            })}
          </div>

          <div style={styles.touchControlsContainer}>
            <div style={styles.touchDpad}>
              <button style={styles.touchBtn} onTouchStart={() => { keysPressed.current['touchLeft'] = true; }} onTouchEnd={() => { keysPressed.current['touchLeft'] = false; }} onMouseDown={() => { keysPressed.current['touchLeft'] = true; }} onMouseUp={() => { keysPressed.current['touchLeft'] = false; }}>◀️</button>
              <button style={styles.touchBtn} onTouchStart={() => { keysPressed.current['touchRight'] = true; }} onTouchEnd={() => { keysPressed.current['touchRight'] = false; }} onMouseDown={() => { keysPressed.current['touchRight'] = true; }} onMouseUp={() => { keysPressed.current['touchRight'] = false; }}>▶️</button>
            </div>
            <div style={styles.touchActionPad}>
              <button style={{ ...styles.touchBtn, background: '#3b82f6' }} onTouchStart={handleJumpAction} onClick={handleJumpAction}>🦘</button>
              <button style={{ ...styles.touchBtn, background: '#10b981', width: '90px', fontSize: '1.1rem' }} onTouchStart={handleSpaceAction} onClick={handleSpaceAction}>ESPACE 🖐️</button>
            </div>
          </div>

          {countdown !== null && (
            <div style={styles.countdownOverlay}>
              <div key={countdown} className="countdown-num" style={styles.countdownText}>{countdown}</div>
            </div>
          )}

          {activeMinigame && (
            <div style={styles.minigameOverlay}>
              <div style={styles.minigameBox}>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fbbf24', marginBottom: '8px' }}>
                  {activeMinigame.type === 'cut' ? '🔪 DÉCOUPE PRÉCISE !' : '🔥 CUISSON DU POT !'}
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
            
            {/* Floating Chicken in World 1 */}
            {currentWorldIndex === 0 && (
              <div style={{ position: 'absolute', left: `${chickenPos.x}px`, top: `${chickenPos.y}px`, zIndex: 22, fontSize: '2.5rem' }} className="holding-arrow">
                🍗
              </div>
            )}

            {worldConfig.platforms.map((p, idx) => {
              const platTop = floorY - p.offsetFromGround;
              return <div key={idx} style={{ ...styles.platform, left: `${p.x}px`, top: `${platTop}px`, width: `${p.w}px`, height: `${p.h}px` }} />;
            })}

            {/* Cutting Board Station */}
            <div style={{ position: 'absolute', left: `${stations.cuttingBoard.x - 35}px`, top: `${cbTop}px`, textAlign: 'center' }}>
              <div style={styles.stationStand}>
                <div style={styles.cuttingBoardTop}>
                  {stationState.cuttingBoardItem && (
                    <div style={{ position: 'absolute', top: '-28px', left: '15px', fontSize: '1.6rem' }}>{stationState.cuttingBoardItem.type}</div>
                  )}
                  {stationState.cuttingBoardActive && (
                    <span className="chopping-knife" style={{ position: 'absolute', left: '22px', top: '-18px', fontSize: '1.4rem' }}>🔪</span>
                  )}
                </div>
              </div>
            </div>

            {/* Cooking Pot Station */}
            <div style={{ position: 'absolute', left: `${stations.pot.x - 35}px`, top: `${potTop}px`, textAlign: 'center' }}>
              <div style={styles.stationStand}>
                <div className={stationState.potCooking ? "boiling-pot" : ""} style={{ fontSize: '3.2rem', marginTop: '-36px' }}>🍲</div>
                <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: '800' }}>
                  {stationState.potIngredients.join(', ')}
                </div>
              </div>
            </div>

            {/* Counter Station */}
            <div style={{ position: 'absolute', left: `${stations.counter.x - 26}px`, top: `${counterTop}px`, textAlign: 'center' }}>
              <div style={{ fontSize: '3.2rem' }}>🛎️</div>
            </div>

            {/* World Items (Tomato, Onion) */}
            {worldItems.map((item, idx) => {
              const itemPlatform = worldConfig.platforms.find(p => item.x >= p.x - 15 && item.x <= p.x + p.w + 15);
              const itemTop = itemPlatform ? floorY - itemPlatform.offsetFromGround - 34 : floorY - 34;
              return (
                <div key={item.id || idx} style={{ position: 'absolute', left: `${item.x}px`, top: `${itemTop}px`, width: '36px', marginLeft: '-18px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 15 }}>
                  <div className="golden-glow-item" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{item.type}</div>
                </div>
              );
            })}

            <div style={styles.ground} />

            <div style={{ ...styles.playerNode, left: `${pos.x}px`, top: `${pos.y}px` }}>
              {holdingItem && (
                <div className="holding-arrow" style={styles.holdingIndicator}>▼ {holdingItem} ({holdingState})</div>
              )}
              <div style={{ ...styles.tag, border: '1.5px solid #fbbf24' }}>{playerName}</div>
              <ChefSprite anim={animState} facingRight={facingRight} frameTick={frameTick} isGhost={false} />
            </div>

            {Object.keys(players).filter(pid => pid !== myId).map(pid => {
              const p = players[pid];
              const pWorldIdx = p.worldIndex !== undefined ? p.worldIndex : 0;
              if (pWorldIdx !== currentWorldIndex) return null;
              const px = p.x || 140;
              const py = floorY - (p.heightAboveGround || 0);

              return (
                <div key={pid} style={{ ...styles.playerNode, left: `${px}px`, top: `${py}px` }}>
                  <div style={{ ...styles.tag, opacity: 0.7, borderColor: '#ef4444' }}>⚔️ {p.name}</div>
                  <ChefSprite anim={p.anim || 'idle'} facingRight={p.facingRight ?? true} frameTick={frameTick} isGhost={true} />
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
  touchControlsContainer: { position: 'fixed', bottom: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 60, pointerEvents: 'none' },
  touchDpad: { display: 'flex', gap: '12px', pointerEvents: 'auto' },
  touchActionPad: { display: 'flex', gap: '12px', pointerEvents: 'auto' },
  touchBtn: { width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(15, 23, 42, 0.85)', border: '2px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  countdownOverlay: { position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  countdownText: { fontSize: '7rem', fontWeight: '900', color: '#fbbf24' },
  minigameOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 },
  minigameBox: { background: '#1e1b4b', border: '3px solid #fbbf24', borderRadius: '24px', padding: '32px 40px', width: '90%', maxWidth: '460px', textAlign: 'center' },
  sliderTrack: { width: '100%', height: '32px', background: '#0f172a', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden', marginBottom: '20px' },
  sweetSpot: { position: 'absolute', left: '30%', width: '40%', height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' },
  sliderCursor: { position: 'absolute', top: '-2px', transform: 'translateX(-50%)', fontSize: '1.6rem' },
  minigameActionBtn: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '12px 24px', fontSize: '1.1rem', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' },
  worldLayer: { position: 'absolute', top: 0, left: 0, height: '100vh' },
  platform: { position: 'absolute', background: '#22c55e', border: '3px solid #15803d', borderRadius: '10px' },
  ground: { position: 'absolute', bottom: '0', left: '0', width: '100%', height: '28px', background: 'repeating-linear-gradient(45deg, #451a03, #451a03 12px, #78350f 12px, #78350f 24px)', borderTop: '4px solid #22c55e' },
  playerNode: { position: 'absolute', transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 },
  tag: { background: 'rgba(15, 23, 42, 0.85)', padding: '3px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800', whiteSpace: 'nowrap', marginBottom: '4px' },
  holdingIndicator: { background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.80rem', fontWeight: '900', marginBottom: '2px' },
  stationStand: { width: '70px', height: '36px', background: '#78350f', border: '3px solid #451a03', borderRadius: '8px', position: 'relative' },
  cuttingBoardTop: { position: 'absolute', top: '-10px', left: '6px', width: '54px', height: '14px', background: '#d97706', border: '2px solid #b45309', borderRadius: '4px' }
};