import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {createBrowserRouter,Router, RouterProvider} from "react-router-dom"
import { MenuCard } from './Components/MenuCard.tsx'
import { CanteenShop } from './Components/CanteenShop.tsx'
import { Provider } from 'react-redux'
import { store } from './Util/store.ts'
import { Cart_Details } from './Components/Cart_Details.tsx'
import { CanteenStoreAddition } from './Components/SuperAdminStoreAdditon.tsx'
import ErrorPage from './Components/Error_Page.tsx'
const router=createBrowserRouter([
  {
    path:"/",
    element:<App/>,
    errorElement:<ErrorPage/>,
    children:[{
      path:"/",
      element:<CanteenShop/>
    },{
      path:"/menu_card_shop/:id",
      element:<MenuCard/>
    },{
      path:"/cart",
      element:<Cart_Details/>
    },{
      path:"/canteenstoreAddition",
      element:<CanteenStoreAddition/>
    }]
  }
])
createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <RouterProvider router={router}/>
  </Provider>,
)
