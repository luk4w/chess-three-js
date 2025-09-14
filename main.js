import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import TWEEN from '@tweenjs/tween.js';

// --- VARIÁVEIS GLOBAIS ---
let scene, camera, renderer, controls, boardGroup, piecesGroup;
const pieceModels = {};
const pieceObjects = [];
const clickableObjects = []; // Guarda todas as peças e quadrados

// --- VARIÁVEIS DE INTERAÇÃO ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPiece = null;

// --- CONSTANTES E DADOS DO JOGO ---
const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const initialBoardState = [
    // Peças Pretas
    { type: 'rook', color: 'black', row: 0, col: 0 },
    { type: 'knight', color: 'black', row: 0, col: 1 },
    { type: 'bishop', color: 'black', row: 0, col: 2 },
    { type: 'queen', color: 'black', row: 0, col: 3 },
    { type: 'king', color: 'black', row: 0, col: 4 },
    { type: 'bishop', color: 'black', row: 0, col: 5 },
    { type: 'knight', color: 'black', row: 0, col: 6 },
    { type: 'rook', color: 'black', row: 0, col: 7 },
    ...Array(8).fill(null).map((_, i) => ({ type: 'pawn', color: 'black', row: 1, col: i })),
    // Peças Brancas
    ...Array(8).fill(null).map((_, i) => ({ type: 'pawn', color: 'white', row: 6, col: i })),
    { type: 'rook', color: 'white', row: 7, col: 0 },
    { type: 'knight', color: 'white', row: 7, col: 1 },
    { type: 'bishop', color: 'white', row: 7, col: 2 },
    { type: 'queen', color: 'white', row: 7, col: 3 },
    { type: 'king', color: 'white', row: 7, col: 4 },
    { type: 'bishop', color: 'white', row: 7, col: 5 },
    { type: 'knight', color: 'white', row: 7, col: 6 },
    { type: 'rook', color: 'white', row: 7, col: 7 },
];

// --- FUNÇÃO PRINCIPAL ---
async function init() {
    setupScene();
    setupLighting();
    await loadAllPieceModels();

    boardGroup = createBoard();
    scene.add(boardGroup);

    piecesGroup = createPieces();
    scene.add(piecesGroup);

    setupEventListeners();
    animate();
}

// --- FUNÇÕES DE SETUP ---
function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xCCCCCC);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 8);
    renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#webgl'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
}

// --- FUNÇÕES DE CRIAÇÃO ---
async function loadAllPieceModels() {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);
    const pieceTypes = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
    for (const type of pieceTypes) {
        const model = await gltfLoader.loadAsync(`models/${type}.glb`);
        pieceModels[type] = model.scene;
    }
}

function createBoard() {
    const group = new THREE.Group();
    const whiteSquareMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackSquareMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.1, SQUARE_SIZE);

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = new THREE.Mesh(squareGeometry, (row + col) % 2 === 0 ? whiteSquareMaterial : blackSquareMaterial);
            square.position.set(col * SQUARE_SIZE, 0, row * SQUARE_SIZE);
            square.userData = { type: 'square', row, col };
            group.add(square);
            clickableObjects.push(square);
        }
    }
    const offset = (BOARD_SIZE * SQUARE_SIZE) / 2 - SQUARE_SIZE / 2;
    group.position.set(-offset, 0, -offset);
    return group;
}

function createPieces() {
    const group = new THREE.Group();
    const whitePieceMaterial = new THREE.MeshStandardMaterial({ color: 0xebebeb, roughness: 0.4, metalness: 0.6 });
    const blackPieceMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });

    initialBoardState.forEach(pieceData => {
        const pieceMesh = pieceModels[pieceData.type].clone(true);
        const material = pieceData.color === 'white' ? whitePieceMaterial : blackPieceMaterial;
        pieceMesh.traverse(child => { if (child.isMesh) child.material = material; });
        pieceMesh.scale.set(30, 30, 30);
        pieceMesh.position.set(pieceData.col * SQUARE_SIZE, 0.05, pieceData.row * SQUARE_SIZE);

        pieceMesh.userData = { type: pieceData.type, color: pieceData.color };
        group.add(pieceMesh);
        clickableObjects.push(pieceMesh);

        pieceObjects.push({ mainObject: pieceMesh, ...pieceData });
    });
    const offset = (BOARD_SIZE * SQUARE_SIZE) / 2 - SQUARE_SIZE / 2;
    group.position.set(-offset, 0, -offset);
    return group;
}

// --- LÓGICA DE INTERAÇÃO (RAYCASTING) ---
function onMouseDown(event) {
    if (event.button !== 0) return; // Apenas botão esquerdo

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickableObjects, true);

    if (intersects.length > 0) {
        handleInteraction(intersects[0].object);
    } else if (selectedPiece) {
        deselectPiece(selectedPiece);
    }
}

function handleInteraction(clickedObject) {
    let targetObject = clickedObject;
    while (targetObject.parent && !targetObject.userData.type) {
        targetObject = targetObject.parent;
    }

    if (!selectedPiece) {
        if (targetObject.userData.type !== 'square') {
            selectPiece(targetObject);
        }
    } else {
        if (targetObject === selectedPiece) {
            deselectPiece(selectedPiece);
            return;
        }

        if (targetObject.userData.type === 'square') {
            const pieceToMove = pieceObjects.find(p => p.mainObject === selectedPiece);
            if (pieceToMove) movePiece(pieceToMove, targetObject.userData.row, targetObject.userData.col);
        }
        deselectPiece(selectedPiece);
    }
}

// --- FUNÇÕES DE MOVIMENTO E SELEÇÃO (COM ANIMAÇÃO) ---
function selectPiece(pieceMesh) {
    if (selectedPiece) deselectPiece(selectedPiece);

    selectedPiece = pieceMesh;
    // const sfx = new Audio("select.mp3");
    // sfx.play();
    new TWEEN.Tween(pieceMesh.position)
        .to({ y: 0.5 }, 150)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
}

function deselectPiece(pieceMesh) {
    new TWEEN.Tween(pieceMesh.position)
        .to({ y: 0.05 }, 150)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    selectedPiece = null;
}

function movePiece(pieceToMove, newRow, newCol) {
    const targetPosition = new THREE.Vector3(
        newCol * SQUARE_SIZE,
        0.5,
        newRow * SQUARE_SIZE
    );
    // const sfx = new Audio("move.mp3");
    // sfx.play();
    new TWEEN.Tween(pieceToMove.mainObject.position)
        .to(targetPosition, 400)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            new TWEEN.Tween(pieceToMove.mainObject.position)
                .to({ y: 0.05 }, 150)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        })
        .start();
    pieceToMove.row = newRow;
    pieceToMove.col = newCol;
}

// --- LOOP DE ANIMAÇÃO E RESIZE ---
const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    TWEEN.update(); // Atualizar as animações a cada frame
    renderer.render(scene, camera);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- INÍCIO ---
init();