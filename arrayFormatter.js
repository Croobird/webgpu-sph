let simParamsBufferSize = 48;
let particleBufferSize = 48;

export function simParamsObjectToArray(data) {
    var buffer = new Float32Array(simParamsBufferSize / 4);
    buffer[0] = data.resting_density;
    buffer[1] = data.viscosity;
    buffer[2] = data.mass;
    buffer[3] = data.time_step;
    buffer[4] = data.num_particles;
    buffer[5] = data.smoothing_distance;
    buffer[6] = data.stiffness;
    buffer[7] = data.bounds;
    buffer[8] = data.gravity.x;
    buffer[9] = data.gravity.y;
    buffer[10] = data.gravity.z;
    buffer[11] = 0.0;
    return buffer;
}

export function particleObjectToArray(data) {
    var buffer = new Float32Array(particleBufferSize / 4);
    buffer[0] = data.position.x;
    buffer[1] = data.position.y;
    buffer[2] = data.position.z;
    buffer[3] = data.density;
    buffer[4] = data.velocity.x;
    buffer[5] = data.velocity.y;
    buffer[6] = data.velocity.z;
    buffer[7] = data.pressure;
    buffer[8] = data.force.x;
    buffer[9] = data.force.y;
    buffer[10] = data.force.z;
    buffer[11] = 0.0;
    return buffer;
}

export function createParticleWithPosition(pos) {
    return particleObjectToArray({
        position: {
            x: pos.x,
            y: pos.y,
            z: pos.z},
        density: 1.0,
        velocity: {x: 0.0, y: 0.0, z: 0.0},
        pressure: 1.0,
        force: {x: 0.0, y: 0.0, z: 0.0}
    });
}