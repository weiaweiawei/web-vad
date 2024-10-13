import { Message, log, Resampler } from "./_common";
class Processor extends AudioWorkletProcessor {
    // @ts-ignore
    resampler;
    _initialized = false;
    _stopProcessing = false;
    options;
    constructor(options) {
        super();
        this.options = options.processorOptions;
        this.port.onmessage = (ev) => {
            if (ev.data.message === Message.SpeechStop) {
                this._stopProcessing = true;
            }
        };
        this.init();
    }
    init = async () => {
        log.debug("initializing worklet");
        this.resampler = new Resampler({
            nativeSampleRate: sampleRate,
            targetSampleRate: 16000,
            targetFrameSize: this.options.frameSamples,
        });
        this._initialized = true;
        log.debug("initialized worklet");
    };
    process(inputs, outputs, parameters) {
        if (this._stopProcessing) {
            return false;
        }
        // @ts-ignore
        const arr = inputs[0][0];
        if (this._initialized && arr instanceof Float32Array) {
            const frames = this.resampler.process(arr);
            for (const frame of frames) {
                this.port.postMessage({ message: Message.AudioFrame, data: frame.buffer }, [frame.buffer]);
            }
        }
        return true;
    }
}
registerProcessor("vad-helper-worklet", Processor);
//# sourceMappingURL=worklet.js.map