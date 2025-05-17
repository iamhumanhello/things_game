const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const energyDisplay = document.getElementById('energyDisplay');

// Game State
let gameState = {
    playerBase: { x: 100, y: 100, size: 30, units: [] },
    enemyBase: { x: 700, y: 400, size: 30, units: [] },
    units: [],
    energy: 50,
    gameTime: 0,
    selectedUnits: [] // For handling unit selection
};

// Game Settings
const gameSettings = {
    unitSpeed: 2,
    workerCost: 10,
    attackerCost: 20,
    resourceTickRate: 1000, // Milliseconds
    resourceGainPerTick: 1
};

// Helper Functions
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function collision(obj1, obj2) {
    return distance(obj1.x, obj1.y, obj2.x, obj2.y) < obj1.size / 2 + obj2.size / 2;
}

// Game Object Classes (Illustrative)
class Unit {
    constructor(x, y, size = 15, speed = gameSettings.unitSpeed, color = 'blue', type = 'unit') {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = speed;
        this.color = color;
        this.type = type;
        this.target = null; // For movement or attack orders
        this.health = 10;
    }

    update() {
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;

            if (distance(this.x, this.y, this.target.x, this.target.y) < this.size) {
                this.onTargetReached();
            }
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    onTargetReached() {
        // Placeholder for specific unit behavior on reaching a target
        if (this.target.type === 'unit' && this.type === 'attacker') {
            this.attack(this.target);
        }
        this.target = null;
    }

    attack(targetUnit) {
        targetUnit.health -= 5; // Example damage
        console.log(`${this.type} attacked ${targetUnit.type}, remaining health: ${targetUnit.health}`);
        if (targetUnit.health <= 0) {
            // Handle unit destruction
            const index = gameState.units.indexOf(targetUnit);
            if (index > -1) {
                gameState.units.splice(index, 1);
            }
        }
    }
}

class Worker extends Unit {
    constructor(x, y) {
        super(x, y, 10, gameSettings.unitSpeed * 0.8, 'green', 'worker');
    }

    onTargetReached() {
        // Workers might gather resources or build structures later
        this.target = null;
    }
}

class Attacker extends Unit {
    constructor(x, y) {
        super(x, y, 12, gameSettings.unitSpeed * 1.2, 'red', 'attacker');
    }

    onTargetReached() {
        if (this.target && (this.target.type === 'unit' || this.target === gameState.enemyBase)) {
            this.attack(this.target);
        }
        this.target = null;
    }

    attack(target) {
        super.attack(target);
        // Specific attacker logic
    }
}

// Game Logic Functions
function buildUnit(type) {
    let cost;
    let UnitClass;

    if (type === 'worker') {
        cost = gameSettings.workerCost;
        UnitClass = Worker;
    } else if (type === 'attacker') {
        cost = gameSettings.attackerCost;
        UnitClass = Attacker;
    }

    if (gameState.energy >= cost) {
        gameState.energy -= cost;
        const newUnit = new UnitClass(gameState.playerBase.x + gameState.playerBase.size + 10, gameState.playerBase.y);
        gameState.units.push(newUnit);
        gameState.playerBase.units.push(newUnit);
        console.log(`Built a ${type}. Energy: ${gameState.energy}`);
        updateUI();
    } else {
        console.log("Not enough energy to build a " + type);
    }
}

function handleMouseClick(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Unit Selection (Basic)
    gameState.units.forEach(unit => {
        if (distance(mouseX, mouseY, unit.x, unit.y) < unit.size / 2) {
            gameState.selectedUnits = [unit]; // Simple single selection
            console.log("Selected unit:", unit);
        }
    });

    // Issue Move/Attack Order to Selected Units
    if (gameState.selectedUnits.length > 0) {
        // Check if clicked on an enemy unit or base
        const targetEnemy = gameState.units.find(unit => unit !== gameState.selectedUnits[0] && distance(mouseX, mouseY, unit.x, unit.y) < unit.size / 2);
        if (targetEnemy) {
            gameState.selectedUnits.forEach(unit => unit.target = targetEnemy);
            console.log("Order: Attack enemy unit");
            return;
        }

        if (distance(mouseX, mouseY, gameState.enemyBase.x, gameState.enemyBase.y) < gameState.enemyBase.size / 2) {
            gameState.selectedUnits.forEach(unit => unit.target = gameState.enemyBase);
            console.log("Order: Attack enemy base");
            return;
        }

        // Otherwise, move the selected units
        gameState.selectedUnits.forEach(unit => unit.target = { x: mouseX, y: mouseY, type: 'location' });
        console.log("Order: Move to", mouseX, mouseY);
    }
}

// Resource Generation
function generateResources() {
    gameState.energy += gameSettings.resourceGainPerTick;
    updateUI();
}

// Update UI
function updateUI() {
    energyDisplay.textContent = gameState.energy;
}

// Game Loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Bases
    ctx.fillStyle = 'blue';
    ctx.fillRect(gameState.playerBase.x - gameState.playerBase.size / 2, gameState.playerBase.y - gameState.playerBase.size / 2, gameState.playerBase.size, gameState.playerBase.size);
    ctx.fillStyle = 'red';
    ctx.fillRect(gameState.enemyBase.x - gameState.enemyBase.size / 2, gameState.enemyBase.y - gameState.enemyBase.size / 2, gameState.enemyBase.size, gameState.enemyBase.size);

    // Update and Draw Units
    gameState.units.forEach(unit => {
        unit.update();
        unit.draw();
    });

    // Basic Selection Indicator
    if (gameState.selectedUnits.length > 0) {
        gameState.selectedUnits.forEach(unit => {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(unit.x, unit.y, unit.size / 2 + 5, 0, Math.PI * 2);
            ctx.closePath();
            ctx.stroke();
        });
    }

    gameState.gameTime += 16; // Approximate milliseconds per frame
    requestAnimationFrame(gameLoop);
}

// Initialize Game
function initGame() {
    canvas.width = 800;
    canvas.height = 600;
    canvas.addEventListener('click', handleMouseClick);
    setInterval(generateResources, gameSettings.resourceTickRate);
    updateUI();
    gameLoop();
}

initGame();
