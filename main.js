'use strict';

// Based on the PA1/PA2 skeleton by Anatoliy Demchyshyn (ademch/WebGL).
let gl, surface, shProgram, spaceball;
let lightProgram, lightBuffer;
let lightAngle = 0.65;
let lightRunning = true;
let previousTime = null;
let frameRequest = 0;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.vertex = gl.getAttribLocation(program, 'vertex');
    this.normal = gl.getAttribLocation(program, 'normal');
    for (const uniform of ['ModelViewMatrix', 'ProjectionMatrix', 'NormalMatrix',
                           'lightPosition', 'components']) {
        this[uniform] = gl.getUniformLocation(program, uniform);
    }
    this.Use = function() { gl.useProgram(this.prog); };
}

function LightPosition(angle) {
    return [2.0 * Math.cos(angle), 2.0 * Math.sin(angle), 0.45];
}

function draw() {
    if (!gl || !spaceball || gl.isContextLost()) return;
    const canvas = gl.canvas;
    // TrackballRotator uses CSS coordinates; keep canvas units consistent.
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.03, 0.04, 0.065, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = canvas.width / canvas.height;
    const fov = 2 * Math.atan(Math.tan(Math.PI / 15) / Math.min(1, aspect));
    const projection = m4.perspective(fov, aspect, 7, 13);
    const modelView = m4.multiply(m4.translation(0, 0, -10), spaceball.getViewMatrix());
    const inverseTranspose = m4.transpose(m4.inverse(modelView));
    const normalMatrix = new Float32Array([
        inverseTranspose[0], inverseTranspose[1], inverseTranspose[2],
        inverseTranspose[4], inverseTranspose[5], inverseTranspose[6],
        inverseTranspose[8], inverseTranspose[9], inverseTranspose[10]
    ]);
    const light = LightPosition(lightAngle);
    // Both surface positions and the light must be in the same eye space.
    const lightEye = m4.transformPoint(modelView, light);
    shProgram.Use();
    gl.uniformMatrix4fv(shProgram.ModelViewMatrix, false, modelView);
    gl.uniformMatrix4fv(shProgram.ProjectionMatrix, false, projection);
    gl.uniformMatrix3fv(shProgram.NormalMatrix, false, normalMatrix);
    gl.uniform3fv(shProgram.lightPosition, lightEye);
    gl.uniform3fv(shProgram.components, ['ambient', 'diffuse', 'specular'].map(id =>
        document.getElementById(id).checked ? 1 : 0));
    surface.Draw();

    gl.disableVertexAttribArray(shProgram.normal);
    gl.disableVertexAttribArray(shProgram.vertex);
    gl.useProgram(lightProgram.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, lightBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(light));
    gl.vertexAttribPointer(lightProgram.vertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(lightProgram.vertex);
    gl.uniformMatrix4fv(lightProgram.matrix, false, m4.multiply(projection, modelView));
    gl.drawArrays(gl.POINTS, 0, 1);
    gl.disableVertexAttribArray(lightProgram.vertex);
}

function animate(time) {
    if (previousTime !== null && lightRunning) {
        lightAngle = (lightAngle + 0.65 * Math.min((time - previousTime)/1000, 0.1)) % (2*Math.PI);
    }
    previousTime = time;
    draw();
    frameRequest = requestAnimationFrame(animate);
}

function rebuildSurface() {
    const nu = Number(document.getElementById('u-segments').value);
    const nv = Number(document.getElementById('v-segments').value);
    document.getElementById('u-value').value = nu;
    document.getElementById('v-value').value = nv;
    const data = CreateSurfaceData(nu, nv);
    surface.BufferData(data);
    document.getElementById('mesh-info').textContent =
        'Вершин: ' + data.vertices.length/3 + ' · Трикутників: ' + data.indices.length/3 +
        ' · Розбиття: ' + nu + ' × ' + nv;
    draw();
}

function initialView() {
    spaceball.setView(0, [4, 6, 2.5], [0, 0, 1]);
    draw();
}

function saveImage() {
    draw();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gl.canvas.width;
    exportCanvas.height = gl.canvas.height + 70;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(gl.canvas, 0, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('PA2 — Kiss Surface · Variant 19 · Oleh Khomenko · TR-62mp', 20, 27);
    ctx.font = '15px Arial';
    ctx.fillStyle = '#85c9dd';
    ctx.fillText('Phong shading · Analytic normals · Ambient + Diffuse + Specular', 20, 52);
    exportCanvas.toBlob(function(blob) {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'PA2_Khomenko_TR62mp.png';
        link.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
}

function createProgram(gl, vertexSource, fragmentSource) {
    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(message);
        }
        return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
}

function init() {
    try {
        const canvas = document.getElementById('webglcanvas');
        gl = canvas.getContext('webgl', {antialias: true});
        if (!gl) throw new Error('Браузер не підтримує WebGL. Перевірте апаратне прискорення.');
        shProgram = new ShaderProgram('Phong', createProgram(gl, vertexShaderSource, fragmentShaderSource));
        lightProgram = {prog: createProgram(gl, lightVertexSource, lightFragmentSource)};
        lightProgram.vertex = gl.getAttribLocation(lightProgram.prog, 'vertex');
        lightProgram.matrix = gl.getUniformLocation(lightProgram.prog, 'ModelViewProjectionMatrix');
        lightBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, lightBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, 3*4, gl.DYNAMIC_DRAW);
        gl.enable(gl.DEPTH_TEST);
        surface = new Model('Kiss Surface');
        rebuildSurface();
        spaceball = new TrackballRotator(canvas, draw, 0);
        initialView();
        for (const id of ['u-segments', 'v-segments']) {
            document.getElementById(id).addEventListener('input', rebuildSurface);
        }
        for (const id of ['ambient', 'diffuse', 'specular']) {
            document.getElementById(id).addEventListener('change', draw);
        }
        document.getElementById('pause-light').addEventListener('click', function() {
            lightRunning = !lightRunning;
            this.textContent = lightRunning ? 'Зупинити світло' : 'Продовжити рух світла';
            this.setAttribute('aria-pressed', String(!lightRunning));
            document.querySelector('.light-label').textContent = lightRunning ?
                '● Джерело світла рухається по колу' : '● Рух світла зупинено';
        });
        document.getElementById('reset-view').addEventListener('click', initialView);
        document.getElementById('front-view').addEventListener('click', function() {
            spaceball.setView(0, [0, 1, 0], [0, 0, 1]);
            draw();
        });
        document.getElementById('save-image').addEventListener('click', saveImage);
        window.addEventListener('resize', draw);
        document.addEventListener('visibilitychange', function() { previousTime = null; });
        canvas.addEventListener('webglcontextlost', function(event) {
            event.preventDefault();
            cancelAnimationFrame(frameRequest);
            showError('WebGL-контекст втрачено. Оновіть сторінку для відновлення.');
        });
        frameRequest = requestAnimationFrame(animate);
    } catch (error) {
        showError(String(error));
        console.error(error);
    }
}

function showError(message) {
    const error = document.getElementById('error');
    error.textContent = message;
    error.hidden = false;
}
