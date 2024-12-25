@group(0) @binding(1) var myTexture: texture_cube<f32>;
@group(0) @binding(2) var mySampler: sampler;


@fragment
fn main(
  @location(0) fragUV: vec2f,
  @location(1) fragPosition: vec4f
) -> @location(0) vec4f {

  var cubemapVec = fragPosition.xyz - vec3(0.5);
  cubemapVec.z *= -cubemapVec.z;
  return textureSample(myTexture, mySampler, cubemapVec);
}
