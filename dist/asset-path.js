// nextjs@14 bundler may attempt to execute this during SSR and crash
const isWeb = typeof window !== "undefined" && typeof window.document !== "undefined";
const currentScript = isWeb
    ? window.document.currentScript
    : null;
let basePath = "/";
if (currentScript) {
    basePath = currentScript.src
        .replace(/#.*$/, "")
        .replace(/\?.*$/, "")
        .replace(/\/[^\/]+$/, "/");
}
export const assetPath = (file) => {
    return basePath + file;
};
//# sourceMappingURL=asset-path.js.map