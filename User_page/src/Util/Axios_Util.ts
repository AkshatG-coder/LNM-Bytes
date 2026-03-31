import axios from "axios";
export const LNM_SERVER=axios.create({
    baseURL:"http://localhost:8081/",
    timeout:5000,
})