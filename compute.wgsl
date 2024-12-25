struct SimUniform {
    resting_density : f32,   // 4 bytes
    viscosity : f32,         // 4 bytes
    mass : f32,              // 4 bytes
    time_step : f32,         // 4 bytes
    num_particles: u32,      // 4 bytes
    smoothing_distance: f32, // 4 bytes            
    stiffness: f32,          // 4 bytes
    bounds: f32,             // 4 bytes (unused)
    gravity: vec3f           // 16 bytes (12 actual + 4 padded)
    
}; // 48 bytes

struct Particle {
    position : vec3f, // 12 bytes
    density : f32,    // 4 bytes
    velocity : vec3f, // 12 bytes
    pressure : f32,   // 4 bytes
    force : vec3f,    // 16 bytes (12 actual + 4 padded)
}; // 48 bytes

@group(0) @binding(0) var<uniform> params : SimUniform;
@group(0) @binding(1) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(2) var<storage, read_write> positions : array<vec4f>;
@compute @workgroup_size(64)
fn compute1_density_pressure(@builtin(global_invocation_id) id : vec3u) {
    var i = id.x;
    var density = 0.0;

    for (var j : u32 = 0; j < 64; j++) {
        var pos_diff = particles[i].position - particles[j].position;
        if (length(pos_diff) < params.smoothing_distance) {
            density = particles[i].density + (params.mass * kernel_poly6(pos_diff, params.smoothing_distance)); // This causes NaN issues.
        }
    }

    particles[i].density = density;
    particles[i].pressure = params.stiffness * (density - params.resting_density);
}

@compute @workgroup_size(64)
fn compute2_forces(@builtin(global_invocation_id) id : vec3u) {
    var i : u32 = id.x;
    var j : u32 = (i + 1) % 64;

    var f_pressure : vec3f = vec3f(0);
    var f_viscosity : vec3f = vec3f(0);
    var f_external : vec3f = vec3f(0);
    var f_total : vec3f = vec3f(0);

    for (var num_tested : u32 = 0; num_tested < 64; num_tested++) {
        j = (j + 1) % 64;
        var pos_diff = particles[i].position - particles[j].position;

        var f_pressure_component = params.mass * ((particles[i].pressure + particles[j].pressure) / (2 * particles[j].density)) * kernel_spiky_grad(pos_diff, params.smoothing_distance);
        var f_viscosity_component = params.mass * ((particles[i].velocity - particles[j].velocity) / particles[j].density) * kernel_viscosity_laplacian(pos_diff, params.smoothing_distance);
        if (
            f_pressure_component.x != f_pressure_component.x ||
            f_pressure_component.y != f_pressure_component.y ||
            f_pressure_component.z != f_pressure_component.z
        ) {
            continue;
        }

        if (
            f_viscosity_component.x != f_viscosity_component.x ||
            f_viscosity_component.y != f_viscosity_component.y ||
            f_viscosity_component.z != f_viscosity_component.z
        ) {
            continue;
        }
        f_pressure = f_pressure - f_pressure_component;
        f_viscosity = f_viscosity + f_viscosity_component;
    }

    f_viscosity = f_viscosity * params.viscosity;
    f_external = params.gravity * particles[i].density;
    f_total = f_pressure + f_viscosity + f_external;

    particles[i].force = f_total;
}

@compute @workgroup_size(64)
fn compute3_leapfrog(@builtin(global_invocation_id) id : vec3u) {
    var i = id.x;

    var acceleration = particles[i].force / particles[i].density;
    particles[i].velocity = particles[i].velocity + (params.time_step * acceleration);
    particles[i].position = particles[i].position + (params.time_step * particles[i].velocity);
    //particles[i].position = max(particles[i].position, vec3(-params.bounds, -params.bounds, -params.bounds));
    //particles[i].position = min(particles[i].position, vec3(params.bounds, params.bounds, params.bounds));
    positions[i] = vec4f(particles[i].position, 1);
}

fn kernel_poly6(pos_diff : vec3f, smoothing_distance: f32) -> f32 {
    var len_squared = pow(length(pos_diff), 2);
    var a = (315) / (64 * 3.14159265 * pow(smoothing_distance, 9));
    var nonzero =  a * pow(pow(smoothing_distance, 2) - len_squared, 3);
    return nonzero * when_ge(len_squared, 0) * when_ge(smoothing_distance, len_squared);
}

fn kernel_viscosity_laplacian(pos_diff : vec3f, smoothing_distance : f32) -> f32 {
    var len = length(pos_diff);
    var a = (45) / (3.14159265 * pow(smoothing_distance, 6));
    return a * (smoothing_distance - len);
}

fn kernel_spiky_grad(pos_diff : vec3f, smoothing_distance : f32) -> vec3f {
    var len = length(pos_diff);
    var a = (-45) / (3.14159265 * pow(smoothing_distance, 6));
    var nonzero = a * pow(smoothing_distance - len, 2) * normalize(pos_diff);
    return nonzero * when_ge(len, 0) * when_ge(smoothing_distance, len);

}

// The following functions are based on:
// https://theorangeduck.com/page/avoiding-shader-conditionals
fn when_gt(x : f32, y : f32) -> f32 {
    return max(sign(x - y), 0.0);
}

fn when_lt(x : f32, y : f32) -> f32 {
    return max(sign(y - x), 0.0);
}

fn when_ge(x : f32, y : f32) -> f32 {
    return 1.0 - when_lt(x, y);
}

fn when_le(x : f32, y : f32) -> f32 {
    return 1.0 - when_gt(x, y);
}