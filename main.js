import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import TWEEN from '@tweenjs/tween.js';

// --- VARIÁVEIS GLOBAIS ---
let scene, camera, renderer, controls, boardGroup, piecesGroup;
let dir; // Variável para a luz direcional, acessível globalmente
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
    { type: 'rook', color: 'white', row: 0, col: 0 },
    { type: 'knight', color: 'white', row: 0, col: 1 },
    { type: 'bishop', color: 'white', row: 0, col: 2 },
    { type: 'queen', color: 'white', row: 0, col: 3 },
    { type: 'king', color: 'white', row: 0, col: 4 },
    { type: 'bishop', color: 'white', row: 0, col: 5 },
    { type: 'knight', color: 'white', row: 0, col: 6 },
    { type: 'rook', color: 'white', row: 0, col: 7 },
    ...Array(8).fill(null).map((_, i) => ({ type: 'pawn', color: 'white', row: 1, col: i })),

    // Peças Pretas
    ...Array(8).fill(null).map((_, i) => ({ type: 'pawn', color: 'black', row: 6, col: i })),
    { type: 'rook', color: 'black', row: 7, col: 0 },
    { type: 'knight', color: 'black', row: 7, col: 1 },
    { type: 'bishop', color: 'black', row: 7, col: 2 },
    { type: 'queen', color: 'black', row: 7, col: 3 },
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

    // Habilita sombras e iluminação física
    renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#webgl'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
}

