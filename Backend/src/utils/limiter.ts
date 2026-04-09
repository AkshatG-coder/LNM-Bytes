import {rateLimit} from "express-rate-limit"
const limiter=rateLimit({
    windowMs:15*60*60,
    limit:100,
    message:"Cool Down Bro!! You are hitting too Hard",
    statusCode:429,
    standardHeaders:'draft-8',
    legacyHeaders:false,
    ipv6Subnet:56,
})
export {limiter}