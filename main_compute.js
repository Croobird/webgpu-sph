import * as formatter from './arrayFormatter.js'
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

const WORKGROUP_SIZE = 64;

let pipeline1, pipeline2, pipeline3,
    particleCount,
    shaderModule,
    adapter,
    device,
    bindGroupLayout,
    bindGroup,
    bufferSize,
    simParamsBuffer,
    particlesBuffer,
    positionsBuffer,
    simParamsReadBuffer,
    particlesReadBuffer,
    positionsReadBuffer,
    queue,
    code;

export var posArray;

async function initDevice() {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
}

async function initBuffers() {
    bufferSize = 64;
    particleCount = 64;
    
    // **********************************
    // ATTENTION!
    // **********************************
    // Tweak these values to your liking.
    // Have fun!
    // **********************************
    var params = formatter.simParamsObjectToArray({
        resting_density: 0.2,
        viscosity: 2,
        mass: 1,
        time_step: 0.02,
        num_particles: 64,
        smoothing_distance: 2,
        stiffness: 5,
        bounds: 10.0,
        gravity: {x: 0.0, y: 0.0, z: 0.0}
    });
    /////////////////////////////////////

    var particles = [];
    for (var i = 0; i < 64; i++) {
        particles.push(formatter.createParticleWithPosition(
            {
                x: Math.random() * 3,
                y: Math.random() * 3,
                z: Math.random() * 3
            })
        );
    }
    console.log(particles[0]);

    // Simulation Parameters Buffer
    simParamsBuffer = device.createBuffer({
        label: 'param buffer',
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    device.queue.writeBuffer(
        simParamsBuffer,
        0,
        params
    );

    // Particles Buffer
    particlesBuffer = device.createBuffer({
        label: 'particle buffer',
        size: 48 * particleCount,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    for (var i = 0, offset = 0; i < particleCount; i++, offset += 48) {
        device.queue.writeBuffer(
            particlesBuffer,
            offset,
            particles[i]
        );
    }

    // Buffer containing only positions and not other particle data ( for rendering )
    positionsBuffer = device.createBuffer({
        label: 'positions after processing buffer',
        size: 16 * 64,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC 
    })


    simParamsReadBuffer = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    particlesReadBuffer = device.createBuffer({
        size: 48 * particleCount,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    positionsReadBuffer = device.createBuffer({
        size: 16 * 64,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // TODO: Put data in the buffers somehow.

}

async function initPipelines() {
    code = document.getElementById("compute").innerText;

    shaderModule = device.createShaderModule({
        label: 'compute shader',
        code: code
    });

    bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: 'uniform'}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: 'storage'}
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: 'storage'}
            }
        ]
    });

    pipeline1 = device.createComputePipeline({
        label: 'pipeline 1',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        compute: {
            module: shaderModule,
            entryPoint: 'compute1_density_pressure'
        }
    });
    pipeline2 = device.createComputePipeline({
        label: 'pipeline 2',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        compute: {
            module: shaderModule,
            entryPoint: 'compute2_forces'
        }
    });
    pipeline3 = device.createComputePipeline({
        label: 'pipeline 3',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        compute: {
            module: shaderModule,
            entryPoint: 'compute3_leapfrog'
        }
    });

    // BIND GROUP
    bindGroup = device.createBindGroup({
        label: 'smelly bindgroup',
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: {buffer: simParamsBuffer}},
            { binding: 1, resource: {buffer: particlesBuffer}},
            { binding: 2, resource: {buffer: positionsBuffer}}
        ]
    });

} 

async function dispatch() {
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    // Compute Stage 1: calculate particle densities and pressures
    passEncoder.setPipeline(pipeline1);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(bufferSize / WORKGROUP_SIZE);
    
    // Compute Stage 2: calculate particle forces
    passEncoder.setPipeline(pipeline2);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(bufferSize / WORKGROUP_SIZE);

    // Compute Stage 3: calculate particle positions and velocities
    passEncoder.setPipeline(pipeline3);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(bufferSize / WORKGROUP_SIZE);
    
    passEncoder.end();
    commandEncoder.copyBufferToBuffer(simParamsBuffer, 0, simParamsReadBuffer, 0, 48);
    commandEncoder.copyBufferToBuffer(particlesBuffer, 0, particlesReadBuffer, 0, particlesBuffer.size);
    commandEncoder.copyBufferToBuffer(positionsBuffer, 0, positionsReadBuffer, 0, positionsBuffer.size);

    

    
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);


    await Promise.all([
        simParamsReadBuffer.mapAsync(GPUMapMode.READ),
        particlesReadBuffer.mapAsync(GPUMapMode.READ),
        positionsReadBuffer.mapAsync(GPUMapMode.READ),
    ]);

    const simParams = new Float32Array(simParamsReadBuffer.getMappedRange());
    const particles = new Float32Array(particlesReadBuffer.getMappedRange());
    const positions = new Float32Array(positionsReadBuffer.getMappedRange());

    posArray = positions.slice();
    //console.log(particles);

    simParamsReadBuffer.unmap();
    particlesReadBuffer.unmap();
    positionsReadBuffer.unmap();
    requestAnimationFrame(dispatch);

}

export async function setup() {
    await initDevice();
    await initBuffers();
    await initPipelines();
}

export async function run() {
    await dispatch();
}

await setup();
await run();