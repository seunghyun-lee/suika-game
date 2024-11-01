import { ref, set, get, query, orderByChild, limitToLast, push } from 'firebase/database';
import * as Matter from 'matter-js';
import { FRUITS } from './fruits';

let database;
const { Engine, Render, Runner, Bodies, Events, World, Body, Composite } = Matter;

let engine, render, runner, world;
let currentFruit, nextFruit;
let oldWidth = 400;
let oldHeight = 900;
let gameContainer, canvasWidth, canvasHeight;
let gameArea, gameAreaWidth, gameAreaHeight;
let gameAreaTop, gameAreaBottom, gameAreaLeft, gameAreaRight;
let nextFruitPreview;
let lastDropPosition = null;
let backgroundCanvas, backgroundCtx;
let score = 0;
let bestScore = 0;
let lastSavedScore = 0;
let scorelineY;
let guideCanvas, guideCtx;
let userId;
let isGameOver = false;
let isScoreSaved = false;
let isGameOverDisplayed = false;
let boundariesCreated = false;
let gamePaused = false;
let gameInitialized = false;
let isMuted = false;
let isRestarting = false;
let interactionStarted = false;
let listenersAdded = false;
const dropSound = new Audio('./sounds/drop.mp3');
const mergeSound = new Audio('./sounds/merge.wav');
let bgmAudio = new Audio('./sounds/bgm.mp3');
let isBgmPlaying = false;
const imageCache = {};

