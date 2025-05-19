// Game Variables
let canvas, ctx;
let ship, asteroids, bullets, stars, powerUps;
let score = 0;
let lives = 3;
let respawnCount = 0;
let maxRespawns = 1;
let highScore = localStorage.getItem('asteroidShooterHighScore') || 0;
let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;
let lastTime = 0;
let lastAsteroidTime = 0;
let lastPowerUpTime = 1000;
let asteroidInterval = 3000;
let powerUpInterval = 1; // Power-up spawns every 10 seconds

// Game Settings
let settings = {
    asteroidSpeed: 1.0, // Multiplier for asteroid base speed
    shipThrust: 0.1     // Ship thrust value
};

// Keyboard state
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false
};

// Star object for animated background
class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.5;
        this.opacitySpeed = Math.random() * 0.02 + 0.01;
        this.phase = Math.random() * Math.PI * 2;
        this.velocityX = (Math.random() - 0.5) * 0.1;
        this.velocityY = (Math.random() - 0.5) * 0.1;
    }

    update() {
        this.opacity = 0.5 + 0.5 * Math.sin(performance.now() * this.opacitySpeed + this.phase);
        this.x += this.velocityX;
        this.y += this.velocityY;
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }

    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

// PowerUp object
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.type = type; // 'rapidFire' or 'shield'
        this.lifespan = 5000; // 5 seconds
        this.color = type === 'rapidFire' ? '#FFFF00' : '#00FFFF';
    }

    update(deltaTime) {
        this.lifespan -= deltaTime;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type === 'rapidFire' ? 'RF' : 'S', this.x, this.y);
    }
}

// Ship object
class Ship {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.angle = 0;
        this.rotationSpeed = 0.1;
        this.velocityX = 0;
        this.velocityY = 0;
        this.thrust = settings.shipThrust;
        this.friction = 0.98;
        this.maxSpeed = 5; // Dikembalikan ke 5 untuk deteksi kolisi yang lebih baik
        this.color = "#ff4081";
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.shotCooldown = 0;
        this.powerUp = null;
        this.powerUpTime = 0;
    }
    
    update(deltaTime) {
        if (keys.left) this.angle -= this.rotationSpeed;
        if (keys.right) this.angle += this.rotationSpeed;
        
        if (keys.up) {
            this.velocityX += Math.sin(this.angle) * this.thrust;
            this.velocityY -= Math.cos(this.angle) * this.thrust;
        }
        if (keys.down) {
            this.velocityX -= Math.sin(this.angle) * this.thrust;
            this.velocityY += Math.cos(this.angle) * this.thrust;
        }
        
        this.velocityX *= this.friction;
        this.velocityY *= this.friction;
        
        const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
        if (speed > this.maxSpeed) {
            const ratio = this.maxSpeed / speed;
            this.velocityX *= ratio;
            this.velocityY *= ratio;
        }
        
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
        
        if (this.shotCooldown > 0) {
            this.shotCooldown -= deltaTime;
        }
        
        const cooldown = this.powerUp === 'rapidFire' ? 100 : 300;
        if (keys.space && this.shotCooldown <= 0) {
            this.shoot();
            this.shotCooldown = cooldown;
        }
        
        if (this.invulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        if (this.powerUp) {
            this.powerUpTime -= deltaTime;
            if (this.powerUpTime <= 0) {
                this.powerUp = null;
            }
        }
    }
    
    shoot() {
        const bulletSpeed = 10;
        const bulletVelocityX = Math.sin(this.angle) * bulletSpeed;
        const bulletVelocityY = -Math.cos(this.angle) * bulletSpeed;
        
        bullets.push(new Bullet(
            this.x + Math.sin(this.angle) * this.radius,
            this.y - Math.cos(this.angle) * this.radius,
            bulletVelocityX,
            bulletVelocityY
        ));
        
        playSound('shoot');
    }
    
    draw() {
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(-this.radius / 2, this.radius);
        ctx.lineTo(this.radius / 2, this.radius);
        ctx.closePath();
        
        ctx.fillStyle = this.color;
        ctx.fill();
        
        if (keys.up) {
            ctx.beginPath();
            ctx.moveTo(-this.radius / 3, this.radius);
            ctx.lineTo(0, this.radius + this.radius / 2);
            ctx.lineTo(this.radius / 3, this.radius);
            ctx.closePath();
            ctx.fillStyle = "#FFA500";
            ctx.fill();
        }
        
        if (keys.down) {
            ctx.beginPath();
            ctx.moveTo(-this.radius / 3, -this.radius);
            ctx.lineTo(0, -this.radius - this.radius / 2);
            ctx.lineTo(this.radius / 3, -this.radius);
            ctx.closePath();
            ctx.fillStyle = "#FFA500";
            ctx.fill();
        }
        
        if (this.powerUp === 'shield') {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    hit() {
        if (!this.invulnerable && this.powerUp !== 'shield') {
            lives--;
            updateLives();
            playSound('explosion');
            
            if (lives <= 0 || respawnCount >= maxRespawns) {
                setTimeout(() => gameOver(), 500);
            } else {
                respawnCount++;
                this.invulnerable = true;
                this.invulnerabilityTime = 3000;
                this.x = canvas.width / 2;
                this.y = canvas.height / 2;
                this.velocityX = 0;
                this.velocityY = 0;
                this.angle = 0;
            }
        }
    }

    collectPowerUp(powerUp) {
        this.powerUp = powerUp.type;
        this.powerUpTime = 500000;
        playSound('powerUp');
        console.log(`Power-up collected: ${this.powerUp}`); // Debug log
    }
}

// Asteroid object
class Asteroid {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius || 30 + Math.random() * 20;
        this.speed = (speed || 1 + Math.random() * 2) * settings.asteroidSpeed;
        this.angle = Math.random() * Math.PI * 2;
        this.velocityX = Math.sin(this.angle) * this.speed;
        this.velocityY = Math.cos(this.angle) * this.speed;
        this.vertices = [];
        this.color = "#8BC34A";
        
        const numVertices = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2;
            const radiusVariation = 0.5 + Math.random() * 0.5;
            this.vertices.push({
                x: Math.cos(angle) * this.radius * radiusVariation,
                y: Math.sin(angle) * this.radius * radiusVariation
            });
        }
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        if (this.x < -this.radius) this.x = canvas.width + this.radius;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = canvas.height + this.radius;
        if (this.y > canvas.height + this.radius) this.y = -this.radius;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }
    
    split() {
        if (this.radius < 15) return [];
        
        const newAsteroids = [];
        for (let i = 0; i < 2; i++) {
            const newRadius = this.radius * 0.6;
            const newSpeed = this.speed * 1.2 * settings.asteroidSpeed;
            const angleOffset = i === 0 ? Math.PI / 4 : -Math.PI / 4;
            
            const newAsteroid = new Asteroid(this.x, this.y, newRadius, newSpeed);
            const newAngle = Math.atan2(this.velocityY, this.velocityX) + angleOffset;
            newAsteroid.velocityX = Math.cos(newAngle) * newSpeed;
            newAsteroid.velocityY = Math.sin(newAngle) * newSpeed;
            newAsteroids.push(newAsteroid);
        }
        return newAsteroids;
    }
}

