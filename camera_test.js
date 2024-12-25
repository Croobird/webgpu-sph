import { Camera } from "./camera.js";
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

var camera = new Camera();

function hi() {
    camera.update();
}

window.addEventListener('input_handler', hi);