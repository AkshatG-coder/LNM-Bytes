import { useEffect,useState } from "react";
import { useDebounce } from "./useDebounce";
export function useSearch<T>(
    data:T[],
    searchFn:(item:T,search:string)=>boolean,
    delay=500
){
    const [searchText,setsearchText]=useState("")
    const debounceSearch=useDebounce(searchText,delay)
    const [filteredData,setFilteredData]=useState<T[]>(data)
    useEffect(()=>{
        if(!debounceSearch.trim()){
            setFilteredData(data)
            return;
        }
        const result=data.filter((item)=>searchFn(item,debounceSearch))
        setFilteredData(result)
    },[debounceSearch,data])
    return {
        searchText,
        setsearchText,
        filteredData,
        debounceSearch
    }
}