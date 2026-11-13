// The one place that loads transformers.js (dynamically, admin only), so
// tests can stand in for the model.
export const loadTransformers = () => import("@huggingface/transformers")