// Bullet object
class Bullet {
    constructor(x, y, velocityX, velocityY) {
        this.x = x;
        this.y = y;
        this.radius = 3;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.lifespan = 50;
        this.color = "#FFF";
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
        
        this.lifespan--;
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

// Initialize the game
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    updateHighScore();
    ship = new Ship(canvas.width / 2, canvas.height / 2);
    asteroids = [];
    bullets = [];
    powerUps = [];
    
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push(new Star());
    }
    
    for (let i = 0; i < 4; i++) {
        createAsteroid();
    }
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    addTouchControls();
    
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('restartBtn').addEventListener('click', resetGame);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    
    const asteroidSpeedInput = document.getElementById('asteroidSpeed');
    const shipSpeedInput = document.getElementById('shipSpeed');
    asteroidSpeedInput.addEventListener('input', () => {
        document.getElementById('asteroidSpeedValue').textContent = asteroidSpeedInput.value;
    });
    shipSpeedInput.addEventListener('input', () => {
        document.getElementById('shipSpeedValue').textContent = shipSpeedInput.value;
    });
    
    render();
}

function createAsteroid() {
    let x, y;
    do {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
    } while (
        Math.abs(x - canvas.width / 2) < 100 &&
        Math.abs(y - canvas.height / 2) < 100
    );
    asteroids.push(new Asteroid(x, y));
}

function createPowerUp() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const type = Math.random() < 0.5 ? 'rapidFire' : 'shield';
    powerUps.push(new PowerUp(x, y, type));
}

