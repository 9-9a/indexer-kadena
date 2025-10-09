export const initializeMemoryMonitoring = () => {
  const memoryMonitoringInterval = 1000 * 60 * 30; // 30 minutes
  setInterval(monitorMemoryUsage, memoryMonitoringInterval);
};

const monitorMemoryUsage = () => {
  const mem = process.memoryUsage();
  const heapUsedMB = mem.heapUsed / 1024 / 1024;
  const heapInfo = `Heap: ${heapUsedMB.toFixed(2)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB`;
  const externalInfo = `External: ${(mem.external / 1024 / 1024).toFixed(2)}MB`;
  const rssInfo = `RSS: ${(mem.rss / 1024 / 1024).toFixed(2)}MB`;
  console.info(`[INFO][MEMORY] ${heapInfo} | ${externalInfo} | ${rssInfo}`);
};
