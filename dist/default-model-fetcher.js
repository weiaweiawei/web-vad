export const defaultModelFetcher = (path) => {
    return fetch(path).then((model) => model.arrayBuffer());
};
//# sourceMappingURL=default-model-fetcher.js.map