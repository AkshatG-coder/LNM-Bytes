import cron from 'node-cron'
console.log("Cron system initialized")
cron.schedule("*/2 * * * *",()=>{
    console.log("Cron running in backend",new Date().toLocaleTimeString())
})
