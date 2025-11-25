import {
    Camera,
    Entity,
    Material,
    Model,
    Primitive,
    Sampler,
    Texture,
    Transform,
} from 'engine/core/core.js';

import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';
import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';
import { loadResources } from 'engine/loaders/resources.js';
import { SkierController } from 'engine/controllers/SkierController.js';

import { GameState } from './GameState.js';
import { checkTreeCollisions, checkGateCollisions } from './CollisionDetection.js';

//
// 1) NALOŽIMO MESH IN SNEŽNO TEKSTURO
//
const resources = await loadResources({
    cubeMesh: new URL('../models/cube/cube.json', import.meta.url),
    snowTex:  new URL('../models/snow/Snow010A_2K-JPG_Color.jpg', import.meta.url),
});

// enotni sampler + tekstura (sneg) za vse objekte
const snowTexture = new Texture({
    image: resources.snowTex,
    sampler: new Sampler({
        magFilter: 'linear',
        minFilter: 'linear',
    }),
});

// helper: primitive z barvnim faktorjem (barva * tekstura)
function createColoredPrimitive(r, g, b, a = 1) {
    return new Primitive({
        mesh: resources.cubeMesh,
        material: new Material({
            baseTexture: snowTexture,
            baseFactor: [r, g, b, a],
        }),
    });
}

//
// 2) ENTITETE – SVET
//

// 2.1. Smučarska proga: zelo široka in dolga "ploskev"
const slope = new Entity();
slope.addComponent(new Transform({
    translation: [0, -1.5, 0],
    // X = širina, Y = debelina, Z = dolžina
    scale: [60, 0.2, 600],
}));
slope.addComponent(new Model({
    primitives: [createColoredPrimitive(1.0, 1.0, 1.0, 1)],
}));

// 2.2. Drevesa ob robu proge
function createTree(x, z, height = 4) {
    const tree = new Entity();
    tree.addComponent(new Transform({
        translation: [x, -0.5, z],
        scale: [0.9, height, 0.9],
    }));
    tree.addComponent(new Model({
        // rahlo zelenkast ton
        primitives: [createColoredPrimitive(0.2, 0.6, 0.2, 1)],
    }));
    return tree;
}

// Naključno razmetana drevesa z večjo variabilnostjo
const trees = [];
{
    const treeCount = 50;
    for (let i = 0; i < treeCount; i++) {
        // Naključna razdalja med drevesi (10-20 enot)
        const spacing = 10 + Math.random() * 10;
        const z = -20 - i * spacing;

        // Naključno levo/desno
        const side = Math.random() < 0.5 ? -1 : 1;

        // Večja variabilnost v X poziciji: 15-28 enot od centra
        const xBase = 15 + Math.random() * 13;
        const x = side * xBase;

        // Naključna višina med 2.5 in 7
        const height = 2.5 + Math.random() * 4.5;

        trees.push(createTree(x, z, height));
    }
}

// 2.3. Vratca – par palic iste barve (rdeča ali modra)
function createGatePair(zPos, centerX, isRedGate) {
    const gateHalfWidth  = 1.8;   // polovica razmika med količkoma
    const poleHeight     = 2.2;
    const poleThickness  = 0.12;

    const red  = [1.0, 0.1, 0.1, 1];
    const blue = [0.1, 0.3, 1.0, 1];

    // če je isRedGate = true → OBEDVI palici rdeči
    // če je isRedGate = false → OBEDVI palici modri
    const color = isRedGate ? red : blue;

    const leftGate = new Entity();
    leftGate.addComponent(new Transform({
        translation: [centerX - gateHalfWidth, -0.4, zPos],
        scale:       [poleThickness, poleHeight, poleThickness],
    }));
    leftGate.addComponent(new Model({
        primitives: [createColoredPrimitive(...color)],
    }));

    const rightGate = new Entity();
    rightGate.addComponent(new Transform({
        translation: [centerX + gateHalfWidth, -0.4, zPos],
        scale:       [poleThickness, poleHeight, poleThickness],
    }));
    rightGate.addComponent(new Model({
        primitives: [createColoredPrimitive(...color)],
    }));

    return { leftGate, rightGate, z: zPos, centerX, halfWidth: gateHalfWidth, isRedGate, passed: false };
}

// Naredimo več vratc po progi: rdeča, modra, rdeča, modra ...
const gatePairs = [];
{
    const gateCount  = 14; // even count so alternating looks balanced
    const firstGateZ = -40;
    const gateStepZ  = -32; // razdalja med vratci

    for (let i = 0; i < gateCount; i++) {
        const z = firstGateZ + i * gateStepZ; // gateStepZ je negativen
        const centerX = Math.sin(i * 0.55) * 10; // gladko vijuganje
        const isRedGate = (i % 2 === 0); // izmenično rdeča / modra
        const gatePair = createGatePair(z, centerX, isRedGate);
        gatePairs.push(gatePair);
    }
}

