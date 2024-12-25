@group(0) @binding(2) var myTexture : texture_2d<f32>;
@group(0) @binding(3) var mySampler: sampler;

@fragment fn fs(
    @location(0) fragColor: vec4f,
    @location(1) fragUV: vec2f
) -> @location(0) vec4f {
    return textureSample(myTexture, mySampler, fragUV);
}