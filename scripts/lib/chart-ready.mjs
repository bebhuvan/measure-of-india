// Shared bounded lifecycle gate; do not inspect partially rendered documents.
export async function awaitChartJobs(doc, timeoutMs = 120000) {
  let timer;
  try {
    const finish = async () => {
      let seen=0;
      do {
        const jobs=doc.__atlasChartJobs ?? [];
        seen=jobs.length;
        await Promise.all(jobs.map(job=>job.promise));
        for(const job of jobs)if(job.completed!==job.total||job.errors.length)throw Error(`Incomplete charts: ${job.completed}/${job.total}`);
      } while((doc.__atlasChartJobs?.length ?? 0)!==seen);
    };
    await Promise.race([finish(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Chart readiness timed out')),timeoutMs);})]);
  } finally { clearTimeout(timer); }
}
