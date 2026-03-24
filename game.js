const config = {
    type: Phaser.AUTO,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    width: 1200, height: 800, 
    backgroundColor: '#000000', 
    physics: { default: 'arcade', arcade: { debug: false, fps: 60 } },
    disableVisibilityChange: true, pauseOnBlur: false, 
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let train, coaches, ohePoles, signals, keyH, keyC, keyE, keyUp, keyDown, tracks;
let speed = 0; let maxSpeed = 25; 

// --- NPC TRAINS & BLOCK SIGNALLING ---
let npcTrains = [];          
let blockOccupancy = {};     
let signalMap = {};          
let distantMarkers = {};     
const DISTANT_MARKER_OFFSET = 9000;
let playerBlockId = -1;
let playerLastSignalX = -Infinity;
let npcSpawnTimer = 0;
let gameScene;
const OPP_TRACK_OFFSET = 0;
const RELIEF_TRACK_OFFSET = 28;

// Deadlock breaker
let deadlockTimer = 0;
const DEADLOCK_TIMEOUT = 10000;
let signalWaitTimer = 0;
const SIGNAL_WAIT_CLEAR = 30000;
let signalWaitFired = false; 
let guardMsgCooldown = 0;   
const GUARD_MSG_COOLDOWN = 12000; 

let playerOnLoop = false;         
let loopMergeX   = -1;           
let loopWarningText = null;       

let brakeCylinderPressure = 0, brakePipePressure = 5.0;
let isEBrakeActive = false, canReleaseEBrake = false, areHeadlightsOn = false;
let postEBGrace = false; 
let stopTimer = 0, throttlePercent = 0, brakePercent = 0;
let cameraDolly, relativeX = 300; 

let dayTime = 1200; 
let clockText, skyGraphics, headlightBeams;

let lastPoleX = 0, lastSignalX = 0, lastTrackX = 0;
const POLE_SPACING = 600, SIGNAL_SPACING = 18000, TRACK_TILE_WIDTH = 1200; 

// ===================== ROUTE DATA =====================
const ROUTES = {
    'Mumbai - New Delhi': {
        stations: ["MUMBAI CENTRAL", "SURAT", "VADODARA", "RATLAM", "KOTA JN", "NEW DELHI"],
        distances: [0, 14000, 8500, 16000, 12000, 20000],
        ghatBetween: null
    },
    'New Delhi - Mumbai': {
        stations: ["NEW DELHI", "KOTA JN", "RATLAM", "VADODARA", "SURAT", "MUMBAI CENTRAL"],
        distances: [0, 20000, 12000, 16000, 8500, 14000],
        ghatBetween: null
    },
    'Mumbai - Pune': {
        stations: ["MUMBAI CST", "THANE", "KALYAN JN", "KARJAT", "LONAVALA", "PUNE JN"],
        distances: [0, 7800, 5500, 15000, 9200, 15000],
        ghatBetween: [3, 4],   
        ghatSpeedLimit: 45
    },
    'Pune - Mumbai': {
        stations: ["PUNE JN", "LONAVALA", "KARJAT", "KALYAN JN", "THANE", "MUMBAI CST"],
        distances: [0, 15000, 9200, 15000, 5500, 7800],
        ghatBetween: [1, 2],
        ghatSpeedLimit: 45
    },
    'Coimbatore - Chennai': {
        stations: ["COIMBATORE JN", "ERODE JN", "SALEM JN", "JOLARPETTAI", "KATPADI JN", "CHENNAI CENTRAL"],
        distances: [0, 12000, 10000, 14000, 8000, 16000],
        ghatBetween: null
    },
    'Chennai - Coimbatore': {
        stations: ["CHENNAI CENTRAL", "KATPADI JN", "JOLARPETTAI", "SALEM JN", "ERODE JN", "COIMBATORE JN"],
        distances: [0, 16000, 8000, 14000, 10000, 12000],
        ghatBetween: null
    }
};

let stationNames = ROUTES['Mumbai - New Delhi'].stations;
let routeDistances = ROUTES['Mumbai - New Delhi'].distances;
let stationIndex = 0; 
let nextStationDist = routeDistances[1]; 
let currentStationName = stationNames[0];
let currentStationGroup = null;
const STATION_LENGTH = 9000;

let isAtStation = true;
let stationWaitTimer = 0;
let starterSignalReleased = false;
let isInGhat = false;
let mountainGraphics = null;
let lastMountainX = 0;

let guardPopup = null;       
let guardMsgTimer = 0;       
let guardTypeTimer = 0;      
let guardFullText = '';      
let guardDisplayText = '';   
let guardTextObj = null;     
const GUARD_MESSAGES = [
    "Guard to Driver: Signal OFF!\nLine clear — right away, Sir!",
    "Guard to Driver: Starter GREEN!\nAll clear from rear — proceed!",
    "Guard to Driver: Signal clear!\nPassengers boarded. Right away!",
    "Guard to Driver: Line clear!\nGuard van secure — right away!",
];

const GUARD_SIGNAL_CLEAR_MESSAGES = [
    "Guard to Driver: Signal ahead\nhas cleared — line is free!",
    "Guard to Driver: Block cleared!\nSignal GREEN — you may proceed.",
    "Guard to Driver: All clear ahead!\nSignal has turned green.",
    "Guard to Driver: Preceding train\nhas cleared the block. Proceed!",
    "Guard to Driver: Signal OFF!\nLine clear — throttle up, Sir!",
];

let isPaused = false;
let menuGroup, menuBGGraphics;
let currentMenuState = 'MAIN'; 
let currentConsist = 'Rajdhani', currentLoco = 'WAP7', currentRoute = 'Mumbai - New Delhi';
let hornSound;
let routeSelectOpen = false; 
let startX = 10000; 

const TRAIN_PARAMS = {
    'Rajdhani': { scale: 0.32, coachSpacing: 350, locoSpacing: 330, lhb: 'lhb_red_ac3', eog: 'eog' },
    'Shatabdi': { scale: 0.32, coachSpacing: 350, locoSpacing: 330, lhb: 'lhb_blue', eog: 'eog_blue' }
};

const COACH_CATALOGUE = [
    { key: 'lhb_red_ac3',              label: 'LHB AC',        color: 0xCC2200, type: 'coach' },
    { key: 'lhb_blue',                 label: 'Wide Win CC',   color: 0x1A5276, type: 'coach' },
    { key: 'lhb_blue_acc',             label: 'LHB Blue ACC',  color: 0x1F618D, type: 'coach' },
    { key: 'lhb_deccanqueenvistadome', label: 'Vistadome',     color: 0x6A0DAD, type: 'coach' },
    { key: 'eog',                      label: 'EOG (Red)',     color: 0x8B0000, type: 'eog'   },
    { key: 'eog_blue',                 label: 'EOG (Blue)',    color: 0x154360, type: 'eog'   },
    { key: 'lhb_humsafar_ac3',         label: 'Humsafar AC3',  color: 0x6E2E0A, type: 'coach' },
    { key: 'lhb_shatabdi_grey_acc',    label: 'Grey ACC',      color: 0x7F8C8D, type: 'coach' },
    { key: 'lhb_humsafar_pantry',      label: 'Humsafar PC',   color: 0x8A3A0B, type: 'coach' },
    { key: 'shatabdi_grey_eog',        label: 'Grey EOG',      color: 0x34495E, type: 'eog'   },
    { key: 'humsafar_eog',             label: 'Humsafar EOG',  color: 0x5C2608, type: 'eog'   }
];

const LOCO_CATALOGUE = [
    { key: 'wap7', label: 'WAP-7', maxKmh: 130, maxSpeed: 25 },
    { key: 'wap5', label: 'WAP-5', maxKmh: 160, maxSpeed: 31 },
];

let customConsist = null;
let customLocoKey = 'wap7';
let consistBuilderOpen = false;
let consistBuilderGroup = null;
let consistPreviewCells = [];
let consistPaletteCards = []; 

let bpText, bcText, speedText, distanceLabel, stationLabel, throttleBar, bpBar, bcBar, notchText, ebrakeLight, headLightIndicator;
let bpNeedle, bcNeedle, signalNavCircle, signalNavText, speedLimitText, releaseButton, releaseText;
let speedNeedle, speedNeedleCap, currentSpeedAngle = -135;
let locoMaxKmh = 130;

let currentSpeedLimit = 130;
let upcomingSignalColor = 0x00ff00;
let secondSignalColor = 0x00ff00; 
let nextRedSignalDist = -1;       
let nextRedSignalLabel = null;    

const GLOBAL_SCALE = 0.32, TRACK_Y = 500, TOTAL_UNITS = 24;
const REALISTIC_POLE_HEIGHT = 160, REALISTIC_SIGNAL_BOX_HEIGHT = 60, REALISTIC_LENS_RADIUS = 6;
const DEPTH_SKY = 0, DEPTH_WORLD = 10, DEPTH_UI_BG = 50000, DEPTH_CAB_DETAILS = 50005, DEPTH_GAUGE = 50010, DEPTH_TEXT = 50015, DEPTH_MENU = 70000;

function preload() {
    this.load.image('wap7', 'assets/wap7.png');
    this.load.image('wap5', 'assets/wap5.png');
    this.load.image('lhb_red_ac3', 'assets/lhb_red_ac3.png');
    this.load.image('lhb_blue', 'assets/lhb_blue.png');
    this.load.image('lhb_blue_acc', 'assets/lhb_blue_acc.png'); 
    this.load.image('eog', 'assets/eog.png');
    this.load.image('lhb_deccanqueenvistadome', 'assets/lhb_deccanqueenvistadome.png');
    this.load.image('eog_blue', 'assets/eog_blue.png');
    this.load.image('pole', 'assets/ohe_pole.png'); 
    this.load.image('lhb_humsafar_ac3', 'assets/lhb_humsafar_ac3.png');
    this.load.image('lhb_shatabdi_grey_acc', 'assets/lhb_shatabdi_grey_acc.png');
    this.load.image('shatabdi_grey_eog', 'assets/shatabdi_grey_eog.png');
    this.load.image('humsafar_eog', 'assets/humsafar_eog.png');
    this.load.image('lhb_humsafar_pantry', 'assets/lhb_humsafar_pantry.png');
    this.load.audio('horn', 'assets/horn.mp3');
}

function create() {
    this.game.events.off('blur');
    gameScene = this;
    lastPoleX = startX - 8700; lastSignalX = startX; lastTrackX = startX - 10000;
    hornSound = this.sound.add('horn');

    skyGraphics = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_SKY);
    mountainGraphics = this.add.graphics().setDepth(DEPTH_SKY + 1);
    tracks = this.add.group();

    for (let tx = startX - 10000; tx <= startX + 2000; tx += TRACK_TILE_WIDTH) {
        spawnTrackSegment(this, tx);
        lastTrackX = tx;
    }
    train = this.physics.add.sprite(startX, TRACK_Y, 'wap7').setScale(GLOBAL_SCALE).setDepth(30).setOrigin(0.5, 1);
    headlightBeams = this.add.graphics().setDepth(35);
    cameraDolly = this.add.image(train.x + relativeX, train.y, null).setVisible(false);
    
    coaches = this.add.group();
    updateTrainRake(this); 

    let hudBar = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI_BG);
    hudBar.fillStyle(0x0A0A0B, 0.95);
    hudBar.fillRect(0, 0, 1200, 110);
    hudBar.fillStyle(0xFF6B00, 1);
    hudBar.fillRect(0, 108, 1200, 2);
    hudBar.fillStyle(0xFF6B00, 1);
    hudBar.fillRect(0, 0, 90, 110);
    hudBar.lineStyle(1, 0xffffff, 0.06);
    hudBar.strokeLineShape(new Phaser.Geom.Line(700, 10, 700, 100));
    hudBar.strokeLineShape(new Phaser.Geom.Line(850, 10, 850, 100));
    hudBar.strokeLineShape(new Phaser.Geom.Line(990, 10, 990, 100));
    
    let pauseBtn = this.add.rectangle(45, 55, 50, 50, 0x000000, 0).setInteractive({useHandCursor:true}).setScrollFactor(0).setDepth(DEPTH_GAUGE);
    this.add.text(45, 52, '〓', { fontSize: '26px', fill: '#fff', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
    pauseBtn.on('pointerdown', () => toggleMenu(this));

    this.add.text(130, 28, 'NEXT STATION', { fontSize: '10px', fill: '#FF6B00', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 3 }).setScrollFactor(0).setDepth(DEPTH_TEXT);
    stationLabel = this.add.text(130, 50, 'SURAT', { fontSize: '28px', fill: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold' }).setScrollFactor(0).setDepth(DEPTH_TEXT);
    this.add.text(130, 83, 'DISTANCE', { fontSize: '10px', fill: '#888', fontFamily: 'monospace', letterSpacing: 2 }).setScrollFactor(0).setDepth(DEPTH_TEXT);
    distanceLabel = this.add.text(280, 83, nextStationDist + 'm', { fontSize: '14px', fill: '#ffcc00', fontFamily: 'monospace', fontWeight: 'bold' }).setScrollFactor(0).setDepth(DEPTH_TEXT);

    this.add.text(718, 18, 'NEXT SIGNAL', { fontSize: '10px', fill: '#888', fontFamily: 'monospace', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
    signalNavCircle = this.add.circle(718, 60, 14, 0x00ff00).setScrollFactor(0).setDepth(DEPTH_TEXT);
    this.add.circle(718, 60, 18, 0x000000, 0).setStrokeStyle(1, 0xffffff, 0.1).setScrollFactor(0).setDepth(DEPTH_TEXT);
    signalNavText = this.add.text(718, 86, 'NEXT SIGNAL', { fontSize: '1px', fill: '#000' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT); 

    this.add.text(920, 18, 'NEXT RED', { fontSize: '10px', fill: '#888', fontFamily: 'monospace', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
    nextRedSignalLabel = this.add.text(920, 60, '----', { fontSize: '20px', fill: '#ff4444', fontWeight: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);

    this.add.text(1095, 18, 'SPEED LIMIT', { fontSize: '10px', fill: '#888', fontFamily: 'monospace', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
    speedLimitText = this.add.text(1095, 65, '130 km/h', { fontSize: '22px', fill: '#00ff88', align: 'center', fontWeight: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);

    loopWarningText = this.add.text(600, 130, '', { fontSize: '14px', fill: '#ffcc00', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#1a1500', padding: { x: 14, y: 6 } }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT).setVisible(false);

    const dashY = 700;
    let dashPanel = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI_BG);
    dashPanel.fillStyle(0x0D0D0F, 1);
    dashPanel.fillRoundedRect(10, dashY - 100, 1180, 200, 12);
    dashPanel.fillStyle(0xFF6B00, 1);
    dashPanel.fillRoundedRect(10, dashY - 100, 1180, 3, { tl: 12, tr: 12, bl: 0, br: 0 });
    dashPanel.lineStyle(1, 0xffffff, 0.06);
    dashPanel.strokeRoundedRect(10, dashY - 100, 1180, 200, 12);

    let cabGraphics = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_CAB_DETAILS);
    cabGraphics.lineStyle(1, 0xffffff, 0.06);
    [230, 490, 680, 1060].forEach(x => cabGraphics.strokeLineShape(new Phaser.Geom.Line(x, dashY - 95, x, dashY + 95)));
    cabGraphics.lineStyle(1, 0xFF6B00, 0.12);
    cabGraphics.strokeRoundedRect(250, dashY - 82, 120, 62, 4);
    cabGraphics.strokeRoundedRect(420, dashY + 28, 100, 52, 4);

    clockText = this.add.text(350, dashY, '12:00', { fontSize: '28px', fill: '#FF6B00', fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);

    cabGraphics.fillStyle(0xFF6B00, 0.4);
    [30, 1170].forEach(x => { cabGraphics.fillCircle(x, dashY - 85, 3); cabGraphics.fillCircle(x, dashY + 85, 3); });

    this.add.circle(600, dashY, 85, 0x080808).setStrokeStyle(3, 0xFF6B00, 0.5).setScrollFactor(0).setDepth(DEPTH_GAUGE);
    this.add.circle(600, dashY, 75, 0x000000, 0).setStrokeStyle(1, 0xffffff, 0.05).setScrollFactor(0).setDepth(DEPTH_GAUGE);
    for (let i = -135; i <= 135; i += 22.5) {
        let rad = Phaser.Math.DegToRad(i - 90);
        let x1 = 600 + Math.cos(rad) * 70; let y1 = dashY + Math.sin(rad) * 70;
        let x2 = 600 + Math.cos(rad) * 80; let y2 = dashY + Math.sin(rad) * 80;
        this.add.line(0, 0, x1, y1, x2, y2, 0x444444).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_GAUGE + 1);
    }
    speedText = this.add.text(600, dashY + 25, '0', { fontSize: '40px', fill: '#fff', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
    this.add.text(600, dashY + 55, 'km/h', { fontSize: '14px', fill: '#aaa' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);

    const speedLabels = [0, 20, 40, 60, 80, 100, 120];
    speedLabels.forEach(kmh => {
        let frac = kmh / 130;
        let angleDeg = -135 + frac * 270;
        let rad = Phaser.Math.DegToRad(angleDeg - 90);
        let lx = 600 + Math.cos(rad) * 58;
        let ly = dashY + Math.sin(rad) * 58;
        this.add.text(lx, ly, '' + kmh, { fontSize: '10px', fill: '#888' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_GAUGE + 1);
    });

    let redG = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_GAUGE + 1);
    for (let kmh = 120; kmh <= 130; kmh += 2) {
        let frac = kmh / 130;
        let angleDeg = -135 + frac * 270;
        let rad = Phaser.Math.DegToRad(angleDeg - 90);
        let x1 = 600 + Math.cos(rad) * 70; let y1 = dashY + Math.sin(rad) * 70;
        let x2 = 600 + Math.cos(rad) * 80; let y2 = dashY + Math.sin(rad) * 80;
        redG.lineStyle(2, 0xff2200, 1).beginPath().moveTo(x1, y1).lineTo(x2, y2).strokePath();
    }

    speedNeedle = this.add.rectangle(600, dashY, 3, 68, 0xff4422).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH_TEXT + 1).setAngle(-135);
    speedNeedleCap = this.add.circle(600, dashY, 9, 0xcccccc).setStrokeStyle(2, 0x888888).setScrollFactor(0).setDepth(DEPTH_TEXT + 2);

    const createCircularGauge = (x, y, label, color) => {
        this.add.circle(x, y, 45, 0x111111).setStrokeStyle(3, 0x555555).setScrollFactor(0).setDepth(DEPTH_GAUGE);
        for (let i = -135; i <= 135; i += 45) {
            let rad = Phaser.Math.DegToRad(i - 90);
            let x1 = x + Math.cos(rad) * 35; let y1 = y + Math.sin(rad) * 35;
            let x2 = x + Math.cos(rad) * 42; let y2 = y + Math.sin(rad) * 42;
            this.add.line(0, 0, x1, y1, x2, y2, 0x444444).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_GAUGE + 1);
        }
        this.add.text(x, y - 30, label, { fontSize: '12px', fill: '#aaa' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
        let valText = this.add.text(x, y + 25, '0.0', { fontSize: '16px', fill: color, fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
        let needle = this.add.rectangle(x, y, 2, 35, color).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH_TEXT);
        return { text: valText, needle: needle };
    };

    let bpG = createCircularGauge(120, dashY - 45, 'BP', 0x00ff00); bpText = bpG.text; bpNeedle = bpG.needle;
    let bcG = createCircularGauge(120, dashY + 45, 'BC', 0xff3333); bcText = bcG.text; bcNeedle = bcG.needle;
    ebrakeLight = this.add.circle(535, dashY - 60, 12, 0xff0000).setScrollFactor(0).setDepth(DEPTH_TEXT).setAlpha(0);
    this.add.circle(535, dashY - 60, 12, 0x000000).setStrokeStyle(2, 0x888888).setScrollFactor(0).setDepth(DEPTH_TEXT - 1);
    this.add.text(535, dashY - 35, 'E/B', { fontSize: '10px', fill: '#ff6666', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);

    const barsX = 1100;
    throttleBar = this.add.rectangle(barsX - 40, dashY + 60, 20, 0, 0x3498db).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH_GAUGE);
    notchText = this.add.text(barsX - 40, dashY - 80, 'N: 0', {fontSize:'14px', fill:'#3498db'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
    bpBar = this.add.rectangle(barsX, dashY - 60, 20, 0, 0x00ff00).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH_GAUGE);
    bcBar = this.add.rectangle(barsX + 40, dashY + 60, 20, 0, 0xee0000).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH_GAUGE);

    const btnX = 760; 
    const createBtn = (x, y, sym, label, col, cb) => {
        let b = this.add.circle(x, y, 28, col).setInteractive({useHandCursor:true}).setScrollFactor(0).setDepth(DEPTH_GAUGE);
        b.setStrokeStyle(3, 0xffffff, 0.5); 
        this.add.text(x, y, sym, {fontSize:'22px'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
        this.add.text(x, y + 45, label, {fontSize:'10px', fill:'#DCDCDC', fontWeight:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);
        b.on('pointerdown', cb); return b;
    };

    createBtn(btnX, dashY, '📯', 'HORN', 0xFFD700, () => { if(hornSound) hornSound.play(); }); 
    createBtn(btnX + 65, dashY, '🚨', 'TRIP', 0xDC143C, () => { isEBrakeActive = true; }); 
    createBtn(btnX + 130, dashY, '💡', 'LIGHTS', 0x00FFFF, () => { areHeadlightsOn = !areHeadlightsOn; headLightIndicator.setText(areHeadlightsOn ? 'ON' : 'OFF'); headLightIndicator.setFill(areHeadlightsOn ? '#00FFFF' : '#ff0000'); });
    createBtn(btnX + 195, dashY, '🎥', 'FRONT', 0x00C957, () => { relativeX = 300; }); 
    createBtn(btnX + 260, dashY, '🔚', 'REAR', 0x8A2BE2, () => { relativeX = -8600; }); 
    headLightIndicator = this.add.text(btnX + 130, dashY + 58, 'OFF', {fontSize: '9px', fill:'#ff0000', fontWeight: 'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT);

    releaseButton = this.add.rectangle(600, dashY - 145, 200, 45, 0x2ecc71).setInteractive({useHandCursor:true}).setScrollFactor(0).setDepth(DEPTH_TEXT).setVisible(false);
    releaseText = this.add.text(600, dashY - 145, 'RELEASE E/B', { fontSize: '20px', fill: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TEXT + 1).setVisible(false);
    releaseButton.on('pointerdown', () => { 
        isEBrakeActive = false; canReleaseEBrake = false; releaseButton.setVisible(false); releaseText.setVisible(false); 
        brakePercent = 0; throttlePercent = 0;
        postEBGrace = true; 
    });

    menuGroup = this.add.group();
    let menuOverlay = this.add.rectangle(600, 400, 1200, 800, 0x000000, 0.88).setScrollFactor(0).setDepth(DEPTH_MENU);
    menuBGGraphics = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_MENU + 1);
    menuBGGraphics.fillStyle(0x0D0D0F, 1).fillRoundedRect(420, 160, 360, 480, 8);
    menuBGGraphics.lineStyle(1, 0xffffff, 0.08).strokeRoundedRect(420, 160, 360, 480, 8);
    menuBGGraphics.fillStyle(0xFF6B00, 1).fillRoundedRect(420, 160, 360, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
    menuGroup.add(menuOverlay);
    menuGroup.getChildren().forEach(c => c.setVisible(false));
    menuBGGraphics.setVisible(false);

    this.input.on('pointermove', (p) => { if (p.rightButtonDown() && !isPaused) { relativeX += (p.prevPosition.x - p.x) * 1.5; relativeX = Phaser.Math.Clamp(relativeX, -10000, 600); } });
    this.cameras.main.startFollow(cameraDolly, true, 1, 1);
    this.input.mouse.disableContextMenu();
    keyUp = this.input.keyboard.addKey('UP'); keyDown = this.input.keyboard.addKey('DOWN'); keyC = this.input.keyboard.addKey('C'); keyE = this.input.keyboard.addKey('E');
    ohePoles = this.physics.add.group(); signals = this.physics.add.group();

    this.physics.pause();
    routeSelectOpen = true;
    showRouteSelector(this);
}

function update(time, delta) {
    cameraDolly.x = train.x + relativeX; cameraDolly.y = train.y;
    if (isPaused || routeSelectOpen) return;

    let now = new Date();
    let hh = now.getHours(), mm = now.getMinutes(), ss = now.getSeconds();
    clockText.setText(
        (hh < 10 ? '0' : '') + hh + ':' +
        (mm < 10 ? '0' : '') + mm + ':' +
        (ss < 10 ? '0' : '') + ss
    );
    let realHour = hh + mm / 60;
    dayTime = realHour * 100; 
    
    skyGraphics.clear();
    let topColor, bottomColor;
    if (dayTime > 600 && dayTime < 1600) { topColor = 0x87CEEB; bottomColor = 0xB0E0E6; }
    else if (dayTime >= 1600 && dayTime <= 1900) { topColor = 0x4B0082; bottomColor = 0xFF4500; }
    else if (dayTime > 1900 || dayTime < 500) { topColor = 0x000011; bottomColor = 0x000033; }
    else { topColor = 0x000033; bottomColor = 0x87CEEB; }
    skyGraphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    skyGraphics.fillRect(0, 0, 1200, TRACK_Y);

    let activeRoute = ROUTES[currentRoute];
    if (activeRoute.ghatBetween) {
        let [gFrom, gTo] = activeRoute.ghatBetween;
        isInGhat = (stationIndex === gFrom && nextStationDist > 0);
    } else {
        isInGhat = false;
    }

    mountainGraphics.clear();
    if (isInGhat) {
        let ridges = [
            { yBase: TRACK_Y - 60,  color: 0x4a6741, peaks: 6, height: 260, seed: 0 },
            { yBase: TRACK_Y - 120, color: 0x3a5233, peaks: 5, height: 200, seed: 1337 },
            { yBase: TRACK_Y - 180, color: 0x2d3e28, peaks: 4, height: 160, seed: 2674 },
        ];
        ridges.forEach(ridge => {
            mountainGraphics.fillStyle(ridge.color, 1);
            mountainGraphics.beginPath();
            let step = 280;
            let startI = Math.floor((train.x - ridge.seed) / step) - 1;
            mountainGraphics.moveTo(0, ridge.yBase);
            for (let i = startI; i < startI + 7; i++) {
                let bx = (i * step + ridge.seed) - train.x + 600; 
                let peakH = ridge.height * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.618 + ridge.seed)));
                let nextBx = bx + step;
                mountainGraphics.lineTo(bx, ridge.yBase);
                mountainGraphics.lineTo(bx + step * 0.35, ridge.yBase - peakH);
                mountainGraphics.lineTo(nextBx, ridge.yBase);
            }
            mountainGraphics.lineTo(1200, ridge.yBase);
            mountainGraphics.lineTo(1200, TRACK_Y + 50);
            mountainGraphics.lineTo(0, TRACK_Y + 50);
            mountainGraphics.closePath();
            mountainGraphics.fillPath();

            if (ridge.seed === 2674) {
                mountainGraphics.fillStyle(0xeeeeff, 0.7);
                for (let i = startI; i < startI + 7; i++) {
                    let bx = (i * step + ridge.seed) - train.x + 600;
                    let peakH = ridge.height * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.618 + ridge.seed)));
                    if (peakH > 130) {
                        mountainGraphics.beginPath();
                        mountainGraphics.moveTo(bx + step * 0.35, ridge.yBase - peakH);
                        mountainGraphics.lineTo(bx + step * 0.27, ridge.yBase - peakH + 40);
                        mountainGraphics.lineTo(bx + step * 0.43, ridge.yBase - peakH + 40);
                        mountainGraphics.closePath();
                        mountainGraphics.fillPath();
                    }
                }
            }
        });
        mountainGraphics.fillStyle(0x222222, 0.6);
        mountainGraphics.fillRect(0, TRACK_Y - 55, 1200, 55);
    }

    headlightBeams.clear();
    if (areHeadlightsOn) {
        headlightBeams.fillStyle(0xffffcc, (dayTime > 1800 || dayTime < 600) ? 0.4 : 0.1);
        headlightBeams.beginPath();
        headlightBeams.moveTo(train.x + 180, TRACK_Y - 80);
        headlightBeams.lineTo(train.x + 600, TRACK_Y - 140);
        headlightBeams.lineTo(train.x + 600, TRACK_Y - 20);
        headlightBeams.closePath(); headlightBeams.fillPath();
    }

    if (train.x > lastTrackX) { spawnTrackSegment(this, lastTrackX + TRACK_TILE_WIDTH); lastTrackX += TRACK_TILE_WIDTH; }
    tracks.getChildren().forEach(t => { if (t.x < train.x - 12000) t.destroy(); });

    if (isAtStation && Math.floor(speed) === 0) {
        if (starterSignalReleased) { starterSignalReleased = false; upcomingSignalColor = 0xff0000; signalNavCircle.setFillStyle(0xff0000); }
        stationWaitTimer += delta;
        if (stationWaitTimer >= 15000) {
            starterSignalReleased = true;
            signals.getChildren().forEach(sig => {
                if (sig.getData('isStarter') && sig.getData('color') === 0xff0000) {
                    setSignalColor(sig, 0x00ff00);
                }
            });
            updateUpcomingSignalNav();
            showGuardMessage(this);
            stationWaitTimer = 0; 
        }
    }

    if (!isEBrakeActive) {
        if (Phaser.Input.Keyboard.JustDown(keyUp)) { throttlePercent = Math.min(throttlePercent + 10, 100); brakePercent = 0; }
        if (Phaser.Input.Keyboard.JustDown(keyDown)) { if (throttlePercent > 0) throttlePercent = Math.max(throttlePercent - 10, 0); else brakePercent = Math.min(brakePercent + 20, 100); }
    }
    if (isEBrakeActive || Phaser.Input.Keyboard.JustDown(keyE)) {
        isEBrakeActive = true; speed = Math.max(speed - 0.08, 0); 
        brakePipePressure = Phaser.Math.Linear(brakePipePressure, 0, 0.02);
        brakeCylinderPressure = Phaser.Math.Linear(brakeCylinderPressure, 5.0, 0.05);
        if (speed === 0 && !canReleaseEBrake) { stopTimer += delta; if (stopTimer >= 15000) { canReleaseEBrake = true; releaseButton.setVisible(true); releaseText.setVisible(true); stopTimer = 0; } }
    } else {
        let targetSpeed = (throttlePercent / 100) * maxSpeed;
        if (Math.abs(speed - targetSpeed) > 0.01) { if (speed < targetSpeed) speed += 0.015; else speed -= (brakePercent > 0) ? 0.05 : 0.005; }
        else speed = targetSpeed;
        brakePipePressure = Phaser.Math.Linear(brakePipePressure, 5.0, 0.02);
        brakeCylinderPressure = Phaser.Math.Linear(brakeCylinderPressure, (brakePercent/100)*5, 0.05);
    }
    bpNeedle.setAngle(-135 + (brakePipePressure / 5) * 270);
    bcNeedle.setAngle(-135 + (brakeCylinderPressure / 5) * 270);
    train.setVelocityX(speed * 60);
    let displayKmh = Math.floor((speed / maxSpeed) * locoMaxKmh);
    speedText.setText(displayKmh);
    let targetAngle = -135 + (displayKmh / locoMaxKmh) * 270;
    currentSpeedAngle = Phaser.Math.Linear(currentSpeedAngle, targetAngle, 0.06);
    speedNeedle.setAngle(currentSpeedAngle);
    if (displayKmh > currentSpeedLimit + 2) {
        speedLimitText.setAlpha(Math.sin(time / 150) > 0 ? 1 : 0.3);
    } else {
        speedLimitText.setAlpha(1);
    }
    bpText.setText(brakePipePressure.toFixed(1)); bcText.setText(brakeCylinderPressure.toFixed(1)); notchText.setText('N: ' + (throttlePercent / 10));
    ebrakeLight.setAlpha(isEBrakeActive ? (Math.sin(time / 200) > 0 ? 1 : 0.2) : 0);
    throttleBar.height = -(throttlePercent / 100) * 120; bpBar.height = (brakePipePressure / 5) * 120; bcBar.height = -(brakeCylinderPressure / 5) * 120;
    
    if (train.x > lastPoleX + POLE_SPACING) { lastPoleX += POLE_SPACING; ohePoles.create(lastPoleX + 1200, TRACK_Y, 'pole').setScale(0.58).setOrigin(0.5, 1).setDepth(15); }
    if (train.x > lastSignalX + SIGNAL_SPACING - SIGNAL_SPACING * 3) {
        lastSignalX += SIGNAL_SPACING;
        if (nextStationDist > 2000 || nextStationDist < -STATION_LENGTH) spawnSignal(this, lastSignalX + 1200);
    }

    signals.getChildren().forEach(sig => {
        if (!sig.active) return;
        let sigX = sig.x;
        if (train.x >= sigX && sigX > playerLastSignalX) {
            let colorBeforeCrossing = sig.getData('color');
            let newBlock = sig.getData('blockId');

            if (newBlock !== playerBlockId && (blockOccupancy[newBlock] || 0) === 0) {
                playerLastSignalX = sigX;
                if (playerBlockId >= 0) freeBlock(playerBlockId);
                playerBlockId = newBlock;
                occupyBlock(playerBlockId);
                refreshSignal(playerBlockId + 1);
            } else if (newBlock !== playerBlockId && (blockOccupancy[newBlock] || 0) > 0) {
                if (colorBeforeCrossing === 0xff0000 && !isEBrakeActive) {
                    isEBrakeActive = true; throttlePercent = 0;
                }
                return;
            } else {
                playerLastSignalX = sigX;
            }

            if (colorBeforeCrossing === 0xff0000 && !isEBrakeActive) {
                isEBrakeActive = true; throttlePercent = 0;
            }
        }
    });

    updateUpcomingSignalNav();

    if (playerOnLoop && loopMergeX > 0 && train.x > loopMergeX) {
        playerOnLoop = false;
        loopMergeX   = -1;
        train.y = TRACK_Y;
        coaches.getChildren().forEach(c => c.y = TRACK_Y);
        let currentBlock = playerBlockId >= 0 ? playerBlockId : Math.round(train.x / SIGNAL_SPACING);
        freeBlock(currentBlock);
        playerBlockId = -1;
        loopWarningText.setVisible(false);
        showGuardMessage(gameScene, 'signal_clear');
    }

    if (playerOnLoop) {
        train.y = Phaser.Math.Linear(train.y, TRACK_Y - RELIEF_TRACK_OFFSET, 0.05);
        coaches.getChildren().forEach(c => c.y = train.y);
    }

    if (!playerOnLoop && !isAtStation && speed < 0.5 && upcomingSignalColor === 0xff0000 && nextRedSignalDist > 0 && nextRedSignalDist < 2000) {
        deadlockTimer += delta;
        if (deadlockTimer >= DEADLOCK_TIMEOUT) {
            deadlockTimer = 0;
            playerOnLoop = true;
            loopMergeX = train.x + SIGNAL_SPACING * 1.5;
            if (playerBlockId >= 0) {
                freeBlock(playerBlockId);
                playerBlockId = -1;
                playerLastSignalX = train.x;
            }
            let currentBlock = Math.round(train.x / SIGNAL_SPACING);
            let blockedBlock = currentBlock + 1;
            for (let b = currentBlock; b <= currentBlock + 4; b++) {
                blockOccupancy[b] = 0; delete blockOccupancy[b];
            }
            let sigAhead = signals.getChildren()
                .filter(s => s.active && s.x > train.x)
                .sort((a, b) => a.x - b.x)[0];
            if (sigAhead) {
                setSignalColor(sigAhead, 0x00ff00);
                playerLastSignalX = sigAhead.x;
            }
            removeDistantMarker(blockedBlock);
            updateUpcomingSignalNav();
            isEBrakeActive   = false;
            canReleaseEBrake = false;
            postEBGrace      = true;
            releaseButton.setVisible(false);
            releaseText.setVisible(false);
            throttlePercent  = 0;
            brakePercent     = 0;
            loopWarningText.setText('⚠ LOOP DIVERSION — Signal cleared, proceed on loop').setVisible(true);
        }
    } else if (!playerOnLoop) {
        deadlockTimer = 0;
    }

    if (speed < 0.5 && (upcomingSignalColor === 0xff0000 || playerOnLoop)) {
        if (!signalWaitFired) {
            signalWaitTimer += delta;
            if (signalWaitTimer >= SIGNAL_WAIT_CLEAR) {
                signalWaitTimer = 0;
                signalWaitFired = true;
                for (let i = npcTrains.length - 1; i >= 0; i--) {
                    let npc = npcTrains[i];
                    if ((npc.direction === 1 || npc.direction === 2) && npc.loco.x > train.x) {
                        if (npc.blockId >= 0) freeBlock(npc.blockId);
                        npc.loco.destroy(); npc.coaches.forEach(c => c.destroy());
                        npcTrains.splice(i, 1);
                    }
                }
                let currentBlock = playerBlockId >= 0 ? playerBlockId : Math.round(train.x / SIGNAL_SPACING);
                for (let b = currentBlock + 1; b <= currentBlock + 8; b++) {
                    blockOccupancy[b] = 0; delete blockOccupancy[b];
                }
                signals.getChildren()
                    .filter(s => s.active && s.x > train.x && s.x < train.x + SIGNAL_SPACING * 9)
                    .forEach(s => setSignalColor(s, 0x00ff00));
                removeDistantMarker(currentBlock + 1);
                removeDistantMarker(currentBlock + 2);
                updateUpcomingSignalNav();
                showGuardMessage(gameScene, 'signal_clear');
            }
        }
    } else {
        signalWaitTimer = 0;
        signalWaitFired = false; 
    }

    npcSpawnTimer += delta;
    if (npcSpawnTimer > 45000 && speed > 0) {
        npcSpawnTimer = 0;
        let sameDirCount  = npcTrains.filter(n => n.direction ===  1).length;
        let oppDirCount   = npcTrains.filter(n => n.direction === -1).length;
        let behindCount   = npcTrains.filter(n => n.direction ===  2).length;
        if (oppDirCount  === 0) spawnNpcTrain(-1);
        if (sameDirCount === 0) spawnNpcTrain(1);  
        if (behindCount  === 0) spawnNpcTrain(2);  
    }

    if (guardMsgCooldown > 0) guardMsgCooldown -= delta;
    updateGuardMessage(delta);
    if (this.input.keyboard.checkDown(this.input.keyboard.addKey('SPACE'), 200) && guardPopup) {
        dismissGuardMessage();
    }

    updateNpcTrains(delta);

    updateDistantMarkerFlash(time);
    Object.entries(distantMarkers).forEach(([blockId, m]) => {
        if (m.container.x < train.x - 15000) {
            m.container.destroy();
            delete distantMarkers[blockId];
        }
    });

    let prevLimitLabel = currentSpeedLimit;

    if (postEBGrace && upcomingSignalColor !== 0xff0000) postEBGrace = false;

    if (isAtStation || (nextStationDist > 0 && nextStationDist < 1500)) {
        currentSpeedLimit = 30;
    } else if (nextStationDist > 0 && nextStationDist < 4000) {
        currentSpeedLimit = 60;
    } else if (isInGhat) {
        let ghatMax = activeRoute.ghatSpeedLimit || 45;
        if      (upcomingSignalColor === 0xff0000) currentSpeedLimit = postEBGrace ? 15 : 0;
        else if (nextRedSignalDist > 0 && nextRedSignalDist < 4000) currentSpeedLimit = Math.min(ghatMax, 30);
        else    currentSpeedLimit = ghatMax;
    } else if (upcomingSignalColor === 0xff0000) {
        currentSpeedLimit = postEBGrace ? 15 : 0;
    } else if (nextRedSignalDist > 0) {
        if      (nextRedSignalDist < 800)  currentSpeedLimit = 0;
        else if (nextRedSignalDist < 2000) currentSpeedLimit = 30;
        else if (nextRedSignalDist < 4000) currentSpeedLimit = 60;
        else if (nextRedSignalDist < 6500) currentSpeedLimit = 75;
        else if (nextRedSignalDist < 9000) currentSpeedLimit = 100;
        else                               currentSpeedLimit = locoMaxKmh;
    } else {
        currentSpeedLimit = locoMaxKmh;
    }

    if (currentSpeedLimit !== prevLimitLabel) {
        let col;
        if      (currentSpeedLimit === 0)       col = '#ff2222';
        else if (currentSpeedLimit <= 15)        col = '#ff5500';
        else if (currentSpeedLimit <= 30)        col = '#ff4444';
        else if (currentSpeedLimit <= 60)        col = '#ffaa00';
        else if (currentSpeedLimit <= 75)        col = '#ffcc00';
        else if (currentSpeedLimit <= 100)       col = '#ff8800';
        else                                     col = '#00ff88';
        speedLimitText.setText(currentSpeedLimit === 0 ? 'STOP' : currentSpeedLimit + ' km/h').setFill(col);
    }
    
    if (speed > 0) {
        nextStationDist -= (speed * 0.1);
        if (nextStationDist <= 0 && !currentStationGroup) {
            currentStationGroup = spawnStation(this, train.x + 1500);
            spawnSignal(this, train.x + 1500 + STATION_LENGTH, 0xff0000, true); 
            isAtStation = true; stationWaitTimer = 0;
        }
        if (currentStationGroup) {
            let plat = currentStationGroup.getChildren()[currentStationGroup.getLength()-1];
            if (train.x > plat.x + STATION_LENGTH + 2000) { 
                currentStationGroup.clear(true, true); 
                currentStationGroup = null; 
                
                // Logic to increment or decrement station based on travel direction
                if (train.flipX) {
                    stationIndex = (stationIndex - 1 + stationNames.length) % stationNames.length;
                    // For reverse direction, the distance is from the current station to the previous one
                    nextStationDist = routeDistances[stationIndex + 1] + (Math.random() * 2000 - 1000);
                } else {
                    stationIndex = (stationIndex + 1) % stationNames.length;
                    nextStationDist = routeDistances[stationIndex] + (Math.random() * 2000 - 1000);
                }

                currentStationName = stationNames[stationIndex];
                stationLabel.setText(currentStationName); 
                isAtStation = false; 
                saveProgress(currentRoute, stationIndex, nextStationDist);
            }
        }
    }
    distanceLabel.setText(Math.max(0, Math.floor(nextStationDist)) + 'm');
    let coachList = coaches.getChildren();
    coachList.forEach((u, i) => {
        u.x = (i === 0) ? train.x - (train.flipX ? -350 : 350) : coachList[i - 1].x - (train.flipX ? -350 : 350);
        u.y = train.y;
    });
}

function spawnSignal(scene, x, colorOverride = null, isStarter = false) {
    let rand = Math.random();
    let colorHex = (rand > 0.9) ? 0xff0000 : (rand > 0.7 ? 0xffff00 : 0x00ff00);
    if (colorOverride) colorHex = colorOverride;

    let sc = scene.add.container(x, TRACK_Y).setDepth(14);
    sc.add(scene.add.rectangle(0, 0, 8, REALISTIC_POLE_HEIGHT, 0x333333).setOrigin(0.5, 1));
    sc.add(scene.add.rectangle(0, -REALISTIC_POLE_HEIGHT, 25, REALISTIC_SIGNAL_BOX_HEIGHT, 0x000000).setOrigin(0.5, 0));
    const by = -REALISTIC_POLE_HEIGHT;

    let rLens = scene.add.circle(0, by + 12, REALISTIC_LENS_RADIUS, 0x330000);
    let yLens = scene.add.circle(0, by + 30, REALISTIC_LENS_RADIUS, 0x333300);
    let gLens = scene.add.circle(0, by + 48, REALISTIC_LENS_RADIUS, 0x003300);
    sc.add([rLens, yLens, gLens]);

    if (colorHex === 0xff0000) { rLens.setFillStyle(0xff0000); rLens.setStrokeStyle(2, 0xffffff); }
    else if (colorHex === 0xffff00) { yLens.setFillStyle(0xffff00); yLens.setStrokeStyle(2, 0xffffff); }
    else { gLens.setFillStyle(0x00ff00); gLens.setStrokeStyle(2, 0xffffff); }

    let blockId = Math.round(x / SIGNAL_SPACING);
    let sig = signals.create(x, TRACK_Y, null)
        .setData('color', colorHex)
        .setData('isStarter', isStarter)
        .setData('container', sc)
        .setData('blockId', blockId)
        .setData('rLens', rLens)
        .setData('yLens', yLens)
        .setData('gLens', gLens)
        .setVisible(false);
    signalMap[blockId] = sig;

    if (colorHex === 0xff0000) {
        spawnDistantMarker(scene, x - DISTANT_MARKER_OFFSET, blockId);
    }

    updateUpcomingSignalNav();
}

function spawnStation(scene, x, nameOverride = null) {
    let name = nameOverride !== null ? nameOverride : currentStationName;
    let group = scene.add.group();

    let plat = scene.add.rectangle(x, TRACK_Y, STATION_LENGTH, 40, 0x888880).setOrigin(0, 1).setDepth(5);
    group.add(scene.add.rectangle(x, TRACK_Y - 40, STATION_LENGTH, 6, 0xffff88).setOrigin(0, 1).setDepth(6));
    for (let i = 0; i < STATION_LENGTH; i += 400)
        group.add(scene.add.rectangle(x + i + 80, TRACK_Y - 40, 12, 200, 0x555555).setOrigin(0.5, 1).setDepth(6));
    group.add(scene.add.rectangle(x, TRACK_Y - 238, STATION_LENGTH, 18, 0x8B4513).setOrigin(0, 1).setDepth(7));
    group.add(scene.add.rectangle(x, TRACK_Y - 240, STATION_LENGTH, 4, 0xcc6600).setOrigin(0, 1).setDepth(7));

    let bldX = x + 600;   
    let bldY = TRACK_Y - 240; 
    let bld = scene.add.graphics().setDepth(8);

    bld.fillStyle(0x8B3A2A, 1);
    bld.fillRect(bldX, bldY - 220, 700, 220);

    bld.lineStyle(1, 0x6B2A1A, 0.35);
    for (let row = 0; row < 220; row += 14) bld.strokeLineShape(new Phaser.Geom.Line(bldX, bldY - row, bldX + 700, bldY - row));

    bld.fillStyle(0x9B4A3A, 1);
    bld.fillRect(bldX + 220, bldY - 310, 260, 310);

    bld.fillStyle(0x7B2A1A, 1);
    for (let cx = bldX + 225; cx < bldX + 475; cx += 30) bld.fillRect(cx, bldY - 330, 18, 25);

    for (let cx = bldX + 5; cx < bldX + 215; cx += 24) bld.fillRect(cx, bldY - 240, 14, 20);
    for (let cx = bldX + 485; cx < bldX + 695; cx += 24) bld.fillRect(cx, bldY - 240, 14, 20);

    bld.fillStyle(0x6B2A1A, 1);
    bld.fillRect(bldX + 305, bldY - 410, 90, 100);
    bld.fillStyle(0x5A1A0A, 1);
    bld.fillTriangle(bldX + 305, bldY - 410, bldX + 395, bldY - 410, bldX + 350, bldY - 450);

    bld.fillStyle(0xffffee, 1);
    bld.fillCircle(bldX + 350, bldY - 370, 28);
    bld.lineStyle(2, 0x333333, 1);
    bld.strokeCircle(bldX + 350, bldY - 370, 28);
    bld.lineStyle(3, 0x222222, 1);
    bld.strokeLineShape(new Phaser.Geom.Line(bldX + 350, bldY - 370, bldX + 350, bldY - 395));
    bld.strokeLineShape(new Phaser.Geom.Line(bldX + 350, bldY - 370, bldX + 362, bldY - 358));

    const drawArch = (ax, ay, w, h) => {
        bld.fillStyle(0x88ccee, 0.8);
        bld.fillRect(ax, ay, w, h);
        bld.fillEllipse(ax + w / 2, ay, w, w); 
        bld.lineStyle(2, 0x444422, 1);
        bld.strokeRect(ax, ay, w, h);
    };
    [bldX + 30, bldX + 110, bldX + 170].forEach(wx => drawArch(wx, bldY - 190, 40, 80));
    [bldX + 490, bldX + 560, bldX + 630].forEach(wx => drawArch(wx, bldY - 190, 40, 80));
    [bldX + 245, bldX + 420].forEach(wx => drawArch(wx, bldY - 280, 50, 110));

    bld.fillStyle(0x331100, 1);
    bld.fillRect(bldX + 320, bldY - 100, 60, 100);
    bld.fillEllipse(bldX + 350, bldY - 100, 60, 60);
    bld.lineStyle(3, 0xaa6633, 1);
    bld.strokeRect(bldX + 320, bldY - 100, 60, 100);

    bld.fillStyle(0xf1c40f, 1);
    bld.fillRect(bldX + 270, bldY - 130, 160, 22);
    group.add(scene.add.text(bldX + 350, bldY - 119, 'INDIAN RAILWAYS', {
        fontSize: '10px', fill: '#000', fontWeight: 'bold'
    }).setOrigin(0.5).setDepth(9));

    group.add(bld);

    group.add(scene.add.rectangle(x + 300, TRACK_Y - 80, 480, 50, 0x003366).setOrigin(0.5, 0.5).setDepth(9).setStrokeStyle(3, 0xffcc00));
    group.add(scene.add.text(x + 300, TRACK_Y - 80, name, {
        fontSize: '28px', fill: '#ffcc00', fontWeight: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(10));

    for (let i = 200; i < STATION_LENGTH - 200; i += 500) {
        let bx = x + i;
        group.add(scene.add.rectangle(bx, TRACK_Y - 55, 80, 8, 0x8B4513).setOrigin(0.5, 1).setDepth(7));
        group.add(scene.add.rectangle(bx - 28, TRACK_Y - 63, 8, 16, 0x5D2E0C).setOrigin(0.5, 1).setDepth(7));
        group.add(scene.add.rectangle(bx + 28, TRACK_Y - 63, 8, 16, 0x5D2E0C).setOrigin(0.5, 1).setDepth(7));
    }

    for (let i = 400; i < STATION_LENGTH; i += 900) {
        group.add(scene.add.rectangle(x + i, TRACK_Y - 41, 14, 22, 0x228B22).setOrigin(0.5, 1).setDepth(7));
    }

    group.add(plat);
    return group;
}

function spawnDistantMarker(scene, x, blockId) {
    if (distantMarkers[blockId]) return; 

    let container = scene.add.container(x, TRACK_Y).setDepth(13);

    container.add(scene.add.rectangle(0, 0, 6, 120, 0x888888).setOrigin(0.5, 1));

    let board = scene.add.graphics();
    board.fillStyle(0xff6600, 1);
    board.lineStyle(3, 0xffffff, 1);
    board.beginPath();
    board.moveTo(0, -145);   
    board.lineTo(18, -122);  
    board.lineTo(0, -100);   
    board.lineTo(-18, -122); 
    board.closePath();
    board.fillPath();
    board.strokePath();

    let label = scene.add.text(0, -122, '!', {
        fontSize: '18px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5);

    let strip = scene.add.rectangle(0, -82, 80, 18, 0xff6600).setOrigin(0.5);
    let stripText = scene.add.text(0, -82, 'CAUTION', {
        fontSize: '9px', fill: '#fff', fontWeight: 'bold'
    }).setOrigin(0.5);

    let flashLight = scene.add.circle(0, -168, 5, 0xff8800);
    flashLight.setStrokeStyle(1, 0xffffff);

    container.add([board, label, strip, stripText, flashLight]);

    let trackStripe = scene.add.rectangle(0, -2, 30, 10, 0xff6600).setOrigin(0.5, 1);
    container.add(trackStripe);

    distantMarkers[blockId] = { container, flashLight };
}

function removeDistantMarker(blockId) {
    if (distantMarkers[blockId]) {
        distantMarkers[blockId].container.destroy();
        delete distantMarkers[blockId];
    }
}

function updateDistantMarkerFlash(time) {
    Object.values(distantMarkers).forEach(m => {
        m.flashLight.setAlpha(Math.sin(time / 250) > 0 ? 1 : 0.1);
    });
}

function setSignalColor(sig, colorHex) {
    if (!sig || !sig.active) return;
    let prevColor = sig.getData('color');
    if (prevColor === colorHex) return;
    sig.setData('color', colorHex);

    let rLens = sig.getData('rLens');
    let yLens = sig.getData('yLens');
    let gLens = sig.getData('gLens');
    if (!rLens || !yLens || !gLens) return;

    rLens.setFillStyle(0x330000).setStrokeStyle(0);
    yLens.setFillStyle(0x333300).setStrokeStyle(0);
    gLens.setFillStyle(0x003300).setStrokeStyle(0);

    if (colorHex === 0xff0000)      { rLens.setFillStyle(0xff0000); rLens.setStrokeStyle(2, 0xffffff); }
    else if (colorHex === 0xffff00) { yLens.setFillStyle(0xffff00); yLens.setStrokeStyle(2, 0xffffff); }
    else                            { gLens.setFillStyle(0x00ff00); gLens.setStrokeStyle(2, 0xffffff); }

    let blockId = sig.getData('blockId');
    let sigX    = sig.x;
    if (colorHex === 0xff0000) {
        spawnDistantMarker(gameScene, sigX - DISTANT_MARKER_OFFSET, blockId);
    } else {
        removeDistantMarker(blockId);
    }

    if (prevColor === 0xff0000 && colorHex === 0x00ff00 && sigX > train.x) {
        showGuardMessage(gameScene, 'signal_clear');
    }

    updateUpcomingSignalNav();
}

function computeSignalColor(blockId) {
    if ((blockOccupancy[blockId] || 0) > 0)     return 0xff0000;
    if ((blockOccupancy[blockId + 1] || 0) > 0) return 0xffff00;
    return 0x00ff00;
}

function refreshSignal(blockId) {
    let sig = signalMap[blockId];
    if (sig) setSignalColor(sig, computeSignalColor(blockId));
}

function occupyBlock(blockId) {
    blockOccupancy[blockId] = (blockOccupancy[blockId] || 0) + 1;
    refreshSignal(blockId);       
    refreshSignal(blockId + 1);   
    refreshSignal(blockId - 1);   
    refreshSignal(blockId - 2);   
    updateUpcomingSignalNav();
}

function freeBlock(blockId) {
    if ((blockOccupancy[blockId] || 0) > 0) blockOccupancy[blockId]--;
    if (!blockOccupancy[blockId]) delete blockOccupancy[blockId];
    refreshSignal(blockId);       
    refreshSignal(blockId + 1);   
    refreshSignal(blockId - 1);   
    refreshSignal(blockId - 2);
    updateUpcomingSignalNav();
}

function updateUpcomingSignalNav() {
    let ahead = signals.getChildren()
        .filter(s => s.active && s.x > train.x)
        .sort((a, b) => a.x - b.x);

    let sig1 = ahead[0] || null;
    let sig2 = ahead[1] || null;

    upcomingSignalColor = sig1 ? sig1.getData('color') : 0x00ff00;
    secondSignalColor   = sig2 ? sig2.getData('color') : 0x00ff00;

    let navColor;
    if      (upcomingSignalColor === 0xff0000) navColor = 0xff0000;
    else if (upcomingSignalColor === 0xffff00) navColor = 0xffff00;
    else if (secondSignalColor === 0xff0000 || secondSignalColor === 0xffff00) navColor = 0xff8800;
    else navColor = 0x00ff00;
    signalNavCircle.setFillStyle(navColor);

    nextRedSignalDist = -1;
    let firstRed = ahead.find(s => s.getData('color') === 0xff0000);
    if (firstRed) {
        nextRedSignalDist = Math.floor(firstRed.x - train.x);
    }

    if (nextRedSignalDist > 0) {
        nextRedSignalLabel.setText(nextRedSignalDist + ' m').setFill(nextRedSignalDist < 3000 ? '#ff2222' : '#ff8888');
    } else {
        nextRedSignalLabel.setText('----').setFill('#555555');
    }
}

function spawnNpcTrain(direction) {
    const consists = ['Rajdhani', 'Shatabdi'];
    const locos = ['wap7', 'wap5'];
    let npcConsist = consists[Math.floor(Math.random() * consists.length)];
    let npcLoco   = locos[Math.floor(Math.random() * locos.length)];
    let params    = TRAIN_PARAMS[npcConsist];

    let spawnX, npcSpeed;
    let trackY = TRACK_Y;

    if (direction === 1) {
        let safeMin = train.x + SIGNAL_SPACING * 4;
        spawnX   = safeMin + Math.random() * SIGNAL_SPACING;
        npcSpeed = 18 + Math.random() * 6; 
        trackY   = TRACK_Y;
    } else if (direction === 2) {
        spawnX   = train.x - SIGNAL_SPACING * 2 - Math.random() * 3000;
        npcSpeed = 8 + Math.random() * 5; 
        trackY   = TRACK_Y;
    } else {
        spawnX   = train.x + 14000 + Math.random() * 4000;
        npcSpeed = -(14 + Math.random() * 6);
        trackY   = TRACK_Y;
    }

    let locoSprite = gameScene.add.sprite(spawnX, trackY, npcLoco)
        .setScale(GLOBAL_SCALE).setDepth(22).setOrigin(0.5, 1);
    if (direction === -1) locoSprite.setFlipX(true);

    let coachSprites = [];
    for (let i = 0; i < TOTAL_UNITS; i++) {
        let tex = (i === 0 || i === TOTAL_UNITS - 1) ? params.eog : params.lhb;
        let cx = (direction === -1)
            ? spawnX + params.locoSpacing + i * params.coachSpacing
            : spawnX - params.locoSpacing - i * params.coachSpacing;
        let c = gameScene.add.sprite(cx, trackY, tex)
            .setScale(GLOBAL_SCALE).setDepth(20).setOrigin(0.5, 1);
        if (direction === -1) c.setFlipX(true);
        coachSprites.push(c);
    }

    npcTrains.push({
        loco: locoSprite,
        coaches: coachSprites,
        speed: npcSpeed,
        maxSpeed: Math.abs(npcSpeed),
        direction: direction,
        blockId: -1,
        isLooped: false,
        loopStopX: Infinity,
        loopDone: false,
        lastSignalX: (direction === 1 || direction === 2) ? spawnX : Infinity,
        tailLastSignalX: (direction === 1 || direction === 2) ? spawnX : Infinity,
        locoSpacing: params.locoSpacing,
        coachSpacing: params.coachSpacing
    });
}

function updateNpcTrains(delta) {
    for (let i = npcTrains.length - 1; i >= 0; i--) {
        let npc = npcTrains[i];
        if (!npc.loco.active) { npcTrains.splice(i, 1); continue; }

        if (npc.direction === 1) {
            let redAhead = false;
            signals.getChildren().forEach(sig => {
                if (!sig.active) return;
                let dist = sig.x - npc.loco.x;
                if (dist > 0 && dist < 600 && computeSignalColor(sig.getData('blockId')) === 0xff0000) redAhead = true;
            });
            if (redAhead) npc.speed = Math.max(npc.speed - 0.2, 0);
            else          npc.speed = Math.min(npc.speed + 0.08, npc.maxSpeed);

            npc.loco.x += npc.speed;
            npc.coaches.forEach((c, ci) => {
                c.x = npc.loco.x - npc.locoSpacing - ci * npc.coachSpacing;
            });

            signals.getChildren().forEach(sig => {
                if (!sig.active) return;
                let sigX = sig.x;
                if (npc.loco.x >= sigX && sigX > npc.lastSignalX) {
                    npc.lastSignalX = sigX;
                    let newBlock = sig.getData('blockId');
                    if (newBlock !== npc.blockId) { npc.blockId = newBlock; occupyBlock(npc.blockId); }
                }
                let tail = npc.coaches.length > 0 ? npc.coaches[npc.coaches.length - 1].x : npc.loco.x;
                if (tail >= sigX && sigX > (npc.tailLastSignalX || -Infinity)) {
                    npc.tailLastSignalX = sigX;
                    let clearedBlock = sig.getData('blockId');
                    if (clearedBlock !== npc.blockId) freeBlock(clearedBlock);
                }
            });

            if (npc.loco.x < train.x - 15000 || npc.loco.x > train.x + 45000) {
                if (npc.blockId >= 0) freeBlock(npc.blockId);
                npc.loco.destroy(); npc.coaches.forEach(c => c.destroy());
                npcTrains.splice(i, 1);
            }
        } else if (npc.direction === 2) {
            let redAhead = false;
            signals.getChildren().forEach(sig => {
                if (!sig.active) return;
                let dist = sig.x - npc.loco.x;
                if (dist > 0 && dist < 600 && computeSignalColor(sig.getData('blockId')) === 0xff0000) redAhead = true;
            });
            let playerTailX = coaches.getChildren().length > 0
                ? coaches.getChildren()[coaches.getChildren().length - 1].x
                : train.x - 8500;
            let gap = playerTailX - npc.loco.x;
            if (redAhead || gap < 1200) npc.speed = Math.max(npc.speed - 0.15, 0);
            else if (gap > 3000)        npc.speed = Math.min(npc.speed + 0.05, npc.maxSpeed);

            npc.loco.x += npc.speed;
            npc.coaches.forEach((c, ci) => {
                c.x = npc.loco.x - npc.locoSpacing - ci * npc.coachSpacing;
            });

            signals.getChildren().forEach(sig => {
                if (!sig.active) return;
                let sigX = sig.x;
                if (npc.loco.x >= sigX && sigX > npc.lastSignalX) {
                    npc.lastSignalX = sigX;
                    let newBlock = sig.getData('blockId');
                    if (newBlock !== npc.blockId) { npc.blockId = newBlock; occupyBlock(npc.blockId); }
                }
                let tail = npc.coaches.length > 0 ? npc.coaches[npc.coaches.length - 1].x : npc.loco.x;
                if (tail >= sigX && sigX > (npc.tailLastSignalX || -Infinity)) {
                    npc.tailLastSignalX = sigX;
                    let clearedBlock = sig.getData('blockId');
                    if (clearedBlock !== npc.blockId) freeBlock(clearedBlock);
                }
            });

            if (npc.loco.x < train.x - 30000) {
                if (npc.blockId >= 0) freeBlock(npc.blockId);
                npc.loco.destroy(); npc.coaches.forEach(c => c.destroy());
                npcTrains.splice(i, 1);
            }
        } else {
            npc.loco.x += npc.speed;
            npc.coaches.forEach((c, ci) => {
                c.x = npc.loco.x + npc.locoSpacing + ci * npc.coachSpacing;
            });
            if (npc.loco.x < train.x - 20000) {
                npc.loco.destroy(); npc.coaches.forEach(c => c.destroy());
                npcTrains.splice(i, 1);
            }
        }
    }
}

function updateTrainRake(scene) {
    coaches.clear(true, true);
    const SCALE = 0.32;

    train.setScale(SCALE);
    train.setTexture(customLocoKey);

    let coachKeys;
    if (customConsist && customConsist.length > 0) {
        coachKeys = customConsist;
    } else {
        let params = TRAIN_PARAMS[currentConsist];
        coachKeys = [];
        for (let i = 1; i <= TOTAL_UNITS; i++) {
            coachKeys.push((i === 1 || i === TOTAL_UNITS) ? params.eog : params.lhb);
        }
    }

    for (let i = 0; i < coachKeys.length; i++) {
        coaches.add(scene.add.sprite(train.x, TRACK_Y, coachKeys[i])
            .setScale(SCALE).setDepth(20).setOrigin(0.5, 1));
    }
}

function toggleMenu(scene) {
    isPaused = !isPaused;
    if (isPaused) { scene.physics.pause(); currentMenuState = 'MAIN'; refreshMenuButtons(scene); } 
    else scene.physics.resume();
    menuGroup.getChildren().forEach(c => c.setVisible(isPaused));
    menuBGGraphics.setVisible(isPaused);
}

function refreshMenuButtons(scene) {
    let children = menuGroup.getChildren();
    for (let i = children.length - 1; i >= 1; i--) { children[i].destroy(); }
    const createMenuBtn = (y, text, color, cb) => {
        let b = scene.add.rectangle(600, y, 300, 52, 0x111116).setInteractive({useHandCursor:true}).setScrollFactor(0).setDepth(DEPTH_MENU + 2);
        b.setStrokeStyle(1, color, 0.7);
        let t = scene.add.text(600, y, text, { fontSize: '15px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 3);
        b.on('pointerover', () => { b.setFillStyle(color, 0.15); });
        b.on('pointerout',  () => { b.setFillStyle(0x111116, 1); });
        b.on('pointerdown', cb); menuGroup.add(b); menuGroup.add(t);
        let accent = scene.add.rectangle(452, y, 4, 52, color).setScrollFactor(0).setDepth(DEPTH_MENU + 3);
        menuGroup.add(accent);
    };
    let menuTitle = scene.add.text(600, 195, 'IR SIMULATOR', { fontSize: '13px', fill: '#FF6B00', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 3);
    menuGroup.add(menuTitle);
    if (currentMenuState === 'MAIN') {
        createMenuBtn(250, "CHANGE ROUTE", 0x2980b9, () => { currentMenuState = 'ROUTE'; refreshMenuButtons(scene); });
        createMenuBtn(320, "CUSTOM TRAIN", 0x8e44ad, () => { currentMenuState = 'CUSTOM'; refreshMenuButtons(scene); });
        createMenuBtn(390, "CHANGE TRAIN SET", 0xd35400, () => { currentMenuState = 'TRAIN_SET'; refreshMenuButtons(scene); });
        createMenuBtn(460, "RESUME", 0x27ae60, () => toggleMenu(scene));
        createMenuBtn(530, "🏠  HOME PAGE", 0x1a1a2e, () => { window.location.href = 'website_index.html'; });
    } else if (currentMenuState === 'CUSTOM') {
        createMenuBtn(280, "BUILD CUSTOM CONSIST", 0x16a085, () => { 
            toggleMenu(scene); 
            openConsistBuilder(scene); 
        });
        createMenuBtn(380, "SELECT LOCO", 0xf39c12, () => { currentMenuState = 'SELECT_LOCO'; refreshMenuButtons(scene); });
        createMenuBtn(500, "BACK", 0xc0392b, () => { currentMenuState = 'MAIN'; refreshMenuButtons(scene); });
    } else if (currentMenuState === 'TRAIN_SET') {
        createMenuBtn(280, "RAJDHANI", 0xc0392b, () => { currentConsist = 'Rajdhani'; updateTrainRake(scene); });
        createMenuBtn(380, "SHATABDI", 0x2980b9, () => { currentConsist = 'Shatabdi'; updateTrainRake(scene); });
        createMenuBtn(500, "BACK", 0x7f8c8d, () => { currentMenuState = 'MAIN'; refreshMenuButtons(scene); });
    } else if (currentMenuState === 'SELECT_LOCO') {
        createMenuBtn(280, "WAP-7  (130 km/h)", 0x2c3e50, () => { 
            currentLoco = 'WAP7'; 
            maxSpeed = 25; locoMaxKmh = 130;
            train.setTexture('wap7');
            speedLimitText.setText('130 km/h');
        });
        createMenuBtn(370, "WAP-5  (160 km/h)", 0x1a5276, () => { 
            currentLoco = 'WAP5'; 
            maxSpeed = 31; locoMaxKmh = 160;
            train.setTexture('wap5');
            speedLimitText.setText('160 km/h');
        });
        createMenuBtn(470, "BACK", 0x7f8c8d, () => { currentMenuState = 'CUSTOM'; refreshMenuButtons(scene); });
    } else if (currentMenuState === 'ROUTE') {
        const switchRoute = (routeKey) => {
            currentRoute = routeKey;
            let r = ROUTES[routeKey];
            stationNames    = r.stations;
            routeDistances  = r.distances;

            stationIndex = 0;
            nextStationDist = routeDistances[1];
            currentStationName = stationNames[0];
            train.setFlipX(false);
            
            saveProgress(routeKey, stationIndex, nextStationDist);

            if (currentStationGroup) { currentStationGroup.clear(true, true); currentStationGroup = null; }
            tracks.getChildren().forEach(t => t.destroy()); tracks.clear();
            ohePoles.getChildren().forEach(p => p.destroy()); ohePoles.clear();
            signals.getChildren().forEach(s => {
                let c = s.getData('container'); if (c) c.destroy();
                s.destroy();
            }); signals.clear(true, true);
            Object.values(distantMarkers).forEach(m => m.container.destroy());
            distantMarkers = {};
            signalMap = {};
            blockOccupancy = {};
            npcTrains.forEach(npc => { npc.loco.destroy(); npc.coaches.forEach(c => c.destroy()); });
            npcTrains = [];
            mountainGraphics.clear();
            if (guardPopup) { guardPopup.destroy(); guardPopup = null; }

            const newStartX = train.x + 20000; 
            train.x = newStartX; train.y = TRACK_Y;
            train.setVelocityX(0);
            updateTrainRake(scene);

            lastTrackX = newStartX - 10000;
            for (let tx = newStartX - 10000; tx <= newStartX + 2000; tx += TRACK_TILE_WIDTH) {
                spawnTrackSegment(scene, tx);
                lastTrackX = tx;
            }
            lastPoleX    = newStartX - 8700;
            lastSignalX  = newStartX;

            playerBlockId      = -1;
            playerLastSignalX  = -Infinity;
            npcSpawnTimer      = 0;

            currentStationGroup = spawnStation(scene, newStartX - 8700, stationNames[stationIndex]);
            spawnSignal(scene, newStartX + 800, 0xff0000, true);
            signalNavCircle.setFillStyle(0xff0000);
            upcomingSignalColor = 0xff0000;
            secondSignalColor   = 0xff0000;

            relativeX = train.flipX ? -8600 : 300;
            cameraDolly.x = newStartX + relativeX;
            cameraDolly.y = TRACK_Y;

            isAtStation          = true;
            stationWaitTimer     = 0;
            starterSignalReleased = false;
            isInGhat             = false;
            speed                = 0;
            throttlePercent      = 0;
            brakePercent         = 0;
            isEBrakeActive       = false;
            canReleaseEBrake     = false;
            postEBGrace          = false;
            currentSpeedLimit    = locoMaxKmh;
            releaseButton.setVisible(false);
            releaseText.setVisible(false);
            stationLabel.setText(currentStationName);
            distanceLabel.setText(Math.floor(nextStationDist) + 'm');
            speedLimitText.setText(locoMaxKmh + ' km/h').setFill('#00ff88');
            currentMenuState = 'MAIN';
            refreshMenuButtons(scene);
        };
        createMenuBtn(280, "MUMBAI ⇌ NEW DELHI", 0x27ae60, () => switchRoute(Math.random() < 0.5 ? 'Mumbai - New Delhi' : 'New Delhi - Mumbai'));
        createMenuBtn(350, "MUMBAI ⇌ PUNE", 0xe67e22, () => switchRoute(Math.random() < 0.5 ? 'Mumbai - Pune' : 'Pune - Mumbai'));
        createMenuBtn(420, "COIMBATORE ⇌ CHENNAI", 0x0E9F6E, () => switchRoute(Math.random() < 0.5 ? 'Coimbatore - Chennai' : 'Chennai - Coimbatore'));
        createMenuBtn(510, "BACK", 0xc0392b, () => { currentMenuState = 'MAIN'; refreshMenuButtons(scene); });
    }
}

// ===================== GUARD MESSAGE POPUP =====================

function showGuardMessage(scene, type = 'departure') {
    if (guardMsgCooldown > 0) return; 
    guardMsgCooldown = GUARD_MSG_COOLDOWN;

    let pool = type === 'signal_clear' ? GUARD_SIGNAL_CLEAR_MESSAGES : GUARD_MESSAGES;
    let msg = pool[Math.floor(Math.random() * pool.length)];
    guardFullText    = msg;
    guardDisplayText = '';
    guardMsgTimer    = 0;
    guardTypeTimer   = 0;

    let px = 980, py = 570;
    let container = scene.add.container(px, py).setScrollFactor(0).setDepth(DEPTH_TEXT + 10);

    container.add(scene.add.rectangle(5, 5, 280, 110, 0x000000, 0.4).setOrigin(0));
    let bg = scene.add.rectangle(0, 0, 280, 110, 0x1a3a1a, 1).setOrigin(0);
    bg.setStrokeStyle(2, 0x00cc44);
    container.add(bg);

    let header = scene.add.rectangle(0, 0, 280, 26, 0x006622, 1).setOrigin(0);
    container.add(header);

    container.add(scene.add.text(10, 4, '📻 GUARD → DRIVER', {
        fontSize: '11px', fill: '#00ff88', fontWeight: 'bold', fontFamily: 'monospace'
    }));

    let deco = scene.add.graphics();
    deco.fillStyle(0x00cc44, 0.3);
    [230, 242, 254].forEach((x, i) => deco.fillRect(x, 6, 5, 14 - i * 3));
    container.add(deco);

    guardTextObj = scene.add.text(10, 34, '', {
        fontSize: '12px', fill: '#ccffcc', fontFamily: 'monospace',
        wordWrap: { width: 258 }, lineSpacing: 4
    });
    container.add(guardTextObj);

    container.add(scene.add.text(10, 94, 'Press SPACE or click to dismiss', {
        fontSize: '9px', fill: '#448844', fontFamily: 'monospace'
    }));

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => dismissGuardMessage());

    guardPopup = container;
}

function dismissGuardMessage() {
    if (guardPopup) { guardPopup.destroy(); guardPopup = null; }
}

function updateGuardMessage(delta) {
    if (!guardPopup) return;

    guardTypeTimer += delta;
    if (guardDisplayText.length < guardFullText.length) {
        let charsToAdd = Math.floor(guardTypeTimer / 40);
        if (charsToAdd > 0) {
            guardTypeTimer = 0;
            guardDisplayText = guardFullText.slice(0, guardDisplayText.length + charsToAdd);
            guardTextObj.setText(guardDisplayText);
        }
    }

    guardMsgTimer += delta;
    if (guardMsgTimer >= 7000) dismissGuardMessage();
}

// ===================== CONSIST BUILDER =====================

function openConsistBuilder(scene) {
    if (consistBuilderOpen) return;
    consistBuilderOpen = true;
    scene.physics.pause();

    let workingConsist = customConsist
        ? [...customConsist]
        : buildDefaultConsist();
    let workingLoco = customLocoKey;

    const W = 1200, H = 800;
    let g = consistBuilderGroup = scene.add.group();

    let bg = scene.add.rectangle(600, 400, W, H, 0x111111, 0.97)
        .setScrollFactor(0).setDepth(DEPTH_MENU + 10).setInteractive();
    g.add(bg);

    g.add(scene.add.text(600, 30, '🚂  CONSIST BUILDER', {
        fontSize: '28px', fill: '#FFD700', fontWeight: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    g.add(scene.add.text(600, 60, 'SELECT LOCO  ·  PICK COACHES  ·  APPLY TO TRAIN', {
        fontSize: '13px', fill: '#aaaaaa', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    g.add(scene.add.text(40, 90, 'LOCOMOTIVE', {
        fontSize: '14px', fill: '#00ff88', fontWeight: 'bold', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    let locoButtons = {};
    LOCO_CATALOGUE.forEach((loco, idx) => {
        let bx = 40 + idx * 180, by = 110;
        let border = scene.add.rectangle(bx, by, 160, 50, 
            workingLoco === loco.key ? 0x00aa55 : 0x333333)
            .setOrigin(0).setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(DEPTH_MENU + 12)
            .setStrokeStyle(2, workingLoco === loco.key ? 0x00ff88 : 0x666666);
        let label = scene.add.text(bx + 80, by + 25, loco.label + '\n' + loco.maxKmh + ' km/h', {
            fontSize: '13px', fill: '#fff', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
        g.add(border); g.add(label);
        locoButtons[loco.key] = { border, label };
        border.on('pointerdown', () => {
            workingLoco = loco.key;
            LOCO_CATALOGUE.forEach(l => {
                let b = locoButtons[l.key];
                b.border.setFillStyle(workingLoco === l.key ? 0x00aa55 : 0x333333);
                b.border.setStrokeStyle(2, workingLoco === l.key ? 0x00ff88 : 0x666666);
            });
            refreshPreview();
        });
    });

    g.add(scene.add.text(40, 175, 'COACH PALETTE  (click to add · right-click last to remove)', {
        fontSize: '13px', fill: '#00ff88', fontWeight: 'bold', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    const CARD_W = 185, CARD_H = 60, PALETTE_X = 80, PALETTE_Y = 195;
    const VISIBLE_W = 1040; 
    let paletteOffset = 0;
    consistPaletteCards = [];

    let paletteBg = scene.add.rectangle(PALETTE_X, PALETTE_Y, VISIBLE_W, CARD_H, 0x111111, 0)
        .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_MENU + 11);
    g.add(paletteBg);

    let leftBtn = scene.add.rectangle(48, PALETTE_Y + CARD_H / 2, 30, CARD_H, 0x1a1a2e)
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(DEPTH_MENU + 15)
        .setStrokeStyle(1, 0x00ff88, 0.5);
    let leftTxt = scene.add.text(48, PALETTE_Y + CARD_H / 2, '◀', {
        fontSize: '14px', fill: '#00ff88', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 16);
    g.add(leftBtn); g.add(leftTxt);

    let rightBtn = scene.add.rectangle(1152, PALETTE_Y + CARD_H / 2, 30, CARD_H, 0x1a1a2e)
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(DEPTH_MENU + 15)
        .setStrokeStyle(1, 0x00ff88, 0.5);
    let rightTxt = scene.add.text(1152, PALETTE_Y + CARD_H / 2, '▶', {
        fontSize: '14px', fill: '#00ff88', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 16);
    g.add(rightBtn); g.add(rightTxt);

    let scrollIndicator = scene.add.text(600, PALETTE_Y + CARD_H + 8, '', {
        fontSize: '10px', fill: '#555', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 11);
    g.add(scrollIndicator);

    function buildPaletteCards() {
        consistPaletteCards.forEach(p => { p.card.destroy(); p.swatch.destroy(); p.txt.destroy(); });
        consistPaletteCards = [];

        const maxVisible = Math.floor(VISIBLE_W / CARD_W);
        const maxOffset = Math.max(0, COACH_CATALOGUE.length - maxVisible);
        paletteOffset = Phaser.Math.Clamp(paletteOffset, 0, maxOffset);

        if (COACH_CATALOGUE.length > maxVisible) {
            scrollIndicator.setText((paletteOffset + 1) + '–' + Math.min(paletteOffset + maxVisible, COACH_CATALOGUE.length) + ' of ' + COACH_CATALOGUE.length + ' coaches');
        } else {
            scrollIndicator.setText('');
        }

        COACH_CATALOGUE.forEach((coach, idx) => {
            let visIdx = idx - paletteOffset;
            if (visIdx < 0 || visIdx >= maxVisible) return;

            let cx = PALETTE_X + visIdx * CARD_W, cy = PALETTE_Y;
            let card = scene.add.rectangle(cx, cy, CARD_W - 10, CARD_H, 0x222222)
                .setOrigin(0).setInteractive({ useHandCursor: true })
                .setScrollFactor(0).setDepth(DEPTH_MENU + 12)
                .setStrokeStyle(2, coach.color);
            let swatch = scene.add.rectangle(cx + 10, cy + 10, 16, 40, coach.color)
                .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
            let txt = scene.add.text(cx + 34, cy + 10, coach.label + '\n[click to add]', {
                fontSize: '11px', fill: '#ddd', fontFamily: 'monospace'
            }).setScrollFactor(0).setDepth(DEPTH_MENU + 13);

            card.on('pointerover', () => card.setFillStyle(0x333333));
            card.on('pointerout',  () => card.setFillStyle(0x222222));
            card.on('pointerdown', (ptr) => {
                if (ptr.rightButtonDown()) {
                    let idx2 = workingConsist.lastIndexOf(coach.key);
                    if (idx2 >= 0) { workingConsist.splice(idx2, 1); refreshPreview(); }
                } else {
                    if (workingConsist.length < 24) {
                        workingConsist.push(coach.key);
                        refreshPreview();
                    }
                }
            });

            consistPaletteCards.push({ card, swatch, txt, coach });
        });
    }

    leftBtn.on('pointerdown', () => { 
        const maxVisible = Math.floor(VISIBLE_W / CARD_W);
        paletteOffset = Math.max(0, paletteOffset - maxVisible); 
        buildPaletteCards(); 
    });
    rightBtn.on('pointerdown', () => { 
        const maxVisible = Math.floor(VISIBLE_W / CARD_W);
        paletteOffset += maxVisible; 
        buildPaletteCards(); 
    });

    buildPaletteCards();

    g.add(scene.add.text(40, 270, 'CONSIST PREVIEW', {
        fontSize: '14px', fill: '#00ff88', fontWeight: 'bold', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    let countText = scene.add.text(1160, 270, '', {
        fontSize: '13px', fill: '#ffcc00', fontFamily: 'monospace'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
    g.add(countText);

    let previewBg = scene.add.rectangle(600, 370, 1140, 170, 0x1a1a2e)
        .setScrollFactor(0).setDepth(DEPTH_MENU + 11)
        .setStrokeStyle(1, 0x333355);
    g.add(previewBg);

    consistPreviewCells = [];
    let scrollOffset = 0;

    function refreshPreview() {
        consistPreviewCells.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
        consistPreviewCells = [];

        countText.setText(workingConsist.length + ' / 24 coaches');

        let startX = 60, y = 300, cellW = 42, cellH = 70, gap = 3;

        let locoEntry = LOCO_CATALOGUE.find(l => l.key === workingLoco);
        let locoBox = scene.add.rectangle(startX, y, cellW + 8, cellH, 0x1a3a1a)
            .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_MENU + 12)
            .setStrokeStyle(2, 0x00ff88);
        let locoTxt = scene.add.text(startX + (cellW + 8)/2, y + cellH/2,
            locoEntry ? locoEntry.label : 'LOCO', {
            fontSize: '9px', fill: '#00ff88', fontFamily: 'monospace', align: 'center', wordWrap: { width: cellW + 4 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
        consistPreviewCells.push(locoBox, locoTxt);

        let curX = startX + cellW + 8 + gap;

        workingConsist.forEach((key, i) => {
            let coach = COACH_CATALOGUE.find(c => c.key === key);
            let col = coach ? coach.color : 0x888888;
            let lbl = coach ? coach.label.split(' ')[0] : key;

            let drawX = curX + i * (cellW + gap) - scrollOffset;
            if (drawX < 50 || drawX > 1150) return;

            let box = scene.add.rectangle(drawX, y, cellW, cellH, 0x111111)
                .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_MENU + 12)
                .setStrokeStyle(1, col);
            let stripe = scene.add.rectangle(drawX, y, cellW, 10, col, 0.9)
                .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
            let num = scene.add.text(drawX + cellW/2, y + 30, (i + 1) + '\n' + lbl, {
                fontSize: '8px', fill: '#ccc', fontFamily: 'monospace', align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
            let del = scene.add.text(drawX + cellW - 4, y + 2, '×', {
                fontSize: '12px', fill: '#ff4444', fontFamily: 'monospace'
            }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
                .setScrollFactor(0).setDepth(DEPTH_MENU + 14);
            del.on('pointerdown', () => {
                workingConsist.splice(i, 1);
                refreshPreview();
            });
            consistPreviewCells.push(box, stripe, num, del);
        });

        if (workingConsist.length > 24) {
            scrollOffset = Math.max(0, workingConsist.length * (cellW + gap) - 1080);
        }
    }

    refreshPreview();

    g.add(scene.add.text(40, 500, 'QUICK PRESETS', {
        fontSize: '14px', fill: '#00ff88', fontWeight: 'bold', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    const presets = [
        { label: 'Rajdhani\n(22 LHB + 2 EOG)', fn: () => {
            workingConsist = ['eog'];
            for (let i=0; i<22; i++) workingConsist.push('lhb_red_ac3');
            workingConsist.push('eog');
        }},
        { label: 'Shatabdi\n(22 Blue + 2 EOG)', fn: () => {
            workingConsist = ['eog_blue'];
            for (let i=0; i<22; i++) workingConsist.push('lhb_blue');
            workingConsist.push('eog_blue');
        }},
        { label: 'Shatabdi +\nVistadome (Mix)', fn: () => {
            workingConsist = ['eog_blue'];
            for (let i=0; i<11; i++) workingConsist.push('lhb_blue');
            for (let i=0; i<11; i++) workingConsist.push('lhb_deccanqueenvistadome');
            workingConsist.push('eog_blue');
        }},
        { label: 'Full Vistadome\n(22 Vista + 2 EOG)', fn: () => {
            workingConsist = ['eog'];
            for (let i=0; i<22; i++) workingConsist.push('lhb_deccanqueenvistadome');
            workingConsist.push('eog');
        }},
        { label: 'Mixed All\n(Rajdhani+Vista)', fn: () => {
            workingConsist = ['eog'];
            for (let i=0; i<11; i++) workingConsist.push('lhb_red_ac3');
            for (let i=0; i<11; i++) workingConsist.push('lhb_deccanqueenvistadome');
            workingConsist.push('eog_blue');
        }},
        { label: 'Short Rake\n(10 LHB + 2 EOG)', fn: () => {
            workingConsist = ['eog'];
            for (let i=0; i<10; i++) workingConsist.push('lhb_red_ac3');
            workingConsist.push('eog');
        }},
        { label: 'Clear All', fn: () => { workingConsist = []; } },
    ];

    presets.forEach((p, idx) => {
        let row = Math.floor(idx / 4);
        let col = idx % 4;
        let px = 40 + col * 285, py = 520 + row * 68;
        let pb = scene.add.rectangle(px, py, 265, 55, 0x2c3e50)
            .setOrigin(0).setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(DEPTH_MENU + 12)
            .setStrokeStyle(1, 0x4a6080);
        let pt = scene.add.text(px + 132, py + 27, p.label, {
            fontSize: '12px', fill: '#ddd', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
        pb.on('pointerdown', () => { p.fn(); refreshPreview(); });
        g.add(pb); g.add(pt);
    });

    g.add(scene.add.text(600, 665, 'LEFT-CLICK coach card to ADD  ·  RIGHT-CLICK to REMOVE last  ·  Click × on preview cell to remove that coach', {
        fontSize: '11px', fill: '#888', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 11));

    let applyBtn = scene.add.rectangle(500, 725, 280, 55, 0x27ae60)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(DEPTH_MENU + 12)
        .setStrokeStyle(3, 0x00ff88);
    let applyTxt = scene.add.text(500, 725, '✅  APPLY TO TRAIN', {
        fontSize: '18px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
    applyBtn.on('pointerdown', () => {
        if (workingConsist.length === 0) {
            applyTxt.setText('⚠ Add at least 1 coach!').setFill('#ff4444');
            scene.time.delayedCall(1500, () => applyTxt.setText('✅  APPLY TO TRAIN').setFill('#fff'));
            return;
        }
        customConsist = [...workingConsist];
        customLocoKey = workingLoco;
        let locoEntry = LOCO_CATALOGUE.find(l => l.key === workingLoco);
        if (locoEntry) { maxSpeed = locoEntry.maxSpeed; locoMaxKmh = locoEntry.maxKmh; }
        updateTrainRake(gameScene);
        closeConsistBuilder(scene);
    });
    g.add(applyBtn); g.add(applyTxt);

    let cancelBtn = scene.add.rectangle(780, 725, 200, 55, 0xc0392b)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(DEPTH_MENU + 12)
        .setStrokeStyle(2, 0xff6666);
    let cancelTxt = scene.add.text(780, 725, '✖  CANCEL', {
        fontSize: '18px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
    cancelBtn.on('pointerdown', () => closeConsistBuilder(scene));
    g.add(cancelBtn); g.add(cancelTxt);

    let resetBtn = scene.add.rectangle(990, 725, 180, 55, 0x7f8c8d)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(DEPTH_MENU + 12);
    let resetTxt = scene.add.text(990, 725, '↺  RESET', {
        fontSize: '16px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_MENU + 13);
    resetBtn.on('pointerdown', () => {
        customConsist = null;
        customLocoKey = 'wap7';
        maxSpeed = 25; locoMaxKmh = 130;
        updateTrainRake(gameScene);
        closeConsistBuilder(scene);
    });
    g.add(resetBtn); g.add(resetTxt);
}

function buildDefaultConsist() {
    let consist = ['eog'];
    for (let i = 0; i < 22; i++) consist.push('lhb_red_ac3');
    consist.push('eog');
    return consist;
}

function closeConsistBuilder(scene) {
    consistPreviewCells.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
    consistPreviewCells = [];
    consistPaletteCards.forEach(p => {
        if (p.card  && p.card.destroy)   p.card.destroy();
        if (p.swatch && p.swatch.destroy) p.swatch.destroy();
        if (p.txt   && p.txt.destroy)    p.txt.destroy();
    });
    consistPaletteCards = [];

    if (consistBuilderGroup) {
        consistBuilderGroup.getChildren().forEach(c => c.destroy());
        consistBuilderGroup.clear(true, true);
        consistBuilderGroup = null;
    }
    consistBuilderOpen = false;
    scene.physics.resume();
}

// ===================== STARTUP ROUTE SELECTOR =====================

function saveProgress(routeKey, stationIdx, distToNext) {
    try {
        localStorage.setItem('ir_progress', JSON.stringify({ routeKey, stationIdx, distToNext }));
    } catch(e) {}
}
function loadProgress() {
    try {
        let d = localStorage.getItem('ir_progress');
        return d ? JSON.parse(d) : null;
    } catch(e) { return null; }
}

function showRouteSelector(scene) {
    let g = scene.add.group();
    const D = DEPTH_MENU + 20;
    const savedProgress = loadProgress();

    g.add(scene.add.rectangle(600, 400, 1200, 800, 0x000000, 0.97).setScrollFactor(0).setDepth(D));

    let deco = scene.add.graphics().setScrollFactor(0).setDepth(D + 1);
    deco.lineStyle(1, 0xFF6B00, 0.08);
    for (let y = 0; y < 800; y += 40) deco.strokeLineShape(new Phaser.Geom.Line(0, y, 1200, y));
    deco.lineStyle(1, 0xFF6B00, 0.15);
    deco.strokeLineShape(new Phaser.Geom.Line(0, 0, 1200, 0));
    deco.strokeLineShape(new Phaser.Geom.Line(0, 799, 1200, 799));
    g.add(deco);

    let badge = scene.add.graphics().setScrollFactor(0).setDepth(D + 2);
    badge.fillStyle(0xFF6B00, 1).fillRect(560, 28, 80, 32);
    g.add(badge);
    g.add(scene.add.text(600, 44, 'IR SIM', { fontSize: '13px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));

    g.add(scene.add.text(600, 90, 'SELECT YOUR ROUTE', { fontSize: '13px', fill: '#FF6B00', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));
    g.add(scene.add.text(600, 112, 'Choose where your journey begins', { fontSize: '14px', fill: '#666', fontFamily: 'monospace' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));

    const routes = [
        {
            key: 'random-delhi',
            title: 'MUMBAI ⇌ NEW DELHI',
            sub: 'Rajdhani Express Corridor',
            desc: 'Race across 5 states on the\nWestern Railway main line.',
            badge: '130–160 km/h',
            stations: 'MUMBAI · SURAT · VADODARA · RATLAM · KOTA · NEW DELHI',
            color: 0xFF6B00,
            x: 200,
            relatedKeys: ['Mumbai - New Delhi', 'New Delhi - Mumbai']
        },
        {
            key: 'random-pune',
            title: 'MUMBAI ⇌ PUNE',
            sub: 'Bhor Ghat Mountain Route',
            desc: 'Tackle the legendary Bhor Ghat.\nSpeed restricted to 45 km/h.',
            badge: '⛰ Ghat Section',
            stations: 'MUMBAI · THANE · KALYAN · KARJAT · LONAVALA · PUNE',
            color: 0x7C3AED,
            x: 600,
            relatedKeys: ['Mumbai - Pune', 'Pune - Mumbai']
        },
        {
            key: 'random-cbe',
            title: 'COIMBATORE ⇌ CHENNAI',
            sub: 'Tamil Nadu Express Corridor',
            desc: 'Sprint across Tamil Nadu on the\nSouthern Railway main line.',
            badge: '130 km/h',
            stations: 'COIMBATORE · ERODE · SALEM · JOLARPETTAI · KATPADI · CHENNAI',
            color: 0x0E9F6E,
            x: 1000,
            relatedKeys: ['Coimbatore - Chennai', 'Chennai - Coimbatore']
        }
    ];

    routes.forEach(r => {
        let hasSave = savedProgress && r.relatedKeys.includes(savedProgress.routeKey);
        let savedStation = hasSave
            ? ROUTES[savedProgress.routeKey].stations[savedProgress.stationIdx]
            : null;

        let card = scene.add.graphics().setScrollFactor(0).setDepth(D + 2);
        card.fillStyle(0x0D0D0F, 1).fillRoundedRect(r.x - 185, 140, 370, hasSave ? 430 : 380, 8);
        card.lineStyle(1, r.color, 0.3).strokeRoundedRect(r.x - 185, 140, 370, hasSave ? 430 : 380, 8);
        card.fillStyle(r.color, 1).fillRoundedRect(r.x - 185, 140, 370, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
        g.add(card);

        g.add(scene.add.text(r.x, 175, r.title, { fontSize: '16px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
        g.add(scene.add.text(r.x, 198, r.sub, { fontSize: '10px', fill: '#888', fontFamily: 'monospace', letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));

        let div = scene.add.graphics().setScrollFactor(0).setDepth(D + 3);
        div.lineStyle(1, r.color, 0.2).strokeLineShape(new Phaser.Geom.Line(r.x - 155, 215, r.x + 155, 215));
        g.add(div);

        g.add(scene.add.text(r.x, 238, r.desc, { fontSize: '13px', fill: '#aaa', fontFamily: 'monospace', align: 'center', lineSpacing: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));

        let bg2 = scene.add.graphics().setScrollFactor(0).setDepth(D + 3);
        bg2.fillStyle(r.color, 0.12).fillRoundedRect(r.x - 65, 280, 130, 26, 4);
        bg2.lineStyle(1, r.color, 0.4).strokeRoundedRect(r.x - 65, 280, 130, 26, 4);
        g.add(bg2);
        g.add(scene.add.text(r.x, 293, r.badge, { fontSize: '10px', fill: '#' + r.color.toString(16).padStart(6,'0'), fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 4));

        g.add(scene.add.text(r.x, 332, r.stations, { fontSize: '8px', fill: '#444', fontFamily: 'monospace', letterSpacing: 1, align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));

        const launch = (chosenKey, resume) => {
            g.getChildren().forEach(c => c.destroy()); g.clear(true, true); deco.destroy();
            routeSelectOpen = false;
            let rt = ROUTES[chosenKey];
            currentRoute    = chosenKey;
            stationNames    = rt.stations;
            routeDistances  = rt.distances;

            if (resume && savedProgress && savedProgress.routeKey === chosenKey) {
                stationIndex       = savedProgress.stationIdx;
                nextStationDist    = savedProgress.distToNext;
                let nextIdx = Math.min(stationIndex + 1, stationNames.length - 1);
                currentStationName = stationNames[nextIdx];
            } else {
                // Since bidirectional routes exist separately, always spawn at index 0
                stationIndex = 0;
                nextStationDist = routeDistances[1];
                currentStationName = stationNames[0];
                train.setFlipX(false);
                saveProgress(chosenKey, stationIndex, nextStationDist);
            }
            stationLabel.setText(currentStationName);
            distanceLabel.setText(Math.floor(nextStationDist) + 'm');
            currentStationGroup = spawnStation(scene, startX - 8700, stationNames[stationIndex]);
            spawnSignal(scene, startX + 800, 0xff0000, true);
            signalNavCircle.setFillStyle(0xff0000);
            upcomingSignalColor = 0xff0000;

            relativeX = train.flipX ? -8600 : 300;
            cameraDolly.x = startX + relativeX;
            cameraDolly.y = TRACK_Y;

            isAtStation = true; stationWaitTimer = 0;
            scene.physics.resume();
        };

        const pickKey = () => r.key === 'random-pune'
            ? (Math.random() < 0.5 ? 'Mumbai - Pune' : 'Pune - Mumbai')
            : r.key === 'random-delhi'
            ? (Math.random() < 0.5 ? 'Mumbai - New Delhi' : 'New Delhi - Mumbai')
            : (Math.random() < 0.5 ? 'Coimbatore - Chennai' : 'Chennai - Coimbatore');

        if (hasSave) {
            let resumeBtn = scene.add.rectangle(r.x, 390, 330, 40, 0x1a1a1a)
                .setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(D + 4)
                .setStrokeStyle(1, r.color, 0.7);
            let resumeTxt = scene.add.text(r.x, 390,
                '↺  RESUME — ' + savedStation,
                { fontSize: '11px', fill: '#' + r.color.toString(16).padStart(6,'0'), fontWeight: 'bold', fontFamily: 'monospace' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(D + 5);
            resumeBtn.on('pointerover', () => resumeBtn.setFillStyle(r.color, 0.15));
            resumeBtn.on('pointerout',  () => resumeBtn.setFillStyle(0x1a1a1a));
            resumeBtn.on('pointerdown', () => launch(savedProgress.routeKey, true));
            g.add(resumeBtn); g.add(resumeTxt);

            let restartBtn = scene.add.rectangle(r.x, 450, 330, 40, r.color)
                .setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(D + 4);
            let restartTxt = scene.add.text(r.x, 450, '▶  NEW JOURNEY',
                { fontSize: '13px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(D + 5);
            restartBtn.on('pointerover', () => restartBtn.setAlpha(0.85));
            restartBtn.on('pointerout',  () => restartBtn.setAlpha(1));
            restartBtn.on('pointerdown', () => launch(pickKey(), false));
            g.add(restartBtn); g.add(restartTxt);
        } else {
            let btn = scene.add.rectangle(r.x, 400, 280, 44, r.color)
                .setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(D + 4);
            let btnTxt = scene.add.text(r.x, 400, '▶  BEGIN JOURNEY',
                { fontSize: '14px', fill: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(D + 5);
            btn.on('pointerover', () => btn.setAlpha(0.85));
            btn.on('pointerout',  () => btn.setAlpha(1));
            btn.on('pointerdown', () => launch(pickKey(), false));
            g.add(btn); g.add(btnTxt);
        }
    });

    g.add(scene.add.text(600, 758, 'You can change routes anytime from the menu', { fontSize: '10px', fill: '#333', fontFamily: 'monospace' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));
}

function spawnTrackSegment(scene, x) {
    let container = scene.add.container(x, TRACK_Y);
    let ground = scene.add.rectangle(0, 8, TRACK_TILE_WIDTH, 400, 0x4d3319).setOrigin(0, 0);
    container.add(ground);
    for (let i = 0; i < TRACK_TILE_WIDTH; i += 40) container.add(scene.add.rectangle(i, 5, 25, 8, 0xaaaaaa).setOrigin(0.5, 0));
    container.add(scene.add.rectangle(0, 0, TRACK_TILE_WIDTH, 6, 0x333333).setOrigin(0, 0));
    container.setDepth(10); tracks.add(container);
}
