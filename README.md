# vad 使用介绍

Prompt your user for microphone permissions and run callbacks on segments of audio with user speech in a few lines of code.

Quick start:

```html
<script src="./dist/bundle.min.js"></script>
<script>
  async function main() {
    const myvad = await vad.MicVAD.new({
      onSpeechStart: (audio) => {
        console.log("Detected speech start",audio);
      },
      onSpeechEnd: (audio) => {
        console.log("Detected speech end");
      },
      onFrameProcessed: (probabilities, audio) => {
        console.log("Frame processed");
      },
    });
    myvad.start();
  }
  main();
</script>
```
