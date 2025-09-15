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
const activeFragments = []; // Guarda todos os fragmentos que estão sendo animados
const clock = new THREE.Clock(); // Relógio para uma animação mais suave

// --- VARIÁVEIS DE INTERAÇÃO ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPiece = null;
let boardState = Array(8).fill(null).map(() => Array(8).fill(null));

// --- CONSTANTES E DADOS DO JOGO ---
const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;

const initialBoardState = [
    // Peças Brancas
    { type: 'rook', color: 'white', row: 0, col: 0 }, // Torre da Rainha
    { type: 'knight', color: 'white', row: 0, col: 1 },
    { type: 'bishop', color: 'white', row: 0, col: 2 },
    { type: 'queen', color: 'white', row: 0, col: 3 }, // Rainha na sua cor (casa preta d1)
    { type: 'king', color: 'white', row: 0, col: 4 },
    { type: 'bishop', color: 'white', row: 0, col: 5 },
    { type: 'knight', color: 'white', row: 0, col: 6 },
    { type: 'rook', color: 'white', row: 0, col: 7 }, // Torre do Rei
    ...Array(8).fill(null).map((_, i) => ({ type: 'pawn', color: 'white', row: 1, col: i })),

    // Peças Pretas
    ...Array(8).fill(null).map((_, i) => ({ type: 'pawn', color: 'black', row: 6, col: i })),
    { type: 'rook', color: 'black', row: 7, col: 0 },
    { type: 'knight', color: 'black', row: 7, col: 1 },
    { type: 'bishop', color: 'black', row: 7, col: 2 },
    { type: 'queen', color: 'black', row: 7, col: 3 }, // Rainha na sua cor (casa branca d8)
    { type: 'king', color: 'black', row: 7, col: 4 },
    { type: 'bishop', color: 'black', row: 7, col: 5 },
    { type: 'knight', color: 'black', row: 7, col: 6 },
    { type: 'rook', color: 'black', row: 7, col: 7 },
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

    initializeBoardState();
    setupEventListeners();
    animate();
}

// --- FUNÇÕES DE SETUP ---
function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xCCCCCC);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 7, 7);
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

function initializeBoardState() {
    // Preenche o estado do tabuleiro com as peças iniciais
    pieceObjects.forEach(piece => {
        if (piece.row >= 0 && piece.row < 8 && piece.col >= 0 && piece.col < 8) {
            boardState[piece.row][piece.col] = piece;
        }
    });
}

function createBoard() {
    const group = new THREE.Group();
    const whiteSquareMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackSquareMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.1, SQUARE_SIZE);

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = new THREE.Mesh(squareGeometry, (row + col) % 2 === 0 ? whiteSquareMaterial : blackSquareMaterial);
            const posX = col * SQUARE_SIZE;
            const posZ = (BOARD_SIZE - 1 - row) * SQUARE_SIZE;
            square.position.set(posX, 0, posZ);
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
        if (pieceData.type === 'knight' && pieceData.color === 'black') {
            pieceMesh.rotation.y = Math.PI; // Girar o cavalo preto em 180 graus
        }
        const posX = pieceData.col * SQUARE_SIZE;
        const posZ = (BOARD_SIZE - 1 - pieceData.row) * SQUARE_SIZE;
        pieceMesh.position.set(posX, 0.05, posZ);

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
    let object = clickedObject;
    // Ao clicar no objeto ele nem sempre trará o objeto principal (ex: pode ser um filho do mesh, como a cabeça do cavalo)
    // Nesse cenário, é necessário subir na hierarquia até encontrar o objeto com userData
    while (object.parent && !object.userData.type) {
        object = object.parent;
    }

    // Lógica de seleção
    if (!selectedPiece) {
        if (object.userData.type !== 'square') {
            selectPiece(object);
        }
        return;
    } else {
        let targetRow, targetCol;
        // verificar se o clique foi em um quadrado ou peça
        if (object.userData.type !== 'square') {
            // Busca a peça pelo mesh
            const found = pieceObjects.find(p => p.mainObject === object);
            if (!found) {
                deselectPiece(selectedPiece);
                return;
            }
            targetRow = found.row;
            targetCol = found.col;
        } else {
            targetRow = object.userData.row;
            targetCol = object.userData.col;
        }
        const targetPiece = boardState[targetRow][targetCol];
        if (targetPiece) {
            // verificar a cor da peça
            if (targetPiece.color === selectedPiece.userData.color) {
                // Seleciona a nova peça
                deselectPiece(selectedPiece);
                selectPiece(object);
                return;
            }

            // Salve a peça capturada ANTES de mover!
            const captured = pieceObjects.find(p => p.row === targetRow && p.col === targetCol);
            const selectedPieceData = pieceObjects.find(p => p.mainObject === selectedPiece);
            if (selectedPieceData) {
                movePiece(selectedPieceData, targetRow, targetCol, () => {
                    if (captured) capturePiece(captured);
                });
            }

        } else {
            // Move a peça selecionada
            const selectedPieceData = pieceObjects.find(p => p.mainObject === selectedPiece);
            if (selectedPieceData) {
                movePiece(selectedPieceData, targetRow, targetCol);
            }
        }

        deselectPiece(selectedPiece);
    }
}


