import { setup, run } from './main_compute.js';
import { init, render } from './main_render.js';

async function start() {
    await setup();
    await init();
}

async function pass() {
    await run();
    await render();
    requestAnimationFrame(pass);
}

async function main() {
    await start();
    await pass();
}

main();