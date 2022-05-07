/*
	Streaming from local audio samples
	
		queue audio samples in chunks
		keep about one second of audio queued
		audio queued as raw samples (skips MAUD header)
		calcuates RMS of each block after dequeuing

		streaming from a resource is not needed for playback: the full resource could be queued.
		streaming is done here to demonstrate streaming audio independent of network.
		streaming is convenient for calculating power in increments
		reading from a resource could be replaced with reading from a file  
 */

import AudioOut from "pins/audioout"
import Resource from "Resource";

const samples = new Resource("googletts_16bit_mono_11025hz.maud");
samples.position = 12;		// skip maud header

const sampleRate = 11025;
const bytesPerSample = 2;
const targetBytesQueued = sampleRate * bytesPerSample;
const bytesPerBlock = Math.idiv(targetBytesQueued, 8);
if (bytesPerBlock % bytesPerSample)
	throw new Error("invalid bytesPerBlock")
let bytesQueued = 0; 

const audio = new AudioOut({});
audio.playing = [];
audio.callback = function(bytes) {
	if (!bytes) {
		trace('...done\n');
		return;
	}
	bytesQueued -= bytes;
	const played = this.playing.shift();
	const power = calculatePower(played);
	trace("power " + power + "\n");
	fillQueue();
};
fillQueue();
audio.start();

function fillQueue() {
	while ((bytesQueued < targetBytesQueued) &&
			(samples.position < samples.byteLength) &&
			(audio.length(0) >= 2)) {
		const use = Math.min(targetBytesQueued - bytesQueued, bytesPerBlock);
		const slice = samples.slice(samples.position, samples.position + use, false);
		samples.position += slice.byteLength;
		audio.enqueue(0, AudioOut.RawSamples, slice, 1, 0, slice.byteLength / bytesPerSample);
		audio.enqueue(0, AudioOut.Callback, slice.byteLength);
		bytesQueued += slice.byteLength;
		audio.playing.push(slice);
		if (samples.position === samples.byteLength)
			audio.enqueue(0, AudioOut.Callback, 0);
	}
}

function calculatePower(samplea) @ "xs_calculatePower";
