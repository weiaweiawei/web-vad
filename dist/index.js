import * as ort from "onnxruntime-web";
import { utils as _utils, PlatformAgnosticNonRealTimeVAD, FrameProcessor, Message, } from "./_common";
import { audioFileToArray } from "./utils";
import { defaultModelFetcher } from "./default-model-fetcher";
import { assetPath } from "./asset-path";
export const defaultNonRealTimeVADOptions = {
    modelURL: assetPath("silero_vad.onnx"),
    modelFetcher: defaultModelFetcher,
};
class NonRealTimeVAD extends PlatformAgnosticNonRealTimeVAD {
    static async new(options = {}) {
        const { modelURL, modelFetcher } = {
            ...defaultNonRealTimeVADOptions,
            ...options,
        };
        return await this._new(() => modelFetcher(modelURL), ort, options);
    }
}
export const utils = { audioFileToArray, ..._utils };
export { FrameProcessor, Message, NonRealTimeVAD };
export { MicVAD, AudioNodeVAD, defaultRealTimeVADOptions, } from "./real-time-vad";
//# sourceMappingURL=index.js.map