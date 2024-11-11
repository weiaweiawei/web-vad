import * as ortInstance from "onnxruntime-web";
import {
  log,
  Message,
  Silero,
  SpeechProbabilities,
  defaultFrameProcessorOptions,
  FrameProcessor,
  FrameProcessorOptions,
  OrtOptions,
  validateOptions,
} from "./_common";
import { assetPath } from "./asset-path";
import { defaultModelFetcher } from "./default-model-fetcher";
// @ts-ignore
const onnxFile = new URL("./silero_vad.onnx", import.meta.url).href;

const workletURL = new URL("./worklet.js", import.meta.url).href;

interface RealTimeVADCallbacks {
  /** Callback to run after each frame. The size (number of samples) of a frame is given by `frameSamples`. */
  onFrameProcessed: (
    probabilities: SpeechProbabilities,
    speaking: boolean | undefined
  ) => any;
  onFrameProcessing?: (parsms: any) => any;

  /** Callback to run if speech start was detected but `onSpeechEnd` will not be run because the
   * audio segment is smaller than `minSpeechFrames`.
   */
  onVADMisfire: () => any;

  /** Callback to run when speech start is detected */
  onSpeechStart: (audio: Float32Array) => any;

  /**
   * Callback to run when speech end is detected.
   * Takes as arg a Float32Array of audio samples between -1 and 1, sample rate 16000.
   * This will not run if the audio segment is smaller than `minSpeechFrames`.
   */
  onSpeechEnd: (audio: Float32Array) => any;
}

/**
 * Customizable audio constraints for the VAD.
 * Excludes certain constraints that are set for the user by default.
 */
type AudioConstraints = Omit<
  MediaTrackConstraints,
  "channelCount" | "echoCancellation" | "autoGainControl" | "noiseSuppression"
>;

type AssetOptions = {
  workletURL: string;
  modelURL: string;
  modelFetcher: (path: string) => Promise<ArrayBuffer>;
};

interface RealTimeVADOptionsWithoutStream
  extends FrameProcessorOptions,
    RealTimeVADCallbacks,
    OrtOptions,
    AssetOptions {
  additionalAudioConstraints?: AudioConstraints;
  stream: undefined;
}

interface RealTimeVADOptionsWithStream
  extends FrameProcessorOptions,
    RealTimeVADCallbacks,
    OrtOptions,
    AssetOptions {
  stream: MediaStream;
}

export const ort = ortInstance;

export type RealTimeVADOptions =
  | RealTimeVADOptionsWithStream
  | RealTimeVADOptionsWithoutStream;

export const defaultRealTimeVADOptions: RealTimeVADOptions = {
  ...defaultFrameProcessorOptions,
  onFrameProcessed: (probabilities, speaking) => {},
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
  workletURL:  new URL("./vad.worklet.bundle.min.js", import.meta.url).href,
  modelURL: new URL("./silero_vad.onnx", import.meta.url).href,
  modelFetcher: defaultModelFetcher,
  stream: undefined,
  ortConfig: undefined,
};

const loadModel = async () => {
  try {
    console.error(
      `加载工作单元onnxFileonnxFileonnxFile时出错。请确保 ${onnxFile} 可用。`
    );
    return await Silero.new(ortInstance, async () => {
      console.log("model 正在加载....1");
      const response = await fetch(onnxFile);
      console.log("model 正在加载....2", response);
      if (!response.ok) {
        throw new Error(
          `Failed to load model: ${response.status} ${response.statusText}`
        );
      }
      return response.arrayBuffer();
    });
  } catch (e) {
    console.error(`加载模型文件时出错。请确保 ${onnxFile} 可用。`);
    throw e;
  }
};

const  loadAudioWorklet = async (
  ctx: AudioContext,
  fullOptions: RealTimeVADOptions
) => {
  try {
    await ctx.audioWorklet.addModule(workletURL);
  } catch (e) {
    console.error(
      `加载工作单元时出错。请确保 ${workletURL} 可用。`
    );
    throw e;
  }
  return new AudioWorkletNode(ctx, "vad-worklet", {
    processorOptions: {
      frameSamples: fullOptions.frameSamples,
    },
  });
}

