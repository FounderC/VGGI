'use strict';

// Variant 19. Encyclopedia of Analytical Surfaces, printed p. 129.
// Here v is the book's z parameter; the geometry stays in the original XYZ axes.
function KissPoint(u, v) {
    const radius = v * v * Math.sqrt(1 - v);
    return [radius * Math.cos(u), radius * Math.sin(u), v];
}

// Build two flat XYZ arrays and explicit boundaries of individual polylines.
// A U-curve varies u at fixed v; a V-curve varies v at fixed u.
function CreateSurfaceData(uSegments, vSegments) {
    if (!Number.isInteger(uSegments) || !Number.isInteger(vSegments) ||
        uSegments < 3 || vSegments < 2 || uSegments > 512 || vSegments > 512) {
        throw new RangeError('Invalid surface subdivision');
    }
    const uVertices = [], vVertices = [];
    const uLines = [], vLines = [];

    for (let j = 0; j <= vSegments; ++j) {
        const v = -1 + 2 * j / vSegments;
        const first = uVertices.length / 3;
        for (let i = 0; i <= uSegments; ++i) {
            // Repeat the first point exactly to close each U-circle at the seam.
            const u = i === uSegments ? 0 : 2 * Math.PI * i / uSegments;
            uVertices.push(...KissPoint(u, v));
        }
        uLines.push({first: first, count: uSegments + 1});
    }
    // u = 2*pi is the same meridian as u = 0: do not draw it twice.
    for (let i = 0; i < uSegments; ++i) {
        const u = 2 * Math.PI * i / uSegments;
        const first = vVertices.length / 3;
        for (let j = 0; j <= vSegments; ++j) {
            const v = -1 + 2 * j / vSegments;
            vVertices.push(...KissPoint(u, v));
        }
        vLines.push({first: first, count: vSegments + 1});
    }
    return {
        uVertices: new Float32Array(uVertices), uLines: uLines,
        vVertices: new Float32Array(vVertices), vLines: vLines
    };
}

// The lecturer's Model object, moved out of main.js and extended to U/V sets.
function Model(name) {
    this.name = name;
    this.uBuffer = gl.createBuffer();
    this.vBuffer = gl.createBuffer();
    this.data = null;

    this.BufferData = function(data) {
        this.data = data;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.uVertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.vVertices, gl.STATIC_DRAW);
    };

    this.DrawSet = function(buffer, lines, color) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        // Three float32 coordinates per vertex. Stride/offset here are in bytes.
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.uniform4fv(shProgram.iColor, color);
        for (const line of lines) {
            // first/count are in VERTICES, not bytes. Each call starts a new strip.
            // No segment joins the end of one curve to the start of the next.
            gl.drawArrays(gl.LINE_STRIP, line.first, line.count);
        }
    };

    this.Draw = function(showU, showV) {
        if (showU) this.DrawSet(this.uBuffer, this.data.uLines, [1.0, 0.76, 0.36, 1.0]);
        if (showV) this.DrawSet(this.vBuffer, this.data.vLines, [0.33, 0.85, 0.94, 1.0]);
    };
}