function startGame() {
    if (!gameRunning) {
        // Reset game state if coming from game over
        if (lives <= 0 || respawnCount >= maxRespawns) {
            resetGame();
        }
        gameRunning = true;
        gamePaused = false; // Pastikan tidak dalam mode jeda
        lastTime = performance.now();
        lastAsteroidTime = 0;
        lastPowerUpTime = 0;
        console.log("Game started, ship initialized:", ship); // Debug log
        animationFrameId = requestAnimationFrame(gameLoop);
    } else if (gamePaused) {
        gamePaused = false;
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function togglePause() {
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        cancelAnimationFrame(animationFrameId);
    } else if (gameRunning && gamePaused) {
        gamePaused = false;
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function resetGame() {
    console.log("Resetting game..."); // Debug log
    ship = new Ship(canvas.width / 2, canvas.height / 2);
    asteroids = [];
    bullets = [];
    powerUps = [];
    score = 0;
    lives = 3;
    respawnCount = 0;
    updateScore();
    updateLives();
    
    for (let i = 0; i < 4; i++) {
        createAsteroid();
    }
    
    if (gameRunning) {
        if (gamePaused) gamePaused = false;
        cancelAnimationFrame(animationFrameId);
        lastTime = performance.now();
        lastAsteroidTime = 0;
        lastPowerUpTime = 0;
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        render();
    }
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    asteroids = [];
    bullets = [];
    powerUps = [];
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#FFF";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "20px Arial";
    ctx.fillText(`Skor Akhir: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText("Tekan tombol 'Restart' untuk bermain lagi", canvas.width / 2, canvas.height / 2 + 50);
}

function updateScore() {
    document.getElementById('score').textContent = `Skor: ${score}`;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidShooterHighScore', highScore);
        updateHighScore();
    }
}

function updateHighScore() {
    document.getElementById('highscore').textContent = `Skor Tertinggi: ${highScore}`;
}

function updateLives() {
    document.getElementById('lives').textContent = `Nyawa: ${lives}`;
}

function handleKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
    if (e.key === ' ') keys.space = true;
    
    // Hanya panggil startGame jika game belum berjalan dan bukan game over
    if (!gameRunning && lives > 0) {
        startGame();
    } else if (gamePaused) {
        togglePause();
    }
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
}

function handleKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
    if (e.key === ' ') keys.space = false;
}

function addTouchControls() {
    const touchZones = {
        left: { x: 0, y: 0, width: canvas.width / 4, height: canvas.height },
        right: { x: canvas.width * 3 / 4, y: 0, width: canvas.width / 4, height: canvas.height },
        up: { x: canvas.width / 4, y: 0, width: canvas.width / 2, height: canvas.height / 2 },
        down: { x: canvas.width / 4, y: canvas.height / 2, width: canvas.width / 4, height: canvas.height / 2 },
        shoot: { x: canvas.width / 2, y: canvas.height / 2, width: canvas.width / 4, height: canvas.height / 2 }
    };
    
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleTouchControls(e, true);
    });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        handleTouchControls(e, false);
    });
    
    canvas.addEventListener('touchcancel', function(e) {
        e.preventDefault();
        keys.left = false;
        keys.right = false;
        keys.up = false;
        keys.down = false;
        keys.space = false;
    });
    
    function handleTouchControls(e, isActive) {
        const touches = e.touches || e.changedTouches;
        if (!isActive) {
            keys.left = false;
            keys.right = false;
            keys.up = false;
            keys.down = false;
            keys.space = false;
        }
        
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const touchX = touch.clientX - canvas.getBoundingClientRect().left;
            const touchY = touch.clientY - canvas.getBoundingClientRect().top;
            
            if (isInZone(touchX, touchY, touchZones.left)) keys.left = isActive;
            if (isInZone(touchX, touchY, touchZones.right)) keys.right = isActive;
            if (isInZone(touchX, touchY, touchZones.up)) keys.up = isActive;
            if (isInZone(touchX, touchY, touchZones.down)) keys.down = isActive;
            if (isInZone(touchX, touchY, touchZones.shoot)) keys.space = isActive;
        }
        
        if (isActive && (!gameRunning && lives > 0 || gamePaused)) startGame();
    }
    
    function isInZone(x, y, zone) {
        return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
    }
}

// Settings Menu
function openSettings() {
    document.getElementById('settingsMenu').style.display = 'block';
    if (gameRunning && !gamePaused) togglePause();
}

function saveSettings() {
    settings.asteroidSpeed = parseFloat(document.getElementById('asteroidSpeed').value);
    settings.shipThrust = parseFloat(document.getElementById('shipSpeed').value);
    ship.thrust = settings.shipThrust;
    asteroids.forEach(asteroid => {
        const speed = asteroid.speed / settings.asteroidSpeed;
        asteroid.speed = speed * settings.asteroidSpeed;
        const angle = Math.atan2(asteroid.velocityY, asteroid.velocityX);
        asteroid.velocityX = Math.cos(angle) * asteroid.speed;
        asteroid.velocityY = Math.sin(angle) * asteroid.speed;
    });
    closeSettings();
}

function closeSettings() {
    document.getElementById('settingsMenu').style.display = 'none';
}

// Sound system
const sounds = {};

function loadSounds() {
    try {
        if (window.AudioContext || window.webkitAudioContext) {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            sounds.shoot = function() {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.1);
            };
            
            sounds.explosion = function() {
                const bufferSize = 4096;
                const whiteNoise = audioCtx.createBufferSource();
                const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                whiteNoise.buffer = noiseBuffer;
                const gainNode = audioCtx.createGain();
                gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                whiteNoise.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                whiteNoise.start();
                whiteNoise.stop(audioCtx.currentTime + 0.3);
            };
            
            sounds.powerUp = function() {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.2);
            };
        } else {
            sounds.shoot = function() {};
            sounds.explosion = function() {};
            sounds.powerUp = function() {};
        }
    } catch (e) {
        console.error("Sound initialization failed:", e);
        sounds.shoot = function() {};
        sounds.explosion = function() {};
        sounds.powerUp = function() {};
    }
}

function playSound(soundName) {
    try {
        if (sounds[soundName]) sounds[soundName]();
    } catch (e) {
        console.error("Sound playback failed:", e);
    }
}

// Collision detection
function checkCollisions() {
    if (!ship.invulnerable && ship.powerUp !== 'shield') {
        for (let i = 0; i < asteroids.length; i++) {
            const asteroid = asteroids[i];
            const distance = Math.sqrt(
                (ship.x - asteroid.x) * (ship.x - asteroid.x) + 
                (ship.y - asteroid.y) * (ship.y - asteroid.y)
            );
            if (distance < ship.radius + asteroid.radius * 0.8) {
                ship.hit();
                break;
            }
        }
    }
    
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            const distance = Math.sqrt(
                (bullet.x - asteroid.x) * (bullet.x - asteroid.x) + 
                (bullet.y - asteroid.y) * (bullet.y - asteroid.y)
            );
            if (distance < bullet.radius + asteroid.radius) {
                bullets.splice(i, 1);
                const newAsteroids = asteroid.split();
                asteroids.splice(j, 1);
                asteroids.push(...newAsteroids);
                const pointValue = Math.floor(50 / asteroid.radius * 10);
                score += pointValue;
                updateScore();
                playSound('explosion');
                break;
            }
        }
    }
    
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        const distance = Math.sqrt(
            (ship.x - powerUp.x) * (ship.x - powerUp.x) + 
            (ship.y - powerUp.y) * (ship.y - powerUp.y)
        );
        if (distance < ship.radius + powerUp.radius) {
            console.log(`Collision detected with power-up: ${powerUp.type}`); // Debug log
            ship.collectPowerUp(powerUp);
            powerUps.splice(i, 1);
        }
    }
}

// Game loop
function gameLoop(timestamp) {
    if (!gameRunning || gamePaused) return;
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    update(deltaTime);
    render();
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    ship.update(deltaTime);
    
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].lifespan <= 0) bullets.splice(i, 1);
    }
    
    for (let i = asteroids.length - 1; i >= 0; i--) {
        asteroids[i].update();
    }
    
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].update(deltaTime);
        if (powerUps[i].lifespan <= 0) powerUps.splice(i, 1);
    }
    
    for (let i = 0; i < stars.length; i++) {
        stars[i].update();
    }
    
    checkCollisions();
    
    lastAsteroidTime += deltaTime;
    if (lastAsteroidTime > asteroidInterval && asteroids.length < 8) {
        createAsteroid();
        lastAsteroidTime = 0;
        asteroidInterval = Math.max(1500, asteroidInterval - 50);
    }
    
    lastPowerUpTime += deltaTime;
    if (lastPowerUpTime > powerUpInterval && powerUps.length < 1) {
        createPowerUp();
        lastPowerUpTime = 0;
    }
}

function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < stars.length; i++) {
        stars[i].draw();
    }
    
    if (gameRunning && lives > 0) {
        ship.draw();
    }
    
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].draw();
    }
    
    for (let i = 0; i < asteroids.length; i++) {
        asteroids[i].draw();
    }
    
    for (let i = 0; i < powerUps.length; i++) {
        powerUps[i].draw();
    }
    
    if (respawnCount > 0) {
        ctx.fillStyle = "#FFF";
        ctx.font = "14px Arial";
        ctx.textAlign = "right";
        ctx.fillText(`Respawn: ${respawnCount}/${maxRespawns}`, canvas.width - 10, 30);
    }
    
    if (!gameRunning && lives > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFF";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Tekan tombol 'Mulai' untuk memulai", canvas.width / 2, canvas.height / 2);
    }
    
    if (gamePaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFF";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("JEDA", canvas.width / 2, canvas.height / 2);
    }
}

// Initialize sounds
function init() {
    loadSounds();
    initGame();
}

window.addEventListener('load', init);