export class MicVAD {
  static async new(options: Partial<RealTimeVADOptions> = {}) {
    const fullOptions: RealTimeVADOptions = {
      ...defaultRealTimeVADOptions,
      ...options,
    };
    validateOptions(fullOptions);

    let stream: MediaStream;
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
    else stream = fullOptions.stream;

    const audioContext = new AudioContext();
    const sourceNode = new MediaStreamAudioSourceNode(audioContext, {
      mediaStream: stream,
    });

    const audioNodeVAD = await AudioNodeVAD.new(audioContext, fullOptions);
    audioNodeVAD.receive(sourceNode);

    return new MicVAD(
      fullOptions,
      audioContext,
      stream,
      audioNodeVAD,
      sourceNode
    );
  }

  private constructor(
    public options: RealTimeVADOptions,
    private audioContext: AudioContext,
    private stream: MediaStream,
    private audioNodeVAD: AudioNodeVAD,
    private sourceNode: MediaStreamAudioSourceNode,
    private listening = false
  ) {}

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
  static async new(
    ctx: AudioContext,
    options: Partial<RealTimeVADOptions> = {}
  ) {
    const fullOptions: RealTimeVADOptions = {
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
    } catch (e) {
      console.error("初始化worklet失败！！！");
      throw e;
    }
    const vadNode = new AudioWorkletNode(ctx, "vad-helper-worklet", {
      processorOptions: {
        frameSamples: fullOptions.frameSamples,
      },
    });

    let model: Silero;

    try {
      model = await Silero.new(ort, () =>
        fullOptions.modelFetcher(fullOptions.modelURL)
      );
    } catch (e) {
      console.error("初始化模型失败！！！");
      throw e;
    }
    
    // // // 加载音频工作单元 worklet
    // const vadNode = await loadAudioWorklet(ctx, fullOptions);

    // // // 初始化模型
    // const model = await loadModel();

    const frameProcessor = new FrameProcessor(
      model.process,
      model.reset_state,
      {
        frameSamples: fullOptions.frameSamples,
        positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
        negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
        redemptionFrames: fullOptions.redemptionFrames,
        preSpeechPadFrames: fullOptions.preSpeechPadFrames,
        minSpeechFrames: fullOptions.minSpeechFrames,
        submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
      }
    );

    const audioNodeVAD = new AudioNodeVAD(
      ctx,
      fullOptions,
      frameProcessor,
      vadNode
    );

    vadNode.port.onmessage = async (ev: MessageEvent) => {
      switch (ev.data?.message) {
        case Message.AudioFrame:
          const buffer: ArrayBuffer = ev.data.data;
          const frame = new Float32Array(buffer);
          await audioNodeVAD.processFrame(frame);
          break;

        default:
          break;
      }
    };

    return audioNodeVAD;
  }

  constructor(
    public ctx: AudioContext,
    public options: RealTimeVADOptions,
    private frameProcessor: FrameProcessor,
    private entryNode: AudioWorkletNode
  ) {}

  pause = () => {
    const ev = this.frameProcessor.pause();
    this.handleFrameProcessorEvent(ev);
  };

  start = () => {
    this.frameProcessor.resume();
  };

  receive = (node: AudioNode) => {
    node.connect(this.entryNode);
  };

  processFrame = async (frame: Float32Array) => {
    const ev = await this.frameProcessor.process(frame); // 处理每一帧数据，来判断是否有中断之类的 以及开始,它这里面有个累积的数据
    this.handleFrameProcessorEvent(ev);
  };

  handleFrameProcessorEvent = (
    ev: Partial<{
      probs: SpeechProbabilities;
      msg: Message;
      audio: Float32Array;
      speaking: boolean;
    }>
  ) => {
    if (ev.probs !== undefined) {
      this.options.onFrameProcessed(ev.probs, ev.speaking);
    }
    switch (ev.msg) {
      case Message.SpeechStart:
        this.options.onSpeechStart(ev.audio as Float32Array);
        break;

      case Message.VADMisfire:
        this.options.onVADMisfire();
        break;

      case Message.SpeechEnd:
        this.options.onSpeechEnd(ev.audio as Float32Array);
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