function displayLeaderboard(scores) {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '';
    scores.forEach((score, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${score.userId}: ${score.score}`;
        leaderboardList.appendChild(li);
    });
    document.getElementById('leaderboard-overlay').style.display = 'flex';
}

export function initGame(db) {
    if (!db) {
        console.error("Database object is undefined");
        return;
    }
    database = db;
    if (gameInitialized) {
        return;
    }

    gameInitialized = true;
    gameContainer = document.getElementById('game-container');
    canvasWidth = 400;
    canvasHeight = 900;
    
    backgroundCanvas = document.getElementById('background-guide');
    backgroundCanvas.width = canvasWidth;
    backgroundCanvas.height = canvasHeight;
    backgroundCtx = backgroundCanvas.getContext('2d');

    guideCanvas = document.getElementById('guide-canvas');
    guideCanvas.width = canvasWidth;
    guideCanvas.height = canvasHeight;
    guideCtx = guideCanvas.getContext('2d');

    const horizontalMargin = canvasWidth / 20;
    const bottomMargin = canvasHeight / 7;

    gameAreaWidth = canvasWidth - (2 * horizontalMargin);
    gameAreaHeight = canvasHeight - bottomMargin - (canvasHeight / 4);
    gameAreaTop = canvasHeight / 4;
    gameAreaBottom = canvasHeight - bottomMargin;
    gameAreaLeft = horizontalMargin;
    gameAreaRight = canvasWidth - horizontalMargin;

    engine = Engine.create();
    world = engine.world;

    render = Render.create({
        element: document.getElementById('matter-js-canvas'),
        engine: engine,
        options: {
            width: canvasWidth,
            height: canvasHeight,
            wireframes: false,
            background: 'transparent',
            showAngleIndicator: false,
        }
    });

    Events.on(render, 'afterRender', function() {
        drawDropGuide();
    });

    Render.run(render);
    render.canvas.style.zIndex = '1';
    runner = Runner.create();
    Runner.run(runner, engine);
    
    createBoundaries();
    createNextFruitPreview();

    setTimeout(() => {
        createNewFruit();
        addEventListeners();
    }, 100);

    Events.on(engine, 'collisionStart', handleCollision);
    requestAnimationFrame(gameLoop);

    loadBestScore();
    score = 0;
    updateScore(0);
    getBestScore();

    setGameBackground();

    resizeGame();
    window.addEventListener('resize', resizeGame);

    const gameControls = document.querySelectorAll('.game-control');
    gameControls.forEach(control => {
        control.addEventListener('touchstart', preventPropagation, { passive: false });
        control.addEventListener('touchend', preventPropagation, { passive: false });
        control.addEventListener('touchmove', preventPropagation, { passive: false });
        control.addEventListener('mousedown', preventPropagation);
        control.addEventListener('mouseup', preventPropagation);
        control.addEventListener('mousemove', preventPropagation);
    });

    const topScoreButton = document.getElementById('top-score-button');
    topScoreButton.addEventListener('click', showLeaderboard);

    const closeLeaderboardButton = document.getElementById('close-leaderboard');
    closeLeaderboardButton.addEventListener('click', hideLeaderboard);

    const settingButton = document.getElementById('setting-button');
    if (settingButton) {
        settingButton.addEventListener('click', showSettingsOverlay);
    }

    const closeSettingsButton = document.getElementById('close-settings');
    if (closeSettingsButton) {
        closeSettingsButton.addEventListener('click', hideSettingsOverlay);
    }

    const restartGameButton = document.getElementById('restart-game-button');
    restartGameButton.addEventListener('click', restartGame);

    const restartButton = document.getElementById('restart-button');
    restartButton.addEventListener('click', handleRestartClick);

    const muteButton = document.getElementById('mute-button');
    muteButton.addEventListener('click', toggleMute);

    const bgmButton = document.getElementById('bgm-button');
    bgmButton.addEventListener('click', toggleBgm);

    bgmAudio.loop = true;
    bgmAudio.volume = 0.5;

    userId = getUserId();
    updateUserIdDisplay();

    const userIdDisplay = document.getElementById('user-id-display');
    userIdDisplay.addEventListener('click', showUserIdOverlay);

    const saveUserIdButton = document.getElementById('save-user-id');
    saveUserIdButton.addEventListener('click', saveNewUserId);

    const cancelUserIdButton = document.getElementById('cancel-user-id');
    cancelUserIdButton.addEventListener('click', hideUserIdOverlay);

    if (navigator.standalone) {
        document.documentElement.style.setProperty('--safe-area-inset-top', `${window.screen.height - document.documentElement.clientHeight}px`);
    }
}

function resizeGame() {
    const gameContainer = document.getElementById('game-container');
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const chromeAddressBarHeight = windowWidth <= 1024 ? 5 : 0;

    const availableHeight = windowHeight - chromeAddressBarHeight;

    const aspectRatio = 4 / 9;
    let newWidth, newHeight;

    if (windowWidth <= 1024) {
        if (windowWidth / availableHeight > aspectRatio) {
            newHeight = availableHeight;
            newWidth = newHeight * aspectRatio;
        } else {
            newWidth = windowWidth;
            newHeight = newWidth / aspectRatio;
        }
        newHeight -= chromeAddressBarHeight;
    } else {
        newWidth = 400;
        newHeight = 900;
    }

    gameContainer.style.width = `${newWidth}px`;
    gameContainer.style.height = `${newHeight}px`;
    gameContainer.style.marginTop = '0';
    
    canvasWidth = newWidth;
    canvasHeight = newHeight;
    
    const horizontalMargin = canvasWidth / 20;
    const bottomMargin = canvasHeight / 7;

    gameAreaWidth = canvasWidth - (2 * horizontalMargin);
    gameAreaHeight = canvasHeight - bottomMargin - (canvasHeight / 4);
    gameAreaTop = canvasHeight / 4;
    gameAreaBottom = canvasHeight - bottomMargin;
    gameAreaLeft = horizontalMargin;
    gameAreaRight = canvasWidth - horizontalMargin;

    scorelineY = gameAreaTop + ((gameAreaBottom - gameAreaTop) * 0.2);

    if (render) {
        render.canvas.width = canvasWidth;
        render.canvas.height = canvasHeight;
        render.options.width = canvasWidth;
        render.options.height = canvasHeight;
    }

    if (backgroundCanvas) {
        backgroundCanvas.width = canvasWidth;
        backgroundCanvas.height = canvasHeight;
    }

    if (guideCanvas) {
        guideCanvas.width = canvasWidth;
        guideCanvas.height = canvasHeight;
    }

    createBoundaries();
    setGameBackground();

    adjustFruitsPosition();
}

function adjustFruitsPosition() {
    const bodies = Composite.allBodies(world);
    bodies.forEach(body => {
        if (body.label !== "topBoundary" && body.label !== "scoreLine" && !body.isStatic) {
            const newX = (body.position.x / oldWidth) * canvasWidth;
            const newY = (body.position.y / oldHeight) * canvasHeight;
            Body.setPosition(body, {
                x: newX,
                y: newY
            });
        }
    });

    if (currentFruit) {
        const newX = (currentFruit.position.x / oldWidth) * canvasWidth;
        Body.setPosition(currentFruit, {
            x: newX,
            y: currentFruit.position.y
        });
    }

    oldWidth = canvasWidth;
    oldHeight = canvasHeight;
}

function createBoundaries() {
    Composite.clear(world, false, true);

    const wallThickness = 15;

    const leftWall = Bodies.rectangle(
        gameAreaLeft + wallThickness / 2,
        gameAreaTop + (gameAreaBottom - gameAreaTop) / 2,
        wallThickness,
        gameAreaBottom - gameAreaTop,
        { isStatic: true, render: { visible: false } }
    );
    const rightWall = Bodies.rectangle(
        gameAreaRight - wallThickness / 2,
        gameAreaTop + (gameAreaBottom - gameAreaTop) / 2,
        wallThickness,
        gameAreaBottom - gameAreaTop,
        { isStatic: true, render: { visible: false } }
    );
    const ground = Bodies.rectangle(
        gameAreaLeft + gameAreaWidth / 2,
        gameAreaBottom - wallThickness / 2,
        gameAreaWidth,
        wallThickness,
        { isStatic: true, render: { visible: false } }
    );
    const top = Bodies.rectangle(
        gameAreaLeft + gameAreaWidth / 2,
        gameAreaTop,
        gameAreaWidth,
        2,
        { 
            label: "topBoundary",
            isStatic: true, 
            isSensor: true,
            render: { visible: false }
        }
    );
    const scoreline = Bodies.rectangle(
        gameAreaLeft + gameAreaWidth / 2,
        scorelineY,
        gameAreaWidth,
        1,
        {
            label: "scoreLine",
            isStatic: true,
            isSensor: true,
            render: { 
                strokeStyle: 'red',
                lineWidth: 1,
                lineDash: [5, 5],
                fillStyle: 'transparent'
            },
        }
    );

    World.add(world, [leftWall, rightWall, ground, top, scoreline]);
}

function createNewFruit() {
    if (currentFruit) {
        console.log("Fruit already exists, not creating a new one");
        return;
    }

    const fruitType = nextFruitPreview.type;
    const xPosition = lastDropPosition ? lastDropPosition.x : gameAreaLeft + gameAreaWidth / 2;
    const yPosition = gameAreaTop - fruitType.radius - 20;

    currentFruit = Bodies.circle(xPosition, yPosition, fruitType.radius, {
        label: fruitType.name,
        density: 0.001,
        friction: 0.5,
        frictionStatic: 0.5,
        restitution: 0.1,
        slop: 0.01,
        render: {
            sprite: {
                texture: `./images/${fruitType.name}.png`
            }
        }
    });
    Body.setStatic(currentFruit, true);
    World.add(world, currentFruit);

    createNextFruitPreview();
}


function createNextFruitPreview() {
    const fruitType = FRUITS[Math.floor(Math.random() * 5)];
    nextFruitPreview = {
        type: fruitType,
    };
    const previewElement = document.getElementById('next-fruit-image');
    previewElement.style.backgroundImage = `url(./images/${fruitType.name}.png)`;
}

function playSound(sound) {
    if (!isMuted) {
        sound.play();
    }
}

function preventPropagation(event) {
    event.stopPropagation();
}

function updateFruitPosition(position) {
    if (!currentFruit) return;

    const wallThickness = 15;
    const buffer = 5;
    const minX = gameAreaLeft + wallThickness + currentFruit.circleRadius + buffer;
    const maxX = gameAreaRight - wallThickness - currentFruit.circleRadius - buffer;

    const clampedX = Math.max(minX, Math.min(position.x, maxX));
    Body.setPosition(currentFruit, { x: clampedX, y: currentFruit.position.y });
}

function addEventListeners() {
    if (listenersAdded) {
        return;
    }
    listenersAdded = true;
    console.log("Adding event listeners");

    const gameCanvas = document.getElementById('matter-js-canvas');
    if (gameCanvas) {
        gameCanvas.addEventListener('touchstart', handleGameInteraction, { passive: false });
        gameCanvas.addEventListener('touchmove', handleGameInteraction, { passive: false });
        gameCanvas.addEventListener('touchend', handleGameInteraction, { passive: false });

        gameCanvas.addEventListener('mousedown', handleGameInteraction);
        gameCanvas.addEventListener('mousemove', handleGameInteraction);
        gameCanvas.addEventListener('mouseup', handleGameInteraction);
    }

    const restartButton = document.getElementById('restart-game-button');
    if (restartButton) {
        restartButton.addEventListener('click', handleRestartClick);
    }

    const muteButton = document.getElementById('mute-button');
    if (muteButton) {
        muteButton.addEventListener('click', toggleMute);
    }
}

function handleGameInteraction(event) {
    event.preventDefault();
    
    if (event.type === 'touchstart' || event.type === 'mousedown') {
        interactionStarted = true;
    } else if (event.type === 'touchend' || event.type === 'mouseup') {
        if (currentFruit && currentFruit.isStatic) {
            dropFruit();
            playSound(dropSound);
        }
        interactionStarted = false;
    }

    if (interactionStarted && currentFruit) {
        const pos = getEventPosition(event);
        updateFruitPosition(pos);
    }
}

function getEventPosition(event) {
    const gameContainer = document.getElementById('matter-js-canvas');
    const rect = gameContainer.getBoundingClientRect();
    let clientX, clientY;

    if (event.type.startsWith('touch')) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function dropFruit() {
    Body.setStatic(currentFruit, false);
    lastDropPosition = { x: currentFruit.position.x, y: currentFruit.position.y };
    currentFruit = null;

    guideCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    setTimeout(() => {
        createNewFruit();
    }, 1000);
}

function drawDropGuide() {
    
    guideCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (currentFruit && currentFruit.position) {
        const startX = currentFruit.position.x;
        const startY = currentFruit.position.y + currentFruit.circleRadius;
        const endY = gameAreaBottom;

        guideCtx.beginPath();
        guideCtx.setLineDash([5, 5]);
        guideCtx.strokeStyle = 'rgba(186, 189, 197, 1)';
        guideCtx.lineWidth = 2;
        guideCtx.moveTo(startX, startY);
        guideCtx.lineTo(startX, endY);
        guideCtx.stroke();
        guideCtx.setLineDash([]);
    }
}

function setGameBackground() {
    return new Promise((resolve) => {
        const canvas = backgroundCanvas;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.src = './images/bucket.png';

        img.onload = function() {
            console.log('Bucket image loaded');

            const x = gameAreaLeft;
            const y = gameAreaTop;
            const width = gameAreaRight - gameAreaLeft;
            const height = gameAreaBottom - gameAreaTop;

            console.log(`Drawing background: ${x},${y},${width},${height}`);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, x, y, width, height);

            addRevolutionaryArrow();
            resolve();
        };
    });
}

function addRevolutionaryArrow() {
    const canvas = backgroundCanvas;
    const ctx = canvas.getContext('2d');

    const arrowImg = new Image();
    arrowImg.src = './images/revolutionarrow.png';

    arrowImg.onload = function() {
        const arrowHeight = gameAreaHeight * 0.1;
        const arrowWidth = (arrowImg.width / arrowImg.height) * arrowHeight;
        
        const x = gameAreaLeft + (gameAreaWidth - arrowWidth) / 2;
        const y = gameAreaBottom + 6;

        ctx.drawImage(arrowImg, x, y, arrowWidth, arrowHeight);
    };
}

function updateScore(points) {
    score += points;
    console.log("Score updated:", score);
    document.getElementById('score-value').textContent = score;
    if (score > bestScore) {
        bestScore = score;
        updateBestScore(bestScore);
    }
}

function updateBestScore(newBestScore) {
    bestScore = newBestScore;
    document.getElementById('best-score').textContent = `Best: ${bestScore}`;
}

function saveScoreToFirebase(score) {
    if (score <= lastSavedScore) return Promise.resolve();
    
    const userId = getUserId();
    return set(ref(database, 'scores/' + userId), {
        score: score
    }).then(() => {
        console.log("Score saved successfully");
        lastSavedScore = score;
    }).catch((error) => {
        console.error("Error saving score to Firebase:", error);
    });
}

function loadBestScore() {
    if (!database) {
        console.error("Database is not initialized");
        return;
    }
    const userId = getUserId();
    get(ref(database, 'scores/' + userId)).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data && data.score) {
                updateBestScore(data.score);
            }
        }
    }).catch((error) => {
        console.error("Error loading best score:", error);
    });
}

function updateUserIdDisplay() {
    const userIdElement = document.getElementById('user-id');
    if (userIdElement) {
        userIdElement.textContent = userId;
    }
}

function showUserIdOverlay() {
    document.getElementById('user-id-overlay').style.display = 'flex';
    document.getElementById('new-user-id').value = userId;
}

function hideUserIdOverlay() {
    document.getElementById('user-id-overlay').style.display = 'none';
}

function saveNewUserId() {
    const newUserId = document.getElementById('new-user-id').value.trim();
    if (newUserId && newUserId !== userId) {
        userId = newUserId;
        localStorage.setItem('userId', userId);
        updateUserIdDisplay();
    }
    hideUserIdOverlay();
}

function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

function saveScore(score) {
    if (window.Android) {
        window.Android.saveScore(score);
    }
}

function getBestScore() {
    if (window.Android) {
        window.Android.getBestScore();
    }
}

function onBestScoreReceived(score) {
    bestScore = parseInt(score);
    updateBestScoreDisplay();
}

function updateBestScoreDisplay() {
    document.getElementById('best-score').textContent = `Best: ${bestScore}`;
}

function pauseGame() {
    Runner.stop(runner);
    saveGameState();
    gamePaused = true;
    bgmAudio.pause();
}

function resumeGame() {
    loadGameState();
    
    if (gamePaused) {
        Runner.run(runner, engine);
        gamePaused = false;
        requestAnimationFrame(gameLoop);
    }

    if (isBgmPlaying && !isMuted) {
        bgmAudio.play();
    }
}

function saveGameState() {
    const gameState = {
        score: score,
        bestScore: bestScore,
        fruits: Composite.allBodies(world)
            .filter(body => !body.isStatic && body.label !== "topBoundary" && body.label !== "scoreLine")
            .map(fruit => ({
                type: fruit.label,
                x: fruit.position.x,
                y: fruit.position.y
            })),
        isGameOver: isGameOver
    };
    
    if (window.Android) {
        window.Android.saveGameState(JSON.stringify(gameState));
    }
}

function loadGameState() {
    if (window.Android) {
        const gameStateString = window.Android.getGameState();
        if (gameStateString) {
            const gameState = JSON.parse(gameStateString);

            Composite.allBodies(world)
                .filter(body => !body.isStatic && body.label !== 'scoreLine' && body.label !== 'topBoundary')
                .forEach(body => World.remove(world, body));

            gameState.fruits.forEach(createFruitFromState);

            if (currentFruit) {
                World.remove(world, currentFruit);
                currentFruit = null;
            }

            createNewFruit();

            score = gameState.score;
            bestScore = gameState.bestScore;
            updateScore(0);

            isGameOver = gameState.isGameOver;
            if (isGameOver && !isGameOverDisplayed) {
                showGameOverOverlay();
            } else {
                hideGameOverOverlay();
            }
        }
    }
}

function createFruitFromState(fruitState) {
    const fruitType = FRUITS.find(f => f.name === fruitState.type);
    const fruit = Bodies.circle(fruitState.x, fruitState.y, fruitType.radius, {
        label: fruitType.name,
        density: 0.001,
        friction: 0.5,
        frictionStatic: 0.5,
        restitution: 0.1,
        slop: 0.01,
        render: {
            sprite: {
                texture: `./images/${fruitType.name}.png`
            }
        }
    });
    Body.setStatic(fruit, fruitState.isStatic);
    World.add(world, fruit);
    return fruit;
}

function gameLoop() {
    if (gamePaused) {
        return;
    }
    const bodies = Composite.allBodies(world);

    for (let i = bodies.length - 1; i >= 0; i--) {
        const body = bodies[i];
        if (body.position.y > canvasHeight + 100) {
            World.remove(world, body);
            console.log("Removed fruit that fell out of bounds");
        }
    }

    if (!isGameOver) {
        const stationaryFruitsAboveScoreline = bodies.filter(body => {
            return body !== currentFruit && 
                body.label !== 'scoreLine' && 
                body.label !== 'topBoundary' && 
                !body.isStatic && 
                body.position.y <= scorelineY &&
                Math.abs(body.velocity.y) < 0.1;
        });

        if (stationaryFruitsAboveScoreline.length > 0) {
            console.log("Stationary fruits above scoreline:", stationaryFruitsAboveScoreline.length);
            
            setTimeout(() => {
                const stillAboveScoreline = stationaryFruitsAboveScoreline.every(fruit => 
                    fruit.position.y <= scorelineY && Math.abs(fruit.velocity.y) < 0.1
                );
                
                if (stillAboveScoreline) {
                    console.log("Game Over - Fruits remained above scoreline for 3 seconds");
                    isGameOver = true;
                    showGameOverOverlay();
                }
            }, 3000);
        }
    }

   requestAnimationFrame(gameLoop);
}


function hideGameOverOverlay() {
    const overlay = document.getElementById('game-over-overlay');
    overlay.style.display = 'none';
}

async function restartGame() {
    console.log("Restarting game");

    isScoreSaved = false;
    isGameOver = false;
    isGameOverDisplayed = false;
    score = 0;
    updateScore(0);
    lastDropPosition = null;

    World.clear(world, true);

    Engine.clear(engine);
    world = engine.world;

    if (currentFruit) {
        World.remove(world, currentFruit);
        currentFruit = null;
    }

    createBoundaries();
    createNextFruitPreview();
    await setGameBackground();

    createNewFruit();
    addEventListeners();

    Events.off(engine, 'collisionStart');
    Events.on(engine, 'collisionStart', handleCollision);

    Runner.stop(runner);
    runner = Runner.create();
    Runner.run(runner, engine);

    requestAnimationFrame(gameLoop);

    saveGameState();

    hideGameOverOverlay();
}

setInterval(saveGameState, 1000);

function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (imageCache[src]) {
            resolve(imageCache[src]);
        } else {
            const img = new Image();
            img.onload = () => {
                imageCache[src] = img;
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        }
    });
}

function captureGameState() {
    const fruits = Composite.allBodies(world)
        .filter(body => !body.isStatic && body.label !== "topBoundary" && body.label !== "scoreLine")
        .map(fruit => ({
            type: fruit.label,
            x: fruit.position.x,
            y: fruit.position.y,
            radius: fruit.circleRadius
        }));
    return { fruits, score };
}

function showGameOverOverlay() {
    if (isGameOverDisplayed || score === 0) {
        return;
    }
    const overlay = document.getElementById('game-over-overlay');
    const finalScoreElement = document.getElementById('final-score');
    finalScoreElement.textContent = score;
    overlay.style.display = 'flex'; 
    isGameOver = true;
    isGameOverDisplayed = true;
    
    const userId = getUserId();
    
    const newScoreRef = push(ref(database, 'scores'));
    set(newScoreRef, {
        userId: userId,
        score: score,
        timestamp: Date.now()
    })
    .then(() => {
        console.log("New score saved successfully");
        isScoreSaved = true;
        saveGameState();
    })
    .catch((error) => {
        console.error("Error saving score:", error);
        isScoreSaved = false;
    });
}

function showSettingsOverlay() {
    document.getElementById('setting-overlay').style.display = 'flex';
}

function hideSettingsOverlay() {
    document.getElementById('setting-overlay').style.display = 'none';
    isGameOverDisplayed = false;
}

function handleCollision(event) {
    console.log("Collision detected");
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if (bodyA.label === bodyB.label && bodyA.label !== "watermelon") {
            World.remove(world, [bodyA, bodyB]);
            const fruitIndex = FRUITS.findIndex(fruit => fruit.name === bodyA.label);
            if (fruitIndex < FRUITS.length - 1) {
                const newFruit = FRUITS[fruitIndex + 1];
                const newBody = Bodies.circle(
                    (bodyA.position.x + bodyB.position.x) / 2,
                    (bodyA.position.y + bodyB.position.y) / 2,
                    newFruit.radius,
                    {
                        density: 0.001,
                        friction: 0.5,
                        frictionStatic: 0.5,
                        restitution: 0.1,
                        slop: 0.01,
                        label: newFruit.name,
                        render: {
                            sprite: {
                                texture: `./images/${newFruit.name}.png`
                            }
                        }
                    }
                );
                World.add(world, newBody);

                updateScore(newFruit.score);
                playSound(mergeSound);
            }
        }
    });
}

window.addEventListener('load', () => {
    console.log("Window loaded");
    initGame();
    loadGameState();
    loadBestScore();

    const restartButton = document.getElementById('restart-button');
    restartButton.addEventListener('click', handleRestartClick);

    const closeLeaderboardButton = document.getElementById('close-leaderboard');
    closeLeaderboardButton.addEventListener('click', () => {
        document.getElementById('leaderboard-overlay').style.display = 'none';
    });

    window.addEventListener('resize', () => {
        if (navigator.standalone) {
            document.documentElement.style.setProperty('--safe-area-inset-top', `${window.screen.height - document.documentElement.clientHeight}px`);
        }
    });
});

window.addEventListener('resize', () => {
    console.log("Window resized");
});

export function handleRestartClick(event) {
    event.stopPropagation();
    if (isRestarting) return;
    isRestarting = true;
    
    setTimeout(async () => {
        await restartGame();
        isRestarting = false;
    }, 100);
}

export function toggleMute(event) {
    event.stopPropagation();
    isMuted = !isMuted;
    const muteButton = document.getElementById('mute-button');
    muteButton.textContent = isMuted ? 'SFX On' : 'SFX Off';
}

function toggleBgm() {
    const bgmButton = document.getElementById('bgm-button');
    if (isBgmPlaying) {
        bgmAudio.pause();
        bgmButton.textContent = 'BGM On';
        isBgmPlaying = false;
    } else {
        bgmAudio.play();
        bgmButton.textContent = 'BGM Off';
        isBgmPlaying = true;
    }
}

export function showLeaderboard() {
    const scoresRef = ref(database, 'scores');
    const topScoresQuery = query(scoresRef, orderByChild('score'), limitToLast(10));
    
    get(topScoresQuery).then((snapshot) => {
        const scores = [];
        snapshot.forEach((childSnapshot) => {
            const scoreData = childSnapshot.val();
            scores.push({
                userId: scoreData.userId,
                score: scoreData.score
            });
        });
        scores.sort((a, b) => b.score - a.score);
        displayLeaderboard(scores);
    }).catch((error) => {
        console.error("Error fetching leaderboard:", error);
        alert("Failed to load leaderboard. Please try again later.");
    });
}

export function hideLeaderboard() {
    document.getElementById('leaderboard-overlay').style.display = 'none';
}