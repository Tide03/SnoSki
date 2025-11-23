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
// 1) Naložimo geometrijo in teksturo kocke
//
const resources = await loadResources({
    cubeMesh:    new URL('../models/cube/cube.json', import.meta.url),
    cubeTexture: new URL('../models/cube/cube-diffuse.png', import.meta.url),
});

// Enoten sampler in tekstura za vse objekte
const cubeTexture = new Texture({
    image: resources.cubeTexture,
    sampler: new Sampler({
        magFilter: 'linear',
        minFilter: 'linear',
    }),
});

// Helper: naredi Primitive z določeno barvo (baseFactor)
// barva se množi s teksturo, tako dobimo npr. rdeča/ modra vratca
function createColoredPrimitive(r, g, b, a = 1) {
    return new Primitive({
        mesh: resources.cubeMesh,
        material: new Material({
            baseTexture: cubeTexture,
            baseFactor: [r, g, b, a],
        }),
    });
}

//
// 2) Entitete – naš svet
//

// 2.1. Teren / smučarska proga – zelo dolg in širok
const slope = new Entity();
slope.addComponent(new Transform({
    translation: [0, -1.5, 0],
    scale:       [10, 0.2, 140],    // širša in daljša proga, čez skoraj cel ekran
}));
slope.addComponent(new Model({
    primitives: [createColoredPrimitive(1, 1, 1, 1)],   // bel “sneg”
}));

// 2.2. Drevesa – visoke kocke ob robu proge
function createTree(x, z) {
    const tree = new Entity();
    tree.addComponent(new Transform({
        translation: [x, -0.5, z],
        scale:       [0.6, 3, 0.6],
    }));
    tree.addComponent(new Model({
        primitives: [createColoredPrimitive(0.1, 0.6, 0.2, 1)],
    }));
    return tree;
}

const trees = [
    createTree(-5, -15),
    createTree( 5, -25),
    createTree(-4, -40),
    createTree( 4, -55),
    createTree(-6, -75),
    createTree( 6, -95),
];

// 2.3. Vratca – par količkov, center se premika levo-desno (S-oblika)
function createGatePair(zPos, centerX, redOnLeft) {
    const gateOffsetX    = 2.3;
    const poleHeight     = 2.3;
    const poleThickness  = 0.12;

    const red  = [1.0, 0.1, 0.1, 1];
    const blue = [0.1, 0.3, 1.0, 1];

    const leftColor  = redOnLeft ? red  : blue;
    const rightColor = redOnLeft ? blue : red;

    const leftGate = new Entity();
    leftGate.addComponent(new Transform({
        translation: [centerX - gateOffsetX, -0.4, zPos],
        scale:       [poleThickness, poleHeight, poleThickness],
    }));
    leftGate.addComponent(new Model({
        primitives: [createColoredPrimitive(...leftColor)],
    }));

    const rightGate = new Entity();
    rightGate.addComponent(new Transform({
        translation: [centerX + gateOffsetX, -0.4, zPos],
        scale:       [poleThickness, poleHeight, poleThickness],
    }));
    rightGate.addComponent(new Model({
        primitives: [createColoredPrimitive(...rightColor)],
    }));

    return [leftGate, rightGate];
}

// Naredimo več vratc po progi, izmenično rdeča/modra in levo-desno “valovita”
const gates = [];
const gateCount    = 10;
const gateStartZ   = -15;
const gateSpacingZ = -12;          // bolj narazen po globini
const gateAmplitudeX = 3.0;        // koliko zavije levo-desno

for (let i = 0; i < gateCount; i++) {
    const z = gateStartZ + i * gateSpacingZ;
    const centerX = Math.sin(i * 0.7) * gateAmplitudeX;
    const redOnLeft = (i % 2 === 0);
    const [leftGate, rightGate] = createGatePair(z, centerX, redOnLeft);
    gates.push(leftGate, rightGate);
}

// 2.4. Smučar – zaenkrat samo kocka na vrhu proge
const skier = new Entity();
skier.addComponent(new Transform({
    translation: [0, 0, 15],
    scale:       [0.6, 1.2, 0.6],
}));
skier.addComponent(new Model({
    primitives: [createColoredPrimitive(1.0, 0.8, 0.2, 1)],
}));

// 2.5. Kamera – zelo visoko in daleč, malo nagnjena navzdol
function createPitchQuatX(angle) {
    const half = angle * 0.5;
    const s = Math.sin(half);
    const c = Math.cos(half);
    // [x, y, z, w]
    return [s, 0, 0, c];
}

const cameraEntity = new Entity();
cameraEntity.addComponent(new Transform({
    translation: [0, 40, 55],        // višje in bolj nazaj
    rotation:    createPitchQuatX(-Math.PI / 3), // približno 60° dol po pobočju
}));
cameraEntity.addComponent(new Camera({
    aspect: 1,
    fovy:   0.7,   // malo ožji kot, “telefoto” pogled
    near:   0.1,
    far:    300.0,
}));

//
// 3) Scena = seznam entitet
//
const scene = [
    slope,
    skier,
    ...trees,
    ...gates,
    cameraEntity,
];

//
// 4) Renderer + sistemi
//
const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

function update(t, dt) {
    // Splošna posodobitev vseh komponent, če imajo update()
    for (const entity of scene) {
        for (const component of entity.components) {
            component.update?.(t, dt);
        }
    }

    // TODO: premikanje smučarja, trki, pravilna vratca ...
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
