import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// =================================================================
// 1. INICIALIZAÇÃO BÁSICA
// =================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xCCCCCC);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 7, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#webgl') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// =================================================================
// 2. CONSTANTES E DADOS DO JOGO
// =================================================================
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

// Materiais para as peças que serão aplicados aos modelos
const whitePieceMaterial = new THREE.MeshStandardMaterial({ color: 0xebebeb, roughness: 0.4, metalness: 0.6 });
const blackPieceMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });

// guarda os modelos 3D depois de carregados
const pieceModels = {};

// =================================================================
// 3. ILUMINAÇÃO
// =================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// =================================================================
// 4. LÓGICA DE MONTAGEM DO JOGO
// =================================================================

// Função principal assíncrona para orquestrar o carregamento e a criação
async function init() {
    await loadAllPieceModels();
    createBoardAndPieces();
    animate();
}

// Função para carregar todos os modelos .glb
async function loadAllPieceModels() {
    const gltfLoader = new GLTFLoader();
    // Configuração do DRACOLoader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://unpkg.com/three@0.157.0/examples/jsm/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const pieceTypes = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
    for (const type of pieceTypes) {
        // O `await` pausa a função até o modelo ser baixado e processado
        const model = await gltfLoader.loadAsync(`models/${type}.glb`);
        // Armazenamos a cena do modelo para clonar depois
        pieceModels[type] = model.scene;
    }
}

// Função que cria o tabuleiro e posiciona as peças
function createBoardAndPieces() {
    const boardGroup = new THREE.Group();

    // Lógica para criar os quadrados (a mesma que você já tinha)
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.1, SQUARE_SIZE);

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const isWhite = (row + col) % 2 === 0;
            const material = isWhite ? whiteMaterial : blackMaterial;
            const square = new THREE.Mesh(squareGeometry, material);
            square.position.set(col * SQUARE_SIZE, 0, row * SQUARE_SIZE);
            boardGroup.add(square);
        }
    }

    // Lógica para posicionar as peças usando os modelos carregados
    initialBoardState.forEach(pieceData => {
        const sourceModel = pieceModels[pieceData.type];
        if (sourceModel) {
            const pieceMesh = sourceModel.clone(true); // CLONA o modelo base
            const material = pieceData.color === 'white' ? whitePieceMaterial : blackPieceMaterial;

            pieceMesh.traverse((child) => {
                if (child.isMesh) {
                    child.material = material; // Aplica nosso material à peça
                }
            });

            // Escala das peças 
            pieceMesh.scale.set(30, 30, 30); 

            pieceMesh.position.set(
                pieceData.col * SQUARE_SIZE,
                0.05,
                pieceData.row * SQUARE_SIZE
            );
            boardGroup.add(pieceMesh);
        }
    });

    // Centraliza o tabuleiro (e as peças junto com ele)
    const offset = (BOARD_SIZE * SQUARE_SIZE) / 2 - SQUARE_SIZE / 2;
    boardGroup.position.set(-offset, 0, -offset);

    scene.add(boardGroup);
}

// loop de animação
const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});


// Inicia tudo
init();