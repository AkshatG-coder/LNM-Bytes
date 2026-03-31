import { useEffect,useState } from "react";
export function useDebounce(value:string,delay=500){
    const [debounceValue,setdebounceValue]=useState(value)
    useEffect(()=>{
        const timer=setTimeout(()=>{
            setdebounceValue(value)
        },delay)
        return ()=> clearTimeout(timer)
    },[value,delay])
    return debounceValue
}