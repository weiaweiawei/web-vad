const prod = { mode: "production", suffix: "min" }

const workletConfig = ({ mode, suffix }) => {
  return {
    mode,
    entry: { worklet: "./dist/worklet.js" },
    output: {
      filename: `vad.worklet.bundle.${suffix}.js`,
    },
  }
}

module.exports = [workletConfig(prod)]
