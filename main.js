'use strict';

// Based on the PA1 skeleton by Anatoliy Demchyshyn (ademch/WebGL).
let gl;
let surface;
let shProgram;
let spaceball;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.iAttribVertex = gl.getAttribLocation(program, 'vertex');
    this.iColor = gl.getUniformLocation(program, 'color');
    this.iModelViewProjectionMatrix = gl.getUniformLocation(program, 'ModelViewProjectionMatrix');
    this.Use = function() { gl.useProgram(this.prog); };
}

function draw() {
    if (!gl || !spaceball || gl.isContextLost()) return;
    const canvas = gl.canvas;
    // TrackballRotator uses CSS mouse coordinates: keep canvas units the same.
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
    // The lecture's near/far = 8/12 and distance = 10 enclose radius sqrt(3).
    // Widen vertical FOV in portrait layouts to keep the surface inside the view.
    const fov = 2 * Math.atan(Math.tan(Math.PI / 16) / Math.min(1, aspect));
    const projection = m4.perspective(fov, aspect, 8, 12);
    const modelView = spaceball.getViewMatrix();
    const translation = m4.translation(0, 0, -10);
    const translatedView = m4.multiply(translation, modelView);
    const modelViewProjection = m4.multiply(projection, translatedView);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    surface.Draw(document.getElementById('show-u').checked,
                 document.getElementById('show-v').checked);
}

function rebuildSurface() {
    const nu = Number(document.getElementById('u-segments').value);
    const nv = Number(document.getElementById('v-segments').value);
    document.getElementById('u-value').value = nu;
    document.getElementById('v-value').value = nv;
    const data = CreateSurfaceData(nu, nv);
    surface.BufferData(data);
    const vertices = (data.uVertices.length + data.vVertices.length) / 3;
    document.getElementById('mesh-info').textContent =
        'U: ' + data.uLines.length + ' поліліній × ' + (nu + 1) + ' вершин; ' +
        'V: ' + data.vLines.length + ' поліліній × ' + (nv + 1) + ' вершин. ' +
        'Разом у двох буферах: ' + vertices + ' вершин.';
    draw();
}

function initialView() {
    // The surface's z axis points upwards. Rotation affects the view only.
    spaceball.setView(0, [4, 6, 2.5], [0, 0, 1]);
    draw();
}

function saveImage() {
    draw();
    // Export the actual WebGL render, with the name and U/V legend.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gl.canvas.width;
    exportCanvas.height = gl.canvas.height + 70;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(gl.canvas, 0, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('PA1 — Kiss Surface · Variant 19 · Oleh Khomenko · TR-62mp', 20, 27);
    ctx.font = '15px Arial';
    ctx.fillStyle = '#ffc25c';
    ctx.fillText('U curves: u varies, v fixed', 20, 52);
    ctx.fillStyle = '#55d8f0';
    ctx.fillText('V curves: v varies, u fixed', 245, 52);
    exportCanvas.toBlob(function(blob) {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'PA1_Khomenko_TR62mp.png';
        link.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
}

function createProgram(gl, vShader, fShader) {
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
    const vsh = compile(gl.VERTEX_SHADER, vShader);
    const fsh = compile(gl.FRAGMENT_SHADER, fShader);
    const program = gl.createProgram();
    gl.attachShader(program, vsh);
    gl.attachShader(program, fsh);
    gl.linkProgram(program);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
}

function init() {
    try {
        const canvas = document.getElementById('webglcanvas');
        gl = canvas.getContext('webgl', {antialias: true});
        if (!gl) throw new Error('Браузер не підтримує WebGL. Перевірте апаратне прискорення.');
        shProgram = new ShaderProgram('Basic', createProgram(gl, vertexShaderSource, fragmentShaderSource));
        shProgram.Use();
        gl.enable(gl.DEPTH_TEST);
        surface = new Model('Kiss Surface');
        rebuildSurface();
        spaceball = new TrackballRotator(canvas, draw, 0);
        initialView();
        for (const id of ['u-segments', 'v-segments']) {
            document.getElementById(id).addEventListener('input', rebuildSurface);
        }
        for (const id of ['show-u', 'show-v']) {
            document.getElementById(id).addEventListener('change', draw);
        }
        document.getElementById('reset-view').addEventListener('click', initialView);
        document.getElementById('front-view').addEventListener('click', function() {
            spaceball.setView(0, [0, 1, 0], [0, 0, 1]);
            draw();
        });
        document.getElementById('save-image').addEventListener('click', saveImage);
        window.addEventListener('resize', draw);
        canvas.addEventListener('webglcontextlost', function(event) {
            event.preventDefault();
            showError('WebGL-контекст втрачено. Оновіть сторінку, щоб відновити зображення.');
        });
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

