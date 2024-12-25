// see https://webgpufundamentals.org/webgpu/lessons/webgpu-utils.html#wgpu-matrix
import {mat4, vec3} from 'https://webgpufundamentals.org/3rdparty/wgpu-matrix.module.js';
import * as cube2 from './cube2.js'
import { Camera } from './camera.js';
import * as compute from './main_compute.js';

let adapter,
    device,
    uniformBufferSize,
    uniformBuffer,
    uniformBuffer2,
    canvas,
    renderPassDescriptor,
    mainPipe,
    skyboxPipe,
    vertexBuffer,
    positionsBuffer,
    mainBindGroup,
    context,
    sampler,
    cubeTexture,
    cubemapTexture,
    depthTexture,
    skyboxBindGroup;

const camera = new Camera();

function calculateMVP() {
    camera.update();
    var p_ = mat4.perspective(
        90 * Math.PI / 180,
        canvas.width / canvas.height,
        1,
        100.0
    );
    var v_ = camera.matrixInverse_;
    var m_ = mat4.identity(); // Change if you want.
    var mvp_ = mat4.mul(mat4.mul(p_, v_), m_);
    return mvp_;
}

function calculateSDirP() {
    var s_ = mat4.scaling(vec3.create(10.0, 10.0, 10.0))
    var p_ = mat4.perspective(
        90 * Math.PI / 180,
        canvas.width / canvas.height,
        1,
        100.0
    );
    var v_ = camera.viewDirection_;

    var vip_ = mat4.mul(mat4.mul(p_, v_), s_);
    return vip_;
}