function capturePiece(pieceToCapture) {
    if (!pieceToCapture || !pieceToCapture.mainObject) return;
    const mesh = pieceToCapture.mainObject;

    // --- 1. ATUALIZA A LÓGICA DO JOGO ---
    boardState[pieceToCapture.row][pieceToCapture.col] = null;
    const idx = pieceObjects.indexOf(pieceToCapture);
    if (idx !== -1) pieceObjects.splice(idx, 1);
    const clickableIdx = clickableObjects.indexOf(mesh);
    if (clickableIdx !== -1) clickableObjects.splice(clickableIdx, 1);

    // --- 2. CRIA OS FRAGMENTOS (SÓ CRIA, NÃO ANIMA) ---
    mesh.visible = false;
    const origin = mesh.position.clone();

    const miniCount = 36;
    for (let i = 0; i < miniCount; i++) {
        const mini = mesh.clone(true);
        mini.visible = true;

        const scale = 12 + Math.random() * 10;
        mini.scale.set(scale, scale, scale);
        mini.position.copy(origin);

        // Rotação inicial aleatória
        mini.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        // Velocidade inicial: mais vertical, mais rápida
        const angle = Math.random() * Math.PI * 2;
        const horizontalSpeed = 1.2 + Math.random() * 2.2;
        const verticalSpeed = 3.5 + Math.random() * 2.5;
        const velocity = new THREE.Vector3(
            Math.cos(angle) * horizontalSpeed,
            verticalSpeed,
            Math.sin(angle) * horizontalSpeed
        );

        // Velocidade angular para rotação animada (mais rápida)
        const angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8
        );

        // Guarda o fragmento e suas propriedades para serem animados no loop principal
        activeFragments.push({
            mesh: mini,
            velocity: velocity,
            angularVelocity: angularVelocity,
            life: 1.0,
            initialScale: scale,
            bounced: false // Para controlar o "quique"
        });

        piecesGroup.add(mini);
    }

    // Remove a peça original do grupo principal
    if (mesh.parent) mesh.parent.remove(mesh);
}

// --- FUNÇÕES DE MOVIMENTO E SELEÇÃO (COM ANIMAÇÃO) ---
function selectPiece(pieceMesh) {
    if (!pieceMesh.userData.type || pieceMesh.userData.type === 'square') return;

    if (selectedPiece) deselectPiece(selectedPiece);

    selectedPiece = pieceMesh;
    const sfx = new Audio("sounds/select.wav");
    sfx.play();

    // Todas as peças levantam igual ao selecionar
    new TWEEN.Tween(pieceMesh.position)
        .to({ y: 0.5 }, 180)
        .easing(TWEEN.Easing.Back.Out)
        .start();
}

function deselectPiece(pieceMesh) {
    new TWEEN.Tween(pieceMesh.position)
        .to({ y: 0.05 }, 150)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    selectedPiece = null;
}

