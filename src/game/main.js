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

// 2.1. Teren / smučarska proga – dolg ploščat “cube”
const slope = new Entity();
slope.addComponent(new Transform({
    translation: [0, -1.5, 0],     // malo dol, da smo nad progo
    scale:       [6, 0.2, 60],     // široko in zelo dolgo
}));
slope.addComponent(new Model({
    primitives: [createColoredPrimitive(1, 1, 1, 1)],   // bel “sneg”
}));

// 2.2. Drevesa – visoke kocke ob robu proge
function createTree(x, z) {
    const tree = new Entity();
    tree.addComponent(new Transform({
        translation: [x, -0.5, z],
        scale:       [0.6, 3, 0.6],  // visoko, ozko (deblo + krošnja v enem)
    }));
    tree.addComponent(new Model({
        primitives: [createColoredPrimitive(0.1, 0.6, 0.2, 1)], // zelenkasto
    }));
    return tree;
}

const trees = [
    createTree(-4, -10),
    createTree( 4, -18),
    createTree(-3, -30),
    createTree( 3, -40),
];

// 2.3. Vratca – par količkov levo/desno, barva se izmenjuje rdeča/modra
function createGatePair(zPos, redOnLeft) {
    const gateOffsetX    = 2.2;
    const poleHeight     = 2.2;
    const poleThickness  = 0.12;

    const red  = [1.0, 0.1, 0.1, 1];
    const blue = [0.1, 0.3, 1.0, 1];

    const leftColor  = redOnLeft ? red  : blue;
    const rightColor = redOnLeft ? blue : red;

    const leftGate = new Entity();
    leftGate.addComponent(new Transform({
        translation: [-gateOffsetX, -0.4, zPos],
        scale:       [poleThickness, poleHeight, poleThickness],
    }));
    leftGate.addComponent(new Model({
        primitives: [createColoredPrimitive(...leftColor)],
    }));

    const rightGate = new Entity();
    rightGate.addComponent(new Transform({
        translation: [gateOffsetX, -0.4, zPos],
        scale:       [poleThickness, poleHeight, poleThickness],
    }));
    rightGate.addComponent(new Model({
        primitives: [createColoredPrimitive(...rightColor)],
    }));

    return [leftGate, rightGate];
}

// Naredimo več vratc po progi, izmenično rdeče/modre
const gates = [];
const gateCount     = 7;
const gateStartZ    = -8;
const gateSpacingZ  = -7;   // negativno – gremo “dol” po pobočju

for (let i = 0; i < gateCount; i++) {
    const z = gateStartZ + i * gateSpacingZ;
    const redOnLeft = (i % 2 === 0);    // 0: rdeča levo, 1: modra levo, 2: rdeča levo, ...
    const [leftGate, rightGate] = createGatePair(z, redOnLeft);
    gates.push(leftGate, rightGate);
}

// 2.4. Smučar – zaenkrat samo kocka na vrhu proge
const skier = new Entity();
skier.addComponent(new Transform({
    translation: [0, 0, 10],   // malo nad začetkom proge
    scale:       [0.4, 0.9, 0.4],
}));
skier.addComponent(new Model({
    primitives: [createColoredPrimitive(1.0, 0.8, 0.2, 1)], // “rumen” smučar
}));

// 2.5. Kamera – malo nad smučarjem, gleda po progi dol
const cameraEntity = new Entity();
cameraEntity.addComponent(new Transform({
    translation: [0, 4, 16],
}));
cameraEntity.addComponent(new Camera({
    aspect: 1,        // pravo razmerje nastavimo v resize()
    fovy:   1.0,
    near:   0.1,
    far:    200.0,
}));

// Zaenkrat kamera še ne “sledi” smučarju, je statična – to dodamo kasneje z .update()

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

    // TODO: v naslednjem koraku boste tu premikali smučarja,
    //       preverjali trke, ali je šel skozi prava vratca itd.
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