// Plosko polje vseh entitet vratc (levi + desni) za render in collision
const gateEntities = gatePairs.flatMap(g => [g.leftGate, g.rightGate]);

// 2.4. Smučar – zdaj z kontrolerjem za premikanje!
const skier = new Entity();
skier.addComponent(new Transform({
    translation: [0, 0.2, 8],
    scale: [0.7, 1.3, 0.7],
}));
skier.addComponent(new Model({
    primitives: [createColoredPrimitive(1.0, 0.9, 0.3, 1)], // rumenkast
}));

// 2.5. Kamera – pogled od zgoraj, malo poševno
const cameraEntity = new Entity();

const cameraAngle = -0.4; // radiani; negativen = gleda navzdol
const half = cameraAngle / 2;
const cameraRotation = [
    Math.sin(half),  // x
    0,               // y
    0,               // z
    Math.cos(half),  // w
];

cameraEntity.addComponent(new Transform({
    translation: [0, 22, 40],   // višina in razdalja
    rotation: cameraRotation,
}));

cameraEntity.addComponent(new Camera({
    aspect: 1,   // v resize() nastavimo pravo razmerje
    fovy:   0.9,
    near:   0.1,
    far:    400.0,
}));

//
// 3) SCENA – seznam entitet
//
const scene = [
    slope,
    skier,
    ...trees,
    ...gateEntities,
    cameraEntity,
];

//
// 4) RENDERER + SISTEMI + GAME STATE
//
const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

// Ustvari game state manager
const gameState = new GameState();

// Dodaj kontroler za premikanje smučarja
const skierController = new SkierController(skier, canvas, {
    forwardSpeed: 15,   // hitrost navzdol
    lateralSpeed: 10,   // hitrost levo/desno
    maxX: 25,           // meja za rob proge
});
skier.addComponent(skierController);

// Dodaj restart funkcionalnost
document.getElementById('restartButton')?.addEventListener('click', () => {
    gameState.reset();
    
    // Reset skier position
    const skierTransform = skier.getComponentOfType(Transform);
    if (skierTransform) {
        skierTransform.translation = [0, 0.2, 8];
    }
});

function update(t, dt) {
    // Preveri če igra še teče
    if (!gameState.isPlaying()) {
        return; // Če je game over, ne posodabljaj več
    }
    
    // Univerzalni update za vse komponente, ki definirajo update()
    for (const entity of scene) {
        for (const component of entity.components) {
            component.update?.(t, dt);
        }
    }

    const skierTransform = skier.getComponentOfType(Transform);
    
    if (skierTransform) {
        // Posodobi game state (razdalja)
        gameState.update(skierTransform.translation[2]);
        
        // Preveri trčenje z drevesi
        const hitTree = checkTreeCollisions(skier, trees);
        if (hitTree) {
            gameState.gameOver('tree');
            console.log('💥 Hit a tree!');
            return;
        }
        
        // Preveri trčenje z vratci
        const hitGate = checkGateCollisions(skier, gateEntities);
        if (hitGate) {
            gameState.gameOver('gate');
            console.log('💥 Hit a gate pole!');
            return;
        }
    }
        // Preveri, če smo pravkar prešli katera še neobdelana vratca
        for (const pair of gatePairs) {
            if (pair.passed) continue;
            // Ko smučarjev Z gre za z vratc (z je negativen, skierZ bo manjši ali enak)
            if (skierTransform.translation[2] <= pair.z) {
                pair.passed = true; // obdelaj samo enkrat
                const x = skierTransform.translation[0];
                const withinGate = (x >= pair.centerX - pair.halfWidth) && (x <= pair.centerX + pair.halfWidth);
                if (withinGate) {
                    gameState.gatePassed();
                } else {
                    // Zgrešil vratca
                    gameState.gameOver('miss-gate');
                    console.log('❌ Missed a gate!');
                    return;
                }
            }
        }

    // Kamera sledi smučarju
    const cameraTransform = cameraEntity.getComponentOfType(Transform);
    
    if (skierTransform && cameraTransform) {
        // Kamera sledi X poziciji smučarja (levo/desno)
        cameraTransform.translation[0] = skierTransform.translation[0];
        
        // Kamera sledi Z poziciji smučarja z offsetom (ostane za njim)
        cameraTransform.translation[2] = skierTransform.translation[2] + 32;
    }
}

function render() {
    renderer.render(scene, cameraEntity);
}

function resize({ displaySize: { width, height } }) {
    const cam = cameraEntity.getComponentOfType(Camera);
    cam.aspect = width / height;
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
