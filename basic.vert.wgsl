struct Uniforms {
    modelViewProjection : mat4x4f
}
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> simulationPositions : array<vec4f>;

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) uv: vec2f
}
// Incomplete
@vertex fn vs(
    @builtin(instance_index) instance_index : u32,
    @location(0) position : vec4f,
    @location(1) uv : vec2f
) -> VSOutput {
    var vsOut: VSOutput;
    var p = position + simulationPositions[instance_index] * 10;
    p = uniforms.modelViewProjection * p;

    vsOut.position = p;
    vsOut.color = vec4f(69, 420, 1337 , 86);
    vsOut.uv = uv;

    return vsOut;
}