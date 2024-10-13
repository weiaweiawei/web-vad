export class Silero {
    ort;
    modelFetcher;
    _session;
    _h;
    _c;
    _sr;
    constructor(ort, modelFetcher) {
        this.ort = ort;
        this.modelFetcher = modelFetcher;
    }
    static new = async (ort, modelFetcher) => {
        const model = new Silero(ort, modelFetcher);
        await model.init();
        return model;
    };
    init = async () => {
        console.log("VAD 正在初始化");
        const modelArrayBuffer = await this.modelFetcher();
        this._session = await this.ort.InferenceSession.create(modelArrayBuffer);
        this._sr = new this.ort.Tensor("int64", [16000n]);
        this.reset_state();
        console.log("VAD 初始化完成", modelArrayBuffer);
    };
    reset_state = () => {
        const zeroes = Array(2 * 64).fill(0);
        this._h = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
        this._c = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
    };
    process = async (audioFrame) => {
        const t = new this.ort.Tensor("float32", audioFrame, [1, audioFrame.length]);
        const inputs = {
            input: t,
            h: this._h,
            c: this._c,
            sr: this._sr,
        };
        const out = await this._session.run(inputs);
        this._h = out.hn;
        this._c = out.cn;
        const [isSpeech] = out.output.data;
        const notSpeech = 1 - isSpeech;
        return { notSpeech, isSpeech, audioFrame };
    };
}
//# sourceMappingURL=models.js.map