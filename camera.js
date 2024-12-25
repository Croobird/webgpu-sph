import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';
import { inputState } from './input_handler.js'

const forward = vec3.create(0,0,-1);
const right = vec3.create(1,0,0);

export class Camera {
    matrix_ = mat4.identity(); // Camera's model matrix
    matrixInverse_ = mat4.create(); // Camera's model matrix inverse
    viewDirection_ = mat4.create();
    position = vec3.create(0,0,0); // Camera's position


    movementSpeed = 0.1;
    rotationSpeed = 1.2;

    yaw = 225.0;
    yawDirection = 0;
    pitch = 10.0;
    pitchDirection = 0;

    forward = vec3.create(0,0,-1);
    right = vec3.create(1,0,0);
    
    northSouth = 0; // 1 north, -1 south
    eastWest = 0;   // 1 east, -1 west

    constructor() {
        mat4.translation(vec3.create(0,0,-1), this.forwardMatrix_);
        mat4.translation(vec3.create(1,0,0), this.rightMatrix_);
    }

    update() {
        this.sampleInput();
        this.matrix_ = this.rotate(this.yaw, this.pitch); 
        this.position = vec3.transformMat4(this.position, this.translate(this.matrix_));
        mat4.mul(mat4.translation(this.position), this.matrix_, this.matrix_);
        mat4.inverse(this.matrix_, this.matrixInverse_);
    }
    
    sampleInput() {
        this.pitchDirection = 0;
        this.yawDirection = 0;
        this.northSouth = 0;
        this.eastWest = 0;

        if (inputState.lookUp)    this.pitchDirection += 1;
        if (inputState.lookDown)  this.pitchDirection -= 1;
        if (inputState.lookLeft)  this.yawDirection += 1;
        if (inputState.lookRight) this.yawDirection -= 1;

        if (inputState.forward)  this.northSouth += 1;
        if (inputState.backward) this.northSouth -= 1;
        if (inputState.left)     this.eastWest -= 1;
        if (inputState.right)    this.eastWest += 1;

        this.yaw += this.yawDirection * this.rotationSpeed;
        this.pitch += this.pitchDirection * this.rotationSpeed;
    }

    rotate(yaw, pitch) {
        var yawM_ = mat4.rotationY(yaw * Math.PI / 180);
        var pitchM_ = mat4.rotationX(pitch * Math.PI / 180);
        var m_ = mat4.mul(yawM_, pitchM_);
        this.viewDirection_ = mat4.inverse(m_);
        return m_;
    }

    // Returns a translation matrix along the cardinal directions that the camera is facing.
    translate(orientation) {
        var f = vec3.copy(forward);
        var r = vec3.copy(right);

        vec3.mulScalar(f, this.northSouth * this.movementSpeed, f);
        vec3.mulScalar(r, this.eastWest * this.movementSpeed, r);

        vec3.transformMat4(f, orientation, f);
        vec3.transformMat4(r, orientation, r);


        var f_ = mat4.translation(f);
        var r_ = mat4.translation(r);

        var m_ = mat4.mul(f_, r_);
        return m_;
    }
}