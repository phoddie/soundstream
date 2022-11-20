# WavStream
Copyright 2022 Moddable Tech, Inc.<BR>
Revised: November 20, 2022

The `WavStream` class plays an uncompressed WAV audio files and Audio/L16 streams delivered over HTTP. It uses the following modules:

- `HTTPClient` from ECMA-419 2nd Edition (draft). The API design of the HTTP request makes buffering of streaming data very straightforward.
- `AudioOut` class for audio playback
- `WavReader` class to parse the header of the received WAV file

The API itself follows the ECMA-419 style as much as possible, including passing in the full HTTP configuration (with any necessary constructors) and all callbacks.

The `AudioOut` instances is not created by `WavStream` but provided by the calling script. The `WavStream` instances plays to a specified stream of the audio output. Any other streams are available for other uses (including additional instances of `WavStream`).

The following is a simple example of using `WavStream` to play a stream.

```js
const audio = new AudioOut({});

new WavStreamer({
	http: device.network.http,
	host: "www.example.com",
	path: "/myaudio_11025.wav",
	audio: {
		out: audio,
		sampleRate: 11025
	}
});

audio.start();
```

The `WavStream` class provides many callbacks to manage the streaming session, such as notification of streaming stalls and playback completion. They are documented below as part of the options object of the constructor.

The `WavStream` tries to keep about one second of audio buffers queued with the audio output. Once it has buffered once second, playback begins. When the buffered bytes drops to 0, playback stops until one second of audio is again buffered.

The `HTTPClient` does not yet implement `TLS`. When it does, `WavStream` will support streaming over HTTPS.

### `Audio/L16` Streams
Uncompressed audio streams are the data portion of a WAVE file with the sample rate and channel count specified in the MIME type. These are useful for live-streaming of uncompressed audio, and is also used for live transcoding of compressed data to lightweight clients. It is specified by [RFC 2586](https://datatracker.ietf.org/doc/html/rfc2586). The data is delivered in network byte order (big-endian). The WaveStreamer implementation converts it to little-endian for playback.

The following command line allows ffmpeg to act as simple server for testing Audio/L16 streaming.

```
ffmpeg -i bflatmajor.wav -listen 1 -content_type "audio/L16;rate=11025&channels=2" -f s16be -ar 11025 -acodec pcm_s16be http://127.0.0.1:8080
```

### Stereo Streams
`WavStream` accepts stereo data and converts mixes it to mono for playback. This is provided for compatibility with existing audio sources as it is clearly not an optimal use of network bandwidth.


## API reference

### `constructor(options)`

The options object may contain the following properties. Only the `http`, `host`, `path`, `audio.out`, and `audio.sampleRate` properties are required.

- `http` - the HTTP client configuration. This usually comes from the host provider at `device.network.http`
- `host` - the HTTP host to connect to stream from
- `port` - the remote port to connect to
- `path` - the path of the HTTP resource to review
- `audio.out` - the audio output instance to play the audio on
- `audio.sampleRate` - the expected sample rate of the WAV file
- `audio.stream` - the stream number of the audio output to use to play the audio. Defaults to `0`.
- `waveHeaderBytes` - the number of bytes to buffer before trying to parse the WAV header. Defaults to `512`
- `onPlayed(buffer)` - callback function invoked after the audio output is done with an audio buffer. This callback is useful for calculating the RMS of audio that is playing
- `onReady(ready)` - callback function invoked with `true` when there is enough audio buffered to be able to begin playback and `false` when there is an audio buffer underflow
- `onError(e)` - callback function invoked on a fatal error, such as the remote endpoint disconnecting
- `onDone()` - callback function invoked when `WavStream` determines that the complete WAV stream has been successfully played

### `close()`

Stops playback on the specified stream and frees all resources.
