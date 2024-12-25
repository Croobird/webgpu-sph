export const event = new Event("input_handler");

export var inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false
}

function setDigital(e, value) {
    switch(e.code) {
        case 'KeyW':
            inputState.forward = value;
            break;
        case 'KeyS':
            inputState.backward = value;
            break;
        case 'KeyA':
            inputState.left = value;
            break;
        case 'KeyD':
            inputState.right = value;
            break;
        case 'ArrowUp':
            inputState.lookUp = value;
            break;
        case 'ArrowDown':
            inputState.lookDown = value;
            break;
        case 'ArrowLeft':
            inputState.lookLeft = value;
            break;
        case 'ArrowRight':
            inputState.lookRight = value;
            break;    
    }
    console.log(inputState);
    window.dispatchEvent(event);
}

window.addEventListener('keydown', (e) => setDigital(e, true));
window.addEventListener('keyup', (e) => setDigital(e, false));