import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { limiter } from './utils/limiter'
import helmet from 'helmet'
import PinoHttp, { pinoHttp } from 'pino-http'
import logger from "./utils/logger"
import { Store_Router } from './Routers/Store_Router'
import { MenuItemRouter } from './Routers/Menu_Item_Router'
import { Auth_Router } from './Routers/Auth_Router'
import { Order_Router } from './Routers/Order_Router'
//import "./Crons/storeCrone"
const app=express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))
app.use(limiter)
app.use(helmet())
app.use(cors({
  origin:"*",
  credentials:true
}))
app.use(
  pinoHttp({
    logger,
    serializers:{
        req:()=>undefined
    },
    customLogLevel: (res, err) => {
      const code = res.statusCode ?? 200;
      if (err || code >= 500) return "error";
      if (code >= 400) return "warn";
      return "info";
    }
  })
);

app.use((
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  req.log.error({
    err,
    body:req.body
  },"Unhandled error")
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message
  });
});

app.use("/store_handler", Store_Router)
app.use("/menu_item", MenuItemRouter)
app.use("/auth", Auth_Router)
app.use("/order", Order_Router)
export {app}
