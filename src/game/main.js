import { WebGPU } from "../engine/WebGPU.js";
import { Entity } from "../engine/core/Entity.js";
import { Transform } from "../engine/core/Transform.js";
import { Camera } from "../engine/core/Camera.js";
import { Mesh } from "../engine/core/Mesh.js";
import { MeshUtils } from "../engine/core/MeshUtils.js";
import { UnlitRenderer } from "../engine/renderers/UnlitRenderer.js";

const canvas = document.getElementById('gfx');
const gpu = await WebGPU.create({canvas});

const scene = new Entity();

// camera
const cam = new Entity();
cam.addComponent(new Transform({translation:[0,2,6]}));
cam.addComponent(new Camera());
scene.addChild(cam);

// skier (cube placeholder)
const skier = new Entity();
skier.addComponent(new Transform({translation:[0,1,0]}));
skier.addComponent(new Mesh(MeshUtils.createCube()));
skier.addComponent(new UnlitRenderer({color:[1,0,0,1]}));
scene.addChild(skier);

gpu.scene = scene;
gpu.camera = cam;

gpu.start();