export async function init() {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        fail('need a browser that supports WebGPU');
        return;
    }

    // Get a WebGPU context from the canvas and configure it
    canvas = document.querySelector('canvas');
    context = canvas.getContext('webgpu');
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied',
    });

    const vertexCode = document.getElementById("vertex").innerText;
    const fragCode = document.getElementById("frag").innerText;
    const skyboxVertexCode = document.getElementById("skyboxvert").innerText;
    const skyboxFragCode = document.getElementById("skyboxfrag").innerText;

    const vertexModule = device.createShaderModule({
        label: 'my vertex module',
        code: vertexCode
    });

    const fragmentModule = device.createShaderModule({
        label: 'my fragment module',
        code: fragCode
    });

    const skyBoxVertexModule = device.createShaderModule({
        label: 'my skybox vertex module',
        code: skyboxVertexCode
    });

    const skyboxFragmentModule = device.createShaderModule({
        label: 'my skybox fragment module',
        code: skyboxFragCode
    });

    mainPipe = device.createRenderPipeline({
        label: '2 attributes',
        layout: 'auto',
        vertex: {
            label: 'main vertex desc',
            module: vertexModule,
            buffers: [
                {
                    label: "mainpipe cube",
                    arrayStride: (4 + 4 + 2) * 4, // (10) floats 4 bytes each [only use 6 of them]
                    attributes: [
                        {shaderLocation: 0, offset: cube2.cubePositionOffset, format: 'float32x4'},  // position
                        {shaderLocation: 1, offset: cube2.cubeUVOffset, format: 'float32x2'},  // uv
                    ],
                }

            ],
        },
        fragment: {
            module: fragmentModule,
            targets: [
                {
                    format: presentationFormat
                }
            ]
        },
        primitive: {
            cullMode: 'back',
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
          },

    });

    skyboxPipe = device.createRenderPipeline({
        label: '2 attributes',
        layout: 'auto',
        vertex: {
            label: 'skybox vertex desc',
            module: skyBoxVertexModule,
            buffers: [
                {
                    label: "mainpipe cube",
                    arrayStride: (4 + 4 + 2) * 4, // (10) floats 4 bytes each [only use 6 of them]
                    attributes: [
                        {shaderLocation: 0, offset: cube2.cubePositionOffset, format: 'float32x4'},  // position
                        {shaderLocation: 1, offset: cube2.cubeUVOffset, format: 'float32x2'},  // uv
                    ],
                }

            ],
        },
        fragment: {
            module: skyboxFragmentModule,
            targets: [
                {
                    format: presentationFormat
                }
            ]
        },
        primitive: {
            cullMode: 'front',
        },
        depthStencil: {
            depthWriteEnabled: false,
            depthCompare: 'always',
            format: 'depth24plus',
        },
    });

    sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });

    const response = await fetch('./bright.jpg');
    const imageBitmap = await createImageBitmap(await response.blob());

    const srcs = [
        './negx.png',
        './posx.png',
        './posy.png',
        './negy.png',
        './posz.png',
        './negz.png'
    ];

    const promises = srcs.map(async (src) => {
        const response = await fetch(src);
        return createImageBitmap(await response.blob());
    });

    const imageBitmaps = await Promise.all(promises);

    cubeTexture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: 'rgba8unorm',
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    });

    cubemapTexture = device.createTexture({
        dimension: '2d',
        size: [imageBitmaps[0].width, imageBitmaps[0].height, 6],
        format: 'rgba8unorm',
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    });

    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: cubeTexture },
        [imageBitmap.width, imageBitmap.height]
    );

    for (let i = 0; i < imageBitmaps.length; i++) {
        const bitmap = imageBitmaps[i];
        device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: cubemapTexture, origin: [0, 0, i] },
            [bitmap.width, bitmap.height]
        )
    }

    vertexBuffer = device.createBuffer({
        size: cube2.cubeVertexSize * cube2.cubeVertexCount,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });

    positionsBuffer = device.createBuffer({
        size: 16 * 64,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    console.log("posArray:", compute.posArray);
    new Float32Array(positionsBuffer.getMappedRange()).set(compute.posArray);
    positionsBuffer.unmap();

    new Float32Array(vertexBuffer.getMappedRange()).set(cube2.cubeVertexArray);
    vertexBuffer.unmap();

    uniformBufferSize = 4 * 16;
    uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    uniformBuffer2 = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
      

    skyboxBindGroup = device.createBindGroup({
        label: 'skybox bind group',
        layout: skyboxPipe.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer2 } },
            { binding: 1, resource: cubemapTexture.createView({ dimension: 'cube' })},
            { binding: 2, resource: sampler}
        ]
    });

    mainBindGroup = device.createBindGroup({
        label: 'main bind group',
        layout: mainPipe.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: positionsBuffer }},
            { binding: 2, resource: cubeTexture.createView()},
            { binding: 3, resource: sampler}
        ]
    });


}

export async function render() {


    
    const textureView = context.getCurrentTexture().createView();

    renderPassDescriptor = {
        colorAttachments: [
          {
            view: textureView,
            clearValue: [0, 0, 0, 1],
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
        }
      };

    device.queue.writeBuffer(
        positionsBuffer,
        0,
        compute.posArray,
        0,
        64 * 4
    );
    device.queue.writeBuffer(
        uniformBuffer,
        0,
        calculateMVP(),
        0,
        16
    );

    device.queue.writeBuffer(
        uniformBuffer2,
        0,
        calculateSDirP(),
        0,
        16
    )

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);

    // upload the uniform values to the uniform buffers
    //device.queue.writeBuffer(envMapUniformBuffer, 0, envMapUniformValues);
    //device.queue.writeBuffer(skyBoxUniformBuffer, 0, skyBoxUniformValues);


    // Draw the skybox
    pass.setPipeline(skyboxPipe);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, skyboxBindGroup);
    pass.draw(cube2.cubeVertexCount, 1, 0, 0);

    // Draw the particles
    pass.setPipeline(mainPipe);
    pass.setBindGroup(0, mainBindGroup);
    pass.draw(cube2.cubeVertexCount, 64, 0, 0);

    pass.end();

    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    requestAnimationFrame(render);
}


function fail(msg) {
  alert(msg);
}

async function main() {
    await init();
    await render();
}
main();