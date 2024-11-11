/*
Some of this code, together with the default options found in index.ts,
were taken (or took inspiration) from https://github.com/snakers4/silero-vad
*/
import { Message } from "./messages";
import { log } from "./logging";
const RECOMMENDED_FRAME_SAMPLES = [512, 1024, 1536];
export const defaultFrameProcessorOptions = {
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.5 - 0.15,
    preSpeechPadFrames: 1,
    redemptionFrames: 8,
    frameSamples: 1536,
    minSpeechFrames: 4,
    submitUserSpeechOnPause: false, // 设为 false，表示暂停时不提交语音片段，直接重置或丢弃未完成的语音检测。
};
export function validateOptions(options) {
    if (!RECOMMENDED_FRAME_SAMPLES.includes(options.frameSamples)) {
        log.warn("You are using an unusual frame size");
    }
    if (options.positiveSpeechThreshold < 0 ||
        options.negativeSpeechThreshold > 1) {
        log.error("postiveSpeechThreshold should be a number between 0 and 1");
    }
    if (options.negativeSpeechThreshold < 0 ||
        options.negativeSpeechThreshold > options.positiveSpeechThreshold) {
        log.error("negativeSpeechThreshold should be between 0 and postiveSpeechThreshold");
    }
    if (options.preSpeechPadFrames < 0) {
        log.error("preSpeechPadFrames should be positive");
    }
    if (options.redemptionFrames < 0) {
        log.error("preSpeechPadFrames should be positive");
    }
}
const concatArrays = (arrays) => {
    const sizes = arrays.reduce((out, next) => {
        out.push(out.at(-1) + next.length);
        return out;
    }, [0]);
    const outArray = new Float32Array(sizes.at(-1));
    arrays.forEach((arr, index) => {
        const place = sizes[index];
        outArray.set(arr, place);
    });
    return outArray;
};
export class FrameProcessor {
    modelProcessFunc;
    modelResetFunc;
    options;
    speaking = false;
    audioBuffer;
    redemptionCounter = 0;
    active = false;
    constructor(modelProcessFunc, modelResetFunc, options) {
        this.modelProcessFunc = modelProcessFunc;
        this.modelResetFunc = modelResetFunc;
        this.options = options;
        this.audioBuffer = [];
        this.reset();
    }
    reset = () => {
        this.speaking = false;
        this.audioBuffer = [];
        this.modelResetFunc();
        this.redemptionCounter = 0;
    };
    pause = () => {
        this.active = false;
        if (this.options.submitUserSpeechOnPause) {
            return this.endSegment();
        }
        else {
            this.reset();
            return {};
        }
    };
    resume = () => {
        this.active = true;
    };
    endSegment = () => {
        const audioBuffer = this.audioBuffer;
        this.audioBuffer = [];
        const speaking = this.speaking;
        this.reset();
        const speechFrameCount = audioBuffer.reduce((acc, item) => {
            return acc + +item.isSpeech;
        }, 0);
        if (speaking) {
            if (speechFrameCount >= this.options.minSpeechFrames) {
                const audio = concatArrays(audioBuffer.map((item) => item.frame));
                return { msg: Message.SpeechEnd, audio };
            }
            else {
                return { msg: Message.VADMisfire };
            }
        }
        return {};
    };
    process = async (frame) => {
        if (!this.active) {
            return {};
        }
        const probs = await this.modelProcessFunc(frame);
        this.audioBuffer.push({
            frame,
            isSpeech: probs.isSpeech >= this.options.positiveSpeechThreshold,
        });
        if (probs.isSpeech >= this.options.positiveSpeechThreshold &&
            this.redemptionCounter) {
            this.redemptionCounter = 0; // 重置静音帧计算数量
        }
        const audioBuffer = this.audioBuffer;
        const speechFrameCount = audioBuffer.reduce((acc, item) => {
            return acc + +item.isSpeech;
        }, 0);
        console.log("speechFrameCount", speechFrameCount, "exitLength", this.audioBuffer.length);
        if (speechFrameCount >= this.options.minSpeechFrames && !this.speaking) {
            this.speaking = true;
            // const audio = concatArrays(audioBuffer.map((item) => item.frame)); // 合并音频
            console.log("开始讲话", speechFrameCount);
            const audio = concatArrays(audioBuffer.map((item) => item.frame));
            return { probs, msg: Message.SpeechStart, audio };
        }
        // if (
        //   probs.isSpeech >= this.options.positiveSpeechThreshold &&
        //   !this.speaking
        // ) {
        //   this.speaking = true;
        //   return { probs, msg: Message.SpeechStart }; // 开始说话
        // }
        if (probs.isSpeech < this.options.negativeSpeechThreshold &&
            this.speaking &&
            ++this.redemptionCounter >= this.options.redemptionFrames) {
            // 静音模式
            this.redemptionCounter = 0;
            this.speaking = false;
            const audioBuffer = this.audioBuffer;
            this.audioBuffer = [];
            const audio = concatArrays(audioBuffer.map((item) => item.frame)); // 合并音频
            return { probs, msg: Message.SpeechEnd, audio }; // 结束说话
            // const speechFrameCount = audioBuffer.reduce((acc, item) => {
            //   return acc + +item.isSpeech;
            // }, 0);
            // if (speechFrameCount >= this.options.minSpeechFrames) {
            //   const audio = concatArrays(audioBuffer.map((item) => item.frame)); // 合并音频
            //   return { probs, msg: Message.SpeechEnd, audio }; // 结束说话
            // } else {
            //   console.log("丢弃的音频：", audioBuffer);
            //   return { probs, msg: Message.VADMisfire };
            // }
        }
        if (!this.speaking) {
            while (this.audioBuffer.length > this.options.preSpeechPadFrames) {
                // 只保留制定数量的音频帧，保留最新的
                this.audioBuffer.shift();
            }
        }
        return { probs, speaking: this.speaking };
    };
}
//# sourceMappingURL=frame-processor.js.map