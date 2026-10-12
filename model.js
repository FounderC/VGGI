'use strict';

// Variant 19: Kiss Surface, Encyclopedia of Analytical Surfaces, p. 129.
function KissPoint(u, v) {
    const radius = v * v * Math.sqrt(1 - v);
    return [radius * Math.cos(u), radius * Math.sin(u), v];
}

function Cross(a, b) {
    return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
}

function Normalize(vector) {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
}

function KissNormal(u, v) {
    // At the upper pole use the limit of the analytic unit normal.
    if (v === 1) return [0, 0, 1];
    // At the cusp there is no unique normal: keep the limit for each meridian.
    if (v === 0) return [Math.cos(u), Math.sin(u), 0];
    const radius = v * v * Math.sqrt(1 - v);
    const derivative = v * (4 - 5*v) / (2 * Math.sqrt(1 - v));
    const tangentU = [-radius * Math.sin(u), radius * Math.cos(u), 0];
    const tangentV = [derivative * Math.cos(u), derivative * Math.sin(u), 1];
    return Normalize(Cross(tangentU, tangentV));
}

function CreateSurfaceData(uSegments, vSegments) {
    // Even V subdivision includes the cusp v=0 as a separate row.
    // This bound also keeps all indices within WebGL1's Uint16 range.
    if (!Number.isInteger(uSegments) || !Number.isInteger(vSegments) ||
        uSegments < 3 || uSegments > 128 || vSegments < 4 ||
        vSegments > 128 || vSegments % 2 !== 0) {
        throw new RangeError('U: 3..128; V: even integer in 4..128');
    }
    const vertices = [], normals = [], indices = [];
    const stride = uSegments + 1;
    for (let j = 0; j <= vSegments; ++j) {
        const v = -1 + 2*j/vSegments;
        for (let i = 0; i <= uSegments; ++i) {
            const u = i === uSegments ? 0 : 2*Math.PI*i/uSegments;
            vertices.push(...KissPoint(u, v));
            normals.push(...KissNormal(u, v));
        }
    }
    for (let j = 0; j < vSegments; ++j) {
        for (let i = 0; i < uSegments; ++i) {
            const a = j*stride + i, b = a + 1;
            const c = a + stride, d = c + 1;
            // A collapsed ring needs a triangle fan, not zero-area triangles.
            if (j !== vSegments/2) indices.push(a, b, c);
            if (j+1 !== vSegments/2 && j+1 !== vSegments) indices.push(b, d, c);
        }
    }
    return {
        vertices: new Float32Array(vertices),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}

// Model remains a separate object, as in PA1 and the lecturer's skeleton.
function Model(name) {
    this.name = name;
    this.vertexBuffer = gl.createBuffer();
    this.normalBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.indexCount = 0;
    this.BufferData = function(data) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
        this.indexCount = data.indices.length;
    };
    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(shProgram.vertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.vertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(shProgram.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.normal);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    };
}