function movePiece(pieceToMove, newRow, newCol, onComplete) {
    const targetPosition = new THREE.Vector3(
        newCol * SQUARE_SIZE,
        0.5,
        (BOARD_SIZE - 1 - newRow) * SQUARE_SIZE
    );

    // Se for cavalo, faz arco parabólico
    if (pieceToMove.mainObject.userData.type === 'knight') {
        const start = pieceToMove.mainObject.position.clone();
        const end = targetPosition.clone();
        const duration = 420;
        const peak = Math.max(start.y, end.y) + 1.5; // Altura máxima do arco

        // Anima X e Z linearmente, Y em parábola
        let obj = { t: 0 };
        new TWEEN.Tween(obj)
            .to({ t: 1 }, duration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                // Interpolação linear para X e Z
                pieceToMove.mainObject.position.x = start.x + (end.x - start.x) * obj.t;
                pieceToMove.mainObject.position.z = start.z + (end.z - start.z) * obj.t;
                // Interpolação parabólica para Y
                // y = (1 - t)^2 * startY + 2*(1-t)*t*peak + t^2*endY
                pieceToMove.mainObject.position.y =
                    (1 - obj.t) * (1 - obj.t) * start.y +
                    2 * (1 - obj.t) * obj.t * peak +
                    obj.t * obj.t * 0.05;
            })
            .onComplete(() => {
                const sfx = new Audio("sounds/move.wav");
                sfx.play();
                pieceToMove.mainObject.position.y = 0.05;
                if (onComplete) onComplete();
            })
            .start();
    } else {
        // Animação padrão para outras peças
        const liftY = 0.5;
        new TWEEN.Tween(pieceToMove.mainObject.position)
            .to({ y: liftY }, 140)
            .easing(TWEEN.Easing.Back.Out)
            .onComplete(() => {
                new TWEEN.Tween(pieceToMove.mainObject.position)
                    .to({ x: targetPosition.x, z: targetPosition.z }, 320)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onComplete(() => {
                        const sfx = new Audio("sounds/move.wav");
                        sfx.play();
                        new TWEEN.Tween(pieceToMove.mainObject.position)
                            .to({ y: 0.05 }, 140)
                            .easing(TWEEN.Easing.Back.In)
                            .onComplete(() => {
                                if (onComplete) onComplete();
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    // Atualiza o estado do tabuleiro
    boardState[pieceToMove.row][pieceToMove.col] = null;
    pieceToMove.row = newRow;
    pieceToMove.col = newCol;
    boardState[newRow][newCol] = pieceToMove;
}

// --- LOOP DE ANIMAÇÃO E RESIZE ---
// A ÚNICA função animate que você deve ter no seu código
const animate = () => {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    controls.update();
    TWEEN.update();
    const gravity = 13.5;
    for (let i = activeFragments.length - 1; i >= 0; i--) {
        const fragment = activeFragments[i];

        // Aplica a gravidade à velocidade vertical
        fragment.velocity.y -= gravity * deltaTime;

        // Move o fragmento com base na sua velocidade
        fragment.mesh.position.x += fragment.velocity.x * deltaTime;
        fragment.mesh.position.y += fragment.velocity.y * deltaTime;
        fragment.mesh.position.z += fragment.velocity.z * deltaTime;

        // "Quica" levemente ao tocar o chão uma vez
        if (!fragment.bounced && fragment.mesh.position.y < 0.05) {
            fragment.mesh.position.y = 0.05;
            fragment.velocity.y *= -0.35 * (0.5 + Math.random() * 0.5); // Perde energia
            fragment.velocity.x *= 0.7;
            fragment.velocity.z *= 0.7;
            fragment.bounced = true;
        }

        // Rotaciona o fragmento
        fragment.mesh.rotation.x += fragment.angularVelocity.x * deltaTime;
        fragment.mesh.rotation.y += fragment.angularVelocity.y * deltaTime;
        fragment.mesh.rotation.z += fragment.angularVelocity.z * deltaTime;

        // Diminui a "vida" do fragmento
        fragment.life -= 0.7 * deltaTime;

        // Anima o fade-out e escala com easing
        const ease = fragment.life < 0.5
            ? 2 * fragment.life * fragment.life
            : -2 * (fragment.life - 1) * (fragment.life - 1) + 1;
        const scale = Math.max(0, fragment.initialScale * Math.max(0, ease));
        fragment.mesh.scale.set(scale, scale, scale);

        fragment.mesh.traverse(child => {
            if (child.isMesh) {
                if (!child.material.transparent) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                }
                // Fade-out com easing
                child.material.opacity = Math.max(0, ease);
            }
        });

        // Se a vida acabou, remove o fragmento
        if (fragment.life <= 0) {
            if (fragment.mesh.parent) fragment.mesh.parent.remove(fragment.mesh);
            activeFragments.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- INÍCIO ---
init();