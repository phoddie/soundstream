/*
 * Copyright (c) 2022  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 * 
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 * 
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 * 
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
 
 /*
	Streaming from http
	
		uses Ecma-419 HTTPClient implementation (much better for streaming)
		collects received audio into fixed size block (bytesPerBlock)
		tries to top-up queue after audio buffer played and when new network data received
		audio queue target is one second of audio
		calcuates RMS of each block after dequeuing
*/

import WavReader from "data/wavreader";

class WavStreamer {
	#audio;
	#stream;
	#http;
	#request;
	#playing = [];
	#ready;		// undefined while initializing, false if not buffered / playing, true if buffers full to play / playing
	#next;
	#bytes = 0;		// remaining in stream
	#bytesQueued = 0;
	#targetBytesQueued;
	#bytesPerSample = 2;
	#bytesPerBlock;
	#callbacks = [];
	#pending = [];

	constructor(options) {
		const waveHeaderBytes = options.waveHeaderBytes ?? 512;
		const sampleRate = options.audio.sampleRate;
		this.#targetBytesQueued = sampleRate * this.#bytesPerSample;
		this.#bytesPerBlock = Math.idiv(this.#targetBytesQueued, 8);
		if (this.#bytesPerBlock % this.#bytesPerSample)
			throw new Error("invalid bytesPerBlock")

		if (options.onPlayed)
			this.#callbacks.onPlayed = options.onPlayed;
		if (options.onReady)
			this.#callbacks.onReady = options.onReady;
		if (options.onError)
			this.#callbacks.onError = options.onError;
		if (options.onDone)
			this.#callbacks.onDone = options.onDone;

		this.#http = new options.http.io({
			...options.http,
			host: options.host
		});
		this.#request = this.#http.request({
			path: options.path,
			onHeaders: (status, headers) => {
				if (2 !== Math.idiv(status, 100))
					this.#callbacks.onError?.("http request failed, status " + status);
			},
			onReadable: (count) => {
				this.#request.readable = count;
				if (undefined === this.#ready) {
					if (count < waveHeaderBytes)
						return;

					const buffer = this.#request.read(waveHeaderBytes);
					const wav = new WavReader(buffer);
					if (1 !== wav.audioFormat)
						throw new Error("unsupported format");
					if (sampleRate !== wav.sampleRate)
						throw new Error("incompatble sampleRate");
					if (16 !== wav.bitsPerSample)
						throw new Error("incompatible bitsPerSample");

					this.#ready = false;	

					this.#request.readable -= waveHeaderBytes;
					this.#next = new Uint8Array(new SharedArrayBuffer(this.#bytesPerBlock));
					this.#next.set(new Uint8Array(buffer, wav.position));
					this.#next.position = waveHeaderBytes - wav.position;

					this.#bytes = (wav.samples << 1) - this.#next.position;
				}
				this.#fillQueue();
			},
			onDone: () => {
				this.#audio.enqueue(this.#stream, this.#audio.constructor.Callback, 0);
			},
			onError: e => {
				this.#callbacks.onError?.(e);
			}
		});

		const audio = options.audio.out;
		this.#audio = audio;
		this.#stream = options.audio.stream ?? 0;
		audio.callbacks ??= [];
		audio.callbacks[this.#stream] = bytes => {
			if (!bytes) {
				this.#callbacks.onDone?.();
				return;
			}

			this.#bytesQueued -= bytes;
			let played = this.#playing.shift();
			this.#callbacks.onPlayed?.(played);
			played = undefined;

			this.#fillQueue();
			if (0 === this.#bytesQueued) {
				this.#ready = false;
				this.#pending = [];
				this.#callbacks.onReady?.(false);
			}
		};
	}
	close() {
		this.#audio.enqueue(this.#stream, this.#audio.constructor.Flush);
		this.#audio.callbacks[this.#stream] = undefined;
		
		this.#http.close();
		this.#http = this.#audio = undefined;
	}
	#fillQueue() {
		while ((this.#bytesQueued < this.#targetBytesQueued) &&
				this.#request.readable &&
				(this.#audio.length(this.#stream) >= 2)) {
			let next = this.#next;
			if (!next) {
				this.#next = next = new Uint8Array(new SharedArrayBuffer(this.#bytesPerBlock));
				next.position = 0;
			}

			const use = Math.min(next.byteLength - next.position, this.#request.readable);
			this.#request.read(next.subarray(next.position, next.position + use));
			this.#request.readable -= use;
			next.position += use;
			this.#bytes -= use;
			if ((next.position === next.byteLength) || !this.#bytes) {
				if (this.#pending)
					this.#pending.push(next);
				else {
					this.#audio.enqueue(this.#stream, this.#audio.constructor.RawSamples, next.buffer, 1, 0, next.position / this.#bytesPerSample);
					this.#audio.enqueue(this.#stream, this.#audio.constructor.Callback, next.position);
					this.#playing.push(next);
				}
				this.#bytesQueued += next.position;
				this.#next = undefined;
			}
		}

		if (!this.#ready && (this.#bytesQueued >= this.#targetBytesQueued)) {
			this.#ready = true;

			while (this.#pending.length) {
				const next = this.#pending.shift();
				this.#audio.enqueue(this.#stream, this.#audio.constructor.RawSamples, next.buffer, 1, 0, next.position / this.#bytesPerSample);
				this.#audio.enqueue(this.#stream, this.#audio.constructor.Callback, next.position);
				this.#playing.push(next);
			}
			this.#pending = undefined;

			this.#callbacks.onReady?.(true);
		}
	}
}

export default WavStreamer;
