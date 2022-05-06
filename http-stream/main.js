/*
	Streaming from http
	
		uses Ecma-419 HTTPClient implementation (much better for streaming)
		collects received audio into fixed size block (bytesPerBlock)
		tries to top-up queue after audio buffer played and when new network data received
		audio queue target is one second of audio
		calcuates RMS of each block after dequeuing

	To do

		handle network stalls (stop, fill buffer, start)
		queue last audio fragment (next.position) 
		skip WAV header
	
*/

import AudioOut from "pins/audioout"
import HTTPRequest from "embedded:network/http/request";

const http = new HTTPRequest({
//	host: "localhost",
	host: "10.0.1.11"
});
const request = http.request({
	path: "/googletts_16bit_mono_11025hz.wav",
	onHeaders(status, headers) {
		if (2 !== Math.idiv(status, 100))
			trace("http request failed\n");
	},
	onReadable(count) {
		this.readable = count;
		fillQueue();
	},
	onDone() {
		//@@ queue .next
		audio.enqueue(0, AudioOut.Callback, 0);
	}
});

const sampleRate = 11025;
const bytesPerSample = 2;
const targetBytesQueued = sampleRate * bytesPerSample;
const bytesPerBlock = Math.idiv(targetBytesQueued, 8);
if (bytesPerBlock % bytesPerSample)
	throw new Error("invalid bytesPerBlock")
let bytesQueued = 0; 

const audio = new AudioOut({});
audio.playing = [];
audio.stopped = true;

audio.callback = function(bytes) {
	if (!bytes) {
		trace('...done\n');
		return;
	}
	bytesQueued -= bytes;
	const played = this.playing.shift();
	const power = calculatePower(played);
	trace("power " + Math.round(power) + "\n");
	fillQueue();
};
audio.start();

function fillQueue() {
	while ((bytesQueued < targetBytesQueued) &&
			request.readable &&
			(audio.length(0) >= 2)) {
		let next = audio.next;
		if (!next) {
			audio.next = next = new Uint8Array(new SharedArrayBuffer(bytesPerBlock));
			next.position = 0;
		}

		const use = Math.min(next.byteLength - next.position, request.readable);
		const slice = request.read(use);
		request.readable -= use;

		next.set(new Uint8Array(slice), next.position);
		next.position += use;
		if (next.position === next.byteLength) {		//@@ or end of stream
			audio.enqueue(0, AudioOut.RawSamples, next.buffer, 1, 0, next.byteLength / bytesPerSample);
			audio.enqueue(0, AudioOut.Callback, next.byteLength);
			bytesQueued += next.byteLength;
			audio.playing.push(next);
			delete audio.next;
		}
	}

	if (audio.stopped && (bytesQueued >= targetBytesQueued)) {
		audio.start();
		audio.stopped = false;
	}
}

function calculatePower(samplea) @ "xs_calculatePower";
