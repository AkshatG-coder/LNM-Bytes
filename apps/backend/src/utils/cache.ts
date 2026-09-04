import NodeCache from "node-cache";

// StdTTL sets standard time-to-live in seconds.
// We set it to 3600 seconds (1 hour). 
// The cache will automatically delete data after 1 hour.
const appCache = new NodeCache({ stdTTL: 3600 });

export default appCache;
