# va`

Prompt your user for microphone permissions and run callbacks on segments of audio with user speech in a few lines of code.

Quick start:

```html
<script src="./dist/bundle.min.js"></script>
<script>
  async function main() {
    const myvad = await vad.MicVAD.new({
      onSpeechStart: () => {
        console.log("Detected speech start");
      },
      onSpeechEnd: (audio) => {
        console.log("Detected speech end");
      },
      onFrameProcessed: (probabilities, audio) => {
        console.log("Frame processed");
      },

      onVADMisfired: () => {
        console.log("onVADMisfire  fire");
      },
    });
    myvad.start();
  }
  main();
</script>
```
