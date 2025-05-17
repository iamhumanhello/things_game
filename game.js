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
    energyProductionRate: gameSettings.generatorProductionRate, // New
    unitCap: gameSettings.initialUnitCap, // New
    currentUnitCount: 0, // New
    buildings: [], // New array to hold buildings
    gameTime: 0,
    selectedUnits: []
};

// Game Settings
const gameSettings = {
    unitSpeed: 2,
    workerCost: 10,
    attackerCost: 20,
    basicUnitBuildTime: 5000, // Milliseconds
    barracksCost: 50, // New
    barracksBuildTime: 10000, // New
    houseCost: 30, // New
    houseBuildTime: 7000, // New
    generatorCost: 40, // New
    generatorBuildTime: 8000, // New
    generatorProductionRate: 1, // Energy per second (will be adjusted by interval)
    initialUnitCap: 5, // New
    houseUnitCapIncrease: 3, // New
    resourceTickInterval: 1000 // Milliseconds for energy production
};

// ... (Helper functions like getRandomInt, distance, collision remain the same)

// Game Object Classes
class GameObject { // Base class for all game objects with position, size, and health
    constructor(x, y, size, color = 'white', type = 'object', health = 100) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.type = type;
        this.health = health;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }

    update() {
        // Can be overridden by subclasses for specific behavior
    }
}

class Unit extends GameObject {
    constructor(x, y, size = 15, speed = gameSettings.unitSpeed, color = 'blue', type = 'unit') {
        super(x, y, size, color, type, 10);
        this.speed = speed;
        this.target = null;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    update() {
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;

            if (distance(this.x, this.y, this.target.x, this.target.y) < this.size / 2) {
                this.onTargetReached();
            }
        }
    }

    onTargetReached() {
        if (this.target.type === 'unit' && this.type === 'attacker') {
            this.attack(this.target);
        } else if (this.target.type === 'building') {
            // Basic interaction with buildings
            console.log(`${this.type} reached building: ${this.target.type}`);
            this.target = null;
        }
        this.target = null;
    }

    attack(targetUnit) {
        targetUnit.health -= 5;
        console.log(`${this.type} attacked ${targetUnit.type}, remaining health: ${targetUnit.health}`);
        if (targetUnit.health <= 0) {
            const index = gameState.units.indexOf(targetUnit);
            if (index > -1) {
                gameState.units.splice(index, 1);
                gameState.currentUnitCount--;
            }
        }
    }
}

class Worker extends Unit {
    constructor(x, y) {
        super(x, y, 10, gameSettings.unitSpeed * 0.8, 'green', 'worker');
    }

    onTargetReached() {
        this.target = null;
    }
}

class Attacker extends Unit {
    constructor(x, y) {
        super(x, y, 12, gameSettings.unitSpeed * 1.2, 'red', 'attacker');
    }

    onTargetReached() {
        if (this.target && (this.target.type === 'unit' || this.target.type === 'building')) {
            this.attack(this.target);
        }
        this.target = null;
    }

    attack(target) {
        super.attack(target);
    }
}

class Building extends GameObject {
    constructor(x, y, size, color, type, cost, buildTime) {
        super(x, y, size, color, type, 100); // Buildings have more health
        this.cost = cost;
        this.buildTime = buildTime;
        this.buildProgress = 0;
        this.isBuilt = false;
    }

    update() {
        if (!this.isBuilt) {
            this.buildProgress += 16; // Assuming ~60 FPS
            if (this.buildProgress >= this.buildTime) {
                this.isBuilt = true;
                console.log(`${this.type} at (${this.x}, ${this.y}) finished building.`);
                if (this.type === 'house') {
                    gameState.unitCap += gameSettings.houseUnitCapIncrease;
                    updateUI();
                }
            }
        }
    }

    draw() {
        if (this.isBuilt) {
            super.draw();
        } else {
            // Indicate building in progress
            ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
            ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        }
    }
}

class Barracks extends Building {
    constructor(x, y) {
        super(x, y, 40, 'orange', 'barracks', gameSettings.barracksCost, gameSettings.barracksBuildTime);
    }
    // Can add specific barracks functionality later (e.g., training advanced units)
}

