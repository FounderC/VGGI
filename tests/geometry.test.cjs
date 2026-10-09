const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../model.js'), 'utf8');
const context = vm.createContext({Float32Array, Math, Number, RangeError});
vm.runInContext(code, context);

test('vertices satisfy the independent implicit equation; bounds and poles are correct', function() {
    for (const nu of [8, 12, 48, 96]) for (const nv of [8, 20, 48, 96]) {
        const data = context.CreateSurfaceData(nu, nv);
        for (const a of [data.uVertices, data.vVertices]) {
            for (let i = 0; i < a.length; i += 3) {
                const [x, y, z] = a.slice(i, i + 3);
                assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
                assert.ok(z >= -1 && z <= 1);
                assert.ok(Math.abs(x*x + y*y - (1-z)*z**4) < 1e-6);
                assert.ok(x*x + y*y + z*z <= 3.000001);
            }
        }
    }
    assert.deepEqual(Array.from(context.KissPoint(1, 0)), [0, 0, 0]);
    assert.deepEqual(Array.from(context.KissPoint(1, 1)), [0, 0, 1]);
    assert.ok(Math.abs(context.KissPoint(0, -1)[0] - Math.SQRT2) < 1e-14);
    assert.throws(() => context.CreateSurfaceData(0, 48), RangeError);
    assert.throws(() => context.CreateSurfaceData(48, 2.5), RangeError);
});

test('each U strip closes at a constant height and both sets share the same grid', function() {
    const nu = 48, nv = 48;
    const d = context.CreateSurfaceData(nu, nv);
    for (const line of d.uLines) {
        const a = d.uVertices.slice(3*line.first, 3*(line.first+line.count));
        assert.deepEqual(a.slice(0, 3), a.slice(-3));
        for (let p = 2; p < a.length; p += 3) assert.equal(a[p], a[2]);
    }
    for (let i = 0; i < nu; ++i) for (let j = 0; j <= nv; ++j) {
        const a = 3*(d.uLines[j].first+i);
        const b = 3*(d.vLines[i].first+j);
        assert.deepEqual(d.uVertices.slice(a,a+3), d.vVertices.slice(b,b+3));
    }
    assert.equal((d.uVertices.length + d.vVertices.length)/3, 4753);
});

test('actual Model.Draw calls stay within buffers and restart the strip for each curve', function() {
    let bound, next = 0;
    const buffers = new Map(), calls = [];
    const gl = {
        ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, FLOAT: 5126, LINE_STRIP: 3,
        createBuffer: () => ++next,
        bindBuffer: (_, b) => { bound = b; },
        bufferData: (_, a) => buffers.set(bound, a),
        vertexAttribPointer: (_, size, type, normalized, stride, offset) => {
            assert.equal(size, 3); assert.equal(stride, 0); assert.equal(offset, 0);
        },
        enableVertexAttribArray: () => {}, uniform4fv: () => {},
        drawArrays: (mode, first, count) => {
            assert.equal(mode, 3);
            assert.ok(first >= 0 && count >= 2 && 3*(first+count) <= buffers.get(bound).length);
            calls.push({buffer: bound, first, count});
        }
    };
    context.gl = gl; context.shProgram = {iAttribVertex: 0, iColor: 1};
    const model = new context.Model('test');
    const data = context.CreateSurfaceData(8, 12);
    model.BufferData(data); model.Draw(true, true);
    assert.equal(buffers.size, 2);
    assert.equal(calls.length, 13+8);
    for (const buffer of [model.uBuffer, model.vBuffer]) {
        let end = 0;
        for (const call of calls.filter(c => c.buffer === buffer)) {
            assert.equal(call.first, end);
            end += call.count;
        }
        assert.equal(end*3, buffers.get(buffer).length);
    }
    calls.length = 0; model.Draw(false, false); assert.equal(calls.length, 0);
    calls.length = 0; model.Draw(true, false); assert.equal(calls.length, 13);
    calls.length = 0; model.Draw(false, true); assert.equal(calls.length, 8);
    model.BufferData(context.CreateSurfaceData(96, 96));
    assert.equal(buffers.size, 2, 'sliders reuse existing buffers');
});
