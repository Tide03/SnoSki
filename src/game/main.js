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

// 2.1. Smučarska proga: zelo široka in dolga “ploskev”
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

// bolj “naključno” razmetana drevesa
const trees = [];
{
    const treeCount = 40;
    for (let i = 0; i < treeCount; i++) {
        // gremo po dolžini proge navzdol
        const z = -20 - i * 15; // od približno -20 do globoko v dolino

        // naključno levo/desno
        const side = Math.random() < 0.5 ? -1 : 1;

        // da niso v ravni liniji: baza med 18 in 26 enot od centra
        const xBase = 18 + Math.random() * 8;
        const x = side * xBase;

        // višina med 3 in 6
        const height = 3 + Math.random() * 3;

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

    return [leftGate, rightGate];
}

// Naredimo več vratc po progi, zaporedje: R/R → B/B → R/R → B/B ...
const gates = [];
{
    const gateCount  = 12;
    const firstGateZ = -40;
    const gateStepZ  = -35;

    for (let i = 0; i < gateCount; i++) {
        const z = firstGateZ + i * gateStepZ;

        // center vratc naj vijuga po X, da je bolj zanimivo
        const centerX = Math.sin(i * 0.6) * 8.0;

        // parni: rdeča vratca, neparni: modra vratca
        const isRedGate = (i % 2 === 0);

        const [leftGate, rightGate] = createGatePair(z, centerX, isRedGate);
        gates.push(leftGate, rightGate);
    }
}

// 2.4. Smučar – zaenkrat kocka blizu vrha proge
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
    ...gates,
    cameraEntity,
];

//
// 4) RENDERER + SISTEMI
//
const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

function update(t, dt) {
    // univerzalni update za vse komponente, ki definirajo update()
    for (const entity of scene) {
        for (const component of entity.components) {
            component.update?.(t, dt);
        }
    }

    // TODO:
    // - premikanje smučarja (input + gravitacija)
    // - kamera, ki sledi smučarju
    // - detekcija, ali je šel skozi prava vratca
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