function setupLighting() {
    // Luz ambiente com temperatura sutil (céu/solo)
    const hemi = new THREE.HemisphereLight(0xf6f7ff, 0x444444, 0.65);
    scene.add(hemi);

    // Luz direcional principal (sol) com sombras suaves
    dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 12, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 50;
    dir.shadow.camera.left = -10;
    dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10;
    dir.shadow.camera.bottom = -10;
    dir.shadow.bias = -0.0005;
    scene.add(dir);

    // Luz de preenchimento suave para reduzir contrastes e destacar contornos
    const fill = new THREE.PointLight(0xfff7e6, 0.35, 30);
    fill.position.set(-6, 6, -6);
    fill.castShadow = false;
    scene.add(fill);

    // Luz de contorno/rim atrás para realçar silhuetas
    const rim = new THREE.PointLight(0xbde7ff, 0.25, 40);
    rim.position.set(6, 4, -6);
    rim.castShadow = false;
    scene.add(rim);
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
    // materiais com roughness/metalness para resposta mais rica à iluminação
    const whiteSquareMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 });
    const blackSquareMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.02 });
    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.1, SQUARE_SIZE);

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = new THREE.Mesh(squareGeometry, (row + col) % 2 === 0 ? whiteSquareMaterial : blackSquareMaterial);
            const posX = col * SQUARE_SIZE;
            const posZ = (BOARD_SIZE - 1 - row) * SQUARE_SIZE;
            square.position.set(posX, 0, posZ);
            square.userData = { type: 'square', row, col };

            // Recebe sombras
            square.receiveShadow = true;

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
    // Materiais das peças com propriedades para reagir à iluminação
    const whitePieceMaterial = new THREE.MeshStandardMaterial({ color: 0xebebeb, roughness: 0.35, metalness: 0.15 });
    const blackPieceMaterial = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.25, metalness: 0.12 });

    initialBoardState.forEach(pieceData => {
        const pieceMesh = pieceModels[pieceData.type].clone(true);
        const material = pieceData.color === 'white' ? whitePieceMaterial : blackPieceMaterial;
        pieceMesh.traverse(child => {
            if (child.isMesh) {
                // Aplica material e habilita sombras
                child.material = material;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
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
            if (selectedPieceData && captured) {
                // Agora: move a peça e executa a captura durante a animação
                movePiece(selectedPieceData, targetRow, targetCol, undefined, captured);
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

    // --- 2. SOM DE CAPTURA ---
    const sfx = new Audio("sounds/capture.wav");
    sfx.volume = 0.6;
    sfx.play();

    // --- 3. CRIA OS FRAGMENTOS (SÓ CRIA, NÃO ANIMA) ---
    mesh.visible = false;
    const origin = mesh.position.clone();

    const miniCount = 36;
    for (let i = 0; i < miniCount; i++) {
        const mini = mesh.clone(true);
        mini.visible = true;

        const scale = 12 + Math.random() * 10;
        mini.scale.set(scale, scale, scale);
        mini.position.copy(origin);
        mini.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);

        const angle = Math.random() * Math.PI * 2;
        const horizontalSpeed = 1.2 + Math.random() * 2.2;
        const verticalSpeed = 3.5 + Math.random() * 2.5;
        const velocity = new THREE.Vector3(Math.cos(angle) * horizontalSpeed, verticalSpeed, Math.sin(angle) * horizontalSpeed);
        const angularVelocity = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

        activeFragments.push({
            mesh: mini,
            velocity: velocity,
            angularVelocity: angularVelocity,
            life: 1.0,
            initialScale: scale,
            bounced: false
        });
        piecesGroup.add(mini);
    }
    if (mesh.parent) mesh.parent.remove(mesh);
}

// --- FUNÇÕES DE MOVIMENTO E SELEÇÃO (COM ANIMAÇÃO) ---
function selectPiece(pieceMesh) {
    if (!pieceMesh.userData.type || pieceMesh.userData.type === 'square') return;
    if (selectedPiece) deselectPiece(selectedPiece);
    selectedPiece = pieceMesh;
    const sfx = new Audio("sounds/select.wav");
    sfx.play();
    new TWEEN.Tween(pieceMesh.position).to({ y: 0.5 }, 180).easing(TWEEN.Easing.Back.Out).start();
}

function deselectPiece(pieceMesh) {
    new TWEEN.Tween(pieceMesh.position).to({ y: 0.05 }, 150).easing(TWEEN.Easing.Quadratic.Out).start();
    selectedPiece = null;
}

function movePiece(pieceToMove, newRow, newCol, onComplete, captureTarget) {
    const targetPosition = new THREE.Vector3(newCol * SQUARE_SIZE, 0.5, (BOARD_SIZE - 1 - newRow) * SQUARE_SIZE);
    const start = pieceToMove.mainObject.position.clone();
    const end = targetPosition.clone();
    const distance = start.distanceTo(end);
    const baseDuration = 320;
    const duration = Math.max(180, Math.min(600, baseDuration * (distance / SQUARE_SIZE)));
    let captureTriggered = false;
    const captureTriggerT = 0.85;

    boardState[pieceToMove.row][pieceToMove.col] = null;

    if (pieceToMove.mainObject.userData.type === 'knight') {
        const peak = Math.max(start.y, end.y) + 1.5;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        let targetRotationY = Math.atan2(-dx, -dz);
        const initialRotationY = pieceToMove.mainObject.rotation.y;
        let deltaRot = targetRotationY - initialRotationY;
        if (deltaRot > Math.PI) deltaRot -= 2 * Math.PI;
        if (deltaRot < -Math.PI) deltaRot += 2 * Math.PI;
        const finalRotationY = initialRotationY + deltaRot;

        let obj = { t: 0 };
        new TWEEN.Tween(obj).to({ t: 1 }, 420).easing(TWEEN.Easing.Quadratic.InOut).onUpdate(() => {
            pieceToMove.mainObject.position.x = start.x + (end.x - start.x) * obj.t;
            pieceToMove.mainObject.position.z = start.z + (end.z - start.z) * obj.t;
            pieceToMove.mainObject.position.y = (1 - obj.t) * (1 - obj.t) * start.y + 2 * (1 - obj.t) * obj.t * peak + obj.t * obj.t * 0.05;
            pieceToMove.mainObject.rotation.y = initialRotationY + deltaRot * obj.t;
            if (captureTarget && !captureTriggered && obj.t >= captureTriggerT) {
                capturePiece(captureTarget);
                captureTriggered = true;
            }
        }).onComplete(() => {
            // Só toca som de movimento se não houve captura
            if (!captureTarget) {
                const sfx = new Audio("sounds/move.wav");
                sfx.play();
            }
            pieceToMove.mainObject.position.y = 0.05;
            pieceToMove.mainObject.rotation.y = finalRotationY;
            pieceToMove.row = newRow;
            pieceToMove.col = newCol;
            boardState[newRow][newCol] = pieceToMove;
            if (onComplete) onComplete();
        }).start();
    } else {
        new TWEEN.Tween(pieceToMove.mainObject.position).to({ y: 0.5 }, 140).easing(TWEEN.Easing.Back.Out).onComplete(() => {
            let obj = { t: 0 };
            new TWEEN.Tween(obj).to({ t: 1 }, duration).easing(TWEEN.Easing.Quadratic.InOut).onUpdate(() => {
                pieceToMove.mainObject.position.x = start.x + (end.x - start.x) * obj.t;
                pieceToMove.mainObject.position.z = start.z + (end.z - start.z) * obj.t;
                if (captureTarget && !captureTriggered && obj.t >= captureTriggerT) {
                    capturePiece(captureTarget);
                    captureTriggered = true;
                }
            }).onComplete(() => {
                // Só toca som de movimento se não houve captura
                if (!captureTarget) {
                    const sfx = new Audio("sounds/move.wav");
                    sfx.play();
                }
                new TWEEN.Tween(pieceToMove.mainObject.position).to({ y: 0.05 }, 140).easing(TWEEN.Easing.Back.In).onComplete(() => {
                    pieceToMove.row = newRow;
                    pieceToMove.col = newCol;
                    boardState[newRow][newCol] = pieceToMove;
                    if (onComplete) onComplete();
                }).start();
            }).start();
        }).start();
    }
}

// --- LOOP DE ANIMAÇÃO E RESIZE ---
const animate = () => {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    controls.update();
    TWEEN.update();

    if (dir) {
        // Copia a posição da câmera para a luz
        dir.position.copy(camera.position);
        // Adiciona um deslocamento (offset) para que a luz não fique exatamente no mesmo ponto, 
        dir.position.add(new THREE.Vector3(3, 5, 2));
    }

    const gravity = 13.5;
    for (let i = activeFragments.length - 1; i >= 0; i--) {
        const fragment = activeFragments[i];
        fragment.velocity.y -= gravity * deltaTime;
        fragment.mesh.position.x += fragment.velocity.x * deltaTime;
        fragment.mesh.position.y += fragment.velocity.y * deltaTime;
        fragment.mesh.position.z += fragment.velocity.z * deltaTime;

        if (!fragment.bounced && fragment.mesh.position.y < 0.05) {
            fragment.mesh.position.y = 0.05;
            fragment.velocity.y *= -0.35 * (0.5 + Math.random() * 0.5);
            fragment.velocity.x *= 0.7;
            fragment.velocity.z *= 0.7;
            fragment.bounced = true;
        }

        fragment.mesh.rotation.x += fragment.angularVelocity.x * deltaTime;
        fragment.mesh.rotation.y += fragment.angularVelocity.y * deltaTime;
        fragment.mesh.rotation.z += fragment.angularVelocity.z * deltaTime;
        fragment.life -= 0.7 * deltaTime;

        const ease = fragment.life < 0.5 ? 2 * fragment.life * fragment.life : -2 * (fragment.life - 1) * (fragment.life - 1) + 1;
        const scale = Math.max(0, fragment.initialScale * Math.max(0, ease));
        fragment.mesh.scale.set(scale, scale, scale);

        fragment.mesh.traverse(child => {
            if (child.isMesh) {
                if (!child.material.transparent) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                }
                child.material.opacity = Math.max(0, ease);
            }
        });

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