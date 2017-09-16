#!/usr/bin/env node
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const PNG = require('pngjs').PNG;
const glsl = require('glslify');
const path = require('path');

const OUTPUT_SIZE = argv.size !== undefined ? argv.size : 512;
const NOISE_SCALE = argv.noise_scale !== undefined ? argv.noise_scale : 1.0;
const LOOP_RADIUS = argv.loop_radius !== undefined ? argv.loop_radius : Math.PI;
const TIME = argv.t !== undefined ? argv.t : 0.0;
const OUTPUT_FILE = `/noise_${OUTPUT_SIZE}_${TIME.toFixed(8)}.png`
const OUTPUT_PATH = argv.o !== undefined ? path.resolve(process.cwd(), argv.o) : path.resolve(process.cwd(), OUTPUT_FILE);

console.log(OUTPUT_PATH);

// if no arguments passed, display help
if(Object.keys(argv).length === 1) {
	console.log(`
noisemaker
+ + +

options:
-size [512]	        png output size in pixels, always square
-noise_scale [1.0]	scale of noise, bigger number = higher frequency
-t [0.0]	          timestamp to render in noise field, like a seed you can fade
-o [./noise_...]	  output path relative to current location for png

	`);
	return false;
}

const VERT_SHADER = glsl(argv.vert !== undefined ? argv.vert : './shaders/default.vert');
const FRAG_SHADER = glsl(argv.frag !== undefined ? argv.frag : './shaders/default.frag');



const gl = require('headless-gl')(OUTPUT_SIZE, OUTPUT_SIZE);

gl.clearColor(0,0,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

function createShader(str, type) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, str);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw gl.getShaderInfoLog(shader);
	}
	return shader;
}

function createProgram(vstr, fstr) {
	var program = gl.createProgram();
	var vshader = createShader(vstr, gl.VERTEX_SHADER);
	var fshader = createShader(fstr, gl.FRAGMENT_SHADER);
	gl.attachShader(program, vshader);
	gl.attachShader(program, fshader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw gl.getProgramInfoLog(program);
	}
	return program;
}

// Create a two triangle plane that fills the viewport
var boxSize = 1.;

var arrays = {
  position: [-boxSize, -boxSize, 0, boxSize, -boxSize, 0, -boxSize, boxSize, 0, -boxSize, boxSize, 0, boxSize, -boxSize, 0, boxSize, boxSize, 0],
};

var vertexPosBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
var vertices = arrays.position;
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

var program = createProgram(VERT_SHADER,FRAG_SHADER);
gl.useProgram(program);
program.timeUniform = gl.getUniformLocation(program, 'uTime');
program.resolutionUniform = gl.getUniformLocation(program, 'uResolution');

program.seedUniform = gl.getUniformLocation(program, 'uSeed');
program.vertexPosAttrib = gl.getAttribLocation(program, 'position');

function padToFour(number) {
	let n = '';
  if (Math.abs(number)<=9999) {
		n = ("000"+Math.abs(number)).slice(-4);
	}
	if(number < 0) {
		n = `-${n}`;
	}
  return n;
}

function render() {

	// set uniforms
	gl.uniform2f(program.resolutionUniform, OUTPUT_SIZE, OUTPUT_SIZE);
	gl.uniform1f(program.timeUniform, TIME*.005);
	gl.uniform2f(program.seedUniform, TIME, TIME);

	// setup screen tile
	gl.enableVertexAttribArray(program.vertexPosAttrib);
	gl.vertexAttribPointer(program.vertexPosAttrib, 3, gl.FLOAT, false, 0, 0);

	// draw the loaded program to the screen
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	// read the render buffer back
	// const pixels = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE * 4);
	const png = new PNG({ width: OUTPUT_SIZE, height: OUTPUT_SIZE });
	gl.readPixels(0, 0, OUTPUT_SIZE, OUTPUT_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, png.data);

	png.pack().pipe(fs.createWriteStream(OUTPUT_PATH));
}

render();