class House extends Building {
    constructor(x, y) {
        super(x, y, 30, 'lightgray', 'house', gameSettings.houseCost, gameSettings.houseBuildTime);
    }
}

class Generator extends Building {
    constructor(x, y) {
        super(x, y, 30, 'yellow', 'generator', gameSettings.generatorCost, gameSettings.generatorBuildTime);
    }
    // Generators will produce energy in the main game loop
}

// Initialize with one generator
gameState.buildings.push(new Generator(gameState.playerBase.x - 50, gameState.playerBase.y));

// Game Logic Functions
let buildingToPlace = null; // To track which building the player wants to place

function handleBaseClick(mouseX, mouseY) {
    if (distance(mouseX, mouseY, gameState.playerBase.x, gameState.playerBase.y) < gameState.playerBase.size / 2) {
        // Open a simple "build menu" near the base
        const buildWorkerButton = document.createElement('button');
        buildWorkerButton.textContent = `Build Worker (${gameSettings.workerCost} Energy)`;
        buildWorkerButton.onclick = () => attemptBuildUnit('worker');

        const buildAttackerButton = document.createElement('button');
        buildAttackerButton.textContent = `Build Attacker (${gameSettings.attackerCost} Energy)`;
        buildAttackerButton.onclick = () => attemptBuildUnit('attacker');

        const buildMenu = document.createElement('div');
        buildMenu.style.position = 'absolute';
        buildMenu.style.left = `${mouseX + 10}px`;
        buildMenu.style.top = `${mouseY - 20}px`;
        buildMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        buildMenu.style.color = '#eee';
        buildMenu.style.padding = '10px';
        buildMenu.style.borderRadius = '5px';

        buildMenu.appendChild(buildWorkerButton);
        buildMenu.appendChild(buildAttackerButton);
        document.body.appendChild(buildMenu);

        // Remove the menu when clicking outside
        setTimeout(() => {
            function removeMenu(event) {
                if (!buildMenu.contains(event.target)) {
                    document.body.removeChild(buildMenu);
                    document.removeEventListener('click', removeMenu);
                }
            }
            document.addEventListener('click', removeMenu);
        }, 0);
        return true; // Indicate base click handled
    }
    return false;
}

function attemptBuildUnit(type) {
    let cost;
    let buildTime;
    let UnitClass;

    if (type === 'worker') {
        cost = gameSettings.workerCost;
        buildTime = gameSettings.basicUnitBuildTime;
        UnitClass = Worker;
    } else if (type === 'attacker') {
        cost = gameSettings.attackerCost;
        buildTime = gameSettings.basicUnitBuildTime;
        UnitClass = Attacker;
    }

    if (gameState.energy >= cost && gameState.currentUnitCount < gameState.unitCap) {
        gameState.energy -= cost;
        console.log(`Building a ${type}...`);
        // Simulate build time (for now, instant after a delay)
        setTimeout(() => {
            const newUnit = new UnitClass(gameState.playerBase.x + gameState.playerBase.size + 10, gameState.playerBase.y);
            gameState.units.push(newUnit);
            gameState.playerBase.units.push(newUnit);
            gameState.currentUnitCount++;
            console.log(`${type} built. Energy: ${gameState.energy}, Units: ${gameState.currentUnitCount}/${gameState.unitCap}`);
            updateUI();
        }, buildTime);
        updateUI();
    } else if (gameState.energy < cost) {
        console.log("Not enough energy to build a " + type);
    } else {
        console.log("Unit cap reached!");
    }
}

