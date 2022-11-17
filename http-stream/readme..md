# WavStream
Copyright 2022 Moddable Tech, Inc.<BR>
Revised: November 17, 2022

The `WavStream` class plays an uncompressed WAV audio file streamed over HTTP. It uses the following modules:

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

## API reference

### `constructor(options)`

The options object may contain the following properties. Only the `http`, `host`, `path`, `audio.out`, and `audio.sampleRate` properties are required.

- `http` - the HTTP client configuration. This usually comes from the host provider at `device.network.http`
- `host` - the HTTP host to connect to stream from
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
