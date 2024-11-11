import * as ortInstance from "onnxruntime-web";
import { log, Message, Silero, defaultFrameProcessorOptions, FrameProcessor, validateOptions, } from "./_common";
import { defaultModelFetcher } from "./default-model-fetcher";
// @ts-ignore
const onnxFile = new URL("./silero_vad.onnx", import.meta.url).href;
const workletURL = new URL("./worklet.js", import.meta.url).href;
export const ort = ortInstance;
export const defaultRealTimeVADOptions = {
    ...defaultFrameProcessorOptions,
    onFrameProcessed: (probabilities, speaking) => { },
    onVADMisfire: () => {
        log.debug("VAD misfire");
    },
    onSpeechStart: () => {
        log.debug("Detected speech start");
    },
    onSpeechEnd: () => {
        log.debug("Detected speech end");
    },
    // workletURL: assetPath("vad.worklet.bundle.min.js"),
    // modelURL: assetPath("silero_vad.onnx"),
    workletURL: new URL("./vad.worklet.bundle.min.js", import.meta.url).href,
    modelURL: new URL("./silero_vad.onnx", import.meta.url).href,
    modelFetcher: defaultModelFetcher,
    stream: undefined,
    ortConfig: undefined,
};
const loadModel = async () => {
    try {
        console.error(`加载工作单元onnxFileonnxFileonnxFile时出错。请确保 ${onnxFile} 可用。`);
        return await Silero.new(ortInstance, async () => {
            console.log("model 正在加载....1");
            const response = await fetch(onnxFile);
            console.log("model 正在加载....2", response);
            if (!response.ok) {
                throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
            }
            return response.arrayBuffer();
        });
    }
    catch (e) {
        console.error(`加载模型文件时出错。请确保 ${onnxFile} 可用。`);
        throw e;
    }
};
const loadAudioWorklet = async (ctx, fullOptions) => {
    try {
        await ctx.audioWorklet.addModule(workletURL);
    }
    catch (e) {
        console.error(`加载工作单元时出错。请确保 ${workletURL} 可用。`);
        throw e;
    }
    return new AudioWorkletNode(ctx, "vad-worklet", {
        processorOptions: {
            frameSamples: fullOptions.frameSamples,
        },
    });
};
export class MicVAD {
    options;
    audioContext;
    stream;
    audioNodeVAD;
    sourceNode;
    listening;
    static async new(options = {}) {
        const fullOptions = {
            ...defaultRealTimeVADOptions,
            ...options,
        };
        validateOptions(fullOptions);
        let stream;
        if (fullOptions.stream === undefined)
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    ...fullOptions.additionalAudioConstraints,
                    channelCount: 1,
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true,
                },
            });
        else
            stream = fullOptions.stream;
        const audioContext = new AudioContext();
        const sourceNode = new MediaStreamAudioSourceNode(audioContext, {
            mediaStream: stream,
        });
        const audioNodeVAD = await AudioNodeVAD.new(audioContext, fullOptions);
        audioNodeVAD.receive(sourceNode);
        return new MicVAD(fullOptions, audioContext, stream, audioNodeVAD, sourceNode);
    }
    constructor(options, audioContext, stream, audioNodeVAD, sourceNode, listening = false) {
        this.options = options;
        this.audioContext = audioContext;
        this.stream = stream;
        this.audioNodeVAD = audioNodeVAD;
        this.sourceNode = sourceNode;
        this.listening = listening;
    }
    pause = () => {
        this.audioNodeVAD.pause();
        this.listening = false;
    };
    start = () => {
        this.audioNodeVAD.start();
        this.listening = true;
    };
    destroy = () => {
        if (this.listening) {
            this.pause();
        }
        if (this.options.stream === undefined) {
            this.stream.getTracks().forEach((track) => track.stop());
        }
        this.sourceNode.disconnect();
        this.audioNodeVAD.destroy();
        this.audioContext.close();
    };
}
export class AudioNodeVAD {
    ctx;
    options;
    frameProcessor;
    entryNode;
    static async new(ctx, options = {}) {
        const fullOptions = {
            ...defaultRealTimeVADOptions,
            ...options,
        };
        validateOptions(fullOptions);
        console.log("fullOptions-参数11111", fullOptions);
        if (fullOptions.ortConfig !== undefined) {
            fullOptions.ortConfig(ort);
        }
        // try {
        //   await ctx.audioWorklet.addModule(fullOptions.workletURL);
        // } catch (e) {
        //   console.error("初始化worklet失败！！！");
        //   throw e;
        // }
        // const vadNode = new AudioWorkletNode(ctx, "vad-helper-worklet", {
        //   processorOptions: {
        //     frameSamples: fullOptions.frameSamples,
        //   },
        // });
        // let model: Silero;
        // try {
        //   model = await Silero.new(ort, () =>
        //     fullOptions.modelFetcher(fullOptions.modelURL)
        //   );
        // } catch (e) {
        //   console.error("初始化模型失败！！！");
        //   throw e;
        // }
        try {
            await ctx.audioWorklet.addModule(fullOptions.workletURL);
        }
        catch (e) {
            console.error("初始化worklet失败！！！");
            throw e;
        }
        const vadNode = new AudioWorkletNode(ctx, "vad-helper-worklet", {
            processorOptions: {
                frameSamples: fullOptions.frameSamples,
            },
        });
        let model;
        try {
            model = await Silero.new(ort, () => fullOptions.modelFetcher(fullOptions.modelURL));
        }
        catch (e) {
            console.error("初始化模型失败！！！");
            throw e;
        }
        // // // 加载音频工作单元 worklet
        // const vadNode = await loadAudioWorklet(ctx, fullOptions);
        // // // 初始化模型
        // const model = await loadModel();
        const frameProcessor = new FrameProcessor(model.process, model.reset_state, {
            frameSamples: fullOptions.frameSamples,
            positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
            negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
            redemptionFrames: fullOptions.redemptionFrames,
            preSpeechPadFrames: fullOptions.preSpeechPadFrames,
            minSpeechFrames: fullOptions.minSpeechFrames,
            submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
        });
        const audioNodeVAD = new AudioNodeVAD(ctx, fullOptions, frameProcessor, vadNode);
        vadNode.port.onmessage = async (ev) => {
            switch (ev.data?.message) {
                case Message.AudioFrame:
                    const buffer = ev.data.data;
                    const frame = new Float32Array(buffer);
                    await audioNodeVAD.processFrame(frame);
                    break;
                default:
                    break;
            }
        };
        return audioNodeVAD;
    }
    constructor(ctx, options, frameProcessor, entryNode) {
        this.ctx = ctx;
        this.options = options;
        this.frameProcessor = frameProcessor;
        this.entryNode = entryNode;
    }
    pause = () => {
        const ev = this.frameProcessor.pause();
        this.handleFrameProcessorEvent(ev);
    };
    start = () => {
        this.frameProcessor.resume();
    };
    receive = (node) => {
        node.connect(this.entryNode);
    };
    processFrame = async (frame) => {
        const ev = await this.frameProcessor.process(frame); // 处理每一帧数据，来判断是否有中断之类的 以及开始,它这里面有个累积的数据
        this.handleFrameProcessorEvent(ev);
    };
    handleFrameProcessorEvent = (ev) => {
        if (ev.probs !== undefined) {
            this.options.onFrameProcessed(ev.probs, ev.speaking);
        }
        switch (ev.msg) {
            case Message.SpeechStart:
                this.options.onSpeechStart(ev.audio);
                break;
            case Message.VADMisfire:
                this.options.onVADMisfire();
                break;
            case Message.SpeechEnd:
                this.options.onSpeechEnd(ev.audio);
                break;
            default:
                break;
        }
    };
    destroy = () => {
        this.entryNode.port.postMessage({
            message: Message.SpeechStop,
        });
        this.entryNode.disconnect();
    };
}
//# sourceMappingURL=real-time-vad.js.map