function handleBuildCommand(buildingType) {
    buildingToPlace = buildingType;
    console.log(`Ready to place a ${buildingType}. Click on the map.`);
}

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (handleBaseClick(mouseX, mouseY)) {
        return; // Don't process further clicks if it was on the base for unit building
    }

    if (buildingToPlace) {
        let newBuilding;
        switch (buildingToPlace) {
            case 'barracks':
                if (gameState.energy >= gameSettings.barracksCost) {
                    gameState.energy -= gameSettings.barracksCost;
                    newBuilding = new Barracks(mouseX, mouseY);
                    gameState.buildings.push(newBuilding);
                    buildingToPlace = null;
                    console.log("Barracks blueprint placed.");
                } else {
                    console.log("Not enough energy for a barracks.");
                }
                break;
            case 'house':
                if (gameState.energy >= gameSettings.houseCost) {
                    gameState.energy -= gameSettings.houseCost;
                    newBuilding = new House(mouseX, mouseY);
                    gameState.buildings.push(newBuilding);
                    buildingToPlace = null;
                    console.log("House blueprint placed.");
                } else {
                    console.log("Not enough energy for a house.");
                }
                break;
            case 'generator':
                if (gameState.energy >= gameSettings.generatorCost) {
                    gameState.energy -= gameSettings.generatorCost;
                    newBuilding = new Generator(mouseX, mouseY);
                    gameState.buildings.push(newBuilding);
                    buildingToPlace = null;
                    console.log("Generator blueprint placed.");
                } else {
                    console.log("Not enough energy for a generator.");
                }
                break;
            default:
                buildingToPlace = null;
                break;
        }
        updateUI();
        return;
    }

    // Unit Selection and Movement/Attack Logic
    let unitSelected = false;
    gameState.units.forEach(unit => {
        if (distance(mouseX, mouseY, unit.x, unit.y) < unit.size / 2) {
            gameState.selectedUnits = [unit];
            console.log("Selected unit:", unit);
            unitSelected = true;
        }
    });

    if (!unitSelected && gameState.selectedUnits.length > 0) {
        // Issue Move/Attack Order
        const targetEnemy = gameState.units.find(unit => unit !== gameState.selectedUnits[0] && distance(mouseX, mouseY, unit.x, unit.y) < unit.size / 2);
        if (targetEnemy) {
            gameState.selectedUnits.forEach(unit => unit.target = targetEnemy);
            console.log("Order: Attack enemy unit");
            return;
        }

        const targetBuilding = gameState.buildings.find(building => distance(mouseX, mouseY, building.x, building.y) < building.size / 2);
        if (targetBuilding && targetBuilding.type !== 'generator') { // Don't attack your own buildings for now
            gameState.selectedUnits.forEach(unit => unit.target = targetBuilding);
            console.log("Order: Interact with building:", targetBuilding.type);
            return;
        }

        if (distance(mouseX, mouseY, gameState.enemyBase.x, gameState.enemyBase.y) < gameState.enemyBase.size / 2) {
            gameState.selectedUnits.forEach(unit => unit.target = gameState.enemyBase);
            console.log("Order: Attack enemy base");
            return;
        }

        gameState.selectedUnits.forEach(unit => unit.target = { x: mouseX, y: mouseY, type: 'location' });
        console.log("Order: Move to", mouseX, mouseY);
    }
}

// Resource Generation
function generateResources() {
    gameState.energy += gameState.energyProductionRate;
    updateUI();
}

// Update UI
function updateUI() {
    energyDisplay.textContent = Math.floor(gameState.energy);
    const unitCountDisplay = document.getElementById('unitCountDisplay');
    if (unitCountDisplay) {
        unitCountDisplay.textContent = `${gameState.currentUnitCount}/${gameState.unitCap}`;
    }
}

// Game Loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Bases
    ctx.fillStyle = 'blue';
    ctx.fillRect(gameState.playerBase.x - gameState.playerBase.size / 2, gameState.playerBase.y - gameState.playerBase.size / 2, gameState.playerBase.size, gameState.playerBase.size);
    ctx.fillStyle = 'red';
    ctx.fillRect(gameState.enemyBase.x - gameState.enemyBase.size / 2, gameState.enemyBase.y - gameState.enemyBase.size / 2, gameState.enemyBase.size, gameState.enemyBase.size);

    // Draw Buildings
    gameState.buildings.forEach(building => {
        building.update();
        building.draw();
    });

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

    gameState.gameTime += 16;
    requestAnimationFrame(gameLoop);
}

// Initialize Game
function initGame() {
    canvas.width = 800;
    canvas.height = 600;
    canvas.addEventListener('click', handleCanvasClick);
    setInterval(generateResources, gameSettings.resourceTickInterval);
    updateUI();
    gameLoop();
}

initGame